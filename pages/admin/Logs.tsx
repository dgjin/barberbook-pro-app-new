import React, { useState, useCallback } from 'react';
import { Layout } from '../../components/Layout';
import { BottomNav } from '../../components/BottomNav';
import { PageRoute } from '../../types';
import { useLogs } from '../../hooks/useAdmin';
import { Loading } from '../../components/Loading';

interface Props {
  onNavigate: (route: PageRoute) => void;
}

export const Logs: React.FC<Props> = ({ onNavigate }) => {
  const [toast, setToast] = useState('');

  // 使用自定义 Hook
  const {
    filteredLogs,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    loading,
    hasMore,
    loadMore,
    currentPage,
    totalCount,
    pageSize,
    refetch
  } = useLogs();

  // 处理下载 - 导出 CSV 文件
  const handleDownload = useCallback(() => {
    if (filteredLogs.length === 0) {
      setToast('没有可导出的日志');
      setTimeout(() => setToast(''), 3000);
      return;
    }

    setToast('正在导出 CSV...');

    // 构建 CSV 内容
    const headers = ['时间', '用户', '角色', '操作', '详情'];
    const csvRows = [headers.join(',')];

    filteredLogs.forEach(log => {
      const row = [
        `"${log.time}"`,
        `"${log.user}"`,
        `"${log.role || 'system'}"`,
        `"${log.action}"`,
        `"${log.details?.replace(/"/g, '""') || ''}"`
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = '\uFEFF' + csvRows.join('\n'); // 添加 BOM 支持中文
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    // 创建下载链接
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().split('T')[0];
    link.href = url;
    link.download = `系统日志_${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setToast('导出成功！文件已下载');
    setTimeout(() => setToast(''), 3000);
  }, [filteredLogs]);

  // 判断是否为系统日志
  const isSystemLog = useCallback((log: any) => {
    return log.role === 'system' || log.action?.includes('系统更新');
  }, []);

  return (
    <Layout>
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-text-main text-white px-6 py-3 rounded-full text-sm font-bold shadow-soft-lg z-50 animate-fade-in">
          {toast}
        </div>
      )}

      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-bg-soft px-5 pt-6 pb-4">
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('admin_settings')}
              className="material-symbols-outlined text-text-muted hover:text-primary transition-colors cursor-pointer"
            >
              arrow_back
            </button>
            <h1 className="text-xl font-bold text-text-main tracking-tight font-heading">日志中心</h1>
          </div>
          <button
            onClick={handleDownload}
            disabled={filteredLogs.length === 0}
            className={`w-10 h-10 flex items-center justify-center rounded-2xl border transition-all duration-300 cursor-pointer ${
              filteredLogs.length === 0
                ? 'border-bg-soft bg-bg-soft text-text-muted cursor-not-allowed'
                : 'border-bg-soft bg-surface text-text-muted hover:bg-primary hover:text-white hover:border-primary hover:shadow-soft'
            }`}
          >
            <span className="material-symbols-outlined text-xl">download</span>
          </button>
        </div>

        <div className="space-y-3">
          {/* 搜索框 */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-xl">search</span>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-bg-soft border border-bg-soft rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder-text-muted transition-all"
              placeholder="搜索操作、人员或详情..."
              type="text"
            />
          </div>

          {/* 筛选标签 */}
          <div className="flex p-1 bg-bg-soft rounded-xl">
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-300 cursor-pointer ${
                filter === 'all' ? 'bg-surface text-text-main shadow-soft' : 'text-text-muted hover:text-text-main'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setFilter('operation')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-300 cursor-pointer ${
                filter === 'operation' ? 'bg-surface text-text-main shadow-soft' : 'text-text-muted hover:text-text-main'
              }`}
            >
              业务操作
            </button>
            <button
              onClick={() => setFilter('system')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-300 cursor-pointer ${
                filter === 'system' ? 'bg-surface text-primary shadow-soft' : 'text-text-muted hover:text-primary'
              }`}
            >
              系统更新
            </button>
          </div>
        </div>
      </header>

      <main className="px-5 mt-6 relative pb-32">
        {loading ? (
          <div className="py-20 text-center">
            <Loading text="加载日志..." />
          </div>
        ) : (
          <>
            <div className="absolute left-[21px] top-0 bottom-0 w-[1px] bg-primary/20"></div>
            <div className="mb-8">
              <div className="flex items-center gap-4 mb-5 relative z-10">
                <div className="w-1.5 h-1.5 rounded-full bg-primary ring-[6px] ring-surface outline outline-1 outline-primary/20 ml-[18px]"></div>
                <span className="text-[11px] font-bold text-text-muted uppercase tracking-[0.1em]">
                  {filter === 'system' ? '版本发布记录' : '最近活动'}
                </span>
              </div>
              <div className="space-y-4 ml-10">
                {filteredLogs.length > 0 ? (
                  filteredLogs.map(log => {
                    const isSystem = isSystemLog(log);
                    return (
                      <div
                        key={log.id}
                        className={`bg-surface rounded-xl p-4 shadow-soft border relative overflow-hidden transition-all duration-300 hover:shadow-soft-lg ${
                          isSystem
                            ? 'border-l-4 border-l-accent border-y-bg-soft border-r-bg-soft'
                            : 'border-bg-soft'
                        }`}
                      >
                        {isSystem && (
                          <span className="absolute -right-4 -top-4 w-12 h-12 bg-accent/10 rounded-full flex items-end justify-start pl-2 pb-2">
                            <span className="material-symbols-outlined text-accent/40 text-sm">rocket_launch</span>
                          </span>
                        )}
                        <div className="flex justify-between items-start mb-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-bg-soft overflow-hidden flex items-center justify-center">
                              {log.avatar ? (
                                <img src={log.avatar} alt={log.user} className="w-full h-full object-cover"/>
                              ) : (
                                <span className="material-symbols-outlined text-[16px] text-text-muted">smart_toy</span>
                              )}
                            </div>
                            <span className="text-xs font-semibold text-text-main">{log.user}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                              isSystem
                                ? 'bg-accent/10 text-accent border-accent/20'
                                : 'bg-bg-soft text-text-muted border-bg-soft'
                            }`}>
                              {isSystem ? 'SYSTEM' : log.role}
                            </span>
                          </div>
                          <span className="text-[10px] text-text-muted font-mono">{log.time}</span>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs font-bold ${
                            log.type === 'danger' ? 'text-red-500' :
                            log.type === 'warning' ? 'text-amber-500' : 'text-primary'
                          }`}>
                            {log.action?.split(' ')[0]}
                          </span>
                          <div className="w-1 h-1 rounded-full bg-bg-soft"></div>
                          <h3 className="text-sm font-medium text-text-main line-clamp-1">{log.action}</h3>
                        </div>
                        <p className={`text-xs leading-relaxed p-2.5 rounded-lg border ${
                          isSystem
                            ? 'bg-accent/5 text-text-secondary border-accent/10 font-medium'
                            : 'bg-bg-soft/50 text-text-muted border-bg-soft'
                        }`}>
                          {log.details}
                        </p>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-10">
                    <p className="text-sm text-text-muted">未找到相关日志</p>
                  </div>
                )}

                {/* 分页信息 */}
                {filteredLogs.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-bg-soft">
                    {/* 统计信息 */}
                    <div className="flex justify-between items-center mb-4 text-xs text-text-muted">
                      <span>已显示 <span className="font-bold text-text-main">{filteredLogs.length}</span> 条</span>
                      <span>每页 {pageSize} 条</span>
                    </div>

                    {/* 加载更多按钮 */}
                    <div className="text-center">
                      {loading ? (
                        <div className="py-4 flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                          <span className="text-sm text-text-secondary">加载中...</span>
                        </div>
                      ) : hasMore ? (
                        <button
                          onClick={loadMore}
                          className="w-full sm:w-auto px-8 py-3 bg-bg-soft text-text-secondary font-bold text-sm rounded-xl border border-bg-soft hover:bg-primary hover:text-white hover:border-primary transition-all duration-300 cursor-pointer shadow-soft hover:shadow-soft-lg flex items-center justify-center gap-2"
                        >
                          <span>加载更多</span>
                          <span className="material-symbols-outlined text-[16px]">expand_more</span>
                        </button>
                      ) : (
                        <div className="py-4 text-center">
                          <p className="text-xs text-text-muted">已加载全部日志</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
      <BottomNav activeRoute="admin_logs" onNavigate={onNavigate} userRole="admin" />
    </Layout>
  );
};
