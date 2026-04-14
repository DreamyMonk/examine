"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  FileText, Users, FolderOpen, ClipboardList, Radio,
  LogOut, ShieldCheck, ChevronRight,
} from 'lucide-react';
import { UsersTab } from './admin-tabs/UsersTab';
import { GroupsTab } from './admin-tabs/GroupsTab';
import { ExamsTab } from './admin-tabs/ExamsTab';
import { SubmissionsTab } from './admin-tabs/SubmissionsTab';
import { LiveMonitorTab } from './admin-tabs/LiveMonitorTab';

interface AdminDashboardProps {
  onLogout: () => void;
}

const TABS = [
  {
    value: 'exams',
    label: 'Exams',
    description: 'Create & manage exam sets',
    icon: FileText,
  },
  {
    value: 'users',
    label: 'Candidates',
    description: 'Manage registered users',
    icon: Users,
  },
  {
    value: 'groups',
    label: 'Groups',
    description: 'Cohort & assignment control',
    icon: FolderOpen,
  },
  {
    value: 'submissions',
    label: 'Submissions',
    description: 'Review results & attempts',
    icon: ClipboardList,
  },
  {
    value: 'live',
    label: 'Live Monitor',
    description: 'Active session oversight',
    icon: Radio,
  },
] as const;

type TabValue = typeof TABS[number]['value'];

export function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabValue>('exams');

  const activeTabConfig = TABS.find(t => t.value === activeTab)!;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">

      {/* ── SIDEBAR ─────────────────────────────────────────── */}
      <aside className="admin-sidebar">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-none">ExamDesk</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Administrator</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-2 py-2 mb-1">
            Management
          </p>
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                id={`nav-${tab.value}`}
                onClick={() => setActiveTab(tab.value)}
                className={`nav-item w-full group ${isActive ? 'active' : ''}`}
              >
                <Icon className={`h-4 w-4 flex-shrink-0 nav-icon transition-colors ${
                  isActive ? 'text-indigo-400' : 'text-slate-600 group-hover:text-slate-300'
                }`} />
                <span className="flex-1 text-left">{tab.label}</span>
                {isActive && <ChevronRight className="h-3.5 w-3.5 text-indigo-500" />}
              </button>
            );
          })}
        </nav>

        {/* Footer / Logout */}
        <div className="px-2 py-3 border-t border-slate-800">
          <button
            id="admin-logout-btn"
            onClick={onLogout}
            className="nav-item w-full text-red-500/70 hover:text-red-400 hover:bg-red-500/10"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── MAIN AREA ───────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Top bar */}
        <header className="admin-topbar flex-shrink-0">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-slate-900">{activeTabConfig.label}</h1>
              <span className="text-slate-300">·</span>
              <span className="text-xs text-slate-500">{activeTabConfig.description}</span>
            </div>
          </div>
          {/* Live indicator */}
          {activeTab === 'live' && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Monitoring Active
            </div>
          )}
        </header>

        {/* Content scrollable area */}
        <main className="admin-content">
          <div className="max-w-6xl mx-auto px-5 py-5">
            {activeTab === 'exams' && <ExamsTab />}
            {activeTab === 'users' && <UsersTab />}
            {activeTab === 'groups' && <GroupsTab />}
            {activeTab === 'submissions' && <SubmissionsTab />}
            {activeTab === 'live' && <LiveMonitorTab />}
          </div>
        </main>
      </div>
    </div>
  );
}
