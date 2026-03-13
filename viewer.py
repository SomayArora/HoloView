import pygame
import sys
import threading
import numpy as np
from PyQt5.QtWidgets import QApplication, QWidget, QVBoxLayout, QHBoxLayout, QPushButton
from PyQt5.QtOpenGL import QGLWidget
from PyQt5.QtCore import Qt, QTimer, pyqtSignal, QPoint, QObject
from OpenGL.GL import *
from OpenGL.GLU import *
import win32gui
import win32con
import os
from typing import cast

# Screen dimensions
WIDTH = 1920  # Default width
HEIGHT = 1080  # Default height

# Signal handler for window management
class WindowManager(QObject):
    viewer_closed = pyqtSignal()

# Global signal handler
window_manager = WindowManager()

# Colors
BLACK = (0, 0, 0)
CYAN = (0, 255, 255)
DARK_CYAN = (0, 180, 180)
WHITE = (255, 255, 255)
GRADIENT_START = (10, 10, 30)
GRADIENT_END = (30, 30, 50)
ACCENT_COLOR = (0, 200, 255)
HOVER_COLOR = (0, 220, 255)
SELECTED_COLOR = (0, 180, 255)

# Animation constants
ANIMATION_DURATION = 200  # ms
BUTTON_SCALE = 1.1
BUTTON_TRANSITION = 0.15

# Global variables for state management
current_scene = "main_menu"
current_category = None
buttons = []
running = True
scroll_offset = 0  # Initialize scroll_offset
max_scroll = 0     # Initialize max_scroll
title_rect_for_menu = None

# Model Paths Dictionary
model_paths = {
    "Arc Reactors": {
        "Mark 1": r"D:\HoloMat v2.0\3D Models\AR 1\model.obj",
        "Mark 2": r"D:\HoloMat v2.0\3D Models\AR 2\model.obj",
        "Mark 85": r"D:\HoloMat v2.0\3D Models\AR 85\model.obj",
    },
    "Armours": {
        "Mark 2": r"D:\HoloMat v2.0\3D Models\Mark 2\mk3.obj",
        "Mark 3": r"D:\HoloMat v2.0\3D Models\Mark 3\source\mk3.obj",
        "Mark 7": r"D:\HoloMat v2.0\3D Models\Mark 7\source\Iron_man_Mark-7(Subsurf).obj",
        "Mark 45": r"D:\HoloMat v2.0\3D Models\Mark 45\model.obj",
        "Mark 85": r"D:\HoloMat v2.0\3D Models\Mark 85\model.obj",
        "Helmet": r"D:\HoloMat v2.0\3D Models\Helmet\model.obj",
        "Hulkbuster": r"D:\HoloMat v2.0\3D Models\Hulkbuster\model.obj",
    },
    "Weaponary": {
        "Batarang": r"D:\HoloMat v2.0\3D Models\Batarang\model.obj",
        "Mjolnir": r"D:\HoloMat v2.0\3D Models\Mjolnir\model.obj",
        "Storm Breaker": r"D:\HoloMat v2.0\3D Models\Storm Breaker\model.obj",
        "Thanos Sword": r"D:\HoloMat v2.0\3D Models\Thanos Sword\model.obj",
        "Captain America Shield": r"D:\HoloMat v2.0\3D Models\Shield\model.obj",
        "Web shooter": r"D:\HoloMat v2.0\3D Models\Web Shooter\model.obj",
    },
    "Garage": {
        "Batmobile": r"D:\HoloMat v2.0\3D Models\Batmobile\model.obj",
        "Batwing": r"D:\HoloMat v2.0\3D Models\Batwing\model.obj",
        "Bugatti La voiture noire": r"D:\HoloMat v2.0\3D Models\Bugatti\model.obj",
        "Bugatti Chiron": r"D:\HoloMat v2.0\3D Models\Chiron\model.obj",
        "Bugatti Centodiece": r"D:\HoloMat v2.0\3D Models\Bugatti Centodiece\model.obj",
        "Bugatti Divo": r"D:\HoloMat v2.0\3D Models\Divo\model.obj",
        "Lamborghini Essenza": r"D:\HoloMat v2.0\3D Models\Lamborghini\model.obj",
        "Lamborghini Aventador SVJ": r"D:\HoloMat v2.0\3D Models\SVJ\model.obj",
        "Lamborghini Revuelto": r"D:\HoloMat v2.0\3D Models\Revuelto\model.obj",
        "Nissan GTR": r"D:\HoloMat v2.0\3D Models\GTR\model.obj",
        "Mclaren 765 lt": r"D:\HoloMat v2.0\3D Models\Mclaren\model.obj",
    }
}

# Button class with enhanced styling
class Button:
    def __init__(self, text, x, y, width, height, action=None):
        self.text = text
        self.rect = pygame.Rect(x, y, width, height)
        self.action = action
        self.hovered = False
        self.scale = 1.0
        self.target_scale = 1.0
        self.alpha = 255
        self.target_alpha = 255
        self.icon = None
        self.description = None

    def draw(self, screen, scroll_offset=0):
        # Calculate current scale
        self.scale += (self.target_scale - self.scale) * BUTTON_TRANSITION
        self.alpha += (self.target_alpha - self.alpha) * BUTTON_TRANSITION

        # Calculate scaled dimensions
        scaled_width = int(self.rect.width * self.scale)
        scaled_height = int(self.rect.height * self.scale)
        scaled_x = self.rect.centerx - scaled_width // 2
        scaled_y = self.rect.centery - scaled_height // 2 - scroll_offset

        # Draw button background
        color = HOVER_COLOR if self.hovered else CYAN
        button_rect = pygame.Rect(scaled_x, scaled_y, scaled_width, scaled_height)
        pygame.draw.rect(screen, color, button_rect, border_radius=15)
        
        # Draw button border with glow effect
        border_color = (255, 255, 255, int(self.alpha))
        pygame.draw.rect(screen, border_color, button_rect, 2, border_radius=15)
        
        # Draw text without shadow
        text_surf = font.render(self.text, True, BLACK)
        text_rect = text_surf.get_rect(center=button_rect.center)
        screen.blit(text_surf, text_rect)

        # Draw description if available
        if self.description and self.hovered:
            desc_surf = small_font.render(self.description, True, WHITE)
            desc_rect = desc_surf.get_rect(midtop=(button_rect.centerx, button_rect.bottom + 10))
            screen.blit(desc_surf, desc_rect)

    def check_hover(self, pos, scroll_offset=0):
        was_hovered = self.hovered
        adjusted_pos = (pos[0], pos[1] + scroll_offset)
        self.hovered = self.rect.collidepoint(adjusted_pos)
        
        if self.hovered and not was_hovered:
            self.target_scale = BUTTON_SCALE
            self.target_alpha = 255
        elif not self.hovered and was_hovered:
            self.target_scale = 1.0
            self.target_alpha = 200

    def click(self):
        if self.action:
            self.action()

# Scene control with enhanced state management
def switch_to_main():
    global current_scene, buttons, scroll_offset, max_scroll, title_rect_for_menu
    current_scene = "main_menu"
    buttons = []
    # Responsive sizing
    button_width = int(WIDTH * 0.4)
    button_height = int(HEIGHT * 0.08)
    button_spacing = int(HEIGHT * 0.04)
    num_buttons = len(model_paths) + 1  # +1 for Exit
    total_buttons_height = num_buttons * button_height + (num_buttons - 1) * button_spacing
    # Prepare title for height calculation
    title_font_size = int(HEIGHT * 0.10)
    temp_title_font = pygame.font.Font("D:/HoloMat v2.0/Arame-Regular.ttf", title_font_size)
    title_surf = temp_title_font.render("HOLO VIEW", True, CYAN)
    title_height = title_surf.get_height()
    block_height = title_height + int(HEIGHT * 0.04) + total_buttons_height  # 0.04*HEIGHT gap between title and first button
    block_start_y = (HEIGHT - block_height) // 2
    # Store for use in run()
    title_rect_for_menu = title_surf.get_rect(center=(WIDTH // 2, block_start_y + title_height // 2))
    # Buttons start below title + gap
    start_y = block_start_y + title_height + int(HEIGHT * 0.04)
    for i, category in enumerate(model_paths):
        btn = Button(category, WIDTH // 2 - button_width // 2, start_y + i * (button_height + button_spacing), button_width, button_height, lambda c=category: switch_to_category(c))
        buttons.append(btn)
    exit_btn = Button("Exit", WIDTH // 2 - button_width // 2, start_y + (num_buttons - 1) * (button_height + button_spacing), button_width, button_height, quit_app)
    buttons.append(exit_btn)
    max_scroll = 0
    scroll_offset = 0

def switch_to_category(category_name):
    global current_scene, current_category, buttons, scroll_offset, max_scroll, title_rect_for_menu
    current_scene = "category"
    current_category = category_name
    buttons = []
    scroll_offset = 0
    max_scroll = 0

    title_font_size = int(HEIGHT * 0.10)
    temp_title_font = pygame.font.Font("D:/HoloMat v2.0/Arame-Regular.ttf", title_font_size)
    title_surf = temp_title_font.render(current_category, True, CYAN)
    title_height = title_surf.get_height()

    if category_name == "Garage":
        button_width = int(WIDTH * 0.4)
        button_height = int(HEIGHT * 0.06)
        button_spacing = int(HEIGHT * 0.03)
        col_spacing = int(WIDTH * 0.02)

        items = [("Back", switch_to_main)] + [(model, lambda p=path: print_model_path(p)) for model, path in model_paths[category_name].items()]
        
        num_cols = 2
        num_rows = (len(items) + num_cols - 1) // num_cols

        total_buttons_height = num_rows * button_height + (num_rows - 1) * button_spacing
        block_height = title_height + int(HEIGHT * 0.04) + total_buttons_height
        block_start_y = (HEIGHT - block_height) // 2

        title_rect_for_menu = title_surf.get_rect(center=(WIDTH // 2, block_start_y + title_height // 2))
        start_y = block_start_y + title_height + int(HEIGHT * 0.04)

        col1_x = WIDTH // 2 - button_width - col_spacing // 2
        col2_x = WIDTH // 2 + col_spacing // 2

        for i, (text, action) in enumerate(items):
            row = i // num_cols
            col = i % num_cols
            x = col1_x if col == 0 else col2_x
            y = start_y + row * (button_height + button_spacing)
            btn = Button(text, x, y, button_width, button_height, action)
            buttons.append(btn)
    else:
        if category_name == "Armours":
            button_width = int(WIDTH * 0.3)
            button_height = int(HEIGHT * 0.06)
            button_spacing = int(HEIGHT * 0.03)
        else:
            button_width = int(WIDTH * 0.4)
            button_height = int(HEIGHT * 0.08)
            button_spacing = int(HEIGHT * 0.04)
            
        num_buttons = 1 + len(model_paths[category_name])  # 1 for Back, rest for models
        total_buttons_height = num_buttons * button_height + (num_buttons - 1) * button_spacing
        block_height = title_height + int(HEIGHT * 0.04) + total_buttons_height
        block_start_y = (HEIGHT - block_height) // 2
        title_rect_for_menu = title_surf.get_rect(center=(WIDTH // 2, block_start_y + title_height // 2))
        start_y = block_start_y + title_height + int(HEIGHT * 0.04)
        back_btn = Button("Back", WIDTH // 2 - button_width // 2, start_y, button_width, button_height, switch_to_main)
        buttons.append(back_btn)
        for i, (model, path) in enumerate(model_paths[category_name].items()):
            btn = Button(model, WIDTH // 2 - button_width // 2, start_y + (i + 1) * (button_height + button_spacing), button_width, button_height, lambda p=path: print_model_path(p))
            buttons.append(btn)
        max_scroll = 0
        scroll_offset = 0

class OBJModel:
    def __init__(self, filename):
        self.vertices = []
        self.normals = []
        self.faces = []
        self.display_list = None
        self.center = [0, 0, 0]
        self.scale = 1.0
        self.load_obj(filename)
        self.center_and_scale()

    def load_obj(self, filename):
        with open(filename, 'r') as file:
            for line in file:
                if line.startswith('v '):
                    self.vertices.append(list(map(float, line.split()[1:4])))
                elif line.startswith('vn '):
                    self.normals.append(list(map(float, line.split()[1:4])))
                elif line.startswith('f '):
                    face = []
                    for v in line.split()[1:]:
                        parts = v.replace('//', '/').split('/')
                        vi = int(parts[0]) - 1
                        ni = int(parts[-1]) - 1 if len(parts) > 1 else 0
                        face.append((vi, ni))
                    self.faces.append(face)

    def center_and_scale(self):
        if not self.vertices:
            return
        vertices_np = np.array(self.vertices)
        min_vals, max_vals = vertices_np.min(axis=0), vertices_np.max(axis=0)
        self.center = ((min_vals + max_vals) / 2).tolist()
        self.scale = 2.0 / np.max(max_vals - min_vals)

    def generate_display_list(self):
        if self.display_list:
            return
        self.display_list = glGenLists(1)
        glNewList(self.display_list, GL_COMPILE)
        glBegin(GL_TRIANGLES)
        for face in self.faces:
            for vi, ni in face:
                if self.normals:
                    glNormal3fv(self.normals[ni])
                vertex = (np.array(self.vertices[vi]) - self.center) * self.scale
                glVertex3fv(vertex)
        glEnd()
        glEndList()

class GLWidget(QGLWidget):
    model_loaded = pyqtSignal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self.model = None
        self.wireframe = False
        self.auto_rotate = False

        self.target_zoom = -3.0
        self.current_zoom = -3.0
        self.target_rot_x = 0.0
        self.target_rot_y = 0.0
        self.current_rot_x = 0.0
        self.current_rot_y = 0.0
        self.target_tx = 0.0
        self.target_ty = 0.0
        self.current_tx = 0.0
        self.current_ty = 0.0

        self.last_pos = QPoint()
        self.last_rot_pos = QPoint()

        self.rot_vel_x = 0
        self.rot_vel_y = 0
        self.friction = 0.95
        self.mouse_dragging = False

        self.timer = QTimer()
        self.timer.timeout.connect(self.update_smooth)
        self.timer.start(16)

    def update_smooth(self):
        interp = 0.15
        self.current_zoom += (self.target_zoom - self.current_zoom) * interp
        self.current_rot_x += (self.target_rot_x - self.current_rot_x) * interp
        self.current_rot_y += (self.target_rot_y - self.current_rot_y) * interp
        self.current_tx += (self.target_tx - self.current_tx) * interp
        self.current_ty += (self.target_ty - self.current_ty) * interp
        if self.auto_rotate:
            self.target_rot_y += 0.5
        self.updateGL()

    def initializeGL(self):
        glEnable(GL_DEPTH_TEST)
        glEnable(GL_LIGHTING)
        diffuse = [0.6, 0.6, 0.6, 1.0]
        specular = [0.6, 0.6, 0.6, 1.0]
        for i in range(6):
            light_id = int(GL_LIGHT0) + i
            glEnable(light_id)
            glLightfv(light_id, GL_POSITION, [0.0, 0.0, i - 2.5, 0.0])
            glLightfv(light_id, GL_DIFFUSE, diffuse)
            glLightfv(light_id, GL_SPECULAR, specular)
        glLightModelfv(GL_LIGHT_MODEL_AMBIENT, [0.2, 0.2, 0.2, 1.0])
        glEnable(GL_CULL_FACE)
        glCullFace(GL_BACK)
        glClearColor(0.0, 0.0, 0.0, 1.0)

    def resizeGL(self, w, h):
        glViewport(0, 0, w, h or 1)
        glMatrixMode(GL_PROJECTION)
        glLoadIdentity()
        gluPerspective(45.0, w / h, 0.1, 100.0)
        glMatrixMode(GL_MODELVIEW)

    def paintGL(self):
        glClear(int(GL_COLOR_BUFFER_BIT) | int(GL_DEPTH_BUFFER_BIT))
        glLoadIdentity()
        glTranslatef(self.current_tx, self.current_ty, self.current_zoom)
        glRotatef(self.current_rot_x, 1.0, 0.0, 0.0)
        glRotatef(self.current_rot_y, 0.0, 1.0, 0.0)
        if self.model and self.model.display_list:
            glPolygonMode(GL_FRONT_AND_BACK, GL_LINE if self.wireframe else GL_FILL)
            glCallList(self.model.display_list)

        if not self.mouse_dragging:
            self.target_rot_x += self.rot_vel_x
            self.target_rot_y += self.rot_vel_y

            # Apply friction to slow rotation over time
            self.rot_vel_x *= self.friction
            self.rot_vel_y *= self.friction

            # Stop spinning when velocity is very low
            if abs(self.rot_vel_x) < 0.01:
                self.rot_vel_x = 0
            if abs(self.rot_vel_y) < 0.01:
                self.rot_vel_y = 0

    def mousePressEvent(self, event):
        if event.button() == cast(int, Qt.LeftButton):  # type: ignore
            self.last_rot_pos = event.pos()
            self.mouse_dragging = True

    def mouseReleaseEvent(self, event):
        if event.button() == cast(int, Qt.LeftButton):  # type: ignore
            self.mouse_dragging = False

    def mouseMoveEvent(self, event):
        sensitivity = 0.6

        if event.buttons() & cast(int, Qt.LeftButton):  # type: ignore
            dx = event.x() - self.last_rot_pos.x()
            dy = event.y() - self.last_rot_pos.y()

            self.target_rot_x += dy * sensitivity
            self.target_rot_y += dx * sensitivity

            # Save velocities for momentum
            self.rot_vel_x = dy * sensitivity
            self.rot_vel_y = dx * sensitivity

            self.last_rot_pos = event.pos()

        elif event.buttons() & cast(int, Qt.RightButton):  # type: ignore
            dx = event.x() - self.last_pos.x()
            dy = event.y() - self.last_pos.y()
            self.target_tx += dx * 0.005
            self.target_ty -= dy * 0.005
            self.last_pos = event.pos()

    def wheelEvent(self, event):
        self.target_zoom += (event.angleDelta().y() / 120) * 0.3

    def toggle_wireframe(self):
        self.wireframe = not self.wireframe

    def toggle_auto_rotate(self):
        self.auto_rotate = not self.auto_rotate

    def reset_view(self):
        self.target_zoom = -3.0
        self.target_rot_x = 0.0
        self.target_rot_y = 0.0
        self.target_tx = 0.0
        self.target_ty = 0.0
        self.rot_vel_x = 0
        self.rot_vel_y = 0

    def load_model_async(self, filepath):
        def worker():
            model = OBJModel(filepath)
            self.model = model
            QTimer.singleShot(0, self.finalize_model)
        threading.Thread(target=worker).start()

    def finalize_model(self):
        self.makeCurrent()
        if self.model:
            self.model.generate_display_list()
            self.model_loaded.emit()

class MainWindow(QWidget):
    def __init__(self, model_path):
        super().__init__()
        self.setWindowTitle('HOLO VIEW')
        self.setGeometry(100, 100, 800, 600)
        self.setStyleSheet("background-color: black;")
        self.setWindowFlags(cast(int, Qt.Window) | cast(int, Qt.WindowStaysOnTopHint) | cast(int, Qt.FramelessWindowHint))  # type: ignore  # Make window stay on top and frameless

        self.gl_widget = GLWidget(self)
        self.gl_widget.model_loaded.connect(self.showFullScreen)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)
        layout.addWidget(self.gl_widget)

        button_layout = QHBoxLayout()
        button_layout.setContentsMargins(30, 10, 30, 30)
        button_layout.setSpacing(40)

        button_style = """
            QPushButton {
                background-color: black;
                color: cyan;
                font-size: 18px;
                padding: 10px 20px;
                border: 2px solid cyan;
                border-radius: 10px;
            }
            QPushButton:hover {
                background-color: #00FFFF;
                color: black;
            }
        """

        auto_btn = QPushButton("AUTO ROTATE")
        auto_btn.setStyleSheet(button_style)
        auto_btn.clicked.connect(self.gl_widget.toggle_auto_rotate)
        button_layout.addWidget(auto_btn)

        wire_btn = QPushButton("WIREFRAME")
        wire_btn.setStyleSheet(button_style)
        wire_btn.clicked.connect(self.gl_widget.toggle_wireframe)
        button_layout.addWidget(wire_btn)

        reset_btn = QPushButton("RESET VIEW")
        reset_btn.setStyleSheet(button_style)
        reset_btn.clicked.connect(self.gl_widget.reset_view)
        button_layout.addWidget(reset_btn)

        exit_btn = QPushButton("EXIT")
        exit_btn.setStyleSheet(button_style)
        exit_btn.clicked.connect(lambda: self.close())  # type: ignore
        button_layout.addWidget(exit_btn)

        layout.addLayout(button_layout)
        self.setLayout(layout)

        self.hide()
        self.gl_widget.load_model_async(model_path)

    def show(self):
        super().show()
        self.showFullScreen()  # Always show in fullscreen
        self.activateWindow()  # Bring window to front
        self.raise_()  # Raise window above others

    def keyPressEvent(self, event):
        if event.key() == cast(int, Qt.Key_Escape):  # type: ignore
            self.close()

    def closeEvent(self, event):
        # Hide this window first
        self.hide()
        
        # Emit signal to notify main window
        window_manager.viewer_closed.emit()
        
        # Accept the close event
        event.accept()

def print_model_path(path):
    print(f"Selected model: {path}")
    app = QApplication.instance() or QApplication(sys.argv)
    window = MainWindow(path)
    window.show()
    app.exec_()

def quit_app():
    global running
    running = False

def run(screen):
    global running, font, small_font, title_font, clock, scroll_offset, title_rect_for_menu
    
    # Connect signal to handle viewer closing
    def on_viewer_closed():
        app = QApplication.instance()
        if app:
            for widget in app.allWidgets():  # type: ignore
                if widget.windowTitle() == "HoloMat":
                    widget.show()
                    widget.showNormal()
                    widget.activateWindow()
                    widget.raise_()
                    break
    
    window_manager.viewer_closed.connect(on_viewer_closed)
    
    # Responsive font sizes
    button_font_size = int(HEIGHT * 0.045)
    small_font_size = int(HEIGHT * 0.06)
    title_font_size = int(HEIGHT * 0.10)
    font = pygame.font.Font("D:/HoloMat v2.0/Arame-Regular.ttf", button_font_size)
    small_font = pygame.font.Font("D:/HoloMat v2.0/Arame-Regular.ttf", small_font_size)
    title_font = pygame.font.Font("D:/HoloMat v2.0/Arame-Regular.ttf", title_font_size)
    clock = pygame.time.Clock()
    running = True
    scroll_offset = 0
    switch_to_main()

    while running:
        screen.fill(BLACK)

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                quit_app()
            elif event.type == pygame.MOUSEMOTION:
                for btn in buttons:
                    btn.check_hover(event.pos, scroll_offset)
            elif event.type == pygame.MOUSEBUTTONDOWN:
                if event.button == 1:
                    for btn in buttons:
                        if btn.rect.collidepoint((event.pos[0], event.pos[1] + scroll_offset)):
                            btn.click()
            elif event.type == pygame.MOUSEWHEEL:
                if current_scene == "category":
                    scroll_offset = max(0, min(max_scroll, scroll_offset - event.y * 30))

        # Draw title text at the precomputed rect
        title_text = "HOLO VIEW" if current_scene == "main_menu" else current_category
        title_surf = title_font.render(title_text, True, CYAN)
        screen.blit(title_surf, title_rect_for_menu)

        # Draw buttons with scroll offset
        for btn in buttons:
            if btn.rect.bottom > scroll_offset and btn.rect.top < HEIGHT + scroll_offset:
                btn.draw(screen, scroll_offset)

        pygame.display.flip()
        clock.tick(60)

    return screen
