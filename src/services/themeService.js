// ============================================================================
// THEME SERVICE
// ============================================================================

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Constants from '../constants/defaults.js';

/**
 * Service for managing application theme colors
 * Loads colors from Alacritty theme configuration
 */
export class ThemeService {
    constructor() {
        this.colors = this._loadColors();
        this.monitor = null;
    }

    /**
     * Get the full path to the theme configuration file
     */
    _getThemePath() {
        const homeDir = GLib.get_home_dir();
        return GLib.build_filenamev([homeDir, ...Constants.THEME_PATH]);
    }

    /**
     * Load colors from theme file
     */
    _loadColors() {
        try {
            const themePath = this._getThemePath();
            const file = Gio.File.new_for_path(themePath);
            const [success, contents] = file.load_contents(null);

            if (!success) {
                print(`Theme file not found at: ${themePath}`);
                return { ...Constants.DEFAULT_THEME };
            }

            const parsedColors = this._parseTomlColors(new TextDecoder().decode(contents));
            return parsedColors;
        } catch (e) {
            print(`Failed to load theme: ${e.message}`);
            return { ...Constants.DEFAULT_THEME };
        }
    }

    /**
     * Parse TOML theme file and extract colors
     */
    _parseTomlColors(text) {
        const colors = {};
        const lines = text.split('\n');
        let currentSection = '';

        for (const line of lines) {
            // Handle both [colors.primary] and [colors.normal] formats
            const sectionMatch = line.match(/^\[colors(?:\.(\w+))?\]/);
            if (sectionMatch) {
                currentSection = sectionMatch[1] || '';
                continue;
            }

            const match = line.match(/^(\w+)\s*=\s*["']([^"']+)["']/);
            if (match) {
                const [, key, value] = match;
                // Only parse colors from relevant sections
                if (currentSection === 'normal' || currentSection === 'primary' || currentSection === 'cursor' || currentSection === '') {
                    colors[key] = value;
                }
            }
        }

        // Debug: print what we found
        // print(`Parsed colors: ${JSON.stringify(colors)}`);

        return {
            background: colors.background || Constants.DEFAULT_THEME.background,
            foreground: colors.foreground || Constants.DEFAULT_THEME.foreground,
            cursor: colors.cursor || Constants.DEFAULT_THEME.cursor,
            black: colors.black || Constants.DEFAULT_THEME.black,
            red: colors.red || Constants.DEFAULT_THEME.red,
            green: colors.green || Constants.DEFAULT_THEME.green,
            yellow: colors.yellow || Constants.DEFAULT_THEME.yellow,
            blue: colors.blue || Constants.DEFAULT_THEME.blue,
            magenta: colors.magenta || Constants.DEFAULT_THEME.magenta,
            cyan: colors.cyan || Constants.DEFAULT_THEME.cyan,
            white: colors.white || Constants.DEFAULT_THEME.white,
        };
    }

    /**
     * Setup file monitor to watch for theme changes
     * @param {Function} callback - Function to call when theme changes
     */
    setupMonitor(callback) {
        try {
            const themePath = this._getThemePath();
            const file = Gio.File.new_for_path(themePath);
            this.monitor = file.monitor_file(Gio.FileMonitorFlags.NONE, null);
            this.monitor.connect('changed', (monitor, file, other_file, event_type) => {
                // Only reload on actual file changes (modified, created, etc.)
                if (event_type === Gio.FileMonitorEvent.CHANGED ||
                    event_type === Gio.FileMonitorEvent.CREATED ||
                    event_type === Gio.FileMonitorEvent.DELETED) {
                    this.colors = this._loadColors();
                    callback();
                }
            });
        } catch (e) {
            print(`Failed to setup theme monitor: ${e.message}`);
        }
    }

    /**
     * Generate CSS from current theme colors
     * @param {number} zoomLevel - Zoom level percentage (default 100)
     */
    generateCSS(zoomLevel = 100) {
        const c = this.colors;
        const zoom = zoomLevel / 100;
        return `
            window {
                background: ${c.background};
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
                border: 1px solid ${c.foreground};
                background: ${c.background};
                color: ${c.foreground};
                font-weight: 500;
                font-size: 11px;
            }

            .jot-button:hover {
                background: ${c.foreground};
                color: ${c.background};
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
                border-top: 1px solid ${c.foreground};
                padding-top: 10px;
            }

            .status-label {
                color: ${c.foreground};
                font-size: 12px;
            }

            .jot-hash {
                color: ${c.foreground};
                font-size: ${18 * zoom}px;
                font-weight: bold;
                font-family: 'JetBrains Mono', 'Fira Code', 'Source Code Pro', 'DejaVu Sans Mono', 'Courier New', monospace;
                margin-right: 8px;
            }

            .jot-title {
                background: transparent;
                border: none;
                color: ${c.foreground};
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
                border: 1px solid ${c.foreground};
                background: ${c.background};
                color: ${c.foreground};
                font-weight: 500;
                font-size: 11px;
            }

            .jot-open-button:hover {
                background: ${c.foreground};
                color: ${c.background};
            }

            .fuzzy-search-dialog {
                background: ${c.background};
                border: 1px solid ${c.foreground};
            }

            .fuzzy-search-entry {
                background: ${c.background};
                color: ${c.foreground};
                border: none;
                border-bottom: 1px solid ${c.foreground};
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
                background: ${c.background};
            }

            .fuzzy-result-item {
                padding: 8px 12px;
                font-size: ${13 * zoom}px;
                font-family: 'JetBrains Mono', 'Fira Code', 'Source Code Pro', 'DejaVu Sans Mono', 'Courier New', monospace;
            }

            .fuzzy-result-item label {
                color: ${c.foreground};
            }

            .fuzzy-result-item:selected {
                background: ${c.blue};
                color: ${c.foreground};
            }

            .fuzzy-result-item:hover {
                background: ${c.blue};
            }

            .fuzzy-preview {
                background: ${c.background};
                color: ${c.foreground};
                border-left: 1px solid ${c.foreground};
                padding: 12px;
                font-size: ${12 * zoom}px;
                font-family: 'JetBrains Mono', 'Fira Code', 'Source Code Pro', 'DejaVu Sans Mono', 'Courier New', monospace;
            }

            .jot-recovery-dialog{
               background: ${c.background};
               color: ${c.foreground};
            }
            .jot-recovery-dialog button {
                padding: 4px 12px;
                border-radius: 0;
                border: 1px solid ${c.foreground};
                background: ${c.background};
                color: ${c.foreground};
                font-weight: 500;
                font-size: 11px;
            }
            .jot-recovery-dialog button.destructive-action {
                background: ${c.background};
                color: ${c.foreground};
            }
            .jot-recovery-dialog button.suggested-action {
                background: ${c.green};
                border-color: ${c.green};
                color: ${c.background};
            }
        `;
    }
}
