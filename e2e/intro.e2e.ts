import { expect, test } from '@playwright/test';

test('the gate shows the title, Enter, and Skip', async ({ page }) => {
	await page.goto('/intro');
	await expect(page.getByText('Explore the lab.')).toBeVisible();
	await expect(page.getByRole('button', { name: '▶ Enter the lab' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Skip intro →' })).toBeVisible();
	await expect(page).toHaveTitle('Intro · AI Model Lab');
});

test('portrait phones get the tall video; desktops get wide', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/intro');
	await expect(page.locator('video')).toHaveAttribute('src', '/intro/intro-tall.mp4');
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto('/intro');
	await expect(page.locator('video')).toHaveAttribute('src', '/intro/intro-wide.mp4');
});

test('if the browser refuses playback, native controls appear instead of freezing', async ({ page }) => {
	await page.addInitScript(() => {
		HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('blocked', 'NotAllowedError'));
	});
	await page.goto('/intro');
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: '▶ Enter the lab' }).click();
	await expect(page.locator('video')).toHaveAttribute('controls', '');
	await expect(page.getByText(/press play/i)).toBeVisible();
});

test('reduced motion offers "Read instead"', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/intro');
	await expect(page.getByRole('button', { name: 'Read instead' })).toBeVisible();
});

test('Skip brings the story into view', async ({ page }) => {
	await page.goto('/intro');
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Skip intro →' }).click();
	await expect(page.getByRole('heading', { name: 'One job each.' })).toBeInViewport();
});

test('each story step becomes active as it scrolls into view', async ({ page }) => {
	await page.goto('/intro');
	for (const [i, name] of ['One job each.', 'Made by hand.', 'Honest report cards.', 'Runs on your device.'].entries()) {
		// Center it: a step is active while it crosses the middle band of the screen.
		await page.getByRole('heading', { name }).evaluate((el) => el.scrollIntoView({ block: 'center' }));
		await expect(page.locator(`#story li[data-i="${i}"]`)).toHaveAttribute('aria-current', 'step');
	}
});

test('when the video ends, the page glides to the story (not if you scrolled, not with reduced motion)', async ({ page }) => {
	const end = () => page.locator('video').evaluate((v) => v.dispatchEvent(new Event('ended')));
	await page.goto('/intro');
	await page.waitForLoadState('networkidle');
	await end();
	await expect(page.getByRole('heading', { name: 'One job each.' })).toBeInViewport();

	await page.goto('/intro');
	await page.waitForLoadState('networkidle');
	await page.evaluate(() => scrollTo(0, 0)); // the browser restores the previous visit's scroll position
	await page.mouse.wheel(0, 200);
	await page.waitForTimeout(200);
	const y = await page.evaluate(() => scrollY);
	await end();
	await page.waitForTimeout(600);
	expect(await page.evaluate(() => scrollY)).toBe(y);

	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/intro');
	await page.waitForLoadState('networkidle');
	await page.evaluate(() => scrollTo(0, 0)); // the browser restores the previous visit's scroll position
	await end();
	await page.waitForTimeout(300);
	expect(await page.evaluate(() => scrollY)).toBe(0);
});

test('the ending leads into the lab', async ({ page }) => {
	await page.goto('/intro');
	await expect(page.getByText('New models are added as they’re trained.')).toBeVisible();
	await page.getByRole('link', { name: 'Open the lab →' }).click();
	await expect(page).toHaveURL(/\/$/);
});

test('the lab links to the intro and never downloads the video', async ({ page }) => {
	const videos: string[] = [];
	page.on('request', (r) => { if (r.url().includes('/intro/')) videos.push(r.url()); });
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	await expect(page.getByRole('link', { name: /Watch the intro/ })).toHaveAttribute('href', '/intro');
	expect(videos).toEqual([]);
});

test('refused playback: the note goes once it plays, and our buttons never cover the native controls', async ({ page }) => {
	await page.addInitScript(() => {
		HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('blocked', 'NotAllowedError'));
	});
	await page.goto('/intro');
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: '▶ Enter the lab' }).click();
	await expect(page.getByText(/press play/i)).toBeVisible();
	await expect(page.getByRole('button', { name: /Replay/ })).toBeHidden();
	await page.locator('video').evaluate((v) => v.dispatchEvent(new Event('play')));
	await expect(page.getByText(/press play/i)).toBeHidden();
	await expect(page.getByRole('button', { name: /Replay/ })).toBeVisible();
});

test('after Enter, focus moves to the controls and the page keeps its heading', async ({ page }) => {
	await page.addInitScript(() => {
		HTMLMediaElement.prototype.play = () => Promise.resolve();
	});
	await page.goto('/intro');
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: '▶ Enter the lab' }).click();
	await expect(page.getByRole('button', { name: /Mute/ })).toBeFocused();
	await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
});

const heads = ['One job each.', 'Made by hand.', 'Honest report cards.', 'Runs on your device.'];
const cssVar = (page: import('@playwright/test').Page, sel: string, name: string) =>
	page.locator(sel).evaluate((el, n) => parseFloat(getComputedStyle(el).getPropertyValue(n)), name);

test('the spine lights its markers in order and fills as you scroll', async ({ page }) => {
	await page.goto('/intro');
	await page.evaluate(() => scrollTo(0, 0));
	const lit = () => page.locator('#story .spine [data-lit]');
	for (const [i, name] of heads.entries()) {
		await page.getByRole('heading', { name }).evaluate((el) => el.scrollIntoView({ block: 'center' }));
		await expect(lit()).toHaveCount(i + 1);
	}
	// With the last step centred, the fill has reached its marker (7/8 of the way down).
	await expect.poll(() => cssVar(page, '#story', '--p')).toBeGreaterThanOrEqual(0.87);
	await page.evaluate(() => scrollTo(0, 0));
	await expect.poll(() => cssVar(page, '#story', '--p')).toBe(0);
});

test('each scene builds as its step scrolls in and is finished once centred', async ({ page }) => {
	await page.goto('/intro');
	await page.evaluate(() => scrollTo(0, 0));
	await page.getByRole('heading', { name: heads[1] }).evaluate((el) => el.scrollIntoView({ block: 'center' }));
	await expect.poll(() => cssVar(page, '.scene[data-i="1"]', '--t')).toBe(1);
	await expect.poll(() => cssVar(page, '.scene[data-i="3"]', '--t')).toBe(0);
	// Put step 3's top 70% down the screen: its scene is showing, part-built.
	await page.locator('#story li[data-i="2"]').evaluate((el) => scrollBy(0, el.getBoundingClientRect().top - innerHeight * 0.7));
	await expect.poll(async () => { const t = await cssVar(page, '.scene[data-i="2"]', '--t'); return t > 0 && t < 1; }).toBe(true);
	await expect(page.locator('.scene.on')).toHaveAttribute('data-i', '2');
});

test('reduced motion shows every scene finished', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/intro');
	await page.evaluate(() => scrollTo(0, 0));
	for (const i of [0, 1, 2, 3]) await expect.poll(() => cssVar(page, `.scene[data-i="${i}"]`, '--t')).toBe(1);
});

for (const [w, h] of [[390, 844], [1280, 800]])
	test(`the story never scrolls sideways at ${w}px`, async ({ page }) => {
		await page.setViewportSize({ width: w, height: h });
		await page.goto('/intro');
		for (const name of heads) {
			await page.getByRole('heading', { name }).evaluate((el) => el.scrollIntoView({ block: 'center' }));
			await page.waitForTimeout(150);
			expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w);
		}
	});

test('on the narrowest phone, every scene stays inside its picture once built', async ({ page }) => {
	await page.setViewportSize({ width: 360, height: 740 });
	await page.goto('/intro');
	for (const [i, sel] of [[1, '.lock, .tag'], [2, '.card, .stamp'], [3, '.phone']] as const) {
		await page.getByRole('heading', { name: heads[i] }).evaluate((el) => el.scrollIntoView({ block: 'center' }));
		await expect.poll(() => cssVar(page, `.scene[data-i="${i}"]`, '--t')).toBeGreaterThan(0.95);
		await page.waitForTimeout(600); // let the scene's fade-in settle
		const out = await page.evaluate((sel) => {
			const v = document.querySelector('.visual')!.getBoundingClientRect();
			return [...document.querySelectorAll(sel)].filter((e) => e.closest('.scene.on')).filter((e) => {
				const b = e.getBoundingClientRect();
				return b.left < v.left - 1 || b.right > v.right + 1 || b.top < v.top - 1 || b.bottom > v.bottom + 1;
			}).map((e) => e.className);
		}, sel);
		expect(out, `scene ${i}`).toEqual([]);
	}
});
