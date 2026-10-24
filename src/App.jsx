import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Download, Sun, RefreshCw, LogOut, Send, X, Plus, Printer, Mail, Lock, 
  TrendingUp, AlertTriangle, ShoppingBag, Bell, Smartphone, Trash2,
  Users, Package, Factory, ShoppingCart, Truck, Wallet, UserCheck, DollarSign, Layers
} from 'lucide-react';
import { format } from 'date-fns';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { supabase, pingSupabase } from './supabaseClient';
import * as htmlToImage from 'html-to-image';
import { jsPDF } from 'jspdf';
import Swal from 'sweetalert2';

// ── NOUVEAUX MODULES ERP ──────────────────────────────────────────
import ClientsModule    from './components/clients/ClientsModule';
import ProduitsModule   from './components/produits/ProduitsModule';
import StockModule      from './components/stock/StockModule';
import ProductionModule from './components/production/ProductionModule';
import VentesModule     from './components/ventes/VentesModule';
import AchatsModule     from './components/achats/AchatsModule';
import ReglementsModule from './components/reglements/ReglementsModule';
import CaisseModule     from './components/caisse/CaisseModule';
import ApportsModule    from './components/apports/ApportsModule';
import PersonnelModule  from './components/personnel/PersonnelModule';
import { getGeminiReply } from './services/aiService';

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
  const [dbError, setDbError]     = useState(null);
  const [isModalOpen, setModal]   = useState(false);
  const [modalType, setModalType] = useState('vente');
  const [isSubmitting, setSubmit] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isBotTyping, setIsBotTyping] = useState(false);
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

  /* ── Supabase Keep-Alive ────────────────── */
  useEffect(() => {
    const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
    const interval = setInterval(async () => {
      const ok = await pingSupabase();
      console.log(`[Keep-Alive] Supabase: ${ok ? 'actif' : 'erreur'}`);
    }, FIVE_DAYS_MS);
    pingSupabase();
    return () => clearInterval(interval);
  }, []);

  /* ── PWA Install ─────────────────────────── */
  const [deferredPrompt, setDeferredPrompt]   = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); setShowInstallBanner(true); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => { window.removeEventListener('beforeinstallprompt', handler); };
  }, []);

  const installApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null); setShowInstallBanner(false);
  };

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
    setDbError(null);
    try {
      const [{ data: a, error: ea }, { data: v, error: ev }, { data: p, error: ep }, { data: m, error: em }] = await Promise.all([
        supabase.from('achats').select('*').order('date', { ascending: false }),
        supabase.from('ventes').select('*').order('date', { ascending: false }),
        supabase.from('products').select('*').order('nom'),
        supabase.from('messages').select('*').order('created_at'),
      ]);
      if (ea || ev || ep) throw (ea || ev || ep);
      setAchats(a || []); setVentes(v || []); setProducts(p || []); setMessages(m || []);
    } catch (e) { 
      console.error(e);
      setDbError(e.message || 'Erreur connexion');
    } finally { 
      setLoading(false); 
    }
  };
  useEffect(() => { fetchData(); }, [session]);

  /* ── Computed stats ──────────────────────── */
  const totalVentes  = useMemo(() => ventes.reduce((s, v) => s + (v.total_prix || v.prix * v.quantite || 0), 0), [ventes]);
  const totalAchats  = useMemo(() => achats.reduce((s, a) => s + (a.prix * a.quantite || 0), 0), [achats]);
  const totalDettes  = useMemo(() => ventes.filter(v => !v.est_paye).reduce((s, v) => s + (v.total_prix || v.prix * v.quantite || 0), 0), [ventes]);
  const benefice     = useMemo(() => ventes.reduce((s, v) => {
    const p = products.find(p => p.id === v.product_id);
    return s + (v.prix - (p ? p.prix_unitaire : 0)) * v.quantite;
  }, 0), [ventes, products]);

  const topProducts = useMemo(() => {
    const map = {};
    ventes.forEach(v => {
      const tot = v.total_prix || (v.prix * v.quantite);
      if (!map[v.nom]) map[v.nom] = { nom: v.nom, total: 0, qty: 0 };
      map[v.nom].total += tot;
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
    const ca = filtered.reduce((s, v) => s + (v.total_prix || v.prix * v.quantite || 0), 0);
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

    const buildReport = (logoDataUrl) => {
      // Header
      doc.setFillColor(79, 70, 229); doc.rect(0, 0, W, 44, 'F');

      if (logoDataUrl) {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(12, 7, 28, 28, 4, 4, 'F');
        doc.addImage(logoDataUrl, 'PNG', 14, 9, 24, 24);
      }

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(17);
      doc.text('BRASTI - RAPPORT GENERAL', logoDataUrl ? 46 : 14, 20);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.text(`Genere le : ${today}  |  Production & Vente`, logoDataUrl ? 46 : 14, 30);

      const kpis = [
        { label: 'CHIFFRE AFFAIRES', val: `${totalVentes.toFixed(0)} DA`, color: [79, 70, 229] },
        { label: 'BENEFICE NET', val: `${benefice.toFixed(0)} DA`, color: [16, 185, 129] },
        { label: 'CREANCES (NON PAYES)', val: `${totalDettes.toFixed(0)} DA`, color: [239, 68, 68] },
        { label: 'TOTAL VENTES', val: `${ventes.length}`, color: [14, 165, 233] },
      ];

      const cardW = (W - 28 - 9) / 4;
      kpis.forEach((k, i) => {
        const x = 14 + i * (cardW + 3);
        doc.setFillColor(248, 250, 252); doc.roundedRect(x, 50, cardW, 22, 2, 2, 'F');
        doc.setFillColor(...k.color); doc.rect(x, 50, cardW, 2, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...k.color);
        doc.text(k.val, x + cardW / 2, 62, { align: 'center' });
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(100, 116, 139);
        doc.text(k.label, x + cardW / 2, 68, { align: 'center' });
      });

      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(30, 41, 59);
      doc.text('PERFORMANCES PAR PERIODE', 14, 82);

      const periods = [
        { label: '7 Derniers Jours', data: week, c: [139, 92, 246] },
        { label: 'Ce Mois', data: month, c: [14, 165, 233] },
        { label: 'Cette Annee', data: year, c: [16, 185, 129] },
      ];
      const pW = (W - 28 - 6) / 3;
      periods.forEach((p, i) => {
        const x = 14 + i * (pW + 3);
        doc.setFillColor(248, 250, 252); doc.roundedRect(x, 86, pW, 28, 2, 2, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...p.c);
        doc.text(p.label, x + 5, 93);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(30, 41, 59);
        doc.text(`CA : ${p.data.ca.toFixed(0)} DA`, x + 5, 100);
        doc.text(`Benefice : ${p.data.ben.toFixed(0)} DA`, x + 5, 106);
        doc.setTextColor(100, 116, 139);
        doc.text(`${p.data.nb} transaction(s)`, x + 5, 111);
      });

      let y = 124;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(30, 41, 59);
      doc.text('HISTORIQUE DES VENTES', 14, y);
      y += 5;

      doc.setFillColor(241, 245, 249); doc.rect(14, y, W - 28, 7, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(71, 85, 105);
      doc.text('DATE', 17, y + 5);
      doc.text('CLIENT', 42, y + 5);
      doc.text('ARTICLE', 90, y + 5);
      doc.text('QTE', 142, y + 5, { align: 'center' });
      doc.text('TOTAL (DA)', 168, y + 5, { align: 'right' });
      doc.text('STATUT', W - 17, y + 5, { align: 'right' });
      y += 8;

      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
      ventes.slice(0, 30).forEach((v, idx) => {
        if (y > 270) {
          doc.addPage();
          y = 15;
          doc.setFillColor(241, 245, 249); doc.rect(14, y, W - 28, 7, 'F');
          doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(71, 85, 105);
          doc.text('DATE', 17, y + 5);
          doc.text('CLIENT', 42, y + 5);
          doc.text('ARTICLE', 90, y + 5);
          doc.text('QTE', 142, y + 5, { align: 'center' });
          doc.text('TOTAL (DA)', 168, y + 5, { align: 'right' });
          doc.text('STATUT', W - 17, y + 5, { align: 'right' });
          y += 8;
          doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
        }
        if (idx % 2 === 0) {
          doc.setFillColor(250, 250, 250); doc.rect(14, y - 1, W - 28, 6.5, 'F');
        }
        doc.setTextColor(30, 41, 59);
        doc.text(v.date || '', 17, y + 4);
        doc.text((v.client_nom || 'Client').substring(0, 22), 42, y + 4);
        doc.text((v.nom || '').substring(0, 24), 90, y + 4);
        doc.text(`${v.quantite}`, 142, y + 4, { align: 'center' });
        doc.setFont('helvetica', 'bold');
        doc.text(`${(v.total_prix || v.prix * v.quantite).toFixed(0)}`, 168, y + 4, { align: 'right' });
        doc.setFont('helvetica', 'normal');

        if (v.est_paye) {
          doc.setTextColor(21, 128, 61); doc.text('Paye', W - 17, y + 4, { align: 'right' });
        } else {
          doc.setTextColor(185, 28, 28); doc.text('Credit', W - 17, y + 4, { align: 'right' });
        }
        y += 6.5;
      });

      doc.setFillColor(245, 243, 255); doc.rect(0, 285, W, 12, 'F');
      doc.setFontSize(7); doc.setTextColor(100, 116, 139);
      doc.text('BRASTI Production & Vente - Rapport officiel', W / 2, 292, { align: 'center' });

      doc.save(`Rapport_Brasti_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    };

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        canvas.getContext('2d').drawImage(img, 0, 0);
        buildReport(canvas.toDataURL('image/png'));
      };
      img.onerror = () => buildReport(null);
      img.src = '/logo.png';
    } catch { buildReport(null); }
  };

  /* ── Single Sale Invoice PDF ─────────────── */
  const generateInvoice = (v) => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const today = format(new Date(), 'dd/MM/yyyy');
    const invoiceNum = `FAC-${format(new Date(), 'yyyyMM')}-${(v.id || '').substring(0, 4).toUpperCase() || '0001'}`;

    const buildPdf = (logoDataUrl) => {
      doc.setFillColor(79, 70, 229); doc.rect(0, 0, pageW, 36, 'F');
      if (logoDataUrl) {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(14, 5, 26, 26, 3, 3, 'F');
        doc.addImage(logoDataUrl, 'PNG', 16, 7, 22, 22);
      }
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
      doc.text('FACTURE', pageW - 20, 18, { align: 'right' });
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(`N : ${invoiceNum}`, pageW - 20, 25, { align: 'right' });
      doc.text(`Date : ${today}`, pageW - 20, 31, { align: 'right' });

      doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
      doc.text('BRASTI', logoDataUrl ? 44 : 20, 17);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
      doc.text('Production & Vente de produits de nettoyage', logoDataUrl ? 44 : 20, 24);

      // Client block
      doc.setFillColor(248, 250, 252); doc.roundedRect(20, 44, pageW - 40, 24, 2, 2, 'F');
      doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
      doc.text('Facture a :', 26, 52);
      doc.setFontSize(10.5); doc.text(v.client_nom || 'Client Particulier', 26, 59);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(100, 116, 139);
      if (v.client_tel) doc.text(`Tel : ${v.client_tel}`, 26, 65);

      // Table
      doc.setFillColor(241, 245, 249); doc.rect(20, 75, pageW - 40, 9, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(71, 85, 105);
      doc.text('DESCRIPTION', 26, 81);
      doc.text('QTE', 110, 81, { align: 'center' });
      doc.text('PRIX UNIT.', 145, 81, { align: 'center' });
      doc.text('TOTAL', pageW - 24, 81, { align: 'right' });

      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(30, 41, 59);
      doc.text(v.nom, 26, 94);
      doc.text(`${v.quantite}`, 110, 94, { align: 'center' });
      doc.text(`${(+v.prix).toFixed(2)} DA`, 145, 94, { align: 'center' });
      doc.setFont('helvetica', 'bold');
      doc.text(`${(v.prix * v.quantite).toFixed(2)} DA`, pageW - 24, 94, { align: 'right' });

      // Total Box
      doc.setFillColor(79, 70, 229);
      doc.roundedRect(pageW - 90, 110, 70, 18, 3, 3, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(255, 255, 255);
      doc.text('TOTAL A PAYER', pageW - 55, 117, { align: 'center' });
      doc.setFontSize(12);
      doc.text(`${(v.prix * v.quantite).toFixed(2)} DA`, pageW - 55, 124, { align: 'center' });

      doc.save(`Facture_${v.client_nom || 'Client'}_${invoiceNum}.pdf`);
    };

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        canvas.getContext('2d').drawImage(img, 0, 0);
        buildPdf(canvas.toDataURL('image/png'));
      };
      img.onerror = () => buildPdf(null);
      img.src = '/logo.png';
    } catch { buildPdf(null); }
  };

  /* ── Auth submit ─────────────────────────── */
  const handleAuth = async (e) => {
    e.preventDefault(); setAuthLoad(true); setAuthError('');
    try {
      const { error } = authMode === 'login'
        ? await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword })
        : await supabase.auth.signUp({ email: authEmail, password: authPassword });
      if (error) setAuthError(error.message);
    } catch (err) {
      setAuthError('Erreur de connexion');
    } finally {
      setAuthLoad(false);
    }
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
      setModal(false);
      Swal.fire('Erreur', err?.message || 'Erreur enregistrement', 'error');
    } finally { 
      setSubmit(false); 
    }
  };

  /* ── Delete handle ───────────────────────── */
  const handleDelete = async (table, id) => {
    const { isConfirmed } = await Swal.fire({
      title: 'Supprimer cet élément ?',
      text: "Cette action est irréversible !",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Oui, supprimer',
      cancelButtonText: 'Annuler'
    });

    if (isConfirmed) {
      try {
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (error) throw error;
        Swal.fire({ icon: 'success', title: 'Supprimé !', timer: 800, showConfirmButton: false });
        fetchData();
      } catch (err) {
        Swal.fire('Erreur', err.message, 'error');
      }
    }
  };

  /* ── Update Product (edit stock) ─────────── */
  const handleUpdate = async (e) => {
    e.preventDefault(); setSubmit(true);
    try {
      const { error } = await supabase.from('products').update({
        nom: form.nom,
        prix_unitaire: +form.prix,
        stock_qty: +form.quantite,
      }).eq('id', form.product_id);
      if (error) throw error;
      setModal(false);
      fetchData();
      Swal.fire({ icon: 'success', title: 'Mis à jour !', timer: 900, showConfirmButton: false });
    } catch (err) {
      setModal(false);
      Swal.fire('Erreur', err?.message || 'Erreur mise à jour', 'error');
    } finally { 
      setSubmit(false); 
    }
  };

  const openEditProduct = (p) => {
    setForm({ nom: p.nom, quantite: p.stock_qty, prix: p.prix_unitaire, product_id: p.id, client_nom: '', client_tel: '', est_paye: true });
    setModalType('editProduct'); setModal(true);
  };

  /* ── AI Chat Assistant (100% Français Professionnel) ───────────── */
  const handleClearChat = async () => {
    const result = await Swal.fire({
      title: 'Effacer la conversation ?',
      text: 'Tous les messages seront définitivement supprimés.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Oui, effacer',
      cancelButtonText: 'Annuler'
    });

    if (result.isConfirmed) {
      setMessages([]);
      try {
        if (session?.user?.id) {
          await supabase.from('messages').delete().eq('user_id', session.user.id);
        }
        await supabase.from('messages').delete().neq('id', 0);
      } catch (e) {
        console.warn('Error clearing messages:', e);
      }
      Swal.fire({ icon: 'success', title: 'Conversation effacée !', timer: 1000, showConfirmButton: false });
    }
  };

  const handleDeleteMessage = async (msgId) => {
    setMessages(prev => prev.filter(m => m.id !== msgId));
    try {
      await supabase.from('messages').delete().eq('id', msgId);
    } catch (e) {
      console.warn('Error deleting message:', e);
    }
  };

  const handleSend = async (customPrompt) => {
    const textToSend = typeof customPrompt === 'string' ? customPrompt : chatInput;
    if (!textToSend.trim() || isBotTyping) return;
    const content = textToSend.trim();
    setChatInput('');

    let userMsgId = Date.now();
    try {
      const { data } = await supabase.from('messages').insert([{ user_id: session.user.id, sender: 'customer', content }]).select().single();
      if (data?.id) userMsgId = data.id;
    } catch {
      supabase.from('messages').insert([{ user_id: session.user.id, sender: 'customer', content }]).then(() => {});
    }

    const userMsg = { id: userMsgId, sender: 'customer', content, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);

    setIsBotTyping(true);
    try {
      const totalArticlesVendus = ventes.reduce((s, v) => s + (+v.quantite || 1), 0);
      const nbVentes = ventes.length;

      // Group sales by product
      const topProductsMap = {};
      ventes.forEach(v => {
        const nom = v.nom || 'Produit';
        topProductsMap[nom] = (topProductsMap[nom] || 0) + (+v.quantite || 1);
      });
      const topProductsList = Object.entries(topProductsMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([nom, qte]) => `• **${nom}** : ${qte} unité(s)`)
        .join('\n');

      const productsInfo = products.map(p => `${p.nom} (stock: ${p.stock_qty}, coût: ${p.prix_unitaire} DA)`).join(', ');

      const ctx = `Tu es l'assistant commercial et financier intelligent de BRASTI (application de gestion de production, stocks et ventes).
DONNÉES EN TEMPS RÉEL :
- Chiffre d'affaires total : ${totalVentes.toFixed(0)} DA
- Total des coûts/achats : ${totalAchats.toFixed(0)} DA
- Bénéfice net actuel : ${benefice.toFixed(0)} DA
- Nombre d'opérations de vente : ${nbVentes}
- Total d'articles vendus : ${totalArticlesVendus} unités
- Total des dettes/créances clients : ${totalDettes.toFixed(0)} DA
- Stock produits : ${productsInfo || 'aucun produit'}
- Top ventes :
${topProductsList || 'aucune vente'}

CONSIGNES STRICTES :
1. Réponds EXCLUSIVEMENT en français clair, élégant et professionnel.
2. N'utilise JAMAIS de darija ni de termes en arabe.
3. Sois précis, donne les chiffres réels ci-dessus.
4. Structure ta réponse avec des puces.`;

      // Prepare conversation history
      const history = messages.slice(-4).map(m => ({
        role: m.sender === 'customer' ? 'user' : 'assistant',
        content: m.content
      }));

      // Call Google Gemini Web / AI service
      let botContent = await getGeminiReply(content, ctx, history);

      // Fallback intelligent en Français
      if (!botContent) {
        const q = content.toLowerCase();

        // Quantité de produits vendus ("chhal mn mntoj tba3", "combien de produits vendus", etc.)
        if (q.includes('produit') || q.includes('mntoj') || q.includes('article') || q.includes('combien') || q.includes('quantite') || q.includes('chhal') || q.includes('nb')) {
          botContent = `📊 **Statistiques des articles vendus :**\n\n` +
            `• **Total d'articles vendus :** **${totalArticlesVendus} unités** au total\n` +
            `• **Nombre d'opérations de vente :** **${nbVentes} vente(s)**\n` +
            `• **Chiffre d'affaires réalisé :** **${totalVentes.toFixed(0)} DA**\n\n` +
            (topProductsList ? `🏆 **Détail par produit :**\n${topProductsList}` : `Aucune vente enregistrée pour le moment.`);
        }
        // Bénéfice / Profit / Marge
        else if (q.includes('rbh') || q.includes('profit') || q.includes('bénéfice') || q.includes('benefice') || q.includes('marge') || q.includes('gain')) {
          botContent = `💰 **Bénéfice Net Actuel :**\n\n` +
            `• **Bénéfice net :** **${benefice.toFixed(0)} DA**\n` +
            `• **Chiffre d'affaires :** ${totalVentes.toFixed(0)} DA\n` +
            `• **Total achats et dépenses :** ${totalAchats.toFixed(0)} DA\n\n` +
            (benefice >= 0 ? `✅ Votre activité est rentable avec un résultat positif.` : `⚠️ Vos dépenses dépassent actuellement vos recettes.`);
        }
        // Ventes
        else if (q.includes('bi3') || q.includes('vente') || q.includes('chiffre') || q.includes('ca')) {
          botContent = `📈 **Rapport du Chiffre d'Affaires :**\n\n` +
            `• **Chiffre d'affaires :** **${totalVentes.toFixed(0)} DA**\n` +
            `• **Nombre de ventes :** ${nbVentes}\n` +
            `• **Volume total vendu :** ${totalArticlesVendus} unités`;
        }
        // Dettes / Crédits
        else if (q.includes('dyn') || q.includes('dette') || q.includes('credit') || q.includes('créance') || q.includes('payer') || q.includes('reglement')) {
          botContent = `⚠️ **Créances & Dettes Clients :**\n\n` +
            `• **Total des impayés clients :** **${totalDettes.toFixed(0)} DA**\n\n` +
            (totalDettes > 0 ? `Consultez l'onglet **Clients** ou **Règlements** pour effectuer les relances.` : `✨ Parfait ! Aucun impayé en attente.`);
        }
        // Stock
        else if (q.includes('stok') || q.includes('stock') || q.includes('inventaire') || q.includes('quantité')) {
          const alertes = products.filter(p => p.stock_qty <= 5);
          botContent = `📦 **État de l'Inventaire :**\n\n` +
            (products.length > 0 ? products.map(p => `• **${p.nom}** : ${p.stock_qty} unité(s) (${p.stock_qty <= 5 ? '⚠️ Stock faible' : '✅ En stock'})`).join('\n') : `Aucun produit dans l'inventaire.`) +
            (alertes.length > 0 ? `\n\n⚠️ **${alertes.length} produit(s)** nécessitent un réapprovisionnement rapide.` : '');
        }
        // Salutations
        else if (q.includes('bonjour') || q.includes('salut') || q.includes('hello') || q.includes('hi') || q.includes('coucou') || q.includes('aide')) {
          botContent = `👋 **Bonjour !** Je suis l'assistant intelligent de votre plateforme BRASTI.\n\n` +
            `Je peux analyser vos données financières en direct :\n` +
            `• Ventes et total d'articles vendus\n` +
            `• Bénéfice net et chiffre d'affaires\n` +
            `• Alertes stock et inventaire\n` +
            `• Suivi des dettes et règlements clients\n\n` +
            `Que souhaitez-vous vérifier aujourd'hui ?`;
        }
        // Vue d'ensemble
        else {
          botContent = `🤖 **Synthèse de votre activité :**\n\n` +
            `• **Chiffre d'affaires :** **${totalVentes.toFixed(0)} DA** (${nbVentes} ventes)\n` +
            `• **Articles vendus :** **${totalArticlesVendus} unités**\n` +
            `• **Bénéfice net :** **${benefice.toFixed(0)} DA**\n` +
            `• **Dettes clients :** **${totalDettes.toFixed(0)} DA**\n\n` +
            `Posez-moi une question précise (ex: *"Combien de produits vendus ?"*, *"Quel est le bénéfice ?"*, *"État du stock"*).`;
        }
      }

      let botMsgId = Date.now() + 1;
      try {
        const { data } = await supabase.from('messages').insert([{ user_id: session.user.id, sender: 'admin', content: botContent }]).select().single();
        if (data?.id) botMsgId = data.id;
      } catch {
        supabase.from('messages').insert([{ user_id: session.user.id, sender: 'admin', content: botContent }]).then(() => {});
      }

      const botMsg = { id: botMsgId, sender: 'admin', content: botContent, is_bot: true, created_at: new Date().toISOString() };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      console.error('Chat error:', err);
      const fallbackMsg = {
        id: Date.now() + 1,
        sender: 'admin',
        content: `👋 **Bonjour !** Je suis l'assistant intelligent de votre plateforme BRASTI.\n\n` +
          `• **Chiffre d'affaires :** ${(totalVentes || 0).toFixed(0)} DA\n` +
          `• **Bénéfice net :** ${(benefice || 0).toFixed(0)} DA\n` +
          `• **Créances / Dettes :** ${(totalDettes || 0).toFixed(0)} DA\n\n` +
          `Que souhaitez-vous savoir concernant votre activité ?`,
        is_bot: true,
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setIsBotTyping(false);
    }
  };

  const openQuickSell = (v) => {
    setForm(f => ({ ...f, client_nom: v.client_nom || '', client_tel: v.client_tel || '', nom: '', product_id: '', est_paye: true }));
    setModalType('vente'); setModal(true);
  };

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
          Gérez votre production & ventes facilement
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
     ALL APP TABS LIST
  ════════════════════════════════════════════ */
  const TABS_LIST = [
    { id: 'dashboard',   label: 'Dashboard',   icon: '🏠' },
    { id: 'clients',     label: 'Clients',     icon: '👥' },
    { id: 'produits',    label: 'Produits',    icon: '🏷️' },
    { id: 'stock',       label: 'Stock',       icon: '📦' },
    { id: 'production',  label: 'Production',  icon: '🏭' },
    { id: 'ventes',      label: 'Ventes',      icon: '🛒' },
    { id: 'achats',      label: 'Achats',      icon: '🚚' },
    { id: 'reglements',  label: 'Règlements',  icon: '💳' },
    { id: 'caisse',      label: 'Caisse',      icon: '💰' },
    { id: 'apports',     label: 'Apports',     icon: '📈' },
    { id: 'personnel',   label: 'Personnel',   icon: '👷' },
    { id: 'stats',       label: 'Stats',       icon: '📊' },
    { id: 'chat',        label: 'AI Chat',     icon: '🤖' },
    { id: 'dev',         label: 'Dev',         icon: '👨‍💻' },
  ];

  /* ═══════════════════════════════════════════
     MAIN APP
  ════════════════════════════════════════════ */
  return (
    <div className="app-wrapper">
      {/* Header */}
      <header className="header">
        <div className="header-title">
          <img src="/logo.png" alt="Brasti" style={{ height: 36, width: 36, objectFit: 'contain', marginRight: 10, verticalAlign: 'middle' }} onError={e => e.target.style.display='none'} />
          <span style={{ verticalAlign: 'middle' }}>Brasti Platform</span>
        </div>
        <div className="header-actions">
          <button className="icon-btn" onClick={fetchData} title="Rafraîchir"><RefreshCw size={18} /></button>
          <button className="icon-btn" style={{ background: 'var(--primary)', color: 'white', border: 'none' }} onClick={generateFullReport} title="Télécharger Rapport PDF"><Download size={18} /></button>
          <button className="icon-btn" onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')} title="Thème"><Sun size={18} /></button>
          <button className="icon-btn" onClick={() => supabase.auth.signOut()} title="Déconnexion"><LogOut size={18} /></button>
        </div>
      </header>

      {/* Database Error Banner */}
      {dbError && (
        <div style={{ margin: '0 0 16px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 14, padding: '12px 16px', color: '#991b1b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem' }}>
            <AlertTriangle size={18} />
            <span>Erreur de connexion à la base de données. Si le projet est en pause, activez-le sur Supabase.</span>
          </div>
          <button onClick={fetchData} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
            Réessayer
          </button>
        </div>
      )}

      {/* PWA Install Banner */}
      {showInstallBanner && (
        <div style={{
          margin: '0 0 16px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
          borderRadius: 20, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
          color: 'white', boxShadow: '0 8px 25px rgba(79,70,229,0.3)'
        }}>
          <img src="/logo.png" alt="" style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'contain', background: 'white', padding: 4 }} onError={e => e.target.style.display='none'} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>Installer l'application Brasti</div>
            <div style={{ fontSize: '0.8rem', opacity: 0.85, marginTop: 2 }}>Accès rapide depuis votre écran d'accueil</div>
          </div>
          <button onClick={installApp} style={{ background:'white', color:'#4f46e5', border:'none', borderRadius:12, padding:'9px 16px', fontWeight:800, cursor:'pointer', fontSize:'0.82rem', display:'flex', alignItems:'center', gap:6 }}>
            <Smartphone size={16} /> Installer
          </button>
          <button onClick={() => setShowInstallBanner(false)} style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'50%', width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'white' }}><X size={14} /></button>
        </div>
      )}

      {/* Nav Tabs Bar (Scrollable Pill Navigation) */}
      <div className="nav-tabs-wrapper">
        <nav className="nav-tabs">
          {TABS_LIST.map(tab => (
            <button 
              key={tab.id} 
              className={`nav-tab${activeTab === tab.id ? ' active' : ''}`} 
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <main id="app-content">

        {/* ── 1. DASHBOARD ORIGINAL ─────────────────────────────────── */}
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
                  <div><div className="stat-value" style={{ color: '#ef4444' }}>{totalDettes.toFixed(0)} DA</div><div className="stat-label">Non Payés (Crédit)</div></div>
                  <AlertTriangle color="#ef4444" size={30} />
                </div>
              </div>
              <div className="stat-card" style={{ borderLeft: '5px solid #4f46e5' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div><div className="stat-value" style={{ color: '#4f46e5' }}>{totalVentes.toFixed(0)} DA</div><div className="stat-label">Chiffre d'Affaires</div></div>
                  <ShoppingBag color="#4f46e5" size={30} />
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="glass-container">
              <div className="section-header">
                <h3>Évolution des Ventes</h3>
              </div>
              <div style={{ height: 260 }}>
                <Line
                  data={{
                    labels: ventes.slice(0, 10).reverse().map(v => v.date || ''),
                    datasets: [{
                      label: 'Ventes (DA)',
                      data: ventes.slice(0, 10).reverse().map(v => v.total_prix || (v.prix * v.quantite)),
                      borderColor: '#4f46e5',
                      backgroundColor: 'rgba(79, 70, 229, 0.1)',
                      fill: true,
                      tension: 0.3
                    }]
                  }}
                  options={{ responsive: true, maintainAspectRatio: false }}
                />
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              <button className="btn-primary" style={{ padding: 16 }} onClick={() => openModal('vente')}>
                <Plus size={18} /> Nouvelle Vente
              </button>
              <button className="btn-secondary" style={{ padding: 16 }} onClick={() => openModal('product')}>
                <Plus size={18} /> Nouveau Produit
              </button>
              <button className="btn-secondary" style={{ padding: 16 }} onClick={() => openModal('achat')}>
                <Plus size={18} /> Nouvel Achat
              </button>
              <button className="btn-secondary" style={{ padding: 16 }} onClick={generateFullReport}>
                <Download size={18} /> Télécharger Rapport
              </button>
            </div>
          </div>
        )}

        {/* ── 2. CLIENTS (NOUVEAU MODULE) ─────────────────────────── */}
        {activeTab === 'clients' && <ClientsModule session={session} theme={theme} />}

        {/* ── 3. PRODUITS & CODES-BARRES (NOUVEAU MODULE) ─────────── */}
        {activeTab === 'produits' && <ProduitsModule session={session} theme={theme} />}

        {/* ── 4. STOCK (STOCK ORIGINAL + MATIÈRES PREMIÈRES) ───────── */}
        {activeTab === 'stock' && (
          <div className="animate-enter">
            <StockModule session={session} theme={theme} />
          </div>
        )}

        {/* ── 5. PRODUCTION & RECETTES (NOUVEAU MODULE) ────────────── */}
        {activeTab === 'production' && <ProductionModule session={session} theme={theme} />}

        {/* ── 6. VENTES & FACTURES & BL (MODULE COMPLET) ──────────── */}
        {activeTab === 'ventes' && <VentesModule session={session} theme={theme} />}

        {/* ── 7. ACHATS & FOURNISSEURS (NOUVEAU MODULE) ───────────── */}
        {activeTab === 'achats' && <AchatsModule session={session} theme={theme} />}

        {/* ── 8. RÈGLEMENTS CLIENTS & FOURNISSEURS (NOUVEAU MODULE) ─ */}
        {activeTab === 'reglements' && <ReglementsModule session={session} theme={theme} />}

        {/* ── 9. CAISSE & DÉPENSES (NOUVEAU MODULE) ───────────────── */}
        {activeTab === 'caisse' && <CaisseModule session={session} theme={theme} />}

        {/* ── 10. APPORTS, INVESTISSEMENTS & PRÊTS (NOUVEAU MODULE) ─ */}
        {activeTab === 'apports' && <ApportsModule session={session} theme={theme} />}

        {/* ── 11. PERSONNEL & SALAIRES (NOUVEAU MODULE) ───────────── */}
        {activeTab === 'personnel' && <PersonnelModule session={session} theme={theme} />}

        {/* ── 12. STATS TAB ORIGINAL ───────────────────────────────── */}
        {activeTab === 'stats' && (
          <div className="animate-enter">
            {[
              { label: 'Cette Semaine', ...statsBy('week'), color: '#8b5cf6' },
              { label: 'Ce Mois', ...statsBy('month'), color: '#0ea5e9' },
              { label: 'Cette Année', ...statsBy('year'), color: '#10b981' },
            ].map(s => (
              <div key={s.label} className="glass-container" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h4 style={{ fontWeight: 800, fontSize: '1rem' }}>📈 {s.label}</h4>
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

            <div className="glass-container">
              <h4 style={{ fontWeight: 800, marginBottom: 16 }}>🏆 Top Produits Vendus</h4>
              {topProducts.length === 0 ? <p style={{ color: 'var(--muted)' }}>Aucune vente enregistrée.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {topProducts.map((p, i) => (
                    <div key={p.nom} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontWeight: 800, color: 'var(--primary)', width: 20 }}>#{i + 1}</span>
                        <div><strong>{p.nom}</strong><div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{p.qty} unités vendues</div></div>
                      </div>
                      <strong style={{ color: '#10b981' }}>{p.total.toFixed(0)} DA</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 13. AI CHAT ASSISTANT (FRANÇAIS PROFESSIONNEL) ───────────── */}
        {activeTab === 'chat' && (
          <div className="glass-container animate-enter" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="chat-window-card">
              {/* Header */}
              <div className="chat-header-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="chat-avatar-ai">
                    🤖
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)' }}>Assistant BRASTI</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#10b981', fontWeight: 700 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                      En ligne · Intelligence de gestion
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button 
                    onClick={handleClearChat}
                    className="btn-clear-chat"
                    title="Effacer toute la conversation"
                  >
                    <Trash2 size={15} />
                    <span>Effacer le chat</span>
                  </button>
                </div>
              </div>

              {/* Messages Body */}
              <div className="chat-messages">
                {messages.length === 0 ? (
                  <div className="chat-empty-intro">
                    <div style={{ fontSize: '3rem', marginBottom: 12 }}>🤖</div>
                    <h4 style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--text)', margin: '0 0 6px' }}>
                      Comment puis-je vous aider aujourd'hui ?
                    </h4>
                    <p style={{ color: 'var(--muted)', fontSize: '0.88rem', maxWidth: 440, margin: '0 auto 20px', lineHeight: 1.5 }}>
                      Posez vos questions sur vos ventes, votre stock, vos bénéfices et la gestion de votre activité.
                    </p>

                    {/* Quick suggestion chips */}
                    <div className="chat-suggestion-chips">
                      {[
                        { label: '📊 Combien de produits vendus ?', query: 'Combien de produits vendus au total ?' },
                        { label: '💰 Quel est mon bénéfice net ?', query: 'Quel est mon bénéfice net actuel ?' },
                        { label: '📦 État du stock disponible', query: 'Quel est l\'état actuel du stock ?' },
                        { label: '⚠️ Total des dettes clients', query: 'Quel est le montant total des dettes clients ?' },
                      ].map((chip, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="chat-chip-btn"
                          onClick={() => handleSend(chip.query)}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map(m => (
                    <div 
                      key={m.id} 
                      className={`message-wrapper ${m.sender === 'customer' ? 'msg-user' : 'msg-bot'}`}
                    >
                      {m.sender !== 'customer' && (
                        <div className="msg-avatar-icon">🤖</div>
                      )}

                      <div className="msg-bubble">
                        <div className="msg-content" style={{ whiteSpace: 'pre-line' }}>
                          {m.content}
                        </div>
                        <div className="msg-footer">
                          {m.created_at && (
                            <span className="msg-time">
                              {format(new Date(m.created_at), 'HH:mm')}
                            </span>
                          )}
                          <button 
                            className="msg-delete-btn"
                            onClick={() => handleDeleteMessage(m.id)}
                            title="Supprimer ce message"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {m.sender === 'customer' && (
                        <div className="msg-avatar-icon user-avatar">👤</div>
                      )}
                    </div>
                  ))
                )}

                {isBotTyping && (
                  <div className="message-wrapper msg-bot">
                    <div className="msg-avatar-icon">🤖</div>
                    <div className="msg-bubble typing-bubble">
                      <span className="dot" />
                      <span className="dot" />
                      <span className="dot" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="chat-input-area">
                <input 
                  type="text" 
                  className="form-control chat-input" 
                  placeholder="Posez votre question (ex: Combien de produits vendus ?)..." 
                  value={chatInput} 
                  onChange={e => setChatInput(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && handleSend()} 
                  disabled={isBotTyping}
                />
                <button 
                  className="btn-primary btn-chat-send" 
                  onClick={() => handleSend()}
                  disabled={isBotTyping || !chatInput.trim()}
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── 14. DEV PROFILE (Hamza Amirni) ────────────────────────── */}
        {activeTab === 'dev' && (
          <div className="animate-enter" style={{ padding: '0 0 40px' }}>
            {/* Hero Card */}
            <div style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #a855f7 100%)',
              borderRadius: 28, padding: '40px 28px 32px', textAlign: 'center',
              marginBottom: 20, position: 'relative', overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(79,70,229,0.35)'
            }}>
              {/* Decorative circles */}
              <div style={{ position:'absolute', top:-40, right:-40, width:160, height:160, borderRadius:'50%', background:'rgba(255,255,255,0.06)' }} />
              <div style={{ position:'absolute', bottom:-30, left:-30, width:120, height:120, borderRadius:'50%', background:'rgba(255,255,255,0.06)' }} />

              <div style={{ position:'relative', zIndex:1 }}>
                <div style={{ width:100, height:100, borderRadius:'50%', margin:'0 auto 16px', border:'4px solid rgba(255,255,255,0.5)', overflow:'hidden', background:'white', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <img src="/logo.png" alt="Hamza Amirni" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e => { e.target.src = 'https://ui-avatars.com/api/?name=Hamza+Amirni&background=4f46e5&color=fff'; }} />
                </div>
                <h2 style={{ color:'white', fontWeight:900, fontSize:'1.6rem', margin:'0 0 6px', letterSpacing:'-0.5px' }}>Hamza Amirni</h2>
                <p style={{ color:'rgba(255,255,255,0.85)', fontSize:'0.95rem', margin:'0 0 20px', fontWeight:500 }}>Full-Stack Developer · Créateur de Brasti</p>
                <div style={{ display:'flex', justifyContent:'center', gap:10, flexWrap:'wrap' }}>
                  {['React', 'Node.js', 'Supabase', 'PWA', 'Python'].map(skill => (
                    <span key={skill} style={{ padding:'5px 14px', background:'rgba(255,255,255,0.18)', borderRadius:30, color:'white', fontSize:'0.78rem', fontWeight:700, backdropFilter:'blur(10px)', border:'1px solid rgba(255,255,255,0.25)' }}>{skill}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Stats Row */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
              {[
                { emoji:'💻', label:'Apps créées', value:'10+' },
                { emoji:'⭐', label:'Projets livrés', value:'20+' },
                { emoji:'🚀', label:'Années exp.', value:'3+' },
              ].map(s => (
                <div key={s.label} style={{ background:'var(--card)', borderRadius:20, padding:'18px 12px', textAlign:'center', border:'1.5px solid var(--card-border)', boxShadow:'0 4px 16px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize:'1.6rem', marginBottom:4 }}>{s.emoji}</div>
                  <div style={{ fontWeight:900, fontSize:'1.3rem', color:'var(--primary)' }}>{s.value}</div>
                  <div style={{ fontSize:'0.72rem', color:'var(--muted)', fontWeight:600, marginTop:2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Social Links & Accounts */}
            <div style={{ background:'var(--card)', borderRadius:24, padding:'24px 20px', border:'1.5px solid var(--card-border)', marginBottom:16, boxShadow:'0 4px 20px rgba(0,0,0,0.06)' }}>
              <h4 style={{ fontWeight:800, marginBottom:16, fontSize:'0.95rem', color:'var(--text)', letterSpacing:'-0.3px' }}>🌐 Réseaux Sociaux & Contacts</h4>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {[
                  { label:'Portfolio',   icon:'🌐', url:'https://hamzaamirni.netlify.app',    color:'#4f46e5', desc:'Voir mes projets & réalisations' },
                  { label:'Instagram',   icon:'📷', url:'https://instagram.com/hamza_amirni_01', color:'#e1306c', desc:'@hamza_amirni_01' },
                  { label:'YouTube',     icon:'🎥', url:'https://www.youtube.com/@Hamzaamirni01', color:'#ff0000', desc:'Tutoriels & contenus' },
                  { label:'WhatsApp',    icon:'💬', url:'https://whatsapp.com/channel/0029ValXRoHCnA7yKopcrn1p', color:'#25d366', desc:'Canal officiel WhatsApp' },
                  { label:'Facebook',    icon:'📘', url:'https://www.facebook.com/profile.php?id=61564527797752', color:'#1877f2', desc:'Page Facebook' },
                  { label:'Telegram',    icon:'✈️', url:'https://t.me/hamzaamirni',           color:'#229ED9', desc:'@hamzaamirni' },
                ].map(link => (
                  <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer"
                    style={{ display:'flex', alignItems:'center', gap:14, padding:'13px 16px', borderRadius:16, background:`${link.color}0d`, border:`1.5px solid ${link.color}22`, textDecoration:'none', transition:'all 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.transform='translateX(4px)'}
                    onMouseLeave={e => e.currentTarget.style.transform='translateX(0)'}
                  >
                    <span style={{ fontSize:'1.3rem', width:38, height:38, display:'flex', alignItems:'center', justifyContent:'center', background:`${link.color}18`, borderRadius:12 }}>{link.icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:800, color:'var(--text)', fontSize:'0.9rem' }}>{link.label}</div>
                      <div style={{ fontSize:'0.75rem', color:'var(--muted)', marginTop:1 }}>{link.desc}</div>
                    </div>
                    <span style={{ color:link.color, fontWeight:800, fontSize:'1rem' }}>→</span>
                  </a>
                ))}
              </div>
            </div>

            {/* App Info sans GitHub */}
            <div style={{ background:'linear-gradient(135deg, rgba(79,70,229,0.08), rgba(124,58,237,0.06))', borderRadius:24, padding:'22px 20px', border:'1.5px solid rgba(79,70,229,0.15)', textAlign:'center' }}>
              <div style={{ fontSize:'2rem', marginBottom:8 }}>🏭</div>
              <h4 style={{ fontWeight:900, color:'var(--text)', marginBottom:6 }}>Brasti Platform</h4>
              <p style={{ color:'var(--muted)', fontSize:'0.83rem', lineHeight:1.6, maxWidth: 480, margin: '0 auto 14px' }}>Application complète de gestion de production, stock et vente · Conçue pour les entreprises en pleine croissance.</p>
              <div style={{ display:'flex', justifyContent:'center', gap:10, flexWrap:'wrap' }}>
                <a href="https://brasti.netlify.app" target="_blank" rel="noopener noreferrer" style={{ padding:'10px 20px', background:'var(--primary)', color:'white', borderRadius:14, fontSize:'0.82rem', fontWeight:800, textDecoration:'none' }}>⚡ Ouvrir l'application</a>
                <a href="https://hamzaamirni.netlify.app" target="_blank" rel="noopener noreferrer" style={{ padding:'10px 20px', background:'rgba(79,70,229,0.1)', color:'var(--primary)', border:'1.5px solid rgba(79,70,229,0.2)', borderRadius:14, fontSize:'0.82rem', fontWeight:800, textDecoration:'none' }}>💼 Mon Portfolio</a>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ── MODALS ORIGINAUX ────────────────────────────────────── */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal-content animate-enter" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {modalType === 'product' ? '📦 Nouveau Produit' : modalType === 'achat' ? '🚚 Nouvel Achat' : modalType === 'editProduct' ? '✏️ Modifier Produit' : '🛒 Nouvelle Vente'}
              </h3>
              <button className="modal-close-btn" onClick={() => setModal(false)}>×</button>
            </div>

            {/* Form edit product */}
            {modalType === 'editProduct' && (
              <form onSubmit={handleUpdate}>
                <div className="form-group">
                  <label>Désignation</label>
                  <input className="form-control" value={form.nom} required onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label>Prix (DA)</label>
                    <input type="number" step="0.01" className="form-control" value={form.prix} required onChange={e => setForm(f => ({ ...f, prix: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Stock</label>
                    <input type="number" min="0" className="form-control" value={form.quantite} required onChange={e => setForm(f => ({ ...f, quantite: e.target.value }))} />
                  </div>
                </div>
                <button type="submit" className="btn-primary" style={{ width: '100%', padding: '14px', marginTop: 10 }} disabled={isSubmitting}>
                  {isSubmitting ? '...' : 'Mettre à jour'}
                </button>
              </form>
            )}

            {/* Form Achat / Vente / Produit Original */}
            {modalType !== 'editProduct' && (
              <form onSubmit={handleSubmit}>
                {modalType === 'vente' && (
                  <div className="form-group">
                    <label>Lier à un Produit du Stock</label>
                    <select className="form-control" value={form.product_id} onChange={e => {
                      const p = products.find(x => x.id === e.target.value);
                      setForm(f => p ? { ...f, product_id: p.id, nom: p.nom, prix: +(p.prix_unitaire * 1.2).toFixed(2) } : { ...f, product_id: '' });
                    }}>
                      <option value="">-- Sélectionner un produit existant --</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.nom} (Stock: {p.stock_qty})</option>)}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label>Désignation de l'article *</label>
                  <input className="form-control" required value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="Ex: Javel 1L" />
                </div>

                {modalType === 'vente' && (
                  <div className="form-row">
                    <div className="form-group">
                      <label>Client</label>
                      <input className="form-control" value={form.client_nom} onChange={e => setForm(f => ({ ...f, client_nom: e.target.value }))} placeholder="Nom du client" />
                    </div>
                    <div className="form-group">
                      <label>Téléphone</label>
                      <input className="form-control" value={form.client_tel} onChange={e => setForm(f => ({ ...f, client_tel: e.target.value }))} placeholder="06XXXXXXXX" />
                    </div>
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label>Quantité</label>
                    <input type="number" min="1" className="form-control" value={form.quantite} required onChange={e => setForm(f => ({ ...f, quantite: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Prix Unitaire (DA)</label>
                    <input type="number" step="0.01" className="form-control" value={form.prix} required onChange={e => setForm(f => ({ ...f, prix: e.target.value }))} />
                  </div>
                </div>

                <div style={{ background: 'rgba(79,70,229,0.06)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontWeight: 800 }}>
                  Total : <span style={{ color: 'var(--primary)' }}>{(+form.prix * +form.quantite).toFixed(2)} DA</span>
                </div>

                <button type="submit" className="btn-primary" style={{ width: '100%', padding: '14px' }} disabled={isSubmitting}>
                  {isSubmitting ? '...' : 'Valider et Enregistrer'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
