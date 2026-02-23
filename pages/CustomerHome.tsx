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
        return 'bg-status-ready shadow-[0_0_12px_rgba(16,185,129,0.6)]';
      case 'busy':
        return 'bg-status-busy shadow-[0_0_8px_rgba(239,68,68,0.4)]';
      case 'rest':
        return 'bg-status-rest';
      default:
        return 'bg-status-rest';
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
    <Layout>
      {/* Header */}
      <header className="pt-14 pb-6 px-6 flex justify-between items-center sticky top-0 bg-bg-main/80 backdrop-blur-xl z-20">
        <div className="animate-fade-in">
          <p className="text-[11px] text-primary font-bold uppercase tracking-widest mb-1">
            {currentUser ? 'GOOD MORNING' : 'WELCOME TO'}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-text-main font-heading">
            {currentUser ? currentUser.name : 'BarberBook Pro'}
          </h1>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowQuickHelp(true)}
            className="w-12 h-12 rounded-2xl bg-surface shadow-soft border border-bg-soft flex items-center justify-center text-text-muted active:scale-90 transition-all duration-300 hover:shadow-soft-lg hover:text-primary cursor-pointer"
          >
            <span className="material-symbols-outlined text-[24px]">help</span>
          </button>
          <div
            className="relative cursor-pointer transition-transform active:scale-90"
            onClick={() => currentUser ? onNavigate('check_in') : onNavigate('login')}
          >
            <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-white shadow-soft bg-bg-soft ring-4 ring-bg-soft">
              {currentUser?.avatar ? (
                <img alt="User" className="w-full h-full object-cover" src={currentUser.avatar} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-text-muted">
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
          <div className="bg-surface rounded-[40px] p-8 shadow-soft-xl border border-white flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-primary/40 to-transparent"></div>
            <div className="inline-flex items-center gap-2 mb-6 px-5 py-2 bg-bg-soft rounded-full border border-primary/20">
              <span className={`w-2.5 h-2.5 rounded-full ${queueLoading ? 'bg-text-muted' : 'bg-primary animate-pulse shadow-[0_0_12px_rgba(236,72,153,0.6)]'}`}></span>
              <span className="text-[11px] font-bold text-primary uppercase tracking-widest">今日实时队列</span>
            </div>
            <div className="mb-2">
              <span className="text-[12px] text-text-secondary font-semibold uppercase tracking-wider">预计平均等待时间</span>
            </div>
            <div className="flex items-baseline gap-2 mb-10">
              {queueLoading ? (
                <span className="text-7xl font-bold text-bg-soft animate-pulse">--</span>
              ) : (
                <span className="text-7xl font-bold text-text-main tracking-tighter font-heading">
                  {queueStats.estimatedWaitTime}
                </span>
              )}
              <span className="text-xl font-bold text-text-muted uppercase">min</span>
            </div>

            {/* 繁忙状态提示 */}
            {queueStats.isBusy && !queueLoading && (
              <div className="mb-4 px-4 py-2 bg-accent/10 text-accent rounded-full text-xs font-bold">
                <span className="material-symbols-outlined text-[14px] align-middle mr-1">warning</span>
                当前较为繁忙
              </div>
            )}

            <button
              onClick={() => onNavigate('monitor')}
              className="w-full bg-gradient-to-r from-primary to-primary-dark text-white font-bold py-5 rounded-2xl shadow-soft-xl active:scale-[0.97] transition-all duration-300 flex items-center justify-center gap-3 group cursor-pointer hover:shadow-glow"
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
              <h3 className="text-lg font-bold text-text-main tracking-tight font-heading">甄选发型专家</h3>
              <p className="text-[11px] text-text-muted font-medium uppercase tracking-wider mt-1">Certified Specialists</p>
            </div>
            <button
              onClick={() => onNavigate('booking')}
              className="text-primary text-[11px] font-bold uppercase tracking-wider bg-bg-soft px-4 py-2 rounded-xl border border-primary/20 shadow-soft active:scale-95 transition-all duration-300 hover:shadow-soft-lg hover:bg-primary hover:text-white cursor-pointer"
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
              barbers.filter(b => b.status !== 'rest').map((barber) => (
                <div
                  key={barber.id}
                  className="snap-start min-w-[200px] bg-surface rounded-[36px] p-3 pb-8 border border-white shadow-soft-lg hover:shadow-soft-xl transition-all duration-500 cursor-pointer active:scale-95 group"
                  onClick={() => handleBarberClick(barber)}
                >
                  <div className="relative aspect-[4/5] mb-6 rounded-[28px] overflow-hidden shadow-inner-soft">
                    <img
                      alt={barber.name}
                      className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                      src={barber.image}
                      loading="lazy"
                    />
                    <div className="absolute top-4 right-4 bg-surface/95 backdrop-blur-md px-2.5 py-1 rounded-xl flex items-center gap-1 shadow-soft border border-white/50">
                      <span className="material-symbols-outlined text-[14px] text-accent fill-1">star</span>
                      <span className="text-[12px] font-bold text-text-main">{barber.rating}</span>
                    </div>
                    <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-2xl border border-white/10">
                      <span className={`w-2 h-2 rounded-full ${getStatusDot(barber.status)}`}></span>
                      <span className="text-[10px] font-bold text-white uppercase tracking-tighter">
                        {getStatusText(barber.status)}
                      </span>
                    </div>
                  </div>
                  <div className="px-4 text-center">
                    <p className="font-bold text-[17px] text-text-main mb-1 truncate tracking-tight font-heading">{barber.name}</p>
                    <p className="text-[11px] text-text-muted font-medium uppercase tracking-wider mb-6 truncate">
                      {barber.title || 'Master Stylist'}
                    </p>
                    <div className="inline-flex items-center justify-center gap-2 text-primary bg-bg-soft/80 px-6 py-2.5 rounded-2xl border border-primary/20 group-hover:bg-primary group-hover:text-white transition-all duration-300 w-full shadow-soft cursor-pointer">
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
            <h3 className="text-lg font-bold text-text-main tracking-tight font-heading">探索空间</h3>
            <p className="text-[11px] text-text-muted font-medium uppercase tracking-wider mt-1">Explore Hub</p>
          </div>
          <div className="grid grid-cols-1 gap-5">
            <div
              className="bg-surface rounded-[32px] p-6 flex gap-6 items-center shadow-soft-lg border border-white cursor-pointer active:bg-bg-soft active:scale-[0.98] transition-all duration-300 group"
              onClick={() => setShowQuickHelp(true)}
            >
              <div className="bg-accent/10 text-accent w-16 h-16 rounded-[24px] flex items-center justify-center group-hover:bg-accent/20 transition-colors duration-300 shadow-inner-soft">
                <span className="material-symbols-outlined text-4xl">lightbulb</span>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-text-main text-[16px] tracking-tight font-heading">新手操作指南</h4>
                <p className="text-[13px] text-text-muted font-medium mt-1">3 Steps to start your journey</p>
              </div>
              <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-bg-soft text-text-muted group-hover:text-primary transition-all duration-300 group-hover:translate-x-1">
                <span className="material-symbols-outlined text-[24px]">chevron_right</span>
              </div>
            </div>

            <div
              className="bg-surface rounded-[32px] p-6 flex gap-6 items-center shadow-soft-lg border border-white cursor-pointer active:bg-bg-soft active:scale-[0.98] transition-all duration-300 group"
              onClick={() => onNavigate('check_in')}
            >
              <div className="bg-primary/10 text-primary w-16 h-16 rounded-[24px] flex items-center justify-center group-hover:bg-primary/20 transition-colors duration-300 shadow-inner-soft">
                <span className="material-symbols-outlined text-4xl">confirmation_number</span>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-text-main text-[16px] tracking-tight font-heading">理发券资产中心</h4>
                <p className="text-[13px] text-text-muted font-medium mt-1">Manage your digital vouchers</p>
              </div>
              <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-bg-soft text-text-muted group-hover:text-primary transition-all duration-300 group-hover:translate-x-1">
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
            className="absolute inset-0 bg-text-main/30 backdrop-blur-lg transition-opacity"
            onClick={() => setShowQuickHelp(false)}
          ></div>
          <div className="relative bg-surface w-full max-w-sm rounded-[48px] p-10 shadow-soft-xl animate-[slide-up_0.4s_cubic-bezier(0.16,1,0.3,1)] max-h-[85vh] overflow-y-auto no-scrollbar border border-white">
            <div className="flex justify-between items-center mb-10">
              <div>
                <h2 className="text-2xl font-bold text-text-main tracking-tight font-heading">操作指引</h2>
                <p className="text-[10px] text-text-muted font-bold uppercase tracking-[0.25em] mt-1">User Onboarding</p>
              </div>
              <button
                onClick={() => setShowQuickHelp(false)}
                className="w-12 h-12 flex items-center justify-center bg-bg-soft rounded-2xl text-text-muted hover:bg-primary/10 hover:text-primary transition-all duration-300 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="space-y-10">
              <div className="flex gap-6">
                <div className="w-12 h-12 rounded-[20px] bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold shadow-inner-soft text-lg">1</div>
                <div>
                  <h4 className="font-bold text-text-main mb-2 text-base tracking-tight font-heading">在线选人与预约</h4>
                  <p className="text-[13px] text-text-secondary leading-relaxed font-medium">挑选您信任的发型师，选择合适的时段。完成系统确认后，您的席位将被正式预留。</p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="w-12 h-12 rounded-[20px] bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold shadow-inner-soft text-lg">2</div>
                <div>
                  <h4 className="font-bold text-text-main mb-2 text-base tracking-tight font-heading">到店扫码签到</h4>
                  <p className="text-[13px] text-text-secondary leading-relaxed font-medium">到店后出示"个人中心"的预约码。此操作将激活您的到店状态，正式进入排队队列。</p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="w-12 h-12 rounded-[20px] bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold shadow-inner-soft text-lg">3</div>
                <div>
                  <h4 className="font-bold text-text-main mb-2 text-base tracking-tight font-heading">自动结算与评价</h4>
                  <p className="text-[13px] text-text-secondary leading-relaxed font-medium">服务完工后，系统将自动优先扣除理发券。理发师结算后，请为本次服务留下宝贵评价。</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => onNavigate('booking')}
              className="w-full mt-12 bg-gradient-to-r from-primary to-primary-dark text-white font-bold py-5 rounded-[24px] shadow-soft-xl active:scale-[0.96] transition-all duration-300 text-base tracking-widest cursor-pointer hover:shadow-glow"
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
