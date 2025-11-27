import { useState, useEffect } from 'react';
import { MapPin, Briefcase, Star, Heart, X, Zap, FileText } from 'lucide-react';
import { Profile, ProfessionalProfile, Post } from '../../lib/supabase';
import { supabase } from '../../lib/supabase';

interface SwipeCardProps {
  profile: Profile;
  professionalProfile?: ProfessionalProfile;
  onSwipe: (action: 'like' | 'pass' | 'super_like') => void;
  distance?: number;
  hasStory?: boolean;
}

export function SwipeCard({ profile, professionalProfile, onSwipe, distance, hasStory }: SwipeCardProps) {
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [professionalPosts, setProfessionalPosts] = useState<Post[]>([]);

  // Charger les posts du professionnel (promotions/services)
  useEffect(() => {
    const loadProfessionalPosts = async () => {
      if (!profile.id) return;

      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', profile.id)
        .is('ape_code', null) // Seulement les posts sans code APE (promotions des pros)
        .order('created_at', { ascending: false })
        .limit(3); // Limiter à 3 posts récents

      if (error) {
        console.error('Error loading professional posts:', error);
        return;
      }

      setProfessionalPosts(data || []);
    };

    loadProfessionalPosts();
  }, [profile.id]);

  // Gestion des événements tactiles (mobile)
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    setDragOffset({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const threshold = 80; // Seuil réduit pour mobile
    if (Math.abs(dragOffset.x) > threshold) {
      if (dragOffset.x > 0) {
        onSwipe('like');
      } else {
        onSwipe('pass');
      }
    } else if (dragOffset.y < -threshold) {
      onSwipe('super_like');
    }

    setDragOffset({ x: 0, y: 0 });
  };

  // Gestion des événements souris (desktop)
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setDragOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const threshold = 100;
    if (Math.abs(dragOffset.x) > threshold) {
      if (dragOffset.x > 0) {
        onSwipe('like');
      } else {
        onSwipe('pass');
      }
    } else if (dragOffset.y < -threshold) {
      onSwipe('super_like');
    }

    setDragOffset({ x: 0, y: 0 });
  };

  const rotation = dragOffset.x * 0.1;
  const opacity = 1 - Math.abs(dragOffset.x) * 0.002;

  return (
    <div
      className="absolute inset-0 cursor-grab active:cursor-grabbing touch-none select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: `translate(${dragOffset.x}px, ${dragOffset.y}px) rotate(${rotation}deg)`,
        opacity,
        transition: isDragging ? 'none' : 'all 0.3s ease',
        touchAction: 'none', // Empêche le scroll pendant le drag
      }}
    >
      <div className="bg-white rounded-xl sm:rounded-3xl shadow-2xl overflow-hidden h-full flex flex-col">
        {/* Image/Photo - Très réduite pour mobile */}
        <div className="relative h-[35%] sm:h-2/3 bg-gradient-to-br from-blue-400 to-cyan-400 flex-shrink-0">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.full_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-white text-3xl sm:text-6xl font-bold">
                {profile.full_name.charAt(0).toUpperCase()}
              </div>
            </div>
          )}

          {/* Indicateurs de swipe - Taille réduite mobile */}
          {dragOffset.x > 50 && (
            <div className="absolute inset-0 bg-green-500 bg-opacity-30 flex items-center justify-center">
              <Heart className="w-16 h-16 sm:w-32 sm:h-32 text-green-500" fill="currentColor" />
            </div>
          )}

          {dragOffset.x < -50 && (
            <div className="absolute inset-0 bg-red-500 bg-opacity-30 flex items-center justify-center">
              <X className="w-16 h-16 sm:w-32 sm:h-32 text-red-500" strokeWidth={3} />
            </div>
          )}

          {dragOffset.y < -50 && (
            <div className="absolute inset-0 bg-blue-500 bg-opacity-30 flex items-center justify-center">
              <Zap className="w-16 h-16 sm:w-32 sm:h-32 text-blue-500" fill="currentColor" />
            </div>
          )}

          {professionalProfile?.verified && (
            <div className="absolute top-2 right-2 sm:top-4 sm:right-4 bg-blue-500 p-1 sm:p-2 rounded-full shadow-lg">
              <Star className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white" fill="currentColor" />
            </div>
          )}
        </div>

        {/* Contenu - Très compact pour mobile */}
        <div className="flex-1 p-2.5 sm:p-6 flex flex-col justify-between overflow-y-auto min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="flex items-center justify-between mb-1 sm:mb-2">
              <h2 className="text-lg sm:text-3xl font-bold text-gray-800">
                {profile.full_name}
              </h2>
              {hasStory && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 text-white text-[10px] sm:text-xs font-semibold shadow-md">
                  <span className="inline-flex h-2 w-2 rounded-full bg-white mr-0.5" />
                  Story
                </div>
              )}
            </div>

            {professionalProfile && (
              <div className="space-y-1 sm:space-y-2 mb-1.5 sm:mb-4">
                <div className="flex items-center gap-1.5 sm:gap-2 text-gray-600">
                  <Briefcase className="w-3 h-3 sm:w-5 sm:h-5 flex-shrink-0" />
                  <span className="font-semibold text-xs sm:text-base truncate">
                    {professionalProfile.company_name || 'Indépendant'}
                  </span>
                </div>
                {professionalProfile.category && (
                  <span className="inline-block px-2 sm:px-3 py-0.5 sm:py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                    {professionalProfile.category}
                  </span>
                )}
              </div>
            )}

            {distance !== undefined && (
              <div className="flex items-center gap-1.5 sm:gap-2 text-gray-500 mb-1 sm:mb-3">
                <MapPin className="w-3 h-3 sm:w-5 sm:h-5 flex-shrink-0" />
                <span className="text-xs sm:text-base">
                  {distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`}
                </span>
              </div>
            )}

            {/* Coordonnées du professionnel (affichées pour les particuliers) */}
            {profile.address && (
              <div className="flex items-start gap-1.5 sm:gap-2 text-gray-600 mb-1 sm:mb-3 text-xs sm:text-sm">
                <MapPin className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium">{profile.address}</p>
                  {(profile.postal_code || profile.city) && (
                    <p className="text-gray-500">
                      {profile.postal_code} {profile.city}
                    </p>
                  )}
                  {profile.phone && (
                    <p className="text-blue-600 mt-1">📞 {profile.phone}</p>
                  )}
                </div>
              </div>
            )}

            {profile.bio && (
              <p className="text-gray-600 leading-relaxed line-clamp-1 sm:line-clamp-3 text-xs sm:text-base mb-1 sm:mb-0">
                {profile.bio}
              </p>
            )}

            {/* Posts/Promotions du professionnel */}
            {professionalPosts.length > 0 && (
              <div className="mt-2 sm:mt-4 space-y-2">
                <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-gray-700">
                  <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>Promotions & Services</span>
                </div>
                {professionalPosts.map((post) => {
                  const isStory = post.type === 'story';
                  return (
                    <div
                      key={post.id}
                      className={`rounded-lg p-2 sm:p-3 border ${
                        isStory
                          ? 'bg-gradient-to-r from-pink-50 via-orange-50 to-amber-50 border-pink-100'
                          : 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-100'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed flex-1">
                          {post.content}
                        </p>
                        {isStory && (
                          <span className="ml-2 px-2 py-0.5 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 text-[10px] sm:text-xs text-white font-semibold">
                            Story 24h
                          </span>
                        )}
                      </div>
                      {post.created_at && (
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(post.created_at).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {professionalProfile?.tags && professionalProfile.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 sm:gap-2 mt-1.5 sm:mt-4">
                {professionalProfile.tags.slice(0, 2).map((tag, index) => (
                  <span
                    key={index}
                    className="px-1.5 sm:px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Boutons d'action - Toujours visibles en bas */}
          <div className="flex justify-center gap-2 sm:gap-4 mt-2 sm:mt-6 pt-2 sm:pt-4 border-t border-gray-100 flex-shrink-0">
            <button
              onClick={() => onSwipe('pass')}
              className="w-11 h-11 sm:w-16 sm:h-16 rounded-full bg-white border-2 border-red-500 flex items-center justify-center active:bg-red-50 hover:bg-red-50 transition shadow-lg touch-manipulation"
              aria-label="Passer"
            >
              <X className="w-5 h-5 sm:w-8 sm:h-8 text-red-500" strokeWidth={3} />
            </button>

            <button
              onClick={() => onSwipe('super_like')}
              className="w-11 h-11 sm:w-16 sm:h-16 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center active:from-blue-600 active:to-cyan-600 hover:from-blue-600 hover:to-cyan-600 transition shadow-lg touch-manipulation"
              aria-label="Super like"
            >
              <Zap className="w-5 h-5 sm:w-8 sm:h-8 text-white" fill="currentColor" />
            </button>

            <button
              onClick={() => onSwipe('like')}
              className="w-11 h-11 sm:w-16 sm:h-16 rounded-full bg-white border-2 border-green-500 flex items-center justify-center active:bg-green-50 hover:bg-green-50 transition shadow-lg touch-manipulation"
              aria-label="Aimer"
            >
              <Heart className="w-5 h-5 sm:w-8 sm:h-8 text-green-500" fill="currentColor" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
