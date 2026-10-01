/* =========================================================
   CRATE
========================================================= */


/* =========================================================
   CRATE RENDER
========================================================= */

function renderCrate() {

    const grid =
        document.getElementById(
            "folder-grid"
        );

    const recentContainer =
        document.getElementById(
            "song-list"
        );

    if (!grid || !recentContainer) {
        return;
    }


    /* -----------------------------------------------------
       FOLDERS
    ----------------------------------------------------- */

    grid.innerHTML =
        state.folders
            .map(folder => {

                const count =
                    state.songs.filter(
                        song =>
                            song.folder ===
                            folder.id
                    ).length;

                /* "Test" stays undeletable; that guard is
                   behaviour, not styling, so it no longer drives a
                   colour special-case. Every folder shares one blue
                   system now. */
                const isProtected =
                    folder.name.trim() === "Test";

                const isOpen =
                    folder.id ===
                    currentFolderId;

                return `
                    <div
                        class="folder${
                            isOpen
                                ? " is-open"
                                : ""
                        }"
                        data-folder-id="${folder.id}"
                        tabindex="0"
                        role="button"
                        aria-label="${escapeAttribute(
                            folder.name
                        )} folder, ${count} song${
                            count === 1 ? "" : "s"
                        }${
                            isOpen
                                ? ", currently open"
                                : ""
                        }"
                        ${
                            isOpen
                                ? 'aria-current="true"'
                                : ""
                        }
                    >

                        <div class="folder-actions">

                            <button
                                data-action="rename-folder"
                                title="Rename"
                                aria-label="Rename ${escapeAttribute(
                                    folder.name
                                )}"
                                type="button"
                            >
                                ✎
                            </button>

                            <button
                                data-action="delete-folder"
                                title="Delete"
                                aria-label="Delete ${escapeAttribute(
                                    folder.name
                                )}"
                                type="button"
                                ${isProtected ? "disabled" : ""}
                            >
                                ×
                            </button>

                        </div>

                        <div class="folder-icon">
                            ▱
                        </div>

                        <div class="folder-name">
                            ${escapeHTML(folder.name)}
                        </div>

                        <div class="folder-count">
                            ${count}
                            SONG${count === 1 ? "" : "S"}
                        </div>

                    </div>
                `;
            })
            .join("");


    /* -----------------------------------------------------
       RECENT SONGS
    ----------------------------------------------------- */

    const recent =
        [...state.songs]
            .sort(
                (a, b) =>
                    new Date(b.modified) -
                    new Date(a.modified)
            )
            .slice(0, 20);


    if (!recent.length) {

        recentContainer.innerHTML = `
            <div class="empty-state">
                NOTHING HERE YET.<br>
                CREATE SOMETHING.
            </div>
        `;

        return;
    }


    recentContainer.innerHTML =
        recent
            .map(
                (song, index) =>
                    renderSongRow(
                        song,
                        index
                    )
            )
            .join("");
}


/* =========================================================
   SONG ROW
========================================================= */

function renderSongRow(
    song,
    index
) {

    const folder =
        state.folders.find(
            folder =>
                folder.id === song.folder
        );

    return `
        <div
            class="song-row"
            data-song-id="${song.id}"
            draggable="true"
            tabindex="0"
            role="button"
            aria-label="Open song ${escapeAttribute(
                song.title ||
                "UNTITLED"
            )}"
        >

            <div class="song-number">
                ${String(index + 1).padStart(2, "0")}
            </div>

            <div class="song-main">

                <div class="song-title">
                    ${escapeHTML(
                        song.title ||
                        "UNTITLED"
                    )}
                </div>

                <div class="song-sub">
                    ${escapeHTML(
                        song.status ||
                        "Draft"
                    )}
                    ·
                    ${formatDate(
                        song.modified
                    )}
                </div>

            </div>

            <div class="song-folder">
                ${
                    folder
                        ? escapeHTML(
                            folder.name
                        )
                        : "NO FOLDER"
                }
            </div>

            <div class="song-status">
                ${(
                    song.status ||
                    "Draft"
                ).toUpperCase()}
            </div>

            <div class="song-actions">

                <button
                    data-action="move-song"
                    type="button"
                    title="Move to folder"
                    aria-label="Move ${escapeAttribute(
                        song.title ||
                        "UNTITLED"
                    )} to a folder"
                >
                    ⇢
                </button>

                <button
                    data-action="duplicate-song"
                    type="button"
                    title="Duplicate"
                    aria-label="Duplicate ${escapeAttribute(
                        song.title ||
                        "UNTITLED"
                    )}"
                >
                    ⧉
                </button>

                <button
                    data-action="delete-song"
                    type="button"
                    title="Delete"
                    aria-label="Delete ${escapeAttribute(
                        song.title ||
                        "UNTITLED"
                    )}"
                >
                    ×
                </button>

            </div>

        </div>
    `;
}


/* =========================================================
   CREATE FOLDER
========================================================= */

function createFolder() {

    const modalTitle =
        document.getElementById(
            "modal-title"
        );

    const modalBody =
        document.getElementById(
            "modal-body"
        );

    const confirm =
        document.getElementById(
            "modal-confirm"
        );

    if (!modalTitle || !modalBody) {
        return;
    }

    modalTitle.textContent =
        "CREATE FOLDER";

    modalBody.innerHTML = `
        <input
            id="folder-name-input"
            type="text"
            placeholder="Folder name"
        >
    `;

    if (confirm) {

        modalConfirm.set(function () {

            const input =
                document.getElementById(
                    "folder-name-input"
                );

            const name =
                input?.value.trim();

            if (!name) {
                return;
            }

            state.folders.push({
                id: generateId(),
                name: name.toUpperCase(),

                modified:
                    new Date().toISOString()
            });

            saveState();

            closeModal();

            renderCrate();
        });
    }

    openModal();

    setTimeout(() => {

        document
            .getElementById(
                "folder-name-input"
            )
            ?.focus();

    }, 50);
}


/* =========================================================
   DELETE FOLDER
========================================================= */

function deleteFolder(id) {

    const folder =
        state.folders.find(
            folder =>
                folder.id === id
        );

    if (!folder) {
        return;
    }


    /* The Unsorted folder is a protected root folder: it can not
       be deleted, cleared, or dragged into trash. */
    if (folder.name === "UNSORTED") {

        alert(
            "The Unsorted folder can not be deleted."
        );

        return;
    }


    /* Never allow the last folder to disappear */
    if (state.folders.length === 1) {

        alert(
            "You must keep at least one folder."
        );

        return;
    }


    const songIds =
        state.songs
            .filter(
                song =>
                    song.folder === id
            )
            .map(
                song => song.id
            );


    const alreadyTrashed =
        state.trash.some(
            item =>
                item.type === "folder" &&
                item.data &&
                item.data.id === id
        );

    if (!alreadyTrashed) {

        state.trash.push({
            id: generateId(),
            type: "folder",
            data: folder,
            songIds: songIds,

            /* Tombstone timestamp used by the per-record sync
               merge to order this deletion against stale copies. */
            modified:
                new Date().toISOString()
        });
    }


    /* Durable deletion tombstone for the FOLDER only. The songs
       that lived in it are re-homed to UNSORTED and keep their
       own ids, so they are never marked as deleted. */
    markRecordDeleted(id);


    state.folders =
        state.folders.filter(
            folder =>
                folder.id !== id
        );


    /* Move songs into UNSORTED */
    const unsorted =
        state.folders.find(
            folder =>
                folder.name === "UNSORTED"
        );


    if (unsorted) {

        state.songs.forEach(song => {

            if (song.folder === id) {
                song.folder =
                    unsorted.id;

                /* Re-homing is a real edit, so it must outrank an
                   older copy of the song on another device. */
                touchSong(song);
            }

        });

    } else {

        state.songs.forEach(song => {

            if (song.folder === id) {
                song.folder =
                    state.folders[0].id;

                touchSong(song);
            }

        });
    }


    if (currentFolderId === id) {
        currentFolderId = null;
        showView("crate");
    }


    saveState();

    renderCrate();

    renderTrash();
}


/* =========================================================
   OPEN SONG
========================================================= */

function openSong(id) {

    const song =
        state.songs.find(
            song =>
                song.id === id
        );

    if (!song) {
        return;
    }

    currentSongId = id;

    currentSectionId =
        song.sections[0]?.id ||
        null;

    /* Opening a song is an explicit navigation action. Leaving the
       folder detail view means the folder is no longer the current
       context, so the CRATE grid must not keep it highlighted.
       showView() also clears this for every non-folder view; setting
       it here keeps the intent local to the action itself. */
    currentFolderId = null;

    showView("redroom");
}


/* =========================================================
   CREATE SONG
========================================================= */

function createSong() {

    const defaultFolder =
        state.folders.find(
            folder =>
                folder.name === "UNSORTED"
        ) ||
        state.folders[0];

    const song = {

        id: generateId(),

        /* Title starts EMPTY: the input's placeholder shows
           "UNTITLED" visually without forcing that string
           into the stored value. */
        title: "",

        status: "Draft",

        folder:
            defaultFolder
                ? defaultFolder.id
                : null,

        created:
            new Date().toISOString(),

        modified:
            new Date().toISOString(),

        sections: [
            {
                id: generateId(),
                type: "VERSE",
                lyrics: ""
            }
        ]
    };


    state.songs.unshift(song);

    currentSongId =
        song.id;

    currentSectionId =
        song.sections[0].id;

    saveState();

    renderCrate();

    showView("redroom");


    setTimeout(() => {

        const title =
            document.getElementById(
                "song-title"
            );

        if (title) {
            title.focus();
            title.select();
        }

    }, 50);
}


/* =========================================================
   DUPLICATE SONG
========================================================= */

function duplicateSong(id) {

    const original =
        state.songs.find(
            song =>
                song.id === id
        );

    if (!original) {
        return;
    }


    const duplicate =
        JSON.parse(
            JSON.stringify(original)
        );


    duplicate.id =
        generateId();

    duplicate.title =
        original.title +
        " COPY";

    duplicate.created =
        new Date().toISOString();

    duplicate.modified =
        new Date().toISOString();


    duplicate.sections =
        duplicate.sections.map(
            section => ({
                ...section,
                id: generateId()
            })
        );


    state.songs.unshift(
        duplicate
    );

    saveState();

    renderCrate();

    openSong(
        duplicate.id
    );
}


/* =========================================================
   DELETE SONG
========================================================= */

function deleteSong(id) {

    const song =
        state.songs.find(
            song =>
                song.id === id
        );

    if (!song) {
        return;
    }


    /* Idempotent: never create a second trash record for a
       song that is already in the trash. */
    const alreadyTrashed =
        state.trash.some(
            item =>
                item.type === "song" &&
                item.data &&
                item.data.id === id
        );

    if (!alreadyTrashed) {

        state.trash.push({
            id: generateId(),
            type: "song",
            data: song,

            /* Tombstone timestamp used by the per-record sync
               merge to order this deletion against stale copies. */
            modified:
                new Date().toISOString()
        });
    }


    /* Durable deletion tombstone. Prevents a device that still
       holds an older copy from resurrecting this song. */
    markRecordDeleted(id);

    /* Forget any text that was still being typed into this song. */
    if (typeof dropLocalEditsForSong === "function") {
        dropLocalEditsForSong(id);
    }


    state.songs =
        state.songs.filter(
            song =>
                song.id !== id
        );


    if (currentSongId === id) {

        currentSongId = null;
        currentSectionId = null;

        showView("crate");
    }


    saveState();

    renderCrate();

    renderTrash();
}


/* =========================================================
   MOVE SONG TO FOLDER
   (for touch devices where drag and drop does not work)
========================================================= */

function openMoveSongModal(songId) {

    const modalTitle =
        document.getElementById(
            "modal-title"
        );

    const modalBody =
        document.getElementById(
            "modal-body"
        );

    if (!modalTitle || !modalBody) {
        return;
    }

    modalTitle.textContent =
        "MOVE SONG TO FOLDER";


    modalBody.innerHTML = `
        <div style="display:grid;gap:6px;">

            ${state.folders.map(folder => `
                <button
                    class="move-to-folder-option"
                    type="button"
                    data-song-id="${songId}"
                    data-folder-id="${folder.id}"
                    style="
                        text-align:left;
                        border:1px solid var(--line);
                        background:rgba(255,255,255,.025);
                        padding:14px;
                        color:#bbb;
                        cursor:pointer;
                    "
                >
                    ${escapeHTML(folder.name)}
                </button>
            `).join("")}

        </div>
    `;


    openModal();
}


function moveSongToFolder(songId, folderId) {

    const song =
        state.songs.find(
            song =>
                song.id === songId
        );

    if (!song) {
        return;
    }

    song.folder = folderId;

    touchSong(song);

    saveState();

    closeModal();

    renderCrate();

    renderFolderSongsIfNeeded();
}


/* =========================================================
   FOLDER DRAG / DROP
========================================================= */

function folderDragOver(
    event,
    element
) {

    event.preventDefault();

    element.classList.add(
        "drag-over"
    );
}


function folderDragLeave(
    event,
    element
) {

    element.classList.remove(
        "drag-over"
    );
}


function folderDrop(
    event,
    element,
    folderId
) {

    event.preventDefault();
    event.stopPropagation();

    element.classList.remove(
        "drag-over"
    );


    if (!draggedSongId) {
        return;
    }


    const song =
        state.songs.find(
            song =>
                song.id ===
                draggedSongId
        );


    if (!song) {

        draggedSongId = null;

        return;
    }


    song.folder =
        folderId;


    touchSong(song);


    draggedSongId = null;

    saveState();

    renderCrate();

    renderFolderSongsIfNeeded();
}


/* =========================================================
   SONG DRAG
========================================================= */

function songDragStart(
    event,
    id,
    element
) {

    draggedSongId = id;

    if (event.dataTransfer) {

        event.dataTransfer.effectAllowed =
            "move";

        event.dataTransfer.setData(
            "text/plain",
            id
        );
    }

    element.classList.add(
        "dragging"
    );
}


function songDragEnd() {

    draggedSongId = null;

    document
        .querySelectorAll(".song-row")
        .forEach(row => {

            row.classList.remove(
                "dragging"
            );
        });

    document
        .querySelectorAll(".folder")
        .forEach(folder => {

            folder.classList.remove(
                "drag-over"
            );
        });
}


/* =========================================================
   FOLDER DETAIL
========================================================= */

function openFolder(id) {

    const folder =
        state.folders.find(
            folder =>
                folder.id === id
        );

    if (!folder) {
        return;
    }

    currentFolderId = id;

    const title =
        document.getElementById(
            "folder-detail-title"
        );

    if (title) {
        title.textContent =
            folder.name;
    }

    syncFolderOpenHighlight();

    showView("folder");
}


/* ---------------------------------------------------------
   OPEN-FOLDER HIGHLIGHT

   Single source of truth for the .is-open class and its
   aria-current counterpart. renderCrate() also derives the class
   from currentFolderId while building the grid, so keeping one
   helper means the DOM and state cannot drift apart.
--------------------------------------------------------- */

function syncFolderOpenHighlight() {

    document
        .querySelectorAll(".folder")
        .forEach(element => {

            const isOpen =
                element.dataset.folderId ===
                currentFolderId;


            element.classList.toggle(
                "is-open",
                isOpen
            );


            if (isOpen) {

                element.setAttribute(
                    "aria-current",
                    "true"
                );

            } else {

                element.removeAttribute(
                    "aria-current"
                );
            }
        });
}


function renderFolderSongs() {

    const container =
        document.getElementById(
            "folder-song-list"
        );

    if (!container) {
        return;
    }


    const songs =
        state.songs.filter(
            song =>
                song.folder ===
                currentFolderId
        );


    if (!songs.length) {

        container.innerHTML = `
            <div class="empty-state">
                EMPTY FOLDER.<br>
                DRAG A SONG HERE.
            </div>
        `;

        return;
    }


    container.innerHTML =
        songs
            .map(
                (song, index) =>
                    renderSongRow(
                        song,
                        index
                    )
            )
            .join("");
}


/* =========================================================
   RENAME FOLDER
========================================================= */

function renameFolder(id) {

    const folder =
        state.folders.find(
            folder =>
                folder.id === id
        );

    if (!folder) {
        return;
    }


    const modalBody =
        document.getElementById(
            "modal-body"
        );

    const modalTitle =
        document.getElementById(
            "modal-title"
        );

    const confirmButton =
        document.getElementById(
            "modal-confirm"
        );


    if (!modalBody || !modalTitle) {
        return;
    }


    modalTitle.textContent =
        "RENAME FOLDER";


    modalBody.innerHTML = `
        <input
            id="rename-folder-input"
            type="text"
            value="${escapeAttribute(
                folder.name
            )}"
            placeholder="Folder name"
        >
    `;


    if (confirmButton) {

        modalConfirm.set(function () {

            saveFolderRename(
                id
            );
        });
    }


    openModal();


    setTimeout(() => {

        const input =
            document.getElementById(
                "rename-folder-input"
            );

        if (input) {

            input.focus();
            input.select();
        }

    }, 50);
}


function saveFolderRename(id) {

    const folder =
        state.folders.find(
            folder =>
                folder.id === id
        );

    const input =
        document.getElementById(
            "rename-folder-input"
        );


    if (
        !folder ||
        !input ||
        !input.value.trim()
    ) {
        return;
    }


    const next =
        input.value
            .trim()
            .toUpperCase();


    /* The Unsorted folder is protected: it cannot be renamed
       and it cannot be effectively removed by making it blank. */
    if (folder.name === "UNSORTED") {

        alert(
            "The Unsorted folder cannot be renamed."
        );

        return;
    }


    folder.name = next;

    /* Renaming is a real edit: stamp it so the per-record sync
       merge can order it against another device's copy. */
    touchRecord(folder);

    saveState();

    closeModal();

    renderCrate();


    if (
        currentFolderId === id
    ) {

        const title =
            document.getElementById(
                "folder-detail-title"
            );

        if (title) {
            title.textContent =
                folder.name;
        }

        renderFolderSongs();
    }
}


/* =========================================================
   TRASH
========================================================= */

function renderTrash() {

    const container =
        document.getElementById(
            "trash-list"
        );

    if (!container) {
        return;
    }


    if (!state.trash.length) {

        container.innerHTML = `
            <div class="empty-state">
                TRASH IS EMPTY.
            </div>
        `;

        return;
    }


    container.innerHTML =
        state.trash
            .map(item => {

                let name = "";

                if (
                    item.type === "song"
                ) {

                    name =
                        item.data.title;

                } else if (
                    item.type === "folder"
                ) {

                    name =
                        item.data.name;

                } else {

                    name =
                        item.data.text;
                }


                return `
                    <div class="trash-item">

                        <div class="trash-icon">
                            ▫
                        </div>

                        <div class="trash-name">
                            ${escapeHTML(
                                name
                            )}
                        </div>

                        <div class="trash-type">
                            ${item.type.toUpperCase()}
                        </div>

                        <button
                            type="button"
                            data-action="restore-trash"
                            data-trash-id="${item.id}"
                        >
                            RESTORE
                        </button>

                        <button
                            type="button"
                            data-action="permanent-delete"
                            data-trash-id="${item.id}"
                        >
                            DELETE
                        </button>

                    </div>
                `;
            })
            .join("");
}


/* =========================================================
   RESTORE TRASH
========================================================= */

function restoreTrash(id) {

    const item =
        state.trash.find(
            item =>
                item.id === id
        );

    if (!item) {
        return;
    }


    if (
        item.type === "song"
    ) {

        /* Idempotent restore: only add the song back if it
           is not already in the crate (prevents duplicates
           when a restore races a sync echo). */
        const exists =
            state.songs.some(
                song =>
                    song.id === item.data.id
            );

        if (!exists) {

            state.songs.push(
                item.data
            );
        }


        /* Explicit restore: clear the deletion tombstone and bump
           the modified stamp so the restored copy outranks the
           tombstone wherever it is still present. */
        unmarkRecordDeleted(item.data.id);
        touchRecord(item.data);
        touchLiveRecord(item.data.id);

    } else if (
        item.type === "folder"
    ) {

        /* The Unsorted folder is protected. If it somehow ends
           up in trash (migration, import, legacy data), treat
           it as already existing and just remove it from trash
           without creating a second copy or re-trashing it. */
        if (
            item.data &&
            item.data.name === "UNSORTED"
        ) {

            /* The Unsorted folder must never carry a deletion
               tombstone, or the sync merge would remove it. */
            unmarkRecordDeleted(item.data.id);

            state.trash =
                state.trash.filter(
                    row =>
                        row.id !== id
                );

            saveState();

            renderTrash();

            renderCrate();

            return;
        }


        const folderExists =
            state.folders.some(
                folder =>
                    folder.id === item.data.id
            );

        if (!folderExists) {

            state.folders.push(
                item.data
            );
        }


        /* Explicit restore: clear the deletion tombstone. */
        unmarkRecordDeleted(item.data.id);
        touchRecord(item.data);
        touchLiveRecord(item.data.id);


        /*
           Songs that lived in this folder were moved to
           UNSORTED (not deleted) when the folder was
           trashed. Reunite them with the restored folder.
        */

        if (
            Array.isArray(
                item.songIds
            )
        ) {

            item.songIds.forEach(
                songId => {

                    const song =
                        state.songs.find(
                            existing =>
                                existing.id ===
                                songId
                        );

                    if (song) {
                        song.folder =
                            item.data.id;

                        touchSong(song);
                    }
                }
            );
        }


        /*
           Older versions of the app stored the folder's
           songs separately (as full copies, since they
           were removed rather than reassigned). Restore
           them if present and not already in the list.
        */

        if (
            Array.isArray(
                item.songs
            )
        ) {

            item.songs.forEach(
                song => {

                    const exists =
                        state.songs.some(
                            existing =>
                                existing.id ===
                                song.id
                        );

                    if (!exists) {
                        state.songs.push(
                            song
                        );
                    }
                }
            );
        }

    } else if (
        item.type === "liner"
    ) {

        const linerExists =
            state.liners.some(
                liner =>
                    liner.id === item.data.id
            );

        if (!linerExists) {

            state.liners.push(
                item.data
            );
        }


        /* Explicit restore: clear the deletion tombstone. */
        unmarkRecordDeleted(item.data.id);
        touchRecord(item.data);
        touchLiveRecord(item.data.id);

    } else if (
        item.type === "verse"
    ) {

        const verseExists =
            state.verses.some(
                verse =>
                    verse.id === item.data.id
            );

        if (!verseExists) {

            state.verses.push(
                item.data
            );
        }


        /* Explicit restore: clear the deletion tombstone. */
        unmarkRecordDeleted(item.data.id);
        touchRecord(item.data);
        touchLiveRecord(item.data.id);
    }


    state.trash =
        state.trash.filter(
            item =>
                item.id !== id
        );


    saveState();

    renderTrash();

    renderCrate();
}


/* =========================================================
   PERMANENT DELETE
========================================================= */

function permanentlyDelete(id) {

    const doomed =
        state.trash.find(
            item =>
                item.id === id
        );

    state.trash =
        state.trash.filter(
            item =>
                item.id !== id
        );

    /* A song destroyed for good must not leave protected text behind
       that an older copy still in flight could restore. */
    forgetLocalEditsFor(doomed);

    saveState();

    renderTrash();
}


/* Drop any pending Red Room typing protection that belongs to a trash
   record being destroyed. */
function forgetLocalEditsFor(item) {

    if (
        !item ||
        typeof dropLocalEditsForSong !== "function"
    ) {
        return;
    }

    if (item.type === "song" && item.data && item.data.id) {
        dropLocalEditsForSong(item.data.id);
    }
}


/* =========================================================
   EMPTY TRASH
========================================================= */

function emptyTrash() {

    if (!state.trash.length) {
        return;
    }

    state.trash.forEach(forgetLocalEditsFor);

    state.trash = [];

    saveState();

    renderTrash();
}