<script lang="ts">
	let { active }: { active: number } = $props();
</script>

<div class="visual" aria-hidden="true">
	<!-- 1 · One job each: plates slide onto a shelf that runs off the edge -->
	<div class="scene shelf" class:on={active === 0}>
		{#each ['No. 01', 'No. 02', 'No. 03', 'No. 04', 'No. 05', 'No. 06'] as n, i (n)}
			<div class="plate" style="--i: {i}"><span class="mono">{n}</span><span class="bar"></span></div>
		{/each}
	</div>

	<!-- 2 · Made by hand: one photo travels Collect → Train → Test -->
	<div class="scene pipe" class:on={active === 1}>
		<div class="stations mono"><span>COLLECT</span><span>TRAIN</span><span>TEST</span></div>
		<img class="thumb" src="/samples/octopus.jpg" alt="" width="512" height="512" />
		<svg class="curve" viewBox="0 0 100 40" preserveAspectRatio="none"><polyline points="0,38 20,30 40,22 60,14 80,9 100,6" /></svg>
	</div>

	<!-- 3 · Honest report cards: columns build, then the stamp -->
	<div class="scene card" class:on={active === 2}>
		{#each ['DATA', 'ACCURACY', 'HOW IT FAILS'] as h, i (h)}
			<div class="col" style="--i: {i}"><span class="mono red">{h}</span><span class="line"></span><span class="line short"></span></div>
		{/each}
		<span class="stamp mono">HOW IT FAILS</span>
	</div>

	<!-- 4 · Runs on your device: the model moves into the phone; the photo stays -->
	<div class="scene device" class:on={active === 3}>
		<div class="phone"><img src="/samples/octopus.jpg" alt="" width="512" height="512" /><span class="lock">🔒</span></div>
		<div class="model mono">MODEL</div>
	</div>
</div>

<style>
	.visual { position: relative; width: 100%; height: 100%; }
	.scene { position: absolute; inset: 0; display: grid; place-items: center; opacity: 0; transition: opacity 0.4s; }
	.scene.on { opacity: 1; }
	.mono { font-family: var(--font-mono); font-size: var(--step--1); }
	.red { color: var(--red); }

	.shelf { grid-auto-flow: column; justify-content: start; gap: 12px; overflow: hidden; padding-left: 8%; border-bottom: 2px solid var(--hairline); align-content: center; }
	.shelf .plate { width: 120px; height: 150px; background: var(--plate); border: 1px solid var(--hairline); display: grid; align-content: space-between; padding: 10px; transform: translateX(60vw); transition: transform 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) calc(var(--i) * 0.12s); }
	.shelf.on .plate { transform: none; }
	.shelf .bar { height: 6px; background: var(--red); opacity: 0.6; }

	.pipe { grid-template-rows: auto 1fr; padding: 10%; }
	.stations { display: flex; justify-content: space-between; width: 100%; color: var(--ink-soft); }
	.thumb { width: 22%; aspect-ratio: 1; object-fit: cover; justify-self: start; transform: translateX(0); transition: transform 1.6s ease-in-out; border: 1px solid var(--hairline); }
	.pipe.on .thumb { transform: translateX(340%); }
	.curve { position: absolute; left: 10%; right: 10%; bottom: 12%; height: 30%; width: 80%; }
	.curve polyline { fill: none; stroke: var(--red); stroke-width: 1.5; vector-effect: non-scaling-stroke; stroke-dasharray: 200; stroke-dashoffset: 200; transition: stroke-dashoffset 1.6s ease-out 0.4s; }
	.pipe.on .curve polyline { stroke-dashoffset: 0; }

	.card { grid-template-columns: repeat(3, 1fr); gap: 16px; padding: 12%; align-content: center; }
	.col { display: grid; gap: 10px; background: var(--plate); border: 1px solid var(--hairline); padding: 14px; opacity: 0; transform: translateY(16px); transition: opacity 0.4s calc(var(--i) * 0.25s), transform 0.4s calc(var(--i) * 0.25s); }
	.card.on .col { opacity: 1; transform: none; }
	.line { height: 4px; background: var(--ink); opacity: 0.4; }
	.line.short { width: 60%; }
	.stamp { position: absolute; bottom: 18%; right: 16%; border: 2px solid var(--red); color: var(--red); padding: 2px 10px; letter-spacing: 0.12em; transform: rotate(-6deg) scale(1.8); opacity: 0; transition: transform 0.35s cubic-bezier(0.2, 1.6, 0.4, 1) 0.9s, opacity 0.2s 0.9s; }
	.card.on .stamp { transform: rotate(-6deg) scale(1); opacity: 1; }

	.phone { position: relative; width: 36%; aspect-ratio: 9 / 18; border: 3px solid var(--ink); border-radius: 22px; overflow: hidden; }
	.phone img { width: 100%; height: 100%; object-fit: cover; }
	.lock { position: absolute; top: 8px; right: 10px; opacity: 0; transition: opacity 0.3s 1.2s; }
	.device.on .lock { opacity: 1; }
	.model { position: absolute; top: 8%; border: 1px solid var(--red); color: var(--red); padding: 4px 10px; transform: translateY(-40px); transition: transform 1s ease-in-out 0.2s; }
	.device.on .model { transform: translateY(18vh); }
</style>
