-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.crm_users (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  auth_id uuid UNIQUE,
  email text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'Agent'::text CHECK (role = ANY (ARRAY['Super Admin'::text, 'Data Analyst'::text, 'Agent'::text])),
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  first_name character varying,
  middle_name character varying,
  last_name character varying,
  profile_url text,
  birthday date,
  phone_no character varying,
  address text,
  department character varying,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_login timestamp with time zone,
  CONSTRAINT crm_users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.leads (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  email text,
  phone text,
  company text,
  source text,
  status text NOT NULL DEFAULT 'new'::text CHECK (status = ANY (ARRAY['new'::text, 'contacted'::text, 'qualified'::text, 'unqualified'::text, 'converted'::text])),
  score integer DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  assigned_to uuid,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT leads_pkey PRIMARY KEY (id),
  CONSTRAINT leads_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.crm_users(id)
);
CREATE TABLE public.contacts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  email text,
  phone text,
  company text,
  position text,
  lead_id uuid,
  deal_id uuid,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT contacts_pkey PRIMARY KEY (id),
  CONSTRAINT contacts_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id)
);
CREATE TABLE public.activities (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  type text NOT NULL CHECK (type = ANY (ARRAY['call'::text, 'email'::text, 'meeting'::text, 'task'::text, 'note'::text, 'status'::text])),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'completed'::text, 'cancelled'::text])),
  due_date timestamp with time zone,
  completed_at timestamp with time zone,
  lead_id uuid,
  deal_id uuid,
  contact_id uuid,
  assigned_to uuid,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  prospect_id bigint,
  external_id text,
  CONSTRAINT activities_pkey PRIMARY KEY (id),
  CONSTRAINT activities_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id),
  CONSTRAINT activities_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id),
  CONSTRAINT activities_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.crm_users(id),
  CONSTRAINT activities_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.crm_users(id),
  CONSTRAINT activities_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id),
  CONSTRAINT activities_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.prospects(id)
);
CREATE TABLE public.email_templates (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'general'::text CHECK (category = ANY (ARRAY['general'::text, 'follow_up'::text, 'introduction'::text, 'proposal'::text, 'closing'::text, 're_engagement'::text, 'newsletter'::text])),
  subject text NOT NULL,
  body text NOT NULL,
  created_by uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT email_templates_pkey PRIMARY KEY (id),
  CONSTRAINT email_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.crm_users(id)
);
CREATE TABLE public.workflows (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  trigger_type text NOT NULL CHECK (trigger_type = ANY (ARRAY['lead_created'::text, 'deal_stage_changed'::text, 'activity_due'::text, 'manual'::text])),
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT workflows_pkey PRIMARY KEY (id),
  CONSTRAINT workflows_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.crm_users(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  type text NOT NULL DEFAULT 'info'::text CHECK (type = ANY (ARRAY['info'::text, 'success'::text, 'warning'::text, 'error'::text])),
  is_read boolean NOT NULL DEFAULT false,
  link text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.crm_users(id)
);
CREATE TABLE public.favorites (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  label text NOT NULL,
  url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT favorites_pkey PRIMARY KEY (id),
  CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.crm_users(id)
);
CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  label text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT projects_pkey PRIMARY KEY (id),
  CONSTRAINT projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.crm_users(id)
);
CREATE TABLE public.permission_modules (
  module_id integer NOT NULL DEFAULT nextval('permission_modules_module_id_seq'::regclass),
  module_name character varying NOT NULL,
  description text,
  category character varying CHECK (category::text = ANY (ARRAY['crm'::character varying, 'activities'::character varying, 'account_settings'::character varying]::text[])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT permission_modules_pkey PRIMARY KEY (module_id)
);
CREATE TABLE public.permission_roles (
  role_id integer NOT NULL DEFAULT nextval('permission_roles_role_id_seq'::regclass),
  role_name character varying NOT NULL,
  description text,
  is_system_role boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT permission_roles_pkey PRIMARY KEY (role_id)
);
CREATE TABLE public.permissions (
  permission_id integer NOT NULL DEFAULT nextval('permissions_permission_id_seq'::regclass),
  module_id integer,
  permission_name character varying NOT NULL,
  permission_key character varying NOT NULL UNIQUE,
  description text,
  CONSTRAINT permissions_pkey PRIMARY KEY (permission_id),
  CONSTRAINT permissions_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.permission_modules(module_id)
);
CREATE TABLE public.role_permissions (
  role_permission_id integer NOT NULL DEFAULT nextval('role_permissions_role_permission_id_seq'::regclass),
  role_id integer,
  permission_id integer,
  has_permission boolean DEFAULT false,
  CONSTRAINT role_permissions_pkey PRIMARY KEY (role_permission_id),
  CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.permission_roles(role_id),
  CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(permission_id)
);
CREATE TABLE public.user_roles (
  user_role_id integer NOT NULL DEFAULT nextval('user_roles_user_role_id_seq'::regclass),
  user_id uuid,
  role_id integer,
  CONSTRAINT user_roles_pkey PRIMARY KEY (user_role_id),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.crm_users(id),
  CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.permission_roles(role_id)
);
CREATE TABLE public.prospects (
  id bigint NOT NULL DEFAULT nextval('prospects_id_seq'::regclass),
  fullname character varying,
  firstname character varying,
  lastname character varying,
  jobtitle character varying,
  company character varying,
  website character varying,
  personallinkedin character varying,
  companylinkedin character varying,
  altphonenumber character varying DEFAULT '0'::character varying,
  companyphonenumber character varying DEFAULT '0'::character varying,
  email character varying UNIQUE,
  emailcode character varying,
  address character varying,
  street character varying,
  city character varying,
  state character varying,
  postalcode character varying,
  country character varying,
  annualrevenue numeric DEFAULT 0,
  industry character varying,
  employeesize integer DEFAULT 0,
  siccode integer DEFAULT 0,
  naicscode integer DEFAULT 0,
  dispositioncode character varying,
  providercode character varying,
  comments text,
  isactive boolean DEFAULT true,
  status character varying DEFAULT 'New'::character varying CHECK (status::text = ANY (ARRAY['New'::character varying, 'Contacted'::character varying, 'Qualified'::character varying, 'Closed'::character varying]::text[])),
  department character varying,
  seniority character varying,
  created_by uuid,
  created_on timestamp with time zone DEFAULT now(),
  updated_by uuid,
  updated_on timestamp with time zone,
  search_vector tsvector DEFAULT ((((((setweight(to_tsvector('simple'::regconfig, (COALESCE(fullname, ''::character varying))::text), 'A'::"char") || setweight(to_tsvector('simple'::regconfig, (COALESCE(email, ''::character varying))::text), 'A'::"char")) || setweight(to_tsvector('simple'::regconfig, (COALESCE(company, ''::character varying))::text), 'B'::"char")) || setweight(to_tsvector('simple'::regconfig, (COALESCE(jobtitle, ''::character varying))::text), 'B'::"char")) || setweight(to_tsvector('simple'::regconfig, (COALESCE(city, ''::character varying))::text), 'C'::"char")) || setweight(to_tsvector('simple'::regconfig, (COALESCE(state, ''::character varying))::text), 'C'::"char")) || setweight(to_tsvector('simple'::regconfig, (COALESCE(country, ''::character varying))::text), 'C'::"char")),
  CONSTRAINT prospects_pkey PRIMARY KEY (id),
  CONSTRAINT prospects_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.crm_users(id),
  CONSTRAINT prospects_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.crm_users(id)
);
CREATE TABLE public.prospects_disposition (
  disposition_code character varying NOT NULL,
  disposition_name character varying NOT NULL,
  CONSTRAINT prospects_disposition_pkey PRIMARY KEY (disposition_code)
);
CREATE TABLE public.prospects_email_status (
  email_code character varying NOT NULL,
  email_name character varying NOT NULL,
  CONSTRAINT prospects_email_status_pkey PRIMARY KEY (email_code)
);
CREATE TABLE public.prospects_provider (
  provider_code character varying NOT NULL,
  provider_name character varying NOT NULL,
  CONSTRAINT prospects_provider_pkey PRIMARY KEY (provider_code)
);
CREATE TABLE public.prospects_country (
  country_code character varying NOT NULL,
  country_name character varying NOT NULL,
  CONSTRAINT prospects_country_pkey PRIMARY KEY (country_code)
);
CREATE TABLE public.prospects_industry (
  industry_code character varying NOT NULL,
  industry_name character varying NOT NULL,
  CONSTRAINT prospects_industry_pkey PRIMARY KEY (industry_code)
);
CREATE TABLE public.import_sessions (
  id integer NOT NULL DEFAULT nextval('import_sessions_id_seq'::regclass),
  session_id character varying NOT NULL,
  total_chunks integer NOT NULL,
  processed_chunks integer DEFAULT 0,
  total_prospects integer NOT NULL,
  successful_imports integer DEFAULT 0,
  failed_imports integer DEFAULT 0,
  chunk_errors jsonb,
  status character varying DEFAULT 'processing'::character varying CHECK (status::text = ANY (ARRAY['processing'::character varying, 'completed'::character varying, 'failed'::character varying]::text[])),
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  CONSTRAINT import_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT import_sessions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.crm_users(id)
);
CREATE TABLE public.ip_whitelist (
  id integer NOT NULL DEFAULT nextval('ip_whitelist_id_seq'::regclass),
  ip_address character varying NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ip_whitelist_pkey PRIMARY KEY (id)
);
CREATE TABLE public.ip_blacklist (
  id integer NOT NULL DEFAULT nextval('ip_blacklist_id_seq'::regclass),
  ip_address character varying NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ip_blacklist_pkey PRIMARY KEY (id)
);
CREATE TABLE public.system_settings (
  id integer NOT NULL DEFAULT nextval('system_settings_id_seq'::regclass),
  setting_key character varying NOT NULL UNIQUE,
  setting_value text,
  description text,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid,
  CONSTRAINT system_settings_pkey PRIMARY KEY (id),
  CONSTRAINT system_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.crm_users(id)
);
CREATE TABLE public.user_requests (
  request_id integer NOT NULL DEFAULT nextval('user_requests_request_id_seq'::regclass),
  user_id uuid,
  request_type character varying,
  status character varying DEFAULT 'pending'::character varying,
  token text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_requests_pkey PRIMARY KEY (request_id),
  CONSTRAINT user_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.crm_users(id)
);
CREATE TABLE public.rate_limits (
  id integer NOT NULL DEFAULT nextval('rate_limits_id_seq'::regclass),
  rate_key character varying NOT NULL,
  endpoint character varying NOT NULL,
  request_count integer DEFAULT 1,
  window_start timestamp with time zone DEFAULT now(),
  CONSTRAINT rate_limits_pkey PRIMARY KEY (id)
);
CREATE TABLE public.deals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  prospect_id integer,
  prospect_name text NOT NULL DEFAULT ''::text,
  company text NOT NULL DEFAULT ''::text,
  stage text NOT NULL DEFAULT 'New Lead'::text CHECK (stage = ANY (ARRAY['New Lead'::text, 'Contacted'::text, 'Qualified'::text, 'Proposal Sent'::text, 'Negotiation'::text, 'Closed Won'::text, 'Closed Lost'::text])),
  value numeric NOT NULL DEFAULT 0,
  probability integer NOT NULL DEFAULT 10 CHECK (probability >= 0 AND probability <= 100),
  expected_close_date date NOT NULL DEFAULT CURRENT_DATE,
  assigned_to uuid,
  stage_changed_at timestamp with time zone NOT NULL DEFAULT now(),
  sort_order integer NOT NULL DEFAULT 0,
  description text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT deals_pkey PRIMARY KEY (id),
  CONSTRAINT deals_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.prospects(id),
  CONSTRAINT deals_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.crm_users(id),
  CONSTRAINT deals_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.crm_users(id)
);
CREATE TABLE public.error_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  error_message text NOT NULL,
  stack_trace text,
  page text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT error_logs_pkey PRIMARY KEY (id),
  CONSTRAINT error_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.api_keys (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  last_used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT api_keys_pkey PRIMARY KEY (id),
  CONSTRAINT api_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.crm_users(id)
);
CREATE TABLE public.integrations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  label text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active'::text,
  last_synced_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT integrations_pkey PRIMARY KEY (id),
  CONSTRAINT integrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.crm_users(id)
);
CREATE TABLE public.webhook_endpoints (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  url text NOT NULL,
  events ARRAY NOT NULL DEFAULT '{}'::text[],
  secret text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT webhook_endpoints_pkey PRIMARY KEY (id),
  CONSTRAINT webhook_endpoints_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.crm_users(id)
);
CREATE TABLE public.pipeline_sessions (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  file_name text NOT NULL,
  file_rows integer NOT NULL DEFAULT 0,
  mapped_rows integer NOT NULL DEFAULT 0,
  skipped_rows integer NOT NULL DEFAULT 0,
  imported_rows integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'mapping'::text, 'importing'::text, 'done'::text, 'failed'::text])),
  error_message text,
  column_map jsonb,
  notes text,
  CONSTRAINT pipeline_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT pipeline_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);