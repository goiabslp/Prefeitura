import React from 'react';
import { ShieldCheck, ArrowLeft, Printer, Lock, FileText, Building2, Mail, MapPin, CheckCircle2 } from 'lucide-react';

interface PoliticaPrivacidadeScreenProps {
  onBack?: () => void;
}

export const PoliticaPrivacidadeScreen: React.FC<PoliticaPrivacidadeScreenProps> = ({ onBack }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Bar / Header */}
      <header className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white sticky top-0 z-50 shadow-xl border-b border-indigo-700/40">
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
              <div className="p-2 bg-indigo-500/30 rounded-xl border border-indigo-400/30 backdrop-blur-md">
                <ShieldCheck className="w-6 h-6 text-indigo-300" />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tight leading-none text-white">
                  Política de Privacidade
                </h1>
                <p className="text-[11px] text-indigo-200 font-medium tracking-wide">
                  Prefeitura Municipal de São José do Goiabal - MG
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
          {/* Subtle background decoration */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Banner Title */}
          <div className="border-b border-slate-100 pb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full mb-3 border border-indigo-100">
              <Lock className="w-3.5 h-3.5" /> LGPD - Lei Federal nº 13.709/2018
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Política de Privacidade
            </h2>
            <p className="text-xs text-slate-500 font-semibold mt-2">
              Última atualização: <span className="text-indigo-600 font-bold">28/08/2026</span>
            </p>
          </div>

          {/* Intro statement */}
          <div className="text-slate-600 leading-relaxed text-sm sm:text-base space-y-4">
            <p>
              A presente Política de Privacidade estabelece as regras para coleta, utilização, armazenamento, compartilhamento, proteção e tratamento de dados pessoais realizados pela <strong>Prefeitura Municipal de São José do Goiabal</strong>, por meio do sistema <strong>Prefeitura Integrada</strong>.
            </p>
            <p>
              O tratamento de dados pessoais será realizado em total conformidade com a <strong>Lei Federal nº 13.709/2018 – Lei Geral de Proteção de Dados Pessoais (LGPD)</strong> e demais normas aplicáveis.
            </p>
          </div>

          {/* Section 1 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600" />
              1. IDENTIFICAÇÃO DO CONTROLADOR
            </h3>
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/60 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
              <div>
                <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Controlador</p>
                <p className="font-bold text-slate-800">Prefeitura Municipal de São José do Goiabal</p>
              </div>
              <div>
                <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">CNPJ</p>
                <p className="font-bold text-slate-800">18.297.234/0001-38</p>
              </div>
              <div>
                <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Endereço Oficial</p>
                <p className="font-bold text-slate-800">Praça Cônego João Pio, 16 - Centro, São José do Goiabal - MG, 35988-000</p>
              </div>
              <div>
                <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">E-mail Institucional</p>
                <p className="font-bold text-indigo-600">contato@saojosedogoiabal.mg.gov.br</p>
              </div>
              <div>
                <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Encarregado pelo Tratamento de Dados (DPO)</p>
                <p className="font-bold text-slate-800">Encarregado de Proteção de Dados (DPO)</p>
              </div>
              <div>
                <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">E-mail do Encarregado</p>
                <p className="font-bold text-indigo-600">dpo@saojosedogoiabal.mg.gov.br</p>
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              2. QUAIS DADOS PODEM SER COLETADOS
            </h3>
            <p className="text-xs sm:text-sm text-slate-600">Dependendo da funcionalidade utilizada, o sistema poderá tratar:</p>

            <div className="space-y-3 text-xs sm:text-sm text-slate-700">
              <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/80">
                <h4 className="font-bold text-indigo-900 mb-1">Dados de identificação</h4>
                <ul className="list-disc list-inside space-y-1 text-slate-600">
                  <li>Nome completo; CPF; Data de nascimento;</li>
                  <li>Matrícula funcional; Cargo/função; Setor ou unidade administrativa.</li>
                </ul>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                <h4 className="font-bold text-slate-900 mb-1">Dados de contato</h4>
                <p className="text-slate-600">E-mail, telefone e endereço, quando estritamente necessários para a prestação do serviço público.</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                <h4 className="font-bold text-slate-900 mb-1">Dados de autenticação e segurança</h4>
                <p className="text-slate-600">Identificador de usuário, registros de acesso, data/hora, endereço IP, informações técnicas do dispositivo e registros de operações no sistema.</p>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-3 pt-4 border-t border-slate-100">
            <h3 className="text-lg font-black text-slate-800">3. FINALIDADES DO TRATAMENTO</h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-slate-600">
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> Identificação e autenticação de usuários</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> Prestação de serviços públicos municipais</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> Gestão administrativa e institucional</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> Agendamentos de consultas e veículos</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> Auditoria e prestação de contas públicas</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> Segurança da informação e prevenção a fraudes</li>
            </ul>
          </section>

          {/* Section 4 & 5 */}
          <section className="space-y-3 pt-4 border-t border-slate-100 text-xs sm:text-sm text-slate-600 leading-relaxed">
            <h3 className="text-lg font-black text-slate-800">4. BASE LEGAL E DADOS SENSÍVEIS</h3>
            <p>
              O tratamento ocorre com fundamento no <strong>cumprimento de obrigação legal ou regulatória</strong>, na <strong>execução de políticas públicas</strong> previstas em leis ou regulamentos e no exercício regular de direitos da Administração Pública.
            </p>
            <p>
              Dados pessoais sensíveis (como dados relativos à saúde ou exames) receberão proteção especial reforçada, com controle rigoroso de acesso circunscrito apenas a servidores devidamente autorizados.
            </p>
          </section>

          {/* Section 6 & 7 */}
          <section className="space-y-3 pt-4 border-t border-slate-100 text-xs sm:text-sm text-slate-600 leading-relaxed">
            <h3 className="text-lg font-black text-slate-800">5. DIREITOS DO TITULAR DOS DADOS</h3>
            <p>
              Conforme previsto no Art. 18 da LGPD, o titular dos dados possui o direito de solicitar a confirmação do tratamento, acesso aos dados, correção de informações incompletas ou desatualizadas, bem como informações sobre o compartilhamento.
            </p>
            <p>
              Para exercer qualquer um de seus direitos, o cidadão ou servidor poderá entrar em contato com nosso Encarregado de Proteção de Dados através do e-mail: <strong className="text-indigo-600">dpo@saojosedogoiabal.mg.gov.br</strong>.
            </p>
          </section>

          {/* Footer note */}
          <div className="bg-indigo-900 text-white rounded-2xl p-6 text-center space-y-2">
            <p className="font-extrabold text-sm sm:text-base">Prefeitura Municipal de São José do Goiabal - MG</p>
            <p className="text-xs text-indigo-200">Garantindo a transparência, segurança e privacidade dos cidadãos.</p>
          </div>
        </div>
      </main>

      {/* Page Footer */}
      <footer className="bg-slate-900 text-slate-400 py-6 text-center text-xs border-t border-slate-800">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 Prefeitura Municipal de São José do Goiabal - MG. Todos os direitos reservados.</p>
          {onBack && (
            <button onClick={onBack} className="text-indigo-400 hover:text-white font-bold underline cursor-pointer">
              Voltar ao Sistema
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};
