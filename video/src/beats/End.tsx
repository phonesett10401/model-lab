import type React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { c, font } from '../theme';
import { Lockup } from '../parts';
import { BeatGlow, Swarm } from '../fx';
import { unit, type Layout } from '../layout';

export const End: React.FC<{ layout: Layout; from: number }> = ({ layout, from }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const u = unit(layout);
	const logo = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 16 });
	const sweep = interpolate(frame, [6, 34], [-0.2, 1.2], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
	const line = interpolate(frame, [12, 24], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
	// Hold with a slow push-in, then fade to black with the music.
	const push = interpolate(frame, [0, 75], [1, 1.05]);
	const out = interpolate(frame, [58, 75], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
	return (
		<AbsoluteFill style={{ opacity: out }}>
			{/* Kept far back (dim + soft) so nothing competes with the lockup. */}
			<AbsoluteFill style={{ filter: `blur(${4 * u}px)` }}>
				<Swarm u={u} spin={2 + frame * 0.01} opacity={0.09} />
			</AbsoluteFill>
			<BeatGlow from={from} strength={1.2} />
			<AbsoluteFill style={{ justifyContent: 'center', padding: `0 ${120 * u}px`, gap: 44 * u, transform: `scale(${push})` }}>
				<Lockup u={u} progress={logo} sweep={sweep} />
				<div style={{ fontFamily: font.serif, fontSize: 84 * u, lineHeight: 1.05, opacity: line, transform: `translateY(${(1 - line) * 20 * u}px)` }}>
					Click it. Test it. <span style={{ fontStyle: 'italic', color: c.red, textShadow: `0 0 ${24 * u}px rgba(255,79,79,0.6)` }}>See the result.</span>
				</div>
			</AbsoluteFill>
		</AbsoluteFill>
	);
};
