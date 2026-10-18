import type React from 'react';
import { AbsoluteFill } from 'remotion';
import { c, font } from '../theme';
import { LoopFrame, Plate, usePhase } from './Base';

const names = ['Sea creature detector', 'Fresh or spoiled', 'Bird song reader', 'Plant disease spotter', 'Sound detective', 'Coin sorter', 'Leaf identifier', 'Gender classifier', 'Recycling sorter'];

/** Slide 2: a grid of small models; the highlight moves from one to the next: one job each. */
export const Boxes: React.FC = () => {
	const p = usePhase();
	const order = [0, 4, 1, 7, 3, 8, 2, 6, 5];
	const step = p * order.length;
	return (
		<LoopFrame sample>
			<AbsoluteFill style={{ padding: '90px 70px 70px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 26, alignContent: 'center' }}>
				{names.map((name, i) => {
					const at = order.indexOf(i);
					const n = order.length;
					const d = (((step - at) % n) + n) % n;
					const hot = Math.max(0, 1 - Math.min(d, n - d)); // 1 on its turn, fading over a step either side, wrapping at the seam
					return <Plate key={name} no={`No. ${String(i + 1).padStart(2, '0')}`} name={name} hot={hot} style={{ width: 'auto', transform: `scale(${1 + hot * 0.06})`, opacity: 0.55 + hot * 0.45 }} />;
				})}
			</AbsoluteFill>
			<div style={{ position: 'absolute', top: 30, left: 70, fontFamily: font.mono, fontSize: 20, letterSpacing: '0.2em', color: c.red }}>ONE JOB EACH</div>
		</LoopFrame>
	);
};
