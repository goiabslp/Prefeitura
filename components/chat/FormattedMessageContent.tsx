import React from 'react';

interface FormattedMessageContentProps {
  content: string;
  className?: string;
  isUser?: boolean;
}

/**
 * Renderiza o texto da mensagem de forma limpa, eliminando marcadores Markdown
 * crus como '**' e transformando-os em negrito visual elegante e estruturado.
 */
export const FormattedMessageContent: React.FC<FormattedMessageContentProps> = ({
  content,
  className = '',
  isUser = false
}) => {
  if (!content) return null;

  // 1. Remove TOOL_CALL residuais caso existam
  let cleanText = content.replace(/TOOL_CALL:\s*\{[\s\S]*?\}/g, '').trim();

  // 2. Normaliza quebras de linha
  const lines = cleanText.split('\n');

  return (
    <div className={`space-y-1.5 leading-relaxed font-sans ${className}`}>
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={lineIdx} className="h-1.5" />;
        }

        // Verifica se é item de lista com marcador (- ou *)
        const isBullet = /^[•\-\*]\s+/.test(trimmed);
        const lineContent = isBullet ? trimmed.replace(/^[•\-\*]\s+/, '') : trimmed;

        // Processa partes em negrito (delimitadas por **)
        const parts: React.ReactNode[] = [];
        const boldRegex = /\*\*(.*?)\*\*/g;
        let lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = boldRegex.exec(lineContent)) !== null) {
          // Texto antes do negrito
          if (match.index > lastIndex) {
            parts.push(
              <span key={`txt-${lastIndex}`}>
                {lineContent.substring(lastIndex, match.index)}
              </span>
            );
          }
          // Conteúdo em negrito (sem os asteriscos!)
          const boldText = match[1].trim();
          if (boldText) {
            parts.push(
              <strong 
                key={`bold-${match.index}`} 
                className={`font-black tracking-tight ${isUser ? 'text-white' : 'text-orange-700'}`}
              >
                {boldText}
              </strong>
            );
          }
          lastIndex = boldRegex.lastIndex;
        }

        // Texto restante após o último match
        if (lastIndex < lineContent.length) {
          const remaining = lineContent.substring(lastIndex).replace(/\*\*/g, '');
          parts.push(<span key={`txt-end`}>{remaining}</span>);
        }

        if (isBullet) {
          return (
            <div key={lineIdx} className="flex items-start gap-1.5 pl-1 text-[11px] md:text-xs">
              <span className={`text-[10px] shrink-0 mt-0.5 ${isUser ? 'text-white/80' : 'text-orange-500'}`}>
                ●
              </span>
              <div className="flex-1">{parts}</div>
            </div>
          );
        }

        return (
          <p key={lineIdx} className="text-xs md:text-[13px] leading-relaxed break-words">
            {parts}
          </p>
        );
      })}
    </div>
  );
};
