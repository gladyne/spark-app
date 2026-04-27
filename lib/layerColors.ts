export function getLayerColor(jenisJaringan: string, statusJaringan: string): string {
  if (jenisJaringan === "SUTM" && statusJaringan === "Existing") return "black";
  if (jenisJaringan === "SUTM" && statusJaringan === "Perluasan") return "blue";
  if (jenisJaringan === "SKUTR" && statusJaringan === "Existing") return "black";
  if (jenisJaringan === "SKUTR" && statusJaringan === "Perluasan") return "blue";
  if (jenisJaringan === "SKUTM" && statusJaringan === "Existing") return "#6d28d9";
  if (jenisJaringan === "SKUTM" && statusJaringan === "Perluasan") return "#7c3aed";
  if (jenisJaringan === "SKTM" && statusJaringan === "Existing") return "#7c2d12";
  if (jenisJaringan === "SKTM" && statusJaringan === "Perluasan") return "#b45309";
  if (jenisJaringan === "SKTR" && statusJaringan === "Existing") return "#166534";
  if (jenisJaringan === "SKTR" && statusJaringan === "Perluasan") return "#15803d";
  if (jenisJaringan.includes("SUTM + SKUTR") || jenisJaringan.includes("Underbuild")) {
    return statusJaringan === "Existing" ? "black" : "blue";
  }
  return "gray";
}

export function getSidebarDotColor(jenisJaringan: string, statusJaringan: string): string {
  return getLayerColor(jenisJaringan, statusJaringan);
}
