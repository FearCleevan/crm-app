-- Migration 006: RLS policies for campaign tables and email_templates

-- Enable RLS on new tables
ALTER TABLE public.email_campaigns        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_recipients    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events           ENABLE ROW LEVEL SECURITY;

-- email_campaigns: user manages own campaigns
-- crm_users.auth_id links to auth.uid()
DROP POLICY IF EXISTS "Users manage own campaigns" ON public.email_campaigns;
CREATE POLICY "Users manage own campaigns"
ON public.email_campaigns FOR ALL
USING (
  user_id IN (
    SELECT id FROM public.crm_users WHERE auth_id = auth.uid()
  )
);

-- campaign_recipients: accessible if parent campaign belongs to user
DROP POLICY IF EXISTS "Users access own campaign recipients" ON public.campaign_recipients;
CREATE POLICY "Users access own campaign recipients"
ON public.campaign_recipients FOR ALL
USING (
  campaign_id IN (
    SELECT ec.id
    FROM public.email_campaigns ec
    JOIN public.crm_users cu ON cu.id = ec.user_id
    WHERE cu.auth_id = auth.uid()
  )
);

-- email_events: accessible if parent campaign belongs to user
DROP POLICY IF EXISTS "Users access own email events" ON public.email_events;
CREATE POLICY "Users access own email events"
ON public.email_events FOR ALL
USING (
  campaign_id IN (
    SELECT ec.id
    FROM public.email_campaigns ec
    JOIN public.crm_users cu ON cu.id = ec.user_id
    WHERE cu.auth_id = auth.uid()
  )
);

-- email_templates: policy using created_by (existing column — NOT user_id)
DROP POLICY IF EXISTS "Users manage own templates" ON public.email_templates;
CREATE POLICY "Users manage own templates"
ON public.email_templates FOR ALL
USING (
  created_by IN (
    SELECT id FROM public.crm_users WHERE auth_id = auth.uid()
  )
);
