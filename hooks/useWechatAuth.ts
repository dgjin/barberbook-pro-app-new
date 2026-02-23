import { useState, useCallback, useEffect, useMemo } from 'react';
import { User } from '../types';
import { supabase } from '../services/supabase';

// 微信登录配置
const WECHAT_APPID = import.meta.env.VITE_WECHAT_APPID || '';
const WECHAT_OPEN_APPID = import.meta.env.VITE_WECHAT_OPEN_APPID || ''; // 微信开放平台 AppID（用于网站应用扫码登录）

/**
 * 获取微信授权回调地址
 * 微信要求 redirect_uri 必须与公众平台配置的域名一致
 * 使用当前页面 URL 作为回调地址，确保一致性
 */
const getRedirectUri = (): string => {
  // 优先使用环境变量配置的回调地址
  const envUri = import.meta.env.VITE_WECHAT_REDIRECT_URI;
  if (envUri && envUri !== 'http://localhost:5173/auth/callback') {
    return envUri;
  }
  
  // 否则使用当前页面 URL（去掉 hash 部分）
  const currentUrl = window.location.href.split('#')[0].split('?')[0];
  return currentUrl;
};

interface WechatAuthState {
  loading: boolean;
  error: string | null;
  isWechatBrowser: boolean;
  qrCodeUrl: string | null;
}

interface UseWechatAuthReturn extends WechatAuthState {
  loginWithWechat: () => void;
  loginWithWechatQR: () => void;
  generateQRCode: () => string;
  handleWechatCallback: (code: string) => Promise<User | null>;
  clearError: () => void;
}

/**
 * 检测是否在微���浏览器内
 */
const isWechatBrowser = (): boolean => {
  const ua = window.navigator.userAgent.toLowerCase();
  return /micromessenger/i.test(ua);
};

/**
 * 微信登录 Hook
 * 处理微信 OAuth 登录流程，支持：
 * 1. 微信内浏览器 - 直接跳转授权
 * 2. 普通浏览器 - 显示二维码扫码登录
 */
export const useWechatAuth = (onSuccess?: (user: User) => void): UseWechatAuthReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [inWechatBrowser] = useState(() => isWechatBrowser());

  const clearError = useCallback(() => setError(null), []);

  /**
   * 生成微信登录二维码 URL
   * 用于普通浏览器扫码登录
   */
  const generateQRCode = useCallback((): string => {
    if (!WECHAT_OPEN_APPID || WECHAT_OPEN_APPID === 'your_wechat_open_appid_here') {
      // 如果没有配置开放平台 AppID，使用微信公众号的二维码方式
      // 生成一个带参数的二维码，用户扫码后关注公众号并获取登录链接
      const state = Math.random().toString(36).substring(2, 15);
      sessionStorage.setItem('wechat_auth_state', state);
      
      // 使用 QRCode API 生成二维码
      // 实际项目中应该调用后端接口生成带 scene 参数的二维码
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
        `${window.location.origin}/login?wechat_auth=1&state=${state}`
      )}`;
      
      setQrCodeUrl(qrUrl);
      return qrUrl;
    }

    // 使用微信开放平台网站应用扫码登录
    const state = Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('wechat_auth_state', state);

    const redirectUri = getRedirectUri();
    const authUrl = `https://open.weixin.qq.com/connect/qrconnect?` +
      `appid=${WECHAT_OPEN_APPID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=snsapi_login` +
      `&state=${state}` +
      `#wechat_redirect`;

    // 生成二维码图片 URL（使用微信提供的二维码接口）
    const qrCodeImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(authUrl)}`;
    setQrCodeUrl(qrCodeImgUrl);
    return qrCodeImgUrl;
  }, []);

  /**
   * 发起微信登录（微信内浏览器）
   * 跳转到微信授权页面
   */
  const loginWithWechat = useCallback(() => {
    if (!WECHAT_APPID || WECHAT_APPID === 'your_wechat_appid_here') {
      setError('微信登录未配置，请联系管理员');
      return;
    }

    // 生成随机 state 防止 CSRF 攻击
    const state = Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('wechat_auth_state', state);

    // 构建微信授权 URL
    const scope = 'snsapi_userinfo'; // 获取用户信息
    const redirectUri = getRedirectUri();
    const authUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?` +
      `appid=${WECHAT_APPID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${scope}` +
      `&state=${state}` +
      `#wechat_redirect`;

    // 跳转到微信授权页面
    window.location.href = authUrl;
  }, []);

  /**
   * 发起微信二维码登录（普通浏览器）
   */
  const loginWithWechatQR = useCallback(() => {
    if ((!WECHAT_APPID || WECHAT_APPID === 'your_wechat_appid_here') && 
        (!WECHAT_OPEN_APPID || WECHAT_OPEN_APPID === 'your_wechat_open_appid_here')) {
      setError('微信登录未配置，请联系管理员');
      return;
    }

    // 生成二维码
    generateQRCode();
  }, [generateQRCode]);

  /**
   * 处理微信回调
   * 使用 code 获取用户信息并完成登录
   */
  const handleWechatCallback = useCallback(async (code: string): Promise<User | null> => {
    setLoading(true);
    setError(null);

    try {
      // 注意：实际项目中，这里需要后端服务来换取 access_token 和用户信息
      // 因为微信的 appsecret 不能暴露在前端
      // 这里使用模拟数据演示流程

      // 模拟调用后端 API 获取微信用户信息
      // const response = await fetch('/api/wechat/auth', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ code })
      // });
      // const wechatData = await response.json();

      // 模拟微信用户信息
      const mockWechatData = {
        openid: 'mock_openid_' + Math.random().toString(36).substring(2, 10),
        nickname: '微信用户' + Math.floor(Math.random() * 10000),
        headimgurl: `https://ui-avatars.com/api/?name=WeChat&background=07C160&color=fff`,
        unionid: 'mock_unionid_' + Math.random().toString(36).substring(2, 10)
      };

      // 检查用户是否已存在
      const { data: existingUser } = await supabase
        .from('app_customers')
        .select('*')
        .eq('wechat_openid', mockWechatData.openid)
        .single();

      let userData: User;

      if (existingUser) {
        // 用户已存在，更新信息
        const { data: updatedUser } = await supabase
          .from('app_customers')
          .update({
            name: mockWechatData.nickname,
            avatar: mockWechatData.headimgurl,
            last_login: new Date().toISOString()
          })
          .eq('id', existingUser.id)
          .select()
          .single();

        userData = {
          id: existingUser.id,
          name: mockWechatData.nickname,
          role: 'customer',
          avatar: mockWechatData.headimgurl,
          phone: existingUser.phone || '',
          wechatOpenid: mockWechatData.openid
        };
      } else {
        // 新用户，创建账号
        const { data: newUser, error: insertError } = await supabase
          .from('app_customers')
          .insert({
            name: mockWechatData.nickname,
            avatar: mockWechatData.headimgurl,
            wechat_openid: mockWechatData.openid,
            wechat_unionid: mockWechatData.unionid,
            phone: '', // 微信登录后需要绑定手机号
            password_hash: '', // 微信登录不需要密码
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (insertError) {
          throw new Error('创建用户失败: ' + insertError.message);
        }

        userData = {
          id: newUser.id,
          name: mockWechatData.nickname,
          role: 'customer',
          avatar: mockWechatData.headimgurl,
          phone: '',
          wechatOpenid: mockWechatData.openid
        };

        // 记录日志
        await supabase.from('app_logs').insert({
          user: mockWechatData.nickname,
          role: 'customer',
          action: '微信登录注册',
          details: `新用户通过微信登录注册: ${mockWechatData.openid}`,
          type: 'info',
          avatar: mockWechatData.headimgurl
        });
      }

      onSuccess?.(userData);
      return userData;
    } catch (err: any) {
      setError(err.message || '微信登录失败');
      return null;
    } finally {
      setLoading(false);
    }
  }, [onSuccess]);

  return {
    loading,
    error,
    isWechatBrowser: inWechatBrowser,
    qrCodeUrl,
    loginWithWechat,
    loginWithWechatQR,
    generateQRCode,
    handleWechatCallback,
    clearError
  };
};
