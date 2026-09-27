import type React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { c } from '../theme';
import { Bloom } from '../fx';
import { HeroPlate } from './Focus';
import { unit, type Layout } from '../layout';

/** The hero plate swings open in 3D and becomes the workbench frame. */
export const Expand: React.FC<{ layout: Layout; from: number }> = ({ layout, from }) => {
	const frame = useCurrentFrame();
	const { fps, width, height } = useVideoConfig();
	const u = unit(layout);
	const s = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 26 });
	const plateOut = interpolate(frame, [0, 10], [1, 0], { extrapolateRight: 'clamp' });
	return (
		<AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', perspective: 1400 * u }}>
			<Bloom from={from} size={900 * u} strength={1 - s * 0.7} />
			<div
				style={{
					position: 'absolute', width: interpolate(s, [0, 1], [630 * u, width - 80 * u]), height: interpolate(s, [0, 1], [260 * u, height - 80 * u]),
					border: `${3 * u}px solid ${c.red}`, background: c.plate, boxShadow: `0 0 ${80 * u}px rgba(255,79,79,${0.5 - s * 0.35})`,
					transform: `rotateX(${(1 - s) * 28}deg) rotateY(${(1 - s) * -18}deg)`
				}}
			/>
			<div style={{ position: 'absolute', opacity: plateOut, transform: 'scale(1.5)' }}>
				<HeroPlate u={u} label={1} />
			</div>
		</AbsoluteFill>
	);
};
