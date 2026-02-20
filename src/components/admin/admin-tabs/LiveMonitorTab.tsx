"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
    getExamSets, getActiveSessionsForExam,
    pauseSession, resumeSession, terminateSession,
    sendChatMessage, subscribeToChatMessages,
    subscribeToStudentChatAlerts,
} from '@/services/examService';
import { adminSubscribeToCamera, adminSubscribeToScreen, isAgoraConfigured } from '@/services/agoraService';
import type { ExamSet, LiveSession, ChatMessage } from '@/types/exam';
import type { IRemoteVideoTrack, IRemoteAudioTrack } from 'agora-rtc-sdk-ng';

// ============ SESSION CARD (grid) ============
// Each card manages its own Agora camera subscription.
// Video thumbnail renders live, audio is muted in grid view.
function SessionCard({
    session,
    onClick,
    children,
}: {
    session: LiveSession;
    onClick: () => void;
    children: React.ReactNode;
}) {
    const camDivRef = useRef<HTMLDivElement>(null);
    const camTrackRef = useRef<IRemoteVideoTrack | null>(null);
    const audioTrackRef = useRef<IRemoteAudioTrack | null>(null);
    const cleanupRef = useRef<(() => Promise<void>) | null>(null);
    const [hasVideo, setHasVideo] = useState(false);

    // Use agoraChannel as the sole dependency — it's a stable string that won't change
    // across poll refreshes (same session = same channel).
    const channel = session.agoraChannel;

    useEffect(() => {
        if (!channel || !isAgoraConfigured()) return;
        let mounted = true;

        const playTrack = (track: IRemoteVideoTrack) => {
            if (!mounted) return;
            if (camTrackRef.current && camTrackRef.current !== track) {
                camTrackRef.current.stop();
            }
            camTrackRef.current = track;
            const tryPlay = () => {
                if (!mounted || !camDivRef.current) return;
                try {
                    track.play(camDivRef.current);
                    setHasVideo(true);
                } catch (e) {
                    // Retry once after a short delay (DOM may not be ready)
                    setTimeout(() => {
                        if (!mounted || !camDivRef.current) return;
                        try {
                            track.play(camDivRef.current);
                            setHasVideo(true);
                        } catch { }
                    }, 300);
                }
            };
            tryPlay();
        };

        adminSubscribeToCamera(
            channel,
            (track) => {
                if (!mounted) return;
                playTrack(track);
            },
            (track) => {
                if (!mounted) return;
                if (audioTrackRef.current) audioTrackRef.current.stop();
                audioTrackRef.current = track;
                // Audio muted in grid view — too noisy with many cards
            },
            () => {
                if (!mounted) return;
                if (camTrackRef.current) { camTrackRef.current.stop(); camTrackRef.current = null; }
                if (audioTrackRef.current) { audioTrackRef.current.stop(); audioTrackRef.current = null; }
                setHasVideo(false);
            }
        ).then(result => {
            if (result && mounted) cleanupRef.current = result.leave;
        });

        return () => {
            mounted = false;
            if (camTrackRef.current) { camTrackRef.current.stop(); camTrackRef.current = null; }
            if (audioTrackRef.current) { audioTrackRef.current.stop(); audioTrackRef.current = null; }
            cleanupRef.current?.();
            cleanupRef.current = null;
            setHasVideo(false);
        };
    }, [channel]); // ← Stable string dep — won't re-fire on poll refresh

    return (
        <div className="aspect-video bg-gray-900 relative overflow-hidden cursor-pointer" onClick={onClick}>
            {/* Agora-owned video div — no React children inside */}
            <div ref={camDivRef} className="absolute inset-0" />
            {/* Overlay: shown when no video yet */}
            {!hasVideo && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                        <Camera className="h-8 w-8 text-gray-600 mx-auto mb-1" />
                        <p className="text-[10px] text-gray-500">Connecting...</p>
                    </div>
                </div>
            )}
            {children}
        </div>
    );
}
import {
    Loader2, Eye, Monitor, Camera, Users, Wifi,
    AlertTriangle, Maximize2, X, Shield, Radio,
    Pause, Play, Ban, MessageCircle, Send, Clock
} from 'lucide-react';

export function LiveMonitorTab() {
    const [exams, setExams] = useState<ExamSet[]>([]);
    const [selectedExamId, setSelectedExamId] = useState<string>('');
    const [sessions, setSessions] = useState<LiveSession[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingSessions, setIsLoadingSessions] = useState(false);
    const [zoomedSession, setZoomedSession] = useState<LiveSession | null>(null);
    const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
    const { toast } = useToast();

    // Admin action modals
    const [actionModal, setActionModal] = useState<{ type: 'pause' | 'terminate' | null; session: LiveSession | null }>({ type: null, session: null });
    const [actionReason, setActionReason] = useState('');
    const [pauseDuration, setPauseDuration] = useState(5);
    const [isActioning, setIsActioning] = useState(false);

    // Chat
    const [chatSession, setChatSession] = useState<LiveSession | null>(null);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Unread student messages per session
    const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());
    const chatAlertCleanupRef = useRef<(() => void) | null>(null);

    // Agora video — separate refs for camera and screen containers
    const agoraCamVideoRef = useRef<HTMLDivElement>(null);
    const agoraScrVideoRef = useRef<HTMLDivElement>(null);
    const agoraCamCleanupRef = useRef<(() => Promise<void>) | null>(null);
    const agoraScrCleanupRef = useRef<(() => Promise<void>) | null>(null);
    const camTrackRef = useRef<IRemoteVideoTrack | null>(null);
    const scrTrackRef = useRef<IRemoteVideoTrack | null>(null);
    const [camConnected, setCamConnected] = useState(false);
    const [scrConnected, setScrConnected] = useState(false);

    useEffect(() => {
        const fetchExams = async () => {
            setIsLoading(true);
            try {
                const data = await getExamSets();
                setExams(data);
            } catch (error: any) {
                toast({ title: 'Error', description: error.message, variant: 'destructive' });
            } finally {
                setIsLoading(false);
            }
        };
        fetchExams();
        return () => {
            if (refreshInterval) clearInterval(refreshInterval);
        };
    }, []);

    const handleExamSelect = async (examId: string) => {
        setSelectedExamId(examId);
        if (refreshInterval) clearInterval(refreshInterval);

        await fetchSessions(examId);

        const interval = setInterval(() => fetchSessions(examId), 5000);
        setRefreshInterval(interval);
    };

    const fetchSessions = async (examId: string) => {
        try {
            const data = await getActiveSessionsForExam(examId);
            setSessions(prev => {
                // Merge: reuse existing objects where id matches to preserve React keys & refs
                const prevMap = new Map(prev.map(s => [s.id, s]));
                return data.map(newSession => {
                    const existing = prevMap.get(newSession.id);
                    if (existing && existing.agoraChannel === newSession.agoraChannel) {
                        // Same session, same channel — update fields but keep object identity stable
                        // by only replacing if data actually changed
                        const changed = (
                            existing.violations !== newSession.violations ||
                            existing.isPaused !== newSession.isPaused ||
                            existing.cameraStreamActive !== newSession.cameraStreamActive ||
                            existing.screenStreamActive !== newSession.screenStreamActive ||
                            existing.isActive !== newSession.isActive
                        );
                        return changed ? { ...existing, ...newSession } : existing;
                    }
                    return newSession;
                });
            });
        } catch (error: any) {
            // Silently fail on polling
        }
    };

    // ============ ADMIN ACTIONS ============
    const handlePause = async () => {
        if (!actionModal.session) return;
        setIsActioning(true);
        try {
            await pauseSession(actionModal.session.id, actionReason, pauseDuration);
            toast({ title: 'Exam Paused', description: `${actionModal.session.userName}'s exam has been paused.` });
            setActionModal({ type: null, session: null });
            setActionReason('');
            setPauseDuration(5);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsActioning(false);
        }
    };

    const handleResume = async (session: LiveSession) => {
        try {
            await resumeSession(session.id);
            toast({ title: 'Exam Resumed', description: `${session.userName}'s exam has been resumed.` });
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    const handleTerminate = async () => {
        if (!actionModal.session) return;
        setIsActioning(true);
        try {
            await terminateSession(actionModal.session.id, actionReason);
            toast({ title: 'Exam Terminated', description: `${actionModal.session.userName}'s exam has been terminated.` });
            setActionModal({ type: null, session: null });
            setActionReason('');
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsActioning(false);
        }
    };

    // ============ CHAT ============
    useEffect(() => {
        if (!chatSession) {
            setChatMessages([]);
            return;
        }
        const unsub = subscribeToChatMessages(chatSession.id, (msgs) => {
            setChatMessages(msgs);
        });
        return () => unsub();
    }, [chatSession?.id]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    // Subscribe to student chat alerts across all active sessions
    useEffect(() => {
        // Cleanup previous subscriptions
        if (chatAlertCleanupRef.current) {
            chatAlertCleanupRef.current();
            chatAlertCleanupRef.current = null;
        }

        if (sessions.length === 0) return;

        const sessionIds = sessions.map(s => s.id);
        let isInitialLoad = true;

        // Grace period: suppress toasts during initial snapshot load
        setTimeout(() => { isInitialLoad = false; }, 500);

        const unsub = subscribeToStudentChatAlerts(sessionIds, (sessionId, msg) => {
            // Update unread count (skip if that session's chat is already open)
            setUnreadCounts(prev => {
                if (chatSession?.id === sessionId) return prev; // Chat is open, don't count
                const next = new Map(prev);
                next.set(sessionId, (prev.get(sessionId) || 0) + 1);
                return next;
            });

            // Toast notification (only for truly new messages, not historical)
            if (!isInitialLoad) {
                toast({
                    title: `💬 New message from ${msg.senderName}`,
                    description: msg.message.length > 60 ? msg.message.slice(0, 60) + '...' : msg.message,
                });
            }
        });

        chatAlertCleanupRef.current = unsub;
        return () => {
            unsub();
            chatAlertCleanupRef.current = null;
        };
    }, [sessions.map(s => s.id).join(',')]); // Re-subscribe when session list changes

    const handleSendChat = async () => {
        if (!chatInput.trim() || !chatSession) return;
        try {
            await sendChatMessage({
                sessionId: chatSession.id,
                senderId: 'admin',
                senderName: 'Proctor',
                senderRole: 'admin',
                message: chatInput.trim(),
            });
            setChatInput('');
        } catch (error: any) {
            toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
        }
    };

    // Open chat and clear unread for that session
    const openChat = (session: LiveSession) => {
        setChatSession(session);
        setUnreadCounts(prev => {
            const next = new Map(prev);
            next.delete(session.id);
            return next;
        });
    };

    // ============ AGORA VIDEO SUBSCRIBE ============
    const subscribeToVideo = useCallback(async (session: LiveSession) => {
        // Stop tracks first — this releases Agora's internal DOM refs
        if (camTrackRef.current) { camTrackRef.current.stop(); camTrackRef.current = null; }
        if (scrTrackRef.current) { scrTrackRef.current.stop(); scrTrackRef.current = null; }

        // Leave previous Agora clients
        if (agoraCamCleanupRef.current) {
            await agoraCamCleanupRef.current();
            agoraCamCleanupRef.current = null;
        }
        if (agoraScrCleanupRef.current) {
            await agoraScrCleanupRef.current();
            agoraScrCleanupRef.current = null;
        }
        setCamConnected(false);
        setScrConnected(false);

        if (!session.agoraChannel || !isAgoraConfigured()) return;

        // Helper: play video track with retry (DOM may not be mounted yet)
        const playVideo = (track: IRemoteVideoTrack, container: React.RefObject<HTMLDivElement | null>, onSuccess: () => void) => {
            const attempt = () => {
                if (container.current) {
                    try {
                        track.play(container.current);
                        onSuccess();
                    } catch {
                        setTimeout(() => {
                            if (container.current) {
                                try { track.play(container.current); onSuccess(); } catch { }
                            }
                        }, 400);
                    }
                } else {
                    // Container not mounted yet — retry after modal renders
                    setTimeout(() => {
                        if (container.current) {
                            try { track.play(container.current); onSuccess(); } catch { }
                        }
                    }, 400);
                }
            };
            attempt();
        };

        // Subscribe to camera channel
        const camResult = await adminSubscribeToCamera(
            session.agoraChannel,
            (track, uid) => {
                // Stop previous track (releases Agora DOM refs) before playing new one
                if (camTrackRef.current) { camTrackRef.current.stop(); }
                camTrackRef.current = track;
                playVideo(track, agoraCamVideoRef, () => setCamConnected(true));
            },
            (track, uid) => { track.play(); }, // Audio plays in zoomed view
            (uid) => {
                if (camTrackRef.current) { camTrackRef.current.stop(); camTrackRef.current = null; }
                setCamConnected(false);
            }
        );
        if (camResult) agoraCamCleanupRef.current = camResult.leave;

        // Subscribe to screen channel
        const scrResult = await adminSubscribeToScreen(
            session.agoraChannel,
            (track, uid) => {
                if (scrTrackRef.current) { scrTrackRef.current.stop(); }
                scrTrackRef.current = track;
                playVideo(track, agoraScrVideoRef, () => setScrConnected(true));
            },
            (uid) => {
                if (scrTrackRef.current) { scrTrackRef.current.stop(); scrTrackRef.current = null; }
                setScrConnected(false);
            }
        );
        if (scrResult) agoraScrCleanupRef.current = scrResult.leave;
    }, []);

    // Subscribe when zoomed session changes
    useEffect(() => {
        if (zoomedSession?.agoraChannel) {
            subscribeToVideo(zoomedSession);
        } else {
            // Stop tracks and clear state when modal closes
            if (camTrackRef.current) { camTrackRef.current.stop(); camTrackRef.current = null; }
            if (scrTrackRef.current) { scrTrackRef.current.stop(); scrTrackRef.current = null; }
            setCamConnected(false);
            setScrConnected(false);
        }
        return () => {
            if (camTrackRef.current) { camTrackRef.current.stop(); camTrackRef.current = null; }
            if (scrTrackRef.current) { scrTrackRef.current.stop(); scrTrackRef.current = null; }
            if (agoraCamCleanupRef.current) {
                agoraCamCleanupRef.current();
                agoraCamCleanupRef.current = null;
            }
            if (agoraScrCleanupRef.current) {
                agoraScrCleanupRef.current();
                agoraScrCleanupRef.current = null;
            }
            setCamConnected(false);
            setScrConnected(false);
        };
    }, [zoomedSession?.id]);

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                    Live Monitoring
                </h2>
                <p className="text-sm text-gray-500">Watch students in real-time • Powered by Agora SDK</p>
            </div>

            {/* Exam Selector */}
            <div className="flex items-end gap-4">
                <div className="space-y-1.5 flex-1 max-w-sm">
                    <Label className="text-sm font-medium text-gray-700">Select Active Exam</Label>
                    <Select value={selectedExamId} onValueChange={handleExamSelect}>
                        <SelectTrigger><SelectValue placeholder="Choose an exam to monitor" /></SelectTrigger>
                        <SelectContent>
                            {exams.map(exam => (
                                <SelectItem key={exam.id} value={exam.id}>{exam.title}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                {selectedExamId && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100">
                        <Radio className="h-3 w-3" />
                        Auto-refreshing every 5s
                    </div>
                )}
                {!isAgoraConfigured() && selectedExamId && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100">
                        <AlertTriangle className="h-3 w-3" />
                        Agora App ID not set
                    </div>
                )}
            </div>

            {/* ====== ACTION MODAL (Pause/Terminate) ====== */}
            {actionModal.type && actionModal.session && (
                <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
                        <div className={`px-5 py-4 flex items-center gap-3 ${actionModal.type === 'pause' ? 'bg-amber-50 border-b border-amber-100' : 'bg-red-50 border-b border-red-100'}`}>
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${actionModal.type === 'pause' ? 'bg-amber-100' : 'bg-red-100'}`}>
                                {actionModal.type === 'pause'
                                    ? <Pause className="h-5 w-5 text-amber-600" />
                                    : <Ban className="h-5 w-5 text-red-600" />}
                            </div>
                            <div>
                                <h3 className={`font-semibold ${actionModal.type === 'pause' ? 'text-amber-800' : 'text-red-800'}`}>
                                    {actionModal.type === 'pause' ? 'Pause Exam' : 'Terminate Exam'}
                                </h3>
                                <p className="text-xs text-gray-500">{actionModal.session.userName}</p>
                            </div>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="text-sm font-medium text-gray-700 block mb-1.5">Reason</label>
                                <textarea
                                    value={actionReason}
                                    onChange={e => setActionReason(e.target.value)}
                                    placeholder={actionModal.type === 'pause' ? 'Why are you pausing this exam?' : 'Why are you terminating this exam?'}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                                />
                            </div>
                            {actionModal.type === 'pause' && (
                                <div>
                                    <label className="text-sm font-medium text-gray-700 block mb-1.5">
                                        <Clock className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                                        Pause Duration (minutes)
                                    </label>
                                    <div className="flex items-center gap-2">
                                        {[2, 5, 10, 15, 30].map(d => (
                                            <button key={d} onClick={() => setPauseDuration(d)}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${pauseDuration === d ? 'bg-amber-100 text-amber-700 border border-amber-300' : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'}`}>
                                                {d}m
                                            </button>
                                        ))}
                                        <input
                                            type="number" min="1" max="120"
                                            value={pauseDuration}
                                            onChange={e => setPauseDuration(parseInt(e.target.value) || 5)}
                                            className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-200"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => { setActionModal({ type: null, session: null }); setActionReason(''); }}>
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                disabled={!actionReason.trim() || isActioning}
                                onClick={actionModal.type === 'pause' ? handlePause : handleTerminate}
                                className={actionModal.type === 'pause' ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}
                            >
                                {isActioning ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                                {actionModal.type === 'pause' ? 'Pause Exam' : 'Terminate Exam'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ====== CHAT MODAL ====== */}
            {chatSession && (
                <div className="fixed bottom-4 right-4 z-[100] w-96 bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden" style={{ height: '480px' }}>
                    <div className="px-4 py-3 bg-blue-600 text-white flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <MessageCircle className="w-4 h-4" />
                            <div>
                                <span className="text-sm font-semibold">Chat — {chatSession.userName}</span>
                            </div>
                        </div>
                        <button onClick={() => setChatSession(null)} className="text-white/80 hover:text-white">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50">
                        {chatMessages.length === 0 && (
                            <p className="text-xs text-gray-400 text-center mt-12">No messages yet. Send a message to the student.</p>
                        )}
                        {chatMessages.map(msg => (
                            <div key={msg.id} className={`flex ${msg.senderRole === 'admin' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[75%] px-3 py-2 rounded-xl text-sm ${msg.senderRole === 'admin'
                                    ? 'bg-blue-600 text-white rounded-br-sm'
                                    : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm'
                                    }`}>
                                    {msg.senderRole === 'student' && (
                                        <p className="text-[10px] font-semibold text-blue-600 mb-0.5">{msg.senderName}</p>
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
                            placeholder="Type a message to student..."
                            className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-blue-300"
                        />
                        <button onClick={handleSendChat} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors">
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Zoomed view modal with Agora */}
            {zoomedSession && (
                <div className="fixed inset-0 z-[90] bg-black/80 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-xl w-full max-w-5xl overflow-hidden shadow-2xl">
                        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                            <div className="flex items-center gap-3">
                                <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                                <span className="font-semibold text-gray-900">{zoomedSession.userName}</span>
                                {zoomedSession.violations > 0 && (
                                    <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-semibold">
                                        {zoomedSession.violations} violations
                                    </span>
                                )}
                                {zoomedSession.isPaused && (
                                    <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-semibold">⏸ Paused</span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Action buttons */}
                                {!zoomedSession.isPaused ? (
                                    <Button variant="outline" size="sm"
                                        className="text-amber-600 border-amber-200 hover:bg-amber-50"
                                        onClick={() => setActionModal({ type: 'pause', session: zoomedSession })}>
                                        <Pause className="h-3.5 w-3.5 mr-1" /> Pause
                                    </Button>
                                ) : (
                                    <Button variant="outline" size="sm"
                                        className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                                        onClick={() => handleResume(zoomedSession)}>
                                        <Play className="h-3.5 w-3.5 mr-1" /> Resume
                                    </Button>
                                )}
                                <Button variant="outline" size="sm"
                                    className="text-red-600 border-red-200 hover:bg-red-50"
                                    onClick={() => setActionModal({ type: 'terminate', session: zoomedSession })}>
                                    <Ban className="h-3.5 w-3.5 mr-1" /> Terminate
                                </Button>
                                <Button variant="outline" size="sm"
                                    className="text-blue-600 border-blue-200 hover:bg-blue-50"
                                    onClick={() => openChat(zoomedSession)}>
                                    <MessageCircle className="h-3.5 w-3.5 mr-1" /> Chat
                                    {unreadCounts.get(zoomedSession.id) ? (
                                        <span className="ml-1 bg-blue-600 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5 min-w-[16px] text-center animate-pulse">
                                            {unreadCounts.get(zoomedSession.id)}
                                        </span>
                                    ) : null}
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => setZoomedSession(null)} className="h-8 w-8">
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-0">
                            {/* Camera feed
                                IMPORTANT: agoraCamVideoRef is a bare div with NO React children.
                                The overlay is a sibling, not inside the Agora-owned div.
                                This prevents React's reconciler from fighting with Agora's DOM ops. */}
                            <div className="aspect-video bg-gray-900 relative overflow-hidden">
                                {/* Agora exclusively owns this div — React renders nothing inside it */}
                                <div ref={agoraCamVideoRef} className="absolute inset-0" />
                                {/* Overlay is a React-only sibling — never touched by Agora */}
                                {!camConnected && (
                                    <div className="absolute inset-0 flex items-center justify-center z-10">
                                        {!isAgoraConfigured() ? (
                                            <div className="text-center">
                                                <Camera className="h-10 w-10 text-gray-500 mx-auto mb-2" />
                                                <p className="text-sm text-gray-400">Camera Feed</p>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {zoomedSession.agoraChannel
                                                        ? 'Set NEXT_PUBLIC_AGORA_APP_ID to enable'
                                                        : 'No Agora channel for this session'}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="text-center">
                                                <div className="w-8 h-8 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin mx-auto mb-3" />
                                                <p className="text-sm text-gray-400">Connecting to camera feed...</p>
                                                <p className="text-xs text-gray-600 mt-1">{zoomedSession.agoraChannel}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            {/* Screen share feed — same pattern */}
                            <div className="aspect-video bg-gray-800 relative overflow-hidden">
                                <div ref={agoraScrVideoRef} className="absolute inset-0" />
                                {!scrConnected && (
                                    <div className="absolute inset-0 flex items-center justify-center z-10">
                                        {!isAgoraConfigured() ? (
                                            <div className="text-center">
                                                <Monitor className="h-10 w-10 text-gray-500 mx-auto mb-2" />
                                                <p className="text-sm text-gray-400">Screen Share</p>
                                                <p className="text-xs text-gray-500 mt-1">Agora App ID not set</p>
                                            </div>
                                        ) : (
                                            <div className="text-center">
                                                <div className="w-8 h-8 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin mx-auto mb-3" />
                                                <p className="text-sm text-gray-400">Connecting to screen share...</p>
                                                <p className="text-xs text-gray-600 mt-1">
                                                    {zoomedSession.screenStreamActive ? 'Screen active' : 'Screen share inactive'}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1.5">
                                <Camera className="h-3.5 w-3.5" />
                                {zoomedSession.cameraStreamActive ? 'Camera ●' : 'Camera ○'}
                            </span>
                            <span className="flex items-center gap-1.5">
                                <Monitor className="h-3.5 w-3.5" />
                                {zoomedSession.screenStreamActive ? 'Screen ●' : 'Screen ○'}
                            </span>
                            <span className="flex items-center gap-1.5">
                                <Shield className="h-3.5 w-3.5" />
                                {zoomedSession.violations} violations
                            </span>
                            {zoomedSession.agoraChannel && (
                                <span className="flex items-center gap-1.5 text-xs text-gray-400 ml-auto">
                                    <Wifi className="h-3 w-3" />
                                    Agora: {zoomedSession.agoraChannel.slice(0, 20)}...
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Sessions Grid */}
            {!selectedExamId ? (
                <Card className="shadow-sm border border-gray-200">
                    <CardContent className="flex flex-col items-center py-12">
                        <Eye className="h-10 w-10 text-gray-300 mb-3" />
                        <p className="text-gray-500 text-sm">Select an exam to start monitoring</p>
                    </CardContent>
                </Card>
            ) : isLoadingSessions ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
            ) : sessions.length === 0 ? (
                <Card className="shadow-sm border border-gray-200">
                    <CardContent className="flex flex-col items-center py-12">
                        <Users className="h-10 w-10 text-gray-300 mb-3" />
                        <p className="text-gray-500 text-sm">No active sessions for this exam</p>
                        <p className="text-xs text-gray-400 mt-1">Students will appear here when they start the exam</p>
                    </CardContent>
                </Card>
            ) : (
                <>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Users className="h-4 w-4" />
                        <span>{sessions.length} active student(s)</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {sessions.map(session => (
                            <Card
                                key={session.id}
                                className={`shadow-sm border transition-colors overflow-hidden ${session.isPaused ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200 hover:border-blue-200'}`}
                            >
                                {/* Live camera thumbnail + audio — managed by SessionCard */}
                                <SessionCard session={session} onClick={() => setZoomedSession(session)}>
                                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-500/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                                        <div className="h-1 w-1 rounded-full bg-white animate-pulse" />
                                        LIVE
                                    </div>
                                    {session.isPaused && (
                                        <div className="absolute top-2 right-2 flex items-center gap-1 bg-amber-500/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                                            <Pause className="h-2.5 w-2.5" />
                                            PAUSED
                                        </div>
                                    )}
                                    <button className="absolute top-2 right-2 h-6 w-6 rounded bg-black/30 hover:bg-black/50 flex items-center justify-center transition-colors">
                                        <Maximize2 className="h-3 w-3 text-white" />
                                    </button>
                                    {session.violations > 0 && (
                                        <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-red-500/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                                            <AlertTriangle className="h-2.5 w-2.5" />
                                            {session.violations}
                                        </div>
                                    )}
                                </SessionCard>
                                <CardContent className="py-2.5 px-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="font-medium text-gray-900 text-sm truncate">{session.userName}</p>
                                        <div className="flex items-center gap-1.5">
                                            <div className={`h-1.5 w-1.5 rounded-full ${session.cameraStreamActive ? 'bg-emerald-500' : 'bg-gray-300'}`} title="Camera" />
                                            <div className={`h-1.5 w-1.5 rounded-full ${session.screenStreamActive ? 'bg-emerald-500' : 'bg-gray-300'}`} title="Screen" />
                                        </div>
                                    </div>
                                    {/* Action buttons per card */}
                                    <div className="flex items-center gap-1">
                                        {!session.isPaused ? (
                                            <button onClick={(e) => { e.stopPropagation(); setActionModal({ type: 'pause', session }); }}
                                                className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 transition-colors border border-amber-200">
                                                <Pause className="h-2.5 w-2.5" /> Pause
                                            </button>
                                        ) : (
                                            <button onClick={(e) => { e.stopPropagation(); handleResume(session); }}
                                                className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors border border-emerald-200">
                                                <Play className="h-2.5 w-2.5" /> Resume
                                            </button>
                                        )}
                                        <button onClick={(e) => { e.stopPropagation(); setActionModal({ type: 'terminate', session }); }}
                                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors border border-red-200">
                                            <Ban className="h-2.5 w-2.5" /> End
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); openChat(session); }}
                                            className="relative flex items-center justify-center px-2 py-1 rounded text-[10px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors border border-blue-200">
                                            <MessageCircle className="h-2.5 w-2.5" />
                                            {unreadCounts.get(session.id) ? (
                                                <span className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-[8px] font-bold rounded-full h-4 min-w-[16px] flex items-center justify-center px-1 animate-pulse">
                                                    {unreadCounts.get(session.id)}
                                                </span>
                                            ) : null}
                                        </button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
