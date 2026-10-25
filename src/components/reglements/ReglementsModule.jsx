import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { DollarSign, Plus, ArrowDownLeft, ArrowUpRight, Search, CheckCircle, Trash2, Calendar, FileText } from 'lucide-react';
import Swal from 'sweetalert2';
import { format } from 'date-fns';

export default function ReglementsModule({ session, theme, companyId }) {
  const targetUid = companyId || session?.user?.id;
  const [activeTab, setActiveTab] = useState('clients'); // 'clients' | 'fournisseurs'
  const [regClients, setRegClients] = useState([]);
  const [regFourn, setRegFourn] = useState([]);
  const [clients, setClients] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [ventes, setVentes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    party_id: '',
    party_nom: '',
    montant: '',
    mode_paiement: 'espèces',
    reference: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, [session, targetUid]);

  const fetchData = async () => {
    if (!session || !targetUid) return;
    setLoading(true);
    try {
      const [rcRes, rfRes, cRes, fRes, vRes] = await Promise.all([
        supabase.from('reglements_clients').select('*').eq('user_id', targetUid).order('date', { ascending: false }),
        supabase.from('reglements_fournisseurs').select('*').eq('user_id', targetUid).order('date', { ascending: false }),
        supabase.from('clients').select('*').eq('user_id', targetUid).order('nom'),
        supabase.from('fournisseurs').select('*').eq('user_id', targetUid).order('nom'),
        supabase.from('ventes').select('*').eq('user_id', targetUid).order('date', { ascending: false })
      ]);

      setRegClients(rcRes.data || []);
      setRegFourn(rfRes.data || []);
      setClients(cRes.data || []);
      setFournisseurs(fRes.data || []);
      setVentes(vRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const totalRegClients = regClients.reduce((s, r) => s + (+r.montant || 0), 0);
    const totalRegFourn = regFourn.reduce((s, r) => s + (+r.montant || 0), 0);
    const totalDettesClients = ventes.filter(v => !v.est_paye).reduce((s, v) => s + (v.total_prix || v.prix * v.quantite || 0), 0);
    return { totalRegClients, totalRegFourn, totalDettesClients };
  }, [regClients, regFourn, ventes]);

  const handleSaveReglement = async (e) => {
    e.preventDefault();
    if (!form.party_nom || !form.montant || +form.montant <= 0) return;

    const isClient = activeTab === 'clients';
    const table = isClient ? 'reglements_clients' : 'reglements_fournisseurs';

    try {
      const payload = isClient ? {
        user_id: targetUid,
        client_id: form.party_id || null,
        client_nom: form.party_nom,
        montant: +form.montant,
        mode_paiement: form.mode_paiement,
        reference: form.reference,
        date: form.date,
        notes: form.notes
      } : {
        user_id: targetUid,
        fournisseur_id: form.party_id || null,
        fournisseur_nom: form.party_nom,
        montant: +form.montant,
        mode_paiement: form.mode_paiement,
        reference: form.reference,
        date: form.date,
        notes: form.notes
      };

      const { error } = await supabase.from(table).insert([payload]);
      if (error) {
        if (isClient) setRegClients(prev => [{ ...payload, id: Date.now().toString() }, ...prev]);
        else setRegFourn(prev => [{ ...payload, id: Date.now().toString() }, ...prev]);
      }

      // Record in caisse
      try {
        await supabase.from('caisse').insert([{
          user_id: targetUid,
          type: isClient ? 'entree' : 'sortie',
          categorie: isClient ? 'reglement_client' : 'reglement_fournisseur',
          montant: +form.montant,
          description: `Règlement ${isClient ? 'Client' : 'Fournisseur'} ${form.party_nom} (${form.mode_paiement})`,
          date: form.date
        }]);
      } catch {}

      // If client payment, mark unpaid sales as paid starting from oldest
      if (isClient) {
        let remaining = +form.montant;
        const unpaidSales = ventes
          .filter(v => (!v.est_paye) && (v.client_nom?.toLowerCase() === form.party_nom.toLowerCase() || v.client_id === form.party_id))
          .sort((a,b) => new Date(a.date) - new Date(b.date));

        for (const sale of unpaidSales) {
          const sTot = sale.total_prix || sale.prix * sale.quantite;
          if (remaining >= sTot) {
            await supabase.from('ventes').update({ est_paye: true }).eq('id', sale.id);
            remaining -= sTot;
          } else {
            break;
          }
        }
      }

      Swal.fire({ icon: 'success', title: 'Règlement validé !', timer: 1000, showConfirmButton: false });
      setIsModalOpen(false);
      setForm({ party_id: '', party_nom: '', montant: '', mode_paiement: 'espèces', reference: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '' });
      fetchData();
    } catch (err) {
      Swal.fire('Erreur', err.message, 'error');
    }
  };

  const handleDelete = async (table, id) => {
    const res = await Swal.fire({
      title: 'Supprimer ce règlement ?',
      text: 'Action irréversible',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonText: 'Annuler',
      confirmButtonText: 'Oui, supprimer'
    });
    if (res.isConfirmed) {
      try {
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (error) throw error;
        if (table === 'reglements_clients') setRegClients(prev => prev.filter(x => x.id !== id));
        else setRegFourn(prev => prev.filter(x => x.id !== id));
        Swal.fire({ icon: 'success', title: 'Règlement supprimé !', timer: 700, showConfirmButton: false });
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
        <div className="stat-card" style={{ borderLeft: '5px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#10b981' }}>{stats.totalRegClients.toFixed(0)} DA</div>
              <div className="stat-label">Encaissé des Clients</div>
            </div>
            <ArrowDownLeft color="#10b981" size={28} />
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '5px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#ef4444' }}>{stats.totalDettesClients.toFixed(0)} DA</div>
              <div className="stat-label">Reste Dettes Clients</div>
            </div>
            <DollarSign color="#ef4444" size={28} />
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '5px solid #4f46e5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#4f46e5' }}>{stats.totalRegFourn.toFixed(0)} DA</div>
              <div className="stat-label">Versé aux Fournisseurs</div>
            </div>
            <ArrowUpRight color="#4f46e5" size={28} />
          </div>
        </div>
      </div>

      {/* Main glass card */}
      <div className="glass-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div className="module-tabs" style={{ margin: 0 }}>
            <button 
              className={`module-tab ${activeTab === 'clients' ? 'active' : ''}`}
              onClick={() => setActiveTab('clients')}
            >
              📥 Règlements Clients ({regClients.length})
            </button>
            <button 
              className={`module-tab ${activeTab === 'fournisseurs' ? 'active' : ''}`}
              onClick={() => setActiveTab('fournisseurs')}
            >
              📤 Règlements Fournisseurs ({regFourn.length})
            </button>
          </div>

          <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={16} /> Enregistrer un Règlement
          </button>
        </div>

        {/* TAB 1: Clients */}
        {activeTab === 'clients' && (
          <div className="table-wrapper">
            {loading ? (
              <p style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>Chargement...</p>
            ) : regClients.length === 0 ? (
              <div className="empty-state">
                <DollarSign size={40} />
                <p>Aucun règlement client enregistré</p>
                <small>Les encaissements de dettes et acomptes clients s'affichent ici.</small>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Nom Client</th>
                    <th>Montant Encaissé</th>
                    <th>Mode de Paiement</th>
                    <th>Référence / N° Chèque</th>
                    <th>Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {regClients.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>{r.date}</td>
                      <td><strong>{r.client_nom}</strong></td>
                      <td>
                        <strong style={{ color: '#10b981', fontSize: '1rem' }}>+{(+r.montant || 0).toFixed(2)} DA</strong>
                      </td>
                      <td>
                        <span className="badge badge-purple" style={{ textTransform: 'capitalize' }}>
                          {r.mode_paiement}
                        </span>
                      </td>
                      <td>{r.reference || '—'}</td>
                      <td>{r.notes || '—'}</td>
                      <td>
                        <button className="icon-btn" title="Supprimer" style={{ color: '#ef4444' }} onClick={() => handleDelete('reglements_clients', r.id)}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 2: Fournisseurs */}
        {activeTab === 'fournisseurs' && (
          <div className="table-wrapper">
            {regFourn.length === 0 ? (
              <div className="empty-state">
                <DollarSign size={40} />
                <p>Aucun paiement fournisseur enregistré</p>
                <small>Enregistrez vos règlements pour suivre vos dettes auprès des fournisseurs.</small>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Fournisseur</th>
                    <th>Montant Versé</th>
                    <th>Mode de Paiement</th>
                    <th>Référence</th>
                    <th>Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {regFourn.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>{r.date}</td>
                      <td><strong>{r.fournisseur_nom}</strong></td>
                      <td>
                        <strong style={{ color: '#ef4444', fontSize: '1rem' }}>-{(+r.montant || 0).toFixed(2)} DA</strong>
                      </td>
                      <td>
                        <span className="badge badge-purple" style={{ textTransform: 'capitalize' }}>
                          {r.mode_paiement}
                        </span>
                      </td>
                      <td>{r.reference || '—'}</td>
                      <td>{r.notes || '—'}</td>
                      <td>
                        <button className="icon-btn" title="Supprimer" style={{ color: '#ef4444' }} onClick={() => handleDelete('reglements_fournisseurs', r.id)}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content animate-enter" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {activeTab === 'clients' ? '📥 Encaisser un Règlement Client' : '📤 Payer un Fournisseur'}
              </h3>
              <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSaveReglement}>
              <div className="form-group">
                <label>{activeTab === 'clients' ? 'Client' : 'Fournisseur'} *</label>
                <select 
                  className="form-control"
                  value={form.party_id}
                  onChange={e => {
                    const list = activeTab === 'clients' ? clients : fournisseurs;
                    const item = list.find(x => x.id === e.target.value);
                    setForm(f => ({
                      ...f,
                      party_id: e.target.value,
                      party_nom: item ? item.nom : f.party_nom
                    }));
                  }}
                >
                  <option value="">-- Choisir dans la liste ou taper ci-dessous --</option>
                  {(activeTab === 'clients' ? clients : fournisseurs).map(item => (
                    <option key={item.id} value={item.id}>{item.nom}</option>
                  ))}
                </select>
              </div>

              {!form.party_id && (
                <div className="form-group">
                  <label>Nom {activeTab === 'clients' ? 'du Client' : 'du Fournisseur'} *</label>
                  <input 
                    className="form-control" 
                    required 
                    value={form.party_nom} 
                    onChange={e => setForm({ ...form, party_nom: e.target.value })} 
                    placeholder="Nom complet" 
                  />
                </div>
              )}

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
                    placeholder="Ex: 10000" 
                  />
                </div>
                <div className="form-group">
                  <label>Date de Paiement</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={form.date} 
                    onChange={e => setForm({ ...form, date: e.target.value })} 
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Mode de Règlement</label>
                  <select className="form-control" value={form.mode_paiement} onChange={e => setForm({ ...form, mode_paiement: e.target.value })}>
                    <option value="espèces">Espèces (Caisse)</option>
                    <option value="chèque">Chèque</option>
                    <option value="virement">Virement bancaire</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>N° Chèque / Réf Virement</label>
                  <input 
                    className="form-control" 
                    value={form.reference} 
                    onChange={e => setForm({ ...form, reference: e.target.value })} 
                    placeholder="CHQ-XXXX" 
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Notes / Observations</label>
                <input 
                  className="form-control" 
                  value={form.notes} 
                  onChange={e => setForm({ ...form, notes: e.target.value })} 
                  placeholder="Remarques..." 
                />
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', padding: 14 }}>
                Valider et Mettre à Jour la Caisse
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
