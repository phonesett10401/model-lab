import type React from 'react';
import { Stamp } from '../parts';
import { c, font } from '../theme';
import { LoopFrame, usePhase, wave } from './Base';

const questions = ['When is the semester 2 exam?', 'Library opening hours?', 'Who do I call in a flood?', 'How do I renew a book?', 'Where is the shelter?'];
const SHIELD = 0.62; // share of the width

/** Slide 7: questions scroll along the band into the assistant; a shield checks each one. IN PROGRESS. */
export const Rag: React.FC = () => {
	const p = usePhase();
	let hit = 0;
	const bubbles = questions.map((q, i) => {
		const x = 1.1 - ((p + i / questions.length) % 1) * 1.35; // right → left, wrapping off-screen
		hit = Math.max(hit, 1 - Math.min(1, Math.abs(x - SHIELD) / 0.05));
		return (
			<div key={q} style={{ position: 'absolute', left: `${x * 100}%`, top: 100, transform: 'translateX(-50%)', whiteSpace: 'nowrap', fontSize: 26, padding: '14px 22px', background: c.plate, border: `2px solid ${c.hairline}`, borderRadius: '18px 18px 18px 4px', color: c.ink }}>
				{q}
			</div>
		);
	});
	return (
		<LoopFrame sample>
			{bubbles}
			<svg viewBox="0 0 100 120" style={{ position: 'absolute', left: `calc(${SHIELD * 100}% - 55px)`, top: 60, width: 110, zIndex: 2, filter: `drop-shadow(0 0 ${10 + 30 * hit}px ${c.red})` }}>
				<path d="M50 4 L94 20 V58 C94 88 72 108 50 116 C28 108 6 88 6 58 V20 Z" fill={`rgba(255,79,79,${0.15 + 0.35 * hit})`} stroke={c.red} strokeWidth="4" />
			</svg>
			<div style={{ position: 'absolute', left: 40, top: 30, fontFamily: font.mono, fontSize: 20, letterSpacing: '0.2em', color: c.soft }}>RETRIEVE → ANSWER</div>
			<div style={{ position: 'absolute', right: 60, bottom: 40, transform: `scale(${1 + 0.04 * wave(p * 2)})` }}>
				<Stamp size={24}>IN PROGRESS</Stamp>
			</div>
		</LoopFrame>
	);
};
