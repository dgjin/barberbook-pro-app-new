-- ==========================================================
-- Migration: 002_email_service.sql
-- 描述: 添加邮件服务功能，支持 SMTP 配置和密码重置邮件
-- ==========================================================

-- 1. 创建密码重置验证码表
CREATE TABLE IF NOT EXISTS app_password_reset (
  email TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. 开启 RLS 权限保护
ALTER TABLE app_password_reset ENABLE ROW LEVEL SECURITY;

-- 3. 创建权限策略 - 允许所有操作（实际项目中应更严格）
CREATE POLICY "Allow All for Password Reset" ON app_password_reset FOR ALL USING (true) WITH CHECK (true);

-- 4. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON app_password_reset(expires_at);

-- 5. 清理过期验证码的函数
CREATE OR REPLACE FUNCTION cleanup_expired_verification_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM app_password_reset WHERE expires_at < timezone('utc'::text, now());
END;
$$;

-- 6. 插入默认邮件配置到 app_settings 表
-- 注意：app_settings 表应该在之前的迁移中已创建
INSERT INTO app_settings (key, value)
VALUES ('email_config', '{
  "enabled": false,
  "smtpHost": "smtp.gmail.com",
  "smtpPort": 587,
  "smtpUser": "",
  "smtpPassword": "",
  "fromEmail": "",
  "fromName": "BarberBook Pro",
  "useSSL": true
}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 7. 为 app_customers 表添加邮箱字段（如果还不存在）
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'app_customers' AND COLUMN_NAME = 'email') THEN
        ALTER TABLE app_customers ADD COLUMN email TEXT UNIQUE;
    END IF;
END $$;

-- 8. 为 app_customers 表添加微信 OpenID 字段（如果还不存在）
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'app_customers' AND COLUMN_NAME = 'wechat_openid') THEN
        ALTER TABLE app_customers ADD COLUMN wechat_openid TEXT UNIQUE;
    END IF;
END $$;

-- 9. 为 app_customers 表添加微信 UnionID 字段（如果还不存在）
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'app_customers' AND COLUMN_NAME = 'wechat_unionid') THEN
        ALTER TABLE app_customers ADD COLUMN wechat_unionid TEXT;
    END IF;
END $$;

-- 10. 为 app_customers 表添加最后登录时间字段（如果还不存在）
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'app_customers' AND COLUMN_NAME = 'last_login') THEN
        ALTER TABLE app_customers ADD COLUMN last_login TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- 11. 创建发送邮件的 Edge Function（需要在 Supabase Dashboard 中部署）
-- 注意：以下 SQL 仅作为参考，实际的 Edge Function 需要用 TypeScript/Deno 编写并部署

/*
-- Edge Function: send-email
-- 文件路径: supabase/functions/send-email/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

serve(async (req) => {
  const { to, subject, html, text, config } = await req.json()
  
  try {
    const client = new SMTPClient({
      connection: {
        hostname: config.smtpHost,
        port: config.smtpPort,
        tls: config.useSSL,
        auth: {
          username: config.smtpUser,
          password: config.smtpPassword,
        },
      },
    })

    await client.send({
      from: `${config.fromName} <${config.fromEmail}>`,
      to: to,
      subject: subject,
      content: text || '',
      html: html,
    })

    await client.close()

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
*/

-- ==========================================================
-- 使用说明：
-- 1. 在 Supabase SQL Editor 中执行此脚本
-- 2. 部署 send-email Edge Function（如需真实邮件发送功能）
-- 3. 在管理员后台配置 SMTP 服务器信息
-- 4. 支持的邮箱服务商：
--    - Gmail: smtp.gmail.com:587 (需要应用专用密码)
--    - QQ邮箱: smtp.qq.com:465 (需要授权码)
--    - 163邮箱: smtp.163.com:465 (需要授权码)
--    - Outlook: smtp.office365.com:587
-- ==========================================================
