
"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, Mic, Monitor, CheckCircle2, XCircle, Loader2, ArrowRight, ShieldCheck, AlertTriangle } from 'lucide-react';

export interface ProctoringState {
    cameraGranted: boolean;
    micGranted: boolean;
    screenShared: boolean;
    cameraStream: MediaStream | null;
    micStream: MediaStream | null;
    screenStream: MediaStream | null;
}

interface ProctoringSetupProps {
    onProctoringReady: (state: ProctoringState) => void;
    onSkipProctoring: () => void;
    isHardMode?: boolean;
}

export function ProctoringSetup({ onProctoringReady, onSkipProctoring, isHardMode = false }: ProctoringSetupProps) {
    const [cameraStatus, setCameraStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
    const [micStatus, setMicStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
    const [screenStatus, setScreenStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');

    const cameraStreamRef = useRef<MediaStream | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);
    const screenStreamRef = useRef<MediaStream | null>(null);
    const videoPreviewRef = useRef<HTMLVideoElement>(null);

    const isDesktop = typeof window !== 'undefined' && !(/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));

    useEffect(() => {
        return () => {
            // Cleanup streams on unmount
            cameraStreamRef.current?.getTracks().forEach(t => t.stop());
            micStreamRef.current?.getTracks().forEach(t => t.stop());
            screenStreamRef.current?.getTracks().forEach(t => t.stop());
        };
    }, []);

    const requestCamera = async () => {
        setCameraStatus('requesting');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            cameraStreamRef.current = stream;
            setCameraStatus('granted');
            if (videoPreviewRef.current) {
                videoPreviewRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error('Camera access denied:', err);
            setCameraStatus('denied');
        }
    };

    const requestMic = async () => {
        setMicStatus('requesting');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            micStreamRef.current = stream;
            setMicStatus('granted');
        } catch (err) {
            console.error('Microphone access denied:', err);
            setMicStatus('denied');
        }
    };

    const requestScreen = async () => {
        setScreenStatus('requesting');
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    displaySurface: 'monitor',
                } as any,
                preferCurrentTab: false,
                selfBrowserSurface: 'exclude',
                surfaceSwitching: 'exclude',
                systemAudio: 'exclude',
            } as any);
            screenStreamRef.current = stream;
            setScreenStatus('granted');
            // Listen for screen share stop
            stream.getVideoTracks()[0].addEventListener('ended', () => {
                setScreenStatus('idle');
                screenStreamRef.current = null;
            });
        } catch (err) {
            console.error('Screen sharing denied:', err);
            setScreenStatus('denied');
        }
    };

    const handleProceed = () => {
        onProctoringReady({
            cameraGranted: cameraStatus === 'granted',
            micGranted: micStatus === 'granted',
            screenShared: screenStatus === 'granted',
            cameraStream: cameraStreamRef.current,
            micStream: micStreamRef.current,
            screenStream: screenStreamRef.current,
        });
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'requesting': return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
            case 'granted': return <CheckCircle2 className="h-5 w-5 text-emerald-400" />;
            case 'denied': return <XCircle className="h-5 w-5 text-red-400" />;
            default: return null;
        }
    };

    const getStatusText = (status: string, label: string) => {
        switch (status) {
            case 'requesting': return `Requesting ${label}...`;
            case 'granted': return `${label} enabled`;
            case 'denied': return `${label} denied`;
            default: return `Enable ${label}`;
        }
    };

    const allRequired = isHardMode
        ? cameraStatus === 'granted' && micStatus === 'granted' && (screenStatus === 'granted' || !isDesktop)
        : true; // In basic mode, no permissions are strictly required
    const hasAnyGrant = cameraStatus === 'granted' || micStatus === 'granted' || screenStatus === 'granted';

    return (
        <Card className="w-full max-w-lg glass-card gradient-border overflow-hidden animate-scale-in">
            <div className="h-1 w-full bg-gradient-to-r from-primary via-purple-500 to-accent" />
            <CardHeader className="text-center pt-8">
                <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center mb-3">
                    <ShieldCheck className="h-7 w-7 text-primary" />
                </div>
                <CardTitle className="text-2xl font-bold">Proctoring Setup</CardTitle>
                <CardDescription className="text-sm text-muted-foreground pt-1">
                    {isHardMode
                        ? 'Hard mode requires camera, microphone, and screen sharing to be enabled.'
                        : 'Enable camera, microphone, and screen sharing for a secure exam environment.'}
                </CardDescription>
                {isHardMode && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mt-2 mx-auto bg-red-500/10 text-red-400 border border-red-500/20">
                        🔥 Hard Mode — All Permissions Required
                    </div>
                )}
            </CardHeader>
            <CardContent className="space-y-4 px-8 pb-8">
                {/* Camera preview */}
                {cameraStatus === 'granted' && (
                    <div className="relative rounded-xl overflow-hidden border border-border/30 bg-black aspect-video max-h-40 mx-auto">
                        <video ref={videoPreviewRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-emerald-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                            <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                            LIVE
                        </div>
                    </div>
                )}

                {/* Camera button */}
                <button
                    onClick={requestCamera}
                    disabled={cameraStatus === 'granted' || cameraStatus === 'requesting'}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-300
            ${cameraStatus === 'granted' ? 'border-emerald-500/30 bg-emerald-500/5' : cameraStatus === 'denied' ? 'border-red-500/30 bg-red-500/5' : 'border-border/50 hover:border-primary/30 hover:bg-muted/30 cursor-pointer'}
            ${cameraStatus === 'granted' || cameraStatus === 'requesting' ? 'cursor-not-allowed' : ''}
          `}
                >
                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0
            ${cameraStatus === 'granted' ? 'bg-emerald-500/15' : cameraStatus === 'denied' ? 'bg-red-500/15' : 'bg-primary/10'}`}>
                        <Camera className={`h-5 w-5 ${cameraStatus === 'granted' ? 'text-emerald-400' : cameraStatus === 'denied' ? 'text-red-400' : 'text-primary'}`} />
                    </div>
                    <div className="flex-1 text-left">
                        <p className="font-semibold text-sm">{getStatusText(cameraStatus, 'Camera')}</p>
                        <p className="text-xs text-muted-foreground">{isHardMode ? 'Required' : 'Recommended'}</p>
                    </div>
                    {getStatusIcon(cameraStatus)}
                </button>

                {/* Microphone button */}
                <button
                    onClick={requestMic}
                    disabled={micStatus === 'granted' || micStatus === 'requesting'}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-300
            ${micStatus === 'granted' ? 'border-emerald-500/30 bg-emerald-500/5' : micStatus === 'denied' ? 'border-red-500/30 bg-red-500/5' : 'border-border/50 hover:border-primary/30 hover:bg-muted/30 cursor-pointer'}
            ${micStatus === 'granted' || micStatus === 'requesting' ? 'cursor-not-allowed' : ''}
          `}
                >
                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0
            ${micStatus === 'granted' ? 'bg-emerald-500/15' : micStatus === 'denied' ? 'bg-red-500/15' : 'bg-primary/10'}`}>
                        <Mic className={`h-5 w-5 ${micStatus === 'granted' ? 'text-emerald-400' : micStatus === 'denied' ? 'text-red-400' : 'text-primary'}`} />
                    </div>
                    <div className="flex-1 text-left">
                        <p className="font-semibold text-sm">{getStatusText(micStatus, 'Microphone')}</p>
                        <p className="text-xs text-muted-foreground">{isHardMode ? 'Required' : 'Recommended'}</p>
                    </div>
                    {getStatusIcon(micStatus)}
                </button>

                {/* Screen share button (desktop only) */}
                {isDesktop && (
                    <button
                        onClick={requestScreen}
                        disabled={screenStatus === 'granted' || screenStatus === 'requesting'}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-300
              ${screenStatus === 'granted' ? 'border-emerald-500/30 bg-emerald-500/5' : screenStatus === 'denied' ? 'border-red-500/30 bg-red-500/5' : 'border-border/50 hover:border-primary/30 hover:bg-muted/30 cursor-pointer'}
              ${screenStatus === 'granted' || screenStatus === 'requesting' ? 'cursor-not-allowed' : ''}
            `}
                    >
                        <div className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0
              ${screenStatus === 'granted' ? 'bg-emerald-500/15' : screenStatus === 'denied' ? 'bg-red-500/15' : 'bg-primary/10'}`}>
                            <Monitor className={`h-5 w-5 ${screenStatus === 'granted' ? 'text-emerald-400' : screenStatus === 'denied' ? 'text-red-400' : 'text-primary'}`} />
                        </div>
                        <div className="flex-1 text-left">
                            <p className="font-semibold text-sm">{getStatusText(screenStatus, 'Screen Share')}</p>
                            <p className="text-xs text-muted-foreground">{isHardMode ? 'Required' : 'Recommended for desktop'}</p>
                        </div>
                        {getStatusIcon(screenStatus)}
                    </button>
                )}

                {/* Warning for denied */}
                {(cameraStatus === 'denied' || micStatus === 'denied') && (
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                        <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-300">Some permissions were denied. You can still proceed, but proctoring features will be limited. Check your browser settings to allow access.</p>
                    </div>
                )}

                <div className="pt-4 space-y-3">
                    <Button
                        onClick={handleProceed}
                        className="w-full bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 text-white border-0 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300"
                        size="lg"
                        disabled={isHardMode && !allRequired}
                    >
                        Continue to Exam
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    {!isHardMode && (
                        <Button
                            onClick={onSkipProctoring}
                            variant="ghost"
                            className="w-full text-muted-foreground hover:text-foreground text-sm"
                        >
                            Skip Proctoring Setup
                        </Button>
                    )}
                    {isHardMode && !allRequired && (
                        <p className="text-xs text-center text-amber-400/80">
                            Please enable all permissions to continue in Hard Mode.
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
