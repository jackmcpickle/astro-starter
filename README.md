# Astro starter

A minimal [Astro](https://astro.build) site with Tailwind CSS v4 and strict TypeScript,
ready to deploy to Cloudflare Workers as static assets, with a small Worker for its
waitlist form.

Scaffolded with `npm create astro@latest -- --template minimal`, then `astro add tailwind`.

## Commands

| Command           | What it does                                          |
| :---------------- | :---------------------------------------------------- |
| `npm install`     | Install dependencies                                  |
| `npm run dev`     | Start the dev server on `0.0.0.0:4321`                |
| `npm run build`   | Build the site into `dist/`                           |
| `npm run preview` | Serve the built site locally                          |
| `npm run check`   | Type-check `.astro` and `.ts` files with `astro check` |
| `npm run deploy`  | Build, then `wrangler deploy`                          |

## Layout

```text
src/
├── layouts/BaseLayout.astro   HTML shell, imports the Tailwind stylesheet
├── pages/                     One file per route
├── scripts/waitlist.ts        The waitlist form's browser code (Turnstile widget)
└── styles/global.css          @import 'tailwindcss'
public/                        Copied to dist/ as-is
worker/index.ts                Handles /api/* (the waitlist form) in front of the assets
wrangler.jsonc                 Cloudflare Workers config, including TURNSTILE_SITE_KEY
.dev.vars                      Local values for npm run dev (Turnstile test keys)
.claude/skills/elite-web/      Claude Code skill for working on this site
```

Import from `src/` with the `@/` alias, for example `@/layouts/BaseLayout.astro`.

## Deploy

```sh
npm run deploy
```

The waitlist form also needs its Turnstile secret key as a Worker secret:
`npx wrangler secret put TURNSTILE_SECRET_KEY`.

## Workshop preview

The workshop preview gives each port its own address and serves the dev server at `/`,
so links, assets and hot reload work as they do on your machine. The server listens on
`0.0.0.0:4321` so the preview can reach it.
