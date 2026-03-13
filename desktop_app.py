"""
HoloView Desktop Application
Runs the web viewer as a standalone fullscreen desktop app
"""
import webview
import threading
import uvicorn
import time
import socket
import sys
import os
from pathlib import Path

# Set the working directory to the script location
if getattr(sys, 'frozen', False):
    # Running as compiled executable
    BASE_DIR = Path(sys._MEIPASS)
    os.chdir(sys._MEIPASS)
else:
    # Running as script
    BASE_DIR = Path(__file__).parent
    os.chdir(BASE_DIR)

# Import the FastAPI app
from backend import app

class HoloViewDesktop:
    def __init__(self):
        self.server = None
        self.port = self.find_free_port()
        
    def find_free_port(self):
        """Find an available port"""
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(('', 0))
            s.listen(1)
            port = s.getsockname()[1]
        return port
    
    def start_server(self):
        """Start the FastAPI server in a background thread"""
        config = uvicorn.Config(
            app=app,
            host="127.0.0.1",
            port=self.port,
            log_level="error"
        )
        self.server = uvicorn.Server(config)
        self.server.run()
    
    def run(self):
        """Run the desktop application"""
        # Start the FastAPI server in a background thread
        server_thread = threading.Thread(target=self.start_server, daemon=True)
        server_thread.start()
        
        # Wait for server to start
        time.sleep(2)
        
        # Create the desktop window
        window = webview.create_window(
            'HoloView - Advanced 3D Viewer',
            f'http://127.0.0.1:{self.port}',
            fullscreen=True,
            frameless=False,
            easy_drag=False,
            background_color='#000000'
        )
        
        # Start the GUI
        webview.start(debug=False)

if __name__ == '__main__':
    app_instance = HoloViewDesktop()
    app_instance.run()
