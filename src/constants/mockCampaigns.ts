// src/constants/mockCampaigns.ts

export interface MockCampaign {
  id: string
  name: string
  status: 'active' | 'draft' | 'paused' | 'completed'
  total_recipients: number
  total_sent: number
  total_opened: number
  total_replied: number
  created_at: string
}

export const MOCK_CAMPAIGNS: MockCampaign[] = [
  { id: '1', name: 'US Small Business Outreach',         status: 'active',    total_recipients: 150, total_sent: 98,  total_opened: 27, total_replied: 6, created_at: '2026-06-10' },
  { id: '2', name: 'Canada E-commerce Landing Pages',    status: 'draft',     total_recipients: 45,  total_sent: 0,   total_opened: 0,  total_replied: 0, created_at: '2026-06-14' },
  { id: '3', name: 'Australia Service Businesses',       status: 'paused',    total_recipients: 80,  total_sent: 80,  total_opened: 22, total_replied: 4, created_at: '2026-06-01' },
]
