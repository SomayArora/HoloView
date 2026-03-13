// ========================================
// HoloView - Ultra-Fast 3D Viewer
// Iron Man Inspired UI
// ========================================

class HoloView {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.currentModel = null;
        this.autoRotate = false;
        this.holoMode = false;
        this.wireframeMode = false;
        this.originalMaterials = new Map();
        this.models = [];
        this.websocket = null;
        this.sttActive = false;

        // Hand tracking
        this.handTracking = null;
        this.handTrackingEnabled = true;
        this.harmMode = false;
        this.lastDepthZoom = 0;

        // Repulsor system
        this.particleSystem = null;
        this.chargingGlows = [];
        this.repulsorCooldownEnd = 0;

        this.init();
        this.setupEventListeners();
        this.loadModelList();
        this.connectWebSocket();
        this.initParticleSystem();

        // Note: Hand tracking now waits for first user interaction to satisfy browser privacy policies
    }

    init() {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);

        // Create camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            10000
        );
        this.camera.position.set(0, 2, 5);

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        document.getElementById('canvas-container').appendChild(this.renderer.domElement);

        // Create controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = true;
        this.controls.minDistance = 0.5;
        this.controls.maxDistance = 100;
        this.controls.maxPolarAngle = Math.PI;

        // Add lights
        this.setupLights();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);

        // Start animation loop
        this.animate();

        this.updateStatus('System Online');
    }

    setupLights() {
        // Balanced ambient light for base illumination without flattening
        const ambientLight = new THREE.AmbientLight(0x404040, 0.8);
        this.scene.add(ambientLight);

        // Hemisphere light for natural gradient lighting (sky/ground)
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.7);
        hemiLight.position.set(0, 50, 0);
        this.scene.add(hemiLight);

        // Key light - main directional light from front-top-right (not too strong)
        const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
        keyLight.position.set(10, 12, 10);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 2048;
        keyLight.shadow.mapSize.height = 2048;
        keyLight.shadow.camera.near = 0.1;
        keyLight.shadow.camera.far = 100;
        keyLight.shadow.bias = -0.0001;
        this.scene.add(keyLight);

        // Fill light - front-left to balance key light
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
        fillLight.position.set(-10, 8, 10);
        this.scene.add(fillLight);

        // Back-right light - for depth and edge definition
        const backRightLight = new THREE.DirectionalLight(0xd0d0ff, 0.7);
        backRightLight.position.set(8, 10, -10);
        this.scene.add(backRightLight);

        // Back-left light - for even back coverage
        const backLeftLight = new THREE.DirectionalLight(0xffd0d0, 0.6);
        backLeftLight.position.set(-8, 10, -10);
        this.scene.add(backLeftLight);

        // Top light - from directly above for top surface detail
        const topLight = new THREE.DirectionalLight(0xffffff, 0.6);
        topLight.position.set(0, 20, 0);
        this.scene.add(topLight);

        // Bottom light - gentle illumination from below to prevent dark undersides
        const bottomLight = new THREE.DirectionalLight(0x808080, 0.4);
        bottomLight.position.set(0, -10, 0);
        this.scene.add(bottomLight);

        // Subtle point lights for local detail enhancement
        const pointLight1 = new THREE.PointLight(0xffffff, 0.6, 50);
        pointLight1.position.set(12, 8, 12);
        this.scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0xffffff, 0.6, 50);
        pointLight2.position.set(-12, 8, 12);
        this.scene.add(pointLight2);
    }


    setupEventListeners() {
        // Reset button
        document.getElementById('reset-btn').addEventListener('click', () => this.resetView());

        // Exit button
        document.getElementById('exit-btn').addEventListener('click', () => this.exitApp());

        // Auto rotate button
        document.getElementById('rotate-btn').addEventListener('click', () => this.toggleAutoRotate());

        // Holo mode button
        document.getElementById('holo-btn').addEventListener('click', () => this.toggleHoloMode());

        // Wireframe button
        document.getElementById('wireframe-btn').addEventListener('click', () => this.toggleWireframe());

        // Load button
        document.getElementById('load-btn').addEventListener('click', () => {
            console.log('Load button clicked');
            this.showModelList();
        });

        // Close list button
        document.getElementById('close-list').addEventListener('click', () => this.hideModelList());

        // HARM button
        document.getElementById('harm-btn').addEventListener('click', () => this.toggleHARM());

        // STT: UI button removed (STT always-on). Keep toggleSTT safe if referenced elsewhere.

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // Lazy-initialize tracking on first interaction (Satisfies browser User-Gesture requirement)
        const initOnInteraction = () => {
            console.log('First user interaction detected, initializing systems...');
            this.initializeHandTracking();

            // Try starting STT as well in case auto-start failed
            if (!this.sttActive) this.startSTT();

            document.removeEventListener('click', initOnInteraction);
            document.removeEventListener('touchstart', initOnInteraction);
        };
        document.addEventListener('click', initOnInteraction);
        document.addEventListener('touchstart', initOnInteraction);
    }

    async loadModelList() {
        try {
            console.log('Fetching models from API...');
            const response = await fetch('/api/models');
            const data = await response.json();
            console.log('Models received from API:', data.models);
            this.models = data.models || [];
            this.renderModelList();
        } catch (error) {
            console.error('Error loading models:', error);
            this.updateStatus('Error loading model list');
        }
    }

    renderModelList() {
        const container = document.getElementById('model-items');
        if (!container) {
            console.error('Model items container not found!');
            return;
        }

        container.innerHTML = '';
        console.log('Rendering', this.models.length, 'models to UI');

        if (!this.models || this.models.length === 0) {
            container.innerHTML = '<div style="color: #ff0000; text-align: center; padding: 20px;">No models found in 3D Models folder</div>';
            return;
        }

        this.models.forEach(model => {
            const item = document.createElement('div');
            item.className = 'model-item';
            item.textContent = model.name;
            item.addEventListener('click', () => this.loadModel(model.name));
            container.appendChild(item);
        });
        console.log('Model list rendering complete');
    }

    showModelList() {
        console.log('Showing model list');
        const modelList = document.getElementById('model-list');
        console.log('Model list element:', modelList);
        modelList.classList.add('active');
        this.updateStatus('Select a model');
    }

    hideModelList() {
        document.getElementById('model-list').classList.remove('active');
        this.updateStatus('Ready');
    }

    async loadModel(modelName) {
        this.hideModelList();
        this.showLoading(true);
        this.updateStatus(`Loading ${modelName}...`);

        try {
            // Remove current model
            if (this.currentModel) {
                this.scene.remove(this.currentModel);
                this.currentModel = null;
            }

            // Get model files
            const response = await fetch(`/api/model/${encodeURIComponent(modelName)}`);
            const files = await response.json();

            if (!files.obj) {
                throw new Error('No OBJ file found');
            }

            // Load MTL first if available
            if (files.mtl) {
                const mtlLoader = new THREE.MTLLoader();
                const materials = await new Promise((resolve, reject) => {
                    mtlLoader.load(
                        files.mtl,
                        resolve,
                        undefined,
                        reject
                    );
                });
                materials.preload();

                // Load OBJ with materials
                const objLoader = new THREE.OBJLoader();
                objLoader.setMaterials(materials);

                this.currentModel = await new Promise((resolve, reject) => {
                    objLoader.load(
                        files.obj,
                        resolve,
                        (xhr) => {
                            const percent = (xhr.loaded / xhr.total * 100).toFixed(0);
                            this.updateStatus(`Loading ${modelName}... ${percent}%`);
                        },
                        reject
                    );
                });
            } else {
                // Load OBJ without materials
                const objLoader = new THREE.OBJLoader();
                this.currentModel = await new Promise((resolve, reject) => {
                    objLoader.load(
                        files.obj,
                        resolve,
                        (xhr) => {
                            const percent = (xhr.loaded / xhr.total * 100).toFixed(0);
                            this.updateStatus(`Loading ${modelName}... ${percent}%`);
                        },
                        reject
                    );
                });

                // Apply default material
                this.currentModel.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.material = new THREE.MeshStandardMaterial({
                            color: 0x00d9ff,
                            metalness: 0.7,
                            roughness: 0.3
                        });
                    }
                });
            }

            // Center and scale model
            this.centerModel();

            // Store original materials
            this.storeOriginalMaterials();

            // Apply holo effect if active
            if (this.holoMode) {
                this.applyHoloEffect();
            }

            // Apply wireframe if active
            if (this.wireframeMode) {
                this.applyWireframe();
            }

            this.scene.add(this.currentModel);
            this.updateStatus(`${modelName} loaded successfully`);

        } catch (error) {
            console.error('Error loading model:', error);
            this.updateStatus('Error loading model');
        } finally {
            this.showLoading(false);
        }
    }

    centerModel() {
        if (!this.currentModel) return;

        // Calculate bounding box
        const box = new THREE.Box3().setFromObject(this.currentModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        // Center the model at world origin (0, 0, 0)
        this.currentModel.position.x = -center.x;
        this.currentModel.position.y = -center.y;
        this.currentModel.position.z = -center.z;

        // Scale to a consistent large size (5 units)
        const maxDim = Math.max(size.x, size.y, size.z);
        const targetSize = 5; // Fixed display size
        const scale = targetSize / maxDim;
        this.currentModel.scale.setScalar(scale);

        // Position camera at a fixed optimal distance
        const cameraDistance = 8; // Fixed camera distance
        this.camera.position.set(cameraDistance, cameraDistance * 0.4, cameraDistance);

        // Always look at center
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }

    resetView() {
        if (this.currentModel) {
            this.centerModel();
        }
        this.autoRotate = false;
        document.getElementById('rotate-btn').classList.remove('active');
        this.updateStatus('View reset');
    }

    toggleAutoRotate() {
        this.autoRotate = !this.autoRotate;
        const btn = document.getElementById('rotate-btn');

        if (this.autoRotate) {
            btn.classList.add('active');
            this.updateStatus('Auto-rotate enabled');
        } else {
            btn.classList.remove('active');
            this.updateStatus('Auto-rotate disabled');
        }
    }

    toggleHoloMode() {
        this.holoMode = !this.holoMode;
        const btn = document.getElementById('holo-btn');

        if (this.holoMode) {
            btn.classList.add('active');
            if (this.wireframeMode) {
                // If wireframe is active, update to blue wireframe
                this.applyWireframe();
            } else {
                // Otherwise just apply blue solid
                this.applyHoloEffect();
            }
            this.updateStatus('Hologram mode activated');
        } else {
            btn.classList.remove('active');
            if (this.wireframeMode) {
                // If wireframe is active, update to original color wireframe
                this.applyWireframe();
            } else {
                // Otherwise restore original materials
                this.removeHoloEffect();
            }
            this.updateStatus('Hologram mode deactivated');
        }
    }

    storeOriginalMaterials() {
        if (!this.currentModel) return;

        this.originalMaterials.clear();
        this.currentModel.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                // Clone the material to preserve original
                this.originalMaterials.set(child.uuid, child.material.clone());
            }
        });
    }

    applyHoloEffect() {
        if (!this.currentModel) return;

        this.currentModel.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                // Just turn the model blue (solid)
                const wasWireframe = child.material.wireframe;
                child.material = new THREE.MeshStandardMaterial({
                    color: 0x00d9ff,
                    metalness: 0.7,
                    roughness: 0.3,
                    wireframe: wasWireframe
                });
            }
        });
    }

    removeHoloEffect() {
        if (!this.currentModel) return;

        this.currentModel.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                // Restore original material
                const originalMaterial = this.originalMaterials.get(child.uuid);
                if (originalMaterial) {
                    const wasWireframe = child.material.wireframe;
                    child.material = originalMaterial.clone();
                    child.material.wireframe = wasWireframe;
                }
            }
        });
    }

    toggleWireframe() {
        this.wireframeMode = !this.wireframeMode;
        const btn = document.getElementById('wireframe-btn');

        if (this.wireframeMode) {
            btn.classList.add('active');
            this.applyWireframe();
            this.updateStatus('Wireframe mode enabled');
        } else {
            btn.classList.remove('active');
            this.removeWireframe();
            this.updateStatus('Wireframe mode disabled');
        }
    }

    applyWireframe() {
        if (!this.currentModel) return;

        this.currentModel.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                if (this.holoMode) {
                    // Blue wireframe when holo mode is on
                    child.material = new THREE.MeshBasicMaterial({
                        color: 0x00d9ff,
                        wireframe: true,
                        transparent: true,
                        opacity: 0.8
                    });
                } else {
                    // Original color wireframe when holo mode is off
                    const originalMaterial = this.originalMaterials.get(child.uuid);
                    if (originalMaterial) {
                        child.material = originalMaterial.clone();
                        child.material.wireframe = true;
                    } else {
                        child.material.wireframe = true;
                    }
                }
            }
        });
    }

    removeWireframe() {
        if (!this.currentModel) return;

        this.currentModel.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                if (this.holoMode) {
                    // Restore blue solid material
                    this.applyHoloEffect();
                } else {
                    // Restore original material
                    const originalMaterial = this.originalMaterials.get(child.uuid);
                    if (originalMaterial) {
                        child.material = originalMaterial.clone();
                    }
                }
            }
        });
    }

    async initializeHandTracking() {
        try {
            if (!this.handTracking) {
                this.handTracking = new HandTrackingManager((gesture) => this.handleGesture(gesture));
                await this.handTracking.initialize();
                console.log('Hand tracking auto-initialized');
            }
        } catch (error) {
            console.error('Failed to auto-initialize hand tracking:', error);
            this.updateStatus('Hand tracking unavailable - check camera permissions');
        }
    }

    toggleHARM() {
        this.harmMode = !this.harmMode;
        const btn = document.getElementById('harm-btn');

        if (this.harmMode) {
            btn.classList.add('active');
            this.updateStatus('H.A.R.M. ONLINE - WEAPON SYSTEMS ACTIVE');
            // Play a small charge sound to indicate activation
            const chargeSound = document.getElementById('repulsor-charge-sound');
            chargeSound.currentTime = 0;
            chargeSound.volume = 0.3;
            chargeSound.play().catch(() => { });
            setTimeout(() => { if (!this.chargingGlows.length) chargeSound.pause(); }, 500);
        } else {
            btn.classList.remove('active');
            this.updateStatus('H.A.R.M. STANDBY - 3D CONTROLS ONLY');
            this.handleRepulsorChargeCancel(); // Cancel any active charge
        }
    }

    handleGesture(gesture) {
        // ALWAYS check for camera/tracking state
        if (!this.handTracking) return;

        if (this.harmMode) {
            // HARM Mode Gestures (Only allowed if harmMode is true)
            switch (gesture.type) {
                case 'clap':
                    this.handleClap();
                    break;
                case 'repulsorChargeStart':
                    this.handleRepulsorChargeStart(gesture);
                    break;
                case 'repulsorFire':
                    this.handleRepulsorFire(gesture);
                    break;
                case 'repulsorChargeCancel':
                    this.handleRepulsorChargeCancel();
                    break;
            }
        } else {
            // 3D Controls (Only allowed if HARM is OFF)
            switch (gesture.type) {
                case 'zoom':
                    this.handlePalmZoom(gesture.delta);
                    break;
                case 'pan':
                    this.handlePan(gesture.deltaX, gesture.deltaY);
                    break;
                case 'rotate':
                    this.handleRotate(gesture.deltaX, gesture.deltaY);
                    break;
                case 'depthZoom':
                    this.handleDepthZoom(gesture.depth);
                    break;
            }
        }
    }

    handlePalmZoom(delta) {
        if (!this.currentModel) return;

        // Zoom camera based on palm distance change
        const zoomSpeed = 10;
        const zoomAmount = delta * zoomSpeed;

        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);

        this.camera.position.addScaledVector(direction, zoomAmount);
        this.controls.update();
    }

    handlePan(deltaX, deltaY) {
        if (!this.currentModel) return;

        // Pan camera based on hand movement
        const panSpeed = 5;

        const right = new THREE.Vector3();
        const up = new THREE.Vector3();

        this.camera.getWorldDirection(right);
        right.cross(this.camera.up).normalize();
        up.copy(this.camera.up);

        this.camera.position.addScaledVector(right, deltaX * panSpeed);
        this.camera.position.addScaledVector(up, deltaY * panSpeed);

        this.controls.target.addScaledVector(right, deltaX * panSpeed);
        this.controls.target.addScaledVector(up, deltaY * panSpeed);

        this.controls.update();
    }

    handleRotate(deltaX, deltaY) {
        if (!this.currentModel) return;

        // Rotate model based on both hands movement
        const rotateSpeed = 3;

        this.currentModel.rotation.y += deltaX * rotateSpeed;
        this.currentModel.rotation.x += deltaY * rotateSpeed;
    }

    handleDepthZoom(depth) {
        if (!this.currentModel) return;

        // Smooth depth-based zoom
        const targetZoom = depth;
        const smoothing = 0.1;

        this.lastDepthZoom = this.lastDepthZoom * (1 - smoothing) + targetZoom * smoothing;

        const zoomSpeed = 0.5;
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);

        this.camera.position.addScaledVector(direction, this.lastDepthZoom * zoomSpeed);
        this.controls.update();
    }

    handleClap() {
        console.log('Clap detected!');

        // Play Iron Man sound
        const audio = document.getElementById('clap-sound');
        audio.currentTime = 0;
        audio.play().catch(e => console.log('Audio play failed:', e));

        // Visual effect
        const effect = document.getElementById('clap-effect');
        effect.classList.add('active');

        // Flash the screen
        setTimeout(() => {
            effect.classList.remove('active');
        }, 300);

        // Status message
        this.updateStatus('⚡ Iron Man Clap Detected! ⚡');

        setTimeout(() => {
            this.updateStatus('Ready');
        }, 2000);
    }

    initParticleSystem() {
        const canvas = document.getElementById('particle-canvas');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        this.particleSystem = new ParticleSystem(canvas);

        window.addEventListener('resize', () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        });
    }

    handleRepulsorChargeStart(data) {
        console.log('Repulsor charging:', data.mode);

        // Play charging sound
        const chargeSound = document.getElementById('repulsor-charge-sound');
        chargeSound.currentTime = 0;
        chargeSound.play().catch(e => console.log('Charge sound failed:', e));

        // Create charging glow(s)
        this.chargingGlows = [];

        if (data.mode === 'single') {
            const glow = this.createChargingGlow(data.position, 'repulsor');
            this.chargingGlows.push(glow);
            this.updateStatus(`⚡ ${data.hand === 'left' ? 'Left' : 'Right'} Repulsor Charging...`);
        } else if (data.mode === 'dual') {
            data.positions.forEach(pos => {
                const glow = this.createChargingGlow(pos, 'repulsor');
                this.chargingGlows.push(glow);
            });
            this.updateStatus('⚡⚡ DUAL REPULSORS CHARGING...');
        } else if (data.mode === 'unibeam') {
            const glow = this.createChargingGlow(data.position, 'unibeam');
            this.chargingGlows.push(glow);
            this.updateStatus('🔆 UNIBEAM CHARGING... 🔆');
        }
    }

    createChargingGlow(position, type) {
        const glow = document.createElement('div');
        glow.className = type === 'unibeam' ? 'unibeam-glow' : 'repulsor-glow';

        // Convert normalized position (0-1) to screen coordinates
        // Invert X to match user's perspective (mirror camera view)
        const screenX = (1 - position.x) * window.innerWidth;
        const screenY = position.y * window.innerHeight;

        const size = type === 'unibeam' ? 250 : 150;
        glow.style.left = `${screenX - size / 2}px`;
        glow.style.top = `${screenY - size / 2}px`;

        document.body.appendChild(glow);
        return glow;
    }

    handleRepulsorFire(data) {
        console.log('Repulsor fired:', data.mode);

        // Remove charging glows
        this.chargingGlows.forEach(glow => glow.remove());
        this.chargingGlows = [];

        // Stop charging sound
        const chargeSound = document.getElementById('repulsor-charge-sound');
        chargeSound.pause();

        if (data.mode === 'single') {
            this.fireSingleRepulsor(data);
        } else if (data.mode === 'dual') {
            this.fireDualRepulsor(data);
        } else if (data.mode === 'unibeam') {
            this.fireUnibeam(data);
        }

        // Set cooldown
        this.repulsorCooldownEnd = Date.now() + 2000;
    }

    fireSingleRepulsor(data) {
        // Play blast sound
        const blastSound = document.getElementById('repulsor-blast-sound');
        blastSound.currentTime = 0;
        blastSound.play().catch(e => console.log('Blast sound failed:', e));

        // Screen flash
        const effect = document.getElementById('clap-effect');
        effect.classList.add('active');
        setTimeout(() => effect.classList.remove('active'), 200);

        // Particle burst
        const screenX = (1 - data.position.x) * window.innerWidth;
        const screenY = data.position.y * window.innerHeight;
        this.particleSystem.createBurst(screenX, screenY, 50, '#00d9ff');

        // Camera shake
        document.body.classList.add('shake');
        setTimeout(() => document.body.classList.remove('shake'), 500);

        // Push model back
        if (this.currentModel) {
            const pushDirection = new THREE.Vector3(
                (data.position.x - 0.5) * 2,
                -(data.position.y - 0.5) * 2,
                -1
            ).normalize();

            const pushAmount = 2;
            this.currentModel.position.addScaledVector(pushDirection, pushAmount);

            // Spin model
            this.currentModel.rotation.x += 0.5;
            this.currentModel.rotation.y += 0.3;

            // Reset after animation
            setTimeout(() => {
                if (this.currentModel) {
                    this.centerModel();
                }
            }, 1000);
        }

        this.updateStatus(`💥 ${data.hand === 'left' ? 'LEFT' : 'RIGHT'} REPULSOR BLAST!`);
        setTimeout(() => this.updateStatus('Ready'), 2000);
    }

    fireDualRepulsor(data) {
        // Play blast sound
        const blastSound = document.getElementById('repulsor-blast-sound');
        blastSound.currentTime = 0;
        blastSound.volume = 1.0; // Max volume for dual
        blastSound.play().catch(e => console.log('Blast sound failed:', e));

        // Stronger screen flash
        const effect = document.getElementById('clap-effect');
        effect.style.background = 'radial-gradient(circle, rgba(0, 217, 255, 0.6) 0%, transparent 70%)';
        effect.classList.add('active');
        setTimeout(() => {
            effect.classList.remove('active');
            effect.style.background = 'radial-gradient(circle, rgba(0, 217, 255, 0.3) 0%, transparent 70%)';
        }, 300);

        // Dual particle bursts
        data.positions.forEach(pos => {
            const screenX = (1 - pos.x) * window.innerWidth;
            const screenY = pos.y * window.innerHeight;
            this.particleSystem.createBurst(screenX, screenY, 80, '#00d9ff');
        });

        // Stronger camera shake
        document.body.classList.add('shake');
        setTimeout(() => document.body.classList.remove('shake'), 500);

        // Push model back harder and spin
        if (this.currentModel) {
            const pushDirection = new THREE.Vector3(0, 0, -1);
            const pushAmount = 4;
            this.currentModel.position.addScaledVector(pushDirection, pushAmount);

            // Tumble spin
            this.currentModel.rotation.x += 1.5;
            this.currentModel.rotation.y += 1.0;
            this.currentModel.rotation.z += 0.5;

            setTimeout(() => {
                if (this.currentModel) {
                    this.centerModel();
                }
            }, 1500);
        }

        this.updateStatus('💥💥 DUAL REPULSOR BLAST! 💥💥');
        setTimeout(() => this.updateStatus('Ready'), 2500);
    }

    fireUnibeam(data) {
        // Play unibeam sound
        const unibeamSound = document.getElementById('unibeam-sound');
        unibeamSound.currentTime = 0;
        unibeamSound.play().catch(e => console.log('Unibeam sound failed:', e));

        // Massive white flash
        const effect = document.getElementById('clap-effect');
        effect.style.background = 'radial-gradient(circle, rgba(255, 255, 255, 0.9) 0%, rgba(0, 217, 255, 0.5) 50%, transparent 80%)';
        effect.classList.add('active');

        // Massive particle explosion
        const screenX = (1 - data.position.x) * window.innerWidth;
        const screenY = data.position.y * window.innerHeight;
        this.particleSystem.createBurst(screenX, screenY, 200, '#ffffff');

        setTimeout(() => {
            this.particleSystem.createBurst(screenX, screenY, 150, '#00d9ff');
        }, 100);

        // Extreme camera shake
        document.body.classList.add('shake');
        setTimeout(() => document.body.classList.remove('shake'), 800);

        // OBLITERATE MODEL
        if (this.currentModel) {
            // Explode model into particles
            const modelPos = new THREE.Vector3();
            this.currentModel.getWorldPosition(modelPos);

            // Project 3D position to screen
            const screenPos = modelPos.clone().project(this.camera);
            const modelScreenX = (screenPos.x + 1) / 2 * window.innerWidth;
            const modelScreenY = (-screenPos.y + 1) / 2 * window.innerHeight;

            // Create explosion at model
            for (let i = 0; i < 5; i++) {
                setTimeout(() => {
                    this.particleSystem.createBurst(modelScreenX, modelScreenY, 100, '#ff6600');
                }, i * 100);
            }

            // Remove model
            this.scene.remove(this.currentModel);
            const modelName = this.currentModel.userData.name || 'Model';
            this.currentModel = null;

            // Respawn after delay
            setTimeout(() => {
                this.updateStatus(`Respawning ${modelName}...`);
                // Model will need to be reloaded manually
            }, 3000);
        }

        setTimeout(() => {
            effect.classList.remove('active');
            effect.style.background = 'radial-gradient(circle, rgba(0, 217, 255, 0.3) 0%, transparent 70%)';
        }, 1500);

        this.updateStatus('🔆🔆🔆 UNIBEAM OBLITERATION! 🔆🔆🔆');
        setTimeout(() => this.updateStatus('Ready'), 3000);
    }

    handleRepulsorChargeCancel() {
        // Remove charging glows
        this.chargingGlows.forEach(glow => glow.remove());
        this.chargingGlows = [];

        // Stop charging sound
        const chargeSound = document.getElementById('repulsor-charge-sound');
        chargeSound.pause();
        chargeSound.currentTime = 0;
    }

    async toggleSTT() {
        // Toggle kept for compatibility, but STT is intended to be always-on.
        if (!this.sttActive) {
            await this.startSTT();
        } else {
            // Attempt to stop only if explicitly requested elsewhere
            try {
                await fetch('/api/stt/stop', { method: 'POST' });
                this.sttActive = false;
                this.updateStatus('Voice control deactivated');
            } catch (error) {
                console.error('Error stopping STT:', error);
            }
        }
    }

    async startSTT() {
        if (this.sttActive) return;

        try {
            const response = await fetch('/api/stt/start', { method: 'POST' });
            const data = await response.json();

            if (data.status === 'started' || data.status === 'already_running') {
                this.sttActive = true;
                this.updateStatus('Voice control active');
            }
        } catch (error) {
            console.error('Error starting STT:', error);
            this.updateStatus('Voice control unavailable');
        }
    }

    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/stt`;

        this.websocket = new WebSocket(wsUrl);

        this.websocket.onopen = () => {
            console.log('WebSocket connected');
            // Start STT automatically when websocket is ready
            this.startSTT();
        };

        this.websocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleVoiceCommand(data);
        };

        this.websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        this.websocket.onclose = () => {
            console.log('WebSocket closed, reconnecting...');
            setTimeout(() => this.connectWebSocket(), 3000);
        };
    }

    handleVoiceCommand(command) {
        console.log('Voice command:', command);

        switch (command.action) {
            case 'reset':
                this.resetView();
                break;

            case 'auto_rotate':
                if (command.value !== undefined) {
                    this.autoRotate = command.value;
                    const btn = document.getElementById('rotate-btn');
                    if (this.autoRotate) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                } else {
                    this.toggleAutoRotate();
                }
                break;

            case 'holo_mode':
                this.toggleHoloMode();
                break;

            case 'wireframe':
                this.toggleWireframe();
                break;

            case 'exit':
                this.exitApp();
                break;

            case 'load_model':
                if (command.model) {
                    this.loadModel(command.model);
                } else {
                    this.showModelList();
                }
                break;

            case 'harm_mode':
                this.toggleHARM();
                break;

            default:
                if (command.text) {
                    this.updateStatus(`Voice: ${command.text}`);
                }
        }
    }

    handleKeyboard(event) {
        switch (event.key.toLowerCase()) {
            case 'r':
                this.resetView();
                break;
            case 'a':
                this.toggleAutoRotate();
                break;
            case 'h':
                this.toggleHoloMode();
                break;
            case 'w':
                this.toggleWireframe();
                break;
            case 'l':
                this.showModelList();
                break;
            case 'escape':
                if (document.getElementById('model-list').classList.contains('active')) {
                    this.hideModelList();
                } else {
                    this.exitApp();
                }
                break;
        }
    }

    exitApp() {
        if (confirm('Are you sure you want to exit?')) {
            window.close();
            // If window.close() doesn't work (browser restriction)
            this.updateStatus('Application terminated');
            document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#00d9ff;font-size:32px;font-family:Orbitron;">HoloView Terminated</div>';
        }
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        if (show) {
            loading.classList.add('active');
        } else {
            loading.classList.remove('active');
        }
    }

    updateStatus(message) {
        document.getElementById('status').textContent = message;
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // Auto-rotate if enabled
        if (this.autoRotate && this.currentModel) {
            this.currentModel.rotation.y += 0.005;
        }

        // Update controls
        this.controls.update();

        // Update particle system
        if (this.particleSystem) {
            this.particleSystem.update();
        }

        // Render scene
        this.renderer.render(this.scene, this.camera);
    }
}

// Particle System for Repulsor Effects
class ParticleSystem {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
    }

    createBurst(x, y, count, color) {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
            const speed = 2 + Math.random() * 8;

            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                decay: 0.01 + Math.random() * 0.02,
                size: 3 + Math.random() * 5,
                color: color
            });
        }
    }

    update() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Update and draw particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            // Update position
            p.x += p.vx;
            p.y += p.vy;

            // Apply gravity
            p.vy += 0.2;

            // Decay
            p.life -= p.decay;

            // Remove dead particles
            if (p.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            // Draw particle
            this.ctx.globalAlpha = p.life;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
            this.ctx.fill();

            // Glow effect
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = p.color;
        }

        this.ctx.globalAlpha = 1.0;
        this.ctx.shadowBlur = 0;
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    const holoView = new HoloView();

    // Check if running in desktop app (pywebview sets a user agent)
    const isDesktopApp = navigator.userAgent.includes('pywebview');

    // Only request fullscreen if NOT running as desktop app
    if (!isDesktopApp && document.body.requestFullscreen) {
        document.body.requestFullscreen().catch(err => {
            console.log('Fullscreen not available:', err);
        });
    }
});
