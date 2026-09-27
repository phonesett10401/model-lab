import type React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { c, font } from '../theme';
import { Stamp } from '../parts';
import { unit, type Layout } from '../layout';

export const Open: React.FC<{ layout: Layout }> = ({ layout }) => {
	const frame = useCurrentFrame();
	const { fps, width, height } = useVideoConfig();
	const u = unit(layout);
	const s = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 25 });
	return (
		<AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
			<div style={{ width: interpolate(s, [0, 1], [420 * u, width - 80 * u]), height: interpolate(s, [0, 1], [170 * u, height - 80 * u]), background: c.plate, border: `${2 * u}px solid ${c.hairline}`, boxShadow: `inset ${8 * u}px 0 ${c.red}`, padding: 40 * u, display: 'grid', alignContent: 'start', gap: 12 * u }}>
				<div style={{ fontFamily: font.mono, fontSize: 22 * u, color: c.faint, letterSpacing: '0.1em' }}>SPECIMEN 01 OF THE LAB</div>
				<div style={{ fontFamily: font.serif, fontSize: interpolate(s, [0, 1], [40 * u, 96 * u]) }}>Creature categorizer</div>
				<div style={{ opacity: s }}><Stamp size={22 * u}>SAMPLE</Stamp></div>
			</div>
		</AbsoluteFill>
	);
};
