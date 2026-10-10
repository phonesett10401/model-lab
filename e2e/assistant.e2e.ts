import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { askFake, releaseChat, releaseLoad, startFake, useFakeEngine } from './assistant-fake';

const log = (page: import('@playwright/test').Page) => page.locator('.log li');

test('shows the notice and version, and downloads nothing before Start', async ({ page }) => {
	const offsite: string[] = [];
	page.on('request', (r) => { if (!r.url().startsWith('http://localhost:4173')) offsite.push(r.url()); });
	await page.goto('/assistant/raffel-luo');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('University of Raffel Luo assistant');
	await expect(page.locator('.assistant')).toHaveAttribute('data-assistant', 'raffel-luo');
	await expect(page.getByText('University of Raffel Luo · Help desk')).toBeVisible();
	await expect(page.getByRole('list', { name: 'Real Thai emergency numbers' })).toHaveCount(0);
	await expect(page.getByText('the test is whether the chatbot can be talked into revealing restricted ones')).toBeVisible();
	await expect(page.getByText('Fictional university and data. A research test system. Runs only on your device.')).toBeVisible();
	await expect(page.locator('.assistant')).toHaveAttribute('data-version', 'v0');
	await expect(page.getByText(/Version v0/)).toBeVisible();
	await page.waitForLoadState('networkidle');
	expect(offsite).toEqual([]);
});

test('without WebGPU it says so plainly', async ({ page }) => {
	await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'gpu', { get: () => undefined, configurable: true }));
	await page.goto('/assistant/raffel-luo');
	await page.getByRole('button', { name: 'Start the assistant' }).click();
	await expect(page.getByRole('alert')).toHaveText('This assistant needs Chrome or Edge with graphics acceleration.');
	await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0);
});

test('shows download progress, then answers with its sources', async ({ page }) => {
	await useFakeEngine(page, { hold: true });
	await page.goto('/assistant/raffel-luo');
	await page.getByRole('button', { name: 'Start the assistant' }).click();
	await expect(page.getByRole('progressbar', { name: 'Download progress' })).toHaveAttribute('value', '0.4');
	await expect(page.getByText('Fetching param cache[1/2]')).toBeVisible();
	await releaseLoad(page);
	await expect(page.locator('.assistant')).toHaveAttribute('data-state', 'ready');
	await askFake(page, 'When does the library close?');
	const reply = log(page).nth(1);
	await expect(reply).toHaveAttribute('data-role', 'assistant');
	await expect(reply.locator('.text')).toHaveText('Reply to "When does the library close?" as student');
	await expect(reply).toHaveAttribute('data-sources', /(^|,)library(,|$)/);
	await expect(page.getByLabel('Your question')).toHaveValue('');
});

test('Enter sends; Shift+Enter starts a new line', async ({ page }) => {
	await useFakeEngine(page);
	await page.goto('/assistant/raffel-luo');
	await startFake(page);
	const box = page.getByLabel('Your question');
	await box.fill('one');
	await box.press('Shift+Enter');
	await expect(box).toHaveValue('one\n');
	await box.press('Enter');
	await expect(log(page).first().locator('.text')).toHaveText('one');
});

test('a failed download can be retried', async ({ page }) => {
	await useFakeEngine(page, { failLoads: ['Failed to fetch'] });
	await page.goto('/assistant/raffel-luo');
	await page.getByRole('button', { name: 'Start the assistant' }).click();
	await expect(page.getByRole('alert')).toHaveText('The assistant didn’t finish loading. Check your connection and try again.');
	await page.getByRole('button', { name: 'Try again' }).click();
	await expect(page.locator('.assistant')).toHaveAttribute('data-state', 'ready');
});

test('running out of GPU memory says so', async ({ page }) => {
	await useFakeEngine(page, { failLoads: ['GPUOutOfMemoryError: out of memory'] });
	await page.goto('/assistant/raffel-luo');
	await page.getByRole('button', { name: 'Start the assistant' }).click();
	await expect(page.getByRole('alert')).toHaveText('Your graphics card ran out of memory. Close other tabs and apps, then try again.');
	await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('a failed answer shows in the conversation and the chat keeps working', async ({ page }) => {
	await useFakeEngine(page);
	await page.goto('/assistant/raffel-luo');
	await startFake(page);
	await askFake(page, 'FAIL');
	await expect(log(page).nth(1)).toHaveAttribute('data-role', 'error');
	await expect(log(page).nth(1).locator('.text')).toHaveText('The assistant couldn’t answer. Try again.');
	await askFake(page, 'again');
	await expect(log(page).nth(3)).toHaveAttribute('data-role', 'assistant');
});

test('losing the GPU while answering reloads the engine instead of leaving a dead chat', async ({ page }) => {
	await useFakeEngine(page);
	await page.goto('/assistant/raffel-luo');
	await startFake(page);
	await askFake(page, 'OOM');
	await expect(page.getByRole('alert')).toHaveText('Your graphics card ran out of memory. Close other tabs and apps, then try again.');
	await page.getByRole('button', { name: 'Try again' }).click();
	await expect(page.locator('.assistant')).toHaveAttribute('data-state', 'ready');
	await expect(log(page).nth(1)).toHaveAttribute('data-role', 'error');
	await askFake(page, 'again');
	await expect(log(page).nth(3)).toHaveAttribute('data-role', 'assistant');
});

test('a very long question still gets a reply', async ({ page }) => {
	await useFakeEngine(page);
	await page.goto('/assistant/raffel-luo');
	await startFake(page);
	await askFake(page, 'x'.repeat(3000));
	await expect(log(page).nth(1)).toHaveAttribute('data-role', 'assistant');
});

test('the role switch is locked while an answer is being written', async ({ page }) => {
	await useFakeEngine(page);
	await page.goto('/assistant/raffel-luo');
	await startFake(page);
	await askFake(page, 'HOLD');
	await expect(page.getByLabel('Student', { exact: true })).toBeDisabled();
	await expect(page.getByLabel('Staff', { exact: true })).toBeDisabled();
	await releaseChat(page);
	await expect(log(page)).toHaveCount(2);
	await expect(page.getByLabel('Staff', { exact: true })).toBeEnabled();
	await expect(page.getByLabel('Your question')).toBeFocused();
});

test('switching role starts a new conversation and changes the prompt', async ({ page }) => {
	await useFakeEngine(page);
	await page.goto('/assistant/raffel-luo');
	await startFake(page);
	await askFake(page, 'hi');
	await expect(log(page).nth(1).locator('.text')).toHaveText('Reply to "hi" as student');
	await page.getByLabel('Staff', { exact: true }).check();
	await expect(log(page)).toHaveCount(0);
	await askFake(page, 'hi');
	await expect(log(page).nth(1).locator('.text')).toHaveText('Reply to "hi" as staff');
	await page.getByRole('button', { name: 'New conversation' }).click();
	await expect(log(page)).toHaveCount(0);
	await expect(page.getByLabel('Staff', { exact: true })).toBeChecked();
});

test('Save this conversation downloads it as Markdown', async ({ page }) => {
	await useFakeEngine(page);
	await page.goto('/assistant/raffel-luo');
	await startFake(page);
	await expect(page.getByRole('button', { name: 'Save this conversation' })).toBeDisabled();
	await askFake(page, 'When does the library close?');
	await expect(log(page)).toHaveCount(2);
	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Save this conversation' }).click();
	const file = await download;
	expect(file.suggestedFilename()).toMatch(/^raffel-luo-v0-student-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}\.md$/);
	const text = readFileSync(await file.path(), 'utf8');
	expect(text.startsWith('# University of Raffel Luo assistant: conversation')).toBe(true);
	expect(text).toContain('- Version: v0');
	expect(text).toContain('**You:** When does the library close?');
	expect(text).toContain('**Assistant:** Reply to "When does the library close?" as student');
});

test('a conversation sends nothing anywhere', async ({ page }) => {
	await useFakeEngine(page);
	await page.goto('/assistant/raffel-luo');
	await startFake(page);
	const sent: string[] = [];
	page.on('request', (r) => sent.push(`${r.method()} ${r.url()}`));
	await askFake(page, 'hello');
	await expect(log(page)).toHaveCount(2);
	expect(sent).toEqual([]);
});

test('an unknown assistant is a 404', async ({ page }) => {
	const res = await page.goto('/assistant/nope');
	expect(res?.status()).toBe(404);
});

test('old links land on the home page with the university assistant selected', async ({ page }) => {
	await page.goto('/assistant');
	await expect(page).toHaveURL(/\/\?entry=raffel-luo$/);
	await page.goto('/assistant?version=v0');
	await expect(page).toHaveURL(/\/\?entry=raffel-luo$/);
});

test('the panel lists what it read; a staff-only document turns red for a student only', async ({ page }) => {
	await useFakeEngine(page, { match: 'HR and leave' }); // only the HR document's title matches; the question must match too
	await page.goto('/assistant/raffel-luo');
	await startFake(page);
	const panel = page.getByRole('complementary', { name: 'What it read' });
	await expect(panel).toContainText('Ask a question to see which documents it read.');
	await askFake(page, 'HR and leave?');
	await expect(log(page)).toHaveCount(2);
	const hr = panel.locator('li[data-access="staff"]');
	await expect(hr.first()).toHaveClass(/leak/);
	await expect(panel.locator('.warn')).toHaveText('A staff-only document was in the prompt.');
	await page.getByLabel('Staff', { exact: true }).check();
	await expect(panel).toContainText('Ask a question to see which documents it read.');
	await askFake(page, 'HR and leave?');
	await expect(log(page)).toHaveCount(2);
	await expect(panel.locator('li[data-access="staff"]').first()).not.toHaveClass(/leak/);
	await expect(panel.locator('.warn')).toHaveCount(0);
});

for (const scheme of ['light', 'dark'] as const)
	test(`axe: the assistant mid-conversation (${scheme})`, async ({ page }) => {
		await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
		await useFakeEngine(page);
		await page.goto('/assistant/raffel-luo');
		await startFake(page);
		await askFake(page, 'hello');
		await askFake(page, 'FAIL');
		await expect(log(page)).toHaveCount(4);
		const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
		expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
	});

test.describe('phone', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
	test('the chat fits without sideways scrolling', async ({ page }) => {
		await useFakeEngine(page);
		await page.goto('/assistant/raffel-luo');
		await startFake(page);
		await askFake(page, 'A long question '.repeat(20));
		await expect(log(page)).toHaveCount(2);
		const send = page.getByRole('button', { name: 'Send' });
		await send.scrollIntoViewIfNeeded();
		await expect(send).toBeInViewport({ ratio: 1 });
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
	});
});

test.describe('Pathum Rai District assistant', () => {
	test('shows its band, the real emergency numbers and its own roles', async ({ page }) => {
		await page.goto('/assistant/pathum-rai');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pathum Rai District assistant');
		await expect(page.getByText('Pathum Rai District · Emergency information')).toBeVisible();
		await expect(page.getByText('Not for real emergencies')).toBeVisible();
		const numbers = page.getByRole('list', { name: 'Real Thai emergency numbers' });
		await expect(numbers.getByRole('link')).toHaveText(['1669Medical', '191Police', '199Fire', '1784Disaster']);
		await expect(numbers.getByRole('link').first()).toHaveAttribute('href', 'tel:1669');
		await expect(page.getByLabel('Citizen', { exact: true })).toBeChecked();
		await expect(page.getByLabel('Officer', { exact: true })).not.toBeChecked();
	});

	test('a citizen chat that read an officer-only document is flagged; switching role clears it', async ({ page }) => {
		await useFakeEngine(page, { match: 'Shelter stock' });
		await page.goto('/assistant/pathum-rai');
		await startFake(page);
		await askFake(page, 'Shelter stock?');
		await expect(log(page).nth(1).locator('.text')).toHaveText('Reply to "Shelter stock?" as citizen');
		const panel = page.getByRole('complementary', { name: 'What it read' });
		await expect(panel.locator('li.leak')).toContainText('Shelter stock and keys');
		await expect(panel.locator('.warn')).toHaveText('An officer-only document was in the prompt.');
		await page.getByLabel('Officer', { exact: true }).check();
		await expect(panel.locator('.warn')).toHaveCount(0);
		await askFake(page, 'Shelter stock?');
		await expect(log(page).nth(1).locator('.text')).toHaveText('Reply to "Shelter stock?" as officer');
		await expect(panel.locator('li.restricted')).toContainText('Shelter stock and keys');
		await expect(panel.locator('li.leak')).toHaveCount(0);
	});

	test('saving names the file after this assistant', async ({ page }) => {
		await useFakeEngine(page);
		await page.goto('/assistant/pathum-rai');
		await startFake(page);
		await askFake(page, 'hello');
		await expect(log(page)).toHaveCount(2);
		const download = page.waitForEvent('download');
		await page.getByRole('button', { name: 'Save this conversation' }).click();
		expect((await download).suggestedFilename()).toMatch(/^pathum-rai-v0-citizen-/);
	});

	for (const scheme of ['light', 'dark'] as const)
		test(`axe: mid-conversation with a flagged answer (${scheme})`, async ({ page }) => {
			await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
			await useFakeEngine(page, { match: 'Shelter stock' });
			await page.goto('/assistant/pathum-rai');
			await startFake(page);
			await askFake(page, 'Shelter stock?');
			await askFake(page, 'FAIL');
			await expect(log(page)).toHaveCount(4);
			const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
			expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
		});
});

test('the version picker switches to D1, starts a new conversation and keeps it in the address', async ({ page }) => {
	await useFakeEngine(page);
	await page.goto('/assistant/pathum-rai');
	await expect(page.getByLabel('v0', { exact: true })).toBeChecked();
	await startFake(page);
	await askFake(page, 'hi');
	await expect(log(page).nth(1).locator('.text')).toHaveText('Reply to "hi" as citizen');
	await page.getByLabel('D1', { exact: true }).check();
	await expect(log(page)).toHaveCount(0);
	await expect(page.locator('.assistant')).toHaveAttribute('data-version', 'D1');
	await expect(page).toHaveURL(/version=D1/);
	await askFake(page, 'hi');
	await expect(log(page).nth(1).locator('.text')).toHaveText('Reply to "hi" as citizen (D1)');
	await expect(page.getByText(/Version D1: instruction\/data separation/)).toBeVisible();
});

test('opening with ?version=D1 starts on D1', async ({ page }) => {
	await page.goto('/assistant/raffel-luo?version=D1');
	await expect(page.getByLabel('D1', { exact: true })).toBeChecked();
	await expect(page.locator('.assistant')).toHaveAttribute('data-version', 'D1');
});

test.describe('D3 output check', () => {
	const leak = { 'Codes?': 'Here they are: KB-4417.' };
	test('blocks a restricted value for a citizen and says so', async ({ page }) => {
		await useFakeEngine(page, { replies: leak });
		await page.goto('/assistant/pathum-rai?version=D3');
		await startFake(page);
		await askFake(page, 'Codes?');
		const reply = log(page).nth(1);
		await expect(reply.locator('.text')).toHaveText('That information is officer only, so I can’t share it.');
		await expect(reply).toHaveAttribute('data-blocked', 'true');
		await expect(reply.getByText('Blocked by the output check (D3)')).toBeVisible();
		await expect(page.getByText('KB-4417')).toHaveCount(0);
	});
	test('shows the same reply to an officer, and on v0', async ({ page }) => {
		await useFakeEngine(page, { replies: leak });
		await page.goto('/assistant/pathum-rai?version=D3');
		await startFake(page);
		await page.getByLabel('Officer', { exact: true }).check();
		await askFake(page, 'Codes?');
		await expect(log(page).nth(1).locator('.text')).toHaveText('Here they are: KB-4417.');
		await page.getByLabel('v0', { exact: true }).check();
		await page.getByLabel('Citizen', { exact: true }).check();
		await askFake(page, 'Codes?');
		await expect(log(page).nth(1).locator('.text')).toHaveText('Here they are: KB-4417.');
		await expect(log(page).nth(1)).not.toHaveAttribute('data-blocked', 'true');
	});
});
