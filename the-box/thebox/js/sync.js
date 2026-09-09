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
    if (!firebaseAuth) return;

    const handleUser = async (user) => {
        if (user) {
            currentUser = user;
            updateAuthButton();
            setSyncStatus("syncing");
            await pullState();
            startListening();
            setSyncStatus("synced");
        } else {
            currentUser = null;
            updateAuthButton();
            stopListening();
            setSyncStatus("offline");
        }
    };

    firebaseAuth.onAuthStateChanged(handleUser);
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

async function pushState() {
    if (!isSignedIn()) return;

    const docRef = getUserDocRef();
    if (!docRef) return;

    try {
        setSyncStatus("syncing");

        lastPushedSignature =
            JSON.stringify(state);

        const data = {
            state: state,
            updatedAt:
                firebase.firestore.FieldValue.serverTimestamp()
        };

        await docRef.set(data, { merge: true });

        setSyncStatus("synced");
    } catch (error) {
        console.error("Push failed:", error);
        setSyncStatus("error");
    }
}

async function pullState() {
    if (!isSignedIn()) return;

    const docRef = getUserDocRef();
    if (!docRef) return;

    try {
        setSyncStatus("syncing");

        const doc = await docRef.get();

        if (doc.exists) {
            const data = doc.data();
            if (data && data.state) {
                const adopted =
                    applyRemoteState(data.state);

                if (!adopted) {
                    /* Cloud is stale (or equal) relative to
                       local: push local so the document
                       converges instead of letting an old
                       snapshot win. */
                    await pushState();
                }
            }
        } else {
            /* First time on this device: upload local. */
            await pushState();
        }

        setSyncStatus("synced");
    } catch (error) {
        console.error("Pull failed:", error);
        setSyncStatus("error");
    }
}


/* =========================================================
   REMOTE STATE APPLICATION
   Adopt only strictly newer snapshots; deletions propagate.
========================================================= */

function sanitizeCollection(list) {
    if (!Array.isArray(list)) {
        return [];
    }

    const seen = new Set();
    const cleaned = [];

    list.forEach(item => {
        if (!item || typeof item !== "object" || !item.id) return;
        if (seen.has(item.id)) return;
        seen.add(item.id);
        cleaned.push(item);
    });

    return cleaned;
}


function applyRemoteState(remoteState) {
    if (!remoteState || typeof remoteState !== "object") {
        return false;
    }

    const remoteRevision =
        Number(remoteState.revision || 0);

    const localRevision =
        Number(state.revision || 0);

    const remoteStamp =
        String(remoteState.updatedAt || "");

    const localStamp =
        String(state.updatedAt || "");

    /* LAST-WRITE-WINS: the client `updatedAt` ISO timestamp is
       the primary signal. Both devices write ISO strings, so a
       simple string compare is correct. Revision counters are
       per-device clocks and must NOT decide the winner (a stale
       desktop with a high counter would otherwise clobber newer
       mobile changes — the exact bug this fixes). Revision only
       breaks exact-timestamp ties. */
    const remoteIsNewer =
        remoteStamp > localStamp ||
        (
            remoteStamp === localStamp &&
            remoteRevision > localRevision
        );

    if (!remoteIsNewer) {
        /* Local is at least as fresh: ignore the stale
           snapshot so it cannot overwrite local deletions. */
        return false;
    }


    /* Adopt the remote document wholesale (deduped by id).
       Deletions are representable: an item missing from the
       adopted snapshot is deleted everywhere. */
    state.songs =
        sanitizeCollection(remoteState.songs);

    state.folders =
        sanitizeCollection(remoteState.folders);

    state.liners =
        sanitizeCollection(remoteState.liners);

    state.verses =
        sanitizeCollection(remoteState.verses);

    state.trash =
        sanitizeCollection(remoteState.trash);


    /* Keep app invariants intact after adoption. */
    if (!state.folders.length) {
        state.folders.push({
            id: generateId(),
            name: "UNSORTED"
        });
    }

    const folderIds =
        new Set(
            state.folders.map(
                folder => folder.id
            )
        );

    const fallbackFolder =
        state.folders.find(
            folder =>
                folder.name === "UNSORTED"
        ) ||
        state.folders[0];

    state.songs.forEach(song => {

        if (
            !song.folder ||
            !folderIds.has(song.folder)
        ) {

            song.folder =
                fallbackFolder.id;
        }
    });


    state.revision =
        remoteRevision;

    state.updatedAt =
        remoteStamp ||
        new Date().toISOString();

    /*
    if (!remoteState || typeof remoteState !== "object") {
        return;
    }

    ["songs", "folders", "liners", "verses", "trash"].forEach(
        (collection) => {
            if (!Array.isArray(remoteState[collection])) {
                return;
            }

            const localById = new Map(
                (state[collection] || []).map((item) => [
                    item.id,
                    item
                ])
            );

            remoteState[collection].forEach((remoteItem) => {
                if (!remoteItem || !remoteItem.id) return;

                const localItem = localById.get(remoteItem.id);

                if (!localItem) {
                    if (!state[collection]) state[collection] = [];
                    state[collection].push(remoteItem);
                } else {
                    const localModified =
                        localItem.modified ||
                        localItem.created ||
                        "";

                    const remoteModified =
                        remoteItem.modified ||
                        remoteItem.created ||
                        "";

                    if (remoteModified > localModified) {
                        const idx = state[collection].indexOf(
                            localItem
                        );
                        if (idx !== -1) {
                            state[collection][idx] = remoteItem;
                        }
                    }
                }
            });
        }
    );

    */

    /* Persist locally WITHOUT bumping the revision we just
       received and WITHOUT scheduling a push, so adopting
       can never trigger a push/echo loop. */
    saveState({ silent: true });
    if (typeof isLiveEdit === "function" && isLiveEdit()) {

        /* The user is typing in the Red Room: defer the UI
           reconciliation until they leave the field so the
           focused textarea is never torn down mid-edit. */
        markRenderDeferred();

    } else if (typeof renderAll === "function") {

        renderAll();
    }

    return true;
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
                JSON.stringify(data.state);

            /* Skip our own echo to avoid a sync loop. */
            if (signature === lastPushedSignature) {
                setSyncStatus("synced");
                return;
            }

            applyRemoteState(data.state);
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
