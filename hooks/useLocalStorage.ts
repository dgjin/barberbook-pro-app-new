import { useState, useCallback, useEffect } from 'react';

/**
 * 持久化状态 Hook
 * 自动同步 localStorage
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  // 获取初始值
  const getStoredValue = useCallback((): T => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  }, [key, initialValue]);

  const [storedValue, setStoredValue] = useState<T>(getStoredValue);

  // 设置值并同步到 localStorage
  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    try {
      setStoredValue(prev => {
        const valueToStore = value instanceof Function ? value(prev) : value;
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
        return valueToStore;
      });
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  }, [key]);

  // 移除值
  const removeValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (error) {
      console.warn(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  // 监听其他窗口的变化
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key && event.newValue !== null) {
        setStoredValue(JSON.parse(event.newValue));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return [storedValue, setValue, removeValue];
}

/**
 * 用户偏好设置 Hook
 */
export function useUserPreferences() {
  const [preferences, setPreferences, resetPreferences] = useLocalStorage('user_preferences', {
    darkMode: false,
    notifications: true,
    language: 'zh-CN'
  });

  const updatePreference = useCallback((key: string, value: any) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  }, [setPreferences]);

  return {
    preferences,
    updatePreference,
    resetPreferences
  };
}

/**
 * 最近浏览 Hook
 */
export function useRecentViews<T extends { id: string | number }>(
  key: string,
  maxItems: number = 10
) {
  const [recent, setRecent] = useLocalStorage<T[]>(`recent_${key}`, []);

  const addToRecent = useCallback((item: T) => {
    setRecent(prev => {
      // 移除已存在的相同项
      const filtered = prev.filter(i => i.id !== item.id);
      // 添加到开头并限制数量
      return [item, ...filtered].slice(0, maxItems);
    });
  }, [setRecent, maxItems]);

  const clearRecent = useCallback(() => {
    setRecent([]);
  }, [setRecent]);

  return {
    recent,
    addToRecent,
    clearRecent
  };
}
