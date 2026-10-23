import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vgqrasazquaoqskrsryv.supabase.co'
export const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_ug91i0ItCpe0ord5YKAaAg_wY4dMrQM'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Ping function to verify database connectivity and keep project active
export async function pingSupabase() {
  try {
    const { error } = await supabase.from('products').select('id').limit(1);
    return !error;
  } catch (err) {
    console.warn('Keep-alive ping error:', err);
    return false;
  }
}
