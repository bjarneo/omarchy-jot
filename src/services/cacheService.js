import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

// Cache configuration
const CACHE_PATH = ['.cache', 'jot'];
const CACHE_FILE = 'autosave.json';
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export class CacheService {
    static getCachePath() {
        const homeDir = GLib.get_home_dir();
        const cacheDir = GLib.build_filenamev([homeDir, ...CACHE_PATH]);
        return {
            dir: cacheDir,
            file: GLib.build_filenamev([cacheDir, CACHE_FILE])
        };
    }

    static ensureCacheDirectoryExists() {
        const { dir } = this.getCachePath();
        const cacheDirFile = Gio.File.new_for_path(dir);

        try {
            cacheDirFile.make_directory_with_parents(null);
        } catch (e) {
            if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS)) {
                print(`Error creating cache directory: ${e.message}`);
            }
        }
    }

    static saveCache(title, content) {
        try {
            this.ensureCacheDirectoryExists();
            const { file: cachePath } = this.getCachePath();

            const cacheData = {
                title: title,
                content: content,
                timestamp: GLib.get_real_time(), 
            };

            const file = Gio.File.new_for_path(cachePath);
            const outputStream = file.replace(
                null,
                false,
                Gio.FileCreateFlags.NONE,
                null
            );
            outputStream.write_all(JSON.stringify(cacheData), null);
            outputStream.close(null);

            print(`Cache saved at ${cachePath}`);
            return true;
        } catch (e) {
            print(`Failed to save cache: ${e.message}`);
            return false;
        }
    }

    static loadCache() {
        try {
            const { file: cachePath } = this.getCachePath();
            const file = Gio.File.new_for_path(cachePath);

            if (!file.query_exists(null)) {
                return null;
            }

            const [success, contents] = file.load_contents(null);
            if (!success) {
                return null;
            }

            const cacheData = JSON.parse(new TextDecoder().decode(contents));
            const currentTime = GLib.get_real_time();
            const ageMs = (currentTime - cacheData.timestamp) / 1000; 

            // Check if cache is expired (older than 5 minutes)
            if (ageMs > CACHE_EXPIRY_MS) {
                print(`Cache expired (age: ${Math.floor(ageMs / 1000)}s)`);
                this.clearCache();
                return null;
            }

            print(`Cache loaded (age: ${Math.floor(ageMs / 1000)}s)`);
            return cacheData;
        } catch (e) {
            print(`Failed to load cache: ${e.message}`);
            return null;
        }
    }

    static clearCache() {
        try {
            const { file: cachePath } = this.getCachePath();
            const file = Gio.File.new_for_path(cachePath);

            if (file.query_exists(null)) {
                file.delete(null);
                print('Cache cleared');
            }
            return true;
        } catch (e) {
            print(`Failed to clear cache: ${e.message}`);
            return false;
        }
    }

    static hasValidCache() {
        return this.loadCache() !== null;
    }
}