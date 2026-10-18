<script lang="ts">
	import { onMount } from 'svelte';
	import { reducedMotion } from '$lib/motion.svelte';

	// The caster stage: drawn once behind every slide and never restarted, so motion feels continuous like a livestream set.
	let canvas: HTMLCanvasElement;
	let svg: SVGSVGElement;

	const G = 16; // dot grid spacing, px
	const WAVES = 7;
	type Group = { x: number; y: number; vx: number; vy: number; r: number; life: number; max: number };

	onMount(() => {
		const ctx = canvas.getContext('2d')!;
		const paths = [...svg.querySelectorAll('path')];
		let W = 0, H = 0, raf = 0, last = performance.now();
		const rnd = (a: number, b: number) => a + Math.random() * (b - a);
		const spawn = (): Group => {
			const a = rnd(0, Math.PI * 2), s = rnd(20, 45);
			return { x: rnd(0, W), y: rnd(0, H), vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: rnd(40, 90), life: 0, max: rnd(3, 6) };
		};
		const size = () => {
			const r = canvas.getBoundingClientRect(), d = devicePixelRatio || 1;
			canvas.width = r.width * d; canvas.height = r.height * d;
			ctx.setTransform(d, 0, 0, d, 0, 0);
			W = r.width; H = r.height;
		};
		size();
		const groups = Array.from({ length: 5 }, () => { const g = spawn(); g.life = rnd(0, g.max); return g; });

		function draw(t: number) {
			const dt = Math.min((t - last) / 1000, 0.05);
			last = t;
			ctx.clearRect(0, 0, W, H);
			for (const g of groups) {
				g.x += g.vx * dt; g.y += g.vy * dt; g.life += dt;
				if (g.life > g.max) Object.assign(g, spawn());
			}
			for (let y = G / 2; y < H; y += G)
				for (let x = G / 2; x < W; x += G) {
					let k = 0;
					for (const g of groups) {
						const d = Math.hypot(x - g.x, y - g.y);
						if (d < g.r) k = Math.max(k, (1 - d / g.r) * Math.sin((Math.PI * g.life) / g.max));
					}
					if (k > 0 && (x * 7 + y * 13 + Math.floor(t / 90)) % 5 === 0) k *= 0.3; // flicker
					ctx.fillStyle = k > 0.05 ? `rgba(255,79,79,${0.25 + k * 0.75})` : 'rgba(243,238,238,0.16)';
					const s = 1 + k * 1.6;
					ctx.fillRect(x - s / 2, y - s / 2, s, s);
				}
			const sec = t / 1000;
			paths.forEach((p, i) => {
				let d = '';
				for (let x = 0; x <= 1000; x += 20) {
					const y = 230 + i * 18 + Math.sin(x / 140 + sec * 0.35 + i * 0.6) * 28 + Math.sin(x / 60 - sec * 0.2 + i) * 8;
					d += (x ? 'L' : 'M') + x + ' ' + y.toFixed(1);
				}
				p.setAttribute('d', d);
			});
		}

		const loop = (t: number) => { draw(t); raf = requestAnimationFrame(loop); };
		const restart = () => {
			cancelAnimationFrame(raf);
			if (reducedMotion.current) draw(performance.now()); // one still frame
			else raf = requestAnimationFrame(loop);
		};
		const onresize = () => { size(); if (reducedMotion.current) draw(performance.now()); };
		addEventListener('resize', onresize);
		const mq = matchMedia('(prefers-reduced-motion: reduce)');
		mq.addEventListener('change', restart);
		restart();
		return () => { cancelAnimationFrame(raf); removeEventListener('resize', onresize); mq.removeEventListener('change', restart); };
	});
</script>

<div class="stage" aria-hidden="true">
	<svg class="waves" bind:this={svg} viewBox="0 0 1000 400" preserveAspectRatio="none">
		{#each Array(WAVES) as _, i (i)}<path style="opacity: {0.08 + i * 0.05}" />{/each}
	</svg>
	<canvas bind:this={canvas}></canvas>
	<div class="scan"></div>
	<div class="grain"></div>
	<div class="vignette"></div>
	<i class="corner c1"></i><i class="corner c2"></i><i class="corner c3"></i><i class="corner c4"></i>
</div>

<style>
	.stage { position: absolute; inset: 0; overflow: hidden; background: var(--paper); pointer-events: none; }
	canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
	.waves { position: absolute; left: 0; bottom: 0; width: 100%; height: 65%; }
	.waves path { fill: none; stroke: var(--red); stroke-width: 1; }
	.scan { position: absolute; left: 0; right: 0; height: 22%; background: linear-gradient(to bottom, transparent, rgba(255, 79, 79, 0.12), transparent); animation: scan 6s linear infinite; }
	@keyframes scan { from { top: -25%; } to { top: 105%; } }
	.grain {
		position: absolute; inset: -50%; opacity: 0.08;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='.9'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E");
		animation: grain 0.6s steps(4) infinite;
	}
	@keyframes grain { 50% { transform: translate(-3%, 2%); } 100% { transform: translate(2%, -3%); } }
	.vignette { position: absolute; inset: 0; background: radial-gradient(ellipse at center, transparent 50%, rgba(0, 0, 0, 0.65)); }
	.corner { position: absolute; width: 4.5vmin; aspect-ratio: 1; border: 2px solid var(--red); z-index: 3; }
	.c1 { left: 3%; top: 5%; border-right: 0; border-bottom: 0; }
	.c2 { right: 3%; top: 5%; border-left: 0; border-bottom: 0; }
	.c3 { left: 3%; bottom: 6%; border-right: 0; border-top: 0; }
	.c4 { right: 3%; bottom: 6%; border-left: 0; border-top: 0; }
	@media (prefers-reduced-motion: reduce) { .scan { display: none; } .grain { animation: none; } }
</style>
