"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { AdminDashboard } from '@/components/admin/AdminDashboard';

const ADMIN_EMAIL = 'admin@examdesk.com';
const ADMIN_PASSWORD = 'admin123';

export default function AdminPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const adminAuth = sessionStorage.getItem('adminAuth');
    if (adminAuth === 'true') setIsAuthenticated(true);
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      toast({ title: 'Fields Required', description: 'Please fill in both email and password.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 600));
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      sessionStorage.setItem('adminAuth', 'true');
      setIsAuthenticated(true);
      toast({ title: 'Access Granted', description: 'Welcome to the ExamDesk administrator console.' });
    } else {
      toast({ title: 'Invalid Credentials', description: 'Please check your email and password.', variant: 'destructive' });
    }
    setIsLoading(false);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('adminAuth');
    setIsAuthenticated(false);
    setEmail('');
    setPassword('');
    toast({ title: 'Signed Out', description: 'You have been signed out of the admin console.' });
  };

  if (isAuthenticated) {
    return <AdminDashboard onLogout={handleLogout} />;
  }

  return (
    <div className="auth-page">
      <div className="w-full max-w-sm animate-fade-in-up px-4">

        {/* Brand mark */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-indigo-600 mb-4 shadow-lg shadow-indigo-900/50">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-white tracking-tight">ExamDesk — Admin</h1>
          <p className="text-sm text-slate-400 mt-1">Administrator console access</p>
        </div>

        {/* Login card */}
        <div className="auth-card p-6">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Sign in to continue</h2>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="admin-email" className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Email
              </Label>
              <Input
                id="admin-email"
                type="email"
                placeholder="admin@examdesk.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                disabled={isLoading}
                className="h-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="admin-password" className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  disabled={isLoading}
                  className="h-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              id="admin-login-btn"
              onClick={handleLogin}
              disabled={isLoading}
              className="w-full h-10 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-900/30"
            >
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Authenticating...</>
              ) : (
                <><Lock className="mr-2 h-4 w-4" /> Sign In</>
              )}
            </Button>
          </div>

          <p className="text-[11px] text-slate-600 text-center mt-4">
            Default: admin@examdesk.com / admin123
          </p>
        </div>
      </div>
    </div>
  );
}
