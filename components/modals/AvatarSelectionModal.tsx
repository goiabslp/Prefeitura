import React, { useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { User } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, CheckCircle } from 'lucide-react';

interface AvatarSelectionModalProps {
  currentUser: User;
}

const AVATAR_SEEDS = [
  'Felix', 'Aneka', 'Jack', 'Bella', 'Max', 
  'Oliver', 'Lucy', 'Charlie', 'Milo', 'Chloe', 
  'Leo', 'Lily', 'Lola', 'Oscar', 'Luna'
];

export const AvatarSelectionModal: React.FC<AvatarSelectionModalProps> = ({ currentUser }) => {
  const { refreshUser } = useAuth();
  const [selectedSeed, setSelectedSeed] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAvatarUrl = (seed: string) => `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;

  const handleSave = async () => {
    if (!selectedSeed) return;
    
    setIsSaving(true);
    setError(null);
    try {
      const avatarUrl = getAvatarUrl(selectedSeed);
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar: avatarUrl })
        .eq('id', currentUser.id);

      if (updateError) throw updateError;
      
      // Update the local context
      await refreshUser();
    } catch (err: any) {
      console.error('Error updating avatar:', err);
      setError(err.message || 'Erro ao salvar o avatar. Tente novamente.');
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-500">
        
        {/* Header */}
        <div className="bg-indigo-600 p-8 text-center relative overflow-hidden shrink-0">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <h2 className="text-3xl font-black text-white relative z-10 mb-2">Escolha seu Avatar</h2>
          <p className="text-indigo-100 font-medium relative z-10 text-lg">
            Para continuar, selecione um avatar que represente você no sistema.
          </p>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto flex-1 bg-slate-50">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-2xl text-sm font-bold text-center">
              {error}
            </div>
          )}

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-6">
            {AVATAR_SEEDS.map((seed) => {
              const isSelected = selectedSeed === seed;
              return (
                <button
                  key={seed}
                  onClick={() => setSelectedSeed(seed)}
                  className={`relative group aspect-square rounded-2xl flex items-center justify-center p-4 transition-all duration-300 ${
                    isSelected 
                      ? 'bg-indigo-100 border-2 border-indigo-600 shadow-[0_0_20px_rgba(79,70,229,0.3)] scale-105 z-10' 
                      : 'bg-white border-2 border-slate-200 hover:border-indigo-300 hover:shadow-lg hover:-translate-y-1'
                  }`}
                >
                  <img
                    src={getAvatarUrl(seed)}
                    alt={`Avatar ${seed}`}
                    className="w-full h-full object-contain drop-shadow-md group-hover:scale-110 transition-transform duration-300"
                  />
                  {isSelected && (
                    <div className="absolute -top-3 -right-3 bg-indigo-600 text-white rounded-full p-1.5 shadow-lg animate-bounce">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-white border-t border-slate-100 flex items-center justify-between shrink-0">
          <div className="text-slate-500 text-sm font-medium">
            * O uso de avatar é obrigatório para identificação na plataforma.
          </div>
          <button
            onClick={handleSave}
            disabled={!selectedSeed || isSaving}
            className={`flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-white transition-all duration-300 ${
              !selectedSeed || isSaving
                ? 'bg-slate-300 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-600/30 hover:-translate-y-1'
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Salvando...
              </>
            ) : (
              'Confirmar Escolha'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
