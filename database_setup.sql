-- FINAL DATABASE SCHEMA FOR BRASTI CLEANING PRODUCTION
-- Run this in your Supabase SQL Editor

-- 1. CLEANUP
DROP TABLE IF EXISTS achats CASCADE;
DROP TABLE IF EXISTS ventes CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS messages CASCADE;

-- 2. CREATE TABLES
CREATE TABLE products (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid DEFAULT auth.uid() NOT NULL,
  nom text NOT NULL,
  prix_unitaire numeric NOT NULL DEFAULT 0,
  stock_qty numeric NOT NULL DEFAULT 0,
  description text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE achats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid DEFAULT auth.uid() NOT NULL,
  product_id uuid REFERENCES products(id),
  nom text NOT NULL, -- Backwards compatibility or custom items
  quantite numeric NOT NULL,
  prix numeric NOT NULL, -- Unit price
  total_prix numeric GENERATED ALWAYS AS (quantite * prix) STORED,
  date date DEFAULT current_date NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE ventes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid DEFAULT auth.uid() NOT NULL,
  product_id uuid REFERENCES products(id),
  client_nom text,
  nom text NOT NULL,
  quantite numeric NOT NULL,
  prix numeric NOT NULL, -- Sale unit price
  total_prix numeric GENERATED ALWAYS AS (quantite * prix) STORED,
  date date DEFAULT current_date NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid DEFAULT auth.uid() NOT NULL,
  sender text NOT NULL,
  content text NOT NULL,
  is_bot boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- 3. ENABLE RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE achats ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventes ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 4. CREATE POLICIES
CREATE POLICY "Users own products" ON products FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own achats" ON achats FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own ventes" ON ventes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own messages" ON messages FOR ALL USING (auth.uid() = user_id);

-- 5. FUNCTION TO UPDATE STOCK AUTOMATICALLY
-- Increase stock on Achat
CREATE OR REPLACE FUNCTION update_stock_on_achat() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    UPDATE products SET stock_qty = stock_qty + NEW.quantite WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_stock_achat
AFTER INSERT ON achats
FOR EACH ROW EXECUTE FUNCTION update_stock_on_achat();

-- Decrease stock on Vente
CREATE OR REPLACE FUNCTION update_stock_on_vente() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    UPDATE products SET stock_qty = stock_qty - NEW.quantite WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_stock_vente
AFTER INSERT ON ventes
FOR EACH ROW EXECUTE FUNCTION update_stock_on_vente();
