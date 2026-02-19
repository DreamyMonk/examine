
"use client";

import { useEffect, useCallback, useRef, useState } from 'react';

interface UseProctoringOptions {
    isActive: boolean;
    onAutoSubmit: (reason: string) => void;
    maxViolations?: number;
    warningDurationSeconds?: number;
}

interface ProctoringViolation {
    type: 'tab_switch' | 'fullscreen_exit' | 'copy_attempt' | 'paste_attempt' | 'right_click';
    timestamp: Date;
}

export function useProctoring({
    isActive,
    onAutoSubmit,
    maxViolations = 3,
    warningDurationSeconds = 10,
}: UseProctoringOptions) {
    const [violations, setViolations] = useState<ProctoringViolation[]>([]);
    const [showWarning, setShowWarning] = useState(false);
    const [warningCountdown, setWarningCountdown] = useState(0);
    const [warningMessage, setWarningMessage] = useState('');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [fullscreenWarning, setFullscreenWarning] = useState(false);

    const violationCountRef = useRef(0);
    const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
    const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isActiveRef = useRef(isActive);
    const onAutoSubmitRef = useRef(onAutoSubmit);

    useEffect(() => {
        isActiveRef.current = isActive;
        onAutoSubmitRef.current = onAutoSubmit;
    }, [isActive, onAutoSubmit]);

    const addViolation = useCallback((type: ProctoringViolation['type'], message: string) => {
        if (!isActiveRef.current) return;

        const newViolation: ProctoringViolation = { type, timestamp: new Date() };
        setViolations(prev => [...prev, newViolation]);
        violationCountRef.current += 1;

        const remaining = maxViolations - violationCountRef.current;

        if (violationCountRef.current >= maxViolations) {
            onAutoSubmitRef.current(`Auto-submitted: Too many violations (${violationCountRef.current}). Last: ${message}`);
            return;
        }

        // Show warning with countdown
        setWarningMessage(`${message} (${remaining} warning${remaining !== 1 ? 's' : ''} left before auto-submit)`);
        setWarningCountdown(warningDurationSeconds);
        setShowWarning(true);

        // Clear existing timers
        if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

        // Start countdown
        countdownTimerRef.current = setInterval(() => {
            setWarningCountdown(prev => {
                if (prev <= 1) {
                    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        // Auto-hide warning
        warningTimerRef.current = setTimeout(() => {
            setShowWarning(false);
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        }, warningDurationSeconds * 1000);

    }, [maxViolations, warningDurationSeconds]);

    // Enter fullscreen
    const enterFullscreen = useCallback(async () => {
        try {
            await document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } catch (err) {
            console.error('Failed to enter fullscreen:', err);
        }
    }, []);

    // Exit fullscreen
    const exitFullscreen = useCallback(async () => {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
            }
            setIsFullscreen(false);
        } catch (err) {
            console.error('Failed to exit fullscreen:', err);
        }
    }, []);

    useEffect(() => {
        if (!isActive) return;

        // === COPY LOCK ===
        const handleCopy = (e: ClipboardEvent) => {
            e.preventDefault();
            addViolation('copy_attempt', 'Copy attempt detected');
        };

        const handlePaste = (e: ClipboardEvent) => {
            e.preventDefault();
            addViolation('paste_attempt', 'Paste attempt detected');
        };

        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault();
            // Block only, no violation
        };

        // Block keyboard shortcuts (Ctrl+C, Ctrl+V, Ctrl+A, PrintScreen, etc.)
        const handleKeyDown = (e: KeyboardEvent) => {
            if (
                (e.ctrlKey && (e.key === 'c' || e.key === 'C' || e.key === 'v' || e.key === 'V' || e.key === 'a' || e.key === 'A')) ||
                e.key === 'PrintScreen' ||
                (e.ctrlKey && e.shiftKey && (e.key === 'i' || e.key === 'I')) // Dev tools
            ) {
                e.preventDefault();
                addViolation('copy_attempt', 'Blocked keyboard shortcut detected');
            }
        };

        // === TAB/VISIBILITY DETECTION ===
        const handleVisibilityChange = () => {
            if (document.hidden) {
                addViolation('tab_switch', 'Tab switch or window blur detected');
            }
        };

        const handleWindowBlur = () => {
            if (isActiveRef.current) {
                addViolation('tab_switch', 'Window focus lost');
            }
        };

        // === FULLSCREEN EXIT DETECTION ===
        const handleFullscreenChange = () => {
            if (!document.fullscreenElement && isActiveRef.current) {
                setIsFullscreen(false);
                setFullscreenWarning(true);
                addViolation('fullscreen_exit', 'Fullscreen exited during exam');
                // Show warning for 3 seconds, then re-enter fullscreen
                setTimeout(() => {
                    setFullscreenWarning(false);
                    if (isActiveRef.current) {
                        document.documentElement.requestFullscreen().catch(() => { });
                    }
                }, 3000);
            } else if (document.fullscreenElement) {
                setIsFullscreen(true);
                setFullscreenWarning(false);
            }
        };

        // === BEFOREUNLOAD (Close/Refresh Warning) ===
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = 'Your exam is in progress. Leaving will auto-submit your answers. Are you sure?';
            return e.returnValue;
        };

        // Add CSS to prevent text selection
        document.body.style.userSelect = 'none';
        document.body.style.webkitUserSelect = 'none';
        (document.body.style as any).msUserSelect = 'none';

        // Attach listeners
        document.addEventListener('copy', handleCopy);
        document.addEventListener('paste', handlePaste);
        document.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        window.addEventListener('blur', handleWindowBlur);
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            // Cleanup
            document.body.style.userSelect = '';
            document.body.style.webkitUserSelect = '';
            (document.body.style as any).msUserSelect = '';

            document.removeEventListener('copy', handleCopy);
            document.removeEventListener('paste', handlePaste);
            document.removeEventListener('contextmenu', handleContextMenu);
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            window.removeEventListener('blur', handleWindowBlur);
            window.removeEventListener('beforeunload', handleBeforeUnload);

            if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        };
    }, [isActive, addViolation]);

    const dismissWarning = useCallback(() => {
        setShowWarning(false);
        if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    }, []);

    return {
        violations,
        violationCount: violations.length,
        showWarning,
        warningMessage,
        warningCountdown,
        dismissWarning,
        isFullscreen,
        fullscreenWarning,
        enterFullscreen,
        exitFullscreen,
    };
}
