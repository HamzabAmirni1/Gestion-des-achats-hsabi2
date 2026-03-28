import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Download, Sun, RefreshCw, LogOut, Send, X, Plus, Printer, Mail, Lock, TrendingUp, AlertTriangle, ShoppingBag } from 'lucide-react';
import { format } from 'date-fns';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { supabase } from './supabaseClient';
import * as htmlToImage from 'html-to-image';
import { jsPDF } from 'jspdf';
import Swal from 'sweetalert2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function App() {
  const [session, setSession]       = useState(null);
  const [authMode, setAuthMode]     = useState('login');
  const [authEmail, setAuthEmail]   = useState('');
  const [authPassword, setAuthPass] = useState('');
  const [authLoading, setAuthLoad]  = useState(false);
  const [authError, setAuthError]   = useState('');
  const [theme, setTheme]           = useState(() => localStorage.getItem('brasti-theme') || 'light');
  const [activeTab, setActiveTab]   = useState(() => localStorage.getItem('brasti-tab') || 'dashboard');

  const [achats, setAchats]       = useState([]);
  const [ventes, setVentes]       = useState([]);
  const [products, setProducts]   = useState([]);
  const [messages, setMessages]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [isModalOpen, setModal]   = useState(false);
  const [modalType, setModalType] = useState('vente');
  const [isSubmitting, setSubmit] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const chatEndRef = useRef(null);

  const [form, setForm] = useState({
    nom: '', quantite: 1, prix: 1, product_id: '',
    client_nom: '', client_tel: '', est_paye: true
  });

  /* ── Auth ───────────────────────────────── */
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  /* ── Theme & Tab persistence ─────────────── */
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('brasti-theme', theme);
  }, [theme]);
  useEffect(() => { localStorage.setItem('brasti-tab', activeTab); }, [activeTab]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  /* ── Data fetching ───────────────────────── */
  const fetchData = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [{ data: a }, { data: v }, { data: p }, { data: m }] = await Promise.all([
        supabase.from('achats').select('*').order('date', { ascending: false }),
        supabase.from('ventes').select('*').order('date', { ascending: false }),
        supabase.from('products').select('*').order('nom'),
        supabase.from('messages').select('*').order('created_at'),
      ]);
      setAchats(a || []); setVentes(v || []); setProducts(p || []); setMessages(m || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, [session]);

  /* ── Computed stats ──────────────────────── */
  const totalVentes  = useMemo(() => ventes.reduce((s, v) => s + v.prix * v.quantite, 0), [ventes]);
  const totalDettes  = useMemo(() => ventes.filter(v => !v.est_paye).reduce((s, v) => s + v.prix * v.quantite, 0), [ventes]);
  const benefice     = useMemo(() => ventes.reduce((s, v) => {
    const p = products.find(p => p.id === v.product_id);
    return s + (v.prix - (p ? p.prix_unitaire : 0)) * v.quantite;
  }, 0), [ventes, products]);

  /* ── Invoice PDF ─────────────────────────── */
  const generateInvoice = (v) => {
    const doc = new jsPDF();
    doc.setFontSize(22); doc.setTextColor(79, 70, 229);
    doc.text('BRASTI - Facture', 20, 30);
    doc.setFontSize(11); doc.setTextColor(100, 116, 139);
    doc.text(`Date: ${v.date || format(new Date(), 'dd/MM/yyyy')}`, 20, 45);
    doc.setTextColor(30, 41, 59); doc.setFontSize(13);
    doc.text(`Client: ${v.client_nom || 'Client Anonyme'}`, 20, 60);
    doc.text(`Tél: ${v.client_tel || '-'}`, 20, 70);
    doc.setDrawColor(229, 231, 235); doc.line(20, 80, 190, 80);
    doc.text(`Article: ${v.nom}`, 20, 92);
    doc.text(`Quantité: ${v.quantite}`, 20, 102);
    doc.text(`Prix unitaire: ${v.prix} DA`, 20, 112);
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL: ${v.prix * v.quantite} DA`, 20, 130);
    doc.setFontSize(11); doc.setFont('helvetica', 'normal');
    doc.setTextColor(v.est_paye ? 21 : 185, v.est_paye ? 128 : 29, v.est_paye ? 61 : 28);
    doc.text(v.est_paye ? '✓ Payé' : '⚠ Non payé (Crédit)', 20, 148);
    doc.setTextColor(100, 116, 139);
    doc.text('Merci pour votre confiance !', 20, 200);
    doc.save(`Facture_${v.client_nom || 'client'}_${v.id.slice(0, 6)}.pdf`);
  };

  /* ── Auth submit ─────────────────────────── */
  const handleAuth = async (e) => {
    e.preventDefault(); setAuthLoad(true); setAuthError('');
    const { error } = authMode === 'login'
      ? await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword })
      : await supabase.auth.signUp({ email: authEmail, password: authPassword });
    if (error) setAuthError(error.message);
    setAuthLoad(false);
  };

  /* ── Form submit ─────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault(); setSubmit(true);
    try {
      let table = modalType === 'product' ? 'products' : modalType === 'achat' ? 'achats' : 'ventes';
      const base = { user_id: session.user.id, nom: form.nom };
      let item;
      if (modalType === 'product') {
        item = { ...base, prix_unitaire: +form.prix, stock_qty: +form.quantite };
      } else {
        item = { ...base, prix: +form.prix, quantite: +form.quantite, product_id: form.product_id || null, date: format(new Date(), 'yyyy-MM-dd') };
        if (modalType === 'vente') {
          item.client_nom = form.client_nom;
          item.client_tel = form.client_tel;
          item.est_paye   = form.est_paye;
        }
      }
      const { error } = await supabase.from(table).insert([item]);
      if (error) throw error;
      setModal(false);
      fetchData();
      Swal.fire({ icon: 'success', title: 'Enregistré !', timer: 900, showConfirmButton: false });
    } catch (err) {
      console.error('Insert error:', err);
      setModal(false);
      Swal.fire('Erreur', err?.message || 'Vérifiez votre connexion ou la base de données', 'error');
    }
    finally { setSubmit(false); }
  };

  /* ── AI Chat ─────────────────────────────── */
  const handleSend = async () => {
    if (!chatInput.trim()) return;
    const content = chatInput; setChatInput('');
    const { data } = await supabase.from('messages').insert([{ user_id: session.user.id, sender: 'customer', content }]).select();
    if (data) {
      setMessages(prev => [...prev, data[0]]);
      try {
        const res = await fetch('https://luminai.my.id/', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, prompt: `Ventes=${totalVentes}DA, Bénéfice=${benefice.toFixed(0)}DA. Réponds brièvement en français.` })
        });
        const d = await res.json();
        const bot = { user_id: session.user.id, sender: 'admin', content: d.result || d.response || 'Compris.', is_bot: true };
        const { data: bData } = await supabase.from('messages').insert([bot]).select();
        if (bData) setMessages(prev => [...prev, bData[0]]);
      } catch { /* silent */ }
    }
  };

  /* ── Quick re-sell ───────────────────────── */
  const openQuickSell = (v) => {
    setForm(f => ({ ...f, client_nom: v.client_nom || '', client_tel: v.client_tel || '', nom: '', product_id: '', est_paye: true }));
    setModalType('vente'); setModal(true);
  };

  /* ── Reset form ──────────────────────────── */
  const openModal = (type, extra = {}) => {
    setForm({ nom: '', quantite: 1, prix: 1, product_id: '', client_nom: '', client_tel: '', est_paye: true, ...extra });
    setModalType(type); setModal(true);
  };

  /* ═══════════════════════════════════════════
     AUTH SCREEN
  ════════════════════════════════════════════ */
  if (!session) return (
    <div className="auth-page">
      <div className="auth-card-premium animate-enter">
        <h1 className="auth-title">Brasti</h1>
        <p style={{ color: 'var(--muted)', marginBottom: 32, fontSize: '0.95rem' }}>
          Gérez votre production facilement
        </p>
        <form onSubmit={handleAuth}>
          <div className="auth-group">
            <label>Email</label>
            <div className="auth-input-wrapper">
              <Mail size={18} />
              <input type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="votre@email.com" />
            </div>
          </div>
          <div className="auth-group">
            <label>Mot de passe</label>
            <div className="auth-input-wrapper">
              <Lock size={18} />
              <input type="password" required value={authPassword} onChange={e => setAuthPass(e.target.value)} placeholder="••••••••" />
            </div>
          </div>
          {authError && <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: 12 }}>{authError}</p>}
          <button className="btn-auth-submit" disabled={authLoading}>
            {authLoading ? '...' : authMode === 'login' ? 'Se connecter' : "S'inscrire"}
          </button>
          <div className="auth-divider"><span>OU</span></div>
          <button type="button" className="btn-google-auth" onClick={() => supabase.auth.signInWithOAuth({ provider: 'google' })}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continuer avec Google
          </button>
          <button type="button" className="auth-mode-switch" onClick={() => setAuthMode(authMode === 'login' ? 'reg' : 'login')}>
            {authMode === 'login' ? 'Créer un compte' : 'Déjà inscrit ? Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════
     MAIN APP
  ════════════════════════════════════════════ */
  return (
    <div className="app-wrapper">
      {/* Header */}
      <header className="header">
        <div className="header-title">🧪 Brasti platform</div>
        <div className="header-actions">
          <button className="icon-btn" onClick={fetchData} title="Rafraîchir"><RefreshCw size={18} /></button>
          <button className="icon-btn" onClick={() => {
            const el = document.getElementById('app-content');
            htmlToImage.toJpeg(el).then(img => { const doc = new jsPDF('l','mm','a4'); doc.addImage(img,'JPEG',0,0,297,210); doc.save('Rapport.pdf'); });
          }} title="PDF"><Download size={18} /></button>
          <button className="icon-btn" onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')} title="Thème"><Sun size={18} /></button>
          <button className="icon-btn" onClick={() => supabase.auth.signOut()} title="Déconnexion"><LogOut size={18} /></button>
        </div>
      </header>

      {/* Nav */}
      <nav className="nav-tabs">
        {['dashboard','stock','ventes','chat'].map(tab => (
          <button key={tab} className={`nav-tab${activeTab === tab ? ' active' : ''}`} onClick={() => setActiveTab(tab)}>
            {tab === 'dashboard' ? 'Dashboard' : tab === 'stock' ? 'Stock' : tab === 'ventes' ? 'Ventes' : 'AI Chat'}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main id="app-content">

        {/* DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="animate-enter">
            <div className="stats-grid">
              <div className="stat-card" style={{ borderLeft: '5px solid #10b981' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <div className="stat-value" style={{ color: '#10b981' }}>{benefice.toFixed(0)} DA</div>
                    <div className="stat-label">Bénéfice Net</div>
                  </div>
                  <TrendingUp color="#10b981" size={30} />
                </div>
              </div>
              <div className="stat-card" style={{ borderLeft: '5px solid #ef4444' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <div className="stat-value" style={{ color: '#ef4444' }}>{totalDettes.toFixed(0)} DA</div>
                    <div className="stat-label">Non Payés</div>
                  </div>
                  <AlertTriangle color="#ef4444" size={30} />
                </div>
              </div>
              <div className="stat-card" style={{ borderLeft: '5px solid var(--primary)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <div className="stat-value" style={{ color: 'var(--primary)' }}>{totalVentes.toFixed(0)} DA</div>
                    <div className="stat-label">Total Ventes</div>
                  </div>
                  <ShoppingBag color="var(--primary)" size={30} />
                </div>
              </div>
            </div>
            <div className="glass-container" style={{ height: 320 }}>
              <Line
                options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }}
                data={{ labels: ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'],
                  datasets: [{ label: 'Gain (DA)', data: [0,0,0,0,0,0, benefice], fill: true, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.08)', tension: 0.4, pointBackgroundColor: '#10b981', pointRadius: 5 }]
                }}
              />
            </div>
          </div>
        )}

        {/* STOCK */}
        {activeTab === 'stock' && (
          <div className="animate-enter">
            <div className="section-header">
              <h3>Inventaire</h3>
              <button className="btn-primary" onClick={() => openModal('product')}><Plus size={16} /> Nouveau produit</button>
            </div>
            {products.length === 0 && <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 40 }}>Aucun produit. Ajoutez votre premier produit !</p>}
            <div className="products-grid">
              {products.map(p => (
                <div key={p.id} className="product-card" onClick={() => openModal('vente', { product_id: p.id, nom: p.nom, prix: +(p.prix_unitaire * 1.2).toFixed(2) })}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <b style={{ fontSize: '1rem' }}>{p.nom}</b>
                    <span className={`badge ${p.stock_qty > 0 ? 'badge-success' : 'badge-danger'}`}>{p.stock_qty} unités</span>
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Coût: <strong style={{ color: 'var(--primary)' }}>{p.prix_unitaire} DA</strong></div>
                  <div style={{ marginTop: 10, fontSize: '0.78rem', color: 'var(--muted)', fontStyle: 'italic' }}>▶ Cliquer pour vendre</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VENTES */}
        {activeTab === 'ventes' && (
          <div className="glass-container animate-enter">
            <div className="section-header">
              <h3>Historique des ventes</h3>
              <button className="btn-primary" onClick={() => openModal('vente')}><Plus size={16} /> Nouvelle vente</button>
            </div>
            {ventes.length === 0 && <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 30 }}>Aucune vente enregistrée.</p>}
            <table className="data-table">
              <thead><tr><th>Client</th><th>Article</th><th>Total</th><th>Statut</th><th>Actions</th></tr></thead>
              <tbody>
                {ventes.map(v => (
                  <tr key={v.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{v.client_nom || '—'}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{v.client_tel}</div>
                    </td>
                    <td>{v.nom} <span style={{ color: 'var(--muted)' }}>×{v.quantite}</span></td>
                    <td><strong>{(v.prix * v.quantite).toFixed(0)} DA</strong></td>
                    <td><span className={`badge ${v.est_paye ? 'badge-success' : 'badge-danger'}`}>{v.est_paye ? 'Payé' : 'Crédit'}</span></td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="icon-btn" title="Re-vendre à ce client" onClick={() => openQuickSell(v)}><Plus size={16} /></button>
                      <button className="icon-btn" title="Télécharger Facture PDF" onClick={() => generateInvoice(v)}><Printer size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* AI CHAT */}
        {activeTab === 'chat' && (
          <div className="glass-container animate-enter" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--card-border)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>🤖 AI Business Assistant</h3>
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: 4 }}>Posez des questions sur vos ventes et votre activité</p>
            </div>
            <div className="chat-container">
              <div className="chat-messages">
                {messages.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--muted)', marginTop: 30 }}>
                    <p>💬 Commencez à poser des questions !</p>
                    <p style={{ fontSize: '0.85rem', marginTop: 8 }}>Ex: "Quel est mon bénéfice ce mois ?"</p>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`message ${m.sender}`}>{m.content}</div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="chat-input-area">
                <input
                  className="form-control" value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder="Tapez votre question..."
                />
                <button className="btn-primary" style={{ flexShrink: 0, padding: '12px 18px' }} onClick={handleSend}>
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal-content animate-enter" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modalType === 'product' ? '📦 Nouveau Produit' : modalType === 'achat' ? '🛒 Achat' : '💸 Vente'}</h3>
              <button className="modal-close-btn" onClick={() => setModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              {/* Smart Autocomplete Désignation */}
              <div className="form-group" style={{ position: 'relative' }}>
                <label>Désignation</label>
                <input
                  className="form-control"
                  value={form.nom}
                  required
                  placeholder="Tapez ou choisissez un produit..."
                  autoComplete="off"
                  onChange={e => {
                    setForm(f => ({ ...f, nom: e.target.value, product_id: '' }));
                    setProductSearch(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                />
                {/* Suggestions dropdown */}
                {showSuggestions && productSearch.length >= 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
                    background: 'white', border: '2px solid var(--card-border)',
                    borderRadius: 14, boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                    maxHeight: 220, overflowY: 'auto', marginTop: 4
                  }}>
                    {products
                      .filter(p => p.nom.toLowerCase().includes(productSearch.toLowerCase()))
                      .map(p => (
                        <div
                          key={p.id}
                          onMouseDown={() => {
                            setForm(f => ({
                              ...f,
                              nom: p.nom,
                              product_id: p.id,
                              prix: +(p.prix_unitaire * 1.2).toFixed(2)
                            }));
                            setProductSearch(p.nom);
                            setShowSuggestions(false);
                          }}
                          style={{
                            padding: '12px 16px', cursor: 'pointer', display: 'flex',
                            justifyContent: 'space-between', alignItems: 'center',
                            borderBottom: '1px solid #f1f5f9', transition: '0.15s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                          onMouseLeave={e => e.currentTarget.style.background = 'white'}
                        >
                          <span style={{ fontWeight: 700 }}>{p.nom}</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                            Stock: <strong style={{ color: p.stock_qty > 0 ? '#10b981' : '#ef4444' }}>{p.stock_qty}</strong>
                            {' · '}{(p.prix_unitaire * 1.2).toFixed(0)} DA
                          </span>
                        </div>
                      ))
                    }
                    {products.filter(p => p.nom.toLowerCase().includes(productSearch.toLowerCase())).length === 0 && (
                      <div style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: '0.9rem' }}>
                        Aucun produit trouvé — vous pouvez taper un nom libre
                      </div>
                    )}
                  </div>
                )}
              </div>

              {modalType === 'vente' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label>Nom client</label>
                    <input className="form-control" value={form.client_nom} placeholder="Optionnel" onChange={e => setForm(f => ({ ...f, client_nom: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Téléphone</label>
                    <input className="form-control" value={form.client_tel} placeholder="06..." onChange={e => setForm(f => ({ ...f, client_tel: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', background: 'rgba(16,185,129,0.06)', borderRadius: 14 }}>
                    <input type="checkbox" id="paye-check" checked={form.est_paye} onChange={e => setForm(f => ({ ...f, est_paye: e.target.checked }))} style={{ width: 20, height: 20, cursor: 'pointer', accentColor: '#10b981' }} />
                    <label htmlFor="paye-check" style={{ cursor: 'pointer', fontWeight: 700, textTransform: 'none', letterSpacing: 0 }}>Payé en cash ?</label>
                  </div>
                </div>
              )}

              {modalType !== 'product' && (
                <div className="form-group" style={{ background: 'rgba(79,70,229,0.05)', padding: '14px', borderRadius: 14 }}>
                  <label>🔗 Lier au Stock (optionnel)</label>
                  <select className="form-control" value={form.product_id} onChange={e => {
                    const p = products.find(x => x.id === e.target.value);
                    setForm(f => p ? { ...f, product_id: p.id, nom: p.nom, prix: +(p.prix_unitaire * 1.2).toFixed(2) } : { ...f, product_id: '' });
                  }}>
                    <option value="">— Sélectionner un produit —</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.nom} (Stock: {p.stock_qty})</option>)}
                  </select>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Prix unitaire (DA)</label>
                  <input type="number" step="0.01" className="form-control" value={form.prix} required onChange={e => setForm(f => ({ ...f, prix: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Quantité</label>
                  <input type="number" min="1" className="form-control" value={form.quantite} required onChange={e => setForm(f => ({ ...f, quantite: e.target.value }))} />
                </div>
              </div>

              {/* Live total preview */}
              <div style={{ background: 'rgba(79,70,229,0.06)', borderRadius: 14, padding: '14px 18px', marginBottom: 16, fontWeight: 700 }}>
                Total estimé : <span style={{ color: 'var(--primary)', fontSize: '1.1rem' }}>{(+form.prix * +form.quantite).toFixed(2)} DA</span>
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', padding: '15px' }} disabled={isSubmitting}>
                {isSubmitting ? '...' : '✅ Enregistrer'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
