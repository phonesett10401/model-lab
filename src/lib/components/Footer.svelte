<footer class="footer">
	<p class="mono">AI MODEL LAB</p>
	<p class="soft">
		Models run in your browser: nothing you add leaves your device. Numbers appear only once they’ve been measured,
		and every report card shows how the model fails.
	</p>
	<p class="mono faint">© {new Date().getFullYear()}</p>
</footer>

<style>
	.footer {
		max-width: var(--max); margin: var(--space-6) auto 0; padding: var(--space-4) var(--gutter);
		border-top: 1px solid var(--ink); display: grid; gap: var(--space-2);
	}
	.footer p:nth-child(2) { max-width: 60ch; }
</style>
