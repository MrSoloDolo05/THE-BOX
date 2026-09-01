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

                return `
                    <div
                        class="folder"
                        data-folder-id="${folder.id}"
                        ondragover="folderDragOver(event)"
                        ondragleave="folderDragLeave(event)"
                        ondrop="folderDrop(event, '${folder.id}')"
                        onclick="openFolder('${folder.id}')"
                    >

                        <div class="folder-actions">

                            <button
                                onclick="event.stopPropagation(); renameFolder('${folder.id}')"
                                title="Rename"
                                type="button"
                            >
                                ✎
                            </button>

                            <button
                                onclick="event.stopPropagation(); deleteFolder('${folder.id}')"
                                title="Delete"
                                type="button"
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
            draggable="true"
            ondragstart="songDragStart(event, '${song.id}')"
            ondragend="songDragEnd()"
            onclick="openSong('${song.id}')"
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
                    type="button"
                    onclick="event.stopPropagation(); duplicateSong('${song.id}')"
                    title="Duplicate"
                >
                    ⧉
                </button>

                <button
                    type="button"
                    onclick="event.stopPropagation(); deleteSong('${song.id}')"
                    title="Delete"
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

        confirm.onclick = function () {

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
                name: name.toUpperCase()
            });

            saveState();

            closeModal();

            renderCrate();
        };
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


    state.trash.push({
        id: generateId(),
        type: "folder",
        data: folder,
        songIds: songIds
    });


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
            }

        });

    } else {

        state.songs.forEach(song => {

            if (song.folder === id) {
                song.folder =
                    state.folders[0].id;
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

        title: "UNTITLED",

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


    state.trash.push({
        id: generateId(),
        type: "song",
        data: song
    });


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
   FOLDER DRAG / DROP
========================================================= */

function folderDragOver(event) {

    event.preventDefault();

    event.currentTarget
        .classList
        .add("drag-over");
}


function folderDragLeave(event) {

    event.currentTarget
        .classList
        .remove("drag-over");
}


function folderDrop(
    event,
    folderId
) {

    event.preventDefault();
    event.stopPropagation();

    event.currentTarget
        .classList
        .remove("drag-over");


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
    id
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

    event.currentTarget
        .classList
        .add("dragging");
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

    showView("folder");
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

        confirmButton.onclick =
            function () {

                saveFolderRename(
                    id
                );
            };
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


    folder.name =
        input.value
            .trim()
            .toUpperCase();


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
                            onclick="restoreTrash('${item.id}')"
                        >
                            RESTORE
                        </button>

                        <button
                            type="button"
                            onclick="permanentlyDelete('${item.id}')"
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

        state.songs.push(
            item.data
        );

    } else if (
        item.type === "folder"
    ) {

        state.folders.push(
            item.data
        );


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

        state.liners.push(
            item.data
        );
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

    state.trash =
        state.trash.filter(
            item =>
                item.id !== id
        );

    saveState();

    renderTrash();
}