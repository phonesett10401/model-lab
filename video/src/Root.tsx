import type React from 'react';
import { Composition } from 'remotion';
import { Intro } from './Intro';
import { DURATION, FPS } from './timeline';
import { sizes, type Layout } from './layout';

export const Root: React.FC = () => (
	<Composition
		id="Intro"
		component={Intro}
		durationInFrames={DURATION}
		fps={FPS}
		width={1920}
		height={1080}
		defaultProps={{ layout: 'wide' as Layout }}
		calculateMetadata={({ props }) => sizes[props.layout]}
	/>
);
