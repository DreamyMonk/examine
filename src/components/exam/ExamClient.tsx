"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@/components/exam/RichTextEditor';
import { useToast } from '@/hooks/use-toast';
import {
    saveExamSubmission, createLiveSession, updateLiveSession, endLiveSession,
    subscribeToSession, sendChatMessage, subscribeToChatMessages, deactivateUserSessions
} from '@/services/examService';
import { studentJoinAndPublish, studentLeave, getAgoraChannel, publishScreenTrack } from '@/services/agoraService';
import type { ExamSet, ExamUser, ExamQuestion, StudentAnswer, ProctoringState, ChatMessage } from '@/types/exam';
import { Timestamp } from 'firebase/firestore';

const MAX_VIOLATIONS = 5;

interface ExamClientProps {
    exam: ExamSet;
    user: ExamUser;
    proctoring: ProctoringState;
    selfieDataUrl: string | null;
    idCardDataUrl: string | null;
}

interface Section {
    type: string;
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    dotColor: string;
    questions: { question: ExamQuestion; globalIndex: number }[];
}

const PauseTimer = ({ endTime }: { endTime: number }) => {
    const [remaining, setRemaining] = useState(0);

    useEffect(() => {
        const update = () => {
            const r = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
            setRemaining(r);
        };
        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [endTime]);

    if (remaining <= 0) return (
        <div className="mt-4 flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-xs font-semibold text-amber-500">Waiting for proctor to resume...</span>
        </div>
    );

    const m = Math.floor(remaining / 60);
    const s = remaining % 60;

    return (
        <div className="mt-4 flex flex-col items-center justify-center animate-pulse">
            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">Resuming In</span>
            <span className="text-3xl font-bold text-amber-600 font-mono tracking-widest">
                {m}:{s.toString().padStart(2, '0')}
            </span>
        </div>
    );
};

export function ExamClient({ exam, user, proctoring, selfieDataUrl, idCardDataUrl }: ExamClientProps) {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Map<string, StudentAnswer>>(new Map());
    const [examState, setExamState] = useState<'fullscreen_prompt' | 'in_progress' | 'submitting' | 'submitted'>('fullscreen_prompt');
    const isScheduled = exam.examType === 'scheduled';
    const [timeLeft, setTimeLeft] = useState(() => {
        if (isScheduled && exam.scheduledEnd) {
            const end = exam.scheduledEnd?.toDate ? exam.scheduledEnd.toDate().getTime() : new Date(exam.scheduledEnd).getTime();
            return Math.max(0, Math.floor((end - Date.now()) / 1000));
        }
        return exam.durationMinutes * 60;
    });
    const [violationCount, setViolationCount] = useState(0);
    const [showWarning, setShowWarning] = useState(false);
    const [warningMessage, setWarningMessage] = useState('');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [activeSectionIndex, setActiveSectionIndex] = useState(0);
    const [fullscreenCountdown, setFullscreenCountdown] = useState(15);

    // Admin actions
    const [adminPaused, setAdminPaused] = useState(false);
    const [adminPauseReason, setAdminPauseReason] = useState('');
    const [adminPauseEndTime, setAdminPauseEndTime] = useState<number | null>(null);
    const [adminTerminated, setAdminTerminated] = useState(false);
    const [adminTerminateReason, setAdminTerminateReason] = useState('');

    // Chat
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [showChat, setShowChat] = useState(false);
    const [unreadChat, setUnreadChat] = useState(0);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Toasts for pause/resume state changes
    useEffect(() => {
        if (adminPaused) {
            toast({ title: 'Exam Paused', description: adminPauseReason || 'Your exam has been paused by the proctor.' });
        } else if (adminPaused === false && adminPauseReason === '') {
            // Basic check to avoid initial mount toast, logic is slightly loose but acceptable for now
            // Actually, better to just let the user know if it happens
        }
    }, [adminPaused]); // Simplified toast logic

    // AI Proctoring warnings (soft toasts)
    const [proctoringAlerts, setProctoringAlerts] = useState<{ id: string; type: 'camera' | 'face' | 'object'; message: string; timestamp: number }[]>([]);
    const [cameraOk, setCameraOk] = useState(true);
    const [faceDetected, setFaceDetected] = useState(true);
    const [objectsClean, setObjectsClean] = useState(true);
    const proctoringCanvasRef = useRef<HTMLCanvasElement>(null);

    // Screen share pause
    const [screenPaused, setScreenPaused] = useState(false);

    const hasSubmittedRef = useRef(false);
    const agoraJoinedRef = useRef(false);
    const proctoringRef = useRef(proctoring);
    const videoRef = useRef<HTMLVideoElement>(null);
    const liveSessionIdRef = useRef<string | null>(null);
    const router = useRouter();
    const { toast } = useToast();

    // ============ BUILD SECTIONS ============
    const sections: Section[] = useMemo(() => {
        const sectionMap: Record<string, { question: ExamQuestion; globalIndex: number }[]> = {};
        const sectionOrder = ['mcq', 'descriptive_2', 'descriptive_5', 'descriptive_10'];

        exam.questions.forEach((q, idx) => {
            if (!sectionMap[q.type]) sectionMap[q.type] = [];
            sectionMap[q.type].push({ question: q, globalIndex: idx });
        });

        const sectionConfig: Record<string, { label: string; color: string; bgColor: string; borderColor: string; dotColor: string }> = {
            mcq: { label: 'MCQ', color: 'text-slate-700', bgColor: 'bg-slate-50', borderColor: 'border-slate-200', dotColor: 'bg-slate-400' },
            descriptive_2: { label: '2 Marks', color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-200', dotColor: 'bg-amber-400' },
            descriptive_5: { label: '5 Marks', color: 'text-violet-700', bgColor: 'bg-violet-50', borderColor: 'border-violet-200', dotColor: 'bg-violet-400' },
            descriptive_10: { label: '10 Marks', color: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200', dotColor: 'bg-emerald-400' },
        };

        return sectionOrder
            .filter(type => sectionMap[type]?.length > 0)
            .map(type => ({
                type,
                ...sectionConfig[type],
                questions: sectionMap[type],
            }));
    }, [exam.questions]);

    const findSectionForGlobalIndex = useCallback((globalIdx: number) => {
        for (let si = 0; si < sections.length; si++) {
            const localIdx = sections[si].questions.findIndex(q => q.globalIndex === globalIdx);
            if (localIdx !== -1) return { sectionIndex: si, localIndex: localIdx };
        }
        return { sectionIndex: 0, localIndex: 0 };
    }, [sections]);

    const currentQuestion = exam.questions[currentQuestionIndex];
    const currentAnswer = currentQuestion ? answers.get(currentQuestion.id) : undefined;
    const answeredCount = answers.size;
    const isTimeLow = timeLeft <= 300;
    const isTimeCritical = timeLeft <= 60;

    // Keep proctoringRef up-to-date without causing re-renders
    useEffect(() => { proctoringRef.current = proctoring; }, [proctoring]);

    // Camera feed setup — robust stream attachment with isolation & polling
    useEffect(() => {
        const setupStream = () => {
            const video = videoRef.current;
            if (!video || !proctoring.cameraStream) return;

            const videoTrack = proctoring.cameraStream.getVideoTracks()[0];
            if (!videoTrack || videoTrack.readyState === 'ended') return;

            // Ensure track is enabled
            videoTrack.enabled = true;

            // Create fresh MediaStream if needed
            // check if current srcObject track matches
            const currentStream = video.srcObject as MediaStream;
            const currentTrack = currentStream?.getVideoTracks()[0];

            if (!currentTrack || currentTrack.id !== videoTrack.id) {
                const previewStream = new MediaStream([videoTrack]);
                video.srcObject = previewStream;
                video.muted = true;
                video.play().catch(e => console.warn("Preview play failed:", e));
            } else if (video.paused) {
                video.play().catch(e => console.warn("Resume play failed:", e));
            }
        };

        // Run immediately
        setupStream();

        // Poll to ensure it stays alive (self-healing)
        const outputInterval = setInterval(setupStream, 2000);
        return () => clearInterval(outputInterval);
    }, [proctoring.cameraStream]);

    // ============ CREATE LIVE SESSION + AGORA ============
    useEffect(() => {
        const channel = getAgoraChannel(exam.id, user.id);
        const p = proctoringRef.current;

        const startSession = async () => {
            if (agoraJoinedRef.current) return; // Prevent re-joining if already active
            try {
                // Cleanup any stale sessions for this user/exam to prevent duplicates
                await deactivateUserSessions(user.id, exam.id);

                // Create new live session in Firestore
                const sessionId = await createLiveSession({
                    examId: exam.id,
                    userId: user.id,
                    userName: user.name,
                    isActive: true,
                    cameraStreamActive: p.cameraGranted,
                    screenStreamActive: p.screenShared,
                    violations: 0,
                    lastActivity: Timestamp.now(),
                    agoraChannel: channel,
                });
                liveSessionIdRef.current = sessionId;

                // Join Agora — only once per exam session
                if (!agoraJoinedRef.current) {
                    agoraJoinedRef.current = true;
                    studentJoinAndPublish(channel, p.cameraStream, p.micStream, p.screenStream).catch(() => {
                        agoraJoinedRef.current = false;
                    });
                }
            } catch (e) {
                // Silently fail
            }
        };
        startSession();

        return () => {
            agoraJoinedRef.current = false;
            studentLeave().catch(() => { });
            if (liveSessionIdRef.current) {
                endLiveSession(liveSessionIdRef.current).catch(() => { });
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [exam.id, user.id]);

    // ============ LISTEN FOR ADMIN ACTIONS (pause/terminate) ============
    useEffect(() => {
        if (!liveSessionIdRef.current) return;
        const unsub = subscribeToSession(liveSessionIdRef.current, (session) => {
            if (!session) return;

            // Admin paused the exam
            // Admin paused/resumed logic - sync state directly to avoid stale closures
            setAdminPaused(!!session.isPaused);

            if (session.isPaused) {
                setAdminPauseReason(session.pauseReason || 'Paused by proctor');

                // Calculate end time
                if (session.pauseDuration && session.pausedAt) {
                    const start = (session.pausedAt as any).toMillis ? (session.pausedAt as any).toMillis() : (session.pausedAt as any).seconds * 1000;
                    const end = start + (session.pauseDuration * 60 * 1000);
                    setAdminPauseEndTime(end);
                } else {
                    setAdminPauseEndTime(null);
                }
            } else {
                setAdminPauseReason('');
                setAdminPauseEndTime(null);
            }

            // Admin terminated the exam
            if (session.isTerminated && !adminTerminated) {
                setAdminTerminated(true);
                setAdminTerminateReason(session.terminateReason || 'Terminated by proctor');
                handleSubmit(`Terminated by proctor: ${session.terminateReason || 'No reason given'}`);
            }
        });

        return () => unsub();
    }, [liveSessionIdRef.current, adminPaused, adminTerminated]);

    // ============ CHAT SUBSCRIPTION ============
    useEffect(() => {
        if (!liveSessionIdRef.current) return;
        const unsub = subscribeToChatMessages(liveSessionIdRef.current, (msgs) => {
            setChatMessages(msgs);
            // Count unread if chat is closed
            if (!showChat && msgs.length > 0) {
                const adminMsgs = msgs.filter(m => m.senderRole === 'admin');
                setUnreadChat(adminMsgs.length);
            }
        });
        return () => unsub();
    }, [liveSessionIdRef.current, showChat]);

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, showChat]);

    const handleSendChat = async () => {
        if (!chatInput.trim() || !liveSessionIdRef.current) return;
        try {
            await sendChatMessage({
                sessionId: liveSessionIdRef.current,
                senderId: user.id,
                senderName: user.name,
                senderRole: 'student',
                message: chatInput.trim(),
            });
            setChatInput('');
        } catch (e) { }
    };

    // Update violations in live session
    useEffect(() => {
        if (liveSessionIdRef.current && violationCount > 0) {
            updateLiveSession(liveSessionIdRef.current, { violations: violationCount }).catch(() => { });
        }
    }, [violationCount]);

    // ============ AI PROCTORING: Camera frame analysis ============
    // ============ AI PROCTORING: Camera frame analysis ============
    const addProctoringAlert = useCallback((type: 'camera' | 'face' | 'object', message: string, isViolation = false) => {
        const id = `${type}_${Date.now()}`;
        setProctoringAlerts(prev => {
            // Don't stack duplicates of same type within 10s
            const recent = prev.find(a => a.type === type && Date.now() - a.timestamp < 10000);
            if (recent) return prev;

            // If it's a new violation, increment count (debounced)
            if (isViolation) {
                setViolationCount(v => Math.min(v + 1, MAX_VIOLATIONS));
            }
            return [...prev, { id, type, message, timestamp: Date.now() }];
        });
        // Auto-dismiss after 8s
        setTimeout(() => {
            setProctoringAlerts(prev => prev.filter(a => a.id !== id));
        }, 8000);
    }, []);

    // AI Model Refs
    const objectModelRef = useRef<any>(null);
    const faceModelRef = useRef<any>(null);

    useEffect(() => {
        if (examState !== 'in_progress') return;

        // Load TFJS models
        const loadModels = async () => {
            try {
                await import('@tensorflow/tfjs');
                const [cocoSsd, blazeface] = await Promise.all([
                    import('@tensorflow-models/coco-ssd'),
                    import('@tensorflow-models/blazeface')
                ]);

                if (!objectModelRef.current) objectModelRef.current = await cocoSsd.load();
                if (!faceModelRef.current) faceModelRef.current = await blazeface.load();
                console.log('AI Proctoring Models Loaded');
            } catch (err) {
                console.error('Failed to load AI models', err);
            }
        };
        loadModels();

        const analyzeFrame = async () => {
            // Dynamic check for video element
            const video = videoRef.current;
            if (!video || !objectModelRef.current || !faceModelRef.current || video.videoWidth === 0 || video.videoHeight === 0 || video.paused) return;

            try {
                // Run detections in parallel
                const [objectPreds, facePreds] = await Promise.all([
                    objectModelRef.current.detect(video),
                    faceModelRef.current.estimateFaces(video, false) // false = return predictions
                ]);

                // --- 1. Face & Gaze Detection (BlazeFace) ---
                if (facePreds.length === 0) {
                    setFaceDetected(false);
                    addProctoringAlert('face', 'No face detected. Please stay in frame.', true);
                } else if (facePreds.length > 1) {
                    setFaceDetected(true);
                    addProctoringAlert('face', 'Multiple faces detected. Only you should be in the frame.', true);
                } else {
                    setFaceDetected(true);
                    // Gaze Check (Looking Left/Right)
                    const face = facePreds[0];
                    if (face.landmarks) {
                        const rightEye = face.landmarks[0]; // [x, y]
                        const leftEye = face.landmarks[1];
                        const nose = face.landmarks[2];

                        // Simple horizontal ratio: (NoseX - RightEyeX) / (LeftEyeX - RightEyeX)
                        // Note: RightEye is usually at smaller X (camera left) than LeftEye
                        const eyeDist = Math.abs(leftEye[0] - rightEye[0]);
                        const noseDist = nose[0] - rightEye[0];
                        const ratio = noseDist / (eyeDist || 1);

                        // Thresholds: < 0.25 (looking right) or > 0.75 (looking left) - tuned slightly
                        if (ratio < 0.25 || ratio > 0.75) {
                            addProctoringAlert('face', 'Looking away detected. Please focus on the screen.', true);
                        }
                    }
                }

                // --- 2. Object Detection (COCO-SSD) ---
                const suspicious = objectPreds.filter((p: any) =>
                    ['cell phone', 'book', 'laptop'].includes(p.class) && p.score > 0.5
                );

                if (suspicious.length > 0) {
                    setObjectsClean(false);
                    const items = [...new Set(suspicious.map((p: any) => p.class))].join(', ');
                    addProctoringAlert('object', `Suspicious object detected: ${items}`, true);
                } else {
                    setObjectsClean(true);
                }

                setCameraOk(true);
            } catch (e) {
                console.warn('AI Detection error', e);
            }
        };

        // Run analysis every 2 seconds
        const interval = setInterval(analyzeFrame, 2000);
        return () => clearInterval(interval);
    }, [examState, addProctoringAlert]);

    // Timer — two modes:
    // Practice: freezes when admin-paused or screen-paused
    // Scheduled: real-clock countdown, NEVER freezes
    useEffect(() => {
        if (examState !== 'in_progress') return;

        if (isScheduled) {
            // Scheduled exam: always ticking based on real clock
            const scheduledEndMs = exam.scheduledEnd?.toDate
                ? exam.scheduledEnd.toDate().getTime()
                : new Date(exam.scheduledEnd).getTime();

            const tick = () => {
                const remaining = Math.max(0, Math.floor((scheduledEndMs - Date.now()) / 1000));
                setTimeLeft(remaining);
                if (remaining <= 0) {
                    handleSubmit('Time expired — scheduled exam deadline reached');
                }
            };
            tick(); // immediate sync
            const interval = setInterval(tick, 1000);
            return () => clearInterval(interval);
        } else {
            // Practice exam: pauses when admin-paused or screen-paused
            if (adminPaused || screenPaused) return;
            const interval = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        handleSubmit('Time expired');
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [examState, adminPaused, screenPaused, isScheduled]);

    // ============ SCREEN SHARE MONITORING ============
    useEffect(() => {
        if (examState !== 'in_progress') return;
        if (!proctoring.screenStream) return;

        const videoTrack = proctoring.screenStream.getVideoTracks()[0];
        if (!videoTrack) return;

        const handleTrackEnded = () => {
            setScreenPaused(true);
            // Also count as a violation
            setViolationCount(prev => {
                const newCount = prev + 1;
                if (newCount >= MAX_VIOLATIONS) handleSubmit('Maximum violations reached');
                return newCount;
            });
            setWarningMessage('Screen sharing stopped!');
            setShowWarning(true);
            setTimeout(() => setShowWarning(false), 10000);
        };

        videoTrack.addEventListener('ended', handleTrackEnded);
        return () => {
            videoTrack.removeEventListener('ended', handleTrackEnded);
        };
    }, [examState, proctoring.screenStream]);

    const handleReshareScreen = async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { displaySurface: 'monitor' } as any,
                preferCurrentTab: false,
                selfBrowserSurface: 'exclude',
                surfaceSwitching: 'exclude',
                systemAudio: 'exclude',
            } as any);

            // Enforce full screen only
            const videoTrack = stream.getVideoTracks()[0];
            const settings = videoTrack.getSettings() as any;
            if (settings.displaySurface && settings.displaySurface !== 'monitor') {
                stream.getTracks().forEach(t => t.stop());
                toast({
                    title: 'Full Screen Required',
                    description: 'You must share your entire screen, not a window or tab.',
                    variant: 'destructive',
                });
                return;
            }

            // Replace the old screen stream reference
            (proctoring as any).screenStream = stream;
            (proctoring as any).screenShared = true;

            // Monitor the new track for ending
            videoTrack.addEventListener('ended', () => {
                setScreenPaused(true);
                setViolationCount(prev => {
                    const newCount = prev + 1;
                    if (newCount >= MAX_VIOLATIONS) handleSubmit('Maximum violations reached');
                    return newCount;
                });
                setWarningMessage('Screen sharing stopped!');
                setShowWarning(true);
                setTimeout(() => setShowWarning(false), 10000);
            });

            // Re-publish screen track to Agora screen channel
            const camChannel = getAgoraChannel(exam.id, user.id);
            publishScreenTrack(camChannel, stream).catch(() => { });

            // Update live session
            if (liveSessionIdRef.current) {
                updateLiveSession(liveSessionIdRef.current, { screenStreamActive: true }).catch(() => { });
            }

            setScreenPaused(false);
            toast({ title: 'Screen Shared', description: 'Screen sharing resumed. You may continue.' });

            // Re-enter fullscreen if needed
            if (!document.fullscreenElement) {
                try { await document.documentElement.requestFullscreen(); } catch (e) { }
            }
        } catch (err) {
            toast({
                title: 'Screen Share Required',
                description: 'You must share your screen to continue the exam.',
                variant: 'destructive',
            });
        }
    };

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // ============ FULLSCREEN ============
    const enterFullscreen = useCallback(async () => {
        try { await document.documentElement.requestFullscreen(); setIsFullscreen(true); } catch (e) { }
    }, []);

    // Fullscreen countdown
    useEffect(() => {
        if (examState !== 'fullscreen_prompt') return;
        const interval = setInterval(() => {
            setFullscreenCountdown(prev => {
                if (prev <= 1) {
                    enterFullscreen().then(() => setExamState('in_progress'));
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [examState, enterFullscreen]);

    const handleEnterFullscreen = () => {
        enterFullscreen().then(() => setExamState('in_progress'));
    };

    // Tab switch + fullscreen enforcement
    useEffect(() => {
        if (examState !== 'in_progress') return;

        const addViolation = (message: string) => {
            setViolationCount(prev => {
                const newCount = prev + 1;
                if (newCount >= MAX_VIOLATIONS) handleSubmit('Maximum violations reached');
                return newCount;
            });
            setWarningMessage(message);
            setShowWarning(true);
            setTimeout(() => setShowWarning(false), 10000);
        };

        const handleVisibility = () => { if (document.hidden) addViolation('Tab switch detected!'); };
        const handleFullscreenChange = () => {
            if (!document.fullscreenElement && examState === 'in_progress') {
                addViolation('Fullscreen exited!');
                setTimeout(() => enterFullscreen(), 1500);
            }
            setIsFullscreen(!!document.fullscreenElement);
        };
        const preventCopy = (e: Event) => e.preventDefault();
        const preventShortcuts = (e: KeyboardEvent) => {
            if (e.altKey && e.key === 'Tab') e.preventDefault();
            if (e.ctrlKey && ['c', 'v', 'a', 'p'].includes(e.key.toLowerCase())) e.preventDefault();
            if (['F11', 'Escape'].includes(e.key)) e.preventDefault();
        };

        document.addEventListener('visibilitychange', handleVisibility);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('copy', preventCopy);
        document.addEventListener('paste', preventCopy);
        document.addEventListener('contextmenu', preventCopy);
        document.addEventListener('keydown', preventShortcuts);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('copy', preventCopy);
            document.removeEventListener('paste', preventCopy);
            document.removeEventListener('contextmenu', preventCopy);
            document.removeEventListener('keydown', preventShortcuts);
        };
    }, [examState, enterFullscreen]);

    // ============ ANSWERS ============
    const handleMcqAnswer = (questionId: string, selectedIndex: number, question: ExamQuestion) => {
        setAnswers(prev => {
            const newAnswers = new Map(prev);
            newAnswers.set(questionId, {
                questionId, questionType: 'mcq', selectedOptionIndex: selectedIndex,
                marks: question.marks, marksAwarded: question.options?.[selectedIndex]?.isCorrect ? question.marks : 0,
            });
            return newAnswers;
        });
    };

    const handleDescriptiveAnswer = (questionId: string, text: string, question: ExamQuestion) => {
        setAnswers(prev => {
            const newAnswers = new Map(prev);
            newAnswers.set(questionId, { questionId, questionType: question.type, descriptiveAnswer: text, marks: question.marks });
            return newAnswers;
        });
    };

    const goToQuestion = (globalIndex: number) => {
        setCurrentQuestionIndex(globalIndex);
        const { sectionIndex } = findSectionForGlobalIndex(globalIndex);
        setActiveSectionIndex(sectionIndex);
    };
    const goNext = () => { if (currentQuestionIndex < exam.questions.length - 1) goToQuestion(currentQuestionIndex + 1); };
    const goPrev = () => { if (currentQuestionIndex > 0) goToQuestion(currentQuestionIndex - 1); };

    // ============ SUBMIT ============
    const handleSubmit = useCallback(async (reason?: string) => {
        if (hasSubmittedRef.current) return;
        hasSubmittedRef.current = true;
        setExamState('submitting');

        // End live session + Agora
        if (liveSessionIdRef.current) {
            try { await endLiveSession(liveSessionIdRef.current); } catch (e) { }
            liveSessionIdRef.current = null;
        }
        await studentLeave();

        proctoring.cameraStream?.getTracks().forEach(t => t.stop());
        proctoring.micStream?.getTracks().forEach(t => t.stop());
        proctoring.screenStream?.getTracks().forEach(t => t.stop());

        if (document.fullscreenElement) {
            try { await document.exitFullscreen(); } catch (e) { }
        }

        const answerArray = Array.from(answers.values());
        let totalObtained = 0;
        answerArray.forEach(a => {
            if (a.questionType === 'mcq' && a.marksAwarded !== undefined) totalObtained += a.marksAwarded;
        });

        try {
            await saveExamSubmission({
                examId: exam.id, examTitle: exam.title, userId: user.id, userName: user.name, userEmail: user.email,
                answers: answerArray, totalMarks: exam.totalMarks, marksObtained: totalObtained,
                submittedAt: Timestamp.now(), selfieUrl: selfieDataUrl || '', idCardUrl: idCardDataUrl || '',
                violations: violationCount, status: 'submitted',
            });
            toast({ title: 'Exam Submitted', description: reason || 'Your exam has been submitted successfully.' });
        } catch (error: any) {
            toast({ title: 'Submission Error', description: error.message, variant: 'destructive' });
        }
        setExamState('submitted');
    }, [answers, exam, user, proctoring, selfieDataUrl, idCardDataUrl, violationCount, toast]);

    // ============ FULLSCREEN PROMPT ============
    if (examState === 'fullscreen_prompt') {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center px-4">
                <div className="w-full max-w-sm text-center animate-fade-in">
                    <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9m11.25-5.25v4.5m0-4.5h-4.5m4.5 0L15 9m-11.25 11.25v-4.5m0 4.5h4.5m-4.5 0L9 15m11.25 5.25v-4.5m0 4.5h-4.5m4.5 0L15 15" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Enter Fullscreen Mode</h2>
                    <p className="text-gray-500 text-sm mb-6">The exam requires fullscreen mode. Click below or wait for auto-activation.</p>
                    <div className="relative w-24 h-24 mx-auto mb-6">
                        <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="45" fill="none" stroke="#f3f4f6" strokeWidth="6" />
                            <circle cx="50" cy="50" r="45" fill="none" stroke="#2563eb" strokeWidth="6"
                                strokeDasharray={`${2 * Math.PI * 45}`}
                                strokeDashoffset={`${2 * Math.PI * 45 * (1 - fullscreenCountdown / 15)}`}
                                strokeLinecap="round" className="transition-all duration-1000" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-2xl font-bold text-gray-900">{fullscreenCountdown}</span>
                        </div>
                    </div>
                    <button onClick={handleEnterFullscreen} className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
                        Enter Fullscreen & Start
                    </button>
                    <p className="text-[11px] text-gray-400 mt-3">Auto-entering in {fullscreenCountdown}s...</p>
                </div>
            </div>
        );
    }

    // ============ SUBMITTED ============
    if (examState === 'submitted') {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center px-4">
                <div className="w-full max-w-md text-center animate-fade-in">
                    <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Exam Submitted</h2>
                    {adminTerminated && (
                        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">
                            <strong>Terminated by proctor:</strong> {adminTerminateReason}
                        </div>
                    )}
                    <p className="text-gray-500 text-sm mb-8">Your answers have been recorded.</p>
                    <div className="flex gap-6 justify-center mb-8">
                        <div className="text-center"><p className="text-3xl font-bold text-gray-900">{answeredCount}</p><p className="text-xs text-gray-400 mt-1">Answered</p></div>
                        <div className="w-px bg-gray-200" />
                        <div className="text-center"><p className="text-3xl font-bold text-gray-900">{exam.questions.length - answeredCount}</p><p className="text-xs text-gray-400 mt-1">Unanswered</p></div>
                        <div className="w-px bg-gray-200" />
                        <div className="text-center"><p className={`text-3xl font-bold ${violationCount > 0 ? 'text-red-500' : 'text-gray-900'}`}>{violationCount}</p><p className="text-xs text-gray-400 mt-1">Violations</p></div>
                    </div>
                    <button onClick={() => window.close()} className="px-6 py-3 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
                        Close Window
                    </button>
                </div>
            </div>
        );
    }

    if (examState === 'submitting') {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-500 text-sm">Submitting your exam...</p>
                </div>
            </div>
        );
    }

    // ============ MAIN EXAM VIEW ============
    const currentSection = findSectionForGlobalIndex(currentQuestionIndex);
    const sectionInfo = sections[currentSection.sectionIndex];

    return (
        <div className="h-screen bg-[#fafafa] flex flex-col overflow-hidden select-none">
            {/* ====== ADMIN PAUSED OVERLAY ====== */}
            {adminPaused && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
                    <div className="rounded-2xl p-8 max-w-md text-center shadow-2xl animate-scale-in bg-white border-2 border-amber-100">
                        <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
                            <svg className="w-10 h-10 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-amber-600 mb-2">Exam Paused by Proctor</h3>
                        <p className="text-gray-600 text-sm mb-3">{adminPauseReason}</p>

                        {isScheduled ? (
                            <>
                                <div className="p-3 rounded-lg bg-red-50 border border-red-200 mb-3">
                                    <p className="text-red-600 text-xs font-semibold">⚠️ Scheduled Exam — Timer is still running!</p>
                                    <p className="text-red-500 text-xs mt-1">Time remaining: <span className="font-mono font-bold">{formatTime(timeLeft)}</span></p>
                                </div>
                                <p className="text-gray-400 text-xs">The proctor paused your exam but the deadline does not change.</p>
                            </>
                        ) : (
                            <>
                                <p className="text-gray-400 text-xs">Your timer is paused. Please wait for the proctor to resume.</p>
                                {adminPauseEndTime ? (
                                    <PauseTimer endTime={adminPauseEndTime} />
                                ) : (
                                    <div className="mt-4 flex items-center justify-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                        <span className="text-xs font-semibold text-amber-500">Waiting for proctor...</span>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Chat during pause */}
                        <div className="mt-4 border-t border-gray-200 pt-4">
                            <button onClick={() => setShowChat(!showChat)} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                                💬 Chat with Proctor
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ====== SCREEN SHARE PAUSED OVERLAY ====== */}
            {screenPaused && !adminPaused && (
                <div className="fixed inset-0 z-[240] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}>
                    <div className="rounded-2xl p-8 max-w-md text-center shadow-2xl animate-scale-in bg-white border-2 border-red-100">
                        <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                            <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-red-600 mb-2">Screen Sharing Stopped</h3>
                        <p className="text-gray-600 text-sm mb-2">Your screen share has been disconnected. The exam is paused until you re-share your <strong>entire screen</strong>.</p>
                        <p className="text-gray-400 text-xs mb-6">Your timer is paused. This counts as a violation.</p>
                        <button
                            onClick={handleReshareScreen}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12" />
                            </svg>
                            Share Entire Screen to Continue
                        </button>
                        <div className="mt-4 flex items-center justify-center gap-1">
                            {Array.from({ length: MAX_VIOLATIONS }).map((_, i) => (
                                <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i < violationCount ? 'bg-red-500' : 'bg-gray-200'}`} />
                            ))}
                            <span className="text-[10px] text-gray-400 ml-1.5">{violationCount}/{MAX_VIOLATIONS} violations</span>
                        </div>
                    </div>
                </div>
            )}

            {/* ====== VIOLATION WARNING — Top-right toast ====== */}
            {showWarning && (
                <div className="fixed top-4 right-4 z-[200] w-[360px] animate-slide-in-right">
                    <div className="rounded-xl p-4 shadow-2xl bg-white border border-red-200 flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-red-600 mb-0.5">Violation Detected</h4>
                            <p className="text-xs text-gray-600 mb-2">{warningMessage}</p>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: MAX_VIOLATIONS }).map((_, i) => (
                                    <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i < violationCount ? 'bg-red-500' : 'bg-gray-200'}`} />
                                ))}
                                <span className="text-[10px] text-gray-400 ml-1.5">{violationCount}/{MAX_VIOLATIONS}</span>
                            </div>
                        </div>
                        <button onClick={() => setShowWarning(false)} className="text-gray-400 hover:text-gray-600 flex-shrink-0 mt-0.5">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    {/* Auto-dismiss progress bar */}
                    <div className="mt-1 mx-2 h-0.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-red-400 rounded-full" style={{ animation: 'shrink 10s linear forwards' }} />
                    </div>
                    <style jsx>{`
                        @keyframes shrink {
                            from { width: 100%; }
                            to { width: 0%; }
                        }
                        @keyframes slide-in-right {
                            from { opacity: 0; transform: translateX(100px); }
                            to { opacity: 1; transform: translateX(0); }
                        }
                        .animate-slide-in-right {
                            animation: slide-in-right 0.3s ease-out;
                        }
                    `}</style>
                </div>
            )}

            {/* ====== CHAT PANEL (floating) ====== */}
            {showChat && (
                <div className="fixed bottom-4 right-4 z-[300] w-80 bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden" style={{ height: '400px' }}>
                    <div className="px-4 py-3 bg-blue-600 text-white flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            <span className="text-sm font-semibold">Proctor Chat</span>
                        </div>
                        <button onClick={() => { setShowChat(false); setUnreadChat(0); }} className="text-white/80 hover:text-white">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50">
                        {chatMessages.length === 0 && (
                            <p className="text-xs text-gray-400 text-center mt-8">No messages yet</p>
                        )}
                        {chatMessages.map(msg => (
                            <div key={msg.id} className={`flex ${msg.senderRole === 'student' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[75%] px-3 py-2 rounded-xl text-sm ${msg.senderRole === 'student'
                                    ? 'bg-blue-600 text-white rounded-br-sm'
                                    : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm'
                                    }`}>
                                    {msg.senderRole === 'admin' && (
                                        <p className="text-[10px] font-semibold text-blue-600 mb-0.5">Proctor</p>
                                    )}
                                    <p>{msg.message}</p>
                                </div>
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>
                    <div className="p-2 border-t border-gray-200 flex gap-2 flex-shrink-0 bg-white">
                        <input
                            type="text"
                            value={chatInput}
                            onChange={e => setChatInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                            placeholder="Type a message..."
                            className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-blue-300"
                        />
                        <button onClick={handleSendChat} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {/* ====== TOP BAR ====== */}
            <header className="bg-white border-b border-gray-200 px-5 py-0 flex-shrink-0 h-14 flex items-center">
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="font-semibold text-gray-900 text-sm leading-none">{exam.title}</h1>
                            <p className="text-[11px] text-gray-400 mt-0.5">{user.name} · {exam.questions.length} questions · {exam.totalMarks} marks</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Timer */}
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-mono font-bold transition-all ${isTimeCritical ? 'bg-red-500 text-white animate-pulse' : isTimeLow ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-gray-100 text-gray-800'}`}>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                            {formatTime(timeLeft)}
                            {adminPaused && <span className="text-[9px] ml-1 bg-amber-100 text-amber-700 px-1 rounded">PAUSED</span>}
                        </div>
                        {/* Violations */}
                        {violationCount > 0 && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-red-50 text-red-600 border border-red-200">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                                {violationCount}/{MAX_VIOLATIONS}
                            </div>
                        )}
                        {/* Chat toggle */}
                        <button
                            onClick={() => { setShowChat(!showChat); setUnreadChat(0); }}
                            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            Chat
                            {unreadChat > 0 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold">{unreadChat}</span>
                            )}
                        </button>
                        {/* Submit */}
                        <button
                            onClick={() => {
                                if (confirm(`Submit? ${answeredCount}/${exam.questions.length} answered.`)) handleSubmit('Ended by student');
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Submit
                        </button>
                    </div>
                </div>
            </header>

            {/* ====== MAIN CONTENT ====== */}
            <div className="flex-1 flex overflow-hidden">
                {/* LEFT SIDEBAR */}
                <aside className="w-[220px] bg-white border-r border-gray-200 flex flex-col flex-shrink-0 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Questions</span>
                            <span className="text-xs text-gray-400">{answeredCount}/{exam.questions.length} done</span>
                        </div>
                        <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${(answeredCount / exam.questions.length) * 100}%` }} />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto py-2">
                        {sections.map((section, sIdx) => {
                            const answeredInSection = section.questions.filter(q => answers.has(q.question.id)).length;
                            const isActiveSection = sIdx === currentSection.sectionIndex;
                            return (
                                <div key={section.type} className="mb-1">
                                    <button
                                        onClick={() => { setActiveSectionIndex(sIdx); goToQuestion(section.questions[0].globalIndex); }}
                                        className={`w-full px-4 py-2.5 flex items-center justify-between text-left transition-colors hover:bg-gray-50 ${isActiveSection ? 'bg-gray-50' : ''}`}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <div className={`w-2 h-2 rounded-full ${section.dotColor}`} />
                                            <span className={`text-xs font-bold uppercase tracking-wide ${isActiveSection ? 'text-gray-900' : 'text-gray-500'}`}>{section.label}</span>
                                        </div>
                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${section.bgColor} ${section.color}`}>{answeredInSection}/{section.questions.length}</span>
                                    </button>
                                    <div className="px-4 pb-2">
                                        <div className="grid grid-cols-5 gap-1">
                                            {section.questions.map((q, localIdx) => {
                                                const hasAnswer = answers.has(q.question.id);
                                                const isCurrent = q.globalIndex === currentQuestionIndex;
                                                return (
                                                    <button key={q.question.id} onClick={() => goToQuestion(q.globalIndex)}
                                                        className={`h-8 w-full rounded text-[11px] font-semibold transition-all duration-150 ${isCurrent ? 'bg-gray-900 text-white shadow-sm scale-105' : hasAnswer ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-gray-50 text-gray-400 border border-gray-100 hover:bg-gray-100'}`}>
                                                        {localIdx + 1}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-4 text-[10px] text-gray-400 flex-shrink-0">
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-gray-900" />Current</div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-emerald-100 border border-emerald-200" />Answered</div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-gray-50 border border-gray-100" />Pending</div>
                    </div>
                </aside>

                {/* QUESTION AREA */}
                <main className="flex-1 flex flex-col overflow-hidden">
                    {currentQuestion && (
                        <>
                            <div className="px-8 py-3 border-b border-gray-100 bg-white flex items-center justify-between flex-shrink-0">
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${sectionInfo?.bgColor || 'bg-gray-100'} ${sectionInfo?.color || 'text-gray-600'}`}>{sectionInfo?.label || ''}</span>
                                    <svg className="w-3 h-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                                    <span className="text-xs font-medium text-gray-900">Question {currentSection.localIndex + 1} of {sectionInfo?.questions.length || 0}</span>
                                </div>
                                <span className="text-xs text-gray-400">{currentQuestion.marks} mark{currentQuestion.marks > 1 ? 's' : ''}</span>
                            </div>

                            <div className="flex-1 overflow-y-auto">
                                <div className="px-8 py-6">
                                    <div className="mb-5">
                                        <h2 className="text-lg font-medium text-gray-900 leading-relaxed">{currentQuestion.question}</h2>
                                    </div>

                                    {currentQuestion.type === 'mcq' && currentQuestion.options && (
                                        <div className="space-y-2.5">
                                            {currentQuestion.options.map((option, index) => {
                                                const isSelected = currentAnswer?.selectedOptionIndex === index;
                                                return (
                                                    <button key={index} onClick={() => handleMcqAnswer(currentQuestion.id, index, currentQuestion)}
                                                        className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all duration-150 ${isSelected ? 'border-gray-900 bg-gray-50' : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50/50'}`}>
                                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 transition-colors ${isSelected ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                                            {isSelected ? (
                                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                                            ) : String.fromCharCode(65 + index)}
                                                        </div>
                                                        <span className={`text-sm flex-1 ${isSelected ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>{option.text}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {currentQuestion.type !== 'mcq' && (
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 block">Your Answer</label>
                                            <RichTextEditor
                                                value={currentAnswer?.descriptiveAnswer || ''}
                                                onChange={(val) => handleDescriptiveAnswer(currentQuestion.id, val, currentQuestion)}
                                                placeholder="Type your answer here..."
                                                minHeight={currentQuestion.marks >= 10 ? '400px' : currentQuestion.marks >= 5 ? '320px' : '250px'}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="px-8 py-4 border-t border-gray-200 bg-white flex items-center justify-between flex-shrink-0">
                                <button onClick={goPrev} disabled={currentQuestionIndex === 0}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                                    Previous
                                </button>
                                <span className="text-xs text-gray-400">{currentQuestionIndex + 1} of {exam.questions.length}</span>
                                {currentQuestionIndex === exam.questions.length - 1 ? (
                                    <button onClick={() => { if (confirm(`Submit? ${answeredCount}/${exam.questions.length} answered.`)) handleSubmit(); }}
                                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
                                        Submit Exam
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    </button>
                                ) : (
                                    <button onClick={goNext} className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-gray-900 text-white hover:bg-gray-800 transition-colors">
                                        Next <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </main>

                {/* ====== RIGHT SIDE - Camera Panel ====== */}
                <aside className="w-[220px] bg-white border-l border-gray-200 flex flex-col flex-shrink-0">
                    <div className="px-3 py-2.5 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${proctoring.cameraStream ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`} />
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                {proctoring.cameraStream ? 'Camera' : 'Camera Off'}
                            </span>
                        </div>
                    </div>
                    <div className="p-2 flex-1">
                        <div className="relative rounded-lg overflow-hidden bg-black aspect-[3/4]">
                            {proctoring.cameraStream ? (
                                <>
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        muted
                                        playsInline
                                        className="w-full h-full object-cover" // Removed mirror transform just in case
                                        onLoadedMetadata={(e) => (e.target as HTMLVideoElement).play()}
                                    />
                                    <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 bg-red-500/90 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">
                                        <div className="w-1 h-1 rounded-full bg-white animate-pulse" /> REC
                                    </div>
                                </>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <div className="text-center">
                                        <svg className="w-8 h-8 text-gray-600 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                                        </svg>
                                        <p className="text-[10px] text-gray-500">No Camera</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="px-3 py-3 border-t border-gray-100 space-y-2 flex-shrink-0">
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="text-gray-400">Violations</span>
                            <span className={`font-bold ${violationCount > 0 ? 'text-red-500' : 'text-gray-700'}`}>{violationCount}/{MAX_VIOLATIONS}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="text-gray-400">Answered</span>
                            <span className="font-bold text-gray-700">{answeredCount}/{exam.questions.length}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="text-gray-400">Status</span>
                            <span className={`font-bold ${adminPaused ? 'text-amber-500' : 'text-emerald-600'}`}>{adminPaused ? 'Paused' : 'Active'}</span>
                        </div>
                        {/* AI Proctoring status */}
                        <div className="pt-1 mt-1 border-t border-gray-100 space-y-1.5">
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">AI Monitoring</p>
                            <div className="flex items-center justify-between text-[11px]">
                                <span className="text-gray-400">Camera</span>
                                <span className={`font-bold ${cameraOk ? 'text-emerald-600' : 'text-red-500'}`}>{cameraOk ? '● OK' : '● Blocked'}</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                                <span className="text-gray-400">Face</span>
                                <span className={`font-bold ${faceDetected ? 'text-emerald-600' : 'text-amber-500'}`}>{faceDetected ? '● Detected' : '● Not Found'}</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                                <span className="text-gray-400">Objects</span>
                                <span className={`font-bold ${objectsClean ? 'text-emerald-600' : 'text-amber-500'}`}>{objectsClean ? '● Clear' : '● Detected'}</span>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* AI Proctoring Alerts (soft toasts, top-right, above camera panel) */}
                {proctoringAlerts.length > 0 && (
                    <div className="fixed top-16 right-4 z-[180] w-[320px] space-y-2">
                        {proctoringAlerts.map(alert => (
                            <div key={alert.id} className="rounded-xl p-3 shadow-lg bg-white border border-amber-200 flex items-start gap-2.5 animate-slide-in-right">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${alert.type === 'camera' ? 'bg-red-50' :
                                    alert.type === 'face' ? 'bg-amber-50' : 'bg-orange-50'
                                    }`}>
                                    {alert.type === 'camera' ? (
                                        <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M12 18.75H4.5a2.25 2.25 0 01-2.25-2.25V9m12.841 9.091L16.5 19.5m-1.409-1.409c.739-.805 1.18-1.88 1.18-3.06 0-2.485-2.015-4.5-4.5-4.5S7.271 12.515 7.271 15c0 .625.128 1.22.359 1.76m7.642 1.331L12 21.75" />
                                        </svg>
                                    ) : alert.type === 'face' ? (
                                        <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
                                        </svg>
                                    ) : (
                                        <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                        </svg>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-[11px] font-bold mb-0.5 ${alert.type === 'camera' ? 'text-red-600' :
                                        alert.type === 'face' ? 'text-amber-600' : 'text-orange-600'
                                        }`}>
                                        {alert.type === 'camera' ? 'Camera Warning' :
                                            alert.type === 'face' ? 'Face Warning' : 'Object Warning'}
                                    </p>
                                    <p className="text-[11px] text-gray-600 leading-tight">{alert.message}</p>
                                </div>
                                <button onClick={() => setProctoringAlerts(prev => prev.filter(a => a.id !== alert.id))} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
