import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

/**
 * useUserRole — fetches the user's role from the `profiles` table.
 * Returns: { role: 'admin' | 'worker' | null, loading: boolean }
 *
 * Supabase `profiles` table structure:
 *   id        uuid  (references auth.users.id)
 *   role      text  ('admin' | 'worker')
 *   full_name text
 */
export function useUserRole(session) {
  const [role, setRole]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) { setRole(null); setLoading(false); return; }

    const fetchRole = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role, full_name')
          .eq('id', session.user.id)
          .single();

        if (error || !data) {
          // No profile yet → auto-create as 'worker' (admin must be set manually in Supabase)
          await supabase.from('profiles').upsert({
            id: session.user.id,
            role: 'worker',
            full_name: session.user.email?.split('@')[0] || 'Utilisateur',
            email: session.user.email,
            is_active: true,
          });
          setRole('worker');
        } else {
          setRole(data.role || 'worker');
        }
      } catch {
        setRole('worker'); // safe default
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
  }, [session?.user?.id]);

  return { role, loading };
}

/** Helper: true if the user is an admin */
export const isAdmin = (role) => role === 'admin';

/** Tabs visible to workers (limited) */
export const WORKER_TABS = new Set([
  'dashboard', 'clients', 'produits', 'stock', 'production', 'ventes', 'achats', 'chat',
]);

/** Tabs visible only to admins */
export const ADMIN_ONLY_TABS = new Set([
  'reglements', 'caisse', 'apports', 'personnel', 'stats', 'dev',
]);
