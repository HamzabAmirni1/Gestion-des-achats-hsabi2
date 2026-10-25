import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

/**
 * useUserRole — determines if the current user is 'admin' (Directeur) or 'worker' (Employé).
 * 
 * Order of priority:
 * 1. Database table `profiles` (role column)
 * 2. Auth user_metadata (role set during registration)
 * 3. Default: 'worker' (only first user without any role metadata becomes admin)
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
        const user = session.user;
        const metaRole = user.user_metadata?.role; // 'admin' ou 'worker'

        // 1. Chercher dans la table profiles
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, full_name, is_active')
          .eq('id', user.id)
          .maybeSingle();

        if (profile?.role) {
          // Si le profil a un rôle en base, on l'utilise
          setRole(profile.role);
          return;
        }

        // 2. Si pas de profil, utiliser le rôle choisi à l'inscription (user_metadata)
        if (metaRole === 'worker' || metaRole === 'admin') {
          setRole(metaRole);
          // Tenter de créer le profil en base
          supabase.from('profiles').upsert({
            id: user.id,
            role: metaRole,
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Utilisateur',
            email: user.email,
            is_active: metaRole === 'admin',
          }).then(() => {});
          return;
        }

        // 3. Fallback : si aucun rôle n'a jamais été spécifié
        const { count: adminCount } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'admin');

        const assignedRole = (!adminCount || adminCount === 0) ? 'admin' : 'worker';
        setRole(assignedRole);

        supabase.from('profiles').upsert({
          id: user.id,
          role: assignedRole,
          full_name: user.email?.split('@')[0] || 'Utilisateur',
          email: user.email,
          is_active: assignedRole === 'admin',
        }).then(() => {});

      } catch (err) {
        console.warn('Error determining role:', err);
        // Sécurité : si l'utilisateur avait demandé 'worker', respecter son choix
        const fallbackRole = session.user?.user_metadata?.role || 'worker';
        setRole(fallbackRole);
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

/** Tabs visible to workers (strictly operational: no financial reports, caisse, dev, users) */
export const WORKER_TABS = new Set([
  'dashboard', 'clients', 'produits', 'stock', 'production', 'ventes', 'achats', 'chat',
]);

/** Tabs visible only to admins */
export const ADMIN_ONLY_TABS = new Set([
  'reglements', 'caisse', 'apports', 'personnel', 'stats', 'dev', 'utilisateurs'
]);
