import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validation et formatage de l'URL Supabase
let formattedUrl = supabaseUrl;
if (supabaseUrl && !supabaseUrl.startsWith('http')) {
  // Si l'URL n'a pas de protocole, ajouter https://
  formattedUrl = `https://${supabaseUrl}`;
}

if (!formattedUrl || !supabaseAnonKey) {
  console.error('❌ Configuration Supabase manquante:');
  console.error('   VITE_SUPABASE_URL:', formattedUrl || 'NON DÉFINIE');
  console.error('   VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ Définie' : '❌ NON DÉFINIE');
  throw new Error('Configuration Supabase manquante. Vérifiez vos variables d\'environnement VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.');
}

// Vérifier que l'URL est valide
try {
  new URL(formattedUrl);
} catch (error) {
  console.error('❌ URL Supabase invalide:', formattedUrl);
  throw new Error(`URL Supabase invalide: ${formattedUrl}. Format attendu: https://votre-projet.supabase.co`);
}

export const supabase = createClient(formattedUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Gestion des erreurs de connexion
    flowType: 'pkce'
  },
  // Configuration globale pour éviter les blocages
  global: {
    headers: {
      'apikey': supabaseAnonKey
    }
  }
});

// Log de vérification au démarrage
console.log('🔧 Configuration Supabase:', {
  url: formattedUrl,
  hasAnonKey: !!supabaseAnonKey,
  keyLength: supabaseAnonKey?.length || 0
});

export type UserType = 'professional' | 'individual';
export type MatchAction = 'like' | 'pass' | 'super_like';
export type PostType = 'post' | 'story';

export interface Profile {
  id: string;
  user_type: UserType;
  full_name: string;
  avatar_url?: string;
  bio?: string;
  phone?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  postal_code?: string;
  points: number;
  created_at: string;
  updated_at: string;
}

export interface ProfessionalProfile {
  id: string;
  user_id: string;
  company_name?: string;
  siret?: string;
  website?: string;
  category?: string;
  ape_code?: string; // Code APE (Activité Principale Exercée)
  tags: string[];
  verified: boolean;
  created_at: string;
}

export interface Match {
  id: string;
  user_id: string;
  target_user_id: string;
  action: MatchAction;
  matched: boolean;
  post_id?: string; // ID du post si le match concerne un post
  created_at: string;
}

export interface Post {
  id: string;
  user_id: string;
  caption?: string;
  content?: string;
  image_url?: string;
  type: PostType;
  views: number;
  expires_at?: string;
  ape_code?: string; // Code APE choisi par le particulier pour sa demande
  created_at: string;
}

export interface FilterPreferences {
  id: string;
  user_id: string;
  max_distance: number;
  categories: string[];
  updated_at: string;
}
