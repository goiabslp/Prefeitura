import React from 'react';
import { Smartphone, ArrowLeft, Printer, ShieldCheck, Lock, FileText, CheckCircle2, Building2 } from 'lucide-react';

interface PoliticaPrivacidadeAppScreenProps {
  onBack?: () => void;
}

export const PoliticaPrivacidadeAppScreen: React.FC<PoliticaPrivacidadeAppScreenProps> = ({ onBack }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Bar / Header */}
      <header className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-slate-900 text-white sticky top-0 z-50 shadow-xl border-b border-emerald-700/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-white active:scale-95 flex items-center justify-center cursor-pointer"
                title="Voltar"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-500/30 rounded-xl border border-emerald-400/30 backdrop-blur-md">
                <Smartphone className="w-6 h-6 text-emerald-300" />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tight leading-none text-white">
                  Política de Privacidade do Aplicativo
                </h1>
                <p className="text-[11px] text-emerald-200 font-medium tracking-wide">
                  Prefeitura Integrada - São José do Goiabal - MG
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all border border-white/20 active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200/80 p-6 sm:p-10 space-y-8 relative overflow-hidden">
          {/* Background Gradient Circle */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Banner Title */}
          <div className="border-b border-slate-100 pb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full mb-3 border border-emerald-100">
              <ShieldCheck className="w-3.5 h-3.5" /> Aplicativo Oficial da Prefeitura
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Política de Privacidade do Aplicativo
            </h2>
            <p className="text-xs text-slate-500 font-semibold mt-2">
              Versão 1.0 • Última atualização: <span className="text-emerald-600 font-bold">28/08/2026</span>
            </p>
          </div>

          {/* Intro statement */}
          <div className="text-slate-600 leading-relaxed text-sm sm:text-base space-y-4">
            <p>
              A <strong>Prefeitura Municipal de São José do Goiabal</strong>, responsável pelo aplicativo <strong>Prefeitura Integrada</strong>, valoriza a privacidade, a segurança e a proteção dos dados pessoais de seus usuários.
            </p>
            <p>
              Esta Política de Privacidade explica como os dados pessoais são coletados, utilizados, armazenados, protegidos e eventualmente compartilhados durante a utilização do aplicativo móvel e web. O tratamento é realizado em conformidade com a <strong>Lei Federal nº 13.709/2018 – Lei Geral de Proteção de Dados Pessoais (LGPD)</strong>.
            </p>
          </div>

          {/* Section 1 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              1. DADOS QUE PODEM SER COLETADOS NO APLICATIVO
            </h3>
            <p className="text-xs sm:text-sm text-slate-600">Dependendo do serviço utilizado pelo cidadão ou servidor, o aplicativo poderá coletar:</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
                <span className="font-bold text-slate-900 block mb-1">Dados de Identificação</span>
                <span className="text-slate-600">Nome completo, CPF, data de nascimento, telefone, e-mail e endereço.</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
                <span className="font-bold text-slate-900 block mb-1">Dados Funcionais e Serviços</span>
                <span className="text-slate-600">Matrícula, solicitações públicas, agendamentos e documentos anexados.</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
                <span className="font-bold text-slate-900 block mb-1">Registros de Acesso Técnico</span>
                <span className="text-slate-600">Endereço IP, data/hora de acesso, identificadores do dispositivo e registros de auditoria.</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
                <span className="font-bold text-slate-900 block mb-1">Permissões do Dispositivo</span>
                <span className="text-slate-600">Acesso temporário à câmera/arquivos apenas quando o usuário optar por anexar comprovantes.</span>
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section className="space-y-3 pt-4 border-t border-slate-100">
            <h3 className="text-lg font-black text-slate-800">2. COMO OS DADOS SÃO UTILIZADOS</h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-slate-600">
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> Autenticação e segurança da conta do usuário</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> Atendimento de agendamentos e consultas</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> Acompanhamento transparente de processos</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> Comunicações oficiais sobre serviços municipais</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> Emissão e armazenamento seguro de guias/documentos</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> Cumprimento de obrigações legais e de fiscalização</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3 pt-4 border-t border-slate-100 text-xs sm:text-sm text-slate-600 leading-relaxed">
            <h3 className="text-lg font-black text-slate-800">3. SEGURANÇA E ARMAZENAMENTO</h3>
            <p>
              O aplicativo utiliza medidas técnicas avançadas de segurança para proteger seus dados contra acessos não autorizados, perdas ou alterações. Todo o tráfego de dados é protegido por criptografia de ponta a ponta (HTTPS/TLS) e armazenamento em servidores auditados.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-3 pt-4 border-t border-slate-100 text-xs sm:text-sm text-slate-600 leading-relaxed">
            <h3 className="text-lg font-black text-slate-800">4. CANAL DE ATENDIMENTO AO CITADÃO (DPO)</h3>
            <p>
              Para dúvidas, esclarecimentos ou solicitação de informações sobre o tratamento de seus dados pessoais no aplicativo, entre em contato com nosso Encarregado pelo Tratamento de Dados (DPO):
            </p>

            <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100 text-slate-800 text-xs sm:text-sm space-y-1">
              <p className="font-extrabold text-emerald-900">Prefeitura Municipal de São José do Goiabal - MG</p>
              <p><strong>E-mail Institucional:</strong> <span className="text-emerald-700 font-bold">contato@saojosedogoiabal.mg.gov.br</span></p>
              <p><strong>E-mail DPO:</strong> <span className="text-emerald-700 font-bold">dpo@saojosedogoiabal.mg.gov.br</span></p>
              <p><strong>Endereço:</strong> Praça Cônego João Pio, 16 - Centro, São José do Goiabal - MG, CEP 35988-000</p>
            </div>
          </section>

          {/* Banner bottom */}
          <div className="bg-emerald-950 text-white rounded-2xl p-6 text-center space-y-2">
            <p className="font-extrabold text-sm sm:text-base">Prefeitura Integrada - São José do Goiabal</p>
            <p className="text-xs text-emerald-300">Ao utilizar o aplicativo, você declara ter ciência desta Política de Privacidade.</p>
          </div>
        </div>
      </main>

      {/* Page Footer */}
      <footer className="bg-slate-900 text-slate-400 py-6 text-center text-xs border-t border-slate-800">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 Prefeitura Municipal de São José do Goiabal - MG. Todos os direitos reservados.</p>
          {onBack && (
            <button onClick={onBack} className="text-emerald-400 hover:text-white font-bold underline cursor-pointer">
              Voltar ao Sistema
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};
