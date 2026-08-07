import React, { useState, useEffect, useRef } from 'react';
import { Crop, RotateCw, ZoomIn, ZoomOut, Check, X, RefreshCw, Scissors, Maximize2 } from 'lucide-react';

interface ImageCropModalProps {
  imageFile?: File | null;
  imageUrl?: string | null;
  onConfirm: (croppedFile: File) => void;
  onCancel: () => void;
}

type AspectRatio = 'free' | '1:1' | '3:4' | '4:3' | '16:9';

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  imageFile,
  imageUrl,
  onConfirm,
  onCancel
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [rotation, setRotation] = useState<number>(0);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('free');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Normalized crop rectangle in percentage (0 to 100)
  const [crop, setCrop] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 5,
    y: 5,
    width: 90,
    height: 90
  });

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; cropX: number; cropY: number; cropW: number; cropH: number }>({
    x: 0,
    y: 0,
    cropX: 5,
    cropY: 5,
    cropW: 90,
    cropH: 90
  });

  useEffect(() => {
    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      setImageSrc(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else if (imageUrl) {
      setImageSrc(imageUrl);
    }
  }, [imageFile, imageUrl]);

  // Adjust aspect ratio presets
  const applyAspectRatio = (ratio: AspectRatio) => {
    setAspectRatio(ratio);
    if (ratio === 'free') return;

    let targetRatio = 1;
    if (ratio === '1:1') targetRatio = 1;
    if (ratio === '3:4') targetRatio = 3 / 4;
    if (ratio === '4:3') targetRatio = 4 / 3;
    if (ratio === '16:9') targetRatio = 16 / 9;

    const currentW = crop.width;
    const newH = Math.min(90, Math.max(10, currentW / targetRatio));
    const newW = Math.min(90, newH * targetRatio);

    setCrop(prev => ({
      ...prev,
      width: Math.round(newW),
      height: Math.round(newH),
      x: Math.min(prev.x, 100 - newW),
      y: Math.min(prev.y, 100 - newH)
    }));
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleReset = () => {
    setRotation(0);
    setAspectRatio('free');
    setCrop({ x: 5, y: 5, width: 90, height: 90 });
  };

  // Pointer Down event (Mouse & Touch)
  const handlePointerDown = (e: React.PointerEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setActiveHandle(handle);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      cropX: crop.x,
      cropY: crop.y,
      cropW: crop.width,
      cropH: crop.height
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  // Pointer Move event
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();

    const rect = containerRef.current.getBoundingClientRect();
    const deltaXPercent = ((e.clientX - dragStart.x) / rect.width) * 100;
    const deltaYPercent = ((e.clientY - dragStart.y) / rect.height) * 100;

    setCrop(prev => {
      let newX = prev.x;
      let newY = prev.y;
      let newW = prev.width;
      let newH = prev.height;

      if (activeHandle === 'move') {
        newX = Math.max(0, Math.min(100 - prev.width, dragStart.cropX + deltaXPercent));
        newY = Math.max(0, Math.min(100 - prev.height, dragStart.cropY + deltaYPercent));
      } else {
        if (activeHandle?.includes('w')) {
          const possibleW = Math.max(10, dragStart.cropW - deltaXPercent);
          const possibleX = dragStart.cropX + (dragStart.cropW - possibleW);
          if (possibleX >= 0 && possibleW >= 10) {
            newX = possibleX;
            newW = possibleW;
          }
        }
        if (activeHandle?.includes('e')) {
          newW = Math.max(10, Math.min(100 - dragStart.cropX, dragStart.cropW + deltaXPercent));
        }
        if (activeHandle?.includes('n')) {
          const possibleH = Math.max(10, dragStart.cropH - deltaYPercent);
          const possibleY = dragStart.cropY + (dragStart.cropH - possibleH);
          if (possibleY >= 0 && possibleH >= 10) {
            newY = possibleY;
            newH = possibleH;
          }
        }
        if (activeHandle?.includes('s')) {
          newH = Math.max(10, Math.min(100 - dragStart.cropY, dragStart.cropH + deltaYPercent));
        }
      }

      return {
        x: Math.round(newX * 10) / 10,
        y: Math.round(newY * 10) / 10,
        width: Math.round(newW * 10) / 10,
        height: Math.round(newH * 10) / 10
      };
    });
  };

  // Pointer Up event
  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      setActiveHandle(null);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (err) {}
    }
  };

  // Generate Cropped Image File on HTML5 Canvas
  const handleCropConfirm = async () => {
    if (!imageRef.current || !imageSrc) return;
    setIsProcessing(true);

    try {
      const img = imageRef.current;
      const naturalW = img.naturalWidth;
      const naturalH = img.naturalHeight;

      // Off-screen canvas for full rotated image
      const rotateCanvas = document.createElement('canvas');
      const rotateCtx = rotateCanvas.getContext('2d');
      if (!rotateCtx) throw new Error('Canvas 2D Context indisponível.');

      if (rotation === 90 || rotation === 270) {
        rotateCanvas.width = naturalH;
        rotateCanvas.height = naturalW;
      } else {
        rotateCanvas.width = naturalW;
        rotateCanvas.height = naturalH;
      }

      rotateCtx.translate(rotateCanvas.width / 2, rotateCanvas.height / 2);
      rotateCtx.rotate((rotation * Math.PI) / 180);
      rotateCtx.drawImage(img, -naturalW / 2, -naturalH / 2);

      // Crop coordinates relative to rotated canvas
      const cropPixelX = (crop.x / 100) * rotateCanvas.width;
      const cropPixelY = (crop.y / 100) * rotateCanvas.height;
      const cropPixelW = (crop.width / 100) * rotateCanvas.width;
      const cropPixelH = (crop.height / 100) * rotateCanvas.height;

      // Final canvas for cropped output
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = Math.max(1, cropPixelW);
      finalCanvas.height = Math.max(1, cropPixelH);
      const finalCtx = finalCanvas.getContext('2d');
      if (!finalCtx) throw new Error('Canvas 2D Context indisponível.');

      finalCtx.drawImage(
        rotateCanvas,
        cropPixelX,
        cropPixelY,
        cropPixelW,
        cropPixelH,
        0,
        0,
        cropPixelW,
        cropPixelH
      );

      finalCanvas.toBlob(
        (blob) => {
          if (blob) {
            const fileName = imageFile?.name ? imageFile.name.replace(/\.[^/.]+$/, "") + "_cropped.jpg" : `foto_veiculo_cortada_${Date.now()}.jpg`;
            const croppedFile = new File([blob], fileName, { type: 'image/jpeg', lastModified: Date.now() });
            onConfirm(croppedFile);
          } else {
            alert('Falha ao processar recorte da imagem.');
          }
          setIsProcessing(false);
        },
        'image/jpeg',
        0.92
      );
    } catch (err) {
      console.error('Erro ao recortar imagem:', err);
      alert('Erro ao aplicar o corte na imagem.');
      setIsProcessing(false);
    }
  };

  if (!imageSrc) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-6 animate-fade-in">
      <div className="w-full max-w-2xl bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 flex flex-col max-h-[95vh] overflow-hidden text-white animate-slide-up">
        
        {/* Header do Modal */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-100">Cortar e Editar Comprovante</h3>
              <p className="text-[10px] font-semibold text-slate-400">Ajuste as bordas da imagem antes de salvar</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar de Ajustes */}
        <div className="px-5 py-2.5 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
          {/* Proporções (Aspect Ratios) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 mr-1 hidden sm:inline">Proporção:</span>
            {(['free', '1:1', '3:4', '4:3', '16:9'] as AspectRatio[]).map(ratio => (
              <button
                key={ratio}
                type="button"
                onClick={() => applyAspectRatio(ratio)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
                  aspectRatio === ratio
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {ratio === 'free' ? 'Livre' : ratio === '3:4' ? '3:4 (Cupom)' : ratio}
              </button>
            ))}
          </div>

          {/* Botões de Ação Rápida */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleRotate}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold transition-all border border-slate-700"
              title="Girar 90°"
            >
              <RotateCw className="w-3.5 h-3.5 text-indigo-400" />
              <span>Girar</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-all border border-slate-700"
              title="Resetar Enquadramento"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Área Principal de Enquadramento e Corte */}
        <div className="flex-1 p-4 overflow-hidden flex items-center justify-center bg-slate-950/60 relative min-h-[300px] select-none">
          <div 
            ref={containerRef}
            className="relative max-w-full max-h-[55vh] flex items-center justify-center overflow-hidden touch-none"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {/* Imagem a ser recortada */}
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Visualização do comprovante"
              style={{
                transform: `rotate(${rotation}deg)`,
                maxHeight: '52vh',
                maxWidth: '100%',
                objectFit: 'contain'
              }}
              className="pointer-events-none transition-transform duration-200"
            />

            {/* Overlay da caixa de corte */}
            <div
              style={{
                left: `${crop.x}%`,
                top: `${crop.y}%`,
                width: `${crop.width}%`,
                height: `${crop.height}%`
              }}
              className="absolute border-2 border-indigo-400 bg-indigo-500/10 shadow-[0_0_0_9999px_rgba(15,23,42,0.7)] cursor-move transition-none"
              onPointerDown={(e) => handlePointerDown(e, 'move')}
            >
              {/* Grade visual guia 3x3 */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none border border-white/20">
                <div className="border-r border-b border-white/15"></div>
                <div className="border-r border-b border-white/15"></div>
                <div className="border-b border-white/15"></div>
                <div className="border-r border-b border-white/15"></div>
                <div className="border-r border-b border-white/15"></div>
                <div className="border-b border-white/15"></div>
                <div className="border-r border-white/15"></div>
                <div className="border-r border-white/15"></div>
                <div></div>
              </div>

              {/* Alças de Redimensionamento (Handles) */}
              <div 
                className="absolute -top-2 -left-2 w-4 h-4 bg-indigo-500 border-2 border-white rounded-full cursor-nwse-resize shadow-md"
                onPointerDown={(e) => handlePointerDown(e, 'nw')}
              />
              <div 
                className="absolute -top-2 -right-2 w-4 h-4 bg-indigo-500 border-2 border-white rounded-full cursor-nesw-resize shadow-md"
                onPointerDown={(e) => handlePointerDown(e, 'ne')}
              />
              <div 
                className="absolute -bottom-2 -left-2 w-4 h-4 bg-indigo-500 border-2 border-white rounded-full cursor-nesw-resize shadow-md"
                onPointerDown={(e) => handlePointerDown(e, 'sw')}
              />
              <div 
                className="absolute -bottom-2 -right-2 w-4 h-4 bg-indigo-500 border-2 border-white rounded-full cursor-nwse-resize shadow-md"
                onPointerDown={(e) => handlePointerDown(e, 'se')}
              />
            </div>
          </div>
        </div>

        {/* Rodapé de Ações */}
        <div className="px-5 py-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleCropConfirm}
            disabled={isProcessing}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-600/30 disabled:opacity-50"
          >
            {isProcessing ? (
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Check className="w-4 h-4 stroke-[3]" />
            )}
            <span>{isProcessing ? 'Cortando...' : 'Cortar e Confirmar'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
