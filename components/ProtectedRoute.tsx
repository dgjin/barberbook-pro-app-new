import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { User, UserRole } from '../types';

interface ProtectedRouteProps {
    user: User | null;
    allowedRoles?: UserRole[];
    children: React.ReactNode;
}

/**
 * 路由保护组件
 * 用于校验用户登录状态及角色权限
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    user,
    allowedRoles,
    children
}) => {
    const location = useLocation();

    // 1. 检查是否登录
    if (!user) {
        // 保存尝试访问的路径，登录后可跳回
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // 2. 检查角色权限
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        console.warn(`[Guard] Access denied for role: ${user.role}. Allowed: ${allowedRoles}`);

        // 根据角色重定向到其合法的首页
        if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
        if (user.role === 'barber') return <Navigate to="/admin/workbench" replace />;
        return <Navigate to="/home" replace />;
    }

    return <>{children}</>;
};
