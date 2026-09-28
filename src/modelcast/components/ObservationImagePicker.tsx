// @ts-nocheck - photo picker with auto-compress for WeatherLogs
// Compresses to max 1024px JPEG ~80-150KB so localStorage never fills up
import { useRef, useState } from 'react';

function compressImage(file: File, maxDim = 1024, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        let { width, height } = img;
        const scale = Math.min(1, maxDim / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('no canvas');
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (e) { URL.revokeObjectURL(url); reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
}

export default function ObservationImagePicker({ value, onChange }: { value?: string; onChange?: (url: string | undefined) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pick = async (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) { setErr('Image only'); return; }
    setBusy(true); setErr('');
    try {
      const dataUrl = await compressImage(f, 1024, 0.72);
      onChange?.(dataUrl);
    } catch { setErr('Could not read image'); }
    setBusy(false);
  };
  if (value) {
    return (
      <span style={{ display:'inline-flex', alignItems:'center', gap:'6px' }}>
        <span style={{ position:'relative', display:'inline-block' }}>
          <img src={value} alt="" style={{ height:'36px', width:'36px', objectFit:'cover', borderRadius:'8px', border:'1px solid #475569' }} />
          <button type="button" onClick={() => onChange?.(undefined)} title="Remove photo"
            style={{ position:'absolute', top:'-8px', right:'-8px', height:'18px', width:'18px', borderRadius:'50%', background:'#dc2626', color:'white', border:'none', fontSize:'10px', cursor:'pointer', lineHeight:'18px' }}>✕</button>
        </span>
        <button type="button" onClick={() => inputRef.current?.click()}
          style={{ padding:'6px 10px', borderRadius:'6px', background:'#0f172a', border:'1px solid #475569', color:'#cbd5e1', fontSize:'11px', cursor:'pointer' }}>Change</button>
        <input ref={inputRef} type="file" accept="image/*" style={{ display:'none' }}
          onChange={(e) => { pick(e.target.files?.[0]); e.target.value=''; }} />
      </span>
    );
  }
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:'6px' }}>
      <button type="button" onClick={() => inputRef.current?.click()} title="Add a photo to this observation" disabled={busy}
        style={{ padding:'6px 10px', borderRadius:'6px', background:'transparent', border:'1px dashed #475569', color:'#cbd5e1', fontSize:'11px', cursor: busy?'wait':'pointer', opacity: busy?0.6:1 }}>{busy ? '⏳...' : '📷 + Photo'}</button>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" style={{ display:'none' }}
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value=''; }} />
      {err && <span style={{ color:'#f87171', fontSize:'10px' }}>{err}</span>}
    </span>
  );
}
