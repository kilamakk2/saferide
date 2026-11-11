import { useEffect, useRef, useState } from "react";

const D = 260;

/** Full-screen "Move and scale" photo cropper with drag, pinch and wheel zoom. */
export function PhotoCropper({
  src,
  onCancel,
  onChoose,
}: {
  src: string;
  onCancel: () => void;
  onChoose: (dataUrl: string) => void;
}) {
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  const base = nat ? D / Math.min(nat.w, nat.h) : 1;
  const scale = base * zoom;

  const clamp = (p: { x: number; y: number }, z = zoom) => {
    if (!nat) return p;
    const s = base * z;
    const mx = Math.max(0, (nat.w * s - D) / 2);
    const my = Math.max(0, (nat.h * s - D) / 2);
    return { x: Math.min(mx, Math.max(-mx, p.x)), y: Math.min(my, Math.max(-my, p.y)) };
  };

  useEffect(() => {
    setPos((p) => clamp(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, nat]);

  const choose = () => {
    if (!nat || !imgRef.current) return;
    const out = 400;
    const c = document.createElement("canvas");
    c.width = out;
    c.height = out;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const size = D / scale;
    const cx = nat.w / 2 - pos.x / scale;
    const cy = nat.h / 2 - pos.y / scale;
    ctx.drawImage(imgRef.current, cx - size / 2, cy - size / 2, size, size, 0, 0, out, out);
    onChoose(c.toDataURL("image/jpeg", 0.85));
  };

  return (
    <div className="statusbar-light absolute inset-0 z-50 flex flex-col bg-cropper text-on-photo animate-scrim-in">
      <p className="pt-safe mt-4 text-center text-sm text-on-photo-muted">Move and scale</p>
      <div
        className="relative flex-1 touch-none overflow-hidden"
        onWheel={(e) => setZoom((z) => Math.min(4, Math.max(1, z - e.deltaY * 0.002)))}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()];
            if (a && b) pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
          }
        }}
        onPointerMove={(e) => {
          const prev = pointers.current.get(e.pointerId);
          if (!prev) return;
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pointers.current.size === 2 && pinch.current) {
            const [a, b] = [...pointers.current.values()];
            if (a && b) {
              const d = Math.hypot(a.x - b.x, a.y - b.y);
              setZoom(Math.min(4, Math.max(1, (pinch.current.zoom * d) / pinch.current.dist)));
            }
          } else {
            setPos((p) => clamp({ x: p.x + e.clientX - prev.x, y: p.y + e.clientY - prev.y }));
          }
        }}
        onPointerUp={(e) => {
          pointers.current.delete(e.pointerId);
          if (pointers.current.size < 2) pinch.current = null;
        }}
      >
        <img
          ref={imgRef}
          src={src}
          alt="Selected photo"
          draggable={false}
          onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
          style={{
            width: nat ? nat.w * scale : undefined,
            height: nat ? nat.h * scale : undefined,
            transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
          }}
        />
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-on-photo-dot crop-mask"
          style={{ width: D, height: D }}
        />
      </div>
      <div className="flex items-center justify-between px-6 pb-safe pt-4 mb-6 text-[15px]">
        <button onClick={onCancel} className="py-2">
          Cancel
        </button>
        <button onClick={choose} className="py-2 font-semibold">
          Choose
        </button>
      </div>
    </div>
  );
}
