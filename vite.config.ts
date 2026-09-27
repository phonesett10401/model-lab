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
			prerender: { origin }
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
