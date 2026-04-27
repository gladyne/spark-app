"use client";
import { parseSearchResult } from "../../hooks/useSearch";

interface Props {
  searchInput: string;
  setSearchInput: (v: string) => void;
  searchResults: any[];
  isSearching: boolean;
  searchFocused: boolean;
  setSearchFocused: (v: boolean) => void;
  activeResultIdx: number;
  setActiveResultIdx: (v: number) => void;
  onSelectLocation: (lat: string | number, lon: string | number, display: string, type?: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export default function SearchBar({
  searchInput, setSearchInput, searchResults, isSearching,
  searchFocused, setSearchFocused, activeResultIdx, setActiveResultIdx,
  onSelectLocation, onKeyDown,
}: Props) {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-md px-3">
      <div className={`bg-white rounded-2xl shadow-xl transition-all duration-200 ${searchFocused ? "ring-2 ring-blue-400 shadow-2xl" : ""}`}>
        <div className="flex items-center px-4 py-2.5 gap-2">
          <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input type="text" placeholder="Cari lokasi, jalan, atau koordinat..."
            className="flex-1 text-sm text-gray-800 placeholder-gray-400 outline-none bg-transparent"
            value={searchInput}
            onChange={e => { setSearchInput(e.target.value); setSearchFocused(true); }}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
            onKeyDown={onKeyDown}
          />
          {isSearching && (
            <svg className="w-4 h-4 animate-spin text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
          )}
          {searchInput && !isSearching && (
            <button onClick={() => { setSearchInput(""); }}
              className="w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center flex-shrink-0 transition-colors">
              <svg className="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>

        {searchFocused && searchResults.length > 0 && (
          <div className="border-t border-gray-100 rounded-b-2xl overflow-hidden max-h-72 overflow-y-auto">
            {searchResults.map((r, i) => {
              const { mainName, secondary, icon } = parseSearchResult(r);
              return (
                <button key={i}
                  onMouseDown={() => onSelectLocation(r.lat, r.lon, r.display_name, r.type)}
                  onMouseEnter={() => setActiveResultIdx(i)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-gray-50 last:border-0 ${i === activeResultIdx ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                  <span className="text-lg flex-shrink-0 mt-0.5">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-800 truncate">{mainName}</div>
                    {secondary && <div className="text-xs text-gray-500 truncate mt-0.5">{secondary}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {searchFocused && searchInput.trim().length >= 2 && !isSearching && searchResults.length === 0 && (
          <div className="border-t border-gray-100 px-4 py-4 text-center rounded-b-2xl">
            <p className="text-sm text-gray-400">Tidak ada hasil ditemukan</p>
          </div>
        )}
      </div>
    </div>
  );
}
