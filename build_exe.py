"""
Build script for creating HoloView.exe
Run this script to package the application as a standalone executable
"""
import PyInstaller.__main__
import shutil
from pathlib import Path

# Get the base directory
BASE_DIR = Path(__file__).parent

# Clean previous builds
dist_dir = BASE_DIR / 'dist'
build_dir = BASE_DIR / 'build'
if dist_dir.exists():
    shutil.rmtree(dist_dir)
if build_dir.exists():
    shutil.rmtree(build_dir)

print("Building HoloView Desktop Application...")

# PyInstaller configuration
PyInstaller.__main__.run([
    'desktop_app.py',
    '--name=HoloView',
    '--onefile',
    '--windowed',
    '--icon=NONE',
    '--add-data=index.html;.',
    '--add-data=app.js;.',
    '--add-data=3D Models;3D Models',
    '--hidden-import=uvicorn',
    '--hidden-import=uvicorn.logging',
    '--hidden-import=uvicorn.loops',
    '--hidden-import=uvicorn.loops.auto',
    '--hidden-import=uvicorn.protocols',
    '--hidden-import=uvicorn.protocols.http',
    '--hidden-import=uvicorn.protocols.http.auto',
    '--hidden-import=uvicorn.protocols.websockets',
    '--hidden-import=uvicorn.protocols.websockets.auto',
    '--hidden-import=uvicorn.lifespan',
    '--hidden-import=uvicorn.lifespan.on',
    '--collect-all=fastapi',
    '--collect-all=starlette',
    '--noconfirm'
])

print("\n" + "="*60)
print("Build complete!")
print(f"Executable location: {dist_dir / 'HoloView.exe'}")
print("="*60)
