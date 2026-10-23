// Builds src/lib/data/audits/<assistant>.json from the latest complete held-out run of each version, so each
// assistant's audit numbers and conversations are never typed by hand. Run after each runner run: node eval/audit-data.mjs
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const ASSISTANTS = { 'pathum-rai': 'citizen', 'raffel-luo': 'student' };
const VERSIONS = ['v0', 'D1', 'D2', 'D3', 'D4'];
const DEFENCE = { D1: 'instruction/data separation (D1)', D2: 'input filter (D2)', D3: 'output check (D3)', D4: 'retrieval access control (D4)' };
const MAX_EXAMPLES = 6;

mkdirSync('src/lib/data/audits', { recursive: true });
for (const [slug, role] of Object.entries(ASSISTANTS)) {
	function latest(version) {
		const dir = `assistant/results/${slug}/${version}`;
		if (!existsSync(dir)) return null;
		const runs = readdirSync(dir).filter((f) => f.endsWith('.json')).sort().reverse().map((f) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')));
		return runs.find((r) => r.complete && r.split === 'held-out') ?? null;
	}

	const runs = Object.fromEntries(VERSIONS.map((v) => [v, latest(v)]));
	const auto = (run) => run.results.filter((r) => r.kind === 'case' && r.id.startsWith('deepset-'));
	const email = (run) => run.results.filter((r) => r.kind === 'case' && r.id.startsWith('bipia-'));
	const leakRate = (run) => {
		const scored = auto(run).filter((r) => r.pass !== null);
		return scored.length ? scored.filter((r) => r.pass === false).length / scored.length : null;
	};
	const blocked = (run) => auto(run).filter((r) => r.blockedBy?.some(Boolean)).length;
	const measured = VERSIONS.filter((v) => runs[v]);

	const transcript = (run, r, verdict, how) => ({
		title: `${run.version}: ${r.id}`,
		attackType: 'Direct prompt injection (deepset)',
		turns: r.messages.flatMap((m, i) => [
			{ role: 'user', text: m, flagged: [[0, m.length]] },
			...(r.replies[i] !== undefined ? [{ role: 'assistant', text: r.replies[i] || '(no reply)' }] : [])
		]),
		verdict,
		...(verdict === 'defended' && DEFENCE[run.version] ? { defence: DEFENCE[run.version] } : {}),
		note: how
	});

	// Examples, in this order: every leak (the failures that matter), then one block per defence that blocked something.
	const examples = [];
	for (const v of measured)
		for (const r of auto(runs[v]).filter((r) => r.pass === false))
			examples.push(transcript(runs[v], r, 'broken', `Leaked a restricted value on ${v}.`));
	for (const v of measured) {
		const r = auto(runs[v]).find((r) => r.blockedBy?.some(Boolean));
		if (r) examples.push(transcript(runs[v], r, 'defended', `Stopped by ${DEFENCE[r.blockedBy.find(Boolean)] ?? r.blockedBy.find(Boolean)}.`));
	}

	const first = runs[measured[0]];
	const out = {
		measured,
		status: measured.length ? 'published' : 'in-progress',
		data: [
			{ label: 'Signed in as', value: role },
			{ label: 'Versions measured', value: measured.length ? `${measured.join(', ')} of ${VERSIONS.join(', ')}` : null },
			{ label: 'Chat model', value: first?.chatModel ?? null },
			{ label: 'Attacks per version', value: first ? `${auto(first).length} direct (deepset/prompt-injections), ${email(first).length} hidden in emails (BIPIA), held-out sets` : null },
			...measured.map((v) => ({ label: `${v}: blocked by a defence`, value: `${blocked(runs[v])} of ${auto(runs[v]).length} direct attacks` })),
			{ label: 'Hidden-email attacks (BIPIA)', value: 'replies saved, awaiting the owner’s review' }
		],
		metrics: {
			title: 'Direct attacks that leaked a restricted value',
			lowerIsBetter: true,
			// Only measured versions get a row: the entry's validation allows no unmeasured numbers on a published audit.
			rows: measured.map((v) => ({ label: v, value: leakRate(runs[v]), ...(v !== 'v0' && runs.v0 ? { before: leakRate(runs.v0) } : {}) }))
		},
		transcripts: examples.slice(0, MAX_EXAMPLES)
	};
	writeFileSync(`src/lib/data/audits/${slug}.json`, JSON.stringify(out, null, '\t') + '\n');
	console.log(`${slug}: measured ${measured.join(', ') || 'nothing yet'}, ${out.transcripts.length} examples`);
}
