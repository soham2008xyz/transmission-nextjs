import { useState, useEffect } from "react";

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T) => void] {
  const getInitial = () => {
    if (typeof window === "undefined") return initialValue;
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : initialValue;
    } catch {
      return initialValue;
    }
  };

  const [storedValue, setStoredValue] = useState<T>(getInitial);

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(storedValue));
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}
