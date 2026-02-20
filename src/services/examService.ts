import { db } from '@/lib/firebase';
import {
    collection, addDoc, getDoc, getDocs, setDoc, deleteDoc, updateDoc,
    doc, Timestamp, query, where, orderBy, limit, onSnapshot
} from 'firebase/firestore';
import type {
    ExamSet, ExamQuestion, ExamUser, UserGroup,
    ExamSubmission, StudentAnswer, LiveSession, QuestionType, ChatMessage
} from '@/types/exam';

function formatFirebaseError(error: any): string {
    let message = error.message || 'Unknown Firestore error';
    if (error.code === 'permission-denied') {
        message = 'Missing or insufficient permissions. Check Firestore security rules.';
    } else if (error.code === 'unavailable') {
        message = 'Firestore is currently unavailable.';
    }
    return message;
}

// ============ USER GROUPS ============

export async function createUserGroup(group: Omit<UserGroup, 'id' | 'createdAt'>): Promise<string> {
    if (!db) throw new Error('Firestore not available');
    const docRef = await addDoc(collection(db, 'userGroups'), {
        ...group,
        createdAt: Timestamp.now(),
    });
    return docRef.id;
}

export async function getUserGroups(): Promise<UserGroup[]> {
    if (!db) throw new Error('Firestore not available');
    const snapshot = await getDocs(query(collection(db, 'userGroups'), orderBy('createdAt', 'desc')));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as UserGroup));
}

export async function deleteUserGroup(groupId: string): Promise<void> {
    if (!db) throw new Error('Firestore not available');
    await deleteDoc(doc(db, 'userGroups', groupId));
}

// ============ EXAM USERS ============

export async function addExamUser(user: Omit<ExamUser, 'id' | 'createdAt'>): Promise<string> {
    if (!db) throw new Error('Firestore not available');
    const docRef = await addDoc(collection(db, 'examUsers'), {
        ...user,
        createdAt: Timestamp.now(),
    });
    return docRef.id;
}

export async function getExamUsers(): Promise<ExamUser[]> {
    if (!db) throw new Error('Firestore not available');
    const snapshot = await getDocs(query(collection(db, 'examUsers'), orderBy('createdAt', 'desc')));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ExamUser));
}

export async function getExamUsersByGroup(groupId: string): Promise<ExamUser[]> {
    if (!db) throw new Error('Firestore not available');
    const snapshot = await getDocs(query(collection(db, 'examUsers'), where('groupId', '==', groupId)));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ExamUser));
}

export async function deleteExamUser(userId: string): Promise<void> {
    if (!db) throw new Error('Firestore not available');
    await deleteDoc(doc(db, 'examUsers', userId));
}

export async function getExamUserByEmail(email: string): Promise<ExamUser | null> {
    if (!db) throw new Error('Firestore not available');
    const snapshot = await getDocs(query(collection(db, 'examUsers'), where('email', '==', email)));
    if (snapshot.empty) return null;
    const d = snapshot.docs[0];
    return { id: d.id, ...d.data() } as ExamUser;
}

export async function updateExamUserSession(userId: string, sessionId: string): Promise<void> {
    if (!db) throw new Error('Firestore not available');
    await updateDoc(doc(db, 'examUsers', userId), {
        currentSessionId: sessionId,
        lastLogin: Timestamp.now(),
    });
}

export function subscribeToExamUser(
    userId: string,
    callback: (user: Partial<ExamUser> | null) => void,
): () => void {
    if (!db) return () => { };
    return onSnapshot(doc(db, 'examUsers', userId), (docSnap) => {
        if (docSnap.exists()) {
            callback({ id: docSnap.id, ...docSnap.data() } as Partial<ExamUser>);
        } else {
            callback(null);
        }
    });
}

// ============ EXAM SETS ============

export async function createExamSet(exam: Omit<ExamSet, 'id' | 'createdAt'>): Promise<string> {
    if (!db) throw new Error('Firestore not available');
    const docRef = await addDoc(collection(db, 'examSets'), {
        ...exam,
        createdAt: Timestamp.now(),
    });
    return docRef.id;
}

export async function getExamSets(): Promise<ExamSet[]> {
    if (!db) throw new Error('Firestore not available');
    const snapshot = await getDocs(query(collection(db, 'examSets'), orderBy('createdAt', 'desc')));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ExamSet));
}

export async function getExamSetById(examId: string): Promise<ExamSet | null> {
    if (!db) throw new Error('Firestore not available');
    const docSnap = await getDoc(doc(db, 'examSets', examId));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as ExamSet;
}

export async function deleteExamSet(examId: string): Promise<void> {
    if (!db) throw new Error('Firestore not available');
    await deleteDoc(doc(db, 'examSets', examId));
}

export async function getExamsForGroup(groupId: string): Promise<ExamSet[]> {
    if (!db) throw new Error('Firestore not available');
    // No orderBy here to avoid requiring a composite index — sort client-side
    const snapshot = await getDocs(query(
        collection(db, 'examSets'),
        where('assignedGroups', 'array-contains', groupId)
    ));
    const results = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ExamSet));
    return results.sort((a, b) => {
        const aTime = (a.createdAt as any)?.seconds ?? 0;
        const bTime = (b.createdAt as any)?.seconds ?? 0;
        return bTime - aTime;
    });
}

// ============ EXAM SUBMISSIONS ============

export async function saveExamSubmission(submission: Omit<ExamSubmission, 'id'>): Promise<string> {
    if (!db) throw new Error('Firestore not available');
    const docRef = await addDoc(collection(db, 'examSubmissions'), submission);
    return docRef.id;
}

export async function hasUserSubmittedExam(userId: string, examId: string): Promise<boolean> {
    if (!db) throw new Error('Firestore not available');
    const snapshot = await getDocs(query(
        collection(db, 'examSubmissions'),
        where('userId', '==', userId),
        where('examId', '==', examId)
    ));
    return !snapshot.empty;
}

export async function getSubmissionsForExam(examId: string): Promise<ExamSubmission[]> {
    if (!db) throw new Error('Firestore not available');
    // No orderBy here to avoid requiring a composite index — sort client-side
    const snapshot = await getDocs(query(
        collection(db, 'examSubmissions'),
        where('examId', '==', examId)
    ));
    const results = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ExamSubmission));
    return results.sort((a, b) => {
        const aTime = (a.submittedAt as any)?.seconds ?? 0;
        const bTime = (b.submittedAt as any)?.seconds ?? 0;
        return bTime - aTime;
    });
}

export async function getSubmissionById(submissionId: string): Promise<ExamSubmission | null> {
    if (!db) throw new Error('Firestore not available');
    const docSnap = await getDoc(doc(db, 'examSubmissions', submissionId));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as ExamSubmission;
}

export async function updateSubmissionGrades(submissionId: string, answers: StudentAnswer[], marksObtained: number): Promise<void> {
    if (!db) throw new Error('Firestore not available');
    await updateDoc(doc(db, 'examSubmissions', submissionId), {
        answers,
        marksObtained,
        status: 'graded',
    });
}

// ============ LIVE SESSIONS ============

export async function createLiveSession(session: Omit<LiveSession, 'id'>): Promise<string> {
    if (!db) throw new Error('Firestore not available');
    const docRef = await addDoc(collection(db, 'liveSessions'), session);
    return docRef.id;
}

export async function updateLiveSession(sessionId: string, data: Partial<LiveSession>): Promise<void> {
    if (!db) throw new Error('Firestore not available');
    await updateDoc(doc(db, 'liveSessions', sessionId), {
        ...data,
        lastActivity: Timestamp.now(),
    });
}

export async function deactivateUserSessions(userId: string, examId: string): Promise<void> {
    if (!db) throw new Error('Firestore not available');
    const q = query(
        collection(db, 'liveSessions'),
        where('userId', '==', userId),
        where('examId', '==', examId),
        where('isActive', '==', true)
    );
    const snapshot = await getDocs(q);
    const batch = [];
    for (const d of snapshot.docs) {
        batch.push(updateDoc(doc(db, 'liveSessions', d.id), { isActive: false }));
    }
    await Promise.all(batch);
}

export async function getActiveSessionsForExam(examId: string): Promise<LiveSession[]> {
    if (!db) throw new Error('Firestore not available');
    // Single where clause to avoid composite index requirement — filter isActive client-side
    const snapshot = await getDocs(query(
        collection(db, 'liveSessions'),
        where('examId', '==', examId)
    ));
    return snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as LiveSession))
        .filter(s => s.isActive === true);
}

export async function endLiveSession(sessionId: string): Promise<void> {
    if (!db) throw new Error('Firestore not available');
    await updateDoc(doc(db, 'liveSessions', sessionId), {
        isActive: false,
        lastActivity: Timestamp.now(),
    });
}

/**
 * Subscribe to real-time updates of a single live session
 * Used by students to listen for admin pause/terminate actions
 */
export function subscribeToSession(
    sessionId: string,
    callback: (session: LiveSession | null) => void,
): () => void {
    if (!db) return () => { };
    return onSnapshot(doc(db, 'liveSessions', sessionId), (docSnap) => {
        if (docSnap.exists()) {
            callback({ id: docSnap.id, ...docSnap.data() } as LiveSession);
        } else {
            callback(null);
        }
    });
}

// ============ ADMIN SESSION ACTIONS ============

export async function pauseSession(sessionId: string, reason: string, durationMinutes: number): Promise<void> {
    if (!db) throw new Error('Firestore not available');
    await updateDoc(doc(db, 'liveSessions', sessionId), {
        isPaused: true,
        pauseReason: reason,
        pauseDuration: durationMinutes,
        pausedAt: Timestamp.now(),
        lastActivity: Timestamp.now(),
    });
}

export async function resumeSession(sessionId: string): Promise<void> {
    if (!db) throw new Error('Firestore not available');
    await updateDoc(doc(db, 'liveSessions', sessionId), {
        isPaused: false,
        pauseReason: '',
        pauseDuration: 0,
        lastActivity: Timestamp.now(),
    });
}

export async function terminateSession(sessionId: string, reason: string): Promise<void> {
    if (!db) throw new Error('Firestore not available');
    await updateDoc(doc(db, 'liveSessions', sessionId), {
        isTerminated: true,
        terminateReason: reason,
        isActive: false,
        lastActivity: Timestamp.now(),
    });
}

// ============ PROCTOR CHAT ============

export async function sendChatMessage(message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<string> {
    if (!db) throw new Error('Firestore not available');
    const docRef = await addDoc(collection(db, 'examChats'), {
        ...message,
        timestamp: Timestamp.now(),
    });
    return docRef.id;
}

export function subscribeToChatMessages(
    sessionId: string,
    callback: (messages: ChatMessage[]) => void,
): () => void {
    if (!db) return () => { };
    // Use simple query without orderBy to avoid composite index issues
    const q = query(
        collection(db, 'examChats'),
        where('sessionId', '==', sessionId),
    );
    return onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() } as ChatMessage))
            .sort((a, b) => {
                const aT = (a.timestamp as any)?.seconds ?? 0;
                const bT = (b.timestamp as any)?.seconds ?? 0;
                return aT - bT;
            });
        callback(msgs);
    });
}

/**
 * Subscribe to student-sent chat messages across multiple sessions.
 * Calls onNewMessage each time a new student message is detected.
 * Returns a cleanup function to unsubscribe all listeners.
 */
export function subscribeToStudentChatAlerts(
    sessionIds: string[],
    onNewMessage: (sessionId: string, message: ChatMessage) => void,
): () => void {
    if (!db || sessionIds.length === 0) return () => { };

    const knownIds = new Set<string>();
    const unsubscribers: (() => void)[] = [];

    for (const sid of sessionIds) {
        const q = query(
            collection(db, 'examChats'),
            where('sessionId', '==', sid),
            where('senderRole', '==', 'student'),
        );
        const unsub = onSnapshot(q, (snapshot) => {
            for (const change of snapshot.docChanges()) {
                if (change.type === 'added' && !knownIds.has(change.doc.id)) {
                    knownIds.add(change.doc.id);
                    const msg = { id: change.doc.id, ...change.doc.data() } as ChatMessage;
                    // Only fire for genuinely new messages (skip initial load after a grace period)
                    onNewMessage(sid, msg);
                }
            }
        });
        unsubscribers.push(unsub);
    }

    return () => {
        for (const unsub of unsubscribers) unsub();
    };
}

// Re-export onSnapshot for direct usage
export { onSnapshot } from 'firebase/firestore';

