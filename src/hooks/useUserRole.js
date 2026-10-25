import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

/**
 * useUserRole — fetches the user's role from the `profiles` table.
 * Returns: { role: 'admin' | 'worker' | null, loading: boolean }
 *
 * Automatic First Admin:
 * If no admin exists in the database yet, the first user who logs in
 * is automatically assigned the 'admin' (Directeur) role!
 */
export function useUserRole(session) {
  const [role, setRole]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) { 
      setRole(null); 
      setLoading(false); 
      return; 
    }

    const fetchRole = async () => {
      setLoading(true);
      try {
        // 1. Fetch current profile
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role, full_name, is_active')
          .eq('id', session.user.id)
          .maybeSingle();

        // 2. Count existing admins to see if this is the first / owner
        const { count: adminCount } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'admin');

        const noAdminsYet = !adminCount || adminCount === 0;

        if (error || !profile) {
          // First user or user without profile:
          // If no admin exists yet, make this user admin! Otherwise worker.
          const assignedRole = noAdminsYet ? 'admin' : 'worker';

          const newProfile = {
            id: session.user.id,
            role: assignedRole,
            full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Utilisateur',
            email: session.user.email,
            is_active: true,
          };

          await supabase.from('profiles').upsert(newProfile);
          setRole(assignedRole);
        } else {
          // Profile exists: if there is currently NO admin at all, promote this user to admin
          if (profile.role !== 'admin' && noAdminsYet) {
            await supabase
              .from('profiles')
              .update({ role: 'admin' })
              .eq('id', session.user.id);
            setRole('admin');
          } else {
            setRole(profile.role || 'worker');
          }
        }
      } catch (err) {
        console.warn('Error determining role:', err);
        setRole('worker'); // fallback safe
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
  'reglements', 'caisse', 'apports', 'personnel', 'stats', 'dev', 'utilisateurs'
]);
