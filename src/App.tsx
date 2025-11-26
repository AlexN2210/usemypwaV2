import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginForm } from './components/Auth/LoginForm';
import { MultiStepSignupForm } from './components/Auth/MultiStepSignupForm';
import { Header } from './components/Layout/Header';
import { BottomNav } from './components/Layout/BottomNav';
import { HomePage } from './pages/HomePage';
import { DiscoverPage } from './pages/DiscoverPage';
import { MapPage } from './pages/MapPage';
import { PostsPage } from './pages/PostsPage';
import { ProfilePage } from './pages/ProfilePage';

// Composant de gestion d'erreur pour afficher les erreurs de chargement
function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Erreur capturée:', event.error);
      setError(event.error);
      setHasError(true);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error('Promesse rejetée:', event.reason);
      setError(event.reason instanceof Error ? event.reason : new Error(String(event.reason)));
      setHasError(true);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  if (hasError) {
    // Vérifier si c'est une erreur de configuration Supabase
    const isSupabaseError = error?.message?.includes('Supabase') || 
                            error?.message?.includes('ERR_NAME_NOT_RESOLVED') ||
                            error?.message?.includes('Failed to fetch');

    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            {isSupabaseError ? 'Erreur de connexion Supabase' : 'Erreur de chargement'}
          </h1>
          <p className="text-gray-600 mb-6">
            {isSupabaseError ? (
              <>
                L'application ne peut pas se connecter à Supabase. Vérifiez :
                <ul className="text-left mt-4 space-y-2 text-sm">
                  <li>• Votre connexion Internet</li>
                  <li>• La configuration Supabase (variables d'environnement)</li>
                  <li>• Que votre projet Supabase est actif</li>
                </ul>
              </>
            ) : (
              'L\'application n\'a pas pu se charger correctement. Cela peut être dû à un problème de cache ou de service worker.'
            )}
          </p>
          {error && (
            <details className="text-left mb-4 p-4 bg-gray-100 rounded text-sm">
              <summary className="cursor-pointer font-semibold mb-2">Détails de l'erreur</summary>
              <pre className="text-xs overflow-auto whitespace-pre-wrap">{error.message}</pre>
            </details>
          )}
          <div className="space-y-2">
            <button
              onClick={() => {
                // Réinitialiser le service worker
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistrations().then(registrations => {
                    registrations.forEach(registration => registration.unregister());
                    // Vider le cache
                    if ('caches' in window) {
                      caches.keys().then(names => {
                        names.forEach(name => caches.delete(name));
                      });
                    }
                    // Recharger la page
                    window.location.reload();
                  });
                } else {
                  window.location.reload();
                }
              }}
              className="w-full py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition"
            >
              🔄 Réinitialiser et recharger
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition"
            >
              ↻ Recharger la page
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 flex items-center justify-center p-4">
      {mode === 'login' ? (
        <LoginForm onToggleMode={() => setMode('signup')} />
      ) : (
        <MultiStepSignupForm onToggleMode={() => setMode('login')} />
      )}
    </div>
  );
}

function MainApp() {
  const { user, profile, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('home');
  const [matches, setMatches] = useState<
    Array<{
      id: string;
      otherUserId: string;
      otherUserName: string;
      createdAt: string;
    }>
  >([]);
  const [showMatches, setShowMatches] = useState(false);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesError, setMatchesError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-800">Usemy</h2>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  // Si pas d'utilisateur OU pas de profil, afficher la page de connexion
  if (!user || !profile) {
    return <AuthScreen />;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header
        onProfileClick={() => setActiveTab('profile')}
        onSearchClick={() => setActiveTab('discover')}
        onNotificationsClick={async () => {
          if (!user) return;
          setMatchesLoading(true);
          setMatchesError(null);
          try {
            const { supabase } = await import('./lib/supabase');

            // Récupérer tous les likes où le user est impliqué (comme pro ou particulier)
            const { data: matchRows, error } = await supabase
              .from('matches')
              .select('id, user_id, target_user_id, created_at')
              .or(`user_id.eq.${user.id},target_user_id.eq.${user.id}`)
              .order('created_at', { ascending: false });

            if (error) {
              console.error('Erreur lors du chargement des matches:', error);
              setMatchesError('Impossible de charger les matches.');
              setMatches([]);
              setShowMatches(true);
              setMatchesLoading(false);
              return;
            }

            const rows = matchRows || [];
            if (rows.length === 0) {
              setMatches([]);
              setShowMatches(true);
              setMatchesLoading(false);
              return;
            }

            // Identifier les autres utilisateurs (en face de moi)
            const otherUserIds = Array.from(
              new Set(
                rows.map((m) =>
                  m.user_id === user.id ? m.target_user_id : m.user_id
                )
              )
            );

            const { data: profilesData, error: profilesError } = await supabase
              .from('profiles')
              .select('id, full_name')
              .in('id', otherUserIds);

            if (profilesError) {
              console.error('Erreur lors du chargement des profils des matches:', profilesError);
              setMatchesError('Impossible de charger les profils liés aux matches.');
            }

            const profileMap = new Map(
              (profilesData || []).map((p: any) => [p.id, p.full_name as string])
            );

            const withNames = rows.map((m: any) => {
              const otherId = m.user_id === user.id ? m.target_user_id : m.user_id;
              return {
                id: m.id as string,
                otherUserId: otherId as string,
                otherUserName: profileMap.get(otherId) || 'Utilisateur',
                createdAt: m.created_at as string,
              };
            });

            setMatches(withNames);
            setShowMatches(true);
          } catch (e: any) {
            console.error('Erreur inattendue lors du chargement des matches:', e);
            setMatchesError('Erreur inattendue lors du chargement des matches.');
            setShowMatches(true);
          } finally {
            setMatchesLoading(false);
          }
        }}
        hasNotifications={matches.length > 0}
      />

      <main className="flex-1 overflow-hidden pt-16">
        {activeTab === 'home' && <HomePage />}
        {activeTab === 'discover' && <DiscoverPage />}
        {activeTab === 'map' && <MapPage />}
        {activeTab === 'posts' && <PostsPage />}
        {activeTab === 'profile' && <ProfilePage />}
      </main>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      {showMatches && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] flex flex-col">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Vos correspondances</h2>
                <p className="text-xs text-gray-500">
              {(['individual', 'particulier'] as string[]).includes(profile.user_type as string)
                ? 'Les professionnels intéressés par vos demandes'
                : 'Les particuliers pour lesquels vous avez montré un intérêt'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMatches(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Fermer
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {matchesLoading ? (
                <div className="flex items-center justify-center py-8 text-gray-500 text-sm">
                  Chargement des matches...
                </div>
              ) : matchesError ? (
                <div className="text-sm text-red-500 py-4">{matchesError}</div>
              ) : matches.length === 0 ? (
                <div className="text-sm text-gray-500 py-4">
                  Aucun match pour le moment.
                </div>
              ) : (
                <ul className="space-y-3 text-sm">
                  {matches.map((m) => (
                    <li
                      key={m.id}
                      className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 flex justify-between items-center"
                    >
                      <span className="font-medium text-gray-800 truncate">
                        {m.otherUserName}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {new Date(m.createdAt).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: '2-digit',
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
