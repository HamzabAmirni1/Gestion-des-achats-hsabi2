import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, ShoppingCart, TrendingDown, Package, 
  Plus, Search, Download, Moon, Sun, Trash2, RefreshCw,
  LogOut, User, Smartphone, MessageSquare, Send, X
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
      const { data: dbBot } = await supabase.from('messages').insert([dbBotMsg]).select();
      if (dbBot) setMessages(prev => [...prev, dbBot[0]]);
    }, 1000);
  };

  const handleDownloadPDF = async () => {
    const input = document.getElementById('pdf-content');
    Swal.fire({ title: 'Génération...', didOpen: () => Swal.showLoading() });
    try {
      const img = await htmlToImage.toJpeg(input, { quality: 0.9, pixelRatio: 2, backgroundColor: theme === 'dark' ? '#0f172a' : '#fff' });
      const pdf = new jsPDF('l', 'mm', 'a4');
      const w = pdf.internal.pageSize.getWidth();
      const h = (pdf.getImageProperties(img).height * w) / pdf.getImageProperties(img).width;
      pdf.addImage(img, 'JPEG', 0, 0, w, h);
      pdf.save(`Rapport_Brasti_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.pdf`);
      Swal.fire('OK', 'Downloaded', 'success');
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
  };

  if (!session) return (
    <div className="auth-page">
      <div className="auth-card-premium animate-enter">
        <h1 className="auth-title">Brasti Business</h1>
        <form className="auth-form-premium" onSubmit={(e)=>{e.preventDefault(); setAuthLoading(true); supabase.auth.signInWithPassword({email:authEmail, password:authPassword}).then(r=>{if(r.error) setAuthError(r.error.message); setAuthLoading(false);})}}>
          <div className="input-group"><label>Email</label><input type="email" required onChange={e=>setAuthEmail(e.target.value)} /></div>
          <div className="input-group"><label>Mot de passe</label><input type="password" required onChange={e=>setAuthPassword(e.target.value)} /></div>
          {authError && <div className="auth-error">{authError}</div>}
          <button className="btn-auth-submit" disabled={authLoading}>{authLoading ? '...' : 'Connexion'}</button>
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
        <button className={`nav-tab ${activeTab==='products'?'active':''}`} onClick={()=>setActiveTab('products')}>Catalogue</button>
        <button className={`nav-tab ${activeTab==='ventes'?'active':''}`} onClick={()=>setActiveTab('ventes')}>Ventes</button>
        <button className={`nav-tab ${activeTab==='chat'?'active':''}`} onClick={()=>setActiveTab('chat')}>Chat Bot</button>
      </nav>

      <main>
        {activeTab === 'dashboard' && <div className="stats-grid">
           <div className="stat-card"><div className="stat-value">{totalVentes} DA</div><div className="stat-label">Ventes</div></div>
           <div className="stat-card"><div className="stat-value">{totalAchats} DA</div><div className="stat-label">Dépenses</div></div>
           <div className="stat-card"><div className="stat-value">{benefice} DA</div><div className="stat-label">Bénéfice</div></div>
        </div>}
        {activeTab === 'products' && <div>
           <div className="section-header"><h3>Catalogue</h3><button className="btn-primary" onClick={()=>{setModalType('product'); setIsModalOpen(true)}}>+ Nouveau</button></div>
           <div className="products-grid">{products.map(p=><div key={p.id} className="product-card"><b>{p.nom}</b> - {p.prix} DA<p>{p.description}</p></div>)}</div>
        </div>}
        {activeTab === 'ventes' && <div>
           <div className="section-header"><h3>Ventes</h3><button className="btn-primary" onClick={()=>{setModalType('vente'); setIsModalOpen(true)}}>+ Vendre</button></div>
           <table className="data-table"><thead><tr><th>Client</th><th>Produit</th><th>Total</th></tr></thead><tbody>{ventes.map(v=><tr key={v.id}><td>{v.client_nom}</td><td>{v.nom}</td><td>{v.prix*v.quantite} DA</td></tr>)}</tbody></table>
        </div>}
        {activeTab === 'chat' && <div className="chat-container">
           <div className="chat-messages">{messages.map((m,i)=><div key={i} className={`message ${m.sender}`}>{m.content}</div>)}<div ref={chatEndRef}/></div>
           <div className="chat-input-area"><input className="form-control" value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSendMessage()}/><button className="btn-primary" onClick={handleSendMessage}><Send size={18}/></button></div>
        </div>}
      </main>

      {isModalOpen && (
        <div className="modal-overlay" onClick={()=>setIsModalOpen(false)}>
          <div className="modal-content" onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
               <h3>{modalType === 'product' ? 'Nouveau Produit' : 'Nouvelle Vente'}</h3>
               <button onClick={()=>setIsModalOpen(false)} style={{background:'none', border:'none', cursor:'pointer'}}><X size={24} color="var(--text-muted)"/></button>
            </div>
            <form onSubmit={async (e)=>{e.preventDefault(); setIsSubmitting(true); const table=modalType==='product'?'products':'ventes'; const item={user_id:session.user.id, nom:formData.nom, prix:parseFloat(formData.prix), quantite:parseFloat(formData.quantite)||1, client_nom:formData.client_nom, date:format(new Date(),'yyyy-MM-dd')}; await supabase.from(table).insert([item]); fetchData(); setIsModalOpen(false); setIsSubmitting(false);}}>
               <div className="form-group"><label>Nom</label><input className="form-control" required onChange={e=>setFormData({...formData, nom:e.target.value})} /></div>
               <div className="form-group"><label>Prix</label><input type="number" className="form-control" required onChange={e=>setFormData({...formData, prix:e.target.value})} /></div>
               {modalType==='vente' && <div className="form-group"><label>Client</label><input className="form-control" onChange={e=>setFormData({...formData, client_nom:e.target.value})} /></div>}
               <button type="submit" className="btn-primary" style={{width:'100%', marginTop:'10px'}} disabled={isSubmitting}>Confirmer & Sauvegarder</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
