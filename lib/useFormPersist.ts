"use client";
import { useState, useEffect, useCallback } from "react";

/**
 * A hook that persists form state to localStorage.
 * Automatically saves state on every change and restores it on mount.
 */
export function useFormPersist<T>(key: string, initialValue: T) {
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const saved = localStorage.getItem(key);
      if (saved) return JSON.parse(saved);
    } catch {}
    return initialValue;
  });

  // Save to localStorage whenever state changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }, [key, state]);

  // Clear saved state on successful form submission
  const clearSaved = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch {}
  }, [key]);

  return [state, setState, clearSaved] as const;
}