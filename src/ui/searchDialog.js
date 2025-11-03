// ============================================================================
// SEARCH DIALOG
// ============================================================================

const { Gtk, Gio } = imports.gi;
const Constants = imports.src.constants.defaults;
const FileService = imports.src.services.fileService.FileService;
const SearchService = imports.src.services.searchService.SearchService;

/**
 * Fuzzy search dialog component
 * Provides file search with preview
 */
var SearchDialogBuilder = class SearchDialogBuilder {
    /**
     * Create and show the search dialog
     * @param {Gtk.Window} parent - Parent window
     * @param {string} highlightColor - Color for highlighting matches
     * @param {Function} onFileSelected - Callback when file is selected
     */
    static show(parent, highlightColor, onFileSelected) {
        // Scan files from Jot directory
        const jotDir = FileService.getJotDirectory();
        const allFiles = FileService.scanDirectory(jotDir);

        if (allFiles.length === 0) {
            return { success: false, message: '⚠ No files found in Jot directory' };
        }

        // Create dialog
        const dialog = new Gtk.Window({
            transient_for: parent,
            modal: true,
            default_width: Constants.UI.SEARCH_DIALOG_WIDTH,
            default_height: Constants.UI.SEARCH_DIALOG_HEIGHT,
            title: 'Search Files',
        });
        dialog.add_css_class('fuzzy-search-dialog');

        // Build UI
        const { mainBox, searchEntry, listBox, previewText } = this._buildUI();
        dialog.set_child(mainBox);

        // Store current results
        let currentResults = allFiles.map(f => ({ ...f, score: 0, matchIndices: [], contentMatchIndices: [] }));

        // Update results function
        const updateResults = () => {
            const query = searchEntry.get_text();
            currentResults = SearchService.searchFiles(allFiles, query);

            // Clear existing items
            let child = listBox.get_first_child();
            while (child) {
                const next = child.get_next_sibling();
                listBox.remove(child);
                child = next;
            }

            // Add new results
            const displayResults = currentResults.slice(0, Constants.MAX_SEARCH_RESULTS);
            for (const result of displayResults) {
                const highlightedText = SearchService.highlightMatchesWithColor(
                    result.filename,
                    result.matchIndices || [],
                    highlightColor
                );

                const label = new Gtk.Label({ xalign: 0 });
                label.set_use_markup(true);
                label.set_markup(highlightedText);
                label.add_css_class('fuzzy-result-item');

                const row = new Gtk.ListBoxRow();
                row.set_child(label);
                row._fileData = result;
                listBox.append(row);
            }

            // Select first item
            if (displayResults.length > 0) {
                listBox.select_row(listBox.get_first_child());
            }
        };

        // Update preview function
        const updatePreview = () => {
            const selectedRow = listBox.get_selected_row();
            if (selectedRow && selectedRow._fileData) {
                const buffer = previewText.get_buffer();
                const content = selectedRow._fileData.content.substring(0, Constants.MAX_PREVIEW_SIZE);

                // Set the text first
                buffer.set_text(content, -1);

                // Get current search query
                const query = searchEntry.get_text();

                if (query && selectedRow._fileData.contentMatchIndices &&
                    selectedRow._fileData.contentMatchIndices.length > 0) {
                    // Create a tag for highlighting
                    const tagTable = buffer.get_tag_table();
                    let highlightTag = tagTable.lookup('highlight');
                    if (!highlightTag) {
                        highlightTag = new Gtk.TextTag({
                            name: 'highlight',
                            foreground: highlightColor,
                            weight: 700,
                        });
                        tagTable.add(highlightTag);
                    } else {
                        // Remove existing highlights
                        const startIter = buffer.get_start_iter();
                        const endIter = buffer.get_end_iter();
                        buffer.remove_tag(highlightTag, startIter, endIter);
                    }

                    // Apply highlights
                    const matchSet = new Set(selectedRow._fileData.contentMatchIndices);
                    for (let i = 0; i < Math.min(content.length, Constants.MAX_PREVIEW_SIZE); i++) {
                        if (matchSet.has(i)) {
                            const startIter = buffer.get_iter_at_offset(i);
                            const endIter = buffer.get_iter_at_offset(i + 1);
                            buffer.apply_tag(highlightTag, startIter, endIter);
                        }
                    }
                }
            }
        };

        // Connect events
        listBox.connect('row-selected', updatePreview);
        searchEntry.connect('changed', () => {
            updateResults();
            updatePreview();
        });

        // Handle file selection
        const openSelectedFile = () => {
            const selectedRow = listBox.get_selected_row();
            if (selectedRow && selectedRow._fileData) {
                const file = Gio.File.new_for_path(selectedRow._fileData.filepath);
                onFileSelected(file);
                dialog.close();
            }
        };

        // Keyboard handlers
        this._setupKeyboardHandlers(searchEntry, listBox, openSelectedFile, () => dialog.close());

        // Initial population
        updateResults();

        // Show dialog
        dialog.present();
        searchEntry.grab_focus();

        return { success: true };
    }

    /**
     * Build the dialog UI
     * @private
     */
    static _buildUI() {
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

        // Content box
        const contentBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 0,
            vexpand: true,
        });

        // Results list
        const scrolledWindow = new Gtk.ScrolledWindow({
            hexpand: true,
            vexpand: true,
            min_content_width: Constants.UI.MIN_FILE_LIST_WIDTH,
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

        return { mainBox, searchEntry, listBox, previewText };
    }

    /**
     * Setup keyboard event handlers
     * @private
     */
    static _setupKeyboardHandlers(searchEntry, listBox, onEnter, onEscape) {
        // Search entry handlers
        const searchKeyController = new Gtk.EventControllerKey();
        searchKeyController.connect('key-pressed', (controller, keyval, keycode, state) => {
            if (keyval === Constants.Keys.ENTER) {
                onEnter();
                return true;
            }
            if (keyval === Constants.Keys.ESCAPE) {
                onEscape();
                return true;
            }
            if (keyval === Constants.Keys.DOWN) {
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

        // List box handlers
        const listKeyController = new Gtk.EventControllerKey();
        listKeyController.connect('key-pressed', (controller, keyval, keycode, state) => {
            if (keyval === Constants.Keys.ENTER) {
                onEnter();
                return true;
            }
            if (keyval === Constants.Keys.ESCAPE) {
                onEscape();
                return true;
            }
            return false;
        });
        listBox.add_controller(listKeyController);
    }
};
