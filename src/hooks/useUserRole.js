import { useState, useEffect, useCallback } from 'react';
import { supabase, safeUpsertProfile } from '../supabaseClient';

/**
 * useUserRole — determines user role, active status, and full profile data.
 * 
 * Returns: {
 *   role: 'admin' | 'worker' | null,
 *   isActive: boolean,
 *   profile: object | null,
 *   loading: boolean,
 *   refreshRole: () => Promise<void>
 * }
 */
export function useUserRole(session) {
  const [role, setRole]         = useState(null);
  const [isActive, setIsActive] = useState(true);
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);

  const fetchRole = useCallback(async () => {
    if (!session?.user?.id) { 
      setRole(null); 
      setIsActive(true);
      setProfile(null);
      setLoading(false); 
      return; 
    }

    setLoading(true);
    try {
      const user = session.user;
      const meta = user.user_metadata || {};
      const metaRole = meta.role; // 'admin' ou 'worker'

      // 1. Chercher dans la table profiles
      const { data: dbProfile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (dbProfile) {
        const localAvatar = localStorage.getItem('brasti-avatar-' + user.id);
        let effectiveDirectorId = dbProfile.director_id;
        let effectiveDirectorName = dbProfile.director_name;

        // Auto-guérison si c'est un employé sans director_id valide
        const isWorkerRole = (dbProfile.role === 'worker' || metaRole === 'worker');
        if (isWorkerRole && (!effectiveDirectorId || effectiveDirectorId === 'admin-principal')) {
          try {
            const { data: adminUser } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .eq('role', 'admin')
              .limit(1)
              .maybeSingle();

            if (adminUser?.id) {
              effectiveDirectorId = adminUser.id;
              effectiveDirectorName = adminUser.full_name || adminUser.email;
              safeUpsertProfile({
                id: user.id,
                director_id: effectiveDirectorId,
                director_name: effectiveDirectorName
              }).catch(() => {});
            }
          } catch (e) {
            console.warn('Auto-resolve director error:', e);
          }
        }

        const mergedProfile = {
          ...dbProfile,
          director_id: effectiveDirectorId,
          director_name: effectiveDirectorName,
          avatar_url: dbProfile.avatar_url || meta.avatar_url || localAvatar || ''
        };
        setProfile(mergedProfile);
        setRole(dbProfile.role || metaRole || 'worker');
        setIsActive(dbProfile.is_active !== false);
        return;
      }

      // 2. Si pas de profil en base, vérifier user_metadata
      if (metaRole === 'worker' || metaRole === 'admin') {
        setRole(metaRole);
        // Les employés créés sont en attente (is_active: false), les directeurs sont actifs (true)
        const initialActive = metaRole === 'admin';
        setIsActive(initialActive);

        let effectiveDirectorId = meta.director_id || null;
        let effectiveDirectorName = meta.director_name || '';

        if (metaRole === 'worker' && (!effectiveDirectorId || effectiveDirectorId === 'admin-principal')) {
          try {
            const { data: adminUser } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .eq('role', 'admin')
              .limit(1)
              .maybeSingle();

            if (adminUser?.id) {
              effectiveDirectorId = adminUser.id;
              effectiveDirectorName = adminUser.full_name || adminUser.email;
            }
          } catch (e) {
            console.warn('Auto-resolve director error in metadata flow:', e);
          }
        }

        const localAvatar = localStorage.getItem('brasti-avatar-' + user.id);
        const newProf = {
          id: user.id,
          role: metaRole,
          full_name: meta.full_name || user.email?.split('@')[0] || 'Utilisateur',
          email: user.email,
          tel: meta.tel || '',
          adresse: meta.adresse || '',
          date_naissance: meta.date_naissance || '',
          avatar_url: meta.avatar_url || localAvatar || '',
          director_id: effectiveDirectorId,
          director_name: effectiveDirectorName,
          is_active: initialActive,
        };
        setProfile(newProf);

        // Sauvegarder en arrière-plan avec fallback sécurisé
        safeUpsertProfile(newProf).then(() => {});
        return;
      }

      // 3. Fallback : si aucun rôle n'a jamais été spécifié (ex: premier admin)
      const { count: adminCount } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin');

      const assignedRole = (!adminCount || adminCount === 0) ? 'admin' : 'worker';
      const assignedActive = assignedRole === 'admin';

      setRole(assignedRole);
      setIsActive(assignedActive);

      const fallbackProf = {
        id: user.id,
        role: assignedRole,
        full_name: user.email?.split('@')[0] || 'Utilisateur',
        email: user.email,
        is_active: assignedActive,
      };
      setProfile(fallbackProf);

      safeUpsertProfile(fallbackProf).then(() => {});

    } catch (err) {
      console.warn('Error determining role:', err);
      const fallbackRole = session.user?.user_metadata?.role || 'worker';
      setRole(fallbackRole);
      setIsActive(fallbackRole === 'admin');
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    fetchRole();
  }, [fetchRole]);

  // Company ID: pour un directeur c'est son propre id, pour un employé c'est le director_id de son directeur
  // Fallback sécurisé vers le directeur principal si c'est un employé pour ne JAMAIS avoir un espace vide à 0 clients/produits
  const DEFAULT_DIRECTOR_ID = '4ac64577-c8a3-45ea-a022-18b2f16cb489';
  const isWorker = (role === 'worker' || profile?.role === 'worker' || session?.user?.user_metadata?.role === 'worker');
  const companyId = isWorker 
    ? (profile?.director_id && profile.director_id !== 'admin-principal' ? profile.director_id : DEFAULT_DIRECTOR_ID)
    : session?.user?.id;

  return { role, isActive, profile, loading, companyId, refreshRole: fetchRole };
}

/**
 * Détermine l'identifiant de l'entreprise (espace de travail).
 * - Directeur: son propre id
 * - Employé: l'id de son directeur assigné
 */
export function getCompanyId(session, profile) {
  if (!session?.user?.id) return null;
  const DEFAULT_DIRECTOR_ID = '4ac64577-c8a3-45ea-a022-18b2f16cb489';
  if (profile?.role === 'worker' || session?.user?.user_metadata?.role === 'worker') {
    return (profile?.director_id && profile.director_id !== 'admin-principal') ? profile.director_id : DEFAULT_DIRECTOR_ID;
  }
  return session.user.id;
}

/** Helper: true if the user is an admin */
export const isAdmin = (role) => role === 'admin';

/** Tabs visible to workers */
export const WORKER_TABS = new Set([
  'dashboard', 'clients', 'produits', 'stock', 'production', 'ventes', 'achats', 'retours', 'chat',
]);

/** Tabs visible only to admins */
export const ADMIN_ONLY_TABS = new Set([
  'reglements', 'caisse', 'apports', 'personnel', 'stats', 'dev', 'utilisateurs'
]);
