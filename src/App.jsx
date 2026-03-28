import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, ShoppingCart, TrendingDown, Package, 
  Plus, Search, Download, Moon, Sun, Trash2, RefreshCw,
  LogOut, User, Smartphone, MessageSquare, Send, X, Filter, BarChart3
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
  const [theme, setTheme] = useState('light');
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [achats, setAchats] = useState([]);
  const [ventes, setVentes] = useState([]);
  const [products, setProducts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('achat'); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ nom: '', quantite: 1, prix: 1, product_id: '' });
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
      setAchats(a || []); setVentes(v || []); setProducts(p || []); setMessages(m || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [session]);
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const totalVentes = useMemo(() => ventes.reduce((a, c) => a + (c.prix * c.quantite), 0), [ventes]);
  const totalAchats = useMemo(() => achats.reduce((a, c) => a + (c.prix * c.quantite), 0), [achats]);
  const benefice = totalVentes - totalAchats;

  const handleSendMessage = async () => {
    if(!chatInput.trim()) return;
    const content = chatInput;
    setChatInput('');
    const { data } = await supabase.from('messages').insert([{ user_id: session.user.id, sender: 'customer', content, is_bot: false }]).select();
    if(data) {
      setMessages(p => [...p, data[0]]);
      try {
        const stats = `Brasti Live Stats: Total Sales=${totalVentes}DA, Stock items=${products.length}. Weekly sales total=${totalVentes}DA.`;
        const res = await fetch(`https://luminai.my.id/`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: content, prompt: `${stats} Répond court en français sur le business.` })
        });
        const d = await res.json();
        const botMsg = { user_id: session.user.id, sender: 'admin', content: d.result || d.response || "Je traite vos données.", is_bot: true };
        const { data: dbB } = await supabase.from('messages').insert([botMsg]).select();
        if(dbB) setMessages(p => [...p, dbB[0]]);
      } catch (err) { console.error(err); }
    }
  };

  if (!session) return (
    <div className="auth-page">
      <div className="auth-card-premium animate-enter">
        <h1 className="auth-title">Brasti Business</h1>
        <p style={{marginBottom:'25px'}}>Production مواد التنظيف</p>
        <form onSubmit={async (e)=>{e.preventDefault(); setAuthLoading(true); let r = authMode==='login' ? await supabase.auth.signInWithPassword({email:authEmail, password:authPassword}) : await supabase.auth.signUp({email:authEmail, password:authPassword}); if(r.error) setAuthError(r.error.message); setAuthLoading(false);}}>
           <div className="input-group"><label>Email</label><input type="email" placeholder="votre@email.com" required onChange={e=>setAuthEmail(e.target.value)} /></div>
           <div className="input-group"><label>Mot de passe</label><input type="password" required onChange={e=>setAuthPassword(e.target.value)} /></div>
           {authError && <div style={{color:'red', marginBottom:'10px'}}>{authError}</div>}
           <button className="btn-auth-submit" disabled={authLoading}>{authLoading?'...':'Connexion'}</button>
           <div className="auth-divider"><span>OU</span></div>
           <button type="button" className="btn-google-auth" onClick={()=>supabase.auth.signInWithOAuth({provider:'google'})}>Google Account</button>
           <button type="button" className="auth-mode-switch" onClick={()=>setAuthMode(authMode==='login'?'reg':'login')}>Inscription</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="app-wrapper">
      <header className="header">
        <div className="header-title">Brasti platform</div>
        <div className="header-actions">
           <button className="icon-btn" onClick={fetchData}><RefreshCw size={18}/></button>
           <button className="icon-btn" onClick={()=>setTheme(theme==='light'?'dark':'light')}><Moon size={18}/></button>
           <button className="icon-btn" onClick={()=>supabase.auth.signOut()}><LogOut size={18}/></button>
        </div>
      </header>
      <nav className="nav-tabs">
        <button className={`nav-tab ${activeTab==='dashboard'?'active':''}`} onClick={()=>setActiveTab('dashboard')}><LayoutDashboard size={18}/> Dashboard</button>
        <button className={`nav-tab ${activeTab==='stock'?'active':''}`} onClick={()=>setActiveTab('stock')}><Package size={18}/> Stock</button>
        <button className={`nav-tab ${activeTab==='ventes'?'active':''}`} onClick={()=>setActiveTab('ventes')}><TrendingDown size={18}/> Ventes</button>
        <button className={`nav-tab ${activeTab==='achats'?'active':''}`} onClick={()=>setActiveTab('achats')}><ShoppingCart size={18}/> Achats</button>
        <button className={`nav-tab ${activeTab==='chat'?'active':''}`} onClick={()=>setActiveTab('chat')}><MessageSquare size={18}/> AI</button>
      </nav>
      <main id="app-capture">
        {activeTab==='dashboard' && <div className="stats-grid animate-enter"><div className="stat-card" style={{borderLeft:'5px solid #10b981'}}><div className="stat-value">{benefice} DA</div><div className="stat-label">Bénéfice</div></div><div className="stat-card" style={{borderLeft:'5px solid #4f46e5'}}><div className="stat-value">{totalVentes} DA</div><div className="stat-label">Ventes</div></div><div className="stat-card" style={{borderLeft:'5px solid #ef4444'}}><div className="stat-value">{totalAchats} DA</div><div className="stat-label">Achats</div></div></div>}
        {activeTab==='stock' && <div className="animate-enter"><div className="section-header"><h3>Stock</h3><button className="btn-primary" onClick={()=>{setModalType('product'); setIsModalOpen(true)}}>+ Nouveau</button></div><div className="products-grid">{products.map(p=><div key={p.id} className="product-card"><b>{p.nom}</b><span className="badge badge-success">{p.stock_qty} en stock</span></div>)}</div></div>}
        {activeTab==='ventes' && <div className="glass-container animate-enter"><div className="section-header"><h3>Ventes</h3><button className="btn-primary" onClick={()=>{setModalType('vente'); setIsModalOpen(true)}}>+ Vendre</button></div><table className="data-table"><thead><tr><th>Nom</th><th>Qté</th><th>Total</th></tr></thead><tbody>{ventes.map(v=><tr key={v.id}><td>{v.nom}</td><td>{v.quantite}</td><td>{v.prix*v.quantite} DA</td></tr>)}</tbody></table></div>}
        {activeTab==='achats' && <div className="glass-container animate-enter"><div className="section-header"><h3>Achats</h3><button className="btn-primary" onClick={()=>{setModalType('achat'); setIsModalOpen(true)}}>+ Acheter</button></div><table className="data-table"><thead><tr><th>Nom</th><th>Qté</th><th>Total</th></tr></thead><tbody>{achats.map(a=><tr key={a.id}><td>{a.nom}</td><td>{a.quantite}</td><td>{a.prix*a.quantite} DA</td></tr>)}</tbody></table></div>}
        {activeTab==='chat' && <div className="glass-container animate-enter"><div className="chat-container"><div className="chat-messages">{messages.map((m,i)=><div key={i} className={`message ${m.sender} ${m.is_bot?'bot':''}`}>{m.content}</div>)}<div ref={chatEndRef}/></div><div className="chat-input-area"><input className="form-control" value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSendMessage()} placeholder="Une question ?" /><button className="btn-primary" onClick={handleSendMessage}><Send size={18}/></button></div></div></div>}
      </main>
      {isModalOpen && (
        <div className="modal-overlay" onClick={()=>setIsModalOpen(false)}>
           <div className="modal-content" onClick={e=>e.stopPropagation()}>
              <div className="modal-header"><h3>{modalType}</h3><button onClick={()=>setIsModalOpen(false)}><X size={20}/></button></div>
              <form onSubmit={async (e)=>{e.preventDefault(); setIsSubmitting(true); const table=modalType==='product'?'products':(modalType==='achat'?'achats':'ventes'); const item={user_id:session.user.id, nom:formData.nom, prix:parseFloat(formData.prix), quantite:parseFloat(formData.quantite), product_id:formData.product_id||null, date:format(new Date(),'yyyy-MM-dd')}; await supabase.from(table).insert([item]); fetchData(); setIsModalOpen(false); setIsSubmitting(false);}}>
                 <div className="form-group"><label>Nom / Désignation</label><input className="form-control" required onChange={e=>setFormData({...formData, nom:e.target.value})} /></div>
                 {modalType !== 'product' && (
                    <div className="form-group" style={{background:'rgba(255,255,0,0.1)', padding:'10px', borderRadius:'10px'}}><label>⚠️ Lier au Stock (REQUIS pour mise à jour)</label><select className="form-control" required={modalType==='vente'} onChange={e=>setFormData({...formData, product_id:e.target.value})}><option value="">--- Sélectionner un produit ---</option>{products.map(p=><option key={p.id} value={p.id}>{p.nom} (Stock: {p.stock_qty})</option>)}</select></div>
                 )}
                 <div className="form-group"><label>Prix (DA)</label><input type="number" step="0.01" className="form-control" required onChange={e=>setFormData({...formData, prix:e.target.value})} /></div>
                 <div className="form-group"><label>Quantité</label><input type="number" className="form-control" required onChange={e=>setFormData({...formData, quantite:e.target.value})} /></div>
                 <button type="submit" className="btn-primary" style={{width:'100%', marginTop:'10px'}} disabled={isSubmitting}>{isSubmitting?'...':'Enregistrer'}</button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
