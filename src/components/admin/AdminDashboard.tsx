"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    ClipboardCheck, Users, FileText, Eye, LogOut,
    UserPlus, FolderPlus, PlusCircle, Settings
} from 'lucide-react';
import { UsersTab } from './admin-tabs/UsersTab';
import { GroupsTab } from './admin-tabs/GroupsTab';
import { ExamsTab } from './admin-tabs/ExamsTab';
import { SubmissionsTab } from './admin-tabs/SubmissionsTab';
import { LiveMonitorTab } from './admin-tabs/LiveMonitorTab';

interface AdminDashboardProps {
    onLogout: () => void;
}

export function AdminDashboard({ onLogout }: AdminDashboardProps) {
    const [activeTab, setActiveTab] = useState('exams');
    const tabs = [
        { value: 'exams', label: 'Exams', icon: FileText, hint: 'Create and publish assessment flows' },
        { value: 'users', label: 'Users', icon: Users, hint: 'Manage candidates and access' },
        { value: 'groups', label: 'Groups', icon: FolderPlus, hint: 'Organize cohorts and assignments' },
        { value: 'submissions', label: 'Submissions', icon: ClipboardCheck, hint: 'Review attempts and performance' },
        { value: 'live', label: 'Live Monitor', icon: Eye, hint: 'Watch active sessions in real time' },
    ];

    return (
        <div className="min-h-screen bg-transparent">
            {/* Header */}
            <header className="sticky top-0 z-50 border-b border-white/60 bg-white/80 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 shadow-lg shadow-blue-500/25 flex items-center justify-center">
                            <ClipboardCheck className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <p className="font-semibold text-slate-950">ExamDesk Command</p>
                            <p className="text-xs text-slate-500">Operations hub for secure online assessments</p>
                        </div>
                        <span className="ml-2 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-700">Admin</span>
                    </div>
                    <Button onClick={onLogout} variant="ghost" size="sm" className="rounded-xl border border-slate-200 bg-white px-4 text-slate-600 hover:bg-slate-50 hover:text-slate-900">
                        <LogOut className="mr-1.5 h-4 w-4" />
                        Sign Out
                    </Button>
                </div>
            </header>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <section className="premium-card overflow-hidden border-slate-200/70 bg-slate-950 text-white">
                    <div className="grid gap-6 px-6 py-7 lg:grid-cols-[1.7fr,1fr] lg:px-8">
                        <div>
                            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-blue-100">
                                <Settings className="h-3.5 w-3.5" />
                                Production control surface
                            </div>
                            <h1 className="max-w-2xl text-3xl font-semibold leading-tight text-white sm:text-4xl">
                                Run exams, monitor integrity, and review outcomes from one polished control room.
                            </h1>
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                                This dashboard is structured for real operators: clear tabs, strong visual separation, and quicker orientation during live activity.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
                            {[
                                { label: 'Security', value: 'Live', hint: 'Proctoring active' },
                                { label: 'Review', value: 'Fast', hint: 'Submission insights' },
                                { label: 'Groups', value: 'Ready', hint: 'Assignment control' },
                                { label: 'Ops', value: '24/7', hint: 'Exam operations shell' },
                            ].map((item) => (
                                <div key={item.label} className="rounded-2xl border border-white/10 bg-white/10 p-4">
                                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
                                    <p className="mt-2 text-2xl font-semibold text-white">{item.value}</p>
                                    <p className="mt-1 text-xs text-slate-300">{item.hint}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="mt-6 h-auto w-full flex-wrap justify-start gap-2 rounded-3xl border border-slate-200/70 bg-white/85 p-2 shadow-sm backdrop-blur-xl">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <TabsTrigger
                                    key={tab.value}
                                    value={tab.value}
                                    className="group min-w-[170px] rounded-2xl border border-transparent px-4 py-3 text-left data-[state=active]:border-blue-200 data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-600 data-[state=active]:to-cyan-500 data-[state=active]:text-white"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5 rounded-xl bg-slate-100 p-2 text-slate-600 transition-colors group-data-[state=active]:bg-white/15 group-data-[state=active]:text-white">
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-semibold">{tab.label}</div>
                                            <div className="text-xs text-slate-500 group-data-[state=active]:text-blue-50">{tab.hint}</div>
                                        </div>
                                    </div>
                                </TabsTrigger>
                            );
                        })}
                    </TabsList>

                    <div className="mt-6 premium-card border-slate-200/70 p-4 sm:p-6">
                        <TabsContent value="exams" className="mt-0">
                            <ExamsTab />
                        </TabsContent>
                        <TabsContent value="users" className="mt-0">
                            <UsersTab />
                        </TabsContent>
                        <TabsContent value="groups" className="mt-0">
                            <GroupsTab />
                        </TabsContent>
                        <TabsContent value="submissions" className="mt-0">
                            <SubmissionsTab />
                        </TabsContent>
                        <TabsContent value="live" className="mt-0">
                            <LiveMonitorTab />
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </div>
    );
}
