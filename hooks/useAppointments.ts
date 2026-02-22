import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { Appointment, User } from '../types';

interface UseUserAppointmentsOptions {
  userName?: string;
  status?: string[];
}

interface UseUserAppointmentsReturn {
  appointments: Appointment[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  cancelAppointment: (id: number) => Promise<void>;
  checkInAppointment: (id: number) => Promise<void>;
}

// 默认状态常量（避免每次创建新数组）
const DEFAULT_STATUSES = ['confirmed', 'pending', 'checked_in'];

/**
 * 获取用户的预约列表
 */
export const useUserAppointments = (options: UseUserAppointmentsOptions): UseUserAppointmentsReturn => {
  const { userName, status } = options;

  // 使用 useMemo 缓存状态数组，避免无限循环
  const statusKey = useMemo(() => {
    return (status || DEFAULT_STATUSES).join(',');
  }, [status]);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAppointments = useCallback(async () => {
    if (!userName) {
      setAppointments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const statusArray = status || DEFAULT_STATUSES;

    try {
      let query = supabase
        .from('app_appointments')
        .select('*')
        .eq('customer_name', userName)
        .order('id', { ascending: false });

      if (statusArray.length > 0) {
        query = query.in('status', statusArray);
      }

      const { data, error: supaError } = await query;

      if (supaError) throw new Error(supaError.message);
      setAppointments((data as unknown as Appointment[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch appointments'));
      console.error('Error fetching appointments:', err);
    } finally {
      setLoading(false);
    }
  }, [userName, statusKey]); // 使用 statusKey 而不是 status

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // 取消预约
  const cancelAppointment = useCallback(async (id: number) => {
    try {
      const { error } = await supabase
        .from('app_appointments')
        .update({ status: 'cancelled' })
        .eq('id', id);

      if (error) throw error;
      await fetchAppointments();
    } catch (err) {
      console.error('Error cancelling appointment:', err);
      throw err;
    }
  }, [fetchAppointments]);

  // 签到
  const checkInAppointment = useCallback(async (id: number) => {
    try {
      const { error } = await supabase
        .from('app_appointments')
        .update({ status: 'checked_in' })
        .eq('id', id);

      if (error) throw error;
      await fetchAppointments();
    } catch (err) {
      console.error('Error checking in:', err);
      throw err;
    }
  }, [fetchAppointments]);

  return {
    appointments,
    loading,
    error,
    refetch: fetchAppointments,
    cancelAppointment,
    checkInAppointment
  };
};

interface UseBarberAppointmentsOptions {
  barberName?: string;
  dateString?: string;
  status?: string[];
}

interface UseBarberAppointmentsReturn {
  appointments: Appointment[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  customerAvatars: Record<string, string>;
  completeAppointment: (id: number, customerName: string, barberName: string, currentUser?: User | null) => Promise<boolean>;
  scanCheckIn: (apptId: string) => Promise<void>;
}

// 默认状态常量
const DEFAULT_BARBER_STATUSES = ['confirmed', 'pending', 'checked_in'];

/**
 * 获取理发师的预约列表（工作台用）
 */
export const useBarberAppointments = (options: UseBarberAppointmentsOptions): UseBarberAppointmentsReturn => {
  const { barberName, dateString, status } = options;

  // 使用 useMemo 缓存状态数组
  const statusKey = useMemo(() => {
    return (status || DEFAULT_BARBER_STATUSES).join(',');
  }, [status]);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customerAvatars, setCustomerAvatars] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAppointments = useCallback(async () => {
    if (!barberName || !dateString) {
      setAppointments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const statusArray = status || DEFAULT_BARBER_STATUSES;

    try {
      const { data, error: supaError } = await supabase
        .from('app_appointments')
        .select('*')
        .eq('barber_name', barberName)
        .eq('date_str', dateString)
        .in('status', statusArray)
        .order('time_str', { ascending: true });

      if (supaError) throw new Error(supaError.message);

      const appts = (data as unknown as Appointment[]) || [];
      setAppointments(appts);

      // 批量获取客户头像
      if (appts.length > 0) {
        const customerNames = Array.from(new Set(appts.map(a => a.customer_name)));
        const { data: userData } = await supabase
          .from('app_customers')
          .select('name, avatar')
          .in('name', customerNames);

        if (userData) {
          const avatarMap: Record<string, string> = {};
          userData.forEach((u: any) => {
            if (u.avatar) avatarMap[u.name] = u.avatar;
          });
          setCustomerAvatars(avatarMap);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch appointments'));
      console.error('Error fetching barber appointments:', err);
    } finally {
      setLoading(false);
    }
  }, [barberName, dateString, statusKey]); // 使用 statusKey

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // 完成服务并结算 (优化版：使用 RPC 原子操作)
  const completeAppointment = useCallback(async (
    id: number,
    customerName: string,
    barberName: string,
    currentUser?: User | null
  ): Promise<boolean> => {
    try {
      // 1. 发起原子化结算请求 (RPC)
      // 这将在一个事务中完成凭证扣除、业绩增加和状态更新
      const rpcPromise = supabase.rpc('complete_barber_service_v2', {
        p_appointment_id: id,
        p_customer_name: customerName,
        p_barber_name: barberName
      });

      // 2. 并行记录日志 (非阻塞)
      const logPromise = currentUser ? supabase.from('app_logs').insert({
        user: currentUser.name,
        role: 'barber',
        action: '完成服务',
        details: `完成了顾客 ${customerName} 的服务 (单号: #${id})`,
        type: 'info'
      }) : Promise.resolve();

      // 等待核心逻辑完成
      const { data, error: rpcError } = await rpcPromise;

      if (rpcError) throw rpcError;

      const usedVoucher = data?.used_voucher || false;

      // 重新拉取数据保证 UI 同步
      await fetchAppointments();

      return usedVoucher;
    } catch (err) {
      console.error('Error completing appointment (optimized):', err);
      throw err;
    }
  }, [fetchAppointments]);

  // 扫码签到 (加固版：增加权属校验)
  const scanCheckIn = useCallback(async (apptId: string) => {
    if (!barberName) throw new Error('未识别理发师身份');
    try {
      const numericId = parseInt(apptId, 10);
      if (isNaN(numericId)) {
        throw new Error('无效的预约单号，请输入数字');
      }

      const { data, error } = await supabase
        .from('app_appointments')
        .update({ status: 'checked_in' })
        .eq('id', numericId)
        .eq('barber_name', barberName) // 核心加固：防止越权核销他人订单
        .select();

      if (error) throw new Error(error.message || '数据库更新失败');
      if (!data || data.length === 0) {
        throw new Error('未找到属于您的有效预约单，请检查单号');
      }

      await fetchAppointments();
      return data[0];
    } catch (err) {
      console.error('Error scanning check-in:', err);
      throw err;
    }
  }, [fetchAppointments, barberName]);

  return {
    appointments,
    loading,
    error,
    refetch: fetchAppointments,
    customerAvatars,
    completeAppointment,
    scanCheckIn
  };
};

interface QueuePosition {
  position: number;
  waitTime: number;
}

interface UseQueuePositionOptions {
  appointmentId?: number;
  barberName?: string;
  dateString?: string;
}

/**
 * 计算队列位置
 */
export const useQueuePosition = (options: UseQueuePositionOptions) => {
  const { appointmentId, barberName, dateString } = options;
  const [queueInfo, setQueueInfo] = useState<QueuePosition>({ position: 0, waitTime: 0 });
  const [loading, setLoading] = useState(false);

  const fetchQueuePosition = useCallback(async () => {
    if (!appointmentId || !barberName || !dateString) {
      setQueueInfo({ position: 0, waitTime: 0 });
      return;
    }

    setLoading(true);
    try {
      const { data } = await supabase
        .from('app_appointments')
        .select('id, time_str')
        .eq('barber_name', barberName)
        .eq('date_str', dateString)
        .in('status', ['confirmed', 'pending', 'checked_in'])
        .order('time_str', { ascending: true });

      if (data) {
        const index = data.findIndex((a: any) => a.id === appointmentId);
        if (index !== -1) {
          setQueueInfo({
            position: index + 1,
            waitTime: index * 20 // 平均等待20分钟每人
          });
        }
      }
    } catch (err) {
      console.error('Error fetching queue position:', err);
    } finally {
      setLoading(false);
    }
  }, [appointmentId, barberName, dateString]);

  useEffect(() => {
    fetchQueuePosition();
  }, [fetchQueuePosition]);

  return { ...queueInfo, loading, refetch: fetchQueuePosition };
};

interface DaySaturation {
  dayName: string;
  dateStr: string;
  fullDate: Date;
  count: number;
  percentage: number;
  status: 'low' | 'medium' | 'high' | 'full';
}

interface UseSaturationOptions {
  appointments: Appointment[];
  openTime: string;
  closeTime: string;
  serviceDuration: number;
}

/**
 * 计算饱和度数据
 */
export const useSaturation = (options: UseSaturationOptions): DaySaturation[] => {
  const { appointments, openTime, closeTime, serviceDuration } = options;

  return useMemo(() => {
    const days: DaySaturation[] = [];
    const today = new Date();
    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

    const [openH, openM] = openTime.split(':').map(Number);
    const [closeH, closeM] = closeTime.split(':').map(Number);
    const totalMinutes = (closeH * 60 + closeM) - (openH * 60 + openM);
    const slotsPerDay = Math.max(1, Math.floor(totalMinutes / serviceDuration));

    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateStr = `${d.getMonth() + 1}月${d.getDate()}日`;
      const count = appointments.filter(a => a.date_str === dateStr).length;
      const percentage = Math.min(100, Math.round((count / slotsPerDay) * 100));

      let status: 'low' | 'medium' | 'high' | 'full' = 'low';
      if (percentage >= 100) status = 'full';
      else if (percentage >= 80) status = 'high';
      else if (percentage >= 40) status = 'medium';

      days.push({
        dayName: i === 0 ? '今天' : i === 1 ? '明天' : dayNames[d.getDay()],
        dateStr,
        fullDate: d,
        count,
        percentage,
        status
      });
    }

    return days;
  }, [appointments, openTime, closeTime, serviceDuration]);
};

interface UseBarberSaturationOptions {
  barberName?: string;
  openTime: string;
  closeTime: string;
  serviceDuration: number;
}

/**
 * 获取理发师未来7天的真实饱和度统计 (直接从后端全量拉取)
 */
export const useBarberSaturation = (options: UseBarberSaturationOptions): DaySaturation[] => {
  const { barberName, openTime, closeTime, serviceDuration } = options;
  const [days, setDays] = useState<DaySaturation[]>([]);

  const fetchStats = useCallback(async () => {
    if (!barberName) return;

    // 1. 生成未来 7 天的日期序列
    const today = new Date();
    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const dateRange: { dateStr: string, dayName: string, fullDate: Date }[] = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateStr = `${d.getMonth() + 1}月${d.getDate()}日`;
      dateRange.push({
        dateStr,
        dayName: i === 0 ? '今天' : i === 1 ? '明天' : dayNames[d.getDay()],
        fullDate: d
      });
    }

    const dateStrings = dateRange.map(d => d.dateStr);

    try {
      // 2. 从服务器拉取这 7 天内的所有占位预约
      const { data, error } = await supabase
        .from('app_appointments')
        .select('date_str')
        .eq('barber_name', barberName)
        .in('date_str', dateStrings)
        .in('status', ['confirmed', 'pending', 'checked_in', 'completed']);

      if (error) throw error;

      // 3. 计算每日负荷
      const [openH, openM] = (openTime || '09:00').split(':').map(Number);
      const [closeH, closeM] = (closeTime || '21:00').split(':').map(Number);
      const totalMinutes = (closeH * 60 + closeM) - (openH * 60 + openM);
      const slotsPerDay = Math.max(1, Math.floor(totalMinutes / (serviceDuration || 45)));

      const stats = dateRange.map(range => {
        const count = data.filter(a => a.date_str === range.dateStr).length;
        const percentage = Math.min(100, Math.round((count / slotsPerDay) * 100));

        let status: 'low' | 'medium' | 'high' | 'full' = 'low';
        if (percentage >= 100) status = 'full';
        else if (percentage >= 80) status = 'high';
        else if (percentage >= 40) status = 'medium';

        return {
          ...range,
          count,
          percentage,
          status
        };
      });

      setDays(stats as DaySaturation[]);
    } catch (err) {
      console.error('Error in useBarberSaturation:', err);
    }
  }, [barberName, openTime, closeTime, serviceDuration]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return days;
};
