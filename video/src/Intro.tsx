import type React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import './fonts';
import { c, font } from './theme';
import { beats, cues, padVolume, type BeatId } from './timeline';
import type { Layout } from './layout';
import { Title } from './beats/Title';
import { Fly } from './beats/Fly';
import { Open } from './beats/Open';
import { Right } from './beats/Right';
import { Wrong } from './beats/Wrong';
import { Report } from './beats/Report';
import { End } from './beats/End';

const scenes: Record<BeatId, React.FC<{ layout: Layout }>> = { title: Title, fly: Fly, open: Open, right: Right, wrong: Wrong, report: Report, end: End };

export const Intro: React.FC<{ layout: Layout }> = ({ layout }) => (
	<AbsoluteFill style={{ background: c.ground, color: c.ink, fontFamily: font.sans }}>
		{beats.map((b) => {
			const Scene = scenes[b.id];
			return (
				<Sequence key={b.id} from={b.from} durationInFrames={b.duration}>
					<Scene layout={layout} />
				</Sequence>
			);
		})}
		<Audio src={staticFile('sfx/pad.wav')} volume={padVolume} />
		{cues.map((q, i) => (
			<Sequence key={i} from={q.at}>
				<Audio src={staticFile(`sfx/${q.sfx}.wav`)} volume={q.volume} playbackRate={q.rate ?? 1} />
			</Sequence>
		))}
	</AbsoluteFill>
);
