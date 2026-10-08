/* =========================================================
   IMPORT LINES, VERSES & SONGS
   Paste any text, pick a .txt/.md file, or drop one onto
   the modal. Everything is additive and never wipes data.

   LINES  -> every non-empty line becomes a one liner
   VERSES -> blank-line separated blocks become verses
   SONG   -> explicit section headers ("VERSE 1:", "[Chorus]")
             become sections of a brand new song
========================================================= */


/* =========================================================
   IMPORT MODE
========================================================= */

let importMode = "lines";
let songImportInProgress = false;


/* =========================================================
   TEXT PARSING HELPERS
========================================================= */

function parseLines(text) {

    return String(text || "")
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);
}


function parseVerses(text) {

    return String(text || "")
        .split(/\r?\n\s*\r?\n/)
        .map(block =>
            block
                .replace(/\r?\n/g, "\n")
                .trim()
        )
        .filter(Boolean);
}


const SECTION_KEYWORDS = [
    "PRE-CHORUS",
    "POST-CHORUS",
    "VERSE",
    "CHORUS",
    "BRIDGE",
    "INTRO",
    "OUTRO",
    "INSTRUMENTAL",
    "INTERLUDE",
    "PRELUDE",
    "SOLO",
    "HOOK",
    "TAG",
    "BUILD",
    "DROP",
    "REFRRAIN",
    "SECTION"
];


function normalizeSectionName(line) {

    return String(line || "")
        .trim()
        .replace(/^\[|\]$/g, "")
        .replace(/:+\s*$/g, "")
        .replace(/^[-–—:\s]+|[-–—:\s]+$/g, "")
        .trim()
        .toUpperCase();
}


function isSectionHeader(line) {

    const value =
        String(line || "")
            .trim();

    if (!value) {
        return false;
    }

    /* Bracket headers: [Verse], [Chorus 1], [Pre-Chorus] */
    if (/^\[.+\]\s*:?\s*$/.test(value)) {
        return true;
    }

    /* Keyword + optional number + optional trailing colon,
       case-insensitive: "verse 1:", "Chorus", "BRIDGE 2" */
    if (
        SECTION_KEYWORDS.some(keyword => {

            const matcher = new RegExp(
                "^" +
                keyword
                    .replace(/[-]/g, "\\-")
                    .replace(/[()]/g, "\\$&") +
                "(?:\\s+\\d+)?\\s*:?\\s*$",
                "i"
            );

            return matcher.test(value);
        })
    ) {
        return true;
    }

    return false;
}


function cleanSectionType(line) {

    const normalized =
        normalizeSectionName(line);

    /* Match the longest keyword prefix so "PRE-CHORUS"
       is not misread as "CHORUS". */
    const keyword =
        SECTION_KEYWORDS
            .slice()
            .sort(
                (a, b) =>
                    b.length - a.length
            )
            .find(word =>
                normalized.startsWith(word)
            ) || "SECTION";

    const suffix =
        normalized
            .slice(keyword.length)
            .trim();

    return (
        keyword +
        (suffix ? " " + suffix : "")
    );
}


/* =========================================================
   PARSE SONG
========================================================= */

function titleFromFilename(name) {

    const base =
        String(name || "")
            .split(/[\\/]/)
            .pop() || "";

    return base
        .replace(/\.(txt|md|markdown|text)$/i, "")
        .replace(/[_.]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}


function parseSong(text) {

    const source =
        String(text || "");

    const titleMatch =
        source.match(
            /^\uFEFF?\s*TITLE\s*:\s*(.+?)\s*(?:\r?\n|$)/i
        );

    const title =
        titleMatch
            ? titleMatch[1].trim()
            : "";

    const body =
        titleMatch
            ? source.slice(titleMatch[0].length)
            : source;

    const nonEmpty =
        parseLines(body);

    if (!nonEmpty.length) {
        return null;
    }

    const hasHeader =
        nonEmpty.some(isSectionHeader);
    const sections = [];
    let current = null;

    nonEmpty.forEach(line => {

        if (isSectionHeader(line)) {

            if (current) {
                sections.push(current);
            }

            current = {
                type: cleanSectionType(line),
                lyrics: []
            };

            return;
        }

        if (!current) {

            current = {
                type: "VERSE",
                lyrics: []
            };
        }

        current.lyrics.push(line);
    });

    if (current) {
        sections.push(current);
    }

    /* Fallback: no explicit section headers were found.
       If the text has blank-line separated blocks, split it
       into auto-labelled stanzas (VERSE 1, VERSE 2, ...). */
    const stanzas =
        body
            .split(/\r?\n\s*\r?\n/)
            .map(block =>
                block
                    .replace(/\r?\n/g, "\n")
                    .trim()
            )
            .filter(Boolean);

    if (
        !hasHeader &&
        stanzas.length > 1
    ) {

        return {
            title,
            sections: stanzas.map(
                (stanza, index) => ({
                    type: "VERSE " + (index + 1),
                    lyrics: stanza.split(/\r?\n/)
                })
            )
        };
    }

    return {
        title,
        sections: sections
    };
}


/* =========================================================
   IMPORT LINES
========================================================= */

function importLines(text) {

    const lines =
        parseLines(text);

    const existing =
        new Set(
            state.liners.map(
                liner => liner.text
            )
        );

    let added = 0;

    lines.forEach(line => {

        if (existing.has(line)) {
            return;
        }

        existing.add(line);

        state.liners.unshift({
            id: generateId(),
            text: line,
            usedIn: [],
            created:
                new Date().toISOString(),
            modified:
                new Date().toISOString()
        });

        added += 1;
    });


    if (added) {
        saveState();
        renderLiners();
    }

    return added;
}


/* =========================================================
   IMPORT VERSES
========================================================= */

function importVerses(text) {

    const verses =
        parseVerses(text);

    const existing =
        new Set(
            state.verses.map(
                verse => verse.text
            )
        );

    let added = 0;

    verses.forEach(verse => {

        if (existing.has(verse)) {
            return;
        }

        existing.add(verse);

        state.verses.unshift({
            id: generateId(),
            text: verse,
            usedIn: [],
            created:
                new Date().toISOString(),
            modified:
                new Date().toISOString()
        });

        added += 1;
    });


    if (added) {
        saveState();
        renderLiners();
    }

    return added;
}


/* =========================================================
   IMPORT AS SONG
========================================================= */

function importAsSong(text, filename) {

    const parsed =
        parseSong(text);

    if (!parsed) {
        return false;
    }

    const defaultFolder =
        getUnsortedFolder() ||
        state.folders[0];

    const now =
        new Date().toISOString();

    let songId = generateId();

    while (
        state.songs.some(
            song =>
                song.id === songId
        )
    ) {
        songId = generateId();
    }

    /* Explicit TITLE metadata takes precedence. Otherwise a supported
       text filename may provide the title; lyric text is never used. */
    const filenameTitle =
        titleFromFilename(filename || lastImportFilename || "");

    const song = {
        id: songId,
        title:
            (parsed.title && parsed.title.trim()) ||
            filenameTitle ||
            "Untitled",
        status: "Draft",
        folder:
            defaultFolder
                ? defaultFolder.id
                : null,
        created: now,
        modified: now,
        sections:
            parsed.sections.map(
                section => ({
                    id: generateId(),
                    type: section.type,
                    lyrics:
                        section.lyrics
                            .map(line =>
                                line.trimEnd()
                            )
                            .join("\n")
                })
            )
    };

    state.songs.unshift(song);

    saveState();

    renderCrate();

    return true;
}
/* =========================================================
   OPEN IMPORT MODAL
========================================================= */

function openImportModal() {

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

    importMode = "lines";
    lastImportFilename = "";
    songImportInProgress = false;

    modalTitle.textContent =
        "IMPORT LINES";

    if (confirm) {
        confirm.textContent =
            "IMPORT";
    }

    modalBody.innerHTML = `
        <div class="import-modes">

            <button
                class="import-mode active"
                data-mode="lines"
                type="button"
            >
                LINES
            </button>

            <button
                class="import-mode"
                data-mode="verses"
                type="button"
            >
                VERSES
            </button>

            <button
                class="import-mode"
                data-mode="song"
                type="button"
            >
                SONG
            </button>

        </div>

        <p
            id="import-hint"
            class="import-hint"
        >
            Each non-empty line becomes a ONE LINER.
        </p>

        <textarea
            id="import-text-input"
            class="import-input"
            placeholder="Paste your lines here..."
        ></textarea>

        <div
            id="import-drop-zone"
            class="import-zone"
        >
            OR DROP A .TXT FILE HERE
        </div>

        <button
            id="import-browse"
            class="small-btn"
            type="button"
        >
            CHOOSE FILE
        </button>

        <input
            id="lines-import-file"
            type="file"
            accept=".txt,.md,.markdown,.text,text/plain"
            hidden
        >

        <div
            id="import-result"
            class="import-result"
            role="status"
            aria-live="polite"
        ></div>
    `;


    if (confirm) {

        modalConfirm.set(
            runImport
        );
    }


    openModal();


    setTimeout(() => {

        document
            .getElementById(
                "import-text-input"
            )
            ?.focus();

    }, 50);


    const browse =
        document.getElementById(
            "import-browse"
        );

    const fileInput =
        document.getElementById(
            "lines-import-file"
        );

    const zone =
        document.getElementById(
            "import-drop-zone"
        );

    if (browse && fileInput) {

        browse.addEventListener(
            "click",
            () => {
                fileInput.click();
            }
        );

        fileInput.addEventListener(
            "change",
            event => {

                readImportFile(
                    event.currentTarget.files?.[0]
                );

                event.currentTarget.value = "";
            }
        );
    }

    if (zone) {

        zone.addEventListener(
            "dragover",
            event => {

                event.preventDefault();

                zone.classList.add(
                    "drag-over"
                );
            }
        );

        zone.addEventListener(
            "dragleave",
            () => {

                zone.classList.remove(
                    "drag-over"
                );
            }
        );

        zone.addEventListener(
            "drop",
            event => {

                event.preventDefault();

                zone.classList.remove(
                    "drag-over"
                );

                readImportFile(
                    event.dataTransfer
                        .files?.[0]
                );
            }
        );
    }
}
/* =========================================================
   SET IMPORT MODE
========================================================= */

function setImportMode(
    mode,
    button
) {

    if (
        mode !== "lines" &&
        mode !== "verses" &&
        mode !== "song"
    ) {
        return;
    }

    importMode = mode;


    document
        .querySelectorAll(
            ".import-mode"
        )
        .forEach(btn => {

            btn.classList.toggle(
                "active",
                btn.dataset.mode ===
                mode
            );
        });


    const hints = {
        lines:
            "Each non-empty line becomes a ONE LINER.",

        verses:
            "Blocks separated by blank lines become VERSES.",

        song:
            "Optional TITLE: Song Name, then explicit headers " +
            "like [Verse], Chorus:, VERSE 1 " +
            "or BRIDGE split the song into sections. Ordinary " +
            "ALL-CAPS lines remain lyrics. If no headers " +
            "are found, the text is split on blank lines into " +
            "auto-labelled stanzas."
    };

    const hint =
        document.getElementById(
            "import-hint"
        );

    if (hint) {
        hint.textContent =
            hints[mode];
    }

    const result =
        document.getElementById(
            "import-result"
        );

    if (result) {
        result.className = "import-result";
        result.textContent = "";
    }
}


/* =========================================================
   READ IMPORT FILE
========================================================= */

let lastImportFilename = "";

function showImportResult(status, message) {

    const result =
        document.getElementById("import-result");

    if (!result) {
        return;
    }

    result.className =
        `import-result import-result--${status}`;

    result.textContent = message;
}


function isSupportedImportFile(file) {

    return /\.(txt|md|markdown|text)$/i.test(
        String(file?.name || "")
    );
}


function readImportFile(file) {

    if (!file) {
        return;
    }

    if (!isSupportedImportFile(file)) {
        showImportResult(
            "error",
            "Choose a .txt, .md, .markdown or .text file."
        );
        return;
    }

    lastImportFilename =
        file.name;

    const reader =
        new FileReader();

    reader.onload = function () {

        const input =
            document.getElementById(
                "import-text-input"
            );

        if (input) {
            input.value =
                String(reader.result || "");
        }

        showImportResult(
            "success",
            `Loaded “${file.name}”. Ready to import.`
        );
    };

    reader.onerror = function () {

        lastImportFilename = "";

        const input =
            document.getElementById("import-text-input");

        if (input) {
            input.value = "";
        }

        console.error(
            "Could not read text import file:",
            reader.error
        );

        showImportResult(
            "error",
            "Could not read that file."
        );
    };

    reader.readAsText(file);
}


/* =========================================================
   RUN IMPORT (CONFIRM)
========================================================= */

function runImport() {

    const input =
        document.getElementById(
            "import-text-input"
        );

    const text =
        input?.value || "";

    if (!String(text).trim()) {
        showImportResult(
            "warning",
            "Paste text or choose a supported text file first."
        );
        return;
    }


    /* SONG mode creates a new song and leaves the modal. */

    if (importMode === "song") {

        if (songImportInProgress) {
            return;
        }

        songImportInProgress = true;

        if (importAsSong(text, lastImportFilename)) {
            showImportResult("success", "Song imported.");
            setTimeout(() => {
                songImportInProgress = false;
                closeModal();
            }, 700);

            return;
        }

        songImportInProgress = false;
        showImportResult("warning", "Nothing to import.");
        return;
    }


    const added =
        importMode === "verses"
            ? importVerses(text)
            : importLines(text);


    showImportResult(
        added ? "success" : "warning",
        added
            ? `${added} ${added === 1 ? "item" : "items"} imported.`
            : "Nothing new — everything was already in your library."
    );

    if (added) {
        setTimeout(closeModal, 700);
    }
}


/* =========================================================
   SETUP IMPORT
========================================================= */

function setupImport() {

    document
        .querySelectorAll(
            "[data-import-open]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                openImportModal
            );
        });


    /* -------------------------------------------------
       IMPORT MODE DELEGATION (inside the shared modal)
    -------------------------------------------------- */

    const modalBody =
        document.getElementById(
            "modal-body"
        );

    if (modalBody) {

        delegateClick(
            modalBody,
            ".import-mode",
            (event, button) => {

                setImportMode(
                    button.dataset.mode,
                    button
                );
            }
        );
    }
}
