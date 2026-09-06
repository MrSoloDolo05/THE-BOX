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

function renderRedRoom() {

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

        titleInput.value =
            song.title || "UNTITLED";
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


    renderSections();
}


/* =========================================================
   RENDER SECTIONS
========================================================= */

function renderSections() {

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
                        >

                            <div class="section-top">

                                <input
                                    class="section-type"
                                    type="text"
                                    value="${escapeAttribute(
                                        section.type
                                    )}"
                                    onchange="renameSection('${section.id}', this.value)"
                                >

                                <div class="section-actions">

                                    <button
                                        type="button"
                                        onclick="setCurrentSection('${section.id}')"
                                        title="Select section"
                                    >
                                        SELECT
                                    </button>

                                    <button
                                        type="button"
                                        onclick="openLinerPickerForSection('${section.id}')"
                                        title="Insert one liner"
                                    >
                                        + LINE
                                    </button>

                                    <button
                                        type="button"
                                        onclick="moveSection('${section.id}', -1)"
                                        title="Move up"
                                    >
                                        ↑
                                    </button>

                                    <button
                                        type="button"
                                        onclick="moveSection('${section.id}', 1)"
                                        title="Move down"
                                    >
                                        ↓
                                    </button>

                                    <button
                                        type="button"
                                        onclick="deleteSection('${section.id}')"
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
                                onfocus="setCurrentSection('${section.id}')"
                                onblur="flushLyricsSave()"
                                oninput="updateSectionLyrics('${section.id}', this.value)"
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


    currentSectionId =
        sectionId;


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

    renderRedRoom();


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
            title || "UNTITLED";
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


    song.title =
        input.value.trim() ||
        "UNTITLED";


    touchSong(song);

    saveState();
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

        confirm.onclick =
            function () {

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
            };
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