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
    Swal.fire({ title: 'Rapport en cours...', didOpen: () => Swal.showLoading() });
    try {
      const img = await htmlToImage.toJpeg(input, { quality: 0.95 });
      const pdf = new jsPDF('l', 'mm', 'a4');
      pdf.addImage(img, 'JPEG', 0, 0, 297, 210);
      pdf.save(`Rapport_Brasti_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
      Swal.fire('OK', 'Rapport téléchargé', 'success');
    } catch (e) { Swal.fire('Erreur', e.message, 'error'); }
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) setAuthError(error.message);
  };

  if (!session) return (
    <div className="auth-page">
      <div className="auth-card-premium animate-enter">
        <h1 className="auth-title">Brasti Business</h1>
        <p style={{marginBottom:'25px'}}>Production مواد التنظيف</p>
        <form onSubmit={async (e)=>{e.preventDefault(); setAuthLoading(true); let r = authMode==='login' ? await supabase.auth.signInWithPassword({email:authEmail, password:authPassword}) : await supabase.auth.signUp({email:authEmail, password:authPassword}); if(r.error) setAuthError(r.error.message); setAuthLoading(false);}}>
           <div className="input-group"><label>Email</label><input type="email" placeholder="votre@email.com" required onChange={e=>setAuthEmail(e.target.value)} /></div>
           <div className="input-group"><label>Mot de passe</label><input type="password" placeholder="••••••••" required onChange={e=>setAuthPassword(e.target.value)} /></div>
           {authError && <div className="auth-error" style={{color:'red', marginBottom:'10px'}}>{authError}</div>}
           <button className="btn-auth-submit" disabled={authLoading}>{authLoading?'...':'Se Connecter'}</button>
           <div className="auth-divider"><span>OU</span></div>
           <button type="button" className="btn-google-auth" onClick={signInWithGoogle}>
             <svg width="18" height="18" viewBox="0 0 24 24" style={{marginRight:'10px'}}><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
             Continuer avec Gmail
           </button>
           <button type="button" className="auth-mode-switch" onClick={()=>setAuthMode(authMode==='login'?'reg':'login')}>{authMode==='login'?'Créer un compte':'Déjà inscrit ?'}</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="app-wrapper" id="app-main-content">
      <header className="header">
        <div className="header-title">Brasti Business</div>
        <div className="header-actions">
          <button className="icon-btn" onClick={fetchData}><RefreshCw size={18}/></button>
          <button className="icon-btn" onClick={handleDownloadPDF}><Download size={18}/></button>
          <button className="icon-btn" onClick={()=>setTheme(theme==='light'?'dark':'light')}><Moon size={18}/></button>
          <button className="icon-btn" onClick={()=>supabase.auth.signOut()}><LogOut size={18}/></button>
        </div>
      </header>
      <nav className="nav-tabs">
        <button className={`nav-tab ${activeTab==='dashboard'?'active':''}`} onClick={()=>setActiveTab('dashboard')}>Dashboard</button>
        <button className={`nav-tab ${activeTab==='stock'?'active':''}`} onClick={()=>setActiveTab('stock')}>Stock</button>
        <button className={`nav-tab ${activeTab==='ventes'?'active':''}`} onClick={()=>setActiveTab('ventes')}>Ventes</button>
        <button className={`nav-tab ${activeTab==='achats'?'active':''}`} onClick={()=>setActiveTab('achats')}>Achats</button>
      </nav>
      <main>
        {activeTab==='dashboard' && <div className="stats-grid animate-enter"><div className="stat-card" style={{borderLeft:'5px solid #10b981'}}><div className="stat-value">{benefice} DA</div><div className="stat-label">Bénéfice</div></div><div className="stat-card" style={{borderLeft:'5px solid #4f46e5'}}><div className="stat-value">{totalVentes} DA</div><div className="stat-label">Ventes</div></div><div className="stat-card" style={{borderLeft:'5px solid #ef4444'}}><div className="stat-value">{totalAchats} DA</div><div className="stat-label">Achats</div></div></div>}
        {activeTab==='stock' && <div className="animate-enter"><div className="section-header"><h3>Stock</h3><button className="btn-primary" onClick={()=>{setModalType('product');setIsModalOpen(true)}}>+ Nouveau</button></div><div className="products-grid">{products.map(p=><div key={p.id} className="product-card"><b>{p.nom}</b> - {p.stock_qty} en stock</div>)}</div></div>}
        {activeTab==='ventes' && <div className="glass-container animate-enter"><div className="section-header"><h3>Ventes</h3><button className="btn-primary" onClick={()=>{setModalType('vente');setIsModalOpen(true)}}>+ Vendre</button></div><table className="data-table"><thead><tr><th>Date</th><th>Nom</th><th>Quantité</th><th>Total</th></tr></thead><tbody>{ventes.map(v=><tr key={v.id}><td>{v.date}</td><td>{v.nom}</td><td>{v.quantite}</td><td>{v.prix*v.quantite} DA</td></tr>)}</tbody></table></div>}
        {activeTab==='achats' && <div className="glass-container animate-enter"><div className="section-header"><h3>Achats</h3><button className="btn-primary" onClick={()=>{setModalType('achat');setIsModalOpen(true)}}>+ Acheter</button></div><table className="data-table"><thead><tr><th>Date</th><th>Matière</th><th>Quantité</th><th>Dépense</th></tr></thead><tbody>{achats.map(a=><tr key={a.id}><td>{a.date}</td><td>{a.nom}</td><td>{a.quantite}</td><td>{a.prix*a.quantite} DA</td></tr>)}</tbody></table></div>}
      </main>
      {isModalOpen && (
        <div className="modal-overlay" onClick={()=>setIsModalOpen(false)}>
           <div className="modal-content" onClick={e=>e.stopPropagation()}>
              <div className="modal-header"><h3>{modalType}</h3><button onClick={()=>setIsModalOpen(false)}><X size={20}/></button></div>
              <form onSubmit={async (e)=>{e.preventDefault(); setIsSubmitting(true); const table=modalType==='product'?'products':(modalType==='achat'?'achats':'ventes'); const item={user_id:session.user.id, nom:formData.nom, prix:parseFloat(formData.prix), quantite:parseFloat(formData.quantite), product_id:formData.product_id||null, date:format(new Date(),'yyyy-MM-dd')}; await supabase.from(table).insert([item]); fetchData(); setIsModalOpen(false); setIsSubmitting(false);}}>
                 <div className="form-group"><label>Nom</label><input className="form-control" required onChange={e=>setFormData({...formData, nom:e.target.value})} /></div>
                 <div className="form-group"><label>Prix</label><input type="number" className="form-control" required onChange={e=>setFormData({...formData, prix:e.target.value})} /></div>
                 <div className="form-group"><label>Quantité</label><input type="number" className="form-control" required onChange={e=>setFormData({...formData, quantite:e.target.value})} /></div>
                 <button type="submit" className="btn-primary" style={{width:'100%'}}>Sauvegarder</button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
