import type React from 'react';
import { AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { c, font } from '../theme';
import { Bench, Caption, Sample } from '../parts';
import { BeatGlow } from '../fx';
import { STAMP_AT } from '../timeline';
import { stacked, unit, type Layout } from '../layout';

/** The drop: the stamp slams down with a flash, a short screen shake and an RGB-split glitch. */
export const Wrong: React.FC<{ layout: Layout; from: number }> = ({ layout, from }) => {
	const frame = useCurrentFrame();
	const { fps, width } = useVideoConfig();
	const u = unit(layout);
	const said = interpolate(frame, [4, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
	const st = spring({ frame: frame - STAMP_AT, fps, config: { damping: 9, stiffness: 200 } });
	const since = frame - STAMP_AT;
	const hit = since >= 0 ? Math.max(0, 1 - since / 12) : 0; // 1 at the hit, fading over 12 frames
	const shakeX = hit * (random(`sx${frame}`) - 0.5) * 36 * u;
	const shakeY = hit * (random(`sy${frame}`) - 0.5) * 24 * u;
	const split = hit * 14 * u;
	// The stamp sits on the photo, so size it to the photo (Bench: 80u padding each side, 56u gap, 55% share when side by side).
	const photoWidth = stacked(layout) ? width - 160 * u : (width - 216 * u) * 0.55;
	const stampSize = Math.min(150 * u, photoWidth / 6.5);
	const stamp = (
		<div
			style={{
				opacity: since < 0 ? 0 : 1, transform: `rotate(-8deg) scale(${interpolate(st, [0, 1], [2.6, 1])})`,
				border: `${stampSize / 15}px solid ${c.red}`, color: c.red, fontFamily: font.mono, fontWeight: 600, fontSize: stampSize,
				letterSpacing: '0.15em', padding: `${stampSize / 25}px ${stampSize / 4}px`, background: 'rgba(20,18,19,0.4)',
				textShadow: `${split}px 0 rgba(0,240,255,0.8), ${-split}px 0 rgba(255,0,90,0.8), 0 0 ${30 * u}px rgba(255,79,79,0.7)`,
				boxShadow: `0 0 ${50 * u * (0.4 + hit)}px rgba(255,79,79,0.6)`
			}}
		>
			WRONG
		</div>
	);
	return (
		<>
			<BeatGlow from={from} strength={0.6 + hit} />
			<AbsoluteFill style={{ transform: `translate(${shakeX}px, ${shakeY}px)` }}>
				<Bench layout={layout} u={u} photo="cuttlefish.jpg" overlay={stamp}>
					<Caption u={u}>…and we show where it’s wrong.</Caption>
					<div style={{ fontFamily: font.mono, fontSize: 28 * u, color: c.faint }}>true: cuttlefish</div>
					<div style={{ fontFamily: font.serif, fontSize: 96 * u, color: c.red, opacity: said, textShadow: `${split * 0.5}px 0 rgba(0,240,255,0.6), ${-split * 0.5}px 0 rgba(255,0,90,0.6)` }}>said: squid 71%</div>
				</Bench>
				{/* Glitch slices for a few frames after the hit. */}
				{hit > 0.5 &&
					Array.from({ length: 4 }, (_, i) => (
						<div key={i} style={{ position: 'absolute', left: 0, right: 0, top: `${random(`gy${frame}${i}`) * 100}%`, height: (6 + random(`gh${frame}${i}`) * 18) * u, background: 'rgba(255,79,79,0.35)', transform: `translateX(${(random(`gx${frame}${i}`) - 0.5) * 80 * u}px)`, mixBlendMode: 'screen' }} />
					))}
			</AbsoluteFill>
			{/* The red flash on impact. */}
			<AbsoluteFill style={{ background: c.red, opacity: hit * 0.35, mixBlendMode: 'screen', pointerEvents: 'none' }} />
			<Sample u={u} />
		</>
	);
};
