/* =========================================================
   T3 GATE — headless invariant harness for purgedRecordIds.

   Loads the REAL working-tree source (state.js, database.js,
   sync.js) into a vm context and drives the real
   mergeSyncState() / stateDigest(). Nothing is reimplemented
   and no production file is modified.

   Proves merge semantics only. Does NOT prove Firestore
   transport, onSnapshot, debounce timing, the UI, or real
   two-device behaviour.
   ========================================================= */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "the-box", "thebox");

function loadApp() {

    const store = new Map();

    const sandbox = {};

    sandbox.window = sandbox;
    sandbox.console = console;
    sandbox.performance = { now: () => Date.now() };
    sandbox.setTimeout = setTimeout;
    sandbox.clearTimeout = clearTimeout;
    sandbox.localStorage = {
        getItem: k => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: k => store.delete(k)
    };
    sandbox.document = {
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        createElement: () => ({
            style: {}, setAttribute() {}, appendChild() {}
        })
    };
    sandbox.navigator = {
        clipboard: { writeText: async () => {} }
    };
    sandbox.firebase = {};

    const ctx = vm.createContext(sandbox);

    ["js/state.js", "js/database.js", "js/sync.js"].forEach(rel => {
        const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
        vm.runInContext(src, ctx, { filename: rel });
    });

    return { sandbox, run: code => vm.runInContext(code, ctx) };
}

/* ---------- reporting ---------- */

const results = [];

function check(name, pass, detail) {
    results.push({ name, pass: !!pass, detail: detail || "" });
}

/* ---------- fixture builders (host side) ---------- */

const UNSORTED = {
    id: "folder-unsorted",
    name: "UNSORTED",
    modified: "2026-01-01T00:00:00.000Z"
};

function snap(o) {
    return {
        songs: o.songs || [],
        folders: o.folders || [UNSORTED],
        liners: o.liners || [],
        verses: o.verses || [],
        trash: o.trash || [],
        deletedRecordIds: o.deletedRecordIds || {},
        purgedRecordIds: o.purgedRecordIds || {},
        updatedAt: o.updatedAt || "2026-01-01T00:00:00.000Z",
        revision: o.revision || 1
    };
}

function baseline(o) {
    return {
        uid: null,
        songs: o.songs || {},
        folders: o.folders || {},
        liners: o.liners || {},
        verses: o.verses || {},
        deletedRecordIds: o.deletedRecordIds || {},
        purgedRecordIds: o.purgedRecordIds || {}
    };
}

function song(id, modified) {
    return {
        id,
        title: "Song " + id,
        folder: "folder-unsorted",
        created: "2026-01-01T00:00:00.000Z",
        modified: modified
    };
}

function trashRow(record, stamp) {
    return {
        id: "trash-" + record.id,
        type: "song",
        data: record,
        deletedItemId: record.id,
        modified: stamp
    };
}

function hasRecord(list, id) {
    return (list || []).some(r => r && r.id === id);
}
/* ---------- load the real app ---------- */

const app = loadApp();
app.run("state = createDefaultState();");

function merge(local, cloud, base) {
    app.sandbox.__L = local;
    app.sandbox.__C = cloud;
    app.sandbox.__B = base;
    return app.run("mergeSyncState(__L, __C, __B)");
}

/* =========================================================
   1. T3 CORE  (the acceptance gate)
   A purged X. B is offline holding a stale LIVE copy, a stale
   tombstone and a stale baseline. B reconnects.
   ========================================================= */
(function t3() {

    const X = "song-x";

    const A = snap({
        songs: [],
        trash: [],
        deletedRecordIds: { [X]: "2026-03-02T00:00:00.000Z" },
        purgedRecordIds: { [X]: "2026-03-02T00:00:00.000Z" }
    });

    const B = snap({
        songs: [song(X, "2026-03-01T00:00:00.000Z")],
        trash: [trashRow(song(X, "2026-03-01T00:00:00.000Z"),
                          "2026-03-01T00:00:00.000Z")],
        deletedRecordIds: { [X]: "2026-03-01T00:00:00.000Z" },
        purgedRecordIds: {}
    });

    app.sandbox.__S0 = B;
    const xDigest = app.run("digestRecord(__S0.songs[0])");

    const bBase = baseline({
        songs: { [X]: xDigest },
        deletedRecordIds: { [X]: "2026-03-01T00:00:00.000Z" }
    });

    const m = merge(B, A, bBase);

    check("T3 purgedRecordIds[X] present",
        !!(m.purgedRecordIds && X in m.purgedRecordIds),
        "purged=" + JSON.stringify(m.purgedRecordIds));

    check("T3 deletedRecordIds[X] present",
        !!(m.deletedRecordIds && X in m.deletedRecordIds),
        "deleted=" + JSON.stringify(m.deletedRecordIds));

    check("T3 X absent from every live collection",
        !hasRecord(m.songs, X) && !hasRecord(m.folders, X) &&
        !hasRecord(m.liners, X) && !hasRecord(m.verses, X),
        "songs=" + m.songs.map(s => s.id).join(","));

    check("T3 X absent from trash",
        !(m.trash || []).some(r => r.deletedItemId === X ||
                                 r.id === "trash-" + X),
        "trash=" + (m.trash || []).map(r => r.id).join(","));

})();

/* =========================================================
   2. PURGE WITH NO TOMBSTONE
   ========================================================= */
(function noTombstone() {

    const X = "song-y";

    const A = snap({
        songs: [],
        purgedRecordIds: { [X]: "2026-03-02T00:00:00.000Z" }
    });

    const B = snap({ songs: [song(X, "2026-03-01T00:00:00.000Z")] });

    const m = merge(B, A, baseline({}));

    check("purge-without-tombstone: marker survives",
        !!(m.purgedRecordIds && X in m.purgedRecordIds));

    check("purge-without-tombstone: X does not resurrect",
        !hasRecord(m.songs, X));

})();
/* =========================================================
   3. PURGE vs STALE EDIT (B's record looks NEWER)
   ========================================================= */
(function staleEdit() {

    const X = "song-z";

    const A = snap({
        songs: [],
        deletedRecordIds: { [X]: "2026-03-02T00:00:00.000Z" },
        purgedRecordIds: { [X]: "2026-03-02T00:00:00.000Z" }
    });

    const B = snap({
        songs: [song(X, "2026-06-01T00:00:00.000Z")],
        trash: [trashRow(song(X, "2026-06-01T00:00:00.000Z"),
                          "2026-03-01T00:00:00.000Z")],
        deletedRecordIds: { [X]: "2026-03-01T00:00:00.000Z" }
    });

    const m = merge(B, A, baseline({}));

    check("purge-vs-stale-edit: purge wins over newer modified",
        !hasRecord(m.songs, X) && X in (m.purgedRecordIds || {}),
        "song present=" + hasRecord(m.songs, X));

})();

/* =========================================================
   4. PURGE vs RESTORE (B shows X as restored/live, no tombstone)
   ========================================================= */
(function purgeVsRestore() {

    const X = "song-r";

    const A = snap({
        songs: [],
        deletedRecordIds: { [X]: "2026-03-02T00:00:00.000Z" },
        purgedRecordIds: { [X]: "2026-03-02T00:00:00.000Z" }
    });

    const B = snap({
        songs: [song(X, "2026-03-05T00:00:00.000Z")],
        deletedRecordIds: {},
        purgedRecordIds: {}
    });

    const m = merge(B, A, baseline({}));

    check("purge-vs-restore: purge wins over a live copy",
        !hasRecord(m.songs, X) && X in (m.purgedRecordIds || {}),
        "song present=" + hasRecord(m.songs, X));

})();

/* =========================================================
   5. CONCURRENT INDEPENDENT PURGES (A purges X, B purges Y)
   ========================================================= */
(function concurrent() {

    const X = "song-p";
    const Y = "song-q";

    const A = snap({
        songs: [],
        deletedRecordIds: { [X]: "2026-03-02T00:00:00.000Z" },
        purgedRecordIds: { [X]: "2026-03-02T00:00:00.000Z" }
    });

    const B = snap({
        songs: [],
        deletedRecordIds: { [Y]: "2026-03-03T00:00:00.000Z" },
        purgedRecordIds: { [Y]: "2026-03-03T00:00:00.000Z" }
    });

    const m = merge(B, A, baseline({}));

    check("concurrent-purges: both markers survive",
        X in (m.purgedRecordIds || {}) && Y in (m.purgedRecordIds || {}),
        "purged=" + JSON.stringify(m.purgedRecordIds));

    check("concurrent-purges: both tombstones survive",
        X in (m.deletedRecordIds || {}) && Y in (m.deletedRecordIds || {}),
        "deleted=" + JSON.stringify(m.deletedRecordIds));

})();
/* =========================================================
   6. NON-PURGED REGRESSION - ordinary delete + restore
   ========================================================= */
(function regression() {

    const D = "song-del";

    /* 6a. ordinary tombstone, NO purge -> must still produce trash */
    const cloudOrdinary = snap({
        songs: [],
        deletedRecordIds: { [D]: "2026-03-02T00:00:00.000Z" },
        purgedRecordIds: {}
    });

    const localOrdinary = snap({
        songs: [song(D, "2026-03-01T00:00:00.000Z")],
        trash: [trashRow(song(D, "2026-03-01T00:00:00.000Z"),
                         "2026-03-02T00:00:00.000Z")],
        deletedRecordIds: { [D]: "2026-03-02T00:00:00.000Z" },
        purgedRecordIds: {}
    });

    const mOrdinary = merge(localOrdinary, cloudOrdinary, baseline({}));

    check("regression: ordinary delete still produces a trash row",
        (mOrdinary.trash || []).some(r => r.deletedItemId === D),
        "trash=" + (mOrdinary.trash || []).map(r => r.id).join(","));

    check("regression: ordinary delete removes it from songs",
        !hasRecord(mOrdinary.songs, D));

    /* 6b. ordinary restore: live record newer than tombstone -> survives */
    const R = "song-res";

    const cloudRestore = snap({
        songs: [song(R, "2026-03-09T00:00:00.000Z")],
        deletedRecordIds: { [R]: "2026-03-02T00:00:00.000Z" },
        purgedRecordIds: {}
    });

    const localRestore = snap({
        songs: [song(R, "2026-03-01T00:00:00.000Z")],
        deletedRecordIds: { [R]: "2026-03-02T00:00:00.000Z" },
        purgedRecordIds: {}
    });

    const mRestore = merge(localRestore, cloudRestore, baseline({}));

    check("regression: ordinary restore keeps the record live",
        hasRecord(mRestore.songs, R),
        "songs=" + mRestore.songs.map(s => s.id).join(","));

    check("regression: ordinary restore leaves no trash row",
        !(mRestore.trash || []).some(r => r.deletedItemId === R));

})();

/* =========================================================
   7. DIGEST
   ========================================================= */
(function digest() {

    function digestOf(s) {
        app.sandbox.__S = s;
        return app.run("stateDigest(__S)");
    }

    const one = snap({ purgedRecordIds: { "a": "2026-03-02T00:00:00.000Z" } });
    const oneSame = snap({ purgedRecordIds: { "a": "2026-03-02T00:00:00.000Z" } });
    const oneDiff = snap({ purgedRecordIds: { "a": "2026-09-09T00:00:00.000Z" } });
    const none = snap({ purgedRecordIds: {} });

    const d1 = digestOf(one);
    const d2 = digestOf(oneSame);
    const d3 = digestOf(oneDiff);
    const d4 = digestOf(none);

    check("digest: identical purge maps match",
        d1 === d2, d1 + " vs " + d2);

    check("digest: different purge timestamps differ",
        d1 !== d3, d1 + " vs " + d3);

    check("digest: purge map changes the digest",
        d1 !== d4, d1 + " vs " + d4);

})();

/* ---------- report ---------- */

let failed = 0;

console.log("");
console.log("===== purgedRecordIds INVARIANT HARNESS =====");

results.forEach(r => {
    if (!r.pass) { failed += 1; }
    console.log(
        (r.pass ? "  PASS  " : "  FAIL  ") +
        r.name + (r.detail ? "   [" + r.detail + "]" : "")
    );
});

console.log("");
console.log(
    "  " + (results.length - failed) + "/" + results.length + " passed"
);
console.log("");

process.exit(failed ? 1 : 0);