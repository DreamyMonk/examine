"use client";

import React, { createContext, useContext, ReactNode } from 'react';

// Simplified auth context - the exam system uses email lookup for students
// and session-based auth for admin
interface AuthContextType {
  // Placeholder for future auth needs
}

const AuthContext = createContext<AuthContextType>({});

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider value={{}}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
