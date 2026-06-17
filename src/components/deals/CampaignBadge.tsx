import { Mail } from 'lucide-react'

interface Props { campaignName: string }

export function CampaignBadge({ campaignName }: Props) {
  return (
    <div
      title={`This deal was created from campaign: ${campaignName}`}
      className="flex items-center gap-1 h-5 px-1.5 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40"
    >
      <Mail className="h-2.5 w-2.5 text-blue-500" />
      <span className="text-[9px] font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">Via Campaign</span>
    </div>
  )
}
