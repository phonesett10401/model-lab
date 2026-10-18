import type React from 'react';
import { useVideoConfig } from 'remotion';
import { c, font } from '../theme';
import { Detected, LoopFrame, usePhase } from './Base';
import { seaSamples } from './samples';

const stations = ['COLLECT', 'TRAIN', 'TEST', 'SHIP'];
const at = [0.14, 0.38, 0.62, 0.86]; // share of the width
const CARD = 150;

/** Slide 3: the lab's sample photos travel, one at a time with gaps, Collect → Train → Test → Ship; each gets its real boxes at Test. */
export const Pipeline: React.FC = () => {
	const p = usePhase();
	const n = seaSamples.length;
	const { width } = useVideoConfig();
	// A photo, a blank stretch, the next photo: cards sit GAP apart, so about two are on the band at once.
	// The whole train (n × GAP) is longer than the band, so each card wraps while it is off-screen.
	const GAP = 960;
	const cards = seaSamples.map((s, i) => ({ s, x: (((p + i / n) % 1) * n * GAP - CARD) / width }));
	const near = (i: number) => Math.max(0, ...cards.map((k) => 1 - Math.abs(k.x - at[i]) / 0.06));
	const atTest = cards.reduce((a, b) => (Math.abs(b.x - at[2]) < Math.abs(a.x - at[2]) ? b : a));
	return (
		<LoopFrame sample>
			<div style={{ position: 'absolute', left: 0, right: 0, top: 150, height: 2, background: `linear-gradient(90deg, transparent, ${c.red} 10%, ${c.red} 90%, transparent)`, opacity: 0.6 }} />
			{stations.map((s, i) => (
				<div key={s} style={{ position: 'absolute', left: `${at[i] * 100}%`, top: 30, transform: 'translateX(-50%)', textAlign: 'center', fontFamily: font.mono, fontSize: 20, letterSpacing: '0.2em', color: near(i) > 0.2 ? c.red : c.soft }}>
					<div style={{ width: 16, height: 16, margin: '0 auto 8px', borderRadius: '50%', border: `2px solid ${c.red}`, background: near(i) > 0.2 ? c.red : c.ground, boxShadow: `0 0 ${30 * near(i)}px ${c.red}` }} />
					{s}
				</div>
			))}
			{cards.map(({ s, x }) => (
				<div key={s.id} style={{ position: 'absolute', left: `${x * 100}%`, top: 100, marginLeft: -CARD / 2 }}>
					<Detected sample={s} width={CARD} boxed={x > at[2] - 0.015 ? 1 : 0} />
				</div>
			))}
			<div style={{ position: 'absolute', left: 24, bottom: 14, fontFamily: font.mono, fontSize: 13, color: c.faint }}>Photo: {atTest.s.credit}</div>
		</LoopFrame>
	);
};
