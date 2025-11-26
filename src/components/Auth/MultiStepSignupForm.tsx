import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Stepper } from './Stepper';
import { ProfessionSelector } from './ProfessionSelector';
import { SiretValidator } from './SiretValidator';
import { SiretValidationResult } from '../../lib/siretService';
import { User, Briefcase, ArrowLeft, ArrowRight } from 'lucide-react';
import { GoogleAddressAutocomplete } from '../Location/GoogleAddressAutocomplete';

interface MultiStepSignupFormProps {
  onToggleMode: () => void;
}

interface FormData {
  // Étape 1
  fullName: string;
  email: string;
  password: string;
  
  // Étape 2
  userType: 'professional' | 'individual';
  
  // Étape 3 (si professionnel ou particulier)
  profession: string;
  address: string;
  postalCode: string;
  city: string;
  phone: string; // Numéro de téléphone (récupéré via SIRET ou saisi manuellement)
  
  // Étape 4 (si professionnel)
  siret: string;
  siretValid: boolean;
  companyName: string;
  apeCode: string; // Code APE récupéré via SIRET
}

const STEPS = [
  'Informations',
  'Type de compte',
  'Profession',
  'Vérification'
];

export function MultiStepSignupForm({ onToggleMode }: MultiStepSignupFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    email: '',
    password: '',
    userType: 'individual',
    profession: '',
    address: '',
    postalCode: '',
    city: '',
    phone: '',
    siret: '',
    siretValid: false,
    companyName: '',
    apeCode: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();

  const updateFormData = (updates: Partial<FormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const nextStep = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    // Log des données avant l'envoi
    console.log('📤 Données du formulaire avant inscription:', {
      email: formData.email,
      userType: formData.userType,
      profession: formData.profession,
      siret: formData.siret,
      companyName: formData.companyName,
      address: formData.address,
      postalCode: formData.postalCode,
      city: formData.city,
      phone: formData.phone,
      apeCode: formData.apeCode
    });

    try {
      await signUp(
        formData.email, 
        formData.password, 
        formData.fullName, 
        formData.userType,
        formData.userType === 'professional' ? formData.profession : undefined,
        formData.userType === 'professional' ? formData.siret : undefined,
        formData.userType === 'professional' ? formData.companyName : undefined,
        // Passer les données de localisation pour les deux types d'utilisateurs
        formData.address || undefined,
        formData.postalCode || undefined,
        formData.city || undefined,
        // Passer le numéro de téléphone
        formData.phone || undefined,
        // Passer le code APE
        formData.userType === 'professional' ? formData.apeCode || undefined : undefined
      );
    } catch (err: any) {
      console.error('Erreur lors de l\'inscription:', err);
      setError(err.message || 'Erreur lors de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return formData.fullName && formData.email && formData.password.length >= 6;
      case 2:
        return formData.userType !== '';
      case 3:
        if (formData.userType === 'individual') {
          return formData.address !== '' && formData.postalCode !== '' && formData.city !== '';
        }
        return formData.profession !== '';
      case 4:
        return formData.userType === 'individual' || formData.siretValid;
      default:
        return false;
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nom complet
              </label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => updateFormData({ fullName: e.target.value })}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition"
                placeholder="Jean Dupont"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => updateFormData({ email: e.target.value })}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition"
                placeholder="votre@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mot de passe
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => updateFormData({ password: e.target.value })}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition"
                placeholder="••••••••"
              />
              <p className="text-xs text-gray-500 mt-1">Minimum 6 caractères</p>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Type de compte
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => updateFormData({ userType: 'individual' })}
                  className={`p-4 rounded-lg border-2 transition flex flex-col items-center gap-2 ${
                    formData.userType === 'individual'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <User className={`w-6 h-6 ${formData.userType === 'individual' ? 'text-blue-500' : 'text-gray-400'}`} />
                  <span className={`font-medium text-sm ${formData.userType === 'individual' ? 'text-blue-700' : 'text-gray-600'}`}>
                    Particulier
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => updateFormData({ userType: 'professional' })}
                  className={`p-4 rounded-lg border-2 transition flex flex-col items-center gap-2 ${
                    formData.userType === 'professional'
                      ? 'border-pink-500 bg-pink-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Briefcase className={`w-6 h-6 ${formData.userType === 'professional' ? 'text-pink-500' : 'text-gray-400'}`} />
                  <span className={`font-medium text-sm ${formData.userType === 'professional' ? 'text-pink-700' : 'text-gray-600'}`}>
                    Professionnel
                  </span>
                </button>
              </div>
            </div>
          </div>
        );

      case 3:
        if (formData.userType === 'individual') {
          return (
            <div className="space-y-6">
              <div className="text-center mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <User className="w-6 h-6 text-blue-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-1">Votre adresse</h3>
                <p className="text-sm text-gray-600">
                  Nous en avons besoin pour vous proposer des professionnels près de chez vous.
                </p>
              </div>
              
              <GoogleAddressAutocomplete
                value={formData.address}
                onAddressChange={({ address, postalCode, city }) => {
                  updateFormData({
                    address,
                    postalCode: postalCode ?? formData.postalCode,
                    city: city ?? formData.city,
                  });
                }}
                label="Adresse"
                placeholder="123 rue de la République"
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Code postal
                  </label>
                  <input
                    type="text"
                    value={formData.postalCode}
                    onChange={(e) => updateFormData({ postalCode: e.target.value })}
                    required
                    maxLength={5}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    placeholder="75001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ville
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => updateFormData({ city: e.target.value })}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    placeholder="Paris"
                  />
                </div>
              </div>
            </div>
          );
        }
        return (
          <ProfessionSelector
            selectedProfession={formData.profession}
            onProfessionChange={(profession) => updateFormData({ profession })}
          />
        );

      case 4:
        if (formData.userType === 'individual') {
          return (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Prêt à commencer !</h3>
              <p className="text-gray-600">
                Votre compte particulier est prêt. Cliquez sur "Créer mon compte" pour finaliser.
              </p>
            </div>
          );
        }
        return (
          <SiretValidator
            siret={formData.siret}
            onSiretChange={(siret) => updateFormData({ siret })}
            onValidationResult={(result) => {
              // Stocker toutes les informations récupérées du SIRET
              // Utiliser setFormData avec le callback pour accéder à l'état précédent
              console.log('📝 Stockage des données SIRET dans le formulaire:', {
                apeCode: result.company?.apeCode,
                companyName: result.company?.name,
                address: result.company?.address,
                postalCode: result.company?.postalCode,
                city: result.company?.city
              });
              
              setFormData((prev) => {
                const newData = {
                  ...prev,
                  siretValid: result.valid,
                  companyName: result.company?.name || prev.companyName,
                  // Stocker les informations de localisation du SIRET si disponibles
                  address: result.company?.address || prev.address || '',
                  postalCode: result.company?.postalCode || prev.postalCode || '',
                  city: result.company?.city || prev.city || '',
                  // Stocker le code APE (priorité sur le téléphone)
                  apeCode: result.company?.apeCode || prev.apeCode || '',
                  // Stocker le numéro de téléphone si disponible
                  phone: result.company?.phone || prev.phone || ''
                };
                
                console.log('✅ Données du formulaire après stockage:', {
                  apeCode: newData.apeCode,
                  companyName: newData.companyName
                });
                
                return newData;
              });
            }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 sm:p-6 lg:p-8 bg-white rounded-2xl shadow-xl">
      <div className="flex items-center justify-center mb-6 sm:mb-8">
        <img src="/logoheader.png" alt="Usemy Logo" className="w-12 h-12 sm:w-16 sm:h-16" />
      </div>

      <h2 className="text-2xl sm:text-3xl font-bold text-center mb-2 text-gray-800">Inscription</h2>
      <p className="text-center text-gray-600 mb-6 sm:mb-8 text-sm sm:text-base">Rejoignez la communauté Usemy</p>

      {/* Stepper */}
      <div className="mb-4 sm:mb-6">
        <Stepper 
          currentStep={currentStep} 
          totalSteps={STEPS.length} 
          steps={STEPS} 
        />
      </div>

      <form onSubmit={(e) => e.preventDefault()} className="space-y-4 sm:space-y-6">
        {/* Messages d'erreur */}
        {error && (
          <div className="p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Contenu de l'étape */}
        <div className="min-h-[200px] sm:min-h-[250px]">
          {renderStep()}
        </div>

        {/* Navigation */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-0 sm:justify-between">
          {currentStep > 1 && (
            <button
              type="button"
              onClick={prevStep}
              className="flex items-center justify-center gap-2 px-4 py-3 text-gray-600 hover:text-gray-800 transition border border-gray-300 rounded-lg sm:border-0 sm:px-4 sm:py-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Précédent
            </button>
          )}

          {currentStep < STEPS.length ? (
            <button
              type="button"
              onClick={nextStep}
              disabled={!isStepValid()}
              className="w-full sm:w-auto sm:ml-auto px-6 py-3 bg-pink-500 text-white rounded-lg font-semibold hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Suivant
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!isStepValid() || loading}
              className="w-full py-3 text-white rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              style={{
                background: 'linear-gradient(to right, #FF00FF, #FF33CC)'
              }}
            >
              {loading ? 'Création...' : 'Créer mon compte'}
            </button>
          )}
        </div>
      </form>

      <div className="mt-4 sm:mt-6 text-center">
        <p className="text-gray-600 text-sm sm:text-base">
          Déjà inscrit ?{' '}
          <button
            onClick={onToggleMode}
            className="text-pink-500 font-semibold hover:text-pink-600 transition"
          >
            Se connecter
          </button>
        </p>
      </div>
    </div>
  );
}
