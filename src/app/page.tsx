'use client';

import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '@/components/auth/AuthProvider';
import { LoginForm } from '@/components/auth/LoginForm';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { PasswordReset } from '@/components/auth/PasswordReset';

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      setIsRecovery(true);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4" />
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (isRecovery) {
    return <PasswordReset onComplete={() => setIsRecovery(false)} />;
  }

  if (!user || !profile) {
    return <LoginForm />;
  }

  return <Dashboard />;
}

export default function Home() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
