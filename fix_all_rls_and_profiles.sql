-- ============================================================
-- BRASTI ERP - PARTAGE COMPLET DES DONNÉES (DIRECTEUR & EMPLOYÉS)
-- & NOUVELLES COLONNES DE PROFIL
-- Exécutez ce script dans Supabase -> SQL Editor -> Run
-- ============================================================

-- 1. Table profiles & colonnes complètes de l'employé
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text DEFAULT 'worker',
  full_name text,
  email text,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tel text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS adresse text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_naissance text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS director_id text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS director_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT false;

-- 2. Désactiver le RLS pour partager les données de l'usine entre Directeur et Employés
ALTER TABLE IF EXISTS clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS fournisseurs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS matieres_premieres DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS emballages DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS recettes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS recette_ingredients DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS productions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS reglements_clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS reglements_fournisseurs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS caisse DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS depenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS apports DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS personnel DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS salaires DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS products DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS produits DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ventes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS achats DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS messages DISABLE ROW LEVEL SECURITY;

-- 3. Sécurité supplémentaire : Politiques d'accès pour tous les utilisateurs connectés
DO $$ 
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS "Authenticated users full access" ON %I;', tbl);
      EXECUTE format('CREATE POLICY "Authenticated users full access" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true);', tbl);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;
