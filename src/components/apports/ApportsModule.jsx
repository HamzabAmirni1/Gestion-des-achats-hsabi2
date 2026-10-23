import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { TrendingUp, Plus, DollarSign, ArrowDownLeft, ArrowUpRight, ShieldCheck, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { format } from 'date-fns';

export default function ApportsModule({ session, theme }) {
  const [apports, setApports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    type: 'apport_personnel',
    montant: '',
    source: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  useEffect(() => {
    fetchApports();
  }, [session]);

  const fetchApports = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from('apports').select('*').order('date', { ascending: false });
      setApports(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const totalApports = apports.filter(a => a.type === 'apport_personnel').reduce((s, a) => s + (+a.montant || 0), 0);
    const totalInvest = apports.filter(a => a.type === 'investissement').reduce((s, a) => s + (+a.montant || 0), 0);
    const totalPretsRecus = apports.filter(a => a.type === 'pret_recu').reduce((s, a) => s + (+a.montant || 0), 0);
    const totalRembourse = apports.filter(a => a.type === 'remboursement_pret').reduce((s, a) => s + (+a.montant || 0), 0);
    const dettePretRestante = Math.max(0, totalPretsRecus - totalRembourse);
    const capitalInvesti = totalApports + totalInvest;
    return { totalApports, totalInvest, totalPretsRecus, totalRembourse, dettePretRestante, capitalInvesti };
  }, [apports]);

  const handleSaveApport = async (e) => {
    e.preventDefault();
    if (!form.montant || +form.montant <= 0) return;

    try {
      const payload = {
        user_id: session.user.id,
        type: form.type,
        montant: +form.montant,
        source: form.source || 'Fonds Propres',
        description: form.description,
        date: form.date
      };

      const { error } = await supabase.from('apports').insert([payload]);
      if (error) {
        setApports(prev => [{ ...payload, id: Date.now().toString() }, ...prev]);
      }

      // If it's an apport or pret received, register entry in caisse
      if (form.type === 'apport_personnel' || form.type === 'pret_recu') {
        try {
          await supabase.from('caisse').insert([{
            user_id: session.user.id,
            type: 'entree',
            categorie: 'apport',
            montant: +form.montant,
            description: `${form.type === 'apport_personnel' ? 'Apport personnel' : 'Prêt reçu'} de ${form.source || 'Fondateur'}`,
            date: form.date
          }]);
        } catch {}
      } else if (form.type === 'remboursement_pret') {
        try {
          await supabase.from('caisse').insert([{
            user_id: session.user.id,
            type: 'sortie',
            categorie: 'remboursement',
            montant: +form.montant,
            description: `Remboursement de prêt à ${form.source}`,
            date: form.date
          }]);
        } catch {}
      }

      Swal.fire({ icon: 'success', title: 'Opération Enregistrée !', timer: 900, showConfirmButton: false });
      setIsModalOpen(false);
      setForm({ type: 'apport_personnel', montant: '', source: '', description: '', date: format(new Date(), 'yyyy-MM-dd') });
      fetchApports();
    } catch (err) {
      Swal.fire('Erreur', err.message, 'error');
    }
  };

  const handleDelete = async (id) => {
    const res = await Swal.fire({
      title: 'Supprimer cette ligne ?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Supprimer'
    });
    if (res.isConfirmed) {
      await supabase.from('apports').delete().eq('id', id);
      setApports(prev => prev.filter(a => a.id !== id));
      Swal.fire({ icon: 'success', title: 'Supprimé', timer: 700, showConfirmButton: false });
    }
  };

  const getTypeLabel = (t) => {
    switch (t) {
      case 'apport_personnel': return { label: 'Apport Personnel', badge: 'badge-success' };
      case 'investissement': return { label: 'Investissement Matériel', badge: 'badge-purple' };
      case 'pret_recu': return { label: 'Prêt Reçu', badge: 'badge-warning' };
      case 'remboursement_pret': return { label: 'Remboursement Prêt', badge: 'badge-danger' };
      default: return { label: t, badge: 'badge-info' };
    }
  };

  return (
    <div className="animate-enter">
      {/* Top Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        <div className="stat-card" style={{ borderLeft: '5px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#10b981' }}>{stats.totalApports.toFixed(0)} DA</div>
              <div className="stat-label">Apports Personnels</div>
            </div>
            <ArrowDownLeft color="#10b981" size={28} />
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '5px solid #8b5cf6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#8b5cf6' }}>{stats.totalInvest.toFixed(0)} DA</div>
              <div className="stat-label">Investissements Équipements</div>
            </div>
            <ShieldCheck color="#8b5cf6" size={28} />
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '5px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#f59e0b' }}>{stats.dettePretRestante.toFixed(0)} DA</div>
              <div className="stat-label">Dettes Prêts Restantes</div>
            </div>
            <DollarSign color="#f59e0b" size={28} />
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '5px solid #4f46e5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#4f46e5' }}>{stats.capitalInvesti.toFixed(0)} DA</div>
              <div className="stat-label">Capital Global Injecté</div>
            </div>
            <TrendingUp color="#4f46e5" size={28} />
          </div>
        </div>
      </div>

      {/* Main glass card */}
      <div className="glass-container">
        <div className="section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h3>📈 Apports, Investissements & Prêts</h3>
            <span className="badge badge-purple">{apports.length} opérations</span>
          </div>
          <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={16} /> Nouvelle Opération
          </button>
        </div>

        {/* Table */}
        <div className="table-wrapper">
          {loading ? (
            <p style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>Chargement...</p>
          ) : apports.length === 0 ? (
            <div className="empty-state">
              <TrendingUp size={40} />
              <p>Aucune contribution enregistrée</p>
              <small>Enregistrez vos apports en fonds propres, achats de machines ou emprunts bancaires.</small>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type d'Opération</th>
                  <th>Source / Investisseur</th>
                  <th>Description</th>
                  <th>Montant</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {apports.map(a => {
                  const meta = getTypeLabel(a.type);
                  return (
                    <tr key={a.id}>
                      <td style={{ fontSize: '0.82rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{a.date}</td>
                      <td>
                        <span className={`badge ${meta.badge}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td><strong>{a.source || 'Fonds Propres'}</strong></td>
                      <td>{a.description || '—'}</td>
                      <td>
                        <strong style={{ fontSize: '1rem', color: a.type === 'remboursement_pret' ? '#ef4444' : '#10b981' }}>
                          {a.type === 'remboursement_pret' ? '-' : '+'}{(+a.montant || 0).toFixed(2)} DA
                        </strong>
                      </td>
                      <td>
                        <button className="icon-btn" title="Supprimer" style={{ color: '#ef4444' }} onClick={() => handleDelete(a.id)}>
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

      {/* MODAL */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content animate-enter" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📈 Enregistrer un Financement / Investissement</h3>
              <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSaveApport}>
              <div className="form-group">
                <label>Nature de l'Opération *</label>
                <select className="form-control" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  <option value="apport_personnel">💰 Apport Personnel (Fonds propres)</option>
                  <option value="investissement">⚙️ Investissement Équipement / Machine</option>
                  <option value="pret_recu">🤝 Prêt Reçu (Emprunt / Dette)</option>
                  <option value="remboursement_pret">💸 Remboursement de Prêt</option>
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
                    value={form.montant} 
                    onChange={e => setForm({ ...form, montant: e.target.value })} 
                    placeholder="Ex: 100000" 
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
                <label>Source / Partenaire / Banque</label>
                <input 
                  className="form-control" 
                  value={form.source} 
                  onChange={e => setForm({ ...form, source: e.target.value })} 
                  placeholder="Ex: Banque Badr, Fondateur Amirni, Associé..." 
                />
              </div>

              <div className="form-group">
                <label>Description / Détails</label>
                <input 
                  className="form-control" 
                  value={form.description} 
                  onChange={e => setForm({ ...form, description: e.target.value })} 
                  placeholder="Ex: Achat remplisseuse automatique..." 
                />
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', padding: 14 }}>
                Valider l'Opération
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
