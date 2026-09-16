import { useState, useEffect } from 'react';

/**
 * Hook para aplicar debounce em valores de input, evitando disparar
 * requisições ao banco de dados a cada tecla digitada.
 *
 * @param value Valor a ser observado
 * @param delay Tempo de espera em ms (padrão: 400ms)
 */
export function useDebounce<T>(value: T, delay: number = 400): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}
