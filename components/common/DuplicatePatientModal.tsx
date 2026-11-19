import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ConsultaPaciente, User } from '../../types';
import { formatCpf, formatBirthDateBr, calculateAgeYears, maskCpfPartial } from '../../utils/cpfUtils';
import { PatientConflictType } from '../../utils/patientDuplicateUtils';
import { encaminharParaConferenciaAdministrativa } from '../../services/consultasService';
import { 
  AlertTriangle, 
  UserCheck, 
  Eye, 
  X, 
  ShieldAlert, 
  FileText, 
  Calendar, 
  CreditCard, 
  Phone, 
  MapPin, 
  CheckCircle2, 
  Loader2,
  Send,
  Building2,
  ExternalLink
} from 'lucide-react';

export interface AttemptedCandidateData {
  name: string;
  cpf?: string | null;
  birthDate?: string | null;
  phone?: string | null;
  neighborhood?: string | null;
  street?: string | null;
  susNumber?: string | null;
  nickname?: string | null;
}

interface DuplicatePatientModalProps {
  isOpen: boolean;
  existingPatient: ConsultaPaciente | null;
  conflictType: PatientConflictType | null;
  attemptedCandidate?: AttemptedCandidateData | null;
  currentUser?: User | null;
  onUseExisting: (patient: ConsultaPaciente) => void;
  onViewDetails?: (patient: ConsultaPaciente) => void;
  onCancel: () => void;
  onSentToAdminConference?: () => void;
}

export const DuplicatePatientModal: React.FC<DuplicatePatientModalProps> = ({
  isOpen,
  existingPatient,
  conflictType,
  attemptedCandidate,
  currentUser,
  onUseExisting,
  onViewDetails,
  onCancel,
  onSentToAdminConference
}) => {
  const [isConferenceModalOpen, setIsConferenceModalOpen] = useState(false);
  const [conferenceNotes, setConferenceNotes] = useState('');
  const [isSendingConference, setIsSendingConference] = useState(false);
  const [conferenceSuccess, setConferenceSuccess] = useState(false);
  const [conferenceError, setConferenceError] = useState<string | null>(null);

  if (!isOpen || !existingPatient) return null;

  const candidateCpfClean = attemptedCandidate?.cpf ? attemptedCandidate.cpf.replace(/\D/g, '') : '';
  const existingCpfClean = existingPatient.cpf ? existingPatient.cpf.replace(/\D/g, '') : '';
  const hasCpfDivergence = Boolean(
    candidateCpfClean && 
    existingCpfClean && 
    candidateCpfClean.length === 11 && 
    existingCpfClean.length === 11 && 
    candidateCpfClean !== existingCpfClean
  );

  const existingAge = existingPatient.birth_date ? calculateAgeYears(existingPatient.birth_date) : null;

  const handleSendConference = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingConference(true);
    setConferenceError(null);

    try {
      const res = await encaminharParaConferenciaAdministrativa({
        candidateName: attemptedCandidate?.name || existingPatient.name,
        candidateCpf: attemptedCandidate?.cpf || null,
        candidateBirthDate: attemptedCandidate?.birthDate || null,
        candidatePhone: attemptedCandidate?.phone || null,
        candidateNeighborhood: attemptedCandidate?.neighborhood || null,
        candidateStreet: attemptedCandidate?.street || null,
        candidateSusNumber: attemptedCandidate?.susNumber || null,
        candidateNickname: attemptedCandidate?.nickname || null,
        conflictPatientId: existingPatient.id,
        conflictType: hasCpfDivergence ? 'homonimo_suspeito' : (conflictType || 'name_and_birth_date'),
        reason: hasCpfDivergence 
          ? `Divergência de CPF entre candidato (${formatCpf(candidateCpfClean)}) e paciente existente (${formatCpf(existingCpfClean)}). Suspeita de Homônimo ou CPF incorreto.`
          : `Coincidência detectada por ${conflictType === 'cpf' ? 'CPF' : 'Nome Completo e Data de Nascimento'}.`,
        notes: conferenceNotes.trim() || undefined,
        currentUser: currentUser ? { id: currentUser.id, name: currentUser.name, email: currentUser.email } : null
      });

      if (res.success) {
        setConferenceSuccess(true);
        setTimeout(() => {
          setIsConferenceModalOpen(false);
          setConferenceSuccess(false);
          setConferenceNotes('');
          if (onSentToAdminConference) {
            onSentToAdminConference();
          } else {
            onCancel();
          }
        }, 1600);
      } else {
        setConferenceError(res.error || 'Erro ao enviar para conferência.');
      }
    } catch (err: any) {
      setConferenceError(err?.message || 'Falha ao registrar conferência.');
    } finally {
      setIsSendingConference(false);
    }
  };

  const modalNode = (
    <div 
      className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-duplicidade-titulo"
    >
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[94vh] animate-in zoom-in-95 duration-200">
        
        {/* Cabeçalho com Alerta Visual e Ícone de Proteção */}
        <div className="px-6 py-5 bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center border border-white/25 shrink-0 shadow-inner">
              <ShieldAlert className="w-6 h-6 text-white stroke-[2.5]" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-100 block">
                Validação Anti-Duplicidade
              </span>
              <h3 id="modal-duplicidade-titulo" className="text-base sm:text-lg font-black tracking-tight uppercase leading-tight">
                PACIENTE JÁ CADASTRADO
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
            title="Fechar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4.5 flex-1 custom-scrollbar text-xs">
          
          {/* Mensagem Institucional Exigida */}
          <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-950 space-y-1.5 leading-relaxed">
            <div className="flex items-center gap-2 text-amber-800 font-black text-xs uppercase tracking-wide">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>Cadastro Duplicado Bloqueado</span>
            </div>
            <p className="font-semibold text-xs text-amber-900">
              Identificamos um paciente com o mesmo CPF ou com nome completo e data de nascimento correspondentes. Não é permitido criar cadastros duplicados.
            </p>
          </div>

          {/* Badge Informativo do Critério Conflitante */}
          <div className="flex flex-wrap items-center gap-2">
            {conflictType === 'cpf' ? (
              <span className="px-3 py-1 rounded-xl bg-rose-100 text-rose-900 border border-rose-200 text-[11px] font-black uppercase inline-flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" />
                Coincidência por CPF: {formatCpf(existingPatient.cpf)}
              </span>
            ) : (
              <span className="px-3 py-1 rounded-xl bg-amber-100 text-amber-900 border border-amber-200 text-[11px] font-black uppercase inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Coincidência por Nome Completo e Data de Nascimento
              </span>
            )}

            {hasCpfDivergence && (
              <span className="px-3 py-1 rounded-xl bg-purple-100 text-purple-900 border border-purple-200 text-[11px] font-black uppercase inline-flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-purple-700" />
                Divergência de CPF detectada
              </span>
            )}
          </div>

          {/* Alerta de Divergência de CPF (Suspeita de Homônimo ou Erro de Digitação) */}
          {hasCpfDivergence && (
            <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200 text-purple-950 text-xs space-y-1.5">
              <p className="font-black text-purple-900 uppercase text-[11px]">
                Atenção: Possível Homônimo ou Erro no CPF
              </p>
              <p className="font-medium text-slate-700 leading-relaxed text-[11px]">
                O CPF informado no formulário (<strong className="font-mono text-purple-800">{formatCpf(candidateCpfClean)}</strong>) é diferente do CPF registrado no paciente existente (<strong className="font-mono text-purple-800">{formatCpf(existingCpfClean)}</strong>).
                Para evitar inconsistências, você pode utilizar o paciente já existente ou encaminhar este caso para conferência administrativa.
              </p>
            </div>
          )}

          {/* Card com os Dados do Cadastro Existente Encontrado */}
          <div className="border-2 border-indigo-100 rounded-2xl bg-indigo-50/40 p-4 sm:p-5 space-y-3.5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-indigo-100/80 pb-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                Cadastro Existente na Base Municipal
              </span>
              <span className="text-[10px] font-bold text-slate-500 bg-white px-2.5 py-0.5 rounded-full border border-indigo-100 font-mono">
                ID: {existingPatient.id.slice(0, 8)}...
              </span>
            </div>

            {/* Nome Completo e Apelido */}
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Nome do Paciente</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-sm sm:text-base font-black text-slate-900 uppercase">
                  {existingPatient.name}
                </span>
                {existingPatient.nickname && (
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-lg border border-indigo-200">
                    "{existingPatient.nickname}"
                  </span>
                )}
              </div>
            </div>

            {/* Grade com Informações do Paciente */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
              <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 space-y-0.5">
                <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                  <CreditCard className="w-3 h-3 text-slate-500" /> CPF
                </span>
                <span className="font-mono font-black text-slate-900 block text-xs sm:text-sm">
                  {formatCpf(existingPatient.cpf)}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 space-y-0.5">
                <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-500" /> Data de Nascimento
                </span>
                <span className="font-bold text-slate-900 block text-xs sm:text-sm">
                  {formatBirthDateBr(existingPatient.birth_date)} {existingAge !== null && `(${existingAge} anos)`}
                </span>
              </div>

              {existingPatient.phone && (
                <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 space-y-0.5">
                  <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-500" /> Telefone / WhatsApp
                  </span>
                  <span className="font-semibold text-slate-800 block text-xs">
                    {existingPatient.phone}
                  </span>
                </div>
              )}

              {existingPatient.neighborhood && (
                <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 space-y-0.5">
                  <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-500" /> Bairro / Endereço
                  </span>
                  <span className="font-semibold text-slate-800 block text-xs truncate" title={`${existingPatient.street || ''} ${existingPatient.neighborhood}`}>
                    {existingPatient.neighborhood} {existingPatient.street ? `— ${existingPatient.street}` : ''}
                  </span>
                </div>
              )}

              {existingPatient.sus_number && (
                <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 space-y-0.5 sm:col-span-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                    Cartão SUS
                  </span>
                  <span className="font-mono font-bold text-slate-800 block text-xs">
                    {existingPatient.sus_number}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Opção Adicional: Encaminhar para Conferência Administrativa */}
          {hasCpfDivergence && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3">
              <div>
                <p className="font-black text-xs text-slate-800 uppercase">
                  Suspeita de Homônimo ou Revisão Documental?
                </p>
                <p className="text-[11px] text-slate-500 font-medium">
                  Solicite a conferência administrativa para certificar os documentos sem duplicar o registro.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsConferenceModalOpen(true)}
                className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 font-black text-[11px] uppercase tracking-wider rounded-xl border border-purple-200 shrink-0 transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5 text-purple-600" />
                <span>Conferência Admin</span>
              </button>
            </div>
          )}

        </div>

        {/* 3 Botões de Ação Exigidos no Rodapé */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          
          {/* Botão Cancelar */}
          <button
            type="button"
            onClick={onCancel}
            className="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl border border-slate-300 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <X className="w-4 h-4 text-slate-500" />
            <span>Cancelar</span>
          </button>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {/* Botão Visualizar Cadastro */}
            {onViewDetails && (
              <button
                type="button"
                onClick={() => onViewDetails(existingPatient)}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-black text-xs uppercase tracking-wider rounded-xl border border-indigo-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                title="Visualizar ficha completa do paciente"
              >
                <Eye className="w-4 h-4 text-indigo-600" />
                <span>Visualizar Cadastro</span>
              </button>
            )}

            {/* Botão Principal: UTILIZAR PACIENTE EXISTENTE */}
            <button
              type="button"
              onClick={() => onUseExisting(existingPatient)}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md shadow-emerald-600/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <UserCheck className="w-4 h-4 text-white stroke-[2.5]" />
              <span>Utilizar Paciente Existente</span>
            </button>
          </div>
        </div>

      </div>

      {/* Mini-Modal: Encaminhar para Conferência Administrativa */}
      {isConferenceModalOpen && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-purple-600" />
                <h4 className="font-black text-sm uppercase text-slate-900">
                  Conferência Administrativa
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsConferenceModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {conferenceSuccess ? (
              <div className="py-6 text-center space-y-2 animate-in zoom-in-95">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <p className="font-black text-slate-900 text-sm">
                  Solicitação Registrada com Sucesso!
                </p>
                <p className="text-xs text-slate-500">
                  A equipe administrativa revisará a documentação deste paciente.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSendConference} className="space-y-3.5 text-xs">
                <p className="text-slate-600 leading-relaxed">
                  Informe o motivo da suspeita de homônimo ou divergência de documentos para análise pela coordenação:
                </p>

                {conferenceError && (
                  <p className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold">
                    {conferenceError}
                  </p>
                )}

                <textarea
                  rows={3}
                  required
                  value={conferenceNotes}
                  onChange={e => setConferenceNotes(e.target.value)}
                  placeholder="Ex.: Paciente apresentou documento físico com CPF divergente; necessário verificar certidão..."
                  className="w-full p-3 rounded-xl border border-slate-200 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/10 text-slate-800 text-xs font-semibold outline-none resize-none"
                />

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsConferenceModalOpen(false)}
                    className="px-3 py-2 text-slate-500 hover:bg-slate-100 rounded-xl font-bold cursor-pointer"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingConference || !conferenceNotes.trim()}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-black uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    {isSendingConference ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Confirmar Envio</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode;
};
