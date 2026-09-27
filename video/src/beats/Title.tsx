import type React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { c, font } from '../theme';
import { unit, type Layout } from '../layout';

const word = 'AI MODEL LAB';

export const Title: React.FC<{ layout: Layout }> = ({ layout }) => {
	const frame = useCurrentFrame();
	const u = unit(layout);
	const shown = Math.min(word.length, Math.floor(frame / 2.5) + 1);
	const sub = interpolate(frame, [30, 42], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
	return (
		<AbsoluteFill style={{ justifyContent: 'center', padding: `0 ${120 * u}px`, gap: 24 * u }}>
			<div style={{ fontFamily: font.mono, color: c.red, fontSize: 64 * u, letterSpacing: '0.2em' }}>
				{word.slice(0, shown)}
				<span style={{ opacity: frame % 10 < 5 ? 1 : 0 }}>▌</span>
			</div>
			<div style={{ fontFamily: font.serif, fontStyle: 'italic', fontSize: 110 * u, opacity: sub, transform: `translateY(${(1 - sub) * 24 * u}px)` }}>Explore the lab.</div>
		</AbsoluteFill>
	);
};
