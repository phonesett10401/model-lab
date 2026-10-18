// Fill in the five names here; each presenter's role matches their act in slides.ts.
export type Presenter = { key: 'A' | 'B' | 'C' | 'D' | 'E'; name: string; role: string };

export const team: Presenter[] = [
	{ key: 'A', name: 'Presenter A', role: 'The lab' },
	{ key: 'B', name: 'Presenter B', role: 'The making' },
	{ key: 'C', name: 'Presenter C', role: 'The models' },
	{ key: 'D', name: 'Presenter D', role: "What's next" },
	{ key: 'E', name: 'Presenter E', role: 'Conclusion' }
];
