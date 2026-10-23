import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { Factory, Plus, Beaker, Play, CheckCircle, Trash2, Calendar, DollarSign, Layers, Box, Info } from 'lucide-react';
import Swal from 'sweetalert2';
import { format } from 'date-fns';

export default function ProductionModule({ session, theme }) {
  const [activeTab, setActiveTab] = useState('productions'); // 'productions' | 'recettes'
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
    quantite_produite: 100,
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
    cout_estime: 0
  });

  useEffect(() => {
    fetchData();
  }, [session]);

  const fetchData = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [prodRes, recRes, pRes, mRes, eRes] = await Promise.all([
        supabase.from('productions').select('*').order('date', { ascending: false }),
        supabase.from('recettes').select('*').order('nom'),
        supabase.from('products').select('*').order('nom'),
        supabase.from('matieres_premieres').select('*').order('nom'),
        supabase.from('emballages').select('*').order('nom')
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

  const handleLaunchProduction = async (e) => {
    e.preventDefault();
    if (!prodForm.produit_nom || !prodForm.quantite_produite) return;

    const totalCost = (+prodForm.cout_matiere || 0) + (+prodForm.cout_emballage || 0) + (+prodForm.cout_main_oeuvre || 0);

    try {
      const payload = {
        user_id: session.user.id,
        produit_id: prodForm.produit_id || null,
        produit_nom: prodForm.produit_nom,
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
        // Fallback local
        setProductions(prev => [{ ...payload, id: Date.now().toString() }, ...prev]);
      } else {
        // Automatically increase product stock in products table
        if (prodForm.produit_id) {
          const currentProd = produits.find(p => p.id === prodForm.produit_id);
          if (currentProd) {
            const newStock = (+currentProd.stock_qty || 0) + (+prodForm.quantite_produite);
            await supabase.from('products').update({ stock_qty: newStock }).eq('id', prodForm.produit_id);
          }
        }
      }

      Swal.fire({
        icon: 'success',
        title: 'Production Enregistrée !',
        text: `+${prodForm.quantite_produite} unités ajoutées au stock de ${prodForm.produit_nom}`,
        timer: 1600
      });

      setIsProdModalOpen(false);
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
        user_id: session.user.id,
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
      confirmButtonText: 'Supprimer'
    });
    if (res.isConfirmed) {
      try {
        await supabase.from('productions').delete().eq('id', id);
        setProductions(prev => prev.filter(p => p.id !== id));
        Swal.fire({ icon: 'success', title: 'Supprimé', timer: 800, showConfirmButton: false });
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <div className="animate-enter">
      {/* Top Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
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
              <div className="stat-value" style={{ color: '#10b981' }}>
                {productions.reduce((s, p) => s + (+p.quantite_produite || 0), 0)}
              </div>
              <div className="stat-label">Unités Totales Produites</div>
            </div>
            <CheckCircle color="#10b981" size={28} />
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '5px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#f59e0b' }}>
                {productions.reduce((s, p) => s + (+p.cout_total || 0), 0).toFixed(0)} DA
              </div>
              <div className="stat-label">Coût Global Production</div>
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
              className={`module-tab ${activeTab === 'productions' ? 'active' : ''}`}
              onClick={() => setActiveTab('productions')}
            >
              🏭 Historique & Ordres de Production ({productions.length})
            </button>
            <button 
              className={`module-tab ${activeTab === 'recettes' ? 'active' : ''}`}
              onClick={() => setActiveTab('recettes')}
            >
              🧪 Formules & Recettes ({recettes.length})
            </button>
          </div>

          {activeTab === 'productions' ? (
            <button className="btn-primary" onClick={() => setIsProdModalOpen(true)}>
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
          <div className="table-wrapper">
            {loading ? (
              <p style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>Chargement...</p>
            ) : productions.length === 0 ? (
              <div className="empty-state">
                <Factory size={40} />
                <p>Aucune production enregistrée</p>
                <small>Cliquez sur "Lancer une Production" pour fabriquer un nouveau lot de produits.</small>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Produit Fabriqué</th>
                    <th>Quantité</th>
                    <th>Coût Matières</th>
                    <th>Coût Emballages</th>
                    <th>Coût Total</th>
                    <th>Coût / Unité</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {productions.map(p => {
                    const costPerUnit = p.quantite_produite > 0 ? (p.cout_total / p.quantite_produite) : 0;
                    return (
                      <tr key={p.id}>
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
                        <td>
                          <strong style={{ color: '#4f46e5' }}>{(+p.cout_total || 0).toFixed(2)} DA</strong>
                        </td>
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
                    <button 
                      className="btn-primary" 
                      style={{ width: '100%', padding: 9, fontSize: '0.82rem' }}
                      onClick={() => {
                        setProdForm(f => ({
                          ...f,
                          produit_nom: r.nom,
                          produit_id: r.produit_id || '',
                          quantite_produite: r.rendement || 100
                        }));
                        setIsProdModalOpen(true);
                      }}
                    >
                      <Play size={14} /> Produire ce lot
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL: Lancer une Production */}
      {isProdModalOpen && (
        <div className="modal-overlay" onClick={() => setIsProdModalOpen(false)}>
          <div className="modal-content animate-enter" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🏭 Lancer un Ordre de Production</h3>
              <button className="modal-close-btn" onClick={() => setIsProdModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleLaunchProduction}>
              <div className="form-group">
                <label>Produit à Fabriquer *</label>
                <select 
                  className="form-control" 
                  value={prodForm.produit_id} 
                  required
                  onChange={e => {
                    const p = produits.find(x => x.id === e.target.value);
                    setProdForm(f => ({
                      ...f,
                      produit_id: e.target.value,
                      produit_nom: p ? p.nom : f.produit_nom
                    }));
                  }}
                >
                  <option value="">-- Sélectionner le produit --</option>
                  {produits.map(p => (
                    <option key={p.id} value={p.id}>{p.nom} (Stock actuel: {p.stock_qty})</option>
                  ))}
                </select>
              </div>

              {!prodForm.produit_id && (
                <div className="form-group">
                  <label>Nom du Produit (si non listé)</label>
                  <input 
                    className="form-control" 
                    value={prodForm.produit_nom} 
                    onChange={e => setProdForm({ ...prodForm, produit_nom: e.target.value })} 
                    placeholder="Ex: Savon liquide 5L" 
                  />
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>Quantité Fabriquée *</label>
                  <input 
                    type="number" 
                    min="1" 
                    required 
                    className="form-control" 
                    value={prodForm.quantite_produite} 
                    onChange={e => setProdForm({ ...prodForm, quantite_produite: e.target.value })} 
                  />
                </div>
                <div className="form-group">
                  <label>Date de Production</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={prodForm.date} 
                    onChange={e => setProdForm({ ...prodForm, date: e.target.value })} 
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Coût Matières Premières (DA)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="form-control" 
                    value={prodForm.cout_matiere} 
                    onChange={e => setProdForm({ ...prodForm, cout_matiere: e.target.value })} 
                    placeholder="Ex: 4500" 
                  />
                </div>
                <div className="form-group">
                  <label>Coût Emballages & Bouteilles (DA)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="form-control" 
                    value={prodForm.cout_emballage} 
                    onChange={e => setProdForm({ ...prodForm, cout_emballage: e.target.value })} 
                    placeholder="Ex: 1200" 
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Coût Main-d'œuvre & Énergie (DA)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="form-control" 
                  value={prodForm.cout_main_oeuvre} 
                  onChange={e => setProdForm({ ...prodForm, cout_main_oeuvre: e.target.value })} 
                  placeholder="Ex: 800" 
                />
              </div>

              {/* Total Preview */}
              <div style={{ background: 'rgba(79, 70, 229, 0.08)', borderRadius: 12, padding: 12, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem', color: 'var(--primary)' }}>
                  <span>Coût Total de Production :</span>
                  <span>{((+prodForm.cout_matiere || 0) + (+prodForm.cout_emballage || 0) + (+prodForm.cout_main_oeuvre || 0)).toFixed(2)} DA</span>
                </div>
                {prodForm.quantite_produite > 0 && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 4 }}>
                    Coût de revient par unité : {(((+prodForm.cout_matiere || 0) + (+prodForm.cout_emballage || 0) + (+prodForm.cout_main_oeuvre || 0)) / (+prodForm.quantite_produite)).toFixed(2)} DA
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Notes / N° Lot</label>
                <input 
                  className="form-control" 
                  value={prodForm.notes} 
                  onChange={e => setProdForm({ ...prodForm, notes: e.target.value })} 
                  placeholder="Ex: Lot #2026-04" 
                />
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
                <input 
                  className="form-control" 
                  required 
                  value={recetteForm.nom} 
                  onChange={e => setRecetteForm({ ...recetteForm, nom: e.target.value })} 
                  placeholder="Ex: Formule Lave-vaisselle Citron" 
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Rendement Standard (Unités)</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={recetteForm.rendement} 
                    onChange={e => setRecetteForm({ ...recetteForm, rendement: e.target.value })} 
                    placeholder="100" 
                  />
                </div>
                <div className="form-group">
                  <label>Associer à un Produit</label>
                  <select 
                    className="form-control" 
                    value={recetteForm.produit_id} 
                    onChange={e => setRecetteForm({ ...recetteForm, produit_id: e.target.value })}
                  >
                    <option value="">-- Choisir le produit --</option>
                    {produits.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Composition & Instructions</label>
                <textarea 
                  className="form-control" 
                  rows={4} 
                  value={recetteForm.description} 
                  onChange={e => setRecetteForm({ ...recetteForm, description: e.target.value })} 
                  placeholder="Ex: 50kg Eau + 5kg LABSA + 2kg Soude..." 
                />
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
