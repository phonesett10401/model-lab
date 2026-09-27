import type React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { font } from '../theme';
import { Lockup } from '../parts';
import { BeatGlow, Swarm } from '../fx';
import { unit, type Layout } from '../layout';

export const Title: React.FC<{ layout: Layout; from: number }> = ({ layout, from }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const u = unit(layout);
	const logo = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 20 });
	const sweep = interpolate(frame, [14, 58], [-0.2, 1.2], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
	const tag = interpolate(frame, [26, 42], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
	return (
		<AbsoluteFill>
			{/* The lab is already there, drifting in the dark behind the name. */}
			<Swarm u={u} spin={frame * 0.004} opacity={interpolate(frame, [0, 40], [0, 0.22], { extrapolateRight: 'clamp' })} />
			<BeatGlow from={from} strength={0.7} />
			<AbsoluteFill style={{ justifyContent: 'center', padding: `0 ${120 * u}px`, gap: 36 * u }}>
				<Lockup u={u} progress={logo} sweep={sweep} />
				<div style={{ fontFamily: font.serif, fontSize: 84 * u, lineHeight: 1.05, opacity: tag, transform: `translateY(${(1 - tag) * 20 * u}px)` }}>
					Small models.<br />
					<span style={{ fontStyle: 'italic' }}>Honest report cards.</span>
				</div>
			</AbsoluteFill>
		</AbsoluteFill>
	);
};
