import { useEffect, useRef, useState } from 'react';

type GoogleAddressAutocompleteProps = {
  value: string;
  onAddressChange: (data: { address: string; postalCode?: string; city?: string }) => void;
  label?: string;
  placeholder?: string;
};

declare global {
  interface Window {
    google?: any;
    __USEMY_GOOGLE_PLACES_LOADING__?: boolean;
  }
}

const GOOGLE_PLACES_SCRIPT_ID = 'usemy-google-places-script';

function loadGooglePlacesScript(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.places) {
      resolve();
      return;
    }

    if (window.__USEMY_GOOGLE_PLACES_LOADING__) {
      const checkInterval = setInterval(() => {
        if (window.google?.maps?.places) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 200);
      return;
    }

    window.__USEMY_GOOGLE_PLACES_LOADING__ = true;

    const existingScript = document.getElementById(GOOGLE_PLACES_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () => reject(new Error('Erreur de chargement Google Places')));
      return;
    }

    const script = document.createElement('script');
    script.id = GOOGLE_PLACES_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=fr&region=FR`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      resolve();
    };
    script.onerror = () => {
      reject(new Error('Erreur de chargement Google Places'));
    };

    document.head.appendChild(script);
  });
}

export function GoogleAddressAutocomplete({
  value,
  onAddressChange,
  label = 'Adresse',
  placeholder = '123 rue de la République',
}: GoogleAddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined;
    if (!apiKey) {
      console.warn('VITE_GOOGLE_PLACES_API_KEY non définie - autocomplétion désactivée');
      return;
    }

    let autocomplete: any;

    loadGooglePlacesScript(apiKey)
      .then(() => {
        if (!inputRef.current || !window.google?.maps?.places) return;
        setEnabled(true);

        autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
          types: ['address'],
          componentRestrictions: { country: 'fr' },
        });

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (!place || !place.address_components) return;

          const components = place.address_components as Array<{
            long_name: string;
            short_name: string;
            types: string[];
          }>;

          const getComponent = (type: string) =>
            components.find((c) => c.types.includes(type));

          const streetNumber = getComponent('street_number')?.long_name || '';
          const route = getComponent('route')?.long_name || '';
          const postalCode = getComponent('postal_code')?.long_name;
          const city =
            getComponent('locality')?.long_name ||
            getComponent('postal_town')?.long_name ||
            getComponent('administrative_area_level_2')?.long_name;

          const address = `${streetNumber} ${route}`.trim() || place.formatted_address || value;

          setLocalValue(address);
          onAddressChange({
            address,
            postalCode,
            city,
          });
        });
      })
      .catch((err) => {
        console.warn('Autocomplétion Google Places désactivée:', err);
      });

    return () => {
      if (autocomplete && autocomplete.unbindAll) {
        autocomplete.unbindAll();
      }
    };
  }, [onAddressChange, value]);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
        {enabled && (
          <span className="ml-1 text-xs text-blue-500 align-middle">
            (recherche automatique)
          </span>
        )}
      </label>
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={(e) => {
          const newValue = e.target.value;
          setLocalValue(newValue);
          onAddressChange({ address: newValue });
        }}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
        placeholder={placeholder}
        autoComplete="street-address"
      />
    </div>
  );
}


