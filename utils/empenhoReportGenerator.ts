import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AbastecimentoRecord } from '../services/abastecimentoService';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatNumber = (value: number) => {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const generateEmpenhoReportPDF = (
    records: (AbastecimentoRecord & { derivedSector: string; derivedPlate: string })[],
    periodoStr: string,
    postoStr: string
): Blob => {
    const doc = new jsPDF('landscape', 'pt', 'a4');

    // Headers and Meta
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório Consolidado de Lançamentos Empenhados', 40, 40);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Período: ${periodoStr}`, 40, 60);
    doc.text(`Posto: ${postoStr}`, 40, 75);

    // Grouping by Empenho
    const groupedByEmpenho: Record<string, typeof records> = {};
    records.forEach(r => {
        const empenhoKey = r.numero_empenho ? `${r.projeto_atividade || ''} - Empenho: ${r.numero_empenho}` : 'Sem Empenho Definido';
        if (!groupedByEmpenho[empenhoKey]) groupedByEmpenho[empenhoKey] = [];
        groupedByEmpenho[empenhoKey].push(r);
    });

    let startY = 100;

    Object.entries(groupedByEmpenho).forEach(([empenhoStr, empenhoRecords]) => {
        // Sector Table
        autoTable(doc, {
            startY,
            head: [[
                { content: `${empenhoStr}`, colSpan: 8, styles: { fillColor: [40, 40, 60], textColor: 255, fontStyle: 'bold' } }
            ], [
                'Setor', 'Placa', 'Motorista', 'Odômetro', 'Nota Fiscal', 'Litros', 'Vl. Unit.', 'Posto'
            ]],
            body: empenhoRecords.map(r => {
                const unitPrice = r.unit_price || (r.liters > 0 ? (r.cost / r.liters) : 0);
                return [
                    r.derivedSector || '-',
                    r.derivedPlate || '-',
                    r.driver || '-',
                    formatNumber(r.odometer || 0),
                    r.invoiceNumber || r.fiscal || '-',
                    formatNumber(r.liters || 0),
                    formatCurrency(unitPrice),
                    r.station || '-'
                ];
            }),
            styles: {
                fontSize: 8,
                cellPadding: 4,
            },
            headStyles: {
                fillColor: [240, 240, 240],
                textColor: [60, 60, 60],
                fontStyle: 'bold'
            },
            columnStyles: {
                3: { halign: 'right' }, // Odometer
                5: { halign: 'right' }, // Liters
                6: { halign: 'right' }  // Total cost
            },
            theme: 'grid',
            margin: { top: 40, left: 40, right: 40 }
        });

        const totalCost = empenhoRecords.reduce((acc, r) => acc + (r.cost || 0), 0);
        const totalLiters = empenhoRecords.reduce((acc, r) => acc + (r.liters || 0), 0);

        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY,
            body: [
                [
                    { content: 'Totais do Empenho:', colSpan: 4, styles: { halign: 'right' } },
                    { content: formatNumber(totalLiters) + ' L', styles: { halign: 'right' } },
                    { content: 'Total: ' + formatCurrency(totalCost), colSpan: 3, styles: { halign: 'left' } }
                ]
            ],
            styles: {
                fontSize: 8,
                fontStyle: 'bold',
                fillColor: [245, 245, 250],
                textColor: [30, 30, 50]
            },
            theme: 'plain',
            margin: { left: 40, right: 40 }
        });

        startY = (doc as any).lastAutoTable.finalY + 20;
    });

    const grandTotalCost = records.reduce((acc, r) => acc + (r.cost || 0), 0);
    const grandTotalLiters = records.reduce((acc, r) => acc + (r.liters || 0), 0);

    autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        body: [
            [
                { content: 'TOTAL GERAL NESTA REMESSA:', colSpan: 4, styles: { halign: 'right' } },
                { content: formatNumber(grandTotalLiters) + ' L', styles: { halign: 'right' } },
                { content: 'Total: ' + formatCurrency(grandTotalCost), colSpan: 3, styles: { halign: 'left' } }
            ]
        ],
        styles: {
            fontSize: 10,
            fontStyle: 'bold',
            fillColor: [20, 20, 40],
            textColor: [255, 255, 255]
        },
        margin: { left: 40, right: 40 }
    });

    return doc.output('blob');
};
