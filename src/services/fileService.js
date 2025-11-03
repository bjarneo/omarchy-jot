// ============================================================================
// FILE SERVICE
// ============================================================================

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Constants from '../constants/defaults.js';

/**
 * Service for file operations
 * Handles reading, writing, and parsing markdown files
 */
export class FileService {
    /**
     * Get the Jot directory path
     */
    static getJotDirectory() {
        const homeDir = GLib.get_home_dir();
        return GLib.build_filenamev([homeDir, ...Constants.JOT_DIR]);
    }

    /**
     * Ensure the Jot directory exists
     */
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

    /**
     * Normalize a title to a valid filename
     * @param {string} title - The title to normalize
     */
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

    /**
     * Generate a filename from a title or create timestamp-based name
     * @param {string} title - Optional title
     */
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

    /**
     * Save a note to the Jot directory
     * @param {string} title - Note title
     * @param {string} content - Note content
     */
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

    /**
     * Load a file and parse its content
     * @param {Gio.File} file - File to load
     */
    static loadFile(file) {
        const [success, contents] = file.load_contents(null);
        if (!success) {
            throw new Error('Failed to load file');
        }

        const text = new TextDecoder().decode(contents);
        return this.parseFileContent(text, file);
    }

    /**
     * Parse markdown file content
     * Extracts title and content, skipping metadata
     * @param {string} text - File content
     * @param {Gio.File} file - File object
     */
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

    /**
     * Scan directory for text files
     * @param {string} dirPath - Directory path to scan
     */
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

    /**
     * Save content to a specific file
     * @param {Gio.File} file - File to save to
     * @param {string} title - Optional title
     * @param {string} content - Content to save
     */
    static saveToFile(file, title, content) {
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

            return {
                success: true,
                path: file.get_path(),
                filename: file.get_basename(),
            };
        } catch (e) {
            return {
                success: false,
                error: e.message,
            };
        }
    }
}
