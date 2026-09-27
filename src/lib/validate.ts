import type { Entry, Measured } from './types';

const isNum = (v: Measured | undefined): v is number => typeof v === 'number';

export function validateEntry(e: Entry): string[] {
	const p: string[] = [];
	if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.slug)) p.push(`${e.slug}: slug must be lowercase words joined by hyphens`);

	const rows = e.report.metrics.rows;
	if (rows.length === 0) p.push(`${e.slug}: needs at least one metric row`);
	const values = rows.flatMap((r) => (r.before === undefined ? [r.value] : [r.value, r.before]));
	const allMeasured = values.every(isNum);
	const noneMeasured = values.every((v) => v === null);
	for (const r of rows)
		for (const v of [r.value, r.before])
			if (isNum(v) && (v < 0 || v > 1)) p.push(`${e.slug}: metric "${r.label}" must be between 0 and 1`);

	if (e.kind === 'model') {
		if (e.status === 'live') {
			if (!allMeasured) p.push(`${e.slug}: live model has unmeasured metrics`);
			if (e.report.failures.length === 0) p.push(`${e.slug}: live model must show at least one failure`);
			if (!e.samples.some((s) => s.knownFailure)) p.push(`${e.slug}: live model needs a sample it gets wrong`);
			if (e.labels.length < 2) p.push(`${e.slug}: live model needs at least two labels`);
		} else {
			if (!noneMeasured) p.push(`${e.slug}: ${e.status} model must not show numbers`);
			if (e.report.failures.length) p.push(`${e.slug}: ${e.status} model must not list failures`);
		}
		if (!(e.unsureBelow > 0 && e.unsureBelow < 1)) p.push(`${e.slug}: unsureBelow must be between 0 and 1`);
		if (e.input === 'table' && !e.fields?.length) p.push(`${e.slug}: table model needs fields`);
		for (const s of e.samples)
			if (s.input.type !== e.input) p.push(`${e.slug}: sample ${s.id} is ${s.input.type}, model takes ${e.input}`);
	} else {
		if (e.status === 'published') {
			if (!allMeasured) p.push(`${e.slug}: published audit has unmeasured metrics`);
		} else if (!noneMeasured) {
			p.push(`${e.slug}: ${e.status} audit must not show numbers`);
		}
	}
	return p;
}

export function validateAll(list: Entry[]): string[] {
	const p = list.flatMap(validateEntry);
	const seen = new Set<string>();
	const nums = new Set<number>();
	for (const e of list) {
		if (seen.has(e.slug)) p.push(`duplicate slug: ${e.slug}`);
		if (nums.has(e.no)) p.push(`duplicate number: ${e.no}`);
		seen.add(e.slug);
		nums.add(e.no);
	}
	return p;
}
