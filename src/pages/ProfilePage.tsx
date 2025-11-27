import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, ProfessionalProfile } from '../lib/supabase';
import { ProfessionalInfo } from '../components/Profile/ProfessionalInfo';
import { formatApeCodeDisplay } from '../lib/apeCodeTranslator';
import { LogOut, User, Briefcase, MapPin, Award, Edit, Save, X, Hash } from 'lucide-react';

export function ProfilePage() {
  const { profile, signOut, refreshProfile } = useAuth();
  const [professionalProfile, setProfessionalProfile] = useState<ProfessionalProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    bio: '',
    phone: '',
    address: '',
    city: '',
    postal_code: '',
    company_name: '',
    category: '',
    website: '',
  });
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (profile) {
      // Vérifier si l'utilisateur est professionnel (en français 'professionnel' ou en anglais 'professional')
      const isProfessionalUser = profile.user_type === 'professional' || profile.user_type === 'professionnel';
      
      console.log('🔄 ProfilePage - Profile changé:', {
        id: profile.id,
        user_type: profile.user_type,
        isProfessional: isProfessionalUser
      });
      
      setFormData({
        full_name: profile.full_name || '',
        bio: profile.bio || '',
        phone: profile.phone || '',
        address: profile.address || '',
        city: profile.city || '',
        postal_code: profile.postal_code || '',
        company_name: '',
        category: '',
        website: '',
      });

      if (isProfessionalUser) {
        console.log('📞 Appel de loadProfessionalProfile pour user_id:', profile.id);
        loadProfessionalProfile();
      } else {
        console.log('ℹ️ Utilisateur non professionnel, pas de chargement du profil professionnel');
      }
    }
  }, [profile]);

  const loadProfessionalProfile = async () => {
    if (!profile) {
      console.warn('⚠️ loadProfessionalProfile appelé sans profile');
      return;
    }

    console.log('🔍 Début du chargement du profil professionnel pour user_id:', profile.id);

    const { data, error } = await supabase
      .from('professional_profiles')
      .select('*')
      .eq('user_id', profile.id)
      .maybeSingle();

    if (error) {
      console.error('❌ Erreur lors du chargement du profil professionnel:', {
        error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      return;
    }

    if (data) {
      console.log('✅ Profil professionnel trouvé:', {
        id: data.id,
        user_id: data.user_id,
        company_name: data.company_name,
        category: data.category,
        ape_code: data.ape_code,
        hasApeCode: !!data.ape_code,
        apeCodeValue: data.ape_code || 'NULL',
        siret: data.siret,
        allFields: Object.keys(data),
        rawData: JSON.stringify(data)
      });
      setProfessionalProfile(data);
      setFormData(prev => ({
        ...prev,
        company_name: data.company_name || '',
        category: data.category || '',
        website: data.website || '',
      }));
    } else {
      console.warn('⚠️ Aucun profil professionnel trouvé pour user_id:', profile.id);
      console.warn('💡 Vérifiez que le profil professionnel existe dans la table professional_profiles');
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: formData.full_name,
        bio: formData.bio,
        phone: formData.phone,
        address: formData.address,
        city: formData.city,
        postal_code: formData.postal_code,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      return;
    }

    // Vérifier si l'utilisateur est professionnel
    const isProfessional = profile.user_type === 'professional' || profile.user_type === 'professionnel';
    
    if (isProfessional) {
      if (professionalProfile) {
        const { error: professionalError } = await supabase
          .from('professional_profiles')
          .update({
            company_name: formData.company_name,
            category: formData.category,
            website: formData.website,
          })
          .eq('user_id', profile.id);

        if (professionalError) {
          console.error('Error updating professional profile:', professionalError);
          return;
        }
      } else {
        const { error: professionalError } = await supabase
          .from('professional_profiles')
          .insert({
            user_id: profile.id,
            company_name: formData.company_name,
            category: formData.category,
            website: formData.website,
          });

        if (professionalError) {
          console.error('Error creating professional profile:', professionalError);
          return;
        }
      }
    }

    await refreshProfile();
    setEditing(false);
  };

  const handleAvatarClick = () => {
    if (avatarUploading) return;
    avatarInputRef.current?.click();
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!profile) return;
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setAvatarUploading(true);

      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `avatars/${profile.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        console.error('Erreur lors de l\'upload de l\'avatar:', uploadError);
        return;
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = data.publicUrl;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', profile.id);

      if (updateError) {
        console.error('Erreur lors de la mise à jour de l\'avatar dans le profil:', updateError);
        return;
      }

      await refreshProfile();
    } catch (e) {
      console.error('Erreur inattendue lors de la mise à jour de l\'avatar:', e);
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
    }
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto pb-20">
      <div className="relative h-48 bg-gradient-to-br from-blue-500 to-cyan-500">
        <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2">
          <button
            type="button"
            onClick={handleAvatarClick}
            className="relative w-32 h-32 rounded-full bg-white p-2 shadow-xl group focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-white text-4xl font-bold overflow-hidden">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                profile.full_name.charAt(0).toUpperCase()
              )}
              {/* Overlay au survol / pendant l'upload */}
              <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-xs font-semibold">
                {avatarUploading ? 'Mise à jour...' : 'Changer la photo'}
              </div>
            </div>
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>
      </div>

      <div className="pt-20 px-6">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            {editing ? (
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full text-center border-b-2 border-blue-500 outline-none"
              />
            ) : (
              profile.full_name
            )}
          </h1>

          <span className={`inline-block px-4 py-1 rounded-full text-sm font-semibold ${
            (profile.user_type === 'professional' || profile.user_type === 'professionnel')
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-blue-100 text-blue-700'
          }`}>
            {(profile.user_type === 'professional' || profile.user_type === 'professionnel') ? 'Professionnel' : 'Particulier'}
          </span>

          <div className="flex items-center justify-center gap-2 mt-4 text-gray-600">
            <Award className="w-5 h-5 text-yellow-500" />
            <span className="text-xl font-bold">{profile.points} points</span>
          </div>
        </div>

        <div className="max-w-2xl mx-auto space-y-6">
          {editing ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                  placeholder="Parlez de vous..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Téléphone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="+33 6 12 34 56 78"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Adresse</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="123 Rue Example"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ville</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="Paris"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Code postal</label>
                  <input
                    type="text"
                    value={formData.postal_code}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="75001"
                  />
                </div>
              </div>

              {(profile.user_type === 'professional' || profile.user_type === 'professionnel') && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Entreprise</label>
                    <input
                      type="text"
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      placeholder="Mon Entreprise"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Catégorie</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    >
                      <option value="">Sélectionner une catégorie</option>
                      <option value="Santé">Santé</option>
                      <option value="Maison">Maison</option>
                      <option value="Beauté">Beauté</option>
                      <option value="Technologie">Technologie</option>
                      <option value="Éducation">Éducation</option>
                      <option value="Finance">Finance</option>
                      <option value="Transport">Transport</option>
                      <option value="Restauration">Restauration</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Site web</label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      placeholder="https://exemple.com"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setEditing(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition flex items-center justify-center gap-2"
                >
                  <X className="w-5 h-5" />
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-cyan-600 transition flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  Enregistrer
                </button>
              </div>
            </>
          ) : (
            <>
              {profile.bio && (
                <div className="bg-white rounded-xl p-4 shadow-md">
                  <p className="text-gray-700">{profile.bio}</p>
                </div>
              )}

              <div className="bg-white rounded-xl p-4 shadow-md space-y-3">
                {(profile.user_type === 'professional' || profile.user_type === 'professionnel') && professionalProfile && (
                  <>
                    {professionalProfile.company_name && (
                      <div className="flex items-center gap-3 text-gray-700">
                        <Briefcase className="w-5 h-5 text-blue-500" />
                        <span>{professionalProfile.company_name}</span>
                      </div>
                    )}
                    {/* Afficher uniquement l'activité traduite du code APE */}
                    {professionalProfile.ape_code && (
                      <div className="flex items-center gap-3 text-gray-700">
                        <Hash className="w-5 h-5 text-blue-500" />
                        <span className="font-medium">{formatApeCodeDisplay(professionalProfile.ape_code)}</span>
                      </div>
                    )}
                  </>
                )}

                {profile.address && (
                  <div className="flex items-center gap-3 text-gray-700">
                    <MapPin className="w-5 h-5 text-blue-500" />
                    <span>{profile.address}, {profile.city} {profile.postal_code}</span>
                  </div>
                )}
              </div>

              {/* Informations professionnelles vérifiées */}
              {(profile.user_type === 'professional' || profile.user_type === 'professionnel') && (
                <ProfessionalInfo userId={profile.id} />
              )}

              <button
                onClick={() => setEditing(true)}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-cyan-600 transition flex items-center justify-center gap-2 shadow-lg"
              >
                <Edit className="w-5 h-5" />
                Modifier le profil
              </button>
            </>
          )}

          <button
            onClick={signOut}
            className="w-full py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition flex items-center justify-center gap-2 shadow-lg"
          >
            <LogOut className="w-5 h-5" />
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
