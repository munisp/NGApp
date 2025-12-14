import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HelpCircle, PlayCircle, BookOpen, FileText, Upload, BarChart3, Layers } from "lucide-react";

interface HelpMenuProps {
  onStartTour?: (tourKey: string) => void;
}

export default function HelpMenu({ onStartTour }: HelpMenuProps) {
  const tours = [
    {
      key: 'analytics',
      title: 'Analytics Dashboard Tour',
      description: 'Learn about KPIs, charts, and data insights',
      icon: BarChart3,
      path: '/analytics',
    },
    {
      key: 'upload',
      title: 'Document Upload Tour',
      description: 'Upload and process single documents',
      icon: Upload,
      path: '/upload',
    },
    {
      key: 'batch-upload',
      title: 'Batch Upload Tour',
      description: 'Process multiple documents simultaneously',
      icon: Layers,
      path: '/batch-upload',
    },
    {
      key: 'documents',
      title: 'Documents Page Tour',
      description: 'Search, filter, and manage your documents',
      icon: FileText,
      path: '/documents',
    },
  ];

  const handleTourStart = (tourKey: string, path: string) => {
    // Navigate to the page first
    window.location.href = path;
    // Trigger tour after navigation
    setTimeout(() => {
      if (onStartTour) {
        onStartTour(tourKey);
      } else {
        // Fallback: trigger tour via localStorage
        localStorage.setItem(`tour_${tourKey}_trigger`, 'true');
        window.location.reload();
      }
    }, 500);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <HelpCircle className="h-5 w-5" />
          <span className="sr-only">Help & Tours</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          Help & Guided Tours
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <div className="px-2 py-1.5">
          <p className="text-sm text-muted-foreground mb-3">
            Start a guided tour to learn about different features
          </p>
        </div>

        {tours.map((tour) => (
          <DropdownMenuItem
            key={tour.key}
            onClick={() => handleTourStart(tour.key, tour.path)}
            className="flex items-start gap-3 p-3 cursor-pointer"
          >
            <tour.icon className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
            <div className="flex-1">
              <div className="font-medium text-sm">{tour.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {tour.description}
              </div>
            </div>
            <PlayCircle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        
        <DropdownMenuItem asChild>
          <a
            href="/docs/architecture"
            className="flex items-center gap-2 cursor-pointer"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FileText className="h-4 w-4" />
            <span>Documentation</span>
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
