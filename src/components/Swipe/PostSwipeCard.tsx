import { useState } from 'react';
import { MapPin, Clock, User } from 'lucide-react';
import { Post, Profile } from '../../lib/supabase';
import { translateApeCode } from '../../lib/apeCodeTranslator';

interface PostSwipeCardProps {
  post: Post & { author_name: string; author_avatar?: string };
  onSwipe: (action: 'like' | 'pass' | 'super_like') => void;
}

export function PostSwipeCard({ post, onSwipe }: PostSwipeCardProps) {
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

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

    const threshold = 80;
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
    <div
      className="relative w-full h-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100"
      style={{
        transform: `translate(${dragOffset.x}px, ${dragOffset.y}px) rotate(${dragOffset.x * 0.1}deg)`,
        transition: isDragging ? 'none' : 'transform 0.3s ease-out',
        touchAction: 'none',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex flex-col h-full">
        {/* Header avec auteur */}
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-cyan-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-white font-bold flex-shrink-0">
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
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-800 truncate">{post.author_name}</h3>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Clock className="w-3 h-3" />
                <span>{formatTimeAgo(post.created_at)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Contenu du post sous forme de card */}
        <div className="flex-1 p-4 space-y-3 overflow-y-auto">
          <div className="flex flex-wrap gap-2">
            {post.ape_code ? (
              <span className="inline-flex items-center px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-100">
                {translateApeCode(post.ape_code)} ({post.ape_code})
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium border border-emerald-100">
                Demande générale
              </span>
            )}
          </div>

          {post.content && (
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 sm:p-4">
              <p className="text-gray-800 text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
                {post.content}
              </p>
            </div>
          )}

          {post.image_url && (
            <img
              src={post.image_url}
              alt="Post"
              className="w-full rounded-xl object-cover border border-gray-100"
            />
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-200 bg-white flex gap-3 flex-shrink-0">
          <button
            onClick={() => onSwipe('pass')}
            className="flex-1 py-2.5 sm:py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition flex items-center justify-center gap-2"
          >
            <span className="text-lg sm:text-xl">✕</span>
            <span className="text-xs sm:text-sm">Passer</span>
          </button>
          <button
            onClick={() => onSwipe('super_like')}
            className="flex-1 py-2.5 sm:py-3 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded-xl font-semibold transition flex items-center justify-center gap-2"
          >
            <span className="text-lg sm:text-xl">⚡</span>
            <span className="text-xs sm:text-sm">Super</span>
          </button>
          <button
            onClick={() => onSwipe('like')}
            className="flex-1 py-2.5 sm:py-3 bg-green-100 hover:bg-green-200 text-green-700 rounded-xl font-semibold transition flex items-center justify-center gap-2"
          >
            <span className="text-lg sm:text-xl">✓</span>
            <span className="text-xs sm:text-sm">Intéressé</span>
          </button>
        </div>
      </div>
    </div>
  );
}

