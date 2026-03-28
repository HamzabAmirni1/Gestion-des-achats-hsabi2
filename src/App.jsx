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
      const botMsg = { user_id: session.user.id, sender: 'admin', content: "D'accord, je traite votre demande sur Brasti platform.", is_bot: true };
      const { data: dbBot } = await supabase.from('messages').insert([botMsg]).select();
      if (dbBot) setMessages(prev => [...prev, dbBot[0]]);
    }, 1000);
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
          <button type="button" className="btn-google-auth" onClick={signInWithGoogle}>Continuer avec Gmail</button>
          <button type="button" className="auth-mode-switch" onClick={()=>setAuthMode(authMode==='login'?'reg':'login')}>{authMode==='login'?'Créer un compte':'Déjà un compte'}</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="app-wrapper">
      <header className="header">
        <div className="header-title">Brasti Business</div>
        <div className="header-actions">
          <button className="icon-btn" onClick={fetchData}><RefreshCw size={18} /></button>
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
              <div className="stat-card" style={{borderLeft:'5px solid #10b981'}}><div className="stat-value">{benefice} DA</div><div className="stat-label">Bénéfice Net</div></div>
              <div className="stat-card" style={{borderLeft:'5px solid #4f46e5'}}><div className="stat-value">{totalVentes} DA</div><div className="stat-label">Ventes</div></div>
              <div className="stat-card" style={{borderLeft:'5px solid #ef4444'}}><div className="stat-value">{totalAchats} DA</div><div className="stat-label">Dépenses</div></div>
            </div>
            <div className="glass-container">
               <Line data={{labels:['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'], datasets:[{label:'Ventes (DA)', data:[0,0,0,0,0,0,totalVentes], borderColor:'#10b981', fill:true, tension:0.4}]}} />
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="animate-enter">
            <div className="section-header"><h3>Gestion du Stock</h3><button className="btn-primary" onClick={()=>{setModalType('product'); setIsModalOpen(true)}}>+ Nouveau</button></div>
            <div className="products-grid">{products.map(p=><div key={p.id} className="product-card"><b>{p.nom}</b><span className="badge badge-success">{p.stock_qty} en stock</span><div className="product-price">{p.prix_unitaire} DA</div></div>)}</div>
          </div>
        )}

        {activeTab === 'ventes' && (
          <div className="glass-container animate-enter">
            <div className="section-header"><h3>Historique de Ventes</h3><button className="btn-primary" onClick={()=>{setModalType('vente'); setIsModalOpen(true)}}>+ Vendre</button></div>
            <table className="data-table"><thead><tr><th>Date</th><th>Produit</th><th>Quantité</th><th>Total</th></tr></thead><tbody>{filteredSales.map(v=><tr key={v.id}><td>{v.date}</td><td>{v.nom}</td><td>{v.quantite}</td><td>{v.prix*v.quantite} DA</td></tr>)}</tbody></table>
          </div>
        )}

        {activeTab === 'achats' && (
          <div className="glass-container animate-enter">
            <div className="section-header"><h3>Historique d'Achats</h3><button className="btn-primary" onClick={()=>{setModalType('achat'); setIsModalOpen(true)}}>+ Acheter</button></div>
            <table className="data-table"><thead><tr><th>Date</th><th>Matière</th><th>Quantité</th><th>Dépense</th></tr></thead><tbody>{achats.map(a=><tr key={a.id}><td>{a.date}</td><td>{a.nom}</td><td>{a.quantite}</td><td>{a.prix*a.quantite} DA</td></tr>)}</tbody></table>
          </div>
        )}
      </main>

      {isModalOpen && (
        <div className="modal-overlay" onClick={()=>setIsModalOpen(false)}>
          <div className="modal-content" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><h3>{modalType}</h3><button onClick={()=>setIsModalOpen(false)}><X size={20}/></button></div>
            <form onSubmit={async (e)=>{e.preventDefault(); setIsSubmitting(true); const table=modalType==='product'?'products':(modalType==='achat'?'achats':'ventes'); const item={user_id:session.user.id, nom:formData.nom, prix:parseFloat(formData.prix), quantite:parseFloat(formData.quantite), product_id:formData.product_id||null, date:format(new Date(),'yyyy-MM-dd')}; await supabase.from(table).insert([item]); fetchData(); setIsModalOpen(false); setIsSubmitting(false);}}>
               <div className="form-group"><label>Nom / Matière</label><input className="form-control" required onChange={e=>setFormData({...formData, nom:e.target.value})} /></div>
               {modalType!=='product' && <div className="form-group"><label>Associer</label><select className="form-control" onChange={e=>setFormData({...formData, product_id:e.target.value})}><option value="">-</option>{products.map(p=><option key={p.id} value={p.id}>{p.nom}</option>)}</select></div>}
               <div className="form-group"><label>Prix Unitaire</label><input type="number" className="form-control" required onChange={e=>setFormData({...formData, prix:e.target.value})} /></div>
               <div className="form-group"><label>Quantité</label><input type="number" className="form-control" required onChange={e=>setFormData({...formData, quantite:e.target.value})} /></div>
               <div className="total-preview">Total: {(parseFloat(formData.prix)||0) * (parseFloat(formData.quantite)||0)} DA</div>
               <button type="submit" className="btn-primary" style={{width:'100%'}} disabled={isSubmitting}>Enregistrer</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
