import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { Truck, Plus, Search, Trash2, Edit2, Phone, Mail, DollarSign, Layers, CheckCircle } from 'lucide-react';
import Swal from 'sweetalert2';
import { format } from 'date-fns';

export default function AchatsModule({ session, theme, companyId }) {
  const targetUid = companyId || session?.user?.id;
  const [activeTab, setActiveTab] = useState('achats'); // 'achats' | 'fournisseurs'
  const [achats, setAchats] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [matieres, setMatieres] = useState([]);
  const [emballages, setEmballages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Achat modal
  const [isAchatModal, setIsAchatModal] = useState(false);
  const [achatForm, setAchatForm] = useState({
    fournisseur_id: '',
    fournisseur_nom: '',
    article_nom: '',
    type_article: 'matiere',
    matiere_id: '',
    emballage_id: '',
    quantite: 1,
    prix_unitaire: 1,
    est_paye: true,
    mode_paiement: 'espèces',
    num_bon: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    notes: ''
  });

  // Fournisseur modal
  const [isFournModal, setIsFournModal] = useState(false);
  const [fournForm, setFournForm] = useState({ nom: '', tel: '', email: '', adresse: '', notes: '' });
  const [editingFourn, setEditingFourn] = useState(null);

  useEffect(() => {
    fetchData();
  }, [session, targetUid]);

  const fetchData = async () => {
    if (!session || !targetUid) return;
    setLoading(true);
    try {
      const [aRes, fRes, mRes, eRes] = await Promise.all([
        supabase.from('achats').select('*').eq('user_id', targetUid).order('date', { ascending: false }),
        supabase.from('fournisseurs').select('*').eq('user_id', targetUid).order('nom'),
        supabase.from('matieres_premieres').select('*').eq('user_id', targetUid).order('nom'),
        supabase.from('emballages').select('*').eq('user_id', targetUid).order('nom')
      ]);

      setAchats(aRes.data || []);
      setFournisseurs(fRes.data || []);
      setMatieres(mRes.data || []);
      setEmballages(eRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredAchats = useMemo(() => {
    const q = search.toLowerCase();
    return achats.filter(a => 
      (a.nom && a.nom.toLowerCase().includes(q)) || 
      (a.article_nom && a.article_nom.toLowerCase().includes(q)) ||
      (a.fournisseur_nom && a.fournisseur_nom.toLowerCase().includes(q))
    );
  }, [achats, search]);

  const stats = useMemo(() => {
    const totalAchats = achats.reduce((s, a) => s + (a.total_prix || a.prix * a.quantite || 0), 0);
    const countAchats = achats.length;
    const countFournisseurs = fournisseurs.length;
    return { totalAchats, countAchats, countFournisseurs };
  }, [achats, fournisseurs]);

  const handleSaveAchat = async (e) => {
    e.preventDefault();
    const articleName = achatForm.article_nom || 'Article Acheté';
    const totalCalc = (+achatForm.quantite) * (+achatForm.prix_unitaire);

    try {
      const payload = {
        user_id: targetUid,
        nom: articleName, // compatibility with old schema
        article_nom: articleName,
        fournisseur_id: achatForm.fournisseur_id || null,
        fournisseur_nom: achatForm.fournisseur_nom || '',
        quantite: +achatForm.quantite,
        prix: +achatForm.prix_unitaire, // compatibility with old schema
        prix_unitaire: +achatForm.prix_unitaire,
        type_article: achatForm.type_article,
        matiere_id: achatForm.matiere_id || null,
        emballage_id: achatForm.emballage_id || null,
        est_paye: achatForm.est_paye,
        mode_paiement: achatForm.mode_paiement,
        num_bon: achatForm.num_bon,
        date: achatForm.date,
        notes: achatForm.notes
      };

      const { error } = await supabase.from('achats').insert([payload]);
      if (error) {
        // Fallback to original schema
        const safePayload = {
          user_id: targetUid,
          nom: articleName,
          quantite: +achatForm.quantite,
          prix: +achatForm.prix_unitaire,
          date: achatForm.date
        };
        await supabase.from('achats').insert([safePayload]);
      }

      // Automatically update stock of material or packaging
      if (achatForm.type_article === 'matiere' && achatForm.matiere_id) {
        const mat = matieres.find(m => m.id === achatForm.matiere_id);
        if (mat) {
          const newQty = (+mat.stock_qty || 0) + (+achatForm.quantite);
          await supabase.from('matieres_premieres').update({ stock_qty: newQty }).eq('id', mat.id);
        }
      } else if (achatForm.type_article === 'emballage' && achatForm.emballage_id) {
        const emb = emballages.find(e => e.id === achatForm.emballage_id);
        if (emb) {
          const newQty = (+emb.stock_qty || 0) + (+achatForm.quantite);
          await supabase.from('emballages').update({ stock_qty: newQty }).eq('id', emb.id);
        }
      }

      // If paid, register into caisse
      if (achatForm.est_paye) {
        try {
          await supabase.from('caisse').insert([{
            user_id: targetUid,
            type: 'sortie',
            categorie: 'achat',
            montant: totalCalc,
            description: `Achat ${articleName} (${achatForm.fournisseur_nom || 'Fournisseur'})`,
            date: achatForm.date
          }]);
        } catch {}
      }

      Swal.fire({ icon: 'success', title: 'Achat Enregistré !', timer: 1000, showConfirmButton: false });
      setIsAchatModal(false);
      fetchData();
    } catch (err) {
      Swal.fire('Erreur', err.message, 'error');
    }
  };

  const handleSaveFournisseur = async (e) => {
    e.preventDefault();
    if (!fournForm.nom) return;

    try {
      if (editingFourn) {
        await supabase.from('fournisseurs').update(fournForm).eq('id', editingFourn.id);
        Swal.fire({ icon: 'success', title: 'Fournisseur mis à jour', timer: 900, showConfirmButton: false });
      } else {
        const { error } = await supabase.from('fournisseurs').insert([{ ...fournForm, user_id: targetUid }]);
        if (error) {
          setFournisseurs(prev => [...prev, { ...fournForm, id: Date.now().toString() }]);
        }
        Swal.fire({ icon: 'success', title: 'Fournisseur ajouté', timer: 900, showConfirmButton: false });
      }
      setIsFournModal(false);
      setEditingFourn(null);
      setFournForm({ nom: '', tel: '', email: '', adresse: '', notes: '' });
      fetchData();
    } catch (err) {
      Swal.fire('Info', err.message, 'info');
      setIsFournModal(false);
    }
  };

  const handleDeleteAchat = async (id) => {
    const res = await Swal.fire({
      title: 'Supprimer cet achat ?',
      text: 'Cette action est irréversible !',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonText: 'Annuler',
      confirmButtonText: 'Oui, supprimer'
    });
    if (res.isConfirmed) {
      try {
        const { error } = await supabase.from('achats').delete().eq('id', id);
        if (error) throw error;
        setAchats(prev => prev.filter(a => a.id !== id));
        Swal.fire({ icon: 'success', title: 'Achat supprimé !', timer: 800, showConfirmButton: false });
        fetchData();
      } catch (err) {
        Swal.fire('Erreur', 'Impossible de supprimer: ' + err.message, 'error');
      }
    }
  };

  return (
    <div className="animate-enter">
      {/* Top Stats */}
      <div className="stats-grid">
        <div className="stat-card" style={{ borderLeft: '5px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#f59e0b' }}>{stats.totalAchats.toFixed(0)} DA</div>
              <div className="stat-label">Total Dépenses Achats</div>
            </div>
            <Truck color="#f59e0b" size={28} />
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '5px solid #4f46e5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#4f46e5' }}>{stats.countAchats}</div>
              <div className="stat-label">Bons d'Achat Réalisés</div>
            </div>
            <Layers color="#4f46e5" size={28} />
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '5px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#10b981' }}>{stats.countFournisseurs}</div>
              <div className="stat-label">Fournisseurs Actifs</div>
            </div>
            <CheckCircle color="#10b981" size={28} />
          </div>
        </div>
      </div>

      {/* Main glass card */}
      <div className="glass-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div className="module-tabs" style={{ margin: 0 }}>
            <button 
              className={`module-tab ${activeTab === 'achats' ? 'active' : ''}`}
              onClick={() => setActiveTab('achats')}
            >
              🚚 Historique des Achats ({achats.length})
            </button>
            <button 
              className={`module-tab ${activeTab === 'fournisseurs' ? 'active' : ''}`}
              onClick={() => setActiveTab('fournisseurs')}
            >
              🏭 Fournisseurs Partenaires ({fournisseurs.length})
            </button>
          </div>

          {activeTab === 'achats' ? (
            <button className="btn-primary" onClick={() => setIsAchatModal(true)}>
              <Plus size={16} /> Nouvel Achat
            </button>
          ) : (
            <button className="btn-primary" onClick={() => {
              setEditingFourn(null);
              setFournForm({ nom: '', tel: '', email: '', adresse: '', notes: '' });
              setIsFournModal(true);
            }}>
              <Plus size={16} /> Nouveau Fournisseur
            </button>
          )}
        </div>

        {/* TAB 1: Achats */}
        {activeTab === 'achats' && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div className="search-bar">
                <Search size={18} color="var(--muted)" />
                <input 
                  type="text" 
                  placeholder="Rechercher par article ou fournisseur..." 
                  value={search} 
                  onChange={e => setSearch(e.target.value)} 
                />
              </div>
            </div>

            <div className="table-wrapper">
              {loading ? (
                <p style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>Chargement des achats...</p>
              ) : filteredAchats.length === 0 ? (
                <div className="empty-state">
                  <Truck size={40} />
                  <p>Aucun achat enregistré</p>
                  <small>Cliquez sur "Nouvel Achat" pour enregistrer une facture fournisseur.</small>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Article Acheté</th>
                      <th>Fournisseur</th>
                      <th>Quantité</th>
                      <th>Prix Unit.</th>
                      <th>Total</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAchats.map(a => {
                      const total = a.total_prix || (a.prix * a.quantite);
                      return (
                        <tr key={a.id}>
                          <td style={{ fontSize: '0.82rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{a.date}</td>
                          <td>
                            <strong>{a.article_nom || a.nom}</strong>
                            {a.num_bon && <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Bon: {a.num_bon}</div>}
                          </td>
                          <td>{a.fournisseur_nom || 'Fournisseur Général'}</td>
                          <td>{a.quantite}</td>
                          <td>{(+a.prix_unitaire || +a.prix || 0).toFixed(2)} DA</td>
                          <td>
                            <strong style={{ color: '#f59e0b' }}>{total.toFixed(0)} DA</strong>
                          </td>
                          <td>
                            <button className="icon-btn" title="Supprimer" style={{ color: '#ef4444' }} onClick={() => handleDeleteAchat(a.id)}>
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

        {/* TAB 2: Fournisseurs */}
        {activeTab === 'fournisseurs' && (
          <div className="table-wrapper">
            {fournisseurs.length === 0 ? (
              <div className="empty-state">
                <Truck size={40} />
                <p>Aucun fournisseur enregistré</p>
                <small>Ajoutez vos fournisseurs pour suivre vos approvisionnements et coordonnées.</small>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nom Fournisseur</th>
                    <th>Téléphone</th>
                    <th>Email</th>
                    <th>Adresse</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {fournisseurs.map(f => (
                    <tr key={f.id}>
                      <td><strong>{f.nom}</strong></td>
                      <td>
                        {f.tel ? (
                          <a href={`tel:${f.tel}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                            {f.tel}
                          </a>
                        ) : '—'}
                      </td>
                      <td>{f.email || '—'}</td>
                      <td>{f.adresse || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="icon-btn" title="Modifier" onClick={() => {
                            setEditingFourn(f);
                            setFournForm({ nom: f.nom, tel: f.tel || '', email: f.email || '', adresse: f.adresse || '', notes: f.notes || '' });
                            setIsFournModal(true);
                          }}>
                            <Edit2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* MODAL: Nouvel Achat */}
      {isAchatModal && (
        <div className="modal-overlay" onClick={() => setIsAchatModal(false)}>
          <div className="modal-content animate-enter" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🚚 Enregistrer un Achat / Approvisionnement</h3>
              <button className="modal-close-btn" onClick={() => setIsAchatModal(false)}>×</button>
            </div>
            <form onSubmit={handleSaveAchat}>
              {/* Type d'article */}
              <div className="form-group">
                <label>Type d'Approvisionnement</label>
                <select 
                  className="form-control" 
                  value={achatForm.type_article} 
                  onChange={e => setAchatForm({ ...achatForm, type_article: e.target.value })}
                >
                  <option value="matiere">Matière Première (Chimique / Base)</option>
                  <option value="emballage">Emballage (Bouteille / Carton / Bouchon)</option>
                  <option value="autre">Autre Dépense Matériel</option>
                </select>
              </div>

              {/* Linking to Stock */}
              {achatForm.type_article === 'matiere' && matieres.length > 0 && (
                <div className="form-group">
                  <label>Lier à une Matière du Stock (Mise à jour auto)</label>
                  <select 
                    className="form-control" 
                    value={achatForm.matiere_id}
                    onChange={e => {
                      const m = matieres.find(x => x.id === e.target.value);
                      setAchatForm(f => ({
                        ...f,
                        matiere_id: e.target.value,
                        article_nom: m ? m.nom : f.article_nom,
                        prix_unitaire: m ? (m.prix_unitaire || f.prix_unitaire) : f.prix_unitaire
                      }));
                    }}
                  >
                    <option value="">-- Choisir la matière --</option>
                    {matieres.map(m => <option key={m.id} value={m.id}>{m.nom} ({m.stock_qty} {m.unite})</option>)}
                  </select>
                </div>
              )}

              {achatForm.type_article === 'emballage' && emballages.length > 0 && (
                <div className="form-group">
                  <label>Lier à un Emballage du Stock</label>
                  <select 
                    className="form-control" 
                    value={achatForm.emballage_id}
                    onChange={e => {
                      const emb = emballages.find(x => x.id === e.target.value);
                      setAchatForm(f => ({
                        ...f,
                        emballage_id: e.target.value,
                        article_nom: emb ? emb.nom : f.article_nom,
                        prix_unitaire: emb ? (emb.prix_unitaire || f.prix_unitaire) : f.prix_unitaire
                      }));
                    }}
                  >
                    <option value="">-- Choisir l'emballage --</option>
                    {emballages.map(emb => <option key={emb.id} value={emb.id}>{emb.nom} ({emb.stock_qty} {emb.unite})</option>)}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Désignation de l'Article *</label>
                <input 
                  className="form-control" 
                  required 
                  value={achatForm.article_nom} 
                  onChange={e => setAchatForm({ ...achatForm, article_nom: e.target.value })} 
                  placeholder="Ex: Bidon 5L Transparent ou Soude" 
                />
              </div>

              {/* Fournisseur */}
              <div className="form-group">
                <label>Fournisseur</label>
                <select 
                  className="form-control" 
                  value={achatForm.fournisseur_id}
                  onChange={e => {
                    const f = fournisseurs.find(x => x.id === e.target.value);
                    setAchatForm(af => ({
                      ...af,
                      fournisseur_id: e.target.value,
                      fournisseur_nom: f ? f.nom : af.fournisseur_nom
                    }));
                  }}
                >
                  <option value="">-- Choisir ou taper le nom ci-dessous --</option>
                  {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
                </select>
              </div>

              {!achatForm.fournisseur_id && (
                <div className="form-group">
                  <label>Nom Fournisseur</label>
                  <input 
                    className="form-control" 
                    value={achatForm.fournisseur_nom} 
                    onChange={e => setAchatForm({ ...achatForm, fournisseur_nom: e.target.value })} 
                    placeholder="Nom du fournisseur" 
                  />
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>Quantité Achetée *</label>
                  <input 
                    type="number" 
                    min="1" 
                    step="0.01" 
                    required 
                    className="form-control" 
                    value={achatForm.quantite} 
                    onChange={e => setAchatForm({ ...achatForm, quantite: e.target.value })} 
                  />
                </div>
                <div className="form-group">
                  <label>Prix Unitaire (DA) *</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    required 
                    className="form-control" 
                    value={achatForm.prix_unitaire} 
                    onChange={e => setAchatForm({ ...achatForm, prix_unitaire: e.target.value })} 
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Date d'Achat</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={achatForm.date} 
                    onChange={e => setAchatForm({ ...achatForm, date: e.target.value })} 
                  />
                </div>
                <div className="form-group">
                  <label>N° Bon / Facture</label>
                  <input 
                    className="form-control" 
                    value={achatForm.num_bon} 
                    onChange={e => setAchatForm({ ...achatForm, num_bon: e.target.value })} 
                    placeholder="BL-XXXX" 
                  />
                </div>
              </div>

              {/* Total preview */}
              <div style={{ background: 'rgba(245, 158, 11, 0.08)', borderRadius: 12, padding: 12, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '1.1rem', color: '#d97706' }}>
                  <span>Montant Total :</span>
                  <span>{((+achatForm.quantite || 0) * (+achatForm.prix_unitaire || 0)).toFixed(2)} DA</span>
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', padding: 14 }}>
                Enregistrer l'Achat et Mettre à Jour le Stock
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Fournisseur */}
      {isFournModal && (
        <div className="modal-overlay" onClick={() => setIsFournModal(false)}>
          <div className="modal-content animate-enter" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingFourn ? 'Modifier Fournisseur' : 'Nouveau Fournisseur'}</h3>
              <button className="modal-close-btn" onClick={() => setIsFournModal(false)}>×</button>
            </div>
            <form onSubmit={handleSaveFournisseur}>
              <div className="form-group">
                <label>Nom Société / Fournisseur *</label>
                <input 
                  className="form-control" 
                  required 
                  value={fournForm.nom} 
                  onChange={e => setFournForm({ ...fournForm, nom: e.target.value })} 
                  placeholder="Ex: Plastique Nord SARL" 
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Téléphone</label>
                  <input 
                    className="form-control" 
                    value={fournForm.tel} 
                    onChange={e => setFournForm({ ...fournForm, tel: e.target.value })} 
                    placeholder="06XXXXXXXX" 
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input 
                    type="email" 
                    className="form-control" 
                    value={fournForm.email} 
                    onChange={e => setFournForm({ ...fournForm, email: e.target.value })} 
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Adresse</label>
                <input 
                  className="form-control" 
                  value={fournForm.adresse} 
                  onChange={e => setFournForm({ ...fournForm, adresse: e.target.value })} 
                />
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%', padding: 14 }}>
                Enregistrer le Fournisseur
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
