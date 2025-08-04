import { writable } from 'svelte/store';

// Create a writable store
export const toggelGridTimer = writable(false);
export const toggleDownload = writable(false)

export let uploadURL = "https://gd-25-fotobox-cos-upload.8kyziehrspg.eu-de.codeengine.appdomain.cloud"
export let downloadURL = "https://gd-25-fotobox-get-pics.8kyziehrspg.eu-de.codeengine.appdomain.cloud"