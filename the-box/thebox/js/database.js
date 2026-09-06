/* =========================================================
   DATABASE / STORAGE
========================================================= */

const DATABASE_KEY = "the_box_app_state";

const UI_STATE_KEY = "the_box_ui_state";


/* =========================================================
   UI STATE (current view, persisted across refreshes)
========================================================= */

function saveUIState() {

    try {

        localStorage.setItem(
            UI_STATE_KEY,
            JSON.stringify({
                view: currentView,
                songId: currentSongId,
                folderId: currentFolderId
            })
        );

    } catch (error) {

        console.error(
            "Could not save UI state:",
            error
        );
    }
}


function loadUIState() {

    try {

        const saved =
            localStorage.getItem(UI_STATE_KEY);

        if (!saved) {
            return null;
        }

        return JSON.parse(saved);

    } catch (error) {

        console.error(
            "Could not load UI state:",
            error
        );

        return null;
    }
}


/* =========================================================
   DEFAULT STATE
========================================================= */

function createDefaultState() {
    return {
        songs: [],

        folders: [
            {
                id: generateId(),
                name: "UNSORTED"
            }
        ],

        liners: [],

        verses: [],

        trash: []
    };
}


/* =========================================================
   SAVE STATE
========================================================= */

function saveState() {
    try {
        localStorage.setItem(
            DATABASE_KEY,
            JSON.stringify(state)
        );

        const saveStatus =
            document.getElementById("save-status");

        if (saveStatus) {
            saveStatus.textContent = "SAVED";
        }

        /* Fire-and-forget cloud sync when signed in. */
        if (
            typeof isSignedIn === "function" &&
            isSignedIn() &&
            typeof pushState === "function"
        ) {
            clearTimeout(cloudPushTimer);
            cloudPushTimer = setTimeout(() => {
                pushState();
            }, 500);
        }

    } catch (error) {
        console.error(
            "Could not save application state:",
            error
        );
    }
}


/* =========================================================
   LOAD STATE
========================================================= */

function loadState() {
    try {
        const saved =
            localStorage.getItem(DATABASE_KEY);

        if (!saved) {
            state = createDefaultState();
            saveState();
            return;
        }

        const parsed =
            JSON.parse(saved);

        state = {
            songs: Array.isArray(parsed.songs)
                ? parsed.songs
                : [],

            folders: Array.isArray(parsed.folders)
                ? parsed.folders
                : [],

            liners: Array.isArray(parsed.liners)
                ? parsed.liners
                : [],

            verses: Array.isArray(parsed.verses)
                ? parsed.verses
                : [],

            trash: Array.isArray(parsed.trash)
                ? parsed.trash
                : []
        };


        /* -------------------------------------------------
           FOLDER MIGRATION
        ------------------------------------------------- */

        if (!state.folders.length) {
            state.folders.push({
                id: generateId(),
                name: "UNSORTED"
            });
        }


        state.folders.forEach(folder => {
            if (!folder.id) {
                folder.id = generateId();
            }

            if (
                typeof folder.name !== "string" ||
                !folder.name.trim()
            ) {
                folder.name = "UNSORTED";
            }
        });


        /* -------------------------------------------------
           SONG MIGRATION
        ------------------------------------------------- */

        state.songs.forEach(song => {

            if (!song.id) {
                song.id = generateId();
            }

            if (
                typeof song.title !== "string" ||
                !song.title.trim()
            ) {
                song.title = "UNTITLED";
            }

            if (!song.status) {
                song.status = "Draft";
            }

            if (!song.created) {
                song.created =
                    new Date().toISOString();
            }

            if (!song.modified) {
                song.modified = song.created;
            }

            if (!Array.isArray(song.sections)) {
                song.sections = [];
            }

            if (!song.folder) {
                const unsorted =
                    state.folders.find(
                        folder =>
                            folder.name === "UNSORTED"
                    );

                if (unsorted) {
                    song.folder = unsorted.id;
                }
            }

            song.sections.forEach(section => {

                if (!section.id) {
                    section.id =
                        generateId();
                }

                if (!section.type) {
                    section.type = "VERSE";
                }

                if (
                    typeof section.lyrics !==
                    "string"
                ) {
                    section.lyrics = "";
                }
            });
        });


        /* -------------------------------------------------
           LINER MIGRATION
        ------------------------------------------------- */

        state.liners.forEach(liner => {

            if (!liner.id) {
                liner.id = generateId();
            }

            if (
                typeof liner.text !== "string"
            ) {
                liner.text = "";
            }

            if (!Array.isArray(liner.usedIn)) {
                liner.usedIn = [];
            }

            if (!liner.created) {
                liner.created =
                    new Date().toISOString();
            }
        });


        /* -------------------------------------------------
           VERSE MIGRATION
        ------------------------------------------------- */

        state.verses.forEach(verse => {

            if (!verse.id) {
                verse.id = generateId();
            }

            if (
                typeof verse.text !== "string"
            ) {
                verse.text = "";
            }

            if (!Array.isArray(verse.usedIn)) {
                verse.usedIn = [];
            }

            if (!verse.created) {
                verse.created =
                    new Date().toISOString();
            }
        });


        saveState();

    } catch (error) {

        console.error(
            "Could not load application state:",
            error
        );

        state = createDefaultState();

        saveState();
    }
}


/* =========================================================
   CLEAR DATABASE
========================================================= */

function clearDatabase() {

    localStorage.removeItem(
        DATABASE_KEY
    );

    state = createDefaultState();

    currentSongId = null;
    currentSectionId = null;
    currentFolderId = null;

    renderAll();
    showView("crate");
}


/* =========================================================
   EXPORT DATABASE
========================================================= */

function exportDatabase() {

    const data =
        JSON.stringify(
            state,
            null,
            2
        );

    const blob =
        new Blob(
            [data],
            {
                type: "application/json"
            }
        );

    const url =
        URL.createObjectURL(blob);

    const link =
        document.createElement("a");

    link.href = url;

    link.download =
        "the-box-backup.json";

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);
}


/* =========================================================
   IMPORT DATABASE
========================================================= */

function importDatabase(event) {

    const file =
        event.target.files?.[0];

    if (!file) {
        return;
    }

    const reader =
        new FileReader();

    reader.onload = function () {

        try {

            const imported =
                JSON.parse(
                    reader.result
                );

            if (
                !imported ||
                !Array.isArray(imported.songs) ||
                !Array.isArray(imported.folders) ||
                !Array.isArray(imported.liners) ||
                !Array.isArray(imported.trash)
            ) {

                alert(
                    "Invalid THE BOX database."
                );

                return;
            }

            /* Older backups may not have verses yet. */
            if (!Array.isArray(imported.verses)) {
                imported.verses = [];
            }

            state = imported;

            /* Run migration logic again */
            localStorage.removeItem(
                DATABASE_KEY
            );

            saveState();

            currentSongId = null;
            currentSectionId = null;
            currentFolderId = null;

            loadState();

            renderAll();

            showView("crate");

            alert(
                "Database imported successfully."
            );

        } catch (error) {

            console.error(error);

            alert(
                "Could not import database."
            );
        }
    };

    reader.readAsText(file);

    /* Allow the same file to be selected again */
    event.target.value = "";
}