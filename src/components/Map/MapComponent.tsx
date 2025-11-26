import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { MapPin, Briefcase, Star, Leaf } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix pour les icônes Leaflet avec Vite
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  iconRetinaUrl: iconRetina,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Icône personnalisée pour l'utilisateur
const UserIcon = L.icon({
  iconUrl: icon,
  iconRetinaUrl: iconRetina,
  shadowUrl: iconShadow,
  iconSize: [30, 46],
  iconAnchor: [15, 46],
  popupAnchor: [1, -34],
  shadowSize: [46, 46]
});

// Composant pour centrer la carte sur la position de l'utilisateur
function MapCenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (map && center) {
      map.setView(center, map.getZoom());
    }
  }, [map, center]);
  return null;
}

interface MapComponentProps {
  center: [number, number];
  zoom: number;
  userLocation: { lat: number; lng: number } | null;
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
}

export function MapComponent({
  center,
  zoom,
  userLocation,
  professionals,
  onMarkerClick,
  userCity,
}: MapComponentProps) {
  const getLeafClasses = (distance?: number) => {
    if (distance === undefined) return 'text-gray-400';
    if (distance < 10) {
      // Commerce très proche mis en avant
      return 'text-green-600 w-4 h-4 drop-shadow-md';
    }
    if (distance < 50) return 'text-amber-500 w-3 h-3 opacity-80';
    return 'text-red-700 w-3 h-3 opacity-70';
  };

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: '100%', width: '100%', zIndex: 1 }}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {userLocation && (
        <>
          <MapCenter center={[userLocation.lat, userLocation.lng]} />
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={UserIcon}
          >
            <Popup>
              <div className="text-center">
                <p className="font-semibold text-blue-600">Votre position</p>
                {userCity && <p className="text-sm text-gray-600">{userCity}</p>}
              </div>
            </Popup>
          </Marker>
        </>
      )}

      {professionals.map(({ profile: prof, professionalProfile, distance }) => {
        if (!prof.latitude || !prof.longitude) return null;
        
        return (
          <Marker
            key={prof.id}
            position={[prof.latitude, prof.longitude]}
            eventHandlers={{
              click: () => {
                onMarkerClick({ profile: prof, professionalProfile, distance });
              },
            }}
          >
            <Popup>
              <div className="min-w-[200px]">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-semibold text-gray-800">{prof.full_name}</h4>
                  {professionalProfile?.verified && (
                    <Star className="w-4 h-4 text-blue-500" fill="currentColor" />
                  )}
                </div>
                {professionalProfile?.company_name && (
                  <div className="flex items-center gap-1 text-sm text-gray-600 mb-1">
                    <Briefcase className="w-3 h-3" />
                    <span className="truncate">{professionalProfile.company_name}</span>
                  </div>
                )}
                {distance !== undefined && (
                  <div className="flex items-center gap-2 text-xs">
                    <div className="flex items-center gap-1 text-gray-500">
                      <MapPin className="w-3 h-3" />
                      <span>
                        {distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`}
                      </span>
                    </div>
                    <Leaf className={getLeafClasses(distance)} />
                  </div>
                )}
                <button
                  onClick={() => onMarkerClick({ profile: prof, professionalProfile, distance })}
                  className="mt-2 w-full py-1.5 px-3 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600 transition"
                >
                  Voir détails
                </button>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

