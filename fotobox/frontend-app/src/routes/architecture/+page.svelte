<script>
    import mermaid from 'mermaid';
    import {
	  Grid,
	  Row,
	  Column,
    ContentSwitcher, 
    Switch,
    Tile
	} from "carbon-components-svelte";
  import { onMount } from 'svelte';

  const componentsInfo = [
    {
      "name": "Fotobox Frontend App",
      "type": "Code Engine App",
      "lang": "Svelte",
      "description": "Svelte based Single Page Application using Carbon Components Svelte for the UI. Camera mode to take Pictures including various timer options. \
      Password protected grid view to display all the pictures taken. Architecture Page with diagram explaining the System, generated using mermaid."
    },
    {
      "name": "Upload Function",
      "type": "Code Engine Function",
      "lang": "Python",
      "description": "Receives the image from the frontend, creates a thumbnail version of the image and uploads both images to the COS bucket"
    },
    {
      "name": "Fotobox Download App",
      "type": "Code Engine App",
      "lang": "Go",
      "description": "Gin Web Framework based application which periodically checks for new thumbnail images in COS and downloads the images to be able to serve them to the frontend Grid View"
    }
  ]

  let selectedIndex = 0;

  // The default diagram
  let diagram = `\
flowchart TB
  subgraph IBM Cloud
     
    direction LR
    subgraph Code Engine
        direction TB
        frontendApp:::app@{ shape: rounded, label: "Fotobox Frontend App" } == Process image and generate Thumbnail ==> uploadFn:::function@{ shape: rounded, label: "Upload Function" }
        downloadApp:::app@{ shape: rounded, label: "Fotobox Download App" } == Serve Thumbnail images to Frontend ==> frontendApp
    end

    uploadFn == Upload original Image and Thumbnail ==> cos@{ shape: cyl, label: "COS Database" }
    cos == Download Thumbnail images ==> downloadApp
  end
  user@{shape: circle, label: User } <== User interacts with Webapp ==> frontendApp
  
  classDef function shape:rounded,fill:#0e0c87,color:#fff
  classDef app fill:#d6300b,color:#fff
  
  `;

  let container;
  let active = false
  async function renderDiagram() {
    if (active){
      const {svg} = await mermaid.render('mermaid', diagram)
      container.innerHTML=svg;
    }
  }

  $: diagram && renderDiagram()

  onMount(() => {
    active = true
    renderDiagram()
  });

</script>
<style>
  .tile-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .tile-header {
    font-size: 20px;
    font-weight: bold;
  }

  .tile-detail {
    font-size: 16px;
    color: #525252;
  }

  .tile-detail span {
    font-weight: bold;
    color: #000;
  }
</style>
<main>
  <!-- <pre
   contenteditable="true"
   bind:innerHTML={diagram}
  ></pre> -->
</main>
<Grid>
  <Row>
    <Column>
      <h1>Fotobox Architecture Diagram</h1>
    </Column>
  </Row>
	<Row>
		<Column>
      <span bind:this={container}>
    </Column>
    <Column>
      <h2>Components</h2>
      <br>
      <ContentSwitcher  bind:selectedIndex>
        {#each componentsInfo as comp }
          <Switch >{comp["name"]}</Switch>
        {/each}
      </ContentSwitcher>
      <br>
      <Tile>
        <div class="tile-content">
          <div class="tile-header">{componentsInfo[selectedIndex].name}</div>
          <div class="tile-detail">
            <span>Language/Framework:</span> {componentsInfo[selectedIndex].lang}
          </div>
          <div class="tile-detail">
            <span>Type:</span> {componentsInfo[selectedIndex].type}
          </div>
          <div class="tile-detail">
            <span>Description:</span> {componentsInfo[selectedIndex].description}
          </div>
        </div>
      </Tile>
    </Column>
  </Row>
</Grid>
<!-- 

https://mermaid.js.org/intro/
https://mermaid.js.org/syntax/flowchart.html
https://mermaid.live/edit#pako:eNqNU-9r2zAQ_VcOfQ7Nkmxpa-holzRQ6NhoVgbDX87S2RbIktCPZiHkf5-UpI67wpi_SLp7d--9s7Rj3AhiBauV2fAWXYDHp1ID-Fg1Dm0LD1--wkKZKHI0fcdFSEc8SKNP8EHBIjWEe91ITaeSN_inx3O0dkYH0uLO2tsd-BYtFeBM1ILECBRWpAoo2coEU5nfsDrBIeFLBnu4uYHvznDyHmSHDQGmZEOaHAaCH23sKo1SJdxniFYZFCv9L6LnAwZWUR-0Zo6BBbPROf2fYpcn-FDsmtzLUNdBtIdgztay1MFYjvRpX-rj9tVGbneSa5xMw0YFD_0M3lrnxp8V860aqF18W8MSA1bo6Ww3FeT-vYV3inPXwTxy1UEjwN3t7pVIOq6o53r25I5TOOxkcuiQBw8bGVr4SRVa-959qdmIdeQ6lCLd0l2mKFloqUtyswFBNUYVSlbqfYJiDGa91ZwVwUUasfR_mpYVNSqfTtGKdDGWEtNN7fqoRf3LmO4v1L2Qwbg-mJ1SOu5Y2Nr8YBrpQyLkRteyyfHoVAq3IVhfjMc5fdEka7G64KYbeyny62pfrufj-XR-hdMZzS9n-Gk2E7yaXF_V04-TWlx-mEyR7ff7P2oLNAc
https://terrislinenbach.medium.com/dynamically-render-a-mermaid-diagram-with-sveltekit-and-very-little-code-d8130875cd68
https://stackblitz.com/edit/github-bwrtmm-wdcbct?file=src%2FApp.svelte
-->