import type React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { BeatGlow, Swarm } from '../fx';
import { unit, type Layout } from '../layout';

/** Orbit angle at the end of the fly-through; the focus beat continues from here. */
export const FLY_END_SPIN = 5.2;

export const Fly: React.FC<{ layout: Layout; from: number }> = ({ layout, from }) => {
	const frame = useCurrentFrame();
	const u = unit(layout);
	const spin = interpolate(frame, [0, 103], [0.2, FLY_END_SPIN], { easing: Easing.inOut(Easing.cubic) });
	const push = interpolate(frame, [0, 103], [1.1, 1], { easing: Easing.out(Easing.cubic) });
	return (
		<AbsoluteFill>
			<AbsoluteFill style={{ transform: `scale(${push})` }}>
				<Swarm u={u} spin={spin} />
			</AbsoluteFill>
			<BeatGlow from={from} />
		</AbsoluteFill>
	);
};
