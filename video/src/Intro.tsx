import type React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import './fonts';
import { c, font } from './theme';
import { beat, beats, cues, FPS, MUSIC, musicVolume, type BeatId } from './timeline';
import { unit, type Layout } from './layout';
import { Bug } from './parts';
import { Grain, Vignette } from './fx';
import { Title } from './beats/Title';
import { Fly } from './beats/Fly';
import { Focus } from './beats/Focus';
import { Expand } from './beats/Expand';
import { Upload } from './beats/Upload';
import { Result } from './beats/Result';
import { Wrong } from './beats/Wrong';
import { Report } from './beats/Report';
import { End } from './beats/End';

type Scene = React.FC<{ layout: Layout; from: number }>;
const scenes: Record<BeatId, Scene> = { title: Title, fly: Fly, focus: Focus, expand: Expand, upload: Upload, result: Result, wrong: Wrong, report: Report, end: End };

export const Intro: React.FC<{ layout: Layout }> = ({ layout }) => (
	<AbsoluteFill style={{ background: c.ground, color: c.ink, fontFamily: font.sans }}>
		{beats.map((b) => {
			const Scene = scenes[b.id];
			return (
				<Sequence key={b.id} from={b.from} durationInFrames={b.duration}>
					<Scene layout={layout} from={b.from} />
				</Sequence>
			);
		})}
		{/* The brand stays on screen between the opening and closing lockups. */}
		<Sequence from={beat('fly').from} durationInFrames={beat('end').from - beat('fly').from}>
			<Bug u={unit(layout)} />
		</Sequence>
		<Vignette />
		<Grain />
		<Audio src={staticFile(MUSIC.file)} trimBefore={Math.round(MUSIC.startSeconds * FPS)} volume={musicVolume} />
		{cues.map((q, i) => (
			<Sequence key={i} from={q.at}>
				<Audio src={staticFile(`sfx/${q.sfx}.wav`)} volume={q.volume} playbackRate={q.rate ?? 1} />
			</Sequence>
		))}
	</AbsoluteFill>
);
