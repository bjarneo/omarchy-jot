# Jot

<img src="icon.png" alt="Jot Icon" width="64" height="64" />

Jot, a single-purpose tool for capturing a thought before it disappears.

https://github.com/user-attachments/assets/e132e309-d115-4bd1-a965-b219b8458457

## Features

- **📝 Title-based notes**: Optional markdown title with automatic filename generation
- **💾 Smart saving**: Save to `~/Documents/Jot/` or keep editing existing files in place
- **🎨 Theme integration**: Automatically syncs with your theme colors
- **⌨️ Keyboard shortcuts**: `Ctrl+S` to save, `Escape` to close
- **📂 File management**: Open existing `.md` and `.txt` files from any location
- **🔄 Live preview**: Real-time character and word count in status bar
- **🎯 Zero friction**: Clean, distraction-free interface

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
- **Escape**: Close application
- **+** button: Open existing file

### Interface

- **Title field**: Optional markdown title (prefixed with `#`)
- **Text area**: Main content area with word wrap and scrolling
- **Status line**: Shows character count, word count, file path, and action buttons

### Setting Up Global Hotkey

Configure a global hotkey in your desktop environment to launch Jot:

**Omarchy:**
```bash
# ~/.config/hypr/bindings.conf
bindd = SUPER SHIFT, J, Jot, exec, uwsm app -- jot
```
### Open Jot as an Overlay 

Open Jot in a Floating window:

**Omarchy:**
```bash
# ~/.config/hypr/bindings.conf
windowrule = float, class:com.github.jot
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

Click the **+** button in the status line to open existing `.md` or `.txt` files from anywhere. When you save, the file will be updated in its original location.

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
