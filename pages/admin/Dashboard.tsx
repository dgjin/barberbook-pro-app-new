import React, { useState } from 'react';
import { Layout } from '../../components/Layout';
import { BottomNav } from '../../components/BottomNav';
import { PageRoute } from '../../types';
import { useDashboardSchedule, useYearlyStats } from '../../hooks/useAdmin';
import { useRealtime } from '../../hooks/useRealtime';
import { Loading, Skeleton } from '../../components/Loading';

interface Props {
  onNavigate: (route: PageRoute) => void;
}

export const Dashboard: React.FC<Props> = ({ onNavigate }) => {
  const [viewMode, setViewMode] = useState<'schedule' | 'vouchers'>('vouchers');
  const currentYear = new Date().getFullYear();

  // 使用自定义 Hooks
  const {
    barbers,
    selectedBarber,
    setSelectedBarber,
    weekData,
    selectedDayIndex,
    setSelectedDayIndex,
    timeSlots,
    loading: scheduleLoading,
    refetch: refetchSchedule
  } = useDashboardSchedule();

  const {
    stats: yearlyStats,
    total: totalVouchers,
    loading: statsLoading
  } = useYearlyStats(barbers, currentYear);

  // 实时订阅
  useRealtime({
    table: 'app_appointments',
    onAny: () => refetchSchedule()
  });

  const currentDayInfo = weekData[selectedDayIndex];
  const loading = scheduleLoading || (viewMode === 'vouchers' && statsLoading);

  if (loading && barbers.length === 0) {
    return (
      <Layout>
        <header className="pt-14 pb-4 px-6 flex justify-between items-end sticky top-0 bg-white/85 ios-blur z-20 border-b border-gray-100">
          <div>
            <p className="text-[10px] text-primary font-bold tracking-[0.1em] uppercase">BARBERBOOK PRO</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">数据看板</h1>
          </div>
        </header>
        <main className="flex-1 p-6">
          <Loading text="加载数据中..." />
        </main>
        <BottomNav activeRoute="admin_dashboard" onNavigate={onNavigate} userRole="admin" />
      </Layout>
    );
  }

  return (
    <Layout>
      <header className="pt-14 pb-4 px-6 flex justify-between items-end sticky top-0 bg-white/85 ios-blur z-20 border-b border-gray-100">
        <div>
          <p className="text-[10px] text-primary font-bold tracking-[0.1em] uppercase">BARBERBOOK PRO</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">数据看板</h1>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setViewMode(viewMode === 'schedule' ? 'vouchers' : 'schedule')} 
            className={`w-10 h-10 rounded-full shadow-sm flex items-center justify-center transition-all ${
              viewMode === 'vouchers' ? 'bg-primary text-white shadow-primary/30' : 'bg-white border border-gray-100 text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-2xl">
              {viewMode === 'schedule' ? 'wallet' : 'calendar_today'}
            </span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-32">
        {viewMode === 'schedule' ? (
          <>
            {/* 理发师选择 */}
            <section className="mt-6 mb-8">
              <div className="px-6 flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-500">排班监控</h3>
              </div>
              <div className="flex gap-5 overflow-x-auto px-6 pb-2 hide-scrollbar">
                {scheduleLoading ? (
                  <Skeleton rows={1} avatar />
                ) : (
                  barbers.map((barber) => {
                    const isSelected = selectedBarber?.name === barber.name;
                    return (
                      <div 
                        key={barber.id} 
                        onClick={() => setSelectedBarber(barber)} 
                        className={`flex flex-col items-center gap-2 flex-shrink-0 cursor-pointer transition-all ${
                          isSelected ? '' : 'opacity-60 scale-95'
                        }`}
                      >
                        <div className={`relative w-16 h-16 rounded-full p-0.5 transition-all ${
                          isSelected ? 'border-2 border-primary shadow-md shadow-blue-100' : 'border border-transparent'
                        }`}>
                          <img alt={barber.name} className="w-full h-full rounded-full object-cover" src={barber.image} />
                          <div className={`absolute top-0 right-0 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center ${
                            barber.status === 'active' ? 'bg-status-ready' : barber.status === 'busy' ? 'bg-amber-400' : 'bg-slate-400'
                          }`}>
                            {isSelected && <span className="material-symbols-outlined text-[8px] text-white font-bold">check</span>}
                          </div>
                        </div>
                        <span className={`text-xs ${isSelected ? 'font-bold text-slate-900' : 'font-medium text-slate-500'}`}>
                          {barber.name}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* 日期选择 */}
            <section className="px-6 mb-8">
              <div className="grid grid-cols-7 gap-2">
                {weekData.map((day, i) => {
                  const isSelected = selectedDayIndex === i;
                  return (
                    <button 
                      key={i} 
                      onClick={() => setSelectedDayIndex(i)} 
                      className={`flex flex-col items-center py-3 rounded-2xl transition-all duration-300 ${
                        isSelected ? 'ring-2 ring-primary bg-white shadow-lg scale-110 z-10 -translate-y-1' : 'bg-white border border-gray-100 shadow-sm hover:bg-gray-50'
                      }`}
                    >
                      <span className={`text-[10px] font-medium mb-1 ${isSelected ? 'text-primary' : 'text-slate-400'}`}>
                        {day.dayName}
                      </span>
                      <span className={`text-sm font-bold mb-3 ${isSelected ? 'text-slate-900' : 'text-slate-500'}`}>
                        {day.dateNum}
                      </span>
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        day.status === 'free' ? 'bg-status-ready' : day.status === 'busy' ? 'bg-amber-400' : 'bg-status-busy'
                      }`}></div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 时间段列表 */}
            <section className="px-6">
              <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-50">
                {currentDayInfo && (
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h4 className="font-bold text-slate-900 text-lg">{currentDayInfo.fullDateStr}</h4>
                      <p className="text-sm text-slate-400">{selectedBarber?.name} • 预约单数: {currentDayInfo.count}</p>
                    </div>
                  </div>
                )}
                <div className="space-y-4">
                  {timeSlots.map((slot, idx) => (
                    <div 
                      key={idx} 
                      className={`flex items-center gap-4 p-4 rounded-2xl border ${
                        slot.status === 'available' 
                          ? 'border-2 border-dashed border-primary/20 bg-blue-50/20' 
                          : 'bg-gray-50/50 border-gray-100'
                      }`}
                    >
                      <span className={`text-xs font-semibold w-12 ${
                        slot.status === 'available' ? 'text-primary' : 'text-slate-400'
                      }`}>
                        {slot.time}
                      </span>
                      <div className={`h-8 w-1 rounded-full ${
                        slot.status === 'available' ? 'bg-status-ready' : 'bg-status-busy'
                      }`}></div>
                      <div className="flex-1">
                        <p className={`text-sm font-bold ${
                          slot.status === 'available' ? 'text-primary' : 'text-slate-900'
                        }`}>
                          {slot.status === 'available' ? '可预约' : slot.appointment?.customer_name}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {slot.status === 'available' ? '空闲时段' : slot.appointment?.service_name}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        ) : (
          <section className="px-6 mt-8 animate-fade-in">
            {/* 年度统计卡片 */}
            <div className="bg-slate-900 rounded-[32px] p-8 mb-8 text-white relative overflow-hidden shadow-2xl border border-white/5">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <span className="material-symbols-outlined text-9xl">wallet</span>
              </div>
              <div className="relative z-10">
                <p className="text-xs font-bold text-blue-300 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse shadow-[0_0_8px_#60a5fa]"></span>
                  {currentYear}年度收益看板
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-6xl font-black font-mono tracking-tighter text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                    {statsLoading ? '-' : totalVouchers}
                  </span>
                  <span className="text-sm font-bold opacity-60">张理发券核销额</span>
                </div>
                <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                    <p className="text-[9px] text-slate-400 uppercase font-black mb-1 opacity-50 tracking-tighter">团队活跃度</p>
                    <p className="text-sm font-bold">{barbers.length} 位发型师</p>
                  </div>
                  <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                    <p className="text-[9px] text-slate-400 uppercase font-black mb-1 opacity-50 tracking-tighter">财务期间</p>
                    <p className="text-sm font-bold">{currentYear} 全年度</p>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-primary/20 rounded-full blur-[100px] animate-pulse"></div>
            </div>

            {/* 排行榜 */}
            <div className="bg-white rounded-[28px] p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-8 px-1">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">leaderboard</span>
                  理发师业绩排行
                </h3>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded-md">年度明细</span>
              </div>
              
              {statsLoading ? (
                <Skeleton rows={3} avatar />
              ) : (
                <div className="space-y-8">
                  {yearlyStats.map((stat, i) => {
                    const percentage = totalVouchers > 0 ? (stat.count / totalVouchers) * 100 : 0;
                    return (
                      <div key={i} className="flex flex-col gap-3 group">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 shadow-sm overflow-hidden p-0.5 transition-transform group-hover:scale-110">
                                <img src={stat.avatar} className="w-full h-full object-cover rounded-[14px]" alt={stat.barberName} />
                              </div>
                              <div className="absolute -top-2 -left-2 w-6 h-6 bg-slate-900 text-white rounded-lg flex items-center justify-center text-[10px] font-bold shadow-md border-2 border-white">
                                {i + 1}
                              </div>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[15px] font-bold text-slate-800">{stat.barberName}</span>
                              <span className="text-[10px] text-slate-400 font-medium">年度贡献占比: {percentage.toFixed(1)}%</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-baseline gap-1">
                              <span className="text-2xl font-mono font-bold text-slate-900 tracking-tighter">{stat.count}</span>
                              <span className="text-[10px] text-slate-400 font-bold">张</span>
                            </div>
                          </div>
                        </div>
                        <div className="relative h-2 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                          <div 
                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary via-blue-400 to-cyan-400 rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(0,122,255,0.4)]" 
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                  {yearlyStats.length === 0 && (
                    <div className="text-center py-20 flex flex-col items-center gap-4">
                      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-4xl text-slate-200">event_busy</span>
                      </div>
                      <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">本年度暂无核销数据</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-8 p-5 bg-blue-50/50 rounded-2xl border border-blue-100/50 flex gap-4">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
                <span className="material-symbols-outlined text-primary text-xl">info</span>
              </div>
              <p className="text-[11px] text-blue-800/70 leading-relaxed font-medium">
                <b>年度数据说明：</b>本看板统计本自然年度内所有状态为"已完成"且使用了理发券的预约单。
                由于系统具备自动冲正逻辑，任何在当年内取消的已完成用券订单都将实时从统计中扣减。
              </p>
            </div>
          </section>
        )}
      </main>

      <BottomNav activeRoute="admin_dashboard" onNavigate={onNavigate} userRole="admin" />
    </Layout>
  );
};
