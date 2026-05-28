import { useTranslation } from "react-i18next";
import { Shield, ShieldAlert, ShieldCheck, ShieldOff } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type DataClassification = "public" | "internal" | "confidential" | "restricted";

interface DataClassificationBadgeProps {
  classification: DataClassification;
  showLabel?: boolean;
  size?: "sm" | "md";
}

const classificationConfig: Record<
  DataClassification,
  {  icon: React.FC<{ className?: string }>;color: string; bg: string; border: string }
> = {
  public: {
    icon: ShieldOff,
    color: "text-zinc-400",
    bg: "bg-zinc-800",
    border: "border-zinc-600",
  },
  internal: {
    icon: Shield,
    color: "text-blue-400",
    bg: "bg-blue-950",
    border: "border-blue-700",
  },
  confidential: {
    icon: ShieldCheck,
    color: "text-amber-400",
    bg: "bg-amber-950",
    border: "border-amber-700",
  },
  restricted: {
    icon: ShieldAlert,
    color: "text-red-400",
    bg: "bg-red-950",
    border: "border-red-700",
  },
};

export function DataClassificationBadge({
  classification,
  showLabel = true,
  size = "sm",
}: DataClassificationBadgeProps) {
  const { t } = useTranslation();
  const config = classificationConfig[classification];
  const Icon = config.icon;
  const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-mono font-semibold uppercase tracking-wider
            ${config.color} ${config.bg} ${config.border} ${textSize} cursor-default`}
        >
          <Icon className={iconSize} />
          {showLabel && t(`classification.${classification}`)}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side={"top" as const}
        className="bg-zinc-800 border-zinc-600 text-zinc-200 text-xs max-w-[200px]"
      >
        <p className="font-semibold mb-1">
          {t("classification.label")}: {t(`classification.${classification}`)}
        </p>
        <p>{t(`classification.tooltip.${classification}`)}</p>
      </TooltipContent>
    </Tooltip>
  );
}
