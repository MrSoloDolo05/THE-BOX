/* =========================================================
   __TR  —  TRASH DIAGNOSTIC TRACER  (temporary, observe only)

   Purpose: find the FIRST point where a DELETE FOREVER or
   EMPTY TRASH diverges from the expected deleted state.

   It modifies no application logic. It wraps existing global
   functions (classic-script `function` declarations are live
   properties of window, so every internal call site is captured
   too) and only reads state.

   What it records at every step:
     state.trash      row ids
     tombstones       state.deletedRecordIds keys
     localStorage     trash rows + tombstone keys
     rendered DOM     #trash-list item ids
     sync baseline    tombstone keys from localStorage
     snapshots        collection counts + array identity

   Install: copy to thebox/js/tr-trace.js and add
     <script src="js/tr-trace.js"></script>
   as the LAST <script> in index.html (after js/app.js), then
   hard-refresh. Remove both when the Trash bug is explained.

   Console commands:
     __TR.mark("step 1")   annotate the timeline
     __TR.snap("LABEL")    full snapshot on demand
     __TR.dump()           the whole trace as text
     __TR.copy()           trace to the clipboard
     __TR.on / __TR.off    unmute / mute logging
     __TR.stop()           unhook every wrapper (buffer kept)
   ========================================================= */

(function () {

    "use strict";

    const PREFIX = "[TR TRACER]";
    const MAX_LINES = 12000;

    const TR = {
        lines: [],
        seq: 0,
        depth: 0,
        t0: (window.performance ? performance.now() : Date.now()),
        muted: false,
        wraps: [],
        missing: [],
        stopped: false
    };

    window.__TR = TR;

    /* Identity tokens: proves whether two references are the SAME
       object. captureSyncState copies arrays by reference, so an
       identity that survives a "copy" is a real finding. */
    const tokens = new WeakMap();
    let tokenSeq = 0;

    function tid(obj) {

        if (!obj || typeof obj !== "object") {
            return "-";
        }

        let n = tokens.get(obj);

        if (!n) {
            n = ++tokenSeq;
            tokens.set(obj, n);
        }

        return "#" + n.toString(36);
    }

    function safe(fn, fallback) {

        try {
            return fn();
        } catch (error) {
            return fallback;
        }
    }

    function appState() {
        return safe(() => state, null);
    }

    /* ---------------------------------------------------------
       READERS — guarded and lazy, so a missing global can never
       break the tracer.
    --------------------------------------------------------- */

    function trashRows() {

        const st = appState();

        return Array.isArray(st && st.trash) ? st.trash : [];
    }

    function stateTrashIds() {

        return trashRows()
            .map(row => String((row && row.id) || "?"))
            .join(",") || "(empty)";
    }

    function stateTombstoneKeys() {

        const st = appState();
        const keys = Object.keys(
            safe(() => st.deletedRecordIds, {}) || {}
        );

        return keys.sort().join(",") || "(none)";
    }

    function lsParse(key) {

        const raw = safe(() => localStorage.getItem(key), null);

        if (!raw) {
            return null;
        }

        return safe(() => JSON.parse(raw), null);
    }

    function dbKey() {
        return safe(() => DATABASE_KEY, "the_box_app_state");
    }

    function baselineKey() {
        return safe(
            () => SYNC_BASELINE_KEY,
            "the_box_sync_baseline"
        );
    }

    function lsTrashIds() {

        const parsed = lsParse(dbKey());

        if (!parsed || !Array.isArray(parsed.trash)) {
            return "(no localStorage)";
        }

        return parsed.trash
            .map(row => String((row && row.id) || "?"))
            .join(",") || "(empty)";
    }

    function lsTombstoneKeys() {

        const parsed = lsParse(dbKey());

        if (!parsed) {
            return "(no localStorage)";
        }

        return Object.keys(parsed.deletedRecordIds || {})
            .sort().join(",") || "(none)";
    }

    function baselineTombstoneKeys() {

        const parsed = lsParse(baselineKey());

        if (!parsed) {
            return "(no baseline)";
        }

        return Object.keys(parsed.deletedRecordIds || {})
            .sort().join(",") || "(none)";
    }

    /* What the user can SEE. If state is clean but this is not,
       the fault is in rendering (conclusion G). */
    function renderedTrashIds() {

        const nodes = safe(
            () => document.querySelectorAll("#trash-list .trash-item"),
            []
        );

        const ids = Array.prototype.map.call(
            nodes,
            node => safe(
                () => node.dataset.trashId ||
                    node.querySelector("[data-trash-id]")
                        ?.dataset.trashId || "?",
                "?"
            )
        );

        return ids.join(",") ||
            (nodes.length ? "(unreadable)" : "(empty)");
    }

    function renderedTrashCount() {

        return safe(
            () => document
                .querySelectorAll("#trash-list .trash-item").length,
            -1
        );
    }

    /* Collection counts plus array identity, for comparing what was
       pushed against what the cloud holds. */
    function collectionSummary(snapshot) {

        if (!snapshot || typeof snapshot !== "object") {
            return "no-snapshot";
        }

        const collections = safe(
            () => SYNC_COLLECTIONS,
            ["songs", "folders", "liners", "verses"]
        );

        return collections.map(name => {

            const list = snapshot[name];

            return name + "=" +
                (Array.isArray(list) ? list.length : -1) +
                tid(list);

        }).join(" ") +
            " trash=" +
            (Array.isArray(snapshot.trash) ? snapshot.trash.length : -1) +
            " tomb=" +
            Object.keys(snapshot.deletedRecordIds || {}).length;
    }

    /* ---------------------------------------------------------
       ONE PANEL — compared at every wrapped call, so the first
       divergence in the chain is visible at a glance.
    --------------------------------------------------------- */

    function panel() {

        return {
            stateTrash: stateTrashIds(),
            stateTomb: stateTombstoneKeys(),
            lsTrash: lsTrashIds(),
            lsTomb: lsTombstoneKeys(),
            baseline: baselineTombstoneKeys(),
            dom: renderedTrashIds(),
            domCount: renderedTrashCount()
        };
    }

    function formatPanel(p) {

        return [
            "state.trash=[" + p.stateTrash + "]",
            "state.tomb=[" + p.stateTomb + "]",
            "ls.trash  =[" + p.lsTrash + "]",
            "ls.tomb  =[" + p.lsTomb + "]",
            "baseline =[" + p.baseline + "]",
            "DOM(" + p.domCount + ")=[" + p.dom + "]"
        ].join("\n            ");
    }

    /* ---------------------------------------------------------
       LOGGING
    --------------------------------------------------------- */

    function log(tag, detail) {

        if (TR.muted || TR.stopped) {
            return;
        }

        const rel = Math.round(
            (window.performance ? performance.now() : Date.now()) - TR.t0
        );

        const pad = "  ".repeat(TR.depth);

        let line =
            PREFIX + " #" + (++TR.seq) +
            " +" + rel + "ms " + pad + tag;

        if (detail) {
            line += "\n            " + detail;
        }

        TR.lines.push(line);

        if (TR.lines.length > MAX_LINES) {
            TR.lines.shift();
        }

        try {
            console.log(line);
        } catch (error) { /* console may be unavailable */ }
    }

    function stack(skip) {

        const frames = String(
            safe(() => new Error().stack, "") || ""
        ).split("\n");

        const out = [];

        for (
            let i = (skip || 2);
            i < frames.length && out.length < 5;
            i++
        ) {

            const frame = String(frames[i])
                .trim()
                .replace(/^at\s+/, "");

            if (frame && !/__TR|tr-trace/.test(frame)) {
                out.push(frame);
            }
        }

        return out.join(" <- ");
    }

    /* ---------------------------------------------------------
       WRAPPER — generic; every function below uses it.

       Async functions return a promise, so the "after" half is
       logged from the settled result. Without that, pushState and
       runPushTransaction would only ever show their entry.
    --------------------------------------------------------- */

    function wrap(name, spec) {

        const original = window[name];

        if (typeof original !== "function") {
            TR.missing.push(name);
            return;
        }

        const cfg = spec || {};
        const tag = cfg.tag || ("WRAP " + name);

        const wrapped = function () {

            const args = Array.prototype.slice.call(arguments);
            const previousDepth = TR.depth;

            if (cfg.enter) {
                TR.depth = previousDepth + 1;
                log(tag + " >", cfg.enter(args));
                TR.depth = previousDepth;
            }

            const finish = (value, rejected) => {

                let detail = "";

                if (cfg.exit) {
                    detail = cfg.exit(args, value, rejected);
                }

                if (detail) {
                    log(
                        tag + " <",
                        detail +
                        (rejected
                            ? "\n            *** " + rejected
                            : "")
                    );
                }
            };

            let result;

            try {
                result = original.apply(this, args);
            } catch (error) {
                finish(null, String(
                    error && error.message || error
                ));
                throw error;
            }

            if (result && typeof result.then === "function") {
                return result.then(
                    value => {
                        finish(value, null);
                        return value;
                    },
                    error => {
                        finish(null, String(
                            error && error.message || error
                        ));
                        throw error;
                    }
                );
            }

            finish(result, null);
            return result;
        };

        try {
            Object.defineProperty(wrapped, "name", {
                value: name,
                configurable: true
            });
        } catch (error) { /* name is cosmetic */ }

        window[name] = wrapped;
        TR.wraps.push([name, original]);
    }

    /* ---------------------------------------------------------
       WRAPPED FUNCTIONS, in the order the deletion path runs.
    --------------------------------------------------------- */

    /* -- UI handlers -------------------------------------- */

    wrap("restoreTrash", {
        tag: "HANDLER restoreTrash (CONTROL - works today)",
        enter: a => "id=" + a[0] + "\n            " + stack(),
        exit: (a, v, err) => err
            ? "THREW " + err
            : formatPanel(panel())
    });

    wrap("permanentlyDelete", {
        tag: "HANDLER permanentlyDelete",
        enter: a => "id=" + a[0] + "\n            " + stack(),
        exit: (a, v, err) => err
            ? "THREW " + err
            : formatPanel(panel())
    });

    wrap("emptyTrash", {
        tag: "HANDLER emptyTrash",
        enter: () => stack(),
        exit: (a, v, err) => err
            ? "THREW " + err
            : formatPanel(panel())
    });

    /* -- deletion bookkeeping ---------------------------- */

    wrap("forgetLocalEditsFor", {
        tag: "LEDGER forgetLocalEditsFor",
        enter: a => {
            const item = a[0];
            return "type=" + (item && item.type) +
                " data.id=" + (item && item.data && item.data.id);
        },
        exit: () => "done"
    });

    wrap("unmarkRecordDeleted", {
        tag: "TOMBSTONE unmarkRecordDeleted",
        enter: a => "id=" + a[0] +
            "  BEFORE=[" + stateTombstoneKeys() + "]",
        exit: a => "id=" + a[0] +
            "  AFTER=[" + stateTombstoneKeys() + "]"
    });

    wrap("markRecordDeleted", {
        tag: "TOMBSTONE markRecordDeleted (RE-TRASHING?)",
        enter: a => "id=" + a[0] +
            "  BEFORE=[" + stateTombstoneKeys() + "]",
        exit: a => "id=" + a[0] +
            "  AFTER=[" + stateTombstoneKeys() + "]"
    });

    /* -- persistence ------------------------------------- */

    wrap("saveState", {
        tag: "PERSIST saveState",
        enter: a => "silent=" + Boolean(
            a[0] && a[0].silent === true
        ),
        exit: () => formatPanel(panel())
    });

    wrap("setSyncBaseline", {
        tag: "BASELINE setSyncBaseline",
        enter: a => collectionSummary(a[0]),
        exit: () => "baseline.tomb=[" + baselineTombstoneKeys() + "]"
    });

    wrap("getSyncBaseline", {
        tag: "BASELINE getSyncBaseline",
        exit: () => "tomb=[" + baselineTombstoneKeys() + "]"
    });

    /* -- render ------------------------------------------ */

    wrap("renderTrash", {
        tag: "RENDER renderTrash",
        exit: () => "DOM(" + renderedTrashCount() +
            ")=[" + renderedTrashIds() + "]" +
            "\n            state.trash=[" + stateTrashIds() + "]"
    });

    /* -- sync ------------------------------------------- */

    wrap("captureSyncState", {
        tag: "SYNC captureSyncState",
        exit: (a, v) => collectionSummary(v)
    });

    wrap("stateDigest", {
        tag: "SYNC stateDigest",
        exit: (a, v) => "digest=" + String(v).slice(0, 16)
    });

    wrap("mergeTrash", {
        tag: "MERGE mergeTrash  <<< REBUILDS THE ROWS",
        enter: a => {
            const tombstones = a[2] || {};
            return "tombstone keys=[" +
                Object.keys(tombstones).sort().join(",") +
                "]  removed ids=[" +
                Object.keys(a[3] || {}).sort().join(",") + "]";
        },
        exit: (a, v) => "rows=[" + (Array.isArray(v)
            ? v.map(r => String(r.id)).join(",") || "(empty)"
            : "not-array") + "]"
    });

    wrap("mergeSyncState", {
        tag: "MERGE mergeSyncState",
        enter: a =>
            "local=" + collectionSummary(a[0]) +
            "\n            cloud=" + collectionSummary(a[1]) +
            "\n            base.tomb=[" + (
                a[2] && a[2].deletedRecordIds
                    ? Object.keys(a[2].deletedRecordIds)
                        .sort().join(",")
                    : "(none)"
            ) + "]",
        exit: (a, v) => collectionSummary(v) +
            "\n            merged.trash=[" + (
                Array.isArray(v && v.trash)
                    ? v.trash.map(r => String(r.id))
                        .join(",") || "(empty)"
                    : "?"
            ) + "]  merged.tomb=[" +
            Object.keys((v && v.deletedRecordIds) || {})
                .sort().join(",") + "]"
    });

    wrap("adoptMergedState", {
        tag: "ADOPT adoptMergedState",
        enter: a => collectionSummary(a[0]),
        exit: () => formatPanel(panel())
    });

    wrap("runPushTransaction", {
        tag: "PUSH runPushTransaction",
        exit: (a, v, err) => err
            ? "*** TRANSACTION FAILED: " + err
            : "transaction committed\n            " + formatPanel(panel())
    });

    wrap("pushState", {
        tag: "PUSH pushState",
        exit: (a, v, err) => err
            ? "*** PUSH FAILED: " + err
            : "push resolved"
    });

    /* ---------------------------------------------------------
       PUBLIC API
    --------------------------------------------------------- */

    TR.mark = function (label) {

        TR.seq += 1;

        log(
            "MARK >>> " + label + " <<<",
            formatPanel(panel())
        );

        return label;
    };

    TR.snap = function (label) {

        const text = formatPanel(panel());

        log("SNAP " + (label || ""), text);

        try {
            console.log(
                "\n===== __TR SNAPSHOT: " + (label || "") +
                " =====\n" + text +
                "\n=====================================\n"
            );
        } catch (error) { /* no console */ }

        return text;
    };

    TR.dump = function () {
        return TR.lines.join("\n");
    };

    TR.count = function () {
        return TR.lines.length;
    };

    TR.clear = function () {
        TR.lines.length = 0;
        TR.seq = 0;
        return "cleared";
    };

    /* Clipboard needs the document focused; if it refuses, the
       caller should fall back to __TR.dump(). */
    TR.copy = function () {

        const text = TR.dump();

        try {
            const result = navigator.clipboard.writeText(text);

            log("COPIED " + TR.lines.length + " lines (async)");

            return result && typeof result.then === "function"
                ? result.then(
                    () => TR.lines.length + " lines copied",
                    () => "COPY BLOCKED (document not focused). " +
                          "Click inside the console, retry, or use __TR.dump()."
                )
                : TR.lines.length + " lines copied";

        } catch (error) {
            return "COPY BLOCKED (document not focused). " +
                   "Click inside the console, retry, or use __TR.dump().";
        }
    };

    TR.on = function () {
        TR.muted = false;
        return "logging live";
    };

    TR.off = function () {
        TR.muted = true;
        return "muted; wrappers still in place";
    };

    TR.stop = function () {

        while (TR.wraps.length) {
            const pair = TR.wraps.pop();
            window[pair[0]] = pair[1];
        }

        TR.stopped = true;

        return "unhooked every wrapper; the trace buffer is kept";
    };

    /* ---------------------------------------------------------
       ARM — must be the last script tag so every app global and
       the DOM already exist.
    --------------------------------------------------------- */

    log(
        "TRACER armed - TEMPORARY diagnostic for the Trash bug. Changes nothing.",
        ""
    );

    log(
        "wrapped " + TR.wraps.length + " functions" +
        (TR.missing.length
            ? "; NOT FOUND: " + TR.missing.join(", ")
            : "; all targets found"),
        ""
    );

    log(
        "commands: __TR.mark('x')  __TR.snap('LABEL')  __TR.dump()  " +
        "__TR.copy()  __TR.on / __TR.off  __TR.stop()",
        ""
    );

})();