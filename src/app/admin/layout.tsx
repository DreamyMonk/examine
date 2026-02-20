import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Admin Panel — ExamDesk',
    description: 'Administration panel for managing exams, users, and monitoring.',
};

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
