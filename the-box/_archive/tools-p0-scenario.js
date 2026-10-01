/* Scenario body for tools-p0-check.cjs (temporary file). */

if (typeof saveState === "function") {
    const realSaveState = saveState;

    saveState = function (options) {
        savedStates.push(options || {});
        return realSaveState(options);
    };
} else {
    saveState = function (options) { savedStates.push(options || {}); };
}

["renderAll", "renderCrate", "renderLiners", "renderTrash",
 "renderSearchResults", "renderFolderSongsIfNeeded", "renderSyncStatus",
 "showView", "saveUIState", "hideSectionUndo", "isSignedIn",
 "getUserDocRef"].forEach(name => {

    if (eval("typeof " + name) !== "function") {
        globalThis[name] = function () {};
    }
});

if (typeof formatDate !== "function") {
    formatDate = function () { return "01 SEP 2026"; };
}

if (typeof escapeHTML !== "function") {
    escapeHTML = function (value) {
        return String(value === undefined || value === null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    };
}

if (typeof escapeAttribute !== "function") {
    escapeAttribute = function (value) {
        return escapeHTML(value);
    };
}

state = {
    songs: [{
        id: "song-1",
        title: "GHOST LINE",
        status: "DRAFT",
        created: "2026-09-01T00:00:00.000Z",
        modified: "2026-09-01T00:00:00.000Z",
        sections: [
            { id: "sec-A", name: "VERSE 01", type: "VERSE", lyrics: "old A" },
            { id: "sec-B", name: "CHORUS 01", type: "CHORUS", lyrics: "old B" }
        ]
    }],
    folders: [],
    liners: [],
    verses: [],
    trash: [],
    deletedRecordIds: {},
    updatedAt: "2026-09-01T00:00:00.000Z",
    revision: 1
};

currentSongId = "song-1";
currentSectionId = null;
liveEditActive = false;
renderDeferredWhileEditing = false;

renderRedRoomSafe(true);

check("editor rendered from state",
    editorOf("sec-A").value === "old A" && editorOf("sec-B").value === "old B",
    [editorOf("sec-A").value, editorOf("sec-B").value]);

/* ---- 1. the writer is inside card A and types the newest word ---- */

document.activeElement = editorOf("sec-A");
beginLiveEdit();
setCurrentSection("sec-A");

editorOf("sec-A").value = "old A NEW WORD";
updateSectionLyrics("sec-A", "old A NEW WORD");

/* the snapshot a push captured BEFORE that keystroke reached it, now
   coming back from the cloud with an unrelated remote change */
const stale = JSON.parse(JSON.stringify(state));
stale.songs[0].sections[0].lyrics = "old A";
stale.songs[0].modified = "2026-09-01T00:00:00.000Z";
stale.liners = [{
    id: "liner-1",
    text: "remote idea",
    created: "2026-09-02T00:00:00.000Z"
}];
stale.updatedAt = "2026-09-02T00:00:00.000Z";
stale.revision = 2;

/* ---- 2. focus hands off card A -> card B (blur then focusin) ---- */

const rebuildsBefore = container.rebuilds;
const nextEditor = editorOf("sec-B");

/* exactly the rule app.js applies on focusout */
if (!isRedRoomEditorTarget(nextEditor)) {
    endLiveEdit();
}

document.activeElement = nextEditor;
beginLiveEdit();
setCurrentSection("sec-B");

check("card-to-card handoff rebuilds nothing",
    container.rebuilds === rebuildsBefore,
    container.rebuilds);

check("handoff keeps live-edit protection",
    isLiveEdit(), isLiveEdit());

check("card A DOM still holds the newest word after handoff",
    editorOf("sec-A").value === "old A NEW WORD",
    editorOf("sec-A").value);

/* ---- 3. the stale adoption lands in the middle of the handoff ---- */

adoptMergedState(stale);

check("newest word survives a stale adoption",
    getCurrentSong().sections[0].lyrics === "old A NEW WORD",
    getCurrentSong().sections[0].lyrics);

check("unrelated remote record still merges in",
    (state.liners || []).length === 1,
    (state.liners || []).length);

check("recovered text is persisted, not silent-only",
    savedStates.some(entry => !entry.silent),
    savedStates.length);

check("adoption while editing never rebuilds the editor DOM",
    container.rebuilds === rebuildsBefore,
    container.rebuilds);

/* ---- 4. background refresh must not repaint a protected card ---- */

renderSections(false);

check("deferred card refresh leaves the protected card alone",
    editorOf("sec-A").value === "old A NEW WORD",
    editorOf("sec-A").value);

/* ---- 5. typing continues in card B, another stale adoption arrives -- */

editorOf("sec-B").value = "old B SECOND CARD";
updateSectionLyrics("sec-B", "old B SECOND CARD");

const stale2 = JSON.parse(JSON.stringify(state));
stale2.songs[0].sections[1].lyrics = "old B";
stale2.songs[0].modified = "2026-09-01T00:00:00.000Z";

adoptMergedState(stale2);

check("second card newest word survives its own adoption",
    getCurrentSong().sections[1].lyrics === "old B SECOND CARD",
    getCurrentSong().sections[1].lyrics);

check("first card still intact after the second adoption",
    getCurrentSong().sections[0].lyrics === "old A NEW WORD",
    getCurrentSong().sections[0].lyrics);

check("a kebab button is not treated as an editor",
    isRedRoomEditorTarget(makeElButton()) === false);

/* ---- 6. the writer really leaves: reconcile and paint newest text --- */

/* ---- 6. clicking a control inside the card must not rebuild the card
          list out from under the pointer ---- */

const kebab = makeElButton();
cardOf("sec-A").append(kebab);

document.activeElement = kebab;
endLiveEdit();

setTimeout(function () {

    check("click on a card control keeps the cards intact",
        container.rebuilds === rebuildsBefore,
        container.rebuilds);

    check("protected text still buffered while the click is pending",
        getCurrentSong().sections[0].lyrics === "old A NEW WORD" &&
        getCurrentSong().sections[1].lyrics === "old B SECOND CARD",
        JSON.stringify(getCurrentSong().sections.map(s => s.lyrics)));

    /* ---- 7. the writer really leaves: reconcile and paint ---- */

    document.activeElement = null;
    endLiveEdit();

    setTimeout(function () {

    check("reconciliation rebuilt after the real blur",
        container.rebuilds > rebuildsBefore,
        container.rebuilds);

    check("card A painted with the newest word",
        editorOf("sec-A") && editorOf("sec-A").value === "old A NEW WORD",
        editorOf("sec-A") && editorOf("sec-A").value);

    check("card B painted with the newest word",
        editorOf("sec-B") && editorOf("sec-B").value === "old B SECOND CARD",
        editorOf("sec-B") && editorOf("sec-B").value);

    check("ledger drained once the state carried the text",
        localLyricEdits.size === 0,
        localLyricEdits.size);

    check("title edit protection released after reconcile",
        localTitleEdit === null,
        localTitleEdit);

    const persisted =
        JSON.parse(localStorage.getItem(DATABASE_KEY) || "{}");

    const persistedSong =
        (persisted.songs || []).find(song => song.id === "song-1") || {};

    const persistedLyrics =
        (persistedSong.sections || []).map(section => section.lyrics);

    check("newest text reached local storage",
        persistedLyrics.indexOf("old A NEW WORD") !== -1 &&
        persistedLyrics.indexOf("old B SECOND CARD") !== -1,
        persistedLyrics);

    /* ---- 8. the push path itself: a keystroke typed while the
              transaction was open must survive reconciliation ---- */

    const baseline = buildSyncBaseline(state);
    const captured = JSON.parse(JSON.stringify(state));

    const cloudSide = JSON.parse(JSON.stringify(state));

    cloudSide.liners = (cloudSide.liners || []).concat([{
        id: "liner-2",
        text: "remote liner",
        created: "2026-09-03T00:00:00.000Z"
    }]);

    const committed = mergeSyncState(captured, cloudSide, baseline);

    /* the writer typed AFTER the snapshot was taken */
    getCurrentSong().sections[0].lyrics = "old A LATEST WORD";
    touchSong(getCurrentSong());

    const reconciled =
        mergeSyncState(captureSyncState(state), committed, baseline);

    check("push reconciliation keeps the keystroke typed during the round trip",
        reconciled.songs[0].sections[0].lyrics === "old A LATEST WORD",
        reconciled.songs[0].sections[0].lyrics);

    check("push reconciliation still keeps the remote record",
        (reconciled.liners || []).some(liner => liner.id === "liner-2"),
        (reconciled.liners || []).map(liner => liner.id));

        report();
    }, 0);
}, 0);

