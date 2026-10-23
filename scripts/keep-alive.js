/**
 * Script de Keep-Alive pour Supabase
 * Permet d'envoyer une requête périodique à la base de données
 * pour éviter la mise en pause automatique (Free Tier = pause après 7 jours d'inactivité).
 *
 * Utilisation:
 *   node scripts/keep-alive.js
 *   npm run keep-alive
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://vgqrasazquaoqskrsryv.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_ug91i0ItCpe0ord5YKAaAg_wY4dMrQM';

async function pingSupabase() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Envoi du ping Keep-Alive à Supabase: ${SUPABASE_URL}`);

  try {
    // 1. Requête PostgREST pour forcer une interaction réelle avec la base PostgreSQL
    const dbResponse = await fetch(`${SUPABASE_URL}/rest/v1/products?select=id&limit=1`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    console.log(`[${timestamp}] Statut Base de données (REST API): HTTP ${dbResponse.status}`);

    // 2. Requête Auth Health
    const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY
      }
    });

    console.log(`[${timestamp}] Statut Auth Service: HTTP ${authResponse.status}`);

    if (dbResponse.ok && authResponse.ok) {
      console.log(`✅ Succès: Projet Supabase actif ! Le compteur d'inactivité de 7 jours est réinitialisé.`);
      process.exit(0);
    } else if (dbResponse.status === 503) {
      console.error(`⚠️ Attention: Le projet Supabase est actuellement en pause (HTTP 503).`);
      console.error(`👉 Rendez-vous sur https://supabase.com/dashboard et cliquez sur 'Restore project' pour le relancer.`);
      process.exit(1);
    } else {
      console.warn(`⚠️ Réponse inattendue (HTTP ${dbResponse.status})`);
      process.exit(0);
    }
  } catch (error) {
    console.error(`❌ Erreur lors de la requête Keep-Alive:`, error.message);
    process.exit(1);
  }
}

pingSupabase();
