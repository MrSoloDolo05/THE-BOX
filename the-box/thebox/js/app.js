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

    try {

        const currentHash =
            typeof location !== "undefined"
                ? String(location.hash || "")
                : "";

        const desiredHash =
            "#view=" + view;

        if (currentHash !== desiredHash) {

            if (typeof history !== "undefined" &&
                typeof history.replaceState === "function") {

                history.replaceState(
                    {},
                    "",
                    desiredHash
                );
            }
        }

    } catch (error) {

        /* History/URL access may be restricted in some
           environments (for example, file:// or sandboxed
           iframes). In that case we still keep the in-memory
           and localStorage state. */
    }
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

    /* Lock background scroll while the modal is up. */
    refreshScrollLock();


    /* Focus the first usable control so keyboard users (and
       Enter key handling) have a predictable starting point. */
    setTimeout(() => {

        const first =
            modal.querySelector(
                "input:not([type=\"file\"]):not([type=\"hidden\"]), textarea, select"
            );

        if (first) {
            try {
                first.focus();
            } catch (error) {
                /* Focus may fail on hidden/disabled elements. */
            }
        }
    }, 10);
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

    refreshScrollLock();


    modalConfirm.clear();
}


/* =========================================================
   MODAL SETUP
========================================================= */

function setupModal() {

    const overlay =
        document.getElementById(
            "modal-overlay"
        );


    const cancelButton =
        document.getElementById(
            "modal-cancel"
        );


    const confirmButton =
        document.getElementById(
            "modal-confirm"
        );


    if (overlay) {

        /* Dismiss sharing modals via Cancel. */
        if (cancelButton) {

            cancelButton.addEventListener(
                "click",
                closeModal
            );
        }


        /* Global Enter support for modal text inputs: if a
           modal confirm handler is registered, Enter on text
           inputs triggers it. This fixes name popups and other
           simple create/edit modals without requiring each
           modal function to bind its own keydown listener. */
        overlay.addEventListener(
            "keydown",
            (event) => {

                if (event.key !== "Enter") {
                    return;
                }

                const target =
                    event.target;

                const isTextInput =
                    target &&
                    /^(input|textarea|select)$/i.test(target.tagName) &&
                    target.type !== "file" &&
                    target.type !== "hidden";

                if (!isTextInput) {
                    return;
                }

                if (event.shiftKey) {
                    return;
                }

                event.preventDefault();

                /* Let a registered confirm handler decide
                   whether the action should actually run. */
                if (typeof modalConfirm._handler === "function") {

                    modalConfirm._handler(event);
                }
            }
        );
    }


    if (confirmButton) {

        confirmButton.addEventListener(
            "click",
            () => {

                if (typeof modalConfirm._handler === "function") {

                    modalConfirm._handler();
                }
            }
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


                    /* Dismiss the mobile drawer after nav. */
                    if (typeof closeMobileSidebar === "function") {

                        closeMobileSidebar();
                    }
                }
            );
        });
}


/* =========================================================
   MOBILE SIDEBAR (drawer)
========================================================= */

function getSidebar() {

    return document.querySelector(
        ".sidebar"
    );
}


function getSidebarBackdrop() {

    return document.getElementById(
        "sidebar-backdrop"
    );
}


function isSidebarOpen() {

    const sidebar =
        getSidebar();

    return !!sidebar &&
        sidebar.classList.contains(
            "open"
        );
}


/* Recompute background scroll-lock from whatever overlay is
   actually showing (drawer, backdrop, tools, modal). */
function refreshScrollLock() {

    const overlayActive =
        document
            .getElementById("modal-overlay")
            ?.classList
            .contains("open") ||

        document
            .getElementById("sidebar-backdrop")
            ?.classList
            .contains("show") ||

        document
            .getElementById("tools")
            ?.classList
            .contains("open");

    if (overlayActive) {

        document.body.classList.add(
            "locked"
        );
    } else {

        document.body.classList.remove(
            "locked"
        );
    }
}


function openMobileSidebar() {

    const sidebar =
        getSidebar();

    if (!sidebar) {
        return;
    }

    const wasOpen =
        sidebar.classList.contains("open");

    sidebar.classList.add(
        "open"
    );

    const backdrop =
        getSidebarBackdrop();

    if (backdrop) {

        backdrop.classList.add(
            "show"
        );

        backdrop.setAttribute(
            "aria-hidden",
            "false"
        );

        /* Block pointer interactions on the underlying page
           even before the CSS transition completes in some
           browsers. The mobile media query already adds
           `position: fixed` to `.locked`, so this is
           strictly an accessibility/click-safety net. */
        backdrop.style.pointerEvents = "auto";
    }

    /* Lock background scroll behind the drawer. */
    refreshScrollLock();

    /* Push a history entry so the native browser / Android
       back gesture dismisses the drawer instead of leaving
       the page (popped by the popstate handler below). */
    if (!wasOpen) {

        try {

            history.pushState(
                { sidebar: true },
                ""
            );
        } catch (error) {
            /* History unavailable (file:// etc.): ignore. */
        }
    }
}


function closeMobileSidebar() {

    const sidebar =
        getSidebar();

    if (sidebar) {

        sidebar.classList.remove(
            "open"
        );
    }

    const backdrop =
        getSidebarBackdrop();

    if (backdrop) {

        backdrop.classList.remove(
            "show"
        );

        backdrop.setAttribute(
            "aria-hidden",
            "true"
        );
    }

    refreshScrollLock();
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
        getSidebar();

    const closeButton =
        document.getElementById(
            "sidebar-close"
        );

    const backdrop =
        getSidebarBackdrop();


    if (
        !mobileMenu ||
        !sidebar
    ) {

        return;
    }


    mobileMenu.addEventListener(
        "click",
        () => {

            if (isSidebarOpen()) {

                closeMobileSidebar();
            } else {

                openMobileSidebar();
            }
        }
    );


    if (closeButton) {

        closeButton.addEventListener(
            "click",
            closeMobileSidebar
        );
    }


    if (backdrop) {

        backdrop.addEventListener(
            "click",
            closeMobileSidebar
        );
    }


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape" &&
                isSidebarOpen()
            ) {

                closeMobileSidebar();
            }
        }
    );


    /* Native back gesture / browser back button: pop the
       history entry we pushed and dismiss the drawer. */
    window.addEventListener(
        "popstate",
        () => {

            if (isSidebarOpen()) {

                closeMobileSidebar();
            }
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


    /* The intro should render and animate on both desktop and
       mobile. Do not skip it based on screen size, platform, or
       media queries that were only intended to tweak positioning. */
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


        currentFolderId = null;

        /* Clear the folder open highlight without changing
           navigation behavior. */
        document
            .querySelectorAll(".folder.is-open")
            .forEach(element => {

                element.classList.remove(
                    "is-open"
                );
            });

        showView("crate");


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


    /* Allow the auth button (when visible) to enter the app as
       well, so the first interaction is consistent across
       desktop and mobile. */
    const authButton =
        document.getElementById(
            "auth-button"
        );

    if (authButton) {

        authButton.addEventListener(
            "click",
            (event) => {

                /* If Firebase sign-in is in progress, let that
                   continue; otherwise enter the app immediately
                   so the intro doesn't block the workspace. */
                if (
                    !authButton.classList.contains(
                        "signed-in"
                    )
                ) {

                    /* Only prevent default if we genuinely want
                       to skip the intro; otherwise allow normal
                       auth flow. */
                }

                enterApp();
            }
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


    /* URL hash can override saved UI state so that a shared or
       bookmarked link lands on the intended page even if the
       stored UI state is stale. */
    const hash =
        typeof location !== "undefined"
            ? String(location.hash || "").trim()
            : "";

    if (hash.startsWith("#view=")) {

        const candidate =
            hash.slice("#view=".length).split("/")[0];

        if (candidate) {
            view = candidate;
        }
    }


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


    const verseAddButton =
        document.getElementById(
            "add-verse-button"
        );

    const verseInput =
        document.getElementById(
            "verse-input"
        );


    if (verseAddButton) {

        verseAddButton.addEventListener(
            "click",
            addVerse
        );
    }


    if (verseInput) {

        verseInput.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter" &&
                    (
                        event.ctrlKey ||
                        event.metaKey
                    )
                ) {

                    event.preventDefault();

                    addVerse();
                }
            }
        );
    }


    document
        .querySelectorAll(
            ".liner-tab"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    setLinerView(
                        button.dataset.linerview ||
                        "lines",
                        button
                    );
                }
            );
        });


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


    /* -------------------------------------------------
       LINER LIST DELEGATION
    -------------------------------------------------- */

    ["liner-list", "verse-list"].forEach(id => {

        const list =
            document.getElementById(id);

        if (!list) {
            return;
        }

        const isLines =
            id === "liner-list";

        delegateClick(
            list,
            '[data-action="insert-item"]',
            (event, el) => {

                const itemId =
                    el.closest(".liner")
                        .dataset.itemId;

                if (isLines) {

                    insertLiner(itemId);

                } else {

                    insertVerse(itemId);
                }
            }
        );

        delegateClick(
            list,
            '[data-action="edit-item"]',
            (event, el) => {

                const itemId =
                    el.closest(".liner")
                        .dataset.itemId;

                if (isLines) {

                    editLiner(itemId);

                } else {

                    editVerse(itemId);
                }
            }
        );

        delegateClick(
            list,
            '[data-action="delete-item"]',
            (event, el) => {

                const itemId =
                    el.closest(".liner")
                        .dataset.itemId;

                if (isLines) {

                    deleteLiner(itemId);

                } else {

                    deleteVerse(itemId);
                }
            }
        );
    });


    /* -------------------------------------------------
       PICKER DELEGATION (inside the shared modal)
    -------------------------------------------------- */

    const modalBody =
        document.getElementById(
            "modal-body"
        );

    if (modalBody) {

        delegateClick(
            modalBody,
            ".picker-tab",
            (event, el) => {

                setPickerView(
                    el.dataset.pickerView || "lines",
                    el
                );
            }
        );

        delegateClick(
            modalBody,
            ".picker-item",
            (event, el) => {

                const itemId =
                    el.dataset.itemId;

                if (pickerView === "verses") {

                    insertVerse(itemId);

                } else {

                    insertLiner(itemId);
                }
            }
        );
    }
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


    const newSongButton =
        document.getElementById(
            "create-song-button"
        );


    if (newSongButton) {

        newSongButton.addEventListener(
            "click",
            () => {

                /* The NEW SONG button must always create a genuinely
                   new song. Generic RED ROOM navigation may reuse the
                   current or most recent song, but this explicit
                   button must not. */
                createSong();
            }
        );
    }


    /* -------------------------------------------------
       CRATE DELEGATION
       (folder grid, song lists, trash, move-song modal)
    -------------------------------------------------- */

    const folderGrid =
        document.getElementById(
            "folder-grid"
        );

    if (folderGrid) {

        delegateClick(
            folderGrid,
            ".folder",
            (event, el) => {

                if (
                    event.target.closest(
                        ".folder-actions"
                    )
                ) {
                    return;
                }

                openFolder(
                    el.dataset.folderId
                );
            }
        );

        delegateClick(
            folderGrid,
            '[data-action="rename-folder"]',
            (event, el) => {

                renameFolder(
                    el.closest(".folder")
                        .dataset.folderId
                );
            }
        );

        delegateClick(
            folderGrid,
            '[data-action="delete-folder"]',
            (event, el) => {

                deleteFolder(
                    el.closest(".folder")
                        .dataset.folderId
                );
            }
        );
    }


    ["song-list", "folder-song-list"].forEach(id => {

        const songList =
            document.getElementById(id);

        if (!songList) {
            return;
        }

        delegateClick(
            songList,
            ".song-row",
            (event, el) => {

                if (
                    event.target.closest(
                        ".song-actions"
                    )
                ) {
                    return;
                }

                openSong(
                    el.dataset.songId
                );
            }
        );

        delegateClick(
            songList,
            '[data-action="move-song"]',
            (event, el) => {

                openMoveSongModal(
                    el.closest(".song-row")
                        .dataset.songId
                );
            }
        );

        delegateClick(
            songList,
            '[data-action="duplicate-song"]',
            (event, el) => {

                duplicateSong(
                    el.closest(".song-row")
                        .dataset.songId
                );
            }
        );

        delegateClick(
            songList,
            '[data-action="delete-song"]',
            (event, el) => {

                deleteSong(
                    el.closest(".song-row")
                        .dataset.songId
                );
            }
        );

        songList.addEventListener(
            "dragstart",
            event => {

                const el =
                    event.target.closest(
                        ".song-row"
                    );

                if (el && songList.contains(el)) {

                    songDragStart(
                        event,
                        el.dataset.songId,
                        el
                    );
                }
            }
        );

        songList.addEventListener(
            "dragend",
            event => {

                const el =
                    event.target.closest(
                        ".song-row"
                    );

                if (el && songList.contains(el)) {

                    songDragEnd();
                }
            }
        );
    });


    const trashList =
        document.getElementById(
            "trash-list"
        );

    if (trashList) {

        delegateClick(
            trashList,
            '[data-action="restore-trash"]',
            (event, el) => {

                restoreTrash(
                    el.dataset.trashId
                );
            }
        );

        delegateClick(
            trashList,
            '[data-action="permanent-delete"]',
            (event, el) => {

                permanentlyDelete(
                    el.dataset.trashId
                );
            }
        );
    }


    const modalBody =
        document.getElementById(
            "modal-body"
        );

    if (modalBody) {

        delegateClick(
            modalBody,
            ".move-to-folder-option",
            (event, el) => {

                moveSongToFolder(
                    el.dataset.songId,
                    el.dataset.folderId
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
            "focus",
            () => {

                if (typeof beginLiveEdit === "function") {
                    beginLiveEdit();
                }
            }
        );

        title.addEventListener(
            "input",
            updateSongTitle
        );

        title.addEventListener(
            "blur",
            () => {

                if (typeof endLiveEdit === "function") {
                    endLiveEdit();
                }
            }
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


    /* -------------------------------------------------
       RED ROOM SECTION DELEGATION
    -------------------------------------------------- */

    const sectionsContainer =
        document.getElementById(
            "song-sections"
        );

    if (sectionsContainer) {

        /* Focusin/focusout bubble, unlike focus/blur, so one pair
           covers all current and future section editors. */
        sectionsContainer.addEventListener(
            "focusin",
            event => {

                const editor =
                    event.target.closest(
                        ".lyrics-editor, .section-type"
                    );

                if (
                    editor &&
                    sectionsContainer.contains(editor) &&
                    typeof beginLiveEdit === "function"
                ) {

                    beginLiveEdit();
                }
            }
        );

        sectionsContainer.addEventListener(
            "focusout",
            event => {

                const next =
                    event.relatedTarget;

                /* Moving between two section editors is still live
                   editing; only leaving the container ends it. */
                if (
                    next &&
                    next.closest &&
                    next.closest(".lyrics-editor, .section-type") &&
                    sectionsContainer.contains(next)
                ) {

                    return;
                }

                if (typeof endLiveEdit === "function") {
                    endLiveEdit();
                }
            }
        );

        delegateChange(
            sectionsContainer,
            ".section-type",
            (event, el) => {

                renameSection(
                    el.dataset.sectionId,
                    el.value
                );
            }
        );

        /* Card click selects a section, but no inner editing or
           management control may bubble into selection. */
        sectionsContainer.addEventListener(
            "click",
            event => {

                const card =
                    event.target.closest(
                        ".song-section"
                    );

                if (
                    !card ||
                    !sectionsContainer.contains(
                        card
                    )
                ) {

                    return;
                }

                if (
                    event.target.closest(
                        "button, input, textarea, select, a, [data-no-select]"
                    )
                ) {

                    return;
                }

                setCurrentSection(
                    card.dataset.sectionId
                );
            }
        );

        sectionsContainer.addEventListener(
            "keydown",
            event => {

                if (
                    event.key !== "Enter" &&
                    event.key !== " "
                ) {

                    return;
                }

                const card =
                    event.target.closest(
                        ".song-section"
                    );

                if (
                    !card ||
                    event.target !== card ||
                    !sectionsContainer.contains(
                        card
                    )
                ) {

                    return;
                }

                event.preventDefault();

                setCurrentSection(
                    card.dataset.sectionId
                );
            }
        );

        delegateClick(
            sectionsContainer,
            '[data-action="open-picker"]',
            (event, el) => {

                openLinerPickerForSection(
                    el.closest(".song-section")
                        .dataset.sectionId
                );
            }
        );

        delegateClick(
            sectionsContainer,
            '[data-action="move-section-up"]',
            (event, el) => {

                moveSection(
                    el.closest(".song-section")
                        .dataset.sectionId,
                    -1
                );
            }
        );

        delegateClick(
            sectionsContainer,
            '[data-action="move-section-down"]',
            (event, el) => {

                moveSection(
                    el.closest(".song-section")
                        .dataset.sectionId,
                    1
                );
            }
        );

        delegateClick(
            sectionsContainer,
            '[data-action="delete-section"]',
            (event, el) => {

                deleteSection(
                    el.closest(".song-section")
                        .dataset.sectionId
                );
            }
        );

        sectionsContainer.addEventListener(
            "input",
            event => {

                const el =
                    event.target.closest(
                        ".lyrics-editor"
                    );

                if (el && sectionsContainer.contains(el)) {

                    updateSectionLyrics(
                        el.dataset.sectionId,
                        el.value
                    );
                }
            }
        );

        sectionsContainer.addEventListener(
            "focusin",
            event => {

                const el =
                    event.target.closest(
                        ".lyrics-editor"
                    );

                if (el && sectionsContainer.contains(el)) {

                    setCurrentSection(
                        el.dataset.sectionId
                    );
                }
            }
        );

        sectionsContainer.addEventListener(
            "focusout",
            event => {

                const el =
                    event.target.closest(
                        ".lyrics-editor"
                    );

                if (el && sectionsContainer.contains(el)) {

                    flushLyricsSave();
                }
            }
        );
    }
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


    const emptyTrashButton =
        document.getElementById(
            "empty-trash-button"
        );


    if (emptyTrashButton) {

        emptyTrashButton.addEventListener(
            "click",
            () => {

                if (!state.trash.length) {
                    return;
                }

                const confirmed =
                    window.confirm(
                        "Permanently delete everything in the trash? " +
                        "This cannot be undone."
                    );

                if (confirmed) {
                    emptyTrash();
                }
            }
        );
    }


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


    /* -------------------------------------------------
       TOOLS DELEGATION
       (rhyme words, idea retry, search results)
    -------------------------------------------------- */

    const rhymeResults =
        document.getElementById(
            "rhyme-results"
        );

    if (rhymeResults) {

        delegateClick(
            rhymeResults,
            ".rhyme-word",
            (event, el) => {

                insertRhyme(
                    el.dataset.rhymeWord
                );
            }
        );
    }


    const ideaOutput =
        document.getElementById(
            "idea-output"
        );

    if (ideaOutput) {

        delegateClick(
            ideaOutput,
            ".idea-again",
            (event, el) => {

                ideaHelp(
                    el.dataset.ideaType
                );
            }
        );
    }


    const searchResults =
        document.getElementById(
            "search-results"
        );

    if (searchResults) {

        delegateClick(
            searchResults,
            ".search-result",
            (event, el) => {

                searchResultClick(
                    Number(
                        el.dataset.index
                    )
                );
            }
        );
    }
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


    /* Intro animation must play on both desktop and mobile.
       Do not bypass it based on platform or screen size. */
    setupIntro();


    setupLiners();

    setupCrate();

    setupRedRoom();

    setupTools();

    setupDatabase();

    setupSearch();

    setupImport();

    renderAll();

    restoreLastView();

    saveUIState();


    /* ---- Firebase sync ---- */
    initFirebase();
    initAuth();
}


/* =========================================================
   AUTH BUTTON HANDLER
========================================================= */

function handleAuthClick() {
    const button =
        document.getElementById("auth-button");

    if (!button) return;

    if (isSignedIn()) {
        signOut();
        button.textContent = "SIGN IN WITH GOOGLE";
        button.classList.remove("signed-in");
    } else {
        button.textContent = "SIGNING IN…";
        signInWithGoogle()
            .then((user) => {
                if (user) {
                    button.textContent = "SIGN OUT";
                    button.classList.add("signed-in");
                }
            })
            .catch(() => {
                button.textContent = "SIGN IN WITH GOOGLE";
            });
    }
}


/* =========================================================
   START
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    initApp
);
