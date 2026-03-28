-- FULL DATABASE SETUP FOR BRASTI PLATFORM
-- Run this in your Supabase SQL Editor

-- 1. CLEANUP (Careful: this deletes existing data if you want a fresh start)
DROP TABLE IF EXISTS achats CASCADE;
DROP TABLE IF EXISTS ventes CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS company_info CASCADE;

-- 2. CREATE TABLES
CREATE TABLE achats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid DEFAULT auth.uid() NOT NULL,
  nom text NOT NULL,
  quantite numeric NOT NULL,
  prix numeric NOT NULL,
  statut_paiement text DEFAULT 'payé',
  date date DEFAULT current_date NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE ventes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid DEFAULT auth.uid() NOT NULL,
  client_nom text,
  client_tel text,
  nom text NOT NULL,
  quantite numeric NOT NULL,
  prix numeric NOT NULL,
  statut_paiement text DEFAULT 'payé',
  date date DEFAULT current_date NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE products (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid DEFAULT auth.uid() NOT NULL,
  nom text NOT NULL,
  prix numeric NOT NULL,
  description text,
  features text[], -- tags Array
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid DEFAULT auth.uid() NOT NULL,
  sender text NOT NULL, -- 'customer' or 'admin'
  content text NOT NULL,
  is_bot boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE company_info (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid DEFAULT auth.uid() NOT NULL,
  phone text DEFAULT '0555 00 00 00',
  email text DEFAULT 'contact@brasti.com'
);

-- 3. ENABLE RLS (Row Level Security)
ALTER TABLE achats ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventes ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_info ENABLE ROW LEVEL SECURITY;

-- 4. CREATE POLICIES (Users only see their own data)
CREATE POLICY "Users view own achats" ON achats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own achats" ON achats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own achats" ON achats FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own achats" ON achats FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users view own ventes" ON ventes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own ventes" ON ventes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own ventes" ON ventes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own ventes" ON ventes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users view own products" ON products FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own products" ON products FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own products" ON products FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users view own messages" ON messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own messages" ON messages FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own company" ON company_info FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own company" ON company_info FOR ALL USING (auth.uid() = user_id);
