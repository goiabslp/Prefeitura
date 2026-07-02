import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { User } from '../types';

interface OnlineUser {
  id: string;
  name: string;
  avatar: string | undefined;
}

export const OnlineUsers: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const [onlineUsers, setOnlineUsers] = useState<Map<string, OnlineUser>>(new Map());

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
    <div className="flex items-center gap-2 mr-2 md:mr-4 border-r border-slate-200 pr-2 md:pr-4">
      <div className="flex -space-x-2 overflow-visible">
        {usersArray.slice(0, 5).map((u, i) => (
          <div key={`${u.id}-${i}`} className="relative group inline-block">
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
          </div>
        ))}
        {usersArray.length > 5 && (
          <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center shadow-sm z-10">
            <span className="text-[10px] font-black text-slate-600">+{usersArray.length - 5}</span>
          </div>
        )}
      </div>
    </div>
  );
};
