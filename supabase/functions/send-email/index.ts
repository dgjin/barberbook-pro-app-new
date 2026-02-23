// Supabase Edge Function: send-email
// 用于发送邮件的 Edge Function
// 部署命令: supabase functions deploy send-email

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  fromEmail: string;
  fromName: string;
  useSSL: boolean;
}

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
  config: EmailConfig;
}

serve(async (req) => {
  // 处理 CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    })
  }

  try {
    const { to, subject, html, text, config }: EmailRequest = await req.json()

    // 验证必要参数
    if (!to || !subject || !html || !config) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameters' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 验证配置
    if (!config.smtpHost || !config.smtpUser || !config.smtpPassword) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid email configuration' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 使用 SMTP 发送邮件
    // 注意：Deno 环境中需要使用 SMTP 客户端库
    // 这里使用简单的 fetch 调用外部邮件 API 作为示例
    
    // 方案1: 使用 Resend API（推荐）
    // 如果配置了 Resend API Key，优先使用 Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    
    if (resendApiKey) {
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${config.fromName || 'BarberBook Pro'} <${config.fromEmail || 'onboarding@resend.dev'}>`,
          to: to,
          subject: subject,
          html: html,
          text: text || '',
        }),
      })

      if (resendResponse.ok) {
        const data = await resendResponse.json()
        return new Response(
          JSON.stringify({ success: true, id: data.id }),
          { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        )
      } else {
        const error = await resendResponse.text()
        throw new Error(`Resend API error: ${error}`)
      }
    }

    // 方案2: 使用 SMTP（需要额外的 SMTP 客户端库）
    // 这里使用 denomailer 库作为示例
    try {
      const { SMTPClient } = await import('https://deno.land/x/denomailer@1.6.0/mod.ts')
      
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

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      )
    } catch (smtpError) {
      console.error('SMTP Error:', smtpError)
      throw new Error(`SMTP sending failed: ${smtpError.message}`)
    }

  } catch (error) {
    console.error('Send email error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    )
  }
})
