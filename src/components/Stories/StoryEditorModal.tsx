import { useEffect, useRef, useState } from 'react';
import { X, Type, SlidersHorizontal, Wand2 } from 'lucide-react';

type StoryEditorModalProps = {
  open: boolean;
  imageFile: File | null;
  onCancel: () => void;
  onSave: (editedFile: File, previewUrl: string) => void;
};

type FilterType = 'none' | 'bw' | 'sepia';

export function StoryEditorModal({ open, imageFile, onCancel, onSave }: StoryEditorModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [filter, setFilter] = useState<FilterType>('none');
  const [text, setText] = useState('');
  const [textSize, setTextSize] = useState(28);
  const [textColor, setTextColor] = useState<'white' | 'black'>('white');

  useEffect(() => {
    if (!open || !imageFile) {
      setImage(null);
      return;
    }

    const img = new Image();
    img.onload = () => {
      setImage(img);
      setScale(1);
      setOffsetX(0);
      setOffsetY(0);
    };
    img.src = URL.createObjectURL(imageFile);

    return () => {
      URL.revokeObjectURL(img.src);
    };
  }, [open, imageFile]);

  useEffect(() => {
    if (!open) return;
    draw();
  }, [open, image, scale, offsetX, offsetY, filter, text, textSize, textColor]);

  const applyFilter = (ctx: CanvasRenderingContext2D) => {
    if (filter === 'bw') {
      ctx.filter = 'grayscale(1)';
    } else if (filter === 'sepia') {
      ctx.filter = 'sepia(1)';
    } else {
      ctx.filter = 'none';
    }
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Dessin de l'image avec zoom + décalage
    const imgAspect = image.width / image.height;
    const canvasAspect = width / height;

    let drawWidth = width;
    let drawHeight = height;

    if (imgAspect > canvasAspect) {
      drawHeight = height / scale;
      drawWidth = drawHeight * imgAspect;
    } else {
      drawWidth = width / scale;
      drawHeight = drawWidth / imgAspect;
    }

    const dx = width / 2 - drawWidth / 2 + offsetX;
    const dy = height / 2 - drawHeight / 2 + offsetY;

    applyFilter(ctx);
    ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
    ctx.filter = 'none';

    // Texte superposé
    if (text.trim()) {
      ctx.save();
      ctx.font = `${textSize}px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const x = width / 2;
      const y = height - 60;

      // Ombre pour la lisibilité
      ctx.fillStyle = textColor === 'white' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';
      ctx.fillRect(x - width / 2 + 16, y - textSize, width - 32, textSize * 1.6);

      ctx.fillStyle = textColor === 'white' ? '#ffffff' : '#000000';
      ctx.fillText(text, x, y);
      ctx.restore();
    }
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `story-${Date.now()}.jpg`, { type: 'image/jpeg' });
        const previewUrl = URL.createObjectURL(blob);
        onSave(file, previewUrl);
      },
      'image/jpeg',
      0.9
    );
  };

  if (!open || !imageFile) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-3">
      <div className="bg-gray-900 text-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold">Éditer la story</h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-full hover:bg-gray-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 flex flex-col gap-3 p-3">
          <div className="relative w-full max-w-sm mx-auto aspect-[9/16] bg-black rounded-xl overflow-hidden border border-gray-800">
            <canvas ref={canvasRef} width={360} height={640} className="w-full h-full" />
          </div>

          {/* Contrôles */}
          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-3 h-3 text-gray-300" />
              <span className="font-medium text-gray-200">Zoom & Position</span>
            </div>
            <div className="flex flex-col gap-2 pl-5">
              <label className="flex items-center gap-2">
                <span className="w-16 text-gray-400">Zoom</span>
                <input
                  type="range"
                  min={1}
                  max={2}
                  step={0.05}
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                  className="flex-1"
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="w-16 text-gray-400">Horiz.</span>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  step={1}
                  value={offsetX}
                  onChange={(e) => setOffsetX(Number(e.target.value))}
                  className="flex-1"
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="w-16 text-gray-400">Vert.</span>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  step={1}
                  value={offsetY}
                  onChange={(e) => setOffsetY(Number(e.target.value))}
                  className="flex-1"
                />
              </label>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <Wand2 className="w-3 h-3 text-amber-400" />
              <span className="font-medium text-gray-200">Filtres</span>
            </div>
            <div className="flex gap-2 pl-5">
              {([
                ['none', 'Aucun'],
                ['bw', 'Noir & blanc'],
                ['sepia', 'Sépia'],
              ] as [FilterType, string][]).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`px-3 py-1 rounded-full border text-[11px] ${
                    filter === key
                      ? 'bg-amber-400 text-black border-amber-400'
                      : 'bg-gray-800 text-gray-200 border-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 mt-2">
              <Type className="w-3 h-3 text-blue-400" />
              <span className="font-medium text-gray-200">Texte</span>
            </div>
            <div className="space-y-2 pl-5">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Ajoutez un texte sur la story..."
                className="w-full px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-700 text-xs text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1 text-gray-400">
                  Taille
                  <input
                    type="range"
                    min={16}
                    max={40}
                    step={1}
                    value={textSize}
                    onChange={(e) => setTextSize(Number(e.target.value))}
                    className="ml-2"
                  />
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTextColor('white')}
                    className={`w-6 h-6 rounded-full border ${
                      textColor === 'white'
                        ? 'bg-white border-blue-400'
                        : 'bg-white border-gray-500 opacity-70'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setTextColor('black')}
                    className={`w-6 h-6 rounded-full border ${
                      textColor === 'black'
                        ? 'bg-black border-blue-400'
                        : 'bg-black border-gray-500 opacity-70'
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-gray-800 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2 bg-gray-800 text-gray-200 rounded-lg text-sm font-semibold hover:bg-gray-700 transition"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg text-sm font-semibold hover:from-blue-600 hover:to-cyan-600 transition"
          >
            Enregistrer la story
          </button>
        </div>
      </div>
    </div>
  );
}


