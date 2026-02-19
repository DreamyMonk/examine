
"use client";

import React from 'react';
import { Header } from '@/components/layout/Header';
import { Toaster } from "@/components/ui/toaster";
import { useLayout } from '@/contexts/LayoutContext';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { QuizHistorySidebarContent } from '@/components/layout/QuizHistorySidebarContent';

export function LayoutContentWrapper({ children }: { children: React.ReactNode }) {
  const { isSidebarVisible } = useLayout();

  return (
    <SidebarProvider>
      {isSidebarVisible && (
        <Sidebar className="border-r border-border/50">
          <QuizHistorySidebarContent />
        </Sidebar>
      )}
      <SidebarInset>
        <Header />
        <main className="container mx-auto p-4 md:p-8">
          {children}
        </main>
        <Toaster />
      </SidebarInset>
    </SidebarProvider>
  );
}
