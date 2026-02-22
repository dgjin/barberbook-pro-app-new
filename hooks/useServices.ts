import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { ServiceItem } from '../types';

interface UseServicesReturn {
  services: ServiceItem[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * 获取服务项目列表
 */
export const useServices = (): UseServicesReturn => {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: supaError } = await supabase
        .from('app_services')
        .select('*')
        .order('price', { ascending: true });

      if (supaError) throw new Error(supaError.message);
      setServices((data as unknown as ServiceItem[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch services'));
      console.error('Error fetching services:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  return { services, loading, error, refetch: fetchServices };
};

interface SystemConfig {
  openTime: string;
  closeTime: string;
  serviceDuration: number;
  maxAppointments?: number;
}

interface UseSystemConfigReturn {
  config: SystemConfig;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const DEFAULT_CONFIG: SystemConfig = {
  openTime: '10:00',
  closeTime: '21:00',
  serviceDuration: 45,
  maxAppointments: 24
};

/**
 * 获取系统配置
 */
export const useSystemConfig = (): UseSystemConfigReturn => {
  const [config, setConfig] = useState<SystemConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: supaError } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'global_config')
        .single();

      if (supaError) throw new Error(supaError.message);
      
      if (data?.value) {
        setConfig(prev => ({ ...prev, ...data.value }));
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch config'));
      console.error('Error fetching config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return { config, loading, error, refetch: fetchConfig };
};

interface DateOption {
  day: string;
  date: number;
  month: number;
  fullDate: Date;
  dateString: string;
}

interface UseDateOptionsReturn {
  dates: DateOption[];
  selectedDate: DateOption | null;
  setSelectedDate: (date: DateOption) => void;
}

/**
 * 生成日期选项（未来14天）
 */
export const useDateOptions = (days: number = 14): UseDateOptionsReturn => {
  const [dates, setDates] = useState<DateOption[]>([]);
  const [selectedDate, setSelectedDate] = useState<DateOption | null>(null);

  useEffect(() => {
    const today = new Date();
    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const dateOptions: DateOption[] = [];

    for (let i = 0; i < days; i++) {
      const nextDay = new Date(today);
      nextDay.setDate(today.getDate() + i);
      const month = nextDay.getMonth() + 1;
      const date = nextDay.getDate();
      
      dateOptions.push({
        day: i === 0 ? '今天' : i === 1 ? '明天' : dayNames[nextDay.getDay()],
        date,
        month,
        fullDate: nextDay,
        dateString: `${month}月${date}日`
      });
    }

    setDates(dateOptions);
    setSelectedDate(dateOptions[0]);
  }, [days]);

  return { dates, selectedDate, setSelectedDate };
};

interface UseTimeSlotsOptions {
  barberName?: string;
  dateString?: string;
  config: SystemConfig;
}

interface UseTimeSlotsReturn {
  timeSlots: string[];
  bookedSlots: string[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  checkIsPast: (time: string, date: DateOption | null) => boolean;
}

/**
 * 获取可用时间槽
 */
export const useTimeSlots = (options: UseTimeSlotsOptions): UseTimeSlotsReturn => {
  const { barberName, dateString, config } = options;
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // 生成所有时间槽
  const timeSlots: string[] = [];
  let current = new Date(`2000-01-01T${config.openTime}`);
  const end = new Date(`2000-01-01T${config.closeTime}`);

  while (current < end) {
    timeSlots.push(
      current.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    );
    current.setMinutes(current.getMinutes() + config.serviceDuration);
  }

  // 获取已预订的时间槽
  const fetchBookedSlots = useCallback(async () => {
    if (!barberName || !dateString) return;
    
    setLoading(true);
    setError(null);

    try {
      const { data, error: supaError } = await supabase
        .from('app_appointments')
        .select('time_str')
        .eq('barber_name', barberName)
        .eq('date_str', dateString)
        .in('status', ['confirmed', 'pending', 'checked_in']);

      if (supaError) throw new Error(supaError.message);
      setBookedSlots(data?.map((appt: any) => appt.time_str) || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch booked slots'));
      console.error('Error fetching booked slots:', err);
    } finally {
      setLoading(false);
    }
  }, [barberName, dateString]);

  useEffect(() => {
    fetchBookedSlots();
  }, [fetchBookedSlots]);

  // 检查时间是否过期
  const checkIsPast = useCallback((time: string, selectedDate: DateOption | null): boolean => {
    if (!selectedDate) return false;
    
    const now = new Date();
    // 如果不是今天，永不过期
    if (selectedDate.date !== now.getDate() || selectedDate.month !== (now.getMonth() + 1)) {
      return false;
    }

    const [h, m] = time.split(':').map(Number);
    const slotTime = new Date();
    slotTime.setHours(h, m, 0, 0);
    return slotTime < now;
  }, []);

  return {
    timeSlots,
    bookedSlots,
    loading,
    error,
    refetch: fetchBookedSlots,
    checkIsPast
  };
};
