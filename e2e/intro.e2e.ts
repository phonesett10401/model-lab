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
