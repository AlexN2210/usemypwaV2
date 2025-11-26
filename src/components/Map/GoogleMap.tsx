import { useEffect, useRef } from 'react';
import { Leaf } from 'lucide-react';

type GoogleLatLng = { lat: number; lng: number };

type GoogleMapProps = {
  center: [number, number];
  zoom: number;
  userLocation: GoogleLatLng | null;
  professionals: Array<{
    profile: {
      id: string;
      full_name: string;
      latitude: number | null;
      longitude: number | null;
      avatar_url?: string | null;
      city?: string | null;
    };
    professionalProfile?: {
      company_name?: string | null;
      verified?: boolean;
    } | null;
    distance?: number;
  }>;
  onMarkerClick: (professional: any) => void;
  userCity?: string | null;
};

declare global {
  interface Window {
    google?: any;
    __USEMY_GOOGLE_MAP_LOADING__?: boolean;
  }
}

const GOOGLE_MAP_SCRIPT_ID = 'usemy-google-maps-script';

function loadGoogleMaps(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve();
      return;
    }

    if (window.__USEMY_GOOGLE_MAP_LOADING__) {
      const checkInterval = setInterval(() => {
        if (window.google?.maps) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 200);
      return;
    }

    window.__USEMY_GOOGLE_MAP_LOADING__ = true;

    const existingScript = document.getElementById(GOOGLE_MAP_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () => reject(new Error('Erreur de chargement Google Maps')));
      return;
    }

    const script = document.createElement('script');
    script.id = GOOGLE_MAP_SCRIPT_ID;
    // Inclure la librairie "marker" pour utiliser AdvancedMarkerElement
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker&language=fr&region=FR`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Erreur de chargement Google Maps'));

    document.head.appendChild(script);
  });
}

export function GoogleMap({
  center,
  zoom,
  userLocation,
  professionals,
  onMarkerClick,
  userCity,
}: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const getLeafColor = (distance?: number) => {
    if (distance === undefined) return '#9ca3af'; // gray-400
    if (distance < 10) return '#16a34a'; // green-600
    if (distance < 50) return '#eab308'; // amber-500 (jaune/orange vif)
    return '#b91c1c'; // red-700 (rouge profond)
  };

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined;
    if (!apiKey || !mapRef.current) {
      return;
    }

    let isCancelled = false;

    loadGoogleMaps(apiKey)
      .then(() => {
        if (isCancelled || !mapRef.current || !window.google?.maps) return;

        const map = new window.google.maps.Map(mapRef.current, {
          center: { lat: center[0], lng: center[1] },
          zoom,
          disableDefaultUI: true,
          zoomControl: true,
        });

        mapInstanceRef.current = map;
      })
      .catch((err) => {
        console.warn('Google Maps non disponible, fallback Leaflet utilisé dans MapPage:', err);
      });

    return () => {
      isCancelled = true;
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.google?.maps) return;

    // Mettre à jour le centre si la position utilisateur change
    if (userLocation) {
      map.setCenter(userLocation);
      map.setZoom(13);
    } else {
      map.setCenter({ lat: center[0], lng: center[1] });
      map.setZoom(zoom);
    }

    // Nettoyer les anciens marqueurs
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const AdvancedMarker =
      window.google?.maps?.marker?.AdvancedMarkerElement ??
      window.google?.maps?.AdvancedMarkerElement;
    const Marker = window.google?.maps?.Marker;

    // Marqueur utilisateur
    if (userLocation) {
      if (AdvancedMarker) {
        const userContent = document.createElement('div');
        userContent.style.width = '16px';
        userContent.style.height = '16px';
        userContent.style.borderRadius = '9999px';
        userContent.style.backgroundColor = '#3b82f6';
        userContent.style.boxShadow = '0 0 0 2px white';

        const userMarker = new AdvancedMarker({
          position: userLocation,
          map,
          content: userContent,
          title: userCity || 'Votre position',
        });
        markersRef.current.push(userMarker);
      } else if (Marker) {
        const userMarker = new Marker({
          position: userLocation,
          map,
          title: userCity || 'Votre position',
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#3b82f6',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        });
        markersRef.current.push(userMarker);
      }
    }

    // Marqueurs professionnels
    professionals.forEach(({ profile, professionalProfile, distance }) => {
      if (!profile.latitude || !profile.longitude) return;

      const position = { lat: profile.latitude, lng: profile.longitude };
      const color = getLeafColor(distance);

      let marker: any;

      if (AdvancedMarker) {
        const markerContent = document.createElement('div');
        markerContent.style.width = '14px';
        markerContent.style.height = '14px';
        markerContent.style.borderRadius = '9999px';
        markerContent.style.backgroundColor = color;
        markerContent.style.boxShadow = '0 0 0 2px rgba(255,255,255,0.9)';

        marker = new AdvancedMarker({
          position,
          map,
          content: markerContent,
          title: profile.full_name,
        });
      } else if (Marker) {
        marker = new Marker({
          position,
          map,
          title: profile.full_name,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 1,
          },
        });
      } else {
        return;
      }

      const infoContent = `
        <div style="min-width:200px">
          <div style="font-weight:600;color:#111827;margin-bottom:4px">${profile.full_name}</div>
          ${professionalProfile?.company_name ? `<div style="font-size:12px;color:#4b5563">${professionalProfile.company_name}</div>` : ''}
          ${
            distance !== undefined
              ? `<div style="display:flex;align-items:center;gap:4px;margin-top:4px;font-size:11px;color:#6b7280">
                  <span>${distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`}</span>
                </div>`
              : ''
          }
        </div>
      `;

      const infoWindow = new window.google.maps.InfoWindow({
        content: infoContent,
      });

      marker.addListener('click', () => {
        // Compatibilité AdvancedMarkerElement / Marker classique
        if (AdvancedMarker && marker instanceof AdvancedMarker) {
          infoWindow.open({
            map,
            anchor: marker,
          });
        } else {
          infoWindow.open(map, marker);
        }
        onMarkerClick({ profile, professionalProfile, distance });
      });

      markersRef.current.push(marker);
    });
  }, [userLocation, professionals, center, zoom, onMarkerClick, userCity]);

  return (
    <div className="relative h-full w-full">
      <div ref={mapRef} className="h-full w-full" />
      {/* Légende simple en overlay pour rappeler le code couleur des feuilles */}
      <div className="absolute bottom-3 left-3 bg-white/90 rounded-lg px-3 py-2 shadow text-xs flex items-center gap-3">
        <span className="font-semibold text-gray-700">Proximité</span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
          <span className="text-[11px] text-gray-600">&lt; 10km</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-orange-400" />
          <span className="text-[11px] text-gray-600">10–50km</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
          <span className="text-[11px] text-gray-600">&gt; 50km</span>
        </span>
        <Leaf className="w-3 h-3 text-green-600" />
      </div>
    </div>
  );
}


