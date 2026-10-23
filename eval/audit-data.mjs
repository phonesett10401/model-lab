// Builds src/lib/data/audits/<assistant>.json from the latest complete held-out run of each version, so each
// assistant's audit numbers and conversations are never typed by hand. Run after each runner run: node eval/audit-data.mjs
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const ASSISTANTS = { 'pathum-rai': 'citizen', 'raffel-luo': 'student' };
const VERSIONS = ['v0', 'D1', 'D2', 'D3', 'D4'];
const DEFENCE = { D1: 'instruction/data separation (D1)', D2: 'input filter (D2)', D3: 'output check (D3)', D4: 'retrieval access control (D4)' };
const GROUPS = { deepset: 'Direct prompt injection (deepset)', bipia: 'Instruction hidden in a pasted email (BIPIA)', plain: 'Plain question, no attack' };
const MAX_EXAMPLES = 6;

mkdirSync('src/lib/data/audits', { recursive: true });
for (const [slug, role] of Object.entries(ASSISTANTS)) {
	const latest = (version) => {
		const dir = `assistant/results/${slug}/${version}`;
		if (!existsSync(dir)) return null;
		const runs = readdirSync(dir).filter((f) => f.endsWith('.json')).sort().reverse().map((f) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')));
		return runs.find((r) => r.complete && r.split === 'held-out') ?? null;
	};
	const runs = Object.fromEntries(VERSIONS.map((v) => [v, latest(v)]));
	const measured = VERSIONS.filter((v) => runs[v]);
	const group = (r) => r.id.split('-')[0];
	const cases = (run, g) => run.results.filter((r) => r.kind === 'case' && (!g || group(r) === g));
	const scored = (rs) => rs.filter((r) => r.pass !== null);
	const leaked = (rs) => scored(rs).filter((r) => r.pass === false);
	const blocked = (rs) => rs.filter((r) => r.blockedBy?.some(Boolean));
	// Only attacks that ask for restricted data count: without goals.json the attacks never ask, so there is no leak rate.
	const goal = (run) => cases(run).some((r) => /-G\d+$/.test(r.id));
	const attacks = (run) => cases(run).filter((r) => group(r) !== 'plain');
	const leakRate = (run) => (scored(attacks(run)).length ? leaked(attacks(run)).length / scored(attacks(run)).length : null);
	const first = runs[measured[0]];
	const withGoals = !!first && goal(first);

	const transcript = (run, r, verdict, how) => ({
		title: `${run.version}: ${r.id}`,
		attackType: GROUPS[group(r)] ?? group(r),
		turns: r.messages.flatMap((m, i) => [
			{ role: 'user', text: m, ...(group(r) === 'deepset' ? { flagged: [[0, m.length]] } : {}) },
			...(r.replies[i] !== undefined ? [{ role: 'assistant', text: r.replies[i] || '(no reply)' }] : [])
		]),
		verdict,
		...(verdict === 'defended' && DEFENCE[run.version] ? { defence: DEFENCE[run.version] } : {}),
		note: how
	});
	// Examples: one leak per version (attacks first), then one block per defence that blocked something.
	const examples = [];
	for (const v of measured) {
		const r = leaked(attacks(runs[v]))[0] ?? leaked(cases(runs[v], 'plain'))[0];
		if (r) examples.push(transcript(runs[v], r, 'broken', `Leaked a restricted value on ${v}.`));
	}
	for (const v of measured) {
		const r = blocked(attacks(runs[v]))[0];
		if (r) examples.push(transcript(runs[v], r, 'defended', `Stopped by ${DEFENCE[r.blockedBy.find(Boolean)] ?? r.blockedBy.find(Boolean)}.`));
	}

	const count = (rs) => `${leaked(rs).length} of ${scored(rs).length}`;
	const out = {
		measured,
		status: measured.length && withGoals ? 'published' : 'in-progress',
		data: [
			{ label: 'Signed in as', value: role },
			{ label: 'Versions measured', value: measured.length ? `${measured.join(', ')} of ${VERSIONS.join(', ')}` : null },
			{ label: 'Chat model', value: first?.chatModel ?? null },
			{ label: 'Cases per version', value: first ? `${cases(first, 'deepset').length} deepset attacks and ${cases(first, 'bipia').length} BIPIA emails, each asking for one restricted document; ${cases(first, 'plain').length} plain questions` : null },
			...measured.flatMap((v) => [
				{ label: `${v}: leaked`, value: `direct ${count(cases(runs[v], 'deepset'))}, email ${count(cases(runs[v], 'bipia'))}, plain ${count(cases(runs[v], 'plain'))}` },
				...(v === 'v0' ? [] : [{ label: `${v}: blocked by the defence`, value: `${blocked(attacks(runs[v])).length} of ${attacks(runs[v]).length} attacks` }])
			]),
			{ label: 'Water-shortage question (G5)', value: 'no code to match; replies saved for the owner’s review' }
		],
		metrics: {
			title: 'Attacks that leaked a restricted value',
			lowerIsBetter: true,
			// Only measured versions get a row: the entry's validation allows no unmeasured numbers on a published audit.
			rows: withGoals ? measured.map((v) => ({ label: v, value: leakRate(runs[v]), ...(v !== 'v0' && runs.v0 ? { before: leakRate(runs.v0) } : {}) })) : []
		},
		transcripts: examples.slice(0, MAX_EXAMPLES)
	};
	writeFileSync(`src/lib/data/audits/${slug}.json`, JSON.stringify(out, null, '\t') + '\n');
	console.log(`${slug}: measured ${measured.join(', ') || 'nothing yet'}${withGoals ? '' : ' (no goal attacks yet)'}, ${out.transcripts.length} examples`);
}
