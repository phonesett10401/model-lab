import type React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { c, font } from '../theme';
import { Bench, Caption, Sample } from '../parts';
import { BeatGlow } from '../fx';
import { DROP_AT, UPLOADED_AT } from '../timeline';
import { unit, type Layout } from '../layout';

/** The octopus photo drops into the glowing zone; a progress ring fills. */
export const Upload: React.FC<{ layout: Layout; from: number }> = ({ layout, from }) => {
	const frame = useCurrentFrame();
	const u = unit(layout);
	const progress = interpolate(frame, [DROP_AT + 4, UPLOADED_AT], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
	const r = 46 * u;
	const len = 2 * Math.PI * r;
	return (
		<>
			<BeatGlow from={from} strength={0.6} />
			<Bench layout={layout} u={u} photo="octopus.jpg" zone dropAt={DROP_AT}>
				<Caption u={u}>Every model gets tested.</Caption>
				<div style={{ fontFamily: font.serif, fontSize: 80 * u, lineHeight: 1 }}>Drop in a photo.</div>
				<div style={{ display: 'flex', alignItems: 'center', gap: 28 * u }}>
					<svg width={r * 2 + 12 * u} height={r * 2 + 12 * u} style={{ filter: `drop-shadow(0 0 ${10 * u}px rgba(255,79,79,0.7))` }}>
						<circle cx={r + 6 * u} cy={r + 6 * u} r={r} fill="none" stroke={c.hairline} strokeWidth={8 * u} />
						<circle cx={r + 6 * u} cy={r + 6 * u} r={r} fill="none" stroke={c.red} strokeWidth={8 * u} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - progress)} transform={`rotate(-90 ${r + 6 * u} ${r + 6 * u})`} />
					</svg>
					<div style={{ fontFamily: font.mono, fontSize: 28 * u, color: progress >= 1 ? c.ink : c.soft }}>
						{progress >= 1 ? 'READY · runs on your device' : `UPLOADING ${Math.round(progress * 100)}%`}
					</div>
				</div>
			</Bench>
			<Sample u={u} />
		</>
	);
};
