# Jot

<img src="icon.png" alt="Jot Icon" width="64" height="64" />

Jot, a single-purpose tool for capturing a thought before it disappears.

https://github.com/user-attachments/assets/e132e309-d115-4bd1-a965-b219b8458457

## Features

- **Title-based notes**: Optional markdown title with automatic filename generation
- **Smart saving**: Save to `~/Documents/Jot/` or keep editing existing files in place
- **Double-click save for Save As**: Double-click the save button to choose a different location
- **Auto-save with cache recovery**: Automatic saving every 3 seconds with crash recovery
- **Theme integration**: Automatically syncs with your Alacritty theme colors
- **Keyboard shortcuts**: Full keyboard navigation with zoom controls
- **Fuzzy search**: Quick file finder with content search and live preview
- **File management**: Open existing `.md` and `.txt` files from any location
- **Zoom controls**: Adjust text size with `Ctrl++`, `Ctrl+-`, and `Ctrl+0`
- **Modern ES6 codebase**: Clean, maintainable code using modern JavaScript standards
- **Zero friction**: Clean, distraction-free interface

## Installation

```bash
yay -S jot-git
```

## Development

### Dependencies

Make sure you have GJS and GTK4 installed:

```bash
# Arch Linux
sudo pacman -S gjs gtk4 libadwaita
```

### Setup

1. Clone or download this repository:
   ```bash
   git clone https://github.com/yourusername/jot.git
   cd jot
   ```

2. Make the script executable:
   ```bash
   chmod +x jot.js
   ```

3. (Optional) Create a symlink for easy access:
   ```bash
   sudo ln -s $(pwd)/jot.js /usr/local/bin/jot
   ```

4. (Optional) Install desktop entry:
   ```bash
   mkdir -p ~/.local/share/applications
   cp jot.desktop ~/.local/share/applications/
   # Update the Exec path in jot.desktop to match your installation location
   ```

## Usage

### Running Jot

Run directly:
```bash
./jot.js
```

Or if you created the symlink:
```bash
jot
```

Open a specific file:
```bash
./jot.js ~/Documents/notes/mynote.md
```

Launch from your application menu after installing the desktop entry.

### Keyboard Shortcuts

- **Ctrl+S** or **Ctrl+Enter**: Save note (keeps app open)
- **Ctrl+P**: Open fuzzy search to find and open files by name or content
- **Ctrl++**: Zoom in (increase text size)
- **Ctrl+-**: Zoom out (decrease text size)
- **Ctrl+0**: Reset zoom to default
- **Escape**: Close application
- **Open button**: Open existing file from anywhere

### Interface

- **Title field**: Optional markdown title (prefixed with `#`)
- **Text area**: Main content area with word wrap and scrolling
- **Status line**: Shows current file path and action buttons
- **Open button**: Browse and open existing files
- **Cancel button**: Close the application without saving
- **Save button**: Save the current note (double-click for Save As)

### Setting Up Global Hotkey

Configure a global hotkey in your desktop environment to launch Jot:

**Hyprland:**
```bash
# ~/.config/hypr/bindings.conf
bind = SUPER SHIFT, J, exec, jot
```

### Open Jot as an Overlay

Open Jot in a floating window:

**Hyprland:**
```bash
# ~/.config/hypr/windowrules.conf
windowrule = float, class:^(com.github.jot)$
windowrule = size 700 500, class:^(com.github.jot)$
```

## File Organization

### Default Location

New notes are saved to `~/Documents/Jot/` with the following naming convention:

- **With title**: `title-in-lowercase.md`
- **Without title**: `jot-YYYYMMDD-HHMMSS.md`

### File Format

Notes are saved in markdown format with metadata:

```markdown
# Your Title Here

*Created: 2025-09-30 18:30:45*

Your note content goes here.
```

### Opening Existing Files

Click the **Open** button in the status line to browse and open existing `.md` or `.txt` files from anywhere. When you save, the file will be updated in its original location.

### Auto-Save and Cache Recovery

Jot automatically saves your work every 3 seconds to a cache file. If the application closes unexpectedly, you'll be prompted to recover your unsaved work when you restart. The cache expires after 5 minutes of inactivity.

## Theme Integration

Jot automatically reads colors from your Alacritty theme configuration:

**Theme file**: `~/.config/omarchy/current/theme/alacritty.toml`

The app watches for changes and reloads the theme automatically. If the theme file is not found, it falls back to sensible defaults.

**Color mapping**:
- Background: `colors.normal.black`
- Text: `colors.normal.white`
- Save button: `colors.normal.green`
- Selection: `colors.normal.blue`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Credits

Built with:
- [GJS](https://gjs.guide/) - GNOME JavaScript bindings
- [GTK4](https://www.gtk.org/) - The GTK toolkit
- [Libadwaita](https://gnome.pages.gitlab.gnome.org/libadwaita/) - GNOME design patterns
