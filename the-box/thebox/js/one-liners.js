/* =========================================================
   ONE LINERS
========================================================= */


/* =========================================================
   ADD LINER
========================================================= */

function addLiner() {

    const input =
        document.getElementById(
            "liner-input"
        );

    if (!input) {
        return;
    }


    const text =
        input.value.trim();


    if (!text) {
        return;
    }


    state.liners.unshift({

        id: generateId(),

        text: text,

        usedIn: [],

        created:
            new Date().toISOString(),

        /* Required by the per-record sync merge. */
        modified:
            new Date().toISOString()
    });


    input.value = "";

    input.focus();

    saveState();

    renderLiners();
}


/* =========================================================
   ADD VERSE
========================================================= */

function addVerse() {

    const input =
        document.getElementById(
            "verse-input"
        );

    if (!input) {
        return;
    }


    const text =
        input.value.trim();


    if (!text) {
        return;
    }


    state.verses.unshift({

        id: generateId(),

        text: text,

        usedIn: [],

        created:
            new Date().toISOString(),

        /* Required by the per-record sync merge. */
        modified:
            new Date().toISOString()
    });


    input.value = "";

    input.focus();

    saveState();

    renderLiners();
}


/* =========================================================
   LINER KEBAB MENU (presentation only)
========================================================= */

function closeOpenLinerMenus() {

    document
        .querySelectorAll(
            ".liner-kebab.open"
        )
        .forEach(kebab => {

            kebab.classList.remove(
                "open"
            );

            kebab
                .querySelector(
                    ".liner-kebab-btn"
                )
                ?.setAttribute(
                    "aria-expanded",
                    "false"
                );
        });
}

function toggleLinerMenu(button) {

    const kebab =
        button.closest(
            ".liner-kebab"
        );

    if (!kebab) {
        return;
    }

    const wasOpen =
        kebab.classList.contains(
            "open"
        );

    closeOpenLinerMenus();

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

function focusLinerComposer() {

    const target =
        document.getElementById(
            linerView === "verses"
                ? "verse-input"
                : "liner-input"
        );

    if (!target) {
        return;
    }

    target.scrollIntoView({
        behavior:
            window.matchMedia(
                "(prefers-reduced-motion: reduce)"
            ).matches
                ? "auto"
                : "smooth",
        block: "center"
    });

    target.focus({
        preventScroll: true
    });
}


/* =========================================================
   LINER FILTER
========================================================= */

function setLinerFilter(
    filter,
    button
) {

    linerFilter = filter;


    document
        .querySelectorAll(
            ".filter-btn"
        )
        .forEach(btn => {

            btn.classList.remove(
                "active"
            );
        });


    if (button) {

        button.classList.add(
            "active"
        );
    }


    renderLiners();
}


/* =========================================================
   LINER VIEW (LINES / VERSES TAB)
========================================================= */

function setLinerView(
    view,
    button
) {

    if (
        view !== "lines" &&
        view !== "verses"
    ) {
        return;
    }


    linerView = view;


    const isVerses =
        view === "verses";


    /* Two-tone environment hook for CSS: sage-lit LINE mode vs
       dimmed forest VERSE mode. Pure presentation; no data
       behavior changes. */
    document
        .getElementById("app")
        ?.setAttribute(
            "data-liners",
            isVerses
                ? "verses"
                : "lines"
        );


    document
        .querySelectorAll(
            ".liner-tab"
        )
        .forEach(btn => {

            const isActive =
                btn.dataset.linerview ===
                view;

            btn.classList.toggle(
                "active",
                isActive
            );

            btn.setAttribute(
                "aria-selected",
                isActive
                    ? "true"
                    : "false"
            );
        });


    const quickAdd =
        document.getElementById(
            "liner-quickadd-button"
        );

    if (quickAdd) {

        quickAdd.textContent =
            isVerses
                ? "+ ADD VERSE"
                : "+ ADD LINE";

        quickAdd.setAttribute(
            "aria-label",
            isVerses
                ? "Add verse"
                : "Add line"
        );
    }


    renderLiners();


    /* Capture speed: input is immediately ready after a mode
       switch so the mobile keyboard opens at once. Skip the
       focus move when the user is tabbing through controls. */
    const focusTarget =
        document.getElementById(
            isVerses
                ? "verse-input"
                : "liner-input"
        );

    const activeIsTab =
        button &&
        document.activeElement === button;

    if (
        focusTarget &&
        !activeIsTab &&
        !window.matchMedia(
            "(pointer: coarse)"
        ).matches
    ) {

        focusTarget.focus({
            preventScroll: true
        });
    }
}


/* =========================================================
   RENDER LINERS
========================================================= */

function renderLiners() {

    const isLines =
        linerView === "lines";


    const container =
        document.getElementById(
            isLines
                ? "liner-list"
                : "verse-list"
        );

    const linesInput =
        document.querySelector(
            ".add-liner"
        );

    const versesInput =
        document.querySelector(
            ".add-verse"
        );

    if (linesInput) {
        linesInput.style.display =
            isLines ? "" : "none";
    }

    if (versesInput) {
        versesInput.style.display =
            isLines ? "none" : "flex";
    }

    const otherContainer =
        document.getElementById(
            isLines
                ? "verse-list"
                : "liner-list"
        );

    if (otherContainer) {
        otherContainer.style.display =
            "none";
    }

    if (!container) {
        return;
    }

    container.style.display =
        "";

    let items =
        isLines
            ? [...state.liners]
            : [...state.verses];

    const getUsages =
        isLines
            ? getLinerUsages
            : getVerseUsages;

    if (
        linerFilter === "used"
    ) {

        items =
            items.filter(
                item =>
                    getUsages(
                        item
                    ).length > 0
            );
    }


    if (
        linerFilter === "unused"
    ) {

        items =
            items.filter(
                item =>
                    getUsages(
                        item
                    ).length === 0
            );
    }


    if (!items.length) {

        const isVerseEmpty =
            !isLines;

        container.innerHTML = `
            <div class="liner-empty">
                <h3>${
                    isVerseEmpty
                        ? "No verses yet."
                        : "Nothing here yet."
                }</h3>
                <p>${
                    isVerseEmpty
                        ? "Build something from the fragments."
                        : "Catch it before you forget it."
                }</p>
                <button
                    class="liner-empty-btn"
                    data-action="focus-composer"
                    type="button"
                >
                    ${
                        isVerseEmpty
                            ? "+ ADD VERSE"
                            : "+ ADD LINE"
                    }
                </button>
            </div>
        `;

        return;
    }


    const cardClass =
        isLines
            ? ""
            : "verse-card";

    const textClass =
        isLines
            ? ""
            : "verse-text";


    const sortedItems =
        [...items].reverse();


    container.innerHTML =
        items
            .map((item, displayIndex) => {

                const verseNumber =
                    !isLines
                        ? String(
                            displayIndex + 1
                        ).padStart(2, "0")
                        : "";


                const usages =
                    getUsages(
                        item
                    );

                const kindLabel =
                    isLines
                        ? "line"
                        : "verse";

                const editLabel =
                    escapeAttribute(
                        item.text.slice(0, 80) ||
                        kindLabel
                    );

                const insertButton =
                    currentSongId
                        ? `
                            <button
                                type="button"
                                data-action="insert-item"
                                role="menuitem"
                            >
                                USE IN SONG
                            </button>
                        `
                        : "";

                const verseKicker =
                    !isLines
                        ? `
                            <div class="verse-kicker">
                                VERSE ${verseNumber}
                            </div>
                        `
                        : "";

                return `
                    <div
                        class="liner ${cardClass}"
                        data-item-id="${item.id}"
                    >

                        ${verseKicker}

                        <div class="liner-top">

                            <button
                                class="liner-main"
                                type="button"
                                data-action="edit-item"
                                aria-label="Edit ${kindLabel}: ${editLabel}"
                            >

                                <span class="liner-text ${textClass}">
                                ${
                                    isLines
                                        ? `“${escapeHTML(
                                            item.text
                                        )}”`
                                        : escapeHTML(
                                            item.text
                                        )
                                }
                                </span>

                            </button>

                            <div class="liner-kebab">

                                <button
                                    class="liner-kebab-btn"
                                    type="button"
                                    data-action="menu-item"
                                    aria-haspopup="menu"
                                    aria-expanded="false"
                                >
                                    •••
                                </button>

                                <div
                                    class="liner-menu"
                                    role="menu"
                                >

                                    <button
                                        type="button"
                                        data-action="edit-item"
                                        role="menuitem"
                                    >
                                        EDIT
                                    </button>

                                    ${insertButton}

                                    <button
                                        class="danger"
                                        type="button"
                                        data-action="delete-item"
                                        role="menuitem"
                                    >
                                        DELETE
                                    </button>

                                </div>

                            </div>

                        </div>


                        ${
                            usages.length
                                ? `
                                    <div class="liner-usage">

                                        ${usages
                                            .map(
                                                usage => `
                                                    <div>
                                                        ${escapeHTML(
                                                            usage.song
                                                        )}
                                                        ·
                                                        ${escapeHTML(
                                                            usage.section
                                                        )}
                                                    </div>
                                                `
                                            )
                                            .join("")}

                                    </div>
                                `
                                : ""
                        }

                    </div>
                `;
            })
            .join("");
}


/* =========================================================
   FIND USAGES IN SONGS
   (shared by one liners and verses: plain substring
    matching against every song section's lyrics)
========================================================= */

function findUsageInSongs(text) {

    const usages = [];


    state.songs.forEach(song => {

        if (!Array.isArray(song.sections)) {
            return;
        }


        song.sections.forEach(
            section => {

                if (
                    typeof section.lyrics ===
                    "string" &&
                    section.lyrics.includes(
                        text
                    )
                ) {

                    usages.push({

                        song:
                            song.title,

                        section:
                            section.type
                    });
                }
            }
        );
    });


    return usages;
}


/* =========================================================
   FIND LINER USAGES
========================================================= */

function getLinerUsages(
    liner
) {

    return findUsageInSongs(
        liner.text
    );
}


/* =========================================================
   FIND VERSE USAGES
========================================================= */

function getVerseUsages(
    verse
) {

    return findUsageInSongs(
        verse.text
    );
}


/* =========================================================
   DELETE LINER
========================================================= */

function deleteLiner(id) {

    const liner =
        state.liners.find(
            liner =>
                liner.id === id
        );

    if (!liner) {
        return;
    }


    const alreadyTrashed =
        state.trash.some(
            item =>
                item.type === "liner" &&
                item.data &&
                item.data.id === id
        );

    if (!alreadyTrashed) {

        state.trash.push({

            id: generateId(),

            type: "liner",

            data: liner,

            /* Tombstone timestamp used by the per-record sync
               merge to order this deletion against stale copies. */
            modified:
                new Date().toISOString()
        });
    }


    /* Durable deletion tombstone. Prevents a device that still
       holds an older copy from resurrecting this liner. */
    markRecordDeleted(id);


    state.liners =
        state.liners.filter(
            liner =>
                liner.id !== id
        );


    saveState();

    renderLiners();

    renderTrash();
}


/* =========================================================
   DELETE VERSE
========================================================= */

function deleteVerse(id) {

    const verse =
        state.verses.find(
            verse =>
                verse.id === id
        );

    if (!verse) {
        return;
    }


    const alreadyTrashed =
        state.trash.some(
            item =>
                item.type === "verse" &&
                item.data &&
                item.data.id === id
        );

    if (!alreadyTrashed) {

        state.trash.push({

            id: generateId(),

            type: "verse",

            data: verse,

            /* Tombstone timestamp used by the per-record sync
               merge to order this deletion against stale copies. */
            modified:
                new Date().toISOString()
        });
    }


    /* Durable deletion tombstone. Prevents a device that still
       holds an older copy from resurrecting this verse. */
    markRecordDeleted(id);


    state.verses =
        state.verses.filter(
            verse =>
                verse.id !== id
        );


    saveState();

    renderLiners();

    renderTrash();
}


/* =========================================================
   ONE LINER PICKER
========================================================= */

function openLinerPicker() {

    const song =
        getCurrentSong();

    if (!song) {
        return;
    }


    if (!currentSectionId) {

        currentSectionId =
            song.sections[0]?.id ||
            null;
    }


    const currentSection =
        song.sections.find(
            section =>
                section.id ===
                currentSectionId
        );


    const modalBody =
        document.getElementById(
            "modal-body"
        );

    const modalTitle =
        document.getElementById(
            "modal-title"
        );


    if (!modalBody) {
        return;
    }


    if (modalTitle) {
        modalTitle.textContent =
            "INSERT";
    }


    pickerView = "lines";


    modalBody.innerHTML = `

        <div
            style="
                color:#666;
                font-family:'DM Mono';
                font-size:8px;
                margin-bottom:18px;
            "
        >
            INSERTING INTO:
            ${escapeHTML(
                currentSection?.type ||
                "SECTION"
            )}
        </div>


        <div class="picker-tabs">

            <button
                class="picker-tab active"
                data-picker-view="lines"
                type="button"
            >
                LINES
            </button>

            <button
                class="picker-tab"
                data-picker-view="verses"
                type="button"
            >
                VERSES
            </button>

        </div>


        <div
            id="picker-list"
            style="
                max-height:400px;
                overflow:auto;
            "
        >

            ${renderPickerItems("lines")}

        </div>
    `;


    openModal();
}


/* =========================================================
   PICKER VIEW
========================================================= */

let pickerView = "lines";


function setPickerView(
    view,
    button
) {

    if (
        view !== "lines" &&
        view !== "verses"
    ) {
        return;
    }


    pickerView = view;


    document
        .querySelectorAll(
            ".picker-tab"
        )
        .forEach(btn => {

            btn.classList.toggle(
                "active",
                btn.dataset.pickerView ===
                view
            );
        });


    const list =
        document.getElementById(
            "picker-list"
        );

    if (list) {
        list.innerHTML =
            renderPickerItems(
                view
            );
    }
}


function renderPickerItems(
    view
) {

    const items =
        view === "lines"
            ? state.liners
            : state.verses;

    if (!items.length) {

        return `
            <div style="color:#666">
                NO ${view.toUpperCase()} YET.
            </div>
        `;
    }


    return items
        .map(
            item => `
                <div
                    class="picker-item"
                    data-item-id="${item.id}"
                    style="
                        padding:15px;
                        border-bottom:1px solid rgba(255,255,255,.07);
                        cursor:pointer;
                        color:#bbb;
                        line-height:1.6;
                        ${
                            view === "verses"
                                ? "white-space:pre-wrap;"
                                : ""
                        }
                    "
                >
                    ${
                        view === "lines"
                            ? `“${escapeHTML(
                                item.text
                            )}”`
                            : escapeHTML(
                                item.text
                            )
                    }
                </div>
            `
        )
        .join("");
}


/* =========================================================
   INSERT TEXT INTO CURRENT SECTION
   (shared by one liners and verses)
========================================================= */

function insertIntoSection(text) {

    const song =
        getCurrentSong();

    if (!song) {
        return null;
    }


    const section =
        song.sections.find(
            section =>
                section.id ===
                currentSectionId
        );

    if (!section) {
        return null;
    }


    const editor =
        document.querySelector(
            `[data-editor="${section.id}"]`
        );


    if (editor) {

        const start =
            typeof editor.selectionStart ===
            "number"
                ? editor.selectionStart
                : section.lyrics.length;

        const end =
            typeof editor.selectionEnd ===
            "number"
                ? editor.selectionEnd
                : start;


        const before =
            section.lyrics.slice(
                0,
                start
            );

        const after =
            section.lyrics.slice(
                end
            );


        section.lyrics =
            before +
            text +
            after;

    } else {

        section.lyrics +=
            (
                section.lyrics
                    ? "\n"
                    : ""
            ) +
            text;
    }


    currentSectionId =
        section.id;


    touchSong(song);


    return song;
}


function markUsed(
    items,
    id,
    song
) {

    const item =
        items.find(
            item =>
                item.id === id
        );

    if (!item) {
        return;
    }


    if (
        !item.usedIn.includes(
            song.id
        )
    ) {

        item.usedIn.push(
            song.id
        );

        /* Usage tracking is an edit to the liner/verse record, so
           stamp it for the per-record sync merge. */
        touchRecord(item);
    }
}


/* =========================================================
   INSERT LINER
========================================================= */

function insertLiner(id) {

    const liner =
        state.liners.find(
            liner =>
                liner.id === id
        );

    if (!liner) {
        return;
    }


    const song =
        insertIntoSection(
            liner.text
        );

    if (!song) {
        return;
    }


    markUsed(
        state.liners,
        id,
        song
    );


    saveState();

    closeModal();

    renderSections();

    renderLiners();
}


/* =========================================================
   INSERT VERSE
========================================================= */

function insertVerse(id) {

    const verse =
        state.verses.find(
            verse =>
                verse.id === id
        );

    if (!verse) {
        return;
    }


    const song =
        insertIntoSection(
            verse.text
        );

    if (!song) {
        return;
    }


    markUsed(
        state.verses,
        id,
        song
    );


    saveState();

    closeModal();

    renderSections();

    renderLiners();
}


/* =========================================================
   EDIT ITEM (ONE LINER OR VERSE)
========================================================= */

function editLiner(id) {

    openEditModal(
        id,
        "lines"
    );
}


function editVerse(id) {

    openEditModal(
        id,
        "verses"
    );
}


function openEditModal(
    id,
    kind
) {

    const items =
        kind === "lines"
            ? state.liners
            : state.verses;

    const item =
        items.find(
            item =>
                item.id === id
        );

    if (!item) {
        return;
    }


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
        kind === "lines"
            ? "EDIT ONE LINER"
            : "EDIT VERSE";


    modalBody.innerHTML = `
        <textarea
            id="edit-text-input"
            class="edit-modal-input"
            placeholder="${
                kind === "lines"
                    ? "One liner"
                    : "Verse"
            }..."
        >${escapeHTML(
            item.text
        )}</textarea>
    `;


    if (confirm) {

        modalConfirm.set(function () {

            const input =
                document.getElementById(
                    "edit-text-input"
                );

            const text =
                input?.value.trim();

            if (!text) {
                return;
            }

            item.text = text;

            /* Bump the per-record modified stamp so the sync
               merge can order this edit against other devices. */
            touchRecord(item);

            saveState();

            closeModal();

            renderLiners();
        });
    }


    openModal();


    setTimeout(() => {

        document
            .getElementById(
                "edit-text-input"
            )
            ?.focus();

    }, 50);
}