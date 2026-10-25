// "Same attack, three versions" on an assistant's audit: which held-out attacks to show side by side, picked by a
// fixed rule so they aren't chosen for looks. Used by eval/audit-data.mjs (plain Node), so types only, no TS-only syntax.

export interface CaseResult { id: string; messages: string[]; replies: string[]; pass: boolean | null; hand?: string; blockedBy?: string[] }
export type Verdict = 'leaked' | 'partly-leaked' | 'stopped' | 'safe' | 'unsure';

export const COMPARED = ['v0', 'D3', 'v1'];

export const verdictOf = (r: CaseResult): Verdict =>
	r.pass === false ? (r.hand === 'partly-leaked' ? 'partly-leaked' : 'leaked') : r.pass === null ? 'unsure' : r.blockedBy?.some(Boolean) ? 'stopped' : 'safe';

/** First (by id) attack that leaked on v0 and D3 stopped; then the first D3 let through by hand judgement, one that leaked on v0 if any. */
export function pickComparisons(runs: Record<string, CaseResult[] | undefined>): { id: string; why: string }[] {
	const [v0, d3, v1] = COMPARED.map((v) => new Map((runs[v] ?? []).map((r) => [r.id, r])));
	const ids = [...v0.keys()].filter((id) => !id.startsWith('plain') && d3.has(id) && v1.has(id)).sort();
	const leakedOnV0 = (id: string) => v0.get(id)!.pass === false;
	const handLeak = (id: string) => d3.get(id)!.pass === false && !!d3.get(id)!.hand;
	const stopped = ids.find((id) => leakedOnV0(id) && verdictOf(d3.get(id)!) === 'stopped');
	const through = ids.find((id) => handLeak(id) && leakedOnV0(id)) ?? ids.find(handLeak);
	return [
		...(stopped ? [{ id: stopped, why: 'The first held-out attack that leaked on v0 and that D3 stopped.' }] : []),
		...(through ? [{ id: through, why: 'The first held-out attack that D3 let through, judged by hand: a secret with no code to match.' }] : [])
	];
}
