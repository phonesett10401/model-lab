import type React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { c, font } from '../theme';
import { Bench, Sample } from '../parts';
import { STAMP_AT } from '../timeline';
import { stacked, unit, type Layout } from '../layout';

export const Wrong: React.FC<{ layout: Layout }> = ({ layout }) => {
	const frame = useCurrentFrame();
	const { fps, width } = useVideoConfig();
	const u = unit(layout);
	const said = interpolate(frame, [10, 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
	// The stamp sits on the photo, so size it to the photo (Bench: 80u padding each side, 56u gap, 55% share when side by side).
	const photoWidth = stacked(layout) ? width - 160 * u : (width - 216 * u) * 0.55;
	const stampSize = Math.min(150 * u, photoWidth / 6.5);
	const st = spring({ frame: frame - STAMP_AT, fps, config: { damping: 9, stiffness: 180 } });
	return (
		<>
			<Bench
				layout={layout}
				u={u}
				photo="cuttlefish.jpg"
				overlay={
					<div style={{ opacity: frame < STAMP_AT ? 0 : 1, transform: `rotate(-8deg) scale(${interpolate(st, [0, 1], [2.4, 1])})`, border: `${stampSize / 15}px solid ${c.red}`, color: c.red, fontFamily: font.mono, fontWeight: 600, fontSize: stampSize, letterSpacing: '0.15em', padding: `${stampSize / 25}px ${stampSize / 4}px`, background: 'rgba(20,18,19,0.35)' }}>
						WRONG
					</div>
				}
			>
				<div style={{ fontFamily: font.mono, fontSize: 28 * u, color: c.faint }}>true: cuttlefish</div>
				<div style={{ fontFamily: font.serif, fontSize: 96 * u, color: c.red, opacity: said }}>said: squid 71%</div>
			</Bench>
			<Sample u={u} />
		</>
	);
};
