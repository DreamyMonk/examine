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
import type { ExamSet, ExamQuestion, UserGroup, QuestionType, ExamType, ProgrammingLanguage } from '@/types/exam';
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

    const codingLanguages: ProgrammingLanguage[] = ['javascript', 'python', 'java'];
    const defaultStarterCode: Record<ProgrammingLanguage, string> = {
        javascript: `function solve(input) {\n  return input.trim();\n}\n\nconst fs = require("fs");\nconst input = fs.readFileSync(0, "utf8");\nprocess.stdout.write(String(solve(input)));\n`,
        python: `def solve(input_data: str) -> str:\n    return input_data.strip()\n\nif __name__ == "__main__":\n    import sys\n    input_data = sys.stdin.read()\n    sys.stdout.write(str(solve(input_data)))\n`,
        java: `import java.io.*;\n\npublic class Main {\n    public static void main(String[] args) throws Exception {\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n        StringBuilder input = new StringBuilder();\n        String line;\n        while ((line = br.readLine()) != null) {\n            input.append(line);\n            if (br.ready()) input.append("\\n");\n        }\n        System.out.print(input.toString().trim());\n    }\n}\n`,
    };

    // Add question
    const addQuestion = (type: QuestionType) => {
        const marks = type === 'mcq' ? 1 : type === 'descriptive_2' ? 2 : type === 'descriptive_5' || type === 'coding_5' ? 5 : 10;
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
            } : type === 'coding_5' || type === 'coding_10' ? {
                codingLanguages,
                starterCode: defaultStarterCode,
                testCases: [
                    { input: '', expectedOutput: '', isSample: true },
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
        if (q.codingLanguages !== undefined && q.codingLanguages !== null) obj.codingLanguages = q.codingLanguages;
        if (q.starterCode !== undefined && q.starterCode !== null) obj.starterCode = q.starterCode;
        if (q.testCases !== undefined && q.testCases !== null) obj.testCases = q.testCases;
        return obj;
    };

    // Update question
    const updateQuestion = (index: number, field: string, value: any) => {
        setQuestions(prev => {
            const updated = [...prev];
            (updated[index] as any)[field] = field === 'marks' ? Number(value) : value;
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

    const updateCodingStarterCode = (qIndex: number, language: ProgrammingLanguage, value: string) => {
        setQuestions(prev => {
            const updated = [...prev];
            updated[qIndex].starterCode = {
                ...(updated[qIndex].starterCode || {}),
                [language]: value,
            };
            return updated;
        });
    };

    const addTestCase = (qIndex: number) => {
        setQuestions(prev => {
            const updated = [...prev];
            updated[qIndex].testCases = [...(updated[qIndex].testCases || []), { input: '', expectedOutput: '', isSample: true }];
            return updated;
        });
    };

    const updateTestCase = (qIndex: number, testCaseIndex: number, field: 'input' | 'expectedOutput', value: string) => {
        setQuestions(prev => {
            const updated = [...prev];
            const nextCases = [...(updated[qIndex].testCases || [])];
            nextCases[testCaseIndex] = { ...nextCases[testCaseIndex], [field]: value };
            updated[qIndex].testCases = nextCases;
            return updated;
        });
    };

    const removeTestCase = (qIndex: number, testCaseIndex: number) => {
        setQuestions(prev => {
            const updated = [...prev];
            updated[qIndex].testCases = (updated[qIndex].testCases || []).filter((_, index) => index !== testCaseIndex);
            return updated;
        });
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
            if (!Number.isFinite(q.marks) || q.marks <= 0) {
                toast({ title: 'Invalid Marks', description: `Question ${i + 1} must have marks greater than 0.`, variant: 'destructive' });
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
            } else if (q.type === 'coding_5' || q.type === 'coding_10') {
                if (!q.testCases?.length) {
                    toast({ title: 'Missing Test Cases', description: `Coding question ${i + 1} needs at least one test case.`, variant: 'destructive' });
                    return;
                }
                const hasInvalidCase = q.testCases.some(test => !test.expectedOutput.trim());
                if (hasInvalidCase) {
                    toast({ title: 'Invalid Test Case', description: `Coding question ${i + 1} needs expected output for every test case.`, variant: 'destructive' });
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
            case 'coding_5': return 'Coding 5 Marks';
            case 'coding_10': return 'Coding 10 Marks';
        }
    };

    const getQuestionTypeBadge = (type: QuestionType) => {
        switch (type) {
            case 'mcq': return 'bg-gray-100 text-gray-600';
            case 'descriptive_2': return 'bg-amber-50 text-amber-600';
            case 'descriptive_5': return 'bg-purple-50 text-purple-600';
            case 'descriptive_10': return 'bg-emerald-50 text-emerald-600';
            case 'coding_5': return 'bg-sky-50 text-sky-700';
            case 'coding_10': return 'bg-indigo-50 text-indigo-700';
        }
    };

    return (
        <div className="space-y-4">
            <div className="section-header">
                <div>
                    <p className="section-title">Exams</p>
                    <p className="section-meta">{exams.length} exam{exams.length !== 1 ? 's' : ''} in the system</p>
                </div>
                <Button onClick={() => setShowCreator(!showCreator)} className="bg-indigo-600 hover:bg-indigo-500 text-white h-9 rounded-lg text-sm">
                    <PlusCircle className="mr-1.5 h-4 w-4" />
                    New Exam
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
                                <Button variant="outline" size="sm" onClick={() => addQuestion('coding_5')} className="text-sky-700 border-sky-200 hover:bg-sky-50">
                                    <PlusCircle className="mr-1 h-3.5 w-3.5" /> Coding (5)
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => addQuestion('coding_10')} className="text-indigo-700 border-indigo-200 hover:bg-indigo-50">
                                    <PlusCircle className="mr-1 h-3.5 w-3.5" /> Coding (10)
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

                                            <div className="space-y-1.5 pl-2">
                                                <Label className="text-xs text-gray-500">Marks for this question</Label>
                                                <div className="relative max-w-[180px]">
                                                    <Award className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                                                    <Input
                                                        type="number"
                                                        min={0.5}
                                                        step={0.5}
                                                        value={q.marks}
                                                        onChange={(e) => updateQuestion(qIndex, 'marks', e.target.value)}
                                                        className="h-9 pl-8 text-sm"
                                                    />
                                                </div>
                                                <p className="text-[11px] text-gray-400">You can use decimal values like 0.5, 1.5, or 2.5.</p>
                                            </div>

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
                                                q.type === 'coding_5' || q.type === 'coding_10' ? (
                                                    <div className="space-y-4 pl-2">
                                                        <div className="space-y-1.5">
                                                            <Label className="text-xs text-gray-500">Supported Languages</Label>
                                                            <div className="flex flex-wrap gap-2">
                                                                {(q.codingLanguages || codingLanguages).map((language) => (
                                                                    <span key={language} className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-medium capitalize text-sky-700">
                                                                        {language}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        <div className="grid gap-3 md:grid-cols-3">
                                                            {codingLanguages.map((language) => (
                                                                <div key={language} className="space-y-1.5">
                                                                    <Label className="text-xs text-gray-500 capitalize">{language} Starter Code</Label>
                                                                    <Textarea
                                                                        value={q.starterCode?.[language] || ''}
                                                                        onChange={(e) => updateCodingStarterCode(qIndex, language, e.target.value)}
                                                                        className="min-h-[180px] resize-y font-mono text-xs"
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>

                                                        <div className="space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <Label className="text-xs text-gray-500">Test Cases</Label>
                                                                <Button type="button" variant="outline" size="sm" onClick={() => addTestCase(qIndex)}>
                                                                    <PlusCircle className="mr-1 h-3.5 w-3.5" />
                                                                    Add Test Case
                                                                </Button>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {(q.testCases || []).map((testCase, testCaseIndex) => (
                                                                    <div key={testCaseIndex} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                                                        <div className="mb-2 flex items-center justify-between">
                                                                            <span className="text-xs font-medium text-gray-500">Test Case {testCaseIndex + 1}</span>
                                                                            {(q.testCases?.length || 0) > 1 && (
                                                                                <Button
                                                                                    type="button"
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    onClick={() => removeTestCase(qIndex, testCaseIndex)}
                                                                                    className="h-7 w-7 text-gray-400 hover:bg-red-50 hover:text-red-500"
                                                                                >
                                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                                </Button>
                                                                            )}
                                                                        </div>
                                                                        <div className="grid gap-3 md:grid-cols-2">
                                                                            <div className="space-y-1.5">
                                                                                <Label className="text-[11px] text-gray-500">Input</Label>
                                                                                <Textarea
                                                                                    value={testCase.input}
                                                                                    onChange={(e) => updateTestCase(qIndex, testCaseIndex, 'input', e.target.value)}
                                                                                    className="min-h-[90px] resize-y font-mono text-xs"
                                                                                    placeholder="Optional stdin input"
                                                                                />
                                                                            </div>
                                                                            <div className="space-y-1.5">
                                                                                <Label className="text-[11px] text-gray-500">Expected Output</Label>
                                                                                <Textarea
                                                                                    value={testCase.expectedOutput}
                                                                                    onChange={(e) => updateTestCase(qIndex, testCaseIndex, 'expectedOutput', e.target.value)}
                                                                                    className="min-h-[90px] resize-y font-mono text-xs"
                                                                                    placeholder="Required expected output"
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                <div className="space-y-1.5 pl-2">
                                                    <Label className="text-xs text-gray-500">Model Answer (for reference)</Label>
                                                    <Textarea
                                                        value={q.correctAnswer || ''}
                                                        onChange={(e) => updateQuestion(qIndex, 'correctAnswer', e.target.value)}
                                                        placeholder="Enter the model answer..."
                                                        className="min-h-[40px] resize-none text-sm"
                                                    />
                                                </div>
                                                )
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
                            <Button onClick={handleSave} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-500 text-white h-9 rounded-lg text-sm">
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Save Exam
                            </Button>
                            <Button variant="ghost" onClick={() => setShowCreator(false)} className="h-9 rounded-lg text-sm">Cancel</Button>
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
