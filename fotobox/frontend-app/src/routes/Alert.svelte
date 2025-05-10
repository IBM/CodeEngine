<script>
	import {
	  Grid,
	  Row,
	  Column,
	  Button,
	  ProgressBar,
	  InlineNotification,
	} from "carbon-components-svelte";
    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher();
    import { fade } from "svelte/transition";


    export let data = {}
    let timeout = undefined;
    $: if (data.display == true) {
        timeout = 3000
    }
    $: showNotification = timeout !== undefined;
</script>

<Row>
    <Column>

        {#if showNotification}
            <div transition:fade>
                {#if data.success}
                    <InlineNotification
                    {timeout}
                    kind="success"
                    title="Successfully uploaded Image:"
                    subtitle={data.image_name}
                    on:close={(e) => {
                        timeout = undefined;
                        dispatch("resetAlert");
                    }}
                    />
                {:else}
                    <InlineNotification
                    {timeout}
                    kind="error"
                    title="Failed to uploaded Image:"
                    subtitle={data.image_name}
                    on:close={(e) => {
                        timeout = undefined;
                        dispatch("resetAlert");
                    }}
                    />
                {/if}


            </div>
      {/if}
      
    </Column>
</Row>

  
  <!-- <Button
    disabled={showNotification}
    on:click={() => {
      timeout = 3_000; // 3 seconds
    }}
  >
    Show notification
  </Button>
   -->
