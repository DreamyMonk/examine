
"use client";

import { useEffect, useRef, useState, useCallback } from 'react';

// Suspicious objects that indicate cheating
const CHEATING_OBJECTS = ['cell phone', 'book', 'laptop', 'remote'];
const CHEATING_LABELS: Record<string, string> = {
    'cell phone': '📱 Phone detected',
    'book': '📖 Book detected',
    'laptop': '💻 Secondary device detected',
    'remote': '📱 Suspicious device detected',
};

interface AIProctorOptions {
    isActive: boolean;
    videoElement: HTMLVideoElement | null;
    onFaceWarning: (message: string) => void;       // Soft notification for face issues
    onCheatWarning: (object: string, message: string) => void; // Cheating violation for objects
    checkIntervalMs?: number;
    noFaceThreshold?: number;
    lookAwayThreshold?: number;
}

export interface AIProctorStatus {
    isFaceDetectorSupported: boolean;
    isObjectDetectorLoaded: boolean;
    isRunning: boolean;
    faceCount: number;
    lastFaceStatus: 'ok' | 'no_face' | 'multiple_faces' | 'looking_away' | 'idle';
    faceMessage: string;
    detectedObjects: string[];
    lastObjectWarning: string;
    consecutiveNoFace: number;
}

export function useAIProctor({
    isActive,
    videoElement,
    onFaceWarning,
    onCheatWarning,
    checkIntervalMs = 4000,
    noFaceThreshold = 4,
    lookAwayThreshold = 4,
}: AIProctorOptions): AIProctorStatus {
    const [status, setStatus] = useState<AIProctorStatus>({
        isFaceDetectorSupported: false,
        isObjectDetectorLoaded: false,
        isRunning: false,
        faceCount: 0,
        lastFaceStatus: 'idle',
        faceMessage: 'Initializing...',
        detectedObjects: [],
        lastObjectWarning: '',
        consecutiveNoFace: 0,
    });

    const faceDetectorRef = useRef<any>(null);
    const objectModelRef = useRef<any>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const consecutiveNoFaceRef = useRef(0);
    const consecutiveLookAwayRef = useRef(0);
    const isActiveRef = useRef(isActive);
    const onFaceWarningRef = useRef(onFaceWarning);
    const onCheatWarningRef = useRef(onCheatWarning);
    const objectCooldownRef = useRef<Record<string, number>>({}); // Cooldown per object type

    useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
    useEffect(() => { onFaceWarningRef.current = onFaceWarning; }, [onFaceWarning]);
    useEffect(() => { onCheatWarningRef.current = onCheatWarning; }, [onCheatWarning]);

    // Initialize FaceDetector (browser API)
    useEffect(() => {
        const supported = typeof window !== 'undefined' && 'FaceDetector' in window;
        setStatus(prev => ({ ...prev, isFaceDetectorSupported: supported }));

        if (supported) {
            try {
                faceDetectorRef.current = new (window as any).FaceDetector({
                    maxDetectedFaces: 5,
                    fastMode: true,
                });
            } catch (err) {
                console.error('Failed to create FaceDetector:', err);
                setStatus(prev => ({ ...prev, isFaceDetectorSupported: false }));
            }
        }
    }, []);

    // Load COCO-SSD object detection model
    useEffect(() => {
        if (!isActive) return;

        let cancelled = false;

        const loadModel = async () => {
            try {
                // Dynamic import to avoid SSR issues
                const tf = await import('@tensorflow/tfjs');
                await tf.ready();
                const cocoSsd = await import('@tensorflow-models/coco-ssd');
                const model = await cocoSsd.load({
                    base: 'lite_mobilenet_v2', // Lightest model for performance
                });
                if (!cancelled) {
                    objectModelRef.current = model;
                    setStatus(prev => ({ ...prev, isObjectDetectorLoaded: true }));
                    console.log('🤖 COCO-SSD object detection model loaded');
                }
            } catch (err) {
                console.error('Failed to load object detection model:', err);
            }
        };

        loadModel();

        return () => {
            cancelled = true;
        };
    }, [isActive]);

    // Main detection function
    const runDetection = useCallback(async () => {
        if (!videoElement || !isActiveRef.current) return;
        if (videoElement.readyState < 2 || videoElement.videoWidth === 0) return;

        // === FACE DETECTION ===
        if (faceDetectorRef.current) {
            try {
                const faces = await faceDetectorRef.current.detect(videoElement);
                const faceCount = faces.length;

                if (faceCount === 0) {
                    consecutiveNoFaceRef.current += 1;
                    consecutiveLookAwayRef.current = 0;
                    const count = consecutiveNoFaceRef.current;

                    // Soft notification (NOT cheating)
                    if (count >= noFaceThreshold) {
                        onFaceWarningRef.current(`😶 Your face has not been visible for a while. Please look at the screen.`);
                        consecutiveNoFaceRef.current = 0; // Reset
                    }

                    setStatus(prev => ({
                        ...prev,
                        faceCount: 0,
                        lastFaceStatus: 'no_face',
                        faceMessage: `😶 No face (${count}/${noFaceThreshold})`,
                        consecutiveNoFace: count,
                        isRunning: true,
                    }));

                } else if (faceCount > 1) {
                    consecutiveNoFaceRef.current = 0;
                    consecutiveLookAwayRef.current = 0;
                    // Multiple faces = soft notification
                    onFaceWarningRef.current(`👥 ${faceCount} faces detected — only you should be visible.`);
                    setStatus(prev => ({
                        ...prev,
                        faceCount,
                        lastFaceStatus: 'multiple_faces',
                        faceMessage: `👥 ${faceCount} faces`,
                        consecutiveNoFace: 0,
                        isRunning: true,
                    }));

                } else {
                    // 1 face — check position
                    const face = faces[0];
                    const bbox = face.boundingBox;
                    const vw = videoElement.videoWidth;
                    const vh = videoElement.videoHeight;
                    const cx = (bbox.x + bbox.width / 2) / vw;
                    const cy = (bbox.y + bbox.height / 2) / vh;
                    const area = (bbox.width * bbox.height) / (vw * vh);

                    const isOffCenter = cx < 0.2 || cx > 0.8 || cy < 0.15 || cy > 0.85;
                    const isTooSmall = area < 0.02;

                    if (isOffCenter || isTooSmall) {
                        consecutiveLookAwayRef.current += 1;
                        consecutiveNoFaceRef.current = 0;
                        const count = consecutiveLookAwayRef.current;

                        if (count >= lookAwayThreshold) {
                            onFaceWarningRef.current('👀 You appear to be looking away. Please focus on your exam.');
                            consecutiveLookAwayRef.current = 0;
                        }

                        setStatus(prev => ({
                            ...prev,
                            faceCount: 1,
                            lastFaceStatus: 'looking_away',
                            faceMessage: `👀 Looking away`,
                            consecutiveNoFace: 0,
                            isRunning: true,
                        }));
                    } else {
                        consecutiveNoFaceRef.current = 0;
                        consecutiveLookAwayRef.current = 0;
                        setStatus(prev => ({
                            ...prev,
                            faceCount: 1,
                            lastFaceStatus: 'ok',
                            faceMessage: '✅ Face OK',
                            consecutiveNoFace: 0,
                            isRunning: true,
                        }));
                    }
                }
            } catch (err) {
                // Silently fail face detection
            }
        }

        // === OBJECT DETECTION (phones, books, etc.) ===
        if (objectModelRef.current) {
            try {
                const predictions = await objectModelRef.current.detect(videoElement, undefined, 0.45);
                const now = Date.now();
                const suspicious: string[] = [];

                for (const pred of predictions) {
                    const label = pred.class.toLowerCase();
                    if (CHEATING_OBJECTS.includes(label)) {
                        suspicious.push(label);

                        // Cooldown: don't spam — one warning per object type per 30 seconds
                        const lastWarned = objectCooldownRef.current[label] || 0;
                        if (now - lastWarned > 30000) {
                            objectCooldownRef.current[label] = now;
                            const displayName = CHEATING_LABELS[label] || `⚠️ ${label} detected`;
                            onCheatWarningRef.current(label, `${displayName} near your workspace — this is marked as cheating!`);
                        }
                    }
                }

                setStatus(prev => ({
                    ...prev,
                    detectedObjects: suspicious,
                    lastObjectWarning: suspicious.length > 0
                        ? suspicious.map(s => CHEATING_LABELS[s] || s).join(', ')
                        : '',
                    isRunning: true,
                }));

            } catch (err) {
                // Silently fail object detection
            }
        }
    }, [videoElement, noFaceThreshold, lookAwayThreshold]);

    // Start/stop detection loop
    useEffect(() => {
        if (isActive && videoElement) {
            setStatus(prev => ({ ...prev, isRunning: true, faceMessage: '🔍 AI monitoring starting...' }));

            // Grace period before first check
            const startTimeout = setTimeout(() => {
                runDetection();
                intervalRef.current = setInterval(runDetection, checkIntervalMs);
            }, 5000);

            return () => {
                clearTimeout(startTimeout);
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
            };
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            setStatus(prev => ({ ...prev, isRunning: false }));
        }
    }, [isActive, videoElement, runDetection, checkIntervalMs]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    return status;
}
