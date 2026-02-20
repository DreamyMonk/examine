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

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
                            <ClipboardCheck className="h-4 w-4 text-white" />
                        </div>
                        <span className="font-semibold text-gray-900">ExamDesk</span>
                        <span className="text-xs bg-blue-50 text-blue-600 font-semibold px-2 py-0.5 rounded-full">Admin</span>
                    </div>
                    <Button onClick={onLogout} variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700">
                        <LogOut className="mr-1.5 h-4 w-4" />
                        Sign Out
                    </Button>
                </div>
            </header>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="bg-white border border-gray-200 p-1 rounded-lg h-auto flex-wrap">
                        <TabsTrigger
                            value="exams"
                            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white px-4 py-2 text-sm"
                        >
                            <FileText className="mr-1.5 h-4 w-4" />
                            Exams
                        </TabsTrigger>
                        <TabsTrigger
                            value="users"
                            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white px-4 py-2 text-sm"
                        >
                            <Users className="mr-1.5 h-4 w-4" />
                            Users
                        </TabsTrigger>
                        <TabsTrigger
                            value="groups"
                            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white px-4 py-2 text-sm"
                        >
                            <FolderPlus className="mr-1.5 h-4 w-4" />
                            Groups
                        </TabsTrigger>
                        <TabsTrigger
                            value="submissions"
                            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white px-4 py-2 text-sm"
                        >
                            <ClipboardCheck className="mr-1.5 h-4 w-4" />
                            Submissions
                        </TabsTrigger>
                        <TabsTrigger
                            value="live"
                            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white px-4 py-2 text-sm"
                        >
                            <Eye className="mr-1.5 h-4 w-4" />
                            Live Monitor
                        </TabsTrigger>
                    </TabsList>

                    <div className="mt-6">
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
