/**
 * Utilitários para manuseio e identificação única de Número de Nota Fiscal no módulo Abastecimento.
 */

/**
 * Retorna apenas o número da nota informado pelo usuário para exibição em telas, relatórios e formulários.
 * Exemplo: "2536-A7K9X2" -> "2536"
 * Exemplo: "2536" -> "2536"
 */
export function getDisplayInvoiceNumber(invoiceNumber?: string | null): string {
    if (!invoiceNumber) return '';
    const trimmed = invoiceNumber.trim();
    // Verifica se a nota possui sufixo no formato -XXXXXX (6 caracteres alfanuméricos)
    const match = trimmed.match(/^(.*?)-[A-Za-z0-9]{6}$/);
    if (match) {
        return match[1];
    }
    return trimmed;
}

/**
 * Gera um sufixo alfanumérico aleatório de 6 caracteres (letras maiúsculas e números).
 */
export function generateInvoiceSuffix(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let suffix = '';
    for (let i = 0; i < 6; i++) {
        suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return suffix;
}

/**
 * Formata o Identificador Único Interno combinando o número da nota informado com o sufixo alfanumérico.
 * Exemplo: ("2536", "A7K9X2") -> "2536-A7K9X2"
 */
export function formatInternalInvoiceId(userNote: string, suffix?: string): string {
    const cleanNote = userNote ? userNote.trim() : '';
    if (!cleanNote) return '';
    
    // Se a nota já contém o sufixo no final, retorna ela mesma
    if (/^.*-[A-Za-z0-9]{6}$/.test(cleanNote)) {
        return cleanNote;
    }

    const actualSuffix = suffix || generateInvoiceSuffix();
    return `${cleanNote}-${actualSuffix}`;
}
