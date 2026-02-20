"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { getExamSetById, subscribeToExamUser, hasUserSubmittedExam } from '@/services/examService';
import type { ExamSet, ExamUser, VerificationData, ProctoringState } from '@/types/exam';
import {
  Loader2, Camera, Monitor, Mic, CheckCircle2, XCircle, ArrowRight,
  ShieldCheck, CreditCard, User, Wifi, Volume2, AlertTriangle, BookOpen
} from 'lucide-react';
import { ExamClient } from '@/components/exam/ExamClient';

type VerificationStep = 'loading' | 'hardware' | 'selfie' | 'idcard' | 'guidelines' | 'ready' | 'exam' | 'error';

export default function ExamPage() {
  const params = useParams();
  const examId = params.quizId as string;
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState<VerificationStep>('loading');
  const [exam, setExam] = useState<ExamSet | null>(null);
  const [user, setUser] = useState<ExamUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Hardware check state
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle');
  const [micStatus, setMicStatus] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle');
  const [screenStatus, setScreenStatus] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle');
  const [networkStatus, setNetworkStatus] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle');

  // Streams
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // Selfie state
  const selfieVideoRef = useRef<HTMLVideoElement>(null);
  const selfieCanvasRef = useRef<HTMLCanvasElement>(null);
  const [selfieDataUrl, setSelfieDataUrl] = useState<string | null>(null);
  const [selfieCaptured, setSelfieCaptured] = useState(false);

  // ID card state
  const idCardVideoRef = useRef<HTMLVideoElement>(null);
  const idCardCanvasRef = useRef<HTMLCanvasElement>(null);
  const [idCardDataUrl, setIdCardDataUrl] = useState<string | null>(null);
  const [idCardCaptured, setIdCardCaptured] = useState(false);

  const isDesktop = typeof window !== 'undefined' && !(/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));

  // Load exam and user data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Get user from session storage
        const userStr = sessionStorage.getItem('examUser');
        if (!userStr) {
          setError('Session expired. Please login again.');
          setStep('error');
          return;
        }
        const examUser = JSON.parse(userStr) as ExamUser;
        setUser(examUser);

        // Fetch exam
        const examData = await getExamSetById(examId);
        if (!examData) {
          setError('Exam not found.');
          setStep('error');
          return;
        }
        setExam(examData);

        // Guard: scheduled exam checks
        if (examData.examType === 'scheduled') {
          const now = Date.now();
          const end = examData.scheduledEnd?.toDate
            ? examData.scheduledEnd.toDate().getTime()
            : new Date(examData.scheduledEnd).getTime();

          if (now > end) {
            setError('This scheduled exam has ended. The time window has passed.');
            setStep('error');
            return;
          }

          // Check if already submitted
          try {
            const alreadyDone = await hasUserSubmittedExam(examUser.id, examData.id);
            if (alreadyDone) {
              setError('You have already submitted this exam. Only one attempt is allowed for scheduled exams.');
              setStep('error');
              return;
            }
          } catch (e) {
            // Continue if check fails (offline fallback)
          }
        }

        setStep('hardware');
      } catch (err: any) {
        setError(err.message || 'Failed to load exam.');
        setStep('error');
      }
    };
    loadData();
  }, [examId]);

  // Cleanup streams on unmount
  useEffect(() => {
    return () => {
      cameraStreamRef.current?.getTracks().forEach(t => t.stop());
      micStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // ============ SECURITY: SINGLE SESSION & SINGLE TAB ============
  useEffect(() => {
    if (!user || !exam) return;

    // 1. Single Tab Enforcement via BroadcastChannel
    //    Scoped to user+exam so the login page popup doesn't conflict
    const channel = new BroadcastChannel(`exam_tab_lock_${user.id}_${exam.id}`);

    // Announce: "I just opened"
    channel.postMessage({ type: 'NEW_TAB_OPENED' });

    channel.onmessage = (event) => {
      if (event.data && event.data.type === 'NEW_TAB_OPENED') {
        // A newer tab opened — surrender this one
        alert('Exam has been opened in another window. This window will close.');
        window.close();
        router.push('/');
      }
    };

    // 2. Single Device Enforcement via Firestore Session
    // Listen for changes to the user document (specifically currentSessionId)
    const unsubSession = subscribeToExamUser(user.id, (remoteUser) => {
      if (!remoteUser) return;

      // If the session ID in DB implies a new login occurred
      // remoteUser is Partial<ExamUser>, so check if currentSessionId exists
      if (remoteUser.currentSessionId && user.currentSessionId && remoteUser.currentSessionId !== user.currentSessionId) {
        channel.close();

        // Log out immediately without alert loop (unsub happens in cleanup)
        alert('You have logged in from another device/browser. This session has been terminated.');
        sessionStorage.removeItem('examUser');
        router.push('/');
      }
    });

    return () => {
      channel.close();
      unsubSession();
    };
  }, [user, exam, router]);

  // ============ HARDWARE CHECK ============
  const checkCamera = async () => {
    setCameraStatus('checking');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      cameraStreamRef.current = stream;
      setCameraStatus('ok');
    } catch {
      setCameraStatus('fail');
    }
  };

  const checkMic = async () => {
    setMicStatus('checking');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      setMicStatus('ok');
    } catch {
      setMicStatus('fail');
    }
  };

  const checkScreen = async () => {
    setScreenStatus('checking');
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' } as any,
        preferCurrentTab: false,
        selfBrowserSurface: 'exclude',
        surfaceSwitching: 'exclude',
        systemAudio: 'exclude',
      } as any);

      // Enforce: must be full screen (monitor), reject window/tab
      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack.getSettings() as any;
      if (settings.displaySurface && settings.displaySurface !== 'monitor') {
        // User chose a window or tab instead of full screen
        stream.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
        setScreenStatus('fail');
        toast({
          title: 'Full Screen Required',
          description: 'You must share your entire screen, not a window or tab. Please try again and select "Entire Screen".',
          variant: 'destructive',
        });
        return;
      }

      screenStreamRef.current = stream;
      setScreenStatus('ok');
      videoTrack.addEventListener('ended', () => {
        setScreenStatus('idle');
        screenStreamRef.current = null;
      });
    } catch {
      setScreenStatus('fail');
    }
  };

  const checkNetwork = async () => {
    setNetworkStatus('checking');
    try {
      const online = navigator.onLine;
      setNetworkStatus(online ? 'ok' : 'fail');
    } catch {
      setNetworkStatus('fail');
    }
  };

  const runAllChecks = async () => {
    await checkNetwork();
    await checkCamera();
    await checkMic();
    if (isDesktop) await checkScreen();
  };

  const allHardwareOk = cameraStatus === 'ok' && micStatus === 'ok' && networkStatus === 'ok' && (screenStatus === 'ok' || !isDesktop);

  // ============ BLACK FRAME DETECTION ============
  const isFrameBlack = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): boolean => {
    const w = canvas.width;
    const h = canvas.height;
    if (w === 0 || h === 0) return true;
    // Sample a grid of pixels across the image
    const sampleSize = 20;
    let totalBrightness = 0;
    let sampleCount = 0;
    const imageData = ctx.getImageData(0, 0, w, h);
    for (let sy = 0; sy < sampleSize; sy++) {
      for (let sx = 0; sx < sampleSize; sx++) {
        const px = Math.floor((sx / sampleSize) * w);
        const py = Math.floor((sy / sampleSize) * h);
        const i = (py * w + px) * 4;
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        totalBrightness += (r + g + b) / 3;
        sampleCount++;
      }
    }
    const avgBrightness = totalBrightness / sampleCount;
    return avgBrightness < 10; // threshold: if avg brightness < 10 out of 255, it's basically black
  };

  // ============ SELFIE CAPTURE ============
  const startSelfieCamera = useCallback(async () => {
    if (selfieVideoRef.current && cameraStreamRef.current) {
      selfieVideoRef.current.srcObject = cameraStreamRef.current;
    }
  }, []);

  useEffect(() => {
    if (step === 'selfie') {
      startSelfieCamera();
    }
  }, [step, startSelfieCamera]);

  const captureSelfie = () => {
    if (!selfieVideoRef.current || !selfieCanvasRef.current) return;
    const video = selfieVideoRef.current;
    const canvas = selfieCanvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      // Reject if frame is black (camera blocked)
      if (isFrameBlack(canvas, ctx)) {
        toast({ title: 'Camera Blocked', description: 'Your camera appears to be blocked or covered. Please enable your camera and try again.', variant: 'destructive' });
        return;
      }
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setSelfieDataUrl(dataUrl);
      setSelfieCaptured(true);
      toast({ title: 'Selfie Captured', description: 'Your photo has been taken successfully.' });
    }
  };

  const retakeSelfie = () => {
    setSelfieDataUrl(null);
    setSelfieCaptured(false);
  };

  // ============ ID CARD CAPTURE ============
  const startIdCardCamera = useCallback(async () => {
    if (idCardVideoRef.current && cameraStreamRef.current) {
      idCardVideoRef.current.srcObject = cameraStreamRef.current;
    }
  }, []);

  useEffect(() => {
    if (step === 'idcard') {
      startIdCardCamera();
    }
  }, [step, startIdCardCamera]);

  const captureIdCard = () => {
    if (!idCardVideoRef.current || !idCardCanvasRef.current) return;
    const video = idCardVideoRef.current;
    const canvas = idCardCanvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      // Reject if frame is black (camera blocked)
      if (isFrameBlack(canvas, ctx)) {
        toast({ title: 'Camera Blocked', description: 'Your camera appears to be blocked or covered. Please enable your camera and try again.', variant: 'destructive' });
        return;
      }
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setIdCardDataUrl(dataUrl);
      setIdCardCaptured(true);
      toast({ title: 'ID Card Captured', description: 'Your ID card photo has been taken.' });
    }
  };

  const retakeIdCard = () => {
    setIdCardDataUrl(null);
    setIdCardCaptured(false);
  };

  // ============ STATUS HELPERS ============
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'checking': return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      case 'ok': return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case 'fail': return <XCircle className="h-5 w-5 text-red-500" />;
      default: return <div className="h-5 w-5 rounded-full border-2 border-gray-300" />;
    }
  };

  // ============ STEP INDICATOR ============
  const steps = [
    { key: 'hardware', label: 'Hardware Check', icon: Monitor },
    { key: 'selfie', label: 'Take Selfie', icon: User },
    { key: 'idcard', label: 'ID Card', icon: CreditCard },
    { key: 'guidelines', label: 'Guidelines', icon: BookOpen },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === step);

  // ============ RENDER ============
  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">Loading exam...</p>
        </div>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="w-full max-w-md shadow-sm border border-gray-200">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
            <p className="text-gray-500 text-sm text-center mb-6">{error}</p>
            <Button onClick={() => router.push('/')} className="bg-blue-600 hover:bg-blue-700 text-white">
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'exam' && exam && user) {
    const proctoringState: ProctoringState = {
      cameraGranted: cameraStatus === 'ok',
      micGranted: micStatus === 'ok',
      screenShared: screenStatus === 'ok',
      cameraStream: cameraStreamRef.current,
      micStream: micStreamRef.current,
      screenStream: screenStreamRef.current,
    };
    return (
      <ExamClient
        exam={exam}
        user={user}
        proctoring={proctoringState}
        selfieDataUrl={selfieDataUrl}
        idCardDataUrl={idCardDataUrl}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            <span className="font-semibold text-gray-900">Exam Verification</span>
          </div>
          <span className="text-sm text-gray-400">{exam?.title}</span>
        </div>
      </div>

      {/* Step indicator */}
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            {steps.map((s, i) => (
              <div key={s.key} className="flex items-center flex-1">
                <div className="flex items-center gap-2">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold ${i < currentStepIndex ? 'bg-emerald-100 text-emerald-600' :
                    i === currentStepIndex ? 'bg-blue-600 text-white' :
                      'bg-gray-100 text-gray-400'
                    }`}>
                    {i < currentStepIndex ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                  </div>
                  <span className={`text-sm font-medium hidden sm:inline ${i === currentStepIndex ? 'text-gray-900' : 'text-gray-400'
                    }`}>{s.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-px mx-3 ${i < currentStepIndex ? 'bg-emerald-300' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* HARDWARE CHECK */}
        {step === 'hardware' && (
          <div className="animate-fade-in-up">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-gray-900">System Check</h2>
              <p className="text-gray-500 mt-1">We need to verify your hardware before starting the exam</p>
            </div>

            <Card className="shadow-sm border border-gray-200">
              <CardContent className="space-y-4 py-6">
                {/* Network */}
                <div className="flex items-center justify-between p-4 rounded-lg border border-gray-100 bg-gray-50/50">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                      <Wifi className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">Internet Connection</p>
                      <p className="text-xs text-gray-400">Stable connection required</p>
                    </div>
                  </div>
                  {getStatusIcon(networkStatus)}
                </div>

                {/* Camera */}
                <div className="flex items-center justify-between p-4 rounded-lg border border-gray-100 bg-gray-50/50">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                      <Camera className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">Camera</p>
                      <p className="text-xs text-gray-400">Required for proctoring</p>
                    </div>
                  </div>
                  {getStatusIcon(cameraStatus)}
                </div>

                {/* Microphone */}
                <div className="flex items-center justify-between p-4 rounded-lg border border-gray-100 bg-gray-50/50">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                      <Mic className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">Microphone</p>
                      <p className="text-xs text-gray-400">Required for audio monitoring</p>
                    </div>
                  </div>
                  {getStatusIcon(micStatus)}
                </div>

                {/* Screen Share */}
                {isDesktop && (
                  <div className="flex items-center justify-between p-4 rounded-lg border border-gray-100 bg-gray-50/50">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                        <Monitor className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">Screen Share</p>
                        <p className="text-xs text-gray-400">Share your entire screen</p>
                      </div>
                    </div>
                    {getStatusIcon(screenStatus)}
                  </div>
                )}

                {/* Denied warning */}
                {(cameraStatus === 'fail' || micStatus === 'fail') && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-100">
                    <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-600">Some permissions were denied. All hardware must be enabled to proceed. Check your browser permissions.</p>
                  </div>
                )}

                <div className="pt-2 space-y-3">
                  {networkStatus === 'idle' ? (
                    <Button onClick={runAllChecks} className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white">
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Run System Check
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setStep('selfie')}
                      disabled={!allHardwareOk}
                      className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                    >
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* SELFIE CAPTURE */}
        {step === 'selfie' && (
          <div className="animate-fade-in-up">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-gray-900">Take a Selfie</h2>
              <p className="text-gray-500 mt-1">We need a photo of you for identity verification</p>
            </div>

            <Card className="shadow-sm border border-gray-200">
              <CardContent className="py-6 space-y-4">
                {!selfieCaptured ? (
                  <>
                    <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                      <video
                        ref={selfieVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 border-2 border-dashed border-white/30 rounded-xl pointer-events-none m-6" />
                      <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                        <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                        LIVE
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 text-center">Position your face within the frame and click capture</p>
                    <Button onClick={captureSelfie} className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white">
                      <Camera className="mr-2 h-4 w-4" />
                      Capture Selfie
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="relative rounded-xl overflow-hidden bg-gray-100 aspect-video">
                      {selfieDataUrl && (
                        <img src={selfieDataUrl} alt="Selfie" className="w-full h-full object-cover" />
                      )}
                      <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-emerald-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                        <CheckCircle2 className="h-3 w-3" />
                        Captured
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button onClick={retakeSelfie} variant="outline" className="flex-1 h-11">
                        Retake
                      </Button>
                      <Button onClick={() => setStep('idcard')} className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white">
                        Continue
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
            <canvas ref={selfieCanvasRef} className="hidden" />
          </div>
        )}

        {/* ID CARD CAPTURE */}
        {step === 'idcard' && (
          <div className="animate-fade-in-up">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-gray-900">Capture ID Card</h2>
              <p className="text-gray-500 mt-1">Hold your ID card in front of the camera</p>
            </div>

            <Card className="shadow-sm border border-gray-200">
              <CardContent className="py-6 space-y-4">
                {!idCardCaptured ? (
                  <>
                    <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                      <video
                        ref={idCardVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3/4 h-1/2 border-2 border-dashed border-white/40 rounded-lg" />
                      </div>
                      <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                        <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                        LIVE
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 text-center">Hold your ID card within the dashed area and click capture</p>
                    <Button onClick={captureIdCard} className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white">
                      <CreditCard className="mr-2 h-4 w-4" />
                      Capture ID Card
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="relative rounded-xl overflow-hidden bg-gray-100 aspect-video">
                      {idCardDataUrl && (
                        <img src={idCardDataUrl} alt="ID Card" className="w-full h-full object-cover" />
                      )}
                      <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-emerald-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                        <CheckCircle2 className="h-3 w-3" />
                        Captured
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button onClick={retakeIdCard} variant="outline" className="flex-1 h-11">
                        Retake
                      </Button>
                      <Button onClick={() => setStep('guidelines')} className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white">
                        Continue
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
            <canvas ref={idCardCanvasRef} className="hidden" />
          </div>
        )}

        {/* EXAM GUIDELINES */}
        {step === 'guidelines' && (
          <div className="animate-fade-in-up">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-gray-900">Exam Guidelines</h2>
              <p className="text-gray-500 mt-1">Please read and accept the following rules before proceeding</p>
            </div>

            <div className="space-y-4">
              {/* Rules Section */}
              <Card className="shadow-sm border border-gray-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                      <BookOpen className="h-4 w-4 text-blue-600" />
                    </div>
                    Exam Rules
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    'This exam is proctored. Your camera, microphone, and screen will be monitored throughout.',
                    'The exam will automatically enter fullscreen mode. Do not exit fullscreen.',
                    'Do not switch to other tabs or applications during the exam.',
                    'Keep your face visible to the camera at all times.',
                    'No mobile phones, books, or other materials are allowed in the camera frame.',
                    'Do not copy or paste content. Right-click and keyboard shortcuts are disabled.',
                    `You have ${exam?.durationMinutes || 0} minutes to complete ${exam?.questions.length || 0} questions worth ${exam?.totalMarks || 0} marks.`,
                  ].map((rule, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                      <div className="h-5 w-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">{rule}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Violations Section */}
              <Card className="shadow-sm border border-red-100 bg-red-50/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-red-700">
                    <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    </div>
                    Violations & Punishments
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2">
                    {/* Automatic violations */}
                    <div className="p-3 rounded-lg bg-white border border-red-100">
                      <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">Automatic Violations (Counted)</p>
                      <ul className="space-y-1.5">
                        <li className="text-sm text-gray-700 flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                          Exiting fullscreen mode
                        </li>
                        <li className="text-sm text-gray-700 flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                          Switching to another tab or application
                        </li>
                      </ul>
                    </div>

                    {/* Warnings */}
                    <div className="p-3 rounded-lg bg-white border border-amber-100">
                      <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">Soft Warnings (Monitored)</p>
                      <ul className="space-y-1.5">
                        <li className="text-sm text-gray-700 flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          Camera blocked or not detecting face
                        </li>
                        <li className="text-sm text-gray-700 flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          Suspicious objects detected (phone, book, etc.)
                        </li>
                      </ul>
                    </div>

                    {/* Punishment */}
                    <div className="p-3 rounded-lg bg-red-100 border border-red-200">
                      <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">Maximum Violations: 5</p>
                      <p className="text-sm text-red-600">
                        After 5 violations, your exam will be <span className="font-bold">automatically submitted</span> and flagged for review. Your administrator will be notified.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Accept and Proceed */}
              <Card className="shadow-sm border border-emerald-100 bg-emerald-50/30">
                <CardContent className="py-5">
                  <div className="flex items-start gap-3 mb-4">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-gray-700">
                      By clicking <span className="font-semibold">"Start Exam"</span>, you acknowledge that you have read and understood all the rules. Any violations will be recorded and reported.
                    </p>
                  </div>
                  <Button
                    onClick={() => setStep('exam')}
                    className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    I Accept — Start Exam
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
