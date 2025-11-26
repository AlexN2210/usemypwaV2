import { useState, useEffect } from 'react';
import { supabase, Post } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Image as ImageIcon, Eye, Clock } from 'lucide-react';
import { translateApeCode, APE_CODE_MAPPING } from '../lib/apeCodeTranslator';

export function PostsPage() {
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<Array<Post & { author_name: string; author_avatar?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState<'post' | 'story'>('post');
  const [selectedApeCode, setSelectedApeCode] = useState<string>('');

  // Harmoniser les valeurs de type d'utilisateur (FR/EN)
  const userType = profile?.user_type as string | undefined;
  const isIndividual = userType === 'individual' || userType === 'particulier';
  const isProfessional = userType === 'professional' || userType === 'professionnel';

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    setLoading(true);

    const { data: postsData, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });

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
    if (!user || !content.trim()) return;
    
    // Pour les particuliers, une catégorie OU une demande générale est requise
    if (isIndividual && !selectedApeCode) {
      alert('Veuillez sélectionner une catégorie ou choisir "Demande générale" pour votre besoin');
      return;
    }

    const expiresAt = postType === 'story'
      ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { error } = await supabase
      .from('posts')
      .insert({
        user_id: user.id,
        content,
        type: postType,
        expires_at: expiresAt,
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

    setContent('');
    setSelectedApeCode('');
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

            {isIndividual && (
              <div className="mb-4">
                <label htmlFor="ape_code" className="block text-sm font-medium text-gray-700 mb-2">
                  Professions concernées (Code APE) <span className="text-red-500">*</span>
                </label>
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

            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition"
              >
                Annuler
              </button>
              <button
                onClick={createPost}
                disabled={!content.trim() || (isIndividual && !selectedApeCode)}
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
