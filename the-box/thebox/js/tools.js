/* =========================================================
   TOOLS
========================================================= */


/* =========================================================
   RHYME DICTIONARY
========================================================= */

/* =========================================================
   RHYME FAMILIES
   (curated, offline rhyming dictionary grouped into
   families of words that share the same rhyme sound)
========================================================= */

const rhymeFamilies = {

    light: [
        "night", "light", "fight", "sight", "right", "white",
        "might", "tight", "bright", "flight", "slight", "spite",
        "bite", "kite", "site", "write", "height", "tonight",
        "alright", "delight", "ignite", "excite", "polite",
        "outright"
    ],

    day: [
        "day", "way", "say", "stay", "play", "away", "okay",
        "today", "may", "pay", "lay", "gray", "grey", "sway",
        "tray", "delay", "display", "betray", "decay", "pray",
        "ray", "hey", "neigh"
    ],

    pain: [
        "rain", "pain", "train", "chain", "brain", "sane", "vain",
        "stain", "strain", "again", "explain", "complain", "maintain",
        "contain", "remain", "refrain", "domain", "terrain", "plane",
        "plain"
    ],

    time: [
        "time", "rhyme", "climb", "prime", "crime", "slime", "chime",
        "lime", "mime", "lifetime", "sublime", "paradigm"
    ],

    fine: [
        "mine", "fine", "shine", "line", "sign", "design", "define",
        "align", "wine", "divine", "combine", "confine", "refine",
        "resign", "nine", "pine", "vine"
    ],

    name: [
        "name", "fame", "game", "same", "flame", "claim", "aim",
        "blame", "shame", "frame", "came", "tame", "became",
        "proclaim"
    ],

    well: [
        "well", "tell", "fell", "bell", "hell", "sell", "spell",
        "smell", "shell", "dwell", "farewell", "hotel", "rebel",
        "excel", "yell", "swell"
    ],

    bone: [
        "one", "alone", "stone", "bone", "phone", "grown", "thrown",
        "tone", "throne", "drone", "unknown", "overthrown"
    ],

    home: [
        "home", "roam", "chrome", "foam", "comb", "dome", "tome",
        "gnome"
    ],

    sun: [
        "sun", "run", "gun", "done", "none", "fun", "begun",
        "undone", "everyone", "overrun"
    ],

    door: [
        "more", "floor", "door", "score", "before", "ignore",
        "explore", "store", "adore", "shore", "core", "restore",
        "encore", "therefore", "metaphor", "pour"
    ],

    hear: [
        "hear", "near", "year", "clear", "fear", "dear", "appear",
        "disappear", "sincere", "atmosphere", "career", "interfere",
        "pioneer", "volunteer"
    ],

    air: [
        "air", "care", "bear", "wear", "share", "dare", "fare",
        "rare", "stare", "aware", "prepare", "compare", "despair",
        "repair", "declare"
    ],

    wide: [
        "wide", "ride", "hide", "side", "pride", "guide", "aside",
        "decide", "collide", "divide", "denied", "tried", "cried",
        "died", "slide", "tied", "inside", "provide"
    ],

    own: [
        "known", "own", "grown", "thrown", "unknown", "overgrown",
        "sown", "blown"
    ],

    book: [
        "book", "look", "took", "shook", "hook", "cook", "brook",
        "crook", "nook"
    ],

    late: [
        "late", "wait", "great", "create", "state", "fate",
        "straight", "relate", "translate", "appreciate", "separate",
        "locate", "navigate", "hesitate", "rate", "gate", "hate"
    ],

    love: [
        "love", "above", "dove", "glove", "shove"
    ],

    blood: [
        "blood", "flood", "mud", "stud", "crush", "blush"
    ],

    trust: [
        "must", "trust", "lust", "dust", "adjust", "unjust",
        "disgust", "thrust", "crust"
    ],

    land: [
        "land", "hand", "stand", "understand", "command", "demand",
        "expand", "band", "brand", "strand", "grand", "sand"
    ],

    can: [
        "can", "man", "plan", "ran", "than", "began", "span", "tan",
        "scan", "ban", "fan", "pan"
    ],

    sound: [
        "found", "sound", "ground", "around", "hound", "pound",
        "astound", "rebound", "profound", "round", "drowned"
    ],

    deep: [
        "keep", "sleep", "deep", "cheap", "creep", "weep", "leap",
        "steep", "heap", "asleep", "sweep"
    ],

    sing: [
        "sing", "bring", "ring", "thing", "king", "spring", "swing",
        "sting", "wing", "cling", "fling"
    ],

    not: [
        "not", "got", "lot", "hot", "shot", "plot", "forgot", "rot",
        "spot", "knot", "jot"
    ],

    star: [
        "far", "star", "car", "jar", "bazaar", "bizarre", "guitar"
    ],

    free: [
        "see", "be", "free", "three", "tree", "degree", "agree",
        "guarantee", "sea", "flea", "key", "me", "we"
    ],

    cool: [
        "cool", "school", "fool", "rule", "tool", "pool", "jewel",
        "duel"
    ],

    back: [
        "back", "black", "track", "crack", "pack", "lack", "stack",
        "attack", "unpack", "hack", "jack"
    ],

    broke: [
        "broke", "smoke", "joke", "woke", "spoke", "cloak", "provoke",
        "evoke", "stroke"
    ],

    wild: [
        "child", "wild", "mild", "piled", "smiled", "compiled"
    ],

    grow: [
        "show", "know", "go", "throw", "grow", "slow", "blow", "flow",
        "low", "glow", "though", "below", "hello", "tomorrow"
    ],

    cold: [
        "cold", "old", "bold", "hold", "fold", "gold", "sold", "told"
    ],

    come: [
        "some", "numb", "come", "thumb", "drum", "plum"
    ],

    blue: [
        "blue", "true", "through", "new", "you", "grew", "flew",
        "too", "two", "few", "do", "who", "choose"
    ],

    heart: [
        "heart", "start", "apart", "art", "chart", "smart", "dart",
        "part"
    ],

    fire: [
        "fire", "higher", "wire", "desire", "tire", "choir", "liar",
        "flyer", "buyer"
    ]
};


/* =========================================================
   RHYME FINDER
========================================================= */

/* =========================================================
   RHYME ENGINE
========================================================= */

const RHYME_VOWELS = "aeiou";

const RHYME_COMMON_ENDINGS = [
    "ing", "ight", "ay", "ine", "ate", "one", "ell", "ow"
];

let rhymeIndexBuilt = false;

const wordToFamily = {};

const familyWordLists = {};

function cleanWord(value) {
    return String(value)
        .toLowerCase()
        .replace(/[^a-z]/g, "");
}

function lastVowelIndex(value) {
    for (let i = value.length - 1; i >= 0; i -= 1) {
        if (RHYME_VOWELS.includes(value[i])) {
            return i;
        }
    }
    return -1;
}

function rhymeKey(value) {
    let word = cleanWord(value);
    if (!word) {
        return "";
    }
    if (word.length > 1 && word.endsWith("e")) {
        word = word.slice(0, -1);
    }
    const index = lastVowelIndex(word);
    return index === -1 ? word.slice(-3) : word.slice(index);
}

function lastVowelChar(value) {
    let word = cleanWord(value);
    if (!word) {
        return "";
    }
    if (word.length > 1 && word.endsWith("e")) {
        word = word.slice(0, -1);
    }
    const index = lastVowelIndex(word);
    return index === -1 ? "" : word[index];
}

/* -----------------------------------------------------
   NEAR / SLANT RHYME DETECTION
   A reliable near rhyme shares the SAME final vowel
   sound but a different ending (assonance), e.g.
   time / light / ride. Matching on a lone shared
   trailing consonant (the old logic) produced noise
   like "alone -> rain". Keep it strict so the
   suggestions stay musical.
----------------------------------------------------- */

function isNearRhyme(a, b) {
    const keyA = rhymeKey(a);
    const keyB = rhymeKey(b);
    if (keyA === keyB) {
        return false;
    }
    const vowelA = lastVowelChar(a);
    const vowelB = lastVowelChar(b);
    if (!vowelA || !vowelB) {
        return false;
    }
    return vowelA === vowelB;
}

function countSyllables(value) {
    const word = cleanWord(value);
    if (!word) {
        return 1;
    }
    const groups =
        word
            .replace(/[^aeiouy]+/g, " ")
            .split(" ")
            .filter(Boolean);
    let count = Math.max(1, groups.length);
    if (
        word.endsWith("e") &&
        word.length > 2 &&
        !/[aeiou]e$/.test(word)
    ) {
        count = Math.max(1, count - 1);
    }
    return count;
}

function buildRhymeIndex() {
    if (rhymeIndexBuilt) {
        return;
    }
    Object.keys(rhymeFamilies).forEach(key => {
        const words = rhymeFamilies[key] || [];
        familyWordLists[key] = [...words];
        words.forEach(raw => {
            const word = cleanWord(raw);
            if (word && !wordToFamily[word]) {
                wordToFamily[word] = key;
            }
        });
    });
    rhymeIndexBuilt = true;
}

function capitaliseWord(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
}

function renderRhymeWords(list, fallback) {
    if (!list.length) {
        return `<span class="rhyme-empty">${fallback}</span>`;
    }
    return list
        .map(word => `
            <span
                class="rhyme-word"
                onclick="insertRhyme('${word.replace(/'/g, "")}')"
                title="Insert ${escapeHTML(word)}"
            >
                ${escapeHTML(word)}
            </span>
        `)
        .join("");
}

let rhymeRequestId = 0;


function computeRhymesLocal(word) {

    buildRhymeIndex();

    const queryKey = rhymeKey(word);
    const ownFamily = wordToFamily[word];

    const perfect = [];
    const near = [];

    if (ownFamily) {

        (familyWordLists[ownFamily] || []).forEach(candidate => {

            if (
                candidate !== word &&
                !perfect.includes(candidate)
            ) {
                perfect.push(candidate);
            }
        });
    }

    Object.keys(wordToFamily).forEach(candidate => {

        if (candidate === word) {
            return;
        }

        const candidateKey = rhymeKey(candidate);

        if (
            !ownFamily &&
            candidateKey === queryKey
        ) {

            if (!perfect.includes(candidate)) {
                perfect.push(candidate);
            }

        } else if (

            !perfect.includes(candidate) &&
            !near.includes(candidate) &&
            isNearRhyme(word, candidate)

        ) {

            near.push(candidate);
        }
    });

    return { perfect: perfect, near: near };
}


function renderRhymeResults(word, perfectList, nearList, mode) {

    const container =
        document.getElementById(
            "rhyme-results"
        );

    if (!container) {
        return;
    }

    const syllables = countSyllables(word);

    let syncLabel = "";

    if (mode === "online") {

        syncLabel =
            `<span class="rhyme-sync live">LIVE · DATAMUSE</span>`;

    } else if (mode === "offline") {

        syncLabel =
            `<span class="rhyme-sync offline">DICTIONARY</span>`;

    } else {

        syncLabel =
            `<span class="rhyme-sync loading">SYNCING…</span>`;
    }

    container.innerHTML = `
        <div class="rhyme-meta">
            ${escapeHTML(capitaliseWord(word))} &middot; ${syllables} syllable${syllables === 1 ? "" : "s"}
            ${syncLabel}
        </div>

        <div class="rhyme-group">
            <div class="rhyme-label">PERFECT</div>
            ${renderRhymeWords(perfectList, "No perfect rhymes found yet.")}
        </div>

        <div class="rhyme-group">
            <div class="rhyme-label">NEAR / SLANT</div>
            ${renderRhymeWords(nearList, "No near rhymes found — try the endings below.")}
        </div>

        <div class="rhyme-group">
            <div class="rhyme-label">TRY ENDINGS</div>
            <div class="rhyme-endings-list">
                ${RHYME_COMMON_ENDINGS
                    .map(ending => `<span>-${ending.toUpperCase()}</span>`)
                    .join("")}
            </div>
        </div>
    `;
}


async function fetchRhymesOnline(word) {

    const clean = cleanWord(word);

    if (!clean || typeof window.fetch !== "function") {
        throw new Error("NO_OFFLINE_SUPPORT");
    }

    const request = async (relation, max) => {

        const response =
            await fetch(
                `https://api.datamuse.com/words?${relation}=${encodeURIComponent(clean)}&max=${max}`
            );

        if (!response.ok) {
            throw new Error("HTTP_" + response.status);
        }

        const data = await response.json();

        return (data || [])
            .map(item =>
                String(item.word || "")
                    .toLowerCase()
                    .trim()
            )
            .filter(item => /^[a-z]+$/.test(item));
    };

    const [perfect, near] =
        await Promise.all([
            request("rel_rhy", 30),
            request("rel_nry", 30)
        ]);

    return { perfect: perfect, near: near };
}


function findRhymes(raw) {

    const word = cleanWord(raw);

    const container =
        document.getElementById(
            "rhyme-results"
        );

    if (!container) {
        return;
    }

    if (!word) {

        rhymeRequestId += 1;

        container.innerHTML = "";

        return;
    }

    const local = computeRhymesLocal(word);

    const unique = list => [...new Set(list)];

    const perfectLocal =
        unique(local.perfect).slice(0, 40);

    const nearLocal =
        unique(local.near)
            .filter(item => !perfectLocal.includes(item))
            .slice(0, 40);

    renderRhymeResults(
        word,
        perfectLocal,
        nearLocal,
        "loading"
    );

    const id = ++rhymeRequestId;

    fetchRhymesOnline(word)
        .then(online => {

            if (id !== rhymeRequestId) {
                return;
            }

            const perfect =
                unique([
                    ...perfectLocal,
                    ...online.perfect
                ]).slice(0, 40);

            const near =
                unique([
                    ...nearLocal,
                    ...online.near
                ])
                    .filter(item => !perfect.includes(item))
                    .slice(0, 40);

            renderRhymeResults(
                word,
                perfect,
                near,
                "online"
            );
        })
        .catch(() => {

            if (id !== rhymeRequestId) {
                return;
            }

            renderRhymeResults(
                word,
                perfectLocal,
                nearLocal,
                "offline"
            );
        });
}


/* =========================================================
   GENERIC RHYMES
========================================================= */

/* =========================================================
   INSERT RHYME INTO CURRENT SECTION
========================================================= */

function insertRhyme(word) {

    const song = getCurrentSong();
    if (!song) {
        return;
    }

    const section =
        song.sections.find(
            item => item.id === currentSectionId
        ) ||
        song.sections[0];

    if (!section) {
        return;
    }

    const editor =
        document.querySelector(
            `[data-editor="${section.id}"]`
        );

    let start =
        section.lyrics.length;

    let end = start;

    if (editor) {
        start =
            typeof editor.selectionStart === "number"
                ? editor.selectionStart
                : start;
        end =
            typeof editor.selectionEnd === "number"
                ? editor.selectionEnd
                : start;
    }

    section.lyrics =
        section.lyrics.slice(0, start) +
        word +
        section.lyrics.slice(end);

    currentSectionId =
        section.id;

    touchSong(song);

    updateSectionLyrics(
        section.id,
        section.lyrics
    );

    if (editor) {
        editor.value =
            section.lyrics;
        try {
            editor.focus();
            editor.setSelectionRange(
                start + word.length,
                start + word.length
            );
        } catch (error) {
            /* no-op */
        }
    }
}


/* =========================================================
   IDEA HELPER
========================================================= */

/* =========================================================
   IDEA CONTEXT
========================================================= */

function getSongContext() {
    const song = getCurrentSong();
    if (!song) {
        return null;
    }
    let lastLine = "";
    const sections = song.sections || [];
    for (let i = sections.length - 1; i >= 0; i -= 1) {
        const text = String(sections[i].lyrics || "").trim();
        if (text) {
            const lines = text.split("\n").filter(Boolean);
            lastLine = lines[lines.length - 1].trim();
            if (lastLine) {
                break;
            }
        }
    }
    const title =
        song.title && song.title !== "UNTITLED"
            ? song.title
            : null;
    return { title: title, lastLine: lastLine };
}

const ideaLastUsed = {};

function pickUnique(pool, key) {
    const last = ideaLastUsed[key];
    let index = Math.floor(Math.random() * pool.length);
    if (pool.length > 1 && index === last) {
        index = (index + 1) % pool.length;
    }
    ideaLastUsed[key] = index;
    return pool[index];
}


/* =========================================================
   IDEA POOLS
========================================================= */

const IDEA_THEMES = [
    ctx => `
        <strong>Read the title backwards.</strong><br><br>
        ${ctx && ctx.title ? `You named it &ldquo;${escapeHTML(ctx.title)}&rdquo;.<br>` : ""}
        What is the opposite of it, and who is living that?`,
    ctx => `
        <strong>Take inventory of loss.</strong><br><br>
        ${ctx && ctx.lastLine ? `Your last line: &ldquo;${escapeHTML(ctx.lastLine)}&rdquo;<br>` : ""}
        What was lost before the song began — before the first line?`,
    `<strong>Change the scale.</strong><br><br>
        Make the private feeling public, or the public feeling private.<br>
        Write a whole verse about one tiny object handled by one enormous force.`,
    ctx => `
        <strong>Time-shift the story.</strong><br><br>
        ${ctx && ctx.title ? `For &ldquo;${escapeHTML(ctx.title)}&rdquo;,` : "For this song,"}
        what would it sound like told from ten years after the ending?`,
    `<strong>Find the unspoken.</strong><br><br>
        What would the other person remember differently about the same night?<br>
        Write their version for one verse.`,
    `<strong>Follow the object.</strong><br><br>
        Pick one physical thing in the scene and track where it ends up.<br>
        Let the song end where that object ends up, not where the feeling does.`
];

const IDEA_IMAGERY = [
    ctx => `
        <strong>Anchor the senses.</strong><br><br>
        ${ctx && ctx.lastLine ? `Your last line: &ldquo;${escapeHTML(ctx.lastLine)}&rdquo;<br>` : ""}
        Give the verse one sound, one temperature, and one smell — then take one away.`,
    `<strong>Weather the emotion.</strong><br><br>
        What weather is this feeling?<br>
        Turn it into wind, rain, heat, or static, and write the scene inside it.`,
    `<strong>Light it wrong.</strong><br><br>
        Put the scene in light that fights the mood:<br>
        golden hour at a funeral, neon at a quiet apology.`,
    ctx => `
        <strong>Architecture holds memory.</strong><br><br>
        Describe a room as evidence against somebody.<br>
        ${ctx && ctx.title ? `For &ldquo;${escapeHTML(ctx.title)}&rdquo;, ` : ""}
        what in the room has been used up, broken, or kept?`,
    `<strong>Inanimate narrator.</strong><br><br>
        Write a verse from the point of view of an object watching the action —<br>
        the answering machine, the car seat, the door that keeps being opened.`,
    `<strong>Delete the faces.</strong><br><br>
        Write the scene showing only hands, feet, and backs.<br>
        Let the body language say everything the faces would have shown.`
];


const IDEA_METAPHORS = [
    ctx => `
        <strong>Translate the feeling into an object.</strong><br><br>
        ${ctx && ctx.lastLine ? `Your last line: &ldquo;${escapeHTML(ctx.lastLine)}&rdquo;<br>` : ""}
        If this feeling were a possession, what condition would it be in?<br>
        Frayed, locked, overgrown, half-charged. Write it that way.`,
    `<strong>Place the emotion.</strong><br><br>
        If regret were a place, where would it be?<br>
        If longing were weather, what would it do?<br>
        Pick one and move the whole verse there.`,
    ctx => `
        <strong>Borrow from a machine.</strong><br><br>
        ${ctx && ctx.title ? `For &ldquo;${escapeHTML(ctx.title)}&rdquo;, ` : ""}
        write the emotion as a mechanism: an engine, a valve, a moth in a processor.`,
    `<strong>Season the metaphor.</strong><br><br>
        Compare the feeling to something that decays, ripens, or passes<br>
        (fruit, snow, a cassette, a street after rain) and end on its final state.`,
    `<strong>Commit and go deep.</strong><br><br>
        Use one metaphor three times in the verse,<br>
        each time making it more specific until it stops being a metaphor.`,
    `<strong>Make it physical.</strong><br><br>
        Turn an abstract line you already wrote into a body action —<br>
        something a person actually does with their hands or feet.`
];

const IDEA_CONTRAST = [
    `<strong>Put opposites beside each other.</strong><br><br>
        Love and resentment. Memory and reality.
        Staying and leaving. Silence and noise. Warmth and distance.<br>
        Alternate them line by line.`,
    ctx => `
        <strong>Two rooms.</strong><br><br>
        ${ctx && ctx.lastLine ? `Your last line: &ldquo;${escapeHTML(ctx.lastLine)}&rdquo;<br>` : ""}
        Put the narrator in one room and the memory in another.<br>
        Keep them talking across the wall.`,
    `<strong>Same line, two meanings.</strong><br><br>
        Write a line you could say sweetly or cruelly.<br>
        Then repeat it the other way and let the verse turn.`,
    `<strong>Small and enormous.</strong><br><br>
        Pair a tiny detail with a huge one in the same breath —<br>
        a chipped mug and an ocean. Let the size do the arguing.`,
    `<strong>Before / after.</strong><br><br>
        Split the verse with one hinge word (&ldquo;but&rdquo;, &ldquo;then&rdquo;, &ldquo;except&rdquo;).<br>
        Everything before is one truth; everything after is another.`,
    ctx => `
        <strong>Comfort against it.</strong><br><br>
        Write the safest, most domestic detail you know<br>
        ${ctx && ctx.lastLine ? `(following &ldquo;${escapeHTML(ctx.lastLine)}&rdquo;)` : ""}
        and set the most dangerous line right next to it.`
];


const IDEA_QUESTIONS = [
    `<strong>Ask the song something.</strong><br><br>
        What are you avoiding saying?<br>
        What would you admit at 3AM?<br>
        What does the narrator believe that might be wrong?`,
    ctx => `
        <strong>Interrogate the title.</strong><br><br>
        ${ctx && ctx.title ? `&ldquo;${escapeHTML(ctx.title)}&rdquo; — ` : ""}
        who is it addressed to, and what are they NOT being told?`,
    `<strong>Ask the villain.</strong><br><br>
        Whoever caused the problem gets one verse.<br>
        Let them defend themselves. It may change the whole song.`,
    ctx => `
        <strong>Ask your last line.</strong><br><br>
        ${ctx && ctx.lastLine ? `Your last line: &ldquo;${escapeHTML(ctx.lastLine)}&rdquo;.<br>` : ""}
        What question does it leave hanging? Answer it poorly, on purpose.`,
    `<strong>Ask a child.</strong><br><br>
        Rewrite the situation as a child would describe it —<br>
        simpler, harsher, more honest. Keep their logic.`,
    `<strong>Ask the future.</strong><br><br>
        What would you tell yourself one year from now?<br>
        Write it as a message that arrived too late to matter.`
];

const IDEA_UNSTUCK = [
    ctx => `
        <strong>Change direction.</strong><br><br>
        ${ctx && ctx.lastLine ? `Your last line: &ldquo;${escapeHTML(ctx.lastLine)}&rdquo;<br>` : ""}
        Skip forward in time, change the location, or change who is speaking.<br>
        Any one of the three will reset the verse.`,
    `<strong>Write the ending first.</strong><br><br>
        Write the last line of the section now,<br>
        then make every line before it earn that one.`,
    `<strong>Contradict yourself.</strong><br><br>
        Write one line that directly cancels the line before it.<br>
        Keep the tension and see where it wants to go.`,
    `<strong>Steal a constraint.</strong><br><br>
        Force the next four lines to rhyme on one sound,<br>
        or forbid yourself a word you keep using throughout the song.`,
    ctx => `
        <strong>Start from the noise.</strong><br><br>
        ${ctx && ctx.title ? `For &ldquo;${escapeHTML(ctx.title)}&rdquo;, ` : ""}
        write a deliberately terrible line on purpose.<br>
        Then keep it and make the song prove it right.`,
    `<strong>Move the camera.</strong><br><br>
        Take the same image and describe it from outside a window,<br>
        from underwater, or from across the street. New words arrive fast.`
];

const IDEA_POOLS = {
    themes: IDEA_THEMES,
    imagery: IDEA_IMAGERY,
    metaphors: IDEA_METAPHORS,
    contrast: IDEA_CONTRAST,
    questions: IDEA_QUESTIONS,
    unstuck: IDEA_UNSTUCK
};


function ideaHelp(type) {

    const pool = IDEA_POOLS[type];
    if (!pool) {
        return;
    }

    const chosen = pickUnique(pool, type);
    const context = getSongContext();
    const body =
        typeof chosen === "function"
            ? chosen(context)
            : chosen;

    const output =
        document.getElementById(
            "idea-output"
        );

    if (!output) {
        return;
    }

    const contextLine =
        context && context.title
            ? `
                <div class="idea-context">
                    WORKING ON &ldquo;${escapeHTML(context.title)}&rdquo;
                </div>
            `
            : "";

    output.innerHTML = `
        <div class="idea-body">
            ${contextLine}
            ${body}
        </div>

        <button
            class="idea-again"
            type="button"
            onclick="ideaHelp('${type}')"
        >
            ↻ ANOTHER
        </button>
    `;
}


/* =========================================================
   TOOLS PANEL
========================================================= */

function openTools() {

    const tools =
        document.getElementById(
            "tools"
        );

    if (!tools) {
        return;
    }

    tools.classList.add(
        "open"
    );
}


function closeTools() {

    const tools =
        document.getElementById(
            "tools"
        );

    if (!tools) {
        return;
    }

    tools.classList.remove(
        "open"
    );
}


function switchTool(
    tool,
    button
) {

    document
        .querySelectorAll(
            ".tool-tab"
        )
        .forEach(tab => {

            tab.classList.remove(
                "active"
            );
        });


    if (button) {

        button.classList.add(
            "active"
        );
    }


    document
        .querySelectorAll(
            ".tool-panel"
        )
        .forEach(panel => {

            panel.classList.remove(
                "active"
            );
        });


    const panel =
        document.getElementById(
            "tool-" + tool
        );


    if (panel) {

        panel.classList.add(
            "active"
        );
    }
}


/* =========================================================
   SEARCH
========================================================= */

function performSearch(query) {

    query =
        String(query)
            .trim()
            .toLowerCase();


    const container =
        document.getElementById(
            "search-results"
        );


    if (!container) {
        return;
    }


    if (!query) {

        container.innerHTML =
            "";

        window.searchResults =
            [];

        return;
    }


    const results = [];


    /* -----------------------------------------------------
       SONGS
    ----------------------------------------------------- */

    state.songs.forEach(song => {

        const title =
            String(
                song.title || ""
            );


        if (
            title
                .toLowerCase()
                .includes(query)
        ) {

            results.push({

                type: "SONG",

                title: title,

                snippet:
                    song.status ||
                    "Draft",

                action:
                    () =>
                        openSong(
                            song.id
                        )
            });
        }


        if (!Array.isArray(song.sections)) {
            return;
        }


        song.sections.forEach(
            section => {

                const lyrics =
                    String(
                        section.lyrics ||
                        ""
                    );


                if (
                    lyrics
                        .toLowerCase()
                        .includes(query)
                ) {

                    results.push({

                        type:
                            "LYRICS · " +
                            (
                                section.type ||
                                "SECTION"
                            ),

                        title:
                            title,

                        snippet:
                            makeSnippet(
                                lyrics,
                                query
                            ),

                        action:
                            () => {

                                openSong(
                                    song.id
                                );

                                setTimeout(
                                    () => {

                                        setCurrentSection(
                                            section.id
                                        );

                                    },
                                    50
                                );
                            }
                    });
                }
            }
        );
    });


    /* -----------------------------------------------------
       ONE LINERS
    ----------------------------------------------------- */

    state.liners.forEach(
        liner => {

            const text =
                String(
                    liner.text || ""
                );


            if (
                text
                    .toLowerCase()
                    .includes(query)
            ) {

                results.push({

                    type:
                        "ONE LINER",

                    title:
                        text,

                    snippet:
                        "ONE LINER",

                    action:
                        () =>
                            showView(
                                "liners"
                            )
                });
            }
        }
    );


    /* -----------------------------------------------------
       FOLDERS
    ----------------------------------------------------- */

    state.folders.forEach(
        folder => {

            const name =
                String(
                    folder.name || ""
                );


            if (
                name
                    .toLowerCase()
                    .includes(query)
            ) {

                results.push({

                    type:
                        "FOLDER",

                    title:
                        name,

                    snippet:
                        "FOLDER",

                    action:
                        () =>
                            openFolder(
                                folder.id
                            )
                });
            }
        }
    );


    /* -----------------------------------------------------
       NO RESULTS
    ----------------------------------------------------- */

    if (!results.length) {

        container.innerHTML = `
            <div class="empty-state">
                NOTHING FOUND.
            </div>
        `;

        window.searchResults =
            [];

        return;
    }


    window.searchResults =
        results;


    container.innerHTML =
        results
            .map(
                (result, index) => `

                    <div
                        class="search-result"
                        onclick="searchResultClick(${index})"
                    >

                        <div class="search-result-type">
                            ${escapeHTML(
                                result.type
                            )}
                        </div>

                        <div class="search-result-title">
                            ${escapeHTML(
                                result.title
                            )}
                        </div>

                        <div class="search-result-snippet">
                            ${escapeHTML(
                                result.snippet
                            )}
                        </div>

                    </div>
                `
            )
            .join("");
}


/* =========================================================
   SEARCH SNIPPET
========================================================= */

function makeSnippet(
    text,
    query
) {

    const index =
        text
            .toLowerCase()
            .indexOf(query);


    if (index === -1) {

        return text.slice(
            0,
            120
        );
    }


    const start =
        Math.max(
            0,
            index - 45
        );


    const end =
        Math.min(
            text.length,
            index +
            query.length +
            75
        );


    return (

        (
            start > 0
                ? "… "
                : ""
        ) +

        text.slice(
            start,
            end
        ) +

        (
            end < text.length
                ? " …"
                : ""
        )
    );
}


/* =========================================================
   SEARCH RESULT CLICK
========================================================= */

function searchResultClick(
    index
) {

    const result =
        window.searchResults[
            index
        ];


    if (result) {

        result.action();
    }
}