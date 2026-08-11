import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { setIsDemoMode } from '../services/api';
import type { Profile } from '../types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  baseCurrency: string;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .is('deleted_at', null)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
      } else {
        setProfile(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const signOut = async () => {
    if (getIsDemoMode()) {
      setIsDemoMode(false);
      localStorage.removeItem('finflow_demo_mode');
      setUser(null);
      setSession(null);
      setProfile(null);
      window.location.reload();
      return;
    }

    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  useEffect(() => {
    // Check active sessions — gracefully handle if Supabase is not configured (demo mode)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    }).catch(() => {
      // No Supabase configured — fall through to demo mode
      setLoading(false);
    });

    // Listen for auth state changes
    let subscription: { unsubscribe: () => void } | null = null;
    try {
      const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      });
      subscription = data.subscription;
    } catch {
      // No Supabase configured
    }

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const baseCurrency = profile?.base_currency || 'USD';

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, baseCurrency, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
