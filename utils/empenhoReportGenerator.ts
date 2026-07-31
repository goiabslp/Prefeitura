import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AbastecimentoRecord } from '../services/abastecimentoService';
import { Person } from '../types';
import { getDisplayInvoiceNumber } from './invoiceUtils';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatNumber = (value: number) => {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDateSafe = (dateSource: string | Date | null | undefined): string => {
    if (!dateSource) return '-';
    let d: Date;
    if (dateSource instanceof Date) {
        d = dateSource;
    } else {
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateSource)) {
            const [year, month, day] = dateSource.split('-').map(Number);
            d = new Date(year, month - 1, day);
        } else {
            d = new Date(dateSource);
        }
    }
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('pt-BR');
};

export const generateEmpenhoReportPDF = (
    records: (AbastecimentoRecord & { derivedSector: string; derivedPlate: string })[],
    periodoStr: string,
    postoStr: string,
    persons: Person[] = [],
    gasStations: any[] = []
): Blob => {
    const doc = new jsPDF('landscape', 'pt', 'a4');

    // Headers and Meta
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório Consolidado de Lançamentos Empenhados', 40, 40);

    const formatStation = (name: string) => {
        if (!name || name === 'Todos os Postos') return name;
        const station = gasStations.find(s => s.name.trim().toLowerCase() === name.trim().toLowerCase());
        if (station && station.supplier_code) {
            return `${station.supplier_code} - ${name}`;
        }
        return name;
    };

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Período: ${periodoStr}`, 40, 60);
    doc.text(`Posto: ${formatStation(postoStr)}`, 40, 75);

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
                { content: `${empenhoStr}`, colSpan: 9, styles: { fillColor: [40, 40, 60], textColor: 255, fontStyle: 'bold' } }
            ], [
                'Data', 'Setor', 'Placa', 'Motorista', 'Odômetro', 'Nota Fiscal', 'Litros', 'Vl. Unit.', 'Posto'
            ]],
            body: empenhoRecords.map(r => {
                const unitPrice = r.unit_price || (r.liters > 0 ? (r.cost / r.liters) : 0);
                const fuelData = formatDateSafe(r.date);
                
                // Format driver with code if found, default to 34
                const driverPerson = persons.find(p => p.name.trim().toLowerCase() === (r.driver || '').trim().toLowerCase());
                const driverDisplay = (driverPerson && driverPerson.driver_code) 
                    ? `${driverPerson.driver_code} - ${r.driver}`
                    : `34 - ${r.driver || '-'}`;

                return [
                    fuelData,
                    r.derivedSector || '-',
                    r.derivedPlate || '-',
                    driverDisplay,
                    formatNumber(r.odometer || 0),
                    getDisplayInvoiceNumber(r.invoiceNumber) || r.fiscal || '-',
                    formatNumber(r.liters || 0),
                    formatCurrency(unitPrice),
                    formatStation(r.station || '-')
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
                4: { halign: 'right' }, // Odometer
                6: { halign: 'right' }, // Liters
                7: { halign: 'right' }  // Unit Price
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
                    { content: 'Totais do Empenho:', colSpan: 5, styles: { halign: 'right' } },
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
                { content: 'TOTAL GERAL NESTA REMESSA:', colSpan: 5, styles: { halign: 'right' } },
                { content: formatNumber(grandTotalLiters) + ' L', styles: { halign: 'right' } },
                { content: 'Total: ' + formatCurrency(grandTotalCost), colSpan: 3, styles: { halign: 'left' } }
            ]
        ],
        styles: {
            fontSize: 10,
            fontStyle: 'bold',
            fillColor: [220, 220, 220],
            textColor: [0, 0, 0]
        },
        theme: 'plain',
        margin: { left: 40, right: 40 }
    });

    return doc.output('blob');
};
