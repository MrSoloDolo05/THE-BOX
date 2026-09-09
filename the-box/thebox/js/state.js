/* =========================================================
   ID GENERATION
   (crypto.randomUUID() is only guaranteed in secure
   contexts. If the page is opened directly from disk,
   or in a browser that restricts it, it can be missing.
   This falls back to a manual UUID-like generator so
   creating songs / sections / folders / liners never
   silently fails.)
========================================================= */

function generateId() {

    if (
        window.crypto &&
        typeof window.crypto.randomUUID ===
            "function"
    ) {

        return window.crypto.randomUUID();
    }


    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
        .replace(
            /[xy]/g,
            character => {

                const random =
                    (Math.random() * 16) | 0;

                const value =
                    character === "x"
                        ? random
                        : (random & 0x3) | 0x8;

                return value.toString(16);
            }
        );
}


/* =========================================================
   APPLICATION STATE
========================================================= */

let state = {
    songs: [],
    folders: [],
    liners: [],
    verses: [],
    trash: []
};

let currentSongId = null;
let currentSectionId = null;
let currentFolderId = null;
let currentView = "crate";

let draggedSongId = null;
let linerFilter = "all";
let linerView = "lines";

let lyricsSaveTimer = null;
let cloudPushTimer = null;

/* Realtime reconciliation must never tear down a focused
   editor. These flags let the sync layer know the user is
   actively typing so renderAll() can defer the Red Room
   re-render until they leave the field. */
let liveEditActive = false;
let renderDeferredWhileEditing = false;

function setLiveEdit(active) {
    liveEditActive = active === true;
}

function isLiveEdit() {
    return liveEditActive;
}

function markRenderDeferred() {
    renderDeferredWhileEditing = true;
}

function consumeRenderDeferred() {
    const wasDeferred = renderDeferredWhileEditing;
    renderDeferredWhileEditing = false;
    return wasDeferred;
}

window.searchResults = [];