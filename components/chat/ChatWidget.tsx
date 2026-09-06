import React, { useState } from 'react';
import { Bot, X } from 'lucide-react';
import { useChat } from '../../contexts/ChatContext';

export const ChatWidget: React.FC = () => {
  const { isOpen, setIsOpen } = useChat();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 md:bottom-5 md:right-5 z-40 flex items-center shrink-0 select-none pointer-events-auto">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`chat-toggle-btn group relative flex items-center justify-center transition-all duration-300 ease-out cursor-pointer outline-none active:scale-95 ${
          isOpen
            ? 'w-9 h-9 md:w-10 md:h-10 rounded-full bg-slate-900 text-white shadow-md shadow-slate-900/25 hover:bg-slate-800 border border-slate-700'
            : 'h-9 md:h-10 rounded-full bg-white/95 text-slate-700 shadow-sm shadow-slate-200 hover:shadow-lg hover:shadow-indigo-500/15 border border-slate-200/90 hover:border-indigo-300 hover:text-indigo-600 backdrop-blur-md'
        } ${!isOpen && isHovered ? 'px-3 gap-1.5' : 'w-9 md:w-10 px-0'}`}
        title={isOpen ? 'Fechar Assistente IA' : 'Assistente IA'}
        aria-label={isOpen ? 'Fechar Assistente IA' : 'Abrir Assistente IA'}
      >
        {/* Ícone Minimalista */}
        <div className="relative flex items-center justify-center shrink-0">
          {isOpen ? (
            <X className="w-4 h-4 transition-transform duration-200 group-hover:rotate-90" />
          ) : (
            <Bot className="w-4 h-4 md:w-4.5 md:h-4.5 text-indigo-600 transition-transform duration-300 group-hover:scale-110" />
          )}

          {/* Micro-ponto de atividade sutil */}
          {!isOpen && (
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-white"></span>
          )}
        </div>

        {/* Indicação sutil no hover */}
        {!isOpen && isHovered && (
          <span className="text-[11px] font-bold tracking-tight text-slate-700 whitespace-nowrap animate-fade-in hidden sm:inline">
            Assistente IA
          </span>
        )}
      </button>
    </div>
  );
};
