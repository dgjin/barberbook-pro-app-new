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
  timeSlots: { time: string; appointment?: Appointment; status: 'available' | 'booked' }[];
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
    const slots: { time: string; appointment?: Appointment; status: 'available' | 'booked' }[] = [];
    if (!selectedDateStr) return slots;

    let current = new Date(`2000-01-01T${config.openTime}:00`);
    const end = new Date(`2000-01-01T${config.closeTime}:00`);
    const dailyAppts = appointments.filter(a => a.date_str === selectedDateStr);

    while (current < end) {
      const timeStr = current.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      const appt = dailyAppts.find(a => a.time_str === timeStr);
      slots.push({ time: timeStr, appointment: appt, status: appt ? 'booked' : 'available' });
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
}

interface UseYearlyStatsReturn {
  stats: YearlyVoucherStat[];
  total: number;
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

      const { data } = await supabase
        .from('app_appointments')
        .select('barber_name')
        .eq('status', 'completed')
        .eq('used_voucher', true)
        .gte('created_at', startOfYear)
        .lt('created_at', endOfYear);

      if (data) {
        const counts: Record<string, number> = {};
        data.forEach((appt: any) => {
          counts[appt.barber_name] = (counts[appt.barber_name] || 0) + 1;
        });

        const statsData = barbers.map(b => ({
          barberName: b.name,
          count: counts[b.name] || 0,
          avatar: b.image
        })).sort((a, b) => b.count - a.count);

        setStats(statsData);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [barbers, currentYear]);

  useEffect(() => {
    if (barbers.length > 0) fetchStats();
  }, [barbers, fetchStats]);

  const total = useMemo(() => stats.reduce((sum, s) => sum + s.count, 0), [stats]);

  return { stats, total, loading, refetch: fetchStats };
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
  refetch: () => Promise<void>;
}

/**
 * 日志查询与筛选
 */
export const useLogs = (): UseLogsReturn => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (data) {
        const formattedData = data.map((d: any) => ({
          ...d,
          time: new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));
        setLogs(formattedData);
      }
    } catch (err) {
      console.error('Fetch logs error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = 
        log.user?.includes(searchQuery) ||
        log.action?.includes(searchQuery) ||
        log.details?.includes(searchQuery);

      const isSystemLog = log.role === 'system' || log.action?.includes('系统更新');

      if (filter === 'system') return matchesSearch && isSystemLog;
      if (filter === 'operation') return matchesSearch && !isSystemLog;
      return matchesSearch;
    });
  }, [logs, filter, searchQuery]);

  return {
    logs,
    filteredLogs,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    loading,
    refetch: fetchLogs
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
