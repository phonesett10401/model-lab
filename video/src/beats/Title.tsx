import type React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { font } from '../theme';
import { Lockup } from '../parts';
import { unit, type Layout } from '../layout';

export const Title: React.FC<{ layout: Layout }> = ({ layout }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const u = unit(layout);
	const logo = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 20 });
	const tag = interpolate(frame, [22, 36], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
	return (
		<AbsoluteFill style={{ justifyContent: 'center', padding: `0 ${120 * u}px`, gap: 36 * u }}>
			<Lockup u={u} progress={logo} />
			<div style={{ fontFamily: font.serif, fontSize: 84 * u, lineHeight: 1.05, opacity: tag, transform: `translateY(${(1 - tag) * 20 * u}px)` }}>
				Small models.<br />
				<span style={{ fontStyle: 'italic' }}>Honest report cards.</span>
			</div>
		</AbsoluteFill>
	);
};
