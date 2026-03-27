import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, ShoppingCart, TrendingDown, Package, 
  Plus, Search, Download, Moon, Sun, Trash2, RefreshCw,
  LogOut, User, Printer, Award, Calendar, Smartphone,
  MessageSquare, PlusCircle, Phone, Mail, MessageCircle, MoreHorizontal
} from 'lucide-react';
import { format, isThisWeek, isThisMonth, isThisYear, isToday, parseISO } from 'date-fns';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { supabase } from './supabaseClient';
import * as htmlToImage from 'html-to-image';
import { jsPDF } from 'jspdf';
import Swal from 'sweetalert2';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler
);

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

  const bestSellingStats = useMemo(() => {
    const map = new Map();
    dashVentes.forEach(v => {
      const n = v.nom.trim().toLowerCase();
      const cur = map.get(n) || { nom: v.nom, q: 0, r: 0 };
      cur.q += parseFloat(v.quantite);
      cur.r += (v.quantite * v.prix);
      map.set(n, cur);
    });
    const arr = Array.from(map.values());
    return { bestQte: [...arr].sort((a,b)=>b.q-a.q)[0], bestRev: [...arr].sort((a,b)=>b.r-a.r)[0] };
  }, [dashVentes]);

  // AI Assistant Logic (French)
  const getBotResponse = async (text) => {
     // AI Logic inspired by hamza-chatbot (LuminAI simple endpoint)
     try {
       const res = await fetch("https://luminai.my.id/", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ 
           content: text, 
           prompt: "Vous êtes Brasti AI, un assistant pour une entreprise de nettoyage professionnel. Répondez toujours en français de manière polie et concise. Donnez les infos de contact si besoin: " + companyInfo.phone 
         })
       });
       const data = await res.json();
       return data.result || data.response;
     } catch (e) {
       return `Merci de nous avoir contactés ! Nous avons bien reçu votre message : "${text}". Un agent vous répondra sous peu. Contact: ${companyInfo.phone}`;
     }
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
    if (modalType === 'vente') {
      item.client_nom = formData.client_nom;
      item.client_tel = formData.client_tel;
    }
    const { data, error } = await supabase.from(table).insert([item]).select();
    if (!error && data) {
      if (table === 'achats') setAchats([data[0], ...achats]);
      else setVentes([data[0], ...ventes]);
      Swal.fire('Succès !', 'Données enregistrées.', 'success');
      setIsModalOpen(false);
      setFormData({...formData, nom: '', quantite: '', prix: '', client_nom: '', client_tel: ''});
    } else { Swal.fire('Erreur', error.message, 'error'); }
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
    const { data, error } = await supabase.from('products').insert([item]).select();
    if (!error && data) {
      setProducts([data[0], ...products]);
      Swal.fire('Succès', 'Produit ajouté.', 'success');
      setIsModalOpen(false);
    }
    setIsSubmitting(false);
  };

  const deleteItem = async (id, type) => {
    const res = await Swal.fire({ title: 'Supprimer ?', icon: 'warning', showCancelButton: true });
    if (!res.isConfirmed) return;
    const table = type === 'achat' ? 'achats' : 'ventes';
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (!error) {
       if (type === 'achat') setAchats(achats.filter(a => a.id !== id));
       else setVentes(ventes.filter(v => v.id !== id));
    }
  };

  const togglePaiement = async (item, type) => {
    const table = type === 'achat' ? 'achats' : 'ventes';
    const status = item.statut_paiement === 'payé' ? 'non_payé' : 'payé';
    await supabase.from(table).update({ statut_paiement: status }).eq('id', item.id);
    if (type === 'achat') setAchats(achats.map(a => a.id === item.id ? {...a, statut_paiement: status} : a));
    else setVentes(ventes.map(v => v.id === item.id ? {...v, statut_paiement: status} : v));
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    let r;
    if (authMode === 'login') r = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
    else r = await supabase.auth.signUp({ email: authEmail, password: authPassword });
    if (r.error) setAuthError(r.error.message);
    setAuthLoading(false);
  };

  const handleDownloadPDF = async () => {
    const input = document.getElementById('pdf-content');
    Swal.fire({ title: 'Génération PDF...', didOpen: () => Swal.showLoading() });
    try {
      const imgData = await htmlToImage.toJpeg(input, { quality: 0.9, pixelRatio: 2, backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff' });
      const pdf = new jsPDF('l', 'mm', 'a4');
      const w = pdf.internal.pageSize.getWidth();
      const h = (pdf.getImageProperties(imgData).height * w) / pdf.getImageProperties(imgData).width;
      pdf.addImage(imgData, 'JPEG', 0, 0, w, h);
      pdf.save(`Rapport_Brasti_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      Swal.fire('Succès', 'PDF téléchargé', 'success');
    } catch (e) { Swal.fire('Erreur', e.message, 'error'); }
  };

  const chartData = useMemo(() => {
    const labels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'];
    return {
      labels,
      datasets: [
        { label: 'Ventes', data: [totalVentes/2, totalVentes/1.5, totalVentes], borderColor: '#10b981', fill: true },
        { label: 'Dépenses', data: [totalAchats/3, totalAchats/2, totalAchats], borderColor: '#ef4444', fill: true }
      ]
    };
  }, [totalVentes, totalAchats]);

  if (!session) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-icon"><User size={60} /></div>
          <h1 className="auth-title">Brasti Management</h1>
          <form className="auth-form" onSubmit={handleAuth}>
            <div className="form-group"><label>Email</label><input type="email" className="form-control" required onChange={e=>setAuthEmail(e.target.value)} /></div>
            <div className="form-group"><label>Mot de passe</label><input type="password" className="form-control" required onChange={e=>setAuthPassword(e.target.value)} /></div>
            {authError && <div style={{color: 'red'}}>{authError}</div>}
            <button type="submit" className="btn-primary" style={{width:'100%'}}>{authLoading ? '...' : (authMode === 'login' ? 'Connexion' : 'Inscription')}</button>
          </form>
          <button className="auth-switch" onClick={()=>setAuthMode(authMode==='login'?'register':'login')}>{authMode==='login'?"Pas de compte ?":"Déjà un compte ?"}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-wrapper" id="pdf-content">
      <header className="header">
        <div className="header-title"><span>Brasti Business</span></div>
        <div className="header-actions">
          <button className="icon-btn" onClick={fetchData}><RefreshCw size={20} /></button>
          <button className="icon-btn" onClick={handleDownloadPDF}><Download size={20} /></button>
          <button className="icon-btn" onClick={toggleTheme}>{theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}</button>
          <button className="icon-btn" onClick={()=>supabase.auth.signOut()}><LogOut size={20} /></button>
        </div>
      </header>

      <nav className="nav-tabs">
        <button className={`nav-tab ${activeTab==='dashboard'?'active':''}`} onClick={()=>setActiveTab('dashboard')}><LayoutDashboard size={18} /> Dashboard</button>
        <button className={`nav-tab ${activeTab==='products'?'active':''}`} onClick={()=>setActiveTab('products')}><Package size={18} /> Catalogue</button>
        <button className={`nav-tab ${activeTab==='ventes'?'active':''}`} onClick={()=>setActiveTab('ventes')}><TrendingDown size={18} /> Ventes</button>
        <button className={`nav-tab ${activeTab==='chat'?'active':''}`} onClick={()=>setActiveTab('chat')}><MessageSquare size={18} /> Chat</button>
        <button className={`nav-tab ${activeTab==='profile'?'active':''}`} onClick={()=>setActiveTab('profile')}><User size={18} /> Profil</button>
      </nav>

      <main style={{direction: 'ltr'}}> 
        {activeTab === 'dashboard' && (
          <div className="animate-enter">
            <div className="stats-grid">
              <div className="stat-card revenue">
                <div className="stat-value">{totalVentes.toLocaleString()} DA</div>
                <div className="stat-label">Ventes</div>
              </div>
              <div className="stat-card expenses">
                <div className="stat-value">{totalAchats.toLocaleString()} DA</div>
                <div className="stat-label">Dépenses</div>
              </div>
              <div className="stat-card profit">
                <div className="stat-value">{benefice.toLocaleString()} DA</div>
                <div className="stat-label">Bénéfice</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{caisse.toLocaleString()} DA</div>
                <div className="stat-label">Caisse</div>
              </div>
            </div>
            <div className="glass-container">
              <h3>Évolution des revenus</h3>
              <Line data={chartData} />
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="animate-enter">
            <div className="section-header">
              <div className="section-title">Catalogue</div>
              <button className="btn-primary" onClick={()=>{setModalType('product'); setIsModalOpen(true);}}><Plus size={18} /> Nouveau</button>
            </div>
            <div className="products-grid">
              {products.map(p => (
                <div key={p.id} className="product-card">
                  <div className="product-name">{p.nom}</div>
                  <div className="product-price">{p.prix} DA</div>
                  <p>{p.description}</p>
                  <div className="product-features">{p.features?.map((f,i)=><span key={i} className="feature-tag">{f}</span>)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'ventes' && (
          <div className="glass-container animate-enter">
            <div className="section-header">
              <div className="section-title">Ventes</div>
              <button className="btn-primary" onClick={()=>{setModalType('vente'); setIsModalOpen(true);}}><Plus size={18} /> Vente</button>
            </div>
            <table className="data-table">
               <thead><tr><th>Client</th><th>Produit</th><th>Qté</th><th>Total</th><th>Status</th></tr></thead>
               <tbody>
                 {ventes.map(v => (
                   <tr key={v.id}>
                     <td>{v.client_nom}</td>
                     <td>{v.nom}</td>
                     <td>{v.quantite}</td>
                     <td>{v.prix*v.quantite} DA</td>
                     <td><button className={`badge ${v.statut_paiement==='payé'?'badge-success':'badge-danger'}`} onClick={()=>togglePaiement(v, 'vente')}>{v.statut_paiement}</button></td>
                   </tr>
                 ))}
               </tbody>
            </table>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="glass-container animate-enter">
             <div className="chat-container">
                <div className="chat-messages">
                  {messages.map((m,i)=><div key={i} className={`message ${m.sender} ${m.is_bot?'bot':''}`}>{m.content}</div>)}
                </div>
                <div className="chat-input-area">
                  <input type="text" className="form-control" placeholder="Message..." onKeyDown={e=>{if(e.key==='Enter'){sendMessage(e.target.value); e.target.value='';}}} />
                </div>
             </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="animate-enter" style={{textAlign:'center'}}>
            <div className="company-contact-bar">
               <div className="contact-item"><Phone size={18} /> {companyInfo.phone}</div>
               <div className="contact-item"><Mail size={18} /> {companyInfo.email}</div>
            </div>
            <div className="glass-container">
              <h2>Hamza Amirni</h2>
              <div className="social-grid">
                <a href={companyInfo.phone} className="btn-social whatsapp">WhatsApp</a>
                <a href={companyInfo.email} className="btn-social portfolio">Email</a>
              </div>
            </div>
          </div>
        )}
      </main>

      {isModalOpen && (
        <div className="modal-overlay" onClick={()=>setIsModalOpen(false)}>
          <div className="modal-content" onClick={e=>e.stopPropagation()}>
            <h3>{modalType}</h3>
            <form onSubmit={modalType==='product'?handleProductSubmit:handleSubmit}>
               {modalType==='vente' && <div className="form-group"><label>Client</label><input className="form-control" onChange={e=>setFormData({...formData, client_nom:e.target.value})} /></div>}
               <div className="form-group"><label>Nom</label><input className="form-control" required onChange={e=>setFormData({...formData, nom:e.target.value})} /></div>
               <div className="form-group"><label>Quantité</label><input type="number" className="form-control" required onChange={e=>setFormData({...formData, quantite:e.target.value})} /></div>
               {modalType!=='stock_add' && <div className="form-group"><label>Prix</label><input type="number" className="form-control" required onChange={e=>setFormData({...formData, prix:e.target.value})} /></div>}
               {modalType==='product' && <><div className="form-group"><label>Description</label><textarea className="form-control" onChange={e=>setFormData({...formData, description:e.target.value})} /></div><div className="form-group"><label>Features</label><input className="form-control" onChange={e=>setFormData({...formData, features:e.target.value})} /></div></>}
               <button type="submit" className="btn-primary" disabled={isSubmitting}>OK</button>
            </form>
          </div>
        </div>
      )}

      {installPrompt && (
        <div className="pwa-banner-mobile">
          <span>Installer Brasti !</span>
          <button onClick={handleInstallClick}>Install</button>
        </div>
      )}
    </div>
  );
}
