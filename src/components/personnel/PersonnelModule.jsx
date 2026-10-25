import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { 
  UserCheck, Plus, DollarSign, Calendar, Phone, Award, Trash2, Edit2, 
  CheckCircle, Clock, MapPin, Mail, Shield, UserX, AlertCircle, ShoppingBag, Eye, X
} from 'lucide-react';
import Swal from 'sweetalert2';
import { format } from 'date-fns';

export default function PersonnelModule({ session, theme, companyId }) {
  const targetUid = companyId || session?.user?.id;
  const [activeTab, setActiveTab] = useState('equipe'); // 'equipe' | 'salaires'
  const [profiles, setProfiles] = useState([]);
  const [salaires, setSalaires] = useState([]);
  const [ventes, setVentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmpDetail, setSelectedEmpDetail] = useState(null);

  // Modal Salaire
  const [isSalModalOpen, setIsSalModalOpen] = useState(false);
  const [salForm, setSalForm] = useState({
    employe_id: '',
    employe_nom: '',
    montant: '',
    mois: format(new Date(), 'yyyy-MM'),
    statut: 'paye',
    date_paiement: format(new Date(), 'yyyy-MM-dd'),
    notes: ''
  });

  const fetchData = useCallback(async () => {
    if (!session || !targetUid) return;
    setLoading(true);
    try {
      const [profRes, salRes, ventRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('salaires').select('*').eq('user_id', targetUid).order('date_paiement', { ascending: false }),
        supabase.from('ventes').select('*').eq('user_id', targetUid).order('date', { ascending: false })
      ]);

      setProfiles(profRes.data || []);
      setSalaires(salRes.data || []);
      setVentes(ventRes.data || []);
    } catch (e) {
      console.error('Erreur chargement personnel:', e);
    } finally {
      setLoading(false);
    }
  }, [session, targetUid]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtrer uniquement les employés rattachés à ce Directeur
  const workers = useMemo(() => {
    return profiles.filter(p => p.role === 'worker' && (p.director_id === targetUid || !p.director_id));
  }, [profiles, targetUid]);

  // Calcul de l'activité pour chaque employé (Chno dar)
  const workerStats = useMemo(() => {
    const map = {};
    workers.forEach(w => {
      // Ventes par cet employé (par user_id ou correspondance de nom)
      const empVentes = ventes.filter(v => v.user_id === w.id || (v.client_nom && v.client_nom.includes(w.full_name)));
      const nbVentes = empVentes.length;
      const totalCA = empVentes.reduce((sum, v) => sum + (v.total_prix || v.prix * v.quantite || 0), 0);
      const lastAction = empVentes[0]?.date || w.created_at || null;
      map[w.id] = { nbVentes, totalCA, lastAction };
    });
    return map;
  }, [workers, ventes]);

  // Stats globales
  const stats = useMemo(() => {
    const total = workers.length;
    const actifs = workers.filter(w => w.is_active !== false).length;
    const enAttente = workers.filter(w => w.is_active === false).length;
    const totalSalaires = salaires.filter(s => s.statut === 'paye').reduce((s, x) => s + (+x.montant || 0), 0);
    return { total, actifs, enAttente, totalSalaires };
  }, [workers, salaires]);

  // Activer / Valider un employé
  const handleValidateWorker = async (worker) => {
    const { isConfirmed } = await Swal.fire({
      title: 'Valider cet employé ?',
      html: `Vous allez autoriser <b>${worker.full_name || worker.email}</b> à accéder à la plateforme.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '✅ Oui, Valider l\'accès',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#10b981',
    });

    if (!isConfirmed) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: true })
        .eq('id', worker.id);

      if (error) throw error;

      setProfiles(prev => prev.map(p => p.id === worker.id ? { ...p, is_active: true } : p));
      Swal.fire({ icon: 'success', title: 'Employé validé avec succès !', timer: 1200, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Erreur', err.message, 'error');
    }
  };

  // Suspendre / Bloquer un employé
  const handleSuspendWorker = async (worker) => {
    const { isConfirmed } = await Swal.fire({
      title: 'Suspendre cet employé ?',
      html: `<b>${worker.full_name || worker.email}</b> sera bloqué et ne pourra plus se connecter.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '🚫 Suspendre',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#f59e0b',
    });

    if (!isConfirmed) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: false })
        .eq('id', worker.id);

      if (error) throw error;

      setProfiles(prev => prev.map(p => p.id === worker.id ? { ...p, is_active: false } : p));
      Swal.fire({ icon: 'success', title: 'Employé suspendu', timer: 1200, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Erreur', err.message, 'error');
    }
  };

  // Supprimer un employé
  const handleDeleteWorker = async (worker) => {
    const { isConfirmed } = await Swal.fire({
      title: 'Supprimer ce profil ?',
      text: 'Cette action est irréversible.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '🗑️ Supprimer',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#ef4444',
    });

    if (!isConfirmed) return;

    try {
      const { error } = await supabase.from('profiles').delete().eq('id', worker.id);
      if (error) throw error;
      setProfiles(prev => prev.filter(p => p.id !== worker.id));
      Swal.fire({ icon: 'success', title: 'Profil supprimé', timer: 1000, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Erreur', err.message, 'error');
    }
  };

  // Enregistrer Salaire
  const handlePaySalaire = async (e) => {
    e.preventDefault();
    if (!salForm.employe_nom || !salForm.montant) return;

    try {
      const payload = {
        user_id: targetUid,
        employe_id: salForm.employe_id || null,
        employe_nom: salForm.employe_nom,
        montant: +salForm.montant,
        mois: salForm.mois,
        statut: salForm.statut,
        date_paiement: salForm.date_paiement,
        notes: salForm.notes
      };

      const { error } = await supabase.from('salaires').insert([payload]);
      if (error) {
        setSalaires(prev => [{ ...payload, id: Date.now().toString() }, ...prev]);
      }

      if (salForm.statut === 'paye') {
        try {
          await supabase.from('caisse').insert([{
            user_id: targetUid,
            type: 'sortie',
            categorie: 'salaire',
            montant: +salForm.montant,
            description: `Salaire ${salForm.mois} - ${salForm.employe_nom}`,
            date: salForm.date_paiement
          }]);
        } catch {}
      }

      Swal.fire({ icon: 'success', title: 'Paiement Salaire Enregistré', timer: 1000, showConfirmButton: false });
      setIsSalModalOpen(false);
      fetchData();
    } catch (err) {
      Swal.fire('Erreur', err.message, 'error');
    }
  };

  return (
    <div className="animate-enter">
      {/* ── Top Stats Cards ── */}
      <div className="stats-grid">
        <div className="stat-card" style={{ borderLeft: '5px solid #4f46e5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#4f46e5' }}>{stats.total}</div>
              <div className="stat-label">Total Employés</div>
            </div>
            <UserCheck color="#4f46e5" size={28} />
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '5px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#10b981' }}>{stats.actifs}</div>
              <div className="stat-label">Employés Actifs</div>
            </div>
            <CheckCircle color="#10b981" size={28} />
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '5px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#f59e0b' }}>{stats.enAttente}</div>
              <div className="stat-label">Demandes en Attente</div>
            </div>
            <Clock color="#f59e0b" size={28} />
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '5px solid #8b5cf6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#8b5cf6' }}>{stats.totalSalaires.toFixed(0)} DA</div>
              <div className="stat-label">Total Salaires Versés</div>
            </div>
            <DollarSign color="#8b5cf6" size={28} />
          </div>
        </div>
      </div>

      {/* ── Bannière Alertes En Attente ── */}
      {stats.enAttente > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #fef3c7, #fffbeb)',
          border: '1.5px solid #f59e0b',
          borderRadius: 18,
          padding: '16px 20px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          color: '#92400e',
          boxShadow: '0 4px 16px rgba(245, 158, 11, 0.15)'
        }}>
          <span style={{ fontSize: '1.8rem' }}>🔔</span>
          <div style={{ flex: 1 }}>
            <strong style={{ fontSize: '1rem', display: 'block' }}>
              {stats.enAttente} nouvelle(s) demande(s) d'adhésion en attente de votre validation !
            </strong>
            <span style={{ fontSize: '0.84rem', opacity: 0.9 }}>
              Consultez les fiches ci-dessous et cliquez sur <b>"Valider l'accès"</b> pour autoriser vos employés à travailler.
            </span>
          </div>
        </div>
      )}

      {/* ── Conteneur Principal ── */}
      <div className="glass-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div className="module-tabs" style={{ margin: 0 }}>
            <button 
              className={`module-tab ${activeTab === 'equipe' ? 'active' : ''}`}
              onClick={() => setActiveTab('equipe')}
            >
              👷 Équipe & Activité ({workers.length})
            </button>
            <button 
              className={`module-tab ${activeTab === 'salaires' ? 'active' : ''}`}
              onClick={() => setActiveTab('salaires')}
            >
              💵 Salaires & Fiches de Paie ({salaires.length})
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-secondary" onClick={fetchData} title="Rafraîchir">
              🔄 Actualiser
            </button>
            {activeTab === 'salaires' && (
              <button className="btn-primary" onClick={() => setIsSalModalOpen(true)}>
                <Plus size={16} /> Verser un Salaire
              </button>
            )}
          </div>
        </div>

        {/* ── TAB 1: LISTE DE L'ÉQUIPE AVEC TOUS LES DÉTAILS & CE QU'ILS ONT FAIT ── */}
        {activeTab === 'equipe' && (
          <div>
            {loading ? (
              <p style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Chargement de l'équipe...</p>
            ) : workers.length === 0 ? (
              <div className="empty-state">
                <UserCheck size={48} />
                <p style={{ fontWeight: 800, fontSize: '1.1rem', margin: '12px 0 6px' }}>Aucun employé enregistré</p>
                <small>Les employés qui s'inscrivent apparaîtront automatiquement ici avec tous leurs détails.</small>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {workers.map(w => {
                  const act = workerStats[w.id] || { nbVentes: 0, totalCA: 0 };
                  const isPending = w.is_active === false;

                  return (
                    <div 
                      key={w.id}
                      style={{
                        background: 'var(--card)',
                        border: isPending ? '2px solid #f59e0b' : '1.5px solid var(--card-border)',
                        borderRadius: 20,
                        padding: '18px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: isPending ? '0 8px 24px rgba(245, 158, 11, 0.15)' : 'var(--shadow)',
                        position: 'relative',
                        transition: 'all 0.25s'
                      }}
                    >
                      {/* En-tête de carte */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{
                              width: 46, height: 46, borderRadius: '50%',
                              background: isPending ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                              color: 'white', fontWeight: 900, fontSize: '1.15rem',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                            }}>
                              {(w.full_name || w.email || 'E')[0].toUpperCase()}
                            </div>
                            <div>
                              <strong style={{ fontSize: '1.02rem', display: 'block', color: 'var(--text)' }}>
                                {w.full_name || 'Employé'}
                              </strong>
                              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                                {w.email}
                              </span>
                            </div>
                          </div>

                          {/* Badge Statut */}
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: 14,
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            background: isPending ? '#fef3c7' : '#dcfce7',
                            color: isPending ? '#b45309' : '#15803d',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}>
                            {isPending ? '⏳ En attente' : '✅ Actif'}
                          </span>
                        </div>

                        {/* Coordonnées & Infos Personnelles */}
                        <div style={{
                          background: 'var(--bg)',
                          borderRadius: 14,
                          padding: '12px 14px',
                          margin: '12px 0',
                          fontSize: '0.8rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)' }}>
                            <Phone size={14} color="#0ea5e9" />
                            <span><strong>Tél :</strong> {w.tel || 'Non renseigné'}</span>
                            {w.tel && (
                              <a 
                                href={`https://wa.me/${w.tel.replace(/[^0-9]/g, '')}`} 
                                target="_blank" 
                                rel="noreferrer"
                                style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#10b981', fontWeight: 800, textDecoration: 'none' }}
                              >
                                💬 WhatsApp
                              </a>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)' }}>
                            <MapPin size={14} color="#ef4444" />
                            <span><strong>Adresse :</strong> {w.adresse || 'Non renseignée'}</span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)' }}>
                            <Calendar size={14} color="#8b5cf6" />
                            <span><strong>Naissance :</strong> {w.date_naissance || 'Non renseignée'}</span>
                          </div>

                          {w.director_name && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)' }}>
                              <Shield size={14} color="#4f46e5" />
                              <span><strong>Directeur :</strong> {w.director_name}</span>
                            </div>
                          )}
                        </div>

                        {/* Ce qu'il a fait (Activité / Ventes / CA) */}
                        <div style={{
                          background: 'linear-gradient(135deg, rgba(79,70,229,0.06), rgba(124,58,237,0.04))',
                          border: '1px solid rgba(79,70,229,0.12)',
                          borderRadius: 14,
                          padding: '10px 14px',
                          marginBottom: 14
                        }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <ShoppingBag size={14} /> CE QU'IL A FAIT (ACTIVITÉ) :
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 700 }}>VENTES SAISIES</div>
                              <strong style={{ fontSize: '1.05rem', color: 'var(--text)' }}>{act.nbVentes} vente(s)</strong>
                            </div>
                            <div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 700 }}>CA GÉNÉRÉ</div>
                              <strong style={{ fontSize: '1.05rem', color: '#10b981' }}>{act.totalCA.toFixed(0)} DA</strong>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 10, borderTop: '1px solid var(--card-border)' }}>
                        {isPending ? (
                          <button
                            onClick={() => handleValidateWorker(w)}
                            style={{
                              flex: 1,
                              padding: '10px 14px',
                              background: 'linear-gradient(135deg, #10b981, #059669)',
                              color: 'white',
                              border: 'none',
                              borderRadius: 12,
                              fontWeight: 800,
                              fontSize: '0.84rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                            }}
                          >
                            <CheckCircle size={15} /> Valider l'accès
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSuspendWorker(w)}
                            style={{
                              padding: '8px 12px',
                              background: '#fef3c7',
                              color: '#b45309',
                              border: 'none',
                              borderRadius: 12,
                              fontWeight: 700,
                              fontSize: '0.78rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5
                            }}
                          >
                            <UserX size={14} /> Suspendre
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setSalForm(sf => ({
                              ...sf,
                              employe_id: w.id,
                              employe_nom: w.full_name || w.email,
                              montant: ''
                            }));
                            setIsSalModalOpen(true);
                          }}
                          style={{
                            padding: '8px 12px',
                            background: '#ede9fe',
                            color: '#6d28d9',
                            border: 'none',
                            borderRadius: 12,
                            fontWeight: 700,
                            fontSize: '0.78rem',
                            cursor: 'pointer'
                          }}
                        >
                          💵 Payer
                        </button>

                        <button
                          onClick={() => setSelectedEmpDetail({ ...w, act })}
                          style={{
                            padding: '8px 10px',
                            background: 'var(--card-border)',
                            color: 'var(--text)',
                            border: 'none',
                            borderRadius: 12,
                            cursor: 'pointer'
                          }}
                          title="Voir fiche complète"
                        >
                          <Eye size={14} />
                        </button>

                        <button
                          onClick={() => handleDeleteWorker(w)}
                          style={{
                            padding: '8px 10px',
                            background: '#fee2e2',
                            color: '#ef4444',
                            border: 'none',
                            borderRadius: 12,
                            cursor: 'pointer'
                          }}
                          title="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: SALAIRES & FICHES DE PAIE ── */}
        {activeTab === 'salaires' && (
          <div className="table-wrapper">
            {salaires.length === 0 ? (
              <div className="empty-state">
                <DollarSign size={40} />
                <p>Aucun paiement de salaire enregistré</p>
                <small>Cliquez sur "Verser un Salaire" pour enregistrer les fiches de paie mensuelles.</small>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date Paiement</th>
                    <th>Employé</th>
                    <th>Mois Concerné</th>
                    <th>Montant Versé</th>
                    <th>Statut</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {salaires.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>{s.date_paiement}</td>
                      <td><strong>{s.employe_nom}</strong></td>
                      <td><span className="badge badge-purple">{s.mois}</span></td>
                      <td><strong style={{ color: '#ef4444' }}>{(+s.montant || 0).toFixed(2)} DA</strong></td>
                      <td>
                        <span className={`badge ${s.statut === 'paye' ? 'badge-success' : 'badge-warning'}`}>
                          {s.statut === 'paye' ? 'Payé' : 'En attente'}
                        </span>
                      </td>
                      <td>{s.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ── MODAL FICHE COMPLÈTE DE L'EMPLOYÉ ── */}
      {selectedEmpDetail && (
        <div className="modal-overlay" onClick={() => setSelectedEmpDetail(null)}>
          <div className="modal-content animate-enter" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                📋 Fiche Détaillée de l'Employé
              </h3>
              <button className="modal-close-btn" onClick={() => setSelectedEmpDetail(null)}>×</button>
            </div>

            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{
                width: 70, height: 70, borderRadius: '50%',
                background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                color: 'white', fontWeight: 900, fontSize: '1.8rem',
                margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {(selectedEmpDetail.full_name || 'E')[0].toUpperCase()}
              </div>
              <h3 style={{ margin: '0 0 4px', fontSize: '1.3rem' }}>{selectedEmpDetail.full_name}</h3>
              <span style={{
                display: 'inline-block',
                padding: '4px 12px',
                borderRadius: 20,
                fontSize: '0.78rem',
                fontWeight: 800,
                background: selectedEmpDetail.is_active !== false ? '#dcfce7' : '#fef3c7',
                color: selectedEmpDetail.is_active !== false ? '#15803d' : '#b45309'
              }}>
                {selectedEmpDetail.is_active !== false ? '✅ Employé Actif & Validé' : '⏳ En attente de validation'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ background: 'var(--bg)', padding: '12px 14px', borderRadius: 14 }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 800 }}>TÉLÉPHONE</span>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', marginTop: 2 }}>{selectedEmpDetail.tel || 'Non renseigné'}</div>
              </div>
              <div style={{ background: 'var(--bg)', padding: '12px 14px', borderRadius: 14 }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 800 }}>DATE DE NAISSANCE</span>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', marginTop: 2 }}>{selectedEmpDetail.date_naissance || 'Non renseignée'}</div>
              </div>
              <div style={{ background: 'var(--bg)', padding: '12px 14px', borderRadius: 14, gridColumn: 'span 2' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 800 }}>ADRESSE COMPLETE</span>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', marginTop: 2 }}>{selectedEmpDetail.adresse || 'Non renseignée'}</div>
              </div>
              <div style={{ background: 'var(--bg)', padding: '12px 14px', borderRadius: 14, gridColumn: 'span 2' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 800 }}>GMAIL / EMAIL</span>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', marginTop: 2 }}>{selectedEmpDetail.email}</div>
              </div>
            </div>

            <div style={{ background: 'rgba(79,70,229,0.06)', borderRadius: 16, padding: '14px 16px', marginBottom: 20 }}>
              <strong style={{ fontSize: '0.85rem', color: 'var(--primary)', display: 'block', marginBottom: 8 }}>
                📊 BILAN D'ACTIVITÉ :
              </strong>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>Total des ventes : <strong>{selectedEmpDetail.act?.nbVentes || 0} opération(s)</strong></div>
                <div>Chiffre généré : <strong style={{ color: '#10b981' }}>{(selectedEmpDetail.act?.totalCA || 0).toFixed(0)} DA</strong></div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              {selectedEmpDetail.is_active === false ? (
                <button
                  className="btn-primary"
                  style={{ flex: 1, background: '#10b981' }}
                  onClick={() => {
                    handleValidateWorker(selectedEmpDetail);
                    setSelectedEmpDetail(null);
                  }}
                >
                  ✅ Valider cet employé
                </button>
              ) : (
                <button
                  className="btn-secondary"
                  style={{ flex: 1, color: '#f59e0b' }}
                  onClick={() => {
                    handleSuspendWorker(selectedEmpDetail);
                    setSelectedEmpDetail(null);
                  }}
                >
                  🚫 Suspendre l'accès
                </button>
              )}
              <button className="btn-secondary" onClick={() => setSelectedEmpDetail(null)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL VERSER UN SALAIRE ── */}
      {isSalModalOpen && (
        <div className="modal-overlay" onClick={() => setIsSalModalOpen(false)}>
          <div className="modal-content animate-enter" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>💵 Verser un Salaire</h3>
              <button className="modal-close-btn" onClick={() => setIsSalModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handlePaySalaire}>
              <div className="form-group">
                <label>Employé *</label>
                <select 
                  className="form-control" 
                  value={salForm.employe_nom}
                  required
                  onChange={e => {
                    const emp = workers.find(w => (w.full_name || w.email) === e.target.value);
                    setSalForm(sf => ({
                      ...sf,
                      employe_id: emp ? emp.id : '',
                      employe_nom: e.target.value
                    }));
                  }}
                >
                  <option value="">-- Choisir un employé --</option>
                  {workers.map(w => (
                    <option key={w.id} value={w.full_name || w.email}>
                      {w.full_name || w.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Montant (DA) *</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    required 
                    className="form-control" 
                    value={salForm.montant}
                    onChange={e => setSalForm(sf => ({ ...sf, montant: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>Mois de Référence</label>
                  <input 
                    type="month" 
                    required 
                    className="form-control" 
                    value={salForm.mois}
                    onChange={e => setSalForm(sf => ({ ...sf, mois: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Date de Paiement</label>
                <input 
                  type="date" 
                  required 
                  className="form-control" 
                  value={salForm.date_paiement}
                  onChange={e => setSalForm(sf => ({ ...sf, date_paiement: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label>Notes / Primes / Retenues</label>
                <textarea 
                  className="form-control" 
                  rows="2"
                  value={salForm.notes}
                  onChange={e => setSalForm(sf => ({ ...sf, notes: e.target.value }))}
                  placeholder="Ex: Prime de rendement incluse..."
                />
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', padding: '14px', marginTop: 10 }}>
                Valider le Paiement
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
