import type React from 'react';
import { c, font } from '../theme';
import { Detected, LoopFrame, usePhase } from './Base';

const stations = ['COLLECT', 'TRAIN', 'TEST', 'SHIP'];
const at = [0.14, 0.38, 0.62, 0.86]; // share of the width

/** Slide 3: a photo travels the band through Collect → Train → Test → Ship; a box locks on at Test. */
export const Pipeline: React.FC = () => {
	const p = usePhase();
	const x = -0.08 + p * 1.16; // enters left, leaves right, so the seam happens off-screen
	const near = (i: number) => Math.max(0, 1 - Math.abs(x - at[i]) / 0.09);
	const locked = x > at[2] - 0.02;
	return (
		<LoopFrame sample>
			<div style={{ position: 'absolute', left: 0, right: 0, top: 150, height: 2, background: `linear-gradient(90deg, transparent, ${c.red} 10%, ${c.red} 90%, transparent)`, opacity: 0.6 }} />
			{stations.map((s, i) => (
				<div key={s} style={{ position: 'absolute', left: `${at[i] * 100}%`, top: 60, transform: 'translateX(-50%)', textAlign: 'center', fontFamily: font.mono, fontSize: 22, letterSpacing: '0.2em', color: near(i) > 0.2 ? c.red : c.soft }}>
					<div style={{ width: 18, height: 18, margin: '0 auto 10px', borderRadius: '50%', border: `2px solid ${c.red}`, background: near(i) > 0.2 ? c.red : c.ground, boxShadow: `0 0 ${30 * near(i)}px ${c.red}` }} />
					{s}
				</div>
			))}
			<div style={{ position: 'absolute', left: `${x * 100}%`, top: 125, marginLeft: -75 }}>
				<Detected width={150} boxed={locked ? 1 : 0} />
			</div>
		</LoopFrame>
	);
};
