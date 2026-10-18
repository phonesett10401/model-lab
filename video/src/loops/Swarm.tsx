import type React from 'react';
import { AbsoluteFill } from 'remotion';
import { Swarm as Specimens } from '../fx';
import { LoopFrame, Plate, TAU, usePhase, wave } from './Base';

/** Slide 1: the specimen swarm sways, one box pulled forward and glowing. */
export const Swarm: React.FC = () => {
	const p = usePhase();
	return (
		<LoopFrame sample>
			{/* a sway, not a spin: Swarm's per-box speeds aren't whole turns, so only an oscillation loops seamlessly */}
			<Specimens u={0.8} spin={0.45 * Math.sin(TAU * p)} opacity={0.85} hide={0} />
			<AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', paddingLeft: 180 }}>
				<div style={{ position: 'absolute', width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,79,79,0.45), transparent 70%)', opacity: 0.6 + 0.4 * wave(p), filter: 'blur(12px)' }} />
				<Plate no="No. 01" name="Sea creature detector" hot={1} width={380} style={{ transform: `scale(${1.15 + 0.04 * Math.sin(TAU * p)}) rotate(${-2 * Math.sin(TAU * p)}deg)` }} />
			</AbsoluteFill>
		</LoopFrame>
	);
};
