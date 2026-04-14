// ============ EXAM SYSTEM TYPES ============

export type QuestionType = 'mcq' | 'descriptive_2' | 'descriptive_5' | 'descriptive_10' | 'coding_5' | 'coding_10';
export type ProgrammingLanguage = 'javascript' | 'python' | 'java';

export interface McqOption {
    text: string;
    isCorrect: boolean;
}

export interface CodingTestCase {
    input: string;
    expectedOutput: string;
    isSample?: boolean;
}

export interface CodingExecutionResult {
    stdout?: string;
    stderr?: string;
    compileOutput?: string;
    passedCount?: number;
    totalCount?: number;
    testResults?: Array<{
        input: string;
        expectedOutput: string;
        actualOutput: string;
        passed: boolean;
        stderr?: string;
        compileOutput?: string;
    }>;
}

export interface ExamQuestion {
    id: string;
    type: QuestionType;
    question: string;
    marks: number; // 1 for MCQ, 2/5/10 for descriptive
    options?: McqOption[]; // Only for MCQ
    correctAnswer?: string; // For descriptive - model answer
    codingLanguages?: ProgrammingLanguage[];
    starterCode?: Partial<Record<ProgrammingLanguage, string>>;
    testCases?: CodingTestCase[];
}

export type ExamType = 'practice' | 'scheduled';

export interface ExamSet {
    id: string;
    title: string;
    description?: string;
    questions: ExamQuestion[];
    durationMinutes: number;
    totalMarks: number;
    createdBy: string; // admin userId
    createdAt: any; // Firestore Timestamp
    assignedGroups: string[]; // group IDs this exam is assigned to
    examType: ExamType; // 'practice' = multiple attempts, 'scheduled' = one-time with fixed window
    scheduledStart?: any; // Firestore Timestamp — when exam becomes available
    scheduledEnd?: any; // Firestore Timestamp — hard deadline, timer is real-clock based
    timezone?: string; // e.g. 'Asia/Kolkata'
}

// User managed by admin
export interface ExamUser {
    id: string;
    name: string;
    email: string;
    password?: string; // optional login password
    groupId: string;
    groupName?: string;
    createdAt: any;
    selfieUrl?: string;
    idCardUrl?: string;
    currentSessionId?: string; // For single-session enforcement
    lastLogin?: any;
}

// User group for organizing exams
export interface UserGroup {
    id: string;
    name: string;
    description?: string;
    createdBy: string;
    createdAt: any;
}

// Student's answer to a question
export interface StudentAnswer {
    questionId: string;
    questionType: QuestionType;
    selectedOptionIndex?: number; // For MCQ
    descriptiveAnswer?: string; // For descriptive
    codeAnswer?: string; // For coding
    codeLanguage?: ProgrammingLanguage;
    codeExecution?: CodingExecutionResult;
    marks: number; // marks for this question
    marksAwarded?: number; // admin can grade descriptive
}

// Complete exam submission
export interface ExamSubmission {
    id: string;
    examId: string;
    examTitle: string;
    userId: string;
    userName: string;
    userEmail: string;
    answers: StudentAnswer[];
    totalMarks: number;
    marksObtained: number;
    submittedAt: any;
    selfieUrl?: string;
    idCardUrl?: string;
    violations: number;
    status: 'in_progress' | 'submitted' | 'graded';
}

// Admin credentials
export interface AdminConfig {
    email: string;
    passwordHash: string;
}

// Live monitoring
export interface LiveSession {
    id: string;
    examId: string;
    userId: string;
    userName: string;
    isActive: boolean;
    cameraStreamActive: boolean;
    screenStreamActive: boolean;
    violations: number;
    lastActivity: any;
    agoraChannel?: string; // Agora channel name for this session
    agoraUid?: number; // Agora UID of the student
    // Admin actions
    isPaused?: boolean;
    pauseReason?: string;
    pauseDuration?: number; // in minutes
    pausedAt?: any;
    isTerminated?: boolean;
    terminateReason?: string;
}

// Chat message between proctor and student
export interface ChatMessage {
    id: string;
    sessionId: string; // links to LiveSession.id
    senderId: string;
    senderName: string;
    senderRole: 'admin' | 'student';
    message: string;
    timestamp: any;
}

// Proctoring state  
export interface ProctoringState {
    cameraGranted: boolean;
    micGranted: boolean;
    screenShared: boolean;
    cameraStream: MediaStream | null;
    micStream: MediaStream | null;
    screenStream: MediaStream | null;
}

// Verification step data
export interface VerificationData {
    hardwareChecked: boolean;
    selfieCaptured: boolean;
    selfieDataUrl: string | null;
    idCardCaptured: boolean;
    idCardDataUrl: string | null;
}
