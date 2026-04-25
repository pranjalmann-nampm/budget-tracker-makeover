export const DEFAULT_CATEGORIES = [
  { name: "Food", icon: "UtensilsCrossed", color: "#f97316", type: "expense" as const },
  { name: "Transport", icon: "Car", color: "#3b82f6", type: "expense" as const },
  { name: "Shopping", icon: "ShoppingBag", color: "#a855f7", type: "expense" as const },
  { name: "Bills", icon: "Receipt", color: "#ef4444", type: "expense" as const },
  { name: "Health", icon: "Heart", color: "#ec4899", type: "expense" as const },
  { name: "Entertainment", icon: "Gamepad2", color: "#06b6d4", type: "expense" as const },
  { name: "Income", icon: "Wallet", color: "#22c55e", type: "income" as const },
  { name: "Other", icon: "MoreHorizontal", color: "#6b7280", type: "both" as const },
] as const;

export const PALETTES = {
  "midnight-blue": {
    label: "Midnight Blue",
    primary: "oklch(0.55 0.2 260)",
    primaryForeground: "oklch(0.98 0 0)",
    accent: "oklch(0.3 0.04 260)",
    ring: "oklch(0.55 0.2 260)",
    chart1: "oklch(0.65 0.18 260)",
    chart2: "oklch(0.55 0.2 260)",
    chart3: "oklch(0.45 0.18 260)",
    chart4: "oklch(0.7 0.12 220)",
    chart5: "oklch(0.6 0.15 280)",
  },
  "emerald": {
    label: "Emerald",
    primary: "oklch(0.6 0.18 155)",
    primaryForeground: "oklch(0.98 0 0)",
    accent: "oklch(0.3 0.04 155)",
    ring: "oklch(0.6 0.18 155)",
    chart1: "oklch(0.7 0.16 155)",
    chart2: "oklch(0.6 0.18 155)",
    chart3: "oklch(0.5 0.16 155)",
    chart4: "oklch(0.65 0.12 180)",
    chart5: "oklch(0.55 0.14 130)",
  },
  "rose-gold": {
    label: "Rose Gold",
    primary: "oklch(0.65 0.15 15)",
    primaryForeground: "oklch(0.98 0 0)",
    accent: "oklch(0.3 0.04 15)",
    ring: "oklch(0.65 0.15 15)",
    chart1: "oklch(0.75 0.13 15)",
    chart2: "oklch(0.65 0.15 15)",
    chart3: "oklch(0.55 0.13 15)",
    chart4: "oklch(0.7 0.1 40)",
    chart5: "oklch(0.6 0.12 350)",
  },
  "slate": {
    label: "Slate",
    primary: "oklch(0.55 0.03 260)",
    primaryForeground: "oklch(0.98 0 0)",
    accent: "oklch(0.3 0.02 260)",
    ring: "oklch(0.55 0.03 260)",
    chart1: "oklch(0.65 0.03 260)",
    chart2: "oklch(0.55 0.03 260)",
    chart3: "oklch(0.45 0.03 260)",
    chart4: "oklch(0.6 0.02 220)",
    chart5: "oklch(0.5 0.02 280)",
  },
} as const;

export type PaletteKey = keyof typeof PALETTES;
export type ThemeMode = "dark" | "light";

export interface ReceiptExtraction {
  merchant: string;
  amount: string;
  date: string;
  category: string;
}

export const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
] as const;
