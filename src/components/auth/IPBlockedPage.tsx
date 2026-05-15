import { ShieldX, Globe, Mail } from 'lucide-react'

interface IPBlockedPageProps {
  ip: string
  reason?: string
}

export function IPBlockedPage({ ip, reason }: IPBlockedPageProps) {
  const isBlacklisted = reason === 'blacklisted'

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-6">

        {/* Icon */}
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-2xl bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center">
            <ShieldX className="h-10 w-10 text-rose-500" />
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
          <p className="text-muted-foreground text-sm">
            {isBlacklisted
              ? 'Your IP address has been blocked from accessing this CRM.'
              : 'Your network is not on the authorized access list for this CRM.'}
          </p>
        </div>

        {/* IP card */}
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 text-left">
          <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Globe className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
              Your IP Address
            </p>
            <p className="text-sm font-mono font-semibold text-foreground">
              {ip || 'Unknown'}
            </p>
          </div>
          <span className={`ml-auto text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
            isBlacklisted
              ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
              : 'bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
          }`}>
            {isBlacklisted ? 'Blacklisted' : 'Not whitelisted'}
          </span>
        </div>

        {/* Contact */}
        <div className="bg-muted/50 border border-border rounded-xl p-4 space-y-1 text-left">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            Need access?
          </p>
          <p className="text-xs text-muted-foreground">
            Contact your system administrator and provide your IP address shown above.
            They can add it to the whitelist from the Settings → Security page.
          </p>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Brisk CRM · Access restricted by network policy
        </p>
      </div>
    </div>
  )
}
