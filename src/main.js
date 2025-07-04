const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Note: We are removing 'const Store = require('electron-store');' from here.

// Keep this outside so it can be referenced by other functions if needed.
let store;

// Main function to create the application window
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 850,
    height: 650,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  // For debugging:
  // mainWindow.webContents.openDevTools();
}


// App lifecycle
app.whenReady().then(async () => {
  // Dynamically import electron-store
  const { default: Store } = await import('electron-store');

  // Define the schema for your application's settings
  const schema = {
    directories: { type: 'array', default: [] },
    allowed_extensions: { type: 'array', default: [] },
    blocked_paths: { type: 'array', default: [] },
    live_monitoring: { type: 'boolean', default: false },
    output_directory: { type: 'string', default: '' }
  };

  // Initialize store here
  store = new Store({ schema });

  // --- ALL IPC HANDLERS THAT USE 'store' MUST BE INITIALIZED HERE --- 

  // IPC handler to get the initial configuration
  ipcMain.handle('get-store-data', () => {
    return store.store;
  });

  // IPC handler to save the configuration
  ipcMain.on('set-store-data', (event, data) => {
    store.set(data);
  });

  // Now create the window
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

let watchers = {}; // To store active file watchers
let lastConfig = null; // To store the last used configuration
let lastOutputDir = null; // To store the last used output directory
let debounceTimer = null; // To prevent rapid-fire regeneration

function executeGeneration(config, outputDir) {
  try {
    config.directories.forEach(dir => {
      const dirName = path.basename(dir);
      const outputFilePath = path.join(outputDir, `${dirName}_tree.txt`);
      const fileStream = fs.createWriteStream(outputFilePath, { encoding: 'utf-8' });

      fileStream.write(`${dirName}/\n`);
      generateTreeRecursive(dir, fileStream, config);
      fileStream.end();
    });
    console.log(`Live update: Regenerated tree files in ${outputDir}`);
    return { success: true };
  } catch (error) {
    console.error('Live update failed:', error);
    return { success: false, message: error.message };
  }
}

app.on('window-all-closed', () => {
  Object.values(watchers).forEach(watcher => watcher.close());
  watchers = {};
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// The core tree-generating logic, modified for new requirements
function generateTreeRecursive(directory, fileStream, config, prefix = '') {
  try {
    const items = fs.readdirSync(directory).sort();

    items.forEach((item, index) => {
      const itemPath = path.join(directory, item);
      const isLast = index === items.length - 1;
      const isDir = fs.statSync(itemPath).isDirectory();
      
      const connector = isLast ? '└── ' : '├── ';
      const displayName = isDir ? `${item}/` : item;
      fileStream.write(`${prefix}${connector}${displayName}\n`);

      // If the path is blocked, do not process its contents (neither recurse nor read file)
      const isBlocked = config.blocked_paths.includes(itemPath);

      if (isDir && !isBlocked) {
        const newPrefix = prefix + (isLast ? '    ' : '│   ');
        generateTreeRecursive(itemPath, fileStream, config, newPrefix);
      } else if (!isDir && !isBlocked) {
        const ext = path.extname(item).toLowerCase();
        if (config.allowed_extensions.includes(ext)) {
          try {
            const content = fs.readFileSync(itemPath, 'utf-8').trim();
            const contentPrefix = prefix + (isLast ? '    ' : '│   ');
            content.split(/\r?\n/).forEach(line => {
              fileStream.write(`${contentPrefix}    ${line}\n`);
            });
          } catch (e) {
            const contentPrefix = prefix + (isLast ? '    ' : '│   ');
            fileStream.write(`${contentPrefix}    [Error reading file: ${e.message}]\n`);
          }
        }
      }
    });
  } catch (e) {
    fileStream.write(`${prefix}└── [Permission denied]\n`);
  }
}

// IPC handler to generate the tree file
ipcMain.handle('generate-tree', async (event, config) => {
  const { filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select Output Directory',
  });

  if (!filePaths || filePaths.length === 0) {
    return { success: false, message: 'No output directory selected.' };
  }

  const outputDir = filePaths[0];
  lastConfig = config;
  lastOutputDir = outputDir;

  try {
    executeGeneration(config, outputDir);
    return { success: true, message: `Generated ${config.directories.length} tree files in:\n${outputDir}`, outputDir: outputDir };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.on('start-watching', () => {
    Object.values(watchers).forEach(watcher => watcher.close());
    watchers = {};

    if (!lastConfig || !lastOutputDir) return;

    lastConfig.directories.forEach(dir => {
        try {
            const watcher = fs.watch(dir, { recursive: true }, (eventType, filename) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    if (lastConfig && lastOutputDir) {
                        console.log(`Change detected (${eventType}) in ${filename}. Regenerating tree...`);
                        executeGeneration(lastConfig, lastOutputDir);
                    }
                }, 500);
            });
            watchers[dir] = watcher;
            console.log(`Started watching: ${dir}`);
        } catch (error) {
            console.error(`Failed to watch directory ${dir}:`, error);
        }
    });
});

ipcMain.on('stop-watching', () => {
    Object.values(watchers).forEach(watcher => watcher.close());
    watchers = {};
    console.log('Stopped watching all directories.');
});

// IPC handlers for file/folder dialogs
ipcMain.handle('dialog:openDirectory', async () => {
  const { filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory', 'multiSelections'] });
  return filePaths;
});

ipcMain.handle('dialog:openFiles', async () => {
    const { filePaths } = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] });
    return filePaths;
});

// IPC handler for saving/loading config
ipcMain.handle('config:save', async (event, config) => {
    const { filePath } = await dialog.showSaveDialog({
        title: 'Save Configuration',
        defaultPath: 'config.json',
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });

    if (filePath) {
        try {
            fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }
    return { success: false };
});

ipcMain.handle('config:load', async () => {
    const { filePaths } = await dialog.showOpenDialog({
        title: 'Load Configuration',
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
        properties: ['openFile']
    });

    if (filePaths && filePaths.length > 0) {
        try {
            const content = fs.readFileSync(filePaths[0], 'utf-8');
            return { success: true, config: JSON.parse(content) };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }
    return { success: false };
});


// (Other IPC handlers and functions remain unchanged)
