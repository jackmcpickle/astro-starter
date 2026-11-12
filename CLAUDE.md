# Astro starter

A small Astro site styled with Tailwind CSS v4. It builds to static files that Cloudflare
Workers serves as assets; requests to `/api/*` run the Worker in `worker/index.ts` first (see
`wrangler.jsonc`). There is no Astro server adapter.

- Pages live in `src/pages/` and wrap their content in `src/layouts/BaseLayout.astro`.
- Import from `src/` with the `@/` alias.
- This project uses npm. There is no pnpm lockfile.
- For pages, components and layouts, follow the `elite-web` skill in `.claude/skills/`.

## Waitlist form

The home page has a waitlist form protected by Cloudflare Turnstile
(`src/scripts/waitlist.ts` in the browser, `worker/index.ts` on the server). The Worker reads:

- `TURNSTILE_SITE_KEY`, public, from `vars` in `wrangler.jsonc`
- `TURNSTILE_SECRET_KEY`, private, a Worker secret (`wrangler secret put`)

In the local dev server, `astro.config.mjs` runs the Worker with the values in `.dev.vars`
instead: Cloudflare's test keys, which always pass. The Worker logs one JSON object per
line (`event`, plus details), which shows up in Workers Logs once deployed.
