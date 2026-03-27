-- SQL Script to Set up Supabase Data Model
-- You need to run this command in your Supabase project's SQL Editor

CREATE TABLE IF NOT EXISTS achats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nom text NOT NULL,
  quantite numeric NOT NULL,
  prix numeric NOT NULL,
  date date NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ventes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nom text NOT NULL,
  quantite numeric NOT NULL,
  prix numeric NOT NULL,
  date date NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable Row Level Security but allow unauthenticated access since we are building a simple interface without auth tokens
-- If you need auth later, change these policies
ALTER TABLE achats ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read achats" ON achats FOR SELECT USING (true);
CREATE POLICY "Allow all insert achats" ON achats FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all delete achats" ON achats FOR DELETE USING (true);
CREATE POLICY "Allow all update achats" ON achats FOR UPDATE USING (true);

CREATE POLICY "Allow all read ventes" ON ventes FOR SELECT USING (true);
CREATE POLICY "Allow all insert ventes" ON ventes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all delete ventes" ON ventes FOR DELETE USING (true);
CREATE POLICY "Allow all update ventes" ON ventes FOR UPDATE USING (true);
