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

// Safe upsert helper to prevent crashes if columns are not yet added in SQL
export async function safeUpsertProfile(profileData) {
  try {
    const res = await supabase.from('profiles').upsert(profileData);
    if (!res.error) return res;

    if (res.error?.message?.includes('does not exist')) {
      const basicData = {
        id: profileData.id,
        role: profileData.role,
        full_name: profileData.full_name,
        email: profileData.email,
        is_active: profileData.is_active,
      };
      return await supabase.from('profiles').upsert(basicData);
    }
    return res;
  } catch (err) {
    console.warn('safeUpsertProfile fallback error:', err);
    return { error: err };
  }
}
