/* =========================================================
   RED ROOM / SONG EDITOR
========================================================= */


/* =========================================================
   GET CURRENT SONG
========================================================= */

function getCurrentSong() {

    if (!currentSongId) {
        return null;
    }

    return state.songs.find(
        song =>
            song.id === currentSongId
    ) || null;
}


/* Live-edit protection: while the writer is focused in the Red
   Room, background sync may merge state but must not rebuild the
   active editor DOM node. Blur flushes any pending debounced
   save and reconciles a deferred render safely. */
function beginLiveEdit() {

    if (typeof setLiveEdit === "function") {
        setLiveEdit(true);
    }
}

function endLiveEdit() {

    if (typeof flushLyricsSave === "function") {
        flushLyricsSave();
    }

    if (typeof flushTitleSave === "function") {
        flushTitleSave();
    }

    if (typeof setLiveEdit === "function") {
        setLiveEdit(false);
    }

    if (typeof consumeRenderDeferred === "function") {
        const deferred =
            consumeRenderDeferred();

        if (
            deferred &&
            typeof renderRedRoomSafe === "function"
        ) {

            renderRedRoomSafe();
        }
    }
}

function isRedRoomEditorFocused() {

    const active =
        document.activeElement;

    if (!active) {
        return false;
    }

    return Boolean(
        active.closest &&
        active.closest("#song-sections, #song-title")
    );
}

/* The id of the song the Red Room DOM currently reflects. Opening a
   different song must always rebuild, even when a stale focus is
   still sitting in an editor. */
let renderedSongId = null;

function renderRedRoomSafe(force) {

    const song =
        getCurrentSong();

    /* Defer only while the writer is still in the SAME song; the
       merge already updated state and the visual reconciliation
       waits for blur. A different song (or an explicit force) always
       rebuilds, so an explicit song selection can never be swallowed
       by the focus guard. Explicit structural actions (add / move /
       delete / template) pass force=true so they always paint. */
    const sameSong =
        Boolean(song) &&
        song.id === renderedSongId;

    if (
        !force &&
        sameSong &&
        isRedRoomEditorFocused()
    ) {

        if (typeof markRenderDeferred === "function") {
            markRenderDeferred();
        }

        return;
    }

    renderRedRoomContent(force);
}


/* =========================================================
   TOUCH SONG
========================================================= */

function touchSong(song) {

    if (!song) {
        song = getCurrentSong();
    }

    if (!song) {
        return;
    }

    song.modified =
        new Date().toISOString();
}


/* =========================================================
   RENDER RED ROOM
========================================================= */

function renderRedRoomContent(force) {

    const song =
        getCurrentSong();

    if (!song) {
        return;
    }


    const titleInput =
        document.getElementById(
            "song-title"
        );

    const date =
        document.getElementById(
            "song-meta-date"
        );

    const status =
        document.getElementById(
            "song-meta-status"
        );


    if (titleInput) {

        /* Never overwrite the title while it has focus: state
           already holds the in-progress keystrokes. Empty title
           stays empty; the placeholder shows "UNTITLED". This
           holds even for forced structural renders. */
        if (document.activeElement !== titleInput) {

            const next =
                song.title || "";

            if (titleInput.value !== next) {
                titleInput.value = next;
            }
        }
    }


    if (date) {

        date.textContent =
            "CREATED " +
            formatDate(
                song.created
            );
    }


    if (status) {

        status.textContent =
            (
                song.status ||
                "DRAFT"
            ).toUpperCase();
    }


    renderedSongId =
        song.id;


    renderSections(force);
}


/* =========================================================
   RENDER SECTIONS
========================================================= */

function renderSections(force) {

    /* Background renders defer while the writer is focused so the
       active textarea is never torn down mid-keystroke. Explicit
       structural actions pass force=true: pending edits are flushed
       by the caller first, then the list always rebuilds. */
    if (
        !force &&
        isRedRoomEditorFocused()
    ) {

        const focusedSong =
            getCurrentSong();

        if (focusedSong && Array.isArray(focusedSong.sections)) {
            focusedSong.sections.forEach(section => {
                refreshSectionCard(section.id);
            });
        }

        if (typeof markRenderDeferred === "function") {
            markRenderDeferred();
        }

        return;
    }

    const song =
        getCurrentSong();

    const container =
        document.getElementById(
            "song-sections"
        );


    if (!song || !container) {
        return;
    }


    if (!Array.isArray(song.sections)) {
        song.sections = [];
    }


    if (!song.sections.length) {

        container.innerHTML = `
            <div class="empty-state">
                NO SECTIONS YET.<br>
                ADD ONE BELOW.
            </div>
        `;

        return;
    }


    container.innerHTML =
        song.sections
            .map(
                (section, index) => {

                    const label =
                        sectionDisplayLabel(
                            song,
                            section
                        );

                    const labelId =
                        `section-label-${section.id}`;

                    const editorId =
                        `section-editor-${section.id}`;

                    const menuId =
                        `section-menu-${section.id}`;

                    const isActive =
                        section.id ===
                        currentSectionId;

                    const upDisabled =
                        index === 0
                            ? "disabled"
                            : "";

                    const downDisabled =
                        index === song.sections.length - 1
                            ? "disabled"
                            : "";


                    return `
                        <div
                            class="song-section ${
                                isActive
                                    ? "active-section"
                                    : ""
                            }"
                            data-section-id="${section.id}"
                        >

                            <div class="section-bar">

                                <label
                                    class="visually-hidden"
                                    for="${labelId}"
                                >
                                    Section label
                                </label>

                                <input
                                    id="${labelId}"
                                    class="section-name"
                                    type="text"
                                    data-section-id="${section.id}"
                                    data-section-name
                                    value="${escapeAttribute(
                                        label
                                    )}"
                                    autocomplete="off"
                                    spellcheck="false"
                                >

                                <div class="section-tools">

                                    <div class="section-kebab">

                                        <button
                                            type="button"
                                            class="section-kebab-btn"
                                            data-action="section-menu"
                                            aria-haspopup="menu"
                                            aria-expanded="false"
                                        >
                                            •••
                                        </button>

                                        <div
                                            id="${menuId}"
                                            class="section-menu"
                                            role="menu"
                                            aria-label="Section actions"
                                        >

                                            <button
                                                type="button"
                                                data-action="focus-section-name"
                                                role="menuitem"
                                            >
                                                RENAME
                                            </button>

                                            <button
                                                type="button"
                                                data-action="cycle-section-type"
                                                role="menuitem"
                                            >
                                                CHANGE TYPE
                                            </button>

                                            <button
                                                type="button"
                                                data-action="move-section-up"
                                                role="menuitem"
                                                ${upDisabled}
                                            >
                                                MOVE UP
                                            </button>

                                            <button
                                                type="button"
                                                data-action="move-section-down"
                                                role="menuitem"
                                                ${downDisabled}
                                            >
                                                MOVE DOWN
                                            </button>

                                            <button
                                                type="button"
                                                data-action="duplicate-section"
                                                role="menuitem"
                                            >
                                                DUPLICATE
                                            </button>

                                            <button
                                                type="button"
                                                class="danger"
                                                data-action="delete-section"
                                                role="menuitem"
                                            >
                                                DELETE
                                            </button>

                                        </div>

                                    </div>

                                </div>

                            </div>


                            <label
                                class="visually-hidden"
                                for="${editorId}"
                            >
                                Lyrics
                            </label>

                            <textarea
                                id="${editorId}"
                                class="section-editor"
                                data-editor="${section.id}"
                                data-section-id="${section.id}"
                                placeholder="Write here..."
                                rows="6"
                            >${escapeHTML(
                                section.lyrics
                            )}</textarea>

                        </div>
                    `;
                }
            )
            .join("");
}


/* =========================================================
   SURGICAL SECTION REFRESH
   Rebuilds one section card's chrome (type input value, active
   highlight) WITHOUT replacing the focused editor node or
   resetting its in-progress value. Used after local edits and
   remote merges while the writer may be typing.
   ========================================================= */

function refreshSectionCard(sectionId) {

    const song =
        getCurrentSong();

    const container =
        document.getElementById(
            "song-sections"
        );

    if (!song || !container) {
        return;
    }

    const section =
        song.sections.find(
            item =>
                item.id ===
                sectionId
        );

    const card =
        container.querySelector(
            `[data-section-id="${sectionId}"]`
        );

    if (!section || !card) {
        return;
    }

    card.classList.toggle(
        "active-section",
        section.id ===
        currentSectionId
    );

    const nameInput =
        card.querySelector(
            "[data-section-name]"
        );

    /* Never overwrite the label input while it has focus: state
       already holds the in-progress keystrokes. */
    if (
        nameInput &&
        document.activeElement !== nameInput
    ) {

        const next =
            sectionDisplayLabel(
                song,
                section
            );

        if (nameInput.value !== next) {
            nameInput.value = next;
        }
    }

    const editor =
        card.querySelector(
            ".section-editor"
        );

    /* Never overwrite the focused textarea. State already holds
       the local keystrokes; remote text applies on blur render. */
    if (
        editor &&
        document.activeElement !== editor
    ) {

        const next =
            section.lyrics || "";

        if (editor.value !== next) {
            editor.value = next;
        }
    }
}


/* =========================================================
   SET CURRENT SECTION
========================================================= */

function setCurrentSection(id) {

    const song =
        getCurrentSong();

    if (!song) {
        return;
    }


    const section =
        song.sections.find(
            section =>
                section.id === id
        );


    if (!section) {
        return;
    }


    currentSectionId = id;


    /*
       Don't call renderSections() here: this fires on the
       textarea's own focus event, and a full re-render
       replaces that textarea's DOM node with a fresh,
       unfocused one, so keystrokes go nowhere. Just move
       the highlight instead.
    */

    document
        .querySelectorAll(
            ".song-section"
        )
        .forEach(element => {

            element.classList.toggle(
                "active-section",
                element.dataset.sectionId ===
                    id
            );
        });
}


/* =========================================================
   OPEN LINER PICKER FOR SPECIFIC SECTION
========================================================= */

function openLinerPickerForSection(
    sectionId
) {

    currentSectionId =
        sectionId;

    openLinerPicker();
}


/* =========================================================
   UPDATE SECTION LYRICS
========================================================= */

function updateSectionLyrics(
    sectionId,
    value
) {

    const song =
        getCurrentSong();

    if (!song) {
        return;
    }


    const section =
        song.sections.find(
            section =>
                section.id ===
                sectionId
        );


    if (!section) {
        return;
    }


    section.lyrics =
        value;


    beginLiveEdit();

    currentSectionId =
        sectionId;

    refreshSectionCard(sectionId);


    touchSong(song);


    /* Debounce: wait for the writer to pause before
       writing to localStorage, so we don't serialize
       the whole state on every single keystroke. */
    clearTimeout(lyricsSaveTimer);

    lyricsSaveTimer =
        setTimeout(
            () => {
                saveState();
            },
            400
        );
}


function flushLyricsSave() {

    if (lyricsSaveTimer) {

        clearTimeout(lyricsSaveTimer);

        lyricsSaveTimer = null;

        saveState();
    }
}


/* =========================================================
   RENAME SECTION
========================================================= */

function renameSection(
    sectionId,
    value
) {

    commitSectionName(
        sectionId,
        value
    );
}

/* Direct label editing: the visible text is a custom display
   name layered over the structural type. Typing never destroys
   the type, and clearing falls back to TYPE + number. */
function commitSectionName(
    sectionId,
    value
) {

    const song =
        getCurrentSong();

    if (!song) {
        return;
    }


    const section =
        song.sections.find(
            section =>
                section.id ===
                sectionId
        );


    if (!section) {
        return;
    }


    const clean =
        String(value || "")
            .trim();


    section.name =
        clean;


    touchSong(song);

    beginLiveEdit();

    saveState();
}


/* =========================================================
   ADD SECTION
========================================================= */

function flushRedRoomEdits() {

    if (typeof flushLyricsSave === "function") {
        flushLyricsSave();
    }

    if (typeof flushTitleSave === "function") {
        flushTitleSave();
    }
}

function structuralRender() {

    if (typeof consumeRenderDeferred === "function") {
        consumeRenderDeferred();
    }

    renderRedRoomSafe(true);
}

/* Last deleted section, kept briefly so Delete can offer UNDO.
   Restores content, type, label and position on demand. */
let lastDeletedSection = null;
let lastDeletedSectionTimer = null;

function clearDeletedSectionMemory() {

    lastDeletedSection = null;

    if (lastDeletedSectionTimer) {

        clearTimeout(
            lastDeletedSectionTimer
        );

        lastDeletedSectionTimer = null;
    }
}

function rememberDeletedSection(
    songId,
    section,
    index
) {

    clearDeletedSectionMemory();

    lastDeletedSection = {
        songId,
        section,
        index
    };

    lastDeletedSectionTimer =
        setTimeout(
            clearDeletedSectionMemory,
            30000
        );
}

/* Per-type numbering: VERSE 01 / VERSE 02 / CHORUS 01, derived
   from position among same-type sections so reorder stays sane. */
function sectionDisplayNumber(
    song,
    section
) {

    const sameType =
        (song.sections || []).filter(
            item =>
                (
                    item.type ||
                    "SECTION"
                ).toUpperCase() ===
                (
                    section.type ||
                    "SECTION"
                ).toUpperCase()
        );

    const position =
        sameType.findIndex(
            item =>
                item.id === section.id
        );

    return String(
        (position === -1 ? sameType.length : position) + 1
    ).padStart(2, "0");
}

function sectionDisplayLabel(
    song,
    section
) {

    /* A custom label always wins; otherwise show TYPE + number. */
    if (
        section.name &&
        String(section.name).trim()
    ) {
        return String(section.name).trim();
    }

    return `${(section.type || "SECTION").toUpperCase()} ${
        sectionDisplayNumber(song, section)
    }`;
}

function isSongStarted(song) {

    if (!song || !Array.isArray(song.sections)) {
        return true;
    }

    /* More than the single starter card counts as manual work. */
    if (song.sections.length > 1) {
        return true;
    }

    const first = song.sections[0];

    if (!first) {
        return true;
    }

    return Boolean(
        String(first.lyrics || "").trim()
    );
}

function isFreshSong(song) {

    if (!song || !Array.isArray(song.sections)) {
        return false;
    }

    if (
        song.sections.length !== 1 ||
        isSongStarted(song)
    ) {
        return false;
    }

    return (
        (song.sections[0].type || "VERSE").toUpperCase() ===
        "VERSE"
    );
}

function addSection(
    type = "VERSE",
    options = {}
) {

    const song =
        getCurrentSong();

    if (!song) {
        return null;
    }


    /* Capture pending keystrokes into state before rebuilding so
       the forced render never drops in-flight typing. */
    if (!options.silent) {
        flushRedRoomEdits();
    }


    const canonical =
        String(type || "VERSE")
            .trim()
            .toUpperCase() ||
        "VERSE";

    const customName =
        options.name
            ? String(options.name).trim()
            : "";

    const section = {

        id:
            generateId(),

        type: canonical,

        name: customName,

        lyrics:
            options.lyrics || ""
    };


    song.sections.push(
        section
    );


    currentSectionId =
        section.id;


    touchSong(song);

    saveState();

    if (!options.deferRender) {
        structuralRender();
    }

    closeTemplateMenu();


    if (!options.deferFocus) {

        const focusId = section.id;

        requestAnimationFrame(() => {

            const editor =
                document.querySelector(
                    `[data-editor="${focusId}"]`
                );

            if (editor) {
                editor.focus();
            }
        });
    }

    return section;
}


/* =========================================================
   DELETE SECTION
========================================================= */

function deleteSection(id) {

    /* Explicit user action: flush first, then mutate and force the
       render. The old focus-guard early return meant clicking delete
       while typing silently did nothing. */
    flushRedRoomEdits();


    const song =
        getCurrentSong();

    if (!song) {
        return;
    }


    const index =
        song.sections.findIndex(
            section =>
                section.id === id
        );


    if (index === -1) {
        return;
    }


    const section =
        song.sections[index];


    song.sections.splice(
        index,
        1
    );


    rememberDeletedSection(
        song.id,
        section,
        index
    );


    if (
        currentSectionId === id
    ) {

        currentSectionId =
            song.sections[
                Math.max(
                    0,
                    index - 1
                )
            ]?.id || null;
    }


    touchSong(song);

    saveState();

    structuralRender();

    showSectionUndo();
}


/* =========================================================
   MOVE SECTION (up / down)
========================================================= */

function moveSection(id, delta) {

    /* Same explicit-action rule as delete: flush, mutate, force. */
    flushRedRoomEdits();

    const song =
        getCurrentSong();

    if (!song) {
        return;
    }


    const sections =
        song.sections;

    const index =
        sections.findIndex(
            section =>
                section.id === id
        );

    if (index === -1) {
        return;
    }


    const target =
        index + delta;

    if (
        target < 0 ||
        target >= sections.length
    ) {
        return;
    }


    const temp =
        sections[index];

    sections[index] =
        sections[target];

    sections[target] =
        temp;


    touchSong(song);

    saveState();

    structuralRender();
}


/* =========================================================
   DUPLICATE / RENAME / RETYPE / UNDO
========================================================= */

function duplicateSection(id) {

    flushRedRoomEdits();

    const song =
        getCurrentSong();

    if (!song) {
        return null;
    }

    const index =
        song.sections.findIndex(
            section =>
                section.id === id
        );

    if (index === -1) {
        return null;
    }

    const source =
        song.sections[index];

    const copy = {

        id: generateId(),

        type:
            (source.type || "SECTION").toUpperCase(),

        name: source.name || "",

        lyrics: source.lyrics || ""
    };

    song.sections.splice(
        index + 1,
        0,
        copy
    );

    currentSectionId =
        copy.id;

    touchSong(song);

    saveState();

    structuralRender();

    return copy;
}

function retitleSection(
    sectionId,
    value
) {

    const song =
        getCurrentSong();

    if (!song) {
        return;
    }

    const section =
        song.sections.find(
            section =>
                section.id ===
                sectionId
        );

    if (!section) {
        return;
    }

    const clean =
        String(value || "").trim();

    /* Empty label clears the custom name and falls back to the
       automatic TYPE + number display. */
    section.name = clean;

    touchSong(song);

    beginLiveEdit();

    saveState();
}

function changeSectionType(
    sectionId,
    nextType
) {

    flushRedRoomEdits();

    const song =
        getCurrentSong();

    if (!song) {
        return;
    }

    const section =
        song.sections.find(
            section =>
                section.id ===
                sectionId
        );

    if (!section) {
        return;
    }

    const canonical =
        String(nextType || "")
            .trim()
            .toUpperCase() ||
        section.type ||
        "SECTION";

    section.type = canonical;

    touchSong(song);

    saveState();

    structuralRender();
}

function showSectionUndo() {

    const bar =
        document.getElementById(
            "section-undo-bar"
        );

    if (!bar) {
        return;
    }

    bar.hidden = false;

    const button =
        document.getElementById(
            "section-undo-button"
        );

    button?.focus({
        preventScroll: true
    });
}

function hideSectionUndo() {

    const bar =
        document.getElementById(
            "section-undo-bar"
        );

    if (bar) {
        bar.hidden = true;
    }

    clearDeletedSectionMemory();
}

function undoDeleteSection() {

    if (!lastDeletedSection) {
        return;
    }

    const song =
        state.songs.find(
            song =>
                song.id ===
                lastDeletedSection.songId
        );

    if (!song) {

        hideSectionUndo();

        return;
    }

    flushRedRoomEdits();

    if (!Array.isArray(song.sections)) {
        song.sections = [];
    }

    const at =
        Math.min(
            Math.max(
                0,
                lastDeletedSection.index
            ),
            song.sections.length
        );

    song.sections.splice(
        at,
        0,
        lastDeletedSection.section
    );

    currentSectionId =
        lastDeletedSection.section.id;

    currentSongId =
        song.id;

    touchSong(song);

    saveState();

    hideSectionUndo();

    structuralRender();
}


/* =========================================================
   SAVE SONG (autosave supports this; kept for callers)
========================================================= */

function saveSong() {

    const song =
        getCurrentSong();

    if (!song) {
        return;
    }


    const titleInput =
        document.getElementById(
            "song-title"
        );


    if (titleInput) {

        const title =
            titleInput.value.trim();

        song.title =
            title;
    }


    touchSong(song);

    saveState();

    renderCrate();

    renderRedRoom();


    const saveStatus =
        document.getElementById(
            "save-status"
        );


    if (saveStatus) {

        saveStatus.textContent =
            "SAVED";
    }
}


/* Autosave-first exit: flush pending edits, preserve the song
   identity, then return to CRATE. Nothing is duplicated. */
function exitToCrate() {

    flushRedRoomEdits();

    const song =
        getCurrentSong();

    if (song) {

        touchSong(song);

        saveState();
    }

    hideSectionUndo();

    closeTemplateMenu();

    closeSectionTypeMenu();

    closeOpenSectionMenus();

    showView("crate");
}


/* =========================================================
   SECTION TYPE MENU (+ SECTION selector)
========================================================= */

const SECTION_TYPE_ORDER = [
    "VERSE",
    "CHORUS",
    "PRE-CHORUS",
    "BRIDGE",
    "INTRO",
    "OUTRO"
];

function toggleSectionTypeMenu() {

    const menu =
        document.getElementById(
            "section-type-menu"
        );

    const button =
        document.getElementById(
            "add-section-button"
        );

    if (!menu) {

        addSection("VERSE");

        return;
    }

    if (menu.classList.contains("open")) {

        closeSectionTypeMenu();

    } else {

        openSectionTypeMenu();

    }

}

function openSectionTypeMenu() {

    closeTemplateMenu();

    const menu =
        document.getElementById(
            "section-type-menu"
        );

    const button =
        document.getElementById(
            "add-section-button"
        );

    if (!menu) {

        addSection("VERSE");

        return;
    }

    menu.classList.add(
        "open"
    );

    if (button) {

        button.setAttribute(
            "aria-expanded",
            "true"
        );
    }

    menu
        .querySelector(
            "button"
        )
        ?.focus({
            preventScroll: true
        });
}

function closeSectionTypeMenu() {

    const menu =
        document.getElementById(
            "section-type-menu"
        );

    const button =
        document.getElementById(
            "add-section-button"
        );

    if (!menu) {
        return;
    }

    menu.classList.remove(
        "open"
    );

    if (button) {

        button.setAttribute(
            "aria-expanded",
            "false"
        );
    }
}

function addSectionFromMenu(sectionType) {

    closeSectionTypeMenu();

    if (
        !sectionType ||
        sectionType === "custom"
    ) {

        createCustomSection();

        return;
    }

    addSection(
        sectionType
    );
}

/* Change type keeps the custom label intact: the visible name
   only falls back to TYPE + number when no label was set. */
function cycleSectionType(sectionId) {

    const song =
        getCurrentSong();

    if (!song) {
        return;
    }

    const section =
        song.sections.find(
            section =>
                section.id ===
                sectionId
        );

    if (!section) {
        return;
    }

    const current =
        (section.type || "VERSE").toUpperCase();

    const at =
        SECTION_TYPE_ORDER.indexOf(
            current
        );

    const next =
        SECTION_TYPE_ORDER[
            (at + 1) %
            SECTION_TYPE_ORDER.length
        ] || "VERSE";

    changeSectionType(
        sectionId,
        next
    );
}

function toggleSectionMenu(button) {

    const kebab =
        button.closest(
            ".section-kebab"
        );

    if (!kebab) {
        return;
    }

    const wasOpen =
        kebab.classList.contains(
            "open"
        );

    closeOpenSectionMenus();

    if (!wasOpen) {

        kebab.classList.add(
            "open"
        );

        button.setAttribute(
            "aria-expanded",
            "true"
        );
    }
}

function closeOpenSectionMenus() {

    document
        .querySelectorAll(
            ".section-kebab.open"
        )
        .forEach(kebab => {

            kebab.classList.remove(
                "open"
            );

            kebab
                .querySelector(
                    ".section-kebab-btn"
                )
                ?.setAttribute(
                    "aria-expanded",
                    "false"
                );
        });
}


/* =========================================================
   SONG TITLE CHANGE
========================================================= */

/* renderAll() and sync reconciliation call renderRedRoom() from
   contexts that cannot know whether the user is typing. This
   funnel is installed at the bottom of the file, after every
   helper it calls, so the focused editor is never replaced
   mid-keystroke. */
/* Installed below: renderRedRoom() itself is wrapped so every
   existing caller (renderAll, sync adopt, section ops) funnels
   through renderRedRoomSafe(). Explicit local actions that need
   an immediate rebuild while nothing is focused still work
   because the safe version renders normally when unfocused. */
function renderRedRoomRequested() {

    renderRedRoomSafe();
}


function updateSongTitle() {

    const song =
        getCurrentSong();

    const input =
        document.getElementById(
            "song-title"
        );


    if (!song || !input) {
        return;
    }


    /* Local-first: update memory on every keystroke, but do not
       synchronously persist/cloud-push per character. */
    song.title =
        input.value;


    touchSong(song);

    beginLiveEdit();

    clearTimeout(titleSaveTimer);

    titleSaveTimer =
        setTimeout(
            () => {
                titleSaveTimer = null;
                saveState();
            },
            400
        );
}


function flushTitleSave() {

    if (titleSaveTimer) {

        clearTimeout(titleSaveTimer);

        titleSaveTimer = null;

        saveState();
    }
}


/* =========================================================
   TEMPLATE MENU
========================================================= */

function toggleTemplateMenu() {

    openTemplateMenu();
}

function openTemplateMenu() {

    const menu =
        document.getElementById(
            "template-menu"
        );

    const button =
        document.getElementById(
            "template-button"
        );

    if (!menu) {
        return;
    }

    const willOpen =
        !menu.classList.contains(
            "open"
        );

    closeSectionTypeMenu();

    menu.classList.toggle(
        "open"
    );

    if (
        willOpen &&
        typeof refreshTemplateMenuState ===
            "function"
    ) {
        refreshTemplateMenuState();
    }

    if (willOpen) {

        button?.setAttribute(
            "aria-expanded",
            "true"
        );

        menu
            .querySelector(
                "button:not([disabled])"
            )
            ?.focus({
                preventScroll: true
            });

    } else {

        button?.setAttribute(
            "aria-expanded",
            "false"
        );
    }
}


function closeTemplateMenu() {

    const menu =
        document.getElementById(
            "template-menu"
        );

    const button =
        document.getElementById(
            "template-button"
        );

    if (!menu) {
        return;
    }


    menu.classList.remove(
        "open"
    );

    button?.setAttribute(
        "aria-expanded",
        "false"
    );
}


/* Templates start songs; they never restructure started work.
   The menu disables structure buttons with an explanation once
   meaningful writing or manual structure exists. */
function refreshTemplateMenuState() {

    const song =
        getCurrentSong();

    const menu =
        document.getElementById(
            "template-menu"
        );

    const button =
        document.getElementById(
            "template-button"
        );

    if (!menu) {
        return;
    }

    const fresh =
        isFreshSong(song);

    menu
        .querySelectorAll(
            "[data-template]"
        )
        .forEach(item => {

            const isStructure =
                item.dataset.template !==
                "custom";

            if (
                isStructure &&
                !fresh
            ) {

                item.setAttribute(
                    "disabled",
                    ""
                );

                item.setAttribute(
                    "title",
                    "Templates are available before you start writing."
                );

            } else {

                item.removeAttribute(
                    "disabled"
                );

                item.removeAttribute(
                    "title"
                );
            }
        });

    let note =
        menu.querySelector(
            ".template-note"
        );

    if (!fresh) {

        if (!note) {

            note =
                document.createElement(
                    "p"
                );

            note.className =
                "template-note";

            menu.appendChild(
                note
            );
        }

        note.textContent =
            "Templates are available before you start writing.";

    } else if (note) {

        note.remove();
    }

    if (button) {

        button.classList.toggle(
            "is-disabled",
            !fresh
        );

        button.setAttribute(
            "aria-disabled",
            fresh
                ? "false"
                : "true"
        );

        button.setAttribute(
            "title",
            fresh
                ? "Start with a structure"
                : "Templates are available before you start writing."
        );
    }
}


/* =========================================================
   APPLY TEMPLATE
========================================================= */

function applyTemplate(
    template
) {

    if (
        template === "custom"
    ) {

        closeTemplateMenu();

        createCustomSection();

        return;
    }


    const song =
        getCurrentSong();

    if (!song) {
        return;
    }


    /* Templates only start fresh songs; started songs keep every
       lyric they already have. */
    if (!isFreshSong(song)) {

        refreshTemplateMenuState();

        return;
    }

    flushRedRoomEdits();


    const structures = {

        basic: [
            "VERSE",
            "CHORUS",
            "VERSE",
            "CHORUS"
        ],

        build: [
            "VERSE",
            "PRE-CHORUS",
            "CHORUS",
            "VERSE",
            "PRE-CHORUS",
            "CHORUS"
        ],

        journey: [
            "INTRO",
            "VERSE",
            "CHORUS",
            "VERSE",
            "BRIDGE",
            "CHORUS",
            "OUTRO"
        ]
    };

    const singles = {

        verse: "VERSE",

        chorus: "CHORUS",

        prechorus: "PRE-CHORUS",

        bridge: "BRIDGE",

        intro: "INTRO",

        outro: "OUTRO"
    };


    closeTemplateMenu();

    const wanted =
        structures[template];

    if (wanted) {

        song.sections = [];

        currentSectionId = null;

        wanted.forEach(type => {

            addSection(
                type,
                {
                    silent: true,
                    deferRender: true,
                    deferFocus: true
                }
            );
        });

        currentSectionId =
            song.sections[0]?.id ||
            null;

        touchSong(song);

        saveState();

        structuralRender();

        refreshTemplateMenuState();

        return;
    }


    addSection(
        singles[template] ||
        "SECTION"
    );
}


/* =========================================================
   CUSTOM SECTION
========================================================= */

function createCustomSection() {

    const modalTitle =
        document.getElementById(
            "modal-title"
        );

    const modalBody =
        document.getElementById(
            "modal-body"
        );

    const confirm =
        document.getElementById(
            "modal-confirm"
        );


    if (!modalTitle || !modalBody) {
        return;
    }


    modalTitle.textContent =
        "CUSTOM SECTION";


    modalBody.innerHTML = `
        <input
            id="custom-section-input"
            type="text"
            placeholder="Section name"
        >
    `;


    if (confirm) {

        modalConfirm.set(function () {

            const input =
                document.getElementById(
                    "custom-section-input"
                );

            const name =
                input?.value.trim();


            if (name) {

                addSection(
                    "SECTION",
                    {
                        name
                    }
                );

                closeModal();
            }
        });
    }


    openModal();


    setTimeout(() => {

        document
            .getElementById(
                "custom-section-input"
            )
            ?.focus();

    }, 50);
}


/* =========================================================
   STATUS
========================================================= */

function cycleSongStatus() {

    const song =
        getCurrentSong();

    if (!song) {
        return;
    }


    const statuses = [
        "Draft",
        "Writing",
        "Complete"
    ];


    const current =
        statuses.indexOf(
            song.status
        );


    song.status =
        statuses[
            (current + 1) %
            statuses.length
        ];


    touchSong(song);

    saveState();

    structuralRender();
}


/* =========================================================
   RED ROOM NAVIGATION
========================================================= */

function leaveSong() {

    flushLyricsSave();
    flushTitleSave();

    hideSectionUndo();

    currentSongId = null;
    currentSectionId = null;

    showView("crate");
}

/* =========================================================
   FOCUS-SAFE RENDER FUNNEL
   Installed last so every earlier renderRedRoom() caller routes
   through renderRedRoomSafe(). Function declarations hoist, so
   calling renderRedRoomSafe() earlier in this file is fine.

   NOTE: renderRedRoomSafe() must call renderRedRoomContent(), NOT
   renderRedRoom(). Calling renderRedRoom() here re-enters this
   funnel and recurses until the stack overflows, which silently
   blocked every Red Room render - making every song appear to
   open the previously rendered one.
   ========================================================= */

renderRedRoom = function () {
    renderRedRoomSafe();
};
