import type React from 'react';
import { useVideoConfig } from 'remotion';
import { Stamp } from '../parts';
import { c, font } from '../theme';
import { LoopFrame, usePhase, wave } from './Base';

const questions = ['When is the semester 2 exam?', 'Library opening hours?', 'Who do I call in a flood?', 'How do I renew a book?', 'Where is the shelter?'];
const MAX_W = 440; // widest bubble, px: every bubble starts and ends fully off-screen, so nothing pops in at the wrap
const SHIELD = 0.6; // share of the width

/** Slide 7: questions glide right → left into a shield; past it each one is answered from the assistant's documents. IN PROGRESS. */
export const Rag: React.FC = () => {
	const p = usePhase();
	const { width } = useVideoConfig();
	const travel = width + 2 * MAX_W;
	const shieldX = SHIELD * width;
	let hit = 0;
	const bubbles = questions.map((q, i) => {
		const x = width + MAX_W - ((p + i / questions.length) % 1) * travel; // centre, px, constant speed
		hit = Math.max(hit, 1 - Math.min(1, Math.abs(x - shieldX) / 120));
		const answered = x < shieldX;
		return (
			<div key={q} style={{ position: 'absolute', left: x, top: 96, transform: 'translateX(-50%)', whiteSpace: 'nowrap', fontSize: 26, padding: '14px 22px', background: c.plate, border: `2px solid ${answered ? c.red : c.hairline}`, borderRadius: '18px 18px 18px 4px', color: c.ink }}>
				{q}
				{answered && <span style={{ position: 'absolute', left: 16, top: '100%', marginTop: 8, fontFamily: font.mono, fontSize: 15, color: c.red, letterSpacing: '0.08em' }}>✓ ANSWERED FROM ITS DOCUMENTS</span>}
			</div>
		);
	});
	return (
		<LoopFrame sample>
			{bubbles}
			<svg viewBox="0 0 100 120" style={{ position: 'absolute', left: shieldX - 50, top: 64, width: 100, zIndex: 2 }}>
				<path d="M50 4 L94 20 V58 C94 88 72 108 50 116 C28 108 6 88 6 58 V20 Z" fill={c.ground} />
				<path d="M50 4 L94 20 V58 C94 88 72 108 50 116 C28 108 6 88 6 58 V20 Z" fill={`rgba(255,79,79,${0.18 + 0.4 * hit})`} stroke={c.red} strokeWidth="4" />
			</svg>
			<div style={{ position: 'absolute', left: shieldX - 160, top: 64, width: 320, height: 120, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(255,79,79,0.35), transparent 70%)', opacity: 0.3 + 0.7 * hit }} />
			<div style={{ position: 'absolute', left: 40, top: 30, fontFamily: font.mono, fontSize: 20, letterSpacing: '0.2em', color: c.soft }}>RETRIEVE → ANSWER</div>
			<div style={{ position: 'absolute', right: 60, bottom: 30, transform: `scale(${1 + 0.04 * wave(p * 2)})` }}>
				<Stamp size={24}>IN PROGRESS</Stamp>
			</div>
		</LoopFrame>
	);
};
