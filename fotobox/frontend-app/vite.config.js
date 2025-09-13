import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { optimizeCss } from 'carbon-preprocess-svelte';

export default defineConfig({
	plugins: [
		sveltekit(),

		// Optimize CSS from `carbon-components-svelte` when building for production.
		optimizeCss()
	]
});
