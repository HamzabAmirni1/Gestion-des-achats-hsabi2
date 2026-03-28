import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, ShoppingCart, TrendingDown, Package, 
  Download, Moon, Sun, RefreshCw, LogOut, Send, X, Plus, FileText, Printer
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
    doc.setFontSize(22); doc.text('FACTURE - BRASTI platform', 20, 30);
    doc.setFontSize(12); doc.text(`Date: ${v.date || format(new Date(), 'dd/MM/yyyy')}`, 20, 45);
    doc.text(`ID Facture: ${v.id.slice(0,8)}`, 20, 52);
    doc.setFontSize(14); doc.text('INFORMATIONS CLIENT:', 20, 70);
    doc.setFontSize(12); doc.text(`Nom: ${v.client_nom || 'Client Anonyme'}`, 20, 80);
    doc.text(`Tél: ${v.client_tel || '-'}`, 20, 87);
    doc.line(20, 100, 190, 100);
    doc.text('PRODUIT', 20, 110); doc.text('QTÉ', 100, 110); doc.text('PRIX UN.', 130, 110); doc.text('TOTAL', 165, 110);
    doc.line(20, 115, 190, 115);
    doc.text(v.nom, 20, 125); doc.text(v.quantite.toString(), 100, 125); doc.text(`${v.prix} DA`, 130, 125); doc.text(`${v.prix * v.quantite} DA`, 165, 125);
    doc.setFontSize(16); doc.text(`NET À PAYER: ${v.prix * v.quantite} DA`, 120, 150);
    doc.setFontSize(10); doc.text('État: ' + (v.est_paye ? 'PAYÉ CASH' : 'À PAYER (CRÉDIT)'), 20, 150);
    doc.text('Merci pour votre confiance !', 20, 200);
    doc.save(`Facture_${v.client_nom || 'Client'}_${v.id.slice(0,5)}.pdf`);
  };

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
      const { error } = await supabase.from(table).insert([item]);
      if(error) throw error;
      await fetchData();
      setIsModalOpen(false);
      Swal.fire({ icon: 'success', title: 'Enregistré !', timer: 1000, showConfirmButton: false });
    } catch (err) { Swal.fire('Erreur', 'Contactez le support (Table/Schema error)', 'error'); } finally { setIsSubmitting(false); }
  };

  const handleQuickVenteForClient = (v) => {
    setFormData({ ...formData, client_nom: v.client_nom, client_tel: v.client_tel, est_paye: true, nom: '', product_id: '' });
    setModalType('vente');
    setIsModalOpen(true);
  };

  const handleSendMessage = async () => {
    if(!chatInput.trim()) return;
    const content = chatInput;
    setChatInput('');
    const { data } = await supabase.from('messages').insert([{ user_id: session.user.id, sender: 'customer', content }]).select();
    if(data) {
      setMessages(p => [...p, data[0]]);
      try {
        const stats = `Stats: Sales=${totalVentes}DA, Profit=${beneficeReel}DA.`;
        const res = await fetch(`https://luminai.my.id/`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, prompt: `${stats} Répond court.` })
        });
        const d = await res.json();
        const botMsg = { user_id: session.user.id, sender: 'admin', content: d.result || d.response || "Compris.", is_bot: true };
        await supabase.from('messages').insert([botMsg]).select();
        fetchData();
      } catch (err) { console.error(err); }
    }
  };

  if (!session) return (
    <div className="auth-page"><div className="auth-card-premium animate-enter"><h1 className="auth-title">Brasti</h1><button onClick={()=>supabase.auth.signInWithOAuth({provider:'google'})} className="btn-google-auth">Gmail Account</button></div></div>
  );

  return (
    <div className="app-wrapper">
      <header className="header" id="header-el">
        <div className="header-title">Brasti platform</div>
        <div className="header-actions">
           <button className="icon-btn" onClick={fetchData}><RefreshCw size={18}/></button>
           <button className="icon-btn" onClick={()=>{const input=document.getElementById('app-main-content'); htmlToImage.toJpeg(input).then(it=>{const p=new jsPDF('l','mm','a4'); p.addImage(it,'JPEG',0,0,297,210); p.save('Rapport.pdf')})}}><Download size={18}/></button>
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
               <div className="stat-card" style={{borderLeft:'5px solid #10b981'}}><div className="stat-value">{beneficeReel.toFixed(0)} DA</div><div className="stat-label">Profit</div></div>
               <div className="stat-card" style={{borderLeft:'5px solid #ef4444'}}><div className="stat-value">{totalDettes} DA</div><div className="stat-label">Non Payés</div></div>
               <div className="stat-card" style={{borderLeft:'5px solid #4f46e5'}}><div className="stat-value">{totalVentes} DA</div><div className="stat-label">Ventes</div></div>
            </div>
            <div className="glass-container" style={{height:300}}><Line options={{maintainAspectRatio:false}} data={{labels:['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'], datasets:[{label:'Gain (DA)', data:[0,0,0,0,0,0,beneficeReel], borderColor:'#10b981', fill:true, tension:0.4}]}} /></div>
          </div>
        )}
        {activeTab==='stock' && (
          <div className="animate-enter">
            <div className="section-header"><h3>Inventaire</h3><button className="btn-primary" onClick={()=>{setFormData({nom:'', quantite:1, prix:1, product_id:'', est_paye:true}); setModalType('product'); setIsModalOpen(true)}}>+ Nouveau</button></div>
            <div className="products-grid">{products.map(p=>(
                <div key={p.id} className="product-card" onClick={()=>{setFormData({...formData, product_id:p.id, nom:p.nom, prix:p.prix_unitaire*1.2, est_paye:true}); setModalType('vente'); setIsModalOpen(true)}} style={{cursor:'pointer'}}>
                   <div style={{display:'flex', justify:'space-between'}}><b>{p.nom}</b><span className="badge badge-success">{p.stock_qty} Qté</span></div>
                   <div style={{marginTop:10, fontSize:'0.9rem', color:'var(--primary)'}}>Cost: {p.prix_unitaire} DA</div>
                </div>
              ))}</div>
          </div>
        )}
        {activeTab==='ventes' && <div className="glass-container animate-enter"><div className="section-header"><h3>Historique</h3><button className="btn-primary" onClick={()=>{setModalType('vente'); setIsModalOpen(true)}}>+ Nouvelle</button></div><table className="data-table"><thead><tr><th>Client (Revendre)</th><th>Produit</th><th>Total</th><th>Action</th></tr></thead><tbody>{ventes.map(v=><tr key={v.id} onClick={()=>handleQuickVenteForClient(v)} style={{cursor:'pointer'}} title="Cliquer pour re-vendre à ce client"><td><span className={`badge ${v.est_paye?'badge-success':'badge-danger'}`} style={{marginBottom:5, display:'inline-block'}}>{v.est_paye?'Payé':'Crédit'}</span><br/><b>{v.client_nom || 'Client'}</b><br/><small>{v.client_tel}</small></td><td>{v.nom} ({v.quantite})</td><td>{v.prix*v.quantite} DA</td><td onClick={e=>e.stopPropagation()}><button className="icon-btn" onClick={()=>generateInvoice(v)} title="Télécharger Facture PDF"><Printer size={18}/></button></td></tr>)}</tbody></table></div>}
        {activeTab==='chat' && <div className="glass-container chat-tab animate-enter" style={{padding:0}}><div className="chat-container"><div className="chat-messages">{messages.map((m,i)=><div key={i} className={`message ${m.sender} ${m.is_bot?'bot':''}`}>{m.content}</div>)}<div ref={chatEndRef}/></div><div className="chat-input-area"><input className="form-control" value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSendMessage()} placeholder="Taper ici..." /><button className="btn-primary" onClick={handleSendMessage}><Send size={18}/></button></div></div></div>}
      </main>
      {isModalOpen && (
        <div className="modal-overlay" onClick={()=>setIsModalOpen(false)}>
           <div className="modal-content" onClick={e=>e.stopPropagation()}>
              <div className="modal-header"><h3>{modalType}</h3><button onClick={()=>setIsModalOpen(false)}><X size={20}/></button></div>
              <form onSubmit={handleSubmit}>
                 <div className="form-group"><label>Désignation</label><input className="form-control" value={formData.nom} required onChange={e=>setFormData({...formData, nom:e.target.value})} /></div>
                 {modalType === 'vente' && (
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
                       <div className="form-group"><label>Nom Client</label><input className="form-control" value={formData.client_nom} placeholder="Nom" onChange={e=>setFormData({...formData, client_nom:e.target.value})} /></div>
                       <div className="form-group"><label>Téléphone</label><input className="form-control" value={formData.client_tel} placeholder="06.." onChange={e=>setFormData({...formData, client_tel:e.target.value})} /></div>
                       <div className="form-group" style={{gridColumn:'span 2', display:'flex', alignItems:'center', gap:10}}><label style={{margin:0}}>Payé?</label><input type="checkbox" checked={formData.est_paye} onChange={e=>setFormData({...formData, est_paye:e.target.checked})} style={{width:20, height:20}} /></div>
                    </div>
                 )}
                 {modalType !== 'product' && (
                    <div className="form-group" style={{background:'rgba(255,255,0,0.05)', padding:8}}><label>Lier au Stock</label><select className="form-control" value={formData.product_id} onChange={e=>{const p=products.find(x=>x.id===e.target.value); if(p) setFormData({...formData, product_id:p.id, nom:p.nom, prix:p.prix_unitaire*1.2}); else setFormData({...formData, product_id:e.target.value})}}><option value="">--- Sélectionner ---</option>{products.map(p=><option key={p.id} value={p.id}>{p.nom} (Stock: {p.stock_qty})</option>)}</select></div>
                 )}
                 <div className="form-group"><label>Prix Unitaire</label><input type="number" step="0.01" className="form-control" value={formData.prix} required onChange={e=>setFormData({...formData, prix:e.target.value})} /></div>
                 <div className="form-group"><label>Quantité</label><input type="number" className="form-control" value={formData.quantite} required onChange={e=>setFormData({...formData, quantite:e.target.value})} /></div>
                 <button type="submit" className="btn-primary" style={{width:'100%', marginTop:10}} disabled={isSubmitting}>{isSubmitting?'...':'Enregistrer'}</button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
