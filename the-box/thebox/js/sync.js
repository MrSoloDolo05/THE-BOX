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
                mergeStates(data.state);
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
   MERGE STATES
   Union by item id; newer `modified` wins on conflict.
========================================================= */

function mergeStates(remoteState) {
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

    saveState();
    renderAll();
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

            mergeStates(data.state);
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
