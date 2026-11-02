export const fmtBytes = (n: number) => {
  if (!n) return '0 GB'
  if (n < 1e9) return `${(n / 1e6).toFixed(n < 1e7 ? 1 : 0)} MB`
  return `${(n / 1e9).toFixed(n < 1e11 ? 1 : 0)} GB`
}
export const fmtDay = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
export const fmtNaira = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`
export const CTA_LABEL: Record<string, string> = { choose_plan: 'Choose a plan', pay_now: 'Pay now', upgrade: 'Upgrade plan' }
