import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { Wallet, Plus, ArrowDownRight, ArrowUpRight, DollarSign, Calendar, Filter, Trash2, TrendingUp, AlertTriangle } from 'lucide-react';
import Swal from 'sweetalert2';
import { format } from 'date-fns';

export default function CaisseModule({ session, theme }) {
  const [activeTab, setActiveTab] = useState('caisse'); // 'caisse' | 'depenses'
  const [mouvements, setMouvements] = useState([]);
  const [depenses, setDepenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all'); // 'all' | 'entree' | 'sortie'

  // Modal caisse
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    type: 'entree',
    categorie: 'autre',
    montant: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  // Modal dépense
  const [isDepModalOpen, setIsDepModalOpen] = useState(false);
  const [depForm, setDepForm] = useState({
    categorie: 'loyer',
    montant: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  useEffect(() => {
    fetchCaisseData();
  }, [session]);

  const fetchCaisseData = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [cRes, dRes] = await Promise.all([
        supabase.from('caisse').select('*').order('date', { ascending: false }),
        supabase.from('depenses').select('*').order('date', { ascending: false })
      ]);
      setMouvements(cRes.data || []);
      setDepenses(dRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredMouvements = useMemo(() => {
    if (filterType === 'all') return mouvements;
    return mouvements.filter(m => m.type === filterType);
  }, [mouvements, filterType]);

  const stats = useMemo(() => {
    const totalEntrees = mouvements.filter(m => m.type === 'entree').reduce((s, m) => s + (+m.montant || 0), 0);
    const totalSorties = mouvements.filter(m => m.type === 'sortie').reduce((s, m) => s + (+m.montant || 0), 0);
    const solde = totalEntrees - totalSorties;
    const totalDepenses = depenses.reduce((s, d) => s + (+d.montant || 0), 0);
    return { totalEntrees, totalSorties, solde, totalDepenses };
  }, [mouvements, depenses]);

  const handleSaveMouvement = async (e) => {
    e.preventDefault();
    if (!form.montant || +form.montant <= 0) return;

    try {
      const payload = {
        user_id: session.user.id,
        type: form.type,
        categorie: form.categorie,
        montant: +form.montant,
        description: form.description || 'Mouvement de caisse',
        date: form.date
      };

      const { error } = await supabase.from('caisse').insert([payload]);
      if (error) {
        setMouvements(prev => [{ ...payload, id: Date.now().toString() }, ...prev]);
      }
      Swal.fire({ icon: 'success', title: 'Mouvement Enregistré', timer: 900, showConfirmButton: false });
      setIsModalOpen(false);
      setForm({ type: 'entree', categorie: 'autre', montant: '', description: '', date: format(new Date(), 'yyyy-MM-dd') });
      fetchCaisseData();
    } catch (err) {
      Swal.fire('Erreur', err.message, 'error');
    }
  };

  const handleSaveDepense = async (e) => {
    e.preventDefault();
    if (!depForm.montant || +depForm.montant <= 0) return;

    try {
      const payload = {
        user_id: session.user.id,
        categorie: depForm.categorie,
        montant: +depForm.montant,
        description: depForm.description,
        date: depForm.date
      };

      const { error } = await supabase.from('depenses').insert([payload]);
      if (error) {
        setDepenses(prev => [{ ...payload, id: Date.now().toString() }, ...prev]);
      }

      // Automatically register sortie in caisse
      try {
        await supabase.from('caisse').insert([{
          user_id: session.user.id,
          type: 'sortie',
          categorie: 'depense',
          montant: +depForm.montant,
          description: `Dépense ${depForm.categorie}: ${depForm.description || ''}`,
          date: depForm.date
        }]);
      } catch {}

      Swal.fire({ icon: 'success', title: 'Dépense Enregistrée', timer: 900, showConfirmButton: false });
      setIsDepModalOpen(false);
      setDepForm({ categorie: 'loyer', montant: '', description: '', date: format(new Date(), 'yyyy-MM-dd') });
      fetchCaisseData();
    } catch (err) {
      Swal.fire('Erreur', err.message, 'error');
    }
  };

  const handleDeleteMouvement = async (id) => {
    const res = await Swal.fire({
      title: 'Supprimer cette ligne ?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Supprimer'
    });
    if (res.isConfirmed) {
      await supabase.from('caisse').delete().eq('id', id);
      setMouvements(prev => prev.filter(m => m.id !== id));
      Swal.fire({ icon: 'success', title: 'Supprimé', timer: 700, showConfirmButton: false });
    }
  };

  return (
    <div className="animate-enter">
      {/* Top Solde banner */}
      <div className="stats-grid">
        <div className="stat-card" style={{ borderLeft: stats.solde >= 0 ? '5px solid #10b981' : '5px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: stats.solde >= 0 ? '#10b981' : '#ef4444' }}>
                {stats.solde.toFixed(0)} DA
              </div>
              <div className="stat-label">Solde Caisse Actuel</div>
            </div>
            <Wallet color={stats.solde >= 0 ? '#10b981' : '#ef4444'} size={28} />
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '5px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#10b981' }}>{stats.totalEntrees.toFixed(0)} DA</div>
              <div className="stat-label">Total Entrées</div>
            </div>
            <ArrowDownRight color="#10b981" size={28} />
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '5px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#ef4444' }}>{stats.totalSorties.toFixed(0)} DA</div>
              <div className="stat-label">Total Sorties</div>
            </div>
            <ArrowUpRight color="#ef4444" size={28} />
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '5px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#f59e0b' }}>{stats.totalDepenses.toFixed(0)} DA</div>
              <div className="stat-label">Frais Généraux / Dépenses</div>
            </div>
            <DollarSign color="#f59e0b" size={28} />
          </div>
        </div>
      </div>

      {/* Main glass card */}
      <div className="glass-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div className="module-tabs" style={{ margin: 0 }}>
            <button 
              className={`module-tab ${activeTab === 'caisse' ? 'active' : ''}`}
              onClick={() => setActiveTab('caisse')}
            >
              💰 Journal de Caisse ({mouvements.length})
            </button>
            <button 
              className={`module-tab ${activeTab === 'depenses' ? 'active' : ''}`}
              onClick={() => setActiveTab('depenses')}
            >
              📋 Frais & Dépenses ({depenses.length})
            </button>
          </div>

          {activeTab === 'caisse' ? (
            <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
              <Plus size={16} /> Entrée / Sortie Caisse
            </button>
          ) : (
            <button className="btn-primary" onClick={() => setIsDepModalOpen(true)}>
              <Plus size={16} /> Nouvelle Dépense
            </button>
          )}
        </div>

        {/* TAB 1: Journal de Caisse */}
        {activeTab === 'caisse' && (
          <div>
            {/* Filter buttons */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[
                ['all', 'Tous les mouvements'],
                ['entree', '🟢 Entrées seules'],
                ['sortie', '🔴 Sorties seules']
              ].map(([t, l]) => (
                <button 
                  key={t}
                  className={`btn-secondary ${filterType === t ? 'btn-primary' : ''}`}
                  style={{ padding: '7px 14px', fontSize: '0.82rem' }}
                  onClick={() => setFilterType(t)}
                >
                  {l}
                </button>
              ))}
            </div>

            <div className="table-wrapper">
              {loading ? (
                <p style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>Chargement...</p>
              ) : filteredMouvements.length === 0 ? (
                <div className="empty-state">
                  <Wallet size={40} />
                  <p>Aucun mouvement de caisse</p>
                  <small>Les ventes et achats payés s'enregistrent ici automatiquement, ou ajoutez un mouvement manuel.</small>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Catégorie</th>
                      <th>Description</th>
                      <th>Montant</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMouvements.map(m => {
                      const isEntree = m.type === 'entree';
                      return (
                        <tr key={m.id}>
                          <td style={{ fontSize: '0.82rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{m.date}</td>
                          <td>
                            <span className={`badge ${isEntree ? 'badge-success' : 'badge-danger'}`}>
                              {isEntree ? '↓ Entrée' : '↑ Sortie'}
                            </span>
                          </td>
                          <td style={{ textTransform: 'capitalize', fontWeight: 700 }}>
                            {m.categorie}
                          </td>
                          <td>{m.description || '—'}</td>
                          <td>
                            <strong style={{ color: isEntree ? '#10b981' : '#ef4444', fontSize: '1rem' }}>
                              {isEntree ? '+' : '-'}{(+m.montant || 0).toFixed(2)} DA
                            </strong>
                          </td>
                          <td>
                            <button className="icon-btn" title="Supprimer" style={{ color: '#ef4444' }} onClick={() => handleDeleteMouvement(m.id)}>
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Frais & Dépenses */}
        {activeTab === 'depenses' && (
          <div className="table-wrapper">
            {depenses.length === 0 ? (
              <div className="empty-state">
                <DollarSign size={40} />
                <p>Aucune dépense enregistrée</p>
                <small>Enregistrez vos frais généraux (loyer, factures électricité, carburant...).</small>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Catégorie</th>
                    <th>Description</th>
                    <th>Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {depenses.map(d => (
                    <tr key={d.id}>
                      <td style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>{d.date}</td>
                      <td>
                        <span className="badge badge-warning" style={{ textTransform: 'capitalize' }}>
                          {d.categorie}
                        </span>
                      </td>
                      <td>{d.description || '—'}</td>
                      <td>
                        <strong style={{ color: '#ef4444' }}>{(+d.montant || 0).toFixed(2)} DA</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* MODAL: Mouvement Caisse */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content animate-enter" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>💰 Nouveau Mouvement de Caisse</h3>
              <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSaveMouvement}>
              <div className="form-group">
                <label>Type de Flux *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button 
                    type="button" 
                    className={`btn-secondary ${form.type === 'entree' ? 'btn-primary' : ''}`}
                    style={{ background: form.type === 'entree' ? '#10b981' : '' }}
                    onClick={() => setForm({ ...form, type: 'entree' })}
                  >
                    🟢 Entrée (Encaissement)
                  </button>
                  <button 
                    type="button" 
                    className={`btn-secondary ${form.type === 'sortie' ? 'btn-primary' : ''}`}
                    style={{ background: form.type === 'sortie' ? '#ef4444' : '' }}
                    onClick={() => setForm({ ...form, type: 'sortie' })}
                  >
                    🔴 Sortie (Décaissement)
                  </button>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Montant (DA) *</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    required 
                    className="form-control" 
                    value={form.montant} 
                    onChange={e => setForm({ ...form, montant: e.target.value })} 
                    placeholder="Ex: 5000" 
                  />
                </div>
                <div className="form-group">
                  <label>Date</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={form.date} 
                    onChange={e => setForm({ ...form, date: e.target.value })} 
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Catégorie</label>
                <select className="form-control" value={form.categorie} onChange={e => setForm({ ...form, categorie: e.target.value })}>
                  {form.type === 'entree' ? (
                    <>
                      <option value="vente">Vente</option>
                      <option value="reglement_client">Règlement dette client</option>
                      <option value="apport">Apport personnel</option>
                      <option value="autre">Autre entrée</option>
                    </>
                  ) : (
                    <>
                      <option value="achat">Achat matière / emballage</option>
                      <option value="salaire">Paiement salaire</option>
                      <option value="depense">Frais général</option>
                      <option value="loyer">Loyer</option>
                      <option value="transport">Transport / Carburant</option>
                      <option value="autre">Autre sortie</option>
                    </>
                  )}
                </select>
              </div>

              <div className="form-group">
                <label>Description / Motif</label>
                <input 
                  className="form-control" 
                  value={form.description} 
                  onChange={e => setForm({ ...form, description: e.target.value })} 
                  placeholder="Motif du règlement..." 
                />
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', padding: 14 }}>
                Enregistrer dans la Caisse
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Nouvelle Dépense */}
      {isDepModalOpen && (
        <div className="modal-overlay" onClick={() => setIsDepModalOpen(false)}>
          <div className="modal-content animate-enter" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📋 Enregistrer une Dépense Générale</h3>
              <button className="modal-close-btn" onClick={() => setIsDepModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSaveDepense}>
              <div className="form-group">
                <label>Catégorie de Dépense</label>
                <select className="form-control" value={depForm.categorie} onChange={e => setDepForm({ ...depForm, categorie: e.target.value })}>
                  <option value="loyer">Loyer local / usine</option>
                  <option value="electricite">Électricité & Gaz</option>
                  <option value="eau">Eau</option>
                  <option value="transport">Carburant & Transport</option>
                  <option value="maintenance">Maintenance machines & matériel</option>
                  <option value="fournitures">Fournitures de bureau</option>
                  <option value="publicite">Publicité & Marketing</option>
                  <option value="autre">Autre charge</option>
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
                    value={depForm.montant} 
                    onChange={e => setDepForm({ ...depForm, montant: e.target.value })} 
                  />
                </div>
                <div className="form-group">
                  <label>Date</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={depForm.date} 
                    onChange={e => setDepForm({ ...depForm, date: e.target.value })} 
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Détails / Justificatif</label>
                <input 
                  className="form-control" 
                  value={depForm.description} 
                  onChange={e => setDepForm({ ...depForm, description: e.target.value })} 
                  placeholder="Ex: Facture Sonelgaz n°124..." 
                />
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', padding: 14 }}>
                Valider la Dépense
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
