import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { Package, Factory, Plus, Search, Edit2, Trash2, AlertTriangle, Layers, Box, DollarSign } from 'lucide-react';
import Swal from 'sweetalert2';

export default function StockModule({ session, theme, companyId }) {
  const targetUid = companyId || session?.user?.id;
  const [activeSubTab, setActiveSubTab] = useState('matieres'); // 'matieres' | 'emballages' | 'produits'
  const [matieres, setMatieres] = useState([]);
  const [emballages, setEmballages] = useState([]);
  const [produits, setProduits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({
    nom: '',
    unite: 'kg',
    stock_qty: 0,
    prix_unitaire: 0,
    seuil_alerte: 10,
    description: ''
  });

  useEffect(() => {
    fetchAllStock();
  }, [session, targetUid]);

  const fetchAllStock = async () => {
    if (!session || !targetUid) return;
    setLoading(true);
    try {
      const [mRes, eRes, pRes] = await Promise.all([
        supabase.from('matieres_premieres').select('*').eq('user_id', targetUid).order('nom'),
        supabase.from('emballages').select('*').eq('user_id', targetUid).order('nom'),
        supabase.from('products').select('*').eq('user_id', targetUid).order('nom')
      ]);
      setMatieres(mRes.data || []);
      setEmballages(eRes.data || []);
      setProduits(pRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const currentList = useMemo(() => {
    const list = activeSubTab === 'matieres' ? matieres : activeSubTab === 'emballages' ? emballages : produits;
    const q = search.toLowerCase();
    return list.filter(item => item.nom.toLowerCase().includes(q));
  }, [activeSubTab, matieres, emballages, produits, search]);

  const stats = useMemo(() => {
    const valMatieres = matieres.reduce((s, m) => s + ((+m.stock_qty || 0) * (+m.prix_unitaire || 0)), 0);
    const valEmballages = emballages.reduce((s, e) => s + ((+e.stock_qty || 0) * (+e.prix_unitaire || 0)), 0);
    const valProduits = produits.reduce((s, p) => s + ((+p.stock_qty || 0) * (+p.prix_unitaire || 0)), 0);
    const alertCount = [
      ...matieres.filter(m => m.stock_qty <= (m.seuil_alerte || 10)),
      ...emballages.filter(e => e.stock_qty <= (e.seuil_alerte || 20)),
      ...produits.filter(p => p.stock_qty <= (p.seuil_alerte || 5))
    ].length;
    return { valMatieres, valEmballages, valProduits, totalVal: valMatieres + valEmballages + valProduits, alertCount };
  }, [matieres, emballages, produits]);

  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!form.nom.trim()) return;
    const table = activeSubTab === 'matieres' ? 'matieres_premieres' : activeSubTab === 'emballages' ? 'emballages' : 'products';

    try {
      const payload = {
        nom: form.nom,
        unite: form.unite,
        stock_qty: +form.stock_qty || 0,
        prix_unitaire: +form.prix_unitaire || 0,
        seuil_alerte: +form.seuil_alerte || 5,
        description: form.description || ''
      };

      if (editingItem) {
        await supabase.from(table).update(payload).eq('id', editingItem.id);
        Swal.fire({ icon: 'success', title: 'Mis à jour !', timer: 900, showConfirmButton: false });
      } else {
        const { error } = await supabase.from(table).insert([{ ...payload, user_id: targetUid }]);
        if (error) throw error;
        Swal.fire({ icon: 'success', title: 'Ajouté !', timer: 900, showConfirmButton: false });
      }
      setIsModalOpen(false);
      setEditingItem(null);
      fetchAllStock();
    } catch (err) {
      Swal.fire('Erreur', 'Impossible d\'enregistrer: ' + err.message, 'error');
      setIsModalOpen(false);
    }
  };

  const handleDeleteItem = async (item) => {
    const table = activeSubTab === 'matieres' ? 'matieres_premieres' : activeSubTab === 'emballages' ? 'emballages' : 'products';
    const res = await Swal.fire({
      title: 'Supprimer cet élément ?',
      text: item.nom,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonText: 'Annuler',
      confirmButtonText: 'Oui, supprimer'
    });
    if (res.isConfirmed) {
      try {
        const { error } = await supabase.from(table).delete().eq('id', item.id);
        if (error) throw error;
        fetchAllStock();
        Swal.fire({ icon: 'success', title: 'Supprimé avec succès', timer: 800, showConfirmButton: false });
      } catch (err) {
        Swal.fire('Erreur', 'Impossible de supprimer: ' + err.message, 'error');
      }
    }
  };

  // Items en alerte pour bannière
  const itemsEnAlerte = useMemo(() => {
    const res = [];
    matieres.filter(m => (+m.stock_qty || 0) <= (+m.seuil_alerte || 10)).forEach(m => res.push({ ...m, type: '🧪 Matière' }));
    emballages.filter(e => (+e.stock_qty || 0) <= (+e.seuil_alerte || 20)).forEach(e => res.push({ ...e, type: '📦 Emballage' }));
    produits.filter(p => (+p.stock_qty || 0) <= (+p.seuil_alerte || 5)).forEach(p => res.push({ ...p, type: '🧴 Produit' }));
    return res;
  }, [matieres, emballages, produits]);

  return (
    <div className="animate-enter">
      {/* Bannière alertes stock */}
      {itemsEnAlerte.length > 0 && (
        <div style={{ marginBottom: 16, background: '#fee2e2', border: '1.5px solid #fca5a5', borderRadius: 16, padding: '14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, color: '#b91c1c', marginBottom: 10, fontSize: '0.95rem' }}>
            <AlertTriangle size={18} /> ⚠️ {itemsEnAlerte.length} Article(s) en Alerte de Stock !
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {itemsEnAlerte.map(item => (
              <span key={item.id} style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 20, padding: '4px 12px', fontSize: '0.78rem', fontWeight: 700, color: '#991b1b' }}>
                {item.type} {item.nom}: <strong>{item.stock_qty}</strong> {item.unite || 'u'} (min: {item.seuil_alerte})
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
              <div className="stat-value" style={{ color: '#4f46e5' }}>{stats.totalVal.toFixed(0)} DA</div>
              <div className="stat-label">Valeur Totale Stock</div>
            </div>
            <DollarSign color="#4f46e5" size={28} />
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '5px solid #06b6d4' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#06b6d4' }}>{matieres.length}</div>
              <div className="stat-label">Matières Premières</div>
            </div>
            <Layers color="#06b6d4" size={28} />
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '5px solid #8b5cf6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#8b5cf6' }}>{emballages.length}</div>
              <div className="stat-label">Types d'Emballages</div>
            </div>
            <Box color="#8b5cf6" size={28} />
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: stats.alertCount > 0 ? '5px solid #ef4444' : '5px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: stats.alertCount > 0 ? '#ef4444' : '#10b981' }}>{stats.alertCount}</div>
              <div className="stat-label">Alertes Rupture</div>
            </div>
            <AlertTriangle color={stats.alertCount > 0 ? '#ef4444' : '#10b981'} size={28} />
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="glass-container">
        {/* Module Sub-tabs */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div className="module-tabs" style={{ margin: 0 }}>
            <button 
              className={`module-tab ${activeSubTab === 'matieres' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('matieres')}
            >
              🧪 Matières Premières ({matieres.length})
            </button>
            <button 
              className={`module-tab ${activeSubTab === 'emballages' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('emballages')}
            >
              📦 Emballages & Bouteilles ({emballages.length})
            </button>
            <button 
              className={`module-tab ${activeSubTab === 'produits' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('produits')}
            >
              🧴 Produits Finis ({produits.length})
            </button>
          </div>

          <button 
            className="btn-primary" 
            onClick={() => {
              setEditingItem(null);
              setForm({
                nom: '',
                unite: activeSubTab === 'matieres' ? 'kg' : activeSubTab === 'emballages' ? 'pièce' : 'pièce',
                stock_qty: 0,
                prix_unitaire: '',
                seuil_alerte: activeSubTab === 'matieres' ? 10 : 20,
                description: ''
              });
              setIsModalOpen(true);
            }}
          >
            <Plus size={16} /> Ajouter {activeSubTab === 'matieres' ? 'une Matière' : activeSubTab === 'emballages' ? 'un Emballage' : 'un Produit'}
          </button>
        </div>

        {/* Search Bar */}
        <div style={{ marginBottom: 16 }}>
          <div className="search-bar">
            <Search size={18} color="var(--muted)" />
            <input 
              type="text" 
              placeholder={`Rechercher dans ${activeSubTab === 'matieres' ? 'les matières' : activeSubTab === 'emballages' ? 'les emballages' : 'les produits'}...`}
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
        </div>

        {/* Table View */}
        <div className="table-wrapper">
          {loading ? (
            <p style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>Chargement des données de stock...</p>
          ) : currentList.length === 0 ? (
            <div className="empty-state">
              <Factory size={40} />
              <p>Aucun élément enregistré</p>
              <small>Cliquez sur le bouton ci-dessus pour ajouter votre premier élément.</small>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Désignation</th>
                  <th>Stock Actuel</th>
                  <th>Unité</th>
                  <th>Prix Unitaire (Coût)</th>
                  <th>Valeur en Stock</th>
                  <th>État / Alerte</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentList.map(item => {
                  const seuil = item.seuil_alerte || (activeSubTab === 'matieres' ? 10 : 20);
                  const isLow = item.stock_qty <= seuil;
                  const val = (+item.stock_qty || 0) * (+item.prix_unitaire || 0);
                  return (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: 800 }}>{item.nom}</div>
                        {item.description && <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{item.description}</div>}
                      </td>
                      <td>
                        <span style={{ fontSize: '1.05rem', fontWeight: 900, color: isLow ? '#ef4444' : 'var(--text)' }}>
                          {item.stock_qty}
                        </span>
                      </td>
                      <td>{item.unite || 'unité'}</td>
                      <td>{(+item.prix_unitaire || 0).toFixed(2)} DA</td>
                      <td><strong>{val.toFixed(2)} DA</strong></td>
                      <td>
                        <span className={`badge ${isLow ? 'badge-danger' : 'badge-success'}`}>
                          {isLow ? `⚠️ Bas (≤ ${seuil})` : 'Normal'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="icon-btn" title="Modifier" onClick={() => {
                            setEditingItem(item);
                            setForm({
                              nom: item.nom || '',
                              unite: item.unite || 'kg',
                              stock_qty: item.stock_qty || 0,
                              prix_unitaire: item.prix_unitaire || '',
                              seuil_alerte: item.seuil_alerte || seuil,
                              description: item.description || ''
                            });
                            setIsModalOpen(true);
                          }}>
                            <Edit2 size={14} />
                          </button>
                          <button className="icon-btn" title="Supprimer" style={{ color: '#ef4444' }} onClick={() => handleDeleteItem(item)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL: Ajouter / Modifier Item */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content animate-enter" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {editingItem ? 'Modifier' : 'Ajouter'} {activeSubTab === 'matieres' ? 'Matière Première' : activeSubTab === 'emballages' ? 'Emballage' : 'Produit'}
              </h3>
              <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSaveItem}>
              <div className="form-group">
                <label>Désignation *</label>
                <input 
                  className="form-control" 
                  required 
                  value={form.nom} 
                  onChange={e => setForm({ ...form, nom: e.target.value })} 
                  placeholder={activeSubTab === 'matieres' ? 'Ex: Soude caustique, Acide chlorhydrique' : activeSubTab === 'emballages' ? 'Ex: Bouteille PET 1L, Bouchon sécurité' : 'Nom du produit'} 
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Stock Actuel</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="form-control" 
                    value={form.stock_qty} 
                    onChange={e => setForm({ ...form, stock_qty: e.target.value })} 
                  />
                </div>
                <div className="form-group">
                  <label>Unité de Mesure</label>
                  <select className="form-control" value={form.unite} onChange={e => setForm({ ...form, unite: e.target.value })}>
                    {activeSubTab === 'matieres' ? (
                      <>
                        <option value="kg">Kilogramme (kg)</option>
                        <option value="litre">Litre (L)</option>
                        <option value="tonne">Tonne</option>
                        <option value="sac">Sac (25kg / 50kg)</option>
                        <option value="bidon">Bidon</option>
                      </>
                    ) : (
                      <>
                        <option value="pièce">Pièce / Unité</option>
                        <option value="carton">Carton</option>
                        <option value="sac">Sac</option>
                        <option value="rouleau">Rouleau d'étiquettes</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Prix Unitaire Moyen (DA)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="form-control" 
                    value={form.prix_unitaire} 
                    onChange={e => setForm({ ...form, prix_unitaire: e.target.value })} 
                    placeholder="Prix d'achat unitaire" 
                  />
                </div>
                <div className="form-group">
                  <label>Seuil d'Alerte Minimum</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={form.seuil_alerte} 
                    onChange={e => setForm({ ...form, seuil_alerte: e.target.value })} 
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Description / Référence</label>
                <textarea 
                  className="form-control" 
                  rows={2} 
                  value={form.description} 
                  onChange={e => setForm({ ...form, description: e.target.value })} 
                  placeholder="Notes sur le stockage ou dosage..." 
                />
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', padding: 14 }}>
                Enregistrer dans le Stock
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
