import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingBag, Users, Package,
  BarChart2, AlertTriangle, Calendar, RefreshCw, Download
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { jsPDF } from 'jspdf';

export default function DashboardModule({ session, theme }) {
  const [data, setData] = useState({
    ventes: [], achats: [], produits: [], clients: [],
    caisse: [], depenses: [], personnel: [], productions: []
  });
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month'); // 'week' | 'month' | 'year'

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const uid = session.user.id;
      const [v, a, p, c, ca, dep, per, prod] = await Promise.all([
        supabase.from('ventes').select('*').eq('user_id', uid).order('date', { ascending: false }),
        supabase.from('achats').select('*').eq('user_id', uid).order('date', { ascending: false }),
        supabase.from('produits').select('*').eq('user_id', uid),
        supabase.from('clients').select('*').eq('user_id', uid),
        supabase.from('caisse').select('*').eq('user_id', uid).order('date', { ascending: false }),
        supabase.from('depenses').select('*').eq('user_id', uid).order('date', { ascending: false }),
        supabase.from('personnel').select('*').eq('user_id', uid),
        supabase.from('productions').select('*').eq('user_id', uid).order('date', { ascending: false }),
      ]);
      setData({
        ventes: v.data || [], achats: a.data || [], produits: p.data || [],
        clients: c.data || [], caisse: ca.data || [], depenses: dep.data || [],
        personnel: per.data || [], productions: prod.data || []
      });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const filterByPeriod = (items, dateField = 'date') => {
    const now = new Date();
    return items.filter(item => {
      if (!item[dateField]) return false;
      const d = new Date(item[dateField]);
      if (period === 'week') return (now - d) / 86400000 <= 7;
      if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (period === 'year') return d.getFullYear() === now.getFullYear();
      return true;
    });
  };

  const stats = useMemo(() => {
    const ventesP = filterByPeriod(data.ventes);
    const achatsP = filterByPeriod(data.achats);
    const depP = filterByPeriod(data.depenses);
    const prodP = filterByPeriod(data.productions);

    const ca = ventesP.reduce((s, v) => s + (v.total_prix || v.quantite * v.prix_unitaire || 0), 0);
    const creances = data.ventes.filter(v => !v.est_paye).reduce((s, v) => s + (v.total_prix || 0), 0);
    const achatsTotal = achatsP.reduce((s, a) => s + (a.total_prix || a.quantite * a.prix_unitaire || 0), 0);
    const depenses = depP.reduce((s, d) => s + d.montant, 0);
    const benefice = ca - achatsTotal - depenses;
    const stockAlertes = data.produits.filter(p => p.stock_qty <= p.seuil_alerte).length;
    const productionsNb = prodP.length;
    const coutProductions = prodP.reduce((s, p) => s + (p.cout_total || 0), 0);

    // Monthly chart data (last 6 months)
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(new Date(), 5 - i);
      const m = d.getMonth(); const y = d.getFullYear();
      const ventesM = data.ventes.filter(v => { const vd = new Date(v.date); return vd.getMonth() === m && vd.getFullYear() === y; });
      const achatsM = data.achats.filter(a => { const ad = new Date(a.date); return ad.getMonth() === m && ad.getFullYear() === y; });
      return {
        label: format(d, 'MMM'),
        ventes: ventesM.reduce((s, v) => s + (v.total_prix || 0), 0),
        achats: achatsM.reduce((s, a) => s + (a.total_prix || 0), 0),
      };
    });

    const topClients = data.clients.map(c => {
      const totalAchete = data.ventes.filter(v => v.client_id === c.id).reduce((s, v) => s + (v.total_prix || 0), 0);
      const dette = data.ventes.filter(v => v.client_id === c.id && !v.est_paye).reduce((s, v) => s + (v.total_prix || 0), 0);
      return { ...c, totalAchete, dette };
    }).sort((a, b) => b.totalAchete - a.totalAchete).slice(0, 5);

    const topProduits = data.produits.map(p => {
      const qtyVendue = data.ventes.filter(v => v.produit_id === p.id).reduce((s, v) => s + v.quantite, 0);
      const caP = data.ventes.filter(v => v.produit_id === p.id).reduce((s, v) => s + (v.total_prix || 0), 0);
      return { ...p, qtyVendue, caP };
    }).sort((a, b) => b.caP - a.caP).slice(0, 5);

    return { ca, creances, achatsTotal, depenses, benefice, stockAlertes, productionsNb, coutProductions, months, topClients, topProduits };
  }, [data, period]);

  const maxBar = Math.max(...stats.months.map(m => Math.max(m.ventes, m.achats)), 1);

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>Chargement du tableau de bord...</div>;

  return (
    <div className="animate-enter">
      {/* Period selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['week', '7 Jours'], ['month', 'Ce Mois'], ['year', 'Cette Année']].map(([k, l]) => (
          <button key={k} onClick={() => setPeriod(k)}
            style={{ padding: '8px 18px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', fontFamily: 'Outfit, sans-serif',
              background: period === k ? 'var(--primary)' : 'var(--card)', color: period === k ? 'white' : 'var(--muted)',
              border: period === k ? 'none' : '1px solid var(--card-border)', transition: '0.2s' }}>
            {l}
          </button>
        ))}
        <button onClick={fetchAll} style={{ marginLeft: 'auto', background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '8px 16px', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.85rem', fontFamily: 'Outfit, sans-serif' }}>
          <RefreshCw size={14} /> Rafraîchir
        </button>
      </div>

      {/* Main KPIs */}
      <div className="stats-grid">
        <div className="stat-card" style={{ borderLeft: '5px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#10b981' }}>{stats.ca.toFixed(0)} DA</div>
              <div className="stat-label">Chiffre d'Affaires</div>
            </div>
            <TrendingUp color="#10b981" size={28} />
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '5px solid #4f46e5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#4f46e5' }}>{stats.benefice.toFixed(0)} DA</div>
              <div className="stat-label">Bénéfice Net</div>
            </div>
            <DollarSign color="#4f46e5" size={28} />
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '5px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#ef4444' }}>{stats.creances.toFixed(0)} DA</div>
              <div className="stat-label">Créances Clients</div>
            </div>
            <AlertTriangle color="#ef4444" size={28} />
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '5px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#f59e0b' }}>{stats.achatsTotal.toFixed(0)} DA</div>
              <div className="stat-label">Total Achats</div>
            </div>
            <ShoppingBag color="#f59e0b" size={28} />
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '5px solid #8b5cf6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: '#8b5cf6' }}>{data.clients.length}</div>
              <div className="stat-label">Total Clients</div>
            </div>
            <Users color="#8b5cf6" size={28} />
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: stats.stockAlertes > 0 ? '5px solid #ef4444' : '5px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: stats.stockAlertes > 0 ? '#ef4444' : '#10b981' }}>{stats.stockAlertes}</div>
              <div className="stat-label">Alertes Stock</div>
            </div>
            <Package color={stats.stockAlertes > 0 ? '#ef4444' : '#10b981'} size={28} />
          </div>
        </div>
      </div>

      {/* Charts + Top lists */}
      <div className="dashboard-two-cols" style={{ marginBottom: 20 }}>
        {/* Monthly bar chart */}
        <div className="glass-container" style={{ margin: 0 }}>
          <h3 style={{ fontWeight: 800, marginBottom: 20, fontSize: '1.1rem' }}>📊 Évolution 6 Mois</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 160 }}>
            {stats.months.map((m, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: '100%', display: 'flex', gap: 3, alignItems: 'flex-end', height: 130 }}>
                  <div style={{ flex: 1, background: 'linear-gradient(to top, #10b981, #6ee7b7)', borderRadius: '4px 4px 0 0', height: `${(m.ventes / maxBar) * 100}%`, minHeight: m.ventes > 0 ? 4 : 0, transition: '0.5s' }} title={`Ventes: ${m.ventes.toFixed(0)} DA`} />
                  <div style={{ flex: 1, background: 'linear-gradient(to top, #ef4444, #fca5a5)', borderRadius: '4px 4px 0 0', height: `${(m.achats / maxBar) * 100}%`, minHeight: m.achats > 0 ? 4 : 0, transition: '0.5s' }} title={`Achats: ${m.achats.toFixed(0)} DA`} />
                </div>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)' }}>{m.label}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}><span style={{ width: 10, height: 10, background: '#10b981', borderRadius: 3, display: 'inline-block' }} />Ventes</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 700, color: '#ef4444' }}><span style={{ width: 10, height: 10, background: '#ef4444', borderRadius: 3, display: 'inline-block' }} />Achats</span>
          </div>
        </div>

        {/* Top clients */}
        <div className="glass-container" style={{ margin: 0 }}>
          <h3 style={{ fontWeight: 800, marginBottom: 16, fontSize: '1.1rem' }}>🏆 Top Clients</h3>
          {stats.topClients.length === 0 ? (
            <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 20 }}>Aucun client encore</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {stats.topClients.map((c, i) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nom}</div>
                    {c.dette > 0 && <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>Dette: {c.dette.toFixed(0)} DA</div>}
                  </div>
                  <div style={{ fontWeight: 800, color: '#10b981', fontSize: '0.9rem', flexShrink: 0 }}>{c.totalAchete.toFixed(0)} DA</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top products + Recent activity */}
      <div className="dashboard-two-cols">
        <div className="glass-container" style={{ margin: 0 }}>
          <h3 style={{ fontWeight: 800, marginBottom: 16, fontSize: '1.1rem' }}>📦 Top Produits</h3>
          {stats.topProduits.length === 0 ? (
            <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 20 }}>Aucune vente encore</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {stats.topProduits.map((p, i) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{p.nom}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Vendu: {p.qtyVendue} {p.unite}</div>
                  </div>
                  <div style={{ fontWeight: 800, color: '#4f46e5', fontSize: '0.9rem' }}>{p.caP.toFixed(0)} DA</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent transactions */}
        <div className="glass-container" style={{ margin: 0 }}>
          <h3 style={{ fontWeight: 800, marginBottom: 16, fontSize: '1.1rem' }}>⚡ Dernières Ventes</h3>
          {data.ventes.length === 0 ? (
            <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 20 }}>Aucune vente encore</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.ventes.slice(0, 6).map(v => (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--card-border)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: v.est_paye ? '#dcfce7' : '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <TrendingUp size={16} color={v.est_paye ? '#15803d' : '#b91c1c'} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.produit_nom}</div>
                    <div style={{ fontSize: '0.73rem', color: 'var(--muted)' }}>{v.client_nom || 'Client inconnu'} • {v.date}</div>
                  </div>
                  <div style={{ fontWeight: 800, color: '#4f46e5', fontSize: '0.9rem', flexShrink: 0 }}>{(v.total_prix || 0).toFixed(0)} DA</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
