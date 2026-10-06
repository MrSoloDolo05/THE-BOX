/* =========================================================
   DATABASE / STORAGE
========================================================= */

const DATABASE_KEY = "the_box_app_state";

const UI_STATE_KEY = "the_box_ui_state";

const REVISION_KEY = "the_box_revision_clock";

/* Per-device "last state known to be in sync with the cloud".
   Lives in localStorage only (never inside the synced document)
   and powers the 3-way merge in sync.js. */
const SYNC_BASELINE_KEY = "the_box_sync_baseline";


/* =========================================================
   REVISION CLOCK
   A persistent monotonic counter used to version the whole
   cloud state document. Lives in localStorage (not inside
   the state document) so CLEAR / fresh installs can never
   regress the counter and resurrect stale cloud snapshots.
========================================================= */

function getRevisionClock() {

    try {

        const raw =
            localStorage.getItem(
                REVISION_KEY
            );

        const value =
            parseInt(raw || "0", 10);

        /* Never go backwards. */
        return (
            Number.isFinite(value) &&
            value >= 0
        )
            ? value
            : 0;

    } catch (error) {

        console.error(
            "Could not read revision clock:",
            error
        );

        return 0;
    }
}


function bumpRevisionClock() {

    const next =
        getRevisionClock() + 1;

    try {

        localStorage.setItem(
            REVISION_KEY,
            String(next)
        );

    } catch (error) {

        console.error(
            "Could not persist revision clock:",
            error
        );
    }

    return next;
}


/* =========================================================
   UI STATE (current view, persisted across refreshes)
========================================================= */

function saveUIState() {

    try {

        localStorage.setItem(
            UI_STATE_KEY,
            JSON.stringify({
                view: currentView,
                songId: currentSongId,
                folderId: currentFolderId
            })
        );

    } catch (error) {

        console.error(
            "Could not save UI state:",
            error
        );
    }
}


function loadUIState() {

    try {

        const saved =
            localStorage.getItem(UI_STATE_KEY);

        if (!saved) {
            return null;
        }

        return JSON.parse(saved);

    } catch (error) {

        console.error(
            "Could not load UI state:",
            error
        );

        return null;
    }
}


/* =========================================================
   DEFAULT STATE
========================================================= */

function createDefaultState() {
    return {
        revision: 0,

        updatedAt:
            new Date().toISOString(),

        songs: [],

        folders: [
            {
                id: generateId(),
                name: "UNSORTED",

                modified:
                    new Date().toISOString()
            }
        ],

        liners: [],

        verses: [],

        trash: [],

        /* Per-record deletion tombstones: id -> ISO timestamp.
           The single source of truth for "this record is deleted",
           and it survives trash being emptied. */
        deletedRecordIds: {},

        /* Permanent deletions: id -> ISO timestamp. A purge is
           TERMINAL: the record was deleted forever and must never
           be rebuilt as a trash row nor resurrected as a live
           record. The merge only ever ADDS purge markers, so a stale
           device can never undo one. */
        purgedRecordIds: {}
    };
}


/* =========================================================
   SAVE STATE
   Every normal save bumps the document revision (making it
   strictly newer than any previous cloud snapshot) and
   schedules a background push to Firestore.

   saveState({ silent: true }) ONLY persists locally and is
   used when adopting remote state so we never re-bump the
   revision we just received (avoids a sync echo loop).
========================================================= */

function saveState(options) {
    try {

        const silent =
            options &&
            options.silent === true;

        if (!silent) {

            state.revision =
                bumpRevisionClock();

            state.updatedAt =
                new Date().toISOString();
        }

        localStorage.setItem(
            DATABASE_KEY,
            JSON.stringify(state)
        );

        const saveStatus =
            document.getElementById("save-status");

        if (saveStatus) {
            saveStatus.textContent = "SAVED";
        }

        /* Fire-and-forget cloud sync when signed in. */
        if (
            !silent &&
            typeof isSignedIn === "function" &&
            isSignedIn() &&
            typeof pushState === "function"
        ) {
            clearTimeout(cloudPushTimer);
            if (window.__TR && typeof window.__TR.record === "function") {
                window.__TR.record("push scheduled", {
                    scheduledDelayMs: 500,
                    signedIn: isSignedIn()
                });
            }
            cloudPushTimer = setTimeout(() => {
                if (window.__TR && typeof window.__TR.record === "function") {
                    window.__TR.record("scheduled push fired", {
                        signedIn: isSignedIn()
                    });
                }
                pushState();
            }, 500);
        } else if (
            !silent &&
            window.__TR &&
            typeof window.__TR.record === "function"
        ) {
            window.__TR.record("push not scheduled", {
                signedIn:
                    typeof isSignedIn === "function"
                        ? isSignedIn()
                        : false,
                authCheckAvailable:
                    typeof isSignedIn === "function"
            });
        }

    } catch (error) {
        console.error(
            "Could not save application state:",
            error
        );
    }
}


/* =========================================================
   LOAD STATE
========================================================= */

function loadState() {
    try {
        const saved =
            localStorage.getItem(DATABASE_KEY);

        if (!saved) {
            state = createDefaultState();
            saveState();
            return;
        }

        const parsed =
            JSON.parse(saved);

        state = {
            revision:
                Number.isFinite(parsed.revision)
                    ? parsed.revision
                    : 0,

            updatedAt:
                parsed.updatedAt ||
                new Date().toISOString(),

            songs: Array.isArray(parsed.songs)
                ? parsed.songs
                : [],

            folders: Array.isArray(parsed.folders)
                ? parsed.folders
                : [],

            liners: Array.isArray(parsed.liners)
                ? parsed.liners
                : [],

            verses: Array.isArray(parsed.verses)
                ? parsed.verses
                : [],

            trash: Array.isArray(parsed.trash)
                ? parsed.trash
                : [],

            /* Per-record deletion tombstones. Absent in documents
               written before the per-record merge existed, in which
               case it starts empty and every existing record counts
               as alive. */
            deletedRecordIds:
                parsed.deletedRecordIds &&
                typeof parsed.deletedRecordIds === "object"
                    ? parsed.deletedRecordIds
                    : {},

            /* Absent in every document written before purges
               existed; starts empty, so nothing counts as
               permanently deleted until the user does it. */
            purgedRecordIds:
                parsed.purgedRecordIds &&
                typeof parsed.purgedRecordIds === "object"
                    ? parsed.purgedRecordIds
                    : {}
        };


        /* -------------------------------------------------
           FOLDER MIGRATION
        ------------------------------------------------- */

        if (!state.folders.length) {
            state.folders.push({
                id: generateId(),
                name: "UNSORTED",

                modified:
                    new Date().toISOString()
            });
        }


        state.folders.forEach(folder => {
            if (!folder.id) {
                folder.id = generateId();
            }

            /* Stamping existing folders here too would NOT lose data:
               the merge compares staleness by baseline change, not by
               modified age. This is still scoped to folders that
               genuinely lack a stamp. */
            if (!folder.modified) {
                folder.modified =
                    state.updatedAt ||
                    new Date().toISOString();
            }

            if (
                typeof folder.name !== "string" ||
                !folder.name.trim()
            ) {
                folder.name = "UNSORTED";
            }

            return;
        });


        /* -------------------------------------------------
           SONG MIGRATION
        ------------------------------------------------- */

        state.songs.forEach(song => {

            if (!song.id) {
                song.id = generateId();
            }

            if (
                typeof song.title !== "string"
            ) {
                /* Missing (not just empty) titles get a
                   placeholder name for display until the
                   user types something. An empty string is
                   left empty: the UI shows "UNTITLED" via
                   the input placeholder instead. */
                song.title = "UNTITLED";
            }

            if (!song.status) {
                song.status = "Draft";
            }

            if (!song.created) {
                song.created =
                    new Date().toISOString();
            }

            if (!song.modified) {
                song.modified = song.created;
            }

            if (!Array.isArray(song.sections)) {
                song.sections = [];
            }

            if (!song.folder) {
                const unsorted =
                    state.folders.find(
                        folder =>
                            folder.name === "UNSORTED"
                    );

                if (unsorted) {
                    song.folder = unsorted.id;
                }
            }

            song.sections.forEach(section => {

                if (!section.id) {
                    section.id =
                        generateId();
                }

                if (!section.type) {
                    section.type = "VERSE";
                }

                if (
                    typeof section.lyrics !==
                    "string"
                ) {
                    section.lyrics = "";
                }
            });
        });


        /* -------------------------------------------------
           LINER MIGRATION
        ------------------------------------------------- */

        state.liners.forEach(liner => {

            if (!liner.id) {
                liner.id = generateId();
            }

            if (
                typeof liner.text !== "string"
            ) {
                liner.text = "";
            }

            if (!Array.isArray(liner.usedIn)) {
                liner.usedIn = [];
            }

            if (!liner.created) {
                liner.created =
                    new Date().toISOString();
            }
        });


        /* -------------------------------------------------
           VERSE MIGRATION
        ------------------------------------------------- */

        state.verses.forEach(verse => {

            if (!verse.id) {
                verse.id = generateId();
            }

            if (
                typeof verse.text !== "string"
            ) {
                verse.text = "";
            }

            if (!Array.isArray(verse.usedIn)) {
                verse.usedIn = [];
            }

            if (!verse.created) {
                verse.created =
                    new Date().toISOString();
            }
        });


        /* -------------------------------------------------
           SYNC MIGRATION
           Additive and idempotent: stamps `modified` on legacy
           records and creates the deletion-tombstone map. See
           migrateSyncMetadata() for the exact rules.
        ------------------------------------------------- */

        migrateSyncMetadata(state);

        saveState();

    } catch (error) {

        console.error(
            "Could not load application state:",
            error
        );

        state = createDefaultState();

        saveState();
    }
}


/* =========================================================
   SYNC METADATA MIGRATION  (additive and idempotent)

   Gives every record the metadata the per-record merge needs
   WITHOUT changing, reordering or dropping anything the user
   already has.

   Rules:
     * a record that already has `modified` keeps it exactly
       as-is;
     * a record without one inherits its own `created`, falling
       back to the document `updatedAt`, so legacy records all
       share one stable, deterministic stamp rather than looking
       as though they were all just edited;
     * deletedRecordIds starts empty, so no existing record is
       ever treated as deleted by the upgrade;
     * existing trash entries gain `deletedItemId` plus a
       `modified`, so they keep being listed in trash;
     * nothing is ever removed.

   Safe to run any number of times.
========================================================= */

function migrateSyncMetadata(targetState) {

    if (!targetState || typeof targetState !== "object") {
        return targetState;
    }

    if (
        !targetState.deletedRecordIds ||
        typeof targetState.deletedRecordIds !== "object"
    ) {
        targetState.deletedRecordIds = {};
    }

    const fallback =
        targetState.updatedAt ||
        new Date().toISOString();

    ["songs", "folders", "liners", "verses"].forEach(collection => {

        (targetState[collection] || []).forEach(record => {

            if (!record) {
                return;
            }

            if (!record.modified) {
                record.modified =
                    record.created || fallback;
            }
        });
    });


    (targetState.trash || []).forEach(item => {

        if (!item || typeof item !== "object") {
            return;
        }

        /* The record's own id identifies the tombstone. Legacy
           entries only wrapped the record in `data`, so derive the
           id from there once and keep it. */
        if (!item.deletedItemId && item.data && item.data.id) {
            item.deletedItemId = item.data.id;
        }

        /* Deliberately falls back to the wrapped record's own
           timestamp, never to "now". That keeps a legacy tombstone
           in step with the copy it describes instead of making it
           look newer than a restore. */
        if (!item.modified) {

            item.modified =
                (item.data && item.data.modified) ||
                (item.data && item.data.created) ||
                fallback;
        }
    });


    /* A tombstone against the UNSORTED folder would delete the one
       folder the application guarantees to have. */
    const unsortedFolder =
        (targetState.folders || []).find(
            folder => folder && folder.name === "UNSORTED"
        );

    if (unsortedFolder) {
        delete targetState.deletedRecordIds[unsortedFolder.id];
    }

    return targetState;
}


/* =========================================================
   CLEAR DATABASE
========================================================= */

function clearDatabase() {

    localStorage.removeItem(
        DATABASE_KEY
    );

    state = createDefaultState();

    /* Drop this device's sync baseline too: it describes a
       library that no longer exists, and a stale baseline would
       make the next merge resurrect deleted records. */
    clearSyncBaseline();

    currentSongId = null;
    currentSectionId = null;
    currentFolderId = null;

    /* Bump the revision and push the cleared state so the
       cloud document also resets. Without this, a stale
       higher-revision cloud snapshot would win the next
       merge and resurrect everything the user deleted. */
    saveState();

    renderAll();
    showView("crate");
}


/* =========================================================
   EXPORT DATABASE
========================================================= */

function exportDatabase() {

    const data =
        JSON.stringify(
            state,
            null,
            2
        );

    const blob =
        new Blob(
            [data],
            {
                type: "application/json"
            }
        );

    const url =
        URL.createObjectURL(blob);

    const link =
        document.createElement("a");

    link.href = url;

    link.download =
        "the-box-backup.json";

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);
}


/* =========================================================
   IMPORT DATABASE
========================================================= */

function importDatabase(event) {

    const file =
        event.target.files?.[0];

    if (!file) {
        return;
    }

    const reader =
        new FileReader();

    reader.onload = function () {

        try {

            const imported =
                JSON.parse(
                    reader.result
                );

            if (
                !imported ||
                !Array.isArray(imported.songs) ||
                !Array.isArray(imported.folders) ||
                !Array.isArray(imported.liners) ||
                !Array.isArray(imported.trash)
            ) {

                alert(
                    "Invalid THE BOX database."
                );

                return;
            }

            /* Older backups may not have verses yet. */
            if (!Array.isArray(imported.verses)) {
                imported.verses = [];
            }

            state = imported;

            /* Run migration logic again */
            localStorage.removeItem(
                DATABASE_KEY
            );

            /* An import replaces the library wholesale, so this
               device's sync baseline is meaningless afterwards. */
            clearSyncBaseline();

            saveState();

            currentSongId = null;
            currentSectionId = null;
            currentFolderId = null;

            loadState();

            renderAll();

            showView("crate");

            alert(
                "Database imported successfully."
            );

        } catch (error) {

            console.error(error);

            alert(
                "Could not import database."
            );
        }
    };

    reader.readAsText(file);

    /* Allow the same file to be selected again */
    event.target.value = "";



}
/* =========================================================
   SYNC HELPERS
   Used by the per-record merge in sync.js
   ========================================================= */

function getDeletedRecordIds() {
    return state.deletedRecordIds || {};
}

function setDeletedRecordIds(map) {
    state.deletedRecordIds = map && typeof map === "object" ? map : {};
}

function isRecordDeleted(recordId) {
    const ids = getDeletedRecordIds();
    return recordId in ids;
}

function deletionStampFor(recordId) {

    let newest = "";

    SYNC_LIVE_COLLECTIONS.forEach(collection => {

        (state[collection] || []).forEach(record => {

            if (record && record.id === recordId && record.modified) {
                newest =
                    record.modified > newest
                        ? record.modified
                        : newest;
            }
        });
    });

    let stamp =
        new Date().toISOString();

    /* Same-millisecond clocks are common on fast devices. A tombstone
       that merely ties the record's modified loses the strict-newer
       check in the merge and the stale copy resurrects. */
    if (stamp <= newest) {
        stamp = newest + ".1";
    }

    return stamp;
}

function markRecordDeleted(recordId) {
    const ids = getDeletedRecordIds();
    ids[recordId] = deletionStampFor(recordId);
    setDeletedRecordIds(ids);
}

function unmarkRecordDeleted(recordId) {
    const ids = getDeletedRecordIds();
    delete ids[recordId];
    setDeletedRecordIds(ids);
}


/* ---------------------------------------------------------
   PERMANENT DELETION (purge)

   A purge is TERMINAL and is additive only. It records "this
   record was deleted forever" WITHOUT removing the tombstone,
   which is what makes it durable: the merge can only add purge
   markers, so a device that never saw the purge, or that still
   holds a stale live copy, cannot resurrect the record or
   rebuild its trash row.
--------------------------------------------------------- */

function isPurged(recordId) {
    const ids = state.purgedRecordIds || {};
    return recordId in ids;
}

function getPurgedRecordIds() {
    return state.purgedRecordIds || {};
}

function purgeRecord(recordId) {

    if (!recordId || isPurged(recordId)) {
        return;
    }

    /* The tombstone is deliberately left in place. A purge adds a
       meaning to that tombstone; it does not erase it. */
    markRecordDeleted(recordId);

    state.purgedRecordIds[recordId] =
        deletionStampFor(recordId);
}

function touchRecord(record) {
    if (record) {
        record.modified = new Date().toISOString();
    }
}


/* =========================================================
   SYNC SUPPORT (per-record merge)
   Backing helpers for the per-record merge in sync.js.
   Nothing here deletes or rewrites user data: these helpers
   only stamp timestamps and maintain a compact per-device
   baseline used for 3-way change detection.
========================================================= */

/* Every collection whose records are merged individually. */
const SYNC_COLLECTIONS = [
    "songs",
    "folders",
    "liners",
    "verses",
    "trash"
];

/* Live collections (trash is excluded: it holds tombstones). */
const SYNC_LIVE_COLLECTIONS = [
    "songs",
    "folders",
    "liners",
    "verses"
];


/* Bump `modified` on every live copy of a record id. Used when a
   record is restored from trash so that the restored copy always
   outranks the tombstone that marked it deleted. */
function touchLiveRecord(recordId) {

    const stamp = new Date().toISOString();

    SYNC_LIVE_COLLECTIONS.forEach(collection => {

        (state[collection] || []).forEach(record => {

            if (record && record.id === recordId) {
                record.modified = stamp;
            }
        });
    });
}


/* ---------------------------------------------------------
   CONTENT DIGEST
   Structure-aware FNV-1a hash of a record. Object keys are
   sorted before hashing, so a Firestore round trip that
   reorders fields can never look like a user edit. No large
   intermediate string is built, keeping this cheap even for
   libraries full of lyrics.
--------------------------------------------------------- */

function mixHash(text, hash) {

    for (let index = 0; index < text.length; index++) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }

    return hash >>> 0;
}

function digestValue(value, hash) {

    if (value === null) {
        return mixHash("n", hash);
    }

    const type = typeof value;

    if (type === "undefined") {
        return mixHash("u", hash);
    }

    if (type === "number" || type === "boolean") {
        return mixHash("p" + String(value), hash);
    }

    if (type === "string") {
        /* Length is mixed in separately so two different strings
           of different lengths cannot hash to the same value. */
        hash = mixHash("s" + value.length, hash);
        return mixHash(value, hash);
    }

    if (Array.isArray(value)) {

        hash = mixHash("[" + value.length, hash);

        value.forEach(item => {
            hash = digestValue(item, hash);
        });

        return mixHash("]", hash);
    }

    if (type === "object") {

        const keys = Object.keys(value).sort();

        hash = mixHash("{" + keys.length, hash);

        keys.forEach(key => {
            hash = mixHash(key, hash);
            hash = digestValue(value[key], hash);
        });

        return mixHash("}", hash);
    }

    return mixHash("x", hash);
}

function digestRecord(record) {

    if (!record) {
        return null;
    }

    return digestValue(record, 0x811c9dc5).toString(16);
}



/* ---------------------------------------------------------
   BASELINE (per device, localStorage only)
   A map of collection -> { recordId: digest }, plus the
   deletion tombstones last known to be in the cloud. This is
   what lets the merge distinguish
     "this device changed the record"   from
     "this device is simply out of date".
   It is intentionally NOT part of the synced document.
--------------------------------------------------------- */

function buildSyncBaseline(snapshot) {

    const source = snapshot || state;
    const baseline = {};

    /* Scoped to the account: signing a different user in on the same
       browser must not inherit the previous user's digests. */
    baseline.uid =
        currentUser && currentUser.uid
            ? currentUser.uid
            : null;

    SYNC_COLLECTIONS.forEach(collection => {

        const map = {};

        (source[collection] || []).forEach(record => {

            if (record && record.id) {
                map[record.id] = digestRecord(record);
            }
        });

        baseline[collection] = map;
    });

    baseline.deletedRecordIds = Object.assign(
        {},
        source.deletedRecordIds || {}
    );

    baseline.purgedRecordIds = Object.assign(
        {},
        source.purgedRecordIds || {}
    );

    return baseline;
}

function getSyncBaseline() {

    try {

        const raw =
            localStorage.getItem(SYNC_BASELINE_KEY);

        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw);

        if (!parsed || typeof parsed !== "object") {
            return null;
        }

        /* A baseline belonging to another account is worse than no
           baseline at all: its digests describe a different library. */
        const uid =
            currentUser && currentUser.uid
                ? currentUser.uid
                : null;

        if (parsed.uid !== uid) {
            return null;
        }

        return parsed;

    } catch (error) {

        console.error(
            "Could not read sync baseline:",
            error
        );

        return null;
    }
}

function setSyncBaseline(baseline) {

    try {

        localStorage.setItem(
            SYNC_BASELINE_KEY,
            JSON.stringify(baseline)
        );

    } catch (error) {

        /* Quota or private-mode failure. The merge keeps working;
           it simply falls back to per-record last-writer-wins for
           records this device cannot prove it did not touch. */
        console.error(
            "Could not persist sync baseline:",
            error
        );
    }
}

function clearSyncBaseline() {

    try {
        localStorage.removeItem(SYNC_BASELINE_KEY);
    } catch (error) {

        console.error(
            "Could not clear sync baseline:",
            error
        );
    }
}


/* ---------------------------------------------------------
   STATE SNAPSHOT
   Copy of the syncable collections so a merge can run without
   observing mid-flight UI mutations.
--------------------------------------------------------- */

function captureSyncState(source) {

    const from = source || state;
    const snapshot = {};

    SYNC_COLLECTIONS.forEach(collection => {
        snapshot[collection] = from[collection] || [];
    });

    snapshot.deletedRecordIds = Object.assign(
        {},
        from.deletedRecordIds || {}
    );

    snapshot.purgedRecordIds = Object.assign(
        {},
        from.purgedRecordIds || {}
    );

    snapshot.updatedAt = from.updatedAt || "";
    snapshot.revision = Number(from.revision || 0);

    return snapshot;
}
