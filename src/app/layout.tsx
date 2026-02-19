
import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { LayoutProvider } from '@/contexts/LayoutContext';
import { LayoutContentWrapper } from '@/components/layout/LayoutContentWrapper';

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });

export const metadata: Metadata = {
  title: 'AI Quiz Maker — Smart Quizzes, Instant Feedback',
  description: 'Create AI-powered MCQ quizzes instantly. Test your knowledge with smart question generation, detailed analytics, and personalized study guides.',
  keywords: ['AI quiz', 'quiz maker', 'MCQ generator', 'study tool', 'AI education'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} dark`}>
      <body className="font-sans antialiased">
        <AuthProvider>
          <LayoutProvider>
            <LayoutContentWrapper>{children}</LayoutContentWrapper>
          </LayoutProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
