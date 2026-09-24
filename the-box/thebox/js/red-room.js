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
       by the focus guard. */
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

    renderRedRoomContent();
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

function renderRedRoomContent() {

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
           stays empty; the placeholder shows "UNTITLED". */
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


    renderSections();
}


/* =========================================================
   RENDER SECTIONS
========================================================= */

function renderSections() {

    if (isRedRoomEditorFocused()) {

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

                    const isActive =
                        section.id ===
                        currentSectionId;


                    return `
                        <div
                            class="song-section ${
                                isActive
                                    ? "active-section"
                                    : ""
                            }"
                            data-section-id="${section.id}"
                            role="button"
                            tabindex="0"
                            title="Select section"
                        >

                            <div class="section-top">

                                <input
                                    class="section-type"
                                    type="text"
                                    data-section-id="${section.id}"
                                    value="${escapeAttribute(
                                        section.type
                                    )}"
                                >

                                <div class="section-actions">

                                    <button
                                        type="button"
                                        data-action="open-picker"
                                        title="Insert one liner"
                                    >
                                        + LINE
                                    </button>

                                    <button
                                        type="button"
                                        data-action="move-section-up"
                                        title="Move up"
                                    >
                                        ↑
                                    </button>

                                    <button
                                        type="button"
                                        data-action="move-section-down"
                                        title="Move down"
                                    >
                                        ↓
                                    </button>

                                    <button
                                        type="button"
                                        data-action="delete-section"
                                        title="Delete section"
                                    >
                                        ×
                                    </button>

                                </div>

                            </div>


                            <textarea
                                class="lyrics-editor"
                                data-editor="${section.id}"
                                data-section-id="${section.id}"
                                placeholder="Write here..."
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

    const typeInput =
        card.querySelector(".section-type");

    /* Never overwrite the type input while it has focus: the user
       may be mid-word and state already holds their keystrokes. */
    if (
        typeInput &&
        document.activeElement !== typeInput
    ) {

        const next =
            section.type || "";

        if (typeInput.value !== next) {
            typeInput.value = next;
        }
    }

    const editor =
        card.querySelector(".lyrics-editor");

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
        String(value)
            .trim();


    section.type =
        clean
            ? clean.toUpperCase()
            : "SECTION";


    touchSong(song);

    beginLiveEdit();

    saveState();
}


/* =========================================================
   ADD SECTION
========================================================= */

function addSection(
    type = "VERSE"
) {

    const song =
        getCurrentSong();

    if (!song) {
        return;
    }


    const section = {

        id:
            generateId(),

        type:
            String(type)
                .toUpperCase(),

        lyrics:
            ""
    };


    song.sections.push(
        section
    );


    currentSectionId =
        section.id;


    touchSong(song);

    saveState();

    renderRedRoomSafe();


    setTimeout(() => {

        const editor =
            document.querySelector(
                `[data-editor="${section.id}"]`
            );

        if (editor) {
            editor.focus();
        }

    }, 50);
}


/* =========================================================
   DELETE SECTION
========================================================= */

function deleteSection(id) {

    if (isRedRoomEditorFocused()) {

        if (typeof markRenderDeferred === "function") {
            markRenderDeferred();
        }

        return;
    }


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


    song.sections.splice(
        index,
        1
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

    renderRedRoom();
}


/* =========================================================
   MOVE SECTION (up / down)
========================================================= */

function moveSection(id, delta) {

    if (isRedRoomEditorFocused()) {

        if (typeof markRenderDeferred === "function") {
            markRenderDeferred();
        }

        return;
    }


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

    renderRedRoom();
}


/* =========================================================
   SAVE SONG
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

    /* Save & Exit: head back to the crate */
    leaveSong();
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

function openTemplateMenu() {

    const menu =
        document.getElementById(
            "template-menu"
        );

    if (!menu) {
        return;
    }


    menu.classList.toggle(
        "open"
    );
}


function closeTemplateMenu() {

    const menu =
        document.getElementById(
            "template-menu"
        );

    if (!menu) {
        return;
    }


    menu.classList.remove(
        "open"
    );
}


/* =========================================================
   APPLY TEMPLATE
========================================================= */

function applyTemplate(
    template
) {

    closeTemplateMenu();


    const types = {

        verse: "VERSE",

        chorus: "CHORUS",

        prechorus: "PRE-CHORUS",

        bridge: "BRIDGE",

        intro: "INTRO",

        outro: "OUTRO"
    };


    if (
        template === "custom"
    ) {

        createCustomSection();

        return;
    }


    addSection(
        types[template] ||
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


            if (!name) {
                return;
            }


            addSection(
                name
            );

            closeModal();
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

    renderRedRoom();
}


/* =========================================================
   RED ROOM NAVIGATION
========================================================= */

function leaveSong() {

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
