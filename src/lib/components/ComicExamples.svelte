<script lang="ts">
	import pipeline from '$lib/data/comic-translator-pipeline.json';

	type Example = { id: string; title: string; en: string; my: string; credit: string; creditUrl: string; license: string; licenseUrl: string };
	const examples = pipeline.examples as Example[];
</script>

<div class="comic-examples">
	<p>Finished pages from the measured run: the text was found, read and lettered in Burmese automatically, with no corrections.</p>
	{#each examples as e (e.id)}
		<figure>
			<div class="pair">
				<img src={e.en} alt="{e.title}, English" loading="lazy" />
				<img src={e.my} alt="{e.title}, translated into Burmese" loading="lazy" />
			</div>
			<figcaption class="mono soft">
				{e.title}. <a href={e.creditUrl} target="_blank" rel="noopener">{e.credit}</a>,
				<a href={e.licenseUrl} target="_blank" rel="noopener license">{e.license}</a>
			</figcaption>
		</figure>
	{:else}
		<p class="mono faint">Finished examples: not yet measured.</p>
	{/each}
	<a class="btn" href="/comic-translator">Open the translator →</a>
</div>

<style>
	.comic-examples { display: grid; gap: var(--space-3); }
	figure { margin: 0; display: grid; gap: var(--space-1); }
	.pair { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-1); }
	.pair img { width: 100%; height: auto; border: 1px solid var(--hairline); }
	.btn { justify-self: start; }
</style>
