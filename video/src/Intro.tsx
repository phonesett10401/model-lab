import type React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import './fonts';
import { c, font } from './theme';
import { beat, beats, cues, FPS, MUSIC, musicVolume, type BeatId } from './timeline';
import { unit, type Layout } from './layout';
import { Bug } from './parts';
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
		{/* The brand stays on screen between the opening and closing lockups. */}
		<Sequence from={beat('fly').from} durationInFrames={beat('end').from - beat('fly').from}>
			<Bug u={unit(layout)} />
		</Sequence>
		<Audio src={staticFile(MUSIC.file)} trimBefore={Math.round(MUSIC.startSeconds * FPS)} volume={musicVolume} />
		{cues.map((q, i) => (
			<Sequence key={i} from={q.at}>
				<Audio src={staticFile(`sfx/${q.sfx}.wav`)} volume={q.volume} playbackRate={q.rate ?? 1} />
			</Sequence>
		))}
	</AbsoluteFill>
);
