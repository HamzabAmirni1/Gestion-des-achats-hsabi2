-- SQL Script to Set up Supabase Data Model (Updated with Auth & Client fields)
-- You need to run this command in your Supabase project's SQL Editor

-- First, drop the local tables if they exist to start fresh
DROP TABLE IF EXISTS achats CASCADE;
DROP TABLE IF EXISTS ventes CASCADE;

-- Create achats table
CREATE TABLE achats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  nom text NOT NULL,
  quantite numeric NOT NULL,
  prix numeric NOT NULL,
  statut_paiement text DEFAULT 'payé',
  date date NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create ventes table
CREATE TABLE ventes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  client_nom text,
  client_tel text,
  nom text NOT NULL,
  quantite numeric NOT NULL,
  prix numeric NOT NULL,
  statut_paiement text DEFAULT 'payé',
  date date NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE achats ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventes ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for achats
CREATE POLICY "Users can insert their own achats" ON achats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own achats" ON achats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own achats" ON achats FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own achats" ON achats FOR DELETE USING (auth.uid() = user_id);

-- Create RLS Policies for ventes
CREATE POLICY "Users can insert their own ventes" ON ventes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own ventes" ON ventes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own ventes" ON ventes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own ventes" ON ventes FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can only update their own ventes" ON ventes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can only delete their own ventes" ON ventes FOR DELETE USING (auth.uid() = user_id);
