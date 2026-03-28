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
  const [modalType, setModalType] = useState('product'); 
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

  const totalVentes = useMemo(() => ventes.reduce((a, c) => a + (c.prix * c.quantite), 0), [ventes]);
  const totalAchats = useMemo(() => achats.reduce((a, c) => a + (c.prix * c.quantite), 0), [achats]);
  const benefice = totalVentes - totalAchats;

  const handleDownloadPDF = async () => {
    const input = document.getElementById('app-main-content');
    Swal.fire({ title: 'Rapport PDF...', didOpen: () => Swal.showLoading() });
    try {
      const img = await htmlToImage.toJpeg(input, { quality: 0.95 });
      const pdf = new jsPDF('l', 'mm', 'a4');
      pdf.addImage(img, 'JPEG', 0, 0, 297, 210);
      pdf.save(`Brasti_Business_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
      Swal.fire('OK', 'Exportation réussie', 'success');
    } catch (e) { Swal.fire('Erreur', e.message, 'error'); }
  };

  const handleSendMessage = async () => {
    if(!chatInput.trim()) return;
    const content = chatInput;
    setChatInput('');
    const { data } = await supabase.from('messages').insert([{ user_id: session.user.id, sender: 'customer', content, is_bot: false }]).select();
    if(data) {
      setMessages(prev => [...prev, data[0]]);
      try {
        const stats = `Brasti: Ventes=${totalVentes}DA, Stock=${products.length}.`;
        const res = await fetch(`https://luminai.my.id/`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: content, prompt: `${stats} Répond court en français sur le business cleaning.` })
        });
        const d = await res.json();
        const botMsg = { user_id: session.user.id, sender: 'admin', content: d.result || d.response || "Compris.", is_bot: true };
        const { data: dbB } = await supabase.from('messages').insert([botMsg]).select();
        if(dbB) setMessages(prev => [...prev, dbB[0]]);
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
           {authError && <div style={{color:'red', fontSize:'0.85rem', marginBottom:'10px'}}>{authError}</div>}
           <button className="btn-auth-submit" disabled={authLoading}>{authLoading?'...':'Connexion'}</button>
           <div className="auth-divider"><span>OU</span></div>
           <button type="button" className="btn-google-auth" onClick={()=>supabase.auth.signInWithOAuth({provider:'google'})}>Démarrer avec Google Gmail</button>
           <button type="button" className="auth-mode-switch" onClick={()=>setAuthMode(authMode==='login'?'reg':'login')}>Inscription</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="app-wrapper" id="app-main-content">
      <header className="header" id="header-el">
        <div className="header-title">Brasti platform</div>
        <div className="header-actions">
           <button className="icon-btn" onClick={fetchData}><RefreshCw size={18}/></button>
           <button className="icon-btn" onClick={handleDownloadPDF}><Download size={18}/></button>
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
      <main>
        {activeTab==='dashboard' && (
          <div className="animate-enter">
            <div className="stats-grid">
               <div className="stat-card" style={{borderLeft:'6px solid #10b981'}}><div className="stat-value">{benefice} DA</div><div className="stat-label">Bénéfice Net</div></div>
               <div className="stat-card" style={{borderLeft:'6px solid #4f46e5'}}><div className="stat-value">{totalVentes} DA</div><div className="stat-label">C.A (Ventes)</div></div>
               <div className="stat-card" style={{borderLeft:'6px solid #ef4444'}}><div className="stat-value">{totalAchats} DA</div><div className="stat-label">Achats Totaux</div></div>
            </div>
            <div className="glass-container" style={{marginTop:'25px', height:'350px'}}>
               <Line options={{maintainAspectRatio:false}} data={{labels:['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'], datasets:[{label:'Activite Ventes (DA)', data:[0,0,0,0,0,0,totalVentes], borderColor:'#4f46e5', backgroundColor:'rgba(79, 70, 229, 0.1)', fill:true, tension:0.4}]}} />
            </div>
          </div>
        )}
        {activeTab==='stock' && (
          <div className="animate-enter">
            <div className="section-header"><h3>Inventaire de Stock</h3><button className="btn-primary" onClick={()=>{setModalType('product'); setIsModalOpen(true)}}>+ Nouveau Produit</button></div>
            <div className="products-grid">{products.map(p=><div key={p.id} className="product-card"><b>{p.nom}</b><span className={`badge ${p.stock_qty>10?'badge-success':'badge-danger'}`}>{p.stock_qty} en stock</span><div className="product-price">{p.prix_unitaire} DA</div></div>)}</div>
          </div>
        )}
        {activeTab==='ventes' && (
          <div className="glass-container animate-enter">
            <div className="section-header"><h3>Historique des Ventes</h3><button className="btn-primary" onClick={()=>{setModalType('vente'); setIsModalOpen(true)}}>+ Nouvelle Vente</button></div>
            <table className="data-table"><thead><tr><th>Nom</th><th>Qté</th><th>Total (DA)</th></tr></thead><tbody>{ventes.map(v=><tr key={v.id}><td>{v.nom}</td><td>{v.quantite}</td><td>{v.prix*v.quantite}</td></tr>)}</tbody></table>
          </div>
        )}
        {activeTab==='achats' && (
          <div className="glass-container animate-enter">
            <div className="section-header"><h3>Historique des Achats</h3><button className="btn-primary" onClick={()=>{setModalType('achat'); setIsModalOpen(true)}}>+ Nouvel Achat</button></div>
            <table className="data-table"><thead><tr><th>Article</th><th>Qté</th><th>Dépense (DA)</th></tr></thead><tbody>{achats.map(a=><tr key={a.id}><td>{a.nom}</td><td>{a.quantite}</td><td>{a.prix*a.quantite}</td></tr>)}</tbody></table>
          </div>
        )}
        {activeTab==='chat' && (
          <div className="glass-container animate-enter" style={{padding:'0'}}>
            <div className="chat-container">
              <div className="chat-messages">{messages.map((m,i)=><div key={i} className={`message ${m.sender} ${m.is_bot?'bot':''}`}>{m.content}</div>)}<div ref={chatEndRef}/></div>
              <div className="chat-input-area"><input className="form-control" value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSendMessage()} placeholder="Comment puis-je vous aider ?" /><button className="btn-primary" onClick={handleSendMessage}><Send size={18}/></button></div>
            </div>
          </div>
        )}
      </main>
      {isModalOpen && (
        <div className="modal-overlay" onClick={()=>setIsModalOpen(false)}>
           <div className="modal-content" onClick={e=>e.stopPropagation()}>
              <div className="modal-header"><h3>{modalType==='product'?'Produit':(modalType==='achat'?'Nouvel Achat':'Nouvelle Vente')}</h3><button onClick={()=>setIsModalOpen(false)}><X size={20}/></button></div>
              <form onSubmit={async (e)=>{e.preventDefault(); setIsSubmitting(true); const table=modalType==='product'?'products':(modalType==='achat'?'achats':'ventes'); const item={user_id:session.user.id, nom:formData.nom, prix:parseFloat(formData.prix), quantite:parseFloat(formData.quantite), product_id:formData.product_id||null, date:format(new Date(),'yyyy-MM-dd')}; await supabase.from(table).insert([item]); fetchData(); setIsModalOpen(false); setIsSubmitting(false);}}>
                 <div className="form-group"><label>Désignation</label><input className="form-control" required onChange={e=>setFormData({...formData, nom:e.target.value})} /></div>
                 {modalType !== 'product' && (
                    <div className="form-group" style={{background:'rgba(79, 70, 229, 0.05)', padding:'8px', borderRadius:'10px'}}><label>Lier au Stock (REQUIS)</label><select className="form-control" onChange={e=>setFormData({...formData, product_id:e.target.value})}><option value="">--- Sélectionner ---</option>{products.map(p=><option key={p.id} value={p.id}>{p.nom} (Actuel: {p.stock_qty})</option>)}</select></div>
                 )}
                 <div className="form-group"><label>Prix Unitaire (DA)</label><input type="number" step="0.01" className="form-control" required onChange={e=>setFormData({...formData, prix:e.target.value})} /></div>
                 <div className="form-group"><label>Quantité</label><input type="number" className="form-control" required onChange={e=>setFormData({...formData, quantite:e.target.value})} /></div>
                 <button type="submit" className="btn-primary" style={{width:'100%', marginTop:'10px'}} disabled={isSubmitting}>{isSubmitting?'...':'Enregistrer'}</button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
