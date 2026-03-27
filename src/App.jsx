import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, ShoppingCart, TrendingDown, Package, 
  Plus, Search, Download, Moon, Sun, Trash2, RefreshCw,
  LogOut, User, Printer, Award, Calendar, Smartphone,
  MessageSquare, PlusCircle, Phone, Mail, MessageCircle, MoreHorizontal
} from 'lucide-react';
import { format, isThisWeek, isThisMonth, isThisYear, isToday, parseISO } from 'date-fns';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { supabase } from './supabaseClient';
import * as htmlToImage from 'html-to-image';
import { jsPDF } from 'jspdf';
import Swal from 'sweetalert2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function App() {
  const [session, setSession] = useState(null);
  const [authMode, setAuthMode] = useState('login'); 
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const [activeTab, setActiveTab] = useState('dashboard');
  const [theme, setTheme] = useState('light');
  const [achats, setAchats] = useState([]);
  const [ventes, setVentes] = useState([]);
  const [products, setProducts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [companyInfo, setCompanyInfo] = useState({ phone: '0555 00 11 22', email: 'contact@brasti.com' });
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('achat'); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    nom: '', client_nom: '', client_tel: '', quantite: '', prix: '', 
    description: '', features: '', statut_paiement: 'payé', date: format(new Date(), 'yyyy-MM-dd')
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [installPrompt, setInstallPrompt] = useState(null);
  const [dashboardFilter, setDashboardFilter] = useState('all');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  const fetchData = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [achatsRes, ventesRes, productsRes, messagesRes, companyRes] = await Promise.all([
        supabase.from('achats').select('*').order('date', { ascending: false }),
        supabase.from('ventes').select('*').order('date', { ascending: false }),
        supabase.from('products').select('*').order('created_at', { ascending: false }),
        supabase.from('messages').select('*').order('created_at', { ascending: true }),
        supabase.from('company_info').select('*').single()
      ]);
      if (achatsRes.data) setAchats(achatsRes.data);
      if (ventesRes.data) setVentes(ventesRes.data);
      if (productsRes.data) setProducts(productsRes.data);
      if (messagesRes.data) setMessages(messagesRes.data);
      if (companyRes.data) setCompanyInfo(companyRes.data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [session]);
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);
  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
  };

  const stock = useMemo(() => {
    const map = new Map();
    achats.forEach(a => {
      const n = a.nom.toLowerCase().trim();
      const c = map.get(n) || { nom: a.nom, q: 0 };
      c.q += parseFloat(a.quantite);
      map.set(n, c);
    });
    ventes.forEach(v => {
      const n = v.nom.toLowerCase().trim();
      const c = map.get(n) || { nom: v.nom, q: 0 };
      c.q -= parseFloat(v.quantite);
      map.set(n, c);
    });
    return Array.from(map.values()).filter(i => i.q > 0).map(i => ({nom: i.nom, quantite: i.q}));
  }, [achats, ventes]);

  const dashVentes = useMemo(() => {
    return ventes.filter(v => {
      if (dashboardFilter === 'all') return true;
      const d = parseISO(v.date);
      if (dashboardFilter === 'year') return isThisYear(d);
      if (dashboardFilter === 'month') return isThisMonth(d);
      if (dashboardFilter === 'week') return isThisWeek(d);
      if (dashboardFilter === 'today') return isToday(d);
      return true;
    });
  }, [ventes, dashboardFilter]);

  const dashAchats = useMemo(() => {
    return achats.filter(a => {
      if (dashboardFilter === 'all') return true;
      const d = parseISO(a.date);
      if (dashboardFilter === 'year') return isThisYear(d);
      if (dashboardFilter === 'month') return isThisMonth(d);
      if (dashboardFilter === 'week') return isThisWeek(d);
      if (dashboardFilter === 'today') return isToday(d);
      return true;
    });
  }, [achats, dashboardFilter]);

  const totalAchats = dashAchats.reduce((a, c) => a + (c.prix * c.quantite), 0);
  const totalVentes = dashVentes.reduce((a, c) => a + (c.prix * c.quantite), 0);
  const benefice = totalVentes - totalAchats;
  const unPaidVentes = dashVentes.filter(v => v.statut_paiement === 'non_payé').reduce((a, c) => a + (c.prix * c.quantite), 0);
  const unPaidAchats = dashAchats.filter(v => v.statut_paiement === 'non_payé').reduce((a, c) => a + (c.prix * c.quantite), 0);
  const caisse = (totalVentes - unPaidVentes) - (totalAchats - unPaidAchats);

  const getBotResponse = async (text) => {
     try {
       const res = await fetch("https://luminai.my.id/", {
         method: "POST", headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ content: text, prompt: "Vous êtes Brasti Assistant, répondez en français." })
       });
       const data = await res.json();
       return data.result || data.response;
     } catch (e) { return "Message reçu. Nous vous répondrons bientôt."; }
  };

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last && last.sender === 'customer' && !last.is_bot) {
      const trigger = async () => {
        const reply = await getBotResponse(last.content);
        const botMsg = { user_id: session.user.id, sender: 'admin', content: reply, is_bot: true };
        const { data } = await supabase.from('messages').insert([botMsg]).select();
        if (data) setMessages(prev => [...prev, data[0]]);
      };
      trigger();
    }
  }, [messages]);

  const sendMessage = async (content) => {
    if (!content.trim()) return;
    const newMsg = { user_id: session.user.id, sender: 'customer', content, is_bot: false };
    const { data } = await supabase.from('messages').insert([newMsg]).select();
    if (data) setMessages([...messages, data[0]]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const table = modalType === 'vente' ? 'ventes' : 'achats';
    const item = { 
      user_id: session.user.id, 
      nom: formData.nom.trim(), 
      quantite: parseFloat(formData.quantite), 
      prix: modalType === 'stock_add' ? 0 : parseFloat(formData.prix), 
      statut_paiement: modalType === 'stock_add' ? 'payé' : formData.statut_paiement, 
      date: formData.date 
    };
    if (modalType === 'vente') { item.client_nom = formData.client_nom; item.client_tel = formData.client_tel; }
    const { data } = await supabase.from(table).insert([item]).select();
    if (data) {
      if (table === 'achats') setAchats([data[0], ...achats]); else setVentes([data[0], ...ventes]);
      Swal.fire('Succès !', 'Action enregistrée.', 'success');
      setIsModalOpen(false);
      setFormData({...formData, nom: '', quantite: '', prix: '', client_nom: '', client_tel: ''});
    }
    setIsSubmitting(false);
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const item = { 
      user_id: session.user.id, 
      nom: formData.nom, 
      prix: parseFloat(formData.prix), 
      description: formData.description, 
      features: formData.features.split(',').map(f => f.trim()) 
    };
    const { data } = await supabase.from('products').insert([item]).select();
    if (data) {
      setProducts([data[0], ...products]);
      Swal.fire('Succès !', 'Produit ajouté au catalogue.', 'success');
      setIsModalOpen(false);
    }
    setIsSubmitting(false);
  };

  const deleteItem = async (id, type) => {
    const res = await Swal.fire({ title: 'Supprimer ?', icon: 'warning', showCancelButton: true });
    if (!res.isConfirmed) return;
    const table = type === 'achat' ? 'achats' : 'ventes';
    await supabase.from(table).delete().eq('id', id);
    if (type === 'achat') setAchats(achats.filter(a => a.id !== id)); else setVentes(ventes.filter(v => v.id !== id));
  };

  const togglePaiement = async (item, type) => {
    const table = type === 'achat' ? 'achats' : 'ventes';
    const status = item.statut_paiement === 'payé' ? 'non_payé' : 'payé';
    await supabase.from(table).update({ statut_paiement: status }).eq('id', item.id);
    if (type === 'achat') setAchats(achats.map(a => a.id === item.id ? {...a, statut_paiement: status} : a)); else setVentes(ventes.map(v => v.id === item.id ? {...v, statut_paiement: status} : v));
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    let r = authMode === 'login' ? await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword }) : await supabase.auth.signUp({ email: authEmail, password: authPassword });
    if (r.error) setAuthError(r.error.message);
    setAuthLoading(false);
  };

  const handleDownloadPDF = async () => {
    const input = document.getElementById('pdf-content');
    Swal.fire({ title: 'Génération PDF...', didOpen: () => Swal.showLoading() });
    try {
      const img = await htmlToImage.toJpeg(input, { quality: 0.9, pixelRatio: 2, backgroundColor: theme === 'dark' ? '#0f172a' : '#fff' });
      const pdf = new jsPDF('l', 'mm', 'a4');
      const w = pdf.internal.pageSize.getWidth();
      const h = (pdf.getImageProperties(img).height * w) / pdf.getImageProperties(img).width;
      pdf.addImage(img, 'JPEG', 0, 0, w, h);
      const ts = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
      pdf.save(`Rapport_Brasti_${ts}.pdf`);
      Swal.fire('Succès', 'PDF téléchargé avec succès !', 'success');
    } catch (e) { Swal.fire('Erreur', e.message, 'error'); }
  };

  if (!session) return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-icon"><User size={60} /></div>
        <h1 className="auth-title">Brasti Management</h1>
        <form className="auth-form" onSubmit={handleAuth}>
          <div className="form-group"><label>Email</label><input className="form-control" type="email" required onChange={e=>setAuthEmail(e.target.value)} /></div>
          <div className="form-group"><label>Mot de passe</label><input className="form-control" type="password" required onChange={e=>setAuthPassword(e.target.value)} /></div>
          {authError && <div style={{color:'red', marginBottom:'10px'}}>{authError}</div>}
          <button className="btn-primary" style={{width:'100%'}} type="submit">{authLoading ? '...' : (authMode==='login'?'Connexion':'Inscription')}</button>
        </form>
        <button className="auth-switch" onClick={()=>setAuthMode(authMode==='login'?'register':'login')}>{authMode==='login'?"Pas de compte ? Créer un":"Déjà un compte ? Se connecter"}</button>
      </div>
    </div>
  );

  return (
    <div className="app-wrapper" id="pdf-content">
      <header className="header">
        <div className="header-title"><span>Brasti Business</span></div>
        <div className="header-actions">
          <button className="icon-btn" onClick={fetchData}><RefreshCw size={20} /></button>
          <button className="icon-btn" onClick={handleDownloadPDF}><Download size={20} /></button>
          <button className="icon-btn" onClick={toggleTheme}>{theme==='light'?<Moon size={20}/>:<Sun size={20}/>}</button>
          <button className="icon-btn" onClick={()=>supabase.auth.signOut()}><LogOut size={20}/></button>
        </div>
      </header>

      <nav className="nav-tabs">
        <button className={`nav-tab ${activeTab==='dashboard'?'active':''}`} onClick={()=>setActiveTab('dashboard')}><LayoutDashboard size={18} /> Dashboard</button>
        <button className={`nav-tab ${activeTab==='products'?'active':''}`} onClick={()=>setActiveTab('products')}><Package size={18} /> Catalogue</button>
        <button className={`nav-tab ${activeTab==='ventes'?'active':''}`} onClick={()=>setActiveTab('ventes')}><TrendingDown size={18} /> Ventes</button>
        <button className={`nav-tab ${activeTab==='chat'?'active':''}`} onClick={()=>setActiveTab('chat')}><MessageSquare size={18} /> Chat</button>
      </nav>

      <main>
        {activeTab === 'dashboard' && (
          <div className="animate-enter">
            <div className="stats-grid">
              <div className="stat-card revenue"><div className="stat-value">{totalVentes} DA</div><div className="stat-label">Ventes</div></div>
              <div className="stat-card expenses"><div className="stat-value">{totalAchats} DA</div><div className="stat-label">Dépenses</div></div>
              <div className="stat-card profit"><div className="stat-value">{benefice} DA</div><div className="stat-label">Bénéfice</div></div>
              <div className="stat-card"><div className="stat-value">{caisse} DA</div><div className="stat-label">Caisse</div></div>
            </div>
            <div className="glass-container"><h3>Performance des Revenus</h3><Line data={{labels:['Jan','Feb','Mar','Apr','May','Jun'], datasets:[{label:'Ventes', data:[totalVentes/2, totalVentes], borderColor:'#10b981', fill:true}]}} /></div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="animate-enter">
            <div className="section-header"><div className="section-title">Produits</div><button className="btn-primary" onClick={()=>{setModalType('product'); setIsModalOpen(true)}}><Plus size={18}/> Nouveau</button></div>
            <div className="products-grid">
              {products.map(p=><div key={p.id} className="product-card"><div className="product-name">{p.nom}</div><div className="product-price">{p.prix} DA</div><p>{p.description}</p><div className="product-features">{p.features?.map((f,i)=><span key={i} className="feature-tag">{f}</span>)}</div></div>)}
            </div>
          </div>
        )}

        {activeTab === 'ventes' && (
          <div className="glass-container animate-enter">
            <div className="section-header"><div className="section-title">Ventes Récentes</div><button className="btn-primary" onClick={()=>{setModalType('vente'); setIsModalOpen(true)}}><Plus size={18}/> Vente</button></div>
            <table className="data-table">
              <thead><tr><th>Client</th><th>Produit</th><th>Total</th><th>Status</th></tr></thead>
              <tbody>
                {ventes.map(v=><tr key={v.id}><td>{v.client_nom}</td><td>{v.nom}</td><td>{v.prix*v.quantite} DA</td><td><button className={`badge ${v.statut_paiement==='payé'?'badge-success':'badge-danger'}`} onClick={()=>togglePaiement(v,'vente')}>{v.statut_paiement}</button></td></tr>)}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="glass-container animate-enter">
            <div className="chat-container">
              <div className="chat-messages">{messages.map((m,i)=><div key={i} className={`message ${m.sender} ${m.is_bot?'bot':''}`}>{m.content}</div>)}</div>
              <div className="chat-input-area"><input className="form-control" placeholder="Taper un message..." onKeyDown={e=>{if(e.key==='Enter'){sendMessage(e.target.value); e.target.value=''}}} /></div>
            </div>
          </div>
        )}
      </main>

      {isModalOpen && (
        <div className="modal-overlay" onClick={()=>setIsModalOpen(false)}>
          <div className="modal-content" onClick={e=>e.stopPropagation()}>
            <h3>{modalType === 'product' ? 'Nouveau Produit' : 'Nouvelle Vente'}</h3>
            <form onSubmit={modalType==='product'?handleProductSubmit:handleSubmit}>
              <div className="form-group"><label>Nom</label><input className="form-control" required onChange={e=>setFormData({...formData, nom:e.target.value})} /></div>
              {modalType === 'product' ? (
                <><div className="form-group"><label>Prix</label><input type="number" className="form-control" required onChange={e=>setFormData({...formData, prix:e.target.value})} /></div><div className="form-group"><label>Description</label><textarea className="form-control" onChange={e=>setFormData({...formData, description:e.target.value})} /></div><div className="form-group"><label>Features (tag1, tag2)</label><input className="form-control" onChange={e=>setFormData({...formData, features:e.target.value})} /></div></>
              ) : (
                <><div className="form-group"><label>Client</label><input className="form-control" required onChange={e=>setFormData({...formData, client_nom:e.target.value})} /></div><div className="form-group"><label>Quantité</label><input type="number" className="form-control" required onChange={e=>setFormData({...formData, quantite:e.target.value})} /></div><div className="form-group"><label>Prix Unit.</label><input type="number" className="form-control" required onChange={e=>setFormData({...formData, prix:e.target.value})} /></div></>
              )}
              <div className="modal-footer"><button type="submit" className="btn-primary" disabled={isSubmitting}>Enregistrer</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
