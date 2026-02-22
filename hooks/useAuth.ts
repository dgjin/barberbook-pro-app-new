import React, { useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { User } from '../types';

// 密码哈希函数
const hashPassword = async (pwd: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pwd);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

interface LoginCredentials {
  account: string; // 手机号或用户名
  password: string;
  role?: 'customer' | 'barber' | 'admin';
}

interface RegisterData {
  nickname: string;
  realName?: string;
  phone: string;
  email?: string;
  password: string;
  avatar?: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

interface UseAuthReturn extends AuthState {
  login: (credentials: LoginCredentials) => Promise<User | null>;
  register: (data: RegisterData) => Promise<User | null>;
  logout: () => void;
  updateProfile: (updates: Partial<User>) => Promise<boolean>;
  updatePassword: (newPassword: string) => Promise<boolean>;
  clearError: () => void;
}

/**
 * 认证相关 Hook
 * 处理登录、注册、登出等操作
 */
export const useAuth = (onSuccess?: (user: User) => void): UseAuthReturn => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  /**
   * 用户登录
   */
  const login = useCallback(async (credentials: LoginCredentials): Promise<User | null> => {
    const { account, password, role = 'customer' } = credentials;

    if (!account || !password) {
      setError(role === 'admin' ? '请输入用户名和密码' : '请输入手机号和密码');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const hashedPassword = await hashPassword(password);

      // 优先级 1: 管理员 (username 匹配)
      const { data: adminData } = await supabase
        .from('app_admins')
        .select('*')
        .eq('username', account)
        .eq('password_hash', hashedPassword)
        .single();

      if (adminData) {
        const userData: User = {
          id: adminData.id,
          name: adminData.name,
          role: 'admin',
          avatar: adminData.avatar,
          phone: adminData.phone
        };
        setUser(userData);
        onSuccess?.(userData);
        return userData;
      }

      // 优先级 2: 理发师 (phone 匹配)
      const { data: barberData } = await supabase
        .from('app_barbers')
        .select('*')
        .eq('phone', account)
        .eq('password_hash', hashedPassword)
        .single();

      if (barberData) {
        const userData: User = {
          id: barberData.id,
          name: barberData.name,
          role: 'barber',
          avatar: barberData.image,
          phone: barberData.phone,
          barberId: barberData.id,
          title: barberData.title,
          bio: barberData.bio,
          specialties: barberData.specialties
        };
        setUser(userData);
        onSuccess?.(userData);
        return userData;
      }

      // 优先级 3: 顾客 (phone 匹配)
      const { data: customerData } = await supabase
        .from('app_customers')
        .select('*')
        .eq('phone', account)
        .eq('password_hash', hashedPassword)
        .single();

      if (customerData) {
        const userData: User = {
          id: customerData.id,
          name: customerData.name,
          role: 'customer',
          avatar: customerData.avatar,
          phone: customerData.phone,
          realName: customerData.real_name,
          email: customerData.email,
          vouchers: customerData.vouchers
        };
        setUser(userData);
        onSuccess?.(userData);
        return userData;
      }

      throw new Error('账号或密码错误，请检查后重试');
    } catch (err: any) {
      setError(err.message || '登录失败');
      return null;
    } finally {
      setLoading(false);
    }
  }, [onSuccess]);

  /**
   * 用户注册
   */
  const register = useCallback(async (data: RegisterData): Promise<User | null> => {
    const { nickname, phone, password, realName, email, avatar } = data;

    if (!nickname || !phone || !password) {
      setError('请填写必填项（昵称、手机号、密码）');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const hashedPassword = await hashPassword(password);

      // 准备数据
      const dbPayload = {
        name: nickname,
        real_name: realName || '',
        phone,
        email: email || '',
        avatar: avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(nickname)}&background=random`,
        password_hash: hashedPassword
      };

      // 插入数据库
      const { data: result, error: supaError } = await supabase
        .from('app_customers')
        .insert(dbPayload)
        .select()
        .single();

      if (supaError) {
        if (supaError.code === '23505') {
          throw new Error('该手机号已被注册');
        }
        throw supaError;
      }

      // 处理 Mock 模式或数据库响应
      const finalData = result ? result : { ...dbPayload, id: 'mock_' + Date.now() };

      // 记录日志
      await supabase.from('app_logs').insert({
        user: finalData.name,
        role: 'customer',
        action: '用户注册',
        details: `新用户注册: ${finalData.phone}`,
        type: 'info',
        avatar: finalData.avatar
      });

      // 映射到 User 类型
      const newUser: User = {
        id: finalData.id,
        name: finalData.name,
        role: 'customer',
        avatar: finalData.avatar,
        phone: finalData.phone,
        realName: finalData.real_name,
        email: finalData.email
      };

      setUser(newUser);
      onSuccess?.(newUser);
      return newUser;
    } catch (err: any) {
      setError(err.message || '注册失败，请稍后再试');
      return null;
    } finally {
      setLoading(false);
    }
  }, [onSuccess]);

  /**
   * 更新用户基础资料
   */
  const updateProfile = useCallback(async (updates: Partial<User>): Promise<boolean> => {
    if (!user) return false;
    setLoading(true);
    setError(null);

    try {
      const dbTable = user.role === 'admin' ? 'app_admins' : user.role === 'barber' ? 'app_barbers' : 'app_customers';
      const dbPayload: any = {};

      if (updates.name) dbPayload.name = updates.name;
      if (updates.phone) dbPayload.phone = updates.phone;
      if (updates.avatar) {
        if (user.role === 'barber') dbPayload.image = updates.avatar;
        else dbPayload.avatar = updates.avatar;
      }
      if (updates.realName) dbPayload.real_name = updates.realName;
      if (updates.email) dbPayload.email = updates.email;

      // 管理员特有字段映射
      if (user.role === 'admin') {
        if ((updates as any).email) dbPayload.email = (updates as any).email;
      }

      // 理发师特有字段映射
      if (user.role === 'barber') {
        if ((updates as any).title) dbPayload.title = (updates as any).title;
        if ((updates as any).bio) dbPayload.bio = (updates as any).bio;
        if ((updates as any).specialties) dbPayload.specialties = (updates as any).specialties;
      }

      const { error: supaError } = await supabase
        .from(dbTable)
        .update(dbPayload)
        .eq('id', user.id);

      if (supaError) throw supaError;

      const newUser = { ...user, ...updates };
      setUser(newUser);

      // 记录日志
      await supabase.from('app_logs').insert({
        user: user.name,
        role: user.role,
        action: '更新资料',
        details: `用户更新了个人资料: ${Object.keys(dbPayload).join(', ')}`,
        type: 'info'
      });

      return true;
    } catch (err: any) {
      setError(err.message || '更新资料失败');
      return false;
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * 自助修改密码
   */
  const updatePassword = useCallback(async (newPassword: string): Promise<boolean> => {
    if (!user) return false;
    setLoading(true);
    setError(null);

    try {
      const hashedPassword = await hashPassword(newPassword);
      const tableName = user.role === 'admin' ? 'app_admins' : (user.role === 'barber' ? 'app_barbers' : 'app_customers');

      const { error: supaError } = await supabase
        .from(tableName)
        .update({ password_hash: hashedPassword })
        .eq('id', user.id);

      if (supaError) throw supaError;

      // 强制登出或记录日志
      await supabase.from('app_logs').insert({
        user: user.name,
        role: user.role,
        action: '修改密码',
        details: '用户通过自助服务成功修改了登录密码',
        type: 'warning'
      });

      return true;
    } catch (err: any) {
      setError(err.message || '修改密码失败');
      return false;
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * 用户登出
   */
  const logout = useCallback(() => {
    setUser(null);
    setError(null);
  }, []);

  return {
    user,
    loading,
    error,
    login,
    register,
    logout,
    updateProfile,
    updatePassword,
    clearError
  };
};

interface UseFormReturn<T> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  setValue: (key: keyof T, value: any) => void;
  setValues: (values: Partial<T>) => void;
  handleChange: (key: keyof T) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleBlur: (key: keyof T) => () => void;
  validate: () => boolean;
  reset: () => void;
}

/**
 * 表单状态管理 Hook
 */
export function useForm<T extends Record<string, any>>(
  initialValues: T,
  validators?: Partial<Record<keyof T, (value: any, values: T) => string | undefined>>
): UseFormReturn<T> {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});

  const setValue = useCallback((key: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [key]: value }));
    // 验证单个字段
    if (validators?.[key]) {
      const error = validators[key]!(value, values);
      setErrors(prev => ({ ...prev, [key]: error }));
    }
  }, [validators, values]);

  const setValuesAll = useCallback((newValues: Partial<T>) => {
    setValues(prev => ({ ...prev, ...newValues }));
  }, []);

  const handleChange = useCallback((key: keyof T) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setValue(key, value);
  }, [setValue]);

  const handleBlur = useCallback((key: keyof T) => () => {
    setTouched(prev => ({ ...prev, [key]: true }));
    // 触发验证
    if (validators?.[key]) {
      const error = validators[key]!(values[key], values);
      setErrors(prev => ({ ...prev, [key]: error }));
    }
  }, [validators, values]);

  const validate = useCallback((): boolean => {
    if (!validators) return true;

    const newErrors: Partial<Record<keyof T, string>> = {};
    let isValid = true;

    Object.keys(validators).forEach(key => {
      const validator = validators[key as keyof T];
      if (validator) {
        const error = validator(values[key as keyof T], values);
        if (error) {
          newErrors[key as keyof T] = error;
          isValid = false;
        }
      }
    });

    setErrors(newErrors);
    setTouched(Object.keys(values).reduce((acc, key) => ({ ...acc, [key]: true }), {}));
    return isValid;
  }, [validators, values]);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  return {
    values,
    errors,
    touched,
    setValue,
    setValues: setValuesAll,
    handleChange,
    handleBlur,
    validate,
    reset
  };
}
