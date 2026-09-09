import rawCatalog from "./rab_katalog_dengan_harga.json";
import type { RabCatalogItem } from "./types";

/**
 * Katalog Referensi Lengkap RAB KHS 2026 PLN UP3 Kupang
 * Dilengkapi dengan harga_satuan_bahan (Kolom J) dan harga_satuan_upah (Kolom K)
 * diekstrak langsung dari file master template resmi.
 */
export const RAB_KATALOG_REFERENSI: RabCatalogItem[] = rawCatalog as RabCatalogItem[];

export const RAB_CATALOG_BY_ROW: Map<number, RabCatalogItem> = new Map(
  RAB_KATALOG_REFERENSI.map(item => [item.row, item])
);
