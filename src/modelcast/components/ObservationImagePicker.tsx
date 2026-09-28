// @ts-nocheck - photo picker for WeatherLogs, no extra libs
import { useRef, useState } from 'react';

export default function ObservationImagePicker({ value, onChange }: { value?: string; onChange?: (url: string | undefined) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState('');
  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) { setErr('Image only'); return; }
    if (f.size > 2.5 * 1024 * 1024) { setErr('Max 2.5MB'); return; }
    setErr('');
    const r = new FileReader();
    r.onload = () => onChange?.(r.result as string);
    r.readAsDataURL(f);
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
      <button type="button" onClick={() => inputRef.current?.click()} title="Add a photo to this observation"
        style={{ padding:'6px 10px', borderRadius:'6px', background:'transparent', border:'1px dashed #475569', color:'#cbd5e1', fontSize:'11px', cursor:'pointer' }}>📷 + Photo</button>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" style={{ display:'none' }}
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value=''; }} />
      {err && <span style={{ color:'#f87171', fontSize:'10px' }}>{err}</span>}
    </span>
  );
}

