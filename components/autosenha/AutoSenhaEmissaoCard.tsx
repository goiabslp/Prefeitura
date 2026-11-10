import React from 'react';
import {
  PlusCircle, UserCheck, CheckCircle2, UserPlus,
  Sparkles, RefreshCw, AlertCircle, AlertTriangle, ShieldAlert
} from 'lucide-react';
import {
  AutoSenhaPrioridadeTipo,
  ConsultaPaciente
} from '../../types';
import { formatCpf, formatBirthDateBr, calculateAgeYears } from '../../utils/cpfUtils';

export type AutoSenhaClassificacaoAtendimento = AutoSenhaPrioridadeTipo | 'AVALIACAO_IMEDIATA';

export interface AutoSenhaEmissaoCardProps {
  unidadeTipo: 'PSF' | 'UPA';
  pacienteSelecionado: ConsultaPaciente | null;
  pacienteLocalizadoMeta?: { isNew: boolean } | null;
  cidadaoNome: string;
  classificacao: AutoSenhaClassificacaoAtendimento;
  isSubmitting: boolean;
  onAbrirLocalizarCpf: () => void;
  onLimparPaciente: () => void;
  onClassificacaoChange: (classificacao: AutoSenhaClassificacaoAtendimento) => void;
  onSubmitAcaoPrincipal: (e: React.FormEvent) => void;
}

export const AutoSenhaEmissaoCard: React.FC<AutoSenhaEmissaoCardProps> = ({
  unidadeTipo,
  pacienteSelecionado,
  pacienteLocalizadoMeta,
  cidadaoNome,
  classificacao,
  isSubmitting,
  onAbrirLocalizarCpf,
  onLimparPaciente,
  onClassificacaoChange,
  onSubmitAcaoPrincipal
}) => {
  const idadePaciente = pacienteSelecionado?.birth_date
    ? calculateAgeYears(pacienteSelecionado.birth_date)
    : null;

  const cpfFormatado = pacienteSelecionado?.cpf
    ? formatCpf(pacienteSelecionado.cpf) || pacienteSelecionado.cpf
    : 'Não informado';

  const nascimentoFormatado = pacienteSelecionado?.birth_date
    ? formatBirthDateBr(pacienteSelecionado.birth_date)
    : null;

  const temPacienteValido = Boolean(pacienteSelecionado || cidadaoNome.trim());
  const isAvaliacaoImediata = classificacao === 'AVALIACAO_IMEDIATA';

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 sm:p-6 flex flex-col justify-between h-full">
      <div className="flex flex-col gap-4">
        {/* Cabeçalho do Painel */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200/70 flex items-center justify-center text-emerald-600 shrink-0">
              <PlusCircle className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider">
                Emitir Nova Senha
              </h2>
              <p className="text-[11px] font-medium text-slate-400">
                {unidadeTipo === 'UPA' ? 'Atendimento e Acolhimento UPA' : 'Recepção Integrada da Unidade'}
              </p>
            </div>
          </div>

          {pacienteSelecionado && (
            <button
              type="button"
              onClick={onLimparPaciente}
              className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors cursor-pointer flex items-center gap-1"
              title="Limpar paciente selecionado"
            >
              <RefreshCw className="w-3 h-3" />
              Limpar
            </button>
          )}
        </div>

        {/* Formulário Principal */}
        <form onSubmit={onSubmitAcaoPrincipal} className="flex flex-col gap-4">
          {/* Card do Paciente Localizado / Selecionado */}
          {pacienteSelecionado ? (
            <div className="flex flex-col gap-2.5 animate-fade-in">
              {/* Faixa superior de confirmação visual */}
              <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-900">
                <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-black uppercase tracking-wider text-emerald-800 leading-tight">
                    {pacienteLocalizadoMeta?.isNew ? 'Paciente Cadastrado e Vinculado' : 'Paciente Localizado'}
                  </p>
                  <p className="text-[11px] font-medium text-emerald-700 leading-tight truncate">
                    {pacienteLocalizadoMeta?.isNew
                      ? 'Cadastro integrado concluído e vinculado ao atendimento.'
                      : 'Dados encontrados na base municipal de saúde.'}
                  </p>
                </div>
              </div>

              {/* Card Destacado com Nome Grande e Negrito + CPF e Data de Nascimento */}
              <div className="relative p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/50 border-2 border-emerald-400/70 shadow-sm flex items-start sm:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/20">
                    <UserCheck className="w-6 h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="inline-block text-[10px] font-black uppercase tracking-widest text-emerald-700 mb-0.5">
                      Paciente Selecionado
                    </span>
                    <h3 className="text-base sm:text-xl font-black text-slate-900 uppercase tracking-tight leading-snug break-words">
                      {pacienteSelecionado.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 text-xs font-semibold text-slate-600">
                      <span>
                        CPF: <strong className="text-slate-800 font-mono">{cpfFormatado}</strong>
                      </span>
                      <span className="text-slate-300">|</span>
                      <span>
                        Nasc.:{' '}
                        <strong className="text-slate-800">
                          {nascimentoFormatado || 'Não informada'}
                          {idadePaciente !== null ? ` (${idadePaciente} anos)` : ''}
                        </strong>
                      </span>
                      {pacienteSelecionado.sus_number && (
                        <>
                          <span className="text-slate-300">|</span>
                          <span>
                            SUS: <strong className="text-slate-800 font-mono">{pacienteSelecionado.sus_number}</strong>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <div
                    className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs"
                    title="Paciente confirmado"
                  >
                    <CheckCircle2 className="w-4.5 h-4.5" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 sm:p-5 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-200/80 text-slate-500 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  Nenhum Paciente Selecionado
                </p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Clique em <strong>Localizar Paciente</strong> para consultar pelo CPF na base integrada municipal ou concluir um novo cadastro.
                </p>
              </div>
            </div>
          )}

          {/* Botão Amplo de Localização Simplificada por CPF */}
          <button
            type="button"
            onClick={onAbrirLocalizarCpf}
            className="w-full py-3.5 px-4 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-md shadow-sky-600/20 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <UserPlus className="w-4.5 h-4.5" />
            <span>{pacienteSelecionado ? 'Localizar Outro Paciente' : 'Localizar Paciente'}</span>
          </button>

          {/* 4 Classificações de Atendimento em Linha Única no Desktop */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
              Classificação de Atendimento / Prioridade Legal
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* NORMAL — Azul */}
              <button
                type="button"
                onClick={() => onClassificacaoChange('NORMAL')}
                aria-pressed={classificacao === 'NORMAL'}
                className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                  classificacao === 'NORMAL'
                    ? 'bg-sky-600 border-sky-600 text-white shadow-md shadow-sky-600/25'
                    : 'bg-sky-50/50 border-sky-200 text-slate-700 hover:border-sky-400 hover:bg-sky-50'
                }`}
              >
                <div className="text-xs font-black uppercase tracking-wide">Normal</div>
                <div className={`text-[10px] mt-1 leading-snug ${classificacao === 'NORMAL' ? 'text-sky-100' : 'text-slate-500'}`}>
                  Fila geral
                </div>
              </button>

              {/* PRIORITÁRIO — Amarelo */}
              <button
                type="button"
                onClick={() => onClassificacaoChange('PRIORITARIO')}
                aria-pressed={classificacao === 'PRIORITARIO'}
                className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                  classificacao === 'PRIORITARIO'
                    ? 'bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-500/25'
                    : 'bg-amber-50/50 border-amber-200 text-slate-700 hover:border-amber-400 hover:bg-amber-50'
                }`}
              >
                <div className="text-xs font-black uppercase tracking-wide">Prioritário</div>
                <div className={`text-[10px] mt-1 leading-snug ${classificacao === 'PRIORITARIO' ? 'text-amber-100' : 'text-slate-500'}`}>
                  Idoso 60-79, PCD
                </div>
              </button>

              {/* ESPECIAL — Roxo */}
              <button
                type="button"
                onClick={() => onClassificacaoChange('ESPECIAL')}
                aria-pressed={classificacao === 'ESPECIAL'}
                className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                  classificacao === 'ESPECIAL'
                    ? 'bg-purple-600 border-purple-600 text-white shadow-md shadow-purple-600/25'
                    : 'bg-purple-50/50 border-purple-200 text-slate-700 hover:border-purple-400 hover:bg-purple-50'
                }`}
              >
                <div className="text-xs font-black uppercase tracking-wide">Especial</div>
                <div className={`text-[10px] mt-1 leading-snug ${classificacao === 'ESPECIAL' ? 'text-purple-100' : 'text-slate-500'}`}>
                  Idoso 80+
                </div>
              </button>

              {/* AVALIAÇÃO IMEDIATA — Vermelho */}
              <button
                type="button"
                onClick={() => onClassificacaoChange('AVALIACAO_IMEDIATA')}
                aria-pressed={isAvaliacaoImediata}
                className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isAvaliacaoImediata
                    ? 'bg-red-600 border-red-600 text-white shadow-md shadow-red-600/30'
                    : 'bg-red-50/60 border-red-200 text-red-900 hover:border-red-400 hover:bg-red-50'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <AlertTriangle
                    className={`w-3.5 h-3.5 shrink-0 ${isAvaliacaoImediata ? 'text-white' : 'text-red-600'}`}
                  />
                  <span className="text-[11px] font-black uppercase tracking-wide leading-tight">
                    AVALIAÇÃO IMEDIATA
                  </span>
                </div>
                <div className={`text-[10px] mt-1 leading-snug ${isAvaliacaoImediata ? 'text-red-100' : 'text-red-700/80'}`}>
                  Situação que exige avaliação imediata.
                </div>
              </button>
            </div>
          </div>

          {/* Botão Principal Adaptável à Classificação */}
          <button
            type="submit"
            disabled={isSubmitting || (!isAvaliacaoImediata && !temPacienteValido)}
            className={`w-full py-3.5 sm:py-4 px-5 text-white rounded-2xl text-sm sm:text-base font-black uppercase tracking-wider shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none disabled:cursor-not-allowed ${
              isAvaliacaoImediata
                ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-red-600/25'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/25'
            }`}
          >
            {isAvaliacaoImediata ? (
              <>
                <ShieldAlert className="w-5 h-5" />
                <span>{isSubmitting ? 'Registrando Solicitação...' : 'Solicitar Avaliação Imediata'}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>{isSubmitting ? 'Emitindo Senha...' : 'Emitir Senha'}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
