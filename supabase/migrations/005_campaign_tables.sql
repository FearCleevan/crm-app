-- Migration 005: New campaign tables, indexes, triggers, SQL function

-- =============================================
-- TABLE: email_campaigns
-- =============================================
CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL
    REFERENCES public.crm_users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  template_id uuid
    REFERENCES public.email_templates(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status = ANY (ARRAY['draft','active','paused','completed'])),
  daily_limit integer NOT NULL DEFAULT 50
    CHECK (daily_limit >= 10 AND daily_limit <= 500),
  send_from_hour integer NOT NULL DEFAULT 9
    CHECK (send_from_hour >= 0 AND send_from_hour <= 23),
  send_to_hour integer NOT NULL DEFAULT 17
    CHECK (send_to_hour >= 0 AND send_to_hour <= 23),
  send_days text[] NOT NULL DEFAULT ARRAY['Mon','Tue','Wed','Thu','Fri'],
  warmup_enabled boolean NOT NULL DEFAULT false,
  total_recipients integer NOT NULL DEFAULT 0,
  total_sent integer NOT NULL DEFAULT 0,
  total_opened integer NOT NULL DEFAULT 0,
  total_clicked integer NOT NULL DEFAULT 0,
  total_replied integer NOT NULL DEFAULT 0,
  total_bounced integer NOT NULL DEFAULT 0,
  total_unsubscribed integer NOT NULL DEFAULT 0,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT email_campaigns_pkey PRIMARY KEY (id)
);

-- =============================================
-- TABLE: campaign_recipients
-- prospect_id is BIGINT — matches prospects.id (bigint)
-- =============================================
CREATE TABLE IF NOT EXISTS public.campaign_recipients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL
    REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  prospect_id bigint NOT NULL
    REFERENCES public.prospects(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY[
      'pending','sent','opened','clicked','replied','bounced','unsubscribed'
    ])),
  resend_message_id text,
  sent_at timestamp with time zone,
  opened_at timestamp with time zone,
  clicked_at timestamp with time zone,
  replied_at timestamp with time zone,
  bounced_at timestamp with time zone,
  unsubscribed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT campaign_recipients_pkey PRIMARY KEY (id),
  CONSTRAINT campaign_recipients_unique UNIQUE (campaign_id, prospect_id)
);

-- =============================================
-- TABLE: email_events
-- =============================================
CREATE TABLE IF NOT EXISTS public.email_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid
    REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  recipient_id uuid
    REFERENCES public.campaign_recipients(id) ON DELETE CASCADE,
  prospect_id bigint
    REFERENCES public.prospects(id) ON DELETE CASCADE,
  event_type text NOT NULL
    CHECK (event_type = ANY (ARRAY[
      'sent','opened','clicked','replied','bounced','unsubscribed'
    ])),
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT email_events_pkey PRIMARY KEY (id)
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_email_campaigns_user_id      ON public.email_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status       ON public.email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON public.campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_prospect ON public.campaign_recipients(prospect_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status   ON public.campaign_recipients(status);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_resend
  ON public.campaign_recipients(resend_message_id)
  WHERE resend_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_events_campaign        ON public.email_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_events_prospect        ON public.email_events(prospect_id);
CREATE INDEX IF NOT EXISTS idx_email_events_type            ON public.email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_events_occurred        ON public.email_events(occurred_at DESC);

-- =============================================
-- TRIGGER: updated_at auto-maintain
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_email_campaigns_updated_at ON public.email_campaigns;
CREATE TRIGGER trg_email_campaigns_updated_at
  BEFORE UPDATE ON public.email_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- TRIGGER: campaign aggregate counters
-- =============================================
CREATE OR REPLACE FUNCTION update_campaign_counters()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'sent' AND OLD.status = 'pending' THEN
    UPDATE public.email_campaigns SET total_sent = total_sent + 1 WHERE id = NEW.campaign_id;
  ELSIF NEW.status = 'opened' AND OLD.status NOT IN ('opened','clicked','replied','bounced') THEN
    UPDATE public.email_campaigns SET total_opened = total_opened + 1 WHERE id = NEW.campaign_id;
  ELSIF NEW.status = 'clicked' AND OLD.status NOT IN ('clicked','replied','bounced') THEN
    UPDATE public.email_campaigns SET total_clicked = total_clicked + 1 WHERE id = NEW.campaign_id;
  ELSIF NEW.status = 'replied' AND OLD.status NOT IN ('replied','bounced') THEN
    UPDATE public.email_campaigns SET total_replied = total_replied + 1 WHERE id = NEW.campaign_id;
  ELSIF NEW.status = 'bounced' AND OLD.status != 'bounced' THEN
    UPDATE public.email_campaigns SET total_bounced = total_bounced + 1 WHERE id = NEW.campaign_id;
  ELSIF NEW.status = 'unsubscribed' AND OLD.status != 'unsubscribed' THEN
    UPDATE public.email_campaigns SET total_unsubscribed = total_unsubscribed + 1 WHERE id = NEW.campaign_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_campaign_counters ON public.campaign_recipients;
CREATE TRIGGER trg_update_campaign_counters
  AFTER UPDATE ON public.campaign_recipients
  FOR EACH ROW EXECUTE FUNCTION update_campaign_counters();

-- =============================================
-- TRIGGER: recipient count
-- =============================================
CREATE OR REPLACE FUNCTION update_campaign_recipient_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.email_campaigns
  SET total_recipients = (
    SELECT COUNT(*) FROM public.campaign_recipients WHERE campaign_id = NEW.campaign_id
  )
  WHERE id = NEW.campaign_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_recipient_count ON public.campaign_recipients;
CREATE TRIGGER trg_update_recipient_count
  AFTER INSERT OR DELETE ON public.campaign_recipients
  FOR EACH ROW EXECUTE FUNCTION update_campaign_recipient_count();

-- =============================================
-- SQL FUNCTION: bulk add filtered prospects to campaign
-- =============================================
CREATE OR REPLACE FUNCTION add_filtered_prospects_to_campaign(
  p_campaign_id uuid,
  p_country text DEFAULT NULL,
  p_industry text DEFAULT NULL,
  p_seniority text DEFAULT NULL,
  p_limit integer DEFAULT 100
)
RETURNS integer AS $$
DECLARE
  inserted_count integer;
BEGIN
  INSERT INTO public.campaign_recipients (campaign_id, prospect_id, status)
  SELECT p_campaign_id, p.id, 'pending'
  FROM public.prospects p
  WHERE
    p.email IS NOT NULL
    AND p.isactive = true
    AND (p_country   IS NULL OR p.country   ILIKE p_country)
    AND (p_industry  IS NULL OR p.industry  ILIKE p_industry)
    AND (p_seniority IS NULL OR p.seniority ILIKE p_seniority)
    AND p.id NOT IN (
      SELECT prospect_id FROM public.campaign_recipients WHERE campaign_id = p_campaign_id
    )
  ORDER BY p.created_on DESC
  LIMIT p_limit
  ON CONFLICT (campaign_id, prospect_id) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
