import React, { useState, useMemo, useCallback } from 'react';
import { Layout } from '../../components/Layout';
import { BottomNav } from '../../components/BottomNav';
import { PageRoute, User, Appointment } from '../../types';
import { useBarberAppointments, useSaturation, useBarberSaturation } from '../../hooks/useAppointments';
import { useSystemConfig } from '../../hooks/useServices';
import { useRealtime } from '../../hooks/useRealtime';
import { useAsync } from '../../hooks/useAsync';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { Loading } from '../../components/Loading';

interface Props {
  onNavigate: (route: PageRoute) => void;
  currentUser?: User | null;
}

export const Workbench: React.FC<Props> = ({ onNavigate, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'queue' | 'saturation'>('queue');
  const [isScanning, setIsScanning] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [workbenchMode, setWorkbenchMode] = useLocalStorage<'active' | 'completed'>('workbench_mode', 'active');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('操作已成功同步至数据库');

  // 自助服务状态
  const [showSettings, setShowSettings] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [profileData, setProfileData] = useState({
    name: currentUser?.name || '',
    title: (currentUser as any)?.title || '',
    bio: (currentUser as any)?.bio || '',
    specialties: (currentUser as any)?.specialties || [],
    avatar: currentUser?.avatar || ''
  });

  const [showPasswordSection, setShowPasswordSection] = useState(false);

  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  const [isSaving, setIsSaving] = useState(false);

  // 获取今日日期字符串
  const todayStr = useMemo(() => {
    const today = new Date();
    return `${today.getMonth() + 1}月${today.getDate()}日`;
  }, []);

  // 系统配置
  const { config } = useSystemConfig();

  // 1. 理发师 7 天负载统计 (从后端真实拉取)
  const saturationData = useBarberSaturation({
    barberName: currentUser?.name,
    openTime: config.openTime,
    closeTime: config.closeTime,
    serviceDuration: Number(config.serviceDuration || 45)
  });

  // 2. 预约数据 Hook (今日工作流)
  const {
    appointments,
    loading,
    error,
    refetch: refetchAppointments,
    customerAvatars,
    completeAppointment,
    scanCheckIn
  } = useBarberAppointments({
    barberName: currentUser?.name,
    dateString: todayStr,
    status: ['confirmed', 'pending', 'checked_in']
  });

  // 计算当前服务和等待列表
  const currentServiceAppt = useMemo(() =>
    appointments.find(a => a.status === 'checked_in'),
    [appointments]
  );

  const waitingList = useMemo(() =>
    appointments.filter(a => a.status !== 'checked_in'),
    [appointments]
  );

  // 实时订阅（只在有理发师名称时订阅）
  useRealtime({
    table: 'app_appointments',
    filter: currentUser?.name ? `barber_name=eq.${currentUser.name}` : undefined,
    onAny: useCallback(() => {
      refetchAppointments();
    }, [refetchAppointments])
  });

  // 完成服务
  const { execute: handleCompleteService, loading: isCompleting } = useAsync(
    async () => {
      if (!currentServiceAppt || !currentUser) return;
      if (!window.confirm(`确认完成并结算顾客 ${currentServiceAppt.customer_name} 的服务吗？`)) return;

      const usedVoucher = await completeAppointment(
        currentServiceAppt.id!,
        currentServiceAppt.customer_name,
        currentUser.name,
        currentUser
      );

      return usedVoucher;
    },
    {
      onSuccess: (usedVoucher) => {
        setWorkbenchMode('completed');
        setToastMessage(usedVoucher ? '服务完成，已自动核销理发券' : '服务完成');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      },
      onError: (err) => {
        alert("操作失败: " + (err.message || "未知错误"));
      }
    }
  );

  // 呼叫下一位
  const handleCallNext = useCallback(() => {
    setWorkbenchMode('active');
    refetchAppointments();
  }, [setWorkbenchMode, refetchAppointments]);

  // 扫码签到
  const [isProcessingScan, setIsProcessingScan] = useState(false);

  const handleScanSubmit = useCallback(async () => {
    if (!scanInput) {
      alert('请输入预约单号');
      return;
    }
    const apptId = scanInput.trim().replace('appt:', '');
    if (!apptId) {
      alert('无效的预约单号');
      return;
    }

    setIsProcessingScan(true);
    try {
      await scanCheckIn(apptId);
      // 成功后关闭弹窗并显示提示
      setIsScanning(false);
      setScanInput('');
      setToastMessage('扫码签到成功');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err: any) {
      alert("扫码签到失败: " + (err?.message || "请检查单号是否有效"));
    } finally {
      setIsProcessingScan(false);
    }
  }, [scanInput, scanCheckIn]);

  // 自助服务逻辑
  const handleEditProfile = () => {
    // 强制从 currentUser 中带入最新资料，解决初始化延迟问题
    const userAsBarber = currentUser as any;
    setProfileData({
      name: currentUser?.name || '',
      title: userAsBarber?.title || '',
      bio: userAsBarber?.bio || '',
      specialties: userAsBarber?.specialties || [],
      avatar: currentUser?.avatar || ''
    });
    setIsEditingProfile(true);
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      // 通过 App.tsx 中的 handleUserUpdate 或直接调用 useAuth
      // 此处通过通用的 updateProfile 接口
      const success = await (currentUser as any).updateProfile?.(profileData);
      if (success) {
        setToastMessage('个人资料更新成功');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
        setIsEditingProfile(false);
      }
    } catch (err) {
      alert('资料更新失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('两次输入的密码不一致');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      alert('密码长度至少为 6 位');
      return;
    }

    setIsSaving(true);
    try {
      const success = await (currentUser as any).updatePassword?.(passwordData.newPassword);
      if (success) {
        setToastMessage('登录密码及安全配置已更新');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
        setIsChangingPassword(false);
        setPasswordData({ newPassword: '', confirmPassword: '' });
      }
    } catch (err) {
      alert('修改密码失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileData(prev => ({ ...prev, avatar: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleSpecialty = (s: string) => {
    setProfileData(prev => ({
      ...prev,
      specialties: prev.specialties.includes(s)
        ? prev.specialties.filter(i => i !== s)
        : [...prev.specialties, s]
    }));
  };

  if (!currentUser) {
    return (
      <Layout className="bg-slate-50 relative">
        <div className="flex-1 flex items-center justify-center">
          <Loading text="加载中..." />
        </div>
      </Layout>
    );
  }

  return (
    <Layout className="bg-slate-50 relative">
      {/* Toast Notification */}
      <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[70] transition-all duration-500 transform ${showToast ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0'}`}>
        <div className="bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl text-sm font-bold flex items-center gap-3 border border-white/10">
          <span className="material-symbols-outlined text-green-400 text-xl">verified_user</span>
          {toastMessage}
        </div>
      </div>

      <header className="pt-14 pb-6 px-6 flex justify-between items-center bg-white/80 ios-blur sticky top-0 z-30 border-b border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative group">
            <div className="w-12 h-12 rounded-2xl border-2 border-white shadow-md overflow-hidden ring-4 ring-slate-50">
              <img
                className="w-full h-full object-cover"
                src={currentUser.avatar || `https://ui-avatars.com/api/?name=${currentUser.name}`}
                alt="Avatar"
              />
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="absolute -bottom-1 -right-1 w-5 h-5 bg-slate-900 border border-white text-white rounded-md flex items-center justify-center shadow-lg active:scale-90 transition-all"
            >
              <span className="material-symbols-outlined text-[12px]">{showSettings ? 'close' : 'settings'}</span>
            </button>
          </div>
          <div>
            <p className="text-[11px] text-primary font-bold tracking-widest uppercase mb-0.5">Stylist Workbench</p>
            <h1 className="text-xl font-extrabold text-slate-900 leading-none font-display">{currentUser.name}</h1>
          </div>
        </div>

        {/* 下拉设置菜单 */}
        {showSettings && (
          <div className="absolute top-[100%] left-6 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 animate-slide-down">
            <button onClick={handleEditProfile} className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl text-[12px] font-semibold text-slate-600 transition-all">
              <span className="material-symbols-outlined text-base">manage_accounts</span> 个人中心
            </button>
            <div className="h-px bg-slate-50 my-1 mx-2"></div>
            <button
              onClick={() => onNavigate('login')}
              className="w-full flex items-center gap-3 p-3 hover:bg-rose-50 rounded-xl text-[12px] font-semibold text-rose-500 transition-all"
            >
              <span className="material-symbols-outlined text-base">logout</span> 退出登录
            </button>
          </div>
        )}

        <button
          onClick={refetchAppointments}
          disabled={loading}
          className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center hover:text-primary active:scale-90 transition-all disabled:opacity-50"
        >
          <span className={`material-symbols-outlined ${loading ? 'animate-spin' : ''}`}>sync</span>
        </button>
      </header>

      <main className="flex-1 px-5 pb-40 space-y-8 pt-6 overflow-y-auto no-scrollbar">
        {/* 操作按钮区 */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setIsScanning(true)}
            className="flex items-center justify-center gap-3 bg-slate-900 text-white font-black py-4 px-4 rounded-[22px] active:scale-95 transition-all shadow-xl shadow-slate-200"
          >
            <span className="material-symbols-outlined text-2xl">qr_code_scanner</span>
            <span className="text-sm">扫描签到</span>
          </button>
          <div className="flex bg-slate-200/50 p-1.5 rounded-[22px]">
            <button
              onClick={() => setActiveTab('queue')}
              className={`flex-1 text-[11px] font-black py-2.5 rounded-[18px] transition-all duration-300 ${activeTab === 'queue' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              服务队列
            </button>
            <button
              onClick={() => setActiveTab('saturation')}
              className={`flex-1 text-[11px] font-black py-2.5 rounded-[18px] transition-all duration-300 ${activeTab === 'saturation' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              排班统计
            </button>
          </div>
        </div>

        {activeTab === 'queue' ? (
          <div className="space-y-8">
            {/* 当前服务区域 */}
            <section className="animate-fade-in">
              <h2 className="text-[11px] font-black uppercase text-slate-400 mb-4 px-1 tracking-widest flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${currentServiceAppt ? 'bg-primary animate-pulse' : 'bg-slate-200'}`}></span>
                当前正在接待
              </h2>
              {workbenchMode === 'active' ? (
                currentServiceAppt ? (
                  <div className="bg-white rounded-[32px] p-7 border border-white shadow-xl shadow-blue-100/30 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-5">
                      <span className="material-symbols-outlined text-9xl">face_retouching_natural</span>
                    </div>
                    <div className="flex gap-5 items-center mb-8 relative z-10">
                      <div className="w-20 h-20 rounded-[24px] overflow-hidden shadow-lg bg-slate-100 border-4 border-slate-50 ring-1 ring-slate-100">
                        <img
                          src={customerAvatars[currentServiceAppt.customer_name] || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentServiceAppt.customer_name)}&background=random&color=fff`}
                          className="w-full h-full object-cover"
                          alt={currentServiceAppt.customer_name}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <h3 className="text-2xl font-black text-slate-900 tracking-tight">{currentServiceAppt.customer_name}</h3>
                          <div className="px-2 py-0.5 bg-slate-900 text-white text-[10px] font-mono font-black rounded-lg shadow-sm border border-white/20">
                            ID: #{currentServiceAppt.id}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black px-2.5 py-1 bg-blue-50 text-primary rounded-full border border-blue-100 uppercase tracking-widest">
                            {currentServiceAppt.service_name}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 font-mono">{currentServiceAppt.time_str} 入场</span>
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-slate-50 pt-7 relative z-10">
                      <button
                        onClick={handleCompleteService}
                        disabled={isCompleting}
                        className="w-full bg-primary hover:bg-blue-600 text-white font-black py-5 rounded-[22px] active:scale-[0.97] transition-all shadow-2xl shadow-blue-100 flex items-center justify-center gap-3 disabled:opacity-50"
                      >
                        {isCompleting ? (
                          <span className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></span>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-2xl">check_circle</span>
                            <span className="text-base tracking-widest">确认完成并结算 ¥{currentServiceAppt.price}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white/40 rounded-[32px] p-12 border-2 border-dashed border-slate-200 text-center flex flex-col items-center justify-center transition-all hover:bg-white/60">
                    <span className="material-symbols-outlined text-slate-200 text-5xl mb-4">chair_alt</span>
                    <p className="text-sm font-black text-slate-300 uppercase tracking-[0.2em]">席位空闲中</p>
                    <p className="text-[10px] text-slate-400 mt-2 font-bold">请点击扫码或待办序列开始服务</p>
                  </div>
                )
              ) : (
                <div className="bg-green-50 rounded-[32px] p-12 border border-green-100 text-center flex flex-col items-center justify-center animate-fade-in shadow-inner">
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-green-500 mb-6 shadow-xl border-4 border-green-100">
                    <span className="material-symbols-outlined text-4xl font-black">done_all</span>
                  </div>
                  <h3 className="text-xl font-black text-green-900 tracking-tight">本次服务已成功结算</h3>
                  <p className="text-xs text-green-600/60 mt-2 font-medium">收益已自动计入您的理发师账户</p>
                  <button
                    onClick={handleCallNext}
                    className="mt-8 w-full bg-slate-900 text-white font-black py-5 rounded-[22px] shadow-2xl shadow-slate-200 active:scale-95 transition-all flex items-center justify-center gap-3"
                  >
                    <span className="material-symbols-outlined text-xl">chevron_right</span>
                    <span>呼叫下一位顾客</span>
                  </button>
                </div>
              )}
            </section>

            {/* 等待列表 */}
            <section className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <div className="flex justify-between items-center mb-4 px-1">
                <h2 className="text-[11px] font-black uppercase text-slate-400 tracking-widest">
                  待服务序列 ({waitingList.length})
                </h2>
                <span className="text-[9px] font-black text-primary bg-blue-50 px-2 py-0.5 rounded-md uppercase">Today Only</span>
              </div>
              {loading ? (
                <div className="py-20 text-center">
                  <Loading size="sm" text="加载中..." />
                </div>
              ) : waitingList.length > 0 ? (
                <div className="space-y-4">
                  {waitingList.map((appt) => (
                    <div
                      key={appt.id}
                      className="bg-white p-5 rounded-[24px] border border-slate-100 flex items-center gap-5 group transition-all hover:border-primary/20 hover:shadow-lg hover:shadow-blue-100/20 active:scale-[0.98]"
                    >
                      <div className="flex flex-col items-center min-w-[44px]">
                        <span className="text-[11px] font-black font-mono text-slate-900 bg-slate-100 w-full text-center py-1.5 rounded-lg mb-1">
                          {appt.time_str}
                        </span>
                        <span className="text-[8px] font-black text-slate-300 uppercase">Sched</span>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-slate-50 overflow-hidden shrink-0 border-2 border-white shadow-md ring-1 ring-slate-100">
                        <img
                          src={customerAvatars[appt.customer_name] || `https://ui-avatars.com/api/?name=${encodeURIComponent(appt.customer_name)}&background=random&color=fff`}
                          className="w-full h-full object-cover"
                          alt={appt.customer_name}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-[15px] font-black text-slate-900 truncate tracking-tight">{appt.customer_name}</h4>
                          <div className="px-1.5 py-0.5 bg-slate-100 text-slate-400 text-[9px] font-mono font-bold rounded-md border border-slate-200 flex items-center gap-1">
                            #{appt.id}
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest truncate">{appt.service_name}</p>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <span className="text-[9px] font-black px-2 py-1 bg-slate-50 text-slate-400 rounded-lg border border-slate-100 uppercase tracking-widest">
                          {appt.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                        </span>
                        {!currentServiceAppt && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`确认呼叫顾客 ${appt.customer_name} 吗？`)) {
                                scanCheckIn(appt.id.toString());
                              }
                            }}
                            className="text-[10px] bg-primary text-white font-black px-3 py-1.5 rounded-lg active:scale-95 transition-all shadow-md shadow-blue-200 flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[12px]">notifications_active</span>
                            呼叫接单
                          </button>
                        )}
                        {currentServiceAppt && (
                          <span className="text-[9px] font-bold text-primary">¥{appt.price}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-16 bg-white/40 rounded-[28px] border border-dashed border-slate-200 text-center">
                  <span className="material-symbols-outlined text-slate-200 text-4xl mb-3">list_alt</span>
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">暂无排队中的顾客</p>
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="animate-fade-in space-y-6">
            <div className="bg-white rounded-[32px] p-8 border border-white shadow-xl shadow-slate-200/50">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-blue-50 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined">analytics</span>
                  </span>
                  周排班负荷分析
                </h2>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-lg">Real-time Data</span>
              </div>
              <div className="space-y-8">
                {saturationData.map((day, idx) => (
                  <div key={idx} className="group">
                    <div className="flex justify-between items-end mb-3 text-[11px] px-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900">{day.dayName}</span>
                        <span className="font-bold text-slate-300 text-[9px] uppercase">{day.dateStr}</span>
                      </div>
                      <span className="font-mono font-black text-slate-400">{day.count} 笔预约 / {day.percentage}%</span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner relative">
                      <div
                        className={`h-full transition-all duration-1000 ease-out rounded-full ${day.status === 'full' ? 'bg-red-500' :
                          day.status === 'high' ? 'bg-orange-400' :
                            day.status === 'medium' ? 'bg-primary' : 'bg-green-400'
                          }`}
                        style={{ width: `${day.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-blue-50/50 p-6 rounded-[28px] border border-blue-100 flex gap-4">
              <div className="w-10 h-10 rounded-full bg-white text-primary flex items-center justify-center shrink-0 shadow-sm border border-blue-100">
                <span className="material-symbols-outlined">info</span>
              </div>
              <p className="text-[11px] text-blue-900/60 leading-relaxed font-medium">
                <b>饱和度算法：</b>基于系统配置的每日营业时长与标准套餐耗时计算。
                高饱和度（&gt;80%）建议理发师合理安排个人休息时段，并开启大屏语音提示协助。
              </p>
            </div>
          </div>
        )}
      </main>

      {/* 扫码签到弹窗 */}
      {isScanning && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
          <div
            className="absolute inset-0 bg-slate-900/90 backdrop-blur-xl animate-fade-in"
            onClick={() => !isProcessingScan && setIsScanning(false)}
          ></div>
          <div className="relative bg-white w-full max-w-sm rounded-[40px] p-10 shadow-2xl animate-[scale-in_0.3s_cubic-bezier(0.34,1.56,0.64,1)] border border-white/20">
            <div className="text-center mb-10">
              <div className="w-20 h-20 bg-blue-50 text-primary rounded-[28px] flex items-center justify-center mx-auto mb-6 shadow-inner">
                <span className="material-symbols-outlined text-4xl">pin_invoke</span>
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">扫码识别模拟</h2>
              <p className="text-xs text-slate-400 mt-2 font-medium px-4">
                无法调用物理摄像头时，请在此输入预约单据尾号进行快速核销
              </p>
            </div>
            <div className="relative mb-8">
              <input
                value={scanInput}
                onChange={e => setScanInput(e.target.value)}
                autoFocus
                className="w-full bg-slate-50 border-none rounded-[22px] py-5 px-8 text-center font-mono font-black text-2xl text-slate-900 focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-slate-200"
                placeholder="appt:0000"
              />
              <div className="absolute left-1/2 -translate-x-1/2 -bottom-3 px-3 py-1 bg-primary text-white text-[9px] font-black rounded-md uppercase tracking-[0.2em] shadow-lg">
                Manual Input
              </div>
            </div>
            <div className="space-y-4">
              <button
                onClick={handleScanSubmit}
                disabled={!scanInput || isProcessingScan}
                className="w-full bg-slate-900 text-white font-black py-5 rounded-[22px] active:scale-[0.97] transition-all shadow-2xl shadow-slate-400 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isProcessingScan ? (
                  <span className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  "确认准入签到"
                )}
              </button>
              <button
                onClick={() => setIsScanning(false)}
                className="w-full py-4 text-slate-400 text-[11px] font-black uppercase tracking-widest hover:text-slate-600 transition-colors"
              >
                取消操作
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav activeRoute="admin_workbench" onNavigate={onNavigate} userRole="barber" />

      {/* 理发师个人中心模态框（资料 + 密码 一体化） */}
      {isEditingProfile && (
        <div className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setIsEditingProfile(false)}></div>
          <div className="relative bg-white w-full max-w-md rounded-[36px] p-8 shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto no-scrollbar">
            <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">badge</span> 个人中心
            </h2>
            <div className="space-y-6">
              <div className="flex flex-col items-center mb-4">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-[32px] overflow-hidden border-4 border-slate-50 shadow-md">
                    <img src={profileData.avatar || "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"} alt="Avatar" className="w-full h-full object-cover" />
                  </div>
                  <label htmlFor="barber-avatar-upload" className="absolute -bottom-2 -right-2 w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center cursor-pointer shadow-lg active:scale-90 transition-transform">
                    <span className="material-symbols-outlined text-lg">camera</span>
                  </label>
                  <input id="barber-avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">真实姓名</label>
                  <input value={profileData.name || ""} onChange={e => setProfileData({ ...profileData, name: e.target.value })} className="w-full bg-slate-50 border-none rounded-2xl py-3.5 px-5 text-slate-900 font-bold" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">专业职级</label>
                  <input value={profileData.title || ""} onChange={e => setProfileData({ ...profileData, title: e.target.value })} className="w-full bg-slate-50 border-none rounded-2xl py-3.5 px-5 text-slate-900 font-bold" placeholder="如: 总监/资深" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">个人简介 (Bio)</label>
                <textarea value={profileData.bio || ""} onChange={e => setProfileData({ ...profileData, bio: e.target.value })} className="w-full bg-slate-50 border-none rounded-2xl py-3.5 px-5 text-slate-900 text-xs font-bold min-h-[80px]" placeholder="用简短的话介绍您的风格..." />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3 px-1">专业领域 (Specialties)</label>
                <div className="flex flex-wrap gap-2">
                  {['寸头专家', '渐变大师', '男士修护', '韩式烫染', '胡须理容'].map(s => (
                    <button
                      key={s}
                      onClick={() => toggleSpecialty(s)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${profileData.specialties.includes(s) ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="w-full h-16 bg-primary text-white font-black rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {isSaving ? <span className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></span> : "确认并同步至大屏"}
              </button>

              {/* 安全区域：折叠式密码修改 */}
              <div className="pt-4 border-t border-slate-100">
                <button
                  onClick={() => setShowPasswordSection(!showPasswordSection)}
                  className="w-full flex items-center justify-between p-3 bg-rose-50/50 rounded-2xl text-[11px] font-black text-rose-400 hover:text-rose-600 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">vpn_key</span> 修改登录密码
                  </div>
                  <span className="material-symbols-outlined text-base">{showPasswordSection ? 'expand_less' : 'expand_more'}</span>
                </button>
                {showPasswordSection && (
                  <div className="mt-4 space-y-4 animate-slide-down">
                    <div className="p-3 bg-slate-50 rounded-2xl text-[10px] font-bold text-slate-500 leading-relaxed">
                      修改后将即时生效，下次登录请使用新密码。
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">新登录密码</label>
                      <input type="password" value={passwordData.newPassword} onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })} className="w-full bg-slate-50 border-none rounded-2xl py-3.5 px-5 text-slate-900 font-black tracking-widest" placeholder="••••••••" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">确认新密码</label>
                      <input type="password" value={passwordData.confirmPassword} onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })} className="w-full bg-slate-50 border-none rounded-2xl py-3.5 px-5 text-slate-900 font-black tracking-widest" placeholder="••••••••" />
                    </div>
                    <button onClick={handleSavePassword} disabled={isSaving} className="w-full h-12 bg-rose-500 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 text-sm">
                      {isSaving ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : "立即重置密码"}
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={() => setIsEditingProfile(false)}
                className="w-full py-2 text-[10px] font-black text-slate-300 uppercase tracking-widest"
              >
                返回工作台
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};
