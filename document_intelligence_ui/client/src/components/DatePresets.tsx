import { Button } from "@/components/ui/button";
import { DateRange } from "react-day-picker";

interface DatePresetsProps {
  onSelectPreset: (range: DateRange) => void;
}

export function DatePresets({ onSelectPreset }: DatePresetsProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const presets = [
    {
      label: "Today",
      getValue: () => ({
        from: today,
        to: today,
      }),
    },
    {
      label: "Last 7 Days",
      getValue: () => {
        const from = new Date(today);
        from.setDate(from.getDate() - 6);
        return { from, to: today };
      },
    },
    {
      label: "Last 30 Days",
      getValue: () => {
        const from = new Date(today);
        from.setDate(from.getDate() - 29);
        return { from, to: today };
      },
    },
    {
      label: "This Month",
      getValue: () => {
        const from = new Date(today.getFullYear(), today.getMonth(), 1);
        return { from, to: today };
      },
    },
  ];

  return (
    <div className="flex flex-wrap gap-2 mb-3">
      {presets.map((preset) => (
        <Button
          key={preset.label}
          variant="outline"
          size="sm"
          onClick={() => onSelectPreset(preset.getValue())}
          className="text-xs"
        >
          {preset.label}
        </Button>
      ))}
    </div>
  );
}
