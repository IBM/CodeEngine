const ne = ["file_input", "add", "picture_preview", "progress", "upload", "clear", "colorizer"].reduce((p, c) => {
  p[c] = document.querySelector(`[data-${c.replace("_", "-")}]`);
  return p;
}, Object.create(null));

let enabledFeatures = {};

ne.add.disabled = true;
ne.upload.addEventListener("click", openFileSelector, false);
ne.clear.addEventListener("click", clearGallery, false);

async function clearGallery() {
  ne.progress.innerText = "Deleting...";
  ne.add.disabled = true;
  if (enabledFeatures.fs) {
    // delete items from the file system location
    await fetch("/delete-gallery-content", { method: "POST" });

    // reload the gallery
    listGalleryContent();
  } else {
    // just delete the images from the HTML DOM
    const gallery = document.getElementById("gallery");
    var current = gallery.childNodes.length - 1;
    while (current != -1) {
      gallery.removeChild(gallery.firstChild);
      current--;
    }
  }
  ne.progress.innerText = "";
  ne.add.disabled = false;
}

//
// Uploads the current image that is put in the preview mode to the configured COS bucket
//
function uploadImg() {
  ne.progress.innerText = "Uploading...";
  console.info("Uploading...");
  var canvas = document.createElement("canvas");
  var context = canvas.getContext("2d");
  var img = ne.picture_preview;
  canvas.height = img.naturalHeight;
  canvas.width = img.naturalWidth;
  context.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
  try {
    var data = canvas.toBlob(function (blob) {
      var url = "./upload";
      var xhr = new XMLHttpRequest();
      xhr.open("POST", url, true);

      xhr.addEventListener("readystatechange", function (e) {
        if (xhr.readyState == 4 && xhr.status == 200) {
          ne.progress.innerHTML = "";

          // reload the bucket
          listGalleryContent();
        } else if (xhr.readyState == 4) {
          ne.progress.innerHTML = xhr.responseText;
        }
      });
      xhr.send(blob);
    });
  } catch (exp) {
    ne.progress.innerText = exp;
  }
}

//
// Stores the current image that is in preview into the gallery container as a data image object.
// This image is only stored on the client-side
//
function addImg() {
  ne.progress.innerText = "Adding...";
  console.info("Adding...");

  const gallery = document.getElementById("gallery");

  var imgDiv = document.createElement("div");
  imgDiv.className = "column-6 gallery-div";

  var img = document.createElement("img");
  img.type = "image";
  img.className = "gallery-pic";
  img.src = ne.picture_preview.src;
  img.id = Date.now();

  imgDiv.appendChild(img);

  ne.progress.innerText = "";

  gallery.appendChild(imgDiv);
}

function openFileSelector() {
  ne.file_input.click();
}

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function highlight(e) {
  ne.picture_preview.classList.add("highlight");
}

function unhighlight(e) {
  ne.picture_preview.classList.remove("highlight");
}

function doDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  var items = e.dataTransfer.items;
  var item = items[0];

  var url = e.dataTransfer.getData("URL");
  if (url == "") {
    url = e.dataTransfer.getData("Text");
  }
  if (url != "") {
    ne.picture_preview.src = url;
    ne.add.disabled = false;
    ne.progress.innerText = "";
  } else {
    previewPicture(e.dataTransfer.files[0]);
  }
}

function previewPicture(file) {
  if (file != null) {
    var reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = function () {
      ne.picture_preview.src = reader.result;
    };
    ne.add.disabled = false;
    ne.progress.innerText = "";
  }
}

ne.picture_preview.addEventListener("dragenter", preventDefaults, false);
ne.picture_preview.addEventListener("dragover", preventDefaults, false);
ne.picture_preview.addEventListener("dragleave", preventDefaults, false);

ne.picture_preview.addEventListener("dragenter", highlight, false);
ne.picture_preview.addEventListener("dragover", highlight, false);

ne.picture_preview.addEventListener("dragleave", unhighlight, false);
ne.picture_preview.addEventListener("drop", unhighlight, false);

ne.picture_preview.addEventListener("drop", doDrop, false);

function listGalleryContent() {
  var xmlHttp = new XMLHttpRequest();
  xmlHttp.onreadystatechange = function () {
    if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
      var result = JSON.parse(xmlHttp.response);

      const gallery = document.getElementById("gallery");
      var current = gallery.childNodes.length - 1;
      console.info(`Gallery child nodes: '${current}'`);
      for (var i = 0; result[i] != null; i++) {
        if (current == -1) {
          var imgDiv = document.createElement("div");
          imgDiv.className = "column-6 gallery-div";

          var img = document.createElement("img");
          img.type = "image";
          img.className = "gallery-pic";
          img.src = `/image/${result[i].Key}`;
          img.id = result[i].Key;
          img.updated = result[i].LastModified;

          if (enabledFeatures.colorizer) {
            (function (id) {
              console.info(`setting onclick handler for '${id}'`);
              img.onclick = async () => {
                console.info(`colorizer for '${id}'`);
                ne.colorizer.innerText = "Colorizing ...";

                const currentImage = document.getElementById(id);

                // adding the disabled classname will let the image appear as not clickable
                currentImage.className = "gallery-pic colorizable disabled";
                try {
                  // trigger the color change
                  const colorizeResp = await fetch("/change-colors", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: `{"imageId": "${id}"}`,
                  });
                  if (colorizeResp.status != 200) {
                    ne.colorizer.innerText = await colorizeResp.text();
                  } else {
                    ne.colorizer.innerText = "";
                  }
                } catch (err) {
                  console.error(`Failed to change color of image '${id}'`, err);
                  ne.colorizer.innerText = err.message;
                } finally {
                  currentImage.className = "gallery-pic colorizable";
                }

                // make sure that the updated image gets reloaded by the browser by changing the source URL
                let imageSrc = currentImage.src;
                if (imageSrc.indexOf("?") > -1) {
                  imageSrc = imageSrc.substring(0, imageSrc.indexOf("?"));
                }
                currentImage.src = imageSrc + "?ts=" + Date.now();
              };
            })(img.id);
            img.className += " colorizable";
          }
          imgDiv.appendChild(img);

          ne.progress.innerText = "";

          gallery.insertBefore(imgDiv, gallery.firstChild);
        } else {
          var row = gallery.childNodes[current];
          var img = row.childNodes[0];
          let imageSrc = img.src;
          if (imageSrc.indexOf("?") > -1) {
            imageSrc = imageSrc.substring(0, imageSrc.indexOf("?"));
          }
          if (!imageSrc.endsWith(result[i].Key)) {
            img.src = `/image/${result[i].Key}`;
            img.updated = result[i].LastModified;
          } else if (result[i].LastModified !== img.updated) {
            img.updated = result[i].LastModified;
            img.src = `/image/${result[i].Key}?ts=${Date.now()}`;
          }

          current--;
        }
      }
      while (current != -1) {
        gallery.removeChild(gallery.firstChild);
        current--;
      }
    }
  };
  xmlHttp.open("GET", "./list-gallery-content", true);
  xmlHttp.send(null);
}

// check which features are enabled. Depending on the result the app behaves differently
const checkFeatures = async () => {
  const response = await fetch("/features");
  enabledFeatures = await response.json();
  console.info(`Available features: ${JSON.stringify(enabledFeatures)}`);

  if (enabledFeatures.fs) {
    // list all images that are stored in the bucket
    listGalleryContent();

    // enable the handler to upload images to COS
    ne.add.addEventListener("click", uploadImg, false);

    // add a refresh button to trigger reloading the gallery
    var refreshBtn = document.createElement("button");
    refreshBtn.className = "cta-refresh";
    refreshBtn.innerText = "Refresh";
    refreshBtn.addEventListener("click", listGalleryContent, false);

    document.getElementById("gallery-cta-buttons").appendChild(refreshBtn);

    if (enabledFeatures.fs.cos) {
      document.getElementById("gallery-title-text").innerText = "My Gallery hosted on IBM Cloud Object Storage";
    }
  } else {
    // fallback to store image on the client side
    ne.add.addEventListener("click", addImg, false);
  }

  if (enabledFeatures.colorizer) {
    document.getElementById("gallery").className += " clickable";
    document.getElementById("gallery-subtitle").className = "";
  }
};
checkFeatures();
