import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, ShoppingCart, TrendingDown, Package, 
  Plus, Search, Download, Moon, Sun, Trash2, RefreshCw,
  LogOut, User, Printer, Award, Calendar, Smartphone,
  MessageSquare, PlusCircle, Phone, Mail, MessageCircle, MoreHorizontal, Send
} from 'lucide-react';
import { format, isThisWeek, isThisMonth, isThisYear, isToday, parseISO } from 'date-fns';
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
  const [companyInfo, setCompanyInfo] = useState({ phone: '0555 00 11 22', email: 'contact@brasti.com' });
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('achat'); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    nom: '', client_nom: '', client_tel: '', quantite: '', prix: '', 
    description: '', features: '', statut_paiement: 'payé', date: format(new Date(), 'yyyy-MM-dd')
  });

  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef(null);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [dashboardFilter, setDashboardFilter] = useState('all');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  const fetchData = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [achatsRes, ventesRes, productsRes, messagesRes, companyRes] = await Promise.all([
        supabase.from('achats').select('*').order('date', { ascending: false }),
        supabase.from('ventes').select('*').order('date', { ascending: false }),
        supabase.from('products').select('*').order('created_at', { ascending: false }),
        supabase.from('messages').select('*').order('created_at', { ascending: true }),
        supabase.from('company_info').select('*').single()
      ]);
      if (achatsRes.data) setAchats(achatsRes.data);
      if (ventesRes.data) setVentes(ventesRes.data);
      if (productsRes.data) setProducts(productsRes.data);
      if (messagesRes.data) setMessages(messagesRes.data);
      if (companyRes.data) setCompanyInfo(companyRes.data);
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

  const getBotResponse = async (text) => {
     try {
       // On passe le contexte des ventes et du stock au Bot
       const systemContext = `Tu es Brasti AI. Voici les infos du site: 
       - Total Ventes: ${totalVentes} DA
       - Total Achats: ${totalAchats} DA
       - Bénéfice: ${benefice} DA
       - Ventes de cette semaine: ${ventesCetteSemaine} DA
       - Nombre de produits: ${products.length}
       Réponds poliment en français aux questions de l'utilisateur sur ces données.`;

       const res = await fetch("https://luminai.my.id/", {
         method: "POST", headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ content: text, prompt: systemContext })
       });
       const data = await res.json();
       return data.result || data.response;
     } catch (e) { return "Désolé, j'ai eu un problème pour lire les données. Mais je suis là pour aider !"; }
  };

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last && last.sender === 'customer' && !last.is_bot) {
      const trigger = async () => {
        const reply = await getBotResponse(last.content);
        const botMsg = { user_id: session.user.id, sender: 'admin', content: reply, is_bot: true };
        const { data } = await supabase.from('messages').insert([botMsg]).select();
        if (data) setMessages(prev => [...prev, data[0]]);
      };
      trigger();
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    const content = chatInput;
    setChatInput('');
    const newMsg = { user_id: session.user.id, sender: 'customer', content, is_bot: false };
    const { data } = await supabase.from('messages').insert([newMsg]).select();
    if (data) setMessages([...messages, data[0]]);
  };

  const handleDownloadPDF = async () => {
    const input = document.getElementById('pdf-content');
    Swal.fire({ title: 'PDF...', didOpen: () => Swal.showLoading() });
    try {
      const img = await htmlToImage.toJpeg(input, { quality: 0.9, pixelRatio: 2, backgroundColor: theme === 'dark' ? '#0f172a' : '#fff' });
      const pdf = new jsPDF('l', 'mm', 'a4');
      const w = pdf.internal.pageSize.getWidth();
      const h = (pdf.getImageProperties(img).height * w) / pdf.getImageProperties(img).width;
      pdf.addImage(img, 'JPEG', 0, 0, w, h);
      const ts = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
      pdf.save(`Rapport_Brasti_${ts}.pdf`);
      Swal.fire('Succès', 'PDF téléchargé', 'success');
    } catch (e) { Swal.fire('Erreur', e.message, 'error'); }
  };

  if (!session) return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Brasti</h1>
        <form className="auth-form" onSubmit={(e)=>{e.preventDefault(); setAuthLoading(true); supabase.auth.signInWithPassword({email:authEmail, password:authPassword}).then(r=>{if(r.error) setAuthError(r.error.message); setAuthLoading(false);})}}>
          <div className="form-group"><label>Email</label><input className="form-control" onChange={e=>setAuthEmail(e.target.value)} /></div>
          <div className="form-group"><label>Pass</label><input className="form-control" type="password" onChange={e=>setAuthPassword(e.target.value)} /></div>
          <button className="btn-primary" style={{width:'100%'}}>{authLoading ? '...' : 'Connexion'}</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="app-wrapper" id="pdf-content">
      <header className="header">
        <div className="header-title">Brasti Business</div>
        <div className="header-actions">
          <button className="icon-btn" onClick={fetchData}><RefreshCw size={20} /></button>
          <button className="icon-btn" onClick={handleDownloadPDF}><Download size={20} /></button>
          <button className="icon-btn" onClick={toggleTheme}>{theme==='light'?<Moon size={20}/>:<Sun size={20}/>}</button>
          <button className="icon-btn" onClick={()=>supabase.auth.signOut()}><LogOut size={20}/></button>
        </div>
      </header>
      <nav className="nav-tabs">
        <button className={`nav-tab ${activeTab==='dashboard'?'active':''}`} onClick={()=>setActiveTab('dashboard')}><LayoutDashboard size={18} /> Dashboard</button>
        <button className={`nav-tab ${activeTab==='products'?'active':''}`} onClick={()=>setActiveTab('products')}><Package size={18} /> Catalogue</button>
        <button className={`nav-tab ${activeTab==='ventes'?'active':''}`} onClick={()=>setActiveTab('ventes')}><TrendingDown size={18} /> Ventes</button>
        <button className={`nav-tab ${activeTab==='chat'?'active':''}`} onClick={()=>setActiveTab('chat')}><MessageSquare size={18} /> Chat</button>
      </nav>

      <main>
        {activeTab === 'dashboard' && (
          <div className="animate-enter">
            <div className="stats-grid">
              <div className="stat-card revenue"><div className="stat-value">{totalVentes} DA</div><div className="stat-label">Ventes</div></div>
              <div className="stat-card expenses"><div className="stat-value">{totalAchats} DA</div><div className="stat-label">Dépenses</div></div>
              <div className="stat-card profit"><div className="stat-value">{benefice} DA</div><div className="stat-label">Bénéfice</div></div>
            </div>
            <div className="glass-container"><h3>Ventes de la semaine: {ventesCetteSemaine} DA</h3><Line data={{labels:['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'], datasets:[{label:'Ventes', data:[0,0,0,0,0,0,ventesCetteSemaine], borderColor:'#10b981', fill:true}]}} /></div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="animate-enter">
            <div className="section-header"><div className="section-title">Catalogue</div><button className="btn-primary" onClick={()=>{setModalType('product'); setIsModalOpen(true)}}><Plus size={18}/> New</button></div>
            <div className="products-grid">
              {products.map(p=><div key={p.id} className="product-card"><div className="product-name">{p.nom}</div><div className="product-price">{p.prix} DA</div><p>{p.description}</p></div>)}
            </div>
          </div>
        )}

        {activeTab === 'ventes' && (
          <div className="glass-container animate-enter">
            <div className="section-header"><div className="section-title">Toutes les Ventes</div><button className="btn-primary" onClick={()=>{setModalType('vente'); setIsModalOpen(true)}}><Plus size={18}/> New</button></div>
            <table className="data-table"><thead><tr><th>Client</th><th>Produit</th><th>Total</th></tr></thead><tbody>{ventes.map(v=><tr key={v.id}><td>{v.client_nom}</td><td>{v.nom}</td><td>{v.prix*v.quantite} DA</td></tr>)}</tbody></table>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="glass-container animate-enter">
            <div className="chat-container">
              <div className="chat-messages">
                {messages.map((m,i)=><div key={i} className={`message ${m.sender} ${m.is_bot?'bot':''}`}>{m.content}</div>)}
                <div ref={chatEndRef} />
              </div>
              <div className="chat-input-area">
                <input className="form-control" value={chatInput} placeholder="Posez une question sur vos ventes..." onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSendMessage()} />
                <button className="btn-primary" onClick={handleSendMessage}><Send size={18} /></button>
              </div>
            </div>
          </div>
        )}
      </main>

      {isModalOpen && (
        <div className="modal-overlay" onClick={()=>setIsModalOpen(false)}>
          <div className="modal-content" onClick={e=>e.stopPropagation()}>
            <form onSubmit={async (e)=>{e.preventDefault(); setIsSubmitting(true); const table = modalType==='product'?'products':'ventes'; const item = {user_id:session.user.id, nom:formData.nom, prix:parseFloat(formData.prix), quantite:parseFloat(formData.quantite)||1, client_nom:formData.client_nom, description:formData.description, date:format(new Date(),'yyyy-MM-dd')}; const {data}=await supabase.from(table).insert([item]).select(); if(data){ fetchData(); setIsModalOpen(false); } setIsSubmitting(false);}}>
               <div className="form-group"><label>Nom</label><input className="form-control" required onChange={e=>setFormData({...formData, nom:e.target.value})} /></div>
               <div className="form-group"><label>Prix</label><input type="number" className="form-control" required onChange={e=>setFormData({...formData, prix:e.target.value})} /></div>
               {modalType==='vente' && <div className="form-group"><label>Client</label><input className="form-control" required onChange={e=>setFormData({...formData, client_nom:e.target.value})} /></div>}
               <button type="submit" className="btn-primary" disabled={isSubmitting}>OK</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
