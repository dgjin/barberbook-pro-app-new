# 部署邮件发送 Edge Function 指南

## 方案二：Supabase Edge Function 部署

### 前置条件

1. 已创建 Supabase 项目
2. 已安装 Node.js 和 npm

### 步骤一：安装 Supabase CLI

#### macOS (使用 Homebrew)
```bash
brew install supabase/tap/supabase
```

#### Windows (使用 Scoop)
```bash
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

#### 使用 npm (跨平台)
```bash
npm install -g supabase
```

#### 验证安装
```bash
supabase --version
```

### 步骤二：登录 Supabase

```bash
supabase login
```

浏览器会自动打开，登录您的 Supabase 账号并授权。

### 步骤三：初始化项目（如未初始化）

```bash
# 在项目根目录执行
supabase init
```

### 步骤四：链接到 Supabase 项目

```bash
supabase link --project-ref <your-project-ref>
```

`<your-project-ref>` 可以在 Supabase Dashboard 的 URL 中找到：
`https://app.supabase.com/project/<project-ref>`

### 步骤五：部署 Edge Function

```bash
supabase functions deploy send-email
```

### 步骤六：配置环境变量（可选）

如果使用 Resend API，需要设置环境变量：

```bash
supabase secrets set RESEND_API_KEY=your_resend_api_key
```

### 步骤七：测试部署

部署完成后，可以在 Supabase Dashboard 中测试：

1. 进入 Supabase Dashboard
2. 点击左侧菜单 "Edge Functions"
3. 选择 "send-email" 函数
4. 点击 "Invoke" 进行测试

### 邮件发送流程

部署完成后，邮件发送流程如下：

1. 用户在管理员后台配置 SMTP 信息
2. 点击"发送测试"按钮
3. 前端调用 `supabase.functions.invoke('send-email', ...)`
4. Edge Function 使用配置的 SMTP 信息发送邮件
5. 返回发送结果

### 支持的邮件服务商

#### Gmail
- SMTP Host: smtp.gmail.com
- Port: 587
- Username: 您的 Gmail 地址
- Password: 应用专用密码（不是登录密码）
- SSL: 是

#### QQ邮箱
- SMTP Host: smtp.qq.com
- Port: 465
- Username: 您的 QQ 邮箱地址
- Password: 授权码（不是登录密码）
- SSL: 是

#### 163邮箱
- SMTP Host: smtp.163.com
- Port: 465
- Username: 您的 163 邮箱地址
- Password: 授权码（不是登录密码）
- SSL: 是

#### Outlook
- SMTP Host: smtp.office365.com
- Port: 587
- Username: 您的 Outlook 邮箱地址
- Password: 您的密码
- SSL: 是

### 故障排除

#### 1. 部署失败
```bash
# 检查 CLI 版本
supabase --version

# 重新登录
supabase login

# 重新链接项目
supabase link --project-ref <your-project-ref>
```

#### 2. 邮件发送失败
- 检查 SMTP 配置是否正确
- 确认邮箱授权码/密码正确
- 查看 Edge Function 日志：Supabase Dashboard -> Edge Functions -> send-email -> Logs

#### 3. CORS 错误
Edge Function 已配置 CORS 支持，如果仍有问题，请检查：
- 请求的 Origin 是否正确
- 是否携带了正确的 Authorization header

### 替代方案

如果 Edge Function 部署困难，可以使用以下替代方案：

#### 方案 A：Resend API（推荐）
1. 注册 https://resend.com
2. 获取 API Key
3. 执行 `003_edge_function_send_email.sql` 脚本
4. 在 Supabase Dashboard 启用 `pg_net` 扩展
5. 配置 API Key

#### 方案 B：第三方邮件服务
- SendGrid: https://sendgrid.com
- Mailgun: https://mailgun.com
- AWS SES: https://aws.amazon.com/ses

### 安全提示

1. 不要在代码中硬编码邮箱密码
2. 使用应用专用密码或授权码
3. 定期更换邮箱授权码
4. 启用邮箱的两步验证

### 参考文档

- [Supabase Edge Functions 文档](https://supabase.com/docs/guides/functions)
- [Deno SMTP Client](https://deno.land/x/denomailer)
- [Resend API 文档](https://resend.com/docs)
