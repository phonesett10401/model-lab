import type React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { c, font } from '../theme';
import { Bars, Bench, Caption, Sample } from '../parts';
import { ANSWER_AT, BARS_AT } from '../timeline';
import { unit, type Layout } from '../layout';

export const Right: React.FC<{ layout: Layout }> = ({ layout }) => {
	const frame = useCurrentFrame();
	const u = unit(layout);
	const answer = interpolate(frame, [ANSWER_AT, ANSWER_AT + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
	return (
		<>
			<Bench layout={layout} u={u} photo="octopus.jpg" scan>
				<Caption u={u}>Every model gets tested.</Caption>
				<div style={{ fontFamily: font.serif, fontSize: 96 * u, opacity: answer }}>octopus</div>
				<Bars u={u} startAt={BARS_AT} rows={[{ label: 'octopus', score: 0.94 }, { label: 'squid', score: 0.04 }, { label: 'cuttlefish', score: 0.02 }]} />
				<div style={{ fontFamily: font.mono, fontSize: 22 * u, color: c.faint }}>EXAMINING…</div>
			</Bench>
			<Sample u={u} />
		</>
	);
};
