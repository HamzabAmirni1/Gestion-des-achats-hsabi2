import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, ShoppingCart, TrendingDown, Package, 
  Plus, Search, Download, Moon, Sun, Trash2, RefreshCw,
  LogOut, User, Smartphone, MessageSquare, Send
} from 'lucide-react';
import { format, isThisWeek, parseISO } from 'date-fns';
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
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('achat'); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    nom: '', client_nom: '', quantite: '', prix: '', description: ''
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
      const [a, v, p, m] = await Promise.all([
        supabase.from('achats').select('*').order('date', { ascending: false }),
        supabase.from('ventes').select('*').order('date', { ascending: false }),
        supabase.from('products').select('*').order('created_at', { ascending: false }),
        supabase.from('messages').select('*').order('created_at', { ascending: true })
      ]);
      if (a.data) setAchats(a.data);
      if (v.data) setVentes(v.data);
      if (p.data) setProducts(p.data);
      if (m.data) setMessages(m.data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [session]);
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);
  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');

  const scrollToBottom = () => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); };
  useEffect(() => { scrollToBottom(); }, [messages]);

  const totalVentes = useMemo(() => ventes.reduce((a, c) => a + (c.prix * c.quantite), 0), [ventes]);
  const totalAchats = useMemo(() => achats.reduce((a, c) => a + (c.prix * c.quantite), 0), [achats]);
  const benefice = totalVentes - totalAchats;
  const ventesCetteSemaine = useMemo(() => ventes.filter(v => isThisWeek(parseISO(v.date))).reduce((a, c) => a + (c.prix * c.quantite), 0), [ventes]);

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    const content = chatInput;
    setChatInput('');
    const newMsg = { user_id: session.user.id, sender: 'customer', content, is_bot: false };
    const { data } = await supabase.from('messages').insert([newMsg]).select();
    if (data) setMessages([...messages, data[0]]);
    
    // Auto-reply
    setTimeout(async () => {
      const res = await fetch("https://luminai.my.id/", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content, prompt: `Brasti AI. Stats: Ventes=${totalVentes}, Hebdo=${ventesCetteSemaine}. Répond en fr.` })
      });
      const d = await res.json();
      const botMsg = { user_id: session.user.id, sender: 'admin', content: d.result || d.response || "...", is_bot: true };
      const { data: dbBot } = await supabase.from('messages').insert([botMsg]).select();
      if (dbBot) setMessages(prev => [...prev, dbBot[0]]);
    }, 1000);
  };

  const signInWithGoogle = async () => {
     const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
     if (error) setAuthError(error.message);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    let r = authMode === 'login' ? await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword }) : await supabase.auth.signUp({ email: authEmail, password: authPassword });
    if (r.error) setAuthError(r.error.message);
    setAuthLoading(false);
  };

  if (!session) return (
    <div className="auth-page">
      <div className="auth-card-premium animate-enter">
        <div className="auth-header">
          <div className="auth-logo"><Package size={40} color="var(--primary)" /></div>
          <h1>Brasti platform</h1>
          <p>{authMode === 'login' ? 'Bienvenue à nouveau !' : 'Créez votre compte business'}</p>
        </div>
        
        <form className="auth-form-premium" onSubmit={handleAuth}>
          <div className="input-group">
            <label>Email</label>
            <input type="email" placeholder="nom@exemple.com" required onChange={e=>setAuthEmail(e.target.value)} />
          </div>
          <div className="input-group">
            <label>Mot de passe</label>
            <input type="password" placeholder="••••••••" required onChange={e=>setAuthPassword(e.target.value)} />
          </div>
          {authError && <div className="auth-error">{authError}</div>}
          <button className="btn-auth-submit" disabled={authLoading}>
            {authLoading ? 'Chargement...' : (authMode === 'login' ? 'Se connecter' : 'S\'inscrire')}
          </button>
        </form>

        <div className="auth-divider"><span>OU</span></div>

        <button className="btn-google-auth" onClick={signInWithGoogle}>
          <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Continuer avec Google
        </button>

        <button className="auth-mode-switch" onClick={()=>setAuthMode(authMode==='login'?'register':'login')}>
          {authMode === 'login' ? 'Pas encore de compte ? S\'inscrire' : 'Déjà un compte ? Se connecter'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="app-wrapper" id="pdf-content">
      <header className="header">
        <div className="header-title">Brasti platform</div>
        <div className="header-actions">
          <button className="icon-btn" onClick={fetchData}><RefreshCw size={18} /></button>
          <button className="icon-btn" onClick={toggleTheme}>{theme==='light'?<Moon size={18}/>:<Sun size={18}/>}</button>
          <button className="icon-btn" onClick={()=>supabase.auth.signOut()}><LogOut size={18}/></button>
        </div>
      </header>
      <nav className="nav-tabs">
        <button className={`nav-tab ${activeTab==='dashboard'?'active':''}`} onClick={()=>setActiveTab('dashboard')}><LayoutDashboard size={18} /> Dashboard</button>
        <button className={`nav-tab ${activeTab==='products'?'active':''}`} onClick={()=>setActiveTab('products')}><Package size={18} /> Catalogue</button>
        <button className={`nav-tab ${activeTab==='ventes'?'active':''}`} onClick={()=>setActiveTab('ventes')}><TrendingDown size={18} /> Ventes</button>
        <button className={`nav-tab ${activeTab==='chat'?'active':''}`} onClick={()=>setActiveTab('chat')}><MessageSquare size={18} /> Chat Bot AI</button>
      </nav>

      <main>
        {activeTab === 'dashboard' && (
          <div className="animate-enter">
            <div className="stats-grid">
              <div className="stat-card revenue"><div className="stat-value">{totalVentes} DA</div><div className="stat-label">Total Ventes</div></div>
              <div className="stat-card expenses"><div className="stat-value">{totalAchats} DA</div><div className="stat-label">Total Dépenses</div></div>
              <div className="stat-card profit"><div className="stat-value">{benefice} DA</div><div className="stat-label">Bénéfice Net</div></div>
            </div>
            <div className="glass-container">
               <h3>Ventes de la semaine : {ventesCetteSemaine} DA</h3>
               <Line data={{labels:['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'], datasets:[{label:'DA', data:[0,0,0,0,0,0,ventesCetteSemaine], borderColor:'var(--primary)', fill:true, tension:0.4}]}} />
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="animate-enter">
            <div className="section-header"><div className="section-title">Notre Catalogue</div><button className="btn-primary" onClick={()=>{setModalType('product'); setIsModalOpen(true)}}><Plus size={18}/> Ajouter</button></div>
            <div className="products-grid">{products.map(p=><div key={p.id} className="product-card"><div className="product-name">{p.nom}</div><div className="product-price">{p.prix} DA</div><p>{p.description}</p></div>)}</div>
          </div>
        )}

        {activeTab === 'ventes' && (
          <div className="glass-container animate-enter">
            <div className="section-header"><div className="section-title">Historique des Ventes</div><button className="btn-primary" onClick={()=>{setModalType('vente'); setIsModalOpen(true)}}><Plus size={18}/> Vendre</button></div>
            <table className="data-table"><thead><tr><th>Client</th><th>Produit</th><th>Total</th></tr></thead><tbody>{ventes.map(v=><tr key={v.id}><td>{v.client_nom}</td><td>{v.nom}</td><td>{v.prix*v.quantite} DA</td></tr>)}</tbody></table>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="glass-container animate-enter">
            <div className="chat-container">
              <div className="chat-messages">{messages.map((m,i)=><div key={i} className={`message ${m.sender} ${m.is_bot?'bot':''}`}>{m.content}</div>)}<div ref={chatEndRef} /></div>
              <div className="chat-input-area">
                <input className="form-control" value={chatInput} placeholder="Combien j'ai vendu cette semaine ?" onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSendMessage()} />
                <button className="btn-primary" onClick={handleSendMessage}><Send size={18} /></button>
              </div>
            </div>
          </div>
        )}
      </main>

      {isModalOpen && (
        <div className="modal-overlay" onClick={()=>setIsModalOpen(false)}>
          <div className="modal-content animate-enter" onClick={e=>e.stopPropagation()}>
            <form onSubmit={async (e)=>{e.preventDefault(); setIsSubmitting(true); const table=modalType==='product'?'products':'ventes'; const item={user_id:session.user.id, nom:formData.nom, prix:parseFloat(formData.prix), quantite:parseFloat(formData.quantite)||1, client_nom:formData.client_nom, date:format(new Date(),'yyyy-MM-dd')}; await supabase.from(table).insert([item]); fetchData(); setIsModalOpen(false); setIsSubmitting(false);}}>
               <div className="form-group"><label>Nom</label><input className="form-control" required onChange={e=>setFormData({...formData, nom:e.target.value})} /></div>
               <div className="form-group"><label>Prix</label><input type="number" className="form-control" required onChange={e=>setFormData({...formData, prix:e.target.value})} /></div>
               {modalType==='vente' && <div className="form-group"><label>Client</label><input className="form-control" onChange={e=>setFormData({...formData, client_nom:e.target.value})} /></div>}
               <button type="submit" className="btn-primary" style={{width:'100%'}} disabled={isSubmitting}>Confirmer</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
