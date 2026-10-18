import type React from 'react';
import { Img, staticFile, useVideoConfig } from 'remotion';
import { c } from '../theme';
import { LoopFrame, usePhase, wave } from './Base';

/**
 * Real screen captures (scripts/capture-present.mjs), no SAMPLE stamp: two captures cross-fade while the view
 * pans slowly down and back. `size` is each capture's pixel size, so the pan covers exactly the overflow.
 */
export const Capture: React.FC<{ shots: { file: string; w: number; h: number }[]; label: string; align?: 'left' | 'right'}> = ({ shots, label, align = 'left' }) => {
	const p = usePhase();
	const { width, height } = useVideoConfig();
	const mix = Math.min(1, Math.max(0, (wave(p) - 0.35) / 0.3)); // first shot, cross-fade, second shot, back
	return (
		<LoopFrame label={label}>
			{shots.map((s, i) => {
				const scale = Math.max(width / s.w, height / s.h) * 1.04;
				const over = s.h * scale - height;
				const sideways = s.w * scale - width;
				return (
					<Img
						key={s.file}
						src={staticFile(`captures/${s.file}`)}
						style={{
							position: 'absolute', top: 0, [align]: 0, width: s.w * scale, height: s.h * scale, maxWidth: 'none',
							transform: `translate(${(align === 'left' ? -1 : 1) * sideways * 0.5 * wave(p)}px, ${-over * wave(p, i * 0.5)}px)`,
							opacity: i === 0 ? 1 : mix
						}}
					/>
				);
			})}
			<div style={{ position: 'absolute', inset: 10, border: `2px solid ${c.red}`, opacity: 0.35 + 0.35 * wave(p * 2), pointerEvents: 'none' }} />
		</LoopFrame>
	);
};

/**
 * Many real captures, each shown once in turn (no back-and-forth): a slow drift down each one, then a cross-fade
 * to the next; the last fades into the first, so the loop's seam is just another cut.
 */
export const Sequence: React.FC<{ shots: { file: string; w: number; h: number }[]; label: string }> = ({ shots, label }) => {
	const p = usePhase();
	const { width, height } = useVideoConfig();
	const n = shots.length;
	const FADE = 0.2; // share of a slot spent cross-fading into the next shot
	return (
		<LoopFrame label={label}>
			{shots.map((s, i) => {
				const local = (((p * n - i) % n) + n) % n; // 0..1 during this shot's slot, n - FADE..n while it fades in
				const incoming = local > n - FADE;
				if (local >= 1 && !incoming) return null;
				const scale = Math.max(width / s.w, height / s.h);
				const over = s.h * scale - height;
				const drift = incoming ? 0 : local / (1 + FADE); // keeps drifting a little while the next shot fades in
				return (
					<Img
						key={s.file}
						src={staticFile(`captures/${s.file}`)}
						style={{ position: 'absolute', left: 0, top: 0, width: s.w * scale, height: s.h * scale, maxWidth: 'none', transform: `translateY(${-over * drift}px)`, opacity: incoming ? (local - (n - FADE)) / FADE : 1, zIndex: incoming ? 2 : 1 }}
					/>
				);
			})}
		</LoopFrame>
	);
};
