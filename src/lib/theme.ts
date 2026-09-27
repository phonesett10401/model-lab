export type Theme = 'light' | 'dark';

export function currentTheme(): Theme {
	const set = document.documentElement.dataset.theme;
	if (set === 'light' || set === 'dark') return set;
	return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function setTheme(t: Theme) {
	document.documentElement.dataset.theme = t;
	try {
		localStorage.setItem('theme', t);
	} catch {
		// Private mode: the choice lasts for this page only.
	}
}
