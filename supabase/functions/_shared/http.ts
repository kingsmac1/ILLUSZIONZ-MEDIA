/** CORS + JSON helpers shared by every gallery function. */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

/** Friendly error: `error` is shown to the person as-is. */
export const fail = (error: string, status = 400) => json({ ok: false, error }, status)

export class HttpError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

/** Wraps a handler: answers CORS preflight, parses JSON, turns thrown HttpErrors into friendly responses. */
export function handle(fn: (req: Request, body: Record<string, any>) => Promise<Response>) {
  return async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return fail('Method not allowed.', 405)
    try {
      const body = (await req.json().catch(() => ({}))) as Record<string, any>
      return await fn(req, body)
    } catch (err) {
      if (err instanceof HttpError) return fail(err.message, err.status)
      console.error(err)
      return fail('Something went wrong on our side. Please try again in a moment.', 500)
    }
  }
}

export const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

/** Runs `fn` over `items` with at most `n` in flight. */
export async function pool<T, R>(items: T[], n: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i], i)
    }
  }))
  return out
}
