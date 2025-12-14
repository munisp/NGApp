import { useState, useMemo, useCallback, useEffect } from "react";
import { useLocation } from "wouter";

export interface FilterState {
  search: string;
  categories: string[];
  statuses: string[];
  dateFrom: Date | null;
  dateTo: Date | null;
  sortBy: "date" | "name" | "status";
  sortOrder: "asc" | "desc";
}

export function useFilters<T>(
  items: T[],
  filterFn: (item: T, filters: FilterState) => boolean
) {
  const [location, setLocation] = useLocation();
  
  // Initialize filters from URL params
  const getInitialFilters = (): FilterState => {
    const params = new URLSearchParams(window.location.search);
    return {
      search: params.get('search') || "",
      categories: params.get('categories') ? params.get('categories')!.split(',') : [],
      statuses: params.get('statuses') ? params.get('statuses')!.split(',') : [],
      dateFrom: params.get('dateFrom') ? new Date(params.get('dateFrom')!) : null,
      dateTo: params.get('dateTo') ? new Date(params.get('dateTo')!) : null,
      sortBy: (params.get('sortBy') as FilterState['sortBy']) || "date",
      sortOrder: (params.get('sortOrder') as FilterState['sortOrder']) || "desc",
    };
  };

  const [filters, setFilters] = useState<FilterState>(getInitialFilters());

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.categories.length > 0) params.set('categories', filters.categories.join(','));
    if (filters.statuses.length > 0) params.set('statuses', filters.statuses.join(','));
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom.toISOString());
    if (filters.dateTo) params.set('dateTo', filters.dateTo.toISOString());
    if (filters.sortBy !== 'date') params.set('sortBy', filters.sortBy);
    if (filters.sortOrder !== 'desc') params.set('sortOrder', filters.sortOrder);
    
    const newUrl = params.toString() ? `?${params.toString()}` : location.split('?')[0];
    if (newUrl !== window.location.search) {
      window.history.replaceState({}, '', location.split('?')[0] + (params.toString() ? `?${params.toString()}` : ''));
    }
  }, [filters, location]);

  const updateFilter = useCallback(
    <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const clearFilters = useCallback(() => {
    setFilters({
      search: "",
      categories: [],
      statuses: [],
      dateFrom: null,
      dateTo: null,
      sortBy: "date",
      sortOrder: "desc",
    });
  }, []);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.search !== "" ||
      filters.categories.length > 0 ||
      filters.statuses.length > 0 ||
      filters.dateFrom !== null ||
      filters.dateTo !== null
    );
  }, [filters]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => filterFn(item, filters));
  }, [items, filters, filterFn]);

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a: any, b: any) => {
      let aValue: any;
      let bValue: any;

      switch (filters.sortBy) {
        case "date":
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case "name":
          aValue = (a.filename || a.name || "").toLowerCase();
          bValue = (b.filename || b.name || "").toLowerCase();
          break;
        case "status":
          aValue = a.status;
          bValue = b.status;
          break;
        default:
          return 0;
      }

      if (filters.sortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }, [filteredItems, filters.sortBy, filters.sortOrder]);

  return {
    filters,
    updateFilter,
    clearFilters,
    hasActiveFilters,
    filteredItems: sortedItems,
    totalCount: items.length,
    filteredCount: sortedItems.length,
  };
}
