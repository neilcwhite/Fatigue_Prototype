'use client';

import { supabase } from '@/lib/supabase';

interface SignOutHeaderProps {
  user: any;
  onSignOut: () => void;
}

export function SignOutHeader({ user, onSignOut }: SignOutHeaderProps) {
  if (!user) return null;

  const handleSignOut = async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
      onSignOut();
    } catch (error) {
      console.error('Error signing out:', error);
      alert('Failed to sign out. Check console for details.');
    }
  };

  return (
    <div className="text-white text-sm bg-slate-800/90 backdrop-blur-sm px-3 py-1 rounded-lg shadow-lg border border-slate-700 flex items-center gap-3">
      <p className="font-medium">{user.email}</p>
      <button 
        onClick={handleSignOut} 
        className="text-blue-400 hover:text-blue-300 text-xs underline transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}
