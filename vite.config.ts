import { defineConfig } from 'vitest/config';
import { loadEnv, type Plugin } from 'vite';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { handleTranslate, LIMITS } from './src/lib/comic/translate-server.ts';
import { copyOcrAssets } from './src/lib/comic/ocr-assets.ts';

// The comic translator's OCR files, served from our own site (static/ocr/ is git-ignored and filled from node_modules).
copyOcrAssets(process.cwd());

// In dev, mount the same handler Vercel runs as api/translate.ts (the static build has no server).
const translateDev = (): Plugin => ({
	name: 'comic-translate-dev',
	apply: 'serve',
	configureServer(server) {
		const env = loadEnv(server.config.mode, process.cwd(), '');
		server.middlewares.use('/api/translate', async (req, res) => {
			// Stop reading past the cap: the handler then sees an oversized body and refuses it.
			const chunks: Buffer[] = [];
			let size = 0;
			for await (const c of req) {
				chunks.push(c as Buffer);
				size += (c as Buffer).length;
				if (size > LIMITS.maxBodyBytes) break;
			}
			const request = new Request(`http://${req.headers.host}/api/translate`, {
				method: req.method,
				headers: req.headers as Record<string, string>,
				body: req.method === 'POST' ? Buffer.concat(chunks) : undefined
			});
			const reply = await handleTranslate(request, {
				key: env.GEMINI_API_KEY ?? '', model: env.GEMINI_MODEL || 'gemini-3.5-flash-lite', fallback: env.GEMINI_FALLBACK_MODEL ?? '', tier: env.GEMINI_TIER === 'paid' ? 'paid' : 'free'
			});
			res.statusCode = reply.status;
			res.setHeader('content-type', 'application/json');
			res.end(await reply.text());
		});
	}
});

// Drafts show everywhere except the production deploy.
const showDrafts = process.env.VERCEL_ENV !== 'production';
const origin = process.env.VERCEL_PROJECT_PRODUCTION_URL
	? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
	: 'http://localhost:4173';

export default defineConfig({
	define: { __SHOW_DRAFTS__: JSON.stringify(showDrafts), __SITE_ORIGIN__: JSON.stringify(origin) },
	// Vite's dependency pre-bundling breaks onnxruntime-web's own loading of its engine files.
	optimizeDeps: { exclude: ['onnxruntime-web'] },
	plugins: [
		translateDev(),
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) => (filename.split(/[\\/]/).includes('node_modules') ? undefined : true)
			},
			adapter: adapter({ fallback: '404.html' }),
			// Component CSS is tiny; inlining it saves render-blocking round trips on slow phones.
			inlineStyleThreshold: 20_000,
			prerender: {
				origin,
				// Link-preview images are generated separately (pnpm og); src/lib/og.test.ts guards they exist.
				// Audits are hidden on production for now, so /audits/[slug] has no pages there. Nothing else may go unseen.
				handleUnseenRoutes: ({ routes, message }) => {
					if (routes.every((r) => r === '/audits/[slug]')) return;
					throw new Error(message);
				},
				handleHttpError: ({ path, message }) => {
					if (path.startsWith('/og/')) return;
					throw new Error(message);
				}
			}
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: { name: 'unit', environment: 'node', include: ['src/**/*.test.ts'] }
			}
		]
	}
});
