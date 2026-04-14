"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getExamSets, getSubmissionsForExam, getExamUsersByGroup, updateSubmissionGrades } from '@/services/examService';
import type { ExamSet, ExamSubmission, ExamUser, StudentAnswer } from '@/types/exam';
import {
    Loader2, ClipboardCheck, ChevronDown, ChevronUp,
    Award, AlertTriangle, CheckCircle2, XCircle, Save
} from 'lucide-react';

export function SubmissionsTab() {
    const [exams, setExams] = useState<ExamSet[]>([]);
    const [selectedExamId, setSelectedExamId] = useState<string>('');
    const [submissions, setSubmissions] = useState<ExamSubmission[]>([]);
    const [notSubmittedUsers, setNotSubmittedUsers] = useState<ExamUser[]>([]);
    const [isLoadingExams, setIsLoadingExams] = useState(true);
    const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
    const [expandedSubmission, setExpandedSubmission] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'submitted' | 'not_submitted'>('submitted');
    const [gradeDrafts, setGradeDrafts] = useState<Record<string, StudentAnswer[]>>({});
    const [savingSubmissionId, setSavingSubmissionId] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        const fetchExams = async () => {
            setIsLoadingExams(true);
            try {
                const data = await getExamSets();
                setExams(data);
            } catch (error: any) {
                toast({ title: 'Error', description: error.message, variant: 'destructive' });
            } finally {
                setIsLoadingExams(false);
            }
        };
        fetchExams();
    }, [toast]);

    const formatMarks = (marks: number) => Number.isInteger(marks) ? `${marks}` : marks.toFixed(1);

    const handleExamSelect = async (examId: string) => {
        setSelectedExamId(examId);
        setExpandedSubmission(null);
        setGradeDrafts({});
        setIsLoadingSubmissions(true);
        try {
            const data = await getSubmissionsForExam(examId);
            setSubmissions(data);

            const selectedExam = exams.find(e => e.id === examId);
            if (selectedExam && selectedExam.assignedGroups?.length > 0) {
                const allUsers: ExamUser[] = [];
                for (const groupId of selectedExam.assignedGroups) {
                    try {
                        const groupUsers = await getExamUsersByGroup(groupId);
                        allUsers.push(...groupUsers);
                    } catch (e) { }
                }
                const submittedEmails = new Set(data.map(s => s.userEmail.toLowerCase()));
                const notSubmitted = allUsers.filter(u => !submittedEmails.has(u.email.toLowerCase()));
                setNotSubmittedUsers(notSubmitted);
            } else {
                setNotSubmittedUsers([]);
            }
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoadingSubmissions(false);
        }
    };

    const getDraftAnswers = (submission: ExamSubmission) => gradeDrafts[submission.id] || submission.answers;

    const getDraftTotal = (answers: StudentAnswer[]) => answers.reduce((sum, answer) => sum + (answer.marksAwarded ?? 0), 0);

    const handleToggleSubmission = (submission: ExamSubmission) => {
        if (expandedSubmission === submission.id) {
            setExpandedSubmission(null);
            return;
        }

        setExpandedSubmission(submission.id);
        setGradeDrafts(prev => ({
            ...prev,
            [submission.id]: prev[submission.id] || submission.answers.map(answer => ({ ...answer })),
        }));
    };

    const handleGradeChange = (submissionId: string, answerIndex: number, rawValue: string) => {
        setGradeDrafts(prev => {
            const draft = (prev[submissionId] || []).map(answer => ({ ...answer }));
            const parsed = rawValue === '' ? 0 : Number(rawValue);
            const maxMarks = draft[answerIndex]?.marks ?? 0;
            const bounded = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), maxMarks) : 0;
            draft[answerIndex].marksAwarded = bounded;
            return { ...prev, [submissionId]: draft };
        });
    };

    const handleSaveGrades = async (submission: ExamSubmission) => {
        const answers = getDraftAnswers(submission);
        const invalid = answers.some(answer =>
            !Number.isFinite(answer.marksAwarded ?? 0) ||
            (answer.marksAwarded ?? 0) < 0 ||
            (answer.marksAwarded ?? 0) > answer.marks
        );

        if (invalid) {
            toast({ title: 'Invalid Marks', description: 'Marks awarded must stay between 0 and the question marks.', variant: 'destructive' });
            return;
        }

        setSavingSubmissionId(submission.id);
        try {
            const total = getDraftTotal(answers);
            await updateSubmissionGrades(submission.id, answers, total);
            setSubmissions(prev => prev.map(item =>
                item.id === submission.id
                    ? { ...item, answers, marksObtained: total, status: 'graded' }
                    : item
            ));
            toast({ title: 'Grades Saved', description: `Updated grading for ${submission.userName}.` });
        } catch (error: any) {
            toast({ title: 'Save Failed', description: error.message, variant: 'destructive' });
        } finally {
            setSavingSubmissionId(null);
        }
    };

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-lg font-semibold text-gray-900">Exam Submissions</h2>
                <p className="text-sm text-gray-500">View, review, and grade student answers</p>
            </div>

            <div className="flex items-end gap-4">
                <div className="space-y-1.5 flex-1 max-w-sm">
                    <Label className="text-sm font-medium text-gray-700">Select Exam</Label>
                    <Select value={selectedExamId} onValueChange={handleExamSelect}>
                        <SelectTrigger>
                            <SelectValue placeholder={isLoadingExams ? 'Loading exams...' : 'Choose an exam to view submissions'} />
                        </SelectTrigger>
                        <SelectContent>
                            {exams.map(exam => (
                                <SelectItem key={exam.id} value={exam.id}>
                                    {exam.title} ({exam.questions.length} questions)
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {selectedExamId && !isLoadingSubmissions && (
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setViewMode('submitted')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'submitted'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'text-gray-500 hover:bg-gray-100'
                            }`}
                    >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Submitted ({submissions.length})
                    </button>
                    <button
                        onClick={() => setViewMode('not_submitted')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'not_submitted'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'text-gray-500 hover:bg-gray-100'
                            }`}
                    >
                        <XCircle className="h-3.5 w-3.5" />
                        Not Submitted ({notSubmittedUsers.length})
                    </button>
                </div>
            )}

            {!selectedExamId ? (
                <Card className="shadow-sm border border-gray-200">
                    <CardContent className="flex flex-col items-center py-12">
                        <ClipboardCheck className="h-10 w-10 text-gray-300 mb-3" />
                        <p className="text-gray-500 text-sm">Select an exam to view submissions</p>
                    </CardContent>
                </Card>
            ) : isLoadingSubmissions ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
            ) : viewMode === 'not_submitted' ? (
                notSubmittedUsers.length === 0 ? (
                    <Card className="shadow-sm border border-gray-200">
                        <CardContent className="flex flex-col items-center py-12">
                            <CheckCircle2 className="h-10 w-10 text-emerald-300 mb-3" />
                            <p className="text-gray-500 text-sm">All assigned students have submitted!</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-2">
                        <div className="flex items-center gap-4 p-3 rounded-lg bg-amber-50 border border-amber-100 text-sm">
                            <span className="text-amber-700 font-medium">{notSubmittedUsers.length} students haven&apos;t submitted yet</span>
                        </div>
                        {notSubmittedUsers.map(user => (
                            <Card key={user.id} className="shadow-sm border border-gray-200">
                                <CardContent className="py-3 px-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 font-semibold text-sm">
                                                {user.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900 text-sm">{user.name}</p>
                                                <p className="text-xs text-gray-400">{user.email}</p>
                                            </div>
                                        </div>
                                        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-50 text-amber-600">
                                            Not Submitted
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )
            ) : submissions.length === 0 ? (
                <Card className="shadow-sm border border-gray-200">
                    <CardContent className="flex flex-col items-center py-12">
                        <ClipboardCheck className="h-10 w-10 text-gray-300 mb-3" />
                        <p className="text-gray-500 text-sm">No submissions yet for this exam</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    <div className="flex items-center gap-4 p-3 rounded-lg bg-blue-50 border border-blue-100 text-sm">
                        <span className="text-blue-700 font-medium">{submissions.length} submissions</span>
                        <span className="text-blue-600">
                            Avg: {(submissions.reduce((s, sub) => s + sub.marksObtained, 0) / submissions.length).toFixed(1)} marks
                        </span>
                    </div>

                    {submissions.map(sub => {
                        const selectedExam = exams.find(e => e.id === selectedExamId);
                        const percentage = sub.totalMarks > 0 ? (sub.marksObtained / sub.totalMarks) * 100 : 0;
                        const draftAnswers = getDraftAnswers(sub);

                        return (
                            <Card key={sub.id} className="shadow-sm border border-gray-200">
                                <CardContent className="py-4 px-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-semibold text-sm">
                                                {sub.userName.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900 text-sm">{sub.userName}</p>
                                                <p className="text-xs text-gray-400">{sub.userEmail}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <p className={`text-sm font-bold ${percentage >= 60 ? 'text-emerald-600' : percentage >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                                                    {formatMarks(sub.marksObtained)}/{formatMarks(sub.totalMarks)}
                                                </p>
                                                <p className="text-[10px] text-gray-400">{percentage.toFixed(0)}%</p>
                                            </div>
                                            {sub.violations > 0 && (
                                                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 text-red-500 text-xs font-semibold">
                                                    <AlertTriangle className="h-3 w-3" />
                                                    {sub.violations}
                                                </div>
                                            )}
                                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${sub.status === 'graded' ? 'bg-emerald-50 text-emerald-600' :
                                                sub.status === 'submitted' ? 'bg-blue-50 text-blue-600' :
                                                    'bg-amber-50 text-amber-600'
                                                }`}>
                                                {sub.status}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleToggleSubmission(sub)}
                                                className="h-8 w-8 text-gray-400"
                                            >
                                                {expandedSubmission === sub.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    </div>

                                    {expandedSubmission === sub.id && (
                                        <div className="mt-4 pt-4 border-t border-gray-100 space-y-3 animate-fade-in">
                                            <div className="flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                                                <div>
                                                    <p className="text-sm font-medium text-blue-700">Review and grade answers</p>
                                                    <p className="text-xs text-blue-600">Award custom marks per question. Decimal scores like 0.5 are supported.</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs text-blue-600">Draft total</p>
                                                    <p className="text-lg font-bold text-blue-700">{formatMarks(getDraftTotal(draftAnswers))}/{formatMarks(sub.totalMarks)}</p>
                                                </div>
                                            </div>

                                            <div className="flex gap-3">
                                                {sub.selfieUrl && (
                                                    <div className="space-y-1">
                                                        <p className="text-xs text-gray-400 font-medium">Selfie</p>
                                                        <img src={sub.selfieUrl} alt="Selfie" className="h-20 w-20 rounded-lg object-cover border border-gray-200" />
                                                    </div>
                                                )}
                                                {sub.idCardUrl && (
                                                    <div className="space-y-1">
                                                        <p className="text-xs text-gray-400 font-medium">ID Card</p>
                                                        <img src={sub.idCardUrl} alt="ID Card" className="h-20 w-32 rounded-lg object-cover border border-gray-200" />
                                                    </div>
                                                )}
                                            </div>

                                            {draftAnswers.map((answer, i) => {
                                                const question = selectedExam?.questions.find(q => q.id === answer.questionId);
                                                return (
                                                    <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="flex-1">
                                                                <p className="mb-1 text-xs font-medium text-gray-400">Q{i + 1} · {answer.questionType === 'mcq' ? 'MCQ' : `${formatMarks(answer.marks)} marks`}</p>
                                                                <p className="text-gray-700">{question?.question || 'Question not found'}</p>
                                                            </div>
                                                            <div className="w-[120px] flex-shrink-0">
                                                                <Label className="mb-1 block text-[11px] text-gray-500">Marks Awarded</Label>
                                                                <Input
                                                                    type="number"
                                                                    min={0}
                                                                    max={answer.marks}
                                                                    step={0.5}
                                                                    value={answer.marksAwarded ?? 0}
                                                                    onChange={(e) => handleGradeChange(sub.id, i, e.target.value)}
                                                                    className="h-8 text-xs"
                                                                />
                                                                <p className="mt-1 text-[10px] text-gray-400">Out of {formatMarks(answer.marks)}</p>
                                                            </div>
                                                        </div>

                                                        {answer.questionType === 'mcq' && question?.options && (
                                                            <div className="mt-2 space-y-1">
                                                                {question.options.map((opt, optIdx) => (
                                                                    <div key={optIdx} className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${opt.isCorrect ? 'bg-emerald-50 text-emerald-700' :
                                                                        answer.selectedOptionIndex === optIdx ? 'bg-red-50 text-red-700' :
                                                                            'text-gray-500'
                                                                        }`}>
                                                                        {opt.isCorrect && <CheckCircle2 className="h-3 w-3" />}
                                                                        {!opt.isCorrect && answer.selectedOptionIndex === optIdx && <AlertTriangle className="h-3 w-3" />}
                                                                        <span>{String.fromCharCode(65 + optIdx)}. {opt.text}</span>
                                                                        {answer.selectedOptionIndex === optIdx && <span className="ml-1">(selected)</span>}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {(answer.questionType === 'coding_5' || answer.questionType === 'coding_10') && (
                                                            <div className="mt-2 space-y-2">
                                                                <div className="rounded border border-gray-100 bg-white p-2 text-sm text-gray-600">
                                                                    <p className="mb-1 text-xs text-gray-400">Language</p>
                                                                    <p className="font-medium capitalize text-gray-700">{answer.codeLanguage || 'Not selected'}</p>
                                                                </div>
                                                                <div className="rounded border border-gray-100 bg-slate-950 p-3 text-xs text-slate-100">
                                                                    <p className="mb-2 text-[11px] uppercase tracking-wide text-slate-400">Submitted Code</p>
                                                                    <pre className="whitespace-pre-wrap">{answer.codeAnswer || 'No code submitted'}</pre>
                                                                </div>
                                                                {answer.codeExecution?.testResults?.length ? (
                                                                    <div className="space-y-2">
                                                                        {answer.codeExecution.testResults.map((result, resultIndex) => (
                                                                            <div key={resultIndex} className="rounded border border-gray-100 bg-white p-2">
                                                                                <div className="mb-1 flex items-center justify-between">
                                                                                    <p className="text-xs font-medium text-gray-500">Test Case {resultIndex + 1}</p>
                                                                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${result.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                                                                                        {result.passed ? 'Passed' : 'Failed'}
                                                                                    </span>
                                                                                </div>
                                                                                <p className="text-[11px] text-gray-500">Expected: <span className="font-medium text-gray-700">{result.expectedOutput || '(empty)'}</span></p>
                                                                                <p className="text-[11px] text-gray-500">Actual: <span className="font-medium text-gray-700">{result.actualOutput || result.stderr || result.compileOutput || '(empty)'}</span></p>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        )}

                                                        {answer.questionType !== 'mcq' && answer.questionType !== 'coding_5' && answer.questionType !== 'coding_10' && (
                                                            <div className="mt-2 rounded border border-gray-100 bg-white p-2 text-sm text-gray-600">
                                                                <p className="mb-1 text-xs text-gray-400">Student&apos;s Answer:</p>
                                                                {answer.descriptiveAnswer ? (
                                                                    <div
                                                                        className="prose prose-sm max-w-none"
                                                                        dangerouslySetInnerHTML={{ __html: answer.descriptiveAnswer }}
                                                                    />
                                                                ) : (
                                                                    <span className="italic text-gray-300">No answer provided</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}

                                            <div className="flex justify-end">
                                                <Button
                                                    onClick={() => handleSaveGrades(sub)}
                                                    disabled={savingSubmissionId === sub.id}
                                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                                >
                                                    {savingSubmissionId === sub.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                                    Save Grades
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
