import React from 'react';

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  text?: string;
  fullScreen?: boolean;
  className?: string;
}

/**
 * 统一加载组件
 * 支持多种尺寸和全屏模式
 */
export const Loading: React.FC<LoadingProps> = ({ 
  size = 'md', 
  text,
  fullScreen = false,
  className = ''
}) => {
  const sizeClasses = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-3',
    xl: 'w-16 h-16 border-4'
  };

  const spinner = (
    <div className={`${sizeClasses[size]} rounded-full border-b-primary border-slate-200 animate-spin ${className}`} />
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center z-50">
        {spinner}
        {text && <p className="mt-4 text-sm text-slate-500 font-medium">{text}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-8">
      {spinner}
      {text && <p className="mt-3 text-xs text-slate-400 font-medium">{text}</p>}
    </div>
  );
};

/**
 * 骨架屏组件 - 用于列表加载
 */
export const Skeleton: React.FC<{ 
  rows?: number; 
  className?: string;
  avatar?: boolean;
}> = ({ rows = 3, className = '', avatar = false }) => {
  return (
    <div className={`space-y-4 animate-pulse ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 bg-white rounded-2xl">
          {avatar && <div className="w-12 h-12 bg-slate-200 rounded-full" />}
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-200 rounded w-3/4" />
            <div className="h-3 bg-slate-200 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * 页面过渡加载组件
 */
export const PageTransition: React.FC = () => (
  <div className="min-h-screen bg-bg-main flex flex-col items-center justify-center">
    <div className="relative">
      <div className="w-12 h-12 rounded-[16px] bg-primary/20 animate-pulse" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="material-symbols-outlined text-primary text-2xl">content_cut</span>
      </div>
    </div>
    <p className="mt-4 text-xs text-slate-400 font-medium tracking-widest">LOADING</p>
  </div>
);
