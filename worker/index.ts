/**
 * The Worker in front of the static site. Cloudflare serves the built pages straight from
 * dist/; only /api/* reaches this code (run_worker_first in wrangler.jsonc). Under
 * `npm run dev`, astro.config.mjs runs it with the values in .dev.vars instead.
 */
export interface Env {
    ASSETS: { fetch(request: Request): Promise<Response> };
    /** Public: the browser needs it to show the Turnstile widget. Set in wrangler.jsonc vars. */
    TURNSTILE_SITE_KEY: string;
    /** Private: set with `wrangler secret put TURNSTILE_SECRET_KEY`, never in wrangler.jsonc. */
    TURNSTILE_SECRET_KEY?: string;
}

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const { pathname } = new URL(request.url);
        if (pathname === '/api/config' && request.method === 'GET') {
            return Response.json({ siteKey: env.TURNSTILE_SITE_KEY });
        }
        if (pathname === '/api/waitlist' && request.method === 'POST') return joinWaitlist(request, env);
        if (pathname === '/api/turnstile-error' && request.method === 'POST') return turnstileError(request, env);
        return env.ASSETS.fetch(request);
    },
};

/** One JSON object per line, so Workers Logs can filter on each field. */
function log(level: 'info' | 'warn' | 'error', event: string, fields: Record<string, unknown> = {}): void {
    console[level](JSON.stringify({ event, ...fields }));
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
    const body: unknown = await request.json().catch(() => null);
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

async function joinWaitlist(request: Request, env: Env): Promise<Response> {
    const body = await readJson(request);
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const token = typeof body.token === 'string' ? body.token : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return Response.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }
    if (!token) {
        log('warn', 'waitlist.rejected', { reason: 'no Turnstile token' });
        return Response.json({ error: 'Complete the spam check first.' }, { status: 400 });
    }
    if (!env.TURNSTILE_SECRET_KEY) {
        log('error', 'waitlist.misconfigured', { reason: 'TURNSTILE_SECRET_KEY is not set' });
        return Response.json({ error: "The form isn't set up yet. Try again later." }, { status: 500 });
    }

    const form = new FormData();
    form.append('secret', env.TURNSTILE_SECRET_KEY);
    form.append('response', token);
    const ip = request.headers.get('CF-Connecting-IP');
    if (ip) form.append('remoteip', ip);
    const res = await fetch(SITEVERIFY, { method: 'POST', body: form });
    const outcome = (await res.json().catch(() => ({}))) as { success?: boolean; 'error-codes'?: string[] };
    if (!outcome.success) {
        log('warn', 'waitlist.rejected', { reason: 'Turnstile rejected the token', errorCodes: outcome['error-codes'] ?? [] });
        return Response.json({ error: 'The spam check failed. Reload the page and try again.' }, { status: 400 });
    }

    // A real site would store the address. This one only notes that someone joined.
    log('info', 'waitlist.joined', { emailDomain: email.split('@')[1] });
    return Response.json({ ok: true });
}

/** The browser reports widget errors here, because they never reach the server otherwise. */
async function turnstileError(request: Request, env: Env): Promise<Response> {
    const body = await readJson(request);
    const code = typeof body.code === 'string' && /^[0-9a-z]{1,16}$/i.test(body.code) ? body.code : 'unknown';
    const hostname = typeof body.hostname === 'string' ? body.hostname.slice(0, 253) : '';
    log('error', 'turnstile.widget_error', { code, siteKey: env.TURNSTILE_SITE_KEY, hostname });
    return new Response(null, { status: 204 });
}
