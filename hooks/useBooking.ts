import { useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Appointment, User } from '../types';

interface BookingData {
  customerName: string;
  barberName: string;
  serviceName: string;
  dateString: string;
  timeString: string;
  price: number;
}

interface UseBookingReturn {
  isProcessing: boolean;
  error: string | null;
  bookAppointment: (data: BookingData, currentUser?: User | null) => Promise<Appointment | null>;
  checkConflict: (barberName: string, dateString: string, timeString: string) => Promise<boolean>;
  clearError: () => void;
}

/**
 * 预约操作 Hook
 * 处理预约创建、冲突检查等
 */
export const useBooking = (): UseBookingReturn => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  /**
   * 检查时段是否冲突
   */
  const checkConflict = useCallback(async (
    barberName: string,
    dateString: string,
    timeString: string
  ): Promise<boolean> => {
    try {
      const { data } = await supabase
        .from('app_appointments')
        .select('id')
        .eq('barber_name', barberName)
        .eq('date_str', dateString)
        .eq('time_str', timeString)
        .in('status', ['confirmed', 'pending', 'checked_in'])
        .single();

      return !!data; // 有数据表示冲突
    } catch (err) {
      // 无记录时会报错，表示无冲突
      return false;
    }
  }, []);

  /**
   * 创建预约
   */
  const bookAppointment = useCallback(async (
    data: BookingData,
    currentUser?: User | null
  ): Promise<Appointment | null> => {
    const { customerName, barberName, serviceName, dateString, timeString, price } = data;

    setIsProcessing(true);
    setError(null);

    try {
      // 创建预约数据
      const newAppointment: Partial<Appointment> = {
        customer_name: customerName,
        barber_name: barberName,
        service_name: serviceName,
        date_str: dateString,
        time_str: timeString,
        price,
        status: 'confirmed'
      };

      const { data: result, error: supaError } = await supabase
        .from('app_appointments')
        .insert(newAppointment)
        .select()
        .single();

      if (supaError) throw supaError;

      // 记录日志
      if (currentUser) {
        await supabase.from('app_logs').insert({
          user: currentUser.name,
          role: 'customer',
          action: '创建预约',
          details: `成功预约 ${barberName} - ${dateString} ${timeString}`,
          type: 'info',
          avatar: currentUser.avatar
        });
      }

      return result as Appointment;
    } catch (err: any) {
      setError(err.message || '预约失败，请稍后重试');
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return {
    isProcessing,
    error,
    bookAppointment,
    checkConflict,
    clearError
  };
};

interface UseImageUploadReturn {
  image: string | null;
  loading: boolean;
  error: string | null;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  clearImage: () => void;
}

/**
 * 图片上传 Hook（本地预览版）
 * 实际项目中可扩展为上传到云存储
 */
export const useImageUpload = (): UseImageUploadReturn => {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      setError('请上传图片文件');
      return;
    }

    // 验证文件大小（最大 5MB）
    if (file.size > 5 * 1024 * 1024) {
      setError('图片大小不能超过 5MB');
      return;
    }

    setLoading(true);
    setError(null);

    const reader = new FileReader();
    reader.onloadend = () => {
      setImage(reader.result as string);
      setLoading(false);
    };
    reader.onerror = () => {
      setError('图片读取失败');
      setLoading(false);
    };
    reader.readAsDataURL(file);
  }, []);

  const clearImage = useCallback(() => {
    setImage(null);
    setError(null);
  }, []);

  return {
    image,
    loading,
    error,
    handleFileChange,
    clearImage
  };
};
