import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { User } from '../types';

interface AuthContextType {
  user: SupabaseUser | null;
  userProfile: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchUserProfile(session.user.id);
        } else {
          setUserProfile(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setUserProfile(data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    // Demo mode authentication
    if (email === 'demo@chamber.law' && password === 'demo123456') {
      // Create a mock user session
      const mockUser = {
        id: 'demo-user-id',
        email: 'demo@chamber.law',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      const mockProfile = {
        id: 'demo-user-id',
        tenant_id: 'demo-tenant',
        email: 'demo@chamber.law',
        role: 'senior_lawyer' as const,
        name: 'Demo User',
        language: 'en' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      setUser(mockUser as any);
      setUserProfile(mockProfile);
      return;
    }
    
    // Try real Supabase authentication
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (error) {
      // If Supabase fails, throw the original error
      throw new Error('Invalid credentials. Please try demo@chamber.law / demo123456');
    }
  };

  const signOut = async () => {
    // Clear mock session
    setUser(null);
    setUserProfile(null);
    
    // Also try to sign out from Supabase if connected
    try {
      await supabase.auth.signOut();
    } catch (error) {
      // Ignore Supabase errors in demo mode
      console.log('Supabase signOut skipped in demo mode');
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!user) throw new Error('No user logged in');

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id);

    if (error) throw error;

    setUserProfile(prev => prev ? { ...prev, ...updates } : null);
  };

  const value = {
    user,
    userProfile,
    loading,
    signIn,
    signOut,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};