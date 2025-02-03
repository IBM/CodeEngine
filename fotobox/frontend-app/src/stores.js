import { writable } from 'svelte/store';

// Create a writable store
export const toggelGridTimer = writable(false);
export const toggleDownload = writable(false)

export const uploadURL = "https://fotobox-cos-upload.1pbeufitp1uq.eu-de.codeengine.appdomain.cloud"
export const downloadURL = "https://fotobox-get-pics.1pbeufitp1uq.eu-de.codeengine.appdomain.cloud"