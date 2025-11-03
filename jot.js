#!/usr/bin/env gjs

imports.gi.versions.Gtk = '4.0';
imports.gi.versions.Adw = '1';

const { Gtk, Gio, GLib, Adw, GObject } = imports.gi;

// Import our modules
imports.searchPath.unshift('.');
const Constants = imports.src.constants.defaults;
const ThemeService = imports.src.services.themeService.ThemeService;
const FileService = imports.src.services.fileService.FileService;
const SearchService = imports.src.services.searchService.SearchService;
const SearchDialogBuilder = imports.src.ui.searchDialog.SearchDialogBuilder;

// ============================================================================
// APPLICATION
// ============================================================================

/**
 * Main application class
 * Manages application lifecycle and window creation
 */
const JotApplication = GObject.registerClass(
class JotApplication extends Adw.Application {
    _init() {
        super._init({
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
});

// ============================================================================
// MAIN WINDOW
// ============================================================================

/**
 * Main application window
 * Provides note editing interface
 */
const JotWindow = GObject.registerClass(
class JotWindow extends Adw.ApplicationWindow {
    _init(application) {
        super._init({
            application,
            title: Constants.APP_TITLE,
            default_width: Constants.UI.DEFAULT_WIDTH,
            default_height: Constants.UI.DEFAULT_HEIGHT,
        });

        // Initialize state
        this._state = {
            currentFilename: 'untitled.md',
            currentFilePath: null,
            lastSaveClickTime: 0,
            zoomLevel: Constants.Zoom.DEFAULT,
            zoomTimeoutId: null,
        };

        this._themeManager = new ThemeService();

        this._initializeUI();
        this._setupTheme();
        this._setupKeyboardShortcuts();

        this._titleEntry.grab_focus();
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
});

// ============================================================================
// ENTRY POINT
// ============================================================================

const app = new JotApplication();
app.run([imports.system.programInvocationName].concat(ARGV));
