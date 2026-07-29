// Shared by ComposeModal and InlineReplyBox — both append the same signature format.
export function buildSignature(user: { first_name?: string; last_name?: string; role?: string; email?: string; phone_no?: string | null; profile_url?: string | null } | null): string {
  if (!user) return ''
  const name     = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()
  const initials = `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`
  const avatar   = user.profile_url
    ? `<img src="${user.profile_url}" width="48" height="48" style="width:48px;height:48px;border-radius:50%;object-fit:cover;display:block" />`
    : `<td width="48" height="48" style="background:#0c7c8d;border-radius:50%;text-align:center;vertical-align:middle;font-size:20px;font-weight:700;color:white;width:48px;height:48px">${initials}</td>`

  return `<br/><table cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb;padding-top:16px;margin-top:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"><tr><td style="padding-right:14px;vertical-align:middle">${user.profile_url ? `<table><tr>${avatar}</tr></table>` : `<table><tr>${avatar}</tr></table>`}</td><td style="vertical-align:middle"><div style="font-weight:700;font-size:14px;color:#111827;line-height:1.3">${name}</div><div style="font-size:12px;color:#6b7280;margin-top:2px">${user.role ?? ''}</div><div style="font-size:12px;color:#6b7280;margin-top:2px">${user.email ?? ''}</div>${user.phone_no ? `<div style="font-size:12px;color:#6b7280;margin-top:2px">${user.phone_no}</div>` : ''}<div style="font-size:12px;color:#6b7280;margin-top:2px">WhatsApp: 09515379127</div><div style="font-size:12px;color:#6b7280;margin-top:2px"><a href="https://www.peterpaullazan.com/" style="color:#6b7280;text-decoration:none">https://www.peterpaullazan.com/</a></div><div style="font-size:12px;color:#6b7280;margin-top:2px"><a href="https://github.com/FearCleevan/" style="color:#6b7280;text-decoration:none">https://github.com/FearCleevan/</a></div></td></tr></table>`
}
