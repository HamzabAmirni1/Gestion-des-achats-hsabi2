import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, ShoppingCart, TrendingDown, Package, 
  Plus, Search, Download, Moon, Sun, Trash2, RefreshCw,
  LogOut, User, Smartphone, MessageSquare, Send, X, Filter, ChevronRight, Layers
} from 'lucide-react';
import { format, isThisWeek, isThisMonth, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
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
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all'); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('achat'); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    nom: '', client_nom: '', quantite: 1, prix: 0, product_id: '', description: ''
  });

  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  const fetchData = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const { data: a } = await supabase.from('achats').select('*').order('date', { ascending: false });
      const { data: v } = await supabase.from('ventes').select('*').order('date', { ascending: false });
      const { data: p } = await supabase.from('products').select('*').order('nom', { ascending: true });
      const { data: m } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
      if (a) setAchats(a);
      if (v) setVentes(v);
      if (p) setProducts(p);
      if (m) setMessages(m);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [session]);
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);
  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');

  const scrollToBottom = () => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); };
  useEffect(() => { scrollToBottom(); }, [messages]);

  // Filtering Logic
  const filteredSales = useMemo(() => {
    return ventes.filter(v => {
      const matchSearch = v.nom.toLowerCase().includes(searchQuery.toLowerCase()) || (v.client_nom?.toLowerCase() || '').includes(searchQuery.toLowerCase());
      if (dateFilter === 'all') return matchSearch;
      const date = parseISO(v.date);
      if (dateFilter === 'week') return matchSearch && isThisWeek(date);
      if (dateFilter === 'month') return matchSearch && isThisMonth(date);
      return matchSearch;
    });
  }, [ventes, searchQuery, dateFilter]);

  const totalVentes = useMemo(() => filteredSales.reduce((a, c) => a + (c.prix * c.quantite), 0), [filteredSales]);
  const totalAchats = useMemo(() => achats.reduce((a, c) => a + (c.prix * c.quantite), 0), [achats]);
  const benefice = totalVentes - totalAchats;

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    const content = chatInput;
    setChatInput('');
    const { data } = await supabase.from('messages').insert([{ user_id: session.user.id, sender: 'customer', content, is_bot: false }]).select();
    if (data) setMessages([...messages, data[0]]);
    
    setTimeout(async () => {
      const res = await fetch("https://luminai.my.id/", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content, prompt: `Brasti Cleaning AI. Stats: Ventes=${totalVentes} DA, Stock=${products.length} produits. Répond court en français.` })
      });
      const d = await res.json();
      const botMsg = { user_id: session.user.id, sender: 'admin', content: d.result || d.response || "D'accord, je traite cela.", is_bot: true };
      const { data: dbBot } = await supabase.from('messages').insert([botMsg]).select();
      if (dbBot) setMessages(prev => [...prev, dbBot[0]]);
    }, 1000);
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
      pdf.save(`Rapport_Brasti_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.pdf`);
      Swal.fire('Succès', 'Rapport enregistré', 'success');
    } catch (e) { Swal.fire('Erreur', e.message, 'error'); }
  };

  if (!session) return (
    <div className="auth-page">
      <div className="auth-card-premium animate-enter">
        <h1 className="auth-title">Brasti Business</h1>
        <p>Production مواد التنظيف</p>
        <form className="auth-form-premium" onSubmit={async (e)=>{e.preventDefault(); setAuthLoading(true); setAuthError(''); let r = authMode === 'login' ? await supabase.auth.signInWithPassword({email:authEmail, password:authPassword}) : await supabase.auth.signUp({email:authEmail, password:authPassword}); if(r.error) setAuthError(r.error.message); setAuthLoading(false);}}>
          <div className="input-group"><label>Email</label><input type="email" required onChange={e=>setAuthEmail(e.target.value)} /></div>
          <div className="input-group"><label>Mot de passe</label><input type="password" required onChange={e=>setAuthPassword(e.target.value)} /></div>
          {authError && <div className="auth-error">{authError}</div>}
          <button className="btn-auth-submit" disabled={authLoading}>{authLoading ? '...' : (authMode==='login'?'Se Connecter':'S\'inscrire')}</button>
          <button type="button" className="auth-mode-switch" onClick={()=>setAuthMode(authMode==='login'?'reg':'login')}>{authMode==='login'?'Créer un compte':'Déjà un compte'}</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="app-wrapper" id="pdf-content">
      <header className="header">
        <div className="header-title">Brasti platform</div>
        <div className="header-actions">
          <button className="icon-btn" onClick={fetchData}><RefreshCw size={18} /></button>
          <button className="icon-btn" onClick={handleDownloadPDF}><Download size={18} /></button>
          <button className="icon-btn" onClick={toggleTheme}>{theme==='light'?<Moon size={18}/>:<Sun size={18}/>}</button>
          <button className="icon-btn" onClick={()=>supabase.auth.signOut()}><LogOut size={18}/></button>
        </div>
      </header>
      
      <nav className="nav-tabs">
        <button className={`nav-tab ${activeTab==='dashboard'?'active':''}`} onClick={()=>setActiveTab('dashboard')}><LayoutDashboard size={18} /> Dashboard</button>
        <button className={`nav-tab ${activeTab==='products'?'active':''}`} onClick={()=>setActiveTab('products')}><Package size={18} /> Stock</button>
        <button className={`nav-tab ${activeTab==='ventes'?'active':''}`} onClick={()=>setActiveTab('ventes')}><TrendingDown size={18} /> Ventes</button>
        <button className={`nav-tab ${activeTab==='achats'?'active':''}`} onClick={()=>setActiveTab('achats')}><ShoppingCart size={18} /> Achats</button>
        <button className={`nav-tab ${activeTab==='chat'?'active':''}`} onClick={()=>setActiveTab('chat')}><MessageSquare size={18} /> AI</button>
      </nav>

      <main>
        {activeTab === 'dashboard' && (
          <div className="animate-enter">
            <div className="stats-grid">
              <div className="stat-card" style={{borderColor:'#10b981'}}><div className="stat-value" style={{color:'#10b981'}}>{benefice} DA</div><div className="stat-label">Bénéfice Net</div></div>
              <div className="stat-card"><div className="stat-value">{totalVentes} DA</div><div className="stat-label">Chiffre d'Affaires</div></div>
              <div className="stat-card"><div className="stat-value" style={{color:'#ef4444'}}>{totalAchats} DA</div><div className="stat-label">Total Dépenses</div></div>
              <div className="stat-card"><div className="stat-value" style={{color:'#6366f1'}}>{products.reduce((a,c)=>a+c.stock_qty,0)}</div><div className="stat-label">Produits en Stock</div></div>
            </div>
            <div className="glass-container">
               <div className="section-header"><h3>Statistiques Graphiques</h3><div className="header-actions"><select className="form-control" onChange={e=>setDateFilter(e.target.value)}><option value="all">Tout le temps</option><option value="week">Cette semaine</option><option value="month">Ce mois</option></select></div></div>
               <Line data={{labels:['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'], datasets:[{label:'Ventes (DA)', data:[0,0,0,0,0,0,totalVentes], borderColor:'#10b981', fill:true, tension:0.4}]}} />
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="animate-enter">
            <div className="section-header">
              <div className="section-title">Gestion du Stock</div>
              <div className="header-actions">
                <div className="search-bar"><Search size={16} /><input placeholder="Rechercher un produit..." onChange={e=>setSearchQuery(e.target.value)} /></div>
                <button className="btn-primary" onClick={()=>{setModalType('product'); setIsModalOpen(true)}}><Plus size={18}/> Nouveau</button>
              </div>
            </div>
            <div className="products-grid">
              {products.filter(p=>p.nom.toLowerCase().includes(searchQuery.toLowerCase())).map(p=>(
                <div key={p.id} className="product-card">
                  <div className="product-header"><b>{p.nom}</b><span className={`badge ${p.stock_qty > 10 ? 'badge-success' : 'badge-danger'}`}>{p.stock_qty} en stock</span></div>
                  <div className="product-price">{p.prix_unitaire} DA / unit</div>
                  <p>{p.description || 'Production مواد التنظيف'}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'ventes' && (
          <div className="glass-container animate-enter">
            <div className="section-header"><h3>Historique de Ventes</h3><button className="btn-primary" onClick={()=>{setModalType('vente'); setIsModalOpen(true)}}><Plus size={18}/> Vendre</button></div>
            <table className="data-table"><thead><tr><th>Date</th><th>Produit</th><th>Quantité</th><th>Total (DA)</th></tr></thead><tbody>{filteredSales.map(v=><tr key={v.id}><td>{v.date}</td><td>{v.nom}</td><td>{v.quantite}</td><td>{v.prix*v.quantite}</td></tr>)}</tbody></table>
          </div>
        )}

        {activeTab === 'achats' && (
          <div className="glass-container animate-enter">
            <div className="section-header"><h3>Historique d'Achats</h3><button className="btn-primary" onClick={()=>{setModalType('achat'); setIsModalOpen(true)}}><Plus size={18}/> Acheter</button></div>
            <table className="data-table"><thead><tr><th>Date</th><th>Matière</th><th>Quantité</th><th>Dépense (DA)</th></tr></thead><tbody>{achats.map(a=><tr key={a.id}><td>{a.date}</td><td>{a.nom}</td><td>{a.quantite}</td><td>{a.prix*a.quantite}</td></tr>)}</tbody></table>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="glass-container chat-tab animate-enter">
            <div className="chat-container">
              <div className="chat-messages">{messages.map((m,i)=><div key={i} className={`message ${m.sender} ${m.is_bot?'bot':''}`}>{m.content}</div>)}<div ref={chatEndRef} /></div>
              <div className="chat-input-area"><input className="form-control" placeholder="Combien j'ai en stock ?" value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSendMessage()} /><button className="btn-primary" onClick={handleSendMessage}><Send size={18} /></button></div>
            </div>
          </div>
        )}
      </main>

      {isModalOpen && (
        <div className="modal-overlay" onClick={()=>setIsModalOpen(false)}>
          <div className="modal-content" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><h3>{modalType==='product'?'Nouveau Produit':(modalType==='achat'?'Nouvel Achat':'Nouvelle Vente')}</h3><button onClick={()=>setIsModalOpen(false)}><X size={20}/></button></div>
            <form onSubmit={async (e)=>{e.preventDefault(); setIsSubmitting(true); const table=modalType==='product'?'products':(modalType==='achat'?'achats':'ventes'); const item={user_id:session.user.id, nom:formData.nom, prix:parseFloat(formData.prix), quantite:parseFloat(formData.quantite), product_id:formData.product_id || null, date:format(new Date(),'yyyy-MM-dd')}; await supabase.from(table).insert([item]); fetchData(); setIsModalOpen(false); setIsSubmitting(false);}}>
               <div className="form-group"><label>Nom / Matière</label><input className="form-control" required onChange={e=>setFormData({...formData, nom:e.target.value})} /></div>
               {modalType!=='product' && <div className="form-group"><label>Associer au Stock</label><select className="form-control" onChange={e=>setFormData({...formData, product_id:e.target.value})}><option value="">Ne pas mettre à jour le stock</option>{products.map(p=><option key={p.id} value={p.id}>{p.nom}</option>)}</select></div>}
               <div className="form-group"><label>Prix Unitaire (DA)</label><input type="number" className="form-control" required onChange={e=>setFormData({...formData, prix:e.target.value})} /></div>
               <div className="form-group"><label>Quantité</label><input type="number" className="form-control" required onChange={e=>setFormData({...formData, quantite:e.target.value})} /></div>
               <div className="total-preview">Total automatiquement calculé: <b>{(parseFloat(formData.prix)||0) * (parseFloat(formData.quantite)||0)} DA</b></div>
               <button type="submit" className="btn-primary" style={{width:'100%', marginTop:'20px'}} disabled={isSubmitting}>Confirmer & Enregistrer</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
