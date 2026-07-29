import { supabase } from './supabaseClient';
import { updateDiariaEvento } from './diariasEventosService';
import { DiariaEvento } from '../types';

let isTracking = false;
let trackingIntervalId: any = null;
let watchId: number | null = null;
let backgroundWorker: Worker | null = null;
let wakeLockSentinel: any = null;

// Helper para normalizar texto (remover acentos)
const normalizeText = (text: string): string => {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

// Reverse Geocoding com suporte a OpenStreetMap
export const getCityFromCoords = async (lat: number, lon: number): Promise<string> => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`);
    if (res.ok) {
      const data = await res.json();
      const city = data.address?.city || data.address?.town || data.address?.municipality || data.address?.village || data.address?.county;
      if (city) return city;
    }
  } catch (e) {
    console.warn('Erro ao obter município por GPS:', e);
  }
  return 'Município Detectado';
};

// Tenta manter a tela ativa ou segundo plano ativo durante viagens
const requestWakeLock = async () => {
  try {
    if ('wakeLock' in navigator && !wakeLockSentinel) {
      wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
      wakeLockSentinel.addEventListener('release', () => {
        wakeLockSentinel = null;
      });
    }
  } catch (err) {
    console.warn('Wake Lock não suportado ou negado:', err);
  }
};

const releaseWakeLock = async () => {
  try {
    if (wakeLockSentinel) {
      await wakeLockSentinel.release();
      wakeLockSentinel = null;
    }
  } catch (err) {}
};

// Executa uma captura e atualização completa do Checkpoint
export const performLocationCheckpointSync = async (userId?: string): Promise<DiariaEvento | null> => {
  if (typeof window === 'undefined' || !('geolocation' in navigator)) return null;

  try {
    // 1. Buscar se existe viagem em andamento no Supabase
    const { data: rawEventos, error } = await supabase
      .from('diarias_eventos')
      .select('*')
      .eq('status', 'em_viagem');

    if (error || !rawEventos || rawEventos.length === 0) {
      releaseWakeLock();
      return null;
    }

    // Filtrar viagem pertencente ao usuário logado se informado
    let activeTrip: DiariaEvento | undefined = undefined;
    if (userId) {
      activeTrip = (rawEventos as DiariaEvento[]).find(evt => 
        evt.user_id === userId || 
        (evt.pessoas && evt.pessoas.some(p => p.id === userId))
      );
    }

    if (!activeTrip) {
      activeTrip = rawEventos[0] as DiariaEvento;
    }

    if (!activeTrip) {
      releaseWakeLock();
      return null;
    }

    // Manter segundo plano / tela ativa
    requestWakeLock();

    // 2. Consultar Posição GPS Atual do Dispositivo
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;

          const cityName = await getCityFromCoords(lat, lon);
          const originCity = 'São José do Goiabal - MG';

          const normCity = normalizeText(cityName);
          const normOrigin = normalizeText(originCity);

          const isAtOrigin = normCity.includes('goiabal') || normCity.includes(normOrigin) || normOrigin.includes(normCity) || normCity === 'municipio detectado';
          const isOutside = !isAtOrigin;

          const nowIso = new Date().toISOString();
          const checkpointObj = {
            cidade: cityName,
            lat,
            lon,
            timestamp: nowIso,
            fora_origem: isOutside
          };

          const existingChecklist = (activeTrip as any).checklist || {};

          try {
            const updated = await updateDiariaEvento(activeTrip.id, {
              ultimo_checkpoint: checkpointObj,
              checklist: { ...existingChecklist, ultimo_checkpoint: checkpointObj }
            } as any);

            // Avisar Service Worker para sincronizar em segundo plano se disponível
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
              navigator.serviceWorker.controller.postMessage({
                type: 'BACKGROUND_CHECKPOINT_UPDATED',
                tripId: activeTrip.id,
                checkpoint: checkpointObj
              });
            }

            // Notificar aplicação React local
            window.dispatchEvent(new CustomEvent('diarias_checkpoint_updated', {
              detail: { tripId: activeTrip.id, checkpoint: checkpointObj }
            }));

            resolve(updated);
          } catch (err) {
            console.warn('Erro ao atualizar checkpoint em 1 minuto:', err);
            resolve(null);
          }
        },
        (err) => {
          console.warn('Falha na leitura de GPS de 1 minuto:', err.message);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 }
      );
    });

  } catch (err) {
    console.warn('Erro na rotina de sincronizacao de checkpoint:', err);
    return null;
  }
};

// Inicializa Rastreamento Global (1 em 1 minuto) usando Web Worker + Geolocation Watch
export const startGlobalLocationTracking = (userId?: string) => {
  if (isTracking) return;
  isTracking = true;

  // Executa sync imediato
  performLocationCheckpointSync(userId);

  // 1. Iniciar Intervalo Principal (1 em 1 minuto = 60.000 ms)
  trackingIntervalId = setInterval(() => {
    performLocationCheckpointSync(userId);
  }, 60000);

  // 2. Geolocation WatchPosition para atualizações contínuas de fundo no SO
  if (typeof window !== 'undefined' && 'geolocation' in navigator) {
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        // Se houver alteração significativa, atualiza o checkpoint
        performLocationCheckpointSync(userId);
      },
      (err) => console.warn('Aviso no WatchPosition global:', err.message),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 }
    );
  }

  // 3. Web Worker em Segundo Plano para prevenir que navegadores façam freeze em background/tela bloqueada
  try {
    const workerCode = `
      let timer = null;
      self.onmessage = function(e) {
        if (e.data === 'start') {
          if (timer) clearInterval(timer);
          timer = setInterval(function() {
            self.postMessage('tick');
          }, 60000);
        } else if (e.data === 'stop') {
          if (timer) clearInterval(timer);
        }
      };
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    backgroundWorker = new Worker(URL.createObjectURL(blob));
    backgroundWorker.onmessage = (e) => {
      if (e.data === 'tick') {
        performLocationCheckpointSync(userId);
      }
    };
    backgroundWorker.postMessage('start');
  } catch (e) {
    console.warn('Web Worker em segundo plano não inicializado:', e);
  }
};

// Para o Rastreamento Global
export const stopGlobalLocationTracking = () => {
  isTracking = false;

  if (trackingIntervalId) {
    clearInterval(trackingIntervalId);
    trackingIntervalId = null;
  }

  if (watchId !== null && typeof window !== 'undefined' && 'geolocation' in navigator) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  if (backgroundWorker) {
    backgroundWorker.postMessage('stop');
    backgroundWorker.terminate();
    backgroundWorker = null;
  }

  releaseWakeLock();
};
