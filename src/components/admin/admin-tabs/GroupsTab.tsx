"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { createUserGroup, getUserGroups, deleteUserGroup } from '@/services/examService';
import type { UserGroup } from '@/types/exam';
import { Loader2, FolderPlus, Trash2, Folder, Users } from 'lucide-react';

export function GroupsTab() {
    const [groups, setGroups] = useState<UserGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [showForm, setShowForm] = useState(false);
    const { toast } = useToast();

    const fetchGroups = async () => {
        setIsLoading(true);
        try {
            const data = await getUserGroups();
            setGroups(data);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchGroups(); }, []);

    const handleCreate = async () => {
        if (!newName) {
            toast({ title: 'Name Required', description: 'Please enter a group name.', variant: 'destructive' });
            return;
        }
        setIsSaving(true);
        try {
            await createUserGroup({ name: newName, description: newDesc, createdBy: 'admin' });
            toast({ title: 'Group Created', description: `"${newName}" group has been created.` });
            setNewName(''); setNewDesc('');
            setShowForm(false);
            fetchGroups();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (groupId: string, groupName: string) => {
        if (!confirm(`Delete group "${groupName}"? Users in this group will become unassigned.`)) return;
        try {
            await deleteUserGroup(groupId);
            toast({ title: 'Group Deleted', description: `"${groupName}" removed.` });
            fetchGroups();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    return (
        <div className="space-y-4">
            <div className="section-header">
                <div>
                    <p className="section-title">Groups</p>
                    <p className="section-meta">Organize candidates into cohorts for exam assignment</p>
                </div>
                <Button onClick={() => setShowForm(!showForm)} className="bg-indigo-600 hover:bg-indigo-500 text-white h-9 rounded-lg text-sm">
                    <FolderPlus className="mr-1.5 h-4 w-4" />
                    New Group
                </Button>
            </div>

            {showForm && (
                <Card className="shadow-sm border border-blue-100 bg-blue-50/30 animate-scale-in">
                    <CardContent className="pt-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium text-gray-700">Group Name</Label>
                                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., Class 10A" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium text-gray-700">Description (optional)</Label>
                                <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="e.g., Morning batch" />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handleCreate} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-500 text-white h-9 rounded-lg text-sm">
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Create Group
                            </Button>
                            <Button variant="ghost" onClick={() => setShowForm(false)} className="h-9 rounded-lg text-sm">Cancel</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
            ) : groups.length === 0 ? (
                <Card className="shadow-sm border border-gray-200">
                    <CardContent className="flex flex-col items-center py-12">
                        <Folder className="h-10 w-10 text-gray-300 mb-3" />
                        <p className="text-gray-500 text-sm">No groups yet. Create your first group to organize users.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {groups.map(group => (
                        <Card key={group.id} className="shadow-sm border border-gray-200 hover:border-gray-300 transition-colors">
                            <CardContent className="flex items-center justify-between py-4 px-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                                        <Users className="h-5 w-5 text-indigo-500" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900 text-sm">{group.name}</p>
                                        {group.description && <p className="text-xs text-gray-400">{group.description}</p>}
                                    </div>
                                </div>
                                <Button
                                    onClick={() => handleDelete(group.id, group.name)}
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
