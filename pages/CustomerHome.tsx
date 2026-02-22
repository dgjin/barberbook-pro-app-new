import React, { useState, useCallback, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { BottomNav } from '../components/BottomNav';
import { PageRoute, Barber, User } from '../types';
import { useBarbers } from '../hooks/useBarbers';
import { useQueue } from '../hooks/useQueue';
import { useRealtime } from '../hooks/useRealtime';
import { Skeleton, Loading } from '../components/Loading';

interface Props {
  onNavigate: (route: PageRoute) => void;
  onBarberSelect?: (barber: Barber | null) => void;
  currentUser?: User | null;
}

export const CustomerHome: React.FC<Props> = ({ onNavigate, onBarberSelect, currentUser }) => {
  const [showQuickHelp, setShowQuickHelp] = useState(false);

  // 使用自定义 Hooks 获取数据
  const {
    barbers,
    loading: barbersLoading,
    error: barbersError,
    refetch: refetchBarbers
  } = useBarbers({
    limit: 6,
    orderBy: 'rating',
    ascending: false
  });

  const {
    stats: queueStats,
    loading: queueLoading,
    error: queueError,
    refetch: refetchQueue
  } = useQueue();

  // 实时订阅队列更新
  useRealtime({
    table: 'app_appointments',
    onAny: useCallback(() => {
      refetchQueue();
    }, [refetchQueue])
  });

  // 实时订阅理发师状态更新
  useRealtime({
    table: 'app_barbers',
    onUpdate: useCallback(() => {
      refetchBarbers();
    }, [refetchBarbers])
  });

  // 错误处理
  useEffect(() => {
    if (barbersError || queueError) {
      console.error('Data fetch error:', barbersError || queueError);
    }
  }, [barbersError, queueError]);

  // 处理理发师选择
  const handleBarberClick = useCallback((barber: Barber) => {
    if (onBarberSelect) {
      onBarberSelect(barber);
    }
    onNavigate('booking');
  }, [onBarberSelect, onNavigate]);

  // 获取状态指示器样式
  const getStatusDot = (status: Barber['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-400 shadow-[0_0_8px_#4ade80]';
      case 'busy':
        return 'bg-orange-400';
      case 'rest':
        return 'bg-slate-400';
      default:
        return 'bg-slate-400';
    }
  };

  const getStatusText = (status: Barber['status']) => {
    switch (status) {
      case 'active': return '在线';
      case 'busy': return '忙碌';
      case 'rest': return '休息';
      default: return '离线';
    }
  };

  return (
    <Layout className="bg-[#F8FAFC]">
      {/* Header */}
      <header className="pt-14 pb-6 px-6 flex justify-between items-center sticky top-0 bg-[#F8FAFC]/80 ios-blur z-20">
        <div className="animate-fade-in">
          <p className="text-[11px] text-primary font-bold uppercase tracking-widest mb-1">
            {currentUser ? 'GOOD MORNING' : 'WELCOME TO'}
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 font-display">
            {currentUser ? currentUser.name : 'BarberBook Pro'}
          </h1>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowQuickHelp(true)}
            className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 active:scale-90 transition-all hover:bg-slate-50"
          >
            <span className="material-symbols-outlined text-[24px]">help</span>
          </button>
          <div
            className="relative cursor-pointer transition-transform active:scale-90"
            onClick={() => currentUser ? onNavigate('check_in') : onNavigate('login')}
          >
            <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-white shadow-md bg-slate-200 ring-4 ring-slate-50">
              {currentUser?.avatar ? (
                <img alt="User" className="w-full h-full object-cover" src={currentUser.avatar} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">
                  <span className="material-symbols-outlined text-[24px]">person</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 pb-32 space-y-10 no-scrollbar">
        {/* Queue Status Card */}
        <section className="animate-fade-in">
          <div className="bg-white rounded-[40px] p-8 shadow-2xl shadow-blue-100/60 border border-white flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-primary/40 to-transparent"></div>
            <div className="inline-flex items-center gap-2 mb-6 px-5 py-2 bg-blue-50 rounded-full border border-blue-100">
              <span className={`w-2.5 h-2.5 rounded-full ${queueLoading ? 'bg-slate-300' : 'bg-primary animate-pulse shadow-[0_0_10px_rgba(0,122,255,0.7)]'}`}></span>
              <span className="text-[11px] font-bold text-primary uppercase tracking-widest">今日实时队列</span>
            </div>
            <div className="mb-2">
              <span className="text-[12px] text-slate-500 font-semibold uppercase tracking-wider">预计平均等待时间</span>
            </div>
            <div className="flex items-baseline gap-2 mb-10">
              {queueLoading ? (
                <span className="text-7xl font-black text-slate-100 animate-pulse">--</span>
              ) : (
                <span className="text-7xl font-black text-slate-900 tracking-tighter">
                  {queueStats.estimatedWaitTime}
                </span>
              )}
              <span className="text-xl font-bold text-slate-300 uppercase">min</span>
            </div>

            {/* 繁忙状态提示 */}
            {queueStats.isBusy && !queueLoading && (
              <div className="mb-4 px-4 py-2 bg-orange-50 text-orange-600 rounded-full text-xs font-bold">
                <span className="material-symbols-outlined text-[14px] align-middle mr-1">warning</span>
                当前较为繁忙
              </div>
            )}

            <button
              onClick={() => onNavigate('monitor')}
              className="w-full bg-gradient-to-r from-slate-800 to-slate-900 text-white font-bold py-5 rounded-2xl shadow-xl shadow-slate-200 active:scale-[0.97] transition-all flex items-center justify-center gap-3 group"
            >
              <span className="material-symbols-outlined text-[22px] transition-transform group-hover:scale-110">bolt</span>
              <span className="text-[15px] tracking-wider">查看实时监控屏</span>
            </button>
          </div>
        </section>

        {/* Top Barbers Section */}
        <section>
          <div className="flex justify-between items-end mb-6 px-1">
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 tracking-tight font-display">甄选发型专家</h3>
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider mt-1">Certified Specialists</p>
            </div>
            <button
              onClick={() => onNavigate('booking')}
              className="text-primary text-[11px] font-bold uppercase tracking-wider bg-blue-50 px-4 py-2 rounded-xl border border-blue-100 shadow-sm active:scale-95 transition-all hover:bg-blue-100"
            >
              全部
            </button>
          </div>

          <div className="flex gap-6 overflow-x-auto pb-8 -mx-6 px-6 hide-scrollbar snap-x">
            {barbersLoading ? (
              <Skeleton rows={1} avatar className="min-w-[200px]" />
            ) : barbersError ? (
              <div className="w-full text-center py-8">
                <p className="text-slate-400 text-sm">加载失败，请重试</p>
                <button
                  onClick={refetchBarbers}
                  className="mt-2 text-primary text-xs font-bold"
                >
                  重新加载
                </button>
              </div>
            ) : (
              barbers.map((barber) => (
                <div
                  key={barber.id}
                  className="snap-start min-w-[200px] bg-white rounded-[36px] p-3 pb-8 border border-white shadow-xl shadow-slate-100/50 hover:shadow-2xl hover:shadow-blue-100/30 transition-all duration-500 cursor-pointer active:scale-95 group"
                  onClick={() => handleBarberClick(barber)}
                >
                  <div className="relative aspect-[4/5] mb-6 rounded-[28px] overflow-hidden shadow-inner">
                    <img
                      alt={barber.name}
                      className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                      src={barber.image}
                      loading="lazy"
                    />
                    <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-xl flex items-center gap-1 shadow-md border border-white/50">
                      <span className="material-symbols-outlined text-[14px] text-orange-400 fill-1">star</span>
                      <span className="text-[12px] font-black text-slate-900">{barber.rating}</span>
                    </div>
                    <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-2xl border border-white/10">
                      <span className={`w-2 h-2 rounded-full ${getStatusDot(barber.status)}`}></span>
                      <span className="text-[10px] font-black text-white uppercase tracking-tighter">
                        {getStatusText(barber.status)}
                      </span>
                    </div>
                  </div>
                  <div className="px-4 text-center">
                    <p className="font-bold text-[17px] text-slate-900 mb-1 truncate tracking-tight font-display">{barber.name}</p>
                    <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider mb-6 truncate">
                      {barber.title || 'Master Stylist'}
                    </p>
                    <div className="inline-flex items-center justify-center gap-2 text-primary bg-blue-50/80 px-6 py-2.5 rounded-2xl border border-blue-100 group-hover:bg-primary group-hover:text-white transition-all duration-300 w-full shadow-sm">
                      <span className="text-[11px] font-bold uppercase tracking-wider">立即预约</span>
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Quick Nav Matrix */}
        <section className="pb-10">
          <div className="px-1 mb-6">
            <h3 className="text-lg font-extrabold text-slate-900 tracking-tight font-display">探索空间</h3>
            <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider mt-1">Explore Hub</p>
          </div>
          <div className="grid grid-cols-1 gap-5">
            <div
              className="bg-white rounded-[32px] p-6 flex gap-6 items-center shadow-xl shadow-slate-100/60 border border-white cursor-pointer active:bg-slate-50 active:scale-[0.98] transition-all group"
              onClick={() => setShowQuickHelp(true)}
            >
              <div className="bg-amber-50 text-amber-500 w-16 h-16 rounded-[24px] flex items-center justify-center group-hover:bg-amber-100 transition-colors shadow-inner">
                <span className="material-symbols-outlined text-4xl">lightbulb</span>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-slate-900 text-[16px] tracking-tight font-display">新手操作指南</h4>
                <p className="text-[13px] text-slate-400 font-medium mt-1">3 Steps to start your journey</p>
              </div>
              <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-300 group-hover:text-primary transition-all group-hover:translate-x-1">
                <span className="material-symbols-outlined text-[24px]">chevron_right</span>
              </div>
            </div>

            <div
              className="bg-white rounded-[32px] p-6 flex gap-6 items-center shadow-xl shadow-slate-100/60 border border-white cursor-pointer active:bg-slate-50 active:scale-[0.98] transition-all group"
              onClick={() => onNavigate('check_in')}
            >
              <div className="bg-blue-50 text-primary w-16 h-16 rounded-[24px] flex items-center justify-center group-hover:bg-blue-100 transition-colors shadow-inner">
                <span className="material-symbols-outlined text-4xl">confirmation_number</span>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-slate-900 text-[16px] tracking-tight font-display">理发券资产中心</h4>
                <p className="text-[13px] text-slate-400 font-medium mt-1">Manage your digital vouchers</p>
              </div>
              <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-300 group-hover:text-primary transition-all group-hover:translate-x-1">
                <span className="material-symbols-outlined text-[24px]">chevron_right</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Quick Help Modal */}
      {showQuickHelp && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-6">
          <div
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-lg transition-opacity"
            onClick={() => setShowQuickHelp(false)}
          ></div>
          <div className="relative bg-white w-full max-w-sm rounded-[48px] p-10 shadow-2xl animate-[slide-up_0.4s_cubic-bezier(0.16,1,0.3,1)] max-h-[85vh] overflow-y-auto no-scrollbar border border-white/20">
            <div className="flex justify-between items-center mb-10">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">操作指引</h2>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.25em] mt-1">User Onboarding</p>
              </div>
              <button
                onClick={() => setShowQuickHelp(false)}
                className="w-12 h-12 flex items-center justify-center bg-slate-100 rounded-2xl text-slate-500 hover:bg-slate-200 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="space-y-10">
              <div className="flex gap-6">
                <div className="w-12 h-12 rounded-[20px] bg-primary/10 text-primary flex items-center justify-center shrink-0 font-black shadow-inner text-lg">1</div>
                <div>
                  <h4 className="font-black text-slate-900 mb-2 text-base tracking-tight">在线选人与预约</h4>
                  <p className="text-[13px] text-slate-500 leading-relaxed font-medium">挑选您信任的发型师，选择合适的时段。完成系统确认后，您的席位将被正式预留。</p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="w-12 h-12 rounded-[20px] bg-primary/10 text-primary flex items-center justify-center shrink-0 font-black shadow-inner text-lg">2</div>
                <div>
                  <h4 className="font-black text-slate-900 mb-2 text-base tracking-tight">到店扫码签到</h4>
                  <p className="text-[13px] text-slate-500 leading-relaxed font-medium">到店后出示"个人中心"的预约码。此操作将激活您的到店状态，正式进入排队队列。</p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="w-12 h-12 rounded-[20px] bg-primary/10 text-primary flex items-center justify-center shrink-0 font-black shadow-inner text-lg">3</div>
                <div>
                  <h4 className="font-black text-slate-900 mb-2 text-base tracking-tight">自动结算与评价</h4>
                  <p className="text-[13px] text-slate-500 leading-relaxed font-medium">服务完工后，系统将自动优先扣除理发券。理发师结算后，请为本次服务留下宝贵评价。</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowQuickHelp(false)}
              className="w-full mt-12 bg-slate-900 text-white font-black py-5 rounded-[24px] shadow-2xl shadow-slate-200 active:scale-[0.96] transition-all text-base tracking-widest"
            >
              开始预约服务
            </button>
          </div>
        </div>
      )}

      <BottomNav activeRoute="home" onNavigate={onNavigate} userRole="customer" />
    </Layout>
  );
};
