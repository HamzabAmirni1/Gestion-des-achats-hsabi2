import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, ShoppingCart, TrendingDown, Package, 
  Plus, Search, Download, Moon, Sun, Trash2, RefreshCw,
  LogOut, User, Smartphone, MessageSquare, Send, X, Filter, BarChart3, Phone
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
  const [formData, setFormData] = useState({ nom: '', quantite: 1, prix: 1, product_id: '', client_nom: '', client_tel: '' });
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let table = modalType==='product'?'products':(modalType==='achat'?'achats':'ventes');
      let item = { user_id: session.user.id, nom: formData.nom };
      
      if(modalType === 'product') {
        item.prix_unitaire = parseFloat(formData.prix);
        item.stock_qty = parseFloat(formData.quantite);
      } else {
        item.prix = parseFloat(formData.prix);
        item.quantite = parseFloat(formData.quantite);
        item.product_id = formData.product_id || null;
        item.date = format(new Date(), 'yyyy-MM-dd');
        if(modalType === 'vente') {
           item.client_nom = formData.client_nom;
           item.client_tel = formData.client_tel;
        }
      }

      await supabase.from(table).insert([item]);
      await fetchData();
      setIsModalOpen(false);
      Swal.fire({ icon: 'success', title: 'Enregistré avec succès !', timer: 1000, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Erreur', err.message, 'error');
    } finally { setIsSubmitting(false); }
  };

  const handleQuickVente = (prod) => {
    setFormData({ ...formData, product_id: prod.id, nom: prod.nom, prix: prod.prix_unitaire, quantite: 1 });
    setModalType('vente');
    setIsModalOpen(true);
  };

  return (
    <div className="app-wrapper">
      <header className="header">
        <div className="header-title">Brasti platform</div>
        <div className="header-actions">
           <button className="icon-btn" onClick={fetchData}><RefreshCw size={18}/></button>
           <button className="icon-btn" onClick={()=>{const input=document.getElementById('app-main-content'); htmlToImage.toJpeg(input).then(it=>{const p=new jsPDF('l','mm','a4'); p.addImage(it,'JPEG',0,0,297,210); p.save('Brasti_Report.pdf')})}}><Download size={18}/></button>
           <button className="icon-btn" onClick={()=>setTheme(theme==='light'?'dark':'light')}><Moon size={18}/></button>
           <button className="icon-btn" onClick={()=>supabase.auth.signOut()}><LogOut size={18}/></button>
        </div>
      </header>
      <nav className="nav-tabs">
        <button className={`nav-tab ${activeTab==='dashboard'?'active':''}`} onClick={()=>setActiveTab('dashboard')}>Dashboard</button>
        <button className={`nav-tab ${activeTab==='stock'?'active':''}`} onClick={()=>setActiveTab('stock')}>Stock</button>
        <button className={`nav-tab ${activeTab==='ventes'?'active':''}`} onClick={()=>setActiveTab('ventes')}>Ventes</button>
        <button className={`nav-tab ${activeTab==='chat'?'active':''}`} onClick={()=>setActiveTab('chat')}>AI Support</button>
      </nav>
      <main id="app-main-content">
        {activeTab==='dashboard' && (
          <div className="animate-enter">
            <div className="stats-grid">
               <div className="stat-card" style={{borderLeft:'5px solid #10b981'}}><div className="stat-value">{benefice} DA</div><div className="stat-label">Bénéfice</div></div>
               <div className="stat-card" style={{borderLeft:'5px solid #4f46e5'}}><div className="stat-value">{totalVentes} DA</div><div className="stat-label">Ventes</div></div>
               <div className="stat-card" style={{borderLeft:'5px solid #ef4444'}}><div className="stat-value">{totalAchats} DA</div><div className="stat-label">Achats</div></div>
            </div>
            <div className="glass-container" style={{height:'350px'}}><Line options={{maintainAspectRatio:false}} data={{labels:['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'], datasets:[{label:'Ventes (DA)', data:[0,0,0,0,0,0,totalVentes], borderColor:'#4f46e5', fill:true, tension:0.4}]}} /></div>
          </div>
        )}
        {activeTab==='stock' && (
          <div className="animate-enter">
            <div className="section-header"><h3>Stock & Matériel</h3><button className="btn-primary" onClick={()=>{setFormData({nom:'', quantite:1, prix:1, product_id:''}); setModalType('product'); setIsModalOpen(true)}}><Plus size={18}/> Nouveau</button></div>
            <div className="products-grid">{products.map(p=>(
                <div key={p.id} className="product-card" onClick={()=>handleQuickVente(p)} style={{cursor:'pointer', border:'1px solid transparent'}} onMouseEnter={e=>e.currentTarget.style.borderColor='var(--primary)'} onMouseLeave={e=>e.currentTarget.style.borderColor='transparent'}>
                   <div style={{display:'flex', justifyContent:'space-between'}}><b>{p.nom}</b><span className="badge badge-success">{p.stock_qty} Qté</span></div>
                   <div style={{marginTop:'10px', fontSize:'0.9rem', color:'var(--primary)', fontWeight:'800'}}>{p.prix_unitaire} DA / U</div>
                   <button className="btn-auth-submit" style={{padding:'8px', fontSize:'0.8rem', marginTop:'10px'}}>+ Vendre rapide</button>
                </div>
              ))}</div>
          </div>
        )}
        {activeTab==='ventes' && <div className="glass-container animate-enter"><div className="section-header"><h3>Historique Ventes</h3><button className="btn-primary" onClick={()=>{setModalType('vente'); setIsModalOpen(true)}}>+ Nouvelle</button></div><table className="data-table"><thead><tr><th>Client</th><th>Nom</th><th>Qté</th><th>Total</th></tr></thead><tbody>{ventes.map(v=><tr key={v.id}><td><b>{v.client_nom || '-'}</b><br/><small>{v.client_tel}</small></td><td>{v.nom}</td><td>{v.quantite}</td><td>{v.prix*v.quantite} DA</td></tr>)}</tbody></table></div>}
        {activeTab==='chat' && <div className="glass-container chat-tab animate-enter"><div className="chat-container"><div className="chat-messages">{messages.map((m,i)=><div key={i} className={`message ${m.sender} ${m.is_bot?'bot':''}`}>{m.content}</div>)}<div ref={chatEndRef}/></div><div className="chat-input-area"><input className="form-control" value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&(async()=>{const c=chatInput; setChatInput(''); const {data}=await supabase.from('messages').insert([{user_id:session.user.id, sender:'customer', content:c}]); if(data)setMessages([...messages,data[0]])})()} placeholder="Besoin d'aide ?" /><button className="btn-primary" onClick={()=>{}}><Send size={18}/></button></div></div></div>}
      </main>
      {isModalOpen && (
        <div className="modal-overlay" onClick={()=>setIsModalOpen(false)}>
           <div className="modal-content" onClick={e=>e.stopPropagation()}>
              <div className="modal-header"><h3>{modalType}</h3><button onClick={()=>setIsModalOpen(false)}><X size={20}/></button></div>
              <form onSubmit={handleSubmit}>
                 <div className="form-group"><label>Désignation / Nom</label><input className="form-control" value={formData.nom} required onChange={e=>setFormData({...formData, nom:e.target.value})} /></div>
                 {modalType === 'vente' && (
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
                       <div className="form-group"><label>Nom Client</label><input className="form-control" value={formData.client_nom} placeholder="Optionnel" onChange={e=>setFormData({...formData, client_nom:e.target.value})} /></div>
                       <div className="form-group"><label>Téléphone Client</label><input className="form-control" value={formData.client_tel} placeholder="05/06..." onChange={e=>setFormData({...formData, client_tel:e.target.value})} /></div>
                    </div>
                 )}
                 {modalType !== 'product' && (
                    <div className="form-group" style={{background:'rgba(255,255,0,0.05)', padding:'8px'}}><label>Mise à jour Stock</label><select className="form-control" value={formData.product_id} onChange={e=>{const p=products.find(x=>x.id===e.target.value); if(p) setFormData({...formData, product_id:p.id, nom:p.nom, prix:p.prix_unitaire}); else setFormData({...formData, product_id:e.target.value})}}><option value="">--- Sélectionner ---</option>{products.map(p=><option key={p.id} value={p.id}>{p.nom} (Stock: {p.stock_qty})</option>)}</select></div>
                 )}
                 <div className="form-group"><label>Prix (DA)</label><input type="number" step="0.01" className="form-control" value={formData.prix} required onChange={e=>setFormData({...formData, prix:e.target.value})} /></div>
                 <div className="form-group"><label>Quantité</label><input type="number" className="form-control" value={formData.quantite} required onChange={e=>setFormData({...formData, quantite:e.target.value})} /></div>
                 <button type="submit" className="btn-primary" style={{width:'100%', marginTop:'10px'}} disabled={isSubmitting}>{isSubmitting?'Traitement...':'Enregistrer'}</button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
