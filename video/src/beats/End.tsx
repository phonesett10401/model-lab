import type React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { c, font } from '../theme';
import { unit, type Layout } from '../layout';

export const End: React.FC<{ layout: Layout }> = ({ layout }) => {
	const frame = useCurrentFrame();
	const u = unit(layout);
	const a = interpolate(frame, [4, 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
	const b = interpolate(frame, [20, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
	return (
		<AbsoluteFill style={{ justifyContent: 'center', padding: `0 ${120 * u}px`, gap: 40 * u }}>
			<div style={{ fontFamily: font.serif, fontSize: 130 * u, lineHeight: 1, opacity: a, transform: `translateY(${(1 - a) * 24 * u}px)` }}>
				Click it. Test it.<br />
				<span style={{ fontStyle: 'italic', color: c.red }}>See the result.</span>
			</div>
			<div style={{ fontFamily: font.mono, color: c.red, fontSize: 30 * u, letterSpacing: '0.2em', opacity: b }}>AI MODEL LAB</div>
		</AbsoluteFill>
	);
};
