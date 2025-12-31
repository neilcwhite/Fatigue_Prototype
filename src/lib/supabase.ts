// ============================================
// SUPABASE CLIENT CONFIGURATION
// ============================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables - set these in .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Debug logging
console.log('Supabase config:', {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseKey,
  urlPrefix: supabaseUrl.substring(0, 20)
});

// Validate configuration
if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase environment variables not set');
}

// Create Supabase client with proper auth persistence settings
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: true,
          storageKey: 'fatigue-management-auth',
          storage: typeof window !== 'undefined' ? window.localStorage : undefined,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

// ==================== AUTH HELPERS ====================

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error('Supabase not configured');
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) throw error;
  return data;
}

export async function signUp(email: string, password: string) {
  if (!supabase) throw new Error('Supabase not configured');
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  
  if (error) throw error;
  return data;
}

export async function signOut() {
  if (!supabase) throw new Error('Supabase not configured');
  
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  if (!supabase) return null;
  
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getSession() {
  if (!supabase) return null;
  
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// ==================== DATABASE HELPERS ====================

// Table name mapping for compatibility
export const TABLES = {
  employees: 'employees',
  projects: 'projects',
  teams: 'teams',
  shiftPatterns: 'shift_patterns',
  assignments: 'assignments',
  userProfiles: 'user_profiles',
  organisations: 'organisations',
} as const;

// Convert camelCase to snake_case
export function toSnakeCase(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      result[snakeKey] = obj[key];
    }
  }
  return result;
}

// Convert snake_case to camelCase
export function toCamelCase(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      result[camelKey] = obj[key];
    }
  }
  return result;
}

// ==================== GENERIC CRUD OPERATIONS ====================

export async function fetchAll<T>(table: string): Promise<T[]> {
  if (!supabase) throw new Error('Supabase not configured');
  
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .order('id');
  
  if (error) throw error;
  return (data || []) as T[];
}

export async function fetchById<T>(table: string, id: string | number): Promise<T | null> {
  if (!supabase) throw new Error('Supabase not configured');
  
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data as T;
}

export async function insert<T>(table: string, data: Partial<T>): Promise<T> {
  if (!supabase) throw new Error('Supabase not configured');
  
  const { data: result, error } = await supabase
    .from(table)
    .insert(data)
    .select()
    .single();
  
  if (error) throw error;
  return result as T;
}

export async function update<T>(
  table: string, 
  id: string | number, 
  data: Partial<T>
): Promise<T> {
  if (!supabase) throw new Error('Supabase not configured');
  
  const { data: result, error } = await supabase
    .from(table)
    .update(data)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return result as T;
}

export async function remove(table: string, id: string | number): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

export async function upsert<T>(table: string, data: Partial<T>): Promise<T> {
  if (!supabase) throw new Error('Supabase not configured');
  
  const { data: result, error } = await supabase
    .from(table)
    .upsert(data)
    .select()
    .single();
  
  if (error) throw error;
  return result as T;
}
