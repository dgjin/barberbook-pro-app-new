import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Barber } from '../types';

interface UseBarbersOptions {
  limit?: number;
  orderBy?: 'rating' | 'service_count' | 'name';
  ascending?: boolean;
  status?: 'active' | 'busy' | 'rest' | 'all';
}

interface UseBarbersReturn {
  barbers: Barber[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  getBarberById: (id: number) => Barber | undefined;
}

/**
 * 获取理发师列表的 Hook
 * @param options 配置选项
 * @returns 理发师数据及相关状态
 */
export const useBarbers = (options: UseBarbersOptions = {}): UseBarbersReturn => {
  const { 
    limit = 10, 
    orderBy = 'rating', 
    ascending = false,
    status = 'all'
  } = options;

  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchBarbers = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      let query = supabase
        .from('app_barbers')
        .select('*')
        .order(orderBy, { ascending })
        .limit(limit);

      if (status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error: supaError } = await query;

      if (supaError) throw new Error(supaError.message);
      setBarbers((data as unknown as Barber[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      console.error('Error fetching barbers:', err);
    } finally {
      setLoading(false);
    }
  }, [limit, orderBy, ascending, status]);

  useEffect(() => {
    fetchBarbers();
  }, [fetchBarbers]);

  const getBarberById = useCallback((id: number) => {
    return barbers.find(b => b.id === id);
  }, [barbers]);

  return {
    barbers,
    loading,
    error,
    refetch: fetchBarbers,
    getBarberById
  };
};

/**
 * 获取单个理发师详情的 Hook
 */
export const useBarberDetail = (barberId: number | null) => {
  const [barber, setBarber] = useState<Barber | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!barberId) {
      setBarber(null);
      return;
    }

    const fetchBarber = async () => {
      setLoading(true);
      try {
        const { data, error: supaError } = await supabase
          .from('app_barbers')
          .select('*')
          .eq('id', barberId)
          .single();

        if (supaError) throw new Error(supaError.message);
        setBarber(data as unknown as Barber);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    fetchBarber();
  }, [barberId]);

  return { barber, loading, error };
};
