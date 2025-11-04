#!/usr/bin/env -S gjs -m

import 'gi://Gtk?version=4.0';
import 'gi://Adw?version=1';

import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import System from 'system';

// Improved symlink resolution using query_info and get_symlink_target
function getScriptDirectory() {
    const scriptPath = System.programInvocationName;

    let file = Gio.File.new_for_commandline_arg(scriptPath);
    let realScriptPath = scriptPath;
    let info = null;

    try {
        // Query file info without following symlinks
        info = file.query_info('*', Gio.FileQueryInfoFlags.NONE, null);
    } catch (e) {
        print(`Error querying file info: ${e.message}`);
    }

    if (info) {
        const symlinkTarget = info.get_symlink_target();
        if (symlinkTarget) {
            realScriptPath = symlinkTarget;

            // If target is relative, resolve against symlink's parent dir
            if (!GLib.path_is_absolute(realScriptPath)) {
                const parentPath = file.get_parent()?.get_path() || '/';
                realScriptPath = GLib.build_filename(parentPath, realScriptPath);
            }
        } else {
            // Fallback: Use the original path
            realScriptPath = file.get_path();
        }
    } else {
        print(`No file info available, using raw scriptPath`);
    }

    const scriptDir = GLib.path_get_dirname(realScriptPath);
    return scriptDir;
}

// ============================================================================
// ENTRY POINT (FULLY SCOPED WITHIN ASYNC IIFE)
// ============================================================================

(async () => {
    try {
        const scriptDir = getScriptDirectory();
        GLib.chdir(scriptDir);  // Set CWD to project root for any relative ops

        // Dynamic imports with try/catch to handle failures explicitly
        let Constants, ThemeService, FileService, SearchDialogBuilder, CacheService;
        try {
            // Ensure paths are absolute file:// URIs
            const constantsModule = await import(`file://${scriptDir}/src/constants/defaults.js`);
            Constants = constantsModule;

            const themeModule = await import(`file://${scriptDir}/src/services/themeService.js`);
            ({ ThemeService } = themeModule);

            const fileModule = await import(`file://${scriptDir}/src/services/fileService.js`);
            ({ FileService } = fileModule);

            const searchModule = await import(`file://${scriptDir}/src/ui/searchDialog.js`);
            ({ SearchDialogBuilder } = searchModule);

            const cacheModule = await import(`file://${scriptDir}/src/services/cacheService.js`);
            ({ CacheService } = cacheModule);
        } catch (e) {
            print(`FATAL: Failed to import module: ${e.message}`);
            throw e;
        }

        // ============================================================================
        // APPLICATION CLASS (DEFINED HERE, IN SCOPE WITH IMPORTS)
        // ============================================================================

        /**
         * Main application class
         * Manages application lifecycle and window creation
         */
        class JotApplication extends Adw.Application {
            constructor() {
                super({
                    application_id: Constants.APP_ID,
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
        }

        GObject.registerClass(JotApplication);

        // ============================================================================
        // MAIN WINDOW CLASS (DEFINED HERE, IN SCOPE WITH IMPORTS)
        // ============================================================================

        /**
         * Main application window
         * Provides note editing interface
         */
        class JotWindow extends Adw.ApplicationWindow {
            constructor(application) {
                super({
                    application,
                    title: Constants.APP_TITLE,
                    default_width: Constants.UI.DEFAULT_WIDTH,
                    default_height: Constants.UI.DEFAULT_HEIGHT,
                });

                // Initialize all instance variables immediately after super._init
                this._autoSaveTimeoutId = null;
                this._hasUnsavedChanges = false;

                // Initialize state
                this._state = {
                    currentFilename: 'untitled.md',
                    currentFilePath: null,
                    lastSaveClickTime: 0,
                    zoomLevel: Constants.Zoom.DEFAULT,
                    zoomTimeoutId: null,
                    autoSaveTimeoutId: null,
                };

                this._themeManager = new ThemeService();

                this._initializeUI();
                this._setupTheme();
                this._setupKeyboardShortcuts();

                // Check for cached content on startup
                const cache = CacheService.loadCache();
                if (cache && (cache.title || cache.content.trim())) {
                    this._showCacheRecoveryDialog(cache);
                } else {
                    this._titleEntry.grab_focus();
                    this._startAutoSave();
                }
            }

            // ========================================================================
            // UI INITIALIZATION
            // ========================================================================

            _initializeUI() {
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
                    margin_start: Constants.UI.TITLE_MARGIN,
                    margin_end: Constants.UI.TITLE_MARGIN,
                    margin_top: Constants.UI.TITLE_MARGIN,
                    margin_bottom: 0,
                });

                const hashLabel = new Gtk.Label({
                    label: '#',
                    halign: Gtk.Align.START
                });
                hashLabel.add_css_class('jot-hash');

                this._titleEntry = new Gtk.Entry({
                    placeholder_text: 'Title',
                    hexpand: true,
                });
                this._titleEntry.add_css_class('jot-title');
                this._titleEntry.connect('changed', () => this._updateFilenameDisplay());
                this._titleEntry.connect('activate', () => this._textView.grab_focus());

                titleBox.append(hashLabel);
                titleBox.append(this._titleEntry);

                return titleBox;
            }

            _createTextView() {
                this._textView = new Gtk.TextView({
                    wrap_mode: Gtk.WrapMode.WORD_CHAR,
                    vexpand: true,
                    hexpand: true,
                    left_margin: Constants.UI.TEXT_MARGIN,
                    right_margin: Constants.UI.TEXT_MARGIN,
                    top_margin: 12,
                    bottom_margin: Constants.UI.TEXT_MARGIN,
                });
                this._textView.add_css_class('jot-textview');

                return new Gtk.ScrolledWindow({
                    child: this._textView,
                    vexpand: true,
                    hexpand: true,
                });
            }

            _createStatusBar() {
                this._statusBar = new Gtk.Box({
                    orientation: Gtk.Orientation.HORIZONTAL,
                    spacing: 16,
                    height_request: 36,
                    margin_start: Constants.UI.STATUS_MARGIN,
                    margin_end: Constants.UI.STATUS_MARGIN,
                    margin_top: 8,
                    margin_bottom: 8,
                });
                this._statusBar.add_css_class('jot-statusbar');

                const jotDir = FileService.getJotDirectory();
                this._pathLabel = new Gtk.Label({
                    label: GLib.build_filenamev([jotDir, this._state.currentFilename]),
                    halign: Gtk.Align.START,
                    hexpand: true,
                    ellipsize: 3,
                });
                this._pathLabel.add_css_class('status-label');

                this._statusBar.append(this._pathLabel);
                this._statusBar.append(this._createButtonBox());

                return this._statusBar;
            }

            _createButtonBox() {
                const buttonBox = new Gtk.Box({
                    orientation: Gtk.Orientation.HORIZONTAL,
                    spacing: 8,
                    halign: Gtk.Align.END,
                });

                const buttons = [
                    { label: 'Open', class: 'jot-open-button', handler: () => this._openFileDialog() },
                    { label: 'Cancel', class: 'jot-button', handler: () => this.close() },
                    { label: 'Save', class: 'jot-button-save', handler: () => this._handleSave() },
                ];

                buttons.forEach(({ label, class: cssClass, handler }) => {
                    const button = new Gtk.Button({ label });
                    button.add_css_class('jot-button');
                    if (cssClass !== 'jot-button') {
                        button.add_css_class(cssClass);
                    }
                    button.connect('clicked', handler);
                    buttonBox.append(button);
                });

                return buttonBox;
            }

            // ========================================================================
            // THEME MANAGEMENT
            // ========================================================================

            _setupTheme() {
                this._applyCSS();
                this._themeManager.setupMonitor(() => this._applyCSS());
            }

            _applyCSS() {
                const cssProvider = new Gtk.CssProvider();
                const css = this._themeManager.generateCSS(this._state.zoomLevel);
                cssProvider.load_from_data(css, -1);
                Gtk.StyleContext.add_provider_for_display(
                    this.get_display(),
                    cssProvider,
                    Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
                );
            }

            // ========================================================================
            // KEYBOARD SHORTCUTS
            // ========================================================================

            _setupKeyboardShortcuts() {
                const keyController = new Gtk.EventControllerKey();
                keyController.connect('key-pressed', (controller, keyval, keycode, state) => {
                    return this._handleKeyPress(keyval, state);
                });
                this.add_controller(keyController);
            }

            _handleKeyPress(keyval, state) {
                const isCtrl = state & Constants.Keys.CTRL_MASK;

                // Basic shortcuts
                if (keyval === Constants.Keys.ESCAPE) {
                    this.close();
                    return true;
                }

                if (!isCtrl) return false;

                // Ctrl+key shortcuts
                const shortcuts = {
                    [Constants.Keys.ENTER]: () => this._handleSave(),
                    [Constants.Keys.S]: () => this._handleSave(),
                    [Constants.Keys.P]: () => this._openFuzzySearch(),
                    [Constants.Keys.ZERO]: () => this._zoomReset(),
                };

                // Handle plus/minus with multiple keycodes
                const plusKeys = [Constants.Keys.PLUS, 43, 61, 65451, 65455];
                const minusKeys = [Constants.Keys.MINUS, 45, 95, 65109, 65453];

                if (plusKeys.includes(keyval)) {
                    this._zoomIn();
                    return true;
                }

                if (minusKeys.includes(keyval)) {
                    this._zoomOut();
                    return true;
                }

                if (shortcuts[keyval]) {
                    shortcuts[keyval]();
                    return true;
                }

                return false;
            }

            // ========================================================================
            // FILE OPERATIONS
            // ========================================================================

            _updateFilenameDisplay() {
                if (this._state.currentFilePath) return;

                const title = this._titleEntry.get_text();
                this._state.currentFilename = FileService.generateFilename(title);

                const jotDir = FileService.getJotDirectory();
                this._pathLabel.set_label(
                    GLib.build_filenamev([jotDir, this._state.currentFilename])
                );
            }

            _handleSave() {
                const buffer = this._textView.get_buffer();
                const [start, end] = buffer.get_bounds();
                const content = buffer.get_text(start, end, false);

                if (!content.trim()) {
                    this._showFeedback('⚠ Nothing to save');
                    return;
                }

                const title = this._titleEntry.get_text().trim();

                // Check for double-click (Save As)
                const currentTime = GLib.get_monotonic_time() / 1000;
                const timeSinceLastClick = currentTime - this._state.lastSaveClickTime;
                const isDoubleClick = timeSinceLastClick < 1000;
                this._state.lastSaveClickTime = currentTime;

                if (this._state.currentFilePath && !isDoubleClick) {
                    const file = Gio.File.new_for_path(this._state.currentFilePath);
                    this._saveToFile(file, title, content);
                } else {
                    this._showSaveAsDialog(title, content);
                }
            }

            _showSaveAsDialog(title, content) {
                const dialog = new Gtk.FileChooserNative({
                    title: 'Save File',
                    action: Gtk.FileChooserAction.SAVE,
                    transient_for: this,
                    modal: true,
                });

                const filter = new Gtk.FileFilter();
                Constants.FILE_PATTERNS.forEach(pattern => filter.add_pattern(pattern));
                filter.set_name(Constants.FILE_FILTER_NAME);
                dialog.add_filter(filter);

                FileService.ensureJotDirectoryExists();
                const jotDir = FileService.getJotDirectory();
                dialog.set_current_folder(Gio.File.new_for_path(jotDir));
                dialog.set_current_name(
                    this._state.currentFilename || FileService.generateFilename(title)
                );

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
                const result = FileService.saveToFile(file, title, content);

                if (result.success) {
                    this._state.currentFilePath = result.path;
                    this._state.currentFilename = result.filename;
                    this._pathLabel.set_label(this._state.currentFilePath);

                    print(`Note saved to ${this._state.currentFilePath}`);
                    this._showFeedback(`✓ Saved: ${this._state.currentFilename}`);

                    // Clear cache and reset unsaved changes flag after successful save
                    CacheService.clearCache();
                    this._hasUnsavedChanges = false;
                } else {
                    print(`Error writing file: ${result.error}`);
                    this._showFeedback(`✗ Error: ${result.error}`);
                }
            }

            _openFileDialog() {
                const dialog = new Gtk.FileDialog();

                const filter = new Gtk.FileFilter();
                Constants.FILE_PATTERNS.forEach(pattern => filter.add_pattern(pattern));
                filter.set_name(Constants.FILE_FILTER_NAME);

                const filters = Gio.ListStore.new(Gtk.FileFilter);
                filters.append(filter);
                dialog.set_filters(filters);

                const jotDir = FileService.getJotDirectory();
                dialog.set_initial_folder(Gio.File.new_for_path(jotDir));

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
                    const { title, content, filePath, filename } = FileService.loadFile(file);

                    this._titleEntry.set_text(title);
                    const buffer = this._textView.get_buffer();
                    buffer.set_text(content, -1);

                    this._state.currentFilename = filename;
                    this._state.currentFilePath = filePath;
                    this._pathLabel.set_label(filePath);

                    print(`Loaded file: ${filePath}`);
                } catch (e) {
                    print(`Error loading file: ${e.message}`);
                }
            }

            // ========================================================================
            // AUTO-SAVE & CACHE RECOVERY
            // ========================================================================

            _startAutoSave() {
                // Cancel any existing auto-save timer
                if (this._state.autoSaveTimeoutId) {
                    GLib.source_remove(this._state.autoSaveTimeoutId);
                    this._state.autoSaveTimeoutId = null;
                }

                // Auto-save every 3 seconds
                this._state.autoSaveTimeoutId = GLib.timeout_add_seconds(
                    GLib.PRIORITY_DEFAULT,
                    Constants.AUTOSAVE_INTERVAL_SEC,
                    () => {
                        if (this._hasUnsavedChanges) {
                            const title = this._titleEntry.get_text().trim();
                            const buffer = this._textView.get_buffer();
                            const [start, end] = buffer.get_bounds();
                            const content = buffer.get_text(start, end, false);

                            // Only cache if there's actual content
                            if (content.trim()) {
                                CacheService.saveCache(title, content);
                                print('Auto-saved to cache');
                            }
                        }
                        return true;
                    }
                );

                const buffer = this._textView.get_buffer();
                buffer.connect('changed', () => {
                    this._hasUnsavedChanges = true;
                });

                // Track changes in title entry
                this._titleEntry.connect('changed', () => {
                    this._hasUnsavedChanges = true;
                });
            }

            _stopAutoSave() {
                if (this._state.autoSaveTimeoutId) {
                    GLib.source_remove(this._state.autoSaveTimeoutId);
                    this._state.autoSaveTimeoutId = null;
                }
            }

            _showCacheRecoveryDialog(cache) {
                const dialog = new Adw.MessageDialog({
                    transient_for: this,
                    modal: true,
                    heading: 'Recover Unsaved Work?',
                    body: 'You have unsaved work from a previous session. Would you like to recover it?',
                });

                dialog.add_css_class('jot-recovery-dialog');

                dialog.add_response('discard', 'Create New');
                dialog.add_response('recover', 'Recover');
                dialog.set_response_appearance('discard', Adw.ResponseAppearance.DESTRUCTIVE);
                dialog.set_response_appearance('recover', Adw.ResponseAppearance.SUGGESTED);
                dialog.set_default_response('recover');

                dialog.connect('response', (dialog, response) => {
                    if (response === 'recover') {
                        // Load cached content
                        this._titleEntry.set_text(cache.title || '');
                        const buffer = this._textView.get_buffer();
                        buffer.set_text(cache.content || '', -1);
                        this._hasUnsavedChanges = true;
                        print('Cache recovered');
                    } else {
                        CacheService.clearCache();
                        print('Cache discarded');
                    }

                    this._titleEntry.grab_focus();
                    this._startAutoSave();
                    dialog.close();
                });

                dialog.present();
            }

            // ========================================================================
            // FUZZY SEARCH
            // ========================================================================

            _openFuzzySearch() {
                const result = SearchDialogBuilder.show(
                    this,
                    this._themeManager.colors.blue,
                    (file) => this.loadFile(file)
                );

                if (!result.success) {
                    this._showFeedback(result.message);
                }
            }

            // ========================================================================
            // ZOOM CONTROLS
            // ========================================================================

            _zoomIn() {
                this._state.zoomLevel = Math.min(this._state.zoomLevel + Constants.Zoom.STEP, Constants.Zoom.MAX);
                this._applyCSS();
                this._showZoomLevel();
            }

            _zoomOut() {
                this._state.zoomLevel = Math.max(this._state.zoomLevel - Constants.Zoom.STEP, Constants.Zoom.MIN);
                this._applyCSS();
                this._showZoomLevel();
            }

            _zoomReset() {
                this._state.zoomLevel = Constants.Zoom.DEFAULT;
                this._applyCSS();
                this._showZoomLevel();
            }

            _showZoomLevel() {
                if (this._state.zoomTimeoutId) {
                    GLib.source_remove(this._state.zoomTimeoutId);
                    this._state.zoomTimeoutId = null;
                }

                this._pathLabel.set_label(`Zoom: ${this._state.zoomLevel}%`);

                this._state.zoomTimeoutId = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    Constants.ZOOM_DISPLAY_MS,
                    () => {
                        const actualPath = this._state.currentFilePath ||
                            GLib.build_filenamev([
                                FileService.getJotDirectory(),
                                this._state.currentFilename
                            ]);
                        this._pathLabel.set_label(actualPath);
                        this._state.zoomTimeoutId = null;
                        return false;
                    }
                );
            }

            // ========================================================================
            // UI FEEDBACK
            // ========================================================================

            _showFeedback(message) {
                if (this._state.zoomTimeoutId) {
                    GLib.source_remove(this._state.zoomTimeoutId);
                    this._state.zoomTimeoutId = null;
                }

                this._pathLabel.set_label(message);

                GLib.timeout_add(GLib.PRIORITY_DEFAULT, Constants.FEEDBACK_TIMEOUT_MS, () => {
                    const actualPath = this._state.currentFilePath ||
                        GLib.build_filenamev([
                            FileService.getJotDirectory(),
                            this._state.currentFilename
                        ]);
                    this._pathLabel.set_label(actualPath);
                    return false;
                });
            }

            vfunc_close_request() {
                // Stop auto-save when window closes
                this._stopAutoSave();

                // Cache remains for recovery if not explicitly saved
                // Will auto-expire after 5 minutes

                return false; // Allow window to close
            }
        }

        GObject.registerClass(JotWindow);

        // Now safe to create and run the app (constructors reference these in scope)
        const app = new JotApplication();
        app.run([System.programInvocationName].concat(ARGV));
    } catch (e) {
        print(`FATAL ERROR during app startup: ${e.message}`);
        print(e.stack || 'No stack trace available');
        // Exit cleanly
        System.exit(1);
    }
})();