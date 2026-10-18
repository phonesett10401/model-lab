import type React from 'react';
import { AbsoluteFill } from 'remotion';
import { Swarm as Specimens } from '../fx';
import { LoopFrame, Plate, TAU, usePhase } from './Base';

const next = ['Octopus', 'Manta ray', 'Orca', 'Lionfish'];

/** Slide 8: new specimens fly in from the depth of the swarm, one after another. */
export const Coming: React.FC = () => {
	const p = usePhase();
	return (
		<LoopFrame sample>
			<Specimens u={0.7} spin={0.4 * Math.sin(TAU * p)} opacity={0.5} />
			<AbsoluteFill style={{ perspective: 900 }}>
				{next.map((name, i) => {
					const t = (p + i / next.length) % 1; // each plate: far → near → past the camera, wrapping
					const z = -1600 + t * 2000;
					const y = (i - 1.5) * 170;
					return (
						<div key={name} style={{ position: 'absolute', left: '58%', top: '50%', transform: `translate(-50%, -50%) translate3d(0, ${y}px, ${z}px)`, opacity: Math.sin(Math.PI * t) }}>
							<Plate no="COMING" name={name} hot={t > 0.55 ? 1 : 0} width={320} />
						</div>
					);
				})}
			</AbsoluteFill>
		</LoopFrame>
	);
};
