import {
  Bath,
  Check,
  Coffee,
  Flame,
  Refrigerator,
  Sparkles,
  Sun,
  Tv,
  Wifi,
  Wind,
} from "lucide-react";

const ICON_RULES: Array<{ keywords: string[]; Icon: typeof Wifi }> = [
  { keywords: ["wi-fi", "wifi", "internet", "mạng"], Icon: Wifi },
  { keywords: ["bồn tắm", "tắm", "spa"], Icon: Bath },
  { keywords: ["chiếu", "tv", "netflix", "cinema"], Icon: Tv },
  { keywords: ["ban công", "view", "cửa sổ", "vườn", "thung lũng"], Icon: Sun },
  { keywords: ["bbq", "nướng", "bếp"], Icon: Flame },
  { keywords: ["điều hòa", "máy lạnh", "quạt", "sấy"], Icon: Wind },
  { keywords: ["tủ lạnh", "mini bar", "minibar"], Icon: Refrigerator },
  { keywords: ["trà", "cà phê", "coffee", "ấm đun", "nước"], Icon: Coffee },
  { keywords: ["cao cấp", "ion", "lò sưởi"], Icon: Sparkles },
];

export function AmenityIcon({
  name,
  className = "h-4 w-4 shrink-0 text-[#065F46]",
}: {
  name: string;
  className?: string;
}) {
  const lower = name.toLowerCase();
  const match = ICON_RULES.find((rule) =>
    rule.keywords.some((kw) => lower.includes(kw)),
  );
  const Icon = match ? match.Icon : Check;
  return <Icon className={className} aria-hidden="true" />;
}
