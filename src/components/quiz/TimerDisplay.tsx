"use client";

import { useEffect, useState } from 'react';
import { TimerIcon, AlertTriangle } from 'lucide-react';

interface TimerDisplayProps {
  initialDurationSeconds: number;
  onTimeUp: () => void;
  isPaused: boolean;
}

export function TimerDisplay({ initialDurationSeconds, onTimeUp, isPaused }: TimerDisplayProps) {
  const [timeLeft, setTimeLeft] = useState(initialDurationSeconds);

  useEffect(() => {
    if (timeLeft <= 0) {
      onTimeUp();
      return;
    }

    if (isPaused) {
      return;
    }

    const intervalId = setInterval(() => {
      setTimeLeft((prevTime) => prevTime - 1);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [timeLeft, onTimeUp, isPaused]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isLowTime = timeLeft <= 60;
  const isCritical = timeLeft <= 30;
  const totalSeconds = initialDurationSeconds;
  const pct = totalSeconds > 0 ? ((totalSeconds - timeLeft) / totalSeconds) * 100 : 0;

  return (
    <div className={`inline-flex items-center gap-3 px-5 py-3 rounded-2xl glass-card transition-all duration-500 ${isCritical ? 'border-red-500/50 pulse-glow' : isLowTime ? 'border-amber-500/30' : ''}`}>
      <div className={`flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center transition-colors duration-300 ${isCritical ? 'bg-red-500/15 text-red-400' : isLowTime ? 'bg-amber-500/15 text-amber-400' : 'bg-primary/10 text-primary'}`}>
        {isCritical ? <AlertTriangle className="h-5 w-5" /> : <TimerIcon className="h-5 w-5" />}
      </div>
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground font-medium">Time Left</span>
        <span className={`text-xl font-bold tabular-nums tracking-tight transition-colors duration-300 ${isCritical ? 'text-red-400' : isLowTime ? 'text-amber-400' : 'text-foreground'}`}>
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
      </div>
      {/* Tiny progress bar */}
      <div className="w-16 h-1.5 rounded-full bg-muted/50 overflow-hidden ml-1">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-linear ${isCritical ? 'bg-red-400' : isLowTime ? 'bg-amber-400' : 'bg-primary'}`}
          style={{ width: `${100 - pct}%` }}
        />
      </div>
    </div>
  );
}
