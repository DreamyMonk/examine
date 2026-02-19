
"use client";

import Link from 'next/link';
import { BookMarked, UserCircle, LogOut, Loader2, MailWarning, Send, LockKeyhole, PanelLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { AuthModal } from '@/components/auth/AuthModal';
import { ChangePasswordModal } from '@/components/auth/ChangePasswordModal';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useLayout } from '@/contexts/LayoutContext';

export function Header() {
  const { user, signOut, loading, sendVerificationEmail } = useAuth();
  const { isSidebarVisible } = useLayout();

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalView, setAuthModalView] = useState<'signIn' | 'signUp'>('signIn');
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const { toast } = useToast();

  const handleOpenAuthModal = (view: 'signIn' | 'signUp') => {
    setAuthModalView(view);
    setIsAuthModalOpen(true);
  };

  const getInitials = (name?: string | null) => {
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length > 1 && names[0] && names[names.length - 1]) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const handleResendVerificationEmail = async () => {
    if (!user || user.emailVerified) return;
    setIsResendingEmail(true);
    try {
      await sendVerificationEmail();
      toast({
        title: "Verification Email Sent",
        description: "Please check your inbox (and spam folder).",
      });
    } catch (error: any) {
      toast({
        title: "Error Sending Email",
        description: error.message || "Could not resend verification email.",
        variant: "destructive",
      });
    } finally {
      setIsResendingEmail(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isSidebarVisible && <SidebarTrigger className="mr-2 md:hidden" />}
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="relative">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary via-purple-500 to-accent flex items-center justify-center shadow-lg group-hover:shadow-primary/30 transition-all duration-300">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary via-purple-500 to-accent opacity-0 group-hover:opacity-40 blur-lg transition-opacity duration-300" />
              </div>
              <span className="text-xl font-bold tracking-tight gradient-text">QuizAI</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full ring-2 ring-border hover:ring-primary/50 transition-all duration-300">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user.photoURL || undefined} alt={user.displayName || user.email || "User"} />
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-primary font-semibold text-sm">{getInitials(user.displayName || user.email)}</AvatarFallback>
                    </Avatar>
                    {!user.emailVerified && (
                      <span className="absolute -bottom-0.5 -right-0.5 block h-3.5 w-3.5 rounded-full bg-amber-400 ring-2 ring-background border-transparent" title="Email not verified">
                        <MailWarning className="h-full w-full p-0.5 text-amber-900" />
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64 glass-card" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-semibold leading-none">
                        {user.displayName || "User"}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {!user.emailVerified && (
                    <>
                      <DropdownMenuItem onClick={handleResendVerificationEmail} disabled={isResendingEmail} className="cursor-pointer text-amber-500 hover:!text-amber-600 focus:!text-amber-600 focus:!bg-amber-500/10">
                        {isResendingEmail ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="mr-2 h-4 w-4" />
                        )}
                        Resend Verification Email
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={() => setIsChangePasswordModalOpen(true)} className="cursor-pointer">
                    <LockKeyhole className="mr-2 h-4 w-4" />
                    Change Password
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => handleOpenAuthModal('signIn')} className="text-muted-foreground hover:text-foreground transition-colors">
                  Sign In
                </Button>
                <Button onClick={() => handleOpenAuthModal('signUp')} className="bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 text-white border-0 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300">
                  Sign Up
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>
      <AuthModal
        isOpen={isAuthModalOpen}
        onOpenChange={setIsAuthModalOpen}
        initialView={authModalView}
      />
      <ChangePasswordModal
        isOpen={isChangePasswordModalOpen}
        onOpenChange={setIsChangePasswordModalOpen}
      />
    </>
  );
}
