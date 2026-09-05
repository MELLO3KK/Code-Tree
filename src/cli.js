#!/usr/bin/env node

const { program } = require('commander');
const path = require('path');
const fs = require('fs');

program
  .name('directory-tree-generator')
  .description('Generate directory tree structures with options to block specific paths.')
  .version('1.1.0');

program
  .option('-d, --directories <paths...>', 'Directories to generate tree for (comma-separated or multiple -d flags)')
  .option('-o, --output <directory>', 'Output directory for tree files', process.cwd())
  .option('-e, --extensions <exts...>', 'Allowed file extensions to include content for (e.g., .js .py)', [])
  .option('-b, --blocked <paths...>', 'Paths to block from tree generation', [])
  .option('-r, --recursive', 'Generate tree recursively', true)
  .option('-i, --import <file>', 'Import configuration from a JSON preset file')
  .parse();

const options = program.opts();

// If import option is provided, load configuration from JSON file
let importedConfig = {};
if (options.import) {
  const importPath = path.resolve(options.import);
  if (!fs.existsSync(importPath)) {
    console.error(`Error: Import file does not exist: ${importPath}`);
    process.exit(1);
  }
  try {
    const content = fs.readFileSync(importPath, 'utf-8');
    importedConfig = JSON.parse(content);
    console.log(`Loaded configuration from: ${importPath}\n`);
  } catch (error) {
    console.error(`Error reading import file: ${error.message}`);
    process.exit(1);
  }
}

// Merge imported config with command-line options (CLI options take precedence)
const allowedExtensions = options.extensions && options.extensions.length > 0 
  ? options.extensions.map(ext => ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`)
  : (importedConfig.allowed_extensions || []).map(ext => ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`);

const blockedPaths = options.blocked && options.blocked.length > 0
  ? options.blocked.map(p => path.resolve(p))
  : (importedConfig.blocked_paths || []).map(p => path.resolve(p));

const directories = options.directories 
  ? options.directories.map(d => path.resolve(d))
  : (importedConfig.directories || []).map(d => path.resolve(d));

const outputDir = options.output !== process.cwd() 
  ? path.resolve(options.output)
  : (importedConfig.output_directory ? path.resolve(importedConfig.output_directory) : path.resolve(options.output));

// Validate that we have directories (either from CLI or import)
if (directories.length === 0) {
  console.error('Error: No directories specified. Use -d/--directories or provide a JSON preset with "directories".');
  process.exit(1);
}

console.log('Directory Tree Generator CLI');
console.log('===========================\n');

console.log(`Input directories: ${directories.join(', ')}`);
console.log(`Output directory: ${outputDir}`);
console.log(`Allowed extensions: ${allowedExtensions.length > 0 ? allowedExtensions.join(', ') : '(none)'}`);
console.log(`Blocked paths: ${blockedPaths.length > 0 ? blockedPaths.join(', ') : '(none)'}\n`);

// Validate directories exist
for (const dir of directories) {
  if (!fs.existsSync(dir)) {
    console.error(`Error: Directory does not exist: ${dir}`);
    process.exit(1);
  }
  if (!fs.statSync(dir).isDirectory()) {
    console.error(`Error: Path is not a directory: ${dir}`);
    process.exit(1);
  }
}

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  try {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`Created output directory: ${outputDir}`);
  } catch (error) {
    console.error(`Error creating output directory: ${error.message}`);
    process.exit(1);
  }
}

const config = {
  directories,
  allowed_extensions: allowedExtensions,
  blocked_paths: blockedPaths
};

try {
  directories.forEach(dir => {
    const dirName = path.basename(dir);
    const outputFilePath = path.join(outputDir, `${dirName}_tree.txt`);
    const fileStream = fs.createWriteStream(outputFilePath, { encoding: 'utf-8' });

    console.log(`Generating tree for: ${dir}`);
    fileStream.write(`${dirName}/\n`);
    generateTreeRecursive(dir, fileStream, config);
    fileStream.end();
    
    console.log(`✓ Generated: ${outputFilePath}`);
  });
  
  console.log('\nDone!');
} catch (error) {
  console.error('Error generating tree:', error.message);
  process.exit(1);
}

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

      // If the path is blocked, do not process its contents
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
