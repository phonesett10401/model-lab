import type React from 'react';
import { Composition } from 'remotion';
import { Boxes } from './Boxes';
import { Capture, Sequence } from './Capture';
import { Sound } from './Sound';
import { Coming } from './Coming';
import { Device } from './Device';
import { Pipeline } from './Pipeline';
import { Rag } from './Rag';
import { Swarm } from './Swarm';
import { LOOP_FPS, framesOf, loops, sizeOf } from './sizes';

// Pixel sizes of the real captures in public/captures (2× screenshots from scripts/capture-present.mjs).
const Sea = () => (
	<Sequence
		label="REAL CAPTURE · SEA CREATURE DETECTOR"
		shots={[
			{ file: 'sea-aquarium.png', w: 1174, h: 1930 },
			{ file: 'sea-dolphin.png', w: 1174, h: 1530 },
			{ file: 'sea-turtle.png', w: 1174, h: 1530 },
			{ file: 'sea-seal.png', w: 1174, h: 1530 },
			{ file: 'sea-shark.png', w: 1174, h: 1530 },
			{ file: 'sea-school.png', w: 1174, h: 1988 }
		]}
	/>
);
const Site = () => <Capture label="LIVE SITE" shots={[{ file: 'home.png', w: 2560, h: 4652 }]} />;

const parts: Record<string, React.FC> = { swarm: Swarm, boxes: Boxes, pipeline: Pipeline, device: Device, sea: Sea, sound: Sound, rag: Rag, coming: Coming, site: Site };

export const Loops: React.FC = () => (
	<>
		{loops.map((l) => (
			<Composition key={l.id} id={`Loop-${l.id}`} component={parts[l.id]} durationInFrames={framesOf(l)} fps={LOOP_FPS} {...sizeOf(l)} />
		))}
	</>
);
