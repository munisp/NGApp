import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/contexts/LanguageContext";
import { Globe } from "lucide-react";

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 border border-zinc-700 px-3"
        >
          <Globe className="h-4 w-4" />
          <span className="text-xs font-mono font-semibold">
            {language === "ar" ? "عربي" : "EN"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="bg-zinc-900 border-zinc-700 text-zinc-100 min-w-[140px]"
      >
        <DropdownMenuItem
          onClick={() => setLanguage("en")}
          className={`cursor-pointer hover:bg-zinc-800 hover:text-amber-400 ${
            language === "en" ? "text-amber-400 font-semibold" : "text-zinc-300"
          }`}
        >
          <span className="mr-2">🇺🇸</span> English
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setLanguage("ar")}
          className={`cursor-pointer hover:bg-zinc-800 hover:text-amber-400 ${
            language === "ar" ? "text-amber-400 font-semibold" : "text-zinc-300"
          }`}
        >
          <span className="mr-2">🇰🇼</span> العربية
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
