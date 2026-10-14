import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ConsultaPaciente, ConsultaAgendamento, FarmaciaMovimentacao, User, AutoSenhaItem } from '../../../types';
import { IndicadoresPaciente, IndicadorTempoEspera, calcularIndicadorTempoEspera, ItemLinhaDoTempo } from '../../../services/pacienteHistoricoService';
import { auditLogService } from '../../../services/auditLogService';
import { X, FileText, CheckCircle, Download, Loader2, Calendar, CheckSquare, Square, Shield } from 'lucide-react';

interface PacienteRelatorioModalProps {
    isOpen: boolean;
    onClose: () => void;
    paciente: ConsultaPaciente;
    solicitacoes: ConsultaAgendamento[];
    medicamentos: FarmaciaMovimentacao[];
    senhasAutoSenha?: AutoSenhaItem[];
    indicadores: IndicadoresPaciente;
    linhaDoTempo: ItemLinhaDoTempo[];
    currentUser?: User | null;
}

export const PacienteRelatorioModal: React.FC<PacienteRelatorioModalProps> = ({
    isOpen,
    onClose,
    paciente,
    solicitacoes,
    medicamentos,
    senhasAutoSenha = [],
    indicadores,
    linhaDoTempo,
    currentUser
}) => {
    const [periodo, setPeriodo] = useState<'tudo' | '30dias' | '90dias' | '1ano'>('tudo');
    const [incluirCadastrais, setIncluirCadastrais] = useState(true);
    const [incluirIndicadores, setIncluirIndicadores] = useState(true);
    const [incluirSolicitacoes, setIncluirSolicitacoes] = useState(true);
    const [incluirMedicamentos, setIncluirMedicamentos] = useState(true);
    const [incluirAtendimentosAutoSenha, setIncluirAtendimentosAutoSenha] = useState(true);
    const [incluirLinhaDoTempo, setIncluirLinhaDoTempo] = useState(true);
    const [incluirAlertas, setIncluirAlertas] = useState(true);

    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [downloadReady, setDownloadReady] = useState(false);
    const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

    if (!isOpen) return null;

    const filtrarPorPeriodo = <T extends { data?: string; solicitation_date?: string; created_at?: string; dataHora?: string }>(
        items: T[],
        getDate: (item: T) => string | undefined
    ): T[] => {
        if (periodo === 'tudo') return items;
        const agora = new Date().getTime();
        let limiteDias = 30;
        if (periodo === '90dias') limiteDias = 90;
        if (periodo === '1ano') limiteDias = 365;

        const limiteMs = limiteDias * 24 * 60 * 60 * 1000;
        return items.filter(it => {
            const d = getDate(it);
            if (!d) return false;
            const t = new Date(d).getTime();
            return !isNaN(t) && (agora - t) <= limiteMs;
        });
    };

    const handleGerarRelatorio = async () => {
        setIsGenerating(true);
        setProgress(15);
        setDownloadReady(false);

        try {
            await new Promise(r => setTimeout(r, 200));
            setProgress(35);

            const doc = new jsPDF('portrait', 'pt', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            let currentY = 40;

            // 1. Cabeçalho Institucional
            doc.setFillColor(14, 116, 144); // Cyan/Sky 700 institucional
            doc.rect(40, currentY, pageWidth - 80, 5, 'F');
            currentY += 20;

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.setTextColor(15, 23, 42);
            doc.text('PREFEITURA MUNICIPAL — REGULAÇÃO E SAÚDE INTEGRADA', 40, currentY);

            currentY += 15;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text('Relatório Consolidado de Histórico Individual e Movimentações do Paciente', 40, currentY);

            currentY += 12;
            const dataEmissao = new Date().toLocaleString('pt-BR');
            const emissor = currentUser?.name || 'Gestor Autorizado';
            doc.setFontSize(8);
            doc.text(`Emissão: ${dataEmissao} | Responsável: ${emissor} | Filtro: ${periodo === 'tudo' ? 'Todo o Histórico' : `Últimos ${periodo}`}`, 40, currentY);

            currentY += 18;
            setProgress(50);

            // 2. Seção Dados do Paciente
            if (incluirCadastrais) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(14, 116, 144);
                doc.text('1. IDENTIFICAÇÃO DO PACIENTE', 40, currentY);
                currentY += 8;

                const dadosPacienteRows = [
                    ['Nome Completo', paciente.name || '-', 'CPF', paciente.cpf || '-'],
                    ['Cartão SUS (CNS)', paciente.sus_number || '-', 'Nascimento', paciente.birth_date ? new Date(paciente.birth_date).toLocaleDateString('pt-BR') : '-'],
                    ['Telefone', paciente.phone || '-', 'Agente de Saúde (ACS)', paciente.agente_saude || '-'],
                    ['Endereço / Bairro', `${paciente.street || ''} ${paciente.neighborhood ? `• ${paciente.neighborhood}` : ''}`.trim() || '-', 'Cidade', paciente.city || 'SÃO JOSÉ DO GOIABAL - MG']
                ];

                autoTable(doc, {
                    startY: currentY,
                    body: dadosPacienteRows,
                    theme: 'grid',
                    styles: { fontSize: 8, cellPadding: 3.5, font: 'helvetica' },
                    columnStyles: {
                        0: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 90 },
                        1: { cellWidth: 170 },
                        2: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 90 },
                        3: { cellWidth: 165 }
                    },
                    margin: { left: 40, right: 40 }
                });

                currentY = (doc as any).lastAutoTable.finalY + 18;
            }

            setProgress(65);

            // 3. Indicadores Consolidados
            if (incluirIndicadores) {
                if (currentY > 700) { doc.addPage(); currentY = 40; }
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(14, 116, 144);
                doc.text('2. RESUMO DE INDICADORES CONSOLIDADOS', 40, currentY);
                currentY += 8;

                const indRows = [
                    ['Total de Solicitações', String(indicadores.totalSolicitacoes), 'Solicitações Agendadas', String(indicadores.agendadas)],
                    ['Aguardando Vaga / Fila', String(indicadores.aguardandoVaga), 'Procedimentos Realizados', String(indicadores.realizadas)],
                    ['Solicitações Pausadas', String(indicadores.pausadas), 'Solicitações Canceladas', String(indicadores.canceladas)],
                    ['Tempo Médio de Espera', `${indicadores.tempoMedioEsperaDias} dias`, 'Retiradas na Farmácia', `${indicadores.totalRetiradasMedicamentos} (${indicadores.totalQuantidadeFisicaEntregue} un)`]
                ];

                autoTable(doc, {
                    startY: currentY,
                    body: indRows,
                    theme: 'grid',
                    styles: { fontSize: 8, cellPadding: 3.5, font: 'helvetica' },
                    columnStyles: {
                        0: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 130 },
                        1: { cellWidth: 125, halign: 'center' },
                        2: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 130 },
                        3: { cellWidth: 130, halign: 'center' }
                    },
                    margin: { left: 40, right: 40 }
                });

                currentY = (doc as any).lastAutoTable.finalY + 18;
            }

            setProgress(75);

            // 4. Solicitações e Procedimentos
            if (incluirSolicitacoes) {
                if (currentY > 680) { doc.addPage(); currentY = 40; }
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(14, 116, 144);
                doc.text('3. HISTÓRICO DE SOLICITAÇÕES E PROCEDIMENTOS', 40, currentY);
                currentY += 8;

                const filteredSols = filtrarPorPeriodo(solicitacoes, s => s.solicitation_date || s.created_at);

                if (filteredSols.length === 0) {
                    doc.setFont('helvetica', 'italic');
                    doc.setFontSize(8);
                    doc.setTextColor(148, 163, 184);
                    doc.text('Nenhuma solicitação localizada para o período selecionado.', 40, currentY + 10);
                    currentY += 25;
                } else {
                    const solRows = filteredSols.map(s => {
                        const indicador = calcularIndicadorTempoEspera(s);
                        const dtSol = s.solicitation_date || s.created_at ? new Date(s.solicitation_date || s.created_at || '').toLocaleDateString('pt-BR') : '-';
                        const dtAgend = s.appointment_date ? new Date(s.appointment_date).toLocaleDateString('pt-BR') : '-';

                        return [
                            s.procedimento?.name || 'Procedimento',
                            s.priority || 'Normal',
                            dtSol,
                            `${indicador.diasCorridos}d (${indicador.tempoEfetivoFila}d efet)`,
                            s.status || 'Solicitado',
                            dtAgend,
                            indicador.classificacao
                        ];
                    });

                    autoTable(doc, {
                        startY: currentY,
                        head: [['Procedimento', 'Prioridade', 'Solicitado', 'Espera', 'Situação', 'Data Agend.', 'Classificação']],
                        body: solRows,
                        theme: 'striped',
                        headStyles: { fillColor: [14, 116, 144], textColor: 255, fontSize: 8, fontStyle: 'bold' },
                        styles: { fontSize: 7.5, cellPadding: 3, font: 'helvetica' },
                        columnStyles: {
                            0: { cellWidth: 140 },
                            1: { cellWidth: 55, halign: 'center' },
                            2: { cellWidth: 55, halign: 'center' },
                            3: { cellWidth: 70, halign: 'center' },
                            4: { cellWidth: 70, halign: 'center' },
                            5: { cellWidth: 55, halign: 'center' },
                            6: { cellWidth: 70, halign: 'center' }
                        },
                        margin: { left: 40, right: 40 }
                    });

                    currentY = (doc as any).lastAutoTable.finalY + 18;
                }
            }

            setProgress(85);

            // 5. Histórico de Medicamentos
            if (incluirMedicamentos) {
                if (currentY > 680) { doc.addPage(); currentY = 40; }
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(14, 116, 144);
                doc.text('4. HISTÓRICO DE MEDICAMENTOS DISPENSADOS (FARMÁCIA POPULAR)', 40, currentY);
                currentY += 8;

                const filteredMeds = filtrarPorPeriodo(medicamentos, m => m.data || m.criado_em);

                if (filteredMeds.length === 0) {
                    doc.setFont('helvetica', 'italic');
                    doc.setFontSize(8);
                    doc.setTextColor(148, 163, 184);
                    doc.text('Nenhuma dispensação de medicamentos localizada para o período selecionado.', 40, currentY + 10);
                    currentY += 25;
                } else {
                    const medRows = filteredMeds.map(m => {
                        const dtRetirada = m.data ? new Date(m.data).toLocaleDateString('pt-BR') : '-';
                        return [
                            m.medicamento_nome || 'Medicamento',
                            String(m.quantidade || 1),
                            dtRetirada,
                            m.lote || '-',
                            m.medico_crm ? `CRM ${m.medico_crm} ${m.medico_uf || ''} ${m.medico_nome ? `(${m.medico_nome})` : ''}` : '-',
                            m.responsavel_nome || 'Farmácia'
                        ];
                    });

                    autoTable(doc, {
                        startY: currentY,
                        head: [['Medicamento', 'Qtd', 'Data', 'Lote', 'Médico Prescritor', 'Dispensado Por']],
                        body: medRows,
                        theme: 'striped',
                        headStyles: { fillColor: [126, 34, 206], textColor: 255, fontSize: 8, fontStyle: 'bold' },
                        styles: { fontSize: 7.5, cellPadding: 3, font: 'helvetica' },
                        columnStyles: {
                            0: { cellWidth: 155 },
                            1: { cellWidth: 35, halign: 'center' },
                            2: { cellWidth: 55, halign: 'center' },
                            3: { cellWidth: 60, halign: 'center' },
                            4: { cellWidth: 120 },
                            5: { cellWidth: 90 }
                        },
                        margin: { left: 40, right: 40 }
                    });

                    currentY = (doc as any).lastAutoTable.finalY + 18;
                }
            }

            setProgress(90);

            // 5. Histórico de Atendimentos — UPA, PSF 1 e PSF 2 (AutoSenha)
            if (incluirAtendimentosAutoSenha && senhasAutoSenha && senhasAutoSenha.length > 0) {
                if (currentY > 660) { doc.addPage(); currentY = 40; }
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(225, 29, 72);
                doc.text('5. HISTÓRICO DE ATENDIMENTOS — UPA, PSF 1 E PSF 2 (AUTOSENHA)', 40, currentY);
                currentY += 8;

                const filteredSenhas = filtrarPorPeriodo(senhasAutoSenha, s => s.created_at);

                if (filteredSenhas.length === 0) {
                    doc.setFont('helvetica', 'italic');
                    doc.setFontSize(8);
                    doc.setTextColor(148, 163, 184);
                    doc.text('Nenhum atendimento presencial no período selecionado.', 40, currentY + 10);
                    currentY += 25;
                } else {
                    const rows = filteredSenhas.map(s => {
                        const dataStr = s.created_at ? new Date(s.created_at).toLocaleDateString('pt-BR') : '-';
                        const horaEmissao = s.created_at ? new Date(s.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-';
                        const horaChamada = s.first_called_at ? new Date(s.first_called_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-';
                        const horaConclusao = s.service_finished_at ? new Date(s.service_finished_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-';
                        const esperaMin = s.wait_time_first_call_seconds ? `${Math.round(s.wait_time_first_call_seconds / 60)} min` : '-';
                        const duracaoMin = s.service_duration_seconds ? `${Math.round(s.service_duration_seconds / 60)} min` : '-';
                        const unidade = s.unidade_id === 'upa' ? 'UPA' : s.unidade_id === 'psf1' ? 'PSF 1' : 'PSF 2';
                        const prioridade = s.prioridade_categoria || s.prioridade_tipo || 'Geral';
                        const situacao = s.status === 'CONCLUIDO' ? 'Concluído' : s.status === 'NAO_COMPARECEU' ? 'Não Compareceu' : s.status === 'CANCELADO' ? 'Cancelado' : s.status === 'EM_ATENDIMENTO' ? 'Em Atendimento' : s.status === 'CHAMANDO' ? 'Chamando' : 'Aguardando';

                        return [
                            dataStr,
                            unidade,
                            s.numero,
                            prioridade,
                            horaEmissao,
                            horaChamada,
                            horaConclusao,
                            esperaMin,
                            duracaoMin,
                            situacao
                        ];
                    });

                    autoTable(doc, {
                        startY: currentY,
                        head: [['Data', 'Unidade', 'Senha', 'Prioridade', 'Emissão', 'Chamada', 'Conclusão', 'Espera', 'Duração', 'Situação']],
                        body: rows,
                        theme: 'striped',
                        headStyles: { fillColor: [225, 29, 72], textColor: 255, fontSize: 7.5, fontStyle: 'bold' },
                        styles: { fontSize: 7, cellPadding: 2.5, font: 'helvetica' },
                        columnStyles: {
                            0: { cellWidth: 48, halign: 'center' },
                            1: { cellWidth: 42, halign: 'center' },
                            2: { cellWidth: 42, halign: 'center' },
                            3: { cellWidth: 60 },
                            4: { cellWidth: 42, halign: 'center' },
                            5: { cellWidth: 42, halign: 'center' },
                            6: { cellWidth: 46, halign: 'center' },
                            7: { cellWidth: 42, halign: 'center' },
                            8: { cellWidth: 42, halign: 'center' },
                            9: { cellWidth: 62 }
                        },
                        margin: { left: 40, right: 40 }
                    });

                    currentY = (doc as any).lastAutoTable.finalY + 18;
                }
            }

            setProgress(95);

            // 6. Linha do Tempo Unificada
            if (incluirLinhaDoTempo) {
                if (currentY > 680) { doc.addPage(); currentY = 40; }
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(14, 116, 144);
                doc.text('6. LINHA DO TEMPO CRONOLÓGICA DE MOVIMENTAÇÕES', 40, currentY);
                currentY += 8;

                const filteredTimeline = filtrarPorPeriodo(linhaDoTempo, l => l.dataHora);

                if (filteredTimeline.length === 0) {
                    doc.setFont('helvetica', 'italic');
                    doc.setFontSize(8);
                    doc.setTextColor(148, 163, 184);
                    doc.text('Nenhuma movimentação no período selecionado.', 40, currentY + 10);
                    currentY += 25;
                } else {
                    const timeRows = filteredTimeline.map(it => {
                        const dt = it.dataHora ? new Date(it.dataHora).toLocaleString('pt-BR') : '-';
                        return [
                            dt,
                            it.origem,
                            it.titulo,
                            it.subtitulo
                        ];
                    });

                    autoTable(doc, {
                        startY: currentY,
                        head: [['Data / Hora', 'Módulo', 'Ação / Movimentação', 'Detalhes']],
                        body: timeRows,
                        theme: 'striped',
                        headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 8, fontStyle: 'bold' },
                        styles: { fontSize: 7.5, cellPadding: 3, font: 'helvetica' },
                        columnStyles: {
                            0: { cellWidth: 85, halign: 'center' },
                            1: { cellWidth: 75, halign: 'center' },
                            2: { cellWidth: 165 },
                            3: { cellWidth: 190 }
                        },
                        margin: { left: 40, right: 40 }
                    });

                    currentY = (doc as any).lastAutoTable.finalY + 18;
                }
            }

            // Rodapé Institucional em todas as páginas
            const totalPages = doc.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7.5);
                doc.setTextColor(148, 163, 184);
                doc.text(
                    `Página ${i} de ${totalPages} • Documento Administrativo da Regulação e Saúde Municipal • Autenticidade e Auditoria Garantidas`,
                    pageWidth / 2,
                    doc.internal.pageSize.getHeight() - 20,
                    { align: 'center' }
                );
            }

            const blob = doc.output('blob');
            const blobUrl = URL.createObjectURL(blob);
            setPdfBlobUrl(blobUrl);

            // Registro em auditoria
            try {
                await auditLogService.logAction({
                    action_type: 'RELATORIO_PACIENTE_GERADO',
                    module: 'Regulação/Pacientes',
                    description: `Gerado relatório individual consolidado em PDF para o paciente ${paciente.name} (CPF: ${paciente.cpf || 'N/I'}).`,
                    details: {
                        paciente_id: paciente.id,
                        paciente_nome: paciente.name,
                        paciente_cpf: paciente.cpf,
                        periodo,
                        secoes: {
                            cadastrais: incluirCadastrais,
                            indicadores: incluirIndicadores,
                            solicitacoes: incluirSolicitacoes,
                            medicamentos: incluirMedicamentos,
                            linhaDoTempo: incluirLinhaDoTempo
                        }
                    }
                });
            } catch (auditErr) {
                console.warn('Falha ao auditar geração de relatório:', auditErr);
            }

            setProgress(100);
            setDownloadReady(true);
        } catch (err) {
            console.error('Erro ao gerar relatório PDF:', err);
            alert('Ocorreu um erro ao gerar o documento. Tente novamente.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!pdfBlobUrl) return;
        const link = document.createElement('a');
        link.href = pdfBlobUrl;
        const nomeArquivo = `Relatorio_Paciente_${(paciente.name || 'Paciente').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        link.download = nomeArquivo;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header Modal */}
                <div className="p-4 sm:p-5 bg-gradient-to-r from-sky-600 via-sky-700 to-indigo-700 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                            <FileText className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-black tracking-tight leading-tight">
                                Gerar Relatório Individual
                            </h3>
                            <p className="text-xs text-sky-100 font-medium truncate max-w-xs sm:max-w-md">
                                {paciente.name} • Prontuário Administrativo Consolidado
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isGenerating}
                        className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                        title="Fechar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Conteúdo com seleção de opções */}
                <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 no-scrollbar">
                    {/* Período */}
                    <div>
                        <label className="text-xs font-black uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-sky-600" /> Período do Relatório
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {[
                                { key: 'tudo', label: 'Todo o Histórico' },
                                { key: '30dias', label: 'Últimos 30 dias' },
                                { key: '90dias', label: 'Últimos 90 dias' },
                                { key: '1ano', label: 'Último 1 ano' }
                            ].map(p => (
                                <button
                                    key={p.key}
                                    type="button"
                                    onClick={() => setPeriodo(p.key as any)}
                                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                                        periodo === p.key
                                            ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-white hover:border-sky-300'
                                    }`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Seções a incluir */}
                    <div>
                        <label className="text-xs font-black uppercase tracking-wider text-slate-700 mb-2.5 flex items-center gap-1.5">
                            <CheckSquare className="w-3.5 h-3.5 text-sky-600" /> Seções a Incluir no Documento
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {[
                                { label: 'Identificação e Cadastro', state: incluirCadastrais, set: setIncluirCadastrais },
                                { label: 'Resumo de Indicadores Gerais', state: incluirIndicadores, set: setIncluirIndicadores },
                                { label: 'Histórico de Solicitações e Procedimentos', state: incluirSolicitacoes, set: setIncluirSolicitacoes },
                                { label: 'Retiradas de Medicamentos (Farmácia)', state: incluirMedicamentos, set: setIncluirMedicamentos },
                                { label: 'Histórico de Atendimentos (UPA, PSF 1 e PSF 2)', state: incluirAtendimentosAutoSenha, set: setIncluirAtendimentosAutoSenha },
                                { label: 'Linha do Tempo Cronológica', state: incluirLinhaDoTempo, set: setIncluirLinhaDoTempo }
                            ].map((sec, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => sec.set(!sec.state)}
                                    className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                                        sec.state
                                            ? 'bg-sky-50/60 border-sky-300 text-sky-950 font-bold'
                                            : 'bg-slate-50/70 border-slate-200 text-slate-500 hover:bg-white'
                                    }`}
                                >
                                    {sec.state ? (
                                        <CheckSquare className="w-4 h-4 text-sky-600 shrink-0" />
                                    ) : (
                                        <Square className="w-4 h-4 text-slate-300 shrink-0" />
                                    )}
                                    <span className="text-xs leading-tight">{sec.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Barra de Progresso Real */}
                    {isGenerating && (
                        <div className="bg-sky-50 rounded-2xl p-4 border border-sky-200/80 animate-in fade-in duration-200 space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-sky-900">
                                <span className="flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 text-sky-600 animate-spin" /> Gerando documento institucional...
                                </span>
                                <span>{progress}%</span>
                            </div>
                            <div className="w-full bg-sky-200/60 h-2 rounded-full overflow-hidden">
                                <div
                                    className="bg-sky-600 h-full rounded-full transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <p className="text-[10px] text-sky-700 font-medium text-center">
                                Consolidando Regulação, Consultas e Farmácia Popular com auditoria LGPD...
                            </p>
                        </div>
                    )}

                    {downloadReady && (
                        <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200 flex items-center gap-3 text-emerald-900 animate-in fade-in duration-200">
                            <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <h4 className="text-xs font-black uppercase">Relatório Gerado com Sucesso!</h4>
                                <p className="text-[11px] text-emerald-700">
                                    O arquivo está pronto para download e foi registrado em auditoria.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Aviso de Auditoria e Privacidade */}
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-500 text-[10px]">
                        <Shield className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>A geração deste relatório é rastreada com carimbo de tempo, IP e operador em conformidade com a LGPD.</span>
                    </div>
                </div>

                {/* Rodapé com Ações */}
                <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200/90 flex items-center justify-between gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isGenerating}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-black uppercase tracking-wider text-slate-600 hover:bg-white hover:text-slate-800 transition-all cursor-pointer"
                    >
                        Cancelar
                    </button>

                    <div className="flex items-center gap-2">
                        {downloadReady ? (
                            <button
                                type="button"
                                onClick={handleDownload}
                                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                            >
                                <Download className="w-4 h-4" /> Baixar PDF
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleGerarRelatorio}
                                disabled={isGenerating}
                                className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-sky-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" /> Processando...
                                    </>
                                ) : (
                                    <>
                                        <FileText className="w-4 h-4" /> Processar Relatório
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
