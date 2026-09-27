import type React from 'react';
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { c, font } from '../theme';
import { Sample, Stamp } from '../parts';
import { COLUMNS_AT, RECORDED_AT } from '../timeline';
import { stacked, unit, type Layout } from '../layout';

const columns: { title: string; lines: string[] }[] = [
	{ title: 'DATA', lines: ['Source · iNaturalist', 'Split · 70 / 15 / 15'] },
	{ title: 'ACCURACY', lines: ['octopus · —', 'squid · —', 'cuttlefish · —'] },
	{ title: 'HOW IT FAILS', lines: ['cuttlefish → squid'] }
];

export const Report: React.FC<{ layout: Layout }> = ({ layout }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const u = unit(layout);
	const rec = spring({ frame: frame - RECORDED_AT, fps, config: { damping: 9, stiffness: 180 } });
	return (
		<AbsoluteFill style={{ padding: 90 * u }}>
			<div style={{ flex: 1, background: c.plate, border: `${2 * u}px solid ${c.hairline}`, padding: 56 * u, display: 'grid', gridTemplateColumns: stacked(layout) ? '1fr' : '1fr 1fr 1fr', gap: 48 * u, alignContent: 'center' }}>
				{columns.map((col, i) => {
					const s = spring({ frame: frame - COLUMNS_AT[i], fps, config: { damping: 200 } });
					return (
						<div key={col.title} style={{ opacity: s, transform: `translateY(${(1 - s) * 30 * u}px)`, display: 'grid', gap: 16 * u, alignContent: 'start' }}>
							<div style={{ fontFamily: font.mono, color: c.red, fontSize: 26 * u, letterSpacing: '0.12em' }}>{col.title}</div>
							<div style={{ height: 2 * u, background: c.ink, opacity: 0.6 }} />
							{col.lines.map((l) => (
								<div key={l} style={{ fontFamily: font.mono, fontSize: 30 * u, color: c.ink }}>{l}</div>
							))}
							{i === 2 && (
								<div style={{ opacity: frame < RECORDED_AT ? 0 : 1, transform: `scale(${2 - rec})`, transformOrigin: 'left center', marginTop: 12 * u }}>
									<Stamp size={28 * u}>RECORDED</Stamp>
								</div>
							)}
						</div>
					);
				})}
			</div>
			<Sample u={u} />
		</AbsoluteFill>
	);
};
