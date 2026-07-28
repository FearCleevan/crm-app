export type EmailFolder = 'inbox' | 'sent' | 'drafts'

export interface EmailMessage {
  id: string
  folder: EmailFolder
  from: { name: string; email: string; avatar?: string }
  to: { name: string; email: string }[]
  cc?: { name: string; email: string }[]
  subject: string
  preview: string
  body: string
  date: string
  read: boolean
  starred: boolean
  hasAttachment: boolean
  attachments?: { name: string; size: string }[]
  labels?: string[]
}

const now = Date.now()
const d = (daysAgo: number) => new Date(now - daysAgo * 86400000).toISOString()

export const MOCK_EMAILS: EmailMessage[] = [
  {
    id: 'em-001', folder: 'inbox', read: false, starred: true, hasAttachment: true,
    from: { name: 'Alice Johnson', email: 'alice@techcorp.com' },
    to: [{ name: 'Me', email: 'me@paulcrm.com' }],
    subject: 'Re: Enterprise Plan Proposal — Feedback',
    preview: 'Thanks for sending over the proposal. We\'ve had a chance to review and overall the team is quite excited about the direction…',
    body: `<p>Hi,</p><p>Thanks for sending over the proposal. We've had a chance to review and overall the team is quite excited about the direction. A few things we'd like to clarify before moving forward:</p><ul><li>Can you confirm the onboarding timeline?</li><li>Is the API rate limit negotiable for our use case?</li><li>What's the SLA for enterprise support tickets?</li></ul><p>Looking forward to your response. Happy to jump on a call this week if that's easier.</p><p>Best,<br>Alice Johnson<br>VP Operations, TechCorp</p>`,
    date: d(0), attachments: [{ name: 'proposal-review.pdf', size: '2.4 MB' }], labels: ['important'],
  },
  {
    id: 'em-002', folder: 'inbox', read: false, starred: false, hasAttachment: false,
    from: { name: 'Marcus Lee', email: 'mlee@fingroup.com' },
    to: [{ name: 'Me', email: 'me@paulcrm.com' }],
    subject: 'Introduction — FinGroup potential partnership',
    preview: 'I came across Paul CRM through a recommendation from a mutual contact and thought there might be a great opportunity here…',
    body: `<p>Hello,</p><p>I came across Paul CRM through a recommendation from a mutual contact and thought there might be a great opportunity here for us to explore.</p><p>We're a mid-sized financial services firm with 200+ sales reps who are currently using legacy tools that are holding us back. We're actively evaluating modern CRM solutions for Q3 rollout.</p><p>Would you be open to a 30-minute discovery call next week?</p><p>Regards,<br>Marcus Lee<br>Head of Sales Ops, FinGroup</p>`,
    date: d(1), labels: ['lead'],
  },
  {
    id: 'em-003', folder: 'inbox', read: true, starred: false, hasAttachment: true,
    from: { name: 'Sarah Nguyen', email: 'snguyen@retailco.com.au' },
    to: [{ name: 'Me', email: 'me@paulcrm.com' }],
    subject: 'Contract Signed — Welcome to Paul CRM',
    preview: 'Attached please find the signed MSA and SOW for our Enterprise subscription. We\'re excited to get started…',
    body: `<p>Hi Team,</p><p>Attached please find the signed MSA and SOW for our Enterprise subscription. We're excited to get started and looking forward to the onboarding session scheduled for next Monday.</p><p>Please ensure the admin accounts are set up before then.</p><p>Thanks,<br>Sarah Nguyen<br>CTO, RetailCo</p>`,
    date: d(2), attachments: [{ name: 'MSA-signed.pdf', size: '1.1 MB' }, { name: 'SOW-signed.pdf', size: '890 KB' }], labels: ['closed-won'],
  },
  {
    id: 'em-004', folder: 'inbox', read: true, starred: false, hasAttachment: false,
    from: { name: 'James Patel', email: 'jpatel@cloudstartup.io' },
    to: [{ name: 'Me', email: 'me@paulcrm.com' }],
    subject: 'Quick question about data import limits',
    preview: 'Before we proceed, wanted to confirm — is there a limit on how many contacts we can import on the Growth plan?',
    body: `<p>Hi,</p><p>Before we proceed with the trial signup, I wanted to confirm — is there a limit on how many contacts we can import on the Growth plan? We have around 15,000 contacts we'd be migrating.</p><p>Also, does the plan include CSV and API import?</p><p>Thanks,<br>James Patel</p>`,
    date: d(3),
  },
  {
    id: 'em-005', folder: 'inbox', read: true, starred: false, hasAttachment: false,
    from: { name: 'Newsletter', email: 'noreply@saas-insights.com' },
    to: [{ name: 'Me', email: 'me@paulcrm.com' }],
    subject: 'SaaS Insights Weekly — Top CRM Trends This Month',
    preview: 'This week\'s edition covers AI-powered lead scoring, pipeline automation best practices, and a deep-dive into…',
    body: `<p>SaaS Insights Weekly</p><p>This week's edition covers AI-powered lead scoring, pipeline automation best practices, and a deep-dive into the top-performing CRM features of Q1.</p>`,
    date: d(5),
  },
  {
    id: 'em-006', folder: 'inbox', read: true, starred: true, hasAttachment: false,
    from: { name: 'Emily Watson', email: 'emily.w@consultco.com' },
    to: [{ name: 'Me', email: 'me@paulcrm.com' }],
    subject: 'Follow-up: Demo session yesterday',
    preview: 'Just wanted to say the demo was excellent. Our team was particularly impressed by the pipeline automation features…',
    body: `<p>Hi,</p><p>Just wanted to say the demo was excellent. Our team was particularly impressed by the pipeline automation features and the reporting dashboard.</p><p>We'll be presenting to our board next week and would love a one-pager summary to share. Could you prepare something?</p><p>Best,<br>Emily Watson</p>`,
    date: d(6),
  },
  {
    id: 'em-007', folder: 'sent', read: true, starred: false, hasAttachment: true,
    from: { name: 'Me', email: 'me@paulcrm.com' },
    to: [{ name: 'Alice Johnson', email: 'alice@techcorp.com' }],
    subject: 'Enterprise Plan Proposal — TechCorp',
    preview: 'Hi Alice, as discussed on our call, please find attached the tailored Enterprise Plan proposal for TechCorp…',
    body: `<p>Hi Alice,</p><p>As discussed on our call, please find attached the tailored Enterprise Plan proposal for TechCorp. I've included the custom pricing structure we discussed along with the onboarding plan.</p><p>Happy to walk through it on a call — I have availability Thursday 2–4 PM AEST.</p><p>Best regards,<br>Janson Williams<br>Paul CRM</p>`,
    date: d(1), attachments: [{ name: 'paul-crm-enterprise-proposal-techcorp.pdf', size: '3.2 MB' }],
  },
  {
    id: 'em-008', folder: 'sent', read: true, starred: false, hasAttachment: false,
    from: { name: 'Me', email: 'me@paulcrm.com' },
    to: [{ name: 'James Patel', email: 'jpatel@cloudstartup.io' }],
    subject: 'Re: Quick question about data import limits',
    preview: 'Hi James, great question! The Growth plan supports up to 25,000 contacts and yes, both CSV and API imports are included…',
    body: `<p>Hi James,</p><p>Great question! The Growth plan supports up to 25,000 contacts — so your 15,000 migration would be well within limits. Both CSV bulk import and REST API are included on all paid plans.</p><p>Would you like me to set up an extended 30-day trial so your team can evaluate at full scale?</p><p>Best,<br>Janson</p>`,
    date: d(2),
  },
  {
    id: 'em-009', folder: 'drafts', read: true, starred: false, hasAttachment: false,
    from: { name: 'Me', email: 'me@paulcrm.com' },
    to: [{ name: 'Marcus Lee', email: 'mlee@fingroup.com' }],
    subject: 'Re: Introduction — FinGroup potential partnership',
    preview: 'Hi Marcus, thanks for reaching out. I\'d love to set up that discovery call — I have availability…',
    body: `<p>Hi Marcus,</p><p>Thanks for reaching out! I'd love to set up that discovery call. I have availability next Tuesday from 10 AM – 12 PM and Thursday 2–4 PM AEST.</p><p>Please let me know which works best or feel free to use my calendar link: [calendar link]</p><p>Looking forward to connecting.</p><p>Best,<br>Janson</p>`,
    date: d(0),
  },
  {
    id: 'em-010', folder: 'drafts', read: true, starred: false, hasAttachment: false,
    from: { name: 'Me', email: 'me@paulcrm.com' },
    to: [{ name: 'Emily Watson', email: 'emily.w@consultco.com' }],
    subject: 'Paul CRM — One-Pager Summary',
    preview: 'Hi Emily, attached is the one-pager summary you requested for your board presentation…',
    body: `<p>Hi Emily,</p><p>Attached is the one-pager summary you requested for your board presentation. It covers our key differentiators, pricing overview, and customer success highlights.</p><p>Best,<br>Janson</p>`,
    date: d(1),
  },
]

export const TEMPLATE_CATEGORIES = [
  { value: 'general',          label: 'General'          },
  { value: 'follow_up',        label: 'Follow-up'        },
  { value: 'introduction',     label: 'Introduction'     },
  { value: 'proposal',         label: 'Proposal'         },
  { value: 'closing',          label: 'Closing'          },
  { value: 're_engagement',    label: 'Re-engagement'    },
  { value: 'newsletter',       label: 'Newsletter'       },
  { value: 'cold_outreach',    label: 'Cold Outreach'    },
  { value: 'no_website',       label: 'No Website'       },
  { value: 'outdated_website', label: 'Outdated Website' },
]
