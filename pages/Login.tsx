import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { PageRoute, User } from '../types';
import { useAuth, useForm } from '../hooks/useAuth';
import { Loading } from '../components/Loading';
import { useWechatAuth } from '../hooks/useWechatAuth';

interface Props {
  onNavigate: (route: PageRoute) => void;
  onLogin: (user: User) => void;
}

interface LoginForm {
  account: string;
  password: string;
}

export const Login: React.FC<Props> = ({ onNavigate, onLogin }) => {
  const role = 'customer';
  const uiTexts = {
    title: '欢迎光临理发室',
    subtitle: 'BarberBook Pro Secure Access',
    accountLabel: '登录账号 / ACCOUNT',
    accountPlaceholder: '请输入手机号或用户名'
  };

  // 表单状态管理
  const { values, errors, handleChange, validate, touched } = useForm<LoginForm>(
    { account: '', password: '' },
    {
      account: (value) => !value ? `请输入${uiTexts.accountLabel.split(' / ')[0]}` : undefined,
      password: (value) => !value ? '请输入密码' : undefined
    }
  );

  // 认证 Hook
  const { login, loading, error, clearError } = useAuth(onLogin);

  // 微信登录 Hook
  const { loginWithWechat, handleWechatCallback, loading: wechatLoading, error: wechatError, clearError: clearWechatError } = useWechatAuth(onLogin);

  // 处理微信回调（从 URL 参数获取 code）
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const savedState = sessionStorage.getItem('wechat_auth_state');

    if (code && state && state === savedState) {
      // 清除 state
      sessionStorage.removeItem('wechat_auth_state');
      // 处理微信登录回调
      handleWechatCallback(code);
    }
  }, [searchParams, handleWechatCallback]);

  const handleLogin = async () => {
    if (!validate()) return;
    clearError();
    const user = await login({ account: values.account, password: values.password });

    // 登录后的跳转逻辑由 App.tsx 的 onLogin 回调处理
  };

  return (
    <Layout className="bg-white">
      {/* 安全加固：移除所有返回入口 */}

      <main className="px-10 pt-10 pb-20 flex flex-col h-full animate-fade-in">
        <div className="mb-14">
          <h1 className="text-5xl font-extrabold text-slate-900 mb-3 tracking-tight font-display">{uiTexts.title}</h1>
          <p className="text-slate-500 text-sm font-semibold tracking-wider">{uiTexts.subtitle}</p>
        </div>

        <div className="space-y-8">
          <div className="group">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] block mb-3 px-1">
              {uiTexts.accountLabel}
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors">
                account_circle
              </span>
              <input
                type="text"
                value={values.account}
                onChange={handleChange('account')}
                placeholder={uiTexts.accountPlaceholder}
                className="w-full bg-slate-50/80 border border-slate-100 rounded-2xl py-4.5 pl-14 pr-6 text-slate-900 font-semibold focus:ring-2 focus:ring-primary/20 focus:border-primary/30 placeholder:font-medium placeholder:text-slate-300 transition-all text-[15px]"
              />
            </div>
            {touched.account && errors.account && (
              <p className="mt-2 text-[10px] text-red-500 font-bold">{errors.account}</p>
            )}
          </div>

          <div className="group">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] block mb-3 px-1">
              安全密码 / PASSWORD
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors">
                lock
              </span>
              <input
                type="password"
                value={values.password}
                onChange={handleChange('password')}
                placeholder="请输入密码"
                className="w-full bg-slate-50/80 border border-slate-100 rounded-2xl py-4.5 pl-14 pr-6 text-slate-900 font-semibold focus:ring-2 focus:ring-primary/20 focus:border-primary/30 placeholder:font-medium placeholder:text-slate-300 transition-all text-[15px]"
              />
            </div>
            {touched.password && errors.password && (
              <p className="mt-2 text-[10px] text-red-500 font-bold">{errors.password}</p>
            )}
            <div className="flex justify-end mt-4">
              <button className="text-[12px] font-semibold text-primary hover:opacity-70 transition-opacity">
                忘记密码?
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-8 p-4 bg-red-50 rounded-[20px] flex items-center gap-3 text-red-500 text-[11px] font-black uppercase animate-shake border border-red-100">
            <span className="material-symbols-outlined text-lg">error</span>
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full mt-12 bg-gradient-to-r from-primary to-blue-500 text-white font-bold py-5 rounded-2xl shadow-xl shadow-blue-200/50 active:scale-[0.97] transition-all disabled:opacity-70 flex items-center justify-center gap-3 text-[15px] tracking-wide"
        >
          {loading ? (
            <span className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></span>
          ) : (
            <>
              <span>立即进入系统</span>
              <span className="material-symbols-outlined">login</span>
            </>
          )}
        </button>

        {/* 微信登录错误提示 */}
        {wechatError && (
          <div className="mt-4 p-4 bg-red-50 rounded-[20px] flex items-center gap-3 text-red-500 text-[11px] font-black uppercase animate-shake border border-red-100">
            <span className="material-symbols-outlined text-lg">error</span>
            {wechatError}
          </div>
        )}

        {/* 微信登录按钮 */}
        <button
          onClick={() => {
            clearWechatError();
            loginWithWechat();
          }}
          disabled={wechatLoading}
          className="w-full mt-4 bg-[#07C160] hover:bg-[#06AD56] text-white font-bold py-4 rounded-2xl shadow-lg shadow-green-200/50 active:scale-[0.97] transition-all disabled:opacity-70 flex items-center justify-center gap-3 text-[15px] tracking-wide"
        >
          {wechatLoading ? (
            <span className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></span>
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.032zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z"/>
              </svg>
              <span>微信登录</span>
            </>
          )}
        </button>

        {/* 游客浏览入口 */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-all active:scale-[0.97] border border-slate-200"
          >
            <span className="material-symbols-outlined text-[18px]">visibility</span>
            <span className="text-[13px] font-semibold">浏览理发师</span>
          </button>
          <button
            onClick={() => onNavigate('monitor')}
            className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-all active:scale-[0.97] border border-slate-200"
          >
            <span className="material-symbols-outlined text-[18px]">tv</span>
            <span className="text-[13px] font-semibold">查看排队</span>
          </button>
        </div>

        <div className="mt-auto pt-12 pb-6 text-center">
          <div className="flex items-center justify-center gap-3 text-sm">
            <span className="text-slate-400 font-medium">还没有账号?</span>
            <button
              onClick={() => onNavigate('register')}
              className="text-primary font-bold border-b border-primary/30 pb-0.5 hover:opacity-80 transition-opacity"
            >
              立即注册
            </button>
          </div>
          <p className="text-[11px] text-slate-300 font-medium tracking-widest mt-10">BarberBook Pro v1.5.5</p>
        </div>
      </main>
    </Layout>
  );
};
