"use client";

const CONDUCTOR: Record<string, { tipe: string; ukuran: number[] }> = {
  "SUTM":                          { tipe: "AAACS",      ukuran: [70, 150, 240] },
  "SUTM + SKUTR":                  { tipe: "AAACS",      ukuran: [70, 150, 240] },
  "SUTM Underbuild (2 Jaringan)":  { tipe: "AAACS",      ukuran: [70, 150, 240] },
  "SUTM Underbuild (3 Jaringan)":  { tipe: "AAACS",      ukuran: [70, 150, 240] },
  "SKUTM":                         { tipe: "NFA2XSY-T",  ukuran: [70, 150, 240] },
  "SKTM":                          { tipe: "NA2XSEBY",   ukuran: [70, 150, 240] },
  "SKUTR":                         { tipe: "NFA2X",      ukuran: [70] },
  "SKTR":                          { tipe: "NFA2X",      ukuran: [70] },
};

const selectCls = "w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 font-medium outline-none transition focus:ring-2 focus:ring-blue-400 focus:border-transparent hover:border-slate-300 shadow-sm";
const labelCls = "text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block";

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-2">{children}</div>;
}
function Field({ children, className = "flex-1" }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

interface Props {
  jenisJaringan: string;
  setJenisJaringan: (v: string) => void;
  statusJaringan: string;
  setStatusJaringan: (v: string) => void;
  jarakGawang: number;
  setJarakGawang: (v: number) => void;
  tinggiTiang: number;
  setTinggiTiang: (v: number) => void;
  materialTiang: string;
  setMaterialTiang: (v: string) => void;
  offsetSide: number;
  setOffsetSide: (v: number) => void;
  isKabelTanah: boolean;
  kondukturUkuran: number;
  setKondukturUkuran: (v: number) => void;
}

export default function NetworkSettings({
  jenisJaringan, setJenisJaringan, statusJaringan, setStatusJaringan,
  jarakGawang, setJarakGawang, tinggiTiang, setTinggiTiang,
  materialTiang, setMaterialTiang, offsetSide, setOffsetSide, isKabelTanah,
  kondukturUkuran, setKondukturUkuran,
}: Props) {
  const conductor = CONDUCTOR[jenisJaringan] ?? { tipe: "AAACS", ukuran: [70, 150, 240] };

  return (
    <div className="rounded-2xl overflow-hidden shadow-sm border border-slate-200/80">

      {/* Card header */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-4 py-3 flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </div>
        <span className="text-white font-bold text-sm tracking-wide">Pengaturan Jaringan</span>
      </div>

      {/* Card body */}
      <div className="bg-white p-4 flex flex-col gap-4">

        {/* Jenis & Status */}
        <div>
          <p className={labelCls}>Jaringan</p>
          <FieldRow>
            <Field>
              <select className={selectCls} value={jenisJaringan} onChange={e => setJenisJaringan(e.target.value)}>
                <optgroup label="Tegangan Menengah">
                  <option value="SUTM">SUTM</option>
                  <option value="SKUTM">SKUTM</option>
                  <option value="SKTM">SKTM</option>
                  <option value="SUTM Underbuild (2 Jaringan)">SUTM Underbuild (2 Jrg)</option>
                  <option value="SUTM Underbuild (3 Jaringan)">SUTM Underbuild (3 Jrg)</option>
                </optgroup>
                <optgroup label="Tegangan Rendah">
                  <option value="SKUTR">SKUTR</option>
                  <option value="SKTR">SKTR</option>
                </optgroup>
                <optgroup label="Kolaborasi">
                  <option value="SUTM + SKUTR">SUTM + SKUTR</option>
                </optgroup>
              </select>
            </Field>
            <Field>
              <select className={selectCls} value={statusJaringan} onChange={e => setStatusJaringan(e.target.value)}>
                <option value="Existing">Existing</option>
                <option value="Perluasan">Perluasan</option>
              </select>
            </Field>
          </FieldRow>
        </div>

        {/* Tipe Konduktor */}
        <div>
          <p className={labelCls}>Tipe Konduktor</p>
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 border border-blue-100 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
              <span className="text-sm font-bold text-blue-700">{conductor.tipe}</span>
            </div>
            {conductor.ukuran.length > 1 ? (
              <select
                className={`${selectCls} flex-1`}
                value={kondukturUkuran}
                onChange={e => setKondukturUkuran(Number(e.target.value))}
              >
                {conductor.ukuran.map(u => (
                  <option key={u} value={u}>{u} mm²</option>
                ))}
              </select>
            ) : (
              <div className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-500 font-medium">
                {conductor.ukuran[0]} mm²
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-dashed border-slate-100" />

        {/* Jarak */}
        <div>
          <p className={labelCls}>{isKabelTanah ? "Jarak Antar Jointing" : "Jarak Antar Tiang"}</p>
          <div className="relative">
            <input
              type="number"
              className={`${selectCls} pr-10`}
              value={jarakGawang}
              onChange={e => setJarakGawang(Number(e.target.value))}
              step={isKabelTanah ? 50 : 5}
              min={isKabelTanah ? 100 : 10}
              max={isKabelTanah ? 3000 : 100}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">m</span>
          </div>
          {isKabelTanah && (
            <p className="text-[10px] text-amber-500 mt-1.5 flex items-center gap-1">
              <span>⚡</span> Standar: 500m (TM) · 250m (TR)
            </p>
          )}
        </div>

        {/* Tiang settings (overhead only) */}
        {!isKabelTanah && (
          <>
            <FieldRow>
              <Field>
                <p className={labelCls}>Tinggi Tiang</p>
                <select className={selectCls} value={tinggiTiang} onChange={e => setTinggiTiang(Number(e.target.value))}>
                  {jenisJaringan === "SKUTR"
                    ? <option value={9}>9 m</option>
                    : jenisJaringan === "SUTM Underbuild (3 Jaringan)"
                    ? <><option value={13}>13 m</option><option value={14}>14 m</option></>
                    : <><option value={12}>12 m</option><option value={13}>13 m</option><option value={14}>14 m</option></>
                  }
                </select>
              </Field>
              <Field>
                <p className={labelCls}>Material</p>
                <select className={selectCls} value={materialTiang} onChange={e => setMaterialTiang(e.target.value)}>
                  <option value="Beton">Beton</option>
                  <option value="Besi">Besi</option>
                </select>
              </Field>
            </FieldRow>

            <div>
              <p className={labelCls}>Posisi Tiang</p>
              <select className={selectCls} value={offsetSide} onChange={e => setOffsetSide(Number(e.target.value))}>
                <option value={4}>↗ Kanan Jalan (4 m)</option>
                <option value={-4}>↖ Kiri Jalan (4 m)</option>
                <option value={0}>↑ Tengah / As Rute</option>
              </select>
            </div>
          </>
        )}

        {/* Kabel tanah info */}
        {isKabelTanah && (
          <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60 p-3">
            <div className="flex items-start gap-2">
              <span className="text-lg flex-shrink-0">🔌</span>
              <div className="text-[11px] text-amber-800 leading-relaxed">
                <p className="font-bold text-amber-900 mb-1">SKTM / SKTR — Simbol Peta</p>
                <p><span className="font-bold">◆ T</span> = Terminasi</p>
                <p><span className="font-bold">⬡ J</span> = Jointing bawah tanah</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
