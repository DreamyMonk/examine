"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getExamSets, getSubmissionsForExam, getActiveSessionsForExam, getExamUsersByGroup } from '@/services/examService';
import type { ExamSet, ExamSubmission, ExamUser, LiveSession } from '@/types/exam';
import {
    Loader2, ClipboardCheck, Eye, ChevronDown, ChevronUp,
    User, Award, AlertTriangle, CheckCircle2, Clock, Users, XCircle
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
    }, []);

    const handleExamSelect = async (examId: string) => {
        setSelectedExamId(examId);
        setIsLoadingSubmissions(true);
        try {
            const data = await getSubmissionsForExam(examId);
            setSubmissions(data);

            // Find users who haven't submitted
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

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-lg font-semibold text-gray-900">Exam Submissions</h2>
                <p className="text-sm text-gray-500">View and review student answers</p>
            </div>

            {/* Exam Selector */}
            <div className="flex items-end gap-4">
                <div className="space-y-1.5 flex-1 max-w-sm">
                    <Label className="text-sm font-medium text-gray-700">Select Exam</Label>
                    <Select value={selectedExamId} onValueChange={handleExamSelect}>
                        <SelectTrigger>
                            <SelectValue placeholder="Choose an exam to view submissions" />
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

            {/* Toggle: Submitted / Not Submitted */}
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

            {/* Submissions List */}
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
                /* ====== NOT SUBMITTED VIEW ====== */
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
                    {/* Summary */}
                    <div className="flex items-center gap-4 p-3 rounded-lg bg-blue-50 border border-blue-100 text-sm">
                        <span className="text-blue-700 font-medium">{submissions.length} submissions</span>
                        <span className="text-blue-600">
                            Avg: {(submissions.reduce((s, sub) => s + sub.marksObtained, 0) / submissions.length).toFixed(1)} marks
                        </span>
                    </div>

                    {submissions.map(sub => {
                        const selectedExam = exams.find(e => e.id === selectedExamId);
                        const percentage = sub.totalMarks > 0 ? (sub.marksObtained / sub.totalMarks) * 100 : 0;

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
                                                    {sub.marksObtained}/{sub.totalMarks}
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
                                                onClick={() => setExpandedSubmission(expandedSubmission === sub.id ? null : sub.id)}
                                                className="h-8 w-8 text-gray-400"
                                            >
                                                {expandedSubmission === sub.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Expanded answers */}
                                    {expandedSubmission === sub.id && (
                                        <div className="mt-4 pt-4 border-t border-gray-100 space-y-3 animate-fade-in">
                                            {/* Selfie & ID */}
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

                                            {/* Answers */}
                                            {sub.answers.map((answer, i) => {
                                                const question = selectedExam?.questions.find(q => q.id === answer.questionId);
                                                return (
                                                    <div key={i} className="p-3 rounded-lg bg-gray-50 border border-gray-100 text-sm">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="flex-1">
                                                                <p className="text-xs text-gray-400 font-medium mb-1">Q{i + 1} · {answer.questionType === 'mcq' ? 'MCQ' : `${answer.marks} marks`}</p>
                                                                <p className="text-gray-700">{question?.question || 'Question not found'}</p>
                                                            </div>
                                                            {answer.marksAwarded !== undefined && (
                                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${answer.marksAwarded > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                                                                    }`}>
                                                                    {answer.marksAwarded}/{answer.marks}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {answer.questionType === 'mcq' && question?.options && (
                                                            <div className="mt-2 space-y-1">
                                                                {question.options.map((opt, optIdx) => (
                                                                    <div key={optIdx} className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${opt.isCorrect ? 'bg-emerald-50 text-emerald-700' :
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
                                                        {answer.questionType !== 'mcq' && (
                                                            <div className="mt-2 p-2 rounded bg-white border border-gray-100 text-sm text-gray-600">
                                                                <p className="text-xs text-gray-400 mb-1">Student&apos;s Answer:</p>
                                                                {answer.descriptiveAnswer ? (
                                                                    <div
                                                                        className="prose prose-sm max-w-none"
                                                                        dangerouslySetInnerHTML={{ __html: answer.descriptiveAnswer }}
                                                                    />
                                                                ) : (
                                                                    <span className="text-gray-300 italic">No answer provided</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
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
