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

  const topProducts = useMemo(() => {
    const map = {};
    ventes.forEach(v => {
      if (!map[v.nom]) map[v.nom] = { nom: v.nom, total: 0, qty: 0 };
      map[v.nom].total += v.prix * v.quantite;
      map[v.nom].qty   += v.quantite;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [ventes]);

  const statsBy = (period) => {
    const now = new Date();
    const filtered = ventes.filter(v => {
      if (!v.date) return false;
      const d = new Date(v.date);
      if (period === 'week') { const diff = (now - d) / 86400000; return diff <= 7; }
      if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (period === 'year')  return d.getFullYear() === now.getFullYear();
      return true;
    });
    const ca = filtered.reduce((s, v) => s + v.prix * v.quantite, 0);
    const ben = filtered.reduce((s, v) => {
      const p = products.find(p => p.id === v.product_id);
      return s + (v.prix - (p ? p.prix_unitaire : 0)) * v.quantite;
    }, 0);
    return { ca, ben, nb: filtered.length };
  };

  /* ── Full Report PDF ─────────────────────── */
  const generateFullReport = () => {
    const doc = new jsPDF();
    const W = doc.internal.pageSize.getWidth();
    const today = format(new Date(), 'dd/MM/yyyy');
    const week  = statsBy('week');
    const month = statsBy('month');
    const year  = statsBy('year');

    // Header
    doc.setFillColor(79, 70, 229); doc.rect(0, 0, W, 40, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(255,255,255);
    doc.text('BRASTI — Rapport Complet', 20, 22);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(`Généré le ${today}`, 20, 32);

    let y = 52;
    const section = (title) => {
      doc.setFillColor(248,250,252); doc.rect(15, y-6, W-30, 10, 'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(79,70,229);
      doc.text(title, 18, y); y += 10;
      doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(30,41,59);
    };
    const row = (label, value, color) => {
      doc.setTextColor(100,116,139); doc.text(label, 20, y);
      doc.setTextColor(color || 30); doc.setFont('helvetica','bold');
      doc.text(String(value), W - 20, y, { align:'right' });
      doc.setFont('helvetica','normal'); doc.setTextColor(30,41,59);
      doc.setDrawColor(241,245,249); doc.line(20, y+2, W-20, y+2);
      y += 10;
    };

    section('📊 Résumé Global');
    row('Total Ventes', `${totalVentes.toFixed(0)} DA`, [30,41,59]);
    row('Bénéfice Net', `${benefice.toFixed(0)} DA`, [16,122,87]);
    row('Non Payés (Crédit)', `${totalDettes.toFixed(0)} DA`, [185,28,28]);
    row('# Transactions', ventes.length);
    y += 4;

    section('📅 Statistiques par Période');
    row('Cette semaine — CA', `${week.ca.toFixed(0)} DA`); row('Cette semaine — Bénéfice', `${week.ben.toFixed(0)} DA`);
    row('Ce mois — CA', `${month.ca.toFixed(0)} DA`); row('Ce mois — Bénéfice', `${month.ben.toFixed(0)} DA`);
    row('Cette année — CA', `${year.ca.toFixed(0)} DA`); row('Cette année — Bénéfice', `${year.ben.toFixed(0)} DA`);
    y += 4;

    section('🏆 Top Produits');
    topProducts.slice(0,5).forEach((p, i) => row(`${i+1}. ${p.nom} (×${p.qty})`, `${p.total.toFixed(0)} DA`, [79,70,229]));
    y += 4;

    section('📦 État du Stock');
    products.forEach(p => row(p.nom, `${p.stock_qty} unités — Coût: ${p.prix_unitaire} DA`));
    y += 4;

    section('💸 Dernières Ventes');
    ventes.slice(0,10).forEach(v => row(`${v.date || '—'} · ${v.nom} (${v.client_nom || '?'})`, `${(v.prix*v.quantite).toFixed(0)} DA ${v.est_paye?'✓':'⚠'}`));

    // Footer
    doc.setFillColor(248,250,252); doc.rect(0, 277, W, 20, 'F');
    doc.setFontSize(8); doc.setTextColor(100,116,139);
    doc.text('BRASTI — brasti.netlify.app | Développé par Hamza Amirni', W/2, 286, { align:'center' });

    doc.save(`Rapport_Brasti_${today.replace(/\//g,'-')}.pdf`);
  };


  /* ── Invoice PDF ─────────────────────────── */
  const generateInvoice = (v) => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const invoiceDate = v.date || format(new Date(), 'dd/MM/yyyy');
    const invoiceNum  = `INV-${v.id ? v.id.slice(0,8).toUpperCase() : Date.now()}`;

    // ── HEADER BLOCK ─────────────────────────────────────
    // Purple header bar
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, pageW, 38, 'F');

    // Company name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(255, 255, 255);
    doc.text('BRASTI', 20, 22);

    // Subtitle
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Production & Vente — Produits d\'entretien', 20, 30);

    // FACTURE label (right side)
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('FACTURE', pageW - 20, 20, { align: 'right' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(invoiceNum, pageW - 20, 28, { align: 'right' });

    // ── INFO BLOCKS ──────────────────────────────────────
    doc.setTextColor(30, 41, 59);

    // LEFT: bill to
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('FACTURÉ À :', 20, 52);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(v.client_nom || 'Client Anonyme', 20, 61);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    if (v.client_tel) doc.text(`Tél : ${v.client_tel}`, 20, 69);

    // RIGHT: invoice info
    doc.setFontSize(9);
    doc.text('N° FACTURE :', pageW - 80, 52);
    doc.text('DATE :', pageW - 80, 60);
    doc.text('STATUT :', pageW - 80, 68);

    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text(invoiceNum, pageW - 20, 52, { align: 'right' });
    doc.text(invoiceDate, pageW - 20, 60, { align: 'right' });

    // Payment status badge
    if (v.est_paye) {
      doc.setTextColor(21, 128, 61);
      doc.text('✓ PAYÉ', pageW - 20, 68, { align: 'right' });
    } else {
      doc.setTextColor(185, 28, 28);
      doc.text('⚠ CRÉDIT (non payé)', pageW - 20, 68, { align: 'right' });
    }

    // ── SEPARATOR ────────────────────────────────────────
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.line(20, 78, pageW - 20, 78);

    // ── PRODUCT TABLE HEADER ─────────────────────────────
    doc.setFillColor(248, 250, 252);
    doc.rect(20, 82, pageW - 40, 10, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('ARTICLE', 24, 89);
    doc.text('QTÉ', 115, 89, { align: 'center' });
    doc.text('PRIX UNIT.', 145, 89, { align: 'center' });
    doc.text('TOTAL', pageW - 24, 89, { align: 'right' });

    // ── PRODUCT ROW ──────────────────────────────────────
    const rowY = 106;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(v.nom || '—', 24, rowY);
    doc.text(String(v.quantite), 115, rowY, { align: 'center' });
    doc.text(`${(+v.prix).toFixed(2)} DA`, 145, rowY, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text(`${(v.prix * v.quantite).toFixed(2)} DA`, pageW - 24, rowY, { align: 'right' });

    // Row separator
    doc.setDrawColor(229, 231, 235);
    doc.line(20, 112, pageW - 20, 112);

    // ── TOTAL BLOCK ──────────────────────────────────────
    doc.setFillColor(79, 70, 229);
    doc.setDrawColor(79, 70, 229);
    doc.roundedRect(pageW - 90, 118, 70, 18, 3, 3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text('TOTAL', pageW - 55, 126, { align: 'center' });
    doc.text(`${(v.prix * v.quantite).toFixed(2)} DA`, pageW - 55, 132, { align: 'center' });

    // Sub-totals (left)
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text(`Sous-total :  ${(v.prix * v.quantite).toFixed(2)} DA`, 20, 126);
    doc.text(`TVA :  Hors taxes`, 20, 134);

    // ── NOTES / CONDITIONS ───────────────────────────────
    doc.setDrawColor(229, 231, 235);
    doc.line(20, 148, pageW - 20, 148);

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Note de paiement :', 20, 156);
    doc.setTextColor(30, 41, 59);
    const payNote = v.est_paye
      ? 'Paiement reçu — Aucun montant dû.'
      : `Montant restant à régler : ${(v.prix * v.quantite).toFixed(2)} DA`;
    doc.text(payNote, 20, 163);

    // ── FOOTER ───────────────────────────────────────────
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 275, pageW, 22, 'F');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Merci pour votre confiance ! — BRASTI Production & Vente', pageW / 2, 283, { align: 'center' });
    doc.text('brasti.netlify.app', pageW / 2, 290, { align: 'center' });

    doc.save(`Facture_${v.client_nom || 'Client'}_${invoiceNum}.pdf`);
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
  const [isBotTyping, setIsBotTyping] = useState(false);

  const handleSend = async () => {
    if (!chatInput.trim() || isBotTyping) return;
    const content = chatInput.trim();
    setChatInput('');

    // Show user message immediately in UI
    const userMsg = { id: Date.now(), sender: 'customer', content };
    setMessages(prev => [...prev, userMsg]);

    // Save to DB (optional, don't block UI)
    supabase.from('messages').insert([{ user_id: session.user.id, sender: 'customer', content }]).then(() => {});

    setIsBotTyping(true);
    try {
      // Build context from business data
      const ctx = `Tu es un assistant commercial pour BRASTI. Données actuelles: Ventes totales=${totalVentes.toFixed(0)}DA, Bénéfice net=${benefice.toFixed(0)}DA, Dettes impayées=${totalDettes.toFixed(0)}DA, Produits en stock: ${products.map(p => `${p.nom}(${p.stock_qty})`).join(', ')}. Réponds en français, de façon courte et utile.`;

      let botContent = null;

      // Try luminai first
      try {
        const res = await fetch('https://luminai.my.id/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, prompt: ctx }),
          signal: AbortSignal.timeout(8000)
        });
        if (res.ok) {
          const d = await res.json();
          botContent = d.result || d.response || d.message || null;
        }
      } catch { /* try fallback */ }

      // Fallback: simple rule-based answers
      if (!botContent) {
        const q = content.toLowerCase();
        if (q.includes('bénéfice') || q.includes('profit') || q.includes('rbh'))
          botContent = `Votre bénéfice net actuel est de ${benefice.toFixed(0)} DA.`;
        else if (q.includes('vente') || q.includes('chiffre'))
          botContent = `Total des ventes : ${totalVentes.toFixed(0)} DA.`;
        else if (q.includes('dette') || q.includes('credit') || q.includes('npaye'))
          botContent = `Montant impayé (crédit) : ${totalDettes.toFixed(0)} DA.`;
        else if (q.includes('stock') || q.includes('produit'))
          botContent = `Produits en stock : ${products.map(p => `${p.nom} (${p.stock_qty} unités)`).join(', ') || 'Aucun produit'}.`;
        else
          botContent = `Je suis votre assistant BRASTI. Ventes: ${totalVentes.toFixed(0)}DA | Bénéfice: ${benefice.toFixed(0)}DA | Dettes: ${totalDettes.toFixed(0)}DA.`;
      }

      // Show bot response in UI immediately
      const botMsg = { id: Date.now() + 1, sender: 'admin', content: botContent, is_bot: true };
      setMessages(prev => [...prev, botMsg]);

      // Try to save bot response to DB (don't fail if column missing)
      supabase.from('messages').insert([{ user_id: session.user.id, sender: 'admin', content: botContent }]).then(() => {});

    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'admin', content: '⚠ Service AI temporairement indisponible.', is_bot: true }]);
    } finally {
      setIsBotTyping(false);
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
        <div className="header-title">
          <img src="/logo.png" alt="Brasti" style={{ height: 36, width: 36, objectFit: 'contain', marginRight: 10, verticalAlign: 'middle' }} />
          <span style={{ verticalAlign: 'middle' }}>Brasti platform</span>
        </div>
        <div className="header-actions">
          <button className="icon-btn" onClick={fetchData} title="Rafraîchir"><RefreshCw size={18} /></button>
          <button className="icon-btn" style={{ background: 'var(--primary)', color: 'white', border: 'none' }} onClick={generateFullReport} title="Télécharger Rapport PDF"><Download size={18} /></button>
          <button className="icon-btn" onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')} title="Thème"><Sun size={18} /></button>
          <button className="icon-btn" onClick={() => supabase.auth.signOut()} title="Déconnexion"><LogOut size={18} /></button>
        </div>
      </header>

      {/* Nav */}
      <nav className="nav-tabs">
        {['dashboard','stock','ventes','stats','chat'].map(tab => (
          <button key={tab} className={`nav-tab${activeTab === tab ? ' active' : ''}`} onClick={() => setActiveTab(tab)}>
            {tab === 'dashboard' ? 'Dashboard' : tab === 'stock' ? 'Stock' : tab === 'ventes' ? 'Ventes' : tab === 'stats' ? '📊 Stats' : 'AI Chat'}
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
                  <div><div className="stat-value" style={{ color: '#10b981' }}>{benefice.toFixed(0)} DA</div><div className="stat-label">Bénéfice Net</div></div>
                  <TrendingUp color="#10b981" size={30} />
                </div>
              </div>
              <div className="stat-card" style={{ borderLeft: '5px solid #ef4444' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div><div className="stat-value" style={{ color: '#ef4444' }}>{totalDettes.toFixed(0)} DA</div><div className="stat-label">Non Payés</div></div>
                  <AlertTriangle color="#ef4444" size={30} />
                </div>
              </div>
              <div className="stat-card" style={{ borderLeft: '5px solid var(--primary)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div><div className="stat-value" style={{ color: 'var(--primary)' }}>{totalVentes.toFixed(0)} DA</div><div className="stat-label">Total Ventes</div></div>
                  <ShoppingBag color="var(--primary)" size={30} />
                </div>
              </div>
            </div>
            {/* Chart */}
            <div className="glass-container" style={{ height: 300 }}>
              <Line options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }}
                data={{ labels: ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'],
                  datasets: [{ label: 'Gain (DA)', data: [0,0,0,0,0,0, benefice], fill: true, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.08)', tension: 0.4, pointBackgroundColor: '#10b981', pointRadius: 5 }]
                }}
              />
            </div>
            {/* Top Products */}
            {topProducts.length > 0 && (
              <div className="glass-container">
                <h4 style={{ fontWeight: 800, marginBottom: 16 }}>🏆 Top Produits Vendus</h4>
                {topProducts.slice(0,5).map((p,i) => (
                  <div key={p.nom} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                    <div style={{ width:28, height:28, borderRadius:'50%', background: i===0?'#f59e0b':i===1?'#94a3b8':'#c084fc', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:900, fontSize:'0.8rem' }}>{i+1}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700 }}>{p.nom}</div>
                      <div style={{ height:6, borderRadius:4, background:'#f1f5f9', marginTop:4 }}>
                        <div style={{ height:'100%', borderRadius:4, background:'var(--primary)', width: `${Math.min((p.total/topProducts[0].total)*100,100)}%`, transition:'width 0.5s' }} />
                      </div>
                    </div>
                    <div style={{ fontWeight:800, color:'var(--primary)', fontSize:'0.9rem', minWidth:90, textAlign:'right' }}>{p.total.toFixed(0)} DA</div>
                  </div>
                ))}
              </div>
            )}
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

        {/* STATS TAB */}
        {activeTab === 'stats' && (
          <div className="animate-enter">
            {/* Period stats cards */}
            {[
              { label: 'Cette Semaine', ...statsBy('week'), color: '#8b5cf6' },
              { label: 'Ce Mois', ...statsBy('month'), color: '#0ea5e9' },
              { label: 'Cette Année', ...statsBy('year'), color: '#10b981' },
            ].map(s => (
              <div key={s.label} className="glass-container" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h4 style={{ fontWeight: 800, fontSize: '1rem' }}>📅 {s.label}</h4>
                  <span className="badge badge-success">{s.nb} ventes</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ padding: '12px 16px', background: `${s.color}14`, borderRadius: 14, borderLeft: `4px solid ${s.color}` }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 900, color: s.color }}>{s.ca.toFixed(0)} DA</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 700, marginTop: 2 }}>CHIFFRE D'AFFAIRES</div>
                  </div>
                  <div style={{ padding: '12px 16px', background: '#10b98114', borderRadius: 14, borderLeft: '4px solid #10b981' }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#10b981' }}>{s.ben.toFixed(0)} DA</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 700, marginTop: 2 }}>BÉNÉFICE NET</div>
                  </div>
                </div>
              </div>
            ))}

            {/* Top products */}
            {topProducts.length > 0 && (
              <div className="glass-container" style={{ marginBottom: 16 }}>
                <h4 style={{ fontWeight: 800, marginBottom: 18 }}>🏆 Classement des Produits</h4>
                {topProducts.map((p, i) => (
                  <div key={p.nom} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: ['#f59e0b','#94a3b8','#c084fc','#4f46e5','#10b981'][i] || '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: '0.85rem', flexShrink: 0 }}>{i + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700 }}>{p.nom}</span>
                        <span style={{ fontWeight: 800, color: 'var(--primary)' }}>{p.total.toFixed(0)} DA</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 4, background: '#f1f5f9', marginTop: 6 }}>
                        <div style={{ height: '100%', borderRadius: 4, background: 'var(--primary)', width: `${Math.min((p.total / (topProducts[0]?.total || 1)) * 100, 100)}%`, transition: 'width 0.6s' }} />
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 3 }}>Quantité vendée: {p.qty}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Developer Profile */}
            <div className="glass-container" style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: 8 }}>
                <img src="/logo.png" alt="logo" style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary)' }} />
              </div>
              <h4 style={{ fontWeight: 900, fontSize: '1.1rem' }}>Hamza Amirni</h4>
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: '4px 0 16px' }}>Développeur Full-Stack · Créateur de Brasti</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {[
                  { label: '🌐 Portfolio', url: 'https://hamzaamirni.netlify.app' },
                  { label: '📸 Instagram', url: 'https://instagram.com/hamza_amirni_01' },
                  { label: '📺 YouTube', url: 'https://www.youtube.com/@Hamzaamirni01' },
                  { label: '💬 WhatsApp', url: 'https://whatsapp.com/channel/0029ValXRoHCnA7yKopcrn1p' },
                  { label: '📘 Facebook', url: 'https://www.facebook.com/profile.php?id=61564527797752' },
                  { label: '✈️ Telegram', url: 'https://t.me/hamzaamirni' },
                ].map(link => (
                  <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" style={{
                    padding: '8px 16px', borderRadius: 20, background: 'rgba(79,70,229,0.08)',
                    color: 'var(--primary)', fontWeight: 700, fontSize: '0.82rem', textDecoration: 'none', transition: '0.2s',
                    border: '1px solid rgba(79,70,229,0.15)'
                  }}>{link.label}</a>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* AI CHAT */}
        {activeTab === 'chat' && (
          <div className="glass-container animate-enter" style={{ padding: 0, overflow: 'hidden' }}>

            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>🤖 AI Business Assistant</h3>
                <p style={{ color: 'var(--muted)', fontSize: '0.82rem', marginTop: 3 }}>Posez des questions sur vos ventes et votre activité</p>
              </div>
              <button className="btn-primary" style={{ fontSize: '0.78rem', padding: '8px 14px' }} onClick={() => setMessages([])}>Effacer</button>
            </div>
            <div className="chat-container">
              <div className="chat-messages">
                {messages.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--muted)', marginTop: 24 }}>
                    <div style={{ fontSize: '2rem', marginBottom: 10 }}>🤖</div>
                    <p style={{ fontWeight: 700, marginBottom: 12 }}>Bonjour ! Comment puis-je vous aider ?</p>
                    {[
                      'Quel est mon bénéfice ?',
                      'Combien de dettes impayées ?',
                      'Quels produits sont en stock ?',
                      'Résumé de mes ventes'
                    ].map(q => (
                      <div key={q} onClick={() => { setChatInput(q); }} style={{
                        display: 'inline-block', margin: '4px', padding: '7px 14px',
                        background: 'rgba(79,70,229,0.08)', borderRadius: 20,
                        fontSize: '0.82rem', cursor: 'pointer', color: 'var(--primary)', fontWeight: 600
                      }}>{q}</div>
                    ))}
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={m.id || i} className={`message ${m.sender}`}>{m.content}</div>
                ))}
                {isBotTyping && (
                  <div className="message admin" style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '14px 18px' }}>
                    <span style={{ width: 8, height: 8, background: 'var(--muted)', borderRadius: '50%', animation: 'blink 1.2s infinite 0s' }} />
                    <span style={{ width: 8, height: 8, background: 'var(--muted)', borderRadius: '50%', animation: 'blink 1.2s infinite 0.3s' }} />
                    <span style={{ width: 8, height: 8, background: 'var(--muted)', borderRadius: '50%', animation: 'blink 1.2s infinite 0.6s' }} />
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="chat-input-area">
                <input
                  className="form-control" value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder="Tapez votre question..."
                  disabled={isBotTyping}
                />
                <button className="btn-primary" style={{ flexShrink: 0, padding: '12px 18px', opacity: isBotTyping ? 0.6 : 1 }} onClick={handleSend} disabled={isBotTyping}>
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
