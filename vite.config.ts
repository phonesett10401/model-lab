import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';

// Drafts show everywhere except the production deploy.
const showDrafts = process.env.VERCEL_ENV !== 'production';
const origin = process.env.VERCEL_PROJECT_PRODUCTION_URL
	? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
	: 'http://localhost:4173';

export default defineConfig({
	define: { __SHOW_DRAFTS__: JSON.stringify(showDrafts) },
	plugins: [
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
