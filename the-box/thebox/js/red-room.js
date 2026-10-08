/* =========================================================
   RED ROOM / SONG EDITOR
========================================================= */

const RED_ROOM_LAYOUT_KEY =
    "the_box_red_room_layout";

let redRoomCardLayout = "comfortable";

function applyRedRoomCardLayout() {
    const view =
        document.getElementById("view-redroom");

    const toggle =
        document.getElementById("redroom-layout-toggle");

    if (!view || !toggle) {
        return;
    }

    view.dataset.cardLayout =
        redRoomCardLayout;

    const nextLayout =
        redRoomCardLayout === "compact"
            ? "comfortable"
            : "compact";

    toggle.textContent =
        nextLayout === "compact"
            ? "COMPACT CARDS"
            : "COMFORTABLE CARDS";

    toggle.setAttribute(
        "aria-pressed",
        redRoomCardLayout === "compact"
            ? "true"
            : "false"
    );

    toggle.setAttribute(
        "aria-label",
        `Card layout is ${redRoomCardLayout}. Switch to ${nextLayout}.`
    );
}

function initializeRedRoomCardLayout() {
    try {
        const saved =
            localStorage.getItem(RED_ROOM_LAYOUT_KEY);

        redRoomCardLayout =
            saved === "compact"
                ? "compact"
                : "comfortable";
    } catch (error) {
        console.error(
            "Could not load Red Room card layout:",
            error
        );

        redRoomCardLayout = "comfortable";
    }

    applyRedRoomCardLayout();
}

function toggleRedRoomCardLayout() {
    redRoomCardLayout =
        redRoomCardLayout === "compact"
            ? "comfortable"
            : "compact";

    try {
        localStorage.setItem(
            RED_ROOM_LAYOUT_KEY,
            redRoomCardLayout
        );
    } catch (error) {
        console.error(
            "Could not save Red Room card layout:",
            error
        );

        showToast("CARD LAYOUT COULD NOT BE SAVED");
    }

    applyRedRoomCardLayout();
}


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

/* Blur and focus are two separate events, and a card-to-card handoff
   has a task-sized gap between them. Reconciling inside the blur
   handler rebuilds the whole card list in exactly that gap: the card
   being focused into is replaced before the caret lands in it, which
   both swallowed keystrokes and threw the caret away. Deferring one
   task lets the browser settle the new focus first; if the writer is
   still editing, protection simply continues and the reconciliation
   waits for the real end of the session. */
let liveEditReconcileTimer = null;

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

    if (typeof consumeRenderDeferred !== "function") {
        return;
    }

    if (!consumeRenderDeferred()) {
        return;
    }

    if (liveEditReconcileTimer) {
        clearTimeout(liveEditReconcileTimer);
    }

    liveEditReconcileTimer =
        setTimeout(
            () => {

                liveEditReconcileTimer = null;

                const stillEditing =

                    (typeof isLiveEdit === "function" &&
                        isLiveEdit()) ||

                    (typeof isRedRoomUiFocused === "function" &&
                        isRedRoomUiFocused()) ||

                    (typeof isRedRoomEditorFocused === "function" &&
                        isRedRoomEditorFocused());

                if (stillEditing) {

                    /* Editing continued into another card: keep the
                       reconciliation pending so nothing repaints until
                       the writer really leaves the editor. */
                    if (typeof markRenderDeferred === "function") {
                        markRenderDeferred();
                    }

                    return;
                }

                if (
                    typeof renderRedRoomSafe === "function"
                ) {
                    renderRedRoomSafe();
                }
            },
            0
        );
}

function isRedRoomEditorFocused() {

    return isRedRoomEditorTarget(document.activeElement);
}


/* True while focus sits anywhere inside the RED ROOM editor, including
   the controls attached to a card (kebab, delete, liner picker). A
   click on one of those starts with focus leaving the textarea, so a
   reconciliation that rebuilds the card list in that instant removes
   the button the pointer is still over and the click never lands. */
function isRedRoomUiFocused() {

    const active =
        document.activeElement;

    if (!active || !active.closest) {
        return false;
    }

    return Boolean(
        active.closest("#song-sections, #song-title")
    );
}

/* True for the text inputs of the Red Room: a section editor, a
   section label, or the song title. Deliberately NOT "anything inside
   #song-sections" - a focused kebab or delete button must not keep
   render protection held open, or remote changes would never paint. */
function isRedRoomEditorTarget(node) {

    return Boolean(
        node &&
        node.closest &&
        node.closest(
            ".section-editor, .section-name, #song-title"
        )
    );
}

/* =========================================================
   LOCAL EDIT LEDGER  (P0 data-integrity guard)
   ---------------------------------------------------------
   The sync layer works in snapshots: a push captures the state,
   awaits a Firestore transaction, then adopts the merged result.
   Anything typed during that network round trip is NOT inside the
   snapshot, so adopting it wholesale used to roll state back to the
   older text. The focused editor still looked correct, and the next
   reconciliation painted the older text over it: typed characters
   appeared to vanish when the writer moved to another card.

   The ledger records every locally typed lyric/title value the moment
   the keystroke happens and keeps it until a merge/push has actually
   confirmed it. Any adoption therefore re-applies the newest local
   text before it can reach the screen, and any card refresh skips
   protected sections. The newest local text is authoritative until
   persisted.
   ========================================================= */

const localLyricEdits = new Map();
let localTitleEdit = null;

function recordLocalLyricEdit(songId, sectionId, value) {

    if (!songId || !sectionId) {
        return;
    }

    localLyricEdits.set(sectionId, {
        songId,
        value,
        stamp: Date.now()
    });
}

function recordLocalTitleEdit(songId, value) {

    if (!songId) {
        return;
    }

    localTitleEdit = {
        songId,
        value,
        stamp: Date.now()
    };
}

function hasLocalLyricEdit(sectionId) {
    return localLyricEdits.has(sectionId);
}

/* Re-assert protected local text over a state object that has just
   been (possibly stale-)replaced. Returns true when anything was
   restored, so the caller can persist and push the recovered text. */
function applyLocalEditsToState() {

    let restored = false;

    localLyricEdits.forEach((edit, sectionId) => {

        const song =
            (state.songs || []).find(
                item => item.id === edit.songId
            );

        if (!song || !Array.isArray(song.sections)) {
            return;
        }

        const section =
            song.sections.find(
                item => item.id === sectionId
            );

        if (!section) {
            return;
        }

        if ((section.lyrics || "") !== edit.value) {
            section.lyrics = edit.value;
            restored = true;
        }
    });

    if (localTitleEdit) {

        const song =
            (state.songs || []).find(
                item => item.id === localTitleEdit.songId
            );

        if (song && (song.title || "") !== localTitleEdit.value) {
            song.title = localTitleEdit.value;
            restored = true;
        }
    }

    if (restored && typeof touchSong === "function") {

        const touched = new Set();

        localLyricEdits.forEach(edit => touched.add(edit.songId));

        if (localTitleEdit) {
            touched.add(localTitleEdit.songId);
        }

        touched.forEach(songId => {

            const song =
                (state.songs || []).find(
                    item => item.id === songId
                );

            if (song) {
                touchSong(song);
            }
        });
    }

    return restored;
}

/* A local edit stops being special once the confirmed (merged/pushed)
   state already carries exactly the text the writer typed, and no
   debounced save is still pending. Deleting a song or section also
   drops its entries so the ledger can never grow or resurrect data. */
function pruneLocalEdits(confirmed) {

    const snapshot =
        confirmed || (typeof state !== "undefined" ? state : null);

    if (!snapshot) {
        return;
    }

    const pendingPersist =
        Boolean(lyricsSaveTimer || titleSaveTimer);

    localLyricEdits.forEach((edit, sectionId) => {

        const song =
            (snapshot.songs || []).find(
                item => item.id === edit.songId
            );

        const section =
            song && Array.isArray(song.sections)
                ? song.sections.find(
                    item => item.id === sectionId
                )
                : null;

        if (!section) {
            localLyricEdits.delete(sectionId);
            return;
        }

        if (
            !pendingPersist &&
            (section.lyrics || "") === edit.value
        ) {
            localLyricEdits.delete(sectionId);
        }
    });

    if (!localTitleEdit) {
        return;
    }

    const titleSong =
        (snapshot.songs || []).find(
            item => item.id === localTitleEdit.songId
        );

    if (!titleSong) {
        localTitleEdit = null;
        return;
    }

    if (
        !pendingPersist &&
        (titleSong.title || "") === localTitleEdit.value
    ) {
        localTitleEdit = null;
    }
}

/* An intentional removal of a whole song must also remove its pending
   entries, so a copy of the song that is still travelling through the
   sync layer cannot bring back text the writer already threw away. */
function dropLocalEditsForSong(songId) {

    if (!songId) {
        return;
    }

    localLyricEdits.forEach((edit, sectionId) => {

        if (edit.songId === songId) {
            localLyricEdits.delete(sectionId);
        }
    });

    if (localTitleEdit && localTitleEdit.songId === songId) {
        localTitleEdit = null;
    }
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

    /* The screen and the state now agree, so local edits that this
       render proves are already carried by the state can leave the
       ledger. Entries for sections that no longer exist are dropped
       too, so the ledger can never resurrect deleted content. */
    pruneLocalEdits();
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
                                            aria-label="Actions for ${escapeAttribute(
                                                label
                                            )}"
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
                                                data-action="open-liner-picker"
                                                role="menuitem"
                                                title="Insert one liner"
                                            >
                                                + LINE
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
       already holds the in-progress keystrokes. Sections with a
       pending local edit are also left alone even when unfocused —
       their DOM text is the newest word of the writer. */
    if (
        nameInput &&
        document.activeElement !== nameInput &&
        !hasLocalLyricEdit(sectionId)
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
       the local keystrokes; remote text applies on blur render.
       A section with a pending local edit is protected the same way
       even after focus has moved to another card, otherwise a merge
       that has not yet absorbed those keystrokes would paint older
       text over them. */
    if (
        editor &&
        document.activeElement !== editor &&
        !hasLocalLyricEdit(sectionId)
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


    /* Protect this text from the moment the keystroke happens: any
       state adoption that lands before it has been persisted and
       pushed (including one whose snapshot predates this keystroke)
       re-applies it instead of silently rolling it back. */
    recordLocalLyricEdit(
        song.id,
        sectionId,
        value
    );


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

    const hadTimer =
        Boolean(lyricsSaveTimer);

    if (hadTimer) {

        clearTimeout(lyricsSaveTimer);

        lyricsSaveTimer = null;
    }

    /* Persist even when the debounce already fired but the ledger
       still holds text that has not been confirmed by a merge/push:
       that text must reach localStorage before anything else can
       replace state. */
    if (hadTimer || localLyricEdits.size) {
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

    /* Structural actions rebuild every card, so any in-progress text
       must be in the state before the markup is regenerated. */
    flushRedRoomEdits();

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


    /* An intentional delete outranks the typing guard: forget the
       protected text for this section so a snapshot that still holds
       it cannot bring it back. */
    localLyricEdits.delete(id);


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

        orientMenuForViewport(
            kebab.querySelector(".section-menu"),
            button
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
                .querySelector(".section-menu")
                ?.classList.remove("opens-up");

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

    /* Same protection as lyrics: the newest typed title outranks any
       adoption that has not confirmed it yet. */
    recordLocalTitleEdit(
        song.id,
        input.value
    );


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

    const hadTimer =
        Boolean(titleSaveTimer);

    if (hadTimer) {

        clearTimeout(titleSaveTimer);

        titleSaveTimer = null;
    }

    if (hadTimer || localTitleEdit) {
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

    /* Leaving the editor ends the protected session even when the
       browser never delivered a focusout (touch, or a click on a
       non-focusable control). */
    if (typeof endLiveEdit === "function") {
        endLiveEdit();
    }

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


/* =========================================================
   PERSISTENCE SAFETY NET
   A reload or tab switch inside the save debounce window used to
   drop the last few characters typed. Flushing on pagehide and on
   hidden means the newest text is in localStorage - and queued for
   the cloud - before the document can be torn away.
   ========================================================= */

window.addEventListener(
    "pagehide",
    () => {

        if (typeof flushRedRoomEdits === "function") {
            flushRedRoomEdits();
        }
    }
);

window.addEventListener(
    "visibilitychange",
    () => {

        if (
            document.visibilityState === "hidden" &&
            typeof flushRedRoomEdits === "function"
        ) {
            flushRedRoomEdits();
        }
    }
);
