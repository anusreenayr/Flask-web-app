let currentAudioData = null;

document.getElementById('translateButton').addEventListener('click', async () => {
    const script = document.getElementById('inputScript').value;
    const selectedLanguages = Array.from(document.getElementById('languageSelect').selectedOptions).map(opt => opt.value);

    if (!script || selectedLanguages.length === 0) {
        alert('Please enter a script and select at least one language.');
        return;
    }

    try {
        const response = await fetch('/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ script, languages: selectedLanguages })
        });

        if (response.ok) {
            const data = await response.json();
            const outputArea = document.getElementById('outputScript');
            outputArea.value = '';

            data.results.forEach(result => {
                if (result.error) {
                    outputArea.value += `Language: ${result.language}\nError: ${result.error}\n\n`;
                } else {
                    outputArea.value += `Language: ${result.language}\n`;
                    outputArea.value += `Translation: ${result.translation}\n`;
                    outputArea.value += `Audio File: ${result.audio_file}\n\n`;

                    currentAudioData = result.audio_file;

                    const audioPlayer = document.getElementById('audioPlayer');
                    if (audioPlayer) {
                        audioPlayer.src = result.audio_file;
                        audioPlayer.load();
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while processing the translation.');
    }
});

document.getElementById('saveAudioButton').addEventListener('click', async () => {
    if (!currentAudioData) {
        alert('Please generate an audio file first.');
        return;
    }

    const audioName = prompt('Enter a name for the audio file:');
    if (!audioName) {
        alert('Audio name cannot be empty.');
        return;
    }

    try {
        const foldersResponse = await fetch('/get-folders');
        const folders = await foldersResponse.json();

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Save Audio</h3>
                <select id="folderSelect">
                    ${folders.map(folder => `
                        <option value="${folder.id}">${folder.name}</option>
                    `).join('')}
                </select>
                <div class="modal-buttons">
                    <button onclick="this.closest('.modal').remove()">Cancel</button>
                    <button onclick="saveAudioToFolder(this, '${audioName}')">Save</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } catch (error) {
        console.error('Error loading folders:', error);
        alert('Error loading folders');
    }
});

async function saveAudioToFolder(button, audioName) {
    const modal = button.closest('.modal');
    const folderId = modal.querySelector('#folderSelect').value;

    try {
        const response = await fetch('/save-audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: audioName,
                folderId: folderId,
                audioPath: currentAudioData
            })
        });

        if (response.ok) {
            alert('Audio saved successfully!');
            modal.remove();
            loadFolders(); // Refresh the folder view
        } else {
            alert('Error saving audio');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error saving audio');
    }
}

// Load sidebar folders
async function loadSidebarFolders() {
    try {
        const response = await fetch('/get-sidebar-folders');
        const folders = await response.json();
        const foldersList = document.getElementById('sidebarFolders');
        
        foldersList.innerHTML = folders.map(folder => `
            <li><a href="/folders#${folder.id}">📁 ${folder.name}</a></li>
        `).join('') + `
        <li><button class="add-folder-btn" onclick="createNewFolder()">+ New Folder</button></li>`;
    } catch (error) {
        console.error('Error loading sidebar folders:', error);
    }
}

document.addEventListener('DOMContentLoaded', loadSidebarFolders);

// static/folders.js
async function loadFolders() {
    try {
        const response = await fetch('/get-folders');
        const folders = await response.json();
        displayFolders(folders);
    } catch (error) {
        console.error('Error loading folders:', error);
    }
}

function displayFolders(folders) {
    const grid = document.getElementById('folderGrid');
    grid.innerHTML = '';

    folders.forEach(folder => {
        const folderEl = document.createElement('div');
        folderEl.className = 'folder-card';
        folderEl.dataset.folderId = folder.id;
        folderEl.innerHTML = `
            <div class="folder-header">
                <div class="folder-title">
                    📁 <span class="folder-name" ondblclick="makeEditable(this)" data-folder-id="${folder.id}">${folder.name}</span>
                </div>
                <div class="folder-actions">
                    <button onclick="deleteFolder(${folder.id})">Delete</button>
                </div>
            </div>
            <div class="audio-list">
                ${folder.audios && folder.audios.length ? 
                    folder.audios.map(audio => `
                        <div class="audio-item" draggable="true" data-audio-id="${audio.id}">
                            🎵 <span class="audio-name" ondblclick="makeEditable(this)" data-audio-id="${audio.id}">${audio.name}</span>
                            <button onclick="playAudio('${audio.file_path}')">Play</button>
                            <button onclick="deleteAudio(${audio.id})">Delete</button>
                        </div>
                    `).join('') : 
                    '<div class="folder-empty">No audio files</div>'
                }
            </div>
        `;
        grid.appendChild(folderEl);
    });
}

function makeEditable(element) {
    const originalText = element.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = originalText;
    input.className = 'edit-input';
    
    input.onblur = function() {
        saveEdit(element, input.value);
    };
    
    input.onkeydown = function(e) {
        if (e.key === 'Enter') {
            saveEdit(element, input.value);
        }
        if (e.key === 'Escape') {
            element.textContent = originalText;
            element.style.display = 'inline';
            input.remove();
        }
    };
    
    element.style.display = 'none';
    element.parentNode.insertBefore(input, element);
    input.focus();
    input.select();
}

async function saveEdit(element, newValue) {
    const folderId = element.dataset.folderId;
    const audioId = element.dataset.audioId;
    let success = false;

    try {
        if (folderId) {
            // Editing folder name
            const response = await fetch(`/edit-folder/${folderId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newValue })
            });
            success = response.ok;
        } else if (audioId) {
            // Editing audio name
            const response = await fetch(`/edit-audio/${audioId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newValue })
            });
            success = response.ok;
        }

        if (success) {
            element.textContent = newValue;
            element.style.display = 'inline';
            element.previousSibling.remove(); // Remove input
            loadFolders(); // Refresh the display
            loadSidebarFolders(); // Update sidebar
        } else {
            throw new Error('Failed to save changes');
        }
    } catch (error) {
        console.error('Error saving edit:', error);
        alert('Failed to save changes');
        element.style.display = 'inline';
        element.previousSibling.remove(); // Remove input
    }
}

async function createNewFolder() {
    const name = prompt('Enter folder name:');
    if (!name) return;

    try {
        const response = await fetch('/create-folder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });

        if (response.ok) {
            loadFolders();
            loadSidebarFolders();
        } else {
            throw new Error('Failed to create folder');
        }
    } catch (error) {
        console.error('Error creating folder:', error);
        alert('Failed to create folder');
    }
}

async function deleteFolder(folderId) {
    if (!confirm('Are you sure you want to delete this folder?')) return;

    try {
        const response = await fetch(`/delete-folder/${folderId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            loadFolders();
            loadSidebarFolders();
        } else {
            throw new Error('Failed to delete folder');
        }
    } catch (error) {
        console.error('Error deleting folder:', error);
        alert('Failed to delete folder');
    }
}

async function deleteAudio(audioId) {
    if (!confirm('Are you sure you want to delete this audio?')) return;

    try {
        const response = await fetch(`/delete-audio/${audioId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            loadFolders();
        } else {
            throw new Error('Failed to delete audio');
        }
    } catch (error) {
        console.error('Error deleting audio:', error);
        alert('Failed to delete audio');
    }
}

function playAudio(audioPath) {
    const audio = new Audio(audioPath);
    audio.play();
}

// Drag and drop functionality
let draggedItem = null;

document.addEventListener('dragstart', (e) => {
    if (e.target.classList.contains('audio-item')) {
        draggedItem = e.target;
        e.dataTransfer.setData('text/plain', '');
        e.target.style.opacity = '0.5';
    }
});

document.addEventListener('dragend', (e) => {
    if (e.target.classList.contains('audio-item')) {
        e.target.style.opacity = '1';
    }
});

document.addEventListener('dragover', (e) => {
    e.preventDefault();
    const folderCard = e.target.closest('.folder-card');
    if (folderCard) {
        folderCard.classList.add('drag-over');
    }
});

document.addEventListener('dragleave', (e) => {
    const folderCard = e.target.closest('.folder-card');
    if (folderCard) {
        folderCard.classList.remove('drag-over');
    }
});

document.addEventListener('drop', async (e) => {
    e.preventDefault();
    const dropTarget = e.target.closest('.folder-card');
    if (dropTarget) {
        dropTarget.classList.remove('drag-over');
    }
    
    if (dropTarget && draggedItem) {
        const audioId = draggedItem.dataset.audioId;
        const sourceFolderId = draggedItem.closest('.folder-card').dataset.folderId;
        const targetFolderId = dropTarget.dataset.folderId;

        if (sourceFolderId !== targetFolderId) {
            try {
                const response = await fetch('/move-audio', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        audioId,
                        targetFolderId
                    })
                });

                if (response.ok) {
                    loadFolders();
                } else {
                    throw new Error('Failed to move audio');
                }
            } catch (error) {
                console.error('Error moving audio:', error);
                alert('Failed to move audio');
            }
        }
    }
});

// Load sidebar folders
async function loadSidebarFolders() {
    try {
        const response = await fetch('/get-folders');
        const folders = await response.json();
        const foldersList = document.getElementById('sidebarFolders');
        
        foldersList.innerHTML = folders.map(folder => `
            <li><a href="#folder-${folder.id}">📁 ${folder.name}</a></li>
        `).join('') + `
        <li><button class="add-folder-btn" onclick="createNewFolder()">+ New Folder</button></li>`;
    } catch (error) {
        console.error('Error loading sidebar folders:', error);
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    loadFolders();
    loadSidebarFolders();
});