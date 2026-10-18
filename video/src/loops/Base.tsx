import type React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { Grain, Vignette } from '../fx';
import { Stamp } from '../parts';
import { c, font } from '../theme';
import { LOOP_FRAMES } from './sizes';

/** Loop phase 0 → 1; frame LOOP_FRAMES is the same as frame 0. */
export const usePhase = () => useCurrentFrame() / LOOP_FRAMES;
/** A smooth 0 → 1 → 0 wave over the loop, shifted by `at` (0..1). */
export const wave = (p: number, at = 0) => 0.5 - 0.5 * Math.cos(2 * Math.PI * (p - at));
export const TAU = Math.PI * 2;

/** The intro's ground, grain and vignette, plus the SAMPLE stamp on illustrative loops (owner's honesty rule). */
export const LoopFrame: React.FC<{ sample?: boolean; label?: string; children: React.ReactNode }> = ({ sample, label, children }) => (
	<AbsoluteFill style={{ background: c.ground, overflow: 'hidden', fontFamily: font.sans, color: c.ink }}>
		{children}
		{label && (
			<div style={{ position: 'absolute', left: 24, bottom: 18, fontFamily: font.mono, fontSize: 16, letterSpacing: '0.14em', color: c.soft, background: 'rgba(20,18,19,0.8)', padding: '4px 10px' }}>{label}</div>
		)}
		{sample && (
			<div style={{ position: 'absolute', top: 22, right: 26 }}>
				<Stamp size={18}>SAMPLE</Stamp>
			</div>
		)}
		<Vignette />
		<Grain />
	</AbsoluteFill>
);

/** A specimen plate like the intro's. */
export const Plate: React.FC<{ no: string; name: string; hot?: number; width?: number; style?: React.CSSProperties }> = ({ no, name, hot = 0, width = 300, style }) => (
	<div
		style={{
			width, padding: '14px 18px', background: c.plate, border: `2px solid ${hot > 0.5 ? c.red : c.hairline}`,
			boxShadow: `0 0 ${40 * hot}px rgba(255,79,79,${0.55 * hot})`, ...style
		}}
	>
		<div style={{ fontFamily: font.mono, fontSize: 15, color: c.faint, letterSpacing: '0.1em' }}>{no}</div>
		<div style={{ fontFamily: font.serif, fontSize: 30, color: c.ink, marginTop: 4, whiteSpace: 'nowrap' }}>{name}</div>
	</div>
);

/**
 * The lab's own dolphin sample with the box and score the real model gave it (src/lib/data/sea-creature-detector.json),
 * so the illustration never shows a detection the model can't make.
 */
const DOLPHIN = { w: 1024, h: 678, box: [0.0065, 0.1842, 0.9422, 0.8947], label: 'dolphin 66%' };
export const Detected: React.FC<{ width: number; boxed: number; credit?: boolean }> = ({ width, boxed, credit }) => {
	const [x1, y1, x2, y2] = DOLPHIN.box;
	return (
		<div style={{ position: 'relative', width, height: (width * DOLPHIN.h) / DOLPHIN.w, border: `2px solid ${c.hairline}`, boxShadow: '0 10px 30px rgba(0,0,0,0.6)' }}>
			<Img src={staticFile('photos/dolphin.jpg')} style={{ width: '100%', height: '100%', display: 'block' }} />
			<div style={{ position: 'absolute', left: `${x1 * 100}%`, top: `${y1 * 100}%`, width: `${(x2 - x1) * 100}%`, height: `${(y2 - y1) * 100}%`, border: `3px solid ${c.red}`, opacity: boxed }}>
				<span style={{ position: 'absolute', top: -2, left: -3, transform: 'translateY(-100%)', background: c.red, color: c.ground, fontFamily: font.mono, fontSize: Math.max(11, width / 18), padding: '1px 6px', whiteSpace: 'nowrap' }}>{DOLPHIN.label}</span>
			</div>
			{credit && <div style={{ position: 'absolute', top: '100%', marginTop: 6, left: 0, fontFamily: font.mono, fontSize: 12, color: c.faint, whiteSpace: 'nowrap' }}>bp6316 · Flickr · CC BY 2.0</div>}
		</div>
	);
};
