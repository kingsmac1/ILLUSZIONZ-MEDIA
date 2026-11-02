/**
 * Admin: the studio's gallery billing state for the dashboard (banner, Billing page, paywall).
 *   body: { refresh?: true }  → { ok, configured, billing }   (billing is null when billing is off or never answered)
 */
import { handle, json } from '../_shared/http.ts'
import { requireAdmin } from '../_shared/auth.ts'
import { billingConfigured, getBilling } from '../_shared/billing.ts'

Deno.serve(handle(async (req, body) => {
  await requireAdmin(req)
  if (!billingConfigured()) return json({ ok: true, configured: false, billing: null })
  const { billing } = await getBilling(body.refresh === true)
  return json({ ok: true, configured: true, billing })
}))
