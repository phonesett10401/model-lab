import type React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { c, font } from '../theme';
import { Bars, Bench, Caption, Sample } from '../parts';
import { BeatGlow } from '../fx';
import { ANSWER_AT, BARS_AT } from '../timeline';
import { unit, type Layout } from '../layout';

/** Detection-box corners that close in on the subject, with a label tag once it's identified. */
const Corners: React.FC<{ u: number; lock: number; tag: number }> = ({ u, lock, tag }) => {
	const inset = interpolate(lock, [0, 1], [2, 16]);
	const arm = 60 * u;
	const edge = `${5 * u}px solid ${c.red}`;
	const corner = (style: React.CSSProperties) => <div style={{ position: 'absolute', width: arm, height: arm, filter: `drop-shadow(0 0 ${10 * u}px ${c.red})`, ...style }} />;
	return (
		<AbsoluteFill>
			<div style={{ position: 'absolute', inset: `${inset}%` }}>
				{corner({ left: 0, top: 0, borderLeft: edge, borderTop: edge })}
				{corner({ right: 0, top: 0, borderRight: edge, borderTop: edge })}
				{corner({ left: 0, bottom: 0, borderLeft: edge, borderBottom: edge })}
				{corner({ right: 0, bottom: 0, borderRight: edge, borderBottom: edge })}
				<div style={{ position: 'absolute', left: 0, top: -48 * u, background: c.red, color: c.ground, fontFamily: font.mono, fontWeight: 600, fontSize: 24 * u, padding: `${4 * u}px ${12 * u}px`, letterSpacing: '0.1em', opacity: tag }}>
					OCTOPUS · 94%
				</div>
			</div>
		</AbsoluteFill>
	);
};

export const Result: React.FC<{ layout: Layout; from: number }> = ({ layout, from }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const u = unit(layout);
	const lock = spring({ frame: frame - 6, fps, config: { damping: 14 } });
	const word = 'octopus';
	const typed = word.slice(0, Math.max(0, Math.min(word.length, Math.floor((frame - (ANSWER_AT - 14)) / 2))));
	const tag = interpolate(frame, [ANSWER_AT, ANSWER_AT + 6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
	return (
		<>
			<BeatGlow from={from} strength={0.6} />
			<Bench layout={layout} u={u} photo="octopus.jpg" scan grid overlay={<Corners u={u} lock={lock} tag={tag} />}>
				<Caption u={u}>Every model gets tested.</Caption>
				<div style={{ fontFamily: font.serif, fontSize: 104 * u, lineHeight: 1, minHeight: 104 * u, textShadow: `0 0 ${30 * u}px rgba(255,79,79,0.35)` }}>
					{typed}
					<span style={{ color: c.red, opacity: frame % 10 < 5 && typed.length < word.length ? 1 : 0 }}>▌</span>
				</div>
				<Bars u={u} startAt={BARS_AT} rows={[{ label: 'octopus', score: 0.94 }, { label: 'squid', score: 0.04 }, { label: 'cuttlefish', score: 0.02 }]} />
				<div style={{ fontFamily: font.mono, fontSize: 22 * u, color: c.faint }}>{frame < ANSWER_AT ? 'EXAMINING…' : 'IDENTIFIED'}</div>
			</Bench>
			<Sample u={u} />
		</>
	);
};
