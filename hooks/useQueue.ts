import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { Appointment } from '../types';

interface QueueStats {
  count: number;
  estimatedWaitTime: number; // 分钟
  isBusy: boolean;
  isFull: boolean;
}

interface UseQueueReturn {
  appointments: Appointment[];
  stats: QueueStats;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * 获取今日队列数据的 Hook
 * 自动计算等待时间和繁忙状态
 */
export const useQueue = (): UseQueueReturn => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const getTodayString = useCallback(() => {
    const d = new Date();
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }, []);

  const fetchQueueData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const todayStr = getTodayString();
      const { data, error: supaError } = await supabase
        .from('app_appointments')
        .select('*')
        .eq('date_str', todayStr)
        .eq('status', 'checked_in')
        .order('created_at', { ascending: true });

      if (supaError) throw new Error(supaError.message);
      setAppointments((data as unknown as Appointment[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      console.error('Error fetching queue:', err);
    } finally {
      setLoading(false);
    }
  }, [getTodayString]);

  useEffect(() => {
    fetchQueueData();
  }, [fetchQueueData]);

  // 使用 useMemo 缓存统计数据，避免重复计算
  const stats = useMemo<QueueStats>(() => {
    const count = appointments.length;
    const avgServiceTime = 15; // 平均服务时间 15 分钟
    const estimatedWaitTime = count * avgServiceTime;
    
    return {
      count,
      estimatedWaitTime,
      isBusy: count >= 5,
      isFull: count >= 10
    };
  }, [appointments]);

  return {
    appointments,
    stats,
    loading,
    error,
    refetch: fetchQueueData
  };
};

/**
 * 获取队列实时更新的 Hook
 * 订阅 Supabase 实时变化
 */
export const useRealtimeQueue = () => {
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel('queue_realtime')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'app_appointments',
          filter: "status=eq.checked_in"
        },
        (payload) => {
          setLastUpdate(new Date());
          console.log('[Realtime] Queue updated:', payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { lastUpdate };
};

/**
 * 获取指定理发师当前排队人数的 Hook
 */
export const useBarberQueue = (barberName: string) => {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!barberName) return;

    const fetchBarberQueue = async () => {
      const todayStr = `${new Date().getMonth() + 1}月${new Date().getDate()}日`;
      const { data } = await supabase
        .from('app_appointments')
        .select('id')
        .eq('date_str', todayStr)
        .eq('barber_name', barberName)
        .eq('status', 'checked_in');

      setCount(data?.length || 0);
      setLoading(false);
    };

    fetchBarberQueue();
  }, [barberName]);

  return { count, loading };
};
