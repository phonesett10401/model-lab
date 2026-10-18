import type React from 'react';
import { interpolate, random } from 'remotion';
import { c, font } from '../theme';
import { LoopFrame, usePhase } from './Base';
import { SOUND_LENGTH, soundEvents } from './samples';

const lanes = ['speech', 'engine / traffic', 'clapping'];

/** Slide 6: a playhead runs down the clip; each sound's bar grows as it is heard, with its confidence. Real output, no SAMPLE. */
export const Sound: React.FC = () => {
	const p = usePhase();
	const top = 250, bottom = 1010, left = 40, laneW = 120, gap = 20;
	const sweep = Math.min(1, p / 0.85); // the clip plays over 85% of the loop, then everything fades for a clean restart
	const t = sweep * SOUND_LENGTH;
	const fade = interpolate(p, [0.88, 1], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
	const y = (s: number) => top + (s / SOUND_LENGTH) * (bottom - top);
	return (
		<LoopFrame label="REAL MODEL OUTPUT">
			<div style={{ position: 'absolute', top: 60, left, right: 30, fontFamily: font.mono, fontSize: 18, letterSpacing: '0.18em', color: c.red }}>SOUND DETECTIVE</div>
			<div style={{ position: 'absolute', top: 96, left, right: 30, fontFamily: font.serif, fontSize: 40, lineHeight: 1.05, color: c.ink }}>Two sounds at once</div>
			{lanes.map((name, i) => (
				<div key={name} style={{ position: 'absolute', top: 200, left: left + i * (laneW + gap), width: laneW, fontFamily: font.mono, fontSize: 14, color: c.soft, textAlign: 'center' }}>{name}</div>
			))}
			<div style={{ opacity: fade }}>
				{lanes.map((name, i) => <div key={name} style={{ position: 'absolute', top, height: bottom - top, left: left + i * (laneW + gap) + laneW / 2 - 1, width: 2, background: c.hairline }} />)}
				{soundEvents.map((e, k) => {
					if (t < e.start) return null;
					const i = lanes.indexOf(e.label);
					const shown = Math.min(t, e.end);
					const pop = interpolate(t - e.start, [0, 0.4], [0.6, 1], { extrapolateRight: 'clamp' });
					return (
						<div key={k} style={{ position: 'absolute', top: y(e.start), height: y(shown) - y(e.start), left: left + i * (laneW + gap) + 20, width: laneW - 40, background: c.red, boxShadow: `0 0 18px rgba(255,79,79,${t < e.end ? 0.6 : 0.2})` }}>
							<span style={{ position: 'absolute', top: 4, left: '50%', transform: `translateX(-50%) scale(${pop})`, fontFamily: font.mono, fontSize: 15, color: c.ground, fontWeight: 600 }}>{Math.round(e.score * 100)}%</span>
						</div>
					);
				})}
				{/* the playhead, with a little live waveform riding on it */}
				<div style={{ position: 'absolute', top: y(t), left: 20, right: 20, height: 2, background: c.ink, boxShadow: `0 0 12px ${c.ink}` }}>
					{Array.from({ length: 24 }, (_, j) => {
						const h = 4 + 26 * random(`w${j}-${Math.floor(t * 8)}`);
						return <span key={j} style={{ position: 'absolute', left: `${(j / 24) * 100}%`, top: -h / 2, width: 4, height: h, background: 'rgba(243,238,238,0.35)' }} />;
					})}
				</div>
				<div style={{ position: 'absolute', top: y(t) - 30, right: 26, fontFamily: font.mono, fontSize: 16, color: c.ink }}>{`0:${t.toFixed(1).padStart(4, '0')}`}</div>
			</div>
		</LoopFrame>
	);
};
