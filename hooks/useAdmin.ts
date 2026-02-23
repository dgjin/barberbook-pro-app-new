import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { Barber, Appointment, ServiceItem, LogEntry } from '../types';

// ==================== Dashboard Hooks ====================

interface DayStatus {
  dayName: string;
  dateNum: string;
  fullDateStr: string;
  count: number;
  status: 'free' | 'busy' | 'full';
}

interface UseDashboardScheduleReturn {
  barbers: Barber[];
  selectedBarber: Barber | null;
  setSelectedBarber: (barber: Barber) => void;
  weekData: DayStatus[];
  selectedDayIndex: number;
  setSelectedDayIndex: (index: number) => void;
  timeSlots: { time: string; appointment?: Appointment; status: 'available' | 'booked' | 'expired' }[];
  loading: boolean;
  refetch: () => Promise<void>;
}

/**
 * 管理后台 - 排班看板数据
 */
export const useDashboardSchedule = (): UseDashboardScheduleReturn => {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState({
    openTime: "09:00",
    closeTime: "21:00",
    serviceDuration: 45
  });

  const formatDateToDB = (date: Date) => `${date.getMonth() + 1}月${date.getDate()}日`;
  const getDayName = (date: Date) => ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: settingsData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'global_config')
        .single();
      if (settingsData?.value) setConfig(prev => ({ ...prev, ...settingsData.value }));

      const { data: barberData } = await supabase
        .from('app_barbers')
        .select('*')
        .order('id');
      
      if (barberData && barberData.length > 0) {
        setBarbers(barberData as unknown as Barber[]);
        if (!selectedBarber) setSelectedBarber(barberData[0] as unknown as Barber);
      }
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  }, [selectedBarber]);

  const fetchAppointments = useCallback(async () => {
    if (!selectedBarber) return;
    const { data } = await supabase
      .from('app_appointments')
      .select('*')
      .eq('barber_name', selectedBarber.name)
      .neq('status', 'cancelled');
    if (data) setAppointments(data as Appointment[]);
  }, [selectedBarber]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const weekData = useMemo(() => {
    const days: DayStatus[] = [];
    const today = new Date();
    const [openH, openM] = config.openTime.split(':').map(Number);
    const [closeH, closeM] = config.closeTime.split(':').map(Number);
    const totalMinutes = (closeH * 60 + closeM) - (openH * 60 + openM);
    const totalSlots = Math.floor(totalMinutes / config.serviceDuration);

    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dbDateStr = formatDateToDB(d);
      const dayName = i === 0 ? '今天' : getDayName(d);
      const dailyAppts = appointments.filter(a => a.date_str === dbDateStr);
      const count = dailyAppts.length;
      let status: 'free' | 'busy' | 'full' = 'free';
      const ratio = count / totalSlots;
      if (ratio >= 0.8) status = 'full';
      else if (ratio >= 0.5) status = 'busy';
      days.push({ dayName, dateNum: d.getDate().toString(), fullDateStr: dbDateStr, count, status });
    }
    return days;
  }, [appointments, config]);

  const timeSlots = useMemo(() => {
    const selectedDateStr = weekData[selectedDayIndex]?.fullDateStr;
    const slots: { time: string; appointment?: Appointment; status: 'available' | 'booked' | 'expired' }[] = [];
    if (!selectedDateStr) return slots;

    // 获取当前时间，用于判断时间段是否已过期
    const now = new Date();
    const todayStr = formatDateToDB(now);
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeValue = currentHour * 60 + currentMinute;
    
    // 检查是否是今天
    const isToday = selectedDateStr === todayStr;

    let current = new Date(`2000-01-01T${config.openTime}:00`);
    const end = new Date(`2000-01-01T${config.closeTime}:00`);
    const dailyAppts = appointments.filter(a => a.date_str === selectedDateStr);

    while (current < end) {
      const timeStr = current.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      const appt = dailyAppts.find(a => a.time_str === timeStr);
      
      // 判断时间段状态
      let status: 'available' | 'booked' | 'expired';
      if (appt) {
        status = 'booked';
      } else if (isToday) {
        // 如果是今天，检查时间是否已过期
        const [slotHour, slotMinute] = timeStr.split(':').map(Number);
        const slotTimeValue = slotHour * 60 + slotMinute;
        status = slotTimeValue < currentTimeValue ? 'expired' : 'available';
      } else {
        status = 'available';
      }
      
      slots.push({ time: timeStr, appointment: appt, status });
      current.setMinutes(current.getMinutes() + config.serviceDuration);
    }
    return slots;
  }, [weekData, selectedDayIndex, appointments, config]);

  const refetch = useCallback(async () => {
    await fetchAppointments();
  }, [fetchAppointments]);

  return {
    barbers,
    selectedBarber,
    setSelectedBarber,
    weekData,
    selectedDayIndex,
    setSelectedDayIndex,
    timeSlots,
    loading,
    refetch
  };
};

interface YearlyVoucherStat {
  barberName: string;
  count: number;
  avatar: string;
  appointmentCount: number;
}

interface UseYearlyStatsReturn {
  stats: YearlyVoucherStat[];
  totalVouchers: number;
  totalAppointments: number;
  loading: boolean;
  refetch: () => Promise<void>;
}

/**
 * 年度理发券统计数据
 */
export const useYearlyStats = (barbers: Barber[], year?: number): UseYearlyStatsReturn => {
  const currentYear = year || new Date().getFullYear();
  const [stats, setStats] = useState<YearlyVoucherStat[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const startOfYear = `${currentYear}-01-01T00:00:00Z`;
      const endOfYear = `${currentYear + 1}-01-01T00:00:00Z`;

      // 获取理发券核销数据
      const { data: voucherData } = await supabase
        .from('app_appointments')
        .select('barber_name')
        .eq('status', 'completed')
        .eq('used_voucher', true)
        .gte('created_at', startOfYear)
        .lt('created_at', endOfYear);

      // 获取总预约次数
      const { data: apptData } = await supabase
        .from('app_appointments')
        .select('barber_name')
        .eq('status', 'completed')
        .gte('created_at', startOfYear)
        .lt('created_at', endOfYear);

      const voucherCounts: Record<string, number> = {};
      const apptCounts: Record<string, number> = {};

      if (voucherData) {
        voucherData.forEach((appt: any) => {
          voucherCounts[appt.barber_name] = (voucherCounts[appt.barber_name] || 0) + 1;
        });
      }

      if (apptData) {
        apptData.forEach((appt: any) => {
          apptCounts[appt.barber_name] = (apptCounts[appt.barber_name] || 0) + 1;
        });
      }

      const statsData = barbers.map(b => ({
        barberName: b.name,
        count: voucherCounts[b.name] || 0,
        avatar: b.image,
        appointmentCount: apptCounts[b.name] || 0
      })).sort((a, b) => b.count - a.count);

      setStats(statsData);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [barbers, currentYear]);

  useEffect(() => {
    if (barbers.length > 0) fetchStats();
  }, [barbers, fetchStats]);

  const totalVouchers = useMemo(() => stats.reduce((sum, s) => sum + s.count, 0), [stats]);
  const totalAppointments = useMemo(() => stats.reduce((sum, s) => sum + s.appointmentCount, 0), [stats]);

  return { stats, totalVouchers, totalAppointments, loading, refetch: fetchStats };
};

// ==================== Multi-Dimension Stats Hooks ====================

interface PeriodStat {
  barberName: string;
  count: number;
  avatar: string;
  appointmentCount: number; // 总预约次数（包含未使用券的）
}

interface UsePeriodStatsReturn {
  stats: PeriodStat[];
  totalVouchers: number;
  totalAppointments: number;
  loading: boolean;
  refetch: () => Promise<void>;
}

/**
 * 获取月度统计数据
 */
export const useMonthlyStats = (barbers: Barber[], year?: number, month?: number): UsePeriodStatsReturn => {
  const currentYear = year || new Date().getFullYear();
  const currentMonth = month || new Date().getMonth() + 1;
  const [stats, setStats] = useState<PeriodStat[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const startOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01T00:00:00Z`;
      const endOfMonth = currentMonth === 12
        ? `${currentYear + 1}-01-01T00:00:00Z`
        : `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01T00:00:00Z`;

      // 获取理发券核销数据
      const { data: voucherData } = await supabase
        .from('app_appointments')
        .select('barber_name')
        .eq('status', 'completed')
        .eq('used_voucher', true)
        .gte('created_at', startOfMonth)
        .lt('created_at', endOfMonth);

      // 获取总预约次数（所有已完成订单）
      const { data: apptData } = await supabase
        .from('app_appointments')
        .select('barber_name')
        .eq('status', 'completed')
        .gte('created_at', startOfMonth)
        .lt('created_at', endOfMonth);

      const voucherCounts: Record<string, number> = {};
      const apptCounts: Record<string, number> = {};

      if (voucherData) {
        voucherData.forEach((appt: any) => {
          voucherCounts[appt.barber_name] = (voucherCounts[appt.barber_name] || 0) + 1;
        });
      }

      if (apptData) {
        apptData.forEach((appt: any) => {
          apptCounts[appt.barber_name] = (apptCounts[appt.barber_name] || 0) + 1;
        });
      }

      const statsData = barbers.map(b => ({
        barberName: b.name,
        count: voucherCounts[b.name] || 0,
        avatar: b.image,
        appointmentCount: apptCounts[b.name] || 0
      })).sort((a, b) => b.count - a.count);

      setStats(statsData);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [barbers, currentYear, currentMonth]);

  useEffect(() => {
    if (barbers.length > 0) fetchStats();
  }, [barbers, fetchStats]);

  const totalVouchers = useMemo(() => stats.reduce((sum, s) => sum + s.count, 0), [stats]);
  const totalAppointments = useMemo(() => stats.reduce((sum, s) => sum + s.appointmentCount, 0), [stats]);

  return { stats, totalVouchers, totalAppointments, loading, refetch: fetchStats };
};

/**
 * 获取季度统计数据
 */
export const useQuarterlyStats = (barbers: Barber[], year?: number, quarter?: number): UsePeriodStatsReturn => {
  const currentYear = year || new Date().getFullYear();
  const currentQuarter = quarter || Math.floor((new Date().getMonth() + 3) / 3);
  const [stats, setStats] = useState<PeriodStat[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const startMonth = (currentQuarter - 1) * 3 + 1;
      const endMonth = startMonth + 3;
      const startOfQuarter = `${currentYear}-${String(startMonth).padStart(2, '0')}-01T00:00:00Z`;
      const endOfQuarter = endMonth > 12
        ? `${currentYear + 1}-01-01T00:00:00Z`
        : `${currentYear}-${String(endMonth).padStart(2, '0')}-01T00:00:00Z`;

      // 获取理发券核销数据
      const { data: voucherData } = await supabase
        .from('app_appointments')
        .select('barber_name')
        .eq('status', 'completed')
        .eq('used_voucher', true)
        .gte('created_at', startOfQuarter)
        .lt('created_at', endOfQuarter);

      // 获取总预约次数
      const { data: apptData } = await supabase
        .from('app_appointments')
        .select('barber_name')
        .eq('status', 'completed')
        .gte('created_at', startOfQuarter)
        .lt('created_at', endOfQuarter);

      const voucherCounts: Record<string, number> = {};
      const apptCounts: Record<string, number> = {};

      if (voucherData) {
        voucherData.forEach((appt: any) => {
          voucherCounts[appt.barber_name] = (voucherCounts[appt.barber_name] || 0) + 1;
        });
      }

      if (apptData) {
        apptData.forEach((appt: any) => {
          apptCounts[appt.barber_name] = (apptCounts[appt.barber_name] || 0) + 1;
        });
      }

      const statsData = barbers.map(b => ({
        barberName: b.name,
        count: voucherCounts[b.name] || 0,
        avatar: b.image,
        appointmentCount: apptCounts[b.name] || 0
      })).sort((a, b) => b.count - a.count);

      setStats(statsData);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [barbers, currentYear, currentQuarter]);

  useEffect(() => {
    if (barbers.length > 0) fetchStats();
  }, [barbers, fetchStats]);

  const totalVouchers = useMemo(() => stats.reduce((sum, s) => sum + s.count, 0), [stats]);
  const totalAppointments = useMemo(() => stats.reduce((sum, s) => sum + s.appointmentCount, 0), [stats]);

  return { stats, totalVouchers, totalAppointments, loading, refetch: fetchStats };
};

/**
 * 获取每周统计数据
 */
export const useWeeklyStats = (barbers: Barber[], date?: Date): UsePeriodStatsReturn => {
  const currentDate = date || new Date();
  const [stats, setStats] = useState<PeriodStat[]>([]);
  const [loading, setLoading] = useState(false);

  // 计算本周一的日期字符串作为稳定依赖（同一周内不会变化）
  const weekKey = useMemo(() => {
    const dayOfWeek = currentDate.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(currentDate);
    monday.setDate(currentDate.getDate() + diffToMonday);
    return monday.toISOString().split('T')[0]; // 格式: "2024-02-19"
  }, [currentDate]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      // 计算本周开始（周一）和结束（周日）
      const dayOfWeek = currentDate.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(currentDate);
      monday.setDate(currentDate.getDate() + diffToMonday);
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const startOfWeek = monday.toISOString();
      const endOfWeek = sunday.toISOString();

      // 获取理发券核销数据
      const { data: voucherData } = await supabase
        .from('app_appointments')
        .select('barber_name')
        .eq('status', 'completed')
        .eq('used_voucher', true)
        .gte('created_at', startOfWeek)
        .lte('created_at', endOfWeek);

      // 获取总预约次数
      const { data: apptData } = await supabase
        .from('app_appointments')
        .select('barber_name')
        .eq('status', 'completed')
        .gte('created_at', startOfWeek)
        .lte('created_at', endOfWeek);

      const voucherCounts: Record<string, number> = {};
      const apptCounts: Record<string, number> = {};

      if (voucherData) {
        voucherData.forEach((appt: any) => {
          voucherCounts[appt.barber_name] = (voucherCounts[appt.barber_name] || 0) + 1;
        });
      }

      if (apptData) {
        apptData.forEach((appt: any) => {
          apptCounts[appt.barber_name] = (apptCounts[appt.barber_name] || 0) + 1;
        });
      }

      const statsData = barbers.map(b => ({
        barberName: b.name,
        count: voucherCounts[b.name] || 0,
        avatar: b.image,
        appointmentCount: apptCounts[b.name] || 0
      })).sort((a, b) => b.count - a.count);

      setStats(statsData);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [barbers, weekKey]);

  useEffect(() => {
    if (barbers.length > 0) fetchStats();
  }, [barbers, fetchStats]);

  const totalVouchers = useMemo(() => stats.reduce((sum, s) => sum + s.count, 0), [stats]);
  const totalAppointments = useMemo(() => stats.reduce((sum, s) => sum + s.appointmentCount, 0), [stats]);

  return { stats, totalVouchers, totalAppointments, loading, refetch: fetchStats };
};

// ==================== Settings Hooks ====================

interface SystemConfig {
  openTime: string;
  closeTime: string;
  serviceDuration: number;
  maxAppointments: number;
}

interface UseSystemSettingsReturn {
  config: SystemConfig;
  services: ServiceItem[];
  loading: boolean;
  updateConfig: (config: Partial<SystemConfig>) => void;
  saveConfig: () => Promise<boolean>;
  addService: (service: Omit<ServiceItem, 'id'>) => Promise<boolean>;
  updateService: (id: number | string, service: Partial<ServiceItem>) => Promise<boolean>;
  deleteService: (id: number | string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

const DEFAULT_CONFIG: SystemConfig = {
  openTime: "09:00",
  closeTime: "21:00",
  serviceDuration: 45,
  maxAppointments: 24
};

/**
 * 系统设置管理
 */
export const useSystemSettings = (): UseSystemSettingsReturn => {
  const [config, setConfig] = useState<SystemConfig>(DEFAULT_CONFIG);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const { data: configData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'global_config')
        .single();
      if (configData?.value) setConfig(prev => ({ ...prev, ...configData.value }));

      const { data: servicesData } = await supabase
        .from('app_services')
        .select('*')
        .order('price', { ascending: true });
      if (servicesData) setServices(servicesData as unknown as ServiceItem[]);
    } catch (e) { console.error("Fetch Settings Error:", e); }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateConfig = useCallback((newConfig: Partial<SystemConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  const saveConfig = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key: 'global_config', value: config });
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Save config error:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [config]);

  const addService = useCallback(async (service: Omit<ServiceItem, 'id'>): Promise<boolean> => {
    setLoading(true);
    try {
      const { error } = await supabase.from('app_services').insert(service);
      if (error) throw error;
      await fetchData();
      return true;
    } catch (err) {
      console.error('Add service error:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchData]);

  const updateService = useCallback(async (id: number | string, service: Partial<ServiceItem>): Promise<boolean> => {
    setLoading(true);
    try {
      const { error } = await supabase.from('app_services').update(service).eq('id', id);
      if (error) throw error;
      await fetchData();
      return true;
    } catch (err) {
      console.error('Update service error:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchData]);

  const deleteService = useCallback(async (id: number | string): Promise<boolean> => {
    try {
      const { error } = await supabase.from('app_services').delete().eq('id', id);
      if (error) throw error;
      setServices(prev => prev.filter(s => s.id !== id));
      return true;
    } catch (err) {
      console.error('Delete service error:', err);
      return false;
    }
  }, []);

  return {
    config,
    services,
    loading,
    updateConfig,
    saveConfig,
    addService,
    updateService,
    deleteService,
    refetch: fetchData
  };
};

// ==================== Logs Hooks ====================

type FilterType = 'all' | 'system' | 'operation';

interface UseLogsReturn {
  logs: LogEntry[];
  filteredLogs: LogEntry[];
  filter: FilterType;
  setFilter: (filter: FilterType) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  currentPage: number;
  totalCount: number;
  pageSize: number;
  refetch: () => Promise<void>;
}

/**
 * 日志查询与筛选 - 性能优化版本
 * 优化点：
 * 1. 限制查询最近7天的日志，减少数据传输
 * 2. 服务端搜索，减少前端计算
 * 3. 防抖处理搜索输入
 * 4. 虚拟滚动支持大量数据
 */
export const useLogs = (): UseLogsReturn => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 50;

  // 防抖处理搜索输入
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchLogs = useCallback(async (offset = 0, append = false) => {
    setLoading(true);
    try {
      // 计算7天前的日期
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const startDate = sevenDaysAgo.toISOString();

      let query = supabase
        .from('app_logs')
        .select('*')
        .gte('created_at', startDate)
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      // 服务端搜索优化
      if (debouncedSearchQuery) {
        query = query.or(`user.ilike.%${debouncedSearchQuery}%,action.ilike.%${debouncedSearchQuery}%,details.ilike.%${debouncedSearchQuery}%`);
      }

      // 根据筛选条件过滤
      if (filter === 'system') {
        query = query.or('role.eq.system,action.ilike.%系统更新%');
      } else if (filter === 'operation') {
        query = query.not('role', 'eq', 'system').not('action', 'ilike', '%系统更新%');
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        const formattedData = data.map((d: any) => ({
          ...d,
          time: new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));

        if (append) {
          setLogs(prev => [...prev, ...formattedData]);
        } else {
          setLogs(formattedData);
        }

        // 判断是否还有更多数据
        setHasMore(data.length === pageSize);
      }
    } catch (err) {
      console.error('Fetch logs error:', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearchQuery, filter]);

  // 初始加载和筛选/搜索变化时重新获取
  useEffect(() => {
    fetchLogs(0, false);
  }, [fetchLogs]);

  // 加载更多数据
  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchLogs(logs.length, true);
    }
  }, [logs.length, loading, hasMore, fetchLogs]);

  // 计算当前页码和总页数
  const currentPage = Math.ceil(logs.length / pageSize);
  const totalCount = logs.length;

  // 使用 useMemo 缓存过滤后的日志（现在只是简单的返回，因为过滤已经在服务端完成）
  const filteredLogs = useMemo(() => {
    return logs;
  }, [logs]);

  return {
    logs,
    filteredLogs,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    loading,
    hasMore,
    loadMore,
    currentPage,
    totalCount,
    pageSize,
    refetch: () => fetchLogs(0, false)
  };
};

// ==================== Management Hooks ====================

interface UseManagementReturn {
  staffList: Barber[];
  customerList: any[];
  loading: boolean;
  activeTab: 'barber' | 'customer';
  setActiveTab: (tab: 'barber' | 'customer') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredStaff: Barber[];
  filteredCustomers: any[];
  saveBarber: (barber: Partial<Barber>, isNew?: boolean) => Promise<boolean>;
  deleteBarber: (id: number) => Promise<boolean>;
  saveCustomer: (customer: any) => Promise<boolean>;
  deleteCustomer: (id: string | number) => Promise<boolean>;
  saveSchedule: (barberId: number, schedule: number[]) => Promise<boolean>;
  refetch: () => Promise<void>;
}

/**
 * 人员管理
 */
export const useManagement = (): UseManagementReturn => {
  const [activeTab, setActiveTab] = useState<'barber' | 'customer'>('barber');
  const [staffList, setStaffList] = useState<Barber[]>([]);
  const [customerList, setCustomerList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (staffList.length === 0 && customerList.length === 0) setLoading(true);

    try {
      if (activeTab === 'barber') {
        const { data: barberData } = await supabase.from('app_barbers').select('*').order('id');
        const { data: apptStats } = await supabase
          .from('app_appointments')
          .select('barber_name, used_voucher')
          .eq('status', 'completed')
          .eq('used_voucher', true);

        const voucherCounts: Record<string, number> = {};
        if (apptStats) {
          apptStats.forEach((a: any) => {
            voucherCounts[a.barber_name] = (voucherCounts[a.barber_name] || 0) + 1;
          });
        }

        if (barberData) {
          const enrichedBarbers = barberData.map((b: any) => ({
            ...b,
            voucher_revenue: voucherCounts[b.name] ?? 0
          }));
          setStaffList(enrichedBarbers as Barber[]);
        }
      } else {
        const { data } = await supabase.from('app_customers').select('*').order('created_at', { ascending: false });
        if (data) {
          setCustomerList(data);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredStaff = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return staffList.filter(staff =>
      staff.name.toLowerCase().includes(query) ||
      staff.title?.toLowerCase().includes(query) ||
      staff.specialties?.some(s => s.toLowerCase().includes(query))
    );
  }, [staffList, searchQuery]);

  const filteredCustomers = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return customerList.filter(user =>
      user.name?.toLowerCase().includes(query) ||
      user.real_name?.toLowerCase().includes(query) ||
      user.phone?.includes(query)
    );
  }, [customerList, searchQuery]);

  const saveBarber = useCallback(async (barber: Partial<Barber>, isNew = false): Promise<boolean> => {
    try {
      const payload = {
        name: barber.name,
        title: barber.title,
        status: barber.status,
        specialties: barber.specialties,
        image: barber.image,
        rating: barber.rating || 5.0,
        experience: barber.experience || 1,
        bio: barber.bio || ''
      };

      if (isNew || !barber.id) {
        await supabase.from('app_barbers').insert(payload);
      } else {
        await supabase.from('app_barbers').update(payload).eq('id', barber.id);
      }
      await fetchData();
      return true;
    } catch (err) {
      console.error('Save barber error:', err);
      return false;
    }
  }, [fetchData]);

  const deleteBarber = useCallback(async (id: number): Promise<boolean> => {
    try {
      await supabase.from('app_barbers').delete().eq('id', id);
      await fetchData();
      return true;
    } catch (err) {
      console.error('Delete barber error:', err);
      return false;
    }
  }, [fetchData]);

  const saveCustomer = useCallback(async (customer: any): Promise<boolean> => {
    try {
      const payload = {
        name: customer.name,
        real_name: customer.realName,
        phone: customer.phone,
        email: customer.email,
        avatar: customer.avatar,
        vouchers: Number(customer.vouchers || 0)
      };
      await supabase.from('app_customers').update(payload).eq('id', customer.id);
      await fetchData();
      return true;
    } catch (err) {
      console.error('Save customer error:', err);
      return false;
    }
  }, [fetchData]);

  const deleteCustomer = useCallback(async (id: string | number): Promise<boolean> => {
    try {
      await supabase.from('app_customers').delete().eq('id', id);
      await fetchData();
      return true;
    } catch (err) {
      console.error('Delete customer error:', err);
      return false;
    }
  }, [fetchData]);

  const saveSchedule = useCallback(async (barberId: number, schedule: number[]): Promise<boolean> => {
    try {
      await supabase.from('app_barbers').update({ schedule }).eq('id', barberId);
      await fetchData();
      return true;
    } catch (err) {
      console.error('Save schedule error:', err);
      return false;
    }
  }, [fetchData]);

  return {
    staffList,
    customerList,
    loading,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    filteredStaff,
    filteredCustomers,
    saveBarber,
    deleteBarber,
    saveCustomer,
    deleteCustomer,
    saveSchedule,
    refetch: fetchData
  };
};
