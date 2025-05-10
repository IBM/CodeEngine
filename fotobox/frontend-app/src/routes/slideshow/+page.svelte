<script>
  import { onMount, onDestroy } from 'svelte';
  import { writable } from 'svelte/store';
  import { 
    LocalStorage, 
    Modal,
    TextInput,
    Pagination,
    ImageLoader,
    Link,
    Toggle
  } from "carbon-components-svelte";
  import { toggelGridTimer, toggleDownload, downloadURL } from "../../stores.js";


  // Store to hold the fetched images
  let storage
  const images = writable([]);
  let lastimage = ""
  let limit = 4
  let timerID = null
  let gridtimerID = null
  let passwordSet = false
  let password = ""
  let inputPassword = ""
  let open = false
  let showNames = false
  let gridviewToggle = true
  let pageTurnerToggle = false
  let slideshowToggleTimer = false
  let showImageDownloads = false
  
  function startTimer() {
    if (timerID === null){
      timerID = setInterval(getImages, 60000)
    }
  }

  function stopTimer(){
    if (timerID !== null) { 
      clearInterval(timerID);
      timerID = null;
    }
  }


  function pageTurner() {
    if (slideshowToggleTimer) {
      startGridTimer()
    } else {
      stopGridTimer()
    }
  }

  function startGridTimer() {
    if (gridtimerID === null){
      gridtimerID = setInterval(goToNextPage, 5000)
    }
  }

  function stopGridTimer() {
    if (gridtimerID !== null) { 
      clearInterval(gridtimerID);
      gridtimerID = null;
    }
  }

  function getImages() {
    if (!passwordSet){
      password = inputPassword
    }

    open = false
    fetch(downloadURL + "/login", {
      // fetch("http://localhost:8080/login", {
      method: 'POST',
      headers: {
                'Content-Type': 'application/json'
            },
      body: JSON.stringify({
              "password": password
            })
    })
    .then(response => {
      if (response.status == 401){
        password = ""
        // PasswordInput = ""
        storage.clearAll()
        passwordSet=false
        open = true
        return null
      } 

      if (response.status == 200) {
        fetch(downloadURL + "/images/", {
          // fetch("http://localhost:8080/images", {
          method: "GET"
        })
        .then(response => {
          return response.json()
        })
        .then(data => {
          if (data) {
            images.update(currentImages => [...data])
            startTimer()
            pageTurner()
          }
        })
      }
    })
    // fetch("https://hs-cos-download.8kyziehrspg.eu-de.codeengine.appdomain.cloud",{
    // fetch("https://fotobox-cos-download.8kyziehrspg.eu-de.codeengine.appdomain.cloud",{
    //   method: 'POST',
    //   headers: {
    //             'Content-Type': 'application/json'
    //         },
    //   body: JSON.stringify({
    //           "limit": limit, 
    //           "lastimage": lastimage,
    //           "password": password
    //         })
    // })
    // .then(response => {
    //   if (response.status == 401){
    //     password = ""
    //     PasswordInput = ""
    //     storage.clearAll()
    //     passwordSet=false
    //     open = true
    //     return null
    //   }
    //   if (response.status == 416){
    //     console.log("cant get images returned json to big")
    //     limit -= 1
    //     console.log("current limit: " + limit)
    //     getImages()
    //     return null
    //   }
    //   return response.json()
    // })
    // .then(data => {
    //   if (data) {
    //     images.update(currentImages => [...currentImages, ...data.images])
    //     lastimage = data.next_start_after
    //     let imagesLeft = data.images_left
    //     if (imagesLeft !== 0){
    //       stopTimer()
    //       getImages()
    //     } else {
    //       startTimer()
    //     }
    //   } 
    // })

  }

  function saveImage2Downloads(image) {
    console.log(image)
    // Convert base64 to Blob
    const byteCharacters = atob(image.data);
    const byteNumbers = Array.from(byteCharacters).map(char => char.charCodeAt(0));
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/png' });

    // Create a temporary link to download the file
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = image.name;
    link.click();

    // Clean up URL object after download
    URL.revokeObjectURL(link.href);
  }

  // async function saveOriginalImage(image) {
  //    // Replace with your image URL
  //   const imageName = image["original"]; // Default name for the downloaded file
  //   const imageUrl = 'https://fotobox-get-pics.8kyziehrspg.eu-de.codeengine.appdomain.cloud/images/' + imageName;
  //   const response = await fetch(imageUrl);
  //   const blob = await response.blob();

  //   // Create a Blob URL
  //   const blobUrl = URL.createObjectURL(blob);

  //   // Trigger the download
  //   const link = document.createElement('a');
  //   link.href = blobUrl;
  //   link.download = imageName; 
  //   link.click();

  //   URL.revokeObjectURL(blobUrl);
  // }

  async function saveOriginalImage(image) {
    // Replace with your image URL
    const imageName = image["original"]; 
    const imageUrl = downloadURL + '/images/' + imageName; 
    
    try {
      const response = await fetch(imageUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      
      const blob = await response.blob();

      const blobUrl = URL.createObjectURL(blob);

      // Trigger the download
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = imageName; // Prompts "Save As" dialog
      link.target = '_blank';
      document.body.appendChild(link); // Append to document (required for some browsers)
      link.click();
      document.body.removeChild(link); // Clean up

      // Revoke the Blob URL to free memory
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Error saving the image:', error);
    }
  }


  // Constants for pagination
  const itemsPerPage = 24;
  let currentPage = 1;
  let totalPages = 1;

  // Subscribing to images to calculate total pages
  images.subscribe((imgs) => {
    totalPages = Math.ceil(imgs.length / itemsPerPage);
  });

  // Compute the images for the current page
  function paginatedImages(imagesArray, page, perPage) {
    const start = (page - 1) * perPage;
    const end = start + perPage;
    return imagesArray.slice(start, end);
  }


  function goToNextPage() {
    if (currentPage === totalPages) {
      currentPage = 1; // Reset to the first page
    } else {
      currentPage += 1; // Move to the next page
    }
  }


  toggelGridTimer.subscribe((v)=> {
				slideshowToggleTimer = v
        pageTurner()
        
	})
  toggleDownload.subscribe((v)=> {
    showImageDownloads = v        
	})

  // function onKeyDown(e) {
	// 	if (e.keyCode === 84) {
	// 		pageTurnerToggle = !pageTurnerToggle
	// 	}
		
	// }
  
  // Fetch images on component mount
  onMount(() => {
    const url = new URL(window.location.href);
    
    // Get the query parameters
    const params = new URLSearchParams(url.search);
    
    // Check if 'showNames' exists and set its value
    if (params.has('showNames')) {
      showNames = params.get('showNames') === 'true';  // Convert string to boolean
    }
    if (password === ""){
      open = true
    } else {
      passwordSet= true
      getImages()
    }
	});
</script>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 10px;
  }
/*
  .image-container img {
    width: 100%;
    height: auto;
    object-fit: cover;
    border-radius: 4px;
  }
  .image-container ImageLoader {
    width: 100%;
    height: auto;
    object-fit: cover;
    border-radius: 4px;
  }
    */
</style>
<LocalStorage
  key="cospassword"
  bind:value={password}
  bind:this={storage}
/>

<!-- <div class="load-more">
  <button on:click={getImages}>Load More Images</button>
</div> -->
{#if !passwordSet}
  <Modal
  bind:open
  modalHeading="Enter Password"
  primaryButtonText="Submit"
  secondaryButtonText="Cancel"
  selectorPrimaryFocus="#pw-input"
  on:click:button--secondary={() => (open = false)}
  on:open
  on:close
  on:submit={getImages}
    >
    <TextInput bind:value={inputPassword} id="pw-input" hideLabel labelText="Password" placeholder="Enter your password..." type="password"/>
    <!-- <PasswordInput bind:value={inputPassword} id="pw-input" hideLabel labelText="Password" placeholder="Enter password..."  type="password" /> -->
  </Modal>
{/if}

{#if gridviewToggle}
<div class="grid">
  {#each paginatedImages($images, currentPage, itemsPerPage) as image}
    <div class="image-container" >
      <!-- svelte-ignore a11y-img-redundant-alt -->
       <!-- src="data:image/jpeg;base64,{image.data}" -->
      <ImageLoader
        fadeIn
        
        src="{downloadURL}/images/{image.name}"
      />
      <!-- <button on:click={() => saveImage2Downloads(image)} >d</button> -->
       {#if showNames || showImageDownloads}
        <Link on:click={() => saveOriginalImage(image)} >{image.original}</Link>
       {/if}
      <!-- <img src="data:image/jpeg;base64,{image.data}" alt="Grid Image" /> -->
    </div>
  {/each}
</div>

<Pagination
  totalItems={$images.length}
  pageSize={itemsPerPage}
  pageSizes={[itemsPerPage]}
  on:change={(event) => (currentPage = event.detail.page)}
/>
{:else}
<h1>NO</h1>
{/if}


<!-- <svelte:window on:keydown|preventDefault={onKeyDown} /> -->

<!-- <button on:click={()=>{password = "";storage.clearAll()}}>clear</button> -->
