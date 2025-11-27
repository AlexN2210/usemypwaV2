import { useState, useEffect } from 'react';
import { supabase, Profile, ProfessionalProfile, MatchAction, Post } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { SwipeCard } from '../components/Swipe/SwipeCard';
import { PostSwipeCard } from '../components/Swipe/PostSwipeCard';
import { Loader2, Users, FileText } from 'lucide-react';

export function HomePage() {
  const { user, profile } = useAuth();
  const [profiles, setProfiles] = useState<
    Array<{
      profile: Profile;
      professionalProfile?: ProfessionalProfile;
      distance?: number;
      hasStory?: boolean;
    }>
  >([]);
  const [posts, setPosts] = useState<Array<Post & { author_name: string; author_avatar?: string }>>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [swipedPosts, setSwipedPosts] = useState<string[]>([]);

  // Harmoniser les valeurs possibles de user_type entre la base et le front
  // On force ici le type en string pour éviter les conflits de types TS
  const userType = profile?.user_type as string | undefined;

  const isProfessional =
    userType === 'professional' ||
    userType === 'professionnel';

  const isIndividual =
    userType === 'individual' ||
    userType === 'particulier';

  useEffect(() => {
    // Attendre que le profil soit chargé avant de charger les données
    if (!user || !profile) {
      setLoading(true);
      return;
    }

    if (isProfessional) {
      loadPosts();
      loadSwipedPosts();
    } else if (isIndividual) {
      loadProfiles();
    } else {
      // Si le type d'utilisateur n'est pas défini, arrêter le chargement
      setLoading(false);
    }
  }, [user?.id, profile?.id, profile?.user_type]);

  const loadSwipedPosts = async () => {
    if (!user) return;

    // Pour les pros : charger les posts déjà swipés
    const { data, error } = await supabase
      .from('matches')
      .select('post_id')
      .eq('user_id', user.id)
      .not('post_id', 'is', null);

    if (error) {
      console.error('❌ Erreur lors du chargement des posts swipés:', error);
      return;
    }

    if (data) {
      setSwipedPosts(data.map(m => m.post_id).filter(Boolean) as string[]);
    }
  };

  const loadProfiles = async () => {
    if (!user || !profile || !isIndividual) {
      setLoading(false);
      return;
    }
    setLoading(true);
    
    console.log('🔍 Chargement des profils pour particulier:', user.id);

    // D'abord, récupérer tous les posts du particulier
    const { data: userPosts, error: postsError } = await supabase
      .from('posts')
      .select('id')
      .eq('user_id', user.id);

    if (postsError) {
      console.error('Error loading user posts:', postsError);
      setLoading(false);
      return;
    }

    if (!userPosts || userPosts.length === 0) {
      console.log('ℹ️ Aucun post trouvé pour ce particulier');
      setProfiles([]);
      setLoading(false);
      return;
    }

    console.log(`📝 ${userPosts.length} post(s) trouvé(s) pour ce particulier`);

    const postIds = userPosts.map(p => p.id);

    // Ensuite, récupérer les matches où des pros ont liké les posts du particulier
    // Note: user_id = pro qui a liké, target_user_id = particulier (propriétaire du post)
    const { data: matchesData, error: matchesError } = await supabase
      .from('matches')
      .select('user_id, post_id')
      .not('post_id', 'is', null)
      .eq('target_user_id', user.id)
      .in('post_id', postIds);

    if (matchesError) {
      console.error('Error loading matches:', matchesError);
      setLoading(false);
      return;
    }

    // Récupérer les IDs des pros qui ont liké les posts du particulier
    // user_id dans matches est le pro qui a liké
    const professionalIds = matchesData
      ?.map(m => m.user_id)
      .filter((id, index, self) => self.indexOf(id) === index) || [];

    if (professionalIds.length === 0) {
      console.log('ℹ️ Aucun professionnel n\'a encore liké vos posts');
      setProfiles([]);
      setLoading(false);
      return;
    }

    console.log(`👥 ${professionalIds.length} professionnel(s) intéressé(s) trouvé(s)`);

    const { data: profilesData, error } = await supabase
      .from('profiles')
      .select('*')
      .in('id', professionalIds)
      .in('user_type', ['professional', 'professionnel']);

    if (error) {
      console.error('Error loading profiles:', error);
      setLoading(false);
      return;
    }

    const nowIso = new Date().toISOString();

    const enrichedProfiles = await Promise.all(
      (profilesData || []).map(async (prof) => {
        const { data: professionalData } = await supabase
          .from('professional_profiles')
          .select('*')
          .eq('user_id', prof.id)
          .maybeSingle();

        // Vérifier si le pro a une story active
        const { data: storyData } = await supabase
          .from('posts')
          .select('id, type, expires_at')
          .eq('user_id', prof.id)
          .eq('type', 'story')
          .gt('expires_at', nowIso)
          .limit(1);

        let distance: number | undefined;
        if (profile?.latitude && profile?.longitude && prof.latitude && prof.longitude) {
          distance = calculateDistance(
            profile.latitude,
            profile.longitude,
            prof.latitude,
            prof.longitude
          );
        }

        return {
          profile: prof,
          professionalProfile: professionalData || undefined,
          distance,
          hasStory: !!(storyData && storyData.length > 0),
        };
      })
    );

    console.log(`✅ ${enrichedProfiles.length} profil(s) chargé(s) avec succès`);
    setProfiles(enrichedProfiles);
    setLoading(false);
  };

  const loadPosts = async () => {
    if (!user || !isProfessional) return;
    setLoading(true);

    // Récupérer le code APE du professionnel
    const { data: professionalData } = await supabase
      .from('professional_profiles')
      .select('ape_code')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!professionalData?.ape_code) {
      console.log('Aucun code APE trouvé pour ce professionnel');
      setPosts([]);
      setLoading(false);
      return;
    }

    // Charger les posts qui correspondent au code APE du professionnel
    // ou les demandes générales (ape_code null),
    // en excluant toujours les posts du professionnel lui-même
    const { data: postsData, error } = await supabase
      .from('posts')
      .select('*')
      .neq('user_id', user.id)
      .or(`ape_code.eq.${professionalData.ape_code},ape_code.is.null`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading posts:', error);
      setLoading(false);
      return;
    }

    // Enrichir les posts avec les informations de l'auteur
    const enrichedPosts = await Promise.all(
      (postsData || []).map(async (post) => {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', post.user_id)
          .maybeSingle();

        return {
          ...post,
          author_name: profileData?.full_name || 'Utilisateur',
          author_avatar: profileData?.avatar_url,
        };
      })
    );

    // Filtrer les posts déjà swipés
    const unswipedPosts = enrichedPosts.filter(
      p => !swipedPosts.includes(p.id)
    );

    setPosts(unswipedPosts);
    setLoading(false);
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleSwipe = async (action: MatchAction) => {
    if (!user) return;

    if (isProfessional) {
      // Pour les pros : swiper sur les posts
      if (currentIndex >= posts.length) return;

      const currentPost = posts[currentIndex];

      // On tente d'enregistrer le match, mais même en cas d'erreur (RLS, etc.)
      // on fait avancer le swipe pour ne pas bloquer l'UX.
      const { error } = await supabase
        .from('matches')
        .insert({
          user_id: user.id,
          target_user_id: currentPost.user_id,
          action,
          matched: false,
          post_id: currentPost.id,
        });

      if (error) {
        console.error('Error creating match (non bloquant pour le swipe):', error);
      }

      if (action === 'like') {
        // Le pro est intéressé par la demande
        console.log(`Vous êtes intéressé par la demande de ${currentPost.author_name}`);
      }

      setSwipedPosts([...swipedPosts, currentPost.id]);
      setCurrentIndex(currentIndex + 1);
    } else if (isIndividual) {
      // Pour les particuliers : voir les pros qui ont liké leurs posts
      if (currentIndex >= profiles.length) return;
      setCurrentIndex(currentIndex + 1);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (isProfessional) {
    if (currentIndex >= posts.length) {
      return (
        <div className="flex flex-col items-center justify-center h-full px-8 text-center">
          <FileText className="w-20 h-20 text-gray-300 mb-4" />
          <h2 className="text-2xl font-bold text-gray-700 mb-2">Plus de demandes pour le moment</h2>
          <p className="text-gray-500">Revenez plus tard pour découvrir de nouvelles demandes</p>
          <button
            onClick={() => {
              setCurrentIndex(0);
              loadPosts();
            }}
            className="mt-6 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-cyan-600 transition shadow-lg"
          >
            Recharger
          </button>
        </div>
      );
    }

    const currentPost = posts[currentIndex];

    return (
      <div className="h-full flex items-center justify-center p-2 sm:p-4">
        <div className="w-full max-w-md">
          <PostSwipeCard post={currentPost} onSwipe={handleSwipe} />
        </div>
      </div>
    );
  }

  if (isIndividual) {
    if (!loading && profiles.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full px-8 text-center">
          <Users className="w-20 h-20 text-gray-300 mb-4" />
          <h2 className="text-2xl font-bold text-gray-700 mb-2">Aucun professionnel intéressé pour le moment</h2>
          <p className="text-gray-500 mb-2">Les professionnels qui s'intéressent à vos demandes apparaîtront ici</p>
          <p className="text-sm text-gray-400 mb-4">Créez des posts avec des catégories pour recevoir des réponses de professionnels</p>
          <button
            onClick={() => {
              setCurrentIndex(0);
              loadProfiles();
            }}
            className="mt-6 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-cyan-600 transition shadow-lg"
          >
            Recharger
          </button>
        </div>
      );
    }

    if (currentIndex >= profiles.length && profiles.length > 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full px-8 text-center">
          <Users className="w-20 h-20 text-gray-300 mb-4" />
          <h2 className="text-2xl font-bold text-gray-700 mb-2">Plus de professionnels pour le moment</h2>
          <p className="text-gray-500">Vous avez vu tous les professionnels intéressés</p>
          <button
            onClick={() => {
              setCurrentIndex(0);
              loadProfiles();
            }}
            className="mt-6 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-cyan-600 transition shadow-lg"
          >
            Recharger
          </button>
        </div>
      );
    }

    const currentProfile = profiles[currentIndex];

    return (
      <div className="relative h-full p-0.5 sm:p-4">
        <div className="max-w-md mx-auto h-full relative">
          <SwipeCard
            profile={currentProfile.profile}
            professionalProfile={currentProfile.professionalProfile}
            distance={currentProfile.distance}
            hasStory={currentProfile.hasStory}
            onSwipe={handleSwipe}
          />
        </div>
      </div>
    );
  }

  // Si le type d'utilisateur n'est pas défini
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <p className="text-gray-500">Chargement de votre profil...</p>
      </div>
    </div>
  );
}
