import type React from 'react';
import { Composition } from 'remotion';
import { Boxes } from './Boxes';
import { Capture } from './Capture';
import { Coming } from './Coming';
import { Device } from './Device';
import { Pipeline } from './Pipeline';
import { Rag } from './Rag';
import { Swarm } from './Swarm';
import { LOOP_FPS, LOOP_FRAMES, loopSize, loops } from './sizes';

// Pixel sizes of the real captures in public/captures (2× screenshots from scripts/capture-present.mjs).
const Sea = () => <Capture label="REAL CAPTURE · SEA CREATURE DETECTOR" align="right" shots={[{ file: 'sea-1.png', w: 1174, h: 1930 }, { file: 'sea-2.png', w: 1174, h: 1530 }]} />;
const Sound = () => <Capture label="REAL CAPTURE · SOUND" scroll shots={[{ file: 'sound-1.png', w: 1174, h: 2110 }, { file: 'sound-2.png', w: 1174, h: 1234 }]} />;
const Site = () => <Capture label="LIVE SITE" shots={[{ file: 'home.png', w: 2560, h: 4652 }]} />;

const parts: Record<string, React.FC> = { swarm: Swarm, boxes: Boxes, pipeline: Pipeline, device: Device, sea: Sea, sound: Sound, rag: Rag, coming: Coming, site: Site };

export const Loops: React.FC = () => (
	<>
		{loops.map((l) => (
			<Composition key={l.id} id={`Loop-${l.id}`} component={parts[l.id]} durationInFrames={LOOP_FRAMES} fps={LOOP_FPS} {...loopSize[l.layout]} />
		))}
	</>
);
