import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { RotateCcw, Plus, Trash2, Package, AlertTriangle, CheckCircle } from 'lucide-react';
import Swal from 'sweetalert2';
import { format } from 'date-fns';

export default function RetoursModule({ session, theme, companyId }) {
  const targetUid = companyId || session?.user?.id;
  const [retours, setRetours] = useState([]);
  const [ventes, setVentes] = useState([]);
  const [produits, setProduits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [form, setForm] = useState({
    vente_id: '',
    produit_id: '',
    produit_nom: '',
    quantite: 1,
    motif: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    action: 'stock', // 'stock' = retour en stock, 'perdu' = marchandise perdue
  });

  useEffect(() => { fetchData(); }, [targetUid]);

  const fetchData = async () => {
    if (!session || !targetUid) return;
    setLoading(true);
    try {
      const [retRes, vRes, pRes] = await Promise.all([
        supabase.from('retours').select('*').eq('user_id', targetUid).order('date', { ascending: false }),
        supabase.from('ventes').select('*').eq('user_id', targetUid).order('date', { ascending: false }),
        supabase.from('products').select('*').eq('user_id', targetUid).order('nom'),
      ]);
      setRetours(retRes.data || []);
      setVentes(vRes.data || []);
      setProduits(pRes.data || []);
    } catch (e) {
      console.error(e);
      // Fallback: try without retours table
      try {
        const [vRes, pRes] = await Promise.all([
          supabase.from('ventes').select('*').eq('user_id', targetUid).order('date', { ascending: false }),
          supabase.from('products').select('*').eq('user_id', targetUid).order('nom'),
        ]);
        setVentes(vRes.data || []);
        setProduits(pRes.data || []);
        setRetours([]);
      } catch (e2) { console.error(e2); }
    } finally {
      setLoading(false);
    }
  };

  const venteSelectionnee = useMemo(() =>
    ventes.find(v => v.id === form.vente_id), [ventes, form.vente_id]);

  const handleVenteChange = (venteId) => {
    const v = ventes.find(x => x.id === venteId);
    if (v) {
      const prod = produits.find(p => p.id === v.product_id || p.id === v.produit_id);
      setForm(f => ({
        ...f,
        vente_id: venteId,
        produit_id: prod?.id || v.product_id || v.produit_id || '',
        produit_nom: v.produit_nom || v.nom || '',
        quantite: Math.min(1, v.quantite || 1),
      }));
    } else {
      setForm(f => ({ ...f, vente_id: venteId }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.vente_id || !form.produit_nom || !form.quantite) {
      Swal.fire('Erreur', 'Remplissez tous les champs obligatoires', 'error');
      return;
    }

    const qtyRetour = +form.quantite;

    try {
      // 1. Insérer le retour
      const payload = {
        user_id: targetUid,
        vente_id: form.vente_id || null,
        produit_id: form.produit_id || null,
        produit_nom: form.produit_nom,
        quantite: qtyRetour,
        motif: form.motif || '',
        action: form.action,
        date: form.date,
      };

      const { data: retourData, error: retErr } = await supabase
        .from('retours').insert([payload]).select();

      if (retErr) {
        const isRlsError = retErr.code === '42501' || retErr.message?.toLowerCase().includes('row-level security');
        Swal.fire({
          icon: 'warning',
          title: isRlsError ? 'Permission Supabase (RLS)' : 'Table Retours Manquante',
          html: isRlsError ? `
            La table existe mais les permissions RLS bloquent l'enregistrement.<br/><br/>
            Exécutez cette commande dans <b>Supabase SQL Editor</b> :<br/>
            <code style="font-size:0.8rem;display:block;text-align:left;margin-top:8px;background:#f1f5f9;padding:10px;border-radius:8px;font-weight:700;color:#0f172a;">
            ALTER TABLE IF EXISTS retours DISABLE ROW LEVEL SECURITY;
            </code>
          ` : `
            La table <b>retours</b> n'existe pas encore dans Supabase.<br/><br/>
            Exécutez ce SQL dans Supabase SQL Editor :<br/>
            <code style="font-size:0.75rem;display:block;text-align:left;margin-top:8px;background:#f1f5f9;padding:10px;border-radius:8px;">
            CREATE TABLE IF NOT EXISTS retours (<br/>
            &nbsp;&nbsp;id uuid DEFAULT gen_random_uuid() PRIMARY KEY,<br/>
            &nbsp;&nbsp;user_id uuid,<br/>
            &nbsp;&nbsp;vente_id uuid,<br/>
            &nbsp;&nbsp;produit_id uuid,<br/>
            &nbsp;&nbsp;produit_nom text,<br/>
            &nbsp;&nbsp;quantite numeric DEFAULT 1,<br/>
            &nbsp;&nbsp;motif text,<br/>
            &nbsp;&nbsp;action text DEFAULT 'stock',<br/>
            &nbsp;&nbsp;date date DEFAULT current_date,<br/>
            &nbsp;&nbsp;created_at timestamptz DEFAULT now()<br/>
            );<br/><br/>
            ALTER TABLE IF EXISTS retours DISABLE ROW LEVEL SECURITY;
            </code>
          `,
          confirmButtonColor: '#4f46e5'
        });
        return;
      }

      // 2. Si action = 'stock' → augmenter le stock du produit
      if (form.action === 'stock' && form.produit_id) {
        const prod = produits.find(p => p.id === form.produit_id);
        if (prod) {
          const newStock = (+prod.stock_qty || 0) + qtyRetour;
          await supabase.from('products').update({ stock_qty: newStock }).eq('id', form.produit_id);
        }
      }

      // 3. Mettre à jour la vente (réduire le total ou marquer partiellement retourné)
      if (venteSelectionnee) {
        const prixUnitaire = venteSelectionnee.total_prix / (venteSelectionnee.quantite || 1);
        const montantRetour = qtyRetour * prixUnitaire;
        const newTotal = Math.max(0, (venteSelectionnee.total_prix || 0) - montantRetour);
        const newQty = Math.max(0, (venteSelectionnee.quantite || 0) - qtyRetour);
        await supabase.from('ventes').update({
          total_prix: newTotal,
          quantite: newQty,
        }).eq('id', form.vente_id);
      }

      Swal.fire({
        icon: 'success',
        title: 'Retour Enregistré !',
        html: `<b>${qtyRetour} unité(s)</b> de <b>${form.produit_nom}</b> retournée(s).<br/>
          ${form.action === 'stock' ? '✅ Stock mis à jour.' : '⚠️ Marchandise perdue.'}`,
        timer: 2000, showConfirmButton: false
      });

      setIsModalOpen(false);
      setForm({
        vente_id: '', produit_id: '', produit_nom: '', quantite: 1,
        motif: '', date: format(new Date(), 'yyyy-MM-dd'), action: 'stock'
      });
      fetchData();
    } catch (err) {
      Swal.fire('Erreur', err.message, 'error');
    }
  };

  const handleDelete = async (id) => {
    const res = await Swal.fire({
      title: 'Supprimer ce retour ?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonText: 'Annuler',
      confirmButtonText: 'Supprimer'
    });
    if (res.isConfirmed) {
      try {
        const { error } = await supabase.from('retours').delete().eq('id', id);
        if (error) throw error;
        setRetours(prev => prev.filter(r => r.id !== id));
        Swal.fire({ icon: 'success', title: 'Supprimé !', timer: 800, showConfirmButton: false });
      } catch (err) {
        Swal.fire('Erreur', err.message, 'error');
      }
    }
  };

  const totalRetours = retours.length;
  const totalQtyRetour = retours.reduce((s, r) => s + (+r.quantite || 0), 0);

  return (
    <div className="animate-enter">
      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card" style={{ borderLeft: '5px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#f59e0b' }}>{totalRetours}</div>
              <div className="stat-label">Total Retours</div>
            </div>
            <RotateCcw color="#f59e0b" size={28} />
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '5px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#ef4444' }}>{totalQtyRetour}</div>
              <div className="stat-label">Unités Retournées</div>
            </div>
            <Package color="#ef4444" size={28} />
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '5px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#10b981' }}>
                {retours.filter(r => r.action === 'stock').length}
              </div>
              <div className="stat-label">Réintégrés au Stock</div>
            </div>
            <CheckCircle color="#10b981" size={28} />
          </div>
        </div>
      </div>

      {/* Main card */}
      <div className="glass-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <h3 style={{ fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>↩️ Retours & Avoirs Clients</h3>
          <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={16} /> Nouveau Retour
          </button>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>Chargement...</p>
        ) : retours.length === 0 ? (
          <div className="empty-state">
            <RotateCcw size={40} />
            <p>Aucun retour enregistré</p>
            <small>Enregistrez les produits retournés par les clients pour corriger votre stock et vos factures.</small>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Produit Retourné</th>
                  <th>Quantité</th>
                  <th>Motif</th>
                  <th>Action Stock</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {retours.map(r => (
                  <tr key={r.id}>
                    <td>{r.date}</td>
                    <td><strong>{r.produit_nom}</strong></td>
                    <td>
                      <span className="badge badge-purple" style={{ fontSize: '0.85rem' }}>
                        {r.quantite} unités
                      </span>
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{r.motif || '—'}</td>
                    <td>
                      {r.action === 'stock'
                        ? <span className="badge badge-success">✅ Réintégré</span>
                        : <span className="badge" style={{ background: '#fee2e2', color: '#b91c1c' }}>⚠️ Perdu</span>
                      }
                    </td>
                    <td>
                      <button className="icon-btn" style={{ color: '#ef4444' }} title="Supprimer" onClick={() => handleDelete(r.id)}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content animate-enter" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>↩️ Enregistrer un Retour Client</h3>
              <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Vente Concernée *</label>
                <select className="form-control" value={form.vente_id} required
                  onChange={e => handleVenteChange(e.target.value)}>
                  <option value="">-- Sélectionner la vente --</option>
                  {ventes.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.date} | {v.produit_nom || v.nom} | {v.client_nom || 'Client'} | {v.total_prix?.toFixed(0)} DA
                    </option>
                  ))}
                </select>
              </div>

              {venteSelectionnee && (
                <div style={{ background: 'rgba(79,70,229,0.06)', borderRadius: 12, padding: '10px 14px', marginBottom: 12, fontSize: '0.85rem' }}>
                  <strong>Vente:</strong> {venteSelectionnee.quantite} × {venteSelectionnee.produit_nom || venteSelectionnee.nom} → {venteSelectionnee.total_prix?.toFixed(0)} DA
                  {!venteSelectionnee.est_paye && <span style={{ color: '#ef4444', marginLeft: 8 }}>⚠️ Non payée</span>}
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>Produit Retourné</label>
                  <input className="form-control" value={form.produit_nom}
                    onChange={e => setForm(f => ({ ...f, produit_nom: e.target.value }))}
                    placeholder="Nom du produit" required />
                </div>
                <div className="form-group">
                  <label>Quantité Retournée *</label>
                  <input type="number" min="1" className="form-control" value={form.quantite}
                    required onChange={e => setForm(f => ({ ...f, quantite: e.target.value }))} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Date du Retour</label>
                  <input type="date" className="form-control" value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Action sur le Stock</label>
                  <select className="form-control" value={form.action}
                    onChange={e => setForm(f => ({ ...f, action: e.target.value }))}>
                    <option value="stock">✅ Réintégrer au stock</option>
                    <option value="perdu">⚠️ Marchandise perdue / endommagée</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Motif du Retour</label>
                <input className="form-control" value={form.motif}
                  onChange={e => setForm(f => ({ ...f, motif: e.target.value }))}
                  placeholder="Ex: Produit défectueux, Mauvaise commande..." />
              </div>

              <div style={{ background: form.action === 'stock' ? '#dcfce7' : '#fee2e2', borderRadius: 12, padding: '10px 14px', marginBottom: 16, fontSize: '0.85rem', fontWeight: 700, color: form.action === 'stock' ? '#15803d' : '#b91c1c' }}>
                {form.action === 'stock'
                  ? `✅ ${form.quantite} unité(s) de "${form.produit_nom}" seront ajoutées au stock`
                  : `⚠️ ${form.quantite} unité(s) de "${form.produit_nom}" seront marquées comme perdues`
                }
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', padding: 14 }}>
                Valider le Retour
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
