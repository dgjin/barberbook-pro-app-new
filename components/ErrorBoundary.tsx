import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * 错误边界组件
 * 捕获子组件中的 JavaScript 错误，防止整个应用崩溃
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // 更新 state 使下一次渲染能够显示降级 UI
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 你同样可以将错误日志上报给服务器
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      // 你可以自定义降级 UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-bg-main flex flex-col items-center justify-center p-6">
          <div className="w-20 h-20 bg-red-50 rounded-[24px] flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-4xl text-red-500">error_outline</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-2">页面加载出错</h1>
          <p className="text-slate-500 text-sm mb-6 text-center max-w-sm">
            抱歉，页面加载时遇到了问题。请尝试刷新页面或返回首页。
          </p>
          
          {this.state.error && (
            <div className="bg-slate-50 rounded-2xl p-4 mb-6 max-w-sm w-full overflow-auto">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">错误详情</p>
              <p className="text-xs text-red-500 font-mono">{this.state.error.toString()}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button 
              onClick={() => window.location.reload()} 
              className="px-6 py-3 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-blue-200 active:scale-95 transition-all"
            >
              刷新页面
            </button>
            <button 
              onClick={() => window.location.href = '/'} 
              className="px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-2xl active:scale-95 transition-all"
            >
              返回首页
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
