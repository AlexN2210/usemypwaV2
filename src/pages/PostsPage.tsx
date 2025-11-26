import { useState, useEffect } from 'react';
import { supabase, Post } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Image as ImageIcon, Eye, Clock, Sparkles } from 'lucide-react';
import { translateApeCode, APE_CODE_MAPPING } from '../lib/apeCodeTranslator';

export function PostsPage() {
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<Array<Post & { author_name: string; author_avatar?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState<'post' | 'story'>('post');
  const [selectedApeCode, setSelectedApeCode] = useState<string>('');
  const [suggestedCodes, setSuggestedCodes] = useState<string[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Harmoniser les valeurs de type d'utilisateur (FR/EN)
  const userTypeRaw = profile?.user_type as string | undefined;
  const isProfessional = userTypeRaw === 'professional' || userTypeRaw === 'professionnel';
  // Tout utilisateur connecté qui n'est PAS pro est considéré comme particulier ici
  const isIndividual = !!profile && !isProfessional;

  // Suggestions "intelligentes" de codes APE en fonction du texte saisi
  useEffect(() => {
    if (!isIndividual || !content.trim()) {
      setSuggestedCodes([]);
      return;
    }

    const text = content
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const words = Array.from(
      new Set(
        text
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .split(/[^a-z0-9]+/)
          .filter((w) => w.length >= 3)
      )
    );

    const hints: string[] = [];

    // Règles spécifiques pour la création de site internet / web
    if (
      (text.includes('site') && text.includes('internet')) ||
      (text.includes('site') && text.includes('web')) ||
      text.includes('ecommerce') ||
      text.includes('e-commerce') ||
      text.includes('boutique en ligne') ||
      text.includes('site vitrine')
    ) {
      // 62.01Z : Programmation informatique, 62.02Z : Conseil informatique
      if (APE_CODE_MAPPING['62.01Z']) hints.push('62.01Z');
      if (APE_CODE_MAPPING['62.02Z']) hints.push('62.02Z');
      // Optionnel : pub / marketing pour visibilité
      if (APE_CODE_MAPPING['73.11Z']) hints.push('73.11Z');
    }

    if (words.length === 0 && hints.length === 0) {
      setSuggestedCodes([]);
      return;
    }

    const scores: Array<{ code: string; score: number }> = [];

    for (const [code, label] of Object.entries(APE_CODE_MAPPING)) {
      const labelNorm = label
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      let score = 0;
      for (const w of words) {
        if (labelNorm.includes(w)) {
          score += 1;
        }
      }
      if (score > 0) {
        scores.push({ code, score });
      }
    }

    scores.sort((a, b) => b.score - a.score);
    const topFromText = scores.slice(0, 5).map((s) => s.code);

    // Combiner : d'abord les hints spécifiques, puis les meilleurs scores, en supprimant les doublons
    const combined = Array.from(new Set([...hints, ...topFromText])).slice(0, 3);
    setSuggestedCodes(combined);
  }, [content, isIndividual]);

  useEffect(() => {
    // Recharger les posts à chaque fois que l'utilisateur ou son type change
    loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, userTypeRaw]);

  const loadPosts = async () => {
    if (!user || !profile) {
      setPosts([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    let query = supabase.from('posts').select('*');

    if (isIndividual) {
      // Particulier : ne voir que ses propres demandes
      query = query.eq('user_id', user.id);
    } else if (isProfessional) {
      // Professionnel : ne voir que ses propres posts de promotion (ape_code null)
      query = query.eq('user_id', user.id).is('ape_code', null);
    } else {
      // Type d'utilisateur inconnu : ne rien afficher
      setPosts([]);
      setLoading(false);
      return;
    }

    const { data: postsData, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading posts:', error);
      setLoading(false);
      return;
    }

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

    const validPosts = enrichedPosts.filter(post => {
      if (post.type === 'story' && post.expires_at) {
        return new Date(post.expires_at) > new Date();
      }
      return true;
    });

    setPosts(validPosts);
    setLoading(false);
  };

  const createPost = async () => {
    if (!user || !title.trim() || !content.trim()) return;
    
    // Pour les particuliers, une catégorie OU une demande générale est requise
    if (isIndividual && !selectedApeCode) {
      alert('Veuillez sélectionner une catégorie ou choisir "Demande générale" pour votre besoin');
      return;
    }

    const expiresAt = postType === 'story'
      ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      : null;

    let imageUrl: string | undefined;

    if (imageFile) {
      try {
        const ext = imageFile.name.split('.').pop() || 'jpg';
        const filePath = `posts/${user.id}/${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(filePath, imageFile, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          console.error('Error uploading image:', uploadError);
        } else {
          const { data } = supabase.storage.from('posts').getPublicUrl(filePath);
          imageUrl = data.publicUrl;
        }
      } catch (e) {
        console.error('Unexpected error while uploading image:', e);
      }
    }

    const { error } = await supabase
      .from('posts')
      .insert({
        user_id: user.id,
        caption: title.trim(),
        content,
        type: postType,
        expires_at: expiresAt,
        image_url: imageUrl,
        // Pour les particuliers :
        // - si une catégorie précise est choisie → stocker le code APE
        // - si "général" est choisi → ape_code null (visible comme demande générale)
        ape_code:
          isIndividual
            ? selectedApeCode === 'GENERAL'
              ? null
              : selectedApeCode
            : null,
      });

    if (error) {
      console.error('Error creating post:', error);
      return;
    }

    setTitle('');
    setContent('');
    setSelectedApeCode('');
    setImageFile(null);
    setImagePreview(null);
    setShowCreateModal(false);
    loadPosts();
  };

  const incrementViews = async (postId: string) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    await supabase
      .from('posts')
      .update({ views: post.views + 1 })
      .eq('id', postId);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'À l\'instant';
    if (seconds < 3600) return `Il y a ${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `Il y a ${Math.floor(seconds / 3600)}h`;
    return `Il y a ${Math.floor(seconds / 86400)}j`;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 bg-white">
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-cyan-600 transition flex items-center justify-center gap-2 shadow-lg"
        >
          <Plus className="w-5 h-5" />
          Créer un post
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-20">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <ImageIcon className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Aucun post pour le moment</h3>
            <p className="text-gray-500">Soyez le premier à partager du contenu</p>
          </div>
        ) : (
          <div className="space-y-4 p-4">
            {posts.map((post) => (
              <div
                key={post.id}
                onClick={() => incrementViews(post.id)}
                className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition"
              >
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-white font-bold">
                      {post.author_avatar ? (
                        <img
                          src={post.author_avatar}
                          alt={post.author_name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        post.author_name.charAt(0).toUpperCase()
                      )}
                    </div>

                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800">{post.author_name}</h4>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>{formatTimeAgo(post.created_at)}</span>
                        {post.type === 'story' && (
                          <span className="px-2 py-0.5 bg-pink-100 text-pink-700 rounded-full text-xs font-medium">
                            Story
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {post.caption && (
                    <h5 className="text-sm sm:text-base font-semibold text-gray-900 mb-1">
                      {post.caption}
                    </h5>
                  )}

                  {post.content && (
                    <p className="text-gray-700 mb-3">{post.content}</p>
                  )}

                  {post.ape_code && (
                    <div className="mb-3">
                      <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        {translateApeCode(post.ape_code)} ({post.ape_code})
                      </span>
                    </div>
                  )}

                  {post.image_url && (
                    <img
                      src={post.image_url}
                      alt="Post"
                      className="w-full rounded-lg mb-3"
                    />
                  )}

                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      <span>{post.views}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Créer un post</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setPostType('post')}
                  className={`flex-1 py-2 rounded-lg font-medium transition ${
                    postType === 'post'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Post
                </button>
                <button
                  onClick={() => setPostType('story')}
                  className={`flex-1 py-2 rounded-lg font-medium transition ${
                    postType === 'story'
                      ? 'bg-pink-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Story (24h)
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                {isIndividual ? 'Titre de votre projet' : 'Titre du post'}
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder={
                  isIndividual
                    ? 'Ex: Création d’un site vitrine pour mon commerce'
                    : 'Ex: Promo spéciale sur les rénovations de salle de bain'
                }
              />
            </div>

            {isIndividual && (
              <div className="mb-4">
                <label htmlFor="ape_code" className="block text-sm font-medium text-gray-700 mb-2">
                  Professions concernées (Code APE) <span className="text-red-500">*</span>
                </label>
                <div className="mb-2 flex flex-wrap gap-2 items-center text-xs">
                  <span className="inline-flex items-center gap-1 text-gray-500">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    Suggestions :
                  </span>
                  {suggestedCodes.length === 0 && (
                    <span className="text-[11px] text-gray-400">
                      Saisissez votre besoin pour voir des professions suggérées
                    </span>
                  )}
                  {suggestedCodes.map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setSelectedApeCode(code)}
                      className={`px-2 py-1 rounded-full border text-xs ${
                        selectedApeCode === code
                          ? 'bg-blue-500 text-white border-blue-500'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}
                    >
                      {translateApeCode(code)} ({code})
                    </button>
                  ))}
                </div>
                <select
                  id="ape_code"
                  value={selectedApeCode}
                  onChange={(e) => setSelectedApeCode(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  required
                >
                  <option value="">Sélectionnez une ou plusieurs professions</option>
                  <option value="GENERAL">Demande générale (toutes professions)</option>
                  {Object.entries(APE_CODE_MAPPING)
                    .sort(([, a], [, b]) => a.localeCompare(b))
                    .map(([code, activity]) => (
                      <option key={code} value={code}>
                        {activity} ({code})
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="mb-4">
              <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
                {isIndividual
                  ? 'Décrivez votre besoin'
                  : isProfessional
                  ? 'Promouvez vos services (ex: Promo sur les concombres aujourd\'hui et demain)'
                  : 'Contenu'}
              </label>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                placeholder={
                  isIndividual
                    ? 'Ex: Je souhaite refaire ma terrasse...'
                    : isProfessional
                    ? 'Ex: Promo sur les concombres aujourd\'hui et demain !'
                    : 'Partagez quelque chose...'
                }
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Photo (optionnel)
              </label>
              {imagePreview && (
                <div className="mb-2">
                  <img
                    src={imagePreview}
                    alt="Aperçu"
                    className="w-full rounded-lg object-cover border border-gray-200"
                  />
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setImageFile(file);
                  if (file) {
                    const url = URL.createObjectURL(file);
                    setImagePreview(url);
                  } else {
                    setImagePreview(null);
                  }
                }}
                className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition"
              >
                Annuler
              </button>
              <button
                onClick={createPost}
                disabled={!title.trim() || !content.trim() || (isIndividual && !selectedApeCode)}
                className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-cyan-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Publier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
