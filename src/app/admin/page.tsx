"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, ClipboardCheck, ArrowRight } from 'lucide-react';
import { AdminDashboard } from '@/components/admin/AdminDashboard';

// Admin credentials - in a real app these would be validated server-side
const ADMIN_EMAIL = 'admin@examdesk.com';
const ADMIN_PASSWORD = 'admin123';

export default function AdminPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const { toast } = useToast();

    // Check if already logged in
    useEffect(() => {
        const adminAuth = sessionStorage.getItem('adminAuth');
        if (adminAuth === 'true') {
            setIsAuthenticated(true);
        }
    }, []);

    const handleLogin = async () => {
        if (!email || !password) {
            toast({ title: 'Error', description: 'Please fill in all fields.', variant: 'destructive' });
            return;
        }

        setIsLoading(true);
        // Simulate auth delay
        await new Promise(resolve => setTimeout(resolve, 800));

        if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
            sessionStorage.setItem('adminAuth', 'true');
            setIsAuthenticated(true);
            toast({ title: 'Welcome, Admin', description: 'You have been logged in successfully.' });
        } else {
            toast({ title: 'Invalid Credentials', description: 'Please check your email and password.', variant: 'destructive' });
        }
        setIsLoading(false);
    };

    const handleLogout = () => {
        sessionStorage.removeItem('adminAuth');
        setIsAuthenticated(false);
        toast({ title: 'Logged Out', description: 'You have been signed out.' });
    };

    if (isAuthenticated) {
        return <AdminDashboard onLogout={handleLogout} />;
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
            <div className="w-full max-w-sm animate-fade-in-up">
                <div className="text-center mb-8">
                    <div className="mx-auto h-12 w-12 rounded-xl bg-blue-600 flex items-center justify-center mb-3">
                        <ClipboardCheck className="h-6 w-6 text-white" />
                    </div>
                    <h1 className="text-xl font-semibold text-gray-900">ExamDesk Admin</h1>
                    <p className="text-sm text-gray-500 mt-1">Sign in to manage exams and users</p>
                </div>

                <Card className="shadow-sm border border-gray-200">
                    <CardContent className="space-y-4 pt-6">
                        <div className="space-y-2">
                            <Label htmlFor="admin-email" className="text-sm font-medium text-gray-700">Email</Label>
                            <Input
                                id="admin-email"
                                type="email"
                                placeholder="admin@examdesk.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                                disabled={isLoading}
                                className="h-10"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="admin-password" className="text-sm font-medium text-gray-700">Password</Label>
                            <Input
                                id="admin-password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                                disabled={isLoading}
                                className="h-10"
                            />
                        </div>
                        <Button
                            onClick={handleLogin}
                            disabled={isLoading}
                            className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                <>
                                    <Lock className="mr-2 h-4 w-4" />
                                    Sign In
                                </>
                            )}
                        </Button>
                        <p className="text-xs text-center text-gray-400 pt-2">
                            Default: admin@examdesk.com / admin123
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
