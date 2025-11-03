#!/usr/bin/env gjs

imports.gi.versions.Gtk = '4.0';
imports.gi.versions.Adw = '1';

const { Gtk, Gio, GLib, Adw, GObject } = imports.gi;

// Constants
const APP_ID = 'com.github.jot';
const JOT_DIR = ['Documents', 'Jot'];
const THEME_PATH = ['.config', 'omarchy', 'current', 'theme', 'alacritty.toml'];
const FEEDBACK_TIMEOUT_MS = 3000;

// Keyboard constants
const KEY_ESCAPE = 65307;
const KEY_ENTER = 65293;
const KEY_S = 115;
const KEY_P = 112;       // 'p' key
const KEY_PLUS = 61;     // '+' key (also '=' key without shift)
const KEY_MINUS = 45;    // '-' key
const KEY_0 = 48;        // '0' key
const CTRL_MASK = 4;

// File patterns
const FILE_PATTERNS = ['*.md', '*.txt'];
const FILE_FILTER_NAME = 'Text files (*.md, *.txt)';

// ============================================================================
// Theme Manager
// ============================================================================

class ThemeManager {
    constructor() {
        this.colors = this._loadColors();
        this.monitor = null;
    }

    _getThemePath() {
        const homeDir = GLib.get_home_dir();
        return GLib.build_filenamev([homeDir, ...THEME_PATH]);
    }

    _loadColors() {
        try {
            const themePath = this._getThemePath();
            const file = Gio.File.new_for_path(themePath);
            const [success, contents] = file.load_contents(null);

            if (!success) {
                return this._getDefaultColors();
            }

            return this._parseTomlColors(new TextDecoder().decode(contents));
        } catch (e) {
            print(`Failed to load theme: ${e.message}`);
            return this._getDefaultColors();
        }
    }

    _parseTomlColors(text) {
        const colors = {};
        const lines = text.split('\n');
        let currentSection = '';

        for (const line of lines) {
            const sectionMatch = line.match(/^\[colors\.(\w+)\]/);
            if (sectionMatch) {
                currentSection = sectionMatch[1];
                continue;
            }

            const match = line.match(/^(\w+)\s*=\s*"([^"]+)"/);
            if (match && (currentSection === 'normal' || currentSection === 'primary')) {
                const [, key, value] = match;
                colors[key] = value;
            }
        }

        return {
            background: colors.background || '#0A0E1A',
            foreground: colors.foreground || '#a5bfd8',
            cursor: colors.cursor || '#a5bfd8',
            black: colors.black || '#0A0E1A',
            red: colors.red || '#B4445D',
            green: colors.green || '#335788',
            yellow: colors.yellow || '#384F97',
            blue: colors.blue || '#3A669B',
            magenta: colors.magenta || '#4A689C',
            cyan: colors.cyan || '#D55F8D',
            white: colors.white || '#a5bfd8',
        };
    }

    _getDefaultColors() {
        return {
            background: '#0d1117',
            foreground: '#e6edf3',
            cursor: '#e6edf3',
            black: '#0d1117',
            red: '#ff7b72',
            green: '#3fb950',
            yellow: '#d29922',
            blue: '#58a6ff',
            magenta: '#bc8cff',
            cyan: '#39c5cf',
            white: '#e6edf3',
        };
    }

    setupMonitor(callback) {
        try {
            const themePath = this._getThemePath();
            const file = Gio.File.new_for_path(themePath);
            this.monitor = file.monitor_file(Gio.FileMonitorFlags.NONE, null);
            this.monitor.connect('changed', () => {
                this.colors = this._loadColors();
                callback();
            });
        } catch (e) {
            print(`Failed to setup theme monitor: ${e.message}`);
        }
    }

    generateCSS(zoomLevel = 100) {
        const c = this.colors;
        const zoom = zoomLevel / 100;
        return `
            window {
                background: ${c.black};
            }

            .jot-textview {
                background: transparent;
                color: ${c.white};
                font-size: ${15 * zoom}px;
                font-family: 'JetBrains Mono', 'Fira Code', 'Source Code Pro', 'DejaVu Sans Mono', 'Courier New', monospace;
                caret-color: ${c.white};
            }

            .jot-textview text {
                background: transparent;
                color: ${c.white};
            }
            
            textview {
                background: transparent;
                color: ${c.white};
            }
            
            textview > text {
                background: transparent;
                color: ${c.white};
            }

            .jot-textview selection {
                background-color: ${c.blue};
                color: ${c.white};
            }

            .jot-button {
                padding: 4px 12px;
                border-radius: 0;
                border: 1px solid ${c.white};
                background: ${c.black};
                color: ${c.white};
                font-weight: 500;
                font-size: 11px;
            }

            .jot-button:hover {
                background: ${c.white};
                color: ${c.black};
            }

            .jot-button-save {
                background: ${c.green};
                border-color: ${c.green};
                color: ${c.black};
            }

            .jot-button-save:hover {
                background: ${c.blue};
                border-color: ${c.blue};
            }

            .jot-statusbar {
                border-top: 1px solid ${c.white};
                padding-top: 10px;
            }

            .status-label {
                color: ${c.white};
                font-size: 12px;
            }

            .jot-hash {
                color: ${c.white};
                font-size: ${18 * zoom}px;
                font-weight: bold;
                font-family: 'JetBrains Mono', 'Fira Code', 'Source Code Pro', 'DejaVu Sans Mono', 'Courier New', monospace;
                margin-right: 8px;
            }

            .jot-title {
                background: transparent;
                border: none;
                color: ${c.white};
                font-size: ${18 * zoom}px;
                font-weight: bold;
                font-family: 'JetBrains Mono', 'Fira Code', 'Source Code Pro', 'DejaVu Sans Mono', 'Courier New', monospace;
                padding: 0;
                box-shadow: none;
                outline: none;
            }

            .jot-title:focus {
                outline: none;
                box-shadow: none;
                border: none;
            }

            entry {
                outline: none;
                box-shadow: none;
            }

            entry:focus {
                outline: none;
                box-shadow: none;
                border: none;
            }

            .jot-open-button {
                padding: 4px 12px;
                border-radius: 0;
                border: 1px solid ${c.white};
                background: ${c.black};
                color: ${c.white};
                font-weight: 500;
                font-size: 11px;
            }

            .jot-open-button:hover {
                background: ${c.white};
                color: ${c.black};
            }

            .fuzzy-search-dialog {
                background: ${c.black};
                border: 1px solid ${c.white};
            }

            .fuzzy-search-entry {
                background: ${c.black};
                color: ${c.white};
                border: none;
                border-bottom: 1px solid ${c.white};
                padding: 8px 12px;
                font-size: ${14 * zoom}px;
                font-family: 'JetBrains Mono', 'Fira Code', 'Source Code Pro', 'DejaVu Sans Mono', 'Courier New', monospace;
            }

            .fuzzy-search-entry:focus {
                outline: none;
                box-shadow: none;
                border-bottom: 1px solid ${c.blue};
            }

            .fuzzy-results-list {
                background: ${c.black};
            }

            .fuzzy-result-item {
                padding: 8px 12px;
                font-size: ${13 * zoom}px;
                font-family: 'JetBrains Mono', 'Fira Code', 'Source Code Pro', 'DejaVu Sans Mono', 'Courier New', monospace;
            }

            .fuzzy-result-item label {
                color: ${c.white};
            }

            .fuzzy-result-item:selected {
                background: ${c.blue};
                color: ${c.white};
            }

            .fuzzy-result-item:hover {
                background: ${c.blue};
            }

            .fuzzy-preview {
                background: ${c.black};
                color: ${c.white};
                border-left: 1px solid ${c.white};
                padding: 12px;
                font-size: ${12 * zoom}px;
                font-family: 'JetBrains Mono', 'Fira Code', 'Source Code Pro', 'DejaVu Sans Mono', 'Courier New', monospace;
            }
        `;
    }
}

// ============================================================================
// File Manager
// ============================================================================

class FileManager {
    static getJotDirectory() {
        const homeDir = GLib.get_home_dir();
        return GLib.build_filenamev([homeDir, ...JOT_DIR]);
    }

    static ensureJotDirectoryExists() {
        const jotDir = this.getJotDirectory();
        const jotDirFile = Gio.File.new_for_path(jotDir);

        try {
            jotDirFile.make_directory_with_parents(null);
        } catch (e) {
            if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS)) {
                print(`Error creating directory: ${e.message}`);
                throw e;
            }
        }
    }

    static normalizeFilename(title) {
        let normalized = title.trim()
            .replace(/\s+/g, '-')
            .replace(/[^a-zA-Z0-9-_]/g, '')
            .toLowerCase();

        if (normalized.length > 50) {
            normalized = normalized.substring(0, 50);
        }

        return normalized;
    }

    static generateFilename(title) {
        if (title) {
            const normalized = this.normalizeFilename(title);
            if (normalized) {
                return `${normalized}.md`;
            }
        }

        const now = GLib.DateTime.new_now_local();
        return `jot-${now.format('%Y%m%d-%H%M%S')}.md`;
    }

    static saveNote(title, content) {
        this.ensureJotDirectoryExists();

        const filename = this.generateFilename(title);
        const filePath = GLib.build_filenamev([this.getJotDirectory(), filename]);
        const now = GLib.DateTime.new_now_local();
        const timestamp = now.format('%Y-%m-%d %H:%M:%S');

        let fileContent = '';
        if (title) {
            fileContent = `# ${title}\n\n`;
        }
        fileContent += `*Created: ${timestamp}*\n\n${content}\n`;

        const file = Gio.File.new_for_path(filePath);
        const outputStream = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
        outputStream.write_all(fileContent, null);
        outputStream.close(null);

        print(`Note saved to ${filePath}`);
        return filename;
    }

    static loadFile(file) {
        const [success, contents] = file.load_contents(null);
        if (!success) {
            throw new Error('Failed to load file');
        }

        const text = new TextDecoder().decode(contents);
        return this.parseFileContent(text, file);
    }

    static parseFileContent(text, file) {
        const lines = text.split('\n');
        let title = '';
        let contentStart = 0;

        // Check if first line is a markdown title
        if (lines[0]?.startsWith('# ')) {
            title = lines[0].substring(2).trim();
            contentStart = 1;

            // Skip empty lines after title
            while (contentStart < lines.length && !lines[contentStart].trim()) {
                contentStart++;
            }

            // Skip timestamp line if present
            if (lines[contentStart]?.startsWith('*Created:')) {
                contentStart++;
                while (contentStart < lines.length && !lines[contentStart].trim()) {
                    contentStart++;
                }
            }
        }

        return {
            title,
            content: lines.slice(contentStart).join('\n'),
            filePath: file.get_path(),
            filename: file.get_basename(),
        };
    }
}

// ============================================================================
// Fuzzy Search Manager
// ============================================================================

class FuzzySearchManager {
    static scanDirectory(dirPath) {
        const results = [];
        const dir = Gio.File.new_for_path(dirPath);

        try {
            const enumerator = dir.enumerate_children(
                'standard::name,standard::type',
                Gio.FileQueryInfoFlags.NONE,
                null
            );

            let fileInfo;
            while ((fileInfo = enumerator.next_file(null)) !== null) {
                const name = fileInfo.get_name();
                const fileType = fileInfo.get_file_type();

                // Only process text files
                if (fileType === Gio.FileType.REGULAR &&
                    (name.endsWith('.md') || name.endsWith('.txt'))) {
                    const filePath = GLib.build_filenamev([dirPath, name]);
                    const file = Gio.File.new_for_path(filePath);

                    try {
                        const [success, contents] = file.load_contents(null);
                        if (success) {
                            const text = new TextDecoder().decode(contents);
                            results.push({
                                filename: name,
                                filepath: filePath,
                                content: text,
                            });
                        }
                    } catch (e) {
                        print(`Error reading file ${name}: ${e.message}`);
                    }
                }
            }
        } catch (e) {
            print(`Error scanning directory: ${e.message}`);
        }

        return results;
    }

    static fuzzyMatch(query, text) {
        if (!query) return { matches: true, score: 0, matchIndices: [] };

        const lowerQuery = query.toLowerCase();
        const lowerText = text.toLowerCase();

        // Simple fuzzy matching: check if all query characters appear in order
        let queryIndex = 0;
        let score = 0;
        let lastMatchIndex = -1;
        const matchIndices = [];

        for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
            if (lowerText[i] === lowerQuery[queryIndex]) {
                // Boost score for consecutive matches
                if (lastMatchIndex === i - 1) {
                    score += 2;
                } else {
                    score += 1;
                }
                lastMatchIndex = i;
                matchIndices.push(i);
                queryIndex++;
            }
        }

        const matches = queryIndex === lowerQuery.length;
        return { matches, score, matchIndices };
    }

    static highlightMatchesWithColor(text, matchIndices, color) {
        if (!matchIndices || matchIndices.length === 0) {
            return GLib.markup_escape_text(text, -1);
        }

        let result = '';
        const matchSet = new Set(matchIndices);
        let inHighlight = false;

        for (let i = 0; i < text.length; i++) {
            const isMatch = matchSet.has(i);
            const char = GLib.markup_escape_text(text[i], -1);

            if (isMatch && !inHighlight) {
                // Start highlighting
                result += `<span foreground="${color}" weight="bold">`;
                inHighlight = true;
            } else if (!isMatch && inHighlight) {
                // End highlighting
                result += '</span>';
                inHighlight = false;
            }

            result += char;
        }

        // Close any open highlight tag
        if (inHighlight) {
            result += '</span>';
        }

        return result;
    }

    static searchFiles(files, query) {
        if (!query) {
            return files.map(f => ({ ...f, score: 0, matchIndices: [], contentMatchIndices: [] }));
        }

        const results = [];

        for (const file of files) {
            // Search in filename
            const filenameMatch = this.fuzzyMatch(query, file.filename);

            // Search in content
            const contentMatch = this.fuzzyMatch(query, file.content);

            if (filenameMatch.matches || contentMatch.matches) {
                // Prioritize filename matches
                const totalScore = (filenameMatch.score * 3) + contentMatch.score;
                results.push({
                    ...file,
                    score: totalScore,
                    matchType: filenameMatch.matches ? 'filename' : 'content',
                    matchIndices: filenameMatch.matches ? filenameMatch.matchIndices : [],
                    contentMatchIndices: contentMatch.matches ? contentMatch.matchIndices : [],
                });
            }
        }

        // Sort by score (higher is better)
        results.sort((a, b) => b.score - a.score);

        return results;
    }
}

// ============================================================================
// Application
// ============================================================================

const JotApplication = GObject.registerClass(
class JotApplication extends Adw.Application {
    _init() {
        super._init({
            application_id: APP_ID,
            flags: Gio.ApplicationFlags.HANDLES_OPEN,
        });
        this._fileToOpen = null;
    }

    vfunc_activate() {
        let window = this.active_window;
        if (!window) {
            window = new JotWindow(this);
        }

        if (this._fileToOpen) {
            window.loadFile(this._fileToOpen);
            this._fileToOpen = null;
        }

        window.present();
    }

    vfunc_open(files, hint) {
        if (files.length > 0) {
            this._fileToOpen = files[0];
        }
        this.activate();
    }
});

// ============================================================================
// Main Window
// ============================================================================

const JotWindow = GObject.registerClass(
class JotWindow extends Adw.ApplicationWindow {
    _init(application) {
        super._init({
            application,
            title: 'Jot',
            default_width: 700,
            default_height: 500,
        });

        this._currentFilename = 'untitled.md';
        this._currentFilePath = null; // Track the full path of opened file
        this._themeManager = new ThemeManager();
        this._lastSaveClickTime = 0; // Track double-click for Save As
        this._zoomLevel = 100; // Zoom level percentage (default 100%)
        this._zoomTimeoutId = null; // Track zoom indicator timeout

        this._buildUI();
        this._setupTheme();
        this._setupKeyboardShortcuts();

        this._titleEntry.grab_focus();
    }

    _buildUI() {
        const mainBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 0,
        });

        mainBox.append(this._createTitleBar());
        mainBox.append(this._createTextView());
        mainBox.append(this._createStatusBar());

        this.set_content(mainBox);
    }

    _createTitleBar() {
        const titleBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 0,
            margin_start: 20,
            margin_end: 20,
            margin_top: 20,
            margin_bottom: 0,
        });

        const hashLabel = new Gtk.Label({ label: '#', halign: Gtk.Align.START });
        hashLabel.add_css_class('jot-hash');

        this._titleEntry = new Gtk.Entry({
            placeholder_text: 'Title',
            hexpand: true,
        });
        this._titleEntry.add_css_class('jot-title');
        this._titleEntry.connect('changed', () => this._updateFilenameDisplay());
        
        // Add Enter key handler to switch focus to text view
        this._titleEntry.connect('activate', () => {
            this._textView.grab_focus();
        });

        titleBox.append(hashLabel);
        titleBox.append(this._titleEntry);

        return titleBox;
    }

    _createTextView() {
        this._textView = new Gtk.TextView({
            wrap_mode: Gtk.WrapMode.WORD_CHAR,
            vexpand: true,
            hexpand: true,
            left_margin: 20,
            right_margin: 20,
            top_margin: 12,
            bottom_margin: 20,
        });
        this._textView.add_css_class('jot-textview');

        // Wrap in ScrolledWindow for scrolling
        const scrolledWindow = new Gtk.ScrolledWindow({
            child: this._textView,
            vexpand: true,
            hexpand: true,
        });

        return scrolledWindow;
    }

    _createStatusBar() {
        this._statusBar = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 16,
            height_request: 36,
            margin_start: 16,
            margin_end: 16,
            margin_top: 8,
            margin_bottom: 8,
        });
        this._statusBar.add_css_class('jot-statusbar');

        const jotDir = FileManager.getJotDirectory();
        this._pathLabel = new Gtk.Label({
            label: GLib.build_filenamev([jotDir, this._currentFilename]),
            halign: Gtk.Align.START,
            hexpand: true,
            ellipsize: 3,
        });
        this._pathLabel.add_css_class('status-label');

        const buttonBox = this._createButtonBox();

        this._statusBar.append(this._pathLabel);
        this._statusBar.append(buttonBox);

        return this._statusBar;
    }

    _createButtonBox() {
        const buttonBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            halign: Gtk.Align.END,
        });

        const openButton = new Gtk.Button({
            label: 'Open',
        });
        openButton.add_css_class('jot-open-button');
        openButton.connect('clicked', () => this._openFileDialog());

        const cancelButton = new Gtk.Button({ label: 'Cancel' });
        cancelButton.add_css_class('jot-button');
        cancelButton.connect('clicked', () => this.close());

        const saveButton = new Gtk.Button({ label: 'Save' });
        saveButton.add_css_class('jot-button');
        saveButton.add_css_class('jot-button-save');
        saveButton.connect('clicked', () => this._saveNote());

        buttonBox.append(openButton);
        buttonBox.append(cancelButton);
        buttonBox.append(saveButton);

        return buttonBox;
    }

    _setupTheme() {
        this._applyCSS();
        this._themeManager.setupMonitor(() => this._applyCSS());
    }

    _applyCSS() {
        const cssProvider = new Gtk.CssProvider();
        const css = this._themeManager.generateCSS(this._zoomLevel);
        cssProvider.load_from_data(css, -1);
        Gtk.StyleContext.add_provider_for_display(
            this.get_display(),
            cssProvider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        );
    }

    _setupKeyboardShortcuts() {
        const keyController = new Gtk.EventControllerKey();
        keyController.connect('key-pressed', (controller, keyval, keycode, state) => {
            // Debug: log Ctrl key presses
            if (state & CTRL_MASK) {
                print(`Ctrl key pressed: keyval=${keyval}, keycode=${keycode}`);
            }
            
            if (keyval === KEY_ESCAPE) {
                this.close();
                return true;
            }
            if ((keyval === KEY_ENTER || keyval === KEY_S) && (state & CTRL_MASK)) {
                this._saveNote();
                return true;
            }
            // Zoom in: Ctrl + or Ctrl = (multiple keycodes for compatibility)
            // Ctrl+P: Open fuzzy search
            if (keyval === KEY_P && (state & CTRL_MASK)) {
                this._openFuzzySearch();
                return true;
            }
            if ((keyval === KEY_PLUS || keyval === 43 || keyval === 61 || keyval === 65451 || keyval === 65455) && (state & CTRL_MASK)) {
                this._zoomIn();
                return true;
            }
            // Zoom out: Ctrl - (multiple keycodes for compatibility)
            if ((keyval === KEY_MINUS || keyval === 45 || keyval === 95 || keyval === 65109 || keyval === 65453) && (state & CTRL_MASK)) {
                this._zoomOut();
                return true;
            }
            // Reset zoom: Ctrl 0
            if (keyval === KEY_0 && (state & CTRL_MASK)) {
                this._zoomReset();
                return true;
            }
            return false;
        });
        this.add_controller(keyController);
    }

    _updateFilenameDisplay() {
        // If a file is already opened, don't change the path
        if (this._currentFilePath) {
            return;
        }

        const title = this._titleEntry.get_text();
        this._currentFilename = FileManager.generateFilename(title);

        const jotDir = FileManager.getJotDirectory();
        this._pathLabel.set_label(GLib.build_filenamev([jotDir, this._currentFilename]));
    }

    _saveNote() {
        const buffer = this._textView.get_buffer();
        const [start, end] = buffer.get_bounds();
        const content = buffer.get_text(start, end, false);

        if (!content.trim()) {
            this._showFeedback('⚠ Nothing to save');
            return;
        }

        const title = this._titleEntry.get_text().trim();
        
        // Check for double-click (within 1 second)
        const currentTime = GLib.get_monotonic_time() / 1000; // Convert to milliseconds
        const timeSinceLastClick = currentTime - this._lastSaveClickTime;
        const isDoubleClick = timeSinceLastClick < 1000;
        this._lastSaveClickTime = currentTime;
        
        // If file exists and not double-click, just save directly
        if (this._currentFilePath && !isDoubleClick) {
            const file = Gio.File.new_for_path(this._currentFilePath);
            this._saveToFile(file, title, content);
            return;
        }
        
        // Show "Save As" dialog for new files or double-click
        this._showSaveAsDialog(title, content);
    }
    
    _showSaveAsDialog(title, content) {
        // Create file save dialog using FileChooserNative
        const dialog = new Gtk.FileChooserNative({
            title: 'Save File',
            action: Gtk.FileChooserAction.SAVE,
            transient_for: this,
            modal: true,
        });
        
        // Set up file filter for text files
        const filter = new Gtk.FileFilter();
        FILE_PATTERNS.forEach(pattern => filter.add_pattern(pattern));
        filter.set_name(FILE_FILTER_NAME);
        dialog.add_filter(filter);
        
        // Set initial folder to Jot directory
        FileManager.ensureJotDirectoryExists();
        const jotDir = FileManager.getJotDirectory();
        dialog.set_current_folder(Gio.File.new_for_path(jotDir));
        
        // Suggest a filename
        const suggestedFilename = this._currentFilename || FileManager.generateFilename(title);
        dialog.set_current_name(suggestedFilename);
        
        // Show the save dialog
        dialog.connect('response', (dialog, response) => {
            if (response === Gtk.ResponseType.ACCEPT) {
                const file = dialog.get_file();
                if (file) {
                    this._saveToFile(file, title, content);
                }
            }
            dialog.destroy();
        });
        
        dialog.show();
    }
    
    _saveToFile(file, title, content) {
        try {
            const now = GLib.DateTime.new_now_local();
            const timestamp = now.format('%Y-%m-%d %H:%M:%S');
            
            let fileContent = '';
            if (title) {
                fileContent = `# ${title}\n\n`;
            }
            fileContent += `*Created: ${timestamp}*\n\n${content}\n`;
            
            const outputStream = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
            outputStream.write_all(fileContent, null);
            outputStream.close(null);
            
            // Update current file info
            this._currentFilePath = file.get_path();
            this._currentFilename = file.get_basename();
            this._pathLabel.set_label(this._currentFilePath);
            
            print(`Note saved to ${this._currentFilePath}`);
            this._showFeedback(`✓ Saved: ${this._currentFilename}`);
        } catch (e) {
            print(`Error writing file: ${e.message}`);
            this._showFeedback(`✗ Error: ${e.message}`);
        }
    }

    _showFeedback(message) {
        // Cancel any pending zoom timeout
        if (this._zoomTimeoutId) {
            GLib.source_remove(this._zoomTimeoutId);
            this._zoomTimeoutId = null;
        }
        
        this._pathLabel.set_label(message);

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, FEEDBACK_TIMEOUT_MS, () => {
            // Restore to actual path, not captured label
            const actualPath = this._currentFilePath || 
                               GLib.build_filenamev([FileManager.getJotDirectory(), this._currentFilename]);
            this._pathLabel.set_label(actualPath);
            return false;
        });
    }

    _zoomIn() {
        this._zoomLevel = Math.min(this._zoomLevel + 10, 300); // Max 300%
        print(`Zoom in called, new level: ${this._zoomLevel}%`);
        this._applyCSS();
        this._showZoomLevel();
    }

    _zoomOut() {
        this._zoomLevel = Math.max(this._zoomLevel - 10, 50); // Min 50%
        print(`Zoom out called, new level: ${this._zoomLevel}%`);
        this._applyCSS();
        this._showZoomLevel();
    }

    _zoomReset() {
        this._zoomLevel = 100;
        print(`Zoom reset called, level: ${this._zoomLevel}%`);
        this._applyCSS();
        this._showZoomLevel();
    }

    _showZoomLevel() {
        // Cancel any existing zoom timeout
        if (this._zoomTimeoutId) {
            GLib.source_remove(this._zoomTimeoutId);
            this._zoomTimeoutId = null;
        }
        
        // Show zoom level
        this._pathLabel.set_label(`Zoom: ${this._zoomLevel}%`);

        // Set timeout to restore the actual path
        this._zoomTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
            // Get the actual current path to restore
            const actualPath = this._currentFilePath || 
                               GLib.build_filenamev([FileManager.getJotDirectory(), this._currentFilename]);
            this._pathLabel.set_label(actualPath);
            this._zoomTimeoutId = null;
            return false;
        });
    }

    _openFileDialog() {
        const dialog = new Gtk.FileDialog();

        const filter = new Gtk.FileFilter();
        FILE_PATTERNS.forEach(pattern => filter.add_pattern(pattern));
        filter.set_name(FILE_FILTER_NAME);

        const filters = Gio.ListStore.new(Gtk.FileFilter);
        filters.append(filter);
        dialog.set_filters(filters);

        const jotDir = FileManager.getJotDirectory();
        const jotFile = Gio.File.new_for_path(jotDir);
        dialog.set_initial_folder(jotFile);

        dialog.open(this, null, (source, result) => {
            try {
                const file = dialog.open_finish(result);
                if (file) {
                    this.loadFile(file);
                }
            } catch (e) {
                if (!e.matches(Gtk.DialogError, Gtk.DialogError.DISMISSED)) {
                    print(`Error opening file: ${e.message}`);
                }
            }
        });
    }

    loadFile(file) {
        try {
            const { title, content, filePath, filename } = FileManager.loadFile(file);

            this._titleEntry.set_text(title);
            const buffer = this._textView.get_buffer();
            buffer.set_text(content, -1);

            this._currentFilename = filename;
            this._currentFilePath = filePath; // Store the full path
            this._pathLabel.set_label(filePath);

            print(`Loaded file: ${filePath}`);
        } catch (e) {
            print(`Error loading file: ${e.message}`);
        }
    }

    _openFuzzySearch() {
        // Scan files from Jot directory
        const jotDir = FileManager.getJotDirectory();
        const allFiles = FuzzySearchManager.scanDirectory(jotDir);

        if (allFiles.length === 0) {
            this._showFeedback('⚠ No files found in Jot directory');
            return;
        }

        // Get highlight color from theme
        const highlightColor = this._themeManager.colors.blue;

        // Create dialog
        const dialog = new Gtk.Window({
            transient_for: this,
            modal: true,
            default_width: 800,
            default_height: 500,
            title: 'Search Files',
        });
        dialog.add_css_class('fuzzy-search-dialog');

        // Main container
        const mainBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 0,
        });

        // Search entry
        const searchEntry = new Gtk.Entry({
            placeholder_text: 'Type to search files and content...',
            hexpand: true,
        });
        searchEntry.add_css_class('fuzzy-search-entry');

        // Content box (results on left, preview on right)
        const contentBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 0,
            vexpand: true,
        });

        // Results list
        const scrolledWindow = new Gtk.ScrolledWindow({
            hexpand: true,
            vexpand: true,
            min_content_width: 350,
        });

        const listBox = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.SINGLE,
        });
        listBox.add_css_class('fuzzy-results-list');
        scrolledWindow.set_child(listBox);

        // Preview pane
        const previewScroll = new Gtk.ScrolledWindow({
            hexpand: true,
            vexpand: true,
        });

        const previewText = new Gtk.TextView({
            editable: false,
            wrap_mode: Gtk.WrapMode.WORD_CHAR,
            left_margin: 12,
            right_margin: 12,
            top_margin: 12,
            bottom_margin: 12,
        });
        previewText.add_css_class('fuzzy-preview');
        previewScroll.set_child(previewText);

        contentBox.append(scrolledWindow);
        contentBox.append(previewScroll);

        mainBox.append(searchEntry);
        mainBox.append(contentBox);
        dialog.set_child(mainBox);

        // Store current results
        let currentResults = allFiles.map(f => ({ ...f, score: 0 }));

        // Function to update results
        const updateResults = () => {
            const query = searchEntry.get_text();
            currentResults = FuzzySearchManager.searchFiles(allFiles, query);

            // Clear existing items
            let child = listBox.get_first_child();
            while (child) {
                const next = child.get_next_sibling();
                listBox.remove(child);
                child = next;
            }

            // Add new results (limit to 100 for performance)
            const displayResults = currentResults.slice(0, 100);
            for (const result of displayResults) {
                const highlightedText = FuzzySearchManager.highlightMatchesWithColor(
                    result.filename,
                    result.matchIndices || [],
                    highlightColor
                );

                const label = new Gtk.Label({
                    xalign: 0,
                });
                label.set_use_markup(true);
                label.set_markup(highlightedText);
                label.add_css_class('fuzzy-result-item');

                const row = new Gtk.ListBoxRow();
                row.set_child(label);
                row._fileData = result; // Store file data
                listBox.append(row);
            }

            // Select first item if available
            if (displayResults.length > 0) {
                listBox.select_row(listBox.get_first_child());
            }
        };

        // Update preview when selection changes
        const updatePreview = () => {
            const selectedRow = listBox.get_selected_row();
            if (selectedRow && selectedRow._fileData) {
                const buffer = previewText.get_buffer();
                const content = selectedRow._fileData.content.substring(0, 5000); // Limit preview size

                // Set the text first
                buffer.set_text(content, -1);

                // Get current search query
                const query = searchEntry.get_text();

                if (query && selectedRow._fileData.contentMatchIndices && selectedRow._fileData.contentMatchIndices.length > 0) {
                    // Create a tag for highlighting
                    const tagTable = buffer.get_tag_table();
                    let highlightTag = tagTable.lookup('highlight');
                    if (!highlightTag) {
                        highlightTag = new Gtk.TextTag({
                            name: 'highlight',
                            foreground: highlightColor,
                            weight: 700, // Bold
                        });
                        tagTable.add(highlightTag);
                    } else {
                        // Remove existing highlights
                        const startIter = buffer.get_start_iter();
                        const endIter = buffer.get_end_iter();
                        buffer.remove_tag(highlightTag, startIter, endIter);
                    }

                    // Apply highlights to matched positions
                    const matchSet = new Set(selectedRow._fileData.contentMatchIndices);
                    for (let i = 0; i < Math.min(content.length, 5000); i++) {
                        if (matchSet.has(i)) {
                            const startIter = buffer.get_iter_at_offset(i);
                            const endIter = buffer.get_iter_at_offset(i + 1);
                            buffer.apply_tag(highlightTag, startIter, endIter);
                        }
                    }
                }
            }
        };

        listBox.connect('row-selected', updatePreview);

        // Handle search input
        searchEntry.connect('changed', () => {
            updateResults();
            updatePreview();
        });

        // Handle Enter key to open file
        const searchKeyController = new Gtk.EventControllerKey();
        searchKeyController.connect('key-pressed', (controller, keyval, keycode, state) => {
            if (keyval === KEY_ENTER) {
                const selectedRow = listBox.get_selected_row();
                if (selectedRow && selectedRow._fileData) {
                    const file = Gio.File.new_for_path(selectedRow._fileData.filepath);
                    this.loadFile(file);
                    dialog.close();
                }
                return true;
            }
            if (keyval === KEY_ESCAPE) {
                dialog.close();
                return true;
            }
            // Arrow down - move to list
            if (keyval === 65364) { // Down arrow
                const firstRow = listBox.get_first_child();
                if (firstRow) {
                    listBox.select_row(firstRow);
                    firstRow.grab_focus();
                }
                return true;
            }
            return false;
        });
        searchEntry.add_controller(searchKeyController);

        // Handle keyboard navigation in list
        const listKeyController = new Gtk.EventControllerKey();
        listKeyController.connect('key-pressed', (controller, keyval, keycode, state) => {
            if (keyval === KEY_ENTER) {
                const selectedRow = listBox.get_selected_row();
                if (selectedRow && selectedRow._fileData) {
                    const file = Gio.File.new_for_path(selectedRow._fileData.filepath);
                    this.loadFile(file);
                    dialog.close();
                }
                return true;
            }
            if (keyval === KEY_ESCAPE) {
                dialog.close();
                return true;
            }
            return false;
        });
        listBox.add_controller(listKeyController);

        // Initial population
        updateResults();

        // Show dialog and focus search entry
        dialog.present();
        searchEntry.grab_focus();
    }
});

// ============================================================================
// Entry Point
// ============================================================================

const app = new JotApplication();
app.run([imports.system.programInvocationName].concat(ARGV));
