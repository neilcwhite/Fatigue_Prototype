import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Auth helper functions
export async function signUp(email: string, password: string, fullName: string, orgName: string) {
  // First, sign up the user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error('No user returned from signup');

  // Create the organisation
  const { data: orgData, error: orgError } = await supabase
    .from('organisations')
    .insert({ name: orgName })
    .select()
    .single();

  if (orgError) throw orgError;

  // Create the user profile
  const { error: profileError } = await supabase
    .from('user_profiles')
    .insert({
      id: authData.user.id,
      organisation_id: orgData.id,
      email: email,
      full_name: fullName,
      role: 'admin', // First user is admin
    });

  if (profileError) throw profileError;

  return authData;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getUserProfile() {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*, organisations(*)')
    .eq('id', user.id)
    .single();

  if (error) throw error;
  return data;
}

// Invite a new user to the organisation
export async function inviteUser(email: string, fullName: string, role: 'admin' | 'manager' | 'viewer') {
  const profile = await getUserProfile();
  if (!profile) throw new Error('Not authenticated');

  // Sign up the new user with a temporary password
  const tempPassword = crypto.randomUUID();
  
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password: tempPassword,
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error('No user returned from signup');

  // Create their profile in the same organisation
  const { error: profileError } = await supabase
    .from('user_profiles')
    .insert({
      id: authData.user.id,
      organisation_id: profile.organisation_id,
      email: email,
      full_name: fullName,
      role: role,
    });

  if (profileError) throw profileError;

  // In a real app, you'd send them an email with password reset link
  return { tempPassword };
}
