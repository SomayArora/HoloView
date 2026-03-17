# 🚀 HoloView - Ultra-Fast 3D Model Viewer with Hand Tracking

An **Iron Man-inspired**, ultra-fast, high-resolution 3D model viewer with advanced **hand tracking** and voice control capabilities. Built with Three.js, MediaPipe Hands, and FastAPI for maximum performance.

![Python](https://img.shields.io/badge/python-3.8%2B-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

### 🎨 Iron Man UI
- **Futuristic Interface**: Sleek, glowing cyan UI straight from the MCU
- **Full-Screen Mode**: Immersive desktop experience with black background
- **Hologram Mode**: Toggle wireframe holographic rendering
- **Scanline Effects**: Retro-futuristic visual effects
- **Corner HUD Elements**: Battle-tested UI design

### 🎮 Controls

#### Mouse Controls
- **Left Click + Drag**: Rotate model
- **Right Click + Drag**: Pan camera
- **Scroll Wheel**: Zoom in/out

#### Button Controls
- **Reset**: Reset camera view to default position
- **Exit**: Close the application
- **Auto Rotate**: Toggle automatic model rotation
- **Holo Mode**: Toggle holographic wireframe mode
- **Wireframe**: Toggle wireframe view
- **Load**: Open model selection menu
- **Hand Tracking**: Enable/disable hand gesture controls

#### Keyboard Shortcuts
- `R` - Reset view
- `A` - Toggle auto-rotate
- `H` - Toggle holo mode
- `W` - Toggle wireframe
- `L` - Open model list
- `ESC` - Close dialog/Exit app

### 🖐️ Hand Gesture Controls

Enable hand tracking and use these Iron Man-style gestures:

#### Two-Handed Gestures
- **Both Palms Open + Spread Apart** → Zoom IN (inverted pinch-to-zoom)
- **Both Palms Open + Bring Together** → Zoom OUT
- **Both Hands Pinched** (thumb+index) + Move → Rotate model

#### Single-Handed Gestures  
- **One Hand Pinched** + Move → Pan/Move camera

#### Advanced Gestures
- **Hand Depth** (move closer/farther from camera) → Zoom control
- **Two-Hand Clap** → Iron Man easter egg! ⚡ (sound + visual effect)

### 🎤 Voice Commands

Activate voice control and use these commands:
- "Reset" - Reset camera view
- "Auto rotate" / "Stop rotating" - Control rotation
- "Holo mode" - Toggle holographic mode
- "Load [model name]" - Load specific model (e.g., "Load Mark 85")
- "Exit" / "Close" - Exit application

### ⚡ Performance Features
- **Hand Tracking**: Real-time two-hand gesture recognition with MediaPipe
- **High-Resolution Rendering**: Maximum quality with anti-aliasing
- **Fast Loading**: Optimized OBJ/MTL loader
- **Hardware Acceleration**: GPU-powered rendering
- **Smooth Animations**: 60 FPS with damping controls
- **Shadow Mapping**: Real-time soft shadows
- **Progressive Loading**: Live loading progress indicators

## 🛠️ Installation

### Prerequisites
- Python 3.8 or higher
- Chrome browser (for voice control)
- **Webcam** (for hand tracking)
- Modern GPU (recommended for best performance)

### Setup

1. **Clone or navigate to the project directory**
```bash
cd "d:/HoloView v1.0"
```

2. **Install Python dependencies**
```bash
pip install -r requirements.txt
```

3. **Verify your 3D models**
Place your 3D models (OBJ format with textures) in the `3D Models` folder. Each model should be in its own subdirectory.

## 🚀 Running the Application

### Start the server:
```bash
python backend.py
```

The server will start on `http://localhost:8000`

### Open in browser:
Navigate to `http://localhost:8000` in your web browser.

**Pro Tip**: Press F11 for true fullscreen experience!

## 📁 Project Structure

```
HoloView v1.0/
│
├── backend.py              # FastAPI server
├── index.html             # Main HTML file with Iron Man UI
├── app.js                 # Three.js application logic
├── SpeechToText.py        # Voice recognition module
├── requirements.txt       # Python dependencies
├── README.md             # This file
│
├── 3D Models/            # Your 3D model collection
│   ├── Mark 85/
│   │   ├── model.obj
│   │   ├── model.mtl
│   │   └── textures...
│   ├── Hulkbuster/
│   └── ...
│
└── Data/                 # Runtime data (created automatically)
    └── Voice.html
```

## 🎯 Supported Formats

- **3D Models**: OBJ (with MTL material files)
- **Textures**: PNG, JPG, JPEG
- **Materials**: MTL files with PBR textures

## 🔧 Configuration

### Backend Port
Edit `backend.py` line 189 to change the port:
```python
uvicorn.run(app, host="0.0.0.0", port=8000)
```

### Voice Recognition Language
Edit `SpeechToText.py` line 10 to change input language:
```python
InputLanguage = "en"  # Change to your language code
```

## 🎨 Customization

### UI Colors
Edit the CSS in `index.html` to change the color scheme:
- Primary color: `#00d9ff` (Cyan)
- Background: `#000000` (Black)

### Lighting
Modify the `setupLights()` method in `app.js` to adjust scene lighting.

### Camera Settings
Adjust camera parameters in `app.js`:
```javascript
this.controls.minDistance = 0.5;
this.controls.maxDistance = 100;
```

## 🐛 Troubleshooting

### Model not loading
- Ensure OBJ and MTL files are in the same directory
- Check that texture paths in MTL file are relative
- Verify model is not corrupted

### Voice control not working
- Install Chrome browser
- Allow microphone permissions
- Check `Data/Voice.html` was created

### Performance issues
- Lower the model polygon count
- Disable shadows in `init()` method
- Reduce texture resolution

## 🚀 Performance Tips

1. **Use optimized models**: Keep polygon count under 1M for best performance
2. **Compress textures**: Use compressed texture formats (JPG for diffuse)
3. **Close other applications**: Free up GPU memory
4. **Use SSD**: Faster model loading from solid-state drives
5. **Update GPU drivers**: Latest drivers provide best performance

## 📝 API Endpoints

- `GET /` - Serve main application
- `GET /api/models` - Get list of available models
- `GET /api/model/{model_name}` - Get model file paths
- `POST /api/stt/start` - Start voice recognition
- `POST /api/stt/stop` - Stop voice recognition
- `WebSocket /ws/stt` - Real-time voice command stream

## 🎓 Credits

- **Three.js**: 3D rendering library
- **FastAPI**: High-performance Python backend
- **OrbitControls**: Camera control system
- **Google Fonts**: Orbitron typeface
- **Selenium**: Browser automation for voice recognition

## 📄 License

MIT License - Feel free to use and modify!

## 🤝 Contributing

Contributions are welcome! Please feel free to submit pull requests.

## 💡 Future Enhancements

- [ ] Support for GLTF/GLB formats
- [ ] Real-time model editing
- [ ] VR/AR support
- [ ] Multi-model scene composition
- [ ] Animation playback
- [ ] Screenshot/recording capabilities
- [ ] Cloud model library integration

## 📞 Support

For issues and questions, please create an issue in the project repository.

---

**Made with ⚡ by Somay Arora**

*"Sometimes you gotta run before you can walk." - Tony Stark*
