import type React from 'react';
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from 'remotion';
import { c, font } from './theme';
import { beatPulse } from './timeline';

/** Animated film grain: a fresh noise seed each frame, very faint. */
export const Grain: React.FC = () => {
	const frame = useCurrentFrame();
	return (
		<AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'overlay', opacity: 0.14 }}>
			<svg width="100%" height="100%">
				<filter id="grain">
					<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={frame % 9} stitchTiles="stitch" />
					<feColorMatrix type="saturate" values="0" />
				</filter>
				<rect width="100%" height="100%" filter="url(#grain)" />
			</svg>
		</AbsoluteFill>
	);
};

export const Vignette: React.FC = () => (
	<AbsoluteFill style={{ pointerEvents: 'none', background: 'radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.65) 100%)' }} />
);

/** A red glow from below that pulses on every beat of the music. */
export const BeatGlow: React.FC<{ from: number; strength?: number }> = ({ from, strength = 1 }) => {
	const frame = useCurrentFrame();
	const p = beatPulse(from + frame);
	return (
		<AbsoluteFill style={{ pointerEvents: 'none', opacity: (0.18 + 0.32 * p) * strength, background: `radial-gradient(ellipse 70% 55% at 50% 110%, ${c.red}, transparent 70%)` }} />
	);
};

const names = [
	'Creature categorizer', 'Bird song reader', 'Fresh or spoiled', 'Plant disease spotter', 'Gender classifier', 'Handwriting reader',
	'Coral health check', 'Recycling sorter', 'Leaf identifier', 'Coin sorter', 'Cloud type reader', 'Shell sorter'
];

/**
 * A swarm of specimen boxes orbiting the camera in 3D. `spin` is the orbit angle (radians); boxes near the
 * camera are sharp and bright, far ones blurred and dim. `hide` removes one box (the one that becomes the hero).
 */
export const Swarm: React.FC<{ u: number; spin: number; opacity?: number; hide?: number; count?: number }> = ({ u, spin, opacity = 1, hide, count = 64 }) => {
	const { width, height } = useVideoConfig();
	return (
		<AbsoluteFill style={{ perspective: 1100 * u, perspectiveOrigin: '50% 45%', opacity, overflow: 'hidden' }}>
			<div style={{ position: 'absolute', left: width / 2, top: height / 2, transformStyle: 'preserve-3d' }}>
				{Array.from({ length: count }, (_, i) => {
					if (i === hide) return null;
					const a = random(`a${i}`) * Math.PI * 2 + spin * (0.6 + random(`s${i}`) * 0.8);
					const r = (520 + random(`r${i}`) * 1100) * u;
					const y = (random(`y${i}`) - 0.5) * 1500 * u;
					const x = Math.sin(a) * r;
					const z = Math.cos(a) * r - 300 * u;
					const near = Math.max(0, Math.min(1, (z + 1400 * u) / (1700 * u))); // 0 far … 1 near
					const hot = random(`h${i}`) > 0.82;
					return (
						<div
							key={i}
							style={{
								position: 'absolute', width: 300 * u, padding: `${14 * u}px ${18 * u}px`, marginLeft: -150 * u,
								// Angle each box with the orbit, but never past ~50° so the text never reads mirrored.
								transform: `translate3d(${x}px, ${y}px, ${z}px) rotateY(${Math.sin(a) * 0.9}rad)`,
								background: c.plate, border: `${2 * u}px solid ${hot ? c.red : c.hairline}`,
								boxShadow: hot ? `0 0 ${30 * u}px rgba(255,79,79,0.45)` : 'none',
								opacity: 0.25 + near * 0.75, filter: `blur(${(1 - near) * 5 * u}px)`
							}}
						>
							<div style={{ fontFamily: font.mono, fontSize: 15 * u, color: c.faint, letterSpacing: '0.1em' }}>No. {String(i + 1).padStart(2, '0')}</div>
							<div style={{ fontFamily: font.serif, fontSize: 30 * u, color: c.ink, marginTop: 4 * u, whiteSpace: 'nowrap' }}>{names[i % names.length]}</div>
						</div>
					);
				})}
			</div>
		</AbsoluteFill>
	);
};

/** Hero-plate glow: a red bloom that breathes with the beat. */
export const Bloom: React.FC<{ from: number; size: number; strength?: number }> = ({ from, size, strength = 1 }) => {
	const frame = useCurrentFrame();
	const p = beatPulse(from + frame);
	return (
		<div style={{ position: 'absolute', width: size, height: size, borderRadius: '50%', background: `radial-gradient(circle, rgba(255,79,79,${0.55 * strength}) 0%, rgba(255,79,79,${0.15 * strength}) 40%, transparent 70%)`, transform: `scale(${1 + p * 0.12})`, filter: 'blur(10px)' }} />
	);
};
