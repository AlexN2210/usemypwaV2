import { useEffect } from 'react';
import { X, Eye } from 'lucide-react';
import { supabase, Post } from '../../lib/supabase';

type StoryViewerModalProps = {
  open: boolean;
  story: Post | null;
  onClose: () => void;
  isOwner?: boolean;
};

export function StoryViewerModal({ open, story, onClose, isOwner = false }: StoryViewerModalProps) {
  // Incrémenter le compteur de vues uniquement pour les autres utilisateurs
  useEffect(() => {
    const incrementViews = async () => {
      if (!open || !story || isOwner) return;

      try {
        const newViews = (story.views ?? 0) + 1;
        await supabase
          .from('posts')
          .update({ views: newViews })
          .eq('id', story.id);
      } catch (error) {
        console.error('Erreur lors de la mise à jour des vues de la story:', error);
      }
    };

    incrementViews();
  }, [open, story, isOwner]);

  if (!open || !story) return null;

  const viewsCount = story.views ?? 0;

  return (
    <div className="fixed inset-0 z-[70] bg-black/90 flex flex-col text-white">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-300">
            {isOwner ? 'Votre story' : 'Story'}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-full hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="relative w-full max-w-xs sm:max-w-sm aspect-[9/16] rounded-2xl overflow-hidden bg-gradient-to-br from-blue-500 to-cyan-500 shadow-2xl border border-white/10">
          {story.image_url ? (
            <img
              src={story.image_url}
              alt={story.caption || 'Story'}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-center px-4">
              <p className="text-sm text-white/90">
                Aucune image trouvée pour cette story.
              </p>
            </div>
          )}
        </div>
      </div>

      {isOwner && (
        <div className="px-4 py-3 flex items-center justify-between text-xs bg-black/60 border-t border-white/10">
          <div className="flex items-center gap-2 text-gray-300">
            <Eye className="w-4 h-4" />
            <span>
              {viewsCount} vue{viewsCount > 1 ? 's' : ''}
            </span>
          </div>
          {story.caption && (
            <span className="text-[11px] text-gray-400 truncate max-w-[60%]">
              {story.caption}
            </span>
          )}
        </div>
      )}
    </div>
  );
}


