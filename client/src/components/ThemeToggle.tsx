import { Moon, Sun, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  size?: "sm" | "default";
  showLabel?: boolean;
}

export default function ThemeToggle({ className, size = "default", showLabel = false }: ThemeToggleProps) {
  const { theme, toggleTheme, switchable, isSyncing } = useTheme();

  if (!switchable || !toggleTheme) return null;

  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <Button
      variant="ghost"
      size={size === "sm" ? "sm" : "default"}
      onClick={toggleTheme}
      className={cn("gap-2", className)}
      title={theme === "dark" ? "Switch to light mode (synced across devices)" : "Switch to dark mode (synced across devices)"}
    >
      {isSyncing ? (
        <Loader2 className={cn(iconSize, "animate-spin")} />
      ) : theme === "dark" ? (
        <Sun className={iconSize} />
      ) : (
        <Moon className={iconSize} />
      )}
      {showLabel && (
        <span className="text-sm">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
      )}
    </Button>
  );
}
