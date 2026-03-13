// ========================================
// HoloView - Hand Tracking Module
// MediaPipe Hands Integration
// ========================================

class HandTrackingManager {
    constructor(onGestureCallback) {
        this.onGesture = onGestureCallback;
        this.hands = null;
        this.camera = null;
        this.videoElement = null;
        this.canvasElement = null;
        this.canvasCtx = null;

        // Gesture state
        this.previousHandData = null;
        this.gestureState = {
            leftPinched: false,
            rightPinched: false,
            bothPalmsOpen: false,
            lastClapTime: 0,
            lastGestureTime: 0,
            // Repulsor states
            leftRepulsorStartTime: 0,
            rightRepulsorStartTime: 0,
            unibeamStartTime: 0,
            lastRepulsorTime: 0,
            repulsorCooldown: 2000, // 2 second cooldown
            isCharging: false,
            chargingType: null // 'single', 'dual', 'unibeam'
        };

        // Smoothing
        this.smoothedDepth = 0;
        this.smoothedDistance = 0;
        this.smoothingAlpha = 0.3;

        // Thresholds
        this.PINCH_THRESHOLD = 0.05;
        this.CLAP_DISTANCE_THRESHOLD = 0.15;
        this.CLAP_VELOCITY_THRESHOLD = 0.3;
        this.GESTURE_COOLDOWN = 200; // ms
        this.PALM_OPEN_THRESHOLD = 0.02; // fingertip above knuckle
        this.FIST_THRESHOLD = 0.08; // All fingers close to palm
        this.PALM_FORWARD_THRESHOLD = 0.015;

        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            // Create video element for camera feed
            this.videoElement = document.createElement('video');
            this.videoElement.style.display = 'none';
            document.body.appendChild(this.videoElement);

            // Initialize MediaPipe Hands
            this.hands = new Hands({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
                }
            });

            this.hands.setOptions({
                maxNumHands: 2,
                modelComplexity: 1,
                minDetectionConfidence: 0.7,
                minTrackingConfidence: 0.5
            });

            this.hands.onResults((results) => this.onResults(results));

            // Initialize camera
            this.camera = new Camera(this.videoElement, {
                onFrame: async () => {
                    await this.hands.send({ image: this.videoElement });
                },
                width: 640,
                height: 480
            });

            await this.camera.start();
            this.isInitialized = true;

            console.log('Hand tracking initialized');
        } catch (error) {
            console.error('Failed to initialize hand tracking:', error);
            throw error;
        }
    }

    stop() {
        if (this.camera) {
            this.camera.stop();
        }
        if (this.videoElement) {
            this.videoElement.remove();
        }
        this.isInitialized = false;
    }

    onResults(results) {
        if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
            this.previousHandData = null;
            return;
        }

        const currentTime = Date.now();
        const hands = this.processHands(results);

        // Detect gestures
        if (hands.left && hands.right) {
            this.detectTwoHandGestures(hands, currentTime);
        } else if (hands.left || hands.right) {
            this.detectOneHandGestures(hands, currentTime);
        }

        this.previousHandData = hands;
    }

    processHands(results) {
        const hands = { left: null, right: null };

        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            const landmarks = results.multiHandLandmarks[i];
            const handedness = results.multiHandedness[i].label; // "Left" or "Right"
            const side = handedness.toLowerCase();

            // Simple palm forward check
            const isPalmForward = this.detectPalmForward(landmarks, handedness);

            const handData = {
                landmarks: landmarks,
                isPinched: this.detectPinch(landmarks),
                isPalmOpen: this.detectPalmOpen(landmarks),
                isPalmForward: isPalmForward,
                isFist: this.detectFist(landmarks),
                center: this.getHandCenter(landmarks),
                depth: this.getHandDepth(landmarks)
            };


            if (handedness === 'Left') {
                hands.left = handData;
            } else {
                hands.right = handData;
            }
        }

        return hands;
    }

    detectPinch(landmarks) {
        // Calculate distance between thumb tip (4) and index tip (8)
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];

        const distance = Math.sqrt(
            Math.pow(thumbTip.x - indexTip.x, 2) +
            Math.pow(thumbTip.y - indexTip.y, 2) +
            Math.pow(thumbTip.z - indexTip.z, 2)
        );

        return distance < this.PINCH_THRESHOLD;
    }

    detectPalmOpen(landmarks) {
        // Check if all fingertips are above (lower y value) their respective knuckles
        const fingerPairs = [
            [8, 6],   // Index: tip vs PIP joint
            [12, 10], // Middle: tip vs PIP joint
            [16, 14], // Ring: tip vs PIP joint
            [20, 18]  // Pinky: tip vs PIP joint
        ];

        let openFingers = 0;
        for (const [tipIdx, knuckleIdx] of fingerPairs) {
            const tip = landmarks[tipIdx];
            const knuckle = landmarks[knuckleIdx];

            // Fingertip should be extended (y is lower, and some distance away)
            if (tip.y < knuckle.y - this.PALM_OPEN_THRESHOLD) {
                openFingers++;
            }
        }

        // Consider palm open if at least 3 fingers are extended
        return openFingers >= 3;
    }

    getHandCenter(landmarks) {
        // Use wrist (0) and middle finger base (9) average
        const wrist = landmarks[0];
        const middleBase = landmarks[9];

        return {
            x: (wrist.x + middleBase.x) / 2,
            y: (wrist.y + middleBase.y) / 2,
            z: (wrist.z + middleBase.z) / 2
        };
    }

    getHandDepth(landmarks) {
        // Use wrist z-coordinate as depth
        return landmarks[0].z;
    }

    detectTwoHandGestures(hands, currentTime) {
        const { left, right } = hands;

        // Detect clap gesture
        this.detectClap(left, right, currentTime);

        // Detect zoom with both palms open
        // Mutual Exclusivity: Only zoom if NOT both palms are clearly facing the camera
        const bothForward = left.isPalmForward && right.isPalmForward;
        if (left.isPalmOpen && right.isPalmOpen && !bothForward) {
            this.detectPalmZoom(left, right);
            this.gestureState.bothPalmsOpen = true;
        } else {
            this.gestureState.bothPalmsOpen = false;
        }

        // Detect rotation with both hands pinched
        if (left.isPinched && right.isPinched) {
            this.detectTwoHandRotation(left, right, currentTime);
            this.gestureState.leftPinched = true;
            this.gestureState.rightPinched = true;
        } else {
            this.gestureState.leftPinched = left.isPinched;
            this.gestureState.rightPinched = right.isPinched;
        }

        // Depth-based zoom
        this.detectDepthZoom(left, right);

        // Detect repulsor gestures
        this.detectRepulsorGestures(hands, currentTime);
    }

    detectOneHandGestures(hands, currentTime) {
        const hand = hands.left || hands.right;

        // Detect pan with one hand pinched
        if (hand.isPinched && this.previousHandData) {
            const prevHand = this.previousHandData.left || this.previousHandData.right;
            if (prevHand && prevHand.isPinched) {
                this.detectPan(hand, prevHand);
            }
        }

        // Depth-based zoom with single hand
        this.detectDepthZoom(hand, null);

        // Detect single repulsor
        this.detectRepulsorGestures(hands, currentTime);
    }

    detectPalmZoom(leftHand, rightHand) {
        if (!this.previousHandData || !this.previousHandData.left || !this.previousHandData.right) {
            return;
        }

        // Calculate current distance between hands
        const currentDistance = Math.sqrt(
            Math.pow(leftHand.center.x - rightHand.center.x, 2) +
            Math.pow(leftHand.center.y - rightHand.center.y, 2)
        );

        // Calculate previous distance
        const prevDistance = Math.sqrt(
            Math.pow(this.previousHandData.left.center.x - this.previousHandData.right.center.x, 2) +
            Math.pow(this.previousHandData.left.center.y - this.previousHandData.right.center.y, 2)
        );

        // Smooth the distance
        this.smoothedDistance = this.smoothedDistance * (1 - this.smoothingAlpha) +
            currentDistance * this.smoothingAlpha;

        const delta = currentDistance - prevDistance;

        // Inverted: spread = zoom in, contract = zoom out
        if (Math.abs(delta) > 0.01) {
            this.onGesture({
                type: 'zoom',
                delta: delta * 5 // Scale factor
            });
        }
    }

    detectPan(currentHand, previousHand) {
        const deltaX = (currentHand.center.x - previousHand.center.x) * 2;
        const deltaY = (currentHand.center.y - previousHand.center.y) * 2;

        if (Math.abs(deltaX) > 0.001 || Math.abs(deltaY) > 0.001) {
            this.onGesture({
                type: 'pan',
                deltaX: deltaX,
                deltaY: deltaY
            });
        }
    }

    detectTwoHandRotation(leftHand, rightHand, currentTime) {
        if (!this.previousHandData || !this.previousHandData.left || !this.previousHandData.right) {
            return;
        }

        // Calculate average movement of both hands
        const avgDeltaX = ((leftHand.center.x - this.previousHandData.left.center.x) +
            (rightHand.center.x - this.previousHandData.right.center.x)) / 2;
        const avgDeltaY = ((leftHand.center.y - this.previousHandData.left.center.y) +
            (rightHand.center.y - this.previousHandData.right.center.y)) / 2;

        if (Math.abs(avgDeltaX) > 0.001 || Math.abs(avgDeltaY) > 0.001) {
            this.onGesture({
                type: 'rotate',
                deltaX: avgDeltaX * 3,
                deltaY: avgDeltaY * 3
            });
        }
    }

    detectDepthZoom(hand1, hand2) {
        // Use average depth of available hands
        let avgDepth;
        if (hand1 && hand2) {
            avgDepth = (hand1.depth + hand2.depth) / 2;
        } else if (hand1) {
            avgDepth = hand1.depth;
        } else {
            return;
        }

        // Smooth the depth
        this.smoothedDepth = this.smoothedDepth * (1 - this.smoothingAlpha) +
            avgDepth * this.smoothingAlpha;

        // Map depth to zoom (-0.5 to 0.5 range typically)
        // Closer (negative) = zoom in, farther (positive) = zoom out
        this.onGesture({
            type: 'depthZoom',
            depth: -this.smoothedDepth * 2 // Invert and scale
        });
    }

    detectClap(leftHand, rightHand, currentTime) {
        // Cooldown check
        if (currentTime - this.gestureState.lastClapTime < 1000) {
            return;
        }

        // Calculate distance between hand centers
        const distance = Math.sqrt(
            Math.pow(leftHand.center.x - rightHand.center.x, 2) +
            Math.pow(leftHand.center.y - rightHand.center.y, 2) +
            Math.pow(leftHand.center.z - rightHand.center.z, 2)
        );

        // Calculate velocity if we have previous data
        if (this.previousHandData && this.previousHandData.left && this.previousHandData.right) {
            const prevDistance = Math.sqrt(
                Math.pow(this.previousHandData.left.center.x - this.previousHandData.right.center.x, 2) +
                Math.pow(this.previousHandData.left.center.y - this.previousHandData.right.center.y, 2) +
                Math.pow(this.previousHandData.left.center.z - this.previousHandData.right.center.z, 2)
            );

            const velocity = Math.abs(prevDistance - distance);

            // Detect clap: hands close together with high velocity
            if (distance < this.CLAP_DISTANCE_THRESHOLD && velocity > this.CLAP_VELOCITY_THRESHOLD) {
                this.gestureState.lastClapTime = currentTime;
                this.onGesture({
                    type: 'clap'
                });
            }
        }
    }

    detectPalmForward(landmarks, handedness) {
        // Simpler 2D Cross Product check for palm vs back
        const wrist = landmarks[0];
        const indexBase = landmarks[5];
        const pinkyBase = landmarks[17];

        const v1 = { x: indexBase.x - wrist.x, y: indexBase.y - wrist.y };
        const v2 = { x: pinkyBase.x - wrist.x, y: pinkyBase.y - wrist.y };

        const crossProduct = v1.x * v2.y - v1.y * v2.x;

        // Check if palm is facing camera based on winding order
        if (handedness === 'Right') {
            return crossProduct < -this.PALM_FORWARD_THRESHOLD;
        } else {
            return crossProduct > this.PALM_FORWARD_THRESHOLD;
        }
    }

    detectFist(landmarks) {
        // Check if all fingertips are close to palm center
        const palmCenter = landmarks[0]; // wrist as reference
        const fingertips = [4, 8, 12, 16, 20]; // thumb, index, middle, ring, pinky

        let closedFingers = 0;
        for (const tipIdx of fingertips) {
            const tip = landmarks[tipIdx];
            const distance = Math.sqrt(
                Math.pow(tip.x - palmCenter.x, 2) +
                Math.pow(tip.y - palmCenter.y, 2)
            );

            if (distance < this.FIST_THRESHOLD) {
                closedFingers++;
            }
        }

        // Consider fist if at least 4 fingers are closed
        return closedFingers >= 4;
    }

    detectRepulsorGestures(hands, currentTime) {
        const { left, right } = hands;

        // Check weapon cooldown
        if (currentTime - this.gestureState.lastRepulsorTime < this.gestureState.repulsorCooldown) {
            return;
        }

        // 1. UNIBEAM (Highest Priority)
        if (left && right && left.isFist && right.isFist) {
            const distance = Math.sqrt(
                Math.pow(left.center.x - right.center.x, 2) +
                Math.pow(left.center.y - right.center.y, 2)
            );

            if (distance < 0.2) {
                if (this.gestureState.unibeamStartTime === 0) {
                    this.gestureState.unibeamStartTime = currentTime;
                    this.gestureState.isCharging = true;
                    this.gestureState.chargingType = 'unibeam';
                    this.onGesture({
                        type: 'repulsorChargeStart',
                        mode: 'unibeam',
                        position: {
                            x: (left.center.x + right.center.x) / 2,
                            y: (left.center.y + right.center.y) / 2
                        }
                    });
                } else if (currentTime - this.gestureState.unibeamStartTime >= 1500) {
                    this.gestureState.lastRepulsorTime = currentTime;
                    this.gestureState.unibeamStartTime = 0;
                    this.gestureState.isCharging = false;
                    this.gestureState.chargingType = null;
                    this.onGesture({
                        type: 'repulsorFire',
                        mode: 'unibeam',
                        position: {
                            x: (left.center.x + right.center.x) / 2,
                            y: (left.center.y + right.center.y) / 2
                        }
                    });
                }
                return;
            }
        }

        // Reset unibeam if not meeting conditions
        if (this.gestureState.unibeamStartTime > 0) {
            this.gestureState.unibeamStartTime = 0;
            if (this.gestureState.chargingType === 'unibeam') {
                this.gestureState.isCharging = false;
                this.gestureState.chargingType = null;
                this.onGesture({ type: 'repulsorChargeCancel' });
            }
        }

        // 2. DUAL REPULSOR (High Priority)
        const leftPalmForward = left && left.isPalmOpen && left.isPalmForward;
        const rightPalmForward = right && right.isPalmOpen && right.isPalmForward;

        if (leftPalmForward && rightPalmForward) {
            if (this.gestureState.leftRepulsorStartTime === 0 || this.gestureState.rightRepulsorStartTime === 0 || this.gestureState.chargingType !== 'dual') {
                this.gestureState.leftRepulsorStartTime = currentTime;
                this.gestureState.rightRepulsorStartTime = currentTime;
                this.gestureState.isCharging = true;
                this.gestureState.chargingType = 'dual';
                this.onGesture({
                    type: 'repulsorChargeStart',
                    mode: 'dual',
                    positions: [
                        { x: left.center.x, y: left.center.y },
                        { x: right.center.x, y: right.center.y }
                    ]
                });
            } else if (currentTime - this.gestureState.leftRepulsorStartTime >= 1000) {
                this.gestureState.lastRepulsorTime = currentTime;
                this.gestureState.leftRepulsorStartTime = 0;
                this.gestureState.rightRepulsorStartTime = 0;
                this.gestureState.isCharging = false;
                this.gestureState.chargingType = null;
                this.onGesture({
                    type: 'repulsorFire',
                    mode: 'dual',
                    positions: [
                        { x: left.center.x, y: left.center.y },
                        { x: right.center.x, y: right.center.y }
                    ]
                });
            }
            return;
        } else {
            // Reset dual state if we were charging dual but no longer have both palms forward
            if (this.gestureState.chargingType === 'dual') {
                this.gestureState.leftRepulsorStartTime = 0;
                this.gestureState.rightRepulsorStartTime = 0;
                this.gestureState.isCharging = false;
                this.gestureState.chargingType = null;
                this.onGesture({ type: 'repulsorChargeCancel' });
            }
        }

        // 3. SINGLE REPULSOR (Low Priority)
        // Check Left Hand
        if (leftPalmForward) {
            this.handleSingleHandCharge('left', left, currentTime);
        } else {
            this.resetSingleHandCharge('left');
        }

        // Check Right Hand
        if (rightPalmForward) {
            this.handleSingleHandCharge('right', right, currentTime);
        } else {
            this.resetSingleHandCharge('right');
        }
    }

    handleSingleHandCharge(side, handData, currentTime) {
        const startTimeKey = side === 'left' ? 'leftRepulsorStartTime' : 'rightRepulsorStartTime';

        if (this.gestureState[startTimeKey] === 0) {
            this.gestureState[startTimeKey] = currentTime;
            this.gestureState.isCharging = true;
            this.gestureState.chargingType = 'single';
            this.onGesture({
                type: 'repulsorChargeStart',
                mode: 'single',
                hand: side,
                position: { x: handData.center.x, y: handData.center.y }
            });
        } else if (currentTime - this.gestureState[startTimeKey] >= 1000) {
            this.gestureState.lastRepulsorTime = currentTime;
            this.gestureState[startTimeKey] = 0;
            this.gestureState.isCharging = false;
            this.gestureState.chargingType = null;
            this.onGesture({
                type: 'repulsorFire',
                mode: 'single',
                hand: side,
                position: { x: handData.center.x, y: handData.center.y }
            });
        }
    }

    resetSingleHandCharge(side) {
        const startTimeKey = side === 'left' ? 'leftRepulsorStartTime' : 'rightRepulsorStartTime';
        if (this.gestureState[startTimeKey] > 0) {
            this.gestureState[startTimeKey] = 0;
            // Only fire cancel if we were actually in 'single' mode
            if (this.gestureState.chargingType === 'single') {
                this.gestureState.isCharging = false;
                this.gestureState.chargingType = null;
                this.onGesture({ type: 'repulsorChargeCancel' });
            }
        }
    }
}
