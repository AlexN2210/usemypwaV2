import { useState, useEffect } from 'react';
import { supabase, Profile, ProfessionalProfile, Post } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { MapPin, Navigation, Briefcase, Star, FileText, Leaf } from 'lucide-react';
import { GoogleMap } from '../components/Map/GoogleMap';

export function MapPage() {
  const { profile } = useAuth();
  const [professionals, setProfessionals] = useState<Array<{ profile: Profile; professionalProfile?: ProfessionalProfile; distance?: number }>>([]);
  const [selectedProfessional, setSelectedProfessional] = useState<{ profile: Profile; professionalProfile?: ProfessionalProfile; distance?: number } | null>(null);
  const [professionalPosts, setProfessionalPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([48.8566, 2.3522]); // Paris par défaut
  const [mapZoom, setMapZoom] = useState(13);

  const getLeafClasses = (distance?: number) => {
    if (distance === undefined) return 'text-gray-400';
    if (distance < 10) {
      // Commerce très proche mis en avant
      return 'text-green-600 w-5 h-5 drop-shadow-md';
    }
    if (distance < 50) return 'text-amber-500 w-4 h-4 opacity-80';
    return 'text-red-700 w-4 h-4 opacity-70';
  };

  useEffect(() => {
    // Demander la géolocalisation de l'utilisateur
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setUserLocation({ lat, lng });
          setMapCenter([lat, lng]);
          setMapZoom(13);
        },
        (error) => {
          console.warn('Erreur de géolocalisation:', error);
          // Utiliser la position du profil si disponible
          if (profile?.latitude && profile?.longitude) {
            setUserLocation({ lat: profile.latitude, lng: profile.longitude });
            setMapCenter([profile.latitude, profile.longitude]);
          }
        }
      );
    } else if (profile?.latitude && profile?.longitude) {
      // Fallback sur la position du profil
      setUserLocation({ lat: profile.latitude, lng: profile.longitude });
      setMapCenter([profile.latitude, profile.longitude]);
    }
  }, [profile]);

  // Charger les professionnels quand le profil ou la position change
  useEffect(() => {
    loadProfessionals();
  }, [profile, userLocation]);

  const loadProfessionals = async () => {
    setLoading(true);

    console.log('🔍 Chargement des professionnels...', { userLocation, profileLocation: profile?.latitude ? { lat: profile.latitude, lng: profile.longitude } : null });

    // Charger tous les professionnels (même sans coordonnées)
    const { data: profilesData, error } = await supabase
      .from('profiles')
      .select('*')
      .in('user_type', ['professional', 'professionnel'])
      .neq('id', profile?.id || '00000000-0000-0000-0000-000000000000'); // Exclure l'utilisateur connecté

    if (error) {
      console.error('❌ Error loading professionals:', error);
      setLoading(false);
      return;
    }

    console.log(`📊 ${profilesData?.length || 0} professionnels trouvés au total`);

    // Utiliser userLocation si disponible, sinon profile
    const referenceLocation = userLocation || (profile?.latitude && profile?.longitude ? { lat: profile.latitude, lng: profile.longitude } : null);

    // Charger les profils professionnels et géocoder progressivement
    const enrichedProfiles = await Promise.all(
      (profilesData || []).map(async (prof, index) => {
        const { data: professionalData } = await supabase
          .from('professional_profiles')
          .select('*')
          .eq('user_id', prof.id)
          .maybeSingle();

        // Utiliser les coordonnées existantes (géocodage désactivé pour éviter les erreurs)
        // Le géocodage peut être fait côté serveur ou manuellement dans la base de données
        const lat = prof.latitude;
        const lng = prof.longitude;
        
        // Note: Le géocodage automatique est désactivé pour éviter les erreurs de rate limiting
        // Les coordonnées doivent être renseignées manuellement dans la base de données
        // ou via un script de géocodage côté serveur

        let distance: number | undefined;
        if (referenceLocation && lat && lng) {
          distance = calculateDistance(
            referenceLocation.lat,
            referenceLocation.lng,
            lat,
            lng
          );
        }

        return {
          profile: {
            ...prof,
            latitude: lat || prof.latitude,
            longitude: lng || prof.longitude,
          },
          professionalProfile: professionalData || undefined,
          distance,
        };
      })
    );

    // Filtrer et trier par distance
    const filteredProfiles = enrichedProfiles.filter(p => p.profile.id !== profile?.id); // Exclure l'utilisateur lui-même
    
    // Séparer les professionnels avec et sans distance
    const withDistance = filteredProfiles.filter(p => p.distance !== undefined);
    const withoutDistance = filteredProfiles.filter(p => p.distance === undefined);
    
    // Trier ceux avec distance
    withDistance.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    
    // Combiner : d'abord ceux avec distance, puis ceux sans
    const sortedProfiles = [...withDistance, ...withoutDistance];

    console.log(`✅ ${sortedProfiles.length} professionnels chargés`, {
      avecDistance: withDistance.length,
      sansDistance: withoutDistance.length,
      details: sortedProfiles.map(p => ({
        name: p.profile.full_name,
        distance: p.distance !== undefined ? p.distance.toFixed(2) + 'km' : 'N/A',
        hasCoords: !!(p.profile.latitude && p.profile.longitude),
        address: p.profile.address
      }))
    });

    setProfessionals(sortedProfiles);
    setLoading(false);
  };

  const loadProfessionalPosts = async (professionalId: string) => {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', professionalId)
      .is('ape_code', null) // Seulement les posts sans code APE (promotions des pros)
      .order('created_at', { ascending: false })
      .limit(5); // Limiter à 5 posts récents

    if (error) {
      console.error('Error loading professional posts:', error);
      return;
    }

    setProfessionalPosts(data || []);
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

  // Fonction pour géocoder une adresse (utilise Nominatim OpenStreetMap via proxy CORS)
  const geocodeAddress = async (address: string, postalCode: string, city: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      const query = `${address}, ${postalCode} ${city}, France`;
      // Utiliser un proxy CORS pour éviter les problèmes de CORS et rate limiting
      const proxyUrl = 'https://corsproxy.io/?';
      const targetUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&addressdetails=1`;
      const url = `${proxyUrl}${encodeURIComponent(targetUrl)}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        // Timeout de 5 secondes
        signal: AbortSignal.timeout(5000)
      });
      
      if (!response.ok) {
        console.warn(`⚠️ Géocodage échoué: ${response.status}`);
        return null;
      }
      
      const data = await response.json();
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        };
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.warn('⚠️ Timeout de géocodage');
      } else {
        console.warn('⚠️ Erreur de géocodage:', error.message);
      }
    }
    return null;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 relative overflow-hidden">
        {userLocation && (
          <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 z-[1000]">
            <div className="flex items-center gap-2">
              <Navigation className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-xs text-gray-500">Votre position</p>
                <p className="text-sm font-semibold text-gray-800">{profile?.city || 'Position actuelle'}</p>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-[999]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <GoogleMap
            center={mapCenter}
            zoom={mapZoom}
            userLocation={userLocation}
            professionals={professionals}
            onMarkerClick={(professional) => {
              setSelectedProfessional(professional);
              // Charger les posts du professionnel
              loadProfessionalPosts(professional.profile.id);
            }}
            userCity={profile?.city}
          />
        )}
      </div>

      <div className="h-48 sm:h-64 overflow-y-auto bg-white border-t border-gray-200 pb-20">
        <div className="p-4">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Professionnels à proximité</h3>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : professionals.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Aucun professionnel trouvé</p>
              <p className="text-xs text-gray-400 mt-2">Les professionnels sans coordonnées ne s'affichent pas sur la carte</p>
            </div>
          ) : (
            <div className="space-y-3">
              {professionals.slice(0, 10).map(({ profile: prof, professionalProfile, distance }) => (
                <div
                  key={prof.id}
                  onClick={() => setSelectedProfessional({ profile: prof, professionalProfile, distance })}
                  className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex-shrink-0 flex items-center justify-center text-white font-bold">
                      {prof.avatar_url ? (
                        <img
                          src={prof.avatar_url}
                          alt={prof.full_name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        prof.full_name.charAt(0).toUpperCase()
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-800 truncate">{prof.full_name}</h4>
                        {professionalProfile?.verified && (
                          <Star className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" />
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        {professionalProfile?.company_name && (
                          <div className="flex items-center gap-1">
                            <Briefcase className="w-3 h-3" />
                            <span className="truncate">{professionalProfile.company_name}</span>
                          </div>
                        )}
                        {distance !== undefined && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="flex items-center gap-1 text-gray-500">
                              <MapPin className="w-3 h-3" />
                              <span>
                                {distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`}
                              </span>
                            </div>
                            <Leaf className={getLeafClasses(distance)} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedProfessional && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setSelectedProfessional(null);
            setProfessionalPosts([]);
          }}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex-shrink-0 flex items-center justify-center text-white font-bold text-2xl">
                {selectedProfessional.profile.avatar_url ? (
                  <img
                    src={selectedProfessional.profile.avatar_url}
                    alt={selectedProfessional.profile.full_name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  selectedProfessional.profile.full_name.charAt(0).toUpperCase()
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-xl font-bold text-gray-800">{selectedProfessional.profile.full_name}</h3>
                  {selectedProfessional.professionalProfile?.verified && (
                    <Star className="w-5 h-5 text-blue-500" fill="currentColor" />
                  )}
                </div>

                {selectedProfessional.professionalProfile?.company_name && (
                  <div className="flex items-center gap-1 text-gray-600 mb-2">
                    <Briefcase className="w-4 h-4" />
                    <span className="font-medium">{selectedProfessional.professionalProfile.company_name}</span>
                  </div>
                )}

                {selectedProfessional.distance !== undefined && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <MapPin className="w-4 h-4" />
                      <span>
                        {selectedProfessional.distance < 1
                          ? `${Math.round(selectedProfessional.distance * 1000)}m`
                          : `${selectedProfessional.distance.toFixed(1)}km`}
                      </span>
                    </div>
                    <Leaf className={getLeafClasses(selectedProfessional.distance)} />
                  </div>
                )}
              </div>
            </div>

            {selectedProfessional.profile.bio && (
              <p className="text-gray-600 mb-4">{selectedProfessional.profile.bio}</p>
            )}

            {selectedProfessional.profile.address && (
              <p className="text-sm text-gray-500 mb-4">
                {selectedProfessional.profile.address}
                {selectedProfessional.profile.postal_code && selectedProfessional.profile.city && (
                  <span>, {selectedProfessional.profile.postal_code} {selectedProfessional.profile.city}</span>
                )}
              </p>
            )}

            {/* Posts/Promotions du professionnel */}
            {professionalPosts.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-5 h-5 text-blue-500" />
                  <h4 className="font-semibold text-gray-800">Promotions & Services</h4>
                </div>
                <div className="space-y-3">
                  {professionalPosts.map((post) => (
                    <div
                      key={post.id}
                      className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-4 border border-blue-100"
                    >
                      <p className="text-gray-700 leading-relaxed mb-2">{post.content}</p>
                      {post.created_at && (
                        <p className="text-xs text-gray-500">
                          {new Date(post.created_at).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => {
                setSelectedProfessional(null);
                setProfessionalPosts([]);
              }}
              className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-cyan-600 transition"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
