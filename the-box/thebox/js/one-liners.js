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
            new Date().toISOString()
    });


    input.value = "";

    saveState();

    renderLiners();
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
   RENDER LINERS
========================================================= */

function renderLiners() {

    const container =
        document.getElementById(
            "liner-list"
        );

    if (!container) {
        return;
    }


    let liners =
        [...state.liners];


    if (
        linerFilter === "used"
    ) {

        liners =
            liners.filter(
                liner =>
                    getLinerUsages(
                        liner
                    ).length > 0
            );
    }


    if (
        linerFilter === "unused"
    ) {

        liners =
            liners.filter(
                liner =>
                    getLinerUsages(
                        liner
                    ).length === 0
            );
    }


    if (!liners.length) {

        container.innerHTML = `
            <div class="empty-state">
                NOTHING HERE YET.
            </div>
        `;

        return;
    }


    container.innerHTML =
        liners
            .map(liner => {

                const usages =
                    getLinerUsages(
                        liner
                    );


                return `
                    <div class="liner">

                        <div class="liner-top">

                            <div class="liner-text">
                                “${escapeHTML(
                                    liner.text
                                )}”
                            </div>

                            <div class="liner-meta">
                                ${
                                    usages.length
                                        ? `USED ${usages.length}`
                                        : "UNUSED"
                                }
                            </div>

                            <div class="liner-actions">

                                ${
                                    currentSongId
                                        ? `
                                            <button
                                                type="button"
                                                onclick="insertLiner('${liner.id}')"
                                                title="Insert"
                                            >
                                                ↳
                                            </button>
                                        `
                                        : ""
                                }

                                <button
                                    type="button"
                                    onclick="deleteLiner('${liner.id}')"
                                    title="Delete"
                                >
                                    ×
                                </button>

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
   FIND LINER USAGES
========================================================= */

function getLinerUsages(
    liner
) {

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
                        liner.text
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


    state.trash.push({

        id: generateId(),

        type: "liner",

        data: liner
    });


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
            "INSERT ONE LINER";
    }


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


        <div
            style="
                max-height:400px;
                overflow:auto;
            "
        >

            ${
                state.liners.length
                    ? state.liners
                        .map(
                            liner => `
                                <div
                                    onclick="insertLiner('${liner.id}')"
                                    style="
                                        padding:15px;
                                        border-bottom:1px solid rgba(255,255,255,.07);
                                        cursor:pointer;
                                        color:#bbb;
                                        line-height:1.6;
                                    "
                                >
                                    “${escapeHTML(
                                        liner.text
                                    )}”
                                </div>
                            `
                        )
                        .join("")
                    : `
                        <div style="color:#666">
                            NO ONE LINERS YET.
                        </div>
                    `
            }

        </div>
    `;


    openModal();
}


/* =========================================================
   INSERT LINER
========================================================= */

function insertLiner(id) {

    const song =
        getCurrentSong();

    const liner =
        state.liners.find(
            liner =>
                liner.id === id
        );


    if (!song || !liner) {
        return;
    }


    const section =
        song.sections.find(
            section =>
                section.id ===
                currentSectionId
        );


    if (!section) {
        return;
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
            liner.text +
            after;

    } else {

        section.lyrics +=
            (
                section.lyrics
                    ? "\n"
                    : ""
            ) +
            liner.text;
    }


    currentSectionId =
        section.id;


    touchSong(song);


    if (
        !liner.usedIn.includes(
            song.id
        )
    ) {

        liner.usedIn.push(
            song.id
        );
    }


    saveState();

    closeModal();

    renderSections();

    renderLiners();
}