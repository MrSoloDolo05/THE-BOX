/* =========================================================
   ARCHIVED — NOT PART OF THE SHIPPED APP.

   Kept for reference only. This lives outside the Firebase
   hosting root (the-box/thebox) so it is never uploaded or
   served. The Red Room P0 it diagnosed is closed; restore it
   only if a future bug needs the same DOM/state/ledger trace.

   To use again: copy this file to thebox/js/redroom-trace.js
   and re-add the <script> tag as the LAST tag in index.html
   (after js/app.js), then hard-refresh.

   =========================================================
   REDROOM TRACE  —  TEMPORARY P0 DIAGNOSTIC  (observes only)

   Not a fix. It touches no app file:
     * classic-script `function` declarations are live
       properties of window, so wrapping window.endLiveEdit
       also captures every internal call site inside
       red-room.js / app.js / sync.js / tools.js.
     * the native `value` setter of textarea/input is wrapped,
       so EVERY programmatic DOM write is logged WITH A STACK:
       that answers "which exact function painted the older
       text" with no inference.
     * getUserDocRef() is proxied so the real Firestore
       onSnapshot callback is observed.

   Console commands:
     __RT.mark("step 1 typed AAAAA..")  annotate the timeline
     __RT.snap()                        snapshot right now
     __RT.dump()                        full trace as text
     __RT.copy()                        trace to clipboard
     __RT.download()                    save redroom-trace.txt
     __RT.on / __RT.off                 mute / unmute
     __RT.stop() / __RT.start()         unhook / hook everything

   DELETE THIS FILE AND ITS <script> TAG WHEN DONE.
   ========================================================= */

(function () {

    "use strict";

    const PREFIX = "[REDROOM TRACE]";
    const MAX_LINES = 8000;

    const RT = {
        lines: [],
        seq: 0,
        depth: 0,
        t0: (window.performance ? performance.now() : Date.now()),
        wall0: Date.now(),
        on: true,
        ctx: "ui",
        wraps: [],
        missing: [],
        hooked: false,
        pendingPointer: null,
        tracked: null
    };

    window.__RT = RT;

    /* Object identity tokens. WeakMap: app data objects are
       never mutated by the tracer. A token that changes while
       the user types proves identity divergence (two different
       section objects with the same id). */
    const tokens = new WeakMap();
    let tokenSeq = 0;

    function tid(obj) {
        if (!obj || typeof obj !== "object") return "-";
        let n = tokens.get(obj);
        if (!n) {
            n = ++tokenSeq;
            tokens.set(obj, n);
        }
        return "#" + n.toString(36);
    }

    function hash36(str) {
        let h = 2166136261 >>> 0;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 16777619) >>> 0;
        }
        return h.toString(36);
    }

    /* Short value + fingerprint: identical text always shares
       the same h=, so DOM / state / ledger / localStorage can
       be compared at a glance. */
    function H(value) {
        if (value === null || value === undefined) return "null";
        const s = String(value);
        return "len=" + s.length + " h=" + hash36(s);
    }

    function HV(value) {
        if (value === null || value === undefined) return "null";
        const s = String(value);
        return H(s) + " " + JSON.stringify(
            s.length <= 40 ? s : s.slice(0, 14) + "\u2026" + s.slice(-14)
        );
    }

    function safe(fn, fallback) {
        try { return fn(); } catch (error) { return fallback; }
    }
    /* ---- readers for app-internal bindings. `state`,
       `localLyricEdits`, the debounce timers etc. are top-level
       let/const of classic scripts: reachable by bare name from
       a later script, so every read is guarded and lazy. ---- */

    function appState() { return safe(() => state, null); }

    function findSection(sectionId, st) {
        const s = st || appState();
        if (!s || !Array.isArray(s.songs) || !sectionId) return null;
        for (let i = 0; i < s.songs.length; i++) {
            const song = s.songs[i];
            if (!song || !Array.isArray(song.sections)) continue;
            const section = song.sections.find(
                item => item && item.id === sectionId
            );
            if (section) return { song: song, section: section };
        }
        return null;
    }

    function findSong(songId, st) {
        const s = st || appState();
        if (!s || !Array.isArray(s.songs) || !songId) return null;
        return s.songs.find(item => item && item.id === songId) || null;
    }

    function sectionIdOf(node) {
        if (!node || !node.dataset) return null;
        return node.dataset.sectionId || node.dataset.editor || null;
    }

    function editorOf(sectionId) {
        return safe(
            () => document.querySelector('[data-editor="' + sectionId + '"]'),
            null
        );
    }

    function lsLyricsFor(sectionId) {
        const key = safe(() => DATABASE_KEY, null);
        if (!key) return "n/a";
        let raw = null;
        try { raw = localStorage.getItem(key); } catch (e) { return "unreadable"; }
        if (!raw) return "empty";
        if (raw.length > 5000000) return "too-big";
        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed.songs)) return "no-songs";
            for (let i = 0; i < parsed.songs.length; i++) {
                const song = parsed.songs[i];
                if (!song || !Array.isArray(song.sections)) continue;
                const hit = song.sections.find(
                    item => item && item.id === sectionId
                );
                if (hit) {
                    return H(hit.lyrics || "") +
                        " songModified=" + (song.modified || "?");
                }
            }
            return "section-absent";
        } catch (e) { return "parse-error"; }
    }

    function lsTitle() {
        const key = safe(() => DATABASE_KEY, null);
        const songId = safe(() => currentSongId, null);
        if (!key || !songId) return "n/a";
        let raw = null;
        try { raw = localStorage.getItem(key); } catch (e) { return "unreadable"; }
        if (!raw) return "empty";
        try {
            const parsed = JSON.parse(raw);
            const song = (parsed.songs || []).find(
                item => item && item.id === songId
            );
            return song ? H(song.title || "") : "song-absent";
        } catch (e) { return "parse-error"; }
    }

    function ledgerFor(sectionId) {
        const map = safe(() => localLyricEdits, null);
        if (!map) return "n/a";
        const edit = map.get(sectionId);
        if (!edit) return "size=" + map.size + " none";
        return "size=" + map.size + " {" + H(edit.value) +
            " age=" + (Date.now() - edit.stamp) + "ms song=" + edit.songId + "}";
    }

    function ledgerKeys() {
        const map = safe(() => localLyricEdits, null);
        if (!map) return "n/a";
        return "size=" + map.size + " [" + Array.from(map.keys()).join(",") + "]";
    }

    function titleLedger() {
        const edit = safe(() => localTitleEdit, null);
        if (edit === undefined) return "n/a";
        if (!edit) return "none";
        return "{" + H(edit.value) + " age=" + (Date.now() - edit.stamp) + "ms}";
    }

    function pendingSave() {
        const lyric = safe(() => lyricsSaveTimer, null);
        const title = safe(() => titleSaveTimer, null);
        return "lyricsSaveTimer=" + (lyric ? "armed" : "idle") +
            " titleSaveTimer=" + (title ? "armed" : "idle");
    }

    function flags() {
        const live = safe(() => (typeof isLiveEdit === "function"
            ? isLiveEdit() : liveEditActive), "?");
        const deferred = safe(() => renderDeferredWhileEditing, "?");
        const uiFocus = safe(() => (typeof isRedRoomUiFocused === "function"
            ? isRedRoomUiFocused() : "?"), "?");
        const editorFocus = safe(() => (typeof isRedRoomEditorFocused === "function"
            ? isRedRoomEditorFocused() : "?"), "?");
        const pushed = safe(() => Boolean(pushInFlight), "?");
        const rendered = safe(() => renderedSongId, "?");
        return "live=" + live + " deferred=" + deferred +
            " uiFocus=" + uiFocus + " editorFocus=" + editorFocus +
            " pushInFlight=" + pushed + " renderedSong=" + String(rendered).slice(-6);
    }

    function describeNode(node) {
        if (!node) return "null";
        if (node === document.body) return "BODY";
        const tag = String(node.tagName || node.nodeName || "?").toLowerCase();
        const id = node.id ? "#" + node.id : "";
        const cls = (node.classList && node.classList.length)
            ? "." + Array.from(node.classList).slice(0, 3).join(".")
            : "";
        const sec = (node.dataset && (node.dataset.sectionId || node.dataset.editor)) || "";
        const act = (node.dataset && node.dataset.action) || "";
        return tag + id + cls +
            (sec ? "[sec:" + String(sec).slice(-6) + "]" : "") +
            (act ? "[act:" + act + "]" : "") +
            (document.contains(node) ? "" : " (DETACHED)");
    }
    /* ---------------- logging --------------------------------- */

    function now() {
        return (window.performance ? performance.now() : Date.now());
    }

    function build(tag, detail) {
        const wall = new Date().toISOString().slice(11, 23);
        const rel = Math.round(now() - RT.t0);
        const indent = RT.depth > 0
            ? "  \u00b7".repeat(Math.min(RT.depth, 6)) + " "
            : "";
        return "#" + RT.seq + " " + wall + " +" + rel + "ms " + indent +
            "[" + RT.ctx + "] " + tag + (detail ? "  " + detail : "");
    }

    function log(tag, detail) {
        if (RT.muted) return "";
        RT.seq++;
        let line = "";
        try {
            line = build(tag, detail);
        } catch (e) {
            line = "#" + RT.seq + " [" + RT.ctx + "] " + tag + " (detail failed)";
        }
        RT.lines.push(line);
        if (RT.lines.length > MAX_LINES) RT.lines.shift();
        try {
            if (/^\u26a0|\u26a0 /.test(tag) || /\u26a0/.test(detail || "")) {
                console.warn(PREFIX + " " + line);
            } else {
                console.log(PREFIX + " " + line);
            }
        } catch (e) { /* console unavailable */ }
        return line;
    }

    /* Caller chain of the current call, function names only, so
       a painted DOM value can be traced to its exact writer. */
    function stack(skip) {
        try {
            const frames = String(new Error().stack || "").split("\n");
            const out = [];
            for (let i = skip || 2; i < frames.length && out.length < 6; i++) {
                let f = String(frames[i]).trim().replace(/^at /, "");
                if (!f) continue;
                f = f.replace(/\s*\(.*$/, "").replace(/https?:\/\/.*$/, "");
                if (/redroom-trace/.test(f)) continue;
                if (!f) continue;
                out.push(f);
            }
            return out.join(" \u2190 ") || "?";
        } catch (e) {
            return "?";
        }
    }

    /* ---------------- the snapshot ----------------------------
       Everything the P0 report must answer, on one line:
       DOM / STATE / LEDGER / localStorage / debounce / flags /
       object identities / where focus actually is.
    ------------------------------------------------------------ */

    function snapshot(sectionId, opts) {

        const o = opts || {};
        const sid = sectionId || RT.tracked || safe(() => currentSectionId, null);
        const hit = sid ? findSection(sid) : null;
        const dom = sid ? editorOf(sid) : null;
        const active = document.activeElement;

        const parts = [];

        parts.push("sec=" + String(sid || "-").slice(-6));
        parts.push("song=" + String(
            (hit && hit.song.id) || safe(() => currentSongId, "-") || "-"
        ).slice(-6));

        if (hit) {
            parts.push("objSong=" + tid(hit.song) + " objSec=" + tid(hit.section) +
                " songsArr=" + tid(appState() && appState().songs));
            parts.push("secModified=" + (hit.section.modified || "?"));
        } else if (sid) {
            parts.push("objSec=ABSENT-FROM-STATE");
        }

        parts.push("DOM=" + (dom
            ? H(dom.value || "") + " node=" + tid(dom)
            : (sid ? "no-textarea" : "-")));

        parts.push("STATE=" + (hit ? H(hit.section.lyrics || "") : "-"));
        parts.push("LS=" + (sid && o.ls ? lsLyricsFor(sid) : (sid ? "(skip)" : "-")));
        parts.push("LEDGER=" + (sid ? ledgerFor(sid) : "-"));
        parts.push("TITLE-LEDGER=" + titleLedger());
        parts.push("PENDING=" + pendingSave());
        parts.push("FLAGS=" + flags());
        parts.push("ACTIVE=" + describeNode(active));

        if (dom && hit) {
            const domH = hash36(dom.value || "");
            const stH = hash36(hit.section.lyrics || "");
            if (domH !== stH) {
                parts.push("\u26a0 DOM\u2260STATE dom=" + domH + " state=" + stH);
            }
            const edit = safe(() => localLyricEdits.get(sid), null);
            if (edit && hash36(edit.value || "") !== domH) {
                parts.push("\u26a0 LEDGER\u2260DOM ledger=" +
                    hash36(edit.value || "") + " dom=" + domH);
            }
        }

        return parts.join(" | ");
    }

    RT.snapshot = snapshot;
    RT.snap = function () { return log("SNAP", snapshot(null, { ls: true })); };
    RT.mark = function (label) {
        return log("MARK \u25b8 " + String(label || ""),
            snapshot(null, { ls: true }));
    };
    RT.ls = function (sectionId) { return lsLyricsFor(sectionId || RT.tracked); };
    RT.ledger = ledgerKeys;
    RT.flags = flags;
    /* ---------------- DOM observation hooks -------------------
       1. the native `value` setter is wrapped: every programmatic
          write into a section editor / title / label is logged
          with its caller chain. User keystrokes do NOT go through
          this setter, so anything logged here is the app painting
          text into the box.
       2. a MutationObserver on #song-sections reports every card
          rebuild and whether it destroyed the node the pointer is
          currently pressing (the card-button question).
       3. capture-phase listeners on document see every event the
          app's delegated listeners see, plus the ones outside.
    ------------------------------------------------------------ */

    const domHooks = { armed: false, native: {} };
    RT.hooks = domHooks;

    function isTrackedNode(el) {

        if (!el || !el.tagName) return false;

        const tag = el.tagName.toLowerCase();

        if (tag === "textarea") {
            return el.classList.contains("section-editor") ||
                !!(el.dataset && el.dataset.editor);
        }

        if (tag === "input") {
            return el.id === "song-title" ||
                (el.classList && el.classList.contains("section-name"));
        }

        return false;
    }

    function armValueSetter(proto, label) {

        const desc = Object.getOwnPropertyDescriptor(proto, "value");

        if (!desc || !desc.set || domHooks.native[label]) return;

        const nativeSet = desc.set;
        const nativeGet = desc.get;
        domHooks.native[label] = desc;

        try {
            Object.defineProperty(proto, "value", {
                configurable: true,
                enumerable: desc.enumerable,
                get: nativeGet,
                set: function (v) {

                    let current = "";

                    try { current = nativeGet.call(this) || ""; } catch (e) {}

                    if (isTrackedNode(this)) {

                        const incoming = (v === null || v === undefined) ? "" : String(v);
                        const sid = sectionIdOf(this);
                        let flag = "";

                        if (hash36(incoming) === hash36(current)) {
                            flag = " (same)";
                        } else if (incoming.length < current.length) {
                            flag = " \u26a0 SHORTENS THE BOX";
                        }

                        if (sid) RT.tracked = sid;

                        RT.ctx = "dom";
                        log("DOM-WRITE " + label +
                            (sid ? " sec=" + sid.slice(-6) : " " + describeNode(this)) +
                            " " + H(current) + " \u2192 " + H(incoming) + flag +
                            " node=" + tid(this),
                            "via " + stack(3));
                        RT.ctx = "ui";
                    }

                    return nativeSet.call(this, v);
                }
            });
        } catch (e) {
            log("\u26a0 could not wrap value setter for " + label + ": " + e);
        }
    }

    function armRebuildObserver() {

        const container = document.getElementById("song-sections");
        if (!container || RT.observer) return;

        RT.observer = new MutationObserver(mutations => {

            for (const m of mutations) {

                if (m.type !== "childList") continue;

                const removed = Array.from(m.removedNodes)
                    .filter(n => n && n.nodeType === 1);
                const added = Array.from(m.addedNodes)
                    .filter(n => n.nodeType === 1);

                if (!removed.length && !added.length) continue;

                let killedPointer = "";
                let killedFocus = "";
                const pending = RT.pendingPointer;

                for (const n of removed) {

                    if (pending && n.contains &&
                        (n === pending.el || n.contains(pending.el))) {

                        killedPointer = " \u26a0 REMOVED THE NODE THE POINTER IS PRESSING" +
                            " (act=" + pending.action + ", pressed " +
                            Math.round(now() - pending.t) + "ms ago) \u2192" +
                            " the click event for it can never fire";
                    }

                    if (killedFocus) continue;

                    try {
                        if (n.contains && n.contains(document.activeElement)) {
                            killedFocus = " \u26a0 REMOVED THE FOCUSED NODE";
                        }
                    } catch (e) {}
                }

                log("DOM-REBUILD #song-sections removed=" + removed.length +
                    " added=" + added.length + killedFocus + killedPointer,
                    "removed=[" + removed.map(describeNode).slice(0, 4).join(", ") +
                    "] (caller: see the RENDER line just above)");
            }
        });

        RT.container = container;
        RT.observer.observe(container, { childList: true });
    }
    /* ---------------- event observation ----------------------- */

    const WATCH = [
        "input", "focusin", "focusout", "blur", "focus",
        "change", "pointerdown", "pointerup", "click",
        "keydown", "keyup", "compositionstart",
        "compositionend", "paste", "cut"
    ];

    function relevant(type, target) {

        if (type === "keydown" || type === "keyup") {
            return isTrackedNode(target) ||
                !!(target && target.closest && target.closest(".song-section"));
        }

        const inside = !!(target && target.closest &&
            (target.closest("#song-sections") ||
             target.id === "song-title" ||
             target.closest("#red-room") ||
             target.closest(".modal")));

        const busy = safe(() =>
            (typeof isLiveEdit === "function" && isLiveEdit()) ||
            localLyricEdits.size > 0 ||
            renderDeferredWhileEditing, false);

        return inside || Boolean(busy);
    }

    function onWatchedEvent(event) {

        try {
            const type = event.type;
            const target = event.target;
            let sid = sectionIdOf(target);

            if (!sid && target && target.closest) {
                const card = target.closest(".song-section");
                sid = card ? sectionIdOf(card) : null;
            }

            if (!relevant(type, target)) return;

            if (sid) RT.tracked = sid;

            if (type === "pointerdown") {
                RT.pendingPointer = {
                    el: target,
                    action: (target.dataset && target.dataset.action) || "",
                    sectionId: sid,
                    t: now()
                };
            }

            if (type === "click" || type === "pointerup") {

                const p = RT.pendingPointer;

                if (p && type === "click") {

                    const same = p.el === target;
                    const alive = Boolean(target && document.contains(target));

                    log("EVT click", "target=" + describeNode(target) +
                        " pointerdown-was-on=" + describeNode(p.el) +
                        " same-node=" + same +
                        " click-target-in-document=" + alive +
                        (same && alive ? ""
                            : " \u26a0 THE CONTROL THAT WAS PRESSED IS NOT THE NODE THAT RECEIVED CLICK") +
                        " after=" + Math.round(now() - p.t) + "ms");
                }

                if (type === "click") RT.pendingPointer = null;
                log("EVT " + type, "target=" + describeNode(target) +
                    " | " + snapshot(sid, { ls: (type === "click") }));
                return;
            }

            let head = "EVT " + type + " target=" + describeNode(target);

            if (type === "focusout" || type === "blur") {
                head += " relatedTarget=" + describeNode(event.relatedTarget);
            }

            if (type === "focusin" || type === "focus") {
                head += " relatedTarget=" + describeNode(event.relatedTarget);
            }

            if (type === "input") {
                head += " inputType=" + (event.inputType || "?") +
                    " isComposing=" + Boolean(event.isComposing);
            }

            log(head, snapshot(sid, { ls: false }));

            if (type === "focusout" || type === "blur") {
                setTimeout(() => {
                    log("FOCUS-SETTLED (after the blur task)",
                        "ACTIVE=" + describeNode(document.activeElement) +
                        " | " + snapshot(null, { ls: false }));
                }, 0);
            }
        } catch (error) {
            log("\u26a0 tracer event handler failed for " + event.type + ": " + error);
        }
    }

    RT._onWatchedEvent = onWatchedEvent;

    function armEvents() {
        if (domHooks.armed) return;
        for (const type of WATCH) {
            document.addEventListener(type, onWatchedEvent, true);
        }
        window.addEventListener("pagehide", e => {
            log("EVT pagehide", snapshot(null, { ls: true }));
        }, true);
        document.addEventListener("visibilitychange", () => {
            log("EVT visibilitychange hidden=" + document.hidden,
                snapshot(null, { ls: true }));
        }, true);
        domHooks.armed = true;
    }

    function disarmEvents() {
        if (!domHooks.armed) return;
        for (const type of WATCH) {
            document.removeEventListener(type, onWatchedEvent, true);
        }
        domHooks.armed = false;
    }

    RT.unarmEvents = disarmEvents;
    /* ---------------- function observation --------------------
       Every classic-script `function` declaration is a live
       property of window, so replacing it also captures calls
       made from INSIDE red-room.js / app.js / sync.js.
    ------------------------------------------------------------ */

    function short6(id) { return String(id || "-").slice(-6); }

    function trackedSectionId() {
        return RT.tracked || safe(() => currentSectionId, null);
    }

    /* Mirrors the real guard inside refreshSectionCard so the
       tracer can say, before the call, whether state is about to
       be painted over the textarea. */
    function willPaintSection(sid) {

        const dom = editorOf(sid);
        const hit = findSection(sid);

        if (!dom || !hit) return null;
        if (document.activeElement === dom) return null;
        if (safe(() => (typeof hasLocalLyricEdit === "function" &&
            hasLocalLyricEdit(sid)), false)) return null;

        const domH = hash36(dom.value || "");
        const stH = hash36(hit.section.lyrics || "");

        if (domH === stH) return null;

        return { dom: dom, domH: domH, stH: stH, hit: hit };
    }

    function willPaintLabel(sid) {

        const card = safe(() => document.querySelector(
            '[data-section-id="' + sid + '"]'), null);
        const hit = findSection(sid);

        if (!card || !hit) return null;

        const input = card.querySelector("[data-section-name]");
        if (!input || document.activeElement === input) return null;
        if (safe(() => (typeof hasLocalLyricEdit === "function" &&
            hasLocalLyricEdit(sid)), false)) return null;
        if (hash36(input.value || "") === hash36(hit.section.name || "")) return null;

        return input;
    }

    function wrap(name, spec) {

        spec = spec || {};

        const orig = window[name];

        if (typeof orig !== "function") {
            RT.missing.push(name);
            return;
        }

        if (orig.__rtWrapped) return;

        const tag = spec.tag || name;

        const wrapped = function () {

            const args = Array.prototype.slice.call(arguments);
            const prevCtx = RT.ctx;

            if (spec.ctx) RT.ctx = spec.ctx;

            let enter = "";
            let silent = false;

            try {
                silent = Boolean(spec.silentEnter && spec.silentEnter(args));
                if (!silent) enter = spec.enter ? spec.enter(args) : "";
            } catch (e) { enter = "(enter failed: " + e + ")"; }

            if (!silent) log(tag + " \u2192", enter);

            RT.depth++;

            let out = null;
            let thrown = null;

            try {
                out = orig.apply(this, args);
            } catch (error) {
                thrown = error;
            } finally {
                RT.depth--;
            }

            function finish(value, rejection) {

                let detail = "";
                let mute = false;

                try {
                    mute = Boolean(spec.silentExit && spec.silentExit(args, value));
                    if (!mute) detail = spec.exit ? spec.exit(args, value) : "";
                } catch (e) { detail = "(exit failed: " + e + ")"; }

                if (rejection) {
                    log("\u26a0 " + tag + " rejected: " + rejection,
                        snapshot(trackedSectionId(), { ls: true }));
                } else if (!mute) {
                    log(tag + " \u2190", detail);
                }

                RT.ctx = prevCtx;
            }

            if (thrown) {
                log("\u26a0 " + tag + " threw: " + (thrown && thrown.message),
                    snapshot(trackedSectionId(), { ls: true }));
                RT.ctx = prevCtx;
                throw thrown;
            }

            if (out && typeof out.then === "function") {

                return out.then(
                    value => { finish(value, null); return value; },
                    error => {
                        finish(null, String(error && error.message || error));
                        throw error;
                    }
                );
            }

            finish(out, null);
            return out;
        };

        wrapped.__rtWrapped = true;
        RT.wraps.push([name, orig]);
        window[name] = wrapped;
    }
    /* ---- RED ROOM editing ---- */

    wrap("updateSectionLyrics", {
        tag: "EDIT updateSectionLyrics",
        enter: a => {
            RT.tracked = a[0];
            return "sec=" + short6(a[0]) + " incoming=" + HV(a[1]);
        },
        exit: a => snapshot(a[0], { ls: false })
    });

    wrap("recordLocalLyricEdit", {
        tag: "LEDGER record",
        enter: a => { RT.tracked = a[1]; return "sec=" + short6(a[1]) + " value=" + H(a[2]); },
        exit: a => ledgerFor(a[1])
    });

    wrap("applyLocalEditsToState", {
        tag: "LEDGER apply-to-state",
        enter: () => ledgerKeys(),
        exit: (a, out) => "restored=" + Boolean(out) + " | " + snapshot(null, { ls: false })
    });

    wrap("pruneLocalEdits", {
        tag: "LEDGER prune",
        enter: () => "before " + ledgerKeys() + " pending=" + pendingSave(),
        exit: () => "after " + ledgerKeys()
    });

    wrap("dropLocalEditsForSong", {
        tag: "LEDGER drop-song",
        enter: a => "song=" + short6(a[0]) + " before " + ledgerKeys(),
        exit: () => "after " + ledgerKeys()
    });

    wrap("beginLiveEdit", {
        tag: "LIVE beginLiveEdit",
        enter: () => "activeElement=" + describeNode(document.activeElement),
        exit: () => flags()
    });

    wrap("endLiveEdit", {
        tag: "LIVE endLiveEdit",
        enter: () => "activeElement=" + describeNode(document.activeElement) +
            " " + pendingSave() + " " + ledgerKeys(),
        exit: () => "after " + flags() + " | " + snapshot(null, { ls: false })
    });

    wrap("flushLyricsSave", {
        tag: "SAVE flushLyricsSave",
        enter: () => pendingSave() + " " + ledgerKeys(),
        exit: () => "LS now " + lsLyricsFor(trackedSectionId()) +
            " " + ledgerKeys() + " " + pendingSave()
    });

    wrap("flushTitleSave", {
        tag: "SAVE flushTitleSave",
        enter: () => pendingSave() + " TITLE-LEDGER=" + titleLedger(),
        exit: () => "LS title now " + lsTitle()
    });

    wrap("updateSongTitle", {
        tag: "EDIT updateSongTitle",
        enter: () => "domTitle=" + HV(safe(() => (document.getElementById("song-title") || {}).value, null)),
        exit: () => "STATE title=" + H(
            (findSong(safe(() => currentSongId, null)) || {}).title || "") +
            " TITLE-LEDGER=" + titleLedger()
    });

    /* ---- RED ROOM rendering ---- */

    function forceArg(a) {
        if (a[0] === undefined) return "none";
        if (a[0] && a[0].type) return "EVENT-OBJECT(" + a[0].type + ") \u26a0 truthy = forced rebuild";
        return String(a[0]);
    }

    wrap("renderRedRoomSafe", {
        tag: "RENDER redRoomSafe",
        enter: a => "arg0=" + forceArg(a) + " " + flags(),
        exit: () => snapshot(null, { ls: false })
    });

    wrap("renderRedRoomContent", {
        tag: "RENDER redRoomContent",
        enter: () => flags(),
        exit: () => ""
    });

    wrap("renderSections", {
        tag: "RENDER renderSections",
        enter: a => "arg0=" + forceArg(a) + " " + flags() +
            " (rebuilds every card with innerHTML unless the editor has focus)",
        exit: () => snapshot(null, { ls: false })
    });

    wrap("structuralRender", {
        tag: "RENDER structuralRender",
        enter: () => "flushes edits, then rebuilds ALL cards " + flags(),
        exit: () => snapshot(null, { ls: true })
    });

    wrap("refreshSectionCard", {
        tag: "RENDER refreshSectionCard",
        silentEnter: a => !willPaintSection(a[0]) && !willPaintLabel(a[0]),
        enter: a => {
            const p = willPaintSection(a[0]);
            const l = willPaintLabel(a[0]);
            return "sec=" + short6(a[0]) +
                (p ? " \u26a0 STATE IS ABOUT TO BE PAINTED OVER THE TEXTAREA dom=" +
                    p.domH + " \u2192 state=" + p.stH + " (state text will be visible)"
                    : "") +
                (l ? " \u26a0 STATE IS ABOUT TO BE PAINTED OVER THE LABEL INPUT" : "");
        },
        silentExit: () => true
    });

    /* ---- structural / card actions ---- */

    const CARD_ACTIONS = [
        "setCurrentSection", "commitSectionName", "renameSection",
        "deleteSection", "duplicateSection", "moveSection",
        "moveSectionUp", "moveSectionDown", "cycleSectionType",
        "addSection", "addCustomSection", "toggleSectionMenu",
        "closeOpenSectionMenus", "leaveSong",
        "openLinerPickerForSection"
    ];

    CARD_ACTIONS.forEach(name => {
        wrap(name, {
            tag: "ACTION " + name,
            enter: a => "arg0=" + (a[0] && a[0].tagName
                ? describeNode(a[0]) : short6(a[0])) +
                " " + flags() + " " + pendingSave(),
            exit: () => snapshot(null, { ls: false })
        });
    });
    /* ---- persistence ---- */

    wrap("saveState", {
        tag: "PERSIST saveState",
        ctx: "persist",
        enter: a => "silent=" + Boolean(a[0] && a[0].silent) +
            " " + ledgerKeys() + " " + pendingSave(),
        exit: () => "localStorage now holds lyrics " +
            lsLyricsFor(trackedSectionId()) +
            " | revision=" + safe(() => state.revision, "?")
    });

    wrap("loadState", {
        tag: "PERSIST loadState",
        ctx: "persist",
        enter: () => "\u26a0 replaces the whole state object from localStorage",
        exit: () => snapshot(null, { ls: true })
    });

    /* ---- the sync layer ---- */

    function incomingLyrics(st) {

        const sid = trackedSectionId();

        if (!st || !sid) return "-";

        const hit = findSection(sid, st);

        return hit
            ? H(hit.section.lyrics || "") + " objSec=" + tid(hit.section)
            : "section-absent-in-snapshot";
    }

    wrap("captureSyncState", {
        tag: "SYNC captureSyncState",
        enter: a => "arg=" + (a[0]
            ? (a[0] === safe(() => state, null) ? "THE-LIVE-STATE-OBJECT" : "other object")
            : "none (uses the live state)"),
        silentExit: (a, out) => {
            const st = safe(() => state, null);
            return !(out && st && out.songs === st.songs);
        },
        exit: (a, out) => {
            const st = safe(() => state, null);
            return "\u26a0 returned songs=" + tid(out && out.songs) +
                " is the SAME ARRAY OBJECT as state.songs=" +
                tid(st && st.songs) +
                " \u2192 not a copy: it cannot freeze the state against" +
                " keystrokes that happen during the round trip";
        }
    });

    wrap("mergeSyncState", {
        tag: "SYNC mergeSyncState",
        ctx: "merge",
        enter: a => "local.songs=" + tid(a[0] && a[0].songs) +
            " cloud.songs=" + tid(a[1] && a[1].songs) +
            " baseline=" + (a[2] ? "present" : "NULL \u26a0 the 3-way merge degrades to timestamps only") +
            " | local tracked=" + incomingLyrics(a[0]) +
            " | remote tracked=" + incomingLyrics(a[1]),
        exit: (a, out) => {
            const st = safe(() => state, null);
            return "merged tracked=" + incomingLyrics(out) +
                (out && st && out.songs === st.songs ? " (aliases live state)" : "") +
                " | state right before this adoption tracked=" +
                H((findSection(trackedSectionId()) || { section: {} }).section.lyrics || "");
        }
    });
    wrap("adoptMergedState", {
        tag: "ADOPT adoptMergedState",
        ctx: "adopt",
        enter: a => {

            const sid = trackedSectionId();
            const inc = sid ? findSection(sid, a[0]) : null;
            const live = sid ? findSection(sid) : null;
            const dom = sid ? editorOf(sid) : null;
            const domH = dom ? hash36(dom.value || "") : null;
            const incH = inc ? hash36(inc.section.lyrics || "") : null;

            let verdict = "";

            if (dom && inc && domH !== incH) {
                verdict = " \u26a0 THE SNAPSHOT BEING ADOPTED CARRIES DIFFERENT TEXT" +
                    " THAN THE BOX SHOWS (dom=" + domH + " incoming=" + incH + ")" +
                    " \u2192 whichever render follows decides what the writer sees";
            }

            return "incoming " + incomingLyrics(a[0]) +
                " | state " + (live ? H(live.section.lyrics || "") : "-") +
                " | dom " + (dom ? H(dom.value || "") : "no-textarea") +
                " " + ledgerKeys() + verdict;
        },
        exit: () => "state now: " + snapshot(null, { ls: true })
    });

    wrap("rememberSyncedSignature", {
        tag: "SYNC rememberSyncedSignature",
        enter: a => "digest-to-ignore=" +
            String(safe(() => stateDigest(a[0] || safe(() => state, null)), "?")).slice(0, 16) +
            " (this is what the echo gate compares cloud documents against)",
        silentExit: () => true
    });

    wrap("setSyncBaseline", {
        tag: "SYNC setSyncBaseline",
        enter: a => {

            const songId = safe(() => currentSongId, null);
            const entry = a[0] && a[0].songs && songId ? a[0].songs[songId] : null;
            const live = findSong(songId);
            let note = "";

            try {
                if (entry && live && typeof digestRecord === "function") {
                    const liveDigest = digestRecord(live);
                    note = " baseline[tracked song]=" + String(entry).slice(0, 12) +
                        " live-song-digest=" + String(liveDigest).slice(0, 12) +
                        (entry === liveDigest
                            ? " SAME \u2192 the baseline now tells the merge the cloud" +
                              " already holds exactly what this device has locally"
                            : " different");
                }
            } catch (e) { note = "(digest compare failed)"; }

            return "uid=" + (a[0] && a[0].uid) + note;
        },
        silentExit: () => true
    });
    wrap("pushState", {
        tag: "PUSH pushState",
        ctx: "push",
        enter: () => "start | signedIn=" +
            safe(() => (typeof isSignedIn === "function" && isSignedIn()), "?") +
            " busy=" + safe(() => Boolean(pushInFlight), "?") +
            " queued=" + safe(() => pushPending, "?") +
            " " + pendingSave() + " " + ledgerKeys(),
        exit: () => "done | " + snapshot(null, { ls: false })
    });

    wrap("runPushTransaction", {
        tag: "PUSH runPushTransaction",
        ctx: "push",
        enter: () => "begin | baseline=" +
            (safe(() => getSyncBaseline(), null) ? "present" : "NULL") +
            " | " + snapshot(null, { ls: false }),
        exit: () => "committed | " + snapshot(null, { ls: true }) +
            " lastPushedSignature=" +
            String(safe(() => lastPushedSignature, "?") || "-").slice(0, 16)
    });

    wrap("pullState", {
        tag: "PUSH pullState",
        ctx: "pull",
        enter: () => "start",
        exit: () => snapshot(null, { ls: true })
    });

    /* ---- the realtime listener --------------------------
       The app's own onSnapshot callback cannot be wrapped
       without handing Firestore a fake DocumentReference, so
       the tracer attaches its OWN read-only listener to the
       same document. It writes nothing; it reports what the
       cloud sent and how the app's echo gate will judge it.
    ------------------------------------------------------------ */

    function describeRemoteSnapshot(doc) {

        const sid = trackedSectionId();
        let exists = false, remote = "-", echo = "?", modified = "?";

        try {
            exists = Boolean(doc && doc.exists);
            const data = exists ? doc.data() : null;

            if (data && data.state) {

                const hit = findSection(sid, data.state);
                remote = hit ? H(hit.section.lyrics || "") : "absent";

                const song = hit ? findSong(hit.song.id, data.state) : null;
                modified = song ? (song.modified || "?") : "?";

                const sig = String(stateDigest(data.state)).slice(0, 16);
                const mine = String(safe(() => lastPushedSignature, "") || "").slice(0, 16);

                echo = (sig === mine)
                    ? "matches lastPushedSignature \u2192 app SKIPS this as its own echo"
                    : "DIFFERS from lastPushedSignature \u2192 app MERGES it and may ADOPT it";
            }
        } catch (e) {
            remote = "(inspect failed: " + e + ")";
        }

        return "exists=" + exists + " remote-lyrics=" + remote +
            " remote-song-modified=" + modified +
            " echo-gate=" + echo + " | " + snapshot(sid, { ls: false });
    }

    function armRemoteObserver() {

        if (RT.remoteUnsub) return true;

        let ref = null;

        try {
            ref = (typeof getUserDocRef === "function") ? getUserDocRef() : null;
        } catch (e) {
            return false;
        }

        if (!ref || typeof ref.onSnapshot !== "function") return false;

        try {
            RT.remoteUnsub = ref.onSnapshot(
                doc => {
                    RT.ctx = "remote";
                    log("REMOTE onSnapshot (tracer's own read-only listener)",
                        describeRemoteSnapshot(doc));
                    RT.ctx = "ui";
                },
                error => log("\u26a0 tracer observer error: " + (error && error.message))
            );
            log("TRACE attached the read-only realtime observer");
            return true;
        } catch (e) {
            log("\u26a0 could not attach tracer observer: " + e);
            return false;
        }
    }

    wrap("startListening", {
        tag: "LISTENER startListening",
        enter: () => "(app registers its realtime listener)",
        exit: () => (armRemoteObserver() ? "tracer observer armed" : "tracer observer not ready yet")
    });
    /* ---- ONE LINERS / verse / tool insertion ---- */

    wrap("insertIntoSection", {
        tag: "INSERT insertIntoSection",
        ctx: "insert",
        enter: a => {

            const sid = safe(() => currentSectionId, null);
            const hit = findSection(sid);
            const ed = editorOf(sid);

            RT.tracked = sid;

            const stateH = hash36((hit && hit.section.lyrics) || "");
            const domH = ed ? hash36(ed.value || "") : null;

            return "target-song=" + short6(hit && hit.song.id) +
                " target-section=" + short6(sid) +
                " text=" + HV(a[0]) +
                " | state-before=" + H((hit && hit.section.lyrics) || "") +
                " | dom=" + (ed ? H(ed.value || "") : "no-textarea(APPEND path)") +
                " caret=" + (ed ? (ed.selectionStart + ".." + ed.selectionEnd) : "n/a") +
                (ed && domH !== stateH
                    ? " \u26a0 CARET OFFSETS COME FROM THE DOM BUT THE TEXT IS SLICED" +
                      " FROM STATE AND THE TWO DISAGREE (dom=" + domH + " state=" + stateH + ")"
                    : "") +
                " " + ledgerKeys();
        },
        exit: (a, out) => "returned " + (out ? "song " + short6(out.id)
                : "NULL \u26a0 NOTHING WAS INSERTED") +
            " | state-after=" +
            H((findSection(trackedSectionId()) || { section: {} }).section.lyrics || "") +
            " | dom-after=" + H((editorOf(trackedSectionId()) || { value: "" }).value || "") +
            " " + ledgerKeys() +
            " (writes section.lyrics directly: no updateSectionLyrics, therefore no" +
            " ledger entry and no live-edit protection)"
    });

    ["insertLiner", "insertVerse", "insertRhyme"].forEach(name => {
        wrap(name, {
            tag: "INSERT " + name,
            ctx: "insert",
            enter: a => "arg0=" + String(a[0] || "").slice(0, 24) +
                " currentSection=" + short6(safe(() => currentSectionId, null)) +
                " " + flags() + " " + pendingSave(),
            exit: () => snapshot(null, { ls: true })
        });
    });

    ["openLinerPicker", "closeModal", "showView", "openSong"].forEach(name => {
        wrap(name, {
            tag: "NAV " + name,
            enter: a => "arg0=" + (a[0] && a[0].type ? "EVENT" : short6(a[0])) +
                " " + flags() + " " + pendingSave() + " " + ledgerKeys(),
            exit: () => snapshot(null, { ls: false })
        });
    });
    /* ---------------- lifecycle ----------------------------- */

    RT.armed = false;

    RT.start = function () {

        armValueSetter(window.HTMLTextAreaElement.prototype, "textarea");
        armValueSetter(window.HTMLInputElement.prototype, "input");
        armRebuildObserver();
        armEvents();
        armRemoteObserver();
        RT.armed = true;

        clearInterval(RT.armTimer);

        let attempts = 0;

        RT.armTimer = setInterval(() => {

            attempts++;
            if (!RT.observer) armRebuildObserver();
            armRemoteObserver();

            if ((RT.observer && RT.remoteUnsub) || attempts > 30) {
                clearInterval(RT.armTimer);
            }
        }, 1500);

        return "armed";
    };

    RT.stop = function () {

        try {
            if (domHooks.native.textarea) {
                Object.defineProperty(
                    HTMLTextAreaElement.prototype, "value", domHooks.native.textarea);
                delete domHooks.native.textarea;
            }
            if (domHooks.native.input) {
                Object.defineProperty(
                    HTMLInputElement.prototype, "value", domHooks.native.input);
                delete domHooks.native.input;
            }
        } catch (e) { /* setter already restored */ }

        disarmEvents();

        if (RT.observer) {
            RT.observer.disconnect();
            RT.observer = null;
        }

        while (RT.wraps.length) {
            const pair = RT.wraps.pop();
            window[pair[0]] = pair[1];
        }

        if (RT.remoteUnsub) {
            try { RT.remoteUnsub(); } catch (e) {}
            RT.remoteUnsub = null;
        }

        clearInterval(RT.armTimer);
        RT.armed = false;

        return "unhooked everything (the trace buffer is kept)";
    };

    RT.off = function () { RT.muted = true; return "logging muted, hooks still in place"; };
    RT.on = function () { RT.muted = false; return "logging live"; };

    RT.dump = function () { return RT.lines.join("\n"); };
    RT.count = function () { return RT.lines.length; };
    RT.clear = function () { RT.lines.length = 0; RT.seq = 0; return "cleared"; };

    RT.copy = function () {
        const text = RT.dump();
        try { navigator.clipboard.writeText(text); } catch (e) {}
        log("TRACE copied " + RT.lines.length + " lines to the clipboard");
        return text;
    };

    RT.download = function () {
        const blob = new Blob([RT.dump()], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "redroom-trace.txt";
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        return RT.lines.length + " lines written to redroom-trace.txt";
    };
    /* Arm immediately: this is the last script tag, so the DOM
       and every app function already exist. */
    RT.start();

    log("TRACE armed \u2014 redroom-trace.js is a TEMPORARY diagnostic. It changes" +
        " nothing; delete the file and its script tag once the P0 is explained.");
    log("TRACE commands: __RT.mark('step 1')  __RT.snap()  __RT.dump()  __RT.copy()" +
        "  __RT.download()  __RT.ls()  __RT.ledger()  __RT.off()  __RT.stop()");
    log("TRACE wrapped " + RT.wraps.length + " functions. Not found (typo or removed): " +
        (RT.missing.length ? RT.missing.join(", ") : "none"));

})();












