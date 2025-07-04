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
    const liveMonitorToggle = document.getElementById('live-monitor-toggle');

    let currentOutputDir = null;

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
        if (paths) {
            addPathsToList(dirList, paths);
            saveCurrentState();
        }
    });
    removeDirBtn.addEventListener('click', () => {
        deleteSelectedFromList(dirList);
        saveCurrentState();
    });
    setupListInteraction(dirList);

    // Allowed extensions list
    addExtBtn.addEventListener('click', () => {
        const ext = extEntry.value.trim();
        if (ext) {
            addPathsToList(extensionsList, [ext]);
            extEntry.value = ''; // Clear input after adding
            saveCurrentState();
        }
    });
    extEntry.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevents default 'Enter' behavior
            addExtBtn.click(); // Triggers the existing add button's logic
        }
    });
    removeExtBtn.addEventListener('click', () => {
        deleteSelectedFromList(extensionsList);
        saveCurrentState();
    });
    setupListInteraction(extensionsList);

    // Blocked paths list
    // --- START: Replacement Code ---
    const addValidatedBlockedPaths = (paths) => {
        const scanDirs = Array.from(dirList.children).map(li => li.textContent);
        if (scanDirs.length === 0) {
            alert("Error: Please select one or more 'Directories to Scan' before adding blocked paths.");
            return;
        }

        const validatedPaths = paths.filter(p => 
            scanDirs.some(scanDir => p.startsWith(scanDir) && p !== scanDir)
        );

        const rejectedCount = paths.length - validatedPaths.length;
        if (rejectedCount > 0) {
            alert(`${rejectedCount} path(s) were not added because they are not inside a selected scan directory.`);
        }
        if (validatedPaths.length > 0) {
            addPathsToList(blockedPathsList, validatedPaths);
            saveCurrentState();
        }
    };

    document.querySelectorAll('.add-btn').forEach(addBtn => {
        addBtn.addEventListener('click', async () => {
            const type = addBtn.dataset.type;
            const paths = type === 'folder'
                ? await window.electronAPI.openDirectoryDialog()
                : await window.electronAPI.openFilesDialog();
            
            if (paths) {
                addValidatedBlockedPaths(paths);
            }
        });
    });
    document.querySelector('#blocked-paths-list + .button-column .delete-btn').addEventListener('click', () => {
        deleteSelectedFromList(blockedPathsList);
        saveCurrentState();
    });
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

            if (targetList.id === 'blocked-paths-list') {
                addValidatedBlockedPaths(files);
            } else {
                addPathsToList(targetList, files);
            }
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
        if (result.success) {
            currentOutputDir = result.outputDir;
            if (liveMonitorToggle.checked) {
                window.electronAPI.startWatching();
            }
            saveCurrentState();
        } else {
            currentOutputDir = null;
        }
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

    // Load and apply persistent settings
    async function loadAndApplySettings() {
        const storedData = await window.electronAPI.getStoreData();
        if (storedData) {
            // Restore directories to scan
            if (storedData.directories) {
                addPathsToList(dirList, storedData.directories);
            }
            // Restore allowed extensions
            if (storedData.allowed_extensions) {
                addPathsToList(extensionsList, storedData.allowed_extensions);
            }
            // Restore blocked paths
            if (storedData.blocked_paths) {
                addPathsToList(blockedPathsList, storedData.blocked_paths);
            }
            // Restore live monitoring toggle
            if (typeof storedData.live_monitoring === 'boolean') {
                liveMonitorToggle.checked = storedData.live_monitoring;
            }
            // Restore output directory
            if (storedData.output_directory) {
                currentOutputDir = storedData.output_directory;
            }
        }
    }

    // Call the function to load settings on startup
    loadAndApplySettings();

    // Function to get the current UI configuration and save it
    function saveCurrentState() {
        const currentState = {
            directories: Array.from(dirList.children).map(li => li.textContent),
            allowed_extensions: Array.from(extensionsList.children).map(li => li.textContent),
            blocked_paths: Array.from(blockedPathsList.children).map(li => li.textContent),
            live_monitoring: liveMonitorToggle.checked,
            // Ensure output_directory is always a string
            output_directory: currentOutputDir || ''
        };
        window.electronAPI.setStoreData(currentState);
    }

    liveMonitorToggle.addEventListener('change', () => {
        if (liveMonitorToggle.checked) {
            if (!currentOutputDir) {
                alert('Please generate the tree once to set an output directory before enabling live monitoring.');
                liveMonitorToggle.checked = false;
                return;
            }
            window.electronAPI.startWatching();
            saveCurrentState();
            alert('Live monitoring enabled. The output file will now update automatically.');
        } else {
            window.electronAPI.stopWatching();
            saveCurrentState();
            alert('Live monitoring disabled.');
        }
    });
});
