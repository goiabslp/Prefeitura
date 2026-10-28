import { FarmaciaMovimentacao } from '../types';

/**
 * Verifica se uma data corresponde ao dia civil atual no fuso horário oficial de Brasília (America/Sao_Paulo).
 */
export function isTodayInSaoPaulo(dateInput?: string | Date | null): boolean {
    if (!dateInput) return false;
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return false;

    try {
        const formatter = new Intl.DateTimeFormat('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });

        const inputFormatted = formatter.format(d);
        const todayFormatted = formatter.format(new Date());

        return inputFormatted === todayFormatted;
    } catch (e) {
        // Fallback local se intl falhar
        const today = new Date();
        return d.getDate() === today.getDate() &&
               d.getMonth() === today.getMonth() &&
               d.getFullYear() === today.getFullYear();
    }
}

/**
 * Informações estruturadas de desistência extraídas de uma movimentação.
 */
export interface DesistenciaInfo {
    isDesistencia: boolean;
    dataHoraIso?: string;
    responsavelNome?: string;
    situacaoRetorno?: 'Retorno ao Estoque' | 'Quarentena Sanitária';
    motivo?: string;
}

/**
 * Identifica se uma movimentação de farmácia possui desistência registrada.
 */
export function isDesistenciaMovimentacao(mov?: FarmaciaMovimentacao | null): boolean {
    if (!mov) return false;
    if ((mov as any).desistencia === true) return true;
    if (mov.observacoes && mov.observacoes.includes('[DESISTÊNCIA REGISTRADA')) return true;
    return false;
}

/**
 * Extrai os detalhes de auditoria da desistência contidos na observação da movimentação.
 */
export function parseDesistenciaInfo(mov?: FarmaciaMovimentacao | null): DesistenciaInfo {
    if (!mov || !isDesistenciaMovimentacao(mov)) {
        return { isDesistencia: false };
    }

    const obs = mov.observacoes || '';
    const match = obs.match(/\[DESISTÊNCIA REGISTRADA\s*\|\s*Data:\s*([^|]+)\|\s*Responsavel:\s*([^|]+)\|\s*Situacao:\s*([^|]+)\|\s*Motivo:\s*([^\]]+)\]/i);

    if (match) {
        return {
            isDesistencia: true,
            dataHoraIso: match[1]?.trim(),
            responsavelNome: match[2]?.trim(),
            situacaoRetorno: match[3]?.trim().includes('Quarentena') ? 'Quarentena Sanitária' : 'Retorno ao Estoque',
            motivo: match[4]?.trim()
        };
    }

    return {
        isDesistencia: true,
        motivo: 'Paciente desistiu de levar o medicamento.'
    };
}

/**
 * Mascara parcialmente um CPF para exibição segura (LGPD).
 * Exemplo: "100.965.186-26" -> "100.***.***-26"
 */
export function maskCpf(cpfRaw?: string | null): string {
    if (!cpfRaw) return '---';
    const clean = cpfRaw.replace(/\D/g, '');
    if (clean.length !== 11) {
        return cpfRaw;
    }
    const p1 = clean.slice(0, 3);
    const p4 = clean.slice(9, 11);
    return `${p1}.***.***-${p4}`;
}
