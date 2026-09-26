// Re-export the browser client for easy importing throughout the app
// Usage: import { supabase } from '@/utils/supabase'
export { createClient } from './client';

// Singleton instance for convenience
import { createClient } from './client';
export const supabase = createClient();
