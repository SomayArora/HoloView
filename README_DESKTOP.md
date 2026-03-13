# HoloView Desktop Application

Convert HoloView into a standalone desktop application that runs in fullscreen as an .exe file.

## Quick Start

### Method 1: Run Desktop App (Testing)
1. Install dependencies:
   ```bash
   pip install -r requirements_desktop.txt
   ```

2. Run the desktop app:
   ```bash
   python desktop_app.py
   ```

### Method 2: Build as .exe (Distribution)

#### Option A: Using the batch file (Easiest)
Simply double-click `build_desktop.bat` or run:
```bash
build_desktop.bat
```

#### Option B: Manual build
1. Install dependencies:
   ```bash
   pip install -r requirements_desktop.txt
   ```

2. Build the executable:
   ```bash
   pyinstaller --clean HoloView.spec
   ```

3. Find your executable:
   ```
   dist\HoloView.exe
   ```

## Features

✅ **Fullscreen Mode** - Launches in fullscreen by default
✅ **Standalone** - No need for separate browser
✅ **Portable** - Single .exe file (with 3D Models folder)
✅ **Native Window** - True desktop application feel
✅ **All Features** - Full HoloView functionality including:
   - Holo Mode (blue solid model)
   - Wireframe Mode (toggle wireframe)
   - Auto Rotate
   - Voice Control
   - Model Loading

## Distribution

To distribute your application:

1. Build the .exe using the steps above
2. Copy the following to your distribution folder:
   - `dist\HoloView.exe`
   - `3D Models\` folder (if not already embedded)

Users can simply:
- Double-click `HoloView.exe` to launch
- Press `ESC` to exit fullscreen or close the app

## Controls

- **H** - Toggle Holo Mode (blue color)
- **W** - Toggle Wireframe
- **R** - Reset View
- **A** - Auto Rotate
- **L** - Load Model
- **ESC** - Exit

## System Requirements

- Windows 10/11 (64-bit)
- 4GB RAM minimum
- Graphics card with OpenGL support

## Troubleshooting

### Build fails with missing modules
```bash
pip install --upgrade -r requirements_desktop.txt
```

### .exe is too large
The bundled .exe includes Python runtime and all dependencies. Typical size: 50-100MB

### 3D Models not loading
Ensure the "3D Models" folder is in the same directory as HoloView.exe

### App won't start
- Check Windows Defender/Antivirus (may flag unsigned .exe)
- Run as Administrator if needed

## Development Notes

- Backend: FastAPI (Python)
- Frontend: Three.js + Vanilla JavaScript
- Desktop Wrapper: PyWebView
- Packager: PyInstaller
- The app runs a local web server (random port) and displays it in a native window

## Advanced Configuration

Edit `desktop_app.py` to customize:
- `fullscreen=True` - Change to `False` for windowed mode
- Window size, title, background color, etc.

Edit `HoloView.spec` to customize:
- Bundle icon
- Additional files/folders
- Compression settings
