<script>
    import { onMount } from "svelte";
    import QRCode from "qrcode";
    import {
	  Grid,
	  Row,
	  Column,
    ButtonSet,
	  Button,
    Tile,
	} from "carbon-components-svelte";

    import {default as CameraIcon } from "carbon-icons-svelte/lib/Camera.svelte";
    import { default as GridIcon } from "carbon-icons-svelte/lib/Grid.svelte";
    import {default as ParentChildIcon } from "carbon-icons-svelte/lib/ParentChild.svelte";

    let url = "https://gd-25-fotobox-frontend.8kyziehrspg.eu-de.codeengine.appdomain.cloud/" // make dynamic
    let qrCodeData = "";
  
    const generateQRCode = async () => {
      try {
        qrCodeData = await QRCode.toDataURL(url);
      } catch (error) {
        console.error("Failed to generate QR code", error);
      }
    };
  
    onMount(() => {
      generateQRCode(); // Automatically generate the QR code when the component mounts
    });
  </script>
  
  <style>
    .container {
      text-align: center;
      margin: 20px;
    }
  
    img {
      margin-top: 20px;
      border: 1px solid #ccc;
      padding: 10px;
    }
  </style>
  

  
<Grid>
    <Row>
        <Column>
            <h1>IBM Girls Day 2025</h1>
            <h2>The easy way to save a snapshot of the Event</h2>
        </Column>
    </Row>
    <br>
    <Row>
        <Column>
          <Tile>
            <p>
              <strong>Disclamer:</strong> <i>By using this photobox, you agree that your dazzling or hilariously awkward photos may be displayed for all to admire and stored for posterity. 
              Think of it as your ticket to instant fame—or at least a great laugh at the office party. 
              If you prefer to stay mysterious, maybe skip the photobox... but where's the fun in that?</i>
            </p>
          </Tile>
        </Column>
    </Row>
    <br>
    <Row>
        <Column>
            <div class="container">
                {#if qrCodeData}
                  <img src={qrCodeData} alt="QR Code" />
                {/if}
              </div>
        </Column>
    </Row>
    <br>
    <Row>
        <Column>
            <ButtonSet>
                <Button size="xl" icon={CameraIcon} href="/camera">Camera</Button>
                <Button size="xl" icon={GridIcon} href="/slideshow" kind="secondary">Photo Grid</Button>
                <Button size="xl" icon={ParentChildIcon} href="/architecture" kind="tertiary">Architecture</Button>
              </ButtonSet>              
        </Column>
    </Row>
</Grid>