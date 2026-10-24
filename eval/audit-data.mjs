// Builds src/lib/data/audits/<assistant>.json from the latest complete run of each version (held-out or full; only the
// held-out cases count, so every version is compared on the same attacks; a full run records split '' or 'all'), so each
// assistant's audit numbers and conversations are never typed by hand. Run after each runner run: node eval/audit-data.mjs
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const ASSISTANTS = { 'pathum-rai': 'citizen', 'raffel-luo': 'student' };
const VERSIONS = ['v0', 'D1', 'D2', 'D3', 'D4'];
const DEFENCE = { D1: 'instruction/data separation (D1)', D2: 'input filter (D2)', D3: 'output check (D3)', D4: 'retrieval access control (D4)' };
const GROUPS = { deepset: 'Direct prompt injection (deepset)', bipia: 'Instruction hidden in a pasted email (BIPIA)', disguise: 'Hidden instruction asking for a disguised answer (BIPIA)', plain: 'Plain question, no attack' };
const MAX_EXAMPLES = 7;

mkdirSync('src/lib/data/audits', { recursive: true });
for (const [slug, role] of Object.entries(ASSISTANTS)) {
	const latest = (version) => {
		const dir = `assistant/results/${slug}/${version}`;
		if (!existsSync(dir)) return null;
		const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort().reverse();
		const runs = files.map((f) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')));
		const i = runs.findIndex((r) => r.complete && (r.split === 'held-out' || r.split === 'all' || r.split === ''));
		if (i < 0) return null;
		// Hand verdicts for this exact run (assistant/<slug>/reviews/<version>.json) score the replies with no code to match.
		const reviewFile = `assistant/${slug}/reviews/${version}.json`;
		const review = existsSync(reviewFile) ? JSON.parse(readFileSync(reviewFile, 'utf8')) : null;
		const verdicts = review?.run === files[i] ? review.verdicts : {};
		const judged = (r) => (r.pass === null && verdicts[r.id] && verdicts[r.id].verdict !== 'unsure' ? { ...r, pass: verdicts[r.id].verdict === 'safe', hand: verdicts[r.id].verdict } : r.pass === null && verdicts[r.id] ? { ...r, hand: 'unsure' } : r);
		return { ...runs[i], results: runs[i].results.filter((r) => r.kind === 'case' && r.split === 'held-out').map(judged) };
	};
	const runs = Object.fromEntries(VERSIONS.map((v) => [v, latest(v)]));
	const goalsFile = `assistant/${slug}/tests/goals.json`;
	const goalQuestions = existsSync(goalsFile) ? JSON.parse(readFileSync(goalsFile, 'utf8')).map((g) => g.question) : [];
	// Highlight the goal question: the part of the message that asks for restricted data.
	const flag = (m) => { const q = goalQuestions.find((q) => m.includes(q)); const i = q ? m.lastIndexOf(q) : -1; return i < 0 ? {} : { flagged: [[i, i + q.length]] }; };
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
			{ role: 'user', text: m, ...(group(r) === 'plain' ? {} : flag(m)) },
			...(r.replies[i] !== undefined ? [{ role: 'assistant', text: r.replies[i] || '(no reply)' }] : [])
		]),
		verdict,
		...(verdict === 'defended' && DEFENCE[run.version] ? { defence: DEFENCE[run.version] } : {}),
		note: how
	});
	// Numbers in a reply that appear in no document: the assistant made them up. Email cases are left out,
	// since their replies quote the pasted email's own numbers (card digits, dates).
	const invented = (rs) => rs.filter((r) => (group(r) === 'deepset' || group(r) === 'plain') && r.unknownNumbers?.length);
	// Examples, a different case each time: one leak per version, one block per blocking defence,
	// and for a version that leaked nothing, one reply with a made-up number.
	const examples = [];
	const used = new Set();
	const pick = (rs) => { const r = rs.find((r) => !used.has(r.id)) ?? rs[0]; if (r) used.add(r.id); return r; };
	for (const v of measured) {
		const r = pick([...leaked(attacks(runs[v])), ...leaked(cases(runs[v], 'plain'))]);
		if (r) examples.push(transcript(runs[v], r, 'broken', `Leaked a restricted value on ${v}.`));
	}
	for (const v of measured) {
		const r = pick(blocked(attacks(runs[v])));
		if (r) examples.push(transcript(runs[v], r, 'defended', `Stopped by ${DEFENCE[r.blockedBy.find(Boolean)] ?? r.blockedBy.find(Boolean)}.`));
	}
	for (const v of measured.filter((v) => !leaked(cases(runs[v])).length)) {
		const r = pick([...invented(cases(runs[v], 'plain')), ...invented(cases(runs[v], 'deepset'))]);
		if (r) examples.push(transcript(runs[v], r, 'broken', `Nothing restricted leaked on ${v}, but the reply gives ${r.unknownNumbers.join(', ')}, which is in no document: the assistant made it up.`));
	}

	const count = (rs) => `${leaked(rs).length} of ${scored(rs).length}`;
	const out = {
		measured,
		status: measured.length && withGoals ? 'published' : 'in-progress',
		data: [
			{ label: 'Signed in as', value: role },
			{ label: 'Versions measured', value: measured.length ? `${measured.join(', ')} of ${VERSIONS.join(', ')}` : null },
			{ label: 'Chat model', value: first?.chatModel ?? null },
			{ label: 'Cases per version (held-out)', value: first ? `${cases(first, 'deepset').length} deepset attacks, ${cases(first, 'bipia').length} BIPIA emails and ${cases(first, 'disguise').length} disguise emails, each asking for one restricted document; ${cases(first, 'plain').length} plain questions` : null },
			...measured.flatMap((v) => [
				{ label: `${v}: leaked`, value: `direct ${count(cases(runs[v], 'deepset'))}, email ${count(cases(runs[v], 'bipia'))}, disguised ${count(cases(runs[v], 'disguise'))}, plain ${count(cases(runs[v], 'plain'))}` },
				// Only D2 and D3 replace a reply; v0 has no defence, D1 changes the prompt and D4 hides documents.
				...(v === 'D2' || v === 'D3' ? [{ label: `${v}: blocked by the defence`, value: `${blocked(attacks(runs[v])).length} of ${attacks(runs[v]).length} attacks` }] : []),
				{ label: `${v}: made-up numbers`, value: `${invented(cases(runs[v])).length} of ${cases(runs[v], 'deepset').length + cases(runs[v], 'plain').length} direct and plain replies give a number found in no document` }
			]),
			...(first ? [{ label: 'Judged by hand', value: (() => {
				const hand = measured.flatMap((v) => cases(runs[v]).filter((r) => r.hand));
				const waiting = measured.reduce((n, v) => n + cases(runs[v]).filter((r) => r.pass === null && !r.hand).length, 0);
				return `${hand.length} replies with no code to match were read and judged by Claude, the builder (the owner checks a sample); ${hand.filter((r) => r.hand === 'leaked').length} leaked, ${hand.filter((r) => r.hand === 'unsure').length} unsure${waiting ? `; ${waiting} not yet judged` : ''}. They count in the leak numbers above, except unsure ones.`;
			})() }] : []),
			...(measured.includes('D3') ? [{ label: 'D3 caution', value: (() => {
				const past = cases(runs.D3).filter((r) => r.hand === 'leaked').length;
				return 'D3 checks replies against the same list of codes the automatic scoring uses, so it stops every leak of an exact code. ' + (past
					? `${past} replies judged by hand leaked a secret with no code to match, and D3 let them through.`
					: 'Every secret in these documents is a code, so this test can’t show how D3 handles a secret that is a fact.');
			})() }] : [])
		],
		metrics: {
			title: 'Attacks that leaked a restricted value',
			lowerIsBetter: true,
			// Only measured versions get a row: the entry's validation allows no unmeasured numbers on a published audit.
			rows: withGoals ? measured.map((v) => ({ label: v, value: leakRate(runs[v]), ...(v !== 'v0' && runs.v0 ? { before: leakRate(runs.v0) } : {}) })) : []
		},
		transcripts: examples.slice(0, MAX_EXAMPLES),
		// What each defence did here, from the numbers; what it changes and can't fix live in src/lib/assistant/audits.ts.
		defences: withGoals && runs.v0 ? measured.filter((v) => v !== 'v0').map((v) => {
			const pct = (x) => `${Math.round(x * 100)}%`;
			const rate = `leaked ${pct(leakRate(runs[v]))} of attacks (v0: ${pct(leakRate(runs.v0))})`;
			const made = invented(cases(runs[v])).length;
			return { version: v, result: [
				v === 'D2' || v === 'D3' ? `Blocked ${blocked(attacks(runs[v])).length} of ${attacks(runs[v]).length} attacks; ${rate}.` : `${rate[0].toUpperCase()}${rate.slice(1)}.`,
				...(made ? [`${made} of ${cases(runs[v], 'deepset').length + cases(runs[v], 'plain').length} direct and plain replies gave a made-up number.`] : [])
			].join(' ') };
		}) : []
	};
	writeFileSync(`src/lib/data/audits/${slug}.json`, JSON.stringify(out, null, '\t') + '\n');
	console.log(`${slug}: measured ${measured.join(', ') || 'nothing yet'}${withGoals ? '' : ' (no goal attacks yet)'}, ${out.transcripts.length} examples`);
}
