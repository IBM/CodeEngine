<script>
	import {
	  Grid,
	  Row,
	  Column,
	  Button,
	  ProgressBar,
	  Tooltip,
	} from "carbon-components-svelte";
	import Reset from "carbon-icons-svelte/lib/Reset.svelte";
	import { fade } from "svelte/transition";
	import { onMount } from 'svelte';
	import Alert from "../Alert.svelte";
    import { uploadURL } from "../../stores";
	let front = false;
	let video;
	let canvas;
	let context;
	let dataURL = ""
	let remainingTime = 0
	let progress = 0
	let alertInfo = {}
	let timeout = undefined
	let vheight = 0
	let vwidth = 0

	function startCamera() {
		const constraints = { video: { facingMode: (front ? "user" : "environment"), width: {ideal: 1920}, height: {ideal: 1080}} };
		navigator.mediaDevices.getUserMedia(constraints)
		.then(function(mediaStream) {
			video.srcObject = mediaStream;
			video.onloadedmetadata = function(e) {
				video.play();
				vwidth = video.videoWidth;
				vheight = video.videoHeight;
				console.log(`Video dimensions: ${vwidth}x${vheight}`);
			};
		})
		.catch(function(err) {
			console.log(err.name + ": " + err.message);
		});
	}

	function timer(seconds) {
		remainingTime = seconds;
		progress = 0
		const intervalId = setInterval(() => {

			if (remainingTime > 0) {
				console.log(`${remainingTime} seconds remaining Progress ${progress}`);
				remainingTime--;
			} else {
				progress = (100 / seconds) * (seconds - remainingTime)
				
				clearInterval(intervalId);  // Stop the interval when time runs out
				takePicture()
			}
			progress = (100 / seconds) * (seconds - remainingTime)

		}, 1000);  // 1000 ms = 1 second
	}

	function takePicture() {
		canvas.width = vwidth;
		canvas.height = vheight;
		context.drawImage(video, 0, 0, canvas.width, canvas.height);
		dataURL = canvas.toDataURL('image/png');
		progress = 0;
	}

	function sendPicture() {

		let base64Data = dataURL.replace(/^data:image\/png;base64,/, "")
		// fetch('https://hs-cos-upload.8kyziehrspg.eu-de.codeengine.appdomain.cloud', {
		fetch(uploadURL, {
		// fetch('http://127.0.0.1:8080', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ image: base64Data })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Image successfully sent:', data);
			alertInfo = {
				"display": true,
				"image_name": data["image"],
				"success": true
			}
			reset()
        })
        .catch(error => {
            console.error('Error:', error);
			alertInfo = {
				"display": true,
				"image_name": data["image"],
				"success": false
			}
        });
	}

	function flipCamera() {
		front = !front;
		startCamera();  // Restart the camera with the new facing mode
	}

	function reset() {
		progress = 0
		dataURL = ""
		context.clearRect(0, 0, canvas.width, canvas.height);
		startCamera();
	}

	function onKeyDown(e) {
		console.log(e.keyCode)
		if (e.keyCode === 51 || e.keyCode === 99 ) {
			timer(3)
		}
		if (e.keyCode === 53 || e.keyCode === 101 ) {
			timer(3)
		}
		if (e.keyCode === 32) {
			timer(10)
		}
		
		if (dataURL !== "" && e.keyCode === 27) {
			reset()
		}
		if (dataURL !== "" && e.keyCode === 13) {
			sendPicture()
		}
		
	}

	onMount(() => {
		context = canvas.getContext('2d');
		reset()
	});

</script>
<style>
	/* Container to enforce 16:9 aspect ratio */
	.video-container {
      position: relative;
      width: 100%;
      padding-bottom: 56.25%; /* 16:9 aspect ratio (9 / 16 * 100) */
      overflow: hidden;
    }

    /* Video element styling */
    .video-container video {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    } 

	.video-container img {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    } 
</style>
<Grid>
	<Row>
		<Column>
				<div class="video-container">
				{#if dataURL == ""}
				
				<!-- svelte-ignore a11y-media-has-caption -->
				<!-- <video bind:this={video} id="video" width="640" height="480"></video> -->
					<video bind:this={video} id="video"></video>

				{:else}
					<!-- svelte-ignore a11y-img-redundant-alt -->
					<img src={dataURL}  id="photo" alt="Your Photo" style="border: 1px solid; display: block;">
				{/if}
				</div>

				<!-- <canvas bind:this={canvas} id="canvas" width="640" height="480" style="display: none;"></canvas> -->
				<canvas bind:this={canvas} id="canvas" style="display: none;"></canvas>
		</Column>
	</Row>
	<!-- {#if remainingTime != 0} -->
		<Row>
			<Column>
				<ProgressBar
				size="xl"
				value={progress}
			  />
			</Column>

		</Row>
		<br>
	<!-- {/if} -->

	<Row>
		<Column>
			<!-- <Button on:click={flipCamera}>Flip Camera</Button> -->
			<Tooltip direction="right">
				<p><strong>Disclamer:</strong> Images are Displayed and Stored</p> 
			</Tooltip>
			{#if dataURL == ""}
				<Button kind="tertiary" on:click={flipCamera} iconDescription="flip" icon={Reset} />
				<Button on:click={takePicture}>Take Picture</Button>
				<Button kind="secondary" on:click={() => timer(10)}>Take Picture 10 Sec </Button>
				<Button kind="secondary" on:click={() => timer(5)}>Take Picture 5 Sec </Button>
				<Button kind="secondary" on:click={() => timer(3)}>Take Picture 3 Sec </Button>

			{:else}
				<Button kind="tertiary" on:click={sendPicture}>Upload Picture</Button>
				<Button kind="danger-tertiary" on:click={reset}>Clear</Button>
			{/if}

			  
		</Column>
	</Row>
	<Alert data={alertInfo} on:resetAlert={()=>alertInfo={}}></Alert>
</Grid>


<svelte:window on:keydown|preventDefault={onKeyDown} />