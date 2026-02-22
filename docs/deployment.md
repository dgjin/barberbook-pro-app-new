# BarberBook Pro 系统部署手册 (Ops)

## 1. 环境准备
- **操作系统**: macOS / Linux / Windows
- **运行时**: Node.js 18+
- **工具链**: npm / npx, Supabase CLI

## 2. 核心服务初始化

### 2.1 数据库架构
执行 SQL 迁移以初始化表结构：
```bash
# 进入 Supabase 控制台执行 SQL 或使用 CLI
supabase migration up
```

### 2.2 环境变量配置 (.env.local)
在根目录下创建 `.env.local` 文件，填入：
```env
VITE_SUPABASE_URL=你的项目URL
VITE_SUPABASE_ANON_KEY=你的项目公钥
```

## 3. TTS 云函数部署 (重要)
叫号播报依赖云端签名，需执行以下步骤：

1. **设置 API Secret**:
```bash
supabase secrets set XFYUN_APP_ID=xxx XFYUN_API_KEY=xxx XFYUN_API_SECRET=xxx
```

2. **部署函数**:
```bash
npx supabase functions deploy xfyun-tts --no-verify-jwt --project-ref 你的项目ID
```

## 4. 离线开发与本地代理
为了在开发时规避浏览器对非安全上下文的 AudioContext 限制，已集成 Vite 代理。

**运行开发服务器**:
```bash
# 强制使用 3000 端口以获得 Web Audio API 最高权限
npm run dev -- --port 3000
```

## 5. 大屏挂载指南
- 访问：`http://localhost:3000/monitor` (或对应的部署地址)。
- **注意**：首次打开大屏需点击“开启系统叫号”按钮，以激活浏览器的音频播放限制（Autoplay Policy）。
