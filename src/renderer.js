document.addEventListener('DOMContentLoaded', () => {
    // --- Element selection ---
    const dirList = document.getElementById('directories-list');
    const addDirBtn = document.getElementById('add-dir-btn');
    const removeDirBtn = document.getElementById('remove-dir-btn');
    
    const extEntry = document.getElementById('ext-entry');
    const addExtBtn = document.getElementById('add-ext-btn');
    const removeExtBtn = document.getElementById('remove-ext-btn');
    const extensionsList = document.getElementById('extensions-list');

    const blockedPathsList = document.getElementById('blocked-paths-list');
    
    const generateBtn = document.getElementById('generate-btn');
    const saveConfigBtn = document.getElementById('save-config-btn');
    const loadConfigBtn = document.getElementById('load-config-btn');

    // --- Utility Functions for Lists ---
    const addPathsToList = (listElement, paths) => {
        const existingPaths = Array.from(listElement.children).map(li => li.textContent);
        paths.forEach(p => {
            if (p && !existingPaths.includes(p)) { // Ensure path is not empty
                const li = document.createElement('li');
                li.textContent = p;
                listElement.appendChild(li);
            }
        });
    };
    
    const setupListInteraction = (listElement) => {
        listElement.addEventListener('click', (e) => {
            if (e.target.tagName === 'LI') {
                e.target.classList.toggle('selected');
            }
        });
    };

    const deleteSelectedFromList = (listElement) => {
        const selected = listElement.querySelectorAll('li.selected');
        selected.forEach(li => li.remove());
    };
    
    // --- Event Listeners ---

    // Main directory list
    addDirBtn.addEventListener('click', async () => {
        const paths = await window.electronAPI.openDirectoryDialog();
        if (paths) addPathsToList(dirList, paths);
    });
    removeDirBtn.addEventListener('click', () => deleteSelectedFromList(dirList));
    setupListInteraction(dirList);

    // Allowed extensions list
    addExtBtn.addEventListener('click', () => {
        const ext = extEntry.value.trim();
        if (ext) {
            addPathsToList(extensionsList, [ext]);
            extEntry.value = ''; // Clear input after adding
        }
    });
    removeExtBtn.addEventListener('click', () => deleteSelectedFromList(extensionsList));
    setupListInteraction(extensionsList);

    // Blocked paths list
    document.querySelectorAll('.add-btn').forEach(addBtn => {
        addBtn.addEventListener('click', async () => {
            const type = addBtn.dataset.type; // 'file' or 'folder'
            const paths = type === 'folder' 
                ? await window.electronAPI.openDirectoryDialog()
                : await window.electronAPI.openFilesDialog();
            if (paths) addPathsToList(blockedPathsList, paths);
        });
    });
    document.querySelector('#blocked-paths-list + .button-column .delete-btn').addEventListener('click', () => deleteSelectedFromList(blockedPathsList));
    setupListInteraction(blockedPathsList);

    // --- Drag and Drop ---
    const setupDropArea = (area, targetList) => {
        area.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            area.classList.add('drop-hover');
        });

        area.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            area.classList.remove('drop-hover');
        });
        
        area.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            area.classList.remove('drop-hover');
            
            const files = Array.from(e.dataTransfer.files).map(f => f.path);
            addPathsToList(targetList, files);
        });
    };
    
    setupDropArea(document.getElementById('dirs-drop-area'), dirList);
    setupDropArea(document.querySelector('.config-drop-area'), blockedPathsList);

    // --- Main Actions ---
    const getConfigFromUI = () => {
        const getPathsFromList = (listId) => Array.from(document.getElementById(listId).children).map(li => li.textContent);
        return {
            directories: getPathsFromList('directories-list'),
            allowed_extensions: getPathsFromList('extensions-list').map(ext => ext.toLowerCase()),
            blocked_paths: getPathsFromList('blocked-paths-list'),
        };
    };

    generateBtn.addEventListener('click', async () => {
        const config = getConfigFromUI();
        if (config.directories.length === 0) {
            alert('Error: Please select at least one directory to scan.');
            return;
        }
        const result = await window.electronAPI.generateTree(config);
        alert(result.message);
    });

    saveConfigBtn.addEventListener('click', async () => {
        const config = getConfigFromUI();
        await window.electronAPI.saveConfig(config);
    });

    loadConfigBtn.addEventListener('click', async () => {
        const result = await window.electronAPI.loadConfig();
        if (result.success) {
            const config = result.config;
            // Clear all lists
            document.querySelectorAll('.path-list').forEach(list => list.innerHTML = '');
            // Populate UI from config
            addPathsToList(dirList, config.directories || []);
            addPathsToList(extensionsList, config.allowed_extensions || []);
            addPathsToList(blockedPathsList, config.blocked_paths || []);
        } else if (result.message) {
            alert(`Error loading config: ${result.message}`);
        }
    });
});
