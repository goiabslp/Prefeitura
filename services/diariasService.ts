
import { supabase } from './supabaseClient';
import { Order } from '../types';
import * as counterService from './counterService';

export const getAllServiceRequests = async (lightweight = true, page = 0, pageSize = 1000, searchTerm = ''): Promise<Order[]> => {
    const columns = lightweight
        ? 'id, protocol, title, status, status_history, created_at, user_id, user_name, payment_status, payment_date'
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
        return [];
    }

    return data.map((item: any) => ({
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
        documentSnapshot: lightweight ? {
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
                headerLogoUrl: null,
                headerLogoHeight: 40,
                homeLogoPosition: 'left' as any
            },
            isLightweight: true,
            content: {
                title: item.title,
                protocol: item.protocol, // CRITICAL: Include protocol in document content
                subType: undefined,
                body: '',
                leftBlockText: '',
                rightBlockText: '',
                requesterName: item.user_name,
                requesterRole: '',
                destination: 'Destino n/a',
                departureDateTime: undefined,
                returnDateTime: undefined,
                requesterSector: undefined,
                priority: 'Normal',
                authorizedBy: '',
                requestedValue: '',
                descriptionReason: '',
                lodgingCount: 0,
                distanceKm: 0,
                paymentForecast: undefined,
                signatureName: '',
                signatureRole: '',
                signatureSector: '',
                showDiariaSignatures: false,
                useDigitalSignature: false
            }
        } : item.document_snapshot
    }));
};

export const getServiceRequestById = async (id: string): Promise<Order> => {
    const { data, error } = await supabase
        .from('service_requests')
        .select('*')
        .eq('id', id)
        .single();

    if (error) throw error;

    // Agressive Normalization for Legacy Data
    let docSnapshot = data.document_snapshot || {};

    // If content object doesn't exist, legacy data might be at the root
    if (!docSnapshot.content) {
        docSnapshot.content = { ...docSnapshot };
    }

    const c = docSnapshot.content;
    const r = docSnapshot; // root fallback

    docSnapshot.content = {
        ...c,
        requesterRole: c.requesterRole || c.requester_role || r.requesterRole || r.requester_role,
        requestedValue: c.requestedValue || c.requested_value || r.requestedValue || r.requested_value,
        distanceKm: Number(c.distanceKm || c.distance_km || r.distanceKm || r.distance_km) || 0,
        authorizedBy: c.authorizedBy || c.authorized_by || r.authorizedBy || r.authorized_by,
        descriptionReason: c.descriptionReason || c.description_reason || r.descriptionReason || r.description_reason,
        signatureName: c.signatureName || c.signature_name || r.signatureName || r.signature_name,
        signatureRole: c.signatureRole || c.signature_role || r.signatureRole || r.signature_role,
        signatureSector: c.signatureSector || c.signature_sector || r.signatureSector || r.signature_sector,
        returnDateTime: c.returnDateTime || c.return_date || r.returnDateTime || r.return_date,
        departureDateTime: c.departureDateTime || c.departure_date || r.departureDateTime || r.departure_date,
        requesterName: c.requesterName || c.requester_name || r.requesterName || r.requester_name,
        requesterSector: c.requesterSector || c.requester_sector || r.requesterSector || r.requester_sector,
        paymentForecast: c.paymentForecast || c.payment_forecast || r.paymentForecast || r.payment_forecast,
        showDiariaSignatures: c.showDiariaSignatures ?? c.show_signatures ?? r.showDiariaSignatures ?? r.show_signatures ?? true,
        useDigitalSignature: c.useDigitalSignature ?? c.use_digital ?? r.useDigitalSignature ?? r.use_digital ?? true,
        lodgingCount: Number(c.lodgingCount || c.lodging_count || r.lodgingCount || r.lodging_count) || 0,
        destination: c.destination || r.destination,
        subType: c.subType || c.sub_type || r.subType || r.sub_type,
        protocol: c.protocol || r.protocol,
        title: c.title || r.title || data.title
    };

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
        documentSnapshot: docSnapshot
    };
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
