"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getExamUserByEmail, getExamsForGroup, updateExamUserSession, hasUserSubmittedExam } from '@/services/examService';
import { Loader2, ClipboardCheck, Shield, Monitor, ArrowRight, Eye, EyeOff, Clock, CalendarDays, Lock } from 'lucide-react';
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

      // Check password if the user has one set
      if (foundUser.password && foundUser.password !== password) {
        toast({ title: 'Invalid Password', description: 'The password you entered is incorrect.', variant: 'destructive' });
        setIsLoading(false);
        return;
      }

      // Enforce Single Session: Update Firestore with new session ID
      const sessionId = crypto.randomUUID();
      try {
        await updateExamUserSession(foundUser.id, sessionId);
      } catch (e) {
        console.error("Failed to update session", e);
        // Continue anyway (offline dev mode fallback)
      }

      // Attach session ID to local user state (must be currentSessionId to match Firestore field)
      const userWithSession = { ...foundUser, currentSessionId: sessionId };
      setUser(userWithSession);

      // Fetch exams assigned to user's group
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

    // For scheduled exams: validate time window and submission status
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

      // Check if already submitted
      try {
        const submitted = await hasUserSubmittedExam(user.id, exam.id);
        if (submitted) {
          toast({ title: 'Already Submitted', description: 'You have already submitted this exam. Only one attempt is allowed.', variant: 'destructive' });
          return;
        }
      } catch (e) {
        // Continue anyway if check fails
      }
    }

    // Store user info in sessionStorage for the exam flow
    sessionStorage.setItem('examUser', JSON.stringify(user));

    // Open exam in a popup window (like Google signup)
    const width = screen.width;
    const height = screen.height;
    const popup = window.open(
      `/exam/${exam.id}`,
      'ExamWindow',
      `width=${width},height=${height},top=0,left=0,menubar=no,toolbar=no,location=no,status=no,resizable=no,scrollbars=yes`
    );

    if (popup) {
      // Try to make it fullscreen-like
      popup.moveTo(0, 0);
      popup.resizeTo(screen.availWidth, screen.availHeight);
      toast({ title: 'Exam Opened', description: 'Your exam has been opened in a new window.' });
    } else {
      // Popup blocked — fallback to same tab
      toast({ title: 'Popup Blocked', description: 'Please allow popups and try again, or the exam will open in this tab.', variant: 'destructive' });
      router.push(`/exam/${exam.id}`);
    }
  };

  // Check submission status for scheduled exams when exam list loads
  useEffect(() => {
    if (!user || availableExams.length === 0) return;
    const checkSubmissions = async () => {
      const scheduledExams = availableExams.filter(e => e.examType === 'scheduled');
      const ids = new Set<string>();
      for (const exam of scheduledExams) {
        try {
          const submitted = await hasUserSubmittedExam(user.id, exam.id);
          if (submitted) ids.add(exam.id);
        } catch (e) {
          // Skip
        }
      }
      setSubmittedExamIds(ids);
    };
    checkSubmissions();
  }, [user, availableExams]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-fade-in-up">
        {step === 'login' && (
          <Card className="shadow-sm border border-gray-200">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto h-14 w-14 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
                <Shield className="h-7 w-7 text-blue-600" />
              </div>
              <CardTitle className="text-2xl font-semibold text-gray-900">Student Login</CardTitle>
              <CardDescription className="text-gray-500 mt-1">
                Enter your credentials to access your exams
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-4">
              <div className="space-y-2">
                <Label htmlFor="student-email" className="text-sm font-medium text-gray-700">Email Address</Label>
                <Input
                  id="student-email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  disabled={isLoading}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="student-password" className="text-sm font-medium text-gray-700">Password</Label>
                <div className="relative">
                  <Input
                    id="student-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    disabled={isLoading}
                    className="h-11 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button
                onClick={handleLogin}
                disabled={isLoading}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white"
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

              {/* Features */}
              <div className="pt-4 border-t border-gray-100">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: Shield, label: 'Proctored' },
                    { icon: Monitor, label: 'Monitored' },
                    { icon: ClipboardCheck, label: 'Secure' },
                  ].map((f, i) => (
                    <div key={i} className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg bg-gray-50">
                      <f.icon className="h-4 w-4 text-gray-400" />
                      <span className="text-xs text-gray-500 font-medium">{f.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'select_exam' && user && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-900">Available Exams</h2>
              <p className="text-gray-500 mt-1">Welcome, <span className="font-medium text-gray-700">{user.name}</span></p>
            </div>

            {availableExams.length === 0 ? (
              <Card className="shadow-sm border border-gray-200">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <ClipboardCheck className="h-12 w-12 text-gray-300 mb-3" />
                  <p className="text-gray-500 text-sm">No exams are currently assigned to your group.</p>
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
                      className={`shadow-sm border transition-colors ${isDisabled
                        ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                        : 'border-gray-200 hover:border-blue-200 cursor-pointer'
                        }`}
                      onClick={() => !isDisabled && handleStartExam(exam)}
                    >
                      <CardContent className="flex items-center justify-between p-5">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-gray-900">{exam.title}</h3>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isScheduled
                              ? 'bg-amber-50 text-amber-600 border border-amber-200'
                              : 'bg-blue-50 text-blue-600 border border-blue-200'
                              }`}>
                              {isScheduled ? '📅 Scheduled' : '🔄 Practice'}
                            </span>
                            {alreadySubmitted && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-200">
                                ✅ Submitted
                              </span>
                            )}
                            {scheduleStatus === 'upcoming' && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                                🔒 Not Started
                              </span>
                            )}
                            {scheduleStatus === 'ended' && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-200">
                                ⏰ Ended
                              </span>
                            )}
                          </div>
                          {exam.description && (
                            <p className="text-sm text-gray-500 mt-0.5">{exam.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 flex-wrap">
                            <span>{exam.questions.length} questions</span>
                            <span>{exam.totalMarks} marks</span>
                            <span>{exam.durationMinutes} min</span>
                            {isScheduled && exam.scheduledStart && exam.scheduledEnd && (
                              <span className="text-amber-500">
                                {new Date(exam.scheduledStart?.toDate ? exam.scheduledStart.toDate() : exam.scheduledStart).toLocaleString()}
                                {' → '}
                                {new Date(exam.scheduledEnd?.toDate ? exam.scheduledEnd.toDate() : exam.scheduledEnd).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                        {isDisabled ? (
                          <Lock className="h-5 w-5 text-gray-300" />
                        ) : (
                          <ArrowRight className="h-5 w-5 text-gray-400" />
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
                <Button
                  variant="ghost"
                  onClick={() => { setStep('login'); setUser(null); setEmail(''); setPassword(''); }}
                  className="w-full text-gray-500"
                >
                  Back to Login
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
