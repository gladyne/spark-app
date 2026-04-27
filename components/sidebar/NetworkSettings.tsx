"use client";

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
}

export default function NetworkSettings({
  jenisJaringan, setJenisJaringan, statusJaringan, setStatusJaringan,
  jarakGawang, setJarakGawang, tinggiTiang, setTinggiTiang,
  materialTiang, setMaterialTiang, offsetSide, setOffsetSide, isKabelTanah,
}: Props) {
  return (
    <div className="border border-gray-200 p-4 rounded-xl bg-gray-50">
      <h3 className="font-bold text-gray-700 mb-2 text-sm uppercase">Pengaturan Jaringan</h3>

      <div className="flex gap-2 mb-3">
        <div className="flex-1">
          <label className="text-xs text-gray-600 font-semibold mb-1 block">Jenis:</label>
          <select className="w-full p-2 border border-gray-300 rounded-lg bg-white outline-none text-sm" value={jenisJaringan} onChange={e => setJenisJaringan(e.target.value)}>
            <option value="SUTM">SUTM</option>
            <option value="SKUTR">SKUTR</option>
            <option value="SUTM + SKUTR">SUTM + SKUTR</option>
            <option value="SUTM Underbuild (2 Jaringan)">SUTM Underbuild (2 Jaringan)</option>
            <option value="SUTM Underbuild (3 Jaringan)">SUTM Underbuild (3 Jaringan)</option>
            <option value="SKUTM">SKUTM</option>
            <option value="SKTM">SKTM</option>
            <option value="SKTR">SKTR</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-600 font-semibold mb-1 block">Status:</label>
          <select className="w-full p-2 border border-gray-300 rounded-lg bg-white outline-none text-sm" value={statusJaringan} onChange={e => setStatusJaringan(e.target.value)}>
            <option value="Existing">Existing</option>
            <option value="Perluasan">Perluasan</option>
          </select>
        </div>
      </div>

      <div className="mb-3">
        <label className="text-xs text-gray-600 font-semibold mb-1 block">
          {isKabelTanah ? "Jarak Antar Jointing (Meter):" : "Jarak Antar Tiang (Meter):"}
        </label>
        <input type="number" className="w-full p-2 border border-gray-300 rounded-lg bg-white outline-none text-sm focus:ring-2 focus:ring-blue-400"
          value={jarakGawang} onChange={e => setJarakGawang(Number(e.target.value))}
          step={isKabelTanah ? 50 : 5} min={isKabelTanah ? 100 : 10} max={isKabelTanah ? 3000 : 100} />
        {isKabelTanah && <p className="text-[10px] text-amber-600 mt-1">⚡ Standar: 500m per section untuk TM, 250m untuk TR</p>}
      </div>

      {!isKabelTanah && (
        <>
          <div className="flex gap-2 mb-3">
            <div className="flex-1">
              <label className="text-xs text-gray-600 font-semibold mb-1 block">Tinggi Tiang:</label>
              <select className="w-full p-2 border border-gray-300 rounded-lg bg-white outline-none text-sm" value={tinggiTiang} onChange={e => setTinggiTiang(Number(e.target.value))}>
                {jenisJaringan === "SKUTR" ? <option value={9}>9 Meter</option>
                  : jenisJaringan === "SUTM Underbuild (3 Jaringan)"
                  ? <><option value={13}>13 Meter</option><option value={14}>14 Meter</option></>
                  : <><option value={12}>12 Meter</option><option value={13}>13 Meter</option><option value={14}>14 Meter</option></>}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-600 font-semibold mb-1 block">Material:</label>
              <select className="w-full p-2 border border-gray-300 rounded-lg bg-white outline-none text-sm" value={materialTiang} onChange={e => setMaterialTiang(e.target.value)}>
                <option value="Beton">Beton</option>
                <option value="Besi">Besi</option>
              </select>
            </div>
          </div>
          <label className="text-xs text-gray-600 font-semibold mb-1 block">Posisi Tiang (Bahu Jalan):</label>
          <select className="w-full p-2 mb-1 border border-gray-300 rounded-lg bg-white outline-none text-sm" value={offsetSide} onChange={e => setOffsetSide(Number(e.target.value))}>
            <option value={4}>Kanan Jalan (Jarak 4 meter)</option>
            <option value={-4}>Kiri Jalan (Jarak 4 meter)</option>
            <option value={0}>Tengah Jalan (As Rute)</option>
          </select>
        </>
      )}

      {isKabelTanah && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px] text-amber-800 leading-relaxed">
          🔌 <strong>SKTM / SKTR</strong> — simbol:<br/>
          <span className="font-bold">◆ T</span> = Terminasi (ujung kabel / sambungan ke overhead)<br/>
          <span className="font-bold">⬡ J</span> = Jointing (sambungan kabel bawah tanah)
        </div>
      )}
    </div>
  );
}
