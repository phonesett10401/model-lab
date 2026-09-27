import type React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { c, font } from './theme';
import { stacked, type Layout } from './layout';

export const Stamp: React.FC<{ size: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ size, children, style }) => (
	<span style={{ display: 'inline-block', border: `${size * 0.12}px solid ${c.red}`, color: c.red, fontFamily: font.mono, fontSize: size, letterSpacing: '0.12em', padding: `${size * 0.1}px ${size * 0.45}px`, transform: 'rotate(-4deg)', ...style }}>
		{children}
	</span>
);

export const Sample: React.FC<{ u: number }> = ({ u }) => (
	<div style={{ position: 'absolute', top: 36 * u, right: 36 * u }}>
		<Stamp size={22 * u}>SAMPLE</Stamp>
	</div>
);

export const Plate: React.FC<{ u: number; meta: string; name: string; muted?: boolean }> = ({ u, meta, name, muted }) => (
	<div style={{ width: 420 * u, flex: 'none', background: c.plate, border: `${2 * u}px solid ${c.hairline}`, padding: `${22 * u}px ${26 * u}px` }}>
		<div style={{ fontFamily: font.mono, fontSize: 20 * u, color: c.faint, letterSpacing: '0.1em' }}>{meta}</div>
		<div style={{ fontFamily: font.serif, fontSize: 40 * u, color: muted ? c.faint : c.ink, marginTop: 6 * u }}>{name}</div>
	</div>
);

/** Prediction bars that spring in. The number shown never exceeds the true score, even while the bar overshoots. */
export const Bars: React.FC<{ u: number; rows: { label: string; score: number }[]; startAt: number }> = ({ u, rows, startAt }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	return (
		<div style={{ display: 'grid', gap: 24 * u }}>
			{rows.map((r, i) => {
				const s = spring({ frame: frame - startAt - i * 3, fps, config: { damping: 12, stiffness: 120 } });
				return (
					<div key={r.label} style={{ display: 'grid', gridTemplateColumns: `${230 * u}px 1fr ${110 * u}px`, alignItems: 'center', gap: 20 * u, fontFamily: font.mono, fontSize: 32 * u, color: i ? c.soft : c.ink }}>
						<span>{r.label}</span>
						<span style={{ height: 12 * u, background: 'rgba(243,238,238,0.1)', borderRadius: 6 * u, overflow: 'hidden' }}>
							<span style={{ display: 'block', height: '100%', width: `${s * r.score * 100}%`, background: c.red, opacity: i ? 0.5 : 1 }} />
						</span>
						<span style={{ textAlign: 'right' }}>{Math.round(Math.min(s, 1) * r.score * 100)}%</span>
					</div>
				);
			})}
		</div>
	);
};

/**
 * Photo + side content, side by side (wide/square) or stacked (tall).
 * `zone`: an empty, glowing drop zone that the photo falls into at `dropAt`. `grid`: a tech-grid overlay for scanning.
 */
export const Bench: React.FC<{ layout: Layout; u: number; photo: string; dropAt?: number; zone?: boolean; scan?: boolean; grid?: boolean; overlay?: React.ReactNode; children: React.ReactNode }> = ({ layout, u, photo, dropAt = -60, zone, scan, grid, overlay, children }) => {
	const frame = useCurrentFrame();
	const { fps, height } = useVideoConfig();
	const drop = spring({ frame: frame - dropAt, fps, config: { damping: 14, mass: 0.9 } });
	const scanPos = interpolate(frame % 40, [0, 20, 40], [0, 1, 0]);
	const tall = stacked(layout);
	const landed = frame >= dropAt;
	return (
		<AbsoluteFill style={{ flexDirection: tall ? 'column' : 'row', gap: 56 * u, padding: 80 * u, alignItems: tall ? 'stretch' : 'center' }}>
			<div style={{ position: 'relative', flex: tall ? '0 0 52%' : '0 0 55%', height: tall ? undefined : '100%' }}>
				{zone && (
					<div style={{ position: 'absolute', inset: 0, border: `${3 * u}px dashed ${c.red}`, boxShadow: `inset 0 0 ${50 * u}px rgba(255,79,79,0.25), 0 0 ${40 * u}px rgba(255,79,79,0.3)`, display: 'grid', placeItems: 'center', fontFamily: font.mono, fontSize: 26 * u, color: c.red, letterSpacing: '0.14em', opacity: landed ? 1 - drop : 1 }}>
						DROP A PHOTO
					</div>
				)}
				<div style={{ position: 'absolute', inset: 0, overflow: 'hidden', border: `${2 * u}px solid ${c.hairline}`, opacity: landed ? 1 : 0, transform: `translateY(${(1 - drop) * -height * 0.8}px) rotate(${(1 - drop) * 9}deg)` }}>
					<Img src={staticFile(`photos/${photo}`)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
					{grid && <AbsoluteFill style={{ backgroundImage: `linear-gradient(rgba(255,79,79,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(255,79,79,0.14) 1px, transparent 1px)`, backgroundSize: `${60 * u}px ${60 * u}px` }} />}
					{overlay && <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>{overlay}</AbsoluteFill>}
					{scan && <div style={{ position: 'absolute', left: 0, right: 0, top: `${scanPos * 100}%`, height: 4 * u, background: c.red, boxShadow: `0 0 ${30 * u}px ${8 * u}px rgba(255,79,79,0.6)` }} />}
				</div>
			</div>
			<div style={{ flex: 1, display: 'grid', alignContent: tall ? 'start' : 'center', gap: 28 * u, paddingTop: tall ? 24 * u : 0 }}>{children}</div>
		</AbsoluteFill>
	);
};

/** The brand mark that stays in the corner through the middle of the video. */
export const Bug: React.FC<{ u: number }> = ({ u }) => (
	<div style={{ position: 'absolute', top: 36 * u, left: 40 * u, fontFamily: font.mono, color: c.red, fontSize: 22 * u, letterSpacing: '0.24em' }}>AI MODEL LAB</div>
);

/** A lab-level line above the example ("Every model gets tested."). */
export const Caption: React.FC<{ u: number; children: React.ReactNode }> = ({ u, children }) => (
	<div style={{ fontFamily: font.mono, fontSize: 26 * u, color: c.soft, letterSpacing: '0.08em' }}>{children}</div>
);

/** The AI MODEL LAB lockup used at the start and the end: a glowing wordmark with a light sweep across it. */
export const Lockup: React.FC<{ u: number; progress: number; sweep: number }> = ({ u, progress, sweep }) => (
	<div style={{ display: 'grid', gap: 20 * u, justifyItems: 'start' }}>
		<div style={{ height: 6 * u, width: progress * 180 * u, background: c.red, boxShadow: `0 0 ${18 * u}px ${c.red}` }} />
		<div
			style={{
				fontFamily: font.mono, fontWeight: 600, fontSize: 110 * u, letterSpacing: '0.16em', lineHeight: 1, opacity: progress,
				color: 'transparent', WebkitBackgroundClip: 'text', backgroundClip: 'text',
				backgroundImage: `linear-gradient(100deg, ${c.red} 0%, ${c.red} ${sweep * 100 - 12}%, #ffd9d9 ${sweep * 100}%, ${c.red} ${sweep * 100 + 12}%, ${c.red} 100%)`,
				filter: `drop-shadow(0 0 ${22 * u}px rgba(255,79,79,0.55))`
			}}
		>
			AI MODEL LAB
		</div>
	</div>
);
