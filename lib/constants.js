export const DEFAULT_CITY = "Semarang";
export const CITIES = ["Jakarta", "Semarang", "Palu"];

// Action-plan categories and their accent colours.
export const CAT_COLORS = {
  "Makanan & minuman": "#2BA89A",
  "Investasi & Tabungan": "#1F5932",
  "Kebutuhan rumah tangga": "#E8743B",
  "Cicilan & utang": "#8B6FD6",
};
export const TASK_CATEGORIES = Object.keys(CAT_COLORS);

// Main navigation. `icon` is a key of the Icons object in components/ui/Icons.jsx.
export const NAV_ITEMS = [
  { href: "/dashboard", label: "Beranda", icon: "Home" },
  { href: "/insight", label: "Wawasan", icon: "Chart" },
  { href: "/forecast", label: "Prediksi", icon: "Trend" },
  { href: "/action-plan", label: "Rencana Aksi", icon: "List" },
];

// Pages that render without the main navigation (same rule as the old App.tsx).
export const NO_NAV_PREFIXES = ["/auth"];
// Pages that use the full-bleed layout on desktop.
export const WIDE_PREFIXES = [];
