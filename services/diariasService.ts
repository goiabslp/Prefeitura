
import { supabase } from './supabaseClient';
import { Order } from '../types';
import * as counterService from './counterService';

const normalizeDiariasSnapshot = (item: any, docSnapshotInput: any): any => {
    let docSnapshot = docSnapshotInput ? JSON.parse(JSON.stringify(docSnapshotInput)) : {};

    // If content object doesn't exist, legacy data might be at the root
    if (!docSnapshot.content) {
        docSnapshot.content = { ...docSnapshot };
    }

    const c = docSnapshot.content;
    const r = docSnapshot; // root fallback

    docSnapshot.content = {
        ...c,
        requesterRole: c.requesterRole || c.requester_role || r.requesterRole || r.requester_role || '',
        requestedValue: c.requestedValue || c.requested_value || r.requestedValue || r.requested_value || '',
        distanceKm: Number(c.distanceKm || c.distance_km || r.distanceKm || r.distance_km) || 0,
        authorizedBy: c.authorizedBy || c.authorized_by || r.authorizedBy || r.authorized_by || '',
        descriptionReason: c.descriptionReason || c.description_reason || r.descriptionReason || r.description_reason || '',
        signatureName: c.signatureName || c.signature_name || r.signatureName || r.signature_name || '',
        signatureRole: c.signatureRole || c.signature_role || r.signatureRole || r.signature_role || '',
        signatureSector: c.signatureSector || c.signature_sector || r.signatureSector || r.signature_sector || '',
        returnDateTime: c.returnDateTime || c.return_date || r.returnDateTime || r.return_date,
        departureDateTime: c.departureDateTime || c.departure_date || r.departureDateTime || r.departure_date,
        requesterName: c.requesterName || c.requester_name || r.requesterName || r.requester_name || item.user_name || '',
        requesterSector: c.requesterSector || c.requester_sector || r.requesterSector || r.requester_sector,
        paymentForecast: c.paymentForecast || c.payment_forecast || r.paymentForecast || r.payment_forecast,
        showDiariaSignatures: c.showDiariaSignatures ?? c.show_signatures ?? r.showDiariaSignatures ?? r.show_signatures ?? true,
        useDigitalSignature: c.useDigitalSignature ?? c.use_digital ?? r.useDigitalSignature ?? r.use_digital ?? true,
        lodgingCount: Number(c.lodgingCount || c.lodging_count || r.lodgingCount || r.lodging_count) || 0,
        destination: c.destination || r.destination || 'Destino n/a',
        subType: c.subType || c.sub_type || r.subType || r.sub_type,
        protocol: c.protocol || r.protocol || item.protocol || '',
        title: c.title || r.title || item.title || ''
    };

    return docSnapshot;
};

export const getAllServiceRequests = async (lightweight = true, page = 0, pageSize = 1000, searchTerm = ''): Promise<Order[]> => {
    const columns = lightweight
        ? 'id, protocol, title, status, status_history, created_at, user_id, user_name, payment_status, payment_date, ' +
          'reqName:document_snapshot->content->>requesterName, ' +
          'reqNameLegacy:document_snapshot->>requesterName, ' +
          'reqNameUnderscore:document_snapshot->content->>requester_name, ' +
          'reqNameLegacyUnderscore:document_snapshot->>requester_name, ' +
          'dest:document_snapshot->content->>destination, ' +
          'destLegacy:document_snapshot->>destination, ' +
          'depDate:document_snapshot->content->>departureDateTime, ' +
          'depDateLegacy:document_snapshot->>departureDateTime, ' +
          'depDateUnderscore:document_snapshot->content->>departure_date, ' +
          'depDateLegacyUnderscore:document_snapshot->>departure_date, ' +
          'retDate:document_snapshot->content->>returnDateTime, ' +
          'retDateLegacy:document_snapshot->>returnDateTime, ' +
          'retDateUnderscore:document_snapshot->content->>return_date, ' +
          'retDateLegacyUnderscore:document_snapshot->>return_date, ' +
          'descReason:document_snapshot->content->>descriptionReason, ' +
          'descReasonLegacy:document_snapshot->>descriptionReason, ' +
          'descReasonUnderscore:document_snapshot->content->>description_reason, ' +
          'descReasonLegacyUnderscore:document_snapshot->>description_reason'
        : '*';

    let query = supabase
        .from('service_requests')
        .select(columns)
        .order('created_at', { ascending: false });

    if (searchTerm) {
        query = query.or(`protocol.ilike.%${searchTerm}%,title.ilike.%${searchTerm}%,user_name.ilike.%${searchTerm}%`);
    }

    if (lightweight) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching service requests:', error);
    }

    let serviceRequestOrders: Order[] = (data || []).map((item: any) => {
        if (lightweight) {
            const reqName = item.reqName || item.reqNameLegacy || item.reqNameUnderscore || item.reqNameLegacyUnderscore || item.user_name || '';
            const destination = item.dest || item.destLegacy || 'Destino n/a';
            const departureDateTime = item.depDate || item.depDateLegacy || item.depDateUnderscore || item.depDateLegacyUnderscore || undefined;
            const returnDateTime = item.retDate || item.retDateLegacy || item.retDateUnderscore || item.retDateLegacyUnderscore || undefined;
            const descReason = item.descReason || item.descReasonLegacy || item.descReasonUnderscore || item.descReasonLegacyUnderscore || '';

            return {
                id: item.id,
                protocol: item.protocol,
                title: item.title,
                status: item.status,
                paymentStatus: item.payment_status,
                paymentDate: item.payment_date,
                statusHistory: item.status_history,
                createdAt: item.created_at,
                userId: item.user_id,
                userName: item.user_name,
                blockType: 'diarias',
                documentSnapshot: {
                    branding: {
                        logoUrl: null,
                        primaryColor: '#4f46e5',
                        secondaryColor: '#0f172a',
                        fontFamily: 'font-sans' as any,
                        logoWidth: 76,
                        logoAlignment: 'left' as any,
                        watermark: {
                            enabled: false,
                            imageUrl: null,
                            opacity: 20,
                            size: 55,
                            grayscale: true
                        }
                    },
                    document: {
                        headerText: '',
                        footerText: '',
                        city: '',
                        showDate: true,
                        showPageNumbers: true,
                        showSignature: false,
                        showLeftBlock: true,
                        showRightBlock: true,
                        titleStyle: { size: 12, color: '#000000', alignment: 'left' as any },
                        leftBlockStyle: { size: 10, color: '#000000' },
                        rightBlockStyle: { size: 10, color: '#000000' }
                    },
                    ui: {
                        loginLogoUrl: null,
                        loginLogoHeight: 80,
                        roundedCorners: true,
                        compactMode: false,
                        tableStriped: true
                    },
                    content: {
                        requesterName: reqName,
                        destination: destination,
                        departureDateTime: departureDateTime,
                        returnDateTime: returnDateTime,
                        authorizedBy: '',
                        requestedValue: '',
                        descriptionReason: descReason,
                        lodgingCount: 0,
                        distanceKm: 0,
                        paymentForecast: undefined,
                        signatureName: '',
                        signatureRole: '',
                        signatureSector: '',
                        showDiariaSignatures: false,
                        useDigitalSignature: false
                    }
                }
            };
        }

        return {
            id: item.id,
            protocol: item.protocol,
            title: item.title,
            status: item.status,
            paymentStatus: item.payment_status,
            paymentDate: item.payment_date,
            statusHistory: item.status_history,
            createdAt: item.created_at,
            userId: item.user_id,
            userName: item.user_name,
            blockType: 'diarias',
            documentSnapshot: normalizeDiariasSnapshot(item, item.document_snapshot)
        };
    });

    // 2. Buscar também da tabela diarias_eventos para garantir exibição completa no Histórico
    try {
        let eventosQuery = supabase
            .from('diarias_eventos')
            .select('*')
            .order('created_at', { ascending: false });

        if (searchTerm) {
            eventosQuery = eventosQuery.or(`destino.ilike.%${searchTerm}%,motivo.ilike.%${searchTerm}%,user_name.ilike.%${searchTerm}%`);
        }

        const { data: eventosData } = await eventosQuery;

        if (eventosData && eventosData.length > 0) {
            let deletedSet = new Set<string>();
            try {
                const { getGlobalDeletedEventIds } = await import('./diariasSettingsService');
                const deletedIds = await getGlobalDeletedEventIds();
                deletedSet = new Set(deletedIds);
            } catch (e) {
                console.warn('Erro ao obter IDs deletados:', e);
            }

            eventosData.forEach((evt: any) => {
                if (deletedSet.has(String(evt.id))) return;
                if (serviceRequestOrders.some(o => String(o.id) === String(evt.id))) return;

                const requesterNames = evt.pessoas && Array.isArray(evt.pessoas) && evt.pessoas.length > 0
                    ? evt.pessoas.map((p: any) => p.name).join(', ')
                    : evt.user_name || 'Servidor não informado';

                const mapStatus = (st: string) => {
                  if (st === 'concluido') return 'completed';
                  if (st === 'cancelado' || st === 'rejeitado') return 'rejected';
                  if (st === 'em_viagem') return 'approved';
                  return 'awaiting_approval';
                };

                const mapPaymentStatus = (st: string) => {
                  if (st === 'concluido') return 'paid';
                  return 'pending';
                };

                serviceRequestOrders.push({
                    id: evt.id,
                    protocol: `EVT-${String(evt.id).slice(0, 6).toUpperCase()}`,
                    title: `Viagem Oficial: ${evt.destino}`,
                    status: mapStatus(evt.status),
                    paymentStatus: mapPaymentStatus(evt.status),
                    createdAt: evt.created_at || new Date().toISOString(),
                    userId: evt.user_id,
                    userName: evt.user_name || requesterNames,
                    blockType: 'diarias',
                    documentSnapshot: {
                        branding: {
                            logoUrl: null,
                            primaryColor: '#4f46e5',
                            secondaryColor: '#0f172a',
                            fontFamily: 'font-sans' as any,
                            logoWidth: 76,
                            logoAlignment: 'left' as any,
                            watermark: { enabled: false, imageUrl: null, opacity: 20, size: 55, grayscale: true }
                        },
                        document: {
                            headerText: '', footerText: '', city: '', showDate: true, showPageNumbers: true,
                            showSignature: false, showLeftBlock: true, showRightBlock: true,
                            titleStyle: { size: 12, color: '#000000', alignment: 'left' as any },
                            leftBlockStyle: { size: 10, color: '#000000' },
                            rightBlockStyle: { size: 10, color: '#000000' }
                        },
                        ui: { loginLogoUrl: null, loginLogoHeight: 80, roundedCorners: true, compactMode: false, tableStriped: true },
                        content: {
                            requesterName: requesterNames,
                            destination: evt.destino,
                            departureDateTime: evt.data_saida,
                            returnDateTime: evt.data_retorno,
                            descriptionReason: evt.motivo,
                            subType: evt.veiculo,
                            requestedValue: evt.valor ? `R$ ${Number(evt.valor).toFixed(2)}` : 'R$ 0,00',
                            distanceKm: evt.distancia || 0,
                            lodgingCount: evt.hospedagem_dias || 0
                        }
                    }
                } as unknown as Order);
            });
        }
    } catch (e) {
        console.warn('Erro ao carregar diarias_eventos no historico:', e);
    }

    return serviceRequestOrders;
};

export const getServiceRequestById = async (id: string): Promise<Order> => {
    const { data, error } = await supabase
        .from('service_requests')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (data) {
        return {
            id: data.id,
            protocol: data.protocol,
            title: data.title,
            status: data.status,
            paymentStatus: data.payment_status,
            paymentDate: data.payment_date,
            statusHistory: data.status_history,
            createdAt: data.created_at,
            userId: data.user_id,
            userName: data.user_name,
            blockType: 'diarias',
            documentSnapshot: normalizeDiariasSnapshot(data, data.document_snapshot)
        };
    }

    // Fallback: consultar tabela diarias_eventos
    const { data: evtData, error: evtError } = await supabase
        .from('diarias_eventos')
        .select('*')
        .eq('id', id)
        .single();

    if (evtError || !evtData) throw error || evtError || new Error('Diária não encontrada');

    const requesterNames = evtData.pessoas && Array.isArray(evtData.pessoas) && evtData.pessoas.length > 0
        ? evtData.pessoas.map((p: any) => p.name).join(', ')
        : evtData.user_name || 'Servidor não informado';

    const mapStatus = (st: string) => {
      if (st === 'concluido') return 'completed';
      if (st === 'cancelado' || st === 'rejeitado') return 'rejected';
      if (st === 'em_viagem') return 'approved';
      return 'awaiting_approval';
    };

    return {
        id: evtData.id,
        protocol: `EVT-${String(evtData.id).slice(0, 6).toUpperCase()}`,
        title: `Viagem Oficial: ${evtData.destino}`,
        status: mapStatus(evtData.status),
        paymentStatus: evtData.status === 'concluido' ? 'paid' : 'pending',
        createdAt: evtData.created_at || new Date().toISOString(),
        userId: evtData.user_id,
        userName: evtData.user_name || requesterNames,
        blockType: 'diarias',
        documentSnapshot: {
            branding: { logoUrl: null, primaryColor: '#4f46e5', secondaryColor: '#0f172a', fontFamily: 'font-sans' as any, logoWidth: 76, logoAlignment: 'left' as any, watermark: { enabled: false, imageUrl: null, opacity: 20, size: 55, grayscale: true } },
            document: { headerText: '', footerText: '', city: '', showDate: true, showPageNumbers: true, showSignature: false, showLeftBlock: true, showRightBlock: true, titleStyle: { size: 12, color: '#000000', alignment: 'left' as any }, leftBlockStyle: { size: 10, color: '#000000' }, rightBlockStyle: { size: 10, color: '#000000' } },
            ui: { loginLogoUrl: null, loginLogoHeight: 80, roundedCorners: true, compactMode: false, tableStriped: true },
            content: {
                requesterName: requesterNames,
                destination: evtData.destino,
                departureDateTime: evtData.data_saida,
                returnDateTime: evtData.data_retorno,
                descriptionReason: evtData.motivo,
                subType: evtData.veiculo,
                requestedValue: evtData.valor ? `R$ ${Number(evtData.valor).toFixed(2)}` : 'R$ 0,00',
                distanceKm: evtData.distancia || 0,
                lodgingCount: evtData.hospedagem_dias || 0
            }
        }
    } as unknown as Order;
};

export const saveServiceRequest = async (order: Order): Promise<Order> => {
    let currentOrder = { ...order };
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        const dbOrder = {
            id: currentOrder.id,
            protocol: currentOrder.protocol,
            title: currentOrder.title,
            status: currentOrder.status,
            payment_status: currentOrder.paymentStatus,
            payment_date: currentOrder.paymentDate,
            status_history: currentOrder.statusHistory,
            created_at: currentOrder.createdAt,
            user_id: currentOrder.userId,
            user_name: currentOrder.userName,
            document_snapshot: currentOrder.documentSnapshot
        };

        const { error } = await supabase.from('service_requests').upsert(dbOrder);

        if (!error) {
            return currentOrder;
        }

        if (error.code === '23505') { // Unique violation
            console.warn(`Duplicate protocol ${currentOrder.protocol} detected. Retrying... (Attempt ${attempts + 1}/${maxAttempts})`);
            attempts++;

            const year = new Date().getFullYear();
            const newCount = await counterService.incrementDiariasProtocolCount(year);
            const formattedNum = (newCount || 1).toString().padStart(3, '0');
            const newProtocol = `DIA-${formattedNum}/${year}`;

            currentOrder.protocol = newProtocol;

            // Update documentSnapshot if it exists and has content
            if (currentOrder.documentSnapshot && currentOrder.documentSnapshot.content) {
                currentOrder.documentSnapshot = {
                    ...currentOrder.documentSnapshot,
                    content: {
                        ...currentOrder.documentSnapshot.content,
                        protocol: newProtocol,
                        leftBlockText: `Solicitação Nº: ${newProtocol}`
                    }
                };
            }
        } else {
            throw error;
        }
    }

    throw new Error(`Failed to save service request after ${maxAttempts} attempts due to protocol uniqueness violations.`);
};

export const deleteServiceRequest = async (id: string): Promise<void> => {
    const { error } = await supabase.from('service_requests').delete().eq('id', id);
    if (error) throw error;
};
