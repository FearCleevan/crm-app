export interface Prospect {
  id: string
  fullname: string
  firstname: string
  lastname: string
  jobtitle: string
  company: string
  website: string
  personallinkedin: string
  companylinkedin: string
  altphonenumber: string
  companyphonenumber: string
  email: string
  emailcode: 'EMA000' | 'EMA001' | 'EMA002' | 'EMA003' | 'EMA004'
  dispositioncode: string
  providercode: string
  status: 'New' | 'Contacted' | 'Qualified' | 'Closed'
  country: string
  industry: string
  employeesize: number
  annualrevenue: number
  createdon: string
  createdby: string
  department: string
  seniority: string
  address: string
  street?: string
  city: string
  state: string
  postalcode?: string
  comments: string
  isactive: boolean
}

export interface CRMUser {
  id: string
  first_name: string
  last_name: string
  email: string
  role: 'Super Admin' | 'Data Analyst' | 'Agent'
  permissions: string[]
  last_login: string
  is_active: boolean
  profile_url: string
  department: string
  phone_no: string
  address?: string | null
  birthday?: string | null
}

export interface Deal {
  id: string
  name: string
  prospectId: string
  prospectName: string
  company: string
  stage: 'New Lead' | 'Contacted' | 'Qualified' | 'Proposal Sent' | 'Negotiation' | 'Closed Won' | 'Closed Lost'
  value: number
  probability: number
  expectedCloseDate: string
  assignedTo: string
  daysInStage: number
  description: string
  createdOn: string
  sourceCampaignName: string | null
}

// ── Lookup tables ──────────────────────────────────────────────
export const DISPOSITION_CODES = [
  { code: 'DIS000', name: 'Not Contacted' },
  { code: 'DIS001', name: 'Interested' },
  { code: 'DIS002', name: 'Not Interested' },
  { code: 'DIS003', name: 'Callback Requested' },
  { code: 'DIS004', name: 'Do Not Contact' },
  { code: 'DIS005', name: 'Unqualified' },
  { code: 'DIS006', name: 'Hot Lead' },
]

export const EMAIL_STATUSES = [
  { code: 'EMA000', name: 'Valid' },
  { code: 'EMA001', name: 'Invalid' },
  { code: 'EMA002', name: 'Risky' },
  { code: 'EMA003', name: 'Unknown' },
  { code: 'EMA004', name: 'Catch-All' },
]

export const PROVIDERS = [
  { code: 'PRV001', name: 'Apollo' },
  { code: 'PRV002', name: 'ZoomInfo' },
  { code: 'PRV003', name: 'LinkedIn' },
  { code: 'PRV004', name: 'Hunter.io' },
  { code: 'PRV005', name: 'Manual' },
]

export const INDUSTRIES = [
  'Technology', 'Finance', 'Healthcare', 'Manufacturing', 'Retail',
  'Education', 'Real Estate', 'Media', 'Logistics', 'Energy',
  'Consulting', 'Legal', 'Insurance', 'Hospitality', 'Automotive',
]

export const COUNTRIES = [
  'Australia', 'Indonesia', 'Singapore', 'United States', 'United Kingdom',
  'Canada', 'Germany', 'Japan', 'India', 'Philippines',
  'Malaysia', 'Thailand', 'Vietnam', 'New Zealand', 'South Korea',
]

// ── Mock Users ─────────────────────────────────────────────────
export const MOCK_USERS: CRMUser[] = [
  {
    id: 'usr-001',
    first_name: 'Janson',
    last_name: 'Williams',
    email: 'janson.williams@briskcrm.com',
    role: 'Super Admin',
    permissions: ['leads_view','leads_create','leads_edit','leads_delete','leads_import','leads_export','deals_view','deals_create','deals_edit','deals_delete','reports_view','emails_view','emails_send','workflows_view','workflows_manage','users_view','users_create','users_edit','users_delete','settings_view','settings_manage','ip_manage'],
    last_login: '2026-05-14T08:30:00Z',
    is_active: true,
    profile_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Janson',
    department: 'Management',
    phone_no: '+61 400 000 001',
  },
  {
    id: 'usr-002',
    first_name: 'Sarah',
    last_name: 'Chen',
    email: 'sarah.chen@briskcrm.com',
    role: 'Data Analyst',
    permissions: ['leads_view','leads_create','leads_edit','leads_import','leads_export','deals_view','deals_create','deals_edit','reports_view','emails_view','emails_send','workflows_view','users_view','settings_view'],
    last_login: '2026-05-14T07:15:00Z',
    is_active: true,
    profile_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
    department: 'Analytics',
    phone_no: '+61 400 000 002',
  },
  {
    id: 'usr-003',
    first_name: 'Marcus',
    last_name: 'Torres',
    email: 'marcus.torres@briskcrm.com',
    role: 'Agent',
    permissions: ['leads_view','leads_create','leads_edit','deals_view','emails_view','emails_send','settings_view'],
    last_login: '2026-05-13T16:45:00Z',
    is_active: true,
    profile_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus',
    department: 'Sales',
    phone_no: '+61 400 000 003',
  },
  {
    id: 'usr-004',
    first_name: 'Priya',
    last_name: 'Sharma',
    email: 'priya.sharma@briskcrm.com',
    role: 'Agent',
    permissions: ['leads_view','leads_create','leads_edit','deals_view','emails_view','emails_send','settings_view'],
    last_login: '2026-05-12T11:00:00Z',
    is_active: true,
    profile_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Priya',
    department: 'Sales',
    phone_no: '+61 400 000 004',
  },
  {
    id: 'usr-005',
    first_name: 'Liam',
    last_name: 'O\'Brien',
    email: 'liam.obrien@briskcrm.com',
    role: 'Data Analyst',
    permissions: ['leads_view','leads_create','leads_edit','leads_import','leads_export','deals_view','deals_create','deals_edit','reports_view','emails_view','emails_send','workflows_view','users_view','settings_view'],
    last_login: '2026-05-10T09:30:00Z',
    is_active: false,
    profile_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Liam',
    department: 'Analytics',
    phone_no: '+61 400 000 005',
  },
]

// ── Mock Prospects (55 records) ────────────────────────────────
const emailCodes: Prospect['emailcode'][] = ['EMA000', 'EMA001', 'EMA002', 'EMA003', 'EMA004']
const statuses: Prospect['status'][] = ['New', 'Contacted', 'Qualified', 'Closed']

const rawProspects = [
  { fn:'Alice',    ln:'Johnson',  title:'Chief Executive Officer',    company:'NovaTech Solutions',    country:'Australia',   industry:'Technology',    city:'Sydney',       size:250,  rev:8500000  },
  { fn:'Benjamin', ln:'Smith',    title:'VP of Sales',                company:'Meridian Finance',      country:'Singapore',   industry:'Finance',       city:'Singapore',    size:500,  rev:25000000 },
  { fn:'Chloe',    ln:'Williams', title:'Marketing Director',         company:'BrightPath Education',  country:'Australia',   industry:'Education',     city:'Melbourne',    size:120,  rev:3200000  },
  { fn:'David',    ln:'Lee',      title:'Head of Engineering',        company:'SkyNet Logistics',      country:'Indonesia',   industry:'Logistics',     city:'Jakarta',      size:800,  rev:40000000 },
  { fn:'Emma',     ln:'Taylor',   title:'Product Manager',            company:'HealthFirst Corp',      country:'United States',industry:'Healthcare',   city:'New York',     size:1200, rev:75000000 },
  { fn:'Frank',    ln:'Anderson', title:'Operations Manager',         company:'PeakRetail Group',      country:'Australia',   industry:'Retail',        city:'Brisbane',     size:340,  rev:12000000 },
  { fn:'Grace',    ln:'Martinez', title:'Chief Financial Officer',    company:'Zenith Consulting',     country:'United Kingdom',industry:'Consulting',  city:'London',       size:90,   rev:5500000  },
  { fn:'Henry',    ln:'Garcia',   title:'Business Development Manager',company:'AutoDrive Technologies',country:'Germany',    industry:'Automotive',    city:'Berlin',       size:2200, rev:180000000},
  { fn:'Isabella', ln:'Brown',    title:'HR Director',                company:'TalentBridge Asia',     country:'Philippines', industry:'Consulting',    city:'Manila',       size:180,  rev:4200000  },
  { fn:'James',    ln:'Davis',    title:'CTO',                        company:'CloudSphere Inc',       country:'United States',industry:'Technology',   city:'San Francisco',size:670,  rev:52000000 },
  { fn:'Kayla',    ln:'Wilson',   title:'Sales Manager',              company:'Pacific Insurance',     country:'Australia',   industry:'Insurance',     city:'Perth',        size:430,  rev:18000000 },
  { fn:'Luca',     ln:'Moore',    title:'Digital Marketing Lead',     company:'MediaPulse Agency',     country:'Singapore',   industry:'Media',         city:'Singapore',    size:60,   rev:2100000  },
  { fn:'Mia',      ln:'Jackson',  title:'Regional Director',          company:'SolarPower Energy',     country:'Australia',   industry:'Energy',        city:'Adelaide',     size:950,  rev:62000000 },
  { fn:'Nathan',   ln:'White',    title:'Account Executive',          company:'LegalEdge Partners',    country:'New Zealand', industry:'Legal',         city:'Auckland',     size:45,   rev:890000   },
  { fn:'Olivia',   ln:'Harris',   title:'Chief Marketing Officer',    company:'GreenBuild Real Estate',country:'Australia',   industry:'Real Estate',   city:'Sydney',       size:310,  rev:95000000 },
  { fn:'Patrick',  ln:'Clark',    title:'Senior Software Engineer',   company:'DataStream Corp',       country:'India',       industry:'Technology',    city:'Bangalore',    size:1800, rev:110000000},
  { fn:'Quinn',    ln:'Lewis',    title:'Finance Manager',            company:'Apex Manufacturing',    country:'Australia',   industry:'Manufacturing', city:'Wollongong',   size:720,  rev:35000000 },
  { fn:'Rachel',   ln:'Robinson', title:'Head of Customer Success',   company:'CloudFirst SaaS',       country:'Canada',      industry:'Technology',    city:'Toronto',      size:290,  rev:22000000 },
  { fn:'Samuel',   ln:'Walker',   title:'Supply Chain Director',      company:'LogiLink Asia',         country:'Malaysia',    industry:'Logistics',     city:'Kuala Lumpur', size:1100, rev:58000000 },
  { fn:'Taylor',   ln:'Hall',     title:'UX Design Lead',             company:'CreativeHub Studio',    country:'Australia',   industry:'Media',         city:'Melbourne',    size:35,   rev:950000   },
  { fn:'Uma',      ln:'Young',    title:'VP Engineering',             company:'FinTech Dynamics',      country:'Singapore',   industry:'Finance',       city:'Singapore',    size:440,  rev:31000000 },
  { fn:'Victor',   ln:'King',     title:'Managing Director',          company:'TradeWind Imports',     country:'Indonesia',   industry:'Retail',        city:'Surabaya',     size:560,  rev:27000000 },
  { fn:'Wendy',    ln:'Wright',   title:'Chief People Officer',       company:'HorizonHR Solutions',   country:'Australia',   industry:'Consulting',    city:'Canberra',     size:85,   rev:3800000  },
  { fn:'Xander',   ln:'Scott',    title:'Head of Sales',              company:'NeuroAI Labs',          country:'United States',industry:'Technology',   city:'Austin',       size:130,  rev:9200000  },
  { fn:'Yuki',     ln:'Green',    title:'Regional Sales Manager',     company:'Sakura Pharma',         country:'Japan',       industry:'Healthcare',    city:'Tokyo',        size:3400, rev:250000000},
  { fn:'Zoe',      ln:'Baker',    title:'IT Manager',                 company:'NetSecure Systems',     country:'Australia',   industry:'Technology',    city:'Sydney',       size:200,  rev:7600000  },
  { fn:'Aaron',    ln:'Adams',    title:'Chief Operating Officer',    company:'BuildRight Construction',country:'Australia',  industry:'Manufacturing', city:'Gold Coast',   size:640,  rev:48000000 },
  { fn:'Bella',    ln:'Nelson',   title:'Head of Marketing',          company:'Wanderlust Travel',     country:'Singapore',   industry:'Hospitality',   city:'Singapore',    size:160,  rev:6800000  },
  { fn:'Carlos',   ln:'Carter',   title:'Business Analyst',           company:'GlobalEdge Finance',    country:'Philippines', industry:'Finance',       city:'Cebu',         size:380,  rev:15000000 },
  { fn:'Diana',    ln:'Mitchell', title:'Director of Operations',     company:'EcoLogic Solutions',    country:'New Zealand', industry:'Energy',        city:'Wellington',   size:220,  rev:11000000 },
  { fn:'Ethan',    ln:'Perez',    title:'Software Architect',         company:'ByteForge Technologies',country:'India',       industry:'Technology',    city:'Mumbai',       size:900,  rev:67000000 },
  { fn:'Fiona',    ln:'Roberts',  title:'Senior Account Manager',     company:'Prestige Insurance',    country:'Australia',   industry:'Insurance',     city:'Brisbane',     size:490,  rev:29000000 },
  { fn:'George',   ln:'Turner',   title:'E-Commerce Director',        company:'ShopNova Retail',       country:'Australia',   industry:'Retail',        city:'Sydney',       size:710,  rev:55000000 },
  { fn:'Hannah',   ln:'Phillips', title:'Head of Compliance',         company:'RegCheck Legal',        country:'United Kingdom',industry:'Legal',       city:'Manchester',   size:70,   rev:2500000  },
  { fn:'Ivan',     ln:'Campbell', title:'VP Product',                 company:'StreamFlow Media',      country:'Canada',      industry:'Media',         city:'Vancouver',    size:340,  rev:18500000 },
  { fn:'Julia',    ln:'Parker',   title:'Chief Revenue Officer',      company:'RevUp SaaS',            country:'United States',industry:'Technology',   city:'Chicago',      size:520,  rev:42000000 },
  { fn:'Kyle',     ln:'Evans',    title:'Supply Chain Manager',       company:'FastTrack Logistics',   country:'Indonesia',   industry:'Logistics',     city:'Bandung',      size:830,  rev:38000000 },
  { fn:'Laura',    ln:'Edwards',  title:'Head of Data Science',       company:'InsightIQ Analytics',   country:'Australia',   industry:'Technology',    city:'Melbourne',    size:195,  rev:8900000  },
  { fn:'Mike',     ln:'Collins',  title:'Senior Partner',             company:'Blackstone Consulting',country:'United Kingdom',industry:'Consulting',   city:'London',       size:1400, rev:120000000},
  { fn:'Nina',     ln:'Stewart',  title:'Director of Nursing',        company:'MediCare Alliance',     country:'Australia',   industry:'Healthcare',    city:'Sydney',       size:2600, rev:190000000},
  { fn:'Oscar',    ln:'Sanchez',  title:'Founder & CEO',              company:'StartX Ventures',       country:'Singapore',   industry:'Finance',       city:'Singapore',    size:25,   rev:1200000  },
  { fn:'Paula',    ln:'Morris',   title:'Head of Procurement',        company:'BuildMaster Group',     country:'Australia',   industry:'Manufacturing', city:'Geelong',      size:580,  rev:33000000 },
  { fn:'Quincy',   ln:'Rogers',   title:'Chief Data Officer',         company:'QuantumData Corp',      country:'United States',industry:'Technology',   city:'Seattle',      size:780,  rev:61000000 },
  { fn:'Rosa',     ln:'Reed',     title:'Marketing Manager',          company:'TrendSet Fashion',      country:'Australia',   industry:'Retail',        city:'Perth',        size:140,  rev:5100000  },
  { fn:'Steve',    ln:'Cook',     title:'General Manager',            company:'PowerGrid Energy',      country:'Australia',   industry:'Energy',        city:'Darwin',       size:1050, rev:85000000 },
  { fn:'Tina',     ln:'Bell',     title:'Head of Partnerships',       company:'AllianceHub Network',   country:'Malaysia',    industry:'Consulting',    city:'Penang',       size:95,   rev:3400000  },
  { fn:'Ulrich',   ln:'Murphy',   title:'VP Finance',                 company:'Alpine Finance Group',  country:'Germany',     industry:'Finance',       city:'Munich',       size:420,  rev:32000000 },
  { fn:'Vera',     ln:'Bailey',   title:'Creative Director',          company:'Visionary Studios',     country:'Australia',   industry:'Media',         city:'Sydney',       size:55,   rev:1800000  },
  { fn:'Walter',   ln:'Rivera',   title:'Head of Real Estate',        company:'UrbanNest Properties',  country:'Philippines', industry:'Real Estate',   city:'Makati',       size:265,  rev:14500000 },
  { fn:'Xena',     ln:'Cooper',   title:'Tech Lead',                  company:'DeepLogic AI',          country:'Australia',   industry:'Technology',    city:'Melbourne',    size:180,  rev:7200000  },
  { fn:'Yara',     ln:'Richardson',title:'Sales Director',            company:'MegaStyle Retail',      country:'Indonesia',   industry:'Retail',        city:'Yogyakarta',   size:490,  rev:21000000 },
  { fn:'Zach',     ln:'Cox',      title:'Chief Legal Officer',        company:'Lexis Legal Group',     country:'Australia',   industry:'Legal',         city:'Canberra',     size:60,   rev:2700000  },
  { fn:'Amira',    ln:'Howard',   title:'Head of Strategy',           company:'BoldPath Consulting',   country:'Singapore',   industry:'Consulting',    city:'Singapore',    size:115,  rev:6100000  },
  { fn:'Brett',    ln:'Ward',     title:'Infrastructure Manager',     company:'SkyHigh Data Centers',  country:'Australia',   industry:'Technology',    city:'Sydney',       size:390,  rev:28000000 },
  { fn:'Carmen',   ln:'Torres',   title:'Country Manager',            company:'PharmaBridge Asia',     country:'Thailand',    industry:'Healthcare',    city:'Bangkok',      size:760,  rev:44000000 },
]

const providers = ['PRV001', 'PRV002', 'PRV003', 'PRV004', 'PRV005']
const disps = ['DIS000', 'DIS001', 'DIS002', 'DIS003', 'DIS004', 'DIS005', 'DIS006']
const createdBys = ['usr-001', 'usr-002', 'usr-003', 'usr-004']

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

export const MOCK_PROSPECTS: Prospect[] = rawProspects.map((p, i) => {
  const seed = i + 1
  const email = `${p.fn.toLowerCase()}.${p.ln.toLowerCase()}@${p.company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`
  return {
    id: `prs-${String(i + 1).padStart(3, '0')}`,
    fullname: `${p.fn} ${p.ln}`,
    firstname: p.fn,
    lastname: p.ln,
    jobtitle: p.title,
    company: p.company,
    website: `https://www.${p.company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
    personallinkedin: `https://linkedin.com/in/${p.fn.toLowerCase()}-${p.ln.toLowerCase()}`,
    companylinkedin: `https://linkedin.com/company/${p.company.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
    altphonenumber: `+61 4${String(Math.floor(seededRandom(seed * 3) * 90000000 + 10000000))}`,
    companyphonenumber: `+61 2${String(Math.floor(seededRandom(seed * 5) * 90000000 + 10000000))}`,
    email,
    emailcode: emailCodes[i % emailCodes.length],
    dispositioncode: disps[Math.floor(seededRandom(seed * 7) * disps.length)],
    providercode: providers[Math.floor(seededRandom(seed * 11) * providers.length)],
    status: statuses[Math.floor(seededRandom(seed * 13) * statuses.length)],
    country: p.country,
    industry: p.industry,
    employeesize: p.size,
    annualrevenue: p.rev,
    createdon: new Date(Date.now() - Math.floor(seededRandom(seed * 17) * 365 * 24 * 60 * 60 * 1000)).toISOString(),
    createdby: createdBys[Math.floor(seededRandom(seed * 19) * createdBys.length)],
    department: ['Sales', 'Marketing', 'Engineering', 'Finance', 'Operations'][Math.floor(seededRandom(seed * 23) * 5)],
    seniority: ['C-Level', 'VP', 'Director', 'Manager', 'Senior', 'Mid', 'Junior'][Math.floor(seededRandom(seed * 29) * 7)],
    city: p.city,
    state: '',
    address: `${Math.floor(seededRandom(seed * 31) * 999 + 1)} ${['Main St', 'Park Ave', 'Business Blvd', 'Commerce Rd', 'Tech Drive'][Math.floor(seededRandom(seed * 37) * 5)]}`,
    comments: '',
    isactive: seededRandom(seed * 41) > 0.1,
  }
})

// ── Mock Deals ─────────────────────────────────────────────────
const dealStages: Deal['stage'][] = [
  'New Lead', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Closed Won', 'Closed Lost',
]

export const MOCK_DEALS: Deal[] = MOCK_PROSPECTS.slice(0, 20).map((p, i) => ({
  id: `deal-${String(i + 1).padStart(3, '0')}`,
  name: `${p.company} — Enterprise Deal`,
  prospectId: p.id,
  prospectName: p.fullname,
  company: p.company,
  stage: dealStages[i % dealStages.length],
  value: Math.floor(seededRandom((i + 1) * 43) * 200000 + 5000),
  probability: [10, 20, 40, 60, 75, 90, 5][i % 7],
  expectedCloseDate: new Date(Date.now() + Math.floor(seededRandom((i + 1) * 47) * 180 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
  assignedTo: MOCK_USERS[i % 3].id,
  daysInStage: Math.floor(seededRandom((i + 1) * 53) * 30 + 1),
  description: `Potential ${dealStages[i % dealStages.length]} deal with ${p.company}.`,
  createdOn: p.createdon,
  sourceCampaignName: null,
}))

// ── Dashboard mock metrics ─────────────────────────────────────
export const MOCK_REVENUE_DATA = [
  { month: 'Mar 25', value: 18200 },
  { month: 'Apr 25', value: 22400 },
  { month: 'May 25', value: 19800 },
  { month: 'Jun 25', value: 27600 },
  { month: 'Jul 25', value: 24100 },
  { month: 'Aug 25', value: 31200 },
  { month: 'Sep 25', value: 28900 },
  { month: 'Oct 25', value: 33500 },
  { month: 'Nov 25', value: 29700 },
  { month: 'Dec 25', value: 38400 },
  { month: 'Jan 26', value: 32209 },
  { month: 'Feb 26', value: 35800 },
  { month: 'Mar 26', value: 41200 },
]

export const MOCK_RETENTION_DATA = [
  { month: 'Jan', SMEs: 82, Startups: 74, Enterprises: 91 },
  { month: 'Feb', SMEs: 85, Startups: 78, Enterprises: 93 },
  { month: 'Mar', SMEs: 79, Startups: 71, Enterprises: 90 },
  { month: 'Apr', SMEs: 88, Startups: 80, Enterprises: 95 },
  { month: 'May', SMEs: 86, Startups: 82, Enterprises: 94 },
  { month: 'Jun', SMEs: 90, Startups: 85, Enterprises: 96 },
  { month: 'Jul', SMEs: 87, Startups: 83, Enterprises: 95 },
]

export const MOCK_NOTIFICATIONS = [
  { id: 'n1', type: 'import',     message: 'New lead import completed — 484 records added', time: '2m ago',  read: false, link: '/prospects' },
  { id: 'n2', type: 'deal',       message: 'Deal won: Acme Corp — $45,000',                  time: '1h ago',  read: false, link: '/deals' },
  { id: 'n3', type: 'task',       message: 'Task overdue: Follow up with Sarah Chen',        time: '3h ago',  read: true,  link: '/prospects' },
  { id: 'n4', type: 'system',     message: 'System maintenance scheduled for Saturday 2am',  time: '5h ago',  read: true,  link: '/settings' },
  { id: 'n5', type: 'mention',    message: 'Marcus Torres mentioned you in a note',          time: '1d ago',  read: true,  link: '/prospects' },
]
