// Rebuilds assistant/<slug>/tests/cases.json from two published prompt-injection datasets, wording unchanged.
//   deepset/prompt-injections (Hugging Face, Apache 2.0): the attack rows (label 1), sent as the user's message.
//   microsoft/BIPIA (GitHub, MIT): text attacks hidden at the end of an email the user pastes, then BIPIA's question (indirect injection).
// Each source's train split becomes `dev`, its test split `held-out`. Every case asks as the public role.
// Run: node eval/import-datasets.mjs
import { writeFileSync } from 'node:fs';

const DEEPSET_SHA = '4f61ecb038e9c3fb77e21034b22511b523772cdd'; // revision checked when imported; the rows API serves main
const BIPIA = 'https://raw.githubusercontent.com/microsoft/BIPIA/a004b69ec0dd446e0afd461d98cb5e96e120a5d0/benchmark';
// Long emails don't fit the chat model's 2048-token window next to the documents.
const MAX_EMAIL = 900;

const get = async (url) => {
	const r = await fetch(url);
	if (!r.ok) throw new Error(`${url}: ${r.status}`);
	return r;
};

async function deepset(split) {
	const rows = [];
	for (let offset = 0; ; offset += 100) {
		const j = await (await get(`https://datasets-server.huggingface.co/rows?dataset=deepset/prompt-injections&config=default&split=${split}&offset=${offset}&length=100`)).json();
		rows.push(...j.rows.map((r) => ({ i: r.row_idx, ...r.row })));
		if (j.rows.length < 100) return rows;
	}
}

async function bipia(split) {
	const attacks = Object.entries(await (await get(`${BIPIA}/text_attack_${split}.json`)).json());
	const emails = (await (await get(`${BIPIA}/email/${split}.jsonl`)).text()).trim().split('\n').map((l) => JSON.parse(l)).filter((e) => e.context.length <= MAX_EMAIL);
	let n = 0;
	return attacks.flatMap(([category, list]) => list.map((attack, k) => ({ category, k, attack, email: emails[n++ % emails.length] })));
}

const cases = [];
for (const [split, use] of [['train', 'dev'], ['test', 'held-out']]) {
	for (const r of await deepset(split))
		if (r.label === 1 && r.text.trim())
			cases.push({ id: `deepset-${split}-${r.i}`, owasp: 'LLM01', messages: [r.text.trim()], rule: { type: 'no_placeholders' }, split: use,
				note: `deepset/prompt-injections ${split} row ${r.i} (Apache 2.0, rev ${DEEPSET_SHA.slice(0, 7)})` });
	for (const b of await bipia(split))
		cases.push({ id: `bipia-${split}-${b.category.toLowerCase().replace(/[^a-z]+/g, '-')}-${b.k}`, owasp: 'LLM01',
			messages: [`Here is an email I received:\n\n${b.email.context}\n${b.attack}\n\n${b.email.question}`], rule: { type: 'manual' }, split: use,
			note: `BIPIA ${split} text attack "${b.category}" #${b.k} in an EmailQA context (MIT). Passes if the reply ignores: ${b.attack}` });
}

for (const [slug, role] of [['raffel-luo', 'student'], ['pathum-rai', 'citizen']])
	writeFileSync(`assistant/${slug}/tests/cases.json`, JSON.stringify(cases.map(({ note, ...c }) => ({ ...c, role, note })), null, '\t') + '\n');
const tally = {};
for (const c of cases) tally[`${c.id.split('-')[0]} ${c.split}`] = (tally[`${c.id.split('-')[0]} ${c.split}`] ?? 0) + 1;
console.log(`${cases.length} cases per assistant`, tally);
