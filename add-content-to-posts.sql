-- Script pour ajouter les champs manquants à la table posts
-- À exécuter dans Supabase (SQL editor)

alter table posts
add column if not exists content text;

alter table posts
add column if not exists expires_at timestamptz;

-- Compteur de vues pour les stories / posts
alter table posts
add column if not exists views integer default 0;

update posts
set views = 0
where views is null;

-- Rendre le champ caption optionnel pour les anciens schémas
alter table posts
alter column caption drop not null;

-- Rendre le champ category optionnel pour les anciens schémas
alter table posts
alter column category drop not null;





