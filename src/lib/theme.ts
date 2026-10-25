export type Theme = 'light' | 'dark';

export function currentTheme(): Theme {
	const set = document.documentElement.dataset.theme;
	if (set === 'light' || set === 'dark') return set;
	return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function setTheme(t: Theme) {
	document.documentElement.dataset.theme = t;
	// A chosen theme beats the system one, so both theme-color tags take the page's colour (--paper, read back, not copied).
	const paper = getComputedStyle(document.body).backgroundColor;
	for (const m of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) m.content = paper;
	try {
		localStorage.setItem('theme', t);
	} catch {
		// Private mode: the choice lasts for this page only.
	}
}
