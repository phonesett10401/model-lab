import type React from 'react';
import { random } from 'remotion';
import { c, font } from '../theme';
import { Detected, LoopFrame, TAU, usePhase, wave } from './Base';

/** Slide 4: the model streams into a phone as particles; the photo never leaves it. */
export const Device: React.FC = () => {
	const p = usePhase();
	const phone = { left: 70, top: 300, width: 340, height: 640 };
	return (
		<LoopFrame sample>
			<div style={{ position: 'absolute', top: 70, left: 0, right: 0, textAlign: 'center', fontFamily: font.mono, fontSize: 22, letterSpacing: '0.2em', color: c.red }}>ONNX MODEL</div>
			{Array.from({ length: 26 }, (_, i) => {
				const t = (p * 2 + random(`t${i}`)) % 1; // two passes per loop, so particles wrap seamlessly
				const x = phone.left + 40 + random(`x${i}`) * (phone.width - 80);
				const y = 120 + t * (phone.top + 60 - 120);
				return <div key={i} style={{ position: 'absolute', left: x, top: y, width: 6, height: 18, background: c.red, opacity: Math.sin(Math.PI * t), boxShadow: `0 0 10px ${c.red}` }} />;
			})}
			<div style={{ position: 'absolute', ...phone, border: `3px solid ${c.soft}`, borderRadius: 46, background: c.plate, overflow: 'hidden', boxShadow: `0 0 ${30 + 30 * wave(p * 2)}px rgba(255,79,79,0.35)` }}>
				<div style={{ position: 'absolute', left: 30, top: 110 }}>
					<Detected width={274} boxed={0.6 + 0.4 * wave(p * 2)} credit />
				</div>
				{/* shield */}
				<svg viewBox="0 0 100 120" style={{ position: 'absolute', left: 120, top: 410, width: 100, transform: `scale(${1 + 0.08 * Math.sin(TAU * p * 2)})` }}>
					<path d="M50 4 L94 20 V58 C94 88 72 108 50 116 C28 108 6 88 6 58 V20 Z" fill="rgba(255,79,79,0.15)" stroke={c.red} strokeWidth="4" />
					<path d="M30 60 L45 75 L72 45" fill="none" stroke={c.red} strokeWidth="6" />
				</svg>
				<div style={{ position: 'absolute', bottom: 40, left: 0, right: 0, textAlign: 'center', fontFamily: font.mono, fontSize: 17, letterSpacing: '0.14em', color: c.soft }}>PHOTO STAYS HERE</div>
			</div>
		</LoopFrame>
	);
};
