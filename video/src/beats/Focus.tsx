import type React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { c, font } from '../theme';
import { Stamp } from '../parts';
import { Bloom, Swarm } from '../fx';
import { FLY_END_SPIN } from './Fly';
import { unit, type Layout } from '../layout';

/** The sea creature detector plate, in its hero state. */
export const HeroPlate: React.FC<{ u: number; label: number }> = ({ u, label }) => (
	<div style={{ width: 420 * u, background: c.plate, border: `${3 * u}px solid ${c.red}`, boxShadow: `0 0 ${60 * u}px rgba(255,79,79,0.55), inset 0 0 ${30 * u}px rgba(255,79,79,0.18)`, padding: `${26 * u}px ${30 * u}px` }}>
		<div style={{ fontFamily: font.mono, fontSize: 18 * u, color: c.red, letterSpacing: '0.14em', opacity: label }}>SPECIMEN 01 OF THE LAB</div>
		<div style={{ fontFamily: font.serif, fontSize: 46 * u, color: c.ink, marginTop: 8 * u }}>Sea creature detector</div>
		<div style={{ marginTop: 12 * u, opacity: label }}><Stamp size={18 * u}>SAMPLE</Stamp></div>
	</div>
);

export const Focus: React.FC<{ layout: Layout; from: number }> = ({ layout, from }) => {
	const frame = useCurrentFrame();
	const { fps, width, height } = useVideoConfig();
	const u = unit(layout);
	const glide = spring({ frame, fps, config: { damping: 18, mass: 1.2 } });
	const label = interpolate(frame, [26, 38], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
	return (
		<AbsoluteFill>
			{/* The rest of the lab slows, dims and falls out of focus. */}
			<AbsoluteFill style={{ filter: `blur(${glide * 5 * u}px) brightness(${1 - glide * 0.55})` }}>
				<Swarm u={u} spin={FLY_END_SPIN + frame * 0.006} hide={0} />
			</AbsoluteFill>
			<AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
				<Bloom from={from} size={900 * u} strength={glide} />
				<div style={{ transform: `translate(${(1 - glide) * -width * 0.32}px, ${(1 - glide) * -height * 0.22}px) scale(${0.7 + glide * 0.8}) rotateZ(${(1 - glide) * -8}deg)` }}>
					<HeroPlate u={u} label={label} />
				</div>
			</AbsoluteFill>
		</AbsoluteFill>
	);
};
