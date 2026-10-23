import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { UserCheck, Plus, DollarSign, Calendar, Phone, Award, Trash2, Edit2, CheckCircle, Clock } from 'lucide-react';
import Swal from 'sweetalert2';
import { format } from 'date-fns';

export default function PersonnelModule({ session, theme }) {
  const [activeTab, setActiveTab] = useState('employes'); // 'employes' | 'salaires'
  const [employes, setEmployes] = useState([]);
  const [salaires, setSalaires] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal Employe
  const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState(null);
  const [empForm, setEmpForm] = useState({
    nom: '',
    poste: '',
    tel: '',
    salaire_base: '',
    date_embauche: format(new Date(), 'yyyy-MM-dd'),
    statut: 'actif'
  });

  // Modal Salaire
  const [isSalModalOpen, setIsSalModalOpen] = useState(false);
  const [salForm, setSalForm] = useState({
    employe_id: '',
    employe_nom: '',
    montant: '',
    mois: format(new Date(), 'yyyy-MM'),
    statut: 'paye',
    date_paiement: format(new Date(), 'yyyy-MM-dd'),
    notes: ''
  });

  useEffect(() => {
    fetchPersonnelData();
  }, [session]);

  const fetchPersonnelData = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [eRes, sRes] = await Promise.all([
        supabase.from('personnel').select('*').order('nom'),
        supabase.from('salaires').select('*').order('date_paiement', { ascending: false })
      ]);
      setEmployes(eRes.data || []);
      setSalaires(sRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const totalEmployes = employes.length;
    const employesActifs = employes.filter(e => e.statut === 'actif').length;
    const masseSalariale = employes.filter(e => e.statut === 'actif').reduce((s, e) => s + (+e.salaire_base || 0), 0);
    const salairesPayesTotal = salaires.filter(s => s.statut === 'paye').reduce((s, x) => s + (+x.montant || 0), 0);
    return { totalEmployes, employesActifs, masseSalariale, salairesPayesTotal };
  }, [employes, salaires]);

  const handleSaveEmploye = async (e) => {
    e.preventDefault();
    if (!empForm.nom) return;

    try {
      const payload = {
        user_id: session.user.id,
        nom: empForm.nom,
        poste: empForm.poste,
        tel: empForm.tel,
        salaire_base: +empForm.salaire_base || 0,
        date_embauche: empForm.date_embauche,
        statut: empForm.statut
      };

      if (editingEmp) {
        await supabase.from('personnel').update(payload).eq('id', editingEmp.id);
        Swal.fire({ icon: 'success', title: 'Employé mis à jour', timer: 900, showConfirmButton: false });
      } else {
        const { error } = await supabase.from('personnel').insert([payload]);
        if (error) {
          setEmployes(prev => [...prev, { ...payload, id: Date.now().toString() }]);
        }
        Swal.fire({ icon: 'success', title: 'Employé ajouté', timer: 900, showConfirmButton: false });
      }

      setIsEmpModalOpen(false);
      setEditingEmp(null);
      setEmpForm({ nom: '', poste: '', tel: '', salaire_base: '', date_embauche: format(new Date(), 'yyyy-MM-dd'), statut: 'actif' });
      fetchPersonnelData();
    } catch (err) {
      Swal.fire('Erreur', err.message, 'error');
    }
  };

  const handlePaySalaire = async (e) => {
    e.preventDefault();
    if (!salForm.employe_nom || !salForm.montant) return;

    try {
      const payload = {
        user_id: session.user.id,
        employe_id: salForm.employe_id || null,
        employe_nom: salForm.employe_nom,
        montant: +salForm.montant,
        mois: salForm.mois,
        statut: salForm.statut,
        date_paiement: salForm.date_paiement,
        notes: salForm.notes
      };

      const { error } = await supabase.from('salaires').insert([payload]);
      if (error) {
        setSalaires(prev => [{ ...payload, id: Date.now().toString() }, ...prev]);
      }

      // If status is paid, record into caisse
      if (salForm.statut === 'paye') {
        try {
          await supabase.from('caisse').insert([{
            user_id: session.user.id,
            type: 'sortie',
            categorie: 'salaire',
            montant: +salForm.montant,
            description: `Salaire ${salForm.mois} - ${salForm.employe_nom}`,
            date: salForm.date_paiement
          }]);
        } catch {}
      }

      Swal.fire({ icon: 'success', title: 'Paiement Salaire Enregistré', timer: 1000, showConfirmButton: false });
      setIsSalModalOpen(false);
      fetchPersonnelData();
    } catch (err) {
      Swal.fire('Erreur', err.message, 'error');
    }
  };

  const handleDeleteEmploye = async (id) => {
    const res = await Swal.fire({
      title: 'Supprimer cet employé ?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Supprimer'
    });
    if (res.isConfirmed) {
      await supabase.from('personnel').delete().eq('id', id);
      setEmployes(prev => prev.filter(e => e.id !== id));
      Swal.fire({ icon: 'success', title: 'Supprimé', timer: 700, showConfirmButton: false });
    }
  };

  return (
    <div className="animate-enter">
      {/* Top Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        <div className="stat-card" style={{ borderLeft: '5px solid #4f46e5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#4f46e5' }}>{stats.employesActifs}</div>
              <div className="stat-label">Employés Actifs</div>
            </div>
            <UserCheck color="#4f46e5" size={28} />
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '5px solid #06b6d4' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#06b6d4' }}>{stats.masseSalariale.toFixed(0)} DA</div>
              <div className="stat-label">Masse Salariale / Mois</div>
            </div>
            <DollarSign color="#06b6d4" size={28} />
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '5px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#10b981' }}>{stats.salairesPayesTotal.toFixed(0)} DA</div>
              <div className="stat-label">Total Salaires Versés</div>
            </div>
            <CheckCircle color="#10b981" size={28} />
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '5px solid #8b5cf6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#8b5cf6' }}>{salaires.length}</div>
              <div className="stat-label">Fiches de Paie Émises</div>
            </div>
            <Calendar color="#8b5cf6" size={28} />
          </div>
        </div>
      </div>

      {/* Main glass card */}
      <div className="glass-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div className="module-tabs" style={{ margin: 0 }}>
            <button 
              className={`module-tab ${activeTab === 'employes' ? 'active' : ''}`}
              onClick={() => setActiveTab('employes')}
            >
              👷 Liste du Personnel ({employes.length})
            </button>
            <button 
              className={`module-tab ${activeTab === 'salaires' ? 'active' : ''}`}
              onClick={() => setActiveTab('salaires')}
            >
              💵 Salaires & Fiches de Paie ({salaires.length})
            </button>
          </div>

          {activeTab === 'employes' ? (
            <button className="btn-primary" onClick={() => {
              setEditingEmp(null);
              setEmpForm({ nom: '', poste: '', tel: '', salaire_base: '', date_embauche: format(new Date(), 'yyyy-MM-dd'), statut: 'actif' });
              setIsEmpModalOpen(true);
            }}>
              <Plus size={16} /> Nouvel Employé
            </button>
          ) : (
            <button className="btn-primary" onClick={() => setIsSalModalOpen(true)}>
              <Plus size={16} /> Verser un Salaire
            </button>
          )}
        </div>

        {/* TAB 1: Employes */}
        {activeTab === 'employes' && (
          <div className="table-wrapper">
            {loading ? (
              <p style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>Chargement...</p>
            ) : employes.length === 0 ? (
              <div className="empty-state">
                <UserCheck size={40} />
                <p>Aucun employé enregistré</p>
                <small>Ajoutez les membres de votre équipe de production ou de vente.</small>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nom Complet</th>
                    <th>Poste / Fonction</th>
                    <th>Téléphone</th>
                    <th>Salaire de Base</th>
                    <th>Date Embauche</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employes.map(e => (
                    <tr key={e.id}>
                      <td><strong>{e.nom}</strong></td>
                      <td>{e.poste || 'Opérateur'}</td>
                      <td>{e.tel || '—'}</td>
                      <td>
                        <strong style={{ color: '#10b981' }}>{(+e.salaire_base || 0).toFixed(0)} DA</strong>
                      </td>
                      <td>{e.date_embauche}</td>
                      <td>
                        <span className={`badge ${e.statut === 'actif' ? 'badge-success' : 'badge-danger'}`}>
                          {e.statut}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button 
                            className="btn-secondary" 
                            style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                            onClick={() => {
                              setSalForm(sf => ({
                                ...sf,
                                employe_id: e.id,
                                employe_nom: e.nom,
                                montant: e.salaire_base || ''
                              }));
                              setIsSalModalOpen(true);
                            }}
                          >
                            Payer
                          </button>
                          <button className="icon-btn" title="Modifier" onClick={() => {
                            setEditingEmp(e);
                            setEmpForm({
                              nom: e.nom,
                              poste: e.poste || '',
                              tel: e.tel || '',
                              salaire_base: e.salaire_base || '',
                              date_embauche: e.date_embauche || '',
                              statut: e.statut || 'actif'
                            });
                            setIsEmpModalOpen(true);
                          }}>
                            <Edit2 size={14} />
                          </button>
                          <button className="icon-btn" title="Supprimer" style={{ color: '#ef4444' }} onClick={() => handleDeleteEmploye(e.id)}>
                            <Trash2 size={14} />
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

        {/* TAB 2: Salaires */}
        {activeTab === 'salaires' && (
          <div className="table-wrapper">
            {salaires.length === 0 ? (
              <div className="empty-state">
                <DollarSign size={40} />
                <p>Aucun paiement de salaire enregistré</p>
                <small>Cliquez sur "Verser un Salaire" pour enregistrer les fiches de paie mensuelles.</small>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date Paiement</th>
                    <th>Employé</th>
                    <th>Mois Concerné</th>
                    <th>Montant Versé</th>
                    <th>Statut</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {salaires.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>{s.date_paiement}</td>
                      <td><strong>{s.employe_nom}</strong></td>
                      <td>
                        <span className="badge badge-purple">{s.mois}</span>
                      </td>
                      <td>
                        <strong style={{ color: '#ef4444' }}>{(+s.montant || 0).toFixed(2)} DA</strong>
                      </td>
                      <td>
                        <span className={`badge ${s.statut === 'paye' ? 'badge-success' : 'badge-warning'}`}>
                          {s.statut === 'paye' ? 'Payé' : 'En attente'}
                        </span>
                      </td>
                      <td>{s.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* MODAL: Nouvel Employe */}
      {isEmpModalOpen && (
        <div className="modal-overlay" onClick={() => setIsEmpModalOpen(false)}>
          <div className="modal-content animate-enter" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingEmp ? 'Modifier Employé' : 'Nouvel Employé'}</h3>
              <button className="modal-close-btn" onClick={() => setIsEmpModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSaveEmploye}>
              <div className="form-group">
                <label>Nom et Prénom *</label>
                <input 
                  className="form-control" 
                  required 
                  value={empForm.nom} 
                  onChange={e => setEmpForm({ ...empForm, nom: e.target.value })} 
                  placeholder="Ex: Mohamed Amine" 
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Poste / Responsabilité</label>
                  <input 
                    className="form-control" 
                    value={empForm.poste} 
                    onChange={e => setEmpForm({ ...empForm, poste: e.target.value })} 
                    placeholder="Ex: Chef d'atelier, Chauffeur..." 
                  />
                </div>
                <div className="form-group">
                  <label>Téléphone</label>
                  <input 
                    className="form-control" 
                    value={empForm.tel} 
                    onChange={e => setEmpForm({ ...empForm, tel: e.target.value })} 
                    placeholder="06XXXXXXXX" 
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Salaire Mensuel de Base (DA)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="form-control" 
                    value={empForm.salaire_base} 
                    onChange={e => setEmpForm({ ...empForm, salaire_base: e.target.value })} 
                    placeholder="Ex: 35000" 
                  />
                </div>
                <div className="form-group">
                  <label>Statut</label>
                  <select className="form-control" value={empForm.statut} onChange={e => setEmpForm({ ...empForm, statut: e.target.value })}>
                    <option value="actif">Actif</option>
                    <option value="inactif">Inactif / Congé</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', padding: 14 }}>
                Enregistrer l'Employé
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Verser Salaire */}
      {isSalModalOpen && (
        <div className="modal-overlay" onClick={() => setIsSalModalOpen(false)}>
          <div className="modal-content animate-enter" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>💵 Enregistrer un Paiement de Salaire</h3>
              <button className="modal-close-btn" onClick={() => setIsSalModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handlePaySalaire}>
              <div className="form-group">
                <label>Employé *</label>
                <select 
                  className="form-control" 
                  required
                  value={salForm.employe_id}
                  onChange={e => {
                    const emp = employes.find(x => x.id === e.target.value);
                    setSalForm(sf => ({
                      ...sf,
                      employe_id: e.target.value,
                      employe_nom: emp ? emp.nom : sf.employe_nom,
                      montant: emp ? (emp.salaire_base || sf.montant) : sf.montant
                    }));
                  }}
                >
                  <option value="">-- Sélectionner l'employé --</option>
                  {employes.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.nom} ({emp.poste})</option>
                  ))}
                </select>
              </div>

              {!salForm.employe_id && (
                <div className="form-group">
                  <label>Nom de l'Employé</label>
                  <input 
                    className="form-control" 
                    value={salForm.employe_nom} 
                    onChange={e => setSalForm({ ...salForm, employe_nom: e.target.value })} 
                  />
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>Montant Versé (DA) *</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    required 
                    className="form-control" 
                    value={salForm.montant} 
                    onChange={e => setSalForm({ ...salForm, montant: e.target.value })} 
                  />
                </div>
                <div className="form-group">
                  <label>Mois de Salaire</label>
                  <input 
                    type="month" 
                    className="form-control" 
                    value={salForm.mois} 
                    onChange={e => setSalForm({ ...salForm, mois: e.target.value })} 
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Date de Paiement</label>
                <input 
                  type="date" 
                  className="form-control" 
                  value={salForm.date_paiement} 
                  onChange={e => setSalForm({ ...salForm, date_paiement: e.target.value })} 
                />
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', padding: 14 }}>
                Valider et Déduire de la Caisse
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
