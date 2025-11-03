// ============================================================================
// APPLICATION CONSTANTS
// ============================================================================

// Application constants
var APP_ID = 'com.github.jot';
var APP_TITLE = 'Jot';

// Directories
var JOT_DIR = ['Documents', 'Jot'];
var THEME_PATH = ['.config', 'omarchy', 'current', 'theme', 'alacritty.toml'];

// Timing
var FEEDBACK_TIMEOUT_MS = 3000;
var ZOOM_DISPLAY_MS = 1000;

// Keyboard keycodes
var Keys = {
    ESCAPE: 65307,
    ENTER: 65293,
    S: 115,
    P: 112,
    PLUS: 61,
    MINUS: 45,
    ZERO: 48,
    DOWN: 65364,
    CTRL_MASK: 4,
};

// File patterns
var FILE_PATTERNS = ['*.md', '*.txt'];
var FILE_FILTER_NAME = 'Text files (*.md, *.txt)';

// UI dimensions
var UI = {
    DEFAULT_WIDTH: 700,
    DEFAULT_HEIGHT: 500,
    SEARCH_DIALOG_WIDTH: 800,
    SEARCH_DIALOG_HEIGHT: 500,
    MIN_FILE_LIST_WIDTH: 350,
    TITLE_MARGIN: 20,
    TEXT_MARGIN: 20,
    STATUS_MARGIN: 16,
};

// Zoom settings
var Zoom = {
    DEFAULT: 100,
    MIN: 50,
    MAX: 300,
    STEP: 10,
};

// Preview settings
var MAX_PREVIEW_SIZE = 5000;
var MAX_SEARCH_RESULTS = 100;

// Default theme colors (fallback)
var DEFAULT_THEME = {
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

// Auto-save configuration
var AUTOSAVE_INTERVAL_SEC = 3;      // Save every 3 seconds
var CACHE_EXPIRY_MINUTES = 5;      // Cache valid for 5 minutes
