
"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getRecentQuizzesByUserId } from '@/services/quizService';
import type { GeneratedQuizData } from '@/types/quiz';
import {
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSkeleton,
} from '@/components/ui/sidebar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, ListX, AlertTriangle, Sparkles } from 'lucide-react';
import { format } from 'date-fns';

export function QuizHistorySidebarContent() {
  const { user } = useAuth();
  const [recentQuizzes, setRecentQuizzes] = useState<GeneratedQuizData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.uid) {
      setIsLoading(true);
      setError(null);
      getRecentQuizzesByUserId(user.uid, 15)
        .then(quizzes => {
          setRecentQuizzes(quizzes);
        })
        .catch(err => {
          console.error("Error fetching recent quizzes:", err);
          setError(err.message || "Failed to load quiz history.");
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setRecentQuizzes([]);
    }
  }, [user?.uid]);

  return (
    <>
      <SidebarHeader className="border-b border-border/30">
        <div className="flex items-center gap-2.5 p-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
            <History className="h-4 w-4 text-primary" />
          </div>
          <span className="font-bold text-sm">Recent Quizzes</span>
        </div>
      </SidebarHeader>
      <SidebarContent className="p-0">
        <ScrollArea className="h-full">
          <div className="p-2">
            {isLoading && (
              <SidebarMenu>
                {[...Array(5)].map((_, i) => (
                  <SidebarMenuItem key={i}>
                    <SidebarMenuSkeleton showIcon />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
            {!isLoading && error && (
              <div className="p-4 text-center">
                <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center mx-auto mb-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}
            {!isLoading && !error && recentQuizzes.length === 0 && (
              <div className="p-6 text-center">
                <div className="h-10 w-10 rounded-xl bg-muted/30 flex items-center justify-center mx-auto mb-2">
                  <ListX className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">No quizzes in the last 15 days.</p>
              </div>
            )}
            {!isLoading && !error && recentQuizzes.length > 0 && (
              <SidebarMenu>
                {recentQuizzes.map(quiz => (
                  <SidebarMenuItem key={quiz.id}>
                    <Link href={`/exam/${quiz.id}`} passHref legacyBehavior>
                      <SidebarMenuButton
                        asChild
                        className="w-full justify-start rounded-lg hover:bg-primary/5 transition-colors"
                        tooltip={`Topic: ${quiz.topic}\nDate: ${quiz.createdAt ? format(quiz.createdAt.toDate(), 'MMM d, yyyy') : 'N/A'}\nQuestions: ${quiz.questions.length}`}
                      >
                        <a className="flex items-center gap-3 py-2.5">
                          <div className="flex-shrink-0 h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
                            <Sparkles className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <div className="flex flex-col overflow-hidden min-w-0">
                            <span className="truncate font-medium text-xs">{quiz.topic}</span>
                            {quiz.createdAt && (
                              <span className="text-[10px] text-muted-foreground">
                                {format(quiz.createdAt.toDate(), 'MMM d, yyyy')} · {quiz.questions.length} Qs
                              </span>
                            )}
                          </div>
                        </a>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
          </div>
        </ScrollArea>
      </SidebarContent>
    </>
  );
}
