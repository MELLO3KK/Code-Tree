# Directory Tree Generator

A powerful Electron-based application and CLI tool for generating directory tree structures with customizable options to filter paths, file extensions, and more.

## Features

- **GUI Application**: Visual interface for generating and viewing directory trees
- **CLI Tool**: Command-line interface for automation and scripting
- **Path Blocking**: Exclude specific directories or files from the tree generation
- **Extension Filtering**: Include content only for specified file extensions
- **Recursive Generation**: Support for recursive directory traversal
- **Cross-Platform**: Built with Electron for Windows, macOS, and Linux support

## Installation

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Install Dependencies

```bash
npm install
```

## Usage

### GUI Application

Launch the Electron application:

```bash
npm start
```

### CLI Tool

Run the command-line interface:

```bash
npm run cli -- -d /path/to/directory
```

Or use the installed binary after building:

```bash
directory-tree-generator -d /path/to/directory [options]
```

#### CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `-d, --directories <paths...>` | Directories to generate tree for (required) | - |
| `-o, --output <directory>` | Output directory for tree files | Current directory |
| `-e, --extensions <exts...>` | Allowed file extensions to include content for | All |
| `-b, --blocked <paths...>` | Paths to block from tree generation | None |
| `-r, --recursive` | Generate tree recursively | true |

#### CLI Examples

```bash
# Generate tree for a single directory
directory-tree-generator -d /home/user/project

# Generate tree with specific extensions
directory-tree-generator -d /home/user/project -e .js .ts .json

# Block specific paths
directory-tree-generator -d /home/user/project -b node_modules .git

# Specify output directory
directory-tree-generator -d /home/user/project -o /tmp/trees

# Combine multiple options
directory-tree-generator -d /home/user/project -e .js .py -b node_modules __pycache__ -o ./output
```

## Building

Build the distributable package:

```bash
npm run dist
```

This will create a `.deb` package for Linux in the `dist/` directory.

## Project Structure

```
directory-tree-generator/
├── src/
│   ├── main.js          # Electron main process
│   ├── preload.js       # Preload script for IPC
│   ├── renderer.js      # Frontend logic
│   ├── index.html       # Main HTML file
│   ├── style.css        # Stylesheet
│   └── cli.js           # Command-line interface
├── dist/                # Build output directory
├── package.json         # Project configuration
└── README.md            # This file
```

## License

ISC

## Author

Your Name <your.email@example.com>
