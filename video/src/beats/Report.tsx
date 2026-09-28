import type React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { c, font } from '../theme';
import { Caption, Sample, Stamp } from '../parts';
import { BeatGlow } from '../fx';
import { COLUMNS_AT, RECORDED_AT } from '../timeline';
import { stacked, unit, type Layout } from '../layout';

// Every model in the lab gets a card; they fan out in 3D, and the top one is No. 01 with the failure just filed.
const cards = ['No. 03 · Gender classifier', 'No. 02 · Fresh or spoiled', 'No. 01 · Sea creature detector'];
const sections: { title: string; lines: string[] }[] = [
	{ title: 'DATA', lines: ['Source · iNaturalist', 'Split · —'] },
	{ title: 'ACCURACY', lines: ['octopus · —', 'squid · —', 'cuttlefish · —'] },
	{ title: 'HOW IT FAILS', lines: ['cuttlefish → squid'] }
];

export const Report: React.FC<{ layout: Layout; from: number }> = ({ layout, from }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const u = unit(layout);
	const tall = stacked(layout);
	const rec = spring({ frame: frame - RECORDED_AT, fps, config: { damping: 9, stiffness: 180 } });
	const drift = interpolate(frame, [0, 51], [0, 1]); // a slow camera drift keeps the stack alive
	return (
		<AbsoluteFill>
			<BeatGlow from={from} strength={0.8} />
			<AbsoluteFill style={{ padding: `${110 * u}px ${90 * u}px ${90 * u}px`, gap: 28 * u }}>
				<Caption u={u}>Every model gets a report card.</Caption>
				<div style={{ position: 'relative', flex: 1, marginTop: 72 * u, perspective: 1800 * u }}>
					<div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `rotateY(${-10 + drift * 6}deg) rotateX(${6 - drift * 3}deg)` }}>
						{cards.map((title, i) => {
							const s = spring({ frame: frame - COLUMNS_AT[i], fps, config: { damping: 16 } });
							const depth = cards.length - 1 - i; // 0 = the top card
							return (
								<div
									key={title}
									style={{
										position: 'absolute', inset: 0, background: c.plate, border: `${2 * u}px solid ${depth ? c.hairline : c.red}`, padding: 48 * u,
										boxShadow: depth ? `0 ${30 * u}px ${60 * u}px rgba(0,0,0,0.5)` : `0 0 ${50 * u}px rgba(255,79,79,0.35), 0 ${30 * u}px ${60 * u}px rgba(0,0,0,0.6)`,
										opacity: s,
										transform: `translate3d(${depth * 120 * u}px, ${depth * -70 * u}px, ${depth * -220 * u}px) rotateY(${(1 - s) * -55}deg)`,
										display: 'grid', alignContent: 'start', gap: 28 * u
									}}
								>
									<div style={{ fontFamily: font.mono, color: depth ? c.faint : c.red, fontSize: 24 * u, letterSpacing: '0.12em' }}>REPORT CARD · {title}</div>
									{depth === 0 && (
										<div style={{ display: 'grid', gridTemplateColumns: tall ? '1fr' : '1fr 1fr 1fr', gap: 44 * u }}>
											{sections.map((sec) => (
												<div key={sec.title} style={{ display: 'grid', gap: 14 * u, alignContent: 'start' }}>
													<div style={{ fontFamily: font.mono, color: c.red, fontSize: 24 * u, letterSpacing: '0.12em' }}>{sec.title}</div>
													<div style={{ height: 2 * u, background: c.ink, opacity: 0.6 }} />
													{sec.lines.map((l) => (
														<div key={l} style={{ fontFamily: font.mono, fontSize: 28 * u, color: c.ink }}>{l}</div>
													))}
													{sec.title === 'HOW IT FAILS' && (
														<div style={{ opacity: frame < RECORDED_AT ? 0 : 1, transform: `scale(${2 - rec})`, transformOrigin: 'left center', marginTop: 10 * u }}>
															<Stamp size={26 * u}>RECORDED</Stamp>
														</div>
													)}
												</div>
											))}
										</div>
									)}
								</div>
							);
						})}
					</div>
				</div>
				<Sample u={u} />
			</AbsoluteFill>
		</AbsoluteFill>
	);
};
