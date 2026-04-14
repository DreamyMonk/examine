"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  getExamUserByEmail,
  getExamsForGroup,
  updateExamUserSession,
  hasUserSubmittedExam,
} from '@/services/examService';
import {
  Loader2,
  Eye,
  EyeOff,
  ArrowRight,
  Lock,
  Clock,
  CheckCircle2,
  XCircle,
  CalendarClock,
  ChevronRight,
  BookOpen,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import type { ExamSet, ExamUser } from '@/types/exam';

export default function HomePage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<ExamUser | null>(null);
  const [availableExams, setAvailableExams] = useState<ExamSet[]>([]);
  const [submittedExamIds, setSubmittedExamIds] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<'login' | 'select_exam'>('login');
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async () => {
    if (!email.trim()) {
      toast({ title: 'Email Required', description: 'Please enter your registered email address.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      const foundUser = await getExamUserByEmail(email.trim().toLowerCase());
      if (!foundUser) {
        toast({ title: 'User Not Found', description: 'This email is not registered. Contact your administrator.', variant: 'destructive' });
        setIsLoading(false);
        return;
      }
      if (foundUser.password && foundUser.password !== password) {
        toast({ title: 'Invalid Password', description: 'The password you entered is incorrect.', variant: 'destructive' });
        setIsLoading(false);
        return;
      }
      const sessionId = crypto.randomUUID();
      try { await updateExamUserSession(foundUser.id, sessionId); } catch (e) { console.error(e); }

      const userWithSession = { ...foundUser, currentSessionId: sessionId };
      setUser(userWithSession);

      const exams = await getExamsForGroup(foundUser.groupId);
      setAvailableExams(exams);
      setStep('select_exam');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to verify credentials.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartExam = async (exam: ExamSet) => {
    if (!user) return;
    if (exam.examType === 'scheduled') {
      const now = Date.now();
      const start = exam.scheduledStart?.toDate ? exam.scheduledStart.toDate().getTime() : new Date(exam.scheduledStart).getTime();
      const end = exam.scheduledEnd?.toDate ? exam.scheduledEnd.toDate().getTime() : new Date(exam.scheduledEnd).getTime();
      if (now < start) { toast({ title: 'Not Yet Available', description: 'This exam has not started yet.', variant: 'destructive' }); return; }
      if (now > end) { toast({ title: 'Exam Ended', description: 'This exam window has passed.', variant: 'destructive' }); return; }
      try {
        const submitted = await hasUserSubmittedExam(user.id, exam.id);
        if (submitted) { toast({ title: 'Already Submitted', description: 'You have already submitted this exam. Only one attempt is allowed.', variant: 'destructive' }); return; }
      } catch (e) { }
    }
    sessionStorage.setItem('examUser', JSON.stringify(user));
    const width = screen.width;
    const height = screen.height;
    const popup = window.open(
      `/exam/${exam.id}`,
      'ExamWindow',
      `width=${width},height=${height},top=0,left=0,menubar=no,toolbar=no,location=no,status=no,resizable=no,scrollbars=yes`
    );
    if (popup) {
      popup.moveTo(0, 0);
      popup.resizeTo(screen.availWidth, screen.availHeight);
      toast({ title: 'Exam Opened', description: 'Your exam has been opened in a new window.' });
    } else {
      toast({ title: 'Popup Blocked', description: 'Please allow popups and try again.', variant: 'destructive' });
      router.push(`/exam/${exam.id}`);
    }
  };

  useEffect(() => {
    if (!user || availableExams.length === 0) return;
    const checkSubmissions = async () => {
      const scheduledExams = availableExams.filter((e) => e.examType === 'scheduled');
      const ids = new Set<string>();
      for (const exam of scheduledExams) {
        try { const submitted = await hasUserSubmittedExam(user.id, exam.id); if (submitted) ids.add(exam.id); } catch (e) { }
      }
      setSubmittedExamIds(ids);
    };
    checkSubmissions();
  }, [user, availableExams]);

  const handleLogout = () => {
    setStep('login');
    setUser(null);
    setEmail('');
    setPassword('');
    setAvailableExams([]);
    setSubmittedExamIds(new Set());
  };

  const getScheduleStatus = (exam: ExamSet): 'upcoming' | 'active' | 'ended' | null => {
    if (exam.examType !== 'scheduled' || !exam.scheduledStart || !exam.scheduledEnd) return null;
    const now = Date.now();
    const start = exam.scheduledStart?.toDate ? exam.scheduledStart.toDate().getTime() : new Date(exam.scheduledStart).getTime();
    const end = exam.scheduledEnd?.toDate ? exam.scheduledEnd.toDate().getTime() : new Date(exam.scheduledEnd).getTime();
    if (now < start) return 'upcoming';
    if (now > end) return 'ended';
    return 'active';
  };

  return (
    <div className="min-h-screen bg-white flex">

      {/* ── Left accent strip (desktop) ── */}
      <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] flex-col bg-indigo-600 p-10 relative overflow-hidden flex-shrink-0">
        {/* Decorative blobs */}
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-indigo-500/40 blur-3xl" />
        <div className="absolute bottom-10 -left-10 h-48 w-48 rounded-full bg-indigo-800/40 blur-2xl" />

        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-16">
            <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <span className="text-white font-semibold text-lg">ExamDesk</span>
          </div>

          {/* Feature points */}
          <div className="space-y-6 mt-4">
            <div>
              <h2 className="text-2xl font-semibold text-white leading-snug">
                Secure online<br />examination platform
              </h2>
              <p className="text-indigo-200 text-sm mt-3 leading-relaxed">
                AI-powered proctoring, real-time monitoring, and instant results — all in one place.
              </p>
            </div>

            <div className="space-y-3 mt-8">
              {[
                { icon: ShieldCheck, label: 'AI Proctoring', desc: 'Face detection & tab switch alerts' },
                { icon: Clock, label: 'Timed Exams', desc: 'Scheduled & practice modes' },
                { icon: CheckCircle2, label: 'Instant Results', desc: 'Auto-graded MCQ submissions' },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{label}</p>
                    <p className="text-xs text-indigo-200 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right: auth panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-white">
        <div className="w-full max-w-sm animate-fade-in-up">

          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center h-11 w-11 rounded-xl bg-indigo-600 mb-3 shadow-md shadow-indigo-200">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-slate-900">ExamDesk</h1>
            <p className="text-sm text-slate-500 mt-1">Secure Online Examination</p>
          </div>

          {/* ── LOGIN FORM ── */}
          {step === 'login' && (
            <div className="animate-scale-in">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-slate-900">Candidate Sign In</h2>
                <p className="text-sm text-slate-500 mt-1">Enter your credentials to access assigned exams.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="student-email" className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Email Address
                  </Label>
                  <Input
                    id="student-email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    disabled={isLoading}
                    className="h-10 bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="student-password" className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="student-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                      disabled={isLoading}
                      className="h-10 bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg text-sm pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  id="student-login-btn"
                  onClick={handleLogin}
                  disabled={isLoading}
                  className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm mt-1"
                >
                  {isLoading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</>
                  ) : (
                    <><ArrowRight className="mr-2 h-4 w-4" /> Sign In</>
                  )}
                </Button>
              </div>

              <p className="text-xs text-slate-400 text-center mt-5">
                Access is restricted to registered candidates only.
              </p>
            </div>
          )}

          {/* ── EXAM SELECTION ── */}
          {step === 'select_exam' && user && (
            <div className="animate-fade-in-up w-full max-w-lg mx-auto">

              {/* User info strip */}
              <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-0.5">Signed in as</p>
                  <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors px-3 py-2 rounded-lg hover:bg-slate-100 border border-slate-200"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              </div>

              <div className="mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Your Exams</h2>
                <p className="text-sm text-slate-500 mt-0.5">Select an exam to begin. Check availability before starting.</p>
              </div>

              {availableExams.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border border-slate-100 rounded-xl bg-slate-50">
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                    <BookOpen className="h-5 w-5 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-600">No exams assigned</p>
                  <p className="text-xs text-slate-400 mt-1">Contact your administrator for access.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableExams.map((exam) => {
                    const scheduleStatus = getScheduleStatus(exam);
                    const alreadySubmitted = submittedExamIds.has(exam.id);
                    const isDisabled = alreadySubmitted || scheduleStatus === 'upcoming' || scheduleStatus === 'ended';

                    return (
                      <button
                        key={exam.id}
                        id={`exam-card-${exam.id}`}
                        disabled={isDisabled}
                        onClick={() => !isDisabled && handleStartExam(exam)}
                        className={`w-full text-left rounded-xl border transition-all p-4 group ${
                          isDisabled
                            ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-70'
                            : 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-50 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-sm font-semibold text-slate-900 truncate">{exam.title}</span>
                              {/* Type badge */}
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
                                exam.examType === 'scheduled'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              }`}>
                                {exam.examType === 'scheduled' ? 'Scheduled' : 'Practice'}
                              </span>
                              {alreadySubmitted && (
                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="h-2.5 w-2.5" /> Submitted
                                </span>
                              )}
                              {!alreadySubmitted && scheduleStatus === 'upcoming' && (
                                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                                  Not Started
                                </span>
                              )}
                              {scheduleStatus === 'ended' && (
                                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-red-50 text-red-600 border border-red-200">
                                  Ended
                                </span>
                              )}
                              {scheduleStatus === 'active' && !alreadySubmitted && (
                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  Live
                                </span>
                              )}
                            </div>

                            {exam.description && (
                              <p className="text-xs text-slate-500 mb-2 line-clamp-1">{exam.description}</p>
                            )}

                            <div className="flex items-center gap-4 flex-wrap">
                              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                                <Clock className="h-3 w-3" />
                                {exam.durationMinutes} min
                              </span>
                              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                                <BookOpen className="h-3 w-3" />
                                {exam.questions.length} questions
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {exam.totalMarks} marks
                              </span>
                              {exam.examType === 'scheduled' && exam.scheduledStart && (
                                <span className="flex items-center gap-1 text-[11px] text-amber-600">
                                  <CalendarClock className="h-3 w-3" />
                                  {new Date(exam.scheduledStart?.toDate ? exam.scheduledStart.toDate() : exam.scheduledStart).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                                  {new Date(exam.scheduledStart?.toDate ? exam.scheduledStart.toDate() : exam.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className={`mt-0.5 flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center transition-all ${
                            isDisabled
                              ? 'bg-slate-100 text-slate-300'
                              : 'bg-indigo-50 text-indigo-500 group-hover:bg-indigo-600 group-hover:text-white'
                          }`}>
                            {alreadySubmitted ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            ) : scheduleStatus === 'ended' ? (
                              <XCircle className="h-4 w-4 text-slate-400" />
                            ) : isDisabled ? (
                              <Lock className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
