import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { Package, Plus, Search, Edit2, Trash2, AlertTriangle, Barcode, TrendingUp, DollarSign, Tag, ArrowUpDown } from 'lucide-react';
import Swal from 'sweetalert2';

export default function ProduitsModule({ session, theme }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAlert, setFilterAlert] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState({
    nom: '',
    barcode: '',
    prix_unitaire: '',
    prix_revient: '',
    stock_qty: 0,
    unite: 'pièce',
    seuil_alerte: 5,
    description: ''
  });

  useEffect(() => {
    fetchProducts();
  }, [session]);

  const fetchProducts = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from('products').select('*').order('nom');
      if (error) throw error;
      setProducts(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter(p => {
      const matchesSearch = p.nom.toLowerCase().includes(q) || (p.barcode && p.barcode.toLowerCase().includes(q));
      const matchesAlert = filterAlert ? p.stock_qty <= (p.seuil_alerte || 5) : true;
      return matchesSearch && matchesAlert;
    });
  }, [products, search, filterAlert]);

  const stats = useMemo(() => {
    const totalCount = products.length;
    const totalStock = products.reduce((s, p) => s + (+p.stock_qty || 0), 0);
    const totalValVente = products.reduce((s, p) => s + ((+p.prix_unitaire || 0) * (+p.stock_qty || 0)), 0);
    const lowStockCount = products.filter(p => p.stock_qty <= (p.seuil_alerte || 5)).length;
    return { totalCount, totalStock, totalValVente, lowStockCount };
  }, [products]);

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!form.nom.trim()) return;

    try {
      const payload = {
        nom: form.nom,
        barcode: form.barcode || null,
        prix_unitaire: +form.prix_unitaire || 0,
        prix_revient: +form.prix_revient || 0,
        stock_qty: +form.stock_qty || 0,
        unite: form.unite || 'pièce',
        seuil_alerte: +form.seuil_alerte || 5,
        description: form.description || ''
      };

      if (editingProduct) {
        const { error } = await supabase.from('products').update(payload).eq('id', editingProduct.id);
        if (error) {
          // If columns don't exist yet, fallback to original schema
          const safePayload = {
            nom: form.nom,
            prix_unitaire: +form.prix_unitaire || 0,
            stock_qty: +form.stock_qty || 0,
            description: form.description || ''
          };
          await supabase.from('products').update(safePayload).eq('id', editingProduct.id);
        }
        Swal.fire({ icon: 'success', title: 'Produit mis à jour', timer: 1000, showConfirmButton: false });
      } else {
        const { error } = await supabase.from('products').insert([{ ...payload, user_id: session.user.id }]);
        if (error) {
          const safePayload = {
            nom: form.nom,
            prix_unitaire: +form.prix_unitaire || 0,
            stock_qty: +form.stock_qty || 0,
            description: form.description || '',
            user_id: session.user.id
          };
          await supabase.from('products').insert([safePayload]);
        }
        Swal.fire({ icon: 'success', title: 'Produit créé', timer: 1000, showConfirmButton: false });
      }

      setIsModalOpen(false);
      setEditingProduct(null);
      fetchProducts();
    } catch (err) {
      Swal.fire('Erreur', err.message, 'error');
    }
  };

  const handleQuickStockAdjust = async (p, delta) => {
    const newQty = Math.max(0, (+p.stock_qty || 0) + delta);
    try {
      await supabase.from('products').update({ stock_qty: newQty }).eq('id', p.id);
      setProducts(prev => prev.map(x => x.id === p.id ? { ...x, stock_qty: newQty } : x));
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (p) => {
    const res = await Swal.fire({
      title: 'Supprimer ce produit ?',
      text: p.nom,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Oui, supprimer'
    });
    if (res.isConfirmed) {
      try {
        await supabase.from('products').delete().eq('id', p.id);
        setProducts(prev => prev.filter(x => x.id !== p.id));
        Swal.fire({ icon: 'success', title: 'Supprimé', timer: 800, showConfirmButton: false });
      } catch (err) {
        Swal.fire('Erreur', err.message, 'error');
      }
    }
  };

  return (
    <div className="animate-enter">
      {/* Stats bar */}
      <div className="stats-grid">
        <div className="stat-card" style={{ borderLeft: '5px solid #4f46e5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#4f46e5' }}>{stats.totalCount}</div>
              <div className="stat-label">Total Articles</div>
            </div>
            <Package color="#4f46e5" size={28} />
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '5px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#10b981' }}>{stats.totalValVente.toFixed(0)} DA</div>
              <div className="stat-label">Valeur Vente Stock</div>
            </div>
            <DollarSign color="#10b981" size={28} />
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '5px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#f59e0b' }}>{stats.totalStock}</div>
              <div className="stat-label">Unités en Stock</div>
            </div>
            <Tag color="#f59e0b" size={28} />
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: stats.lowStockCount > 0 ? '5px solid #ef4444' : '5px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: stats.lowStockCount > 0 ? '#ef4444' : '#10b981' }}>
                {stats.lowStockCount}
              </div>
              <div className="stat-label">Rupture / Alerte Stock</div>
            </div>
            <AlertTriangle color={stats.lowStockCount > 0 ? '#ef4444' : '#10b981'} size={28} />
          </div>
        </div>
      </div>

      {/* Main glass card */}
      <div className="glass-container">
        <div className="section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h3>🏷️ Catalogue Produits & Codes-barres</h3>
            {stats.lowStockCount > 0 && (
              <button 
                onClick={() => setFilterAlert(!filterAlert)} 
                className={`badge ${filterAlert ? 'badge-danger' : 'badge-warning'}`}
                style={{ cursor: 'pointer', border: 'none' }}
              >
                {filterAlert ? 'Afficher tous' : `⚠️ ${stats.lowStockCount} en alerte`}
              </button>
            )}
          </div>
          <button className="btn-primary" onClick={() => {
            setEditingProduct(null);
            setForm({ nom: '', barcode: '', prix_unitaire: '', prix_revient: '', stock_qty: 0, unite: 'pièce', seuil_alerte: 5, description: '' });
            setIsModalOpen(true);
          }}>
            <Plus size={16} /> Nouveau Produit
          </button>
        </div>

        {/* Search */}
        <div style={{ marginBottom: 20 }}>
          <div className="search-bar">
            <Search size={18} color="var(--muted)" />
            <input 
              type="text" 
              placeholder="Rechercher par nom ou code-barres (scanner ici)..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
        </div>

        {/* Products Grid */}
        {loading ? (
          <p style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Chargement des produits...</p>
        ) : filteredProducts.length === 0 ? (
          <div className="empty-state">
            <Package size={40} />
            <p>Aucun produit trouvé</p>
            <small>Ajoutez votre premier produit en cliquant sur "Nouveau Produit".</small>
          </div>
        ) : (
          <div className="products-grid">
            {filteredProducts.map(p => {
              const isLow = p.stock_qty <= (p.seuil_alerte || 5);
              const marge = (+p.prix_unitaire || 0) - (+p.prix_revient || 0);
              return (
                <div key={p.id} className="product-card">
                  {/* Header card */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <h4 style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text)' }}>{p.nom}</h4>
                      {p.barcode ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--primary)', marginTop: 2 }}>
                          <Barcode size={13} /> {p.barcode}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 2 }}>Sans code-barres</div>
                      )}
                    </div>
                    <span className={`badge ${isLow ? 'badge-danger' : 'badge-success'}`}>
                      {isLow ? '⚠️ Alerte' : 'En stock'}
                    </span>
                  </div>

                  {/* Prices & Margins */}
                  <div style={{ background: 'rgba(79, 70, 229, 0.04)', borderRadius: 12, padding: 10, marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                      <span style={{ color: 'var(--muted)' }}>Prix Vente :</span>
                      <strong style={{ color: '#10b981', fontSize: '0.95rem' }}>{(+p.prix_unitaire || 0).toFixed(2)} DA</strong>
                    </div>
                    {p.prix_revient > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--muted)' }}>
                        <span>Coût revient :</span>
                        <span>{(+p.prix_revient).toFixed(2)} DA</span>
                      </div>
                    )}
                    {p.prix_revient > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginTop: 4, borderTop: '1px dashed var(--card-border)', paddingTop: 4 }}>
                        <span>Marge brute :</span>
                        <strong style={{ color: marge >= 0 ? '#10b981' : '#ef4444' }}>
                          {marge.toFixed(2)} DA ({((marge / (+p.prix_unitaire || 1)) * 100).toFixed(0)}%)
                        </strong>
                      </div>
                    )}
                  </div>

                  {/* Stock counter & Quick Adjust */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Stock disponible:</span>
                      <div style={{ fontSize: '1.2rem', fontWeight: 900, color: isLow ? '#ef4444' : 'var(--text)' }}>
                        {p.stock_qty} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{p.unite || 'pièce'}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button 
                        className="icon-btn" 
                        style={{ width: 30, height: 30, fontSize: '0.9rem', fontWeight: 800 }} 
                        onClick={() => handleQuickStockAdjust(p, -1)}
                        title="-1 unité"
                      >
                        -
                      </button>
                      <button 
                        className="icon-btn" 
                        style={{ width: 30, height: 30, fontSize: '0.9rem', fontWeight: 800 }} 
                        onClick={() => handleQuickStockAdjust(p, 1)}
                        title="+1 unité"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Card actions */}
                  <div style={{ display: 'flex', gap: 6, borderTop: '1px solid var(--card-border)', paddingTop: 10 }}>
                    <button 
                      className="btn-secondary" 
                      style={{ flex: 1, padding: '7px 10px', fontSize: '0.78rem' }}
                      onClick={() => {
                        setEditingProduct(p);
                        setForm({
                          nom: p.nom || '',
                          barcode: p.barcode || '',
                          prix_unitaire: p.prix_unitaire || '',
                          prix_revient: p.prix_revient || '',
                          stock_qty: p.stock_qty || 0,
                          unite: p.unite || 'pièce',
                          seuil_alerte: p.seuil_alerte || 5,
                          description: p.description || ''
                        });
                        setIsModalOpen(true);
                      }}
                    >
                      <Edit2 size={13} /> Modifier
                    </button>
                    <button 
                      className="icon-btn" 
                      style={{ color: '#ef4444', width: 34, height: 34 }} 
                      onClick={() => handleDelete(p)}
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

      {/* MODAL: Nouveau / Modifier Produit */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content animate-enter" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingProduct ? 'Modifier Produit' : 'Nouveau Produit & Code-barres'}</h3>
              <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSaveProduct}>
              <div className="form-group">
                <label>Nom du Produit *</label>
                <input 
                  className="form-control" 
                  required 
                  value={form.nom} 
                  onChange={e => setForm({ ...form, nom: e.target.value })} 
                  placeholder="Ex: Eau de Javel 1L" 
                />
              </div>

              <div className="form-group">
                <label>Code-barres (EAN / Barcode)</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    className="form-control" 
                    value={form.barcode} 
                    onChange={e => setForm({ ...form, barcode: e.target.value })} 
                    placeholder="Scanner ou saisir le code-barres..." 
                  />
                  <Barcode size={18} color="var(--muted)" style={{ position: 'absolute', right: 12, top: 13 }} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Prix de Vente (DA) *</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    required 
                    className="form-control" 
                    value={form.prix_unitaire} 
                    onChange={e => setForm({ ...form, prix_unitaire: e.target.value })} 
                    placeholder="Ex: 120" 
                  />
                </div>
                <div className="form-group">
                  <label>Prix de Revient (DA)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="form-control" 
                    value={form.prix_revient} 
                    onChange={e => setForm({ ...form, prix_revient: e.target.value })} 
                    placeholder="Coût matières + emb." 
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Stock Initial</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={form.stock_qty} 
                    onChange={e => setForm({ ...form, stock_qty: e.target.value })} 
                  />
                </div>
                <div className="form-group">
                  <label>Unité</label>
                  <select className="form-control" value={form.unite} onChange={e => setForm({ ...form, unite: e.target.value })}>
                    <option value="pièce">Pièce (Bouteille / Bidon)</option>
                    <option value="litre">Litre (L)</option>
                    <option value="kg">Kilogramme (kg)</option>
                    <option value="carton">Carton (Colis)</option>
                    <option value="pack">Pack</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Seuil d'Alerte Stock Minimum</label>
                <input 
                  type="number" 
                  className="form-control" 
                  value={form.seuil_alerte} 
                  onChange={e => setForm({ ...form, seuil_alerte: e.target.value })} 
                  placeholder="5" 
                />
              </div>

              <div className="form-group">
                <label>Description / Remarques</label>
                <textarea 
                  className="form-control" 
                  rows={2} 
                  value={form.description} 
                  onChange={e => setForm({ ...form, description: e.target.value })} 
                  placeholder="Détails du produit..." 
                />
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', padding: 14 }}>
                Enregistrer le Produit
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
