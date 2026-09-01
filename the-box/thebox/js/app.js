/* =========================================================
   APP
========================================================= */


/* =========================================================
   VIEW MANAGEMENT
========================================================= */

function showView(view) {

    /* -----------------------------------------------------
       GUARD: RED ROOM NEEDS A SONG
       (the sidebar link can be clicked with nothing open;
       jump into the most recently edited song instead of
       silently doing nothing, or start a new one if the
       crate is empty)
    ----------------------------------------------------- */

    if (
        view === "redroom" &&
        !getCurrentSong()
    ) {

        const mostRecent =
            [...state.songs].sort(
                (a, b) =>
                    new Date(b.modified) -
                    new Date(a.modified)
            )[0];

        if (mostRecent) {

            currentSongId =
                mostRecent.id;

            currentSectionId =
                mostRecent.sections[0]?.id ||
                null;

        } else {

            createSong();
            return;
        }
    }


    document
        .querySelectorAll(
            ".view"
        )
        .forEach(element => {

            element.classList.remove(
                "active"
            );
        });


    const target =
        document.getElementById(
            "view-" + view
        );


    if (target) {

        target.classList.add(
            "active"
        );
    }


    /* -----------------------------------------------------
       NAVIGATION
    ----------------------------------------------------- */

    document
        .querySelectorAll(
            ".nav-button"
        )
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.view ===
                view
            );
        });


    /* -----------------------------------------------------
       PAGE TITLE
    ----------------------------------------------------- */

    const pageTitle =
        document.getElementById(
            "page-title"
        );


    if (pageTitle) {

        const titles = {

            crate:
                "CRATE",

            folder:
                "FOLDER",

            liners:
                "ONE LINERS",

            redroom:
                "RED ROOM",

            search:
                "SEARCH",

            trash:
                "TRASH"
        };


        pageTitle.textContent =
            titles[view] ||
            view.toUpperCase();
    }


    /* -----------------------------------------------------
       BACKGROUND
    ----------------------------------------------------- */

    const app =
        document.getElementById(
            "app"
        );


    if (app) {

        app.setAttribute(
            "data-view",
            view
        );
    }


    /* -----------------------------------------------------
       TOOLS: ONLY AVAILABLE INSIDE THE RED ROOM
    ----------------------------------------------------- */

    const toolsButton =
        document.getElementById(
            "tools-button"
        );

    const toolsPanel =
        document.getElementById(
            "tools"
        );

    const isRedRoom =
        view === "redroom";


    if (toolsButton) {

        toolsButton.classList.toggle(
            "hidden",
            !isRedRoom
        );
    }


    if (toolsPanel) {

        toolsPanel.classList.toggle(
            "hidden",
            !isRedRoom
        );
    }


    if (!isRedRoom) {

        closeTools();

        closeTemplateMenu();
    }


    /* -----------------------------------------------------
       REFRESH VIEW
    ----------------------------------------------------- */

    if (
        view === "crate" &&
        typeof renderCrate ===
            "function"
    ) {

        renderCrate();
    }


    if (
        view === "folder" &&
        typeof renderFolderSongs ===
            "function"
    ) {

        renderFolderSongs();
    }


    if (
        view === "liners" &&
        typeof renderLiners ===
            "function"
    ) {

        renderLiners();
    }


    if (
        view === "redroom" &&
        typeof renderRedRoom ===
            "function"
    ) {

        renderRedRoom();
    }


    if (
        view === "search" &&
        typeof renderSearch ===
            "function"
    ) {

        renderSearch();
    }


    if (
        view === "trash" &&
        typeof renderTrash ===
            "function"
    ) {

        renderTrash();
    }


    /* -----------------------------------------------------
       PERSIST CURRENT VIEW
    ----------------------------------------------------- */

    currentView = view;

    saveUIState();
}


/* =========================================================
   GENERAL RENDER
========================================================= */

function renderAll() {

    if (
        typeof renderCrate ===
        "function"
    ) {

        renderCrate();
    }


    if (
        typeof renderLiners ===
        "function"
    ) {

        renderLiners();
    }


    if (
        typeof renderTrash ===
        "function"
    ) {

        renderTrash();
    }


    if (
        currentSongId &&
        typeof renderRedRoom ===
        "function"
    ) {

        renderRedRoom();
    }


    if (
        currentFolderId &&
        typeof renderFolderSongs ===
        "function"
    ) {

        renderFolderSongs();
    }
}


/* =========================================================
   FOLDER DETAIL REFRESH
========================================================= */

function renderFolderSongsIfNeeded() {

    const view =
        document.getElementById(
            "view-folder"
        );


    if (
        view &&
        view.classList.contains(
            "active"
        ) &&
        typeof renderFolderSongs ===
            "function"
    ) {

        renderFolderSongs();
    }
}


/* =========================================================
   SEARCH RENDER
========================================================= */

function renderSearch() {

    const box =
        document.getElementById(
            "search-box"
        );


    if (
        box &&
        box.value.trim()
    ) {

        performSearch(
            box.value
        );
    }
}


/* =========================================================
   DATE FORMATTING
========================================================= */

function formatDate(date) {

    if (!date) {
        return "";
    }


    const parsed =
        new Date(date);


    if (
        Number.isNaN(
            parsed.getTime()
        )
    ) {

        return "";
    }


    return parsed
        .toLocaleDateString(
            [],
            {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        )
        .toUpperCase();
}


/* =========================================================
   HTML ESCAPING
========================================================= */

function escapeHTML(value) {

    return String(value)

        .replaceAll(
            "&",
            "&amp;"
        )

        .replaceAll(
            "<",
            "&lt;"
        )

        .replaceAll(
            ">",
            "&gt;"
        )

        .replaceAll(
            '"',
            "&quot;"
        )

        .replaceAll(
            "'",
            "&#039;"
        );
}


function escapeAttribute(value) {

    return escapeHTML(value);
}


/* =========================================================
   MODAL
========================================================= */

function openModal() {

    const modal =
        document.getElementById(
            "modal-overlay"
        );


    if (!modal) {
        return;
    }


    modal.classList.add(
        "open"
    );
}


function closeModal() {

    const modal =
        document.getElementById(
            "modal-overlay"
        );


    if (!modal) {
        return;
    }


    modal.classList.remove(
        "open"
    );


    const confirm =
        document.getElementById(
            "modal-confirm"
        );


    if (confirm) {

        confirm.onclick = null;
    }
}


/* =========================================================
   MODAL SETUP
========================================================= */

function setupModal() {

    const modal =
        document.getElementById(
            "modal-overlay"
        );


    if (!modal) {
        return;
    }


    modal.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                modal
            ) {

                closeModal();
            }
        }
    );


    const cancelButton =
        document.getElementById(
            "modal-cancel"
        );


    if (cancelButton) {

        cancelButton.addEventListener(
            "click",
            closeModal
        );
    }
}


/* =========================================================
   NAVIGATION SETUP
========================================================= */

function setupNavigation() {

    document
        .querySelectorAll(
            ".nav-button"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const view =
                        button.dataset.view;


                    if (!view) {
                        return;
                    }


                    showView(
                        view
                    );


                    const sidebar =
                        document.querySelector(
                            ".sidebar"
                        );


                    if (sidebar) {

                        sidebar.classList.remove(
                            "open"
                        );
                    }
                }
            );
        });
}


/* =========================================================
   MOBILE MENU
========================================================= */

function setupMobileMenu() {

    const mobileMenu =
        document.getElementById(
            "mobile-menu"
        );

    const sidebar =
        document.querySelector(
            ".sidebar"
        );


    if (
        !mobileMenu ||
        !sidebar
    ) {

        return;
    }


    mobileMenu.addEventListener(
        "click",
        () => {

            sidebar.classList.toggle(
                "open"
            );
        }
    );
}


/* =========================================================
   INTRO
========================================================= */

function setupIntro() {

    const intro =
        document.getElementById(
            "intro"
        );

    const tagline =
        document.querySelector(
            ".tagline"
        );


    if (!intro) {
        return;
    }


    requestAnimationFrame(
        () => {

            intro.classList.add(
                "loaded"
            );
        }
    );


    function enterApp() {

        if (
            intro.classList.contains(
                "exit"
            )
        ) {

            return;
        }


        markIntroSeen();


        intro.classList.add(
            "exit"
        );


        const app =
            document.getElementById(
                "app"
            );


        if (app) {

            app.classList.add(
                "visible"
            );
        }


        setTimeout(
            () => {

                intro.style.display =
                    "none";

            },
            1300
        );
    }


    if (tagline) {

        tagline.addEventListener(
            "click",
            enterApp
        );
    }


    setTimeout(
        enterApp,
        2500
    );
}


/* =========================================================
   SKIP INTRO (returning visits)
========================================================= */

function skipIntro() {

    const intro =
        document.getElementById(
            "intro"
        );

    const app =
        document.getElementById(
            "app"
        );


    if (intro) {

        intro.style.display =
            "none";
    }


    if (app) {

        app.classList.add(
            "visible"
        );
    }
}


/* =========================================================
   RESTORE LAST VIEW (returning visits)
========================================================= */

function restoreLastView() {

    const uiState =
        loadUIState();

    let view =
        uiState?.view ||
        "crate";


    if (view === "redroom") {

        const song =
            uiState.songId
                ? state.songs.find(
                    song =>
                        song.id ===
                        uiState.songId
                )
                : null;

        if (song) {

            currentSongId =
                song.id;

            currentSectionId =
                song.sections[0]?.id ||
                null;

        } else {

            view = "crate";
        }
    }


    if (view === "folder") {

        const folder =
            uiState.folderId
                ? state.folders.find(
                    folder =>
                        folder.id ===
                        uiState.folderId
                )
                : null;

        if (folder) {

            currentFolderId =
                folder.id;

            const title =
                document.getElementById(
                    "folder-detail-title"
                );

            if (title) {

                title.textContent =
                    folder.name;
            }

        } else {

            view = "crate";
        }
    }


    showView(view);
}


/* =========================================================
   KEYBOARD
========================================================= */

function setupKeyboard() {

    document.addEventListener(
        "keydown",
        event => {


            /* ---------------------------------------------
               CMD / CTRL + K
            --------------------------------------------- */

            if (
                (
                    event.ctrlKey ||
                    event.metaKey
                ) &&
                event.key.toLowerCase() ===
                    "k"
            ) {

                event.preventDefault();

                showView(
                    "search"
                );


                setTimeout(
                    () => {

                        document
                            .getElementById(
                                "search-box"
                            )
                            ?.focus();

                    },
                    100
                );
            }


            /* ---------------------------------------------
               ESCAPE
            --------------------------------------------- */

            if (
                event.key ===
                "Escape"
            ) {

                closeModal();

                closeTools();

                closeTemplateMenu();


                const sidebar =
                    document.querySelector(
                        ".sidebar"
                    );


                if (sidebar) {

                    sidebar.classList.remove(
                        "open"
                    );
                }
            }
        }
    );
}


/* =========================================================
   SETUP LINERS
========================================================= */

function setupLiners() {

    const addButton =
        document.getElementById(
            "add-liner-button"
        );


    const input =
        document.getElementById(
            "liner-input"
        );


    if (addButton) {

        addButton.addEventListener(
            "click",
            addLiner
        );
    }


    if (input) {

        input.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Enter"
                ) {

                    event.preventDefault();

                    addLiner();
                }
            }
        );
    }


    document
        .querySelectorAll(
            ".filter-btn"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    setLinerFilter(
                        button.dataset.filter ||
                        "all",
                        button
                    );
                }
            );
        });
}


/* =========================================================
   SETUP CRATE BUTTONS
========================================================= */

function setupCrate() {

    const folderButton =
        document.getElementById(
            "create-folder-button"
        );


    if (folderButton) {

        folderButton.addEventListener(
            "click",
            createFolder
        );
    }


    const backButton =
        document.getElementById(
            "folder-back-button"
        );


    if (backButton) {

        backButton.addEventListener(
            "click",
            () => {

                currentFolderId =
                    null;

                showView(
                    "crate"
                );
            }
        );
    }
}


/* =========================================================
   SETUP RED ROOM
========================================================= */

function setupRedRoom() {

    const title =
        document.getElementById(
            "song-title"
        );


    const backButton =
        document.getElementById(
            "redroom-back-button"
        );


    if (backButton) {

        backButton.addEventListener(
            "click",
            leaveSong
        );
    }


    if (title) {

        title.addEventListener(
            "input",
            updateSongTitle
        );
    }


    const addSectionButton =
        document.getElementById(
            "add-section-button"
        );


    const newSongButton =
        document.getElementById(
            "new-song-button"
        );


    if (newSongButton) {

        newSongButton.addEventListener(
            "click",
            createSong
        );
    }


    if (addSectionButton) {

        addSectionButton.addEventListener(
            "click",
            () =>
                addSection(
                    "VERSE"
                )
        );
    }


    const templateButton =
        document.getElementById(
            "template-button"
        );


    if (templateButton) {

        templateButton.addEventListener(
            "click",
            openTemplateMenu
        );
    }


    const saveButton =
        document.getElementById(
            "save-song-button"
        );


    if (saveButton) {

        saveButton.addEventListener(
            "click",
            saveSong
        );
    }


    const statusSelection =
        document.getElementById(
            "song-meta-status"
        );


    if (statusSelection) {

        statusSelection.addEventListener(
            "click",
            cycleSongStatus
        );
    }


    document
        .querySelectorAll(
            "#template-menu [data-template]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    applyTemplate(
                        button.dataset.template
                    );
                }
            );
        });
}


/* =========================================================
   SETUP DATABASE CONTROLS
========================================================= */

function setupDatabase() {

    const exportButton =
        document.getElementById(
            "export-button"
        );


    if (exportButton) {

        exportButton.addEventListener(
            "click",
            exportDatabase
        );
    }


    const importButton =
        document.getElementById(
            "import-button"
        );


    const importFile =
        document.getElementById(
            "import-file"
        );


    if (importButton && importFile) {

        importButton.addEventListener(
            "click",
            () => {
                importFile.click();
            }
        );

        importFile.addEventListener(
            "change",
            importDatabase
        );
    }


    const clearButton =
        document.getElementById(
            "clear-button"
        );


    if (clearButton) {

        clearButton.addEventListener(
            "click",
            () => {

                const confirmed =
                    window.confirm(
                        "Clear ALL songs, folders, liners and trash? " +
                        "This cannot be undone. Consider exporting a " +
                        "backup first."
                    );

                if (confirmed) {
                    clearDatabase();
                }
            }
        );
    }
}



/* =========================================================
   SETUP TOOLS
========================================================= */

function setupTools() {

    const toolsButton =
        document.getElementById(
            "tools-button"
        );


    if (toolsButton) {

        toolsButton.addEventListener(
            "click",
            openTools
        );
    }


    const toolsCloseButton =
        document.getElementById(
            "tools-close"
        );


    if (toolsCloseButton) {

        toolsCloseButton.addEventListener(
            "click",
            closeTools
        );
    }


    document
        .querySelectorAll(
            ".tool-tab"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    switchTool(
                        button.dataset.tool,
                        button
                    );
                }
            );
        });


    const rhymeInput =
        document.getElementById(
            "rhyme-input"
        );


    if (rhymeInput) {

        rhymeInput.addEventListener(
            "input",
            () => {

                findRhymes(
                    rhymeInput.value
                );
            }
        );
    }


    document
        .querySelectorAll(
            ".idea-actions button"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    ideaHelp(
                        button.dataset.idea
                    );
                }
            );
        });
}


/* =========================================================
   SETUP SEARCH
========================================================= */

function setupSearch() {

    const input =
        document.getElementById(
            "search-box"
        );


    if (!input) {
        return;
    }


    input.addEventListener(
        "input",
        () => {

            performSearch(
                input.value
            );
        }
    );
}


/* =========================================================
   APP STARTUP
========================================================= */

function initApp() {

    loadState();

    setupNavigation();

    setupModal();

    setupMobileMenu();

    setupKeyboard();


    setupIntro();


    setupLiners();

    setupCrate();

    setupRedRoom();

    setupTools();

    setupDatabase();

    setupSearch();

    renderAll();

    restoreLastView();
}


/* =========================================================
   START
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    initApp
);