import { useCallback, useEffect, useState } from 'react'

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key)
      return item ? (JSON.parse(item) as T) : initialValue
    } catch {
      return initialValue
    }
  })

  const setValue = useCallback(
    (value: T) => {
      setStoredValue(value)
      localStorage.setItem(key, JSON.stringify(value))
    },
    [key],
  )

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === key) {
        try {
          const newValue = event.newValue ? (JSON.parse(event.newValue) as T) : initialValue
          setStoredValue(newValue)
        } catch {
          setStoredValue(initialValue)
        }
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [key, initialValue])

  return [storedValue, setValue]
}
