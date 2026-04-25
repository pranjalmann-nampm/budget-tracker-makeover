import { useMemo } from "react";
import { CURRENCIES } from "@shared/appTypes";
import { trpc } from "@/lib/trpc";

export function useCurrency() {
  const { data: settings } = trpc.settings.get.useQuery();
  const currencyCode = settings?.currency ?? "USD";
  const currencyInfo = CURRENCIES.find(c => c.code === currencyCode) ?? CURRENCIES[0];

  const format = useMemo(() => {
    return (amount: number | string) => {
      const num = typeof amount === "string" ? parseFloat(amount) : amount;
      if (isNaN(num)) return `${currencyInfo.symbol}0.00`;
      return `${currencyInfo.symbol}${Math.abs(num).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };
  }, [currencyInfo.symbol]);

  const formatSigned = useMemo(() => {
    return (amount: number | string, type: "income" | "expense") => {
      const num = typeof amount === "string" ? parseFloat(amount) : amount;
      if (isNaN(num)) return `${currencyInfo.symbol}0.00`;
      const prefix = type === "expense" ? "-" : "+";
      return `${prefix}${currencyInfo.symbol}${Math.abs(num).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };
  }, [currencyInfo.symbol]);

  return { format, formatSigned, currencyCode, currencyInfo };
}
