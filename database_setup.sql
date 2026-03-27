-- SQL Script to Set up Supabase Data Model (Updated with Auth & Client fields)
-- You need to run this command in your Supabase project's SQL Editor

-- Drop tables if they already exist so we can recreate them with the new schema easily
DROP TABLE IF EXISTS achats CASCADE;
DROP TABLE IF EXISTS ventes CASCADE;

CREATE TABLE achats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid DEFAULT auth.uid() NOT NULL,
  nom text NOT NULL,
  quantite numeric NOT NULL,
  prix numeric NOT NULL,
  date date NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE ventes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid DEFAULT auth.uid() NOT NULL,
  client_nom text,
  client_tel text,
  nom text NOT NULL, -- "what he bought"
  quantite numeric NOT NULL,
  prix numeric NOT NULL,
  date date NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE achats ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventes ENABLE ROW LEVEL SECURITY;

-- Security Policies so each user only sees their own data
CREATE POLICY "Users can only view their own achats" ON achats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can only insert their own achats" ON achats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can only update their own achats" ON achats FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can only delete their own achats" ON achats FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can only view their own ventes" ON ventes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can only insert their own ventes" ON ventes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can only update their own ventes" ON ventes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can only delete their own ventes" ON ventes FOR DELETE USING (auth.uid() = user_id);
