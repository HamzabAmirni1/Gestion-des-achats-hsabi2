import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { Factory, Plus, Beaker, Play, CheckCircle, Trash2, Calendar, DollarSign, Layers, Box, Hash, AlertTriangle } from 'lucide-react';
import Swal from 'sweetalert2';
import { format } from 'date-fns';

export default function ProductionModule({ session, theme, companyId }) {
  const targetUid = companyId || session?.user?.id;
  const [activeTab, setActiveTab] = useState('productions');
  const [productions, setProductions] = useState([]);
  const [recettes, setRecettes] = useState([]);
  const [produits, setProduits] = useState([]);
  const [matieres, setMatieres] = useState([]);
  const [emballages, setEmballages] = useState([]);
  const [loading, setLoading] = useState(true);

  // Production modal state
  const [isProdModalOpen, setIsProdModalOpen] = useState(false);
  const [prodForm, setProdForm] = useState({
    produit_id: '',
    produit_nom: '',
    numero_lot: '',
    quantite_produite: 100,
    emballage_id: '',
    perte_qty: 0,
    cout_matiere: 0,
    cout_emballage: 0,
    cout_main_oeuvre: 0,
    notes: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  // Recette modal state
  const [isRecetteModalOpen, setIsRecetteModalOpen] = useState(false);
  const [recetteForm, setRecetteForm] = useState({
    nom: '',
    produit_id: '',
    description: '',
    rendement: 100,
  });

  // Filtre lot
  const [lotSearch, setLotSearch] = useState('');

  useEffect(() => { fetchData(); }, [session, targetUid]);

  const fetchData = async () => {
    if (!session || !targetUid) return;
    setLoading(true);
    try {
      const [prodRes, recRes, pRes, mRes, eRes] = await Promise.all([
        supabase.from('productions').select('*').eq('user_id', targetUid).order('date', { ascending: false }),
        supabase.from('recettes').select('*').eq('user_id', targetUid).order('nom'),
        supabase.from('products').select('*').eq('user_id', targetUid).order('nom'),
        supabase.from('matieres_premieres').select('*').eq('user_id', targetUid).order('nom'),
        supabase.from('emballages').select('*').eq('user_id', targetUid).order('nom')
      ]);
      setProductions(prodRes.data || []);
      setRecettes(recRes.data || []);
      setProduits(pRes.data || []);
      setMatieres(mRes.data || []);
      setEmballages(eRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Auto-generate lot number
  const generateLotNumber = () => {
    const d = new Date();
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd2 = String(d.getDate()).padStart(2, '0');
    const seq = String(productions.length + 1).padStart(3, '0');
    return `LOT-${yy}${mm}${dd2}-${seq}`;
  };

  const handleLaunchProduction = async (e) => {
    e.preventDefault();
    if (!prodForm.produit_nom || !prodForm.quantite_produite) return;

    const totalCost = (+prodForm.cout_matiere || 0) + (+prodForm.cout_emballage || 0) + (+prodForm.cout_main_oeuvre || 0);
    const lotNum = prodForm.numero_lot || generateLotNumber();

    try {
      const payload = {
        user_id: targetUid,
        produit_id: prodForm.produit_id || null,
        produit_nom: prodForm.produit_nom,
        numero_lot: lotNum,
        quantite_produite: +prodForm.quantite_produite,
        cout_matiere: +prodForm.cout_matiere || 0,
        cout_emballage: +prodForm.cout_emballage || 0,
        cout_main_oeuvre: +prodForm.cout_main_oeuvre || 0,
        cout_total: totalCost,
        notes: prodForm.notes,
        date: prodForm.date
      };

      const { data, error } = await supabase.from('productions').insert([payload]).select();

      if (error) {
        // Si la colonne numero_lot n'existe pas, réessayer sans
        if (error.message && error.message.includes('numero_lot')) {
          const payloadFallback = { ...payload };
          delete payloadFallback.numero_lot;
          const { error: err2 } = await supabase.from('productions').insert([payloadFallback]).select();
          if (err2) {
            setProductions(prev => [{ ...payloadFallback, id: Date.now().toString() }, ...prev]);
          }
        } else {
          setProductions(prev => [{ ...payload, id: Date.now().toString() }, ...prev]);
        }
      } else {
        // 1. Augmenter le stock de produits finis
        if (prodForm.produit_id) {
          const currentProd = produits.find(p => p.id === prodForm.produit_id);
          if (currentProd) {
            const newStock = (+currentProd.stock_qty || 0) + (+prodForm.quantite_produite);
            await supabase.from('products').update({ stock_qty: newStock }).eq('id', prodForm.produit_id);
          }
        }

        // 2. Déduire automatiquement l'emballage consommé du stock
        if (prodForm.emballage_id) {
          const emb = emballages.find(e => e.id === prodForm.emballage_id);
          if (emb) {
            const totalConsumed = (+prodForm.quantite_produite) + (+prodForm.perte_qty || 0);
            const newEmbStock = Math.max(0, (+emb.stock_qty || 0) - totalConsumed);
            await supabase.from('emballages').update({ stock_qty: newEmbStock }).eq('id', prodForm.emballage_id);
          }
        }
      }

      Swal.fire({
        icon: 'success',
        title: 'Production Enregistrée !',
        html: `✅ <b>+${prodForm.quantite_produite} unités</b> de <b>${prodForm.produit_nom}</b> ajoutées au stock<br/>
          🏷️ N° Lot : <b>${lotNum}</b><br/>
          ${prodForm.emballage_id ? '📦 Emballage consommé déduit du stock !' : ''}`,
        timer: 2400, showConfirmButton: false
      });

      setIsProdModalOpen(false);
      setProdForm({
        produit_id: '', produit_nom: '', numero_lot: '',
        quantite_produite: 100, emballage_id: '', perte_qty: 0,
        cout_matiere: 0, cout_emballage: 0,
        cout_main_oeuvre: 0, notes: '', date: format(new Date(), 'yyyy-MM-dd')
      });
      fetchData();
    } catch (err) {
      Swal.fire('Erreur', err.message, 'error');
    }
  };

  const handleSaveRecette = async (e) => {
    e.preventDefault();
    if (!recetteForm.nom) return;
    try {
      const payload = {
        user_id: targetUid,
        nom: recetteForm.nom,
        produit_id: recetteForm.produit_id || null,
        description: recetteForm.description,
        rendement: +recetteForm.rendement || 1
      };
      const { error } = await supabase.from('recettes').insert([payload]);
      if (error) {
        setRecettes(prev => [...prev, { ...payload, id: Date.now().toString() }]);
      }
      Swal.fire({ icon: 'success', title: 'Recette sauvegardée', timer: 1000, showConfirmButton: false });
      setIsRecetteModalOpen(false);
      fetchData();
    } catch (err) {
      Swal.fire('Erreur', err.message, 'error');
    }
  };

  const handleDeleteProduction = async (id) => {
    const res = await Swal.fire({
      title: 'Supprimer ce lot de production ?',
      text: 'Action irréversible',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonText: 'Annuler',
      confirmButtonText: 'Oui, supprimer'
    });
    if (res.isConfirmed) {
      try {
        const { error } = await supabase.from('productions').delete().eq('id', id);
        if (error) throw error;
        setProductions(prev => prev.filter(p => p.id !== id));
        Swal.fire({ icon: 'success', title: 'Lot supprimé !', timer: 800, showConfirmButton: false });
        fetchData();
      } catch (e) {
        Swal.fire('Erreur', 'Impossible de supprimer: ' + e.message, 'error');
      }
    }
  };

  // Alertes stock matières premières
  const alertesMatieres = useMemo(() =>
    matieres.filter(m => (+m.stock_qty || 0) <= (+m.seuil_alerte || 10)), [matieres]);

  // Filtrage par lot
  const productionsFiltrees = useMemo(() => {
    if (!lotSearch.trim()) return productions;
    const q = lotSearch.toLowerCase();
    return productions.filter(p =>
      (p.numero_lot || '').toLowerCase().includes(q) ||
      (p.produit_nom || '').toLowerCase().includes(q)
    );
  }, [productions, lotSearch]);

  // Stats globales
  const totalUnites = productions.reduce((s, p) => s + (+p.quantite_produite || 0), 0);
  const totalCout = productions.reduce((s, p) => s + (+p.cout_total || 0), 0);
  const avgCoutUnite = totalUnites > 0 ? totalCout / totalUnites : 0;

  return (
    <div className="animate-enter">
      {/* Alertes matières premières */}
      {alertesMatieres.length > 0 && (
        <div style={{ marginBottom: 16, background: '#fef3c7', border: '1.5px solid #fde68a', borderRadius: 16, padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: '#92400e', marginBottom: 6 }}>
            <AlertTriangle size={16} /> ⚠️ {alertesMatieres.length} Matière(s) Première(s) en Rupture !
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {alertesMatieres.map(m => (
              <span key={m.id} style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 20, padding: '3px 10px', fontSize: '0.78rem', fontWeight: 700, color: '#78350f' }}>
                {m.nom}: {m.stock_qty} {m.unite} (min: {m.seuil_alerte || 10})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Top Stats */}
      <div className="stats-grid">
        <div className="stat-card" style={{ borderLeft: '5px solid #4f46e5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#4f46e5' }}>{productions.length}</div>
              <div className="stat-label">Lots Fabriqués</div>
            </div>
            <Factory color="#4f46e5" size={28} />
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '5px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#10b981' }}>{totalUnites}</div>
              <div className="stat-label">Unités Totales Produites</div>
            </div>
            <CheckCircle color="#10b981" size={28} />
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '5px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#f59e0b' }}>{totalCout.toFixed(0)} DA</div>
              <div className="stat-label">Coût Global Production</div>
            </div>
            <DollarSign color="#f59e0b" size={28} />
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '5px solid #0ea5e9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#0ea5e9' }}>{avgCoutUnite.toFixed(2)} DA</div>
              <div className="stat-label">Coût Moyen / Unité</div>
            </div>
            <Layers color="#0ea5e9" size={28} />
          </div>
        </div>
      </div>

      {/* Main glass card */}
      <div className="glass-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div className="module-tabs" style={{ margin: 0 }}>
            <button className={`module-tab ${activeTab === 'productions' ? 'active' : ''}`} onClick={() => setActiveTab('productions')}>
              🏭 Historique & Lots ({productions.length})
            </button>
            <button className={`module-tab ${activeTab === 'recettes' ? 'active' : ''}`} onClick={() => setActiveTab('recettes')}>
              🧪 Formules & Recettes ({recettes.length})
            </button>
          </div>
          {activeTab === 'productions' ? (
            <button className="btn-primary" onClick={() => {
              setProdForm(f => ({ ...f, numero_lot: generateLotNumber() }));
              setIsProdModalOpen(true);
            }}>
              <Play size={16} /> Lancer une Production
            </button>
          ) : (
            <button className="btn-primary" onClick={() => setIsRecetteModalOpen(true)}>
              <Plus size={16} /> Créer une Recette
            </button>
          )}
        </div>

        {/* TAB 1: Productions */}
        {activeTab === 'productions' && (
          <div>
            {/* Recherche par lot */}
            <div style={{ marginBottom: 14 }}>
              <input
                className="form-control"
                placeholder="🔍 Rechercher par N° Lot ou produit..."
                value={lotSearch}
                onChange={e => setLotSearch(e.target.value)}
                style={{ maxWidth: 340 }}
              />
            </div>
            <div className="table-wrapper">
              {loading ? (
                <p style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>Chargement...</p>
              ) : productionsFiltrees.length === 0 ? (
                <div className="empty-state">
                  <Factory size={40} />
                  <p>Aucune production enregistrée</p>
                  <small>Cliquez sur "Lancer une Production" pour fabriquer un nouveau lot.</small>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>N° Lot</th>
                      <th>Date</th>
                      <th>Produit Fabriqué</th>
                      <th>Quantité</th>
                      <th>Coût Matières</th>
                      <th>Coût Emballages</th>
                      <th>Main d'Œuvre</th>
                      <th>Coût Total</th>
                      <th>Coût / Unité</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productionsFiltrees.map(p => {
                      const costPerUnit = p.quantite_produite > 0 ? (p.cout_total / p.quantite_produite) : 0;
                      return (
                        <tr key={p.id}>
                          <td>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#4f46e5', fontSize: '0.8rem', background: 'rgba(79,70,229,0.08)', padding: '3px 8px', borderRadius: 8 }}>
                              {p.numero_lot || '—'}
                            </span>
                          </td>
                          <td>{p.date}</td>
                          <td>
                            <strong>{p.produit_nom}</strong>
                            {p.notes && <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{p.notes}</div>}
                          </td>
                          <td>
                            <span className="badge badge-purple" style={{ fontSize: '0.85rem' }}>
                              {p.quantite_produite} unités
                            </span>
                          </td>
                          <td>{(+p.cout_matiere || 0).toFixed(2)} DA</td>
                          <td>{(+p.cout_emballage || 0).toFixed(2)} DA</td>
                          <td>{(+p.cout_main_oeuvre || 0).toFixed(2)} DA</td>
                          <td><strong style={{ color: '#4f46e5' }}>{(+p.cout_total || 0).toFixed(2)} DA</strong></td>
                          <td>
                            <span style={{ fontWeight: 700, color: '#10b981' }}>{costPerUnit.toFixed(2)} DA</span>
                          </td>
                          <td>
                            <button className="icon-btn" title="Supprimer" style={{ color: '#ef4444' }} onClick={() => handleDeleteProduction(p.id)}>
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

        {/* TAB 2: Recettes */}
        {activeTab === 'recettes' && (
          <div className="table-wrapper">
            {recettes.length === 0 ? (
              <div className="empty-state">
                <Beaker size={40} />
                <p>Aucune formule ou recette enregistrée</p>
                <small>Créez des recettes standard pour vos fabrications (dosage, ingrédients, rendement).</small>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {recettes.map(r => (
                  <div key={r.id} className="product-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <h4 style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--primary)' }}>{r.nom}</h4>
                      <Beaker size={20} color="var(--primary)" />
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 12 }}>{r.description || 'Sans description'}</p>
                    <div style={{ background: 'rgba(79, 70, 229, 0.05)', borderRadius: 10, padding: 10, marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span>Rendement standard :</span>
                        <strong>{r.rendement} unités</strong>
                      </div>
                    </div>
                    <button className="btn-primary" style={{ width: '100%', padding: 9, fontSize: '0.82rem' }}
                      onClick={() => {
                        setProdForm(f => ({
                          ...f,
                          produit_nom: r.nom,
                          produit_id: r.produit_id || '',
                          quantite_produite: r.rendement || 100,
                          numero_lot: generateLotNumber()
                        }));
                        setIsProdModalOpen(true);
                      }}>
                      <Play size={14} /> Produire ce lot
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Coût de revient par produit */}
      {produits.length > 0 && (
        <div className="glass-container">
          <h3 style={{ fontWeight: 800, marginBottom: 16, fontSize: '1.1rem' }}>🧮 Coût de Revient par Produit</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {produits.map(p => {
              const prodsLot = productions.filter(pr => pr.produit_id === p.id);
              const totalQty = prodsLot.reduce((s, pr) => s + (+pr.quantite_produite || 0), 0);
              const totalCoutP = prodsLot.reduce((s, pr) => s + (+pr.cout_total || 0), 0);
              const coutUnite = totalQty > 0 ? totalCoutP / totalQty : 0;
              const marge = p.prix_unitaire > 0 ? ((p.prix_unitaire - coutUnite) / p.prix_unitaire * 100) : 0;

              return (
                <div key={p.id} style={{ background: 'var(--card)', borderRadius: 14, padding: '14px 16px', border: '1px solid var(--card-border)' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: 8, color: 'var(--primary)' }}>{p.nom}</div>
                  <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--muted)' }}>Prix vente:</span>
                      <strong>{(+p.prix_unitaire || 0).toFixed(2)} DA</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--muted)' }}>Coût de revient:</span>
                      <strong style={{ color: '#f59e0b' }}>{coutUnite.toFixed(2)} DA</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--muted)' }}>Marge:</span>
                      <strong style={{ color: marge > 0 ? '#10b981' : '#ef4444' }}>
                        {marge > 0 ? '+' : ''}{marge.toFixed(1)}%
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--muted)' }}>Lots produits:</span>
                      <span>{prodsLot.length} lot(s)</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL: Lancer une Production */}
      {isProdModalOpen && (
        <div className="modal-overlay" onClick={() => setIsProdModalOpen(false)}>
          <div className="modal-content animate-enter" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🏭 Lancer un Ordre de Production</h3>
              <button className="modal-close-btn" onClick={() => setIsProdModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleLaunchProduction}>
              {/* N° Lot */}
              <div className="form-row">
                <div className="form-group">
                  <label>🏷️ N° Lot (Duffa)</label>
                  <input className="form-control" value={prodForm.numero_lot}
                    onChange={e => setProdForm(f => ({ ...f, numero_lot: e.target.value }))}
                    placeholder="Ex: LOT-20261025-001" />
                </div>
                <div className="form-group">
                  <label>Date de Production</label>
                  <input type="date" className="form-control" value={prodForm.date}
                    onChange={e => setProdForm(f => ({ ...f, date: e.target.value }))} />
                </div>
              </div>

              <div className="form-group">
                <label>Produit à Fabriquer *</label>
                <select className="form-control" value={prodForm.produit_id} required
                  onChange={e => {
                    const p = produits.find(x => x.id === e.target.value);
                    setProdForm(f => ({
                      ...f,
                      produit_id: e.target.value,
                      produit_nom: p ? p.nom : f.produit_nom
                    }));
                  }}>
                  <option value="">-- Sélectionner le produit --</option>
                  {produits.map(p => (
                    <option key={p.id} value={p.id}>{p.nom} (Stock actuel: {p.stock_qty})</option>
                  ))}
                </select>
              </div>

              {!prodForm.produit_id && (
                <div className="form-group">
                  <label>Nom du Produit (si non listé)</label>
                  <input className="form-control" value={prodForm.produit_nom}
                    onChange={e => setProdForm({ ...prodForm, produit_nom: e.target.value })}
                    placeholder="Ex: Savon liquide 5L" />
                </div>
              )}

              <div className="form-group">
                <label>Quantité Fabriquée *</label>
                <input type="number" min="1" required className="form-control"
                  value={prodForm.quantite_produite}
                  onChange={e => {
                    const q = +e.target.value;
                    const emb = emballages.find(x => x.id === prodForm.emballage_id);
                    setProdForm(f => ({
                      ...f,
                      quantite_produite: e.target.value,
                      cout_emballage: emb ? (q * (+emb.prix_unitaire || 0)).toFixed(2) : f.cout_emballage
                    }));
                  }} />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>📦 Emballage Consommé (Déduit du stock)</label>
                  <select className="form-control" value={prodForm.emballage_id}
                    onChange={e => {
                      const emb = emballages.find(x => x.id === e.target.value);
                      const coutEstime = emb ? ((+prodForm.quantite_produite) * (+emb.prix_unitaire || 0)).toFixed(2) : prodForm.cout_emballage;
                      setProdForm(f => ({
                        ...f,
                        emballage_id: e.target.value,
                        cout_emballage: coutEstime
                      }));
                    }}>
                    <option value="">-- Sans déduction emballage --</option>
                    {emballages.map(emb => (
                      <option key={emb.id} value={emb.id}>
                        {emb.nom} (Stock: {emb.stock_qty} {emb.unite} | {emb.prix_unitaire} DA)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>⚠️ Pertes / Défauts (ضياع ونقص)</label>
                  <input type="number" min="0" className="form-control" value={prodForm.perte_qty}
                    onChange={e => setProdForm({ ...prodForm, perte_qty: e.target.value })}
                    placeholder="Unités abîmées..." />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Coût Matières Premières (DA)</label>
                  <input type="number" step="0.01" className="form-control" value={prodForm.cout_matiere}
                    onChange={e => setProdForm({ ...prodForm, cout_matiere: e.target.value })}
                    placeholder="Ex: 4500" />
                </div>
                <div className="form-group">
                  <label>Coût Emballages & Bouteilles (DA)</label>
                  <input type="number" step="0.01" className="form-control" value={prodForm.cout_emballage}
                    onChange={e => setProdForm({ ...prodForm, cout_emballage: e.target.value })}
                    placeholder="Ex: 1200" />
                </div>
              </div>

              <div className="form-group">
                <label>Coût Main-d'œuvre & Énergie (DA)</label>
                <input type="number" step="0.01" className="form-control" value={prodForm.cout_main_oeuvre}
                  onChange={e => setProdForm({ ...prodForm, cout_main_oeuvre: e.target.value })}
                  placeholder="Ex: 800" />
              </div>

              {/* Preview coût */}
              <div style={{ background: 'rgba(79, 70, 229, 0.08)', borderRadius: 12, padding: 12, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem', color: 'var(--primary)' }}>
                  <span>Coût Total de Production :</span>
                  <span>{((+prodForm.cout_matiere || 0) + (+prodForm.cout_emballage || 0) + (+prodForm.cout_main_oeuvre || 0)).toFixed(2)} DA</span>
                </div>
                {prodForm.quantite_produite > 0 && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 4 }}>
                    🧮 Coût de revient / unité : <strong style={{ color: '#f59e0b' }}>
                      {(((+prodForm.cout_matiere || 0) + (+prodForm.cout_emballage || 0) + (+prodForm.cout_main_oeuvre || 0)) / (+prodForm.quantite_produite)).toFixed(2)} DA
                    </strong>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Notes</label>
                <input className="form-control" value={prodForm.notes}
                  onChange={e => setProdForm({ ...prodForm, notes: e.target.value })}
                  placeholder="Notes supplémentaires..." />
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', padding: 14 }}>
                Valider et Augmenter le Stock
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Nouvelle Recette */}
      {isRecetteModalOpen && (
        <div className="modal-overlay" onClick={() => setIsRecetteModalOpen(false)}>
          <div className="modal-content animate-enter" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🧪 Nouvelle Formule de Recette</h3>
              <button className="modal-close-btn" onClick={() => setIsRecetteModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSaveRecette}>
              <div className="form-group">
                <label>Nom de la Recette *</label>
                <input className="form-control" required value={recetteForm.nom}
                  onChange={e => setRecetteForm({ ...recetteForm, nom: e.target.value })}
                  placeholder="Ex: Formule Lave-vaisselle Citron" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Rendement Standard (Unités)</label>
                  <input type="number" className="form-control" value={recetteForm.rendement}
                    onChange={e => setRecetteForm({ ...recetteForm, rendement: e.target.value })}
                    placeholder="100" />
                </div>
                <div className="form-group">
                  <label>Associer à un Produit</label>
                  <select className="form-control" value={recetteForm.produit_id}
                    onChange={e => setRecetteForm({ ...recetteForm, produit_id: e.target.value })}>
                    <option value="">-- Choisir le produit --</option>
                    {produits.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Composition & Instructions</label>
                <textarea className="form-control" rows={4} value={recetteForm.description}
                  onChange={e => setRecetteForm({ ...recetteForm, description: e.target.value })}
                  placeholder="Ex: 50kg Eau + 5kg LABSA + 2kg Soude..." />
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%', padding: 14 }}>
                Enregistrer la Recette
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
