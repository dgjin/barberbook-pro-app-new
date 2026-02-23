import { useState, useCallback } from 'react';
import { User } from '../types';
import { supabase } from '../services/supabase';

// Clerk 配置
const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';

interface ClerkAuthState {
  loading: boolean;
  error: string | null;
  isClerkEnabled: boolean;
}

interface UseClerkAuthReturn extends ClerkAuthState {
  loginWithClerk: () => void;
  handleClerkCallback: (clerkUser: any) => Promise<User | null>;
  clearError: () => void;
}

/**
 * Clerk 登录 Hook
 * 处理 Clerk 身份验证登录流程
 * 支持邮箱、手机号、社交账号等多种登录方式
 */
export const useClerkAuth = (onSuccess?: (user: User) => void): UseClerkAuthReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 检查 Clerk 是否已配置
  const isClerkEnabled = CLERK_PUBLISHABLE_KEY && 
    !CLERK_PUBLISHABLE_KEY.includes('your_clerk') &&
    CLERK_PUBLISHABLE_KEY.startsWith('pk_');

  const clearError = useCallback(() => setError(null), []);

  /**
   * 发起 Clerk 登录
   * 打开 Clerk 登录弹窗
   */
  const loginWithClerk = useCallback(() => {
    if (!isClerkEnabled) {
      setError('Clerk 登录未配置，请联系管理员');
      return;
    }

    // Clerk 登录通过 ClerkProvider 和 SignIn 组件处理
    // 这里只是触发状态，实际 UI 在组件中渲染
    // 返回 true 表示可以显示 Clerk 登录界面
  }, [isClerkEnabled]);

  /**
   * 处理 Clerk 登录回调
   * 当用户通过 Clerk 登录成功后，同步到本地数据库
   */
  const handleClerkCallback = useCallback(async (clerkUser: any): Promise<User | null> => {
    if (!clerkUser) {
      setError('Clerk 登录信息无效');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      // 从 Clerk 用户信息中提取数据
      const email = clerkUser.emailAddresses?.[0]?.emailAddress || '';
      const phone = clerkUser.phoneNumbers?.[0]?.phoneNumber || '';
      const name = clerkUser.firstName && clerkUser.lastName 
        ? `${clerkUser.firstName} ${clerkUser.lastName}`
        : clerkUser.firstName || clerkUser.username || email.split('@')[0] || '用户';
      const avatar = clerkUser.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6C47FF&color=fff`;
      const clerkId = clerkUser.id;

      // 检查用户是否已存在（通过 Clerk ID 或邮箱）
      let { data: existingUser } = await supabase
        .from('app_customers')
        .select('*')
        .eq('clerk_id', clerkId)
        .single();

      // 如果没找到 Clerk ID，尝试通过邮箱查找
      if (!existingUser && email) {
        const { data: userByEmail } = await supabase
          .from('app_customers')
          .select('*')
          .eq('email', email)
          .single();
        existingUser = userByEmail;
      }

      let userData: User;

      if (existingUser) {
        // 用户已存在，更新信息
        const { data: updatedUser, error: updateError } = await supabase
          .from('app_customers')
          .update({
            name,
            email,
            phone: phone || existingUser.phone,
            avatar,
            clerk_id: clerkId,
            last_login: new Date().toISOString()
          })
          .eq('id', existingUser.id)
          .select()
          .single();

        if (updateError) {
          throw new Error('更新用户信息失败: ' + updateError.message);
        }

        userData = {
          id: existingUser.id,
          name,
          role: 'customer',
          avatar,
          phone: phone || existingUser.phone || '',
          email,
          clerkId
        };
      } else {
        // 新用户，创建账号
        const { data: newUser, error: insertError } = await supabase
          .from('app_customers')
          .insert({
            name,
            email,
            phone,
            avatar,
            clerk_id: clerkId,
            password_hash: '', // Clerk 登录不需要本地密码
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (insertError) {
          throw new Error('创建用户失败: ' + insertError.message);
        }

        userData = {
          id: newUser.id,
          name,
          role: 'customer',
          avatar,
          phone: phone || '',
          email,
          clerkId
        };

        // 记录日志
        await supabase.from('app_logs').insert({
          user: name,
          role: 'customer',
          action: 'Clerk 登录注册',
          details: `新用户通过 Clerk 登录注册: ${email || phone}`,
          type: 'info',
          avatar
        });
      }

      onSuccess?.(userData);
      return userData;
    } catch (err: any) {
      setError(err.message || 'Clerk 登录失败');
      return null;
    } finally {
      setLoading(false);
    }
  }, [onSuccess]);

  return {
    loading,
    error,
    isClerkEnabled,
    loginWithClerk,
    handleClerkCallback,
    clearError
  };
};
