import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { PageRoute } from '../types';
import { useForm } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import { sendVerificationCodeEmail, getEmailConfig } from '../services/emailService';

interface Props {
  onNavigate: (route: PageRoute) => void;
}

interface ForgotPasswordForm {
  email: string;
  code: string;
  newPassword: string;
  confirmPassword: string;
}

export const ForgotPassword: React.FC<Props> = ({ onNavigate }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [resetToken, setResetToken] = useState<string>('');

  // 表单状态管理
  const { values, errors, handleChange, validate, touched, setValue } = useForm<ForgotPasswordForm>(
    { email: '', code: '', newPassword: '', confirmPassword: '' },
    {
      email: (value) => {
        if (!value) return '请输入邮箱地址';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return '邮箱格式不正确';
        return undefined;
      },
      code: (value) => !value ? '请输入验证码' : undefined,
      newPassword: (value) => {
        if (!value) return '请输入新密码';
        if (value.length < 6) return '密码至少需要6位';
        return undefined;
      },
      confirmPassword: (value, values) => {
        if (!value) return '请确认新密码';
        if (value !== values.newPassword) return '两次输入的密码不一致';
        return undefined;
      }
    }
  );

  // 发送验证码
  const sendVerificationCode = async () => {
    if (!values.email || errors.email) {
      setError('请输入有效的邮箱地址');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 检查邮箱是否已注册
      const { data: user, error: userError } = await supabase
        .from('app_customers')
        .select('id, email')
        .eq('email', values.email)
        .single();

      if (userError || !user) {
        throw new Error('该邮箱未注册，请先注册账号');
      }

      // 生成6位验证码
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      // 保存验证码到数据库（带过期时间）
      const { error: saveError } = await supabase
        .from('app_password_reset')
        .upsert({
          email: values.email,
          code: code,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10分钟过期
          created_at: new Date().toISOString()
        }, {
          onConflict: 'email'
        });

      if (saveError) {
        throw new Error('发送验证码失败，请稍后重试');
      }

      // 检查邮件服务是否配置
      const emailConfig = await getEmailConfig();
      
      if (emailConfig && emailConfig.enabled) {
        // 使用邮件服务发送验证码
        const sent = await sendVerificationCodeEmail(values.email, code, 'reset_password');
        if (!sent) {
          throw new Error('邮件发送失败，请稍后重试');
        }
        
        // 开始倒计时
        setCountdown(60);
        const timer = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        
        alert(`验证码已发送至 ${values.email}，请查收邮件`);
      } else {
        // 邮件服务未配置，使用演示模式
        console.log('验证码已发送:', code);
        
        // 开始倒计时
        setCountdown(60);
        const timer = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        // 提示用户（演示模式）
        alert(`验证码已发送至 ${values.email}\n（演示模式：验证码为 ${code}）\n\n提示：请在管理员设置中配置 SMTP 邮件服务，以自动发送邮件。`);
      }
      
    } catch (err: any) {
      setError(err.message || '发送验证码失败');
    } finally {
      setLoading(false);
    }
  };

  // 验证验证码
  const verifyCode = async () => {
    if (!validate(['email', 'code'])) return;

    setLoading(true);
    setError(null);

    try {
      // 验证验证码
      const { data: resetData, error: verifyError } = await supabase
        .from('app_password_reset')
        .select('*')
        .eq('email', values.email)
        .eq('code', values.code)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (verifyError || !resetData) {
        throw new Error('验证码错误或已过期');
      }

      // 生成重置令牌
      const token = Math.random().toString(36).substring(2, 15);
      setResetToken(token);
      
      // 进入下一步
      setStep(2);
    } catch (err: any) {
      setError(err.message || '验证码验证失败');
    } finally {
      setLoading(false);
    }
  };

  // 重置密码
  const resetPassword = async () => {
    if (!validate(['newPassword', 'confirmPassword'])) return;

    setLoading(true);
    setError(null);

    try {
      // 使用 SHA-256 加密新密码
      const encoder = new TextEncoder();
      const data = encoder.encode(values.newPassword);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // 更新用户密码
      const { error: updateError } = await supabase
        .from('app_customers')
        .update({ password_hash: passwordHash })
        .eq('email', values.email);

      if (updateError) {
        throw new Error('密码重置失败，请稍后重试');
      }

      // 删除已使用的验证码
      await supabase
        .from('app_password_reset')
        .delete()
        .eq('email', values.email);

      // 记录日志
      await supabase.from('app_logs').insert({
        user: values.email,
        role: 'customer',
        action: '密码重置',
        details: `用户通过邮箱验证码重置密码`,
        type: 'info'
      });

      // 进入成功页面
      setStep(3);
    } catch (err: any) {
      setError(err.message || '密码重置失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout className="bg-white">
      <header className="pt-12 pb-4 px-6 sticky top-0 bg-white z-40 border-b border-gray-100 flex items-center">
        <button
          onClick={() => onNavigate('login')}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-50 transition-colors -ml-2"
        >
          <span className="material-symbols-outlined text-slate-800">arrow_back</span>
        </button>
        <h1 className="text-lg font-extrabold text-slate-900 ml-2 font-display">找回密码</h1>
      </header>

      <main className="p-6 pb-20">
        {/* 步骤指示器 */}
        <div className="flex items-center justify-center mb-8">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
            step >= 1 ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'
          }`}>
            1
          </div>
          <div className={`w-16 h-1 ${step >= 2 ? 'bg-primary' : 'bg-slate-200'}`}></div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
            step >= 2 ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'
          }`}>
            2
          </div>
          <div className={`w-16 h-1 ${step >= 3 ? 'bg-primary' : 'bg-slate-200'}`}></div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
            step >= 3 ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'
          }`}>
            3
          </div>
        </div>

        {/* 步骤 1: 输入邮箱和验证码 */}
        {step === 1 && (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center mb-8">
              <h2 className="text-xl font-bold text-slate-900 mb-2">验证邮箱</h2>
              <p className="text-sm text-slate-500">请输入注册时使用的邮箱地址</p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                邮箱地址 <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={values.email}
                onChange={handleChange('email')}
                placeholder="example@mail.com"
                className="w-full bg-slate-50/80 border border-slate-100 rounded-xl py-3.5 px-4 text-slate-900 font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary/30 placeholder:font-normal"
              />
              {touched.email && errors.email && (
                <p className="mt-1.5 text-[10px] text-red-500 font-bold">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                验证码 <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={values.code}
                  onChange={handleChange('code')}
                  placeholder="请输入6位验证码"
                  maxLength={6}
                  className="flex-1 bg-slate-50/80 border border-slate-100 rounded-xl py-3.5 px-4 text-slate-900 font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary/30 placeholder:font-normal"
                />
                <button
                  onClick={sendVerificationCode}
                  disabled={loading || countdown > 0}
                  className="px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold text-sm whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200 transition-colors"
                >
                  {countdown > 0 ? `${countdown}s` : '获取验证码'}
                </button>
              </div>
              {touched.code && errors.code && (
                <p className="mt-1.5 text-[10px] text-red-500 font-bold">{errors.code}</p>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-50 rounded-xl flex items-center gap-2 text-red-500 text-xs font-bold">
                <span className="material-symbols-outlined text-sm">error</span>
                {error}
              </div>
            )}

            <button
              onClick={verifyCode}
              disabled={loading}
              className="w-full mt-6 bg-gradient-to-r from-primary to-blue-500 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-200/50 active:scale-[0.97] transition-all disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>验证中...</span>
                </>
              ) : (
                <>
                  <span>下一步</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* 步骤 2: 设置新密码 */}
        {step === 2 && (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center mb-8">
              <h2 className="text-xl font-bold text-slate-900 mb-2">设置新密码</h2>
              <p className="text-sm text-slate-500">请设置您的新密码</p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                新密码 <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={values.newPassword}
                onChange={handleChange('newPassword')}
                placeholder="请输入新密码（至少6位）"
                className="w-full bg-slate-50/80 border border-slate-100 rounded-xl py-3.5 px-4 text-slate-900 font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary/30 placeholder:font-normal"
              />
              {touched.newPassword && errors.newPassword && (
                <p className="mt-1.5 text-[10px] text-red-500 font-bold">{errors.newPassword}</p>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                确认新密码 <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={values.confirmPassword}
                onChange={handleChange('confirmPassword')}
                placeholder="请再次输入新密码"
                className="w-full bg-slate-50/80 border border-slate-100 rounded-xl py-3.5 px-4 text-slate-900 font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary/30 placeholder:font-normal"
              />
              {touched.confirmPassword && errors.confirmPassword && (
                <p className="mt-1.5 text-[10px] text-red-500 font-bold">{errors.confirmPassword}</p>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-50 rounded-xl flex items-center gap-2 text-red-500 text-xs font-bold">
                <span className="material-symbols-outlined text-sm">error</span>
                {error}
              </div>
            )}

            <button
              onClick={resetPassword}
              disabled={loading}
              className="w-full mt-6 bg-gradient-to-r from-primary to-blue-500 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-200/50 active:scale-[0.97] transition-all disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>重置中...</span>
                </>
              ) : (
                <>
                  <span>重置密码</span>
                  <span className="material-symbols-outlined text-sm">lock_reset</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* 步骤 3: 重置成功 */}
        {step === 3 && (
          <div className="text-center animate-fade-in">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-4xl text-green-600">check_circle</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">密码重置成功</h2>
            <p className="text-slate-500 mb-8">您的密码已成功重置，请使用新密码登录</p>
            <button
              onClick={() => onNavigate('login')}
              className="w-full bg-gradient-to-r from-primary to-blue-500 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-200/50 active:scale-[0.97] transition-all flex items-center justify-center gap-2"
            >
              <span>去登录</span>
              <span className="material-symbols-outlined text-sm">login</span>
            </button>
          </div>
        )}
      </main>
    </Layout>
  );
};
