import type React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { c, font } from '../theme';
import { Bench, Caption, Sample } from '../parts';
import { BeatGlow } from '../fx';
import { WIPE } from '../timeline';
import { unit, type Layout } from '../layout';

const page = (file: string, clip?: string) => (
	<Img src={staticFile(`photos/${file}`)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', clipPath: clip }} />
);

/** The comic translator: a red scan line wipes the English page into Burmese, lettered in the same bubbles. */
export const Comic: React.FC<{ layout: Layout; from: number }> = ({ layout, from }) => {
	const frame = useCurrentFrame();
	const u = unit(layout);
	const w = interpolate(frame, WIPE, [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
	const lang = (on: boolean, label: string) => (
		<span style={{ color: on ? c.ink : c.faint, borderBottom: `${3 * u}px solid ${on ? c.red : 'transparent'}`, paddingBottom: 4 * u }}>{label}</span>
	);
	const panel = (
		<AbsoluteFill style={{ background: c.plate }}>
			{page('comic-en.jpg')}
			{page('comic-my.jpg', `inset(0 ${(1 - w) * 100}% 0 0)`)}
			{w > 0 && w < 1 && <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${w * 100}%`, width: 4 * u, background: c.red, boxShadow: `0 0 ${30 * u}px ${8 * u}px rgba(255,79,79,0.6)` }} />}
		</AbsoluteFill>
	);
	return (
		<>
			<BeatGlow from={from} strength={0.6} />
			<Bench layout={layout} u={u} panel={panel}>
				<Caption u={u}>It reads comics, too.</Caption>
				<div style={{ fontFamily: font.serif, fontSize: 80 * u, lineHeight: 1 }}>
					English in.
					<br />
					<span style={{ fontStyle: 'italic', color: c.red }}>Burmese out.</span>
				</div>
				<div style={{ display: 'flex', gap: 28 * u, fontFamily: font.mono, fontSize: 28 * u }}>
					{lang(w < 0.5, 'EN')}
					<span style={{ color: c.faint }}>→</span>
					{lang(w >= 0.5, 'MY')}
				</div>
				<div style={{ display: 'grid', gap: 10 * u, fontFamily: font.mono, fontSize: 26 * u, color: c.soft, opacity: interpolate(frame, [WIPE[1], WIPE[1] + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
					<div>97% of text found · 97 test pages</div>
					<div>94.8% fits its bubble</div>
				</div>
				<div style={{ fontFamily: font.mono, fontSize: 18 * u, color: c.faint }}>Pepper&amp;Carrot by David Revoy · CC BY 4.0</div>
			</Bench>
			<Sample u={u} />
		</>
	);
};
