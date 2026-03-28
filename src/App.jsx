import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, ShoppingCart, TrendingDown, Package, 
  Plus, Search, Download, Moon, Sun, Trash2, RefreshCw,
  LogOut, User, Smartphone, MessageSquare, Send, X, Filter, BarChart3, Phone, Briefcase, AlertCircle
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
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const totalVentes = useMemo(() => ventes.reduce((a, c) => a + (c.prix * c.quantite), 0), [ventes]);
  const totalAchats = useMemo(() => achats.reduce((a, c) => a + (c.prix * c.quantite), 0), [achats]);
  const totalDettes = useMemo(() => ventes.filter(v => !v.est_paye).reduce((a, c) => a + (c.prix * c.quantite), 0), [ventes]);
  
  // Profit per-product estimation (ignoring unsold stock)
  const beneficeReel = useMemo(() => {
     return ventes.reduce((total, v) => {
       const product = products.find(p => p.id === v.product_id);
       const unitCost = product ? (product.prix_unitaire || 0) : 0;
       const profitOnSale = (v.prix - unitCost) * v.quantite;
       return total + profitOnSale;
     }, 0);
  }, [ventes, products]);

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
           item.est_paye = formData.est_paye;
        }
      }

      await supabase.from(table).insert([item]);
      await fetchData();
      setIsModalOpen(false);
      Swal.fire({ icon: 'success', title: 'Action enregistrée !', timer: 1000, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Erreur', err.message, 'error');
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="app-wrapper">
      <header className="header" id="header-el">
        <div className="header-title">Brasti platform</div>
        <div className="header-actions">
           <button className="icon-btn" onClick={fetchData}><RefreshCw size={18}/></button>
           <button className="icon-btn" onClick={()=>{const input=document.getElementById('app-main-content'); htmlToImage.toJpeg(input).then(it=>{const p=new jsPDF('l','mm','a4'); p.addImage(it,'JPEG',0,0,297,210); p.save('Brasti_Rapport.pdf')})}}><Download size={18}/></button>
           <button className="icon-btn" onClick={()=>setTheme(theme==='light'?'dark':'light')}><Sun size={18}/></button>
           <button className="icon-btn" onClick={()=>supabase.auth.signOut()}><LogOut size={18}/></button>
        </div>
      </header>
      <nav className="nav-tabs">
        <button className={`nav-tab ${activeTab==='dashboard'?'active':''}`} onClick={()=>setActiveTab('dashboard')}>Dashboard</button>
        <button className={`nav-tab ${activeTab==='stock'?'active':''}`} onClick={()=>setActiveTab('stock')}>Stock</button>
        <button className={`nav-tab ${activeTab==='ventes'?'active':''}`} onClick={()=>setActiveTab('ventes')}>Ventes</button>
        <button className={`nav-tab ${activeTab==='chat'?'active':''}`} onClick={()=>setActiveTab('chat')}>AI</button>
      </nav>
      <main id="app-main-content">
        {activeTab==='dashboard' && (
          <div className="animate-enter">
            <div className="stats-grid">
               <div className="stat-card" style={{borderLeft:'5px solid #10b981'}}><div className="stat-value">{beneficeReel} DA</div><div className="stat-label">Bénéfice (Profit)</div></div>
               <div className="stat-card" style={{borderLeft:'5px solid #ef4444'}}><div className="stat-value">{totalDettes} DA</div><div className="stat-label">Non Payés (Crédit)</div></div>
               <div className="stat-card" style={{borderLeft:'5px solid #4f46e5'}}><div className="stat-value">{totalVentes} DA</div><div className="stat-label">Total Ventes</div></div>
               <div className="stat-card" style={{borderLeft:'3px solid #64748b'}}><div className="stat-value" style={{fontSize:'1.5rem'}}>{totalAchats} DA</div><div className="stat-label">Stock Initial (Achat)</div></div>
            </div>
            <div className="glass-container" style={{height:'350px'}}><Line options={{maintainAspectRatio:false}} data={{labels:['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'], datasets:[{label:'Progression Gain (DA)', data:[0,0,0,0,0,0,beneficeReel], borderColor:'#10b981', fill:true, tension:0.4}]}} /></div>
          </div>
        )}
        {activeTab==='stock' && (
          <div className="animate-enter">
            <div className="section-header"><h3>Stock de Production</h3><button className="btn-primary" onClick={()=>{setFormData({nom:'', quantite:1, prix:1, product_id:'', est_paye:true}); setModalType('product'); setIsModalOpen(true)}}>+ Nouveau</button></div>
            <div className="products-grid">{products.map(p=>(
                <div key={p.id} className="product-card" onClick={()=>{setFormData({...formData, product_id:p.id, nom:p.nom, prix:p.prix_unitaire*1.2, est_paye:true}); setModalType('vente'); setIsModalOpen(true)}} style={{cursor:'pointer'}}>
                   <div style={{display:'flex', justifyContent:'space-between'}}><b>{p.nom}</b><span className="badge badge-success">{p.stock_qty} Qté</span></div>
                   <div style={{marginTop:'10px', fontSize:'0.9rem', color:'var(--primary)'}}>Cost: {p.prix_unitaire} DA</div>
                </div>
              ))}</div>
          </div>
        )}
        {activeTab==='ventes' && <div className="glass-container animate-enter"><div className="section-header"><h3>Historique Ventes</h3><button className="btn-primary" onClick={()=>{setModalType('vente'); setIsModalOpen(true)}}>+ Nouvelle</button></div><table className="data-table"><thead><tr><th>Client/Statut</th><th>Désignation</th><th>Total</th></tr></thead><tbody>{ventes.map(v=><tr key={v.id}><td><b>{v.client_nom || '-'}</b><br/><span className={`badge ${v.est_paye?'badge-success':'badge-danger'}`}>{v.est_paye?'Payé':'Crédit'}</span></td><td>{v.nom} <small>({v.quantite})</small></td><td>{v.prix*v.quantite} DA</td></tr>)}</tbody></table></div>}
        {activeTab==='chat' && <div className="glass-container chat-tab animate-enter"><div className="chat-container"><div className="chat-messages">{messages.map((m,i)=><div key={i} className={`message ${m.sender} ${m.is_bot?'bot':''}`}>{m.content}</div>)}<div ref={chatEndRef}/></div><div className="chat-input-area"><input className="form-control" value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&(async()=>{const c=chatInput; setChatInput(''); const {data}=await supabase.from('messages').insert([{user_id:session.user.id, sender:'customer', content:c}]); if(data)setMessages([...messages,data[0]])})()} placeholder="Analyser mes ventes ?" /><button className="btn-primary" onClick={()=>{}}><Send size={18}/></button></div></div></div>}
      </nav>
      {isModalOpen && (
        <div className="modal-overlay" onClick={()=>setIsModalOpen(false)}>
           <div className="modal-content" onClick={e=>e.stopPropagation()}>
              <div className="modal-header"><h3>{modalType==='product'?'Produit':(modalType==='achat'?'Achat':'Vente')}</h3><button onClick={()=>setIsModalOpen(false)}><X size={20}/></button></div>
              <form onSubmit={handleSubmit}>
                 <div className="form-group"><label>Nom / Désignation</label><input className="form-control" value={formData.nom} required onChange={e=>setFormData({...formData, nom:e.target.value})} /></div>
                 {modalType === 'vente' && (
                    <>
                       <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
                          <div className="form-group"><label>Nom Client</label><input className="form-control" value={formData.client_nom} placeholder="Optionnel" onChange={e=>setFormData({...formData, client_nom:e.target.value})} /></div>
                          <div className="form-group"><label>Téléphone</label><input className="form-control" value={formData.client_tel} placeholder="05/06..." onChange={e=>setFormData({...formData, client_tel:e.target.value})} /></div>
                       </div>
                       <div className="form-group" style={{display:'flex', alignItems:'center', gap:'10px', background:'rgba(0,0,0,0.03)', padding:'10px', borderRadius:'10px'}}>
                          <label style={{margin:0}}>Est-ce payé ?</label>
                          <input type="checkbox" checked={formData.est_paye} onChange={e=>setFormData({...formData, est_paye:e.target.checked})} style={{width:20, height:20}} />
                          <span style={{fontSize:'0.85rem'}}>{formData.est_paye ? 'Oui, payé cash' : 'Non, crédit client'}</span>
                       </div>
                    </>
                 )}
                 {modalType !== 'product' && (
                    <div className="form-group" style={{background:'rgba(255,255,0,0.05)', padding:'8px'}}><label>Lier au Stock</label><select className="form-control" value={formData.product_id} onChange={e=>{const p=products.find(x=>x.id===e.target.value); if(p) setFormData({...formData, product_id:p.id, nom:p.nom, prix:p.prix_unitaire*1.2}); else setFormData({...formData, product_id:e.target.value})}}><option value="">--- Sélectionner ---</option>{products.map(p=><option key={p.id} value={p.id}>{p.nom} (Stock: {p.stock_qty})</option>)}</select></div>
                 )}
                 <div className="form-group"><label>Prix Unitaire (DA)</label><input type="number" step="0.01" className="form-control" value={formData.prix} required onChange={e=>setFormData({...formData, prix:e.target.value})} /></div>
                 <div className="form-group"><label>Quantité</label><input type="number" className="form-control" value={formData.quantite} required onChange={e=>setFormData({...formData, quantite:e.target.value})} /></div>
                 <button type="submit" className="btn-primary" style={{width:'100%', marginTop:'10px'}} disabled={isSubmitting}>{isSubmitting?'...':'Enregistrer'}</button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
