import type React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { c, font } from '../theme';
import { Lockup } from '../parts';
import { unit, type Layout } from '../layout';

export const End: React.FC<{ layout: Layout }> = ({ layout }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const u = unit(layout);
	const logo = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 16 });
	const line = interpolate(frame, [12, 24], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
	return (
		<AbsoluteFill style={{ justifyContent: 'center', padding: `0 ${120 * u}px`, gap: 44 * u }}>
			<Lockup u={u} progress={logo} />
			<div style={{ fontFamily: font.serif, fontSize: 84 * u, lineHeight: 1.05, opacity: line, transform: `translateY(${(1 - line) * 20 * u}px)` }}>
				Click it. Test it. <span style={{ fontStyle: 'italic', color: c.red }}>See the result.</span>
			</div>
		</AbsoluteFill>
	);
};
