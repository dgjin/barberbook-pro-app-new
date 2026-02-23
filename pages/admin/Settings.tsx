import React, { useState, useCallback } from 'react';
import { Layout } from '../../components/Layout';
import { BottomNav } from '../../components/BottomNav';
import { PageRoute, ServiceItem } from '../../types';
import { useSystemSettings } from '../../hooks/useAdmin';
import { useRealtime } from '../../hooks/useRealtime';
import { useAsync } from '../../hooks/useAsync';
import { Loading } from '../../components/Loading';

interface Props {
  onNavigate: (route: PageRoute) => void;
}

const iconOptions = [
  'content_cut', 'face', 'spa', 'palette',
  'colorize', 'wash', 'healing', 'content_paste',
  'person_celebrate', 'brush', 'dry_cleaning', 'soap',
  'cut', 'styler', 'shower', 'medical_services'
];

const adminGuides = [
  { label: '智能预约管理', content: '顾客扫码即可预约。系统会自动根据理发师忙碌程度计算预计等待时间。', icon: 'confirmation_number' },
  { label: '多驱动叫号系统', content: '排队大屏集成 WebSocket + 轮询双机制。若网络波动，系统将自动切换模式，确保叫号不遗漏。', icon: 'record_voice_over' },
  { label: '超拟音播报', content: '系统集成讯飞星火“聆小玥”超拟人语音。请确保大屏扬声器开启并在首次加载时点击激活按钮。', icon: 'spatial_audio' }
];

export const Settings: React.FC<Props> = ({ onNavigate }) => {
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState<Partial<ServiceItem> | null>(null);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [showHelpGuide, setShowHelpGuide] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  // 使用自定义 Hook
  const {
    config,
    emailConfig,
    services,
    loading,
    updateConfig,
    updateEmailConfig,
    saveConfig,
    saveEmailConfig,
    testEmailConfig,
    addService,
    updateService,
    deleteService,
    refetch
  } = useSystemSettings();

  // 实时订阅
  useRealtime({
    table: 'app_services',
    onAny: () => refetch()
  });

  useRealtime({
    table: 'app_settings',
    onAny: () => refetch()
  });

  // 保存系统配置
  const { execute: handleSaveSystemConfig, loading: isSavingConfig } = useAsync(
    async () => {
      if (config.openTime >= config.closeTime) {
        alert('配置错误：营业结束时间必须晚于开始时间。');
        return false;
      }
      const success = await saveConfig();
      if (success) {
        setShowSaveToast(true);
        setTimeout(() => setShowSaveToast(false), 2500);
      }
      return success;
    }
  );

  // 处理时间变更
  const handleTimeChange = useCallback((field: 'openTime' | 'closeTime', value: string) => {
    updateConfig({ [field]: value });
  }, [updateConfig]);

  // 添加服务
  const handleAddService = useCallback(() => {
    setEditingService({ name: '', price: 88, duration: 45, icon: 'content_cut' });
    setShowServiceModal(true);
  }, []);

  // 编辑服务
  const handleEditService = useCallback((service: ServiceItem) => {
    setEditingService({ ...service });
    setShowServiceModal(true);
  }, []);

  // 删除服务
  const { execute: handleDeleteService, loading: isDeleting } = useAsync(
    async (id: number | string) => {
      if (!confirm('确定要删除该服务项目吗？这将导致相关历史记录显示异常。')) return false;
      const success = await deleteService(id);
      if (success) {
        // 记录日志
        await supabase.from('app_logs').insert({
          user: '管理员',
          role: 'admin',
          action: '删除套餐',
          details: `删除了套餐项目 ID: ${id}`,
          type: 'danger'
        });
      }
      return success;
    }
  );

  // 保存服务
  const { execute: handleSaveService, loading: isSavingService } = useAsync(
    async () => {
      if (!editingService?.name) { alert('请输入项目名称'); return false; }
      if ((editingService.price || 0) <= 0) { alert('价格必须大于0'); return false; }
      if ((editingService.duration || 0) <= 0) { alert('时长必须大于0'); return false; }

      const payload = {
        name: editingService.name,
        price: Number(editingService.price),
        duration: Number(editingService.duration),
        icon: editingService.icon || 'content_cut'
      };

      let success;
      if (editingService.id) {
        success = await updateService(editingService.id, payload);
      } else {
        success = await addService(payload as Omit<ServiceItem, 'id'>);
      }

      if (success) {
        setShowServiceModal(false);
        setEditingService(null);
        // 记录日志
        await supabase.from('app_logs').insert({
          user: '管理员',
          role: 'admin',
          action: editingService.id ? '更新套餐' : '新增套餐',
          details: `${editingService.id ? '修改了' : '新增了'}套餐项目: ${payload.name}`,
          type: 'info'
        });
      }
      return success;
    }
  );

  return (
    <Layout className="bg-bg-main">
      {/* Save Toast */}
      <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[100] transition-all duration-500 transform ${showSaveToast ? 'translate-y-0 opacity-100' : '-translate-y-12 opacity-0'}`}>
        <div className="bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl text-sm font-bold flex items-center gap-3 border border-white/10">
          <span className="material-symbols-outlined text-green-400">check_circle</span>
          全局配置已成功同步
        </div>
      </div>

      <header className="sticky top-0 z-50 bg-white/80 ios-blur border-b border-gray-100 pt-12 pb-4 px-6 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-0.5">System Config</p>
          <h1 className="text-xl font-black tracking-tight text-slate-900">系统全局设置</h1>
        </div>
        <button
          onClick={() => setShowHelpGuide(true)}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-primary/10 hover:text-primary transition-all active:scale-95"
        >
          <span className="material-symbols-outlined">help</span>
        </button>
      </header>

      <main className="flex-1 pb-40 overflow-y-auto p-5 space-y-8 no-scrollbar">
        {/* 营业时间设置 */}
        <section className="animate-fade-in">
          <div className="px-1 mb-3">
            <h2 className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">基础运营参数</h2>
          </div>
          <div className="bg-white rounded-[28px] overflow-hidden shadow-sm border border-gray-100">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                  <span className="material-symbols-outlined">wb_sunny</span>
                </div>
                <span className="text-base font-bold text-slate-700">开门营业时间</span>
              </div>
              <input
                className="text-primary font-black border-none bg-blue-50/50 rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary/20 text-center min-w-[120px]"
                type="time"
                value={config.openTime}
                onChange={(e) => handleTimeChange('openTime', e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between p-5 group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center group-hover:bg-slate-100 transition-colors">
                  <span className="material-symbols-outlined">dark_mode</span>
                </div>
                <span className="text-base font-bold text-slate-700">打烊关门时间</span>
              </div>
              <input
                className="text-primary font-black border-none bg-blue-50/50 rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary/20 text-center min-w-[120px]"
                type="time"
                value={config.closeTime}
                onChange={(e) => handleTimeChange('closeTime', e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* 邮件服务配置 */}
        <section className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="px-1 mb-3 flex justify-between items-end">
            <h2 className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">邮件服务配置</h2>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${emailConfig.enabled ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
              {emailConfig.enabled ? '已启用' : '未启用'}
            </span>
          </div>
          <div className="bg-white rounded-[32px] overflow-hidden shadow-sm border border-gray-100">
            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">email</span>
                </div>
                <div>
                  <div className="text-[15px] font-black text-slate-900 mb-0.5">SMTP 邮件服务</div>
                  <div className="text-[11px] text-slate-400 font-medium">
                    {emailConfig.smtpHost || '未配置'} : {emailConfig.smtpPort || '-'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowEmailModal(true)}
                className="w-9 h-9 rounded-full bg-blue-50 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-all active:scale-90"
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
              </button>
            </div>
          </div>
        </section>

        {/* 服务项目管理 */}
        <section className="animate-fade-in" style={{ animationDelay: '0.15s' }}>
          <div className="px-1 mb-3 flex justify-between items-end">
            <h2 className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">服务套餐矩阵</h2>
            <span className="text-[10px] text-primary font-bold bg-blue-50 px-2 py-0.5 rounded">共 {services.length} 个项目</span>
          </div>
          <div className="bg-white rounded-[32px] overflow-hidden shadow-sm border border-gray-100 divide-y divide-gray-50">
            {services.map((service) => (
              <div key={service.id} className="p-5 flex items-center justify-between hover:bg-slate-50/80 transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-all border border-transparent group-hover:border-primary/20">
                    <span className="material-symbols-outlined text-[24px]">{service.icon}</span>
                  </div>
                  <div>
                    <div className="text-[15px] font-black text-slate-900 mb-0.5">{service.name}</div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-primary">¥{service.price}</span>
                      <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                      <span className="text-[11px] text-slate-400 font-medium">{service.duration} 分钟</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditService(service)}
                    className="w-9 h-9 rounded-full bg-blue-50 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-all active:scale-90"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                  <button
                    onClick={() => handleDeleteService(service.id)}
                    disabled={isDeleting}
                    className="w-9 h-9 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all active:scale-90 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>
            ))}
            <button
              onClick={handleAddService}
              className="w-full p-5 text-primary text-sm font-black bg-blue-50/20 flex items-center justify-center gap-3 hover:bg-blue-50 transition-all group active:scale-[0.99]"
            >
              <span className="material-symbols-outlined text-[20px] transition-transform group-hover:scale-110">add_circle</span>
              <span>新增服务项目</span>
            </button>
          </div>
        </section>

        {/* 保存按钮 */}
        <div className="pt-4">
          <button
            onClick={handleSaveSystemConfig}
            disabled={isSavingConfig}
            className="w-full bg-slate-900 text-white font-black py-4.5 rounded-[24px] shadow-xl shadow-slate-200 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
          >
            {isSavingConfig ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>
                <span className="material-symbols-outlined">cloud_upload</span>
                <span>保存并分发全局配置</span>
              </>
            )}
          </button>
          <p className="text-center text-[10px] text-slate-400 font-medium mt-4 leading-relaxed px-10">
            配置更改将实时推送至所有在线客户端。为了保证排队体验，请勿在营业高峰期大幅度修改服务时长。
          </p>
        </div>
      </main>

      {/* 服务编辑弹窗 */}
      {showServiceModal && editingService && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity animate-fade-in"
            onClick={() => setShowServiceModal(false)}
          ></div>
          <div className="relative bg-white w-full max-w-sm m-4 rounded-[36px] p-7 shadow-2xl animate-[slide-up_0.35s_cubic-bezier(0.16,1,0.3,1)] overflow-y-auto max-h-[92vh] border border-white/20">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  {editingService.id ? '编辑套餐' : '定义新套餐'}
                </h2>
                <p className="text-xs text-slate-400 font-medium mt-0.5">为您的顾客提供更丰富的服务选择</p>
              </div>
              <button
                onClick={() => setShowServiceModal(false)}
                className="w-10 h-10 flex items-center justify-center bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition-colors"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2 px-1">套餐显示名称</label>
                <input
                  type="text"
                  value={editingService.name}
                  onChange={e => setEditingService({ ...editingService, name: e.target.value })}
                  className="w-full bg-slate-50 border-none rounded-[20px] py-4 px-5 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 placeholder:font-normal"
                  placeholder="如：美式复古精剪"
                />
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2 px-1">价格 (¥)</label>
                  <input
                    type="number"
                    value={editingService.price}
                    onChange={e => setEditingService({ ...editingService, price: Number(e.target.value) })}
                    className="w-full bg-slate-50 border-none rounded-[20px] py-4 px-5 font-mono font-black text-slate-900 focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2 px-1">时长 (MIN)</label>
                  <input
                    type="number"
                    value={editingService.duration}
                    onChange={e => setEditingService({ ...editingService, duration: Number(e.target.value) })}
                    className="w-full bg-slate-50 border-none rounded-[20px] py-4 px-5 font-mono font-black text-slate-900 focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2 px-1">选择识别图标</label>
                <div className="grid grid-cols-4 gap-3 bg-slate-50/50 p-4 rounded-[28px] border border-slate-100">
                  {iconOptions.map(icon => (
                    <button
                      key={icon}
                      onClick={() => setEditingService({ ...editingService, icon })}
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${editingService.icon === icon
                          ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-110 ring-4 ring-primary/10'
                          : 'bg-white text-slate-400 border border-slate-100 hover:border-primary/30'
                        }`}
                    >
                      <span className="material-symbols-outlined text-[22px]">{icon}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleSaveService}
                  disabled={isSavingService || !editingService.name}
                  className="w-full bg-primary text-white font-black py-4.5 rounded-[24px] shadow-2xl shadow-primary/30 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isSavingService ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-xl">save</span>
                      <span>{editingService.id ? '更新套餐项目' : '立即发布套餐'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 邮件配置弹窗 */}
      {showEmailModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity animate-fade-in"
            onClick={() => setShowEmailModal(false)}
          ></div>
          <div className="relative bg-white w-full max-w-lg m-4 rounded-[36px] p-8 shadow-2xl animate-[slide-up_0.35s_cubic-bezier(0.16,1,0.3,1)] overflow-y-auto max-h-[90vh] border border-white/20">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">邮件服务配置</h2>
                <p className="text-xs text-slate-400 font-medium mt-0.5">配置 SMTP 服务器用于发送邮件</p>
              </div>
              <button
                onClick={() => setShowEmailModal(false)}
                className="w-10 h-10 flex items-center justify-center bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition-colors"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="space-y-6">
              {/* 启用开关 */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-slate-400">toggle_on</span>
                  <span className="font-bold text-slate-700">启用邮件服务</span>
                </div>
                <button
                  onClick={() => updateEmailConfig({ enabled: !emailConfig.enabled })}
                  className={`w-14 h-8 rounded-full transition-all relative ${emailConfig.enabled ? 'bg-primary' : 'bg-slate-300'}`}
                >
                  <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${emailConfig.enabled ? 'left-7' : 'left-1'}`}></span>
                </button>
              </div>

              {/* SMTP 服务器 */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2 px-1">SMTP 服务器</label>
                <input
                  type="text"
                  value={emailConfig.smtpHost}
                  onChange={e => updateEmailConfig({ smtpHost: e.target.value })}
                  className="w-full bg-slate-50 border-none rounded-[20px] py-4 px-5 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 placeholder:font-normal"
                  placeholder="如：smtp.gmail.com"
                />
              </div>

              {/* 端口和 SSL */}
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2 px-1">端口</label>
                  <input
                    type="number"
                    value={emailConfig.smtpPort}
                    onChange={e => updateEmailConfig({ smtpPort: Number(e.target.value) })}
                    className="w-full bg-slate-50 border-none rounded-[20px] py-4 px-5 font-mono font-black text-slate-900 focus:ring-2 focus:ring-primary/20"
                    placeholder="587"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl cursor-pointer w-full">
                    <input
                      type="checkbox"
                      checked={emailConfig.useSSL}
                      onChange={e => updateEmailConfig({ useSSL: e.target.checked })}
                      className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <span className="font-bold text-slate-700">使用 SSL/TLS</span>
                  </label>
                </div>
              </div>

              {/* 用户名 */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2 px-1">SMTP 用户名</label>
                <input
                  type="text"
                  value={emailConfig.smtpUser}
                  onChange={e => updateEmailConfig({ smtpUser: e.target.value })}
                  className="w-full bg-slate-50 border-none rounded-[20px] py-4 px-5 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 placeholder:font-normal"
                  placeholder="your@email.com"
                />
              </div>

              {/* 密码 */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2 px-1">SMTP 密码 / 授权码</label>
                <input
                  type="password"
                  value={emailConfig.smtpPassword}
                  onChange={e => updateEmailConfig({ smtpPassword: e.target.value })}
                  className="w-full bg-slate-50 border-none rounded-[20px] py-4 px-5 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 placeholder:font-normal"
                  placeholder="••••••••"
                />
                <p className="text-[10px] text-slate-400 mt-2 px-1">建议使用应用专用授权码而非登录密码</p>
              </div>

              {/* 发件人信息 */}
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2 px-1">发件人邮箱</label>
                  <input
                    type="email"
                    value={emailConfig.fromEmail}
                    onChange={e => updateEmailConfig({ fromEmail: e.target.value })}
                    className="w-full bg-slate-50 border-none rounded-[20px] py-4 px-5 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 placeholder:font-normal"
                    placeholder="noreply@example.com"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2 px-1">发件人名称</label>
                  <input
                    type="text"
                    value={emailConfig.fromName}
                    onChange={e => updateEmailConfig({ fromName: e.target.value })}
                    className="w-full bg-slate-50 border-none rounded-[20px] py-4 px-5 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 placeholder:font-normal"
                    placeholder="BarberBook Pro"
                  />
                </div>
              </div>

              {/* 测试邮件 */}
              <div className="pt-4 border-t border-slate-100">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2 px-1">测试邮件地址</label>
                <div className="flex gap-3">
                  <input
                    type="email"
                    value={testEmail}
                    onChange={e => setTestEmail(e.target.value)}
                    className="flex-1 bg-slate-50 border-none rounded-[20px] py-4 px-5 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 placeholder:font-normal"
                    placeholder="输入测试邮箱地址"
                  />
                  <button
                    onClick={async () => {
                      if (!testEmail) return;
                      const success = await testEmailConfig(testEmail);
                      if (success) {
                        alert('✅ 配置验证成功！\n\n注意：当前为演示模式，邮件不会真正发送。\n\n要实现真实邮件发送，请选择以下方案之一：\n\n1. 部署 Supabase Edge Function\n2. 配置 Resend API\n3. 使用其他邮件服务（SendGrid/Mailgun）');
                      } else {
                        alert('❌ 配置验证失败\n\n请检查：\n1. 邮件服务是否已启用\n2. SMTP 配置是否完整\n3. 邮箱地址格式是否正确');
                      }
                    }}
                    disabled={!testEmail}
                    className="px-5 py-4 bg-slate-100 text-slate-700 rounded-[20px] font-bold hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    发送测试
                  </button>
                </div>
              </div>

              {/* 保存按钮 */}
              <div className="pt-2">
                <button
                  onClick={async () => {
                    const success = await saveEmailConfig();
                    if (success) {
                      setShowEmailModal(false);
                      setShowSaveToast(true);
                      setTimeout(() => setShowSaveToast(false), 2500);
                    }
                  }}
                  disabled={isSavingConfig}
                  className="w-full bg-primary text-white font-black py-4.5 rounded-[24px] shadow-2xl shadow-primary/30 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isSavingConfig ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-xl">save</span>
                      <span>保存邮件配置</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 帮助指南弹窗 */}
      {showHelpGuide && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setShowHelpGuide(false)}
          ></div>
          <div className="relative bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-[scale-in_0.25s_cubic-bezier(0.34,1.56,0.64,1)]">
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-16 h-16 bg-blue-50 text-primary rounded-[22px] flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-3xl">lightbulb</span>
              </div>
              <h2 className="text-2xl font-black text-slate-900">系统运营指引</h2>
              <p className="text-xs text-slate-400 font-medium mt-1">Admin Operation Manual</p>
            </div>

            <div className="space-y-5 mb-8">
              {adminGuides.map((guide, i) => (
                <div key={i} className="flex gap-4 p-4 bg-slate-50/50 rounded-[24px] border border-slate-100 hover:bg-white hover:shadow-md transition-all">
                  <div className="w-10 h-10 rounded-xl bg-white text-primary flex items-center justify-center shrink-0 shadow-sm border border-slate-100">
                    <span className="material-symbols-outlined text-xl">{guide.icon}</span>
                  </div>
                  <div className="text-left">
                    <h4 className="text-[13px] font-black text-slate-900 mb-1">{guide.label}</h4>
                    <p className="text-[10px] text-slate-500 leading-relaxed font-medium">{guide.content}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowHelpGuide(false)}
              className="w-full bg-slate-900 text-white font-black py-4 rounded-[20px] shadow-lg shadow-slate-200 active:scale-95 transition-all"
            >
              我已了解规则
            </button>
          </div>
        </div>
      )}

      <BottomNav activeRoute="admin_settings" onNavigate={onNavigate} userRole="admin" />
    </Layout>
  );
};

// 添加缺失的导入
import { supabase } from '../../services/supabase';
