import {
  UtensilsCrossed, Car, ShoppingBag, Receipt, Heart,
  Gamepad2, Wallet, MoreHorizontal, Tag, type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  UtensilsCrossed,
  Car,
  ShoppingBag,
  Receipt,
  Heart,
  Gamepad2,
  Wallet,
  MoreHorizontal,
  Tag,
};

interface CategoryIconProps {
  icon: string;
  color: string;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: { container: "h-7 w-7", icon: "h-3.5 w-3.5" },
  md: { container: "h-9 w-9", icon: "h-4.5 w-4.5" },
  lg: { container: "h-11 w-11", icon: "h-5 w-5" },
};

export function CategoryIcon({ icon, color, size = "md" }: CategoryIconProps) {
  const Icon = iconMap[icon] || Tag;
  const s = sizeMap[size];
  return (
    <div
      className={`${s.container} rounded-lg flex items-center justify-center shrink-0`}
      style={{ backgroundColor: `${color}20` }}
    >
      <Icon className={s.icon} style={{ color }} />
    </div>
  );
}
