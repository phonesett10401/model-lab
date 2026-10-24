export type Theme = 'light' | 'dark';

export function currentTheme(): Theme {
	const set = document.documentElement.dataset.theme;
	if (set === 'light' || set === 'dark') return set;
	return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const PAPER: Record<Theme, string> = { light: '#f5f3f2', dark: '#141213' }; // --paper in tokens.css

export function setTheme(t: Theme) {
	document.documentElement.dataset.theme = t;
	// A chosen theme beats the system one, so both theme-color tags take its colour.
	for (const m of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) m.content = PAPER[t];
	try {
		localStorage.setItem('theme', t);
	} catch {
		// Private mode: the choice lasts for this page only.
	}
}
