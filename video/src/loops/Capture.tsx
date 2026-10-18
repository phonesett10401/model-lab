import type React from 'react';
import { Img, staticFile, useVideoConfig } from 'remotion';
import { c } from '../theme';
import { LoopFrame, usePhase, wave } from './Base';

/**
 * Real screen captures (scripts/capture-present.mjs), no SAMPLE stamp: two captures cross-fade while the view
 * pans slowly down and back. `size` is each capture's pixel size, so the pan covers exactly the overflow.
 */
export const Capture: React.FC<{ shots: { file: string; w: number; h: number }[]; label: string; align?: 'left' | 'right'; scroll?: boolean }> = ({ shots, label, align = 'left', scroll }) => {
	const p = usePhase();
	const { width, height } = useVideoConfig();
	const mix = Math.min(1, Math.max(0, (wave(p) - 0.35) / 0.3)); // first shot, cross-fade, second shot, back
	if (scroll) {
		// Narrow strips: the captures at full width, scrolling up as one seamless column (shots, then the same shots again).
		const total = shots.reduce((sum, s) => sum + (s.h * width) / s.w, 0);
		return (
			<LoopFrame label={label}>
				<div style={{ position: 'absolute', left: 0, top: 0, width, transform: `translateY(${-p * total}px)` }}>
					{[...shots, ...shots].map((s, i) => <Img key={i} src={staticFile(`captures/${s.file}`)} style={{ display: 'block', width, height: (s.h * width) / s.w }} />)}
				</div>
				<div style={{ position: 'absolute', inset: 10, border: `2px solid ${c.red}`, opacity: 0.35 + 0.35 * wave(p * 2), pointerEvents: 'none' }} />
			</LoopFrame>
		);
	}
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
