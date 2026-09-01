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
    trash: []
};

let currentSongId = null;
let currentSectionId = null;
let currentFolderId = null;
let currentView = "crate";

let draggedSongId = null;
let linerFilter = "all";

window.searchResults = [];