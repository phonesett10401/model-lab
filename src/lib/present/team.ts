// The five presenters; each role matches their act in slides.ts.
export type Presenter = { key: 'A' | 'B' | 'C' | 'D' | 'E'; name: string; id: string; role: string };

export const team: Presenter[] = [
	{ key: 'A', name: 'Aung Kyaw Phyo', id: '6708142', role: 'The lab' },
	{ key: 'B', name: 'Bhone Pyae Hein', id: '6708463', role: 'The making' },
	{ key: 'C', name: 'Phone Sett Paing Kyaw', id: '6708369', role: 'The models' },
	{ key: 'D', name: 'Han Phyo Htet', id: '6708463', role: "What's next" },
	{ key: 'E', name: 'Saw Stephen Win', id: '6708566', role: 'Conclusion' }
];
