import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Check, RotateCw, RefreshCw, Eye, Move, Sparkles, 
  ChevronRight, HelpCircle, Loader2, Maximize2, SlidersHorizontal
} from 'lucide-react';

interface DocumentScannerModalProps {
  imageFile: File;
  onConfirm: (processedFile: File) => void;
  onCancel: () => void;
}

interface Point {
  x: number; // Percentual (0 a 100)
  y: number; // Percentual (0 a 100)
}

type FilterType = 'scanner-color' | 'scanner-pb' | 'photo-enhanced' | 'original';

// Componente de Lupa com Zoom 100% Real baseado em Canvas
interface MagnifierCanvasProps {
  imageSrc: string;
  px: number;
  py: number;
  rotation: number;
}

const MagnifierCanvas: React.FC<MagnifierCanvasProps> = ({ imageSrc, px, py, rotation }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageSrc) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;
    img.onload = () => {
      const size = 140; // Tamanho do canvas da Lupa (140x140)
      canvas.width = size;
      canvas.height = size;

      const natW = img.naturalWidth;
      const natH = img.naturalHeight;
      if (!natW || !natH) return;

      // 1. Renderiza a foto completa rotacionada no canvas temporário
      const rotCanvas = document.createElement('canvas');
      const rotCtx = rotCanvas.getContext('2d');
      if (!rotCtx) return;

      if (rotation === 90 || rotation === 270) {
        rotCanvas.width = natH;
        rotCanvas.height = natW;
      } else {
        rotCanvas.width = natW;
        rotCanvas.height = natH;
      }

      rotCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
      rotCtx.rotate((rotation * Math.PI) / 180);
      rotCtx.drawImage(img, -natW / 2, -natH / 2);

      // Coordenada real em pixels na foto rotacionada
      const realX = (px / 100) * rotCanvas.width;
      const realY = (py / 100) * rotCanvas.height;

      // Janela de amostragem em pixels reais da foto original
      const sampleSize = 100;

      ctx.clearRect(0, 0, size, size);

      // 2. Desenha o trecho ampliado com a mira 100% alinhada
      ctx.drawImage(
        rotCanvas,
        realX - sampleSize / 2,
        realY - sampleSize / 2,
        sampleSize,
        sampleSize,
        0,
        0,
        size,
        size
      );

      // 3. Retículo / Mira centralizada em (size/2, size/2)
      const center = size / 2;

      // Linhas em cruz da mira
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)'; // vermelho nítido
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.moveTo(0, center);
      ctx.lineTo(size, center);
      ctx.moveTo(center, 0);
      ctx.lineTo(center, size);
      ctx.stroke();

      // Círculo central da mira
      ctx.beginPath();
      ctx.arc(center, center, 7, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
      ctx.fill();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.stroke();
    };
  }, [imageSrc, px, py, rotation]);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-full rounded-full"
    />
  );
};

export const DocumentScannerModal: React.FC<DocumentScannerModalProps> = ({
  imageFile,
  onConfirm,
  onCancel
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'adjust' | 'preview'>('adjust');
  const [rotation, setRotation] = useState<number>(0);
  
  // Padrão: Scanner Colorido
  const [filterType, setFilterType] = useState<FilterType>('scanner-color');
  
  // Sliders de ajuste fino
  const [brightness, setBrightness] = useState<number>(0);     // -100 a 100
  const [contrast, setContrast] = useState<number>(0);       // -100 a 100
  const [sharpness, setSharpness] = useState<number>(20);     // 0 a 100

  // Estado para exibir o painel retrátil de ajustes finos/filtros
  const [showAdjustDrawer, setShowAdjustDrawer] = useState<boolean>(false);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processedImageSrc, setProcessedImageSrc] = useState<string | null>(null);
  const [processedFile, setProcessedFile] = useState<File | null>(null);

  // Cantos do documento em porcentagem da imagem exibida
  const [corners, setCorners] = useState<Point[]>([
    { x: 10, y: 15 },
    { x: 90, y: 15 },
    { x: 85, y: 85 },
    { x: 15, y: 85 }
  ]);

  // Estado para alça ativa no drag-and-drop
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [magnifier, setMagnifier] = useState<{ active: boolean; x: number; y: number; px: number; py: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const warpedCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Carrega imagem de entrada
  useEffect(() => {
    if (!imageFile) return;
    const url = URL.createObjectURL(imageFile);
    setImageSrc(url);
    return () => {
      URL.revokeObjectURL(url);
      if (processedImageSrc) {
        URL.revokeObjectURL(processedImageSrc);
      }
    };
  }, [imageFile]);

  // Tenta estimar as bordas de forma simplificada ao carregar a imagem
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setCorners([
      { x: 12, y: 12 },
      { x: 88, y: 14 },
      { x: 86, y: 88 },
      { x: 14, y: 86 }
    ]);
  };

  // Girar imagem original
  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
    warpedCanvasRef.current = null;
    setCorners([
      { x: 15, y: 15 },
      { x: 85, y: 15 },
      { x: 85, y: 85 },
      { x: 15, y: 85 }
    ]);
  };

  // Resetar cantos
  const handleReset = () => {
    warpedCanvasRef.current = null;
    setCorners([
      { x: 10, y: 15 },
      { x: 90, y: 15 },
      { x: 85, y: 85 },
      { x: 15, y: 85 }
    ]);
  };

  // Métodos para arrastar alças (Suporte a Touch e Mouse)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingIndex(index);
    updateDragPosition(e, index);
    if (containerRef.current) {
      containerRef.current.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingIndex === null || !containerRef.current || !imageRef.current) return;
    e.preventDefault();
    updateDragPosition(e, draggingIndex);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingIndex !== null) {
      if (containerRef.current) {
        try {
          containerRef.current.releasePointerCapture(e.pointerId);
        } catch (err) {}
      }
      setDraggingIndex(null);
      setMagnifier(null);
    }
  };

  const updateDragPosition = (e: React.PointerEvent<HTMLDivElement>, index: number) => {
    if (!containerRef.current || !imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - rect.top) / rect.height) * 100;

    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));

    warpedCanvasRef.current = null; // invalida cache ao mover cantos

    setCorners(prev => {
      const next = [...prev];
      next[index] = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
      return next;
    });

    const containerRect = containerRef.current.getBoundingClientRect();
    setMagnifier({
      active: true,
      x: e.clientX - containerRect.left,
      y: e.clientY - containerRect.top - 15,
      px: x,
      py: y
    });
  };

  // Matemática de Homografia (Eliminação de Gauss)
  const solveHomography = (
    src: { x: number; y: number }[],
    dst: { x: number; y: number }[]
  ): number[] => {
    const a: number[][] = [];
    for (let i = 0; i < 4; i++) {
      a.push([src[i].x, src[i].y, 1, 0, 0, 0, -src[i].x * dst[i].x, -src[i].y * dst[i].x, dst[i].x]);
      a.push([0, 0, 0, src[i].x, src[i].y, 1, -src[i].x * dst[i].y, -src[i].y * dst[i].y, dst[i].y]);
    }

    const n = 8;
    for (let i = 0; i < n; i++) {
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(a[k][i]) > Math.abs(a[maxRow][i])) {
          maxRow = k;
        }
      }

      const temp = a[i];
      a[i] = a[maxRow];
      a[maxRow] = temp;

      for (let k = i + 1; k < n; k++) {
        const c = -a[k][i] / a[i][i];
        for (let j = i; j <= n; j++) {
          if (i === j) {
            a[k][j] = 0;
          } else {
            a[k][j] += c * a[i][j];
          }
        }
      }
    }

    const coeffs = new Array(8).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      coeffs[i] = a[i][n];
      for (let j = i + 1; j < n; j++) {
        coeffs[i] -= a[i][j] * coeffs[j];
      }
      coeffs[i] /= a[i][i];
    }

    return coeffs;
  };

  // Etapa 1: Retificação de Homografia Projetiva (Gera warpedCanvasRef)
  const renderWarpedDocument = (): HTMLCanvasElement | null => {
    const img = imageRef.current;
    if (!img || !imageSrc) return null;

    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    if (!natW || !natH) return null;

    const rotateCanvas = document.createElement('canvas');
    const rotateCtx = rotateCanvas.getContext('2d');
    if (!rotateCtx) return null;

    if (rotation === 90 || rotation === 270) {
      rotateCanvas.width = natH;
      rotateCanvas.height = natW;
    } else {
      rotateCanvas.width = natW;
      rotateCanvas.height = natH;
    }

    rotateCtx.translate(rotateCanvas.width / 2, rotateCanvas.height / 2);
    rotateCtx.rotate((rotation * Math.PI) / 180);
    rotateCtx.drawImage(img, -natW / 2, -natH / 2);
    rotateCtx.setTransform(1, 0, 0, 1, 0, 0);

    const rotW = rotateCanvas.width;
    const rotH = rotateCanvas.height;

    const srcPoints = corners.map(pt => ({
      x: (pt.x / 100) * rotW,
      y: (pt.y / 100) * rotH
    }));

    const dist = (p1: { x: number; y: number }, p2: { x: number; y: number }) => 
      Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);

    const wTop = dist(srcPoints[0], srcPoints[1]);
    const wBottom = dist(srcPoints[3], srcPoints[2]);
    const hLeft = dist(srcPoints[0], srcPoints[3]);
    const hRight = dist(srcPoints[1], srcPoints[2]);

    let destW = Math.round((wTop + wBottom) / 2);
    let destH = Math.round((hLeft + hRight) / 2);

    const maxResolution = 1800;
    if (destW > maxResolution || destH > maxResolution) {
      const ratio = Math.min(maxResolution / destW, maxResolution / destH);
      destW = Math.round(destW * ratio);
      destH = Math.round(destH * ratio);
    }

    destW = Math.max(100, destW);
    destH = Math.max(100, destH);

    const destPoints = [
      { x: 0, y: 0 },
      { x: destW, y: 0 },
      { x: destW, y: destH },
      { x: 0, y: destH }
    ];

    const coeffs = solveHomography(destPoints, srcPoints);
    const [A, B, C, D, E, F, G, H] = coeffs;

    const warpCanvas = document.createElement('canvas');
    warpCanvas.width = destW;
    warpCanvas.height = destH;
    const warpCtx = warpCanvas.getContext('2d');
    if (!warpCtx) return null;

    const destImageData = warpCtx.createImageData(destW, destH);
    const destData = destImageData.data;

    const srcImageData = rotateCtx.getImageData(0, 0, rotW, rotH);
    const srcData = srcImageData.data;

    for (let y = 0; y < destH; y++) {
      for (let x = 0; x < destW; x++) {
        const denom = G * x + H * y + 1;
        const u = (A * x + B * y + C) / denom;
        const v = (D * x + E * y + F) / denom;

        const destIdx = (y * destW + x) * 4;

        if (u < 0 || u >= rotW - 1 || v < 0 || v >= rotH - 1) {
          destData[destIdx] = 255;
          destData[destIdx + 1] = 255;
          destData[destIdx + 2] = 255;
          destData[destIdx + 3] = 255;
          continue;
        }

        const u0 = Math.floor(u);
        const u1 = u0 + 1;
        const v0 = Math.floor(v);
        const v1 = v0 + 1;

        const du = u - u0;
        const dv = v - v0;

        const w00 = (1 - du) * (1 - dv);
        const w10 = du * (1 - dv);
        const w01 = (1 - du) * dv;
        const w11 = du * dv;

        for (let channel = 0; channel < 4; channel++) {
          const val = 
            w00 * srcData[(v0 * rotW + u0) * 4 + channel] +
            w10 * srcData[(v0 * rotW + u1) * 4 + channel] +
            w01 * srcData[(v1 * rotW + u0) * 4 + channel] +
            w11 * srcData[(v1 * rotW + u1) * 4 + channel];

          destData[destIdx + channel] = Math.round(val);
        }
      }
    }

    warpCtx.putImageData(destImageData, 0, 0);
    warpedCanvasRef.current = warpCanvas;
    return warpCanvas;
  };

  // Etapa 2: Aplicação de Filtros e Sliders em Tempo Real no Canvas Retificado
  const applyFiltersAndRender = (
    fType = filterType,
    bVal = brightness,
    cVal = contrast,
    sVal = sharpness
  ) => {
    let baseCanvas = warpedCanvasRef.current;
    if (!baseCanvas) {
      baseCanvas = renderWarpedDocument();
    }
    if (!baseCanvas) return;

    setIsProcessing(true);

    setTimeout(() => {
      try {
        const destW = baseCanvas!.width;
        const destH = baseCanvas!.height;

        const filterCanvas = document.createElement('canvas');
        filterCanvas.width = destW;
        filterCanvas.height = destH;
        const filterCtx = filterCanvas.getContext('2d');
        if (!filterCtx) throw new Error('Não foi possível obter contexto final.');

        filterCtx.drawImage(baseCanvas!, 0, 0);
        const imgData = filterCtx.getImageData(0, 0, destW, destH);
        const data = imgData.data;

        // FILTROS DE SCANNER E REMOÇÃO DE SOMBRAS
        if (fType === 'scanner-color' || fType === 'scanner-pb') {
          const cleanCanvas = document.createElement('canvas');
          cleanCanvas.width = destW;
          cleanCanvas.height = destH;
          const cleanCtx = cleanCanvas.getContext('2d');
          if (cleanCtx) {
            cleanCtx.drawImage(baseCanvas!, 0, 0);
            const cleanImgData = cleanCtx.getImageData(0, 0, destW, destH);
            const cleanData = cleanImgData.data;

            for (let i = 0; i < cleanData.length; i += 4) {
              const lum = 0.299 * cleanData[i] + 0.587 * cleanData[i + 1] + 0.114 * cleanData[i + 2];
              if (lum < 165) {
                cleanData[i] = 255;
                cleanData[i + 1] = 255;
                cleanData[i + 2] = 255;
              }
            }
            cleanCtx.putImageData(cleanImgData, 0, 0);

            const smallW = Math.max(24, Math.round(destW / 16));
            const smallH = Math.max(24, Math.round(destH / 16));

            const smallCanvas = document.createElement('canvas');
            smallCanvas.width = smallW;
            smallCanvas.height = smallH;
            const smallCtx = smallCanvas.getContext('2d');
            if (smallCtx) {
              smallCtx.imageSmoothingEnabled = true;
              smallCtx.imageSmoothingQuality = 'high';
              smallCtx.drawImage(cleanCanvas, 0, 0, smallW, smallH);

              const bgCanvas = document.createElement('canvas');
              bgCanvas.width = destW;
              bgCanvas.height = destH;
              const bgCtx = bgCanvas.getContext('2d');
              if (bgCtx) {
                bgCtx.imageSmoothingEnabled = true;
                bgCtx.imageSmoothingQuality = 'high';
                try {
                  bgCtx.filter = 'blur(12px)';
                } catch (e) {}
                bgCtx.drawImage(smallCanvas, 0, 0, destW, destH);

                const bgImageData = bgCtx.getImageData(0, 0, destW, destH);
                const bgData = bgImageData.data;

                for (let i = 0; i < data.length; i += 4) {
                  const r = data[i];
                  const g = data[i + 1];
                  const b = data[i + 2];

                  const bgR = Math.max(100, bgData[i]);
                  const bgG = Math.max(100, bgData[i + 1]);
                  const bgB = Math.max(100, bgData[i + 2]);

                  let rOut = (r / (bgR / 255)) * 0.95 + r * 0.05;
                  let gOut = (g / (bgG / 255)) * 0.95 + g * 0.05;
                  let bOut = (b / (bgB / 255)) * 0.95 + b * 0.05;

                  if (fType === 'scanner-pb') {
                    const gray = 0.299 * rOut + 0.587 * gOut + 0.114 * bOut;
                    const threshold = 140;
                    const finalVal = gray > threshold ? 255 : Math.max(0, gray * 0.6);
                    rOut = finalVal;
                    gOut = finalVal;
                    bOut = finalVal;
                  } else {
                    const l = 0.299 * rOut + 0.587 * gOut + 0.114 * bOut;
                    if (l > 175) {
                      const factor = (l - 175) / (255 - 175);
                      rOut = rOut + (255 - rOut) * factor;
                      gOut = gOut + (255 - gOut) * factor;
                      bOut = bOut + (255 - bOut) * factor;
                    }
                  }

                  data[i] = Math.max(0, Math.min(255, rOut));
                  data[i + 1] = Math.max(0, Math.min(255, gOut));
                  data[i + 2] = Math.max(0, Math.min(255, bOut));
                }
              }
            }
          }
        } else if (fType === 'photo-enhanced') {
          for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];

            r = (r - 128) * 1.3 + 128;
            g = (g - 128) * 1.3 + 128;
            b = (b - 128) * 1.3 + 128;

            data[i] = Math.max(0, Math.min(255, r));
            data[i + 1] = Math.max(0, Math.min(255, g));
            data[i + 2] = Math.max(0, Math.min(255, b));
          }
        }

        // SLIDERS: BRILHO & CONTRASTE
        if (bVal !== 0 || cVal !== 0) {
          const bFactor = bVal;
          const cFactor = (cVal + 100) / 100;

          for (let i = 0; i < data.length; i += 4) {
            for (let c = 0; c < 3; c++) {
              let val = data[i + c];
              val += bFactor;
              val = (val - 128) * cFactor + 128;
              data[i + c] = Math.max(0, Math.min(255, val));
            }
          }
        }

        filterCtx.putImageData(imgData, 0, 0);

        // SLIDERS: NITIDEZ
        if (sVal > 0) {
          const finalImageData = filterCtx.getImageData(0, 0, destW, destH);
          const finalData = finalImageData.data;
          const sharpData = new Uint8ClampedArray(finalData);

          const w = destW;
          const h = destH;
          const amt = sVal / 100;

          for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
              const idx = (y * w + x) * 4;

              for (let c = 0; c < 3; c++) {
                const centerVal = sharpData[idx + c];
                const sumNeighbors = 
                  sharpData[((y - 1) * w + x) * 4 + c] +
                  sharpData[(y * w + x - 1) * 4 + c] +
                  sharpData[(y * w + x + 1) * 4 + c] +
                  sharpData[((y + 1) * w + x) * 4 + c];

                const sharpened = 5 * centerVal - sumNeighbors;
                const blended = centerVal + (sharpened - centerVal) * amt;
                finalData[idx + c] = Math.max(0, Math.min(255, blended));
              }
            }
          }
          filterCtx.putImageData(finalImageData, 0, 0);
        }

        // Exportação em Blob/File
        filterCanvas.toBlob(
          (blob) => {
            if (blob) {
              const nameClean = imageFile.name ? imageFile.name.replace(/\.[^/.]+$/, "") : 'comprovante';
              let file: File;
              try {
                file = new File([blob], `${nameClean}_digitalizado.jpg`, {
                  type: 'image/jpeg',
                  lastModified: Date.now()
                });
              } catch (e) {
                const blobAsFile = blob as any;
                blobAsFile.name = `${nameClean}_digitalizado.jpg`;
                blobAsFile.lastModified = Date.now();
                file = blobAsFile as File;
              }
              
              if (processedImageSrc) {
                URL.revokeObjectURL(processedImageSrc);
              }
              const newUrl = URL.createObjectURL(file);
              setProcessedImageSrc(newUrl);
              setProcessedFile(file);
            }
            setIsProcessing(false);
          },
          'image/jpeg',
          0.88
        );
      } catch (err) {
        console.error('Erro nos filtros:', err);
        setIsProcessing(false);
      }
    }, 40);
  };

  // Transição para aba de preview
  const handleDigitalize = () => {
    warpedCanvasRef.current = null;
    setActiveTab('preview');
    applyFiltersAndRender('scanner-color', brightness, contrast, sharpness);
  };

  const handleReprocess = () => {
    setActiveTab('adjust');
  };

  const handleConfirm = () => {
    if (processedFile) {
      onConfirm(processedFile);
    }
  };

  if (!imageSrc) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-2 sm:p-4 animate-fade-in">
      <div className="w-full max-w-5xl bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 flex flex-col max-h-[94vh] overflow-hidden text-white animate-slide-up relative">
        
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-100">Digitalizador Inteligente</h3>
              <p className="text-[10px] font-semibold text-slate-400">Comprovante de Despesa (Scanner Colorido Padrão)</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'preview' && (
              <button
                type="button"
                onClick={() => setShowAdjustDrawer(prev => !prev)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                  showAdjustDrawer
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
                <span>Opções & Ajustes</span>
              </button>
            )}

            <button
              type="button"
              onClick={onCancel}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-slate-950 border-b border-slate-800/60 p-1 shrink-0">
          <button
            type="button"
            onClick={handleReprocess}
            className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              activeTab === 'adjust'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Maximize2 className="w-4 h-4 text-indigo-400" />
            <span>1. Ajustar Bordas</span>
          </button>
          
          <button
            type="button"
            onClick={handleDigitalize}
            className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              activeTab === 'preview'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            ) : (
              <Eye className="w-4 h-4 text-emerald-400" />
            )}
            <span>2. Visualizar Resultado</span>
          </button>
        </div>

        {/* Conteúdo Principal */}
        <div className="flex-1 overflow-hidden flex flex-col bg-slate-950/40 relative min-h-[400px]">
          
          {/* Área Visual Centralizada e Expandida */}
          <div className="flex-1 p-3 sm:p-5 flex items-center justify-center relative bg-slate-950/70 overflow-hidden select-none">
            
            {/* TELA 1: AJUSTE DE BORDAS */}
            <div 
              ref={containerRef}
              style={{ display: activeTab === 'adjust' ? 'flex' : 'none' }}
              className="relative max-w-full max-h-[72vh] items-center justify-center overflow-hidden touch-none"
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              <img
                ref={imageRef}
                src={imageSrc}
                alt="Original"
                onLoad={handleImageLoad}
                style={{
                  transform: `rotate(${rotation}deg)`,
                  maxHeight: '68vh',
                  maxWidth: '100%',
                  objectFit: 'contain'
                }}
                className="pointer-events-none transition-transform duration-200"
              />

              {imageRef.current && (
                <svg 
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{
                    left: imageRef.current.offsetLeft,
                    top: imageRef.current.offsetTop,
                    width: imageRef.current.offsetWidth,
                    height: imageRef.current.offsetHeight
                  }}
                >
                  <polygon
                    points={corners.map(c => `${(c.x / 100) * imageRef.current!.offsetWidth},${(c.y / 100) * imageRef.current!.offsetHeight}`).join(' ')}
                    fill="rgba(79, 70, 229, 0.15)"
                    stroke="rgba(99, 102, 241, 0.8)"
                    strokeWidth="2.5"
                  />
                </svg>
              )}

              {imageRef.current && corners.map((pt, idx) => (
                <div
                  key={idx}
                  onPointerDown={(e) => handlePointerDown(e, idx)}
                  style={{
                    left: `${imageRef.current.offsetLeft + (pt.x / 100) * imageRef.current.offsetWidth}px`,
                    top: `${imageRef.current.offsetTop + (pt.y / 100) * imageRef.current.offsetHeight}px`,
                    transform: 'translate(-50%, -50%)'
                  }}
                  className="absolute w-8 h-8 flex items-center justify-center cursor-crosshair z-20 touch-none"
                >
                  <div className="w-5.5 h-5.5 rounded-full bg-white border-2 border-indigo-600 shadow-lg flex items-center justify-center active:scale-125 transition-transform">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                  </div>
                </div>
              ))}

              {/* Lupa de Precisão Zoom 100% Real em Canvas */}
              {magnifier?.active && imageSrc && (
                <div
                  style={{
                    left: `${magnifier.x}px`,
                    top: `${magnifier.y}px`,
                    transform: 'translate(-50%, -100%)'
                  }}
                  className="absolute w-36 h-36 rounded-full border-3 border-white shadow-2xl bg-slate-900 overflow-hidden pointer-events-none z-30 p-0.5"
                >
                  <MagnifierCanvas 
                    imageSrc={imageSrc}
                    px={magnifier.px}
                    py={magnifier.py}
                    rotation={rotation}
                  />
                </div>
              )}
            </div>

            {/* TELA 2: PREVIEW DE DIGITALIZAÇÃO (AMPLIADO EM 45%) */}
            {activeTab === 'preview' && (
              <div className="w-full h-full flex flex-col items-center justify-center relative">
                {isProcessing ? (
                  <div className="flex flex-col items-center gap-4 text-slate-400">
                    <Loader2 className="w-14 h-14 animate-spin text-indigo-500" />
                    <span className="text-xs font-black uppercase tracking-widest animate-pulse">Digitalizando em Scanner Colorido...</span>
                  </div>
                ) : processedImageSrc ? (
                  <div className="relative max-w-full max-h-[72vh] flex items-center justify-center p-1.5 rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl">
                    <img
                      src={processedImageSrc}
                      alt="Comprovante Digitalizado"
                      style={{ maxHeight: '70vh' }}
                      className="max-w-full rounded-xl object-contain shadow-2xl transition-all"
                    />
                  </div>
                ) : (
                  <div className="text-slate-500 text-xs font-bold uppercase">Nenhum preview gerado</div>
                )}
              </div>
            )}

            {/* DRAWER / PAINEL RETRÁTIL DE OPÇÕES E AJUSTES */}
            {activeTab === 'preview' && showAdjustDrawer && (
              <div className="absolute right-3 top-3 bottom-3 w-80 bg-slate-900/95 backdrop-blur-2xl border border-slate-700 shadow-2xl rounded-2xl p-5 z-40 flex flex-col justify-between overflow-y-auto animate-fade-in">
                <div className="space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-200">Filtros & Ajustes Finos</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAdjustDrawer(false)}
                      className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Seleção do Modo de Scanner */}
                  <div>
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Modo do Documento</h5>
                    <div className="flex flex-col gap-1.5">
                      {[
                        { id: 'scanner-color', label: 'Scanner Colorido', desc: 'Remove sombras e destaca textos (Padrão)' },
                        { id: 'scanner-pb', label: 'Scanner P&B', desc: 'Preto e branco limpo e nítido' },
                        { id: 'photo-enhanced', label: 'Foto Aprimorada', desc: 'Melhora de contraste e nitidez' },
                        { id: 'original', label: 'Foto Original', desc: 'Sem alteração de cores' }
                      ].map(f => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => {
                            const newType = f.id as FilterType;
                            setFilterType(newType);
                            applyFiltersAndRender(newType, brightness, contrast, sharpness);
                          }}
                          className={`w-full text-left p-2.5 rounded-xl border transition-all ${
                            filterType === f.id
                              ? 'bg-indigo-600/25 border-indigo-500 text-indigo-300 font-bold'
                              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <div className="text-xs font-black uppercase tracking-wider flex items-center justify-between">
                            <span>{f.label}</span>
                            {filterType === f.id && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                          </div>
                          <div className="text-[9px] text-slate-500 font-semibold mt-0.5">{f.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sliders de Contraste / Brilho / Nitidez */}
                  <div>
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Ajustes Manuais</h5>
                    
                    <div className="space-y-1 mb-3">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                        <span>Brilho</span>
                        <span className="font-mono text-indigo-400">{brightness > 0 ? `+${brightness}` : brightness}</span>
                      </div>
                      <input 
                        type="range" 
                        min="-60" 
                        max="60" 
                        value={brightness} 
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setBrightness(val);
                          applyFiltersAndRender(filterType, val, contrast, sharpness);
                        }}
                        className="w-full accent-indigo-500 h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1 mb-3">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                        <span>Contraste</span>
                        <span className="font-mono text-indigo-400">{contrast > 0 ? `+${contrast}` : contrast}</span>
                      </div>
                      <input 
                        type="range" 
                        min="-60" 
                        max="60" 
                        value={contrast} 
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setContrast(val);
                          applyFiltersAndRender(filterType, brightness, val, sharpness);
                        }}
                        className="w-full accent-indigo-500 h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                        <span>Nitidez do Texto</span>
                        <span className="font-mono text-indigo-400">{sharpness}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={sharpness} 
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setSharpness(val);
                          applyFiltersAndRender(filterType, brightness, contrast, val);
                        }}
                        className="w-full accent-indigo-500 h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAdjustDrawer(false)}
                  className="w-full py-2.5 mt-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg"
                >
                  Concluir Ajustes
                </button>
              </div>
            )}

          </div>

          {/* Bar de Controles Inferior */}
          <div className="px-6 py-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
            {activeTab === 'adjust' ? (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRotate}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all border border-slate-700"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Girar</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all border border-slate-700"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                    <span>Resetar</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-black uppercase tracking-wider rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleDigitalize}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 active:scale-95"
                  >
                    <span>Digitalizar</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full">
                <button
                  type="button"
                  onClick={handleReprocess}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-black uppercase tracking-wider rounded-xl transition-all"
                >
                  <Move className="w-4 h-4 text-indigo-400" />
                  <span>Ajustar Bordas</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAdjustDrawer(prev => !prev)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                      showAdjustDrawer
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg'
                        : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                    }`}
                  >
                    <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
                    <span>Filtros / Ajustes</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={isProcessing || !processedFile}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 active:scale-95"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Confirmar Documento</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
