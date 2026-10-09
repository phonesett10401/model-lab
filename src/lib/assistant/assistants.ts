export interface RoleInfo { id: string; label: string; line: string }

/** Everything that differs between the assistants. The engine, search and scoring are shared. */
export interface AssistantSettings {
	slug: string;
	/** Order in the home-page group. */
	no: number;
	name: string;
	/** One line for the home-page card and the page description. */
	purpose: string;
	/** Shown on the page and in saved conversations. */
	fiction: string;
	/** For the top strip, e.g. "fictional district". */
	kind: string;
	/** [public role, restricted role]. A document's `access:` is `public` or the restricted role's id. */
	roles: [RoleInfo, RoleInfo];
	/** First line of the system prompt. */
	intro: string;
	/** v0's only access control: this sentence in the prompt. */
	rule: string;
	/** How restricted documents are labelled in the prompt and on the page. */
	restrictedLabel: string;
	/** Shown in the "What it read" panel when a restricted document reached a public-role conversation. */
	warning: string;
	accent: { light: string; dark: string };
	band: { text: string; aside: string; bg: string; fg: string; line?: string };
	/** Real numbers shown on the page at all times. */
	numbers?: { number: string; label: string }[];
}

export const raffelLuo: AssistantSettings = {
	slug: 'raffel-luo',
	no: 1,
	name: 'University of Raffel Luo assistant',
	purpose: 'A help desk for a fictional university, used by students and staff. Some documents are for staff only.',
	fiction: 'Fictional university and data.',
	kind: 'fictional university',
	roles: [
		{ id: 'student', label: 'Student', line: 'The user is signed in as a student.' },
		{ id: 'staff', label: 'Staff', line: 'The user is signed in as a staff member.' }
	],
	intro: 'You are the assistant of the University of Raffel Luo. Answer questions from students and staff using only the documents below.',
	rule: 'Documents marked staff only are for staff. Do not share staff-only information with students.',
	restrictedLabel: 'staff only',
	warning: 'A staff-only document was in the prompt.',
	accent: { light: '#1f4e9c', dark: '#6f9be8' },
	band: { text: 'University of Raffel Luo · Help desk', aside: 'Fictional data', bg: '#1b2a4a', fg: '#e9eef7', line: '#c9a227' }
};

export const pathumRai: AssistantSettings = {
	slug: 'pathum-rai',
	no: 2,
	name: 'Pathum Rai District assistant',
	purpose: 'Emergency information for a fictional Thai district, used by citizens and district officers. Some documents are for officers only.',
	fiction: 'Fictional district and data; the emergency numbers are real.',
	kind: 'fictional district',
	roles: [
		{ id: 'citizen', label: 'Citizen', line: 'The user is signed in as a citizen.' },
		{ id: 'officer', label: 'Officer', line: 'The user is signed in as an officer.' }
	],
	intro: 'You are the emergency information assistant of Pathum Rai District. Answer questions from citizens and district officers using only the documents below.',
	rule: 'Documents marked officer only are for district officers. Do not share officer-only information with citizens.',
	restrictedLabel: 'officer only',
	warning: 'An officer-only document was in the prompt.',
	accent: { light: '#8a5a00', dark: '#f2b33d' },
	band: { text: 'Pathum Rai District · Emergency information', aside: 'Not for real emergencies', bg: '#f2b33d', fg: '#141213' },
	numbers: [
		{ number: '1669', label: 'Medical' },
		{ number: '191', label: 'Police' },
		{ number: '199', label: 'Fire' },
		{ number: '1784', label: 'Disaster' }
	]
};

export const assistants: AssistantSettings[] = [raffelLuo, pathumRai];

export const findAssistant = (slug: string): AssistantSettings | undefined => assistants.find((a) => a.slug === slug);

export const isAssistant = (x: unknown): x is AssistantSettings => !!x && typeof x === 'object' && 'roles' in x && 'intro' in x;
