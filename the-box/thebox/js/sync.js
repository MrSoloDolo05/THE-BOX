/* =========================================================
   FIREBASE SYNC ADAPTER
   Local-first with cloud sync. Reads/writes localStorage
   first, then syncs to Firestore in the background.
========================================================= */

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCxg6zyxjrtcECJ91X-HWXv_zQzMM1jn5g",
    authDomain: "the-box-6ce7b.firebaseapp.com",
    projectId: "the-box-6ce7b",
    storageBucket: "the-box-6ce7b.firebasestorage.app",
    messagingSenderId: "67049526059",
    appId: "1:67049526059:web:f2eaa307bc2af6f299eb6e"
};


let firebaseApp = null;
let firebaseAuth = null;
let firebaseDb = null;
let firebaseUnsubscribe = null;

let currentUser = null;
let syncStatus = "offline";
let lastPushedSignature = null;


/* =========================================================
   SYNC STATUS
========================================================= */

function getSyncStatus() {
    return syncStatus;
}

function setSyncStatus(status) {
    syncStatus = status;
    renderSyncStatus();
}

function renderSyncStatus() {
    const el = document.getElementById("sync-status");
    if (!el) return;

    const labels = {
        offline: "OFFLINE",
        syncing: "SYNCING...",
        synced: "SYNCED",
        error: "SYNC ERROR"
    };

    el.textContent = labels[syncStatus] || "OFFLINE";
    el.className = "sync-status " + syncStatus;
}


/* =========================================================
   AUTH BUTTON
========================================================= */

function updateAuthButton() {
    const button = document.getElementById("auth-button");
    if (!button) return;

    if (isSignedIn()) {
        button.textContent = "SIGN OUT";
        button.classList.add("signed-in");
    } else {

    /* The app now requires manual login triggers. On load we
       only observe the Firebase auth state and update the UI;
       we never attempt to silently sign the user in. */

        button.textContent = "SIGN IN WITH GOOGLE";
        button.classList.remove("signed-in");
    }
}

function getCurrentUser() {
    return currentUser;
}

function isSignedIn() {
    return currentUser !== null;
}


/* =========================================================
   AUTH
========================================================= */

async function initAuth() {
    if (!firebaseAuth) {
        return;
    }


    /* The app now requires manual login triggers. On load we
       only observe the Firebase auth state and update the UI;
       we never attempt to silently sign the user in. */
    firebaseAuth.onAuthStateChanged(
        async (user) => {

            if (user) {

                currentUser = user;
                updateAuthButton();
                setSyncStatus("syncing");

                try {
                    await pullState();
                } catch (error) {
                    console.error(
                        "Auth state pull failed:",
                        error
                    );
                }

                startListening();
                setSyncStatus("synced");

            } else {

                currentUser = null;
                updateAuthButton();
                stopListening();
                setSyncStatus("offline");
            }
        }
    );
}

async function signInWithGoogle() {
    if (!firebaseAuth) return null;

    const provider = new firebase.auth.GoogleAuthProvider();

    try {
        setSyncStatus("syncing");
        const result = await firebaseAuth.signInWithPopup(provider);

        currentUser = result.user;
        updateAuthButton();

        setSyncStatus("syncing");
        await pullState();
        startListening();
        setSyncStatus("synced");

        return result.user;
    } catch (error) {
        console.error("Sign in failed:", error);
        setSyncStatus("error");
        updateAuthButton();
        return null;
    }
}

async function signOut() {
    if (!firebaseAuth) return;

    stopListening();
    await firebaseAuth.signOut();
    currentUser = null;
    updateAuthButton();
    setSyncStatus("offline");
}

/* =========================================================
   FIRESTORE DOCUMENT PATH
========================================================= */

function getUserDocRef() {
    if (!firebaseDb || !currentUser) return null;
    return firebaseDb.collection("users").doc(currentUser.uid);
}


/* =========================================================
   PUSH / PULL
========================================================= */

/* Push is serialised: the saveState debounce timer and a merge
   triggered push could otherwise open two transactions at once. */
let pushInFlight = null;
let pushPending = false;


async function pushState() {
    if (!isSignedIn()) return;

    const docRef = getUserDocRef();
    if (!docRef) return;

    if (pushInFlight) {

        /* A push is already running. Queue exactly one more so
           edits made while the transaction was open still reach
           the cloud. */
        pushPending = true;

        return pushInFlight.task;
    }

    const task = (async () => {
        try {

            setSyncStatus("syncing");

            await runPushTransaction(docRef);

            setSyncStatus("synced");

        } catch (error) {

            console.error("Push failed:", error);

            setSyncStatus("error");
        }
    })();

    pushInFlight = { task };

    await task;

    pushInFlight = null;

    if (pushPending) {
        pushPending = false;
        await pushState();
    }
}


/* Read the cloud document, merge it with the local state record by
   record, and write the merged result back — all inside a single
   Firestore transaction. The transaction is what makes two devices
   pushing at the same time safe: the second transaction reads the
   first one's committed document and merges on top of it instead of
   overwriting it. */
async function runPushTransaction(docRef) {

    const localSnapshot =
        captureSyncState(state);

    const baseline =
        getSyncBaseline();

    let mergedState = null;

    await firebaseDb.runTransaction(async (transaction) => {

        const doc = await transaction.get(docRef);

        const cloudState =
            doc.exists &&
            doc.data() &&
            doc.data().state
                ? doc.data().state
                : null;

        mergedState = mergeSyncState(
            localSnapshot,
            cloudState,
            baseline
        );

        transaction.set(
            docRef,
            {
                state: mergedState,
                updatedAt:
                    firebase.firestore.FieldValue.serverTimestamp()
            },
            { merge: true }
        );
    });

    /* Adopt exactly what the cloud now holds so that every device
       converges on the same document. */
    adoptMergedState(mergedState);

    rememberSyncedSignature(mergedState);

    setSyncBaseline(
        buildSyncBaseline(mergedState)
    );
}

async function pullState() {
    if (!isSignedIn()) return;

    const docRef = getUserDocRef();
    if (!docRef) return;

    try {
        setSyncStatus("syncing");

        const doc = await docRef.get();

        const cloudState =
            doc.exists &&
            doc.data() &&
            doc.data().state
                ? doc.data().state
                : null;

        if (!cloudState) {

            /* First time this account has ever synced. */
            await pushState();

            setSyncStatus("synced");

            return;
        }

        const mergedState = mergeSyncState(
            captureSyncState(state),
            cloudState,
            getSyncBaseline()
        );

        adoptMergedState(mergedState);

        rememberSyncedSignature(mergedState);

        setSyncBaseline(
            buildSyncBaseline(mergedState)
        );

        /* The merge may have produced records the cloud has never
           seen (created on this device while offline). Push so the
           other devices receive them. Uses a content digest, not
           the raw JSON, so key ordering can never cause a push
           storm. */
        if (
            stateDigest(mergedState) !==
            stateDigest(cloudState)
        ) {
            await pushState();
            return;
        }

        setSyncStatus("synced");

    } catch (error) {
        console.error("Pull failed:", error);
        setSyncStatus("error");
    }
}


/* =========================================================
   PER-RECORD SYNCHRONISATION MERGE
=========================================================

   The cloud document `users/{uid}` is still ONE document. Inside
   it, records are merged INDIVIDUALLY, keyed by record id:

     * songs, folders, liners, verses  -> live records
     * trash                           -> deletion tombstones
     * deletedRecordIds                -> durable deletion markers

   The conflict unit is therefore a single record, never the whole
   library. Two devices that touch different records can both win.

   CHANGE DETECTION IS 3-WAY
   -------------------------
   A plain 2-way "newer modified wins" merge cannot tell

     "this device edited the record"   (must win)

   apart from

     "this device has simply not heard
      about the other device's edit"   (must lose)

   because both look like "local modified is older / equal".

   To separate them the merge takes three inputs:

     1. LOCAL   - this device's current state
     2. CLOUD   - the current server state
     3. BASE    - the state this device last knew to be in the
                  cloud (a digest map kept in localStorage only;
                  it is never part of the synced document)

   Given those, the per-record decision is deterministic:

     localDigest  = digest(local record)
     cloudDigest  = digest(cloud record)
     baseDigest   = digest at last successful sync

     localChanged = localDigest !== baseDigest   (we edited it)
     cloudChanged = cloudDigest !== baseDigest   (someone else did)

     localChanged && cloudChanged -> CONFLICT -> last writer wins
                                     on `modified`, ties broken
                                     deterministically
     localChanged only            -> LOCAL wins (keep our edit)
     cloudChanged only            -> CLOUD wins (adopt theirs)
     neither changed              -> identical, keep either

   Because `localChanged` is digest based, a device that only
   *listed* an unchanged record never claims authorship of it, so
   it can never overwrite a newer cloud version. That is what
   makes the stale-device case safe.

   DELETIONS ARE NOT "MISSING RECORDS"
   -----------------------------------
   A record absent from one side is NOT treated as deleted. Absence
   only ever means "this device has not seen it yet". Deletions are
   represented explicitly and durably by:

     * deletedRecordIds[id] = ISO timestamp of the deletion
       (survives trash being emptied)
     * a trash entry carrying `deletedItemId` + `modified`

   A live record is removed only when a tombstone exists whose
   timestamp is NEWER than the record's own `modified`, i.e. the
   deletion genuinely happened after the last edit. A record edited
   after its deletion therefore survives on purpose.

   A records' `deleted` flag and folder membership are properties of
   the record itself, so they version together with it and never
   need to be resolved separately.
========================================================= */


/* Sort orders are not persisted, so the digest walks the sorted
   record map rather than array order: a remote reordering can
   never look like a content change. */
function stateDigest(snapshot) {

    if (!snapshot) {
        return "";
    }

    let hash = 0x811c9dc5;

    hash = mergeHashText("S" + hash, hash);

    SYNC_COLLECTIONS.forEach(collection => {

        const map = recordMap(
            snapshot[collection]
        );

        const ids = Array.from(map.keys()).sort();

        hash = mergeHashText(
            "C" + collection + ids.length,
            hash
        );

        ids.forEach(id => {

            hash = mergeHashText(
                id + "=" + digestRecord(map.get(id)),
                hash
            );
        });
    });

    const deletedIds =
        Object.keys(snapshot.deletedRecordIds || {}).sort();

    hash = mergeHashText(
        "D" + deletedIds.length,
        hash
    );

    deletedIds.forEach(id => {
        hash = mergeHashText(id, hash);
    });

    return hash.toString(16);
}

function mergeHashText(text, hash) {
    return mixHash(text, hash);
}


function recordModified(record) {

    if (!record) {
        return "";
    }

    return record.modified ||
        record.created ||
        "";
}


function isNewer(leftValue, rightValue) {

    return String(leftValue || "") >
        String(rightValue || "");
}


/* Deterministic identity used by the tombstone merge. Trash entries
   may predate the `deletedItemId` field, so fall back to the id of
   the record they wrap. */
function trashKey(entry) {

    if (!entry) {
        return null;
    }

    if (entry.deletedItemId) {
        return String(entry.deletedItemId);
    }

    if (entry.data && entry.data.id) {
        return String(entry.data.id);
    }

    return entry.id
        ? "trash:" + String(entry.id)
        : null;
}


/* Trash rows are keyed by the id of the record they tombstone, NOT by
   the row's own id: a legacy or freshly rebuilt row carries a random
   row id, so keying on it would make two devices disagree about
   whether they are looking at the same tombstone. */
function trashMap(list) {

    const map = new Map();

    (Array.isArray(list) ? list : []).forEach(entry => {

        const key = trashKey(entry);

        if (!key) {
            return;
        }

        const existing = map.get(key);

        if (!existing) {
            map.set(key, entry);
            return;
        }

        const entryStamp = deletionStamp(entry);
        const existingStamp = deletionStamp(existing);

        if (isNewer(entryStamp, existingStamp)) {
            map.set(key, entry);
            return;
        }

        if (
            entryStamp === existingStamp &&
            digestRecord(entry) > digestRecord(existing)
        ) {
            map.set(key, entry);
        }
    });

    return map;
}


/* The row id is derived from the tombstoned record id so that every
   device renders, stores and digests the exact same row. */
function trashRowId(deletedItemId) {
    return "trash-" + String(deletedItemId);
}

function recordMap(list) {

    const map = new Map();

    (Array.isArray(list) ? list : []).forEach(record => {

        if (!record || !record.id) {
            return;
        }

        const key = String(record.id);

        /* Ids are globally unique in practice. If a malformed
           document ever contained a duplicate, the newest by
           creation is kept deterministically. */
        if (!map.has(key)) {
            map.set(key, record);
            return;
        }

        const existing = map.get(key);

        if (
            isNewer(
                recordModified(record),
                recordModified(existing)
            )
        ) {
            map.set(key, record);
        }
    });

    return map;
}


/* ---------------------------------------------------------
   PER-RECORD RESOLUTION
--------------------------------------------------------- */

function resolveRecord(options) {

    const local = options.local;
    const cloud = options.cloud;
    const base = options.base;

    if (!local) {
        /* Only the cloud has it: adopt. Absence locally is never
           read as a deletion. */
        return cloud;
    }

    if (!cloud) {
        /* Only this device has it. Keep it only when this device is
           known to have touched it since the last sync (a record
           created offline has changed by definition). Otherwise the
           cloud deleted it and the local copy is stale, so it must
           not be resurrected. */
        return options.localChanged
            ? local
            : null;
    }

    if (options.localChanged && options.cloudChanged) {

        /* Both sides edited the same record: LAST WRITER WINS on
           `modified`, ties broken by digest so every device picks
           the same winner. Only this record is affected. */
        if (isNewer(recordModified(cloud), recordModified(local))) {
            return cloud;
        }

        if (isNewer(recordModified(local), recordModified(cloud))) {
            return local;
        }

        return digestRecord(cloud) > digestRecord(local)
            ? cloud
            : local;
    }

    if (options.localChanged) {
        return local;
    }

    if (options.cloudChanged) {
        return cloud;
    }

    /* Byte-identical content: take the cloud copy so every device
       converges on the same object. */
    return cloud;
}


/* ---------------------------------------------------------
   TOMBSTONES
   Unifies deletedRecordIds and trash[] into one
   id -> deletion timestamp map, then re-derives both.
--------------------------------------------------------- */

function collectTombstones(local, cloud, base) {

    const localDeleted = local.deletedRecordIds || {};
    const cloudDeleted = cloud.deletedRecordIds || {};
    const baseDeleted =
        (base && base.deletedRecordIds) || {};

    /* Only used to break exact timestamp ties. */
    const localUs =
        String(local.updatedAt || "") >
        String(cloud.updatedAt || "");

    const localTrash = trashMap(local.trash);
    const cloudTrash = trashMap(cloud.trash);

    const keys = new Set();

    Object.keys(localDeleted).forEach(id => keys.add(id));
    Object.keys(cloudDeleted).forEach(id => keys.add(id));
    Object.keys(baseDeleted).forEach(id => keys.add(id));
    localTrash.forEach((entry, id) => keys.add(id));
    cloudTrash.forEach((entry, id) => keys.add(id));

    const tombstones = {};

    keys.forEach(id => {

        const localStamp =
            localDeleted[id] ||
            deletionStamp(localTrash.get(id));

        const cloudStamp =
            cloudDeleted[id] ||
            deletionStamp(cloudTrash.get(id));

        const baseStamp =
            baseDeleted[id] || null;

        const considered = [];

        if (localStamp) {
            considered.push(localStamp);
        }

        if (cloudStamp) {
            considered.push(cloudStamp);
        }

        /* A tombstone the baseline already recorded was seen by this
           device before, so it can never be undone here. */
        if (baseStamp) {
            considered.push(baseStamp);
        }

        if (!considered.length) {
            return;
        }

        considered.sort((left, right) => {

            if (left !== right) {
                return left > right ? -1 : 1;
            }

            return localUs ? -1 : 1;
        });

        tombstones[id] = considered[0];
    });

    /* A tombstone older than the record's own `modified` was issued
       before that edit, which only happens when the record was
       restored (restore clears the marker and re-bumps `modified`).
       Drop it so a restore is not immediately undone. */
    const live = {};

    SYNC_LIVE_COLLECTIONS.forEach(collection => {

        recordMap(local[collection]).forEach((record, id) => {
            live[id] = record;
        });

        recordMap(cloud[collection]).forEach((record, id) => {

            if (
                !live[id] ||
                isNewer(
                    recordModified(record),
                    recordModified(live[id])
                )
            ) {
                live[id] = record;
            }
        });
    });

    Object.keys(tombstones).forEach(id => {

        const record = live[id];

        if (
            record &&
            isNewer(recordModified(record), tombstones[id])
        ) {
            delete tombstones[id];
        }
    });

    return tombstones;
}

function deletionStamp(entry) {

    if (!entry) {
        return null;
    }

    return entry.modified ||
        entry.created ||
        (entry.data && recordModified(entry.data)) ||
        null;
}


/* ---------------------------------------------------------
   ORCHESTRATOR
   Merge a local snapshot with the cloud snapshot (optionally
   against a baseline) and return a complete new state object.
   Pure: it never mutates its inputs, so it can run inside a
   Firestore transaction and inside the realtime listener
   without side effects.
--------------------------------------------------------- */

function mergeSyncState(localRaw, cloudRaw, baseline) {

    const local = captureSyncState(localRaw);
    const cloud = cloudRaw
        ? captureSyncState(cloudRaw)
        : null;

    /* Nothing in the cloud yet: the local state is the seed. */
    if (!cloud) {
        return local;
    }

    const hasBaseline =
        !!(baseline && baseline.deletedRecordIds);

    /* Without a baseline the merge cannot tell "I edited this" from
       "I have not seen this yet", so every record is treated as
       concurrently modified and resolved per record by last-writer-
       wins on `modified`, with a deterministic digest tie-break.

       Deliberately NOT a document-level "newer document owns
       everything" rule: that would discard records this device
       created while offline simply because the cloud document as a
       whole was written later. Per-record resolution keeps every
       record in play, so nothing is dropped wholesale. */
    const merged = {};

    SYNC_LIVE_COLLECTIONS.forEach(collection => {

        const localMap = recordMap(local[collection]);
        const cloudMap = recordMap(cloud[collection]);
        const baseMap =
            (baseline && baseline[collection]) || {};

        const ids = new Set([
            ...localMap.keys(),
            ...cloudMap.keys()
        ]);

        const resolved = [];

        ids.forEach(id => {

            const localRecord = localMap.get(id);
            const cloudRecord = cloudMap.get(id);

            const localDigest = localRecord
                ? digestRecord(localRecord)
                : null;

            const cloudDigest = cloudRecord
                ? digestRecord(cloudRecord)
                : null;

            const baseDigest = baseMap[id] || null;

            const localChanged = hasBaseline
                ? localDigest !== baseDigest
                : true;

            const cloudChanged = hasBaseline
                ? cloudDigest !== baseDigest
                : true;

            const winner = resolveRecord({
                local: localRecord,
                cloud: cloudRecord,
                base: baseDigest,
                localChanged: localChanged,
                cloudChanged: cloudChanged
            });

            if (winner) {
                resolved.push(winner);
            }
        });

        merged[collection] = resolved;
    });

    /* Explicit deletions, kept strictly separate from absence. */
    const tombstones =
        collectTombstones(local, cloud, baseline);

    const removed = {};

    SYNC_LIVE_COLLECTIONS.forEach(collection => {

        merged[collection] = merged[collection].filter(record => {

            if (!tombstones[record.id]) {
                return true;
            }

            /* Keep the data so the record can still be listed in
               trash and restored. */
            removed[record.id] = {
                collection: collection,
                record: record
            };

            return false;
        });
    });

    merged.trash = mergeTrash(
        local.trash,
        cloud.trash,
        tombstones,
        removed
    );

    merged.deletedRecordIds =
        Object.assign({}, tombstones);

    merged.revision = Math.max(
        Number(local.revision || 0),
        Number(cloud.revision || 0)
    );

    merged.updatedAt =
        isNewer(cloud.updatedAt, local.updatedAt)
            ? cloud.updatedAt
            : local.updatedAt;

    return finalizeMergedState(merged);
}


/* ---------------------------------------------------------
   TRASH
   Trash entries are tombstones. An entry is kept only while the
   record it describes is still deleted, so a stale entry can
   never resurrect anything.
--------------------------------------------------------- */

function mergeTrash(
    localTrash,
    cloudTrash,
    tombstones,
    removed
) {

    const localMap = trashMap(localTrash);
    const cloudMap = trashMap(cloudTrash);

    const byId = new Map();

    [localMap, cloudMap].forEach(map => {

        map.forEach((entry, key) => {

            const existing = byId.get(key);

            if (!existing) {
                byId.set(key, entry);
                return;
            }

            const entryStamp =
                deletionStamp(entry);

            const existingStamp =
                deletionStamp(existing);

            if (isNewer(entryStamp, existingStamp)) {
                byId.set(key, entry);
                return;
            }

            if (
                entryStamp === existingStamp &&
                digestRecord(entry) > digestRecord(existing)
            ) {
                byId.set(key, entry);
            }
        });
    });

    const output = [];

    Object.keys(tombstones).forEach(id => {

        let entry = byId.get(id);

        if (!entry) {

            /* The deletion is recorded but no tombstone object
               exists yet (for example after a partial write).
               Rebuild one from the record we just removed so it can
               still be viewed in trash and restored. */
            const source = removed[id];

            if (!source) {
                return;
            }

            entry = {
                type: trashTypeFor(source.collection),
                data: source.record
            };
        }

        /* Row id, tombstone id and timestamp are all normalised so
           that two devices merging the same inputs produce a
           byte-identical trash list. */
        output.push(
            Object.assign({}, entry, {
                id: trashRowId(id),
                deletedItemId: id,
                modified: tombstones[id]
            })
        );
    });

    /* Sort by tombstone id so array order is identical everywhere. */
    output.sort((left, right) => {

        if (left.deletedItemId === right.deletedItemId) {
            return 0;
        }

        return left.deletedItemId < right.deletedItemId
            ? -1
            : 1;
    });

    return output;
}

function trashTypeFor(collection) {

    if (collection === "songs") {
        return "song";
    }

    if (collection === "folders") {
        return "folder";
    }

    if (collection === "liners") {
        return "liner";
    }

    if (collection === "verses") {
        return "verse";
    }

    return "song";
}


/* ---------------------------------------------------------
   FINALIZE
   Restores the invariants the rest of the app relies on. Runs
   identically on every device after every merge, so the result
   converges and no record can silently vanish.
--------------------------------------------------------- */

function finalizeMergedState(merged) {

    if (!Array.isArray(merged.songs)) {
        merged.songs = [];
    }

    if (!Array.isArray(merged.folders)) {
        merged.folders = [];
    }

    if (!Array.isArray(merged.liners)) {
        merged.liners = [];
    }

    if (!Array.isArray(merged.verses)) {
        merged.verses = [];
    }

    if (!Array.isArray(merged.trash)) {
        merged.trash = [];
    }

    if (
        !merged.deletedRecordIds ||
        typeof merged.deletedRecordIds !== "object"
    ) {
        merged.deletedRecordIds = {};
    }

    /* At least one folder must always exist. */
    if (!merged.folders.length) {

        merged.folders.push({
            id: generateId(),
            name: "UNSORTED",

            modified:
                merged.updatedAt ||
                new Date().toISOString()
        });
    }

    /* If two devices each created their own UNSORTED folder they
       both survive the merge. Collapse them deterministically by
       keeping the lowest id, so every device picks the same one. */
    const unsortedIds =
        merged.folders
            .filter(folder => folder.name === "UNSORTED")
            .map(folder => folder.id)
            .sort();

    if (unsortedIds.length > 1) {

        const keep = unsortedIds[0];
        const drop = new Set(unsortedIds.slice(1));

        merged.folders =
            merged.folders.filter(
                folder => !drop.has(folder.id)
            );

        merged.songs.forEach(song => {

            if (drop.has(song.folder)) {
                song.folder = keep;
            }
        });
    }

    const folderIds =
        new Set(
            merged.folders.map(folder => folder.id)
        );

    const fallback =
        merged.folders.find(
            folder => folder.name === "UNSORTED"
        ) || merged.folders[0];

    /* Never let a song point at a folder that no longer exists.
       The song itself is kept — only its folder reference moves. */
    merged.songs.forEach(song => {

        if (!song.folder || !folderIds.has(song.folder)) {
            song.folder = fallback.id;
        }
    });

    /* The UNSORTED folder can never be a tombstone target, or the
       merge would delete the only guaranteed folder. */
    if (
        fallback &&
        fallback.name === "UNSORTED" &&
        merged.deletedRecordIds[fallback.id]
    ) {
        delete merged.deletedRecordIds[fallback.id];
    }

    merged.trash =
        merged.trash.filter(item => {

            if (
                fallback &&
                fallback.name === "UNSORTED" &&
                item &&
                item.data &&
                item.data.id === fallback.id
            ) {
                return false;
            }

            return true;
        });

    return merged;
}


/* ---------------------------------------------------------
   ADOPTION
   Write a merged state into the live app state, persist it
   locally WITHOUT scheduling another push (adopting must never
   create a push/echo loop), then refresh the UI.
--------------------------------------------------------- */

function adoptMergedState(merged) {

    if (!merged) {
        return;
    }

    state.songs = merged.songs || [];
    state.folders = merged.folders || [];
    state.liners = merged.liners || [];
    state.verses = merged.verses || [];
    state.trash = merged.trash || [];

    state.deletedRecordIds =
        Object.assign(
            {},
            merged.deletedRecordIds || {}
        );

    /* Take the merged timestamp as-is. Deliberately NOT "now": a
       later saveState() bumping it would make this device claim
       authorship of changes it merely received. */
    state.updatedAt =
        merged.updatedAt ||
        new Date().toISOString();

    state.revision = Math.max(
        Number(state.revision || 0),
        Number(merged.revision || 0)
    );

    saveState({ silent: true });

    if (
        typeof isLiveEdit === "function" &&
        isLiveEdit()
    ) {

        /* The user is typing in the Red Room: defer the UI
           reconciliation so the focused textarea is never torn
           down mid-edit. */
        markRenderDeferred();

    } else if (typeof renderAll === "function") {

        renderAll();
    }
}


/* ---------------------------------------------------------
   ECHO SUPPRESSION
   A content digest, not raw JSON, so a Firestore round trip
   that reorders object keys never looks like newer data and
   can never cause a push/pull loop.
--------------------------------------------------------- */

function rememberSyncedSignature(snapshot) {

    lastPushedSignature =
        stateDigest(snapshot || state);
}



/* =========================================================
   REALTIME LISTENER
========================================================= */

function startListening() {
    stopListening();

    const docRef = getUserDocRef();
    if (!docRef) return;

    firebaseUnsubscribe = docRef.onSnapshot(
        (doc) => {
            if (!doc.exists || !doc.data()) return;

            const data = doc.data();
            if (!data || !data.state) return;

            const signature =
                stateDigest(data.state);

            /* Skip our own echo to avoid a sync loop. The digest
               ignores object key order, so a Firestore round trip
               that reorders fields is still recognised as ours. */
            if (signature === lastPushedSignature) {
                setSyncStatus("synced");
                return;
            }

            /* Merge record by record instead of adopting the
               snapshot wholesale, so local edits made since the
               last push are not discarded by someone else's
               unrelated change. */
            const mergedState = mergeSyncState(
                captureSyncState(state),
                data.state,
                getSyncBaseline()
            );

            const changed =
                stateDigest(mergedState) !==
                stateDigest(captureSyncState(state));

            if (changed) {
                adoptMergedState(mergedState);
            }

            setSyncBaseline(
                buildSyncBaseline(mergedState)
            );

            rememberSyncedSignature(mergedState);

            /* Push only when the merge produced something the cloud
               does not have yet (local-only records, or a local edit
               the cloud has not accepted). The digest comparison
               makes this idempotent, so the listener can never
               drive an unbounded push loop. */
            if (
                stateDigest(mergedState) !==
                stateDigest(data.state)
            ) {
                pushState();
            }

            setSyncStatus("synced");
        },
        (error) => {
            console.error("Listener error:", error);
            setSyncStatus("error");
        }
    );
}

function stopListening() {
    if (firebaseUnsubscribe) {
        firebaseUnsubscribe();
        firebaseUnsubscribe = null;
    }
}


/* =========================================================
   INITIALIZE FIREBASE
========================================================= */

function initFirebase() {
    if (typeof firebase === "undefined") {
        console.warn("Firebase SDK not loaded.");
        return;
    }

    if (!firebaseApp) {
        firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
        firebaseAuth = firebase.auth();
        firebaseDb = firebase.firestore();
    }
}
