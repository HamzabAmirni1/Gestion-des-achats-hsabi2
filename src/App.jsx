import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, ShoppingCart, TrendingDown, Package, 
  Plus, Search, Download, Moon, Sun, Trash2, RefreshCw,
  LogOut, User, Printer
} from 'lucide-react';
import { format } from 'date-fns';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { supabase } from './supabaseClient';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import Swal from 'sweetalert2';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler
);

export default function App() {
  const [session, setSession] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const [activeTab, setActiveTab] = useState('dashboard');
  const [theme, setTheme] = useState('light');
  const [achats, setAchats] = useState([]);
  const [ventes, setVentes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('achat'); // achat, vente, stock_add
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    nom: '',
    client_nom: '',
    client_tel: '',
    quantite: '',
    prix: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  const [searchQuery, setSearchQuery] = useState('');

  // Handle Authentication Session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch Data from Supabase
  const fetchData = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [achatsRes, ventesRes] = await Promise.all([
        supabase.from('achats').select('*').order('date', { ascending: false }),
        supabase.from('ventes').select('*').order('date', { ascending: false })
      ]);
      
      if (achatsRes.data) setAchats(achatsRes.data);
      if (ventesRes.data) setVentes(ventesRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [session]);

  // Theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');

  // Computed Stock
  const stock = useMemo(() => {
    const stockMap = new Map();
    
    // Add achats
    achats.forEach(achat => {
      const nameLower = achat.nom.toLowerCase().trim();
      const current = stockMap.get(nameLower) || { nom: achat.nom, quantite: 0 };
      current.quantite += parseFloat(achat.quantite);
      stockMap.set(nameLower, current);
    });
    
    // Subtract ventes
    ventes.forEach(vente => {
      const nameLower = vente.nom.toLowerCase().trim();
      const current = stockMap.get(nameLower) || { nom: vente.nom, quantite: 0 };
      current.quantite -= parseFloat(vente.quantite);
      stockMap.set(nameLower, current);
    });
    
    return Array.from(stockMap.values()).filter(item => item.quantite > 0);
  }, [achats, ventes]);

  // Calculations
  const totalAchats = achats.reduce((acc, curr) => acc + (parseFloat(curr.prix) * parseFloat(curr.quantite)), 0);
  const totalVentes = ventes.reduce((acc, curr) => acc + (parseFloat(curr.prix) * parseFloat(curr.quantite)), 0);
  const benefice = totalVentes - totalAchats;
  const totalStock = stock.reduce((acc, curr) => acc + parseFloat(curr.quantite), 0);

  // Form Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    const { nom, quantite, prix, date, client_nom, client_tel } = formData;
    
    if (!nom || !quantite || !date) return;
    if (modalType !== 'stock_add' && !prix) return;
    
    setIsSubmitting(true);
    const table = modalType === 'vente' ? 'ventes' : 'achats'; // stock_add goes as Achat with 0 cost
    
    const newItem = {
      user_id: session.user.id,
      nom: nom.trim(),
      quantite: parseFloat(quantite),
      prix: modalType === 'stock_add' ? 0 : parseFloat(prix),
      date
    };

    if (modalType === 'vente') {
      newItem.client_nom = client_nom;
      newItem.client_tel = client_tel;
    }

    try {
      const { data, error } = await supabase.from(table).insert([newItem]).select();
      if (!error && data) {
        if (modalType === 'achat' || modalType === 'stock_add') setAchats([data[0], ...achats]);
        else setVentes([data[0], ...ventes]);
        Swal.fire('تم الحفظ!', 'تم تسجيل العملية بنجاح.', 'success');
      } else {
        console.error("Supabase Error:", error);
        Swal.fire('خطأ!', 'حدث خطأ أثناء الحفظ: ' + (error?.message || ''), 'error');
      }
    } catch (err) {
      console.error("Error saving data:", err);
    } finally {
      setIsSubmitting(false);
      setIsModalOpen(false);
      setFormData({ nom: '', client_nom: '', client_tel: '', quantite: '', prix: '', date: format(new Date(), 'yyyy-MM-dd') });
    }
  };

  const deleteItem = async (id, type) => {
    const result = await Swal.fire({
      title: 'هل أنت متأكد؟',
      text: "لن تتمكن من استرجاع هذه البيانات!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'نعم، احذف!',
      cancelButtonText: 'إلغاء'
    });
    if (!result.isConfirmed) return;
    
    const table = type === 'achat' ? 'achats' : 'ventes';
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (!error) {
        if (type === 'achat') setAchats(achats.filter(a => a.id !== id));
        else setVentes(ventes.filter(v => v.id !== id));
        Swal.fire('تم الحذف!', 'تمت إزالة العملية.', 'success');
      }
    } catch (err) {
      console.error("Error deleting item:", err);
    }
  };

  // Auth Functions
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    
    try {
      let result;
      if (authMode === 'login') {
        result = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
      } else {
        result = await supabase.auth.signUp({ email: authEmail, password: authPassword });
        if(result.data?.user && !result.data?.session) {
          Swal.fire('تم بنجاح!', 'تم إنشاء حسابك، يرجى تأكيد بريدك الإلكتروني إذا كان مطلوباً أو قم بتسجيل الدخول مباشرة.', 'success');
        }
      }
      if (result.error) throw result.error;
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) setAuthError(error.message);
  };

  // PDF Export Function fixed with Landscape and High-Res!
  const handleDownloadPDF = async () => {
    const input = document.getElementById('pdf-content');
    if (!input) {
      Swal.fire('خطأ!', 'لا يمكن العثور على محتوى للطباعة!', 'error');
      return;
    }
    
    // إزالة الشفافية مؤقتا لتجنب بهتان الكتابة
    const originalCards = Array.from(document.querySelectorAll('.glass-container, .stat-card'));
    originalCards.forEach(el => {
      el.style.backdropFilter = 'none';
      el.style.background = theme === 'dark' ? '#1e293b' : '#ffffff';
    });
    
    Swal.fire({
      title: 'جاري تحضير الملف...',
      text: 'يرجى الانتظار للحصول على جودة عالية...',
      allowOutsideClick: false,
      didOpen: () => { Swal.showLoading(); }
    });

    try {
      const canvas = await html2canvas(input, { 
        scale: 4, // جودة أعلى بكثير للفلاتر والنصوص
        useCORS: true, 
        logging: false,
        backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff' 
      });
      // استخراج الصورة بصيغة JPEG لتقليل الحجم إلى أقل من 2 ميغابايت للحفاظ على المساحة
      const imgData = canvas.toDataURL('image/jpeg', 0.7);
      
      // 'l' يعني Landscape حتى تظهر الجداول بالعرض بشكل واضح
      const pdf = new jsPDF('l', 'mm', 'a4'); 
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      // إضافة هامش صغير للحفاظ على التنسيق
      const margin = 10;
      pdf.addImage(imgData, 'PNG', margin, margin, pdfWidth - (margin*2), pdfHeight - (margin*2));
      pdf.save(`Rapport_Hsabi_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      Swal.close();
      Swal.fire('تم بنجاح!', 'تم حفظ التقرير كـ PDF بجودة عالية', 'success');
    } catch (err) {
      console.error("Error generating PDF:", err);
      Swal.fire('خطأ!', 'حدث خطأ أثناء تحميل الملف', 'error');
    } finally {
      // إرجاع التصميم إلى حالته الأصلية
      originalCards.forEach(el => {
        el.style.backdropFilter = '';
        el.style.background = '';
      });
    }
  };

  // Filtered Data
  const filteredAchats = achats.filter(item => item.nom.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredVentes = ventes.filter(item => 
    item.nom.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (item.client_nom && item.client_nom.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  const filteredStock = stock.filter(item => item.nom.toLowerCase().includes(searchQuery.toLowerCase()));

  // Chart Data
  const chartData = useMemo(() => {
    const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    const currentMonth = new Date().getMonth();
    const last6Months = [];
    for(let i=5; i>=0; i--) {
      let m = currentMonth - i;
      if (m < 0) m += 12;
      last6Months.push({ name: months[m], index: m });
    }

    const mAchats = new Array(6).fill(0);
    const mVentes = new Array(6).fill(0);

    achats.forEach(a => {
      const d = new Date(a.date);
      const mIdx = last6Months.findIndex(lm => lm.index === d.getMonth());
      // Ignore stock_add with 0 price in chart expenses
      if (mIdx !== -1 && a.prix > 0) mAchats[mIdx] += Math.abs(a.quantite * a.prix);
    });

    ventes.forEach(v => {
      const d = new Date(v.date);
      const mIdx = last6Months.findIndex(lm => lm.index === d.getMonth());
      if (mIdx !== -1) mVentes[mIdx] += Math.abs(v.quantite * v.prix);
    });

    return {
      labels: last6Months.map(m => m.name),
      datasets: [
        {
          label: 'المبيعات (DA)',
          data: mVentes,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.2)',
          fill: true,
          tension: 0.4
        },
        {
          label: 'المصاريف (DA)',
          data: mAchats,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.2)',
          fill: true,
          tension: 0.4
        }
      ]
    };
  }, [achats, ventes]);


  // -------------- AUTH SCREEN --------------
  if (!session) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-icon"><User size={60} /></div>
          <h1 className="auth-title">مرحباً بك في تطبيقي</h1>
          <p className="auth-subtitle">
            {authMode === 'login' ? 'قم بتسجيل الدخول للوصول لحساباتك' : 'أنشئ حساباً جديداً للبدء'}
          </p>

          <form className="auth-form" onSubmit={handleAuth}>
            <div className="form-group">
              <label>البريد الإلكتروني</label>
              <input 
                type="email" 
                className="form-control" 
                required
                value={authEmail}
                onChange={e => setAuthEmail(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>كلمة السر</label>
              <input 
                type="password" 
                className="form-control" 
                required
                value={authPassword}
                onChange={e => setAuthPassword(e.target.value)}
                minLength="6"
              />
            </div>
            
            {authError && <div style={{color: 'var(--danger)', fontSize: '0.9rem', marginBottom: '10px'}}>{authError}</div>}
            
            <button type="submit" className="btn-primary" style={{width: '100%', justifyContent: 'center'}} disabled={authLoading}>
              {authLoading ? 'جار التحميل...' : (authMode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب')}
            </button>
          </form>

          <button className="auth-switch" onClick={() => {setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError('');}}>
            {authMode === 'login' ? 'ليس لديك حساب؟ أنشئ حساباً' : 'لديك حساب بالفعل؟ سجل دخولك'}
          </button>

          <div className="auth-divider">أو</div>

          <button className="btn-google" onClick={signInWithGoogle}>
            <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/><path d="M1 1h22v22H1z" fill="none"/></svg>
            تسجيل الدخول باستخدام Google
          </button>
        </div>
      </div>
    );
  }

  // -------------- MAIN APP --------------
  return (
    <div className="app-wrapper" id="pdf-content">
      {/* Header */}
      <header className="header" data-html2canvas-ignore="true">
        <div className="header-title">
          <TrendingDown className="icon" />
          <span>إدارة حسابات المصنع</span>
        </div>
        <div className="header-actions">
          <button className="icon-btn" onClick={fetchData} title="تحديث البيانات" disabled={loading}>
            <RefreshCw size={22} className={loading ? "spin" : ""} />
          </button>
          
          <button className="icon-btn" onClick={() => window.print()} title="طباعة الصفحة">
            <Printer size={22} />
          </button>

          <button className="icon-btn" onClick={handleDownloadPDF} title="تنزيل PDF">
            <Download size={22} />
          </button>
          
          <button className="icon-btn" onClick={toggleTheme} title="تغيير المظهر">
            {theme === 'light' ? <Moon size={22} /> : <Sun size={22} />}
          </button>
          <button className="icon-btn" onClick={() => supabase.auth.signOut()} title="تسجيل الخروج">
            <LogOut size={22} color="var(--danger)" />
          </button>
        </div>
      </header>

      {/* Navigation */}
      <nav className="nav-tabs" data-html2canvas-ignore="true">
        <button className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
          <LayoutDashboard size={20} /> لوحة التحكم
        </button>
        <button className={`nav-tab ${activeTab === 'achats' ? 'active' : ''}`} onClick={() => setActiveTab('achats')}>
          <ShoppingCart size={20} /> المصاريف (Achats)
        </button>
        <button className={`nav-tab ${activeTab === 'ventes' ? 'active' : ''}`} onClick={() => setActiveTab('ventes')}>
          <TrendingDown size={20} style={{transform: "scaleY(-1)"}} /> المبيعات (Ventes)
        </button>
        <button className={`nav-tab ${activeTab === 'stock' ? 'active' : ''}`} onClick={() => setActiveTab('stock')}>
          <Package size={20} /> المخزون (Stock)
        </button>
        <button className={`nav-tab ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
          <User size={20} /> المُطوّر
        </button>
      </nav>

      {/* Content */}
      <main>
        {activeTab === 'dashboard' && (
          <div className="animate-enter">
            <div className="stats-grid">
              <div className="stat-card revenue">
                <div className="stat-icon"><TrendingDown style={{transform: "scaleY(-1)"}} /></div>
                <div className="stat-value">{totalVentes.toLocaleString()} DA</div>
                <div className="stat-label">إجمالي المبيعات</div>
              </div>
              <div className="stat-card expenses">
                <div className="stat-icon"><ShoppingCart /></div>
                <div className="stat-value">{totalAchats.toLocaleString()} DA</div>
                <div className="stat-label">إجمالي المصاريف</div>
              </div>
              <div className="stat-card profit">
                <div className="stat-icon"><LayoutDashboard /></div>
                <div className="stat-value" style={{ color: benefice < 0 ? 'var(--danger)' : 'var(--warning)' }}>
                  {benefice.toLocaleString()} DA
                </div>
                <div className="stat-label">الصافي (الربح)</div>
              </div>
              <div className="stat-card stock">
                <div className="stat-icon"><Package /></div>
                <div className="stat-value">{totalStock.toLocaleString()}</div>
                <div className="stat-label">الكمية في المخزون</div>
              </div>
            </div>

            <div className="glass-container">
              <div className="section-title" style={{marginBottom: "20px"}}>رسم بياني للأرباح (آخر 6 أشهر)</div>
              <div style={{ height: "300px", width: "100%" }}>
                <Line 
                  data={chartData} 
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'top', rtl: true, labels: { font: { family: 'Outfit' } } } },
                    scales: { y: { beginAtZero: true } }
                  }} 
                />
              </div>
            </div>
          </div>
        )}

        {(activeTab === 'achats' || activeTab === 'ventes') && (
          <div className="glass-container animate-enter">
            <div className="section-header" data-html2canvas-ignore="true">
              <div className="section-title">
                {activeTab === 'achats' ? 'إدارة المصاريف' : 'إدارة المبيعات'}
              </div>
              <div className="search-bar">
                <Search size={20} color="var(--text-muted)" />
                <input 
                  type="text" 
                  placeholder={activeTab === 'achats' ? "ابحث عن منتج..." : "ابحث عن منتج أو عميل..."} 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button 
                className="btn-primary" 
                onClick={() => { setModalType(activeTab === 'achats' ? 'achat' : 'vente'); setIsModalOpen(true); }}
              >
                <Plus size={20} /> إضافة {activeTab === 'achats' ? 'مصروف' : 'عملية بيع'}
              </button>
            </div>

            <div style={{overflowX: 'auto'}}>
              {loading ? (
                <div style={{textAlign: "center", padding: "30px"}}>جارٍ تحميل البيانات...</div>
              ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    {activeTab === 'ventes' && <th>اسم العميل</th>}
                    {activeTab === 'ventes' && <th>رقم الهاتف</th>}
                    <th>المنتج</th>
                    <th>الكمية</th>
                    <th>السعر (للوحدة)</th>
                    <th>الإجمالي</th>
                    <th>التاريخ</th>
                    <th data-html2canvas-ignore="true">حذف</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeTab === 'achats' ? filteredAchats : filteredVentes).length === 0 ? (
                    <tr><td colSpan={activeTab === 'ventes' ? "8" : "6"} style={{textAlign: "center", padding: "30px"}}>لا توجد بيانات</td></tr>
                  ) : (activeTab === 'achats' ? filteredAchats : filteredVentes).map(item => (
                    <tr key={item.id}>
                      {activeTab === 'ventes' && <td style={{fontWeight: '700'}}>{item.client_nom || '-'}</td>}
                      {activeTab === 'ventes' && <td>{item.client_tel || '-'}</td>}
                      <td style={activeTab === 'achats' ? {fontWeight: '700'} : {}}>{item.nom}{item.prix === 0 && ' (إضافة مخزون)'}</td>
                      <td>{item.quantite}</td>
                      <td>{item.prix.toLocaleString()} DA</td>
                      <td><span className={activeTab === 'achats' ? "badge badge-danger" : "badge badge-success"}>{(item.prix * item.quantite).toLocaleString()} DA</span></td>
                      <td>{new Date(item.date).toLocaleDateString('ar-DZ')}</td>
                      <td data-html2canvas-ignore="true">
                        <button onClick={() => deleteItem(item.id, activeTab === 'achats' ? 'achat' : 'vente')} className="icon-btn" style={{width: "35px", height: "35px", background: "rgba(239, 68, 68, 0.1)", color: "var(--danger)", border: "none"}}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
            </div>
          </div>
        )}

        {activeTab === 'stock' && (
          <div className="glass-container animate-enter">
            <div className="section-header" data-html2canvas-ignore="true">
              <div className="section-title">المخزون الحالي</div>
              <div className="search-bar">
                <Search size={20} color="var(--text-muted)" />
                <input 
                  type="text" 
                  placeholder="ابحث عن منتج في المخزون..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button 
                className="btn-primary" 
                onClick={() => { setModalType('stock_add'); setIsModalOpen(true); }}
                style={{background: 'var(--primary)'}}
              >
                <Plus size={20} /> زيادة المنتجات للمخزون
              </button>
            </div>

            <div style={{overflowX: 'auto'}}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>اسم المنتج</th>
                    <th>الكمية المتوفرة</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStock.length === 0 ? (
                    <tr><td colSpan="3" style={{textAlign: "center", padding: "30px"}}>المخزون فارغ</td></tr>
                  ) : filteredStock.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{fontWeight: '700', fontSize: '1.1rem'}}>{item.nom}</td>
                      <td style={{fontSize: '1.2rem', fontWeight: '800', color: "var(--primary)"}}>{item.quantite}</td>
                      <td>
                        {item.quantite <= 0 ? (
                           <span className="badge badge-danger">نفذ من المخزون</span>
                        ) : item.quantite < 5 ? (
                          <span className="badge badge-danger">مخزون منخفض</span>
                        ) : item.quantite < 20 ? (
                          <span className="badge badge-warning">متوسط</span>
                        ) : (
                          <span className="badge badge-success">متوفر بكثرة</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="glass-container animate-enter" style={{textAlign: 'center', padding: '40px 20px'}}>
            <div style={{width: '90px', height: '90px', borderRadius: '50%', background: 'var(--primary)', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 25px -5px rgba(79,70,229,0.5)'}}>
              <User size={50} color="white" />
            </div>
            <h2 style={{fontSize: '2rem', marginBottom: '5px', fontWeight: '800'}}>Hamza Amirni</h2>
            <p style={{color: 'var(--text-muted)', marginBottom: '30px', fontSize: '1.1rem'}}>Full-Stack Developer & Technical Creator</p>
            
            <div className="social-grid">
              <a href="https://whatsapp.com/channel/0029ValXRoHCnA7yKopcrn1p" target="_blank" rel="noreferrer" className="btn-social whatsapp">💬 WhatsApp Channel</a>
              <a href="https://chat.whatsapp.com/DDb3fGPuZPB1flLc1BV9gJ" target="_blank" rel="noreferrer" className="btn-social whatsapp">👥 WhatsApp Groups</a>
              <a href="https://instagram.com/hamza_amirni_01" target="_blank" rel="noreferrer" className="btn-social instagram">📸 Instagram (1)</a>
              <a href="https://instagram.com/hamza_amirni_02" target="_blank" rel="noreferrer" className="btn-social instagram">📸 Instagram (2)</a>
              <a href="https://www.instagram.com/channel/AbbqrMVbExH_EZLD/" target="_blank" rel="noreferrer" className="btn-social instagram">📺 IG Channel</a>
              <a href="https://www.facebook.com/6kqzuj3y4e" target="_blank" rel="noreferrer" className="btn-social facebook">📘 Facebook Profile</a>
              <a href="https://www.facebook.com/profile.php?id=61564527797752" target="_blank" rel="noreferrer" className="btn-social facebook">📄 Facebook Page</a>
              <a href="https://www.youtube.com/@Hamzaamirni01" target="_blank" rel="noreferrer" className="btn-social youtube">▶️ YouTube Channel</a>
              <a href="https://t.me/hamzaamirni" target="_blank" rel="noreferrer" className="btn-social telegram">✈️ Telegram</a>
              <a href="https://hamzaamirni.netlify.app" target="_blank" rel="noreferrer" className="btn-social portfolio">🌐 Portfolio / Website</a>
            </div>
          </div>
        )}
      </main>

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => !isSubmitting && setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {modalType === 'achat' ? 'إضافة مصروف جديد' : modalType === 'vente' ? 'إضافة عملية بيع' : 'إضافة منتج مباشر للمخزون'}
              </h2>
              <button className="close-btn" disabled={isSubmitting} onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              
              {modalType === 'vente' && (
                <>
                  <div className="form-group">
                    <label>اسم العميل (اختياري)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      disabled={isSubmitting}
                      placeholder="أدخل اسم العميل..."
                      value={formData.client_nom}
                      onChange={e => setFormData({...formData, client_nom: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>رقم هاتف العميل (اختياري)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      disabled={isSubmitting}
                      placeholder="مثال: 0550123456"
                      value={formData.client_tel}
                      onChange={e => setFormData({...formData, client_tel: e.target.value})}
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label>{(modalType === 'achat' || modalType === 'stock_add') ? 'اسم السلعة / المنتج' : 'المنتج المباع'}</label>
                <input 
                  type="text" 
                  className="form-control" 
                  required
                  disabled={isSubmitting}
                  placeholder="مثلا: Produit nettoyant..."
                  value={formData.nom}
                  onChange={e => setFormData({...formData, nom: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>الكمية</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="form-control" 
                  required
                  disabled={isSubmitting}
                  placeholder="0"
                  value={formData.quantite}
                  onChange={e => setFormData({...formData, quantite: e.target.value})}
                />
              </div>
              
              {modalType !== 'stock_add' && (
                <div className="form-group">
                  <label>السعر (للوحدة بالدينار)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="form-control" 
                    required={modalType !== 'stock_add'}
                    disabled={isSubmitting}
                    placeholder="0"
                    value={formData.prix}
                    onChange={e => setFormData({...formData, prix: e.target.value})}
                  />
                </div>
              )}

              <div className="form-group">
                <label>التاريخ</label>
                <input 
                  type="date" 
                  className="form-control" 
                  required
                  disabled={isSubmitting}
                  value={formData.date}
                  onChange={e => setFormData({...formData, date: e.target.value})}
                />
              </div>
              
              {modalType !== 'stock_add' && (
                <div style={{marginTop: "15px", padding: "15px", background: "rgba(79, 70, 229, 0.05)", borderRadius: "12px", border: "1px dashed var(--primary)"}}>
                  <strong>الإجمالي: </strong>
                  <span style={{fontSize: "1.2rem", color: "var(--primary)", fontWeight: "bold"}}>
                    {((parseFloat(formData.prix) || 0) * (parseFloat(formData.quantite) || 0)).toLocaleString()} DA
                  </span>
                </div>
              )}

              <div className="modal-footer">
                <button type="button" className="btn-cancel" disabled={isSubmitting} onClick={() => setIsModalOpen(false)}>إلغاء</button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'جاري الحفظ...' : modalType === 'stock_add' ? 'إضافة للمخزون' : 'حفظ البيانات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
