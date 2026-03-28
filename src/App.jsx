import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, ShoppingCart, TrendingDown, Package, 
  Download, Moon, Sun, RefreshCw, LogOut, Send, X, Plus, Printer, Mail, Lock
} from 'lucide-react';
import { format } from 'date-fns';
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
  const [theme, setTheme] = useState(localStorage.getItem('brasti-theme') || 'light');
  const [activeTab, setActiveTab] = useState(localStorage.getItem('brasti-tab') || 'dashboard');
  
  const [achats, setAchats] = useState([]);
  const [ventes, setVentes] = useState([]);
  const [products, setProducts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('achat'); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ nom: '', quantite: 1, prix: 1, product_id: '', client_nom: '', client_tel: '', est_paye: true });
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
  useEffect(() => { 
    document.documentElement.setAttribute('data-theme', theme); 
    localStorage.setItem('brasti-theme', theme);
  }, [theme]);
  useEffect(() => { localStorage.setItem('brasti-tab', activeTab); }, [activeTab]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const totalVentes = useMemo(() => (ventes || []).reduce((a, c) => a + (c.prix * c.quantite), 0), [ventes]);
  const totalAchats = useMemo(() => (achats || []).reduce((a, c) => a + (c.prix * c.quantite), 0), [achats]);
  const totalDettes = useMemo(() => (ventes || []).filter(v => v.est_paye === false).reduce((a, c) => a + (c.prix * c.quantite), 0), [ventes]);
  
  const beneficeReel = useMemo(() => {
     return (ventes || []).reduce((total, v) => {
       const product = products.find(p => p.id === v.product_id);
       const unitCost = product ? (product.prix_unitaire || 0) : 0;
       return total + ((v.prix - unitCost) * v.quantite);
     }, 0);
  }, [ventes, products]);

  const generateInvoice = (v) => {
    const doc = new jsPDF();
    doc.setFontSize(22); doc.text('FACTURE BRASTI', 20, 30);
    doc.text(`Client: ${v.client_nom || 'Client'}`, 20, 50);
    doc.text(`Total: ${v.prix * v.quantite} DA`, 20, 60);
    doc.save(`Facture_${v.client_nom}.pdf`);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true); setAuthError('');
    const { data, error } = authMode === 'login' 
      ? await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword })
      : await supabase.auth.signUp({ email: authEmail, password: authPassword });
    if (error) setAuthError(error.message);
    setAuthLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let table = modalType==='product'?'products':(modalType==='achat'?'achats':'ventes');
      let item = { user_id: session.user.id, nom: formData.nom, prix: parseFloat(formData.prix), quantite: parseFloat(formData.quantite) };
      if(modalType === 'product') {
        item.prix_unitaire = parseFloat(formData.prix);
        item.stock_qty = parseFloat(formData.quantite);
        item.prix = undefined; item.quantite = undefined; 
      } else {
        item.product_id = formData.product_id || null;
        item.date = format(new Date(), 'yyyy-MM-dd');
        if(modalType === 'vente') {
           item.client_nom = formData.client_nom;
           item.client_tel = formData.client_tel;
           item.est_paye = formData.est_paye;
        }
      }
      const { error } = await supabase.from(table).insert([item]);
      if(error) throw error;
      fetchData(); setIsModalOpen(false);
      Swal.fire({ icon: 'success', title: 'Succès !', timer: 1000, showConfirmButton: false });
    } catch (err) { Swal.fire('Erreur', 'Vérifiez la connexion', 'error'); } finally { setIsSubmitting(false); }
  };

  const handleSendMessage = async () => {
    if(!chatInput.trim()) return;
    const content = chatInput; setChatInput('');
    const { data } = await supabase.from('messages').insert([{ user_id: session.user.id, sender: 'customer', content }]).select();
    if(data) {
      setMessages(p => [...p, data[0]]);
      try {
        const res = await fetch(`https://luminai.my.id/`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, prompt: `Ventes=${totalVentes}DA. Répond court en français.` })
        });
        const d = await res.json();
        const botMsg = { user_id: session.user.id, sender: 'admin', content: d.result || d.response || "Compris.", is_bot: true };
        await supabase.from('messages').insert([botMsg]).select();
        fetchData();
      } catch (err) { console.error(err); }
    }
  };

  if (!session) return (
    <div className="auth-page">
      <div className="auth-card-premium animate-enter">
        <h1 className="auth-title">Brasti Business</h1>
        <p style={{marginBottom:30, color:'var(--text-muted)'}}>Manage your production smartly</p>
        <form onSubmit={handleAuth}>
           <div className="auth-group"><label>Email</label><div className="auth-input-wrapper"><Mail size={18}/><input type="email" required value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder="votre@email.com" /></div></div>
           <div className="auth-group"><label>Mot de passe</label><div className="auth-input-wrapper"><Lock size={18}/><input type="password" required value={authPassword} onChange={e=>setAuthPassword(e.target.value)} placeholder="••••••••" /></div></div>
           {authError && <p style={{color:'red', fontSize:'0.85rem', marginBottom:15}}>{authError}</p>}
           <button className="btn-auth-submit" disabled={authLoading}>{authLoading ? '...' : (authMode==='login'?'Se connecter':'S\'inscrire')}</button>
           <div className="auth-divider"><span>OU</span></div>
           <button type="button" className="btn-google-auth" onClick={()=>supabase.auth.signInWithOAuth({provider:'google'})}>Sign in with Google</button>
           <button type="button" className="auth-mode-switch" onClick={()=>setAuthMode(authMode==='login'?'reg':'login')}>{authMode==='login'?'Créer un compte':'Connectez-vous'}</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="app-wrapper">
      <header className="header">
        <div className="header-title">Brasti platform</div>
        <div className="header-actions">
           <button className="icon-btn" onClick={fetchData} title="Rafraîchir"><RefreshCw size={20}/></button>
           <button className="icon-btn" onClick={()=>{const input=document.getElementById('app-main-content'); htmlToImage.toJpeg(input).then(it=>{const p=new jsPDF('l','mm','a4'); p.addImage(it,'JPEG',0,0,297,210); p.save('Rapport.pdf')})}} title="PDF Rapport"><Download size={20}/></button>
           <button className="icon-btn" onClick={()=>setTheme(theme==='light'?'dark':'light')} title="Thème"><Sun size={20}/></button>
           <button className="icon-btn" onClick={()=>supabase.auth.signOut()} title="Déconnexion"><LogOut size={20}/></button>
        </div>
      </header>
      <nav className="nav-tabs">
        <button className={`nav-tab ${activeTab==='dashboard'?'active':''}`} onClick={()=>setActiveTab('dashboard')}>Dashboard</button>
        <button className={`nav-tab ${activeTab==='stock'?'active':''}`} onClick={()=>setActiveTab('stock')}>Stock</button>
        <button className={`nav-tab ${activeTab==='ventes'?'active':''}`} onClick={()=>setActiveTab('ventes')}>Ventes</button>
        <button className={`nav-tab ${activeTab==='chat'?'active':''}`} onClick={()=>setActiveTab('chat')}>AI support</button>
      </nav>
      <main id="app-main-content">
        {activeTab==='dashboard' && (
          <div className="animate-enter">
            <div className="stats-grid">
               <div className="stat-card" style={{borderLeft:'5px solid #10b981'}}><div className="stat-value">{beneficeReel.toFixed(0)} DA</div><div className="stat-label">Bénéfice Net</div></div>
               <div className="stat-card" style={{borderLeft:'5px solid #ef4444'}}><div className="stat-value">{totalDettes} DA</div><div className="stat-label">Dettes</div></div>
               <div className="stat-card" style={{borderLeft:'5px solid #4f46e5'}}><div className="stat-value">{totalVentes} DA</div><div className="stat-label">Total Ventes</div></div>
            </div>
            <div className="glass-container" style={{height:300}}><Line options={{maintainAspectRatio:false}} data={{labels:['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'], datasets:[{label:'Gain (DA)', data:[0,0,0,0,0,0,beneficeReel], borderColor:'#10b981', fill:true, tension:0.4}]}} /></div>
          </div>
        )}
        {activeTab==='stock' && (
          <div className="animate-enter">
            <div className="section-header"><h3>Inventaire</h3><button className="btn-primary" onClick={()=>{setFormData({nom:'', quantite:1, prix:1, product_id:'', est_paye:true}); setModalType('product'); setIsModalOpen(true)}}><Plus size={18}/> Nouveau</button></div>
            <div className="products-grid">{products.map(p=>(
                <div key={p.id} className="product-card" onClick={()=>{setFormData({...formData, product_id:p.id, nom:p.nom, prix:p.prix_unitaire*1.2, est_paye:true}); setModalType('vente'); setIsModalOpen(true)}} style={{cursor:'pointer'}}>
                   <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}><b>{p.nom}</b><span className="badge badge-success">{p.stock_qty} Qté</span></div>
                   <div style={{marginTop:12, fontSize:'0.9rem', color:'var(--text-muted)'}}>Coût: <span style={{color:'var(--primary)', fontWeight:800}}>{p.prix_unitaire} DA</span></div>
                </div>
              ))}</div>
          </div>
        )}
        {activeTab==='ventes' && <div className="glass-container animate-enter"><div className="section-header"><h3>Historique</h3><button className="btn-primary" onClick={()=>{setModalType('vente'); setIsModalOpen(true)}}><Plus size={18}/> Nouvelle</button></div><table className="data-table"><thead><tr><th>Client</th><th>Produit</th><th>Total</th><th>Action</th></tr></thead><tbody>{ventes.map(v=><tr key={v.id} onClick={()=>setFormData({...formData, client_nom:v.client_nom, client_tel:v.client_tel, nom:'', product_id:''})||setModalType('vente')||setIsModalOpen(true)} style={{cursor:'pointer'}}><td><span className={`badge ${v.est_paye?'badge-success':'badge-danger'}`} style={{marginBottom:4, display:'inline-block'}}>{v.est_paye?'Payé':'Crédit'}</span> <br/><b>{v.client_nom || 'Client'}</b></td><td>{v.nom} ({v.quantite})</td><td>{v.prix*v.quantite} DA</td><td onClick={e=>e.stopPropagation()}><button className="icon-btn" onClick={()=>generateInvoice(v)}><Printer size={18}/></button></td></tr>)}</tbody></table></div>}
        {activeTab==='chat' && <div className="glass-container chat-tab animate-enter" style={{padding:0}}><div className="chat-container"><div className="chat-messages">{messages.map((m,i)=><div key={i} className={`message ${m.sender} ${m.is_bot?'bot':''}`}>{m.content}</div>)}<div ref={chatEndRef}/></div><div className="chat-input-area"><input className="form-control" value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSendMessage()} placeholder="Une question ?" /><button className="btn-primary" style={{width:'auto'}} onClick={handleSendMessage}><Send size={18}/></button></div></div></div>}
      </main>
      {isModalOpen && (
        <div className="modal-overlay" onClick={()=>setIsModalOpen(false)}>
           <div className="modal-content animate-enter" onClick={e=>e.stopPropagation()}>
              <div className="modal-header"><h3>{modalType.toUpperCase()}</h3><button className="modal-close-btn" onClick={()=>setIsModalOpen(false)}><X size={20}/></button></div>
              <form onSubmit={handleSubmit}>
                 <div className="form-group"><label>Désignation</label><input className="form-control" value={formData.nom} required onChange={e=>setFormData({...formData, nom:e.target.value})} placeholder="Article.." /></div>
                 {modalType === 'vente' && (
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
                       <div className="form-group"><label>Client</label><input className="form-control" value={formData.client_nom} onChange={e=>setFormData({...formData, client_nom:e.target.value})} placeholder="Nom" /></div>
                       <div className="form-group"><label>Tél</label><input className="form-control" value={formData.client_tel} onChange={e=>setFormData({...formData, client_tel:e.target.value})} placeholder="06.." /></div>
                       <div className="form-group" style={{gridColumn:'span 2', display:'flex', alignItems:'center', gap:10}}><label style={{margin:0, cursor:'pointer'}}>Payé cash?</label><input type="checkbox" checked={formData.est_paye} onChange={e=>setFormData({...formData, est_paye:e.target.checked})} style={{width:22, height:22, cursor:'pointer'}} /></div>
                    </div>
                 )}
                 {modalType !== 'product' && (
                    <div className="form-group" style={{background:'rgba(79,70,229,0.05)', padding:12, borderRadius:12}}><label>Lier au Stock</label><select className="form-control" value={formData.product_id} onChange={e=>{const p=products.find(x=>x.id===e.target.value); if(p) setFormData({...formData, product_id:p.id, nom:p.nom, prix:p.prix_unitaire*1.2}); else setFormData({...formData, product_id:e.target.value})}}><option value="">--- Sélectionner ---</option>{products.map(p=><option key={p.id} value={p.id}>{p.nom} ({p.stock_qty} en stock)</option>)}</select></div>
                 )}
                 <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
                   <div className="form-group"><label>Prix (DA)</label><input type="number" step="0.01" className="form-control" value={formData.prix} required onChange={e=>setFormData({...formData, prix:e.target.value})} /></div>
                   <div className="form-group"><label>Quantité</label><input type="number" className="form-control" value={formData.quantite} required onChange={e=>setFormData({...formData, quantite:e.target.value})} /></div>
                 </div>
                 <button type="submit" className="btn-primary" style={{width:'100%', marginTop:15}} disabled={isSubmitting}>{isSubmitting?'...':'Enregistrer'}</button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
