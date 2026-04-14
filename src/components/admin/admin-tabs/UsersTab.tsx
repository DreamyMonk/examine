"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { addExamUser, getExamUsers, deleteExamUser, getUserGroups } from '@/services/examService';
import type { ExamUser, UserGroup } from '@/types/exam';
import { Loader2, UserPlus, Trash2, Users, Mail, Search, Lock } from 'lucide-react';

export function UsersTab() {
    const [users, setUsers] = useState<ExamUser[]>([]);
    const [groups, setGroups] = useState<UserGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Form
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newGroupId, setNewGroupId] = useState('');
    const [showForm, setShowForm] = useState(false);

    const { toast } = useToast();

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [usersData, groupsData] = await Promise.all([getExamUsers(), getUserGroups()]);
            // Enrich with group names
            const groupMap = new Map(groupsData.map(g => [g.id, g.name]));
            setUsers(usersData.map(u => ({ ...u, groupName: groupMap.get(u.groupId) || 'Unknown' })));
            setGroups(groupsData);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleAdd = async () => {
        if (!newName || !newEmail || !newGroupId) {
            toast({ title: 'Missing Fields', description: 'Please fill all fields.', variant: 'destructive' });
            return;
        }
        setIsSaving(true);
        try {
            await addExamUser({ name: newName, email: newEmail.toLowerCase(), password: newPassword || undefined, groupId: newGroupId });
            toast({ title: 'User Added', description: `${newName} has been added.` });
            setNewName(''); setNewEmail(''); setNewPassword(''); setNewGroupId('');
            setShowForm(false);
            fetchData();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (userId: string, userName: string) => {
        if (!confirm(`Delete user "${userName}"?`)) return;
        try {
            await deleteExamUser(userId);
            toast({ title: 'User Deleted', description: `${userName} removed.` });
            fetchData();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    const filteredUsers = users.filter(u =>
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-4">
            <div className="section-header">
                <div>
                    <p className="section-title">Candidates</p>
                    <p className="section-meta">{users.length} registered candidate{users.length !== 1 ? 's' : ''}</p>
                </div>
                <Button onClick={() => setShowForm(!showForm)} className="bg-indigo-600 hover:bg-indigo-500 text-white h-9 rounded-lg text-sm">
                    <UserPlus className="mr-1.5 h-4 w-4" />
                    Add Candidate
                </Button>
            </div>

            {/* Add Form */}
            {showForm && (
                <Card className="shadow-sm border border-blue-100 bg-blue-50/30 animate-scale-in">
                    <CardContent className="pt-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium text-gray-700">Full Name</Label>
                                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="John Doe" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium text-gray-700">Email</Label>
                                <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="john@example.com" type="email" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium text-gray-700">Password (optional)</Label>
                                <Input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Leave blank for email-only login" type="password" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium text-gray-700">Group</Label>
                                <Select value={newGroupId} onValueChange={setNewGroupId}>
                                    <SelectTrigger><SelectValue placeholder="Select group" /></SelectTrigger>
                                    <SelectContent>
                                        {groups.map(g => (
                                            <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handleAdd} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-500 text-white h-9 rounded-lg text-sm">
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Save Candidate
                            </Button>
                            <Button variant="ghost" onClick={() => setShowForm(false)} className="h-9 rounded-lg text-sm">Cancel</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search users..."
                    className="pl-9"
                />
            </div>

            {/* Users list */}
            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
            ) : filteredUsers.length === 0 ? (
                <Card className="shadow-sm border border-gray-200">
                    <CardContent className="flex flex-col items-center py-12">
                        <Users className="h-10 w-10 text-gray-300 mb-3" />
                        <p className="text-gray-500 text-sm">No users found. Add your first user above.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {filteredUsers.map(user => (
                        <Card key={user.id} className="shadow-sm border border-gray-200 hover:border-gray-300 transition-colors">
                            <CardContent className="flex items-center justify-between py-3 px-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-semibold text-sm">
                                        {user.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900 text-sm">{user.name}</p>
                                        <p className="text-xs text-gray-400">{user.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {user.password && (
                                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                            <Lock className="h-2.5 w-2.5" />
                                            Password
                                        </span>
                                    )}
                                    <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">{user.groupName}</span>
                                    <Button
                                        onClick={() => handleDelete(user.id, user.name)}
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
