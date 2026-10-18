import type React from 'react';
import { useVideoConfig } from 'remotion';
import { Stamp } from '../parts';
import { c, font } from '../theme';
import { Detected, LoopFrame, usePhase, wave } from './Base';
import { seaSamples } from './samples';

// Square versions of the two band loops (slides 3 and 7) for phones held upright, where a wide band would be a sliver.

const stations = ['COLLECT', 'TRAIN', 'TEST', 'SHIP'];
const at = [0.16, 0.39, 0.62, 0.85]; // share of the height
const LINE = 360; // x of the pipeline, px
const CARD = 320;

/** Slide 3 upright: the same sample photos travel down the pipeline, one at a time with gaps; real boxes from TEST on. */
export const PipelineTall: React.FC = () => {
	const p = usePhase();
	const { height } = useVideoConfig();
	const n = seaSamples.length;
	const GAP = 560; // about two photos on screen; the whole train is longer than the frame, so each wraps off-screen
	const cards = seaSamples.map((s, i) => {
		const h = (CARD * s.h) / s.w;
		return { s, h, y: ((p + i / n) % 1) * n * GAP - h }; // top edge, px
	});
	const centre = (k: (typeof cards)[number]) => (k.y + k.h / 2) / height;
	const near = (i: number) => Math.max(0, ...cards.map((k) => 1 - Math.abs(centre(k) - at[i]) / 0.06));
	const atTest = cards.reduce((a, b) => (Math.abs(centre(b) - at[2]) < Math.abs(centre(a) - at[2]) ? b : a));
	return (
		<LoopFrame sample>
			<div style={{ position: 'absolute', left: LINE, top: 0, bottom: 0, width: 2, background: `linear-gradient(transparent, ${c.red} 8%, ${c.red} 92%, transparent)`, opacity: 0.6 }} />
			{stations.map((s, i) => (
				<div key={s} style={{ position: 'absolute', top: `${at[i] * 100}%`, left: 0, width: LINE + 9, transform: 'translateY(-50%)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 22, fontFamily: font.mono, fontSize: 34, letterSpacing: '0.18em', color: near(i) > 0.2 ? c.red : c.soft }}>
					{s}
					<span style={{ width: 20, height: 20, borderRadius: '50%', border: `3px solid ${c.red}`, background: near(i) > 0.2 ? c.red : c.ground, boxShadow: `0 0 ${36 * near(i)}px ${c.red}` }} />
				</div>
			))}
			{cards.map(({ s, y, h }) => (
				<div key={s.id} style={{ position: 'absolute', left: LINE + 60, top: y }}>
					<Detected sample={s} width={CARD} boxed={(y + h / 2) / height > at[2] - 0.015 ? 1 : 0} />
				</div>
			))}
			<div style={{ position: 'absolute', left: 30, bottom: 22, right: 30, fontFamily: font.mono, fontSize: 18, color: c.faint }}>Photo: {atTest.s.credit}</div>
		</LoopFrame>
	);
};

const questions = ['When is the semester 2 exam?', 'Library opening hours?', 'Who do I call in a flood?', 'How do I renew a book?', 'Where is the shelter?'];
const PAD = 140; // a bubble plus its answer tag, px: each starts and ends fully off-screen
const SHIELD = 0.48; // share of the height

/** Slide 7 upright: questions rise into the shield; past it each one is answered from the assistant's documents. */
export const RagTall: React.FC = () => {
	const p = usePhase();
	const { height } = useVideoConfig();
	const travel = height + 2 * PAD;
	const shieldY = SHIELD * height;
	let hit = 0;
	const bubbles = questions.map((q, i) => {
		const y = height + PAD - ((p + i / questions.length) % 1) * travel; // centre, px, constant speed, rising
		hit = Math.max(hit, 1 - Math.min(1, Math.abs(y - shieldY) / 90));
		const answered = y < shieldY;
		return (
			<div key={q} style={{ position: 'absolute', left: '50%', top: y, transform: 'translate(-50%, -50%)', whiteSpace: 'nowrap', fontSize: 40, padding: '18px 30px', background: c.plate, border: `2px solid ${answered ? c.red : c.hairline}`, borderRadius: '24px 24px 24px 6px', color: c.ink }}>
				{q}
				{answered && <span style={{ position: 'absolute', left: 20, top: '100%', marginTop: 10, fontFamily: font.mono, fontSize: 22, color: c.red, letterSpacing: '0.08em' }}>✓ ANSWERED FROM ITS DOCUMENTS</span>}
			</div>
		);
	});
	return (
		<LoopFrame sample>
			{bubbles}
			<div style={{ position: 'absolute', left: 0, right: 0, top: shieldY - 1, height: 2, background: `linear-gradient(90deg, transparent, ${c.red}, transparent)`, opacity: 0.4 + 0.6 * hit }} />
			<svg viewBox="0 0 100 120" style={{ position: 'absolute', right: 40, top: shieldY - 75, width: 125, zIndex: 2 }}>
				<path d="M50 4 L94 20 V58 C94 88 72 108 50 116 C28 108 6 88 6 58 V20 Z" fill={c.ground} />
				<path d="M50 4 L94 20 V58 C94 88 72 108 50 116 C28 108 6 88 6 58 V20 Z" fill={`rgba(255,79,79,${0.18 + 0.4 * hit})`} stroke={c.red} strokeWidth="4" />
			</svg>
			<div style={{ position: 'absolute', left: 40, top: 36, fontFamily: font.mono, fontSize: 30, letterSpacing: '0.2em', color: c.soft, zIndex: 3 }}>RETRIEVE → ANSWER</div>
			<div style={{ position: 'absolute', right: 50, bottom: 40, zIndex: 3, transform: `scale(${1 + 0.04 * wave(p * 2)})` }}>
				<Stamp size={30}>IN PROGRESS</Stamp>
			</div>
		</LoopFrame>
	);
};
