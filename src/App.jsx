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
      const [a, v, p, m] = await Promise.all([
        supabase.from('achats').select('*').order('date', { ascending: false }),
        supabase.from('ventes').select('*').order('date', { ascending: false }),
        supabase.from('products').select('*').order('nom', { ascending: true }),
        supabase.from('messages').select('*').order('created_at', { ascending: true })
      ]);
      setAchats(a.data || []); setVentes(v.data || []); setProducts(p.data || []); setMessages(m.data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [session]);
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const totalVentes = useMemo(() => ventes.reduce((a, c) => a + (c.total_prix || (c.prix * c.quantite)), 0), [ventes]);
  const totalAchats = useMemo(() => achats.reduce((a, c) => a + (c.total_prix || (c.prix * c.quantite)), 0), [achats]);
  const benefice = totalVentes - totalAchats;

  const handleDownloadPDF = async () => {
    const input = document.getElementById('app-capture');
    Swal.fire({ title: 'Rapport PDF...', didOpen: () => Swal.showLoading() });
    try {
      const img = await htmlToImage.toJpeg(input, { quality: 0.95 });
      const pdf = new jsPDF('l', 'mm', 'a4');
      pdf.addImage(img, 'JPEG', 0, 0, 297, 210);
      pdf.save(`Brasti_Business_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
      Swal.fire('Succès', 'Rapport exporté !', 'success');
    } catch (e) { Swal.fire('Erreur', e.message, 'error'); }
  };

  const handleSendMessage = async () => {
    if(!chatInput.trim()) return;
    const msg = { user_id: session.user.id, sender: 'customer', content: chatInput, is_bot: false };
    setChatInput('');
    const { data } = await supabase.from('messages').insert([msg]).select();
    if(data) {
      setMessages([...messages, data[0]]);
      setTimeout(async () => {
        const botMsg = { user_id: session.user.id, sender: 'admin', content: "Message bien reçu sur Brasti Business (Production مواد التنظيف).", is_bot: true };
        const { data: dBot } = await supabase.from('messages').insert([botMsg]).select();
        if(dBot) setMessages(prev => [...prev, dBot[0]]);
      }, 1000);
    }
  };

  if (!session) return (
    <div className="auth-page">
      <div className="auth-card-premium animate-enter">
        <h1 className="auth-title">Brasti platform</h1>
        <p style={{marginBottom:'25px'}}>مواد التنظيف - Gestion de Production</p>
        <form onSubmit={async (e)=>{e.preventDefault(); setAuthLoading(true); let r = authMode==='login' ? await supabase.auth.signInWithPassword({email:authEmail, password:authPassword}) : await supabase.auth.signUp({email:authEmail, password:authPassword}); if(r.error) setAuthError(r.error.message); setAuthLoading(false);}}>
           <div className="input-group"><label>Email</label><input type="email" placeholder="votre@email.com" required onChange={e=>setAuthEmail(e.target.value)} /></div>
           <div className="input-group"><label>Mot de passe</label><input type="password" required onChange={e=>setAuthPassword(e.target.value)} /></div>
           {authError && <div style={{color:'#ef4444', fontSize:'0.85rem', marginBottom:'10px'}}>{authError}</div>}
           <button className="btn-auth-submit" disabled={authLoading}>{authLoading?'Chargement...':'Se Connecter'}</button>
           <div className="auth-divider"><span>OU</span></div>
           <button type="button" className="btn-google-auth" onClick={()=>supabase.auth.signInWithOAuth({provider:'google'})}>
             <svg width="18" height="18" viewBox="0 0 24 24" style={{marginRight:'10px'}}><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
             Continuer avec Google
           </button>
           <button type="button" className="auth-mode-switch" onClick={()=>setAuthMode(authMode==='login'?'reg':'login')}>{authMode==='login'?'Créer un compte GRATUIT':'Déjà inscrit ? Connectez-vous'}</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="app-wrapper" id="app-capture">
      <header className="header">
        <div className="header-title">Brasti platform</div>
        <div className="header-actions">
           <button className="icon-btn" onClick={fetchData}><RefreshCw size={18}/></button>
           <button className="icon-btn" onClick={handleDownloadPDF}><Download size={18}/></button>
           <button className="icon-btn" onClick={()=>setTheme(theme==='light'?'dark':'light')}>{theme==='light'?<Moon size={18}/>:<Sun size={18}/>}</button>
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
      <main>
        {activeTab==='dashboard' && (
          <div className="animate-enter">
            <div className="stats-grid">
               <div className="stat-card" style={{borderLeft:'6px solid #10b981'}}><div className="stat-value">{benefice} DA</div><div className="stat-label">Bénéfice Net</div></div>
               <div className="stat-card" style={{borderLeft:'6px solid #4f46e5'}}><div className="stat-value">{totalVentes} DA</div><div className="stat-label">Chiffre d'Affaires</div></div>
               <div className="stat-card" style={{borderLeft:'6px solid #ef4444'}}><div className="stat-value">{totalAchats} DA</div><div className="stat-label">Dépenses Totales</div></div>
            </div>
            <div className="glass-container"><Line data={{labels:['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'], datasets:[{label:'Ventes (DA)', data:[0,0,0,0,0,0,totalVentes], borderColor:'#4f46e5', fill:true, tension:0.4}]}} /></div>
          </div>
        )}
        {activeTab==='stock' && (
          <div className="animate-enter">
            <div className="section-header"><h3>Gestion du Stock</h3><button className="btn-primary" onClick={()=>{setModalType('product'); setIsModalOpen(true)}}>+ Nouveau Produit</button></div>
            <div className="products-grid">{products.map(p=><div key={p.id} className="product-card"><b>{p.nom}</b><span className={`badge ${p.stock_qty>10?'badge-success':'badge-danger'}`}>{p.stock_qty} en stock</span><div className="product-price">{p.prix_unitaire} DA</div></div>)}</div>
          </div>
        )}
        {activeTab==='ventes' && (
          <div className="glass-container animate-enter">
            <div className="section-header"><h3>Historique Ventes</h3><button className="btn-primary" onClick={()=>{setModalType('vente'); setIsModalOpen(true)}}>+ Vendre</button></div>
            <table className="data-table"><thead><tr><th>Date</th><th>Nom</th><th>Quantité</th><th>Total</th></tr></thead><tbody>{ventes.map(v=><tr key={v.id}><td>{v.date}</td><td>{v.nom}</td><td>{v.quantite}</td><td>{v.prix*v.quantite} DA</td></tr>)}</tbody></table>
          </div>
        )}
        {activeTab==='achats' && (
          <div className="glass-container animate-enter">
            <div className="section-header"><h3>Historique Achats</h3><button className="btn-primary" onClick={()=>{setModalType('achat'); setIsModalOpen(true)}}>+ Acheter</button></div>
            <table className="data-table"><thead><tr><th>Date</th><th>Matière</th><th>Quantité</th><th>Dépense</th></tr></thead><tbody>{achats.map(a=><tr key={a.id}><td>{a.date}</td><td>{a.nom}</td><td>{a.quantite}</td><td>{a.prix*a.quantite} DA</td></tr>)}</tbody></table>
          </div>
        )}
        {activeTab==='chat' && (
          <div className="glass-container chat-tab animate-enter">
            <div className="chat-container">
              <div className="chat-messages">{messages.map((m,i)=><div key={i} className={`message ${m.sender} ${m.is_bot?'bot':''}`}>{m.content}</div>)}<div ref={chatEndRef}/></div>
              <div className="chat-input-area"><input className="form-control" value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSendMessage()} placeholder="Une question ?" /><button className="btn-primary" onClick={handleSendMessage}><Send size={18}/></button></div>
            </div>
          </div>
        )}
      </main>
      {isModalOpen && (
        <div className="modal-overlay" onClick={()=>setIsModalOpen(false)}>
           <div className="modal-content" onClick={e=>e.stopPropagation()}>
              <div className="modal-header"><h3>{modalType==='product'?'Produit':(modalType==='achat'?'Achat':'Vente')}</h3><button onClick={()=>setIsModalOpen(false)}><X size={20}/></button></div>
              <form onSubmit={async (e)=>{e.preventDefault(); setIsSubmitting(true); const table=modalType==='product'?'products':(modalType==='achat'?'achats':'ventes'); const item={user_id:session.user.id, nom:formData.nom, prix:parseFloat(formData.prix), quantite:parseFloat(formData.quantite), product_id:formData.product_id||null, date:format(new Date(),'yyyy-MM-dd')}; await supabase.from(table).insert([item]); fetchData(); setIsModalOpen(false); setIsSubmitting(false);}}>
                 <div className="form-group"><label>Nom / Désignation</label><input className="form-control" required onChange={e=>setFormData({...formData, nom:e.target.value})}/></div>
                 {modalType !== 'product' && (
                    <div className="form-group"><label>Mise à jour Stock</label><select className="form-control" onChange={e=>setFormData({...formData, product_id:e.target.value})}><option value="">Ne pas lier</option>{products.map(p=><option key={p.id} value={p.id}>{p.nom} (Actuel: {p.stock_qty})</option>)}</select></div>
                 )}
                 <div className="form-group"><label>Prix Unitaire (DA)</label><input type="number" step="0.01" className="form-control" required onChange={e=>setFormData({...formData, prix:e.target.value})}/></div>
                 <div className="form-group"><label>Quantité</label><input type="number" className="form-control" required onChange={e=>setFormData({...formData, quantite:e.target.value})}/></div>
                 <button type="submit" className="btn-primary" style={{width:'100%', marginTop:'10px'}} disabled={isSubmitting}>{isSubmitting?'...':'Sauvegarder'}</button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
