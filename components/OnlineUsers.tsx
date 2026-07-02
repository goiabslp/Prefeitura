import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { User } from '../types';
import { X } from 'lucide-react';

interface OnlineUser {
  id: string;
  name: string;
  avatar: string | undefined;
  jobTitle?: string;
  role?: string;
}

export const OnlineUsers: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const [onlineUsers, setOnlineUsers] = useState<Map<string, OnlineUser>>(new Map());
  const [selectedUser, setSelectedUser] = useState<OnlineUser | null>(null);

  useEffect(() => {
    if (!currentUser) return;

    // Conectar ao channel de presença
    const room = supabase.channel('online-users');

    room
      .on('presence', { event: 'sync' }, () => {
        const state = room.presenceState<OnlineUser>();
        const newOnlineUsers = new Map<string, OnlineUser>();
        
        // Iterar sobre o estado para pegar os usuários ativos únicos
        Object.values(state).forEach((presences) => {
          presences.forEach((presence) => {
            if (presence.id) {
              newOnlineUsers.set(presence.id, presence);
            }
          });
        });

        setOnlineUsers(newOnlineUsers);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Quando estiver inscrito, envia a própria presença
          await room.track({
            id: currentUser.id,
            name: currentUser.name,
            avatar: currentUser.avatar,
            jobTitle: currentUser.jobTitle,
            role: currentUser.role
          });
        }
      });

    return () => {
      room.untrack();
      supabase.removeChannel(room);
    };
  }, [currentUser]);

  // Transformar o Map em array para renderizar
  const usersArray = Array.from(onlineUsers.values());

  if (usersArray.length === 0) return null;

  return (
    <>
      <div className="flex items-center gap-2 mr-2 md:mr-4 border-r border-slate-200 pr-2 md:pr-4">
        <div className="flex gap-2 overflow-visible">
          {usersArray.map((u, i) => (
            <button
              key={`${u.id}-${i}`}
              onClick={() => setSelectedUser(u)}
              className="relative group inline-block focus:outline-none"
            >
              {u.avatar ? (
                <img
                  src={u.avatar}
                  alt={u.name}
                  className="w-8 h-8 rounded-full border-2 border-white object-cover shadow-sm bg-slate-900 group-hover:z-10 group-hover:scale-110 transition-transform"
                />
              ) : (
                <div className="w-8 h-8 rounded-full border-2 border-white bg-indigo-100 flex items-center justify-center shadow-sm group-hover:z-10 group-hover:scale-110 transition-transform">
                  <span className="text-[10px] font-black text-indigo-700">{u.name.charAt(0)}</span>
                </div>
              )}
              
              {/* Status dot verde */}
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-[1.5px] border-white rounded-full z-20"></div>
              
              {/* Tooltip */}
              <div className="absolute top-10 left-1/2 -translate-x-1/2 px-2.5 py-1.5 bg-slate-800 text-white text-[11px] font-bold rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[100]">
                {u.name}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Mini Modal do Perfil */}
      {selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300 relative border border-slate-100">
            
            <button
              onClick={() => setSelectedUser(null)}
              className="absolute top-4 right-4 p-2 bg-slate-100/50 hover:bg-slate-200 text-slate-500 rounded-full z-10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Fundo do Header do Modal */}
            <div className="h-24 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 relative overflow-hidden">
               <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"></div>
            </div>

            <div className="px-6 pb-8 text-center -mt-12 relative z-10">
              <div className="inline-block relative">
                {selectedUser.avatar ? (
                  <img
                    src={selectedUser.avatar}
                    alt={selectedUser.name}
                    className="w-24 h-24 rounded-full border-4 border-white shadow-xl object-cover bg-slate-900 mx-auto"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full border-4 border-white shadow-xl bg-indigo-100 flex items-center justify-center mx-auto">
                    <span className="text-3xl font-black text-indigo-700">{selectedUser.name.charAt(0)}</span>
                  </div>
                )}
                <div className="absolute bottom-1 right-1 w-5 h-5 bg-green-400 border-2 border-white rounded-full z-20 shadow-md"></div>
              </div>
              
              <h3 className="mt-4 text-xl font-black text-slate-900 tracking-tight">
                {selectedUser.name}
              </h3>
              
              <div className="mt-1 flex items-center justify-center gap-2">
                <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-widest border border-indigo-100">
                  {selectedUser.jobTitle || selectedUser.role || 'Usuário'}
                </span>
              </div>
              
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500 font-medium">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                Online agora
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
