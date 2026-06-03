import { createClient } from '@supabase/supabase-js';

// Retrieve credentials from environment or use direct fallback configurations
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://ymtccjfbcfogkplisjhr.supabase.co';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltdGNjamZiY2ZvZ2twbGlzamhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NTg2MTcsImV4cCI6MjA5NjAzNDYxN30.tWU3xu-UodQvt9-P2TIOy0xsyNtJ9fvB_WJFfClWwaU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
