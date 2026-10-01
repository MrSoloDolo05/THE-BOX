/* Scratch verification harness for the RED ROOM multi-card editing P0.
   Loads state.js + red-room.js + sync.js into one shared scope with a
   minimal fake DOM, then replays the regression scenario.
   Temporary file: node tools-p0-check.cjs */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const JS = path.join(__dirname, "the-box", "thebox", "js");

function source(name) {
    return fs.readFileSync(path.join(JS, name), "utf8").replace(/^\uFEFF/, "");
}

/* ---------------- minimal fake DOM ---------------- */

function matchSelector(node, selector) {
    const attr = selector.match(/^\[data-section-id="(.+)"\]$/);
    if (attr) return Boolean(node.dataset && node.dataset.sectionId === attr[1]);
    if (selector.startsWith(".")) {
        return (node.className || "").split(/\s+/).includes(selector.slice(1));
    }
    if (selector.startsWith("#")) return node.id === selector.slice(1);
    return node.tagName === selector.toUpperCase();
}

function makeEl(tag, init = {}) {
    const el = {
        tagName: tag,
        id: init.id || "",
        className: init.className || "",
        value: init.value || "",
        dataset: init.dataset || {},
        children: [],
        parent: null,
        rebuilds: 0,
        classList: { toggle() {}, contains() { return false; } },
        append(child) {
            child.parent = el;
            el.children.push(child);
            return child;
        },
        closest(selector) {
            const parts = selector.split(",").map(s => s.trim());
            let node = el;
            while (node) {
                if (node.id && parts.includes("#" + node.id)) return node;
                const classes = (node.className || "").split(/\s+/);
                if (parts.some(p => p.startsWith(".") && classes.includes(p.slice(1)))) return node;
                node = node.parent;
            }
            return null;
        },
        querySelector(selector) {
            const found = [];
            (function walk(node) {
                node.children.forEach(child => { found.push(child); walk(child); });
            })(el);
            return selector.split(",").map(s => s.trim())
                .reduce((hit, part) => hit || found.find(node => matchSelector(node, part)), null);
        }
    };

    Object.defineProperty(el, "textContent", {
        get() { return el._text || ""; },
        set(v) { el._text = v; }
    });

    Object.defineProperty(el, "innerHTML", {
        get() { return ""; },
        set(markup) { el.rebuilds += 1; parseCards(el, markup); }
    });

    (init.children || []).forEach(child => el.append(child));
    return el;
}

function parseCards(el, markup) {
    el.children = [];

    const textarea = /<textarea[^>]*data-section-id="([^"]+)"[^>]*>([\s\S]*?)<\/textarea>/g;
    let hit;

    while ((hit = textarea.exec(markup)) !== null) {
        const id = hit[1];
        const lyrics = hit[2]
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&amp;/g, "&");

        const label = makeEl("input", {
            className: "section-name",
            value: "",
            dataset: { sectionId: id }
        });

        const editor = makeEl("textarea", {
            className: "section-editor",
            value: lyrics,
            dataset: { sectionId: id }
        });

        const card = makeEl("div", {
            className: "song-section",
            dataset: { sectionId: id }
        });

        card.append(label);
        card.append(editor);
        el.append(card);
    }
}

/* ---------------- the document the app sees ---------------- */

const container = makeEl("div", { id: "song-sections" });
const titleInput = makeEl("input", { id: "song-title" });

function cardOf(sectionId) {
    return container.children.find(
        item => item.dataset.sectionId === sectionId
    ) || null;
}

function editorOf(sectionId) {
    const card = cardOf(sectionId);
    return card ? card.children[1] : null;
}

function labelOf(sectionId) {
    const card = cardOf(sectionId);
    return card ? card.children[0] : null;
}

const document = {
    activeElement: null,
    visibilityState: "visible",
    getElementById(id) {
        if (id === "song-sections") return container;
        if (id === "song-title") return titleInput;
        return null;
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {}
};

/* ---------------- harness plumbing ---------------- */

const savedStates = [];
const checks = [];

function check(name, pass, got) {
    checks.push({ name, pass, got });
}

function report() {
    let failed = 0;

    checks.forEach(item => {
        if (!item.pass) failed += 1;
        console.log(
            (item.pass ? "PASS  " : "FAIL  ") + item.name +
            (item.pass ? "" : "   -> got " + JSON.stringify(item.got))
        );
    });

    console.log(
        failed
            ? "\n" + failed + " CHECK(S) FAILED"
            : "\nALL CHECKS PASSED"
    );

    process.exitCode = failed ? 1 : 0;
}

const context = {
    document,
    window: { addEventListener() {}, crypto: {} },
    setTimeout,
    clearTimeout,
    console,
    JSON, Math, Date, Object, Array, String, Number, Boolean,
    Set, Map, RegExp, Error, isNaN, parseInt, parseFloat,
    savedStates,
    checks,
    check,
    report,
    container,
    titleInput,
    cardOf,
    editorOf,
    labelOf
};

context.makeElButton = function () {
    return makeEl("button", { className: "section-kebab" });
};

/* Negative control: node tools-p0-check.cjs --pre-fix
   neutralises the new protections to confirm the checks really
   detect the regression they were written for. */
const negative = process.argv.includes("--pre-fix")
    ? `
applyLocalEditsToState = function () { return false; };
hasLocalLyricEdit = function () { return false; };
`
    : "";

/* in-memory storage so database.js can load and persist for real */
const storage = new Map();

context.localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); },
    clear() { storage.clear(); }
};

context.indexedDB = undefined;
context.window.localStorage = context.localStorage;
context.window.indexedDB = undefined;
context.window.matchMedia = function () {
    return { matches: false, addEventListener() {}, addListener() {} };
};

const program = [
    source("state.js"),
    source("database.js"),
    source("red-room.js"),
    source("sync.js"),
    negative,
    fs.readFileSync(path.join(__dirname, "tools-p0-scenario.js"), "utf8")
].join("\n;\n");

const sandbox = vm.createContext(context);

try {
    vm.runInContext(program, sandbox, { filename: "combined.js" });
} catch (error) {
    console.error("HARNESS ERROR:", (error && error.stack) || error);
    process.exitCode = 1;
}

