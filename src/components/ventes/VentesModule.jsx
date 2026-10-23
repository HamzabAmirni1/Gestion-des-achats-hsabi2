import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { ShoppingCart, Plus, Search, Filter, Printer, FileText, CheckCircle, Trash2, DollarSign, AlertTriangle, Download, X } from 'lucide-react';
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';
import { format } from 'date-fns';

export default function VentesModule({ session, theme }) {
  const [ventes, setVentes] = useState([]);
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'paye' | 'credit'
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    client_id: '',
    client_nom: '',
    client_tel: '',
    product_id: '',
    nom: '',
    quantite: 1,
    prix: 1,
    remise: 0,
    est_paye: true,
    mode_paiement: 'espèces',
    date: format(new Date(), 'yyyy-MM-dd'),
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, [session]);

  const fetchData = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [vRes, cRes, pRes] = await Promise.all([
        supabase.from('ventes').select('*').order('date', { ascending: false }),
        supabase.from('clients').select('*').order('nom'),
        supabase.from('products').select('*').order('nom')
      ]);

      setVentes(vRes.data || []);
      setClients(cRes.data || []);
      setProducts(pRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredVentes = useMemo(() => {
    const q = search.toLowerCase();
    return ventes.filter(v => {
      const matchSearch = (v.nom && v.nom.toLowerCase().includes(q)) || 
                          (v.client_nom && v.client_nom.toLowerCase().includes(q)) ||
                          (v.client_tel && v.client_tel.toLowerCase().includes(q));
      const matchStatus = statusFilter === 'all' ? true : statusFilter === 'paye' ? v.est_paye : !v.est_paye;
      return matchSearch && matchStatus;
    });
  }, [ventes, search, statusFilter]);

  const stats = useMemo(() => {
    const totalCA = ventes.reduce((s, v) => s + (v.total_prix || v.prix * v.quantite || 0), 0);
    const totalDettes = ventes.filter(v => !v.est_paye).reduce((s, v) => s + (v.total_prix || v.prix * v.quantite || 0), 0);
    const totalEncaisse = totalCA - totalDettes;
    const countVentes = ventes.length;
    return { totalCA, totalDettes, totalEncaisse, countVentes };
  }, [ventes]);

  const handleCreateVente = async (e) => {
    e.preventDefault();
    if (!form.nom || !form.quantite || !form.prix) return;

    try {
      const totalCalcule = (+form.quantite) * (+form.prix) * (1 - (+form.remise || 0) / 100);

      const payload = {
        user_id: session.user.id,
        nom: form.nom,
        product_id: form.product_id || null,
        client_id: form.client_id || null,
        client_nom: form.client_nom || 'Client Particulier',
        client_tel: form.client_tel || '',
        quantite: +form.quantite,
        prix: +form.prix,
        remise: +form.remise || 0,
        est_paye: form.est_paye,
        mode_paiement: form.mode_paiement,
        date: form.date,
        notes: form.notes
      };

      const { data, error } = await supabase.from('ventes').insert([payload]).select();
      if (error) {
        // Fallback for original schema
        const safePayload = {
          user_id: session.user.id,
          nom: form.nom,
          product_id: form.product_id || null,
          client_nom: form.client_nom || 'Client Particulier',
          client_tel: form.client_tel || '',
          quantite: +form.quantite,
          prix: +form.prix,
          est_paye: form.est_paye,
          date: form.date
        };
        await supabase.from('ventes').insert([safePayload]);
      }

      // If tied to stock, decrease product stock
      if (form.product_id) {
        const prod = products.find(p => p.id === form.product_id);
        if (prod) {
          const newQty = Math.max(0, (+prod.stock_qty || 0) - (+form.quantite));
          await supabase.from('products').update({ stock_qty: newQty }).eq('id', form.product_id);
        }
      }

      // Record in caisse if paid
      if (form.est_paye) {
        try {
          await supabase.from('caisse').insert([{
            user_id: session.user.id,
            type: 'entree',
            categorie: 'vente',
            montant: totalCalcule,
            description: `Vente ${form.nom} à ${form.client_nom} (${form.mode_paiement})`,
            date: form.date
          }]);
        } catch {}
      }

      Swal.fire({ icon: 'success', title: 'Vente Enregistrée !', timer: 1000, showConfirmButton: false });
      setIsModalOpen(false);
      setForm({
        client_id: '',
        client_nom: '',
        client_tel: '',
        product_id: '',
        nom: '',
        quantite: 1,
        prix: 1,
        remise: 0,
        est_paye: true,
        mode_paiement: 'espèces',
        date: format(new Date(), 'yyyy-MM-dd'),
        notes: ''
      });
      fetchData();
    } catch (err) {
      Swal.fire('Erreur', err.message, 'error');
    }
  };

  const togglePayStatus = async (v) => {
    const newStatus = !v.est_paye;
    try {
      await supabase.from('ventes').update({ est_paye: newStatus }).eq('id', v.id);
      setVentes(prev => prev.map(x => x.id === v.id ? { ...x, est_paye: newStatus } : x));
      Swal.fire({
        icon: 'success',
        title: newStatus ? 'Marqué comme Payé' : 'Marqué comme Crédit',
        timer: 800,
        showConfirmButton: false
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id) => {
    const res = await Swal.fire({
      title: 'Supprimer cette vente ?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Supprimer'
    });
    if (res.isConfirmed) {
      await supabase.from('ventes').delete().eq('id', id);
      setVentes(prev => prev.filter(v => v.id !== id));
      Swal.fire({ icon: 'success', title: 'Supprimé', timer: 700, showConfirmButton: false });
    }
  };

  const generatePDFDoc = (v, docType = 'facture') => {
    const doc = new jsPDF();
    const W = doc.internal.pageSize.getWidth();
    const isBL = docType === 'bon_livraison';
    const total = v.total_prix || (v.prix * v.quantite);

    // Banner
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, W, 42, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text(isBL ? 'BON DE LIVRAISON' : 'FACTURE DE VENTE', 14, 22);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`BRASTI Production & Distribution`, 14, 30);
    doc.text(`Date : ${v.date || format(new Date(), 'yyyy-MM-dd')}`, W - 14, 30, { align: 'right' });

    // Client details
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 50, W - 28, 26, 3, 3, 'F');
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text(`Destinataire : ${v.client_nom || 'Client Particulier'}`, 20, 60);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Téléphone : ${v.client_tel || 'Non spécifié'}  |  Réf : VNT-${(v.id || '').substring(0, 8)}`, 20, 68);

    // Table Header
    let y = 88;
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, W - 28, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('ARTICLE / DESIGNATION', 20, y + 6.5);
    doc.text('QTE', 110, y + 6.5, { align: 'center' });
    doc.text('PRIX UNITAIRE', 145, y + 6.5, { align: 'center' });
    doc.text('TOTAL', W - 20, y + 6.5, { align: 'right' });

    // Table Row
    y += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(v.nom || 'Produit', 20, y);
    doc.text(`${v.quantite}`, 110, y, { align: 'center' });
    doc.text(`${(+v.prix).toFixed(2)} DA`, 145, y, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text(`${total.toFixed(2)} DA`, W - 20, y, { align: 'right' });

    doc.setDrawColor(226, 232, 240);
    doc.line(14, y + 8, W - 14, y + 8);

    // Total box
    y += 24;
    doc.setFillColor(79, 70, 229);
    doc.roundedRect(W - 90, y, 76, 22, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text('TOTAL NET A PAYER', W - 52, y + 8, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`${total.toFixed(2)} DA`, W - 52, y + 16, { align: 'center' });

    // Payment condition
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text(
      v.est_paye ? 'Statut : Payé en totalité (Acquitté).' : 'Statut : Montant à régler à crédit.',
      14,
      y + 12
    );

    // Signatures block for Bon de livraison
    if (isBL) {
      y += 50;
      doc.setDrawColor(203, 213, 225);
      doc.line(20, y + 20, 70, y + 20);
      doc.line(W - 70, y + 20, W - 20, y + 20);
      doc.setFontSize(8);
      doc.text('Signature & Cachet Livreur', 25, y + 26);
      doc.text('Signature & Cachet Client', W - 65, y + 26);
    }

    doc.save(`${isBL ? 'Bon_Livraison' : 'Facture'}_${(v.client_nom || 'Client').replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="animate-enter">
      {/* Top Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        <div className="stat-card" style={{ borderLeft: '5px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#10b981' }}>{stats.totalCA.toFixed(0)} DA</div>
              <div className="stat-label">Chiffre d'Affaires Total</div>
            </div>
            <ShoppingCart color="#10b981" size={28} />
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '5px solid #4f46e5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#4f46e5' }}>{stats.totalEncaisse.toFixed(0)} DA</div>
              <div className="stat-label">Total Encaissé</div>
            </div>
            <DollarSign color="#4f46e5" size={28} />
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '5px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#ef4444' }}>{stats.totalDettes.toFixed(0)} DA</div>
              <div className="stat-label">Non Payé (Crédits)</div>
            </div>
            <AlertTriangle color="#ef4444" size={28} />
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '5px solid #8b5cf6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#8b5cf6' }}>{stats.countVentes}</div>
              <div className="stat-label">Nombre de Transactions</div>
            </div>
            <FileText color="#8b5cf6" size={28} />
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="glass-container">
        <div className="section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h3>🛒 Mbi3at, Factures & Bons de Livraison</h3>
            <span className="badge badge-purple">{ventes.length} ventes</span>
          </div>
          <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={16} /> Nouvelle Vente
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div className="search-bar" style={{ flex: 1, minWidth: 220 }}>
            <Search size={18} color="var(--muted)" />
            <input 
              type="text" 
              placeholder="Rechercher client, téléphone ou article..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            {[
              ['all', 'Toutes'],
              ['paye', 'Payées'],
              ['credit', 'Crédit']
            ].map(([val, label]) => (
              <button 
                key={val} 
                className={`btn-secondary ${statusFilter === val ? 'btn-primary' : ''}`}
                style={{ padding: '8px 14px', fontSize: '0.82rem' }}
                onClick={() => setStatusFilter(val)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="table-wrapper">
          {loading ? (
            <p style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>Chargement des ventes...</p>
          ) : filteredVentes.length === 0 ? (
            <div className="empty-state">
              <ShoppingCart size={40} />
              <p>Aucune vente trouvée</p>
              <small>Cliquez sur "Nouvelle Vente" pour enregistrer une commande.</small>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Article & Quantité</th>
                  <th>Prix Unit.</th>
                  <th>Total</th>
                  <th>Paiement</th>
                  <th>Documents & Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVentes.map(v => {
                  const total = v.total_prix || (v.prix * v.quantite);
                  return (
                    <tr key={v.id}>
                      <td style={{ fontSize: '0.82rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                        {v.date}
                      </td>
                      <td>
                        <div style={{ fontWeight: 800 }}>{v.client_nom || 'Client Particulier'}</div>
                        {v.client_tel && <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{v.client_tel}</div>}
                      </td>
                      <td>
                        <strong>{v.nom}</strong>
                        <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}> × {v.quantite}</span>
                      </td>
                      <td>{(+v.prix).toFixed(2)} DA</td>
                      <td>
                        <strong style={{ color: '#4f46e5', fontSize: '1rem' }}>{total.toFixed(0)} DA</strong>
                      </td>
                      <td>
                        <button 
                          onClick={() => togglePayStatus(v)}
                          className={`badge ${v.est_paye ? 'badge-success' : 'badge-danger'}`}
                          style={{ cursor: 'pointer', border: 'none' }}
                          title="Cliquez pour changer le statut"
                        >
                          {v.est_paye ? '✓ Payé' : '⚠️ Crédit'}
                        </button>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button 
                            className="icon-btn" 
                            title="Télécharger Facture PDF"
                            onClick={() => generatePDFDoc(v, 'facture')}
                          >
                            <FileText size={15} />
                          </button>
                          <button 
                            className="icon-btn" 
                            title="Télécharger Bon de Livraison PDF"
                            onClick={() => generatePDFDoc(v, 'bon_livraison')}
                            style={{ color: '#06b6d4' }}
                          >
                            <Printer size={15} />
                          </button>
                          <button 
                            className="icon-btn" 
                            title="Supprimer" 
                            style={{ color: '#ef4444' }} 
                            onClick={() => handleDelete(v.id)}
                          >
                            <Trash2 size={15} />
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

      {/* MODAL: Nouvelle Vente */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content animate-enter" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🛒 Enregistrer une Vente</h3>
              <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleCreateVente}>
              {/* Product Picker */}
              <div className="form-group">
                <label>Produit à Vendre *</label>
                <select 
                  className="form-control" 
                  value={form.product_id}
                  onChange={e => {
                    const prod = products.find(p => p.id === e.target.value);
                    setForm(f => ({
                      ...f,
                      product_id: e.target.value,
                      nom: prod ? prod.nom : f.nom,
                      prix: prod ? (+prod.prix_unitaire || f.prix) : f.prix
                    }));
                  }}
                >
                  <option value="">-- Choisir dans le catalogue --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nom} (Stock: {p.stock_qty} | Prix: {p.prix_unitaire} DA)
                    </option>
                  ))}
                </select>
              </div>

              {!form.product_id && (
                <div className="form-group">
                  <label>Nom de l'article (si non listé)</label>
                  <input 
                    className="form-control" 
                    value={form.nom} 
                    onChange={e => setForm({ ...form, nom: e.target.value })} 
                    placeholder="Ex: Javel 5L" 
                  />
                </div>
              )}

              {/* Client Picker */}
              <div className="form-group">
                <label>Client (Sélectionner ou Saisir)</label>
                <select 
                  className="form-control" 
                  value={form.client_id}
                  onChange={e => {
                    const c = clients.find(x => x.id === e.target.value);
                    setForm(f => ({
                      ...f,
                      client_id: e.target.value,
                      client_nom: c ? c.nom : f.client_nom,
                      client_tel: c ? c.tel : f.client_tel
                    }));
                  }}
                >
                  <option value="">-- Choisir un client existant (ou taper ci-dessous) --</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.tel || 'Sans tél'})</option>)}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Nom du Client</label>
                  <input 
                    className="form-control" 
                    value={form.client_nom} 
                    onChange={e => setForm({ ...form, client_nom: e.target.value })} 
                    placeholder="Nom du client" 
                  />
                </div>
                <div className="form-group">
                  <label>Téléphone Client</label>
                  <input 
                    className="form-control" 
                    value={form.client_tel} 
                    onChange={e => setForm({ ...form, client_tel: e.target.value })} 
                    placeholder="06XXXXXXXX" 
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Quantité *</label>
                  <input 
                    type="number" 
                    min="1" 
                    required 
                    className="form-control" 
                    value={form.quantite} 
                    onChange={e => setForm({ ...form, quantite: e.target.value })} 
                  />
                </div>
                <div className="form-group">
                  <label>Prix Unitaire (DA) *</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    required 
                    className="form-control" 
                    value={form.prix} 
                    onChange={e => setForm({ ...form, prix: e.target.value })} 
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Date</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={form.date} 
                    onChange={e => setForm({ ...form, date: e.target.value })} 
                  />
                </div>
                <div className="form-group">
                  <label>Mode de Règlement</label>
                  <select 
                    className="form-control" 
                    value={form.mode_paiement} 
                    onChange={e => setForm({ ...form, mode_paiement: e.target.value })}
                  >
                    <option value="espèces">Espèces (Caisse)</option>
                    <option value="chèque">Chèque</option>
                    <option value="virement">Virement</option>
                    <option value="crédit">Crédit (Dette)</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
                <label style={{ margin: 0, cursor: 'pointer' }}>Paiement Réceptionné ?</label>
                <input 
                  type="checkbox" 
                  checked={form.est_paye} 
                  onChange={e => setForm({ ...form, est_paye: e.target.checked })} 
                  style={{ width: 20, height: 20, cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: form.est_paye ? '#10b981' : '#ef4444' }}>
                  {form.est_paye ? 'Payé en totalité' : 'Non payé (À crédit)'}
                </span>
              </div>

              {/* Total preview */}
              <div style={{ background: 'rgba(79, 70, 229, 0.08)', borderRadius: 12, padding: 12, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '1.1rem', color: 'var(--primary)' }}>
                  <span>Total Vente :</span>
                  <span>{((+form.prix || 0) * (+form.quantite || 0)).toFixed(2)} DA</span>
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', padding: 14 }}>
                Valider et Imprimer
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
