import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import Swal from 'sweetalert2';
import {
  UserCheck, UserX, Trash2, RefreshCw, Shield, User,
  CheckCircle, XCircle, Clock, Search
} from 'lucide-react';

/* ── Petite badge rôle ── */
const RoleBadge = ({ role }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '3px 11px', borderRadius: 20, fontSize: '0.74rem', fontWeight: 800,
    background: role === 'admin' ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : 'linear-gradient(135deg,#0ea5e9,#06b6d4)',
    color: 'white', letterSpacing: '0.03em',
  }}>
    {role === 'admin' ? <Shield size={12} /> : <User size={12} />}
    {role === 'admin' ? 'Directeur' : 'Employé'}
  </span>
);

/* ── Badge statut ── */
const StatusBadge = ({ active }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '3px 11px', borderRadius: 20, fontSize: '0.74rem', fontWeight: 800,
    background: active ? '#dcfce7' : '#fee2e2',
    color: active ? '#15803d' : '#b91c1c',
  }}>
    {active ? <CheckCircle size={12} /> : <XCircle size={12} />}
    {active ? 'Actif' : 'Désactivé'}
  </span>
);

export default function UsersModule({ session }) {
  const [profiles, setProfiles]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [actionLoading, setActLoad] = useState(null); // id of loading row

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setProfiles(data || []);
    } catch (e) {
      Swal.fire('Erreur', e.message || 'Impossible de charger les utilisateurs', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  /* ── Changer le rôle ── */
  const toggleRole = async (profile) => {
    if (profile.id === session?.user?.id) {
      Swal.fire('Action interdite', 'Vous ne pouvez pas modifier votre propre rôle.', 'warning');
      return;
    }
    const newRole = profile.role === 'admin' ? 'worker' : 'admin';
    const label   = newRole === 'admin' ? 'Directeur' : 'Employé';
    const { isConfirmed } = await Swal.fire({
      title: `Changer le rôle ?`,
      html: `<b>${profile.full_name || profile.email}</b> deviendra <b>${label}</b>.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Confirmer',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#4f46e5',
    });
    if (!isConfirmed) return;

    setActLoad(profile.id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', profile.id);
      if (error) throw error;
      setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, role: newRole } : p));
      Swal.fire({ icon: 'success', title: `Rôle mis à jour !`, timer: 1200, showConfirmButton: false });
    } catch (e) {
      Swal.fire('Erreur', e.message, 'error');
    } finally {
      setActLoad(null);
    }
  };

  /* ── Activer / Désactiver le compte ── */
  const toggleActive = async (profile) => {
    if (profile.id === session?.user?.id) {
      Swal.fire('Action interdite', 'Vous ne pouvez pas désactiver votre propre compte.', 'warning');
      return;
    }
    const activate = !profile.is_active;
    const { isConfirmed } = await Swal.fire({
      title: activate ? 'Activer ce compte ?' : 'Désactiver ce compte ?',
      html: activate
        ? `<b>${profile.full_name || profile.email}</b> pourra se reconnecter.`
        : `<b>${profile.full_name || profile.email}</b> sera bloqué et déconnecté.`,
      icon: activate ? 'question' : 'warning',
      showCancelButton: true,
      confirmButtonText: activate ? '✅ Activer' : '🚫 Désactiver',
      cancelButtonText: 'Annuler',
      confirmButtonColor: activate ? '#10b981' : '#f59e0b',
    });
    if (!isConfirmed) return;

    setActLoad(profile.id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: activate })
        .eq('id', profile.id);
      if (error) throw error;
      setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, is_active: activate } : p));
      Swal.fire({
        icon: 'success',
        title: activate ? 'Compte activé !' : 'Compte désactivé !',
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (e) {
      Swal.fire('Erreur', e.message, 'error');
    } finally {
      setActLoad(null);
    }
  };

  /* ── Supprimer le profil ── */
  const deleteProfile = async (profile) => {
    if (profile.id === session?.user?.id) {
      Swal.fire('Action interdite', 'Vous ne pouvez pas supprimer votre propre compte.', 'warning');
      return;
    }
    const { isConfirmed } = await Swal.fire({
      title: 'Supprimer ce compte ?',
      html: `Le profil de <b>${profile.full_name || profile.email}</b> sera définitivement supprimé.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '🗑️ Supprimer',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#ef4444',
    });
    if (!isConfirmed) return;

    setActLoad(profile.id);
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', profile.id);
      if (error) throw error;
      setProfiles(prev => prev.filter(p => p.id !== profile.id));
      Swal.fire({ icon: 'success', title: 'Profil supprimé !', timer: 1200, showConfirmButton: false });
    } catch (e) {
      Swal.fire('Erreur', e.message, 'error');
    } finally {
      setActLoad(null);
    }
  };

  const filtered = profiles.filter(p => {
    const q = search.toLowerCase();
    return (
      (p.full_name || '').toLowerCase().includes(q) ||
      (p.email     || '').toLowerCase().includes(q) ||
      (p.role      || '').toLowerCase().includes(q)
    );
  });

  const pendingWorkers = profiles.filter(p => p.role === 'worker' && p.is_active === false);

  return (
    <div className="animate-enter">
      {/* ── Header ── */}
      <div className="glass-container" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontWeight: 900, fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: 10 }}>
              🔐 Gestion des Utilisateurs & Équipe
            </h2>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '0.85rem' }}>
              Validez les demandes d'accès des employés, activez ou désactivez leurs permissions.
            </p>
          </div>
          <button
            className="btn-secondary"
            onClick={fetchProfiles}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px' }}
          >
            <RefreshCw size={16} /> Actualiser
          </button>
        </div>

        {/* Stats rapides */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginTop: 18 }}>
          {[
            { label: 'Total', value: profiles.length, color: '#4f46e5', icon: '👥' },
            { label: 'Directeurs', value: profiles.filter(p => p.role === 'admin').length, color: '#7c3aed', icon: '🛡️' },
            { label: 'Employés', value: profiles.filter(p => p.role === 'worker').length, color: '#0ea5e9', icon: '👷' },
            { label: 'En attente', value: pendingWorkers.length, color: '#f59e0b', icon: '⏳' },
          ].map(s => (
            <div key={s.label} style={{ padding: '12px 16px', background: `${s.color}12`, borderRadius: 14, borderLeft: `4px solid ${s.color}`, textAlign: 'center' }}>
              <div style={{ fontSize: '1.4rem' }}>{s.icon}</div>
              <div style={{ fontWeight: 900, fontSize: '1.3rem', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 700 }}>{s.label.toUpperCase()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bannière Alertes Demandes en Attente ── */}
      {pendingWorkers.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #fef3c7, #fffbeb)',
          border: '1.5px solid #f59e0b',
          borderRadius: 16,
          padding: '14px 18px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          color: '#92400e',
          boxShadow: '0 4px 16px rgba(245, 158, 11, 0.15)'
        }}>
          <span style={{ fontSize: '1.6rem' }}>🔔</span>
          <div style={{ flex: 1 }}>
            <strong style={{ fontSize: '0.95rem', display: 'block' }}>
              {pendingWorkers.length} employé(s) ont demandé à rejoindre votre usine !
            </strong>
            <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>
              Cliquez sur le bouton vert <strong>"Activer"</strong> pour valider leur compte et leur donner accès.
            </span>
          </div>
        </div>
      )}

      {/* ── Recherche ── */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom, email ou rôle..."
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '11px 14px 11px 40px',
            border: '1.5px solid var(--card-border)',
            borderRadius: 14, background: 'var(--card)',
            color: 'var(--text)', fontSize: '0.9rem',
          }}
        />
      </div>

      {/* ── Table des utilisateurs ── */}
      <div className="glass-container" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
            <p style={{ marginTop: 12 }}>Chargement des utilisateurs...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>👥</div>
            <p style={{ fontWeight: 700 }}>Aucun utilisateur trouvé.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead>
                <tr style={{ background: 'var(--card-border)' }}>
                  {['Utilisateur', 'Email', 'Rôle', 'Statut', 'Depuis', 'Actions'].map(h => (
                    <th key={h} style={{
                      padding: '12px 16px', textAlign: 'left',
                      fontSize: '0.75rem', fontWeight: 800, color: 'var(--muted)',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((profile, idx) => {
                  const isMe = profile.id === session?.user?.id;
                  const busy = actionLoading === profile.id;
                  return (
                    <tr
                      key={profile.id}
                      style={{
                        borderTop: '1px solid var(--card-border)',
                        background: idx % 2 === 0 ? 'var(--card)' : 'transparent',
                        opacity: busy ? 0.6 : 1,
                        transition: 'opacity 0.2s',
                      }}
                    >
                      {/* Utilisateur */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {profile.avatar_url ? (
                            <img
                              src={profile.avatar_url}
                              alt=""
                              style={{
                                width: 38, height: 38, borderRadius: '50%',
                                objectFit: 'cover', flexShrink: 0,
                                border: '1.5px solid var(--primary)',
                              }}
                            />
                          ) : (
                            <div style={{
                              width: 38, height: 38, borderRadius: '50%',
                              background: profile.role === 'admin'
                                ? 'linear-gradient(135deg,#4f46e5,#7c3aed)'
                                : 'linear-gradient(135deg,#0ea5e9,#06b6d4)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: 'white', fontWeight: 900, fontSize: '1rem',
                              flexShrink: 0,
                            }}>
                              {(profile.full_name || profile.email || 'U')[0].toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text)' }}>
                              {profile.full_name || '—'}
                              {isMe && (
                                <span style={{ marginLeft: 6, fontSize: '0.68rem', background: '#fef9c3', color: '#854d0e', padding: '2px 7px', borderRadius: 8, fontWeight: 700 }}>
                                  Vous
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      </td>

                      {/* Email */}
                      <td style={{ padding: '14px 16px', fontSize: '0.82rem', color: 'var(--muted)' }}>
                        {profile.email || '—'}
                      </td>

                      {/* Rôle */}
                      <td style={{ padding: '14px 16px' }}>
                        <RoleBadge role={profile.role} />
                      </td>

                      {/* Statut */}
                      <td style={{ padding: '14px 16px' }}>
                        <StatusBadge active={profile.is_active !== false} />
                      </td>

                      {/* Date */}
                      <td style={{ padding: '14px 16px', fontSize: '0.8rem', color: 'var(--muted)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Clock size={12} />
                          {profile.created_at
                            ? new Date(profile.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '—'}
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 16px' }}>
                        {isMe ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontStyle: 'italic' }}>—</span>
                        ) : (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>

                            {/* Changer rôle */}
                            <button
                              onClick={() => toggleRole(profile)}
                              disabled={busy}
                              title={profile.role === 'admin' ? 'Rétrograder en Employé' : 'Promouvoir en Directeur'}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                padding: '6px 12px', borderRadius: 10, border: 'none',
                                cursor: busy ? 'not-allowed' : 'pointer',
                                fontSize: '0.78rem', fontWeight: 700,
                                background: profile.role === 'admin' ? '#fef3c7' : '#ede9fe',
                                color: profile.role === 'admin' ? '#92400e' : '#5b21b6',
                                transition: 'all 0.2s',
                              }}
                            >
                              <Shield size={13} />
                              {profile.role === 'admin' ? 'Employé' : 'Directeur'}
                            </button>

                            {/* Activer / Désactiver */}
                            <button
                              onClick={() => toggleActive(profile)}
                              disabled={busy}
                              title={profile.is_active !== false ? 'Désactiver le compte' : 'Activer le compte'}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                padding: '6px 12px', borderRadius: 10, border: 'none',
                                cursor: busy ? 'not-allowed' : 'pointer',
                                fontSize: '0.78rem', fontWeight: 700,
                                background: profile.is_active !== false ? '#fee2e2' : '#dcfce7',
                                color: profile.is_active !== false ? '#b91c1c' : '#15803d',
                                transition: 'all 0.2s',
                              }}
                            >
                              {profile.is_active !== false ? <UserX size={13} /> : <UserCheck size={13} />}
                              {profile.is_active !== false ? 'Désactiver' : 'Activer'}
                            </button>

                            {/* Supprimer */}
                            <button
                              onClick={() => deleteProfile(profile)}
                              disabled={busy}
                              title="Supprimer ce profil"
                              style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                padding: '6px 12px', borderRadius: 10, border: 'none',
                                cursor: busy ? 'not-allowed' : 'pointer',
                                fontSize: '0.78rem', fontWeight: 700,
                                background: '#fee2e2', color: '#b91c1c',
                                transition: 'all 0.2s',
                              }}
                            >
                              <Trash2 size={13} />
                              Supprimer
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
