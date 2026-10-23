-- ============================================================
-- BRASTI ERP - SAFE & NON-DESTRUCTIVE DATABASE SCHEMA
-- Exécutez ce script dans Supabase SQL Editor.
-- Ce script préserve toutes vos données existantes (products, achats, ventes).
-- ============================================================

-- ── 1. AMÉLIORATION DES TABLES EXISTANTES (Sans perte de données) ──
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS prix_revient numeric DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS unite text DEFAULT 'pièce';
ALTER TABLE products ADD COLUMN IF NOT EXISTS seuil_alerte numeric DEFAULT 5;

ALTER TABLE ventes ADD COLUMN IF NOT EXISTS client_id uuid;
ALTER TABLE ventes ADD COLUMN IF NOT EXISTS client_tel text;
ALTER TABLE ventes ADD COLUMN IF NOT EXISTS mode_paiement text DEFAULT 'espèces';
ALTER TABLE ventes ADD COLUMN IF NOT EXISTS remise numeric DEFAULT 0;
ALTER TABLE ventes ADD COLUMN IF NOT EXISTS num_facture text;
ALTER TABLE ventes ADD COLUMN IF NOT EXISTS type_doc text DEFAULT 'facture'; -- 'facture' ou 'bon_livraison'
ALTER TABLE ventes ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE achats ADD COLUMN IF NOT EXISTS fournisseur_id uuid;
ALTER TABLE achats ADD COLUMN IF NOT EXISTS fournisseur_nom text;
ALTER TABLE achats ADD COLUMN IF NOT EXISTS type_article text DEFAULT 'matiere'; -- 'matiere' | 'emballage' | 'autre'
ALTER TABLE achats ADD COLUMN IF NOT EXISTS mode_paiement text DEFAULT 'espèces';
ALTER TABLE achats ADD COLUMN IF NOT EXISTS num_bon text;
ALTER TABLE achats ADD COLUMN IF NOT EXISTS est_paye boolean DEFAULT true;
ALTER TABLE achats ADD COLUMN IF NOT EXISTS notes text;

-- ── 2. NOUVELLES TABLES ───────────────────────────────────────────

-- Clients
CREATE TABLE IF NOT EXISTS clients (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid DEFAULT auth.uid() NOT NULL,
  nom text NOT NULL,
  tel text,
  email text,
  adresse text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Fournisseurs
CREATE TABLE IF NOT EXISTS fournisseurs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid DEFAULT auth.uid() NOT NULL,
  nom text NOT NULL,
  tel text,
  email text,
  adresse text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Matières Premières
CREATE TABLE IF NOT EXISTS matieres_premieres (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid DEFAULT auth.uid() NOT NULL,
  nom text NOT NULL,
  description text,
  unite text DEFAULT 'kg',
  stock_qty numeric NOT NULL DEFAULT 0,
  prix_unitaire numeric DEFAULT 0,
  seuil_alerte numeric DEFAULT 10,
  fournisseur_id uuid,
  created_at timestamptz DEFAULT now()
);

-- Emballages
CREATE TABLE IF NOT EXISTS emballages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid DEFAULT auth.uid() NOT NULL,
  nom text NOT NULL,
  unite text DEFAULT 'pièce',
  stock_qty numeric NOT NULL DEFAULT 0,
  prix_unitaire numeric DEFAULT 0,
  seuil_alerte numeric DEFAULT 20,
  created_at timestamptz DEFAULT now()
);

-- Recettes de production
CREATE TABLE IF NOT EXISTS recettes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid DEFAULT auth.uid() NOT NULL,
  produit_id uuid,
  nom text NOT NULL,
  description text,
  rendement numeric DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recette_ingredients (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  recette_id uuid REFERENCES recettes(id) ON DELETE CASCADE,
  matiere_id uuid,
  emballage_id uuid,
  quantite numeric NOT NULL DEFAULT 0,
  type_ingredient text DEFAULT 'matiere' -- 'matiere' ou 'emballage'
);

-- Ordres et historique de production
CREATE TABLE IF NOT EXISTS productions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid DEFAULT auth.uid() NOT NULL,
  recette_id uuid,
  produit_id uuid,
  produit_nom text NOT NULL,
  quantite_produite numeric NOT NULL,
  cout_matiere numeric DEFAULT 0,
  cout_emballage numeric DEFAULT 0,
  cout_main_oeuvre numeric DEFAULT 0,
  cout_total numeric DEFAULT 0,
  notes text,
  date date DEFAULT current_date,
  created_at timestamptz DEFAULT now()
);

-- Règlements Clients (Dépôts / Paiements)
CREATE TABLE IF NOT EXISTS reglements_clients (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid DEFAULT auth.uid() NOT NULL,
  client_id uuid,
  client_nom text NOT NULL,
  vente_id uuid,
  montant numeric NOT NULL,
  mode_paiement text DEFAULT 'espèces', -- 'espèces', 'chèque', 'virement'
  reference text,
  date date DEFAULT current_date,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Règlements Fournisseurs
CREATE TABLE IF NOT EXISTS reglements_fournisseurs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid DEFAULT auth.uid() NOT NULL,
  fournisseur_id uuid,
  fournisseur_nom text NOT NULL,
  achat_id uuid,
  montant numeric NOT NULL,
  mode_paiement text DEFAULT 'espèces',
  reference text,
  date date DEFAULT current_date,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Caisse (Mouvements de trésorerie)
CREATE TABLE IF NOT EXISTS caisse (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid DEFAULT auth.uid() NOT NULL,
  type text NOT NULL, -- 'entree' ou 'sortie'
  categorie text NOT NULL, -- 'vente', 'achat', 'salaire', 'depense', 'apport', 'pret', 'autre'
  montant numeric NOT NULL,
  description text,
  reference_id uuid,
  date date DEFAULT current_date,
  created_at timestamptz DEFAULT now()
);

-- Dépenses courantes
CREATE TABLE IF NOT EXISTS depenses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid DEFAULT auth.uid() NOT NULL,
  categorie text NOT NULL, -- 'loyer', 'electricite', 'transport', 'maintenance', 'autre'
  montant numeric NOT NULL,
  description text,
  date date DEFAULT current_date,
  created_at timestamptz DEFAULT now()
);

-- Apports, Investissements & Prêts
CREATE TABLE IF NOT EXISTS apports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid DEFAULT auth.uid() NOT NULL,
  type text NOT NULL, -- 'apport_personnel', 'investissement', 'pret_recu', 'remboursement_pret'
  montant numeric NOT NULL,
  description text,
  source text,
  date date DEFAULT current_date,
  created_at timestamptz DEFAULT now()
);

-- Personnel (Employés)
CREATE TABLE IF NOT EXISTS personnel (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid DEFAULT auth.uid() NOT NULL,
  nom text NOT NULL,
  poste text,
  tel text,
  salaire_base numeric DEFAULT 0,
  date_embauche date DEFAULT current_date,
  statut text DEFAULT 'actif', -- 'actif' ou 'inactif'
  created_at timestamptz DEFAULT now()
);

-- Salaires & Fiches de paie
CREATE TABLE IF NOT EXISTS salaires (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid DEFAULT auth.uid() NOT NULL,
  employe_id uuid,
  employe_nom text NOT NULL,
  montant numeric NOT NULL,
  mois text NOT NULL, -- format 'YYYY-MM'
  statut text DEFAULT 'paye', -- 'paye' ou 'en_attente'
  date_paiement date DEFAULT current_date,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- ── 3. ROW LEVEL SECURITY (RLS) ──────────────────────────────────
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE fournisseurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE matieres_premieres ENABLE ROW LEVEL SECURITY;
ALTER TABLE emballages ENABLE ROW LEVEL SECURITY;
ALTER TABLE recettes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recette_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE productions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reglements_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE reglements_fournisseurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE caisse ENABLE ROW LEVEL SECURITY;
ALTER TABLE depenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE apports ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE salaires ENABLE ROW LEVEL SECURITY;

-- Politiques de sécurité (Accès par utilisateur)
DO $$ BEGIN
  CREATE POLICY "Users own clients" ON clients FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users own fournisseurs" ON fournisseurs FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users own matieres" ON matieres_premieres FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users own emballages" ON emballages FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users own recettes" ON recettes FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users own productions" ON productions FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users own reglements_clients" ON reglements_clients FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users own reglements_fournisseurs" ON reglements_fournisseurs FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users own caisse" ON caisse FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users own depenses" ON depenses FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users own apports" ON apports FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users own personnel" ON personnel FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users own salaires" ON salaires FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
