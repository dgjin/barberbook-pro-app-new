import React, { useState, useEffect } from 'react';
import { Layout } from '../../components/Layout';
import { BottomNav } from '../../components/BottomNav';
import { PageRoute, User, Barber } from '../../types';
import { supabase } from '../../services/supabase';

interface Props {
  onNavigate: (route: PageRoute) => void;
  currentUser?: User | null;
}

export const BarberProfile: React.FC<Props> = ({ onNavigate, currentUser }) => {
  const [barberInfo, setBarberInfo] = useState<Barber | null>(null);
  const [todayStats, setTodayStats] = useState({ served: 0, revenue: 0 });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const todayStr = `${new Date().getMonth() + 1}月${new Date().getDate()}日`;

  useEffect(() => {
    if (!currentUser?.name) return;

    // 获取理发师信息
    const fetchBarberInfo = async () => {
      const { data } = await supabase
        .from('app_barbers')
        .select('*')
        .eq('name', currentUser.name)
        .single();
      if (data) setBarberInfo(data as unknown as Barber);
    };

    // 获取今日业绩
    const fetchTodayStats = async () => {
      const { data } = await supabase
        .from('app_appointments')
        .select('*')
        .eq('barber_name', currentUser.name)
        .eq('date_str', todayStr)
        .eq('status', 'completed');

      if (data) {
        const served = data.length;
        const revenue = data.reduce((sum: number, a: any) => sum + (a.price || 0), 0);
        setTodayStats({ served, revenue });
      }
    };

    fetchBarberInfo();
    fetchTodayStats();
  }, [currentUser?.name, todayStr]);

  const handleLogout = () => {
    setShowLogoutConfirm(false);
    onNavigate('login');
  };

  if (!currentUser) {
    return (
      <Layout className="bg-slate-50">
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-400">请先登录</p>
        </div>
        <BottomNav activeRoute="barber_profile" onNavigate={onNavigate} userRole="barber" />
      </Layout>
    );
  }

  return (
    <Layout className="bg-slate-50">
      {/* Header */}
      <header className="pt-14 pb-6 px-6 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 rounded-2xl overflow-hidden border-4 border-white/20 shadow-xl">
            <img
              src={currentUser.avatar || `https://ui-avatars.com/api/?name=${currentUser.name}&background=007AFF&color=fff`}
              alt={currentUser.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h1 className="text-2xl font-black">{currentUser.name}</h1>
            <p className="text-slate-400 text-sm">{barberInfo?.title || '专业理发师'}</p>
            <div className="flex items-center gap-1 mt-1">
              <span className="material-symbols-outlined text-amber-400 text-sm">star</span>
              <span className="text-amber-400 font-bold">{barberInfo?.rating || 4.8}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-5 pb-32 pt-6 space-y-6 overflow-y-auto">
        {/* 今日业绩 */}
        <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">今日业绩</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-2xl p-4 text-center">
              <p className="text-3xl font-black text-primary">{todayStats.served}</p>
              <p className="text-xs text-slate-500 font-medium mt-1">服务顾客</p>
            </div>
            <div className="bg-green-50 rounded-2xl p-4 text-center">
              <p className="text-3xl font-black text-green-600">¥{todayStats.revenue}</p>
              <p className="text-xs text-slate-500 font-medium mt-1">今日收入</p>
            </div>
          </div>
        </section>

        {/* 快捷操作 */}
        <section className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest px-6 pt-5 pb-3">快捷操作</h2>

          <button
            onClick={() => onNavigate('admin_workbench')}
            className="w-full flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors border-b border-slate-50"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined">content_cut</span>
            </div>
            <div className="flex-1 text-left">
              <p className="font-bold text-slate-900">返回工作台</p>
              <p className="text-xs text-slate-400">查看当前服务队列</p>
            </div>
            <span className="material-symbols-outlined text-slate-300">chevron_right</span>
          </button>

          <button
            onClick={() => onNavigate('monitor')}
            className="w-full flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors border-b border-slate-50"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
              <span className="material-symbols-outlined">tv</span>
            </div>
            <div className="flex-1 text-left">
              <p className="font-bold text-slate-900">监控大屏</p>
              <p className="text-xs text-slate-400">查看实时排队状态</p>
            </div>
            <span className="material-symbols-outlined text-slate-300">chevron_right</span>
          </button>

          <button
            onClick={() => onNavigate('web_monitor')}
            className="w-full flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <span className="material-symbols-outlined">desktop_windows</span>
            </div>
            <div className="flex-1 text-left">
              <p className="font-bold text-slate-900">全屏展示</p>
              <p className="text-xs text-slate-400">开启叫号大屏模式</p>
            </div>
            <span className="material-symbols-outlined text-slate-300">chevron_right</span>
          </button>
        </section>

        {/* 账户操作 */}
        <section className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest px-6 pt-5 pb-3">账户</h2>

          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center gap-4 px-6 py-4 hover:bg-red-50 transition-colors text-red-600"
          >
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <span className="material-symbols-outlined">logout</span>
            </div>
            <div className="flex-1 text-left">
              <p className="font-bold">退出登录</p>
              <p className="text-xs text-red-400">返回系统登录页面</p>
            </div>
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </section>
      </main>

      {/* 退出确认弹窗 */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setShowLogoutConfirm(false)} />
          <div className="relative bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl">logout</span>
              </div>
              <h3 className="text-xl font-black text-slate-900">确认退出？</h3>
              <p className="text-sm text-slate-500 mt-2">退出后将返回系统登录页面</p>
            </div>
            <div className="space-y-3">
              <button
                onClick={handleLogout}
                className="w-full bg-red-600 text-white font-bold py-4 rounded-2xl hover:bg-red-700 transition-colors"
              >
                确认退出
              </button>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="w-full bg-slate-100 text-slate-700 font-bold py-4 rounded-2xl hover:bg-slate-200 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav activeRoute="barber_profile" onNavigate={onNavigate} userRole="barber" />
    </Layout>
  );
};
