"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { createExamSet, getExamSets, deleteExamSet, getUserGroups } from '@/services/examService';
import type { ExamSet, ExamQuestion, UserGroup, QuestionType, ExamType } from '@/types/exam';
import {
    Loader2, PlusCircle, Trash2, FileText, Clock, Hash,
    ChevronDown, ChevronUp, Award, CalendarDays
} from 'lucide-react';
import { v4Fallback } from '@/lib/utils';

export function ExamsTab() {
    const [exams, setExams] = useState<ExamSet[]>([]);
    const [groups, setGroups] = useState<UserGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showCreator, setShowCreator] = useState(false);
    const [expandedExam, setExpandedExam] = useState<string | null>(null);

    // Exam creation form
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [duration, setDuration] = useState(60);
    const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
    const [questions, setQuestions] = useState<ExamQuestion[]>([]);

    // Exam type fields
    const [examType, setExamType] = useState<ExamType>('practice');
    const [scheduledStart, setScheduledStart] = useState('');
    const [scheduledEnd, setScheduledEnd] = useState('');
    const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);

    const { toast } = useToast();

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [examsData, groupsData] = await Promise.all([getExamSets(), getUserGroups()]);
            setExams(examsData);
            setGroups(groupsData);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // Add question
    const addQuestion = (type: QuestionType) => {
        const marks = type === 'mcq' ? 1 : type === 'descriptive_2' ? 2 : type === 'descriptive_5' ? 5 : 10;
        const newQ: ExamQuestion = {
            id: v4Fallback(),
            type,
            question: '',
            marks,
            ...(type === 'mcq' ? {
                options: [
                    { text: '', isCorrect: false },
                    { text: '', isCorrect: false },
                    { text: '', isCorrect: false },
                    { text: '', isCorrect: false },
                ],
            } : {
                correctAnswer: '',
            }),
        };
        setQuestions(prev => [...prev, newQ]);
    };

    // Strip undefined/null fields Firestore can't handle
    const sanitizeQuestion = (q: ExamQuestion): Record<string, any> => {
        const obj: Record<string, any> = {
            id: q.id,
            type: q.type,
            question: q.question,
            marks: q.marks,
        };
        if (q.options !== undefined && q.options !== null) obj.options = q.options;
        if (q.correctAnswer !== undefined && q.correctAnswer !== null) obj.correctAnswer = q.correctAnswer;
        return obj;
    };

    // Update question
    const updateQuestion = (index: number, field: string, value: any) => {
        setQuestions(prev => {
            const updated = [...prev];
            (updated[index] as any)[field] = value;
            return updated;
        });
    };

    // Update MCQ option
    const updateOption = (qIndex: number, optIndex: number, field: string, value: any) => {
        setQuestions(prev => {
            const updated = [...prev];
            if (updated[qIndex].options) {
                if (field === 'isCorrect' && value === true) {
                    // Only one correct answer
                    updated[qIndex].options!.forEach((opt, i) => {
                        opt.isCorrect = i === optIndex;
                    });
                } else {
                    (updated[qIndex].options![optIndex] as any)[field] = value;
                }
            }
            return updated;
        });
    };

    // Remove question
    const removeQuestion = (index: number) => {
        setQuestions(prev => prev.filter((_, i) => i !== index));
    };

    // Toggle group selection
    const toggleGroup = (groupId: string) => {
        setSelectedGroups(prev =>
            prev.includes(groupId) ? prev.filter(g => g !== groupId) : [...prev, groupId]
        );
    };

    // Calculate total marks
    const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);

    // Save exam
    const handleSave = async () => {
        if (!title) {
            toast({ title: 'Title Required', description: 'Please enter an exam title.', variant: 'destructive' });
            return;
        }
        if (questions.length === 0) {
            toast({ title: 'No Questions', description: 'Add at least one question.', variant: 'destructive' });
            return;
        }
        if (selectedGroups.length === 0) {
            toast({ title: 'No Groups', description: 'Assign this exam to at least one group.', variant: 'destructive' });
            return;
        }

        // Validate questions
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            if (!q.question.trim()) {
                toast({ title: 'Empty Question', description: `Question ${i + 1} has no text.`, variant: 'destructive' });
                return;
            }
            if (q.type === 'mcq') {
                const hasEmptyOption = q.options?.some(o => !o.text.trim());
                if (hasEmptyOption) {
                    toast({ title: 'Empty Options', description: `Question ${i + 1} has empty options.`, variant: 'destructive' });
                    return;
                }
                const hasCorrect = q.options?.some(o => o.isCorrect);
                if (!hasCorrect) {
                    toast({ title: 'No Correct Answer', description: `Question ${i + 1} needs a correct answer.`, variant: 'destructive' });
                    return;
                }
            }
        }

        setIsSaving(true);
        try {
            const examData: any = {
                title,
                description,
                questions: questions.map(sanitizeQuestion) as ExamQuestion[],
                durationMinutes: duration,
                totalMarks,
                createdBy: 'admin',
                assignedGroups: selectedGroups,
                examType,
            };

            if (examType === 'scheduled') {
                if (!scheduledStart || !scheduledEnd) {
                    toast({ title: 'Schedule Required', description: 'Please set both start and end date/time for scheduled exams.', variant: 'destructive' });
                    setIsSaving(false);
                    return;
                }
                const start = new Date(scheduledStart);
                const end = new Date(scheduledEnd);
                if (end <= start) {
                    toast({ title: 'Invalid Schedule', description: 'End time must be after start time.', variant: 'destructive' });
                    setIsSaving(false);
                    return;
                }
                examData.scheduledStart = start;
                examData.scheduledEnd = end;
                examData.timezone = timezone;
                // Auto-calculate duration from time window
                examData.durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
            }

            await createExamSet(examData);
            toast({ title: 'Exam Created', description: `"${title}" has been created with ${questions.length} questions.` });
            // Reset form
            setTitle(''); setDescription(''); setDuration(60); setExamType('practice');
            setScheduledStart(''); setScheduledEnd(''); setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
            setSelectedGroups([]); setQuestions([]);
            setShowCreator(false);
            fetchData();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (examId: string, examTitle: string) => {
        if (!confirm(`Delete exam "${examTitle}"?`)) return;
        try {
            await deleteExamSet(examId);
            toast({ title: 'Exam Deleted', description: `"${examTitle}" removed.` });
            fetchData();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    const getQuestionTypeLabel = (type: QuestionType) => {
        switch (type) {
            case 'mcq': return 'MCQ';
            case 'descriptive_2': return '2 Marks';
            case 'descriptive_5': return '5 Marks';
            case 'descriptive_10': return '10 Marks';
        }
    };

    const getQuestionTypeBadge = (type: QuestionType) => {
        switch (type) {
            case 'mcq': return 'bg-gray-100 text-gray-600';
            case 'descriptive_2': return 'bg-amber-50 text-amber-600';
            case 'descriptive_5': return 'bg-purple-50 text-purple-600';
            case 'descriptive_10': return 'bg-emerald-50 text-emerald-600';
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">Exams</h2>
                    <p className="text-sm text-gray-500">{exams.length} exams created</p>
                </div>
                <Button onClick={() => setShowCreator(!showCreator)} className="bg-blue-600 hover:bg-blue-700 text-white">
                    <PlusCircle className="mr-1.5 h-4 w-4" />
                    Create Exam
                </Button>
            </div>

            {/* Exam Creator */}
            {showCreator && (
                <Card className="shadow-sm border border-blue-100 bg-white animate-scale-in">
                    <CardHeader>
                        <CardTitle className="text-base font-semibold text-gray-900">Create New Exam</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Exam Type Toggle */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-700">Exam Type</Label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setExamType('practice')}
                                    className={`flex-1 px-4 py-3 rounded-lg border-2 text-left transition-all ${examType === 'practice'
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <Clock className={`h-4 w-4 ${examType === 'practice' ? 'text-blue-600' : 'text-gray-400'}`} />
                                        <span className={`text-sm font-semibold ${examType === 'practice' ? 'text-blue-700' : 'text-gray-700'}`}>Practice</span>
                                    </div>
                                    <p className="text-xs text-gray-500">Duration-based timer. Students can take multiple attempts.</p>
                                </button>
                                <button
                                    onClick={() => setExamType('scheduled')}
                                    className={`flex-1 px-4 py-3 rounded-lg border-2 text-left transition-all ${examType === 'scheduled'
                                        ? 'border-amber-500 bg-amber-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <CalendarDays className={`h-4 w-4 ${examType === 'scheduled' ? 'text-amber-600' : 'text-gray-400'}`} />
                                        <span className={`text-sm font-semibold ${examType === 'scheduled' ? 'text-amber-700' : 'text-gray-700'}`}>Scheduled</span>
                                    </div>
                                    <p className="text-xs text-gray-500">Fixed time window. One attempt only. Real clock — no pausing.</p>
                                </button>
                            </div>
                        </div>

                        {/* Basic Info */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className={`space-y-1.5 ${examType === 'scheduled' ? 'md:col-span-3' : 'md:col-span-2'}`}>
                                <Label className="text-sm font-medium text-gray-700">Exam Title</Label>
                                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Mathematics Final Exam" />
                            </div>
                            {examType === 'practice' && (
                                <div className="space-y-1.5">
                                    <Label className="text-sm font-medium text-gray-700">Duration (minutes)</Label>
                                    <Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} min={1} />
                                </div>
                            )}
                        </div>

                        {/* Scheduled Exam Fields */}
                        {examType === 'scheduled' && (
                            <div className="p-4 rounded-lg border border-amber-200 bg-amber-50/50 space-y-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <CalendarDays className="h-4 w-4 text-amber-600" />
                                    <span className="text-sm font-semibold text-amber-700">Schedule Settings</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-sm font-medium text-gray-700">Start Date & Time</Label>
                                        <Input
                                            type="datetime-local"
                                            value={scheduledStart}
                                            onChange={(e) => setScheduledStart(e.target.value)}
                                            className="text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-sm font-medium text-gray-700">End Date & Time</Label>
                                        <Input
                                            type="datetime-local"
                                            value={scheduledEnd}
                                            onChange={(e) => setScheduledEnd(e.target.value)}
                                            className="text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-sm font-medium text-gray-700">Timezone</Label>
                                        <select
                                            value={timezone}
                                            onChange={(e) => setTimezone(e.target.value)}
                                            className="w-full h-10 px-3 border border-gray-200 rounded-md text-sm bg-white"
                                        >
                                            <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                                            <option value="America/New_York">America/New_York (ET)</option>
                                            <option value="America/Chicago">America/Chicago (CT)</option>
                                            <option value="America/Los_Angeles">America/Los_Angeles (PT)</option>
                                            <option value="Europe/London">Europe/London (GMT)</option>
                                            <option value="Europe/Berlin">Europe/Berlin (CET)</option>
                                            <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                                            <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                                            <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
                                            <option value="UTC">UTC</option>
                                        </select>
                                    </div>
                                </div>
                                <p className="text-xs text-amber-600">
                                    ⏱ Duration will be auto-calculated from the time window. Timer runs on real clock — pauses, disconnections, and late arrivals cost time.
                                </p>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium text-gray-700">Description (optional)</Label>
                            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of the exam" />
                        </div>

                        {/* Assign to Groups */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-700">Assign to Groups</Label>
                            {groups.length === 0 ? (
                                <p className="text-sm text-gray-400">No groups created yet. Go to Groups tab first.</p>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {groups.map(group => (
                                        <button
                                            key={group.id}
                                            onClick={() => toggleGroup(group.id)}
                                            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${selectedGroups.includes(group.id)
                                                ? 'bg-blue-50 border-blue-200 text-blue-700'
                                                : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                                                }`}
                                        >
                                            {group.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Questions */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-medium text-gray-700">
                                    Questions ({questions.length}) · Total: {totalMarks} marks
                                </Label>
                            </div>

                            {/* Add question buttons */}
                            <div className="flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" onClick={() => addQuestion('mcq')} className="text-gray-600">
                                    <PlusCircle className="mr-1 h-3.5 w-3.5" /> MCQ (1 mark)
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => addQuestion('descriptive_2')} className="text-amber-600 border-amber-200 hover:bg-amber-50">
                                    <PlusCircle className="mr-1 h-3.5 w-3.5" /> 2 Marks
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => addQuestion('descriptive_5')} className="text-purple-600 border-purple-200 hover:bg-purple-50">
                                    <PlusCircle className="mr-1 h-3.5 w-3.5" /> 5 Marks
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => addQuestion('descriptive_10')} className="text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                                    <PlusCircle className="mr-1 h-3.5 w-3.5" /> 10 Marks
                                </Button>
                            </div>

                            {/* Questions list */}
                            <div className="space-y-3">
                                {questions.map((q, qIndex) => (
                                    <Card key={q.id} className="border border-gray-200 shadow-none">
                                        <CardContent className="py-4 space-y-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <span className="text-xs font-bold text-gray-400">Q{qIndex + 1}</span>
                                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getQuestionTypeBadge(q.type)}`}>
                                                        {getQuestionTypeLabel(q.type)}
                                                    </span>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => removeQuestion(qIndex)}
                                                    className="h-7 w-7 text-gray-400 hover:text-red-500 hover:bg-red-50 flex-shrink-0"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>

                                            <Textarea
                                                value={q.question}
                                                onChange={(e) => updateQuestion(qIndex, 'question', e.target.value)}
                                                placeholder="Enter your question..."
                                                className="min-h-[60px] resize-none text-sm"
                                            />

                                            {q.type === 'mcq' && q.options && (
                                                <div className="space-y-2 pl-2">
                                                    {q.options.map((opt, optIndex) => (
                                                        <div key={optIndex} className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => updateOption(qIndex, optIndex, 'isCorrect', true)}
                                                                className={`h-6 w-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${opt.isCorrect
                                                                    ? 'border-emerald-500 bg-emerald-500'
                                                                    : 'border-gray-300 hover:border-gray-400'
                                                                    }`}
                                                            >
                                                                {opt.isCorrect && <div className="h-2 w-2 rounded-full bg-white" />}
                                                            </button>
                                                            <Input
                                                                value={opt.text}
                                                                onChange={(e) => updateOption(qIndex, optIndex, 'text', e.target.value)}
                                                                placeholder={`Option ${String.fromCharCode(65 + optIndex)}`}
                                                                className="h-8 text-sm"
                                                            />
                                                        </div>
                                                    ))}
                                                    <p className="text-[11px] text-gray-400 pl-8">Click the circle to mark the correct answer</p>
                                                </div>
                                            )}

                                            {q.type !== 'mcq' && (
                                                <div className="space-y-1.5 pl-2">
                                                    <Label className="text-xs text-gray-500">Model Answer (for reference)</Label>
                                                    <Textarea
                                                        value={q.correctAnswer || ''}
                                                        onChange={(e) => updateQuestion(qIndex, 'correctAnswer', e.target.value)}
                                                        placeholder="Enter the model answer..."
                                                        className="min-h-[40px] resize-none text-sm"
                                                    />
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>

                        {/* Summary */}
                        {questions.length > 0 && (
                            <div className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 border border-gray-100 text-sm text-gray-600">
                                <div className="flex items-center gap-1.5">
                                    <Hash className="h-3.5 w-3.5 text-gray-400" />
                                    {questions.filter(q => q.type === 'mcq').length} MCQ
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <FileText className="h-3.5 w-3.5 text-gray-400" />
                                    {questions.filter(q => q.type !== 'mcq').length} Descriptive
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Award className="h-3.5 w-3.5 text-gray-400" />
                                    {totalMarks} Total Marks
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Clock className="h-3.5 w-3.5 text-gray-400" />
                                    {duration} min
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2">
                            <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white">
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Create Exam
                            </Button>
                            <Button variant="ghost" onClick={() => setShowCreator(false)}>Cancel</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Existing Exams */}
            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
            ) : exams.length === 0 && !showCreator ? (
                <Card className="shadow-sm border border-gray-200">
                    <CardContent className="flex flex-col items-center py-12">
                        <FileText className="h-10 w-10 text-gray-300 mb-3" />
                        <p className="text-gray-500 text-sm">No exams created yet.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {exams.map(exam => (
                        <Card key={exam.id} className="shadow-sm border border-gray-200">
                            <CardContent className="py-4 px-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-gray-900">{exam.title}</h3>
                                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${exam.examType === 'scheduled'
                                                    ? 'bg-amber-50 text-amber-600 border border-amber-200'
                                                    : 'bg-blue-50 text-blue-600 border border-blue-200'
                                                }`}>
                                                {exam.examType === 'scheduled' ? '📅 Scheduled' : '🔄 Practice'}
                                            </span>
                                        </div>
                                        {exam.description && <p className="text-xs text-gray-400 mt-0.5">{exam.description}</p>}
                                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 flex-wrap">
                                            <span>{exam.questions.length} questions</span>
                                            <span>{exam.totalMarks} marks</span>
                                            <span>{exam.durationMinutes} min</span>
                                            <span>{exam.assignedGroups.length} group(s)</span>
                                            {exam.examType === 'scheduled' && exam.scheduledStart && exam.scheduledEnd && (
                                                <span className="text-amber-500">
                                                    {new Date(exam.scheduledStart?.toDate ? exam.scheduledStart.toDate() : exam.scheduledStart).toLocaleString()} → {new Date(exam.scheduledEnd?.toDate ? exam.scheduledEnd.toDate() : exam.scheduledEnd).toLocaleString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setExpandedExam(expandedExam === exam.id ? null : exam.id)}
                                            className="h-8 w-8 text-gray-400"
                                        >
                                            {expandedExam === exam.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDelete(exam.id, exam.title)}
                                            className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Expanded view */}
                                {expandedExam === exam.id && (
                                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-2 animate-fade-in">
                                        {exam.questions.map((q, i) => (
                                            <div key={q.id} className="flex items-start gap-2 p-2 rounded bg-gray-50 text-sm">
                                                <span className="text-xs font-bold text-gray-400 mt-0.5">Q{i + 1}</span>
                                                <div className="flex-1">
                                                    <p className="text-gray-700">{q.question}</p>
                                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-1 inline-block ${getQuestionTypeBadge(q.type)}`}>
                                                        {getQuestionTypeLabel(q.type)} · {q.marks}m
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
