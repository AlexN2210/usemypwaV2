import { Bell, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

type HeaderProps = {
  onProfileClick?: () => void;
  onSearchClick?: () => void;
  onNotificationsClick?: () => void;
  hasNotifications?: boolean;
};

export function Header({ onProfileClick, onSearchClick, onNotificationsClick, hasNotifications }: HeaderProps) {
  const { profile } = useAuth();

  const userType = profile?.user_type as string | undefined;
  const isIndividual = userType === 'individual' || userType === 'particulier';

  return (
    <header className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 shadow-sm z-40">
      <div className="max-w-screen-xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logoheader.png" alt="Usemy Logo" className="w-10 h-10" />
          <div>
            <h1 className="text-xl font-bold text-gray-800">Usemy</h1>
            <p className="text-xs text-gray-500">Connectez-vous aux professionnels</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {isIndividual && (
            <button
              className="p-2 hover:bg-gray-100 rounded-full transition"
              type="button"
              onClick={onSearchClick}
              aria-label="Rechercher un professionnel"
            >
              <Search className="w-5 h-5 text-gray-600" />
            </button>
          )}
          <button
            className="p-2 hover:bg-gray-100 rounded-full transition relative"
            type="button"
            onClick={onNotificationsClick}
            aria-label="Voir les notifications"
          >
            <Bell className="w-5 h-5 text-gray-600" />
            {hasNotifications && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            )}
          </button>
          {profile && (
            <button
              type="button"
              onClick={onProfileClick}
              className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center text-white font-semibold hover:opacity-90 transition"
              aria-label="Voir mon profil"
            >
              {profile.full_name.charAt(0).toUpperCase()}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function Home({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 12L5 10M5 10L12 3L19 10M5 10V20C5 20.5523 5.44772 21 6 21H9M19 10L21 12M19 10V20C19 20.5523 18.5523 21 18 21H15M9 21C9.55228 21 10 20.5523 10 20V16C10 15.4477 10.4477 15 11 15H13C13.5523 15 14 15.4477 14 16V20C14 20.5523 14.4477 21 15 21M9 21H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
