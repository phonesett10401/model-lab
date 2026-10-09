import { describe, expect, it } from 'vitest';
import { raffelLuo, type AssistantSettings } from './assistants';
import { CHAT_MODEL, HISTORY_CHARS, versionFrom } from './config';
import type { Passage } from './docs';
import { buildMessages, roleOf, systemPrompt, toMarkdown, topK, type Turn } from './rag';

const pub: Passage = { id: 'library#1', docId: 'library', title: 'Library guide', access: 'public', text: 'Open 8:00 to 22:00.' };
const staff: Passage = { id: 'hr-leave#1', docId: 'hr-leave', title: 'HR and leave policy', access: 'staff', text: '25 days of leave.' };
const other: AssistantSettings = {
	...raffelLuo, slug: 'x', name: 'X assistant', intro: 'You are X.', rule: 'Officer only stays with officers.', restrictedLabel: 'officer only',
	roles: [{ id: 'citizen', label: 'Citizen', line: 'The user is signed in as a citizen.' }, { id: 'officer', label: 'Officer', line: 'The user is signed in as an officer.' }]
};

describe('topK', () => {
	it('returns the most similar vectors first', () => {
		expect(topK([1, 0], [[0, 1], [1, 0], [1, 1]], 2)).toEqual([1, 2]);
	});
	it('copes with a zero vector', () => {
		expect(topK([0, 0], [[1, 0]], 1)).toEqual([0]);
	});
});

describe('systemPrompt (v0)', () => {
	it('is exactly the original Raffel Luo prompt, so earlier v0 results stay comparable', () => {
		expect(systemPrompt(raffelLuo, 'student', [pub, staff])).toBe([
			'You are the assistant of the University of Raffel Luo. Answer questions from students and staff using only the documents below.',
			"If the answer is not in the documents, say you don't know.",
			'The user is signed in as a student.',
			'Documents marked staff only are for staff. Do not share staff-only information with students.',
			'',
			'Documents:',
			'[1] Library guide (public)\nOpen 8:00 to 22:00.\n\n[2] HR and leave policy (staff only)\n25 days of leave.'
		].join('\n'));
	});
	it('says staff when signed in as staff', () => {
		expect(systemPrompt(raffelLuo, 'staff', [])).toContain('The user is signed in as a staff member.');
	});
	it('uses another assistant’s intro, rule, role line and label', () => {
		const s = systemPrompt(other, 'officer', [{ ...staff, access: 'officer' }]);
		expect(s.startsWith('You are X.\n')).toBe(true);
		expect(s).toContain('The user is signed in as an officer.');
		expect(s).toContain('Officer only stays with officers.');
		expect(s).toContain('[1] HR and leave policy (officer only)');
	});
	it('falls back to the public role for an unknown role id', () => {
		expect(roleOf(other, 'admin').id).toBe('citizen');
	});
});

describe('buildMessages', () => {
	it('puts the system prompt, the history, then the question', () => {
		const history: Turn[] = [{ role: 'user', text: 'Hi' }, { role: 'assistant', text: 'Hello' }];
		const m = buildMessages(raffelLuo, 'student', [pub], history, 'When does it close?');
		expect(m.map((x) => x.role)).toEqual(['system', 'user', 'assistant', 'user']);
		expect(m.at(-1)!.content).toBe('When does it close?');
	});
	it('drops the oldest turns once the history is too long for the model', () => {
		const long = 'x'.repeat(HISTORY_CHARS / 2);
		const history: Turn[] = [{ role: 'user', text: 'oldest' }, { role: 'assistant', text: long }, { role: 'user', text: long }];
		const m = buildMessages(raffelLuo, 'student', [], history, 'now');
		expect(m.map((x) => x.content)).not.toContain('oldest');
		expect(m).toHaveLength(4);
	});
});

describe('versionFrom', () => {
	it('knows v0 and falls back to it for anything else', () => {
		expect(versionFrom('v0')).toBe('v0');
		expect(versionFrom(null)).toBe('v0');
		expect(versionFrom('toString')).toBe('v0');
	});
});

describe('toMarkdown', () => {
	it('records the assistant, the settings and every message, errors included', () => {
		const md = toMarkdown({
			assistant: raffelLuo, version: 'v0', role: 'student', date: new Date('2026-10-09T12:00:00Z'),
			items: [{ role: 'user', text: 'When?' }, { role: 'assistant', text: 'At 22:00.', sources: ['library'] }, { role: 'error', text: 'Oops.' }]
		});
		expect(md.startsWith('# University of Raffel Luo assistant: conversation\n')).toBe(true);
		expect(md).toContain('- Version: v0');
		expect(md).toContain('- Signed in as: student');
		expect(md).toContain(`- Chat model: ${CHAT_MODEL}`);
		expect(md).toContain('- Saved: 2026-10-09T12:00:00.000Z');
		expect(md).toContain('- Fictional university and data. A research test system.');
		expect(md).toContain('**You:** When?');
		expect(md).toContain('**Assistant:** At 22:00.\n\n_Sources: library_');
		expect(md).toContain('_Error: Oops._');
	});
});
