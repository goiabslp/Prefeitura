import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Check, RotateCw, RefreshCw, Eye, Move, Sparkles, 
  ChevronRight, ArrowLeftRight, HelpCircle, Loader2, Maximize2
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

export const DocumentScannerModal: React.FC<DocumentScannerModalProps> = ({
  imageFile,
  onConfirm,
  onCancel
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'adjust' | 'preview'>('adjust');
  const [rotation, setRotation] = useState<number>(0);
  const [filterType, setFilterType] = useState<FilterType>('scanner-color');
  
  // Sliders de ajuste fino
  const [brightness, setBrightness] = useState<number>(0);     // -100 a 100
  const [contrast, setContrast] = useState<number>(0);       // -100 a 100
  const [sharpness, setSharpness] = useState<number>(20);     // 0 a 100

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processedImageSrc, setProcessedImageSrc] = useState<string | null>(null);
  const [processedFile, setProcessedFile] = useState<File | null>(null);

  // Cantos do documento em porcentagem da imagem exibida
  const [corners, setCorners] = useState<Point[]>([
    { x: 10, y: 15 }, // Superior Esquerdo
    { x: 90, y: 15 }, // Superior Direito
    { x: 85, y: 85 }, // Inferior Direito
    { x: 15, y: 85 }  // Inferior Esquerdo
  ]);

  // Estado para alça ativa no drag-and-drop
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [magnifier, setMagnifier] = useState<{ active: boolean; x: number; y: number; px: number; py: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

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
    const img = e.currentTarget;
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
    setCorners([
      { x: 15, y: 15 },
      { x: 85, y: 15 },
      { x: 85, y: 85 },
      { x: 15, y: 85 }
    ]);
  };

  // Resetar cantos
  const handleReset = () => {
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

    setCorners(prev => {
      const next = [...prev];
      next[index] = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
      return next;
    });

    const containerRect = containerRef.current.getBoundingClientRect();
    setMagnifier({
      active: true,
      x: e.clientX - containerRect.left,
      y: e.clientY - containerRect.top - 80,
      px: x,
      py: y
    });
  };

  // Matemática de Homografia
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

  // Processa a imagem (Warp Perspective + Filtros)
  const processImage = async () => {
    const imgElement = imageRef.current;
    if (!imgElement || !imageSrc) return;
    setIsProcessing(true);
    setActiveTab('preview');

    setTimeout(() => {
      try {
        const img = imgElement;
        const natW = img.naturalWidth;
        const natH = img.naturalHeight;

        const rotateCanvas = document.createElement('canvas');
        const rotateCtx = rotateCanvas.getContext('2d');
        if (!rotateCtx) throw new Error('Não foi possível obter contexto 2D.');

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

        const maxResolution = 1800; // Resolução otimizada para iOS/Android
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
        if (!warpCtx) throw new Error('Não foi possível obter contexto do Canvas.');

        const destImageData = warpCtx.createImageData(destW, destH);
        const destData = destImageData.data;

        const srcImageData = rotateCtx.getImageData(0, 0, rotW, rotH);
        const srcData = srcImageData.data;

        // Warp Reverso Bilinear
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

        // Filtros e Ajustes
        const filterCanvas = document.createElement('canvas');
        filterCanvas.width = destW;
        filterCanvas.height = destH;
        const filterCtx = filterCanvas.getContext('2d');
        if (!filterCtx) throw new Error('Não foi possível obter contexto final do Canvas.');

        filterCtx.drawImage(warpCanvas, 0, 0);
        const imgData = filterCtx.getImageData(0, 0, destW, destH);
        const data = imgData.data;

        // Filtro de Flat-field correction para scanner colorido/P&B
        if (filterType === 'scanner-color' || filterType === 'scanner-pb') {
          const smallW = Math.max(32, Math.round(destW / 12));
          const smallH = Math.max(32, Math.round(destH / 12));
          
          const smallCanvas = document.createElement('canvas');
          smallCanvas.width = smallW;
          smallCanvas.height = smallH;
          const smallCtx = smallCanvas.getContext('2d');
          if (smallCtx) {
            smallCtx.drawImage(warpCanvas, 0, 0, smallW, smallH);

            const bgCanvas = document.createElement('canvas');
            bgCanvas.width = destW;
            bgCanvas.height = destH;
            const bgCtx = bgCanvas.getContext('2d');
            if (bgCtx) {
              try {
                bgCtx.filter = 'blur(16px)';
              } catch (e) {
                console.warn('Canvas filter blur não suportado pelo navegador:', e);
              }
              bgCtx.drawImage(smallCanvas, 0, 0, destW, destH);
              
              const bgImageData = bgCtx.getImageData(0, 0, destW, destH);
              const bgData = bgImageData.data;

              for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                const bgR = bgData[i] || 240;
                const bgG = bgData[i + 1] || 240;
                const bgB = bgData[i + 2] || 240;

                let rOut = (r / (bgR / 255)) * 0.93 + r * 0.07;
                let gOut = (g / (bgG / 255)) * 0.93 + g * 0.07;
                let bOut = (b / (bgB / 255)) * 0.93 + b * 0.07;

                if (filterType === 'scanner-pb') {
                  const gray = 0.299 * rOut + 0.587 * gOut + 0.114 * bOut;
                  const threshold = 135;
                  const finalVal = gray > threshold ? 255 : Math.max(0, gray * 0.65);
                  rOut = finalVal;
                  gOut = finalVal;
                  bOut = finalVal;
                } else {
                  const l = 0.299 * rOut + 0.587 * gOut + 0.114 * bOut;
                  if (l > 165) {
                    const factor = (l - 165) / (255 - 165);
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
        } else if (filterType === 'photo-enhanced') {
          for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];

            r = (r - 128) * 1.25 + 128;
            g = (g - 128) * 1.25 + 128;
            b = (b - 128) * 1.25 + 128;

            data[i] = Math.max(0, Math.min(255, r));
            data[i + 1] = Math.max(0, Math.min(255, g));
            data[i + 2] = Math.max(0, Math.min(255, b));
          }
        }

        // Ajustes manuais finos de Brilho & Contraste
        if (brightness !== 0 || contrast !== 0) {
          const bFactor = brightness;
          const cFactor = (contrast + 100) / 100;

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

        // Aumento de nitidez
        if (sharpness > 0) {
          const finalImageData = filterCtx.getImageData(0, 0, destW, destH);
          const finalData = finalImageData.data;
          const sharpData = new Uint8ClampedArray(finalData);

          const w = destW;
          const h = destH;
          const amt = sharpness / 100;

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
                // Fallback para navegadores/WebView do iOS que não suportam o construtor new File com Blobs
                const blobAsFile = blob as any;
                blobAsFile.name = `${nameClean}_digitalizado.jpg`;
                blobAsFile.lastModified = Date.now();
                file = blobAsFile as File;
              }
              
              const newUrl = URL.createObjectURL(file);
              setProcessedImageSrc(newUrl);
              setProcessedFile(file);
            } else {
              alert('Erro ao converter o documento digitalizado.');
            }
            setIsProcessing(false);
          },
          'image/jpeg',
          0.88
        );

      } catch (err) {
        console.error('Erro no processamento da imagem:', err);
        alert('Erro ao processar e digitalizar a imagem.');
        setIsProcessing(false);
      }
    }, 100);
  };

  const handleReprocess = () => {
    setActiveTab('adjust');
    if (processedImageSrc) {
      URL.revokeObjectURL(processedImageSrc);
      setProcessedImageSrc(null);
      setProcessedFile(null);
    }
  };

  const handleConfirm = () => {
    if (processedFile) {
      onConfirm(processedFile);
    }
  };

  if (!imageSrc) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-6 animate-fade-in">
      <div className="w-full max-w-4xl bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 flex flex-col max-h-[95vh] overflow-hidden text-white animate-slide-up">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-100">Digitalizador Inteligente</h3>
              <p className="text-[10px] font-semibold text-slate-400">Conversão de fotos para comprovantes escaneados</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-slate-950 border-b border-slate-800/60 p-1 shrink-0">
          <button
            type="button"
            onClick={handleReprocess}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
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
            onClick={processImage}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
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
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-slate-950/40 relative min-h-[350px]">
          
          {/* Lado Esquerdo */}
          <div className="flex-1 p-4 flex items-center justify-center relative bg-slate-950/70 overflow-hidden select-none">
            {activeTab === 'adjust' && (
              <div 
                ref={containerRef}
                className="relative max-w-full max-h-[55vh] flex items-center justify-center overflow-hidden touch-none"
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
                    maxHeight: '50vh',
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

                {magnifier?.active && imageRef.current && (
                  <div
                    style={{
                      left: `${magnifier.x}px`,
                      top: `${magnifier.y}px`,
                      transform: 'translateX(-50%)'
                    }}
                    className="absolute w-24 h-24 rounded-full border-3 border-white shadow-2xl bg-slate-900 overflow-hidden pointer-events-none z-30"
                  >
                    <img 
                      src={imageSrc}
                      alt="Zoom"
                      style={{
                        position: 'absolute',
                        width: `${imageRef.current.offsetWidth * 2.5}px`,
                        height: `${imageRef.current.offsetHeight * 2.5}px`,
                        left: `-${(magnifier.px / 100) * imageRef.current.offsetWidth * 2.5 - 48}px`,
                        top: `-${(magnifier.py / 100) * imageRef.current.offsetHeight * 2.5 - 48}px`,
                        transform: `rotate(${rotation}deg)`,
                        transformOrigin: `${(magnifier.px / 100) * imageRef.current.offsetWidth * 2.5}px ${(magnifier.py / 100) * imageRef.current.offsetHeight * 2.5}px`
                      }}
                      className="max-none"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-2.5 h-2.5 rounded-full border border-red-500 bg-red-500/20" />
                      <div className="absolute w-full h-px bg-red-500/40" />
                      <div className="absolute h-full w-px bg-red-500/40" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'preview' && (
              <div className="w-full h-full flex flex-col items-center justify-center">
                {isProcessing ? (
                  <div className="flex flex-col items-center gap-4 text-slate-400">
                    <Loader2 className="w-12 h-12 animate-spin text-indigo-500" />
                    <span className="text-xs font-black uppercase tracking-widest animate-pulse">Digitalizando e Otimizando...</span>
                  </div>
                ) : processedImageSrc ? (
                  <div className="relative max-w-full max-h-[52vh] flex items-center justify-center p-1 rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">
                    <img
                      src={processedImageSrc}
                      alt="Digitalizado"
                      className="max-h-[50vh] max-w-full rounded-xl object-contain shadow-2xl"
                    />
                  </div>
                ) : (
                  <div className="text-slate-500 text-xs font-bold uppercase">Nenhum preview gerado</div>
                )}
              </div>
            )}
          </div>

          {/* Lado Direito */}
          <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-slate-800/80 bg-slate-900/90 p-5 flex flex-col justify-between shrink-0 overflow-y-auto">
            <div className="space-y-5">
              {activeTab === 'adjust' ? (
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Ajustes Rápidos</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleRotate}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all border border-slate-700 active:scale-95"
                    >
                      <RotateCw className="w-4 h-4 text-indigo-400" />
                      <span>Girar Imagem</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={handleReset}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all border border-slate-700 active:scale-95"
                    >
                      <RefreshCw className="w-4 h-4 text-slate-400" />
                      <span>Resetar</span>
                    </button>
                  </div>

                  <div className="mt-5 p-3 rounded-2xl bg-indigo-955/20 border border-indigo-500/20">
                    <h5 className="text-[10px] font-black uppercase tracking-wider text-indigo-400 mb-1 flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5" />
                      Como Ajustar?
                    </h5>
                    <p className="text-[9.5px] leading-relaxed text-indigo-300 font-semibold">
                      Mova os 4 círculos azuis até os cantos da folha ou cupom fiscal. O sistema fará o recorte e removerá distorções de perspectiva automaticamente.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Modo do Scanner</h4>
                    <div className="flex flex-col gap-1.5">
                      {[
                        { id: 'scanner-color', label: 'Scanner Colorido', desc: 'Remove sombras e destaca textos/carimbos (Recomendado)' },
                        { id: 'scanner-pb', label: 'Scanner P&B', desc: 'Preto e branco limpo e legível' },
                        { id: 'photo-enhanced', label: 'Foto Aprimorada', desc: 'Apenas melhora de contraste e nitidez' },
                        { id: 'original', label: 'Original', desc: 'Sem alterações de cores' }
                      ].map(f => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => {
                            setFilterType(f.id as FilterType);
                            setTimeout(() => processImage(), 10);
                          }}
                          className={`w-full text-left p-2.5 rounded-xl border transition-all ${
                            filterType === f.id
                              ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                              : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <div className="text-xs font-black uppercase tracking-wider">{f.label}</div>
                          <div className="text-[9px] text-slate-500 font-semibold mt-0.5">{f.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3.5">Filtros Manuais</h4>
                    
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
                        onChange={(e) => setBrightness(parseInt(e.target.value))}
                        onMouseUp={processImage}
                        onTouchEnd={processImage}
                        className="w-full accent-indigo-500 h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer"
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
                        onChange={(e) => setContrast(parseInt(e.target.value))}
                        onMouseUp={processImage}
                        onTouchEnd={processImage}
                        className="w-full accent-indigo-500 h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer"
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
                        onChange={(e) => setSharpness(parseInt(e.target.value))}
                        onMouseUp={processImage}
                        onTouchEnd={processImage}
                        className="w-full accent-indigo-500 h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800/80 flex gap-2">
              {activeTab === 'adjust' ? (
                <>
                  <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-black uppercase tracking-wider rounded-xl transition-all active:scale-95"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={processImage}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <span>Digitalizar</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleReprocess}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1"
                  >
                    <Move className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Ajustar</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={isProcessing || !processedFile}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1 active:scale-95"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Confirmar</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
