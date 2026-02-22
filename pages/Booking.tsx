import React, { useState, useCallback, useMemo } from 'react';
import { Layout, Header } from '../components/Layout';
import { PageRoute, Barber, Appointment, User, ServiceItem } from '../types';
import { useBarbers } from '../hooks/useBarbers';
import { useServices, useSystemConfig, useDateOptions, useTimeSlots } from '../hooks/useServices';
import { useBooking } from '../hooks/useBooking';
import { useRealtime } from '../hooks/useRealtime';
import { Skeleton, Loading } from '../components/Loading';

interface Props {
  onNavigate: (route: PageRoute) => void;
  preselectedBarber?: Barber | null;
  onBookingSuccess?: (appointment: Appointment) => void;
  currentUser?: User | null;
}

export const Booking: React.FC<Props> = ({ onNavigate, preselectedBarber, onBookingSuccess, currentUser }) => {
  // 使用自定义 Hooks 获取数据
  const { barbers, loading: barbersLoading, error: barbersError } = useBarbers({
    status: 'active',
    orderBy: 'rating'
  });

  const { services, loading: servicesLoading } = useServices();
  const { config: systemConfig } = useSystemConfig();
  const { dates, selectedDate, setSelectedDate } = useDateOptions(14);

  // 本地状态
  const [currentBarber, setCurrentBarber] = useState<Barber | null>(preselectedBarber || null);
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showBarberDetailModal, setShowBarberDetailModal] = useState(false);

  // 预约操作 Hook
  const {
    isProcessing,
    error: bookingError,
    bookAppointment,
    checkConflict,
    clearError: clearBookingError
  } = useBooking();

  // 时间槽 Hook
  const {
    timeSlots,
    bookedSlots,
    loading: slotsLoading,
    refetch: refetchSlots
  } = useTimeSlots({
    barberName: currentBarber?.name,
    dateString: selectedDate?.dateString,
    config: systemConfig
  });

  // 实时订阅预约变化
  useRealtime({
    table: 'app_appointments',
    filter: `barber_name=eq.${currentBarber?.name || ''}`,
    onAny: useCallback(() => {
      refetchSlots();
    }, [refetchSlots])
  });

  // 初始化选中项
  React.useEffect(() => {
    if (!currentBarber && barbers.length > 0) {
      setCurrentBarber(barbers[0]);
    }
    if (!selectedService && services.length > 0) {
      setSelectedService(services[0]);
    }
  }, [barbers, services, currentBarber, selectedService]);

  // 切换理发师或日期时重置选中时间
  const handleBarberChange = useCallback((barber: Barber) => {
    setCurrentBarber(barber);
    setSelectedTime('');
  }, []);

  const handleDateChange = useCallback((date: any) => {
    setSelectedDate(date);
    setSelectedTime('');
  }, [setSelectedDate]);

  // 检查时间是否过期（仅今天）
  const checkIsPast = useCallback((time: string) => {
    if (!selectedDate) return false;
    const now = new Date();
    if (selectedDate.date !== now.getDate() || selectedDate.month !== (now.getMonth() + 1)) {
      return false;
    }
    const [h, m] = time.split(':').map(Number);
    const slotTime = new Date();
    slotTime.setHours(h, m, 0, 0);
    return slotTime < now;
  }, [selectedDate]);

  // 处理预约提交
  const handleBookingTrigger = useCallback(() => {
    if (!currentUser) {
      onNavigate('login');
      return;
    }
    if (!selectedTime) return;
    setShowConfirmModal(true);
  }, [currentUser, selectedTime, onNavigate]);

  // 确认预约
  const handleConfirmPay = useCallback(async () => {
    if (!currentBarber || !selectedService || !selectedDate || !currentUser || !selectedTime) return;

    clearBookingError();

    // 二次检查冲突
    const hasConflict = await checkConflict(
      currentBarber.name,
      selectedDate.dateString,
      selectedTime
    );

    if (hasConflict) {
      alert("非常抱歉，该时段刚刚被其他用户预订。请选择其他时间。");
      refetchSlots();
      setShowConfirmModal(false);
      setSelectedTime('');
      return;
    }

    const result = await bookAppointment({
      customerName: currentUser.name,
      barberName: currentBarber.name,
      serviceName: selectedService.name,
      dateString: selectedDate.dateString,
      timeString: selectedTime,
      price: selectedService.price
    }, currentUser);

    if (result) {
      setTimeout(() => {
        setShowConfirmModal(false);
        onBookingSuccess ? onBookingSuccess(result) : onNavigate('check_in');
      }, 1200);
    }
  }, [currentBarber, selectedService, selectedDate, currentUser, selectedTime, bookAppointment, checkConflict, refetchSlots, onBookingSuccess, onNavigate, clearBookingError]);

  if (barbersLoading || !currentBarber) {
    return (
      <Layout className="bg-[#F8FAFC]">
        <Header title="甄选沙龙预约" className="bg-white/90 ios-blur" />
        <div className="flex-1 flex items-center justify-center">
          <Loading text="加载中..." />
        </div>
      </Layout>
    );
  }

  return (
    <Layout className="bg-[#F8FAFC]">
      <Header
        title="甄选沙龙预约"
        className="bg-white/90 ios-blur"
        left={
          <button
            onClick={() => onNavigate('home')}
            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-800 active:scale-90 transition-all"
          >
            <span className="material-symbols-outlined">arrow_back_ios_new</span>
          </button>
        }
      />

      <main className="flex-1 overflow-y-auto pb-52 px-6 no-scrollbar pt-6">
        {/* Barber Selection */}
        <section className="mb-10">
          <div className="flex flex-col mb-6 px-1">
            <h3 className="text-[13px] font-bold text-slate-400 uppercase tracking-widest">首席发型师</h3>
            <p className="text-[11px] text-primary font-medium uppercase mt-1">Master Stylists</p>
          </div>

          <div className="flex gap-6 overflow-x-auto pb-4 hide-scrollbar -mx-6 px-6 snap-x">
            {barbersLoading ? (
              <Skeleton rows={1} avatar />
            ) : (
              barbers.map(barber => {
                const isSelected = currentBarber.id === barber.id;
                return (
                  <div
                    key={barber.id}
                    onClick={() => handleBarberChange(barber)}
                    className={`snap-center flex flex-col items-center gap-4 flex-shrink-0 cursor-pointer transition-all duration-500 ${isSelected ? 'scale-100 opacity-100' : 'opacity-30 scale-90'
                      }`}
                  >
                    <div className={`relative w-20 h-20 rounded-[32px] p-1 transition-all duration-500 ${isSelected ? 'bg-gradient-to-tr from-primary to-cyan-400 shadow-2xl shadow-blue-200' : 'bg-transparent'
                      }`}>
                      <img src={barber.image} className="w-full h-full rounded-[28px] object-cover border-2 border-white" alt={barber.name} />
                      {isSelected && (
                        <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1.5 shadow-xl border border-blue-50">
                          <span className="material-symbols-outlined text-primary text-[16px] font-black">check</span>
                        </div>
                      )}
                    </div>
                    <p className={`text-sm tracking-tight ${isSelected ? 'font-bold text-slate-900' : 'font-medium text-slate-500'}`}>
                      {barber.name}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-4 bg-white rounded-[32px] p-6 flex items-center justify-between border border-white shadow-xl shadow-blue-100/30 animate-fade-in">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="font-extrabold text-slate-900 text-lg tracking-tight font-display">{currentBarber.name}</h2>
                <span className="text-[9px] px-2 py-0.5 bg-slate-900 text-white rounded-md font-bold uppercase tracking-wider">
                  {currentBarber.title || 'Stylist'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-orange-400">
                <span className="material-symbols-outlined text-[16px] fill-1">star</span>
                <span className="text-xs font-bold text-slate-700">{currentBarber.rating}</span>
                <span className="w-1 h-1 bg-slate-200 rounded-full mx-1"></span>
                <span className="text-[11px] text-slate-400 font-medium uppercase truncate max-w-[120px]">
                  专攻: {currentBarber.specialties?.[0] || '高级剪裁'}
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowBarberDetailModal(true)}
              className="w-12 h-12 rounded-2xl bg-blue-50 text-primary flex items-center justify-center active:scale-90 transition-all border border-blue-100"
            >
              <span className="material-symbols-outlined text-2xl">info</span>
            </button>
          </div>
        </section>

        {/* Services */}
        <section className="mb-12">
          <div className="px-1 mb-6">
            <h3 className="text-[13px] font-bold text-slate-400 uppercase tracking-widest">甄选服务套餐</h3>
            <p className="text-[11px] text-primary font-medium uppercase mt-1">Service Matrix</p>
          </div>
          <div className="space-y-4">
            {servicesLoading ? (
              <Skeleton rows={2} />
            ) : (
              services.map(service => {
                const isSelected = selectedService?.id === service.id;
                return (
                  <div
                    key={service.id}
                    onClick={() => setSelectedService(service)}
                    className={`flex items-center justify-between p-6 rounded-[32px] border transition-all duration-300 cursor-pointer active:scale-[0.97] shadow-sm ${isSelected ? 'bg-slate-900 text-white border-slate-900 shadow-2xl shadow-slate-300' : 'bg-white text-slate-700 border-slate-100 hover:border-blue-100'
                      }`}
                  >
                    <div className="flex items-center gap-5">
                      <div className={`w-14 h-14 rounded-[22px] flex items-center justify-center transition-colors shadow-inner ${isSelected ? 'bg-white/10' : 'bg-slate-50 text-slate-400'
                        }`}>
                        <span className="material-symbols-outlined text-3xl">{service.icon}</span>
                      </div>
                      <div>
                        <p className={`font-bold text-base tracking-tight ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                          {service.name}
                        </p>
                        <p className={`text-[11px] font-semibold uppercase tracking-wider mt-1 ${isSelected ? 'text-slate-400' : 'text-slate-400'}`}>
                          {service.duration} MINS
                        </p>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-[12px] font-bold ${isSelected ? 'text-blue-400' : 'text-primary'}`}>¥</span>
                      <span className="text-3xl font-extrabold font-mono tracking-tighter">{service.price}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Date Selector */}
        <section className="mb-12">
          <div className="flex justify-between items-end mb-6 px-1">
            <div>
              <h3 className="text-[13px] font-bold text-slate-400 uppercase tracking-widest">预约日期</h3>
              <p className="text-[11px] text-primary font-medium uppercase mt-1">Select Date</p>
            </div>
            {selectedDate && (
              <span className="text-primary text-[11px] font-semibold bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
                {selectedDate.month}月{selectedDate.date}日
              </span>
            )}
          </div>
          <div className="flex gap-4 overflow-x-auto px-1 hide-scrollbar pb-4">
            {dates.map((d) => {
              const isActive = selectedDate?.date === d.date;
              return (
                <button
                  key={d.date}
                  onClick={() => handleDateChange(d)}
                  className={`flex flex-col items-center justify-center min-w-[76px] h-[100px] rounded-[28px] transition-all duration-300 shadow-sm ${isActive ? 'bg-primary text-white shadow-2xl shadow-blue-200 scale-105 z-10' : 'bg-white border border-slate-50 text-slate-300 active:bg-slate-100'
                    }`}
                >
                  <span className={`text-[10px] font-bold mb-2 uppercase tracking-wider ${isActive ? 'opacity-70' : ''}`}>
                    {d.day}
                  </span>
                  <span className={`text-2xl font-extrabold font-mono ${isActive ? 'text-white' : 'text-slate-900'}`}>
                    {d.date}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Time Slots */}
        <section className="mb-24">
          <div className="px-1 mb-6">
            <h3 className="text-[13px] font-bold text-slate-400 uppercase tracking-widest">可用时段</h3>
            <p className="text-[11px] text-primary font-medium uppercase mt-1">Available Slots</p>
          </div>
          {slotsLoading ? (
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="h-16 bg-slate-100 rounded-[22px] animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 animate-fade-in">
              {timeSlots.map(time => {
                const isSelected = selectedTime === time;
                const isBusy = bookedSlots.includes(time);
                const isPast = checkIsPast(time);
                const isDisabled = isBusy || isPast;

                return (
                  <button
                    key={time}
                    disabled={isDisabled}
                    onClick={() => setSelectedTime(time)}
                    className={`h-16 rounded-[22px] text-sm font-bold font-mono transition-all border shadow-sm relative overflow-hidden flex flex-col items-center justify-center gap-0.5 
                      ${isDisabled ? 'bg-slate-50 text-slate-200 border-transparent cursor-not-allowed grayscale' :
                        isSelected ? 'bg-slate-900 text-white border-slate-900 shadow-2xl scale-105' :
                          'bg-white text-slate-700 border-slate-100 active:scale-95 hover:border-primary/30'
                      }`}
                  >
                    <span>{time}</span>
                    {isBusy && <span className="text-[8px] font-bold uppercase tracking-tighter opacity-40">约满</span>}
                    {isPast && !isBusy && <span className="text-[8px] font-bold uppercase tracking-tighter opacity-40">过期</span>}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Sticky Bottom Summary */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-50 px-6 pb-12">
        <div className="bg-white/95 ios-blur rounded-[40px] p-6 shadow-2xl border border-white flex items-center justify-between gap-6 shadow-blue-100/50">
          <div className="flex-1 pl-2">
            <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold mb-1">应付总计 / TOTAL</p>
            <div className="flex items-baseline gap-1 text-slate-900">
              <span className="text-sm font-bold">¥</span>
              <span className="text-3xl font-extrabold font-mono tracking-tighter">{selectedService?.price || 0}</span>
            </div>
          </div>
          <button
            onClick={handleBookingTrigger}
            disabled={!selectedService || !selectedTime || isProcessing}
            className="flex-none h-16 px-8 bg-gradient-to-r from-primary to-blue-500 hover:opacity-90 text-white font-bold rounded-3xl shadow-xl shadow-blue-200 active:scale-[0.97] transition-all disabled:opacity-20 disabled:active:scale-100 flex items-center gap-3"
          >
            <span className="text-sm tracking-widest">
              {currentUser ? (isProcessing ? '处理中...' : '立即预约') : '请先登录'}
            </span>
            <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
          </button>
        </div>
      </div >

      {/* Confirm Payment Modal */}
      {
        showConfirmModal && selectedService && selectedDate && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <div
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-md transition-opacity"
              onClick={() => !isProcessing && setShowConfirmModal(false)}
            ></div>
            <div className="relative bg-white w-full max-w-sm rounded-[48px] p-10 shadow-2xl border border-white/20 transform transition-all animate-[scale-in_0.3s_cubic-bezier(0.16,1,0.3,1)]">
              <div className="text-center mb-10">
                <div className="w-20 h-20 bg-blue-50 text-primary rounded-[28px] flex items-center justify-center mx-auto mb-6 shadow-inner">
                  <span className="material-symbols-outlined text-4xl">verified_user</span>
                </div>
                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight font-display">确认预约凭证</h2>
                <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mt-2">Order Verification</p>
              </div>

              {bookingError && (
                <div className="mb-6 p-4 bg-red-50 rounded-[16px] text-red-500 text-xs font-bold">
                  {bookingError}
                </div>
              )}

              <div className="bg-slate-50/50 p-8 rounded-[36px] border border-slate-100 mb-10 space-y-6">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">服务专家</span>
                  <span className="text-slate-900 font-bold text-sm">{currentBarber.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">项目套餐</span>
                  <span className="text-slate-900 font-bold text-sm">{selectedService.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">预约时间</span>
                  <span className="text-slate-900 font-bold text-sm">{selectedDate.month}/{selectedDate.date} {selectedTime}</span>
                </div>
                <div className="pt-6 border-t border-dashed border-slate-200 flex justify-between items-center">
                  <span className="text-slate-900 font-bold text-[13px] tracking-tight">支付总额</span>
                  <span className="text-primary text-3xl font-extrabold font-mono tracking-tighter">¥{selectedService.price}</span>
                </div>
              </div>

              <button
                onClick={handleConfirmPay}
                disabled={isProcessing}
                className="w-full bg-gradient-to-r from-primary to-blue-500 text-white font-bold py-5 rounded-[28px] shadow-xl shadow-blue-100 flex items-center justify-center gap-3 active:scale-[0.97] transition-all disabled:opacity-70"
              >
                {isProcessing ? (
                  <span className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[24px]">wallet</span>
                    <span className="text-base tracking-widest">立即确认支付</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="w-full py-4 text-slate-400 text-[12px] font-semibold hover:text-slate-600 transition-colors mt-2"
              >
                返回修改
              </button>
            </div>
          </div>
        )
      }

      {/* Barber Detail Modal */}
      {
        showBarberDetailModal && currentBarber && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity"
              onClick={() => setShowBarberDetailModal(false)}
            ></div>
            <div className="relative bg-white w-full max-w-sm rounded-[48px] p-8 shadow-2xl animate-[scale-in_0.25s_cubic-bezier(0.16,1,0.3,1)] border border-white/20">
              <button
                onClick={() => setShowBarberDetailModal(false)}
                className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition-colors"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
              <div className="flex flex-col items-center mt-4">
                <div className="relative mb-6">
                  <div className="w-[110px] h-[110px] rounded-[40px] p-1 bg-gradient-to-tr from-primary to-cyan-400 shadow-2xl shadow-blue-100">
                    <img src={currentBarber.image} alt={currentBarber.name} className="w-full h-full rounded-[38px] object-cover border-2 border-white" />
                  </div>
                </div>
                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight font-display">{currentBarber.name}</h2>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1 mb-8">
                  {currentBarber.title || 'Senior Stylist'}
                </p>
                <div className="grid grid-cols-3 gap-4 w-full mb-8">
                  <div className="bg-slate-50/80 rounded-[24px] p-4 text-center border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-2">Rating</p>
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-lg font-extrabold text-slate-900 font-mono">{currentBarber.rating}</span>
                      <span className="material-symbols-outlined text-orange-400 text-[14px] fill-1">star</span>
                    </div>
                  </div>
                  <div className="bg-slate-50/80 rounded-[24px] p-4 text-center border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-2">Years</p>
                    <p className="text-lg font-extrabold text-slate-900 font-mono">
                      {currentBarber.experience || 1}<span className="text-[10px] font-medium text-slate-400 ml-1">YR</span>
                    </p>
                  </div>
                  <div className="bg-slate-50/80 rounded-[24px] p-4 text-center border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-2">Served</p>
                    <p className="text-lg font-extrabold text-slate-900 font-mono">1K<span className="text-[10px] font-medium text-slate-400 ml-0.5">+</span></p>
                  </div>
                </div>
                <div className="w-full bg-slate-50 rounded-[32px] p-6 border border-slate-100 text-left">
                  <h4 className="text-[12px] font-bold text-slate-900 mb-3 uppercase tracking-wider">简介与擅长</h4>
                  <p className="text-[12px] text-slate-500 leading-relaxed font-medium">
                    {currentBarber.bio || `${currentBarber.name} 是一位备受赞誉的发型艺术专家，深耕美学设计领域多年。他坚信发型是个人气质的延伸，致力于通过精湛技艺与独特审美，为每位顾客雕琢最契合的自信型格。`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )
      }
    </Layout >
  );
};
