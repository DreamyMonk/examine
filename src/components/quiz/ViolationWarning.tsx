
"use client";

import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ViolationWarningProps {
    show: boolean;
    message: string;
    countdown: number;
    violationCount: number;
    maxViolations: number;
    onDismiss: () => void;
}

export function ViolationWarning({ show, message, countdown, violationCount, maxViolations, onDismiss }: ViolationWarningProps) {
    if (!show) return null;

    const remaining = maxViolations - violationCount;

    return (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-8 pointer-events-none animate-fade-in-up">
            <div className="pointer-events-auto w-full max-w-md mx-4">
                <div className="relative overflow-hidden rounded-2xl border-2 border-red-500/50 bg-background/95 backdrop-blur-xl shadow-2xl shadow-red-500/20">
                    {/* Animated top bar */}
                    <div className="h-1 bg-red-500/30">
                        <div
                            className="h-full bg-red-500 transition-all duration-1000 ease-linear"
                            style={{ width: `${(countdown / 10) * 100}%` }}
                        />
                    </div>

                    <div className="p-5">
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 h-12 w-12 rounded-xl bg-red-500/15 flex items-center justify-center animate-pulse">
                                <AlertTriangle className="h-6 w-6 text-red-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-base font-bold text-red-400 mb-1">⚠️ Violation Detected</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>

                                {/* Violation counter */}
                                <div className="flex items-center gap-2 mt-3">
                                    <div className="flex gap-1">
                                        {Array.from({ length: maxViolations }).map((_, i) => (
                                            <div
                                                key={i}
                                                className={`h-2 w-6 rounded-full transition-all ${i < violationCount ? 'bg-red-500' : 'bg-muted/30'
                                                    }`}
                                            />
                                        ))}
                                    </div>
                                    <span className="text-xs text-red-400 font-semibold">
                                        {remaining} left
                                    </span>
                                </div>

                                {countdown > 0 && (
                                    <p className="text-xs text-muted-foreground mt-2">
                                        Auto-dismissing in {countdown}s
                                    </p>
                                )}
                            </div>
                            <Button size="icon" variant="ghost" onClick={onDismiss} className="flex-shrink-0 h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
