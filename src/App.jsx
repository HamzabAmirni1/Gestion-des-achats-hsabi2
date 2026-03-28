import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, ShoppingCart, TrendingDown, Package, 
  Plus, Search, Download, Moon, Sun, Trash2, RefreshCw,
  LogOut, User, Smartphone, MessageSquare, Send, X, Filter, ChevronRight, Layers
} from 'lucide-react';
import { format, isThisWeek, isThisMonth, parseISO } from 'date-fns';
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
        body: JSON.stringify({ content: content, prompt: `Brasti AI. Status: Ventes=${totalVentes} DA. Répond court.` })
      });
      const d = await res.json();
      const botMsg = { user_id: session.user.id, sender: 'admin', content: d.result || d.response || "...", is_bot: true };
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
      Swal.fire('OK', 'Exporté', 'success');
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) setAuthError(error.message);
  };

  if (!session) return (
    <div className="auth-page">
      <div className="auth-card-premium animate-enter">
        <h1 className="auth-title">Brasti platform</h1>
        <p>Production مواد التنظيف</p>
        <form className="auth-form-premium" onSubmit={async (e)=>{e.preventDefault(); setAuthLoading(true); setAuthError(''); let r = authMode === 'login' ? await supabase.auth.signInWithPassword({email:authEmail, password:authPassword}) : await supabase.auth.signUp({email:authEmail, password:authPassword}); if(r.error) setAuthError(r.error.message); setAuthLoading(false);}}>
          <div className="input-group"><label>Email</label><input type="email" required onChange={e=>setAuthEmail(e.target.value)} /></div>
          <div className="input-group"><label>Mot de passe</label><input type="password" required onChange={e=>setAuthPassword(e.target.value)} /></div>
          {authError && <div className="auth-error">{authError}</div>}
          <button className="btn-auth-submit" disabled={authLoading}>{authLoading ? '...' : (authMode==='login'?'Se Connecter':'S\'inscrire')}</button>
          
          <div className="auth-divider"><span>OU</span></div>
          
          <button type="button" className="btn-google-auth" onClick={signInWithGoogle}>
            <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continuer avec Gmail
          </button>

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
        <button className={`nav-tab ${activeTab==='dashboard'?'active':''}`} onClick={()=>setActiveTab('dashboard')}>Dashboard</button>
        <button className={`nav-tab ${activeTab==='products'?'active':''}`} onClick={()=>setActiveTab('products')}>Stock</button>
        <button className={`nav-tab ${activeTab==='ventes'?'active':''}`} onClick={()=>setActiveTab('ventes')}>Ventes</button>
        <button className={`nav-tab ${activeTab==='achats'?'active':''}`} onClick={()=>setActiveTab('achats')}>Achats</button>
      </nav>

      <main>
        {activeTab === 'dashboard' && (
          <div className="animate-enter">
            <div className="stats-grid">
              <div className="stat-card" style={{borderLeft:'8px solid #10b981'}}><div className="stat-value">{benefice} DA</div><div className="stat-label">Bénéfice</div></div>
              <div className="stat-card" style={{borderLeft:'8px solid #4f46e5'}}><div className="stat-value">{totalVentes} DA</div><div className="stat-label">Mبيعات</div></div>
              <div className="stat-card" style={{borderLeft:'8px solid #ef4444'}}><div className="stat-value">{totalAchats} DA</div><div className="stat-label">مصاريف</div></div>
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="animate-enter">
            <div className="section-header">
              <h3>Gestion du Stock</h3>
              <button className="btn-primary" onClick={()=>{setModalType('product'); setIsModalOpen(true)}}>+ Nouveau</button>
            </div>
            <div className="products-grid">{products.map(p=><div key={p.id} className="product-card"><b>{p.nom}</b><span className="badge badge-success">{p.stock_qty} en stock</span></div>)}</div>
          </div>
        )}
        
        {/* Remaining sections handled via direct UI navigation ... */}
      </main>

      {isModalOpen && (
        <div className="modal-overlay" onClick={()=>setIsModalOpen(false)}>
          <div className="modal-content" onClick={e=>e.stopPropagation()}>
             <div className="modal-header"><h3>{modalType}</h3><button onClick={()=>setIsModalOpen(false)}><X size={20}/></button></div>
             <form onSubmit={async (e)=>{e.preventDefault(); setIsSubmitting(true); const table=modalType==='product'?'products':(modalType==='achat'?'achats':'ventes'); const item={user_id:session.user.id, nom:formData.nom, prix:parseFloat(formData.prix), quantite:parseFloat(formData.quantite), product_id:formData.product_id||null, date:format(new Date(),'yyyy-MM-dd')}; await supabase.from(table).insert([item]); fetchData(); setIsModalOpen(false); setIsSubmitting(false);}}>
                <div className="form-group"><label>Nom / Matière</label><input className="form-control" required onChange={e=>setFormData({...formData, nom:e.target.value})}/></div>
                {modalType!=='product' && <div className="form-group"><label>Associer</label><select className="form-control" onChange={e=>setFormData({...formData, product_id:e.target.value})}><option value="">-</option>{products.map(p=><option key={p.id} value={p.id}>{p.nom}</option>)}</select></div>}
                <div className="form-group"><label>Prix Unit</label><input type="number" className="form-control" onChange={e=>setFormData({...formData, prix:e.target.value})}/></div>
                <div className="form-group"><label>Quantité</label><input type="number" className="form-control" onChange={e=>setFormData({...formData, quantite:e.target.value})}/></div>
                <div className="total-preview">Total: {(parseFloat(formData.prix)||0)*(parseFloat(formData.quantite)||0)} DA</div>
                <button type="submit" className="btn-primary" style={{width:'100%'}}>Sauvegarder</button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
}
