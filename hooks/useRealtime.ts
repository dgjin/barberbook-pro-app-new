import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';

interface RealtimeOptions {
  table: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
  onAny?: (payload: any) => void;
}

/**
 * 通用实时订阅 Hook
 * 简化 Supabase Realtime 的使用
 */
export const useRealtime = (options: RealtimeOptions) => {
  const {
    table,
    event = '*',
    filter,
    onInsert,
    onUpdate,
    onDelete,
    onAny
  } = options;

  const callbacksRef = useRef({ onInsert, onUpdate, onDelete, onAny });
  const channelRef = useRef<any>(null);

  // 保持回调引用最新
  useEffect(() => {
    callbacksRef.current = { onInsert, onUpdate, onDelete, onAny };
  }, [onInsert, onUpdate, onDelete, onAny]);

  const handlePayload = useCallback((payload: any) => {
    const { eventType } = payload;
    const callbacks = callbacksRef.current;

    // 调用特定事件回调
    switch (eventType) {
      case 'INSERT':
        callbacks.onInsert?.(payload);
        break;
      case 'UPDATE':
        callbacks.onUpdate?.(payload);
        break;
      case 'DELETE':
        callbacks.onDelete?.(payload);
        break;
    }

    // 调用通用回调
    callbacks.onAny?.(payload);
  }, []);

  // 使用稳定的 key 来避免重复订阅
  const filterKey = filter || '';

  useEffect(() => {
    let isActive = true;
    const channelName = `realtime_${table}_${event}_${filterKey}`;

    const channel = supabase.channel(channelName);

    channel.on(
      'postgres_changes',
      {
        event,
        schema: 'public',
        table,
        filter
      },
      handlePayload
    )
      .subscribe((status, err) => {
        // 移除 subscribe 内部的 removeChannel 调用以防止某些环境下的递归死循环 (Stack Overflow)
        if (err) console.error(`Realtime subscription error [${table}]:`, err);
      });

    return () => {
      isActive = false;
      // 直接同步移除或通过更安全的方式管理逻辑
      // 避免 setTimeout 导致的竞态条件和潜藏的递归风险
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, event, filterKey]); // 使用 filterKey 替代 filter
};

/**
 * 批量订阅多个表的 Hook
 */
export const useMultiRealtime = (subscriptions: RealtimeOptions[]) => {
  useEffect(() => {
    let isActive = true;
    const channels = subscriptions.map((sub, index) => {
      const channelName = `multi_realtime_${sub.table}_${index}_${Date.now()}`;

      const channel = supabase.channel(channelName);
      channel.on(
        'postgres_changes',
        {
          event: sub.event || '*',
          schema: 'public',
          table: sub.table,
          filter: sub.filter
        },
        (payload) => {
          const { eventType } = payload;
          switch (eventType) {
            case 'INSERT': sub.onInsert?.(payload); break;
            case 'UPDATE': sub.onUpdate?.(payload); break;
            case 'DELETE': sub.onDelete?.(payload); break;
          }
          sub.onAny?.(payload);
        }
      )
        .subscribe((status, err) => {
          if (err) console.error(`Multi-Realtime subscription error [${sub.table}]:`, err);
        });

      return channel;
    });

    return () => {
      isActive = false;
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [subscriptions]);
};
