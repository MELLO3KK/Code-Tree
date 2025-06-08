document.addEventListener('DOMContentLoaded', () => {
    // --- Element selection ---
    const dirList = document.getElementById('directories-list');
    const addDirBtn = document.getElementById('add-dir-btn');
    const removeDirBtn = document.getElementById('remove-dir-btn');
    const extEntry = document.getElementById('ext-entry');
    const generateBtn = document.getElementById('generate-btn');
    const saveConfigBtn = document.getElementById('save-config-btn');
    const loadConfigBtn = document.getElementById('load-config-btn');

    // --- Utility Functions for Lists ---
    const addPathsToList = (listElement, paths) => {
        const existingPaths = Array.from(listElement.children).map(li => li.textContent);
        paths.forEach(p => {
            if (!existingPaths.includes(p)) {
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

    // Main directory list buttons
    addDirBtn.addEventListener('click', async () => {
        const paths = await window.electronAPI.openDirectoryDialog();
        if (paths) addPathsToList(dirList, paths);
    });
    removeDirBtn.addEventListener('click', () => deleteSelectedFromList(dirList));
    setupListInteraction(dirList);

    // Tab Configuration Lists
    document.querySelectorAll('.tab-content').forEach(tab => {
        const list = tab.querySelector('.path-list');
        const addBtn = tab.querySelector('.add-btn');
        const deleteBtn = tab.querySelector('.delete-btn');

        if (list) {
            setupListInteraction(list);

            addBtn.addEventListener('click', async () => {
                const type = addBtn.dataset.type; // 'file' or 'folder'
                const paths = type === 'folder' 
                    ? await window.electronAPI.openDirectoryDialog()
                    : await window.electronAPI.openFilesDialog();
                if (paths) addPathsToList(list, paths);
            });

            deleteBtn.addEventListener('click', () => deleteSelectedFromList(list));
        }
    });

    // Tab switching logic
    document.querySelectorAll('.tab-link').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.tab-link, .tab-content').forEach(el => el.classList.remove('active'));
            const tabId = button.dataset.tab;
            button.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });

    // --- Drag and Drop ---
    const setupDropArea = (area, targetList, type) => {
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
    
    setupDropArea(document.getElementById('dirs-drop-area'), dirList, 'folder');
    document.querySelectorAll('.config-drop-area').forEach(area => {
        const listId = area.dataset.listId;
        const type = area.dataset.type;
        setupDropArea(area, document.getElementById(listId), type);
    });

    // --- Main Actions ---
    const getConfigFromUI = () => {
        const getPathsFromList = (listId) => Array.from(document.getElementById(listId).children).map(li => li.textContent);
        return {
            directories: getPathsFromList('directories-list'),
            allowed_extensions: extEntry.value.split(',').map(ext => ext.trim().toLowerCase()).filter(Boolean),
            hide_entirely: getPathsFromList('hide-entirely-list'),
            show_name_only: getPathsFromList('show-name-only-list'),
            block_file_content: getPathsFromList('block-content-list'),
            block_file_path: getPathsFromList('block-path-list'),
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
            extEntry.value = (config.allowed_extensions || []).join(', ');
            addPathsToList(document.getElementById('hide-entirely-list'), config.hide_entirely || []);
            addPathsToList(document.getElementById('show-name-only-list'), config.show_name_only || []);
            addPathsToList(document.getElementById('block-content-list'), config.block_file_content || []);
            addPathsToList(document.getElementById('block-path-list'), config.block_file_path || []);
        } else if (result.message) {
            alert(`Error loading config: ${result.message}`);
        }
    });
});
