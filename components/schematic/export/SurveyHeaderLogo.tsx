"use client";

import React from "react";

interface Props {
  customLogoUrl?: string;
  size?: number; // pixel size
}

/**
 * Logo resmi untuk kop atas Gambar Survei UP3 Kupang.
 * Menggunakan circular emblem khas PLN / UP3 Kupang atau gambar custom upload pengguna.
 */
export default function SurveyHeaderLogo({ customLogoUrl, size = 110 }: Props) {
  if (customLogoUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex items-center justify-center border border-slate-400 bg-white p-1 overflow-hidden rounded-full shadow-xs"
      >
        <img
          src={customLogoUrl}
          alt="Custom Logo"
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className="flex items-center justify-center rounded-full bg-white border-2 border-slate-900 p-1.5 shadow-xs select-none"
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        style={{ overflow: "visible" }}
      >
        {/* Lingkaran Luar Ganda (Engineering Seal) */}
        <circle cx="50" cy="50" r="48" fill="#ffffff" stroke="#0f172a" strokeWidth="2.5" />
        <circle cx="50" cy="50" r="44" fill="#ffffff" stroke="#0f172a" strokeWidth="1" strokeDasharray="2 1.5" />

        {/* Lingkaran Dalam Kuning PLN */}
        <circle cx="50" cy="50" r="39" fill="#fef08a" stroke="#0f172a" strokeWidth="1.2" />

        {/* Petir Merah PLN Tengah */}
        <polygon
          points="54,18 32,50 48,50 42,78 68,44 52,44"
          fill="#dc2626"
          stroke="#991b1b"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* 3 Gelombang Biru Bawah Petir */}
        <path d="M30,68 Q50,60 70,68" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M33,74 Q50,67 67,74" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M37,80 Q50,74 63,80" fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" />

        {/* Teks Melingkar Atas & Bawah */}
        <text
          x="50"
          y="15"
          textAnchor="middle"
          fontSize="5.5"
          fontWeight="900"
          fill="#0f172a"
          letterSpacing="0.8"
        >
          PT PLN (PERSERO)
        </text>
        <text
          x="50"
          y="93"
          textAnchor="middle"
          fontSize="4.8"
          fontWeight="900"
          fill="#0f172a"
          letterSpacing="0.8"
        >
          UP3 KUPANG
        </text>
      </svg>
    </div>
  );
}
