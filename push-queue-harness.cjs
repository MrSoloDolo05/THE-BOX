const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "the-box", "thebox");
const storage = new Map();
let serverState;
let serverVersion = "2026-10-06T09:00:00.000Z";
let transactionCalls = 0;
let activeTransactions = 0;
let maxActiveTransactions = 0;
let timerCount = 0;
let adoptionCountAtFailedTransaction = null;
let releaseFirstTransaction;
let firstTransactionEntered;
const firstEntered = new Promise(resolve => {
    firstTransactionEntered = resolve;
});
const firstGate = new Promise(resolve => {
    releaseFirstTransaction = resolve;
});
const transactionReads = [];

const sandbox = {
    adoptionCount: 0,
    console,
    performance: { now: () => Date.now() },
    setTimeout(callback, delay) {
        timerCount += 1;
        return setTimeout(callback, delay);
    },
    clearTimeout,
    localStorage: {
        getItem: key => storage.has(key) ? storage.get(key) : null,
        setItem: (key, value) => storage.set(key, String(value)),
        removeItem: key => storage.delete(key)
    },
    document: {
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} })
    },
    firebase: {
        firestore: {
            FieldValue: {
                serverTimestamp: () => ({ serverTimestamp: true })
            }
        }
    }
};
sandbox.window = sandbox;

const context = vm.createContext(sandbox);
["js/state.js", "js/database.js", "js/sync.js"].forEach(file => {
    vm.runInContext(
        fs.readFileSync(path.join(ROOT, file), "utf8"),
        context,
        { filename: file }
    );
});

function assert(condition, message) {
    if (!condition) {
        throw new Error("FAIL: " + message);
    }
    console.log("PASS: " + message);
}

async function main() {
    const docRef = {};
    const db = {
        collection(name) {
            if (name !== "users") {
                throw new Error("Unexpected collection: " + name);
            }
            return { doc: () => docRef };
        },
        async runTransaction(callback) {
            const call = ++transactionCalls;
            activeTransactions += 1;
            maxActiveTransactions = Math.max(
                maxActiveTransactions,
                activeTransactions
            );

            const pendingWrite = {};
            const transaction = {
                async get() {
                    transactionReads.push(serverVersion);
                    return {
                        exists: true,
                        metadata: {
                            fromCache: false,
                            hasPendingWrites: false
                        },
                        data: () => ({
                            state: serverState,
                            updatedAt: serverVersion
                        })
                    };
                },
                set(_ref, value) {
                    pendingWrite.value = value;
                }
            };

            try {
                await callback(transaction);
                if (call === 1) {
                    firstTransactionEntered();
                    await firstGate;
                    serverVersion = "2026-10-06T09:00:01.000Z";
                    const error = new Error(
                        "The stored version (200) does not match the required base version (100)"
                    );
                    error.code = "failed-precondition";
                    adoptionCountAtFailedTransaction =
                        sandbox.adoptionCount || 0;
                    throw error;
                }

                serverState = pendingWrite.value.state;
                serverVersion = call === 2
                    ? "2026-10-06T09:00:02.000Z"
                    : "2026-10-06T09:00:03.000Z";
            } finally {
                activeTransactions -= 1;
            }
        }
    };

    sandbox.__mockDb = db;
    vm.runInContext(
        "currentUser = { uid: 'test-user' }; firebaseDb = __mockDb; state = createDefaultState(); " +
        "const originalAdoptMergedState = adoptMergedState; " +
        "adoptMergedState = function (merged) { adoptionCount++; return originalAdoptMergedState(merged); };",
        context
    );
    serverState = JSON.parse(JSON.stringify(
        vm.runInContext("captureSyncState(state)", context)
    ));

    const firstPush = vm.runInContext(
        "pushState()",
        context
    );
    await firstEntered;

    const queuedPushes = [];
    for (let i = 1; i <= 5; i += 1) {
        queuedPushes.push(vm.runInContext(
            "pushState()",
            context
        ));
    }

    releaseFirstTransaction();
    await Promise.all([firstPush, ...queuedPushes]);

    assert(transactionCalls === 3,
        "one failed transaction, one retry, and one coalesced follow-up ran");
    assert(maxActiveTransactions === 1,
        "at most one Firestore transaction was active");
    assert(
        transactionReads.length === 3 &&
        transactionReads[0] === "2026-10-06T09:00:00.000Z" &&
        transactionReads[1] === "2026-10-06T09:00:01.000Z",
        "the retry re-read the newer Firestore document version"
    );

    assert(timerCount === 1,
        "one version conflict scheduled one retry timer");
    assert(adoptionCountAtFailedTransaction === 0,
        "the failed transaction attempt never reached adoption");
    assert(sandbox.adoptionCount > adoptionCountAtFailedTransaction,
        "successful transaction attempts can reconcile after commit");

    console.log("\nPush queue harness passed.");
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
