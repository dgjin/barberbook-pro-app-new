import React, { useCallback } from 'react';
import { Layout } from '../components/Layout';
import { PageRoute, User } from '../types';
import { useAuth, useForm } from '../hooks/useAuth';
import { useImageUpload } from '../hooks/useBooking';
import { Loading } from '../components/Loading';

interface Props {
  onNavigate: (route: PageRoute) => void;
  onRegister: (user: User) => void;
}

interface RegisterForm {
  nickname: string;
  realName: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export const Register: React.FC<Props> = ({ onNavigate, onRegister }) => {
  // 图片上传 Hook
  const { image: avatar, handleFileChange, loading: imageLoading } = useImageUpload();

  // 表单状态管理
  const { values, errors, handleChange, validate, touched, setValue } = useForm<RegisterForm>(
    { nickname: '', realName: '', phone: '', email: '', password: '', confirmPassword: '' },
    {
      nickname: (value) => !value ? '请输入昵称' : undefined,
      phone: (value) => {
        if (!value) return '请输入手机号';
        if (!/^1[3-9]\d{9}$/.test(value)) return '手机号格式不正确';
        return undefined;
      },
      password: (value) => {
        if (!value) return '请输入密码';
        if (value.length < 6) return '密码至少需要6位';
        return undefined;
      },
      confirmPassword: (value, values) => {
        if (!value) return '请确认密码';
        if (value !== values.password) return '两次输入的密码不一致';
        return undefined;
      }
    }
  );

  // 认证 Hook
  const { register, loading, error, clearError } = useAuth(onRegister);

  // 设置头像到表单
  const handleAvatarChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileChange(e);
  }, [handleFileChange]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!validate()) return;
    clearError();

    await register({
      nickname: values.nickname,
      realName: values.realName,
      phone: values.phone,
      email: values.email,
      password: values.password,
      avatar: avatar || undefined
    });
  };

  return (
    <Layout className="bg-white">
      <header className="pt-12 pb-4 px-6 sticky top-0 bg-white z-40 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={() => onNavigate('login')}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-50 transition-colors -ml-2"
          >
            <span className="material-symbols-outlined text-slate-800">arrow_back</span>
          </button>
          <h1 className="text-lg font-extrabold text-slate-900 ml-2 font-display">注册新账号</h1>
        </div>
      </header>

      <main className="p-6 pb-20 overflow-y-auto">
        {/* 头像上传 */}
        <div className="flex flex-col items-center justify-center mb-8">
          <div className="relative group">
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-slate-50 shadow-md bg-slate-100">
              {imageLoading ? (
                <div className="w-full h-full flex items-center justify-center">
                  <Loading size="sm" />
                </div>
              ) : avatar ? (
                <img src={avatar} alt="Avatar Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  <span className="material-symbols-outlined text-4xl">person</span>
                </div>
              )}
            </div>
            <label
              htmlFor="reg-avatar-upload"
              className="absolute bottom-0 right-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:bg-blue-600 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">photo_camera</span>
            </label>
            <input
              id="reg-avatar-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <p className="text-xs text-slate-400 mt-2">上传头像 (可选)</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 昵称 */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
              昵称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={values.nickname}
              onChange={handleChange('nickname')}
              placeholder="请输入您的昵称"
              className="w-full bg-slate-50/80 border border-slate-100 rounded-xl py-3.5 px-4 text-slate-900 font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary/30 placeholder:font-normal"
            />
            {touched.nickname && errors.nickname && (
              <p className="mt-1.5 text-[10px] text-red-500 font-bold">{errors.nickname}</p>
            )}
          </div>

          {/* 真实姓名和手机号 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                真实姓名
              </label>
              <input
                type="text"
                value={values.realName}
                onChange={handleChange('realName')}
                placeholder="可选"
                className="w-full bg-slate-50/80 border border-slate-100 rounded-xl py-3.5 px-4 text-slate-900 font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary/30 placeholder:font-normal"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                手机号码 <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={values.phone}
                onChange={handleChange('phone')}
                placeholder="11位手机号"
                className="w-full bg-slate-50/80 border border-slate-100 rounded-xl py-3.5 px-4 text-slate-900 font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary/30 placeholder:font-normal"
              />
              {touched.phone && errors.phone && (
                <p className="mt-1.5 text-[10px] text-red-500 font-bold">{errors.phone}</p>
              )}
            </div>
          </div>

          {/* 电子邮箱 */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
              电子邮箱
            </label>
            <input
              type="email"
              value={values.email}
              onChange={handleChange('email')}
              placeholder="example@mail.com (可选)"
              className="w-full bg-slate-50/80 border border-slate-100 rounded-xl py-3.5 px-4 text-slate-900 font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary/30 placeholder:font-normal"
            />
          </div>

          <div className="border-t border-dashed border-gray-200 my-2 pt-2"></div>

          {/* 密码 */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
              密码 <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={values.password}
              onChange={handleChange('password')}
              placeholder="设置登录密码"
              className="w-full bg-slate-50/80 border border-slate-100 rounded-xl py-3.5 px-4 text-slate-900 font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary/30 placeholder:font-normal"
            />
            {touched.password && errors.password && (
              <p className="mt-1.5 text-[10px] text-red-500 font-bold">{errors.password}</p>
            )}
          </div>

          {/* 确认密码 */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
              确认密码 <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={values.confirmPassword}
              onChange={handleChange('confirmPassword')}
              placeholder="请再次输入密码"
              className="w-full bg-slate-50/80 border border-slate-100 rounded-xl py-3.5 px-4 text-slate-900 font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary/30 placeholder:font-normal"
            />
            {touched.confirmPassword && errors.confirmPassword && (
              <p className="mt-1.5 text-[10px] text-red-500 font-bold">{errors.confirmPassword}</p>
            )}
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="p-3 bg-red-50 rounded-xl flex items-center gap-2 text-red-500 text-xs font-bold animate-pulse">
              <span className="material-symbols-outlined text-sm">error</span>
              {error}
            </div>
          )}

          {/* 提交按钮 */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-10 bg-gradient-to-r from-slate-800 to-slate-900 text-white font-bold py-4 rounded-2xl shadow-xl shadow-slate-200 active:scale-[0.98] transition-all disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>注册中...</span>
              </>
            ) : (
              <>
                <span>立即注册</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          注册即代表您同意 <span className="text-primary font-bold">服务条款</span> 和 <span className="text-primary font-bold">隐私政策</span>
        </p>
      </main>
    </Layout>
  );
};
