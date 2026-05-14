export const ROLES = {
  SUPER_ADMIN: 'Super Admin',
  DATA_ANALYST: 'Data Analyst',
  AGENT: 'Agent',
} as const

export type RoleName = (typeof ROLES)[keyof typeof ROLES]

export const PERMISSIONS = {
  // Prospects / Leads
  LEADS_VIEW:   'leads_view',
  LEADS_CREATE: 'leads_create',
  LEADS_EDIT:   'leads_edit',
  LEADS_DELETE: 'leads_delete',
  LEADS_IMPORT: 'leads_import',
  LEADS_EXPORT: 'leads_export',
  // Deals
  DEALS_VIEW:   'deals_view',
  DEALS_CREATE: 'deals_create',
  DEALS_EDIT:   'deals_edit',
  DEALS_DELETE: 'deals_delete',
  // Reports
  REPORTS_VIEW: 'reports_view',
  // Emails
  EMAILS_VIEW:  'emails_view',
  EMAILS_SEND:  'emails_send',
  // Workflows
  WORKFLOWS_VIEW:   'workflows_view',
  WORKFLOWS_MANAGE: 'workflows_manage',
  // Users
  USERS_VIEW:   'users_view',
  USERS_CREATE: 'users_create',
  USERS_EDIT:   'users_edit',
  USERS_DELETE: 'users_delete',
  // Settings
  SETTINGS_VIEW:   'settings_view',
  SETTINGS_MANAGE: 'settings_manage',
  IP_MANAGE:       'ip_manage',
} as const

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

export const ROLE_PERMISSIONS: Record<RoleName, PermissionKey[]> = {
  'Super Admin': Object.values(PERMISSIONS) as PermissionKey[],
  'Data Analyst': [
    'leads_view', 'leads_create', 'leads_edit', 'leads_import', 'leads_export',
    'deals_view', 'deals_create', 'deals_edit',
    'reports_view',
    'emails_view', 'emails_send',
    'workflows_view',
    'users_view',
    'settings_view',
  ],
  'Agent': [
    'leads_view', 'leads_create', 'leads_edit',
    'deals_view',
    'emails_view', 'emails_send',
    'settings_view',
  ],
}
