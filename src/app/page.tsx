'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import { LoginForm } from '@/components/auth/LoginForm';
import { Dashboard } from '@/components/dashboard/Dashboard';

export default function Home() {
  const { user, profile, loading, supabase } = useAuth();

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show error if Supabase not configured
  if (!supabase) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-lg shadow-lg max-w-lg w-full p-8">
          <h1 className="text-2xl font-bold text-red-600 mb-4">⚠️ Configuration Required</h1>
          <p className="text-gray-700 mb-4">
            The application is not properly configured. Environment variables are missing.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Required variables:</p>
            <ul className="text-sm text-gray-600 space-y-1 font-mono">
              <li>• NEXT_PUBLIC_SUPABASE_URL</li>
              <li>• NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
            </ul>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-blue-700">
              <strong>To fix:</strong> Go to Vercel Dashboard → Your Project → Settings → Environment Variables, 
              add the variables, then redeploy.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!user) {
    return <LoginForm />;
  }

  // Show loading while profile loads
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent" />
          <p className="text-gray-600">Setting up your account...</p>
        </div>
      </div>
    );
  }

  // Show dashboard
  return <Dashboard />;
}
