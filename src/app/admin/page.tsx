"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Lock, Eye, EyeOff,
  ShieldCheck, Users, FileText, Radio, BarChart3,
} from 'lucide-react';
import { AdminDashboard } from '@/components/admin/AdminDashboard';

const ADMIN_EMAIL = 'admin@examdesk.com';
const ADMIN_PASSWORD = 'admin123';

const STATS = [
  { icon: FileText,  label: 'Exam Management',   desc: 'Create, schedule & publish' },
  { icon: Users,     label: 'Candidate Control',  desc: 'Users, groups & access' },
  { icon: Radio,     label: 'Live Proctoring',    desc: 'Real-time session monitor' },
  { icon: BarChart3, label: 'Results & Reports',  desc: 'Submissions & analytics' },
];

export default function AdminPage() {
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading]       = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (sessionStorage.getItem('adminAuth') === 'true') setIsAuthenticated(true);
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      toast({ title: 'Fields Required', description: 'Enter both email and password.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 600));
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

  if (isAuthenticated) return <AdminDashboard onLogout={handleLogout} />;

  return (
    <div className="min-h-screen flex">

      {/* ── LEFT PANEL — dark branding ─────────────────────── */}
      <div className="hidden lg:flex lg:w-[440px] xl:w-[500px] flex-shrink-0 flex-col bg-slate-950 relative overflow-hidden">

        {/* Background grid pattern */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        {/* Glow blobs */}
        <div className="absolute top-0 left-0 h-80 w-80 rounded-full bg-indigo-600/20 blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-indigo-800/20 blur-3xl translate-x-1/3 translate-y-1/3" />

        <div className="relative z-10 flex flex-col h-full p-10">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-auto">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-900/60">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-none">ExamDesk</p>
              <p className="text-slate-500 text-[10px] mt-0.5 tracking-wide uppercase">Admin Console</p>
            </div>
          </div>

          {/* Headline */}
          <div className="mt-16 mb-10">
            <h2 className="text-3xl font-semibold text-white leading-tight tracking-tight">
              Manage exams<br />with precision.
            </h2>
            <p className="text-slate-400 text-sm mt-3 leading-relaxed max-w-xs">
              Full control over candidates, scheduling, live proctoring, and results — all in one secure console.
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-3 mb-auto">
            {STATS.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-center gap-3 group">
                <div className="h-8 w-8 rounded-lg bg-slate-800 border border-slate-700/80 flex items-center justify-center flex-shrink-0 group-hover:border-indigo-500/40 transition-colors">
                  <Icon className="h-3.5 w-3.5 text-slate-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-300">{label}</p>
                  <p className="text-[11px] text-slate-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom version tag */}
          <div className="mt-10 pt-6 border-t border-slate-800">
            <p className="text-[11px] text-slate-600">ExamDesk v2.0 · Administrator Access Only</p>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL — white form ────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-sm animate-fade-in-up">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-slate-900 text-sm">ExamDesk Admin</span>
          </div>

          {/* Heading */}
          <div className="mb-7">
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Admin Sign In</h1>
            <p className="text-sm text-slate-500 mt-1">Enter your credentials to access the console.</p>
          </div>

          {/* Form card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="admin-email" className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Email Address
              </Label>
              <Input
                id="admin-email"
                type="email"
                placeholder="admin@examdesk.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                disabled={isLoading}
                className="h-10 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg text-sm"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="admin-password" className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  disabled={isLoading}
                  className="h-10 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <Button
              id="admin-login-btn"
              onClick={handleLogin}
              disabled={isLoading}
              className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-all shadow-sm shadow-indigo-200 mt-1"
            >
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Authenticating...</>
              ) : (
                <><Lock className="mr-2 h-4 w-4" /> Sign In to Console</>
              )}
            </Button>
          </div>

          {/* Hint */}
          <div className="mt-4 flex items-center gap-2 px-1">
            <div className="h-px flex-1 bg-slate-200" />
            <p className="text-[11px] text-slate-400 font-mono px-2">
              admin@examdesk.com · admin123
            </p>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          {/* Security note */}
          <div className="mt-5 flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700 leading-relaxed">
              This console is restricted to authorized administrators only. All access is logged.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
