"use client";

const CONDUCTOR: Record<string, { tipe: string; ukuran: number[] }> = {
  "SUTM":                          { tipe: "AAAC / AAACS", ukuran: [35, 50, 70, 95, 120, 150, 240] },
  "SUTM + SKUTR":                  { tipe: "AAACS + LVTC", ukuran: [50, 70, 95, 120, 150, 240] },
  "SUTM Underbuild (2 Jaringan)":  { tipe: "AAACS",        ukuran: [70, 150, 240] },
  "SUTM Underbuild (3 Jaringan)":  { tipe: "AAACS",        ukuran: [70, 150, 240] },
  "SKUTM":                         { tipe: "NFA2XSY-T",    ukuran: [70, 95, 150, 240] },
  "SKTM":                          { tipe: "NA2XSEYBY",    ukuran: [70, 95, 150, 240, 300] },
  "SKUTR":                         { tipe: "NFA2X-T",      ukuran: [35, 50, 70, 95] },
  "SKTR":                          { tipe: "NYFGbY",       ukuran: [70, 95, 120] },
};

const selectCls = "w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 outline-none transition focus:ring-2 focus:ring-emerald-400 focus:border-transparent hover:border-slate-300 shadow-sm";
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
  kekuatanTiang?: number;
  setKekuatanTiang?: (v: number) => void;
  posisiTiang?: "Tumpu" | "Topang-Sudut" | "Ujung";
  setPosisiTiang?: (v: "Tumpu" | "Topang-Sudut" | "Ujung") => void;
  konduktorJenis?: "AAAC" | "AAAC/S";
  setKonduktorJenis?: (v: "AAAC" | "AAAC/S") => void;
  rabCategory?: "JTM" | "GARDU" | "JTR" | "AUTO";
  setRabCategory?: (v: "JTM" | "GARDU" | "JTR" | "AUTO") => void;
  offsetSide: number;
  setOffsetSide: (v: number) => void;
  isKabelTanah: boolean;
  kondukturUkuran: number;
  setKondukturUkuran: (v: number) => void;
}

export default function NetworkSettings({
  jenisJaringan, setJenisJaringan, statusJaringan, setStatusJaringan,
  jarakGawang, setJarakGawang, tinggiTiang, setTinggiTiang,
  materialTiang, setMaterialTiang,
  kekuatanTiang = 350, setKekuatanTiang,
  posisiTiang = "Tumpu", setPosisiTiang,
  konduktorJenis = "AAAC/S", setKonduktorJenis,
  rabCategory = "AUTO", setRabCategory,
  offsetSide, setOffsetSide, isKabelTanah,
  kondukturUkuran, setKondukturUkuran,
}: Props) {
  const conductor = CONDUCTOR[jenisJaringan] ?? { tipe: "AAACS", ukuran: [70, 150, 240] };
  const isSutm = jenisJaringan.includes("SUTM");

  return (
    <div className="rounded-2xl overflow-hidden shadow-sm border border-slate-200/80">

      {/* Card header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <span className="text-white font-bold text-sm tracking-wide">Pengaturan Jaringan</span>
        </div>
        <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800">
          KHS 2026
        </span>
      </div>

      {/* Card body */}
      <div className="bg-white p-4 flex flex-col gap-3.5">

        {/* Jenis & Status */}
        <div>
          <p className={labelCls}>Jaringan &amp; Status</p>
          <FieldRow>
            <Field>
              <select className={selectCls} value={jenisJaringan} onChange={e => setJenisJaringan(e.target.value)}>
                <optgroup label="Tegangan Menengah (JTM)">
                  <option value="SUTM">SUTM (Udara)</option>
                  <option value="SKUTM">SKUTM (MVTIC)</option>
                  <option value="SKTM">SKTM (Kabel Tanah)</option>
                  <option value="SUTM Underbuild (2 Jaringan)">SUTM Underbuild (2 Jrg)</option>
                  <option value="SUTM Underbuild (3 Jaringan)">SUTM Underbuild (3 Jrg)</option>
                </optgroup>
                <optgroup label="Tegangan Rendah (JTR)">
                  <option value="SKUTR">SKUTR (LVTC Udara)</option>
                  <option value="SKTR">SKTR (Kabel Tanah)</option>
                </optgroup>
                <optgroup label="Kolaborasi JTM + JTR">
                  <option value="SUTM + SKUTR">SUTM + SKUTR</option>
                </optgroup>
              </select>
            </Field>
            <Field>
              <select className={selectCls} value={statusJaringan} onChange={e => setStatusJaringan(e.target.value)}>
                <option value="Perluasan">Perluasan (RAB)</option>
                <option value="Existing">Existing</option>
              </select>
            </Field>
          </FieldRow>
        </div>

        {/* Kategori RAB (Kolom F/G/H) */}
        <div>
          <p className={labelCls}>Kategori RAB (Kolom Excel)</p>
          <select
            className={selectCls}
            value={rabCategory}
            onChange={e => setRabCategory?.(e.target.value as any)}
          >
            <option value="AUTO">✨ Auto (Sesuai Jenis Jaringan)</option>
            <option value="JTM">JTM (Kolom F) – Tegangan Menengah</option>
            <option value="GARDU">Gardu (Kolom G) – Distribusi</option>
            <option value="JTR">JTR (Kolom H) – Tegangan Rendah</option>
          </select>
        </div>

        {/* Tipe & Ukuran Konduktor */}
        <div>
          <p className={labelCls}>Konduktor / Kabel</p>
          <FieldRow>
            {isSutm && (
              <Field>
                <select
                  className={selectCls}
                  value={konduktorJenis}
                  onChange={e => setKonduktorJenis?.(e.target.value as any)}
                >
                  <option value="AAAC/S">AAAC/S (Isolasi)</option>
                  <option value="AAAC">AAAC (Polos)</option>
                </select>
              </Field>
            )}
            <Field>
              <select
                className={selectCls}
                value={kondukturUkuran}
                onChange={e => setKondukturUkuran(Number(e.target.value))}
              >
                {conductor.ukuran.map(u => (
                  <option key={u} value={u}>{u} mm²</option>
                ))}
              </select>
            </Field>
          </FieldRow>
        </div>

        {/* Tiang settings (overhead only) */}
        {!isKabelTanah && (
          <>
            <div className="border-t border-dashed border-slate-100 pt-3">
              <p className={labelCls}>Material &amp; Ukuran Tiang</p>
              <FieldRow>
                <Field>
                  <select
                    className={selectCls}
                    value={materialTiang === "Besi" ? "Baja" : materialTiang}
                    onChange={e => setMaterialTiang(e.target.value)}
                  >
                    <option value="Beton">Tiang Beton</option>
                    <option value="Baja">Tiang Baja</option>
                  </select>
                </Field>
                <Field>
                  <select className={selectCls} value={tinggiTiang} onChange={e => setTinggiTiang(Number(e.target.value))}>
                    <option value={7}>7 meter</option>
                    <option value={9}>9 meter</option>
                    <option value={11}>11 meter</option>
                    <option value={12}>12 meter</option>
                    <option value={13}>13 meter</option>
                    <option value={14}>14 meter</option>
                  </select>
                </Field>
              </FieldRow>
            </div>

            <div>
              <p className={labelCls}>Kekuatan (daN) &amp; Posisi Tiang</p>
              <FieldRow>
                <Field>
                  <select
                    className={selectCls}
                    value={kekuatanTiang}
                    onChange={e => setKekuatanTiang?.(Number(e.target.value))}
                  >
                    <option value={100}>100 daN</option>
                    <option value={200}>200 daN</option>
                    <option value={350}>350 daN</option>
                  </select>
                </Field>
                <Field>
                  <select
                    className={selectCls}
                    value={posisiTiang}
                    onChange={e => setPosisiTiang?.(e.target.value as any)}
                  >
                    <option value="Tumpu">Posisi Tumpu</option>
                    <option value="Topang-Sudut">Topang-Sudut (Belokan)</option>
                    <option value="Ujung">Posisi Ujung (Dead-end)</option>
                  </select>
                </Field>
              </FieldRow>
            </div>

            <div>
              <p className={labelCls}>Posisi Garis Tiang Terhadap Jalan</p>
              <select className={selectCls} value={offsetSide} onChange={e => setOffsetSide(Number(e.target.value))}>
                <option value={4}>↗ Kanan Jalan (4 m)</option>
                <option value={-4}>↖ Kiri Jalan (4 m)</option>
                <option value={0}>↑ As Rute / Tengah</option>
              </select>
            </div>
          </>
        )}

        {/* Jarak Tiang / Jointing */}
        <div className="border-t border-dashed border-slate-100 pt-3">
          <p className={labelCls}>{isKabelTanah ? "Jarak Antar Jointing" : "Jarak Gawang Antar Tiang"}</p>
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
        </div>

        {/* Kabel tanah info */}
        {isKabelTanah && (
          <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60 p-3">
            <div className="flex items-start gap-2">
              <span className="text-lg flex-shrink-0">🔌</span>
              <div className="text-[11px] text-amber-800 leading-relaxed">
                <p className="font-bold text-amber-900 mb-1">SKTM / SKTR — Simbol Peta</p>
                <p><span className="font-bold">◆ T</span> = Terminasi Cold Shrink</p>
                <p><span className="font-bold">⬡ J</span> = Jointing Cold Shrink</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
