"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getExamUserByEmail, getExamsForGroup, updateExamUserSession, hasUserSubmittedExam } from '@/services/examService';
import { Loader2, ClipboardCheck, Shield, Monitor, ArrowRight, Eye, EyeOff, Lock, Sparkles, ShieldCheck, TimerReset, ScanFace } from 'lucide-react';
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
      try {
        await updateExamUserSession(foundUser.id, sessionId);
      } catch (e) {
        console.error('Failed to update session', e);
      }

      const userWithSession = { ...foundUser, currentSessionId: sessionId };
      setUser(userWithSession);

      const exams = await getExamsForGroup(foundUser.groupId);
      setAvailableExams(exams);
      setStep('select_exam');
      toast({ title: 'Welcome', description: `Hello, ${foundUser.name}! Select an exam to begin.` });
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

      if (now < start) {
        toast({ title: 'Not Yet Available', description: 'This exam has not started yet.', variant: 'destructive' });
        return;
      }
      if (now > end) {
        toast({ title: 'Exam Ended', description: 'This exam window has passed.', variant: 'destructive' });
        return;
      }

      try {
        const submitted = await hasUserSubmittedExam(user.id, exam.id);
        if (submitted) {
          toast({ title: 'Already Submitted', description: 'You have already submitted this exam. Only one attempt is allowed.', variant: 'destructive' });
          return;
        }
      } catch (e) {
      }
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
      toast({ title: 'Popup Blocked', description: 'Please allow popups and try again, or the exam will open in this tab.', variant: 'destructive' });
      router.push(`/exam/${exam.id}`);
    }
  };

  useEffect(() => {
    if (!user || availableExams.length === 0) return;
    const checkSubmissions = async () => {
      const scheduledExams = availableExams.filter((e) => e.examType === 'scheduled');
      const ids = new Set<string>();
      for (const exam of scheduledExams) {
        try {
          const submitted = await hasUserSubmittedExam(user.id, exam.id);
          if (submitted) ids.add(exam.id);
        } catch (e) {
        }
      }
      setSubmittedExamIds(ids);
    };
    checkSubmissions();
  }, [user, availableExams]);

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-8 lg:grid-cols-[1.15fr,0.85fr]">
        <section className="animate-fade-in-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/70 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 shadow-sm backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            Production-grade candidate experience
          </div>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight text-slate-950 sm:text-5xl lg:text-6xl">
            Secure online exams with the clarity and confidence of a real assessment platform.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            ExamDesk guides students from verified sign-in to proctored completion with clean layouts, clear deadlines, and fewer moments of confusion under pressure.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              { icon: ShieldCheck, title: 'Trusted access', text: 'Identity-aware sign in with secure session handling.' },
              { icon: ScanFace, title: 'Active proctoring', text: 'Camera, microphone, and screen workflows built into the journey.' },
              { icon: TimerReset, title: 'Exam readiness', text: 'Schedules, duration, and status are visible before launch.' },
            ].map((item) => (
              <div key={item.title} className="premium-card border-slate-200/70 p-5">
                <div className="mb-4 inline-flex rounded-2xl bg-slate-950 p-3 text-white">
                  <item.icon className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-semibold text-slate-950">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 premium-card overflow-hidden border-slate-200/70 bg-slate-950 text-white">
            <div className="grid gap-5 px-6 py-6 sm:grid-cols-3">
              {[
                { value: '24/7', label: 'Assessment access' },
                { value: 'Live', label: 'Session integrity monitoring' },
                { value: 'Fast', label: 'Candidate onboarding flow' },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-3xl font-semibold">{item.value}</p>
                  <p className="mt-1 text-sm text-slate-300">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="w-full max-w-xl justify-self-end animate-fade-in-up">
          {step === 'login' && (
            <Card className="premium-card glass-panel border-slate-200/70">
              <CardHeader className="pb-2">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 shadow-lg shadow-blue-500/25">
                      <Shield className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">Candidate Access</p>
                      <p className="text-sm text-slate-500">Verified sign-in for your assigned examinations</p>
                    </div>
                  </div>
                  <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Secure
                  </div>
                </div>
                <CardTitle className="text-3xl font-semibold text-slate-950">Student Login</CardTitle>
                <CardDescription className="mt-2 text-base text-slate-600">
                  Enter your registered credentials to continue to the exam readiness checks.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="student-email" className="text-sm font-medium text-slate-700">Email Address</Label>
                  <Input
                    id="student-email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    disabled={isLoading}
                    className="h-12 rounded-2xl border-slate-200 bg-white/90"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="student-password" className="text-sm font-medium text-slate-700">Password</Label>
                  <div className="relative">
                    <Input
                      id="student-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                      disabled={isLoading}
                      className="h-12 rounded-2xl border-slate-200 bg-white/90 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button
                  onClick={handleLogin}
                  disabled={isLoading}
                  className="h-12 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/25 hover:from-blue-700 hover:to-cyan-600"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>

                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Session standards</p>
                    <p className="text-xs text-slate-400">Before exam launch</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { icon: Shield, label: 'Proctored' },
                      { icon: Monitor, label: 'Monitored' },
                      { icon: ClipboardCheck, label: 'Secure' },
                    ].map((f, i) => (
                      <div key={i} className="flex flex-col items-center gap-2 rounded-2xl border border-white bg-white/90 p-3">
                        <f.icon className="h-4 w-4 text-blue-600" />
                        <span className="text-xs font-medium text-slate-600">{f.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 'select_exam' && user && (
            <div className="space-y-4">
              <div className="premium-card border-slate-200/70 p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">Assigned exams</p>
                <h2 className="mt-2 text-3xl font-semibold text-slate-950">Welcome back, {user.name}</h2>
                <p className="mt-2 text-sm text-slate-600">Choose the exam you want to launch. Availability and lock states are shown before you begin.</p>
              </div>

              {availableExams.length === 0 ? (
                <Card className="premium-card border-slate-200/70">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <ClipboardCheck className="mb-3 h-12 w-12 text-slate-300" />
                    <p className="text-sm text-slate-500">No exams are currently assigned to your group.</p>
                    <Button
                      variant="ghost"
                      onClick={() => { setStep('login'); setUser(null); setEmail(''); setPassword(''); }}
                      className="mt-4 text-blue-600"
                    >
                      Back to Login
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {availableExams.map((exam) => {
                    const isScheduled = exam.examType === 'scheduled';
                    const alreadySubmitted = submittedExamIds.has(exam.id);
                    const now = Date.now();
                    let scheduleStatus: 'upcoming' | 'active' | 'ended' | null = null;

                    if (isScheduled && exam.scheduledStart && exam.scheduledEnd) {
                      const start = exam.scheduledStart?.toDate ? exam.scheduledStart.toDate().getTime() : new Date(exam.scheduledStart).getTime();
                      const end = exam.scheduledEnd?.toDate ? exam.scheduledEnd.toDate().getTime() : new Date(exam.scheduledEnd).getTime();
                      if (now < start) scheduleStatus = 'upcoming';
                      else if (now > end) scheduleStatus = 'ended';
                      else scheduleStatus = 'active';
                    }

                    const isDisabled = alreadySubmitted || scheduleStatus === 'upcoming' || scheduleStatus === 'ended';

                    return (
                      <Card
                        key={exam.id}
                        className={`premium-card overflow-hidden border transition-all ${isDisabled
                          ? 'border-slate-200/70 bg-slate-100/70 opacity-75 cursor-not-allowed'
                          : 'border-slate-200/70 cursor-pointer hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-xl'
                          }`}
                        onClick={() => !isDisabled && handleStartExam(exam)}
                      >
                        <CardContent className="flex items-center justify-between gap-5 p-6">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-semibold text-slate-950">{exam.title}</h3>
                              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${isScheduled
                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                : 'border-blue-200 bg-blue-50 text-blue-700'
                                }`}>
                                {isScheduled ? 'Scheduled' : 'Practice'}
                              </span>
                              {alreadySubmitted && (
                                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                                  Submitted
                                </span>
                              )}
                              {scheduleStatus === 'upcoming' && (
                                <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                                  Not Started
                                </span>
                              )}
                              {scheduleStatus === 'ended' && (
                                <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-red-600">
                                  Ended
                                </span>
                              )}
                            </div>
                            {exam.description && (
                              <p className="mt-1 text-sm text-slate-600">{exam.description}</p>
                            )}
                            <div className="mt-4 flex flex-wrap gap-2">
                              {[`${exam.questions.length} questions`, `${exam.totalMarks} marks`, `${exam.durationMinutes} min`].map((meta) => (
                                <span key={meta} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                                  {meta}
                                </span>
                              ))}
                              {isScheduled && exam.scheduledStart && exam.scheduledEnd && (
                                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                                  {new Date(exam.scheduledStart?.toDate ? exam.scheduledStart.toDate() : exam.scheduledStart).toLocaleString()}
                                  {' to '}
                                  {new Date(exam.scheduledEnd?.toDate ? exam.scheduledEnd.toDate() : exam.scheduledEnd).toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>
                          {isDisabled ? (
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                              <Lock className="h-5 w-5" />
                            </div>
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-900/10">
                              <ArrowRight className="h-5 w-5" />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                  <Button
                    variant="ghost"
                    onClick={() => { setStep('login'); setUser(null); setEmail(''); setPassword(''); }}
                    className="w-full rounded-2xl py-6 text-slate-500"
                  >
                    Back to Login
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
