import { useState, useCallback, useRef, useEffect } from 'react';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

interface UseAsyncOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
  immediate?: boolean;
}

/**
 * 通用异步操作 Hook
 * 统一管理 loading、error、data 状态
 */
export function useAsync<T = any>(
  asyncFunction: (...args: any[]) => Promise<T>,
  options: UseAsyncOptions = {}
) {
  const { onSuccess, onError, immediate = false } = options;
  
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: immediate,
    error: null
  });

  const isMountedRef = useRef(true);

  // 组件卸载时标记
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const execute = useCallback(async (...args: any[]) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const data = await asyncFunction(...args);
      
      if (isMountedRef.current) {
        setState({ data, loading: false, error: null });
        onSuccess?.(data);
      }
      
      return data;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      
      if (isMountedRef.current) {
        setState({ data: null, loading: false, error: err });
        onError?.(err);
      }
      
      throw err;
    }
  }, [asyncFunction, onSuccess, onError]);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    ...state,
    execute,
    reset
  };
}

/**
 * 带重试机制的异步 Hook
 */
export function useAsyncWithRetry<T = any>(
  asyncFunction: (...args: any[]) => Promise<T>,
  options: UseAsyncOptions & { retries?: number; delay?: number } = {}
) {
  const { retries = 3, delay = 1000, ...asyncOptions } = options;
  
  const retryAsyncFunction = useCallback(async (...args: any[]) => {
    let lastError: Error;
    
    for (let i = 0; i < retries; i++) {
      try {
        return await asyncFunction(...args);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
        }
      }
    }
    
    throw lastError!;
  }, [asyncFunction, retries, delay]);

  return useAsync<T>(retryAsyncFunction, asyncOptions);
}
