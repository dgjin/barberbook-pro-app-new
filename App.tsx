import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { PageRoute, Barber, Appointment, User } from './types';
import { supabase } from './services/supabase';
import { Loading, PageTransition } from './components/Loading';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RoleLauncher } from './pages/RoleLauncher';
import { ProtectedRoute } from './components/ProtectedRoute';

// 自定义 lazy 加载函数以支持预加载
const lazyWithPreload = (factory: () => Promise<any>) => {
  const Component = lazy(factory) as any;
  Component.preload = factory;
  return Component;
};

// --- 懒加载页面组件 ---
// 顾客端
const CustomerHome = lazyWithPreload(() => import('./pages/CustomerHome').then(m => ({ default: m.CustomerHome })));
const Booking = lazyWithPreload(() => import('./pages/Booking').then(m => ({ default: m.Booking })));
const AIChat = lazyWithPreload(() => import('./pages/AIChat').then(m => ({ default: m.AIChat })));
const CheckIn = lazyWithPreload(() => import('./pages/CheckIn').then(m => ({ default: m.CheckIn })));
const Login = lazyWithPreload(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Register = lazyWithPreload(() => import('./pages/Register').then(m => ({ default: m.Register })));

// 监控端
const Monitor = lazyWithPreload(() => import('./pages/Monitor').then(m => ({ default: m.Monitor })));
const WebMonitor = lazyWithPreload(() => import('./pages/WebMonitor').then(m => ({ default: m.WebMonitor })));

// 管理后台
const Dashboard = lazyWithPreload(() => import('./pages/admin/Dashboard').then(m => ({ default: m.Dashboard })));
const Workbench = lazyWithPreload(() => import('./pages/admin/Workbench').then(m => ({ default: m.Workbench })));
const Management = lazyWithPreload(() => import('./pages/admin/Management').then(m => ({ default: m.Management })));
const Settings = lazyWithPreload(() => import('./pages/admin/Settings').then(m => ({ default: m.Settings })));
const Logs = lazyWithPreload(() => import('./pages/admin/Logs').then(m => ({ default: m.Logs })));
const BarberProfile = lazyWithPreload(() => import('./pages/admin/BarberProfile').then(m => ({ default: m.BarberProfile })));


const App: React.FC = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [lastAppointment, setLastAppointment] = useState<Appointment | null>(null);
  const [availableBarbers, setAvailableBarbers] = useState<Barber[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 加载理发师列表
  useEffect(() => {
    const loadBarbers = async () => {
      const { data } = await supabase.from('app_barbers').select('*');
      if (data) setAvailableBarbers(data as unknown as Barber[]);
      else {
        // Fallback
        setAvailableBarbers([
          { id: 1, name: 'Marcus K.', title: '美式渐变', rating: 4.9, image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuASZI54tUmbDSYe5gS24e3PgOMrI9qj3GqCIEsupdXwc_RqEBRxxdeTzuQ3J0BROacciMi8-E7ETF5xeF2c2Uk4cf7YG5pilwN59DTPHgqMFtmR-BKshgwP10w2kJSINs_ypgvRDwU3w6nM3XlqoTe2P00EUzVesNcHEhim30CLfIwvsP3__IjMVSrLxerwxTk_9QTAUp9wDxhQiUOSQBM247evrYwIqH808FQf91hnQpmGCY8fFpkv8bZ_2SuikN86EqZhUYAYaRc', specialties: [], status: 'active' },
          { id: 2, name: 'James L.', title: '经典剪裁', rating: 4.8, image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD1qwvlDy5vm9u_b33_rfD-P40Tj3GDKG0BNW3yV3q6xsmoWSeF97hNH2lUiW2hPUuOombMFpnxNvcaTI3fvuVnlFjtiUQiAPARwitCM7fkkOmGhqU45Tbfv2ctMYXUcYuJog4zB8RNrPbkTdkcJVWtuV76N-kCOflrxai1WG_Ugv2XKZ674N23ONPrmzVGCM84SUkgpRzXQw-w7-ygvF6JovNcvEb3vxZjcdJvYqoeV8QJiVFDljKvMKL_L7dDIwrIvQXwOquUvYg', specialties: [], status: 'active' },
        ]);
      }
    }
    loadBarbers();
  }, []);

  // 路由导航封装
  const handleNavigate = (route: PageRoute) => {
    console.log('[App] Navigating to:', route);

    const routeMap: Record<PageRoute, string> = {
      launcher: '/launcher',
      home: '/home',
      booking: '/booking',
      ai_chat: '/ai_chat',
      check_in: '/check_in',
      login: '/login',
      register: '/register',
      monitor: '/monitor',
      web_monitor: '/web_monitor',
      admin_dashboard: '/admin/dashboard',
      admin_workbench: '/admin/workbench',
      admin_management: '/admin/management',
      admin_settings: '/admin/settings',
      admin_logs: '/admin/logs',
      barber_profile: '/admin/barber_profile'
    };

    setIsLoading(true);
    const path = routeMap[route] || '/';
    navigate(path);
    setTimeout(() => {
      setIsLoading(false);
    }, 100);
  };

  const handleBarberSelect = (barber: Barber) => {
    setSelectedBarber(barber);
  };

  const handleBookingSuccess = (appointment: Appointment) => {
    setLastAppointment(appointment);
    handleNavigate('check_in');
  };

  const handleUserUpdate = (updates: Partial<User>) => {
    if (currentUser) {
      setCurrentUser({ ...currentUser, ...updates });
    }
  };

  const handleRegister = (user: User) => {
    setCurrentUser(user);
    handleNavigate('home');
  };

  // --- 核心重定向逻辑优化 ---
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    console.log('[App] User logged in:', user.role);

    // 基于角色的智能跳转 (RBAC Redirection)
    if (user.role === 'admin') {
      handleNavigate('admin_dashboard');
    } else if (user.role === 'barber') {
      handleNavigate('admin_workbench');
    } else {
      handleNavigate('home');
    }
  };

  const handleGuestVisit = () => {
    setCurrentUser(null);
    handleNavigate('home');
  };

  return (
    <>
      {isLoading && <Loading fullScreen text="页面加载中..." />}
      <ErrorBoundary>
        <Suspense fallback={<PageTransition />}>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/launcher" element={<RoleLauncher availableBarbers={availableBarbers} handleGuestVisit={handleGuestVisit} />} />
            <Route path="/home" element={<CustomerHome onNavigate={handleNavigate} onBarberSelect={handleBarberSelect} currentUser={currentUser} />} />
            <Route path="/booking" element={<Booking onNavigate={handleNavigate} preselectedBarber={selectedBarber} onBookingSuccess={handleBookingSuccess} currentUser={currentUser} />} />
            <Route path="/ai_chat" element={<AIChat onNavigate={handleNavigate} />} />
            <Route path="/check_in" element={<CheckIn onNavigate={handleNavigate} appointment={lastAppointment} currentUser={currentUser} onUpdateUser={handleUserUpdate} />} />
            <Route path="/login" element={<Login onNavigate={handleNavigate} onLogin={handleLogin} />} />
            <Route path="/register" element={<Register onNavigate={handleNavigate} onRegister={handleRegister} />} />

            <Route path="/monitor" element={<Monitor onNavigate={handleNavigate} currentUser={currentUser} />} />
            <Route path="/web_monitor" element={<WebMonitor onNavigate={handleNavigate} currentUser={currentUser} />} />

            {/* 管理后台 - 受保护路由 (Role Based Access Control) */}
            <Route path="/admin/dashboard" element={
              <ProtectedRoute user={currentUser} allowedRoles={['admin']}>
                <Dashboard onNavigate={handleNavigate} />
              </ProtectedRoute>
            } />
            <Route path="/admin/workbench" element={
              <ProtectedRoute user={currentUser} allowedRoles={['barber', 'admin']}>
                <Workbench onNavigate={handleNavigate} currentUser={currentUser} />
              </ProtectedRoute>
            } />
            <Route path="/admin/management" element={
              <ProtectedRoute user={currentUser} allowedRoles={['admin']}>
                <Management onNavigate={handleNavigate} currentUser={currentUser} />
              </ProtectedRoute>
            } />
            <Route path="/admin/settings" element={
              <ProtectedRoute user={currentUser} allowedRoles={['admin']}>
                <Settings onNavigate={handleNavigate} />
              </ProtectedRoute>
            } />
            <Route path="/admin/logs" element={
              <ProtectedRoute user={currentUser} allowedRoles={['admin']}>
                <Logs onNavigate={handleNavigate} />
              </ProtectedRoute>
            } />
            <Route path="/admin/barber_profile" element={
              <ProtectedRoute user={currentUser} allowedRoles={['barber', 'admin']}>
                <BarberProfile onNavigate={handleNavigate} currentUser={currentUser} />
              </ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </>
  );
};

export default App;
