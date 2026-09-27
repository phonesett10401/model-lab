import type React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { Plate } from '../parts';
import { stacked, unit, type Layout } from '../layout';

const plates: [string, string][] = [
	['No. 01 · IMAGE', 'Creature categorizer'], ['No. 04', 'In training…'], ['No. 02 · IMAGE', 'Fresh or spoiled'], ['No. 05', 'Coming soon'],
	['No. 03 · IMAGE', 'Gender classifier'], ['No. 06', 'Coming soon'], ['No. 07', 'In training…'], ['No. 08', 'Coming soon']
];

export const Fly: React.FC<{ layout: Layout }> = ({ layout }) => {
	const frame = useCurrentFrame();
	const { width } = useVideoConfig();
	const u = unit(layout);
	const p = interpolate(frame, [0, 90], [0, 1], { easing: Easing.in(Easing.cubic), extrapolateRight: 'clamp' });
	const rows = stacked(layout) ? 5 : 3;
	return (
		<AbsoluteFill style={{ justifyContent: 'center', gap: 40 * u, overflow: 'hidden' }}>
			{Array.from({ length: rows }, (_, r) => {
				const dir = r % 2 ? 1 : -1;
				const start = dir < 0 ? 0 : -width * 1.5;
				return (
					<div key={r} style={{ display: 'flex', gap: 32 * u, transform: `translateX(${start + p * width * 2.4 * dir}px)`, filter: `blur(${p * 6 * u}px)` }}>
						{[...plates, ...plates].map(([meta, name], i) => (
							<Plate key={i} u={u} meta={meta} name={name} muted={!meta.includes('·')} />
						))}
					</div>
				);
			})}
		</AbsoluteFill>
	);
};
