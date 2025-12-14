import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Filter, X, ArrowUpDown } from "lucide-react";
import { DOCUMENT_CATEGORIES, DOCUMENT_STATUS } from "@shared/documentCategories";

interface FilterBarProps {
  categories: string[];
  statuses: string[];
  sortBy: "date" | "name" | "status";
  sortOrder: "asc" | "desc";
  onCategoriesChange: (categories: string[]) => void;
  onStatusesChange: (statuses: string[]) => void;
  onSortByChange: (sortBy: "date" | "name" | "status") => void;
  onSortOrderChange: (sortOrder: "asc" | "desc") => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  showCategories?: boolean;
}

export function FilterBar({
  categories,
  statuses,
  sortBy,
  sortOrder,
  onCategoriesChange,
  onStatusesChange,
  onSortByChange,
  onSortOrderChange,
  onClearFilters,
  hasActiveFilters,
  showCategories = true,
}: FilterBarProps) {
  const toggleCategory = (categoryId: string) => {
    if (categories.includes(categoryId)) {
      onCategoriesChange(categories.filter((c) => c !== categoryId));
    } else {
      onCategoriesChange([...categories, categoryId]);
    }
  };

  const toggleStatus = (statusId: string) => {
    if (statuses.includes(statusId)) {
      onStatusesChange(statuses.filter((s) => s !== statusId));
    } else {
      onStatusesChange([...statuses, statusId]);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Category Filter */}
      {showCategories && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              Category
              {categories.length > 0 && (
                <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-xs">
                  {categories.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-3">
              <div className="font-semibold text-sm">Filter by Category</div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {Object.values(DOCUMENT_CATEGORIES).map((category) => (
                  <div key={category.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`category-${category.id}`}
                      checked={categories.includes(category.id)}
                      onCheckedChange={() => toggleCategory(category.id)}
                    />
                    <Label
                      htmlFor={`category-${category.id}`}
                      className="flex items-center gap-2 cursor-pointer flex-1"
                    >
                      <span className="text-lg">{category.icon}</span>
                      <span className="text-sm">{category.label}</span>
                    </Label>
                  </div>
                ))}
              </div>
              {categories.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onCategoriesChange([])}
                  className="w-full"
                >
                  Clear Categories
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Status Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" />
            Status
            {statuses.length > 0 && (
              <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-xs">
                {statuses.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="start">
          <div className="space-y-3">
            <div className="font-semibold text-sm">Filter by Status</div>
            <div className="space-y-2">
              {Object.entries(DOCUMENT_STATUS).map(([statusId, statusInfo]) => (
                <div key={statusId} className="flex items-center space-x-2">
                  <Checkbox
                    id={`status-${statusId}`}
                    checked={statuses.includes(statusId)}
                    onCheckedChange={() => toggleStatus(statusId)}
                  />
                  <Label
                    htmlFor={`status-${statusId}`}
                    className="flex items-center gap-2 cursor-pointer flex-1"
                  >
                    <span className="text-sm">{statusInfo.label}</span>
                  </Label>
                </div>
              ))}
            </div>
            {statuses.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onStatusesChange([])}
                className="w-full"
              >
                Clear Statuses
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Sort */}
      <Select value={sortBy} onValueChange={(value: any) => onSortByChange(value)}>
        <SelectTrigger className="w-[140px] h-9">
          <ArrowUpDown className="mr-2 h-4 w-4" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="date">Date</SelectItem>
          <SelectItem value="name">Name</SelectItem>
          <SelectItem value="status">Status</SelectItem>
        </SelectContent>
      </Select>

      {/* Sort Order */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onSortOrderChange(sortOrder === "asc" ? "desc" : "asc")}
      >
        {sortOrder === "asc" ? "↑" : "↓"}
      </Button>

      {/* Clear All */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClearFilters}>
          <X className="mr-2 h-4 w-4" />
          Clear Filters
        </Button>
      )}
    </div>
  );
}
