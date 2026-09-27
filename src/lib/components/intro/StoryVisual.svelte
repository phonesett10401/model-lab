<script lang="ts">
	/** active: the step being read; t: how built each step's scene is, 0 → 1. */
	let { active, t }: { active: number; t: number[] } = $props();

	// Fixed, hand-picked orbit and particle layouts: no randomness, so server and client render the same.
	const swarm = Array.from({ length: 24 }, (_, i) => ({ a: (i * 360) / 24, y: ((i * 37) % 11) - 5, s: 0.7 + ((i * 53) % 7) / 20 }));
	const bits = Array.from({ length: 16 }, (_, i) => ({ x: ((i * 29) % 17) - 8, d: (i % 8) * 0.06 }));
</script>

<div class="visual" aria-hidden="true">
	<!-- The stage: the video's glow, vignette and grain. The glow flares whenever a new step becomes active. -->
	<div class="glow"></div>
	{#key active}<div class="flare"></div>{/key}

	<!-- 1 · One job each: a swarm of specimens orbits; one is pulled forward and glows. -->
	<div class="scene swarm" class:on={active === 0} data-i="0" style="--t: {t[0]}">
		<div class="orbit">
			{#each swarm as b, i (i)}
				<span class="box" style="--a: {b.a}deg; --y: {b.y}; --s: {b.s}"></span>
			{/each}
		</div>
		<div class="hero"><span class="mono">No. 01</span><span class="bar"></span></div>
	</div>

	<!-- 2 · Made by hand: the photo travels Collect → Train → Test along a glowing line; a box locks on at Test. -->
	<div class="scene pipe" class:on={active === 1} data-i="1" style="--t: {t[1]}">
		<svg class="line track" viewBox="0 0 100 20" preserveAspectRatio="none"><path d="M0 10 C 20 2, 30 18, 50 10 S 80 2, 100 10" /></svg>
		<svg class="line lit" viewBox="0 0 100 20" preserveAspectRatio="none"><path d="M0 10 C 20 2, 30 18, 50 10 S 80 2, 100 10" /></svg>
		{#each ['COLLECT', 'TRAIN', 'TEST'] as s, i (s)}
			<span class="station mono" style="--at: {i / 2}">{s}</span>
		{/each}
		<div class="traveller">
			<img src="/samples/octopus.jpg" alt="" width="512" height="512" />
			<span class="lock"><span class="tag mono">octopus · sample</span></span>
		</div>
	</div>

	<!-- 3 · Honest report cards: the cards fan out in 3D, then the stamp slams with a glitch. -->
	<div class="scene cards" class:on={active === 2} class:slam={t[2] > 0.7} data-i="2" style="--t: {t[2]}">
		<div class="fan">
			{#each ['DATA', 'ACCURACY', 'HOW IT FAILS'] as h, i (h)}
				<div class="card" style="--k: {i - 1}">
					<span class="mono red">{h}</span><span class="ln"></span><span class="ln"></span><span class="ln short"></span>
				</div>
			{/each}
		</div>
		<span class="stamp mono">HOW IT FAILS</span>
	</div>

	<!-- 4 · Runs on your device: the model streams into the phone as particles; the photo never leaves. -->
	<div class="scene device" class:on={active === 3} data-i="3" style="--t: {t[3]}">
		<div class="phone">
			<img src="/samples/octopus.jpg" alt="" width="512" height="512" />
			<svg class="shield" viewBox="0 0 24 28"><path d="M12 1 L22 5 V13 C22 20 17 25 12 27 C7 25 2 20 2 13 V5 Z" /></svg>
		</div>
		{#each bits as b, i (i)}
			<span class="bit" style="--x: {b.x}; --d: {b.d}"></span>
		{/each}
		<span class="chip mono">MODEL</span>
	</div>

	<div class="vignette"></div>
	<div class="grain"></div>
</div>

<style>
	.visual { position: relative; width: 100%; height: 100%; overflow: hidden; }
	.scene { position: absolute; inset: 0; display: grid; place-items: center; opacity: 0; transition: opacity 0.5s; }
	.scene.on { opacity: 1; }
	.mono { font-family: var(--font-mono); font-size: var(--step--1); }
	.red { color: var(--red); }

	/* Stage */
	.glow { position: absolute; inset: 0; background: radial-gradient(closest-side at 50% 55%, color-mix(in srgb, var(--red) 22%, transparent), transparent); }
	.flare { position: absolute; inset: 0; background: radial-gradient(closest-side at 50% 55%, color-mix(in srgb, var(--red) 45%, transparent), transparent); opacity: 0; animation: flare 1s ease-out; }
	@keyframes flare { 20% { opacity: 1; } }
	.vignette { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(closest-side, transparent 60%, var(--paper)); }
	.grain { position: absolute; inset: -50%; pointer-events: none; opacity: 0.09; mix-blend-mode: overlay; animation: grain 0.8s steps(4) infinite;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
	@keyframes grain { 25% { translate: -5% 3%; } 50% { translate: 4% -4%; } 75% { translate: -3% -5%; } }

	/* 1 · Swarm */
	.swarm { perspective: 900px; --r: min(34vw, 26vh, 240px); }
	.orbit { position: absolute; top: 50%; left: 50%; transform-style: preserve-3d; transform: rotateX(-12deg) rotateY(calc(var(--t) * 140deg)); }
	.box { position: absolute; width: calc(var(--r) * 0.2); aspect-ratio: 4 / 5; margin: calc(var(--r) * -0.125) 0 0 calc(var(--r) * -0.1); background: var(--plate); border: 1px solid var(--hairline); border-top: 3px solid color-mix(in srgb, var(--red) 60%, transparent);
		transform: rotateY(var(--a)) translateZ(var(--r)) translateY(calc(var(--y) * var(--r) * 0.09)) scale(var(--s)); opacity: calc(0.85 - var(--t) * 0.4); }
	.hero { position: relative; width: calc(var(--r) * 0.55); aspect-ratio: 4 / 5; display: grid; align-content: space-between; padding: 10px; background: var(--plate); border: 1px solid var(--red);
		transform: translateZ(0) scale(calc(0.5 + var(--t) * 0.6)); opacity: min(1, calc(var(--t) * 3)); box-shadow: 0 0 calc(var(--t) * 60px) color-mix(in srgb, var(--red) 55%, transparent); }
	.hero .bar { height: 6px; background: var(--red); }

	/* 2 · Pipeline */
	.pipe { --w: 64%; --x: 18%; }
	.line { position: absolute; left: var(--x); width: var(--w); top: 50%; height: 60px; translate: 0 -50%; overflow: visible; }
	.line path { fill: none; stroke-width: 2; vector-effect: non-scaling-stroke; }
	.track path { stroke: var(--hairline); }
	/* Revealed with a clip, not a dash offset: dashes on a stretched, non-scaling stroke break up in Chrome. */
	.lit { clip-path: inset(-50% calc((1 - var(--t)) * 100%) -50% 0); filter: drop-shadow(0 0 4px var(--red)); }
	.lit path { stroke: var(--red); }
	.station { position: absolute; top: calc(50% + 44px); left: calc(var(--x) + var(--at) * var(--w)); translate: -50% 0; color: var(--ink-soft);
		opacity: clamp(0.3, calc((var(--t) - var(--at) + 0.08) * 12), 1); }
	.traveller { position: absolute; top: calc(50% - 24px); left: calc(var(--x) + var(--t) * var(--w)); translate: -50% -100%; width: min(22%, 110px); aspect-ratio: 1; }
	.traveller img { width: 100%; height: 100%; object-fit: cover; border: 1px solid var(--hairline); box-shadow: 0 0 24px color-mix(in srgb, var(--red) 35%, transparent); }
	.lock { --k: clamp(0, calc((var(--t) - 0.65) * 5), 1); position: absolute; inset: -10%; border: 2px solid var(--red); opacity: var(--k); scale: calc(1.5 - var(--k) * 0.5); box-shadow: 0 0 18px var(--red); }
	.tag { position: absolute; bottom: 100%; right: -2px; background: var(--red); color: #1a0d0d; padding: 1px 6px; font-size: 11px; white-space: nowrap; }

	/* 3 · Report cards */
	.cards { perspective: 1000px; }
	.fan { position: relative; width: min(36%, 200px); aspect-ratio: 3 / 4; transform-style: preserve-3d; transform: rotateX(calc(18deg - var(--t) * 10deg)); }
	.card { position: absolute; inset: 0; display: grid; align-content: start; gap: 10px; padding: 14px; background: var(--plate); border: 1px solid var(--hairline); transform-origin: 50% 110%;
		transform: translateX(calc(var(--k) * var(--t) * 50%)) rotateZ(calc(var(--k) * var(--t) * 12deg)) rotateY(calc(var(--k) * var(--t) * -18deg)) translateZ(calc(var(--k) * var(--k) * var(--t) * -40px)); box-shadow: 0 20px 40px rgb(0 0 0 / 0.5); }
	.ln { height: 4px; background: var(--ink); opacity: 0.35; }
	.ln.short { width: 60%; }
	.stamp { --k: clamp(0, calc((var(--t) - 0.6) * 6), 1); position: absolute; bottom: 16%; left: 50%; translate: -50% 0; border: 2px solid var(--red); color: var(--red); background: var(--paper); padding: 3px 12px; letter-spacing: 0.14em; white-space: nowrap;
		opacity: var(--k); transform: rotate(-6deg) scale(calc(2.4 - var(--k) * 1.4)); }
	.slam .stamp { animation: glitch 0.45s steps(2) 1; }
	.slam .fan { animation: shake 0.3s 1; }
	@keyframes glitch { 0% { text-shadow: -3px 0 #00e5ff, 3px 0 var(--red); filter: brightness(2); } 50% { text-shadow: 3px 0 #00e5ff, -3px 0 var(--red); translate: calc(-50% + 3px) 0; } }
	@keyframes shake { 25% { translate: 3px 1px; } 75% { translate: -3px -1px; } }

	/* 4 · Device */
	.phone { position: relative; height: 78%; aspect-ratio: 9 / 18; border: 3px solid var(--ink); border-radius: 22px; overflow: hidden; box-shadow: 0 0 calc(var(--t) * 40px) color-mix(in srgb, var(--red) 40%, transparent); }
	.phone img { width: 100%; height: 100%; object-fit: cover; }
	.shield { position: absolute; top: 8%; left: 50%; translate: -50% 0; width: 22%; fill: color-mix(in srgb, var(--red) 25%, transparent); stroke: var(--red); stroke-width: 1.5; animation: pulse 1.6s ease-in-out infinite; }
	@keyframes pulse { 50% { filter: drop-shadow(0 0 8px var(--red)); scale: 1.08; } }
	.bit { --k: clamp(0, calc(var(--t) * 1.5 - var(--d)), 1); position: absolute; top: 50%; left: calc(50% + var(--x) * 1.6%); width: 6px; height: 6px; background: var(--red); box-shadow: 0 0 8px var(--red);
		translate: 0 calc((1 - var(--k)) * -45vh); opacity: calc(var(--k) * (1 - var(--k)) * 4); }
	.chip { --k: clamp(0, calc(var(--t) * 1.4), 1); position: absolute; top: 50%; left: 50%; translate: -50% calc((1 - var(--k)) * -40vh - 50%); border: 1px solid var(--red); color: var(--red); background: var(--paper); padding: 3px 10px; box-shadow: 0 0 16px color-mix(in srgb, var(--red) 50%, transparent); }

	@media (prefers-reduced-motion: reduce) {
		.flare, .grain, .shield, .slam .stamp, .slam .fan { animation: none; }
	}
</style>
