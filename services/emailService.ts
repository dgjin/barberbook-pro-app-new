import { supabase } from './supabase';

interface EmailConfig {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  fromEmail: string;
  fromName: string;
  useSSL: boolean;
}

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * 获取邮件配置
 */
export const getEmailConfig = async (): Promise<EmailConfig | null> => {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'email_config')
      .single();

    if (error || !data?.value) return null;
    return data.value as EmailConfig;
  } catch (err) {
    console.error('Get email config error:', err);
    return null;
  }
};

/**
 * 发送邮件
 * 实际项目中应该调用后端 API 或 Edge Function
 */
export const sendEmail = async (params: SendEmailParams): Promise<boolean> => {
  try {
    const config = await getEmailConfig();
    
    if (!config || !config.enabled) {
      console.warn('邮件服务未启用或未配置');
      return false;
    }

    // 调用 Supabase Edge Function 发送邮件
    // 注意：需要在 Supabase 中创建 send-email Edge Function
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
        config: config
      }
    });

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Send email error:', err);
    return false;
  }
};

/**
 * 发送验证码邮件
 */
export const sendVerificationCodeEmail = async (
  to: string, 
  code: string, 
  purpose: 'reset_password' | 'register' = 'reset_password'
): Promise<boolean> => {
  const subject = purpose === 'reset_password' 
    ? 'BarberBook Pro - 密码重置验证码' 
    : 'BarberBook Pro - 注册验证码';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #007AFF; margin: 0;">BarberBook Pro</h1>
        <p style="color: #666; margin: 10px 0 0 0;">专业理发预约管理系统</p>
      </div>
      
      <div style="background: #f8f9fa; border-radius: 12px; padding: 30px; margin-bottom: 20px;">
        <h2 style="color: #333; margin: 0 0 20px 0; font-size: 18px;">
          ${purpose === 'reset_password' ? '密码重置' : '账号注册'}
        </h2>
        <p style="color: #666; margin: 0 0 20px 0; line-height: 1.6;">
          您正在进行${purpose === 'reset_password' ? '密码重置' : '账号注册'}操作，请输入以下验证码完成验证：
        </p>
        <div style="background: #007AFF; color: white; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; border-radius: 8px; letter-spacing: 8px;">
          ${code}
        </div>
        <p style="color: #999; margin: 20px 0 0 0; font-size: 12px;">
          验证码有效期为 10 分钟，请勿泄露给他人。
        </p>
      </div>
      
      <div style="text-align: center; color: #999; font-size: 12px;">
        <p>此邮件由 BarberBook Pro 系统自动发送，请勿回复。</p>
        <p style="margin-top: 10px;">© 2024 BarberBook Pro. All rights reserved.</p>
      </div>
    </div>
  `;

  return sendEmail({ to, subject, html });
};

/**
 * 发送密码重置成功通知
 */
export const sendPasswordResetSuccessEmail = async (to: string): Promise<boolean> => {
  const subject = 'BarberBook Pro - 密码重置成功';
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #007AFF; margin: 0;">BarberBook Pro</h1>
        <p style="color: #666; margin: 10px 0 0 0;">专业理发预约管理系统</p>
      </div>
      
      <div style="background: #f8f9fa; border-radius: 12px; padding: 30px; margin-bottom: 20px;">
        <h2 style="color: #333; margin: 0 0 20px 0; font-size: 18px;">密码重置成功</h2>
        <p style="color: #666; margin: 0 0 20px 0; line-height: 1.6;">
          您的密码已成功重置。如果这不是您本人的操作，请立即联系管理员。
        </p>
        <div style="background: #28a745; color: white; text-align: center; padding: 15px; border-radius: 8px;">
          <span style="font-size: 16px; font-weight: bold;">✓ 密码重置成功</span>
        </div>
      </div>
      
      <div style="text-align: center; color: #999; font-size: 12px;">
        <p>此邮件由 BarberBook Pro 系统自动发送，请勿回复。</p>
        <p style="margin-top: 10px;">© 2024 BarberBook Pro. All rights reserved.</p>
      </div>
    </div>
  `;

  return sendEmail({ to, subject, html });
};
