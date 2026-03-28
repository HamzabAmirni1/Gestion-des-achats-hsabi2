import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, ShoppingCart, TrendingDown, Package, 
  Plus, Search, Download, Moon, Sun, Trash2, RefreshCw,
  LogOut, User, Smartphone, MessageSquare, Send, X, Filter, ChevronRight, Layers, BarChart3
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
  const [formData, setFormData] = useState({ nom: '', quantite: 1, prix: 0, product_id: '' });

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
    Swal.fire({ title: 'Génération du rapport...', didOpen: () => Swal.showLoading() });
    try {
      const img = await htmlToImage.toJpeg(input, { quality: 0.95, backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc' });
      const pdf = new jsPDF('l', 'mm', 'a4');
      const w = pdf.internal.pageSize.getWidth();
      const h = (pdf.getImageProperties(img).height * w) / pdf.getImageProperties(img).width;
      pdf.addImage(img, 'JPEG', 0, 0, w, h);
      pdf.save(`Rapport_Brasti_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
      Swal.fire('Succès', 'Votre rapport PDF est prêt !', 'success');
    } catch (e) { Swal.fire('Erreur', e.message, 'error'); }
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) setAuthError(error.message);
  };

  if (!session) return (
    <div className="auth-page">
      <div className="auth-card-premium animate-enter">
        <h1 className="auth-title">Brasti platform</h1>
        <p>Production مواد التنظيف - Gestion Pro</p>
        <form className="auth-form-p" onSubmit={async (e)=>{e.preventDefault(); setAuthLoading(true); let r = authMode==='login' ? await supabase.auth.signInWithPassword({email:authEmail, password:authPassword}) : await supabase.auth.signUp({email:authEmail, password:authPassword}); if(r.error) setAuthError(r.error.message); setAuthLoading(false);}}>
           <div className="input-group"><label>Email</label><input type="email" required onChange={e=>setAuthEmail(e.target.value)} /></div>
           <div className="input-group"><label>Mot de passe</label><input type="password" required onChange={e=>setAuthPassword(e.target.value)} /></div>
           {authError && <div className="auth-error">{authError}</div>}
           <button className="btn-auth-submit" disabled={authLoading}>{authLoading?'Chargement...':(authMode==='login'?'Se Connecter':'S\'inscrire')}</button>
           <div className="auth-divider"><span>OU</span></div>
           <button type="button" className="btn-google-auth" onClick={signInWithGoogle}>Continuer avec Gmail</button>
           <button type="button" className="auth-mode-switch" onClick={()=>setAuthMode(authMode==='login'?'reg':'login')}>{authMode==='login'?'Créer un compte GRATUIT':'Déjà inscrit ? Connectez-vous'}</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="app-wrapper" id="app-main-content">
      <header className="header">
        <div className="header-title">Brasti Business</div>
        <div className="header-actions">
          <button className="icon-btn" onClick={fetchData} title="Rafraîchir"><RefreshCw size={18}/></button>
          <button className="icon-btn" onClick={handleDownloadPDF} title="Télécharger PDF"><Download size={18}/></button>
          <button className="icon-btn" onClick={()=>setTheme(theme==='light'?'dark':'light')}><Sun size={18} /></button>
          <button className="icon-btn" onClick={()=>supabase.auth.signOut()}><LogOut size={18}/></button>
        </div>
      </header>

      <nav className="nav-tabs">
        <button className={`nav-tab ${activeTab==='dashboard'?'active':''}`} onClick={()=>setActiveTab('dashboard')}><LayoutDashboard size={18}/> Dashboard</button>
        <button className={`nav-tab ${activeTab==='stock'?'active':''}`} onClick={()=>setActiveTab('stock')}><Package size={18}/> Stock</button>
        <button className={`nav-tab ${activeTab==='ventes'?'active':''}`} onClick={()=>setActiveTab('ventes')}><TrendingDown size={18}/> Ventes</button>
        <button className={`nav-tab ${activeTab==='achats'?'active':''}`} onClick={()=>setActiveTab('achats')}><ShoppingCart size={18}/> Achats</button>
      </nav>

      <main>
        {activeTab === 'dashboard' && (
          <div className="animate-enter">
            <div className="stats-grid">
              <div className="stat-card" style={{borderLeft:'6px solid #10b981'}}><div className="stat-value">{benefice} DA</div><div className="stat-label">Bénéfice Net</div></div>
              <div className="stat-card" style={{borderLeft:'6px solid #4f46e5'}}><div className="stat-value">{totalVentes} DA</div><div className="stat-label">Chiffre d'Affaires</div></div>
              <div className="stat-card" style={{borderLeft:'6px solid #ef4444'}}><div className="stat-value">{totalAchats} DA</div><div className="stat-label">Dépenses Totales</div></div>
              <div className="stat-card" style={{borderLeft:'6px solid #f59e0b'}}><div className="stat-value">{products.length}</div><div className="stat-label">Produits Gérés</div></div>
            </div>
            <div className="glass-container">
               <div className="section-header"><h3>Activité de la semaine</h3></div>
               <div style={{height:'300px'}}><Line data={{labels:['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'], datasets:[{label:'Ventes (DA)', data:[0,0,0,0,0,0,totalVentes], borderColor:'#4f46e5', backgroundColor:'rgba(79, 70, 229, 0.1)', fill:true, tension:0.4}]}} options={{maintainAspectRatio:false}} /></div>
            </div>
          </div>
        )}

        {activeTab === 'stock' && (
          <div className="animate-enter">
            <div className="section-header"><h3>État du Stock</h3><button className="btn-primary" onClick={()=>{setModalType('product'); setIsModalOpen(true)}}><Plus size={18}/> Nouveau Produit</button></div>
            <div className="products-grid">
              {products.length === 0 ? <p className="empty-state">Aucun produit en stock.</p> : products.map(p=>(
                <div key={p.id} className="product-card">
                  <div className="product-header"><b>{p.nom}</b><span className={`badge ${p.stock_qty>10?'badge-success':'badge-danger'}`}>{p.stock_qty} en stock</span></div>
                  <div className="product-price">{p.prix_unitaire} DA / unité</div>
                  <p>{p.description || "Production Brasti"}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'ventes' && (
          <div className="glass-container animate-enter">
            <div className="section-header"><h3>Historique de Ventes</h3><button className="btn-primary" onClick={()=>{setModalType('vente'); setIsModalOpen(true)}}><Plus size={18}/> Nouveau Vente</button></div>
            <div style={{overflowX:'auto'}}><table className="data-table"><thead><tr><th>Date</th><th>Designation</th><th>Quantité</th><th>Total (DA)</th></tr></thead><tbody>{ventes.length===0?<tr><td colSpan="4" className="empty-state">Aucune vente enregistrée.</td></tr>:ventes.map(v=><tr key={v.id}><td>{v.date}</td><td>{v.nom}</td><td>{v.quantite}</td><td>{v.prix*v.quantite}</td></tr>)}</tbody></table></div>
          </div>
        )}

        {activeTab === 'achats' && (
          <div className="glass-container animate-enter">
            <div className="section-header"><h3>Historique d'Achats</h3><button className="btn-primary" onClick={()=>{setModalType('achat'); setIsModalOpen(true)}}><Plus size={18}/> Nouveau Achat</button></div>
            <div style={{overflowX:'auto'}}><table className="data-table"><thead><tr><th>Date</th><th>Matière</th><th>Quantité</th><th>Dépense (DA)</th></tr></thead><tbody>{achats.length===0?<tr><td colSpan="4" className="empty-state">Aucun achat enregistré.</td></tr>:achats.map(a=><tr key={a.id}><td>{a.date}</td><td>{a.nom}</td><td>{a.quantite}</td><td>{a.prix*a.quantite}</td></tr>)}</tbody></table></div>
          </div>
        )}
      </main>

      {isModalOpen && (
        <div className="modal-overlay" onClick={()=>setIsModalOpen(false)}>
          <div className="modal-content" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><h3>{modalType==='product'?'Nouveau Produit':(modalType==='achat'?'Nouvel Achat':'Nouvelle Vente')}</h3><button onClick={()=>setIsModalOpen(false)}><X size={24}/></button></div>
            <form onSubmit={async (e)=>{e.preventDefault(); setIsSubmitting(true); const table=modalType==='product'?'products':(modalType==='achat'?'achats':'ventes'); const item={user_id:session.user.id, nom:formData.nom, prix:parseFloat(formData.prix), quantite:parseFloat(formData.quantite), product_id:formData.product_id||null, date:format(new Date(),'yyyy-MM-dd')}; await supabase.from(table).insert([item]); fetchData(); setIsModalOpen(false); setIsSubmitting(false);}}>
               <div className="form-group"><label>Nom / Désignation</label><input className="form-control" required onChange={e=>setFormData({...formData, nom:e.target.value})} /></div>
               {modalType!=='product' && <div className="form-group"><label>Mise à jour Stock</label><select className="form-control" onChange={e=>setFormData({...formData, product_id:e.target.value})}><option value="">Ne pas lier au stock</option>{products.map(p=><option key={p.id} value={p.id}>{p.nom} (Actuel: {p.stock_qty})</option>)}</select></div>}
               <div className="form-group"><label>Prix Unitaire (DA)</label><input type="number" step="0.01" className="form-control" required onChange={e=>setFormData({...formData, prix:e.target.value})} /></div>
               <div className="form-group"><label>Quantité</label><input type="number" className="form-control" required onChange={e=>setFormData({...formData, quantite:e.target.value})} /></div>
               <div className="total-preview">Total automatiquement calculé : <b>{(parseFloat(formData.prix)||0)*(parseFloat(formData.quantite)||0)} DA</b></div>
               <button type="submit" className="btn-primary" style={{width:'100%', marginTop:'10px'}} disabled={isSubmitting}>{isSubmitting?'Traitement...':'Enregistrer dans la base'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
