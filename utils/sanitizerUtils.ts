/**
 * Utilitário de sanitização para remoção de credenciais, tokens, senhas e informações sensíveis
 * de mensagens e logs de erro antes da exibição ou cópia.
 */

// Padrões de dados confidenciais comuns
const SENSITIVE_PATTERNS: { regex: RegExp; replacement: string }[] = [
    // Tokens JWT completos (header.payload.signature)
    {
        regex: /eyJ[a-zA-Z0-9_-]{5,}\.eyJ[a-zA-Z0-9_-]{5,}\.[a-zA-Z0-9_-]{5,}/g,
        replacement: '[TOKEN_JWT_PROTEGIDO]'
    },
    // Headers de autorização Bearer
    {
        regex: /Bearer\s+[a-zA-Z0-9._~+/-]+=*/gi,
        replacement: 'Bearer [TOKEN_PROTEGIDO]'
    },
    // Parâmetros de senha em URLs, queries ou JSON
    {
        regex: /(["']?(?:password|senha|secret|client_secret|access_token|refresh_token|api_key|apikey|private_key|anon_key)["']?\s*[:=]\s*["'])([^"'\r\n]+)(["'])/gi,
        replacement: '$1[PROTEGIDO]$3'
    },
    // Cookies
    {
        regex: /(cookie\s*[:=]\s*["']?)([^"';\r\n]+)(["']?)/gi,
        replacement: '$1[COOKIES_PROTEGIDOS]$3'
    },
    // Chaves Supabase Anon Key extensas
    {
        regex: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9._-]+/g,
        replacement: '[SUPABASE_KEY_PROTEGIDA]'
    }
];

/**
 * Sanitiza uma string removendo tokens, senhas e dados confidenciais.
 */
export const sanitizeErrorText = (input: unknown): string => {
    if (input === null || input === undefined) {
        return '';
    }

    let text = typeof input === 'string' 
        ? input 
        : typeof input === 'object' 
            ? safeStringify(input) 
            : String(input);

    for (const pattern of SENSITIVE_PATTERNS) {
        text = text.replace(pattern.regex, pattern.replacement);
    }

    return text;
};

/**
 * Stringify seguro que lida com referências circulares e propriedades completas de erros
 */
const safeStringify = (obj: any): string => {
    try {
        const seen = new WeakSet();

        // Se for instância de Error ou tiver protótipo de erro, extrai propriedades próprias
        let target = obj;
        if (obj instanceof Error) {
            target = {
                name: obj.name,
                message: obj.message,
                stack: obj.stack
            };
            for (const key of Object.getOwnPropertyNames(obj)) {
                (target as any)[key] = (obj as any)[key];
            }
        } else if (typeof obj === 'object' && obj !== null) {
            const ownProps = Object.getOwnPropertyNames(obj);
            if (ownProps.length > 0 && Object.keys(obj).length === 0) {
                target = {};
                for (const key of ownProps) {
                    target[key] = (obj as any)[key];
                }
            }
        }

        return JSON.stringify(target, (key, value) => {
            // Se for uma chave sensível conhecida no objeto
            const lowerKey = key.toLowerCase();
            if (['password', 'senha', 'token', 'secret', 'client_secret', 'apikey', 'cookie', 'anon_key'].includes(lowerKey)) {
                return '[PROTEGIDO]';
            }
            if (typeof value === 'object' && value !== null) {
                if (seen.has(value)) {
                    return '[Circular]';
                }
                seen.add(value);
            }
            return value;
        }, 2);
    } catch {
        return String(obj);
    }
};
