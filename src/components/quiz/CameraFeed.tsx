
"use client";

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import type { AIProctorStatus } from '@/hooks/useFaceDetection';

interface CameraFeedProps {
    stream: MediaStream | null;
    aiStatus?: AIProctorStatus;
}

export interface CameraFeedHandle {
    getVideoElement: () => HTMLVideoElement | null;
}

export const CameraFeed = forwardRef<CameraFeedHandle, CameraFeedProps>(({ stream, aiStatus }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useImperativeHandle(ref, () => ({
        getVideoElement: () => videoRef.current,
    }));

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    if (!stream) return null;

    const getBorderColor = () => {
        if (!aiStatus || !aiStatus.isRunning) return 'border-border/30';

        // Object detection takes priority (cheating = red)
        if (aiStatus.detectedObjects.length > 0) return 'border-red-500/70 shadow-red-500/20';

        // Face status
        switch (aiStatus.lastFaceStatus) {
            case 'ok': return 'border-emerald-500/50';
            case 'no_face': return 'border-amber-500/50';
            case 'multiple_faces': return 'border-amber-500/50';
            case 'looking_away': return 'border-amber-500/50';
            default: return 'border-border/30';
        }
    };

    const getFaceStatusBadge = () => {
        if (!aiStatus || !aiStatus.isRunning) return null;

        // Show object warning if detected (highest priority)
        if (aiStatus.detectedObjects.length > 0) {
            return (
                <div className="absolute bottom-1.5 left-1.5 right-1.5 bg-red-500/95 text-white text-[8px] font-bold px-1.5 py-1 rounded-md text-center animate-pulse">
                    🚨 {aiStatus.lastObjectWarning}
                </div>
            );
        }

        let bgColor = 'bg-emerald-500/90';
        let text = '✅ OK';

        switch (aiStatus.lastFaceStatus) {
            case 'no_face':
                bgColor = 'bg-amber-500/90';
                text = '😶 No face';
                break;
            case 'multiple_faces':
                bgColor = 'bg-amber-500/90';
                text = `👥 ${aiStatus.faceCount} faces`;
                break;
            case 'looking_away':
                bgColor = 'bg-amber-500/90';
                text = '👀 Look here';
                break;
            case 'ok':
                bgColor = 'bg-emerald-500/90';
                text = '✅ OK';
                break;
        }

        return (
            <div className={`absolute bottom-1.5 left-1.5 ${bgColor} text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full transition-colors duration-300`}>
                {text}
            </div>
        );
    };

    const isAIActive = aiStatus && (aiStatus.isFaceDetectorSupported || aiStatus.isObjectDetectorLoaded) && aiStatus.isRunning;

    return (
        <div className="fixed z-50 bottom-4 right-4 w-44 h-auto">
            <div className={`rounded-2xl overflow-hidden border-2 shadow-2xl bg-black transition-all duration-500 ${getBorderColor()}`}>
                <div className="relative aspect-[4/3]">
                    <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                        style={{ transform: 'scaleX(-1)' }}
                    />
                    <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-red-500/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                        <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                        REC
                    </div>
                    {isAIActive && (
                        <div className="absolute top-1.5 right-1.5 flex items-center gap-1 bg-purple-500/90 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">
                            <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                            AI
                        </div>
                    )}
                    {getFaceStatusBadge()}
                </div>
            </div>
        </div>
    );
});

CameraFeed.displayName = 'CameraFeed';
