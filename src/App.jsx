import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, ShoppingCart, TrendingDown, Package, 
  Plus, Search, Download, Moon, Sun, Trash2, RefreshCw
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

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler
);

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [theme, setTheme] = useState('light');
  const [achats, setAchats] = useState([]);
  const [ventes, setVentes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('achat'); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    nom: '',
    quantite: '',
    prix: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  const [searchQuery, setSearchQuery] = useState('');

  // Fetch Data from Supabase
  const fetchData = async () => {
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
  }, []);

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
    const { nom, quantite, prix, date } = formData;
    if (!nom || !quantite || !prix || !date) return;
    
    setIsSubmitting(true);
    const table = modalType === 'achat' ? 'achats' : 'ventes';
    
    const newItem = {
      nom: nom.trim(),
      quantite: parseFloat(quantite),
      prix: parseFloat(prix),
      date
    };

    try {
      const { data, error } = await supabase.from(table).insert([newItem]).select();
      if (!error && data) {
        if (modalType === 'achat') setAchats([data[0], ...achats]);
        else setVentes([data[0], ...ventes]);
      }
    } catch (err) {
      console.error("Error saving data:", err);
    } finally {
      setIsSubmitting(false);
      setIsModalOpen(false);
      setFormData({ nom: '', quantite: '', prix: '', date: format(new Date(), 'yyyy-MM-dd') });
    }
  };

  const deleteItem = async (id, type) => {
    const confirmDelete = window.confirm("هل أنت متأكد من حذف هذه العملية؟");
    if (!confirmDelete) return;
    
    const table = type === 'achat' ? 'achats' : 'ventes';
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (!error) {
        if (type === 'achat') setAchats(achats.filter(a => a.id !== id));
        else setVentes(ventes.filter(v => v.id !== id));
      }
    } catch (err) {
      console.error("Error deleting item:", err);
    }
  };

  // Filtered Data
  const filteredAchats = achats.filter(item => item.nom.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredVentes = ventes.filter(item => item.nom.toLowerCase().includes(searchQuery.toLowerCase()));
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
      if (mIdx !== -1) mAchats[mIdx] += a.quantite * a.prix;
    });

    ventes.forEach(v => {
      const d = new Date(v.date);
      const mIdx = last6Months.findIndex(lm => lm.index === d.getMonth());
      if (mIdx !== -1) mVentes[mIdx] += v.quantite * v.prix;
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

  return (
    <div className="app-wrapper">
      {/* Header */}
      <header className="header">
        <div className="header-title">
          <TrendingDown className="icon" />
          <span>إدارة حسابات المصنع</span>
        </div>
        <div className="header-actions">
          <button className="icon-btn" onClick={fetchData} title="تحديث البيانات" disabled={loading}>
            <RefreshCw size={22} className={loading ? "spin" : ""} />
          </button>
          <button className="icon-btn" onClick={() => window.print()} title="تصدير PDF">
            <Download size={22} />
          </button>
          <button className="icon-btn" onClick={toggleTheme}>
            {theme === 'light' ? <Moon size={22} /> : <Sun size={22} />}
          </button>
        </div>
      </header>

      {/* Navigation */}
      <nav className="nav-tabs">
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
            <div className="section-header">
              <div className="section-title">
                {activeTab === 'achats' ? 'إدارة المصاريف' : 'إدارة المبيعات'}
              </div>
              <div className="search-bar">
                <Search size={20} color="var(--text-muted)" />
                <input 
                  type="text" 
                  placeholder="ابحث عن منتج..." 
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
                    <th>المنتج</th>
                    <th>الكمية</th>
                    <th>السعر (للوحدة)</th>
                    <th>الإجمالي</th>
                    <th>التاريخ</th>
                    <th>حذف</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeTab === 'achats' ? filteredAchats : filteredVentes).length === 0 ? (
                    <tr><td colSpan="6" style={{textAlign: "center", padding: "30px"}}>لا توجد بيانات</td></tr>
                  ) : (activeTab === 'achats' ? filteredAchats : filteredVentes).map(item => (
                    <tr key={item.id}>
                      <td style={{fontWeight: '700'}}>{item.nom}</td>
                      <td>{item.quantite}</td>
                      <td>{item.prix.toLocaleString()} DA</td>
                      <td><span className={activeTab === 'achats' ? "badge badge-danger" : "badge badge-success"}>{(item.prix * item.quantite).toLocaleString()} DA</span></td>
                      <td>{new Date(item.date).toLocaleDateString('ar-DZ')}</td>
                      <td>
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
            <div className="section-header">
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
      </main>

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => !isSubmitting && setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {modalType === 'achat' ? 'إضافة مصروف جديد' : 'إضافة عملية بيع'}
              </h2>
              <button className="close-btn" disabled={isSubmitting} onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>اسم {modalType === 'achat' ? 'المادة' : 'المنتج'}</label>
                <input 
                  type="text" 
                  className="form-control" 
                  required
                  disabled={isSubmitting}
                  placeholder={modalType === 'achat' ? "مثلا: Parfum, Javel..." : "مثلا: Produit nettoyant..."}
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
              <div className="form-group">
                <label>السعر (للوحدة بالدينار)</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="form-control" 
                  required
                  disabled={isSubmitting}
                  placeholder="0"
                  value={formData.prix}
                  onChange={e => setFormData({...formData, prix: e.target.value})}
                />
              </div>
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
              
              <div style={{marginTop: "15px", padding: "15px", background: "rgba(79, 70, 229, 0.05)", borderRadius: "12px", border: "1px dashed var(--primary)"}}>
                <strong>الإجمالي: </strong>
                <span style={{fontSize: "1.2rem", color: "var(--primary)", fontWeight: "bold"}}>
                  {((parseFloat(formData.prix) || 0) * (parseFloat(formData.quantite) || 0)).toLocaleString()} DA
                </span>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" disabled={isSubmitting} onClick={() => setIsModalOpen(false)}>إلغاء</button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'جاري الحفظ...' : 'حفظ البيانات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
