import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Barber, User } from '../types';

interface RoleLauncherProps {
  availableBarbers: Barber[];
  loginAsAdmin: () => void;
  loginAsBarber: (barber: Barber) => void;
  handleGuestVisit: () => void;
}

export const RoleLauncher: React.FC<RoleLauncherProps> = ({
  availableBarbers,
  handleGuestVisit,
}) => {
  const navigate = useNavigate();
  const [showBarberLogin, setShowBarberLogin] = useState(false);

  return (
    <div className="min-h-screen bg-bg-main flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* ... (existing background divs) */}
      <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-primary/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-cyan-400/20 rounded-full blur-3xl"></div>

      <div className="w-20 h-20 bg-primary rounded-[24px] flex items-center justify-center shadow-xl shadow-blue-200 mb-8 z-10">
        <span className="material-symbols-outlined text-4xl text-white">content_cut</span>
      </div>

      <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight z-10">BarberBook Pro</h1>
      <p className="text-slate-500 mb-10 text-center max-w-[240px] z-10">请选择您的身份登录<br />Select Role to Login</p>

      {!showBarberLogin ? (
        <div className="w-full space-y-4 max-w-xs z-10">
          <button
            onClick={() => navigate('/login')}
            className="w-full p-4 bg-white hover:bg-gray-50 text-slate-900 rounded-2xl font-bold shadow-lg shadow-gray-100 border border-white flex items-center justify-between group transition-all active:scale-95 disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined">person</span>
              </div>
              <div className="text-left">
                <p className="text-sm font-bold">我是顾客</p>
                <p className="text-[10px] text-slate-400">账号登录 / 注册</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-gray-300 group-hover:text-primary transition-colors">arrow_forward</span>
          </button>

          <button
            onClick={() => setShowBarberLogin(true)}
            className="w-full p-4 bg-white hover:bg-gray-50 text-slate-900 rounded-2xl font-bold shadow-lg shadow-gray-100 border border-white flex items-center justify-between group transition-all active:scale-95 disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center">
                <span className="material-symbols-outlined">content_cut</span>
              </div>
              <div className="text-left">
                <p className="text-sm font-bold">我是理发师</p>
                <p className="text-[10px] text-slate-400">员工入口</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-gray-300 group-hover:text-orange-500 transition-colors">arrow_forward</span>
          </button>

          <button
            onClick={() => navigate('/login')}
            className="w-full p-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl shadow-slate-200 flex items-center justify-between group transition-all active:scale-95 disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center">
                <span className="material-symbols-outlined">admin_panel_settings</span>
              </div>
              <div className="text-left">
                <p className="text-sm font-bold">我是管理员</p>
                <p className="text-[10px] text-slate-400">系统后台</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-gray-500 group-hover:text-white transition-colors">arrow_forward</span>
          </button>

          <div className="pt-4 flex flex-col items-center gap-2">
            <button onClick={handleGuestVisit} className="w-full text-slate-500 text-sm font-semibold hover:text-slate-800 transition-colors flex items-center justify-center gap-1 py-2 bg-white/50 rounded-xl border border-transparent hover:bg-white hover:border-gray-100 disabled:opacity-50">
              <span>随便逛逛 (游客模式)</span>
            </button>
            <div className="flex gap-4">
              <button
                onClick={() => navigate('/monitor')}
                className="text-slate-400 text-xs hover:text-primary transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[14px]">tv</span>
                <span>监控大屏</span>
              </button>
              <button
                onClick={() => navigate('/register')}
                className="text-primary text-xs font-bold hover:underline disabled:opacity-50"
              >
                立即注册
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-xs z-10 animate-fade-in">
          <div className="flex items-center gap-2 mb-4 cursor-pointer text-slate-500 hover:text-slate-800" onClick={() => setShowBarberLogin(false)}>
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            <span className="text-xs font-bold">返回角色选择</span>
          </div>
          <div className="bg-white/80 backdrop-blur-md rounded-2xl p-2 max-h-[400px] overflow-y-auto shadow-xl border border-white">
            {availableBarbers.map(b => (
              <div
                key={b.id}
                onClick={() => navigate(`/login`)}
                className="p-3 hover:bg-white rounded-xl flex items-center gap-3 cursor-pointer transition-colors border border-transparent hover:border-gray-100"
              >
                <img src={b.image} className="w-10 h-10 rounded-full object-cover" loading="lazy" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-900">{b.name}</p>
                  <p className="text-[10px] text-slate-500">{b.title}</p>
                </div>
                <span className="material-symbols-outlined text-slate-300">vpn_key</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="absolute bottom-8 text-[10px] text-slate-400 font-medium">© 2023 BarberBook Inc.</p>
    </div>
  );
};
