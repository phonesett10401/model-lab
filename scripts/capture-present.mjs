// Real screen captures for the presentation's banner loops (slides 5 and 9).
// Needs the site running first: pnpm build && pnpm preview --port 4173
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const base = 'http://localhost:4173';
const out = 'video/public/captures';

try {
	await fetch(base);
} catch {
	console.error(`Nothing on ${base}. Run "pnpm build && pnpm preview --port 4173" first.`);
	process.exit(1);
}
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, colorScheme: 'dark' });

/** Click a sample and wait for THAT run's answer (the previous result stays until examining starts), as the e2e tests do. */
async function run(title) {
	const demo = page.locator('.demo');
	const started = demo.evaluate((d) => new Promise((resolve) => {
		const o = new MutationObserver(() => { if (d.dataset.state === 'examining') { o.disconnect(); resolve(); } });
		o.observe(d, { attributes: true, attributeFilter: ['data-state'] });
	}));
	await page.getByRole('button', { name: title, exact: true }).click();
	await started;
	await page.locator('.demo[data-state="result"], .demo[data-state="unsure"]').waitFor({ timeout: 90_000 });
	await page.waitForTimeout(800); // let boxes and the timeline finish animating in
}

async function shot(path, title, file) {
	if (page.url() !== base + path) await page.goto(base + path);
	await run(title);
	await page.locator('.demo').screenshot({ path: `${out}/${file}` });
	console.log('wrote', file);
}

// Slide 5 moves through every sea sample once; the seal shows a failure, honestly.
for (const [title, file] of [['Aquarium tank', 'sea-aquarium.png'], ['Dolphin', 'sea-dolphin.png'], ['Sea turtle', 'sea-turtle.png'], ['Seal or sea lion?', 'sea-seal.png'], ['Shark or fish?', 'sea-shark.png'], ['School of fish', 'sea-school.png']])
	await shot('/models/sea-creature-detector', title, file);

await page.goto(base + '/');
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/home.png`, fullPage: true });
console.log('wrote home.png');

await browser.close();
