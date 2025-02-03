<script>
	import "carbon-components-svelte/css/g10.css";
	// import 'carbon-components-svelte/css/all.css';
	// let theme = "g10"; // "white" | "g10" | "g80" | "g90" | "g100"
    import { page } from '$app/stores'; // Import the page store to access the current route
    import { writable, derived } from 'svelte/store';
	import { onMount, onDestroy } from 'svelte';
	import DevInfoCard from './DevInfoCard.svelte'
	// $: document.documentElement.setAttribute("theme", theme);
	import {
	  Header,
	  HeaderNav,
	  HeaderNavItem,
	  SideNav,
	  SideNavItems,
	  SideNavMenuItem,
	  SideNavLink,
	  SideNavDivider,
	  SkipToContent,
	  Content,
	  ProgressBar,
	  HeaderUtilities,
	  HeaderAction,
	  HeaderPanelLinks,
	  HeaderPanelLink
	} from "carbon-components-svelte";
    import { toggelGridTimer, toggleDownload, downloadURL } from "../stores.js";
	
	let downloadingAll = false
	
	let isSideNavOpen = false;
	let isOpen = false;
	// let tgt = false
	//   // Subscribing to images to calculate total pages
	// toggelGridTimer.subscribe((t) => {
    // 	tgt = t;
  	// });

	// $: t = toggelGridTimer.subscribe()

	let slideshowToggleTimer = false
	function updateTGT() {
		toggelGridTimer.update(value => !value)
	}

	let showDeveloperCard = true
	function updateshowDeveloperCard() {
		showDeveloperCard = !showDeveloperCard
	}
	
	let imageToggleDownload = false 
	function updateITD() {
		toggleDownload.update(value => !value)
	}

	async function downloadAll() {

		try {
			downloadingAll = true 
			const response = await fetch(downloadURL + '/images/all', {
				method: 'GET',
			});
			if (!response.ok) {
				throw new Error(`Error: ${response.statusText}`);
			}

			const blob = await response.blob();
			const blobUrl = window.URL.createObjectURL(blob);

			const link = document.createElement('a');
			link.href = blobUrl;
			link.download = 'images.zip'; // Ensure this matches the filename set in the Go server.
			link.target = '_blank';
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link); // Clean up

			window.URL.revokeObjectURL(blobUrl);
			downloadingAll = false
		} catch (error) {
			console.error('Failed to download the file:', error);
			downloadingAll = false
		}
	}

	onMount(() => {
		if (derived(page, ($page) => $page.url.pathname === '/slideshow')) {
			toggelGridTimer.subscribe((v)=> {
				slideshowToggleTimer = v
			})
			toggleDownload.subscribe((v)=> {
				imageToggleDownload = v
			})
		}
	});
		
</script>
  
<Header persistentHamburgerMenu={true}  company="IBM" platformName="Technology Sales Christmas Dinner" href="/" bind:isSideNavOpen>
	<svelte:fragment slot="skip-to-content">
		<SkipToContent />
	</svelte:fragment>
	<HeaderNav>
		<HeaderNavItem text="Camera" href="/camera" />
		<HeaderNavItem text="Photo Grid" href="/slideshow" />
		<HeaderNavItem text="Architecture" href="/architecture" />

	</HeaderNav>
	{#if $page.url.pathname === '/slideshow'}
	<HeaderUtilities>
		<HeaderAction bind:isOpen transition={{ duration: 200 }}>
			<HeaderPanelLinks>
				<HeaderPanelLink on:click={updateTGT}>Grid Cycle {slideshowToggleTimer ? "on": "off"}</HeaderPanelLink>
				<HeaderPanelLink on:click={updateITD}>Show Download {imageToggleDownload ? "on": "off"}</HeaderPanelLink>
				<HeaderPanelLink on:click={downloadAll}>Download All</HeaderPanelLink>
				{#if downloadingAll}
				<ProgressBar size="sm"/>
				{/if}
			</HeaderPanelLinks>
		</HeaderAction>
	</HeaderUtilities>
	{/if}
</Header>
  
<SideNav bind:isOpen={isSideNavOpen}>
<SideNavItems>
	<SideNavLink text="Camera" href="/camera"/>
	<SideNavLink text="Photo Grid" href="/slideshow"/>
	<SideNavLink text="Architecture" href="/architecture"/>

	{#if $page.url.pathname === '/slideshow'}
		<SideNavDivider />
		<SideNavMenuItem href="" text="Grid Cycle {slideshowToggleTimer ? "on": "off"}" on:click={updateTGT}/>
		<SideNavMenuItem href="" text="Show Download {imageToggleDownload ? "on": "off"}" on:click={updateITD}/>
		<SideNavMenuItem href="" text="Download All" on:click={downloadAll} disabled="true"/>
		{#if downloadingAll}
			<ProgressBar size="sm"/>
		{/if}
		<!-- <Toggle labelText="Grid Cycle" bind:toggled={slideshowToggleTimer} on:change={updateTGT}/>  -->
	{/if}
	<SideNavDivider />
	<SideNavMenuItem href="" text="Show Developer {showDeveloperCard ? "on": "off"}" on:click={updateshowDeveloperCard}/>

</SideNavItems>
</SideNav>
  
<Content>
	<slot/>
	{#if showDeveloperCard}
		<DevInfoCard/>
	{/if}

</Content>
