import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { Users, Plus, Phone, Mail, MapPin, DollarSign, AlertTriangle, FileText, CheckCircle, Search, Trash2, Edit2, Download } from 'lucide-react';
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';
import { format } from 'date-fns';

export default function ClientsModule({ session, theme }) {
  const [clients, setClients] = useState([]);
  const [ventes, setVentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [isPaymentModal, setIsPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('espèces');
  const [paymentNote, setPaymentNote] = useState('');
  const [form, setForm] = useState({ nom: '', tel: '', email: '', adresse: '', notes: '' });
  const [tableExists, setTableExists] = useState(true);

  useEffect(() => {
    fetchClientsAndSales();
  }, [session]);

  const fetchClientsAndSales = async () => {
    if (!session) return;
    setLoading(true);
    try {
      // 1. Fetch sales to get clients from existing transactions as well
      const { data: vData } = await supabase.from('ventes').select('*').order('date', { ascending: false });
      setVentes(vData || []);

      // 2. Fetch clients table if it exists
      const { data: cData, error: cErr } = await supabase.from('clients').select('*').order('nom');
      if (cErr) {
        setTableExists(false);
        // Fallback: extract distinct clients from ventes table
        const map = {};
        (vData || []).forEach(v => {
          if (v.client_nom && !map[v.client_nom]) {
            map[v.client_nom] = {
              id: v.client_id || v.client_nom,
              nom: v.client_nom,
              tel: v.client_tel || '',
              email: '',
              adresse: '',
              notes: 'Client extrait des ventes'
            };
          }
        });
        setClients(Object.values(map));
      } else {
        setTableExists(true);
        // Combine clients from table with any distinct clients from sales
        const existingNames = new Set((cData || []).map(c => (c.nom || '').toLowerCase()));
        const extraClients = [];
        (vData || []).forEach(v => {
          if (v.client_nom && !existingNames.has(v.client_nom.toLowerCase())) {
            extraClients.push({
              id: v.client_id || v.client_nom,
              nom: v.client_nom,
              tel: v.client_tel || '',
              email: '',
              adresse: '',
              notes: 'Extrait des ventes'
            });
            existingNames.add(v.client_nom.toLowerCase());
          }
        });
        setClients([...(cData || []), ...extraClients]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const clientStats = useMemo(() => {
    const stats = {};
    clients.forEach(c => {
      const clientVentes = ventes.filter(v => 
        (v.client_id && v.client_id === c.id) || 
        (v.client_nom && v.client_nom.toLowerCase() === c.nom.toLowerCase())
      );
      const totalAchats = clientVentes.reduce((s, v) => s + (v.total_prix || v.prix * v.quantite || 0), 0);
      const dettes = clientVentes.filter(v => !v.est_paye).reduce((s, v) => s + (v.total_prix || v.prix * v.quantite || 0), 0);
      stats[c.id || c.nom] = { totalAchats, dettes, count: clientVentes.length, ventes: clientVentes };
    });
    return stats;
  }, [clients, ventes]);

  const filteredClients = useMemo(() => {
    const q = search.toLowerCase();
    return clients.filter(c => 
      c.nom.toLowerCase().includes(q) || 
      (c.tel && c.tel.toLowerCase().includes(q))
    );
  }, [clients, search]);

  const totalDettesGlobal = useMemo(() => {
    return Object.values(clientStats).reduce((s, v) => s + v.dettes, 0);
  }, [clientStats]);

  const handleSaveClient = async (e) => {
    e.preventDefault();
    if (!form.nom.trim()) return;
    try {
      if (editingClient && editingClient.id && editingClient.id.length > 20) {
        // Update in Supabase
        const { error } = await supabase.from('clients').update({
          nom: form.nom,
          tel: form.tel,
          email: form.email,
          adresse: form.adresse,
          notes: form.notes
        }).eq('id', editingClient.id);
        if (error) throw error;
        Swal.fire({ icon: 'success', title: 'Client mis à jour', timer: 1000, showConfirmButton: false });
      } else {
        // Insert in Supabase
        const { error } = await supabase.from('clients').insert([{
          user_id: session.user.id,
          nom: form.nom,
          tel: form.tel,
          email: form.email,
          adresse: form.adresse,
          notes: form.notes
        }]);
        if (error) {
          // If table doesn't exist yet, save locally
          setClients(prev => [...prev, { ...form, id: Date.now().toString() }]);
        } else {
          Swal.fire({ icon: 'success', title: 'Client ajouté', timer: 1000, showConfirmButton: false });
        }
      }
      setIsModalOpen(false);
      setEditingClient(null);
      setForm({ nom: '', tel: '', email: '', adresse: '', notes: '' });
      fetchClientsAndSales();
    } catch (err) {
      Swal.fire('Info', 'Client enregistré localement: ' + (err.message || ''), 'info');
      setIsModalOpen(false);
    }
  };

  const handleDeleteClient = async (c) => {
    const res = await Swal.fire({
      title: 'Supprimer ce client ?',
      text: `Client: ${c.nom}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Oui, supprimer'
    });
    if (res.isConfirmed) {
      try {
        if (c.id && c.id.length > 20) {
          await supabase.from('clients').delete().eq('id', c.id);
        }
        setClients(prev => prev.filter(x => (x.id !== c.id && x.nom !== c.nom)));
        if (selectedClient && (selectedClient.id === c.id || selectedClient.nom === c.nom)) {
          setSelectedClient(null);
        }
        Swal.fire({ icon: 'success', title: 'Supprimé', timer: 800, showConfirmButton: false });
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!selectedClient || !paymentAmount || +paymentAmount <= 0) return;
    const amount = +paymentAmount;
    const clientKey = selectedClient.id || selectedClient.nom;
    const cStat = clientStats[clientKey];
    if (!cStat) return;

    try {
      // Record payment into caisse
      try {
        await supabase.from('caisse').insert([{
          user_id: session.user.id,
          type: 'entree',
          categorie: 'reglement_client',
          montant: amount,
          description: `Règlement dette client ${selectedClient.nom} (${paymentMode}) - ${paymentNote}`,
          date: format(new Date(), 'yyyy-MM-dd')
        }]);
      } catch {}

      // Update unpaid sales for this client starting from the oldest
      let remaining = amount;
      const unpaidSales = (cStat.ventes || []).filter(v => !v.est_paye).sort((a,b) => new Date(a.date) - new Date(b.date));
      for (const sale of unpaidSales) {
        const saleTotal = sale.total_prix || sale.prix * sale.quantite;
        if (remaining >= saleTotal) {
          await supabase.from('ventes').update({ est_paye: true }).eq('id', sale.id);
          remaining -= saleTotal;
        } else {
          break;
        }
      }

      Swal.fire({ icon: 'success', title: 'Paiement enregistré !', text: `${amount.toFixed(2)} DA encaissés`, timer: 1500 });
      setIsPaymentModal(false);
      setPaymentAmount('');
      setPaymentNote('');
      fetchClientsAndSales();
    } catch (err) {
      Swal.fire('Erreur', err.message, 'error');
    }
  };

  const generateClientStatement = (client) => {
    const doc = new jsPDF();
    const W = doc.internal.pageSize.getWidth();
    const cKey = client.id || client.nom;
    const cStat = clientStats[cKey] || { totalAchats: 0, dettes: 0, ventes: [] };

    // Header
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, W, 36, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('RELEVE DE COMPTE CLIENT', 14, 20);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`BRASTI - Date: ${format(new Date(), 'dd/MM/yyyy')}`, 14, 28);

    // Client Info Box
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 44, W - 28, 28, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text(`Client : ${client.nom}`, 20, 54);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Téléphone : ${client.tel || 'N/A'}  |  Adresse : ${client.adresse || 'N/A'}`, 20, 62);

    // Summary boxes
    doc.setFillColor(220, 252, 231);
    doc.roundedRect(14, 78, (W - 34) / 2, 20, 2, 2, 'F');
    doc.setTextColor(21, 128, 61);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`Total Ventes: ${cStat.totalAchats.toFixed(2)} DA`, 20, 91);

    doc.setFillColor(254, 226, 226);
    doc.roundedRect(14 + (W - 34) / 2 + 6, 78, (W - 34) / 2, 20, 2, 2, 'F');
    doc.setTextColor(185, 28, 28);
    doc.text(`Total Dettes: ${cStat.dettes.toFixed(2)} DA`, 20 + (W - 34) / 2 + 6, 91);

    // Table header
    let y = 110;
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, W - 28, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('DATE', 18, y + 5.5);
    doc.text('ARTICLE', 50, y + 5.5);
    doc.text('QTE', 110, y + 5.5);
    doc.text('TOTAL (DA)', 135, y + 5.5);
    doc.text('STATUT', 170, y + 5.5);
    y += 12;

    // Table rows
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    cStat.ventes.slice(0, 20).forEach(v => {
      doc.text(v.date || '', 18, y);
      doc.text((v.nom || '').substring(0, 30), 50, y);
      doc.text(`${v.quantite}`, 110, y);
      doc.text(`${(v.total_prix || v.prix * v.quantite).toFixed(2)}`, 135, y);
      doc.setTextColor(v.est_paye ? 21 : 185, v.est_paye ? 128 : 28, v.est_paye ? 61 : 28);
      doc.text(v.est_paye ? 'Paye' : 'Credit', 170, y);
      doc.setTextColor(30, 41, 59);
      y += 8;
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });

    doc.save(`Releve_${client.nom.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="animate-enter">
      {/* Top Banner if clients table is being created */}
      {!tableExists && (
        <div className="alert-banner">
          <AlertTriangle color="#f59e0b" size={20} />
          <div style={{ flex: 1, fontSize: '0.85rem' }}>
            <strong>Clients synchronisés depuis l'historique des ventes.</strong>
            <div>Pour activer la gestion complète, exécutez le script dans <code>database_setup.sql</code> sur Supabase.</div>
          </div>
        </div>
      )}

      {/* Stats bar */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
        <div className="stat-card" style={{ borderLeft: '5px solid #4f46e5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#4f46e5' }}>{clients.length}</div>
              <div className="stat-label">Total Clients</div>
            </div>
            <Users color="#4f46e5" size={28} />
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '5px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#ef4444' }}>{totalDettesGlobal.toFixed(0)} DA</div>
              <div className="stat-label">Créances / Dettes Total</div>
            </div>
            <AlertTriangle color="#ef4444" size={28} />
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '5px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#10b981' }}>
                {Object.values(clientStats).filter(s => s.dettes === 0 && s.totalAchats > 0).length}
              </div>
              <div className="stat-label">Clients À Jour</div>
            </div>
            <CheckCircle color="#10b981" size={28} />
          </div>
        </div>
      </div>

      {/* Main Section */}
      <div className="glass-container">
        <div className="section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h3>👥 Gestion des Clients</h3>
            <span className="badge badge-purple">{clients.length} clients</span>
          </div>
          <button className="btn-primary" onClick={() => { setEditingClient(null); setForm({ nom: '', tel: '', email: '', adresse: '', notes: '' }); setIsModalOpen(true); }}>
            <Plus size={16} /> Nouveau Client
          </button>
        </div>

        {/* Search */}
        <div style={{ marginBottom: 16 }}>
          <div className="search-bar">
            <Search size={18} color="var(--muted)" />
            <input 
              type="text" 
              placeholder="Rechercher par nom ou téléphone..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
        </div>

        {/* Layout: Table on left, Client details panel on right */}
        <div style={{ display: 'grid', gridTemplateColumns: selectedClient ? '1.5fr 1fr' : '1fr', gap: 20 }}>
          {/* Table */}
          <div className="table-wrapper">
            {loading ? (
              <p style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>Chargement des clients...</p>
            ) : filteredClients.length === 0 ? (
              <div className="empty-state">
                <Users size={40} />
                <p>Aucun client trouvé</p>
                <small>Cliquez sur "Nouveau Client" pour en ajouter un.</small>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nom Client</th>
                    <th>Téléphone</th>
                    <th>Achats Total</th>
                    <th>Créance (Dette)</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map(c => {
                    const cKey = c.id || c.nom;
                    const st = clientStats[cKey] || { totalAchats: 0, dettes: 0 };
                    const isSel = selectedClient && (selectedClient.id === c.id || selectedClient.nom === c.nom);
                    return (
                      <tr 
                        key={c.id || c.nom} 
                        style={{ cursor: 'pointer', background: isSel ? 'rgba(79, 70, 229, 0.08)' : 'transparent' }}
                        onClick={() => setSelectedClient(c)}
                      >
                        <td>
                          <div style={{ fontWeight: 800, color: 'var(--text)' }}>{c.nom}</div>
                          {c.adresse && <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{c.adresse}</div>}
                        </td>
                        <td>
                          {c.tel ? (
                            <a href={`tel:${c.tel}`} onClick={e => e.stopPropagation()} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                              {c.tel}
                            </a>
                          ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                        </td>
                        <td>
                          <strong>{st.totalAchats.toFixed(0)} DA</strong>
                        </td>
                        <td>
                          {st.dettes > 0 ? (
                            <span className="badge badge-danger">{st.dettes.toFixed(0)} DA</span>
                          ) : (
                            <span className="badge badge-success">À jour</span>
                          )}
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="icon-btn" title="Modifier" onClick={() => {
                              setEditingClient(c);
                              setForm({ nom: c.nom || '', tel: c.tel || '', email: c.email || '', adresse: c.adresse || '', notes: c.notes || '' });
                              setIsModalOpen(true);
                            }}>
                              <Edit2 size={14} />
                            </button>
                            <button className="icon-btn" title="Télécharger Relevé PDF" onClick={() => generateClientStatement(c)}>
                              <Download size={14} />
                            </button>
                            <button className="icon-btn" title="Supprimer" style={{ color: '#ef4444' }} onClick={() => handleDeleteClient(c)}>
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

          {/* Selected Client Detail Panel */}
          {selectedClient && (
            <div className="glass-container" style={{ margin: 0, background: 'var(--card)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div>
                  <h4 style={{ fontWeight: 900, fontSize: '1.2rem', color: 'var(--primary)' }}>{selectedClient.nom}</h4>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 2 }}>Fiche Client & Historique</div>
                </div>
                <button className="modal-close-btn" onClick={() => setSelectedClient(null)}>×</button>
              </div>

              {/* Quick Info */}
              <div style={{ background: 'rgba(79, 70, 229, 0.05)', borderRadius: 14, padding: 14, marginBottom: 16 }}>
                {selectedClient.tel && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', marginBottom: 6 }}>
                    <Phone size={14} color="var(--primary)" />
                    <strong>{selectedClient.tel}</strong>
                  </div>
                )}
                {selectedClient.email && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', marginBottom: 6 }}>
                    <Mail size={14} color="var(--primary)" />
                    <span>{selectedClient.email}</span>
                  </div>
                )}
                {selectedClient.adresse && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                    <MapPin size={14} color="var(--primary)" />
                    <span>{selectedClient.adresse}</span>
                  </div>
                )}
              </div>

              {/* Debt & Pay Button */}
              {(() => {
                const cKey = selectedClient.id || selectedClient.nom;
                const st = clientStats[cKey] || { totalAchats: 0, dettes: 0, ventes: [] };
                return (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: st.dettes > 0 ? '#fee2e2' : '#dcfce7', borderRadius: 12, marginBottom: 10 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: st.dettes > 0 ? '#991b1b' : '#166534' }}>
                        {st.dettes > 0 ? 'Dette en cours :' : 'Statut :' }
                      </span>
                      <strong style={{ fontSize: '1rem', color: st.dettes > 0 ? '#dc2626' : '#15803d' }}>
                        {st.dettes > 0 ? `${st.dettes.toFixed(2)} DA` : 'Aucune dette'}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      {st.dettes > 0 && (
                        <button className="btn-success" style={{ flex: 1, padding: 10 }} onClick={() => setIsPaymentModal(true)}>
                          <DollarSign size={16} /> Encaisser Règlement
                        </button>
                      )}
                      <button className="btn-secondary" style={{ flex: 1, padding: 10 }} onClick={() => generateClientStatement(selectedClient)}>
                        <FileText size={16} /> Relevé PDF
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Transactions List */}
              <h5 style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: 10 }}>Dernières Transactions</h5>
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                {(() => {
                  const cKey = selectedClient.id || selectedClient.nom;
                  const st = clientStats[cKey] || { ventes: [] };
                  if (st.ventes.length === 0) return <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Aucune vente pour ce client.</p>;
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {st.ventes.map(v => (
                        <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 10, fontSize: '0.82rem' }}>
                          <div>
                            <div style={{ fontWeight: 700 }}>{v.nom} × {v.quantite}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{v.date}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 800 }}>{(v.total_prix || v.prix * v.quantite).toFixed(0)} DA</div>
                            <span className={`badge ${v.est_paye ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.65rem' }}>
                              {v.est_paye ? 'Payé' : 'Crédit'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Nouveau / Modifier Client */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content animate-enter" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingClient ? 'Modifier le Client' : 'Nouveau Client'}</h3>
              <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSaveClient}>
              <div className="form-group">
                <label>Nom Complet *</label>
                <input className="form-control" required value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} placeholder="Ex: ETS Amirni" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Téléphone</label>
                  <input className="form-control" value={form.tel} onChange={e => setForm({ ...form, tel: e.target.value })} placeholder="06XXXXXXXX" />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" className="form-control" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="client@mail.com" />
                </div>
              </div>
              <div className="form-group">
                <label>Adresse / Ville</label>
                <input className="form-control" value={form.adresse} onChange={e => setForm({ ...form, adresse: e.target.value })} placeholder="Casablanca, Maroc" />
              </div>
              <div className="form-group">
                <label>Notes / Remarques</label>
                <textarea className="form-control" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Observations..." />
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%', padding: 14 }}>
                Enregistrer Client
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Règlement Dette */}
      {isPaymentModal && selectedClient && (
        <div className="modal-overlay" onClick={() => setIsPaymentModal(false)}>
          <div className="modal-content animate-enter" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Encaisser Paiement Client</h3>
              <button className="modal-close-btn" onClick={() => setIsPaymentModal(false)}>×</button>
            </div>
            <form onSubmit={handleRecordPayment}>
              <p style={{ fontSize: '0.9rem', marginBottom: 14 }}>
                Client : <strong>{selectedClient.nom}</strong>
              </p>
              <div className="form-group">
                <label>Montant Encaissé (DA) *</label>
                <input 
                  type="number" 
                  step="0.01" 
                  required 
                  className="form-control" 
                  value={paymentAmount} 
                  onChange={e => setPaymentAmount(e.target.value)} 
                  placeholder="Ex: 5000" 
                />
              </div>
              <div className="form-group">
                <label>Mode de Règlement</label>
                <select className="form-control" value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                  <option value="espèces">Espèces (Caisse)</option>
                  <option value="chèque">Chèque</option>
                  <option value="virement">Virement bancaire</option>
                </select>
              </div>
              <div className="form-group">
                <label>Notes / N° Chèque</label>
                <input className="form-control" value={paymentNote} onChange={e => setPaymentNote(e.target.value)} placeholder="Optionnel..." />
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%', padding: 14 }}>
                Valider et Encaisser
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
