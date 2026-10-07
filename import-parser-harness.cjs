const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const context = vm.createContext({});
const source = fs.readFileSync(
    "the-box/thebox/js/import.js",
    "utf8"
);

vm.runInContext(source, context, {
    filename: "import.js"
});

const parseSong = context.parseSong;
const titleFromFilename = context.titleFromFilename;
const isSupportedImportFile = context.isSupportedImportFile;

const allCapsLyrics = parseSong("I'M STILL HERE\nDON'T LET GO");
assert.equal(allCapsLyrics.sections.length, 1);
assert.equal(
    allCapsLyrics.sections[0].lyrics.join("\n"),
    "I'M STILL HERE\nDON'T LET GO"
);

const lyricsBeforeHeader = parseSong(
    "The first line stays lyrics\nVERSE 1:\nA second line"
);
assert.deepEqual(
    JSON.parse(JSON.stringify(lyricsBeforeHeader.sections)),
    [
        { type: "VERSE", lyrics: ["The first line stays lyrics"] },
        { type: "VERSE 1", lyrics: ["A second line"] }
    ]
);

const explicitTitle = parseSong(
    "TITLE: The Working Title\n[VERSE 1]\nA lyric"
);
assert.equal(explicitTitle.title, "The Working Title");
assert.equal(explicitTitle.sections[0].type, "VERSE 1");
assert.equal(explicitTitle.sections[0].lyrics[0], "A lyric");

const filenameTitle = parseSong("A lyric without a header");
assert.equal(filenameTitle.title, "");
assert.equal(filenameTitle.sections[0].lyrics[0], "A lyric without a header");
assert.equal(titleFromFilename("C:\\songs\\A_New_Song.md"), "A New Song");

const stanzas = parseSong("First stanza\nline two\n\nSecond stanza");
assert.deepEqual(
    JSON.parse(JSON.stringify(stanzas.sections)),
    [
        { type: "VERSE 1", lyrics: ["First stanza", "line two"] },
        { type: "VERSE 2", lyrics: ["Second stanza"] }
    ]
);

assert.equal(isSupportedImportFile({ name: "lyrics.markdown" }), true);
assert.equal(isSupportedImportFile({ name: "lyrics.pdf" }), false);

console.log("Import parser harness passed.");
