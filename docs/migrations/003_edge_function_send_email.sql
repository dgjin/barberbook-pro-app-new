-- ==========================================================
-- Migration: 003_edge_function_send_email.sql
-- 描述: 使用 pg_net 扩展创建 HTTP 端点来发送邮件
-- 替代方案：无需部署 Edge Function，直接在数据库中实现
-- ==========================================================

-- 1. 启用 pg_net 扩展（用于 HTTP 请求）
-- 注意：需要在 Supabase Dashboard -> Database -> Extensions 中启用 pg_net

-- 2. 创建发送邮件的函数（使用外部邮件服务 API）
-- 这里使用 Resend API 作为示例（推荐，每月 3000 封免费邮件）

CREATE OR REPLACE FUNCTION send_email_via_api(
    p_to TEXT,
    p_subject TEXT,
    p_html TEXT,
    p_api_key TEXT DEFAULT ''  -- Resend API Key
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_response JSONB;
BEGIN
    -- 使用 pg_net 发送 HTTP POST 请求到 Resend API
    -- 注意：需要先配置 Resend API Key
    
    SELECT content::JSONB INTO v_response
    FROM net.http_post(
        url:='https://api.resend.com/emails',
        headers:=jsonb_build_object(
            'Authorization', 'Bearer ' || p_api_key,
            'Content-Type', 'application/json'
        ),
        body:=jsonb_build_object(
            'from', 'BarberBook Pro <onboarding@resend.dev>',
            'to', p_to,
            'subject', p_subject,
            'html', p_html
        )::text
    );
    
    RETURN v_response;
END;
$$;

-- 3. 创建发送验证码邮件的包装函数
CREATE OR REPLACE FUNCTION send_verification_email(
    p_email TEXT,
    p_code TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_api_key TEXT;
    v_response JSONB;
    v_html TEXT;
BEGIN
    -- 从 app_settings 获取 Resend API Key
    SELECT value->>'apiKey' INTO v_api_key
    FROM app_settings
    WHERE key = 'resend_config';
    
    IF v_api_key IS NULL OR v_api_key = '' THEN
        RAISE EXCEPTION 'Resend API Key not configured';
    END IF;
    
    -- 构建邮件 HTML
    v_html := format('
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #007AFF; margin: 0;">BarberBook Pro</h1>
        <p style="color: #666; margin: 10px 0 0 0;">专业理发预约管理系统</p>
      </div>
      <div style="background: #f8f9fa; border-radius: 12px; padding: 30px; margin-bottom: 20px;">
        <h2 style="color: #333; margin: 0 0 20px 0; font-size: 18px;">密码重置</h2>
        <p style="color: #666; margin: 0 0 20px 0; line-height: 1.6;">
          您正在进行密码重置操作，请输入以下验证码完成验证：
        </p>
        <div style="background: #007AFF; color: white; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; border-radius: 8px; letter-spacing: 8px;">
          %s
        </div>
        <p style="color: #999; margin: 20px 0 0 0; font-size: 12px;">
          验证码有效期为 10 分钟，请勿泄露给他人。
        </p>
      </div>
      <div style="text-align: center; color: #999; font-size: 12px;">
        <p>此邮件由 BarberBook Pro 系统自动发送，请勿回复。</p>
      </div>
    </div>', p_code);
    
    -- 调用发送邮件函数
    v_response := send_email_via_api(p_email, 'BarberBook Pro - 密码重置验证码', v_html, v_api_key);
    
    RETURN v_response->>'id' IS NOT NULL;
END;
$$;

-- 4. 插入 Resend 配置模板
INSERT INTO app_settings (key, value)
VALUES ('resend_config', '{"apiKey": "", "fromEmail": "onboarding@resend.dev"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ==========================================================
-- 使用说明：
-- 
-- 方案一：使用 Resend API（推荐，简单快速）
-- 1. 访问 https://resend.com 注册账号
-- 2. 获取 API Key
-- 3. 在 Supabase Dashboard -> Database -> Extensions 中启用 pg_net
-- 4. 更新 resend_config: UPDATE app_settings SET value = '{"apiKey": "your_api_key"}' WHERE key = 'resend_config';
-- 5. 调用函数: SELECT send_verification_email('user@example.com', '123456');
--
-- 方案二：使用 SMTP（需要 Edge Function）
-- 1. 安装 Supabase CLI: npm install -g supabase
-- 2. 登录: supabase login
-- 3. 创建函数: supabase functions new send-email
-- 4. 复制 002_email_service.sql 中的代码到 supabase/functions/send-email/index.ts
-- 5. 部署: supabase functions deploy send-email
--
-- 方案三：使用第三方邮件服务
-- - SendGrid: https://sendgrid.com
-- - Mailgun: https://mailgun.com
-- - AWS SES: https://aws.amazon.com/ses
-- ==========================================================
