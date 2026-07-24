-- Função de trigger para sincronizar inserção e atualização de diarias_eventos concluídas para service_requests
CREATE OR REPLACE FUNCTION public.sync_diaria_evento_to_service_request()
RETURNS TRIGGER AS $$
DECLARE
  v_protocol TEXT;
  v_title TEXT;
  v_req_name TEXT;
  v_dest TEXT;
  v_dep_date TEXT;
  v_ret_date TEXT;
  v_desc_reason TEXT;
  v_dist_km NUMERIC;
  v_lodging_cnt INTEGER;
  v_req_val TEXT;
  v_auth_by TEXT;
  v_sig_name TEXT;
  v_sig_role TEXT;
  v_doc_snapshot JSONB;
BEGIN
  -- Somente se o status for 'concluido'
  IF NEW.status = 'concluido' THEN
    -- Protocolo: DIA-XXXX/ANO
    v_protocol := 'DIA-' || upper(substring(NEW.id::text from 1 for 4)) || '/' || to_char(NEW.created_at, 'YYYY');
    
    -- Nome do Requerente (Pessoas solicitantes)
    IF NEW.pessoas IS NOT NULL AND jsonb_array_length(NEW.pessoas) > 0 THEN
      v_req_name := NEW.pessoas->0->>'name';
    ELSE
      v_req_name := NEW.user_name;
    END IF;
    
    v_title := 'Concessão de Diária - ' || COALESCE(v_req_name, 'Servidor');
    v_dest := NEW.destino;
    v_dep_date := to_char(NEW.data_saida, 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
    v_ret_date := to_char(NEW.data_retorno, 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
    v_desc_reason := NEW.motivo;
    v_dist_km := COALESCE(NEW.distancia, 0);
    v_lodging_cnt := COALESCE(NEW.hospedagem_dias, 0);
    v_req_val := 'R$ ' || REPLACE(COALESCE(NEW.valor_diaria, 0)::text, '.', ',');
    
    IF NEW.gestor_transferido_cargo IS NOT NULL AND NEW.gestor_transferido_cargo <> '' THEN
      v_auth_by := NEW.gestor_transferido_cargo;
    ELSE
      v_auth_by := 'Gestor do Setor Responsável';
    END IF;
    
    IF NEW.digital_signature IS NOT NULL THEN
      v_sig_name := NEW.digital_signature->>'signerName';
      v_sig_role := 'Administrador';
    ELSE
      v_sig_name := '';
      v_sig_role := '';
    END IF;
    
    -- Construir o document_snapshot estruturado compatível com o módulo de histórico/preview
    v_doc_snapshot := jsonb_build_object(
      'branding', jsonb_build_object(
        'logoUrl', null,
        'primaryColor', '#4f46e5',
        'secondaryColor', '#0f172a',
        'fontFamily', 'font-sans',
        'logoWidth', 76,
        'logoAlignment', 'left',
        'watermark', jsonb_build_object(
          'enabled', false,
          'imageUrl', null,
          'opacity', 20,
          'size', 55,
          'grayscale', true
        )
      ),
      'document', jsonb_build_object(
        'headerText', '',
        'footerText', '',
        'city', '',
        'showDate', true,
        'showPageNumbers', true,
        'showSignature', false,
        'showLeftBlock', true,
        'showRightBlock', true,
        'titleStyle', jsonb_build_object('size', 12, 'color', '#000000', 'alignment', 'left'),
        'leftBlockStyle', jsonb_build_object('size', 10, 'color', '#000000'),
        'rightBlockStyle', jsonb_build_object('size', 10, 'color', '#000000')
      ),
      'ui', jsonb_build_object(
        'loginLogoUrl', null,
        'loginLogoHeight', 80,
        'headerLogoUrl', null,
        'headerLogoHeight', 40,
        'homeLogoPosition', 'left'
      ),
      'isLightweight', false,
      'content', jsonb_build_object(
        'title', v_title,
        'protocol', v_protocol,
        'subType', null,
        'body', '',
        'leftBlockText', '',
        'rightBlockText', '',
        'requesterName', v_req_name,
        'requesterRole', '',
        'destination', v_dest,
        'departureDateTime', v_dep_date,
        'returnDateTime', v_ret_date,
        'requesterSector', null,
        'priority', 'Normal',
        'authorizedBy', v_auth_by,
        'requestedValue', v_req_val,
        'descriptionReason', v_desc_reason,
        'lodgingCount', v_lodging_cnt,
        'distanceKm', v_dist_km,
        'paymentForecast', null,
        'signatureName', v_sig_name,
        'signatureRole', v_sig_role,
        'signatureSector', '',
        'showDiariaSignatures', true,
        'useDigitalSignature', true,
        'digitalSignature', NEW.digital_signature
      )
    );
    
    -- Inserir ou atualizar na tabela service_requests
    INSERT INTO public.service_requests (
      id,
      protocol,
      title,
      status,
      payment_status,
      created_at,
      user_id,
      user_name,
      document_snapshot
    ) VALUES (
      NEW.id,
      v_protocol,
      v_title,
      'concluido',
      'pending',
      NEW.created_at,
      NEW.user_id,
      NEW.user_name,
      v_doc_snapshot
    )
    ON CONFLICT (id) DO UPDATE SET
      protocol = EXCLUDED.protocol,
      title = EXCLUDED.title,
      status = EXCLUDED.status,
      user_name = EXCLUDED.user_name,
      document_snapshot = EXCLUDED.document_snapshot;
      
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sincronizar exclusão de diarias_eventos para service_requests
CREATE OR REPLACE FUNCTION public.sync_delete_diaria_evento_to_service_request()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.service_requests WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger de Insert/Update
DROP TRIGGER IF EXISTS trg_sync_diaria_evento ON public.diarias_eventos;
CREATE TRIGGER trg_sync_diaria_evento
  AFTER INSERT OR UPDATE ON public.diarias_eventos
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_diaria_evento_to_service_request();

-- Criar trigger de Delete
DROP TRIGGER IF EXISTS trg_sync_delete_diaria_evento ON public.diarias_eventos;
CREATE TRIGGER trg_sync_delete_diaria_evento
  AFTER DELETE ON public.diarias_eventos
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_delete_diaria_evento_to_service_request();
