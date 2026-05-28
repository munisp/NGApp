/**
 * useFilterPresets — save and recall named filter presets in localStorage
 * Usage:
 *   const { presets, savePreset, loadPreset, deletePreset } = useFilterPresets<MyFilters>("alarms-filters");
 */
import { useState, useEffect } from "react";

export interface FilterPreset<T> {
  id: string;
  name: string;
  filters: T;
  createdAt: string;
}

export function useFilterPresets<T>(storageKey: string) {
  const [presets, setPresets] = useState<FilterPreset<T>[]>(() => {
    try {
      const raw = localStorage.getItem(`og-rmm:presets:${storageKey}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(`og-rmm:presets:${storageKey}`, JSON.stringify(presets));
  }, [presets, storageKey]);

  const savePreset = (name: string, filters: T) => {
    const preset: FilterPreset<T> = {
      id: `${Date.now()}`,
      name,
      filters,
      createdAt: new Date().toISOString(),
    };
    setPresets(prev => [...prev.filter(p => p.name !== name), preset]);
    return preset;
  };

  const loadPreset = (id: string): FilterPreset<T> | undefined => {
    return presets.find(p => p.id === id);
  };

  const deletePreset = (id: string) => {
    setPresets(prev => prev.filter(p => p.id !== id));
  };

  return { presets, savePreset, loadPreset, deletePreset };
}
