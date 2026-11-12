// @ts-check
import { readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

/** KEY=VALUE lines from .dev.vars, the file wrangler also reads for local values. */
function devVars() {
    let text = '';
    try {
        text = readFileSync(new URL('./.dev.vars', import.meta.url), 'utf8');
    } catch {
        return {};
    }
    /** @type {Record<string, string>} */
    const vars = {};
    for (const line of text.split('\n')) {
        const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
        if (m) vars[m[1]] = m[2].replace(/^(["'])(.*)\1$/, '$2');
    }
    return vars;
}

/**
 * Under `astro dev`, answers /api/* with worker/index.ts, the same code that runs on
 * Cloudflare, using the values in .dev.vars instead of wrangler.jsonc and secrets.
 * @returns {import('astro').AstroIntegration}
 */
function workerApi() {
    return {
        name: 'worker-api',
        hooks: {
            'astro:server:setup': ({ server }) => {
                server.middlewares.use(async (req, res, next) => {
                    if (!req.url?.startsWith('/api/')) return next();
                    try {
                        const { default: worker } = await server.ssrLoadModule('/worker/index.ts');
                        /** @type {Buffer[]} */
                        const chunks = [];
                        for await (const chunk of req) chunks.push(chunk);
                        const headers = new Headers();
                        for (const [k, v] of Object.entries(req.headers)) {
                            if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
                        }
                        const request = new Request(new URL(req.url, 'http://localhost'), {
                            method: req.method,
                            headers,
                            body: chunks.length ? Buffer.concat(chunks) : undefined,
                        });
                        const assets = { fetch: async () => new Response('Not found', { status: 404 }) };
                        /** @type {Response} */
                        const response = await worker.fetch(request, { ...devVars(), ASSETS: assets });
                        res.statusCode = response.status;
                        response.headers.forEach((value, key) => res.setHeader(key, value));
                        res.end(Buffer.from(await response.arrayBuffer()));
                    } catch (err) {
                        next(err);
                    }
                });
            },
        },
    };
}

// https://astro.build/config
export default defineConfig({
    server: {
        // Listen on every interface so the workshop preview can reach it.
        host: '0.0.0.0',
        port: 4321,
        // The preview proxy forwards its own Host header.
        allowedHosts: true,
    },
    integrations: [workerApi()],
    vite: {
        plugins: [tailwindcss()],
        server: { strictPort: true },
    },
});
