import React, { useState, useCallback } from 'react';
import {
  X, ArrowLeft, Loader2, Check, Save, RefreshCw, AlertTriangle, Play
} from 'lucide-react';
import { AppState, User, Signature, BlockType, Person, Sector, Job } from '../types';

import { DesignForm } from './forms/DesignForm';
import { UIForm } from './forms/UIForm';
import { OficioForm } from './forms/OficioForm';
import { DiariaForm } from './forms/DiariaForm';
import { ComprasForm } from './forms/ComprasForm';
import { LicitacaoForm } from './forms/LicitacaoForm';
import { ComprasStepWizard } from './compras/ComprasStepWizard';
import { DiariasStepWizard } from './diarias/DiariasStepWizard';
import { AccountManagementTab } from './compras/AccountManagementTab';
import { updateSystemUpdateTarget } from '../services/settingsService';

interface AdminSidebarProps {
  state: AppState;
  onUpdate: React.Dispatch<React.SetStateAction<AppState>>;
  onPrint: (customState?: AppState) => void;
  isOpen: boolean;
  onClose: () => void;
  isDownloading: boolean;
  currentUser: User;
  mode: 'admin' | 'editor';
  onSaveDefault?: () => Promise<void> | void;
  onFinish?: () => Promise<boolean | void> | void;
  activeTab: string | null;
  onTabChange: (tab: any) => void;
  availableSignatures: Signature[];
  activeBlock: BlockType | null;
  persons: Person[];
  sectors: Sector[];
  jobs: Job[];
  onBack?: () => void;
  isReadOnly?: boolean;
  orderStatus?: string;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  state,
  onUpdate,
  onPrint,
  isOpen,
  onClose,
  isDownloading,
  currentUser,
  mode,
  onSaveDefault,
  onFinish,
  activeTab,
  onTabChange,
  availableSignatures,
  activeBlock,
  persons,
  sectors,
  jobs,
  onBack,
  isReadOnly = false,
  orderStatus
}) => {
  const [globalSaveStatus, setGlobalSaveStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [finishStatus, setFinishStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  const { branding, document: docConfig, content, ui } = state;

  const allowedSignatures = availableSignatures.filter(sig =>
    (currentUser.allowedSignatureIds || []).includes(sig.id)
  );

  const handleUpdate = useCallback((section: keyof AppState, key: string, value: any) => {
    onUpdate(prev => {
      const sectionData = prev[section];
      if (typeof sectionData !== 'object' || sectionData === null) return prev;

      return {
        ...prev,
        [section]: {
          ...sectionData,
          [key]: value
        }
      };
    });
  }, [onUpdate]);

  const handleDeepUpdate = useCallback((section: keyof AppState, subSection: string, key: string, value: any) => {
    onUpdate(prev => ({
      ...prev,
      [section]: {
        ...(prev[section] as any),
        [subSection]: {
          ...(prev[section] as any)[subSection],
          [key]: value
        }
      }
    } as AppState));
  }, [onUpdate]);

  const handleFinishWithAnimation = async () => {
    if (activeBlock === 'diarias' && !content.subType) {
      alert("Por favor, selecione se a requisição é do tipo Diária ou Custeio antes de finalizar.");
      return;
    }
    setFinishStatus('loading');
    await new Promise(resolve => setTimeout(resolve, 800));

    let result: boolean | void = true;
    if (onFinish) {
      result = await onFinish();
    }

    if (result === false) {
      setFinishStatus('idle');
      return;
    }

    setFinishStatus('success');
    setTimeout(() => {
      setFinishStatus('idle');
      onClose();
    }, 1000);
  };

  const handleSaveDefaultWithAnimation = async () => {
    if (!onSaveDefault) return;
    setGlobalSaveStatus('loading');
    await new Promise(resolve => setTimeout(resolve, 800));
    await onSaveDefault();
    setGlobalSaveStatus('success');
    setTimeout(() => setGlobalSaveStatus('idle'), 2000);
  };

  const renderSectionHeader = (title: string, subtitle?: string) => (
    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">

      <div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );

  const renderContentForm = () => {
    switch (activeBlock) {
      case 'oficio':
        return (
          <OficioForm
            state={state} content={content} docConfig={docConfig}
            allowedSignatures={allowedSignatures} handleUpdate={handleUpdate} onUpdate={onUpdate}
          />
        );
      case 'diarias':
        return (
          <DiariasStepWizard
            state={state}
            content={content}
            allowedSignatures={allowedSignatures}
            handleUpdate={handleUpdate}
            onUpdate={onUpdate}
            persons={persons}
            sectors={sectors}
            jobs={jobs}
            activeBlock={activeBlock}
            currentUser={currentUser}
            onFinish={onFinish ? handleFinishWithAnimation : async () => { }}
            onBack={onBack}
            isLoading={isDownloading || finishStatus === 'loading'}
          />
        );
      case 'compras':
        return (
          <ComprasStepWizard
            state={state}
            content={content}
            docConfig={docConfig}
            allowedSignatures={allowedSignatures}
            handleUpdate={handleUpdate}
            onUpdate={onUpdate}
            persons={persons}
            sectors={sectors}
            jobs={jobs}
            currentUser={currentUser}
            onFinish={onFinish ? handleFinishWithAnimation : async () => { }}
            onBack={onBack}
            isLoading={isDownloading || finishStatus === 'loading'}
          />
        );
      case 'licitacao':
        return (
          <LicitacaoForm
            state={state} content={content}
            allowedSignatures={allowedSignatures} handleUpdate={handleUpdate} onUpdate={onUpdate}
            onFinish={onFinish ? handleFinishWithAnimation : undefined}
            isReadOnly={isReadOnly}
            currentUser={currentUser}
            sectors={sectors}
            orderStatus={orderStatus}
          />
        );
      default:
        return (
          <OficioForm
            state={state} content={content} docConfig={docConfig}
            allowedSignatures={allowedSignatures} handleUpdate={handleUpdate} onUpdate={onUpdate}
          />
        );
    }
  };

  const getContentHeaderInfo = () => {
    if (activeBlock === 'diarias') return { title: 'Diárias e Custeio', subtitle: 'Preencha os dados abaixo' };
    if (activeBlock === 'oficio') return { title: 'Módulo de Ofício', subtitle: 'Preencha os dados abaixo para gerar o documento' };
    if (activeBlock === 'compras') return { title: 'Novo Pedido', subtitle: 'Preencha os dados do pedido' };
    if (activeBlock === 'licitacao') return { title: 'Processo Licitatório', subtitle: 'Preencha os dados do processo' };
    return { title: 'Editor', subtitle: 'Preencha os dados' };
  };

  const headerInfo = getContentHeaderInfo();

  return (
    <>
      {/* Overlay para mobile */}
      {isOpen && <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity desktop:hidden" onClick={onClose} />}

      {/* Sidebar - relative no desktop para permitir lado-a-lado com o preview */}
      <div className={`
        fixed desktop:relative inset-y-0 left-0 h-full
        ${(activeBlock === 'compras' || activeBlock === 'diarias') ? 'w-full' : 'w-full desktop:w-[500px] lg:w-[550px] xl:w-[600px]'}
        bg-white shadow-2xl desktop:shadow-none border-r border-slate-200
        transform transition-all duration-300 ease-in-out z-50 shrink-0
        flex flex-col 
        ${isOpen ? 'translate-x-0 opacity-100 visible' : '-translate-x-full opacity-0 invisible absolute desktop:w-0'}
      `}>
        {(activeBlock !== 'compras' && activeBlock !== 'diarias') && (
          <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-white z-10 shrink-0">
            <div className="flex items-center gap-3">
              {(mode !== 'admin' && onBack) ? (
                <button onClick={onBack} className="p-2 -ml-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-all" title="Voltar">
                  <ArrowLeft className="w-5 h-5" />
                </button>
              ) : (mode === 'admin' && activeTab) ? (
                <button onClick={() => onTabChange(null)} className="p-2 -ml-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-all" title="Voltar ao Menu">
                  <ArrowLeft className="w-5 h-5" />
                </button>
              ) : null}
              <div>
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tighter">
                  {mode === 'admin'
                    ? (activeTab === 'design' ? 'Design do Documento' : 'Painel Administrativo')
                    : headerInfo.title}
                </h2>
                {mode !== 'admin' && (
                  <p className="text-xs text-slate-400 font-medium normal-case tracking-normal">{headerInfo.subtitle}</p>
                )}
              </div>
            </div>
            {activeTab !== 'design' && (
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"><X className="w-6 h-6" /></button>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-50/50">


          {activeTab === 'design' && (
            <>

              <DesignForm
                branding={branding}
                docConfig={docConfig}
                handleUpdate={handleUpdate}
                handleDeepUpdate={handleDeepUpdate}
              />
            </>
          )}

          {activeTab === 'ui' && (
            <>
              {renderSectionHeader('Interface', 'Personalize os logos de login e cabeçalho do sistema')}
              <UIForm ui={ui} handleUpdate={handleUpdate} />
            </>
          )}

          {activeTab === 'users' && (
            <div className="animate-fade-in">
              {renderSectionHeader(currentUser.role === 'admin' ? 'Gestão de Usuários' : 'Meu Perfil', 'Configure permissões e dados de acesso')}
              <p className="text-sm text-slate-500 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm font-medium">
                Utilize a tela de gerenciamento à direita para interagir com a base de usuários.
              </p>
            </div>
          )}

          {activeTab === 'entities' && (
            <div className="animate-fade-in">
              {renderSectionHeader('Base Organizacional', 'Pessoas, Setores e Cargos')}
              <p className="text-sm text-slate-500 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm font-medium">
                Utilize a tela de gerenciamento à direita para adicionar pessoas, definir setores e cadastrar cargos.
              </p>
            </div>
          )}

          {activeTab === 'signatures' && (
            <div className="animate-fade-in">
              {renderSectionHeader('Assinaturas', 'Gerencie quem assina os documentos gerados')}
              <p className="text-sm text-slate-500 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm font-medium">
                A lista detalhada de assinaturas está disponível na tela principal ao lado.
              </p>
            </div>
          )}

          {activeTab === 'signatures' && (
            <div className="animate-fade-in">
              {renderSectionHeader('Assinaturas', 'Gerencie quem assina os documentos gerados')}
              <p className="text-sm text-slate-500 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm font-medium">
                A lista detalhada de assinaturas está disponível na tela principal ao lado.
              </p>
            </div>
          )}

          {mode !== 'admin' && activeTab === 'content' && (
            <>
              {renderContentForm()}
            </>
          )}
        </div>

        {mode === 'admin' && activeTab && activeTab !== 'system_update' && onSaveDefault && currentUser.role === 'admin' && !isReadOnly && (
          <div className="p-6 border-t border-gray-200 bg-white z-20">
            <button onClick={handleSaveDefaultWithAnimation} disabled={globalSaveStatus === 'loading' || globalSaveStatus === 'success'} className={`w-full font-black py-4 px-6 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs ${globalSaveStatus === 'success' ? 'bg-emerald-500 text-white shadow-emerald-500/30' : 'bg-slate-900 text-white hover:bg-indigo-600 active:scale-95'}`}>
              {globalSaveStatus === 'loading' ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Salvando...</span></> : globalSaveStatus === 'success' ? <><Check className="w-4 h-4 animate-bounce" /><span>Configurações Salvas!</span></> : <><Save className="w-4 h-4" /><span>Salvar Padrão Global</span></>}
            </button>
          </div>
        )}

        {mode !== 'admin' && activeTab === 'content' && activeBlock !== 'licitacao' && activeBlock !== 'compras' && activeBlock !== 'diarias' && !isReadOnly && (
          <div className="p-6 border-t border-gray-200 bg-white/80 backdrop-blur-xl sticky bottom-0 z-20">
            <button onClick={handleFinishWithAnimation} disabled={finishStatus === 'loading' || finishStatus === 'success'} className={`w-full font-black py-4 px-6 rounded-2xl shadow-xl transform transition-all duration-300 flex items-center justify-center gap-3 uppercase tracking-widest text-xs ${finishStatus === 'success' ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white hover:bg-indigo-600 active:scale-95'}`}>
              {finishStatus === 'loading' ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Processando...</span></> : finishStatus === 'success' ? <><Check className="w-4 h-4" /><span>Concluído!</span></> : <><Check className="w-4 h-4" /><span>Finalizar Edição</span></>}
            </button>
          </div>
        )}
      </div>
    </>
  );
};