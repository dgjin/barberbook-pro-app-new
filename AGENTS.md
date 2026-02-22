# BarberBook Pro - AI Agent Documentation

> **Last Updated**: 2026-02-21  
> **Version**: 1.5.5  
> **Language**: 中文 (Chinese)

---

## 1. Project Overview

BarberBook Pro 是一款基于 AI 驱动的高级理发店综合管理系统。该系统提供从顾客预约、排队叫号到理发师工作台和管理员后台的完整闭环解决方案。

### Core Features
- **顾客端**: 多维预约（理发师/日期/服务）、AI 发型顾问、实时排队、理发券系统
- **理发师工作台**: 数字化排队、扫码签到、智能核销、业绩追踪
- **管理员后台**: 财务看板、人员管理、排班调度、审计日志
- **监控大屏**: 实时叫号显示、语音播报（TTS）、Barber Pole 动画

### Technology Stack
| Layer | Technology |
|-------|------------|
| Frontend Framework | React 19.2.4 + TypeScript 5.8 |
| Build Tool | Vite 6.2 |
| UI Framework | Tailwind CSS (CDN) |
| Icons | Google Material Symbols |
| Database | Supabase (PostgreSQL + Realtime) |
| AI Service | Google Gemini API |
| TTS Engine | 科大讯飞 (iFLYTEK) WebSocket API |
| Fonts | Noto Sans SC, Inter |

---

## 2. Project Structure

```
barberbook-pro-app/
├── index.html              # 入口 HTML，包含 Tailwind CDN 配置
├── index.tsx               # React 应用挂载点
├── App.tsx                 # 根组件，处理路由状态
├── types.ts                # TypeScript 类型定义
├── metadata.json           # 项目元数据
│
├── components/             # 可复用 UI 组件
│   ├── Layout.tsx          # 布局容器 + Header 组件
│   └── BottomNav.tsx       # 底部导航栏（角色自适应）
│
├── pages/                  # 页面组件
│   ├── CustomerHome.tsx    # 顾客首页
│   ├── Booking.tsx         # 预约页面
│   ├── AIChat.tsx          # AI 发型顾问
│   ├── CheckIn.tsx         # 签到/个人中心
│   ├── Login.tsx           # 顾客登录
│   ├── Register.tsx        # 顾客注册
│   ├── Monitor.tsx         # 移动端监控视图
│   ├── WebMonitor.tsx      # 大屏监控（语音叫号）
│   └── admin/              # 管理后台页面
│       ├── Dashboard.tsx   # 财务看板
│       ├── Workbench.tsx   # 理发师工作台
│       ├── Management.tsx  # 人员管理
│       ├── Settings.tsx    # 系统设置
│       └── Logs.tsx        # 审计日志
│
├── services/               # 服务端逻辑
│   ├── supabase.ts         # Supabase 客户端 + Mock 模式
│   ├── geminiService.ts    # Google Gemini AI/TTS
│   ├── xfyunService.ts     # 科大讯飞语音合成
│   └── scheduler.ts        # 定时任务触发器
│
└── doc/                    # 项目文档
    ├── system_introduction.md
    ├── system_design_specification.md
    ├── system_manual.md
    ├── db_schema.sql
    └── changelog.md
```

---

## 3. Build and Development

### Prerequisites
- Node.js (LTS version recommended)
- npm

### Environment Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   ```bash
   # Copy and edit .env.local
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. **Run development server**:
   ```bash
   npm run dev
   ```
   - Server starts at `http://localhost:3000`
   - Host is set to `0.0.0.0` for network access

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server on port 3000 |
| `npm run build` | Build for production (output to `dist/`) |
| `npm run preview` | Preview production build locally |

---

## 4. Architecture Details

### Routing Architecture
本项目不使用传统路由库（如 React Router），而是采用 **State-based Routing**：

```typescript
// App.tsx 中的路由状态管理
const [currentRoute, setCurrentRoute] = useState<PageRoute>('launcher');

// 路由通过 renderPage() 函数进行条件渲染
switch (currentRoute) {
  case 'home': return <CustomerHome ... />;
  case 'booking': return <Booking ... />;
  // ...
}
```

**PageRoute 类型定义** (in `types.ts`):
- `'launcher'` - 启动页/角色选择
- `'login'`, `'register'` - 认证
- `'home'`, `'booking'`, `'ai_chat'`, `'check_in'` - 顾客端
- `'monitor'`, `'web_monitor'` - 监控视图
- `'admin_dashboard'`, `'admin_workbench'`, `'admin_management'`, `'admin_settings'`, `'admin_logs'` - 管理端

### Data Flow
1. **Supabase Realtime**: 所有数据变更通过 PostgreSQL `LISTEN/NOTIFY` 实时同步
2. **State Management**: 使用 React `useState` 和 `useEffect`，无 Redux/MobX
3. **Mock Mode**: 当 Supabase 凭证无效时，自动降级为内存 Mock 数据库

### User Roles
```typescript
type UserRole = 'customer' | 'barber' | 'admin';
```

每个角色的导航菜单不同（见 `BottomNav.tsx`）。

---

## 5. Database Schema

使用 **Supabase (PostgreSQL)**，主要数据表：

| Table | Purpose |
|-------|---------|
| `app_barbers` | 理发师信息、排班、业绩 |
| `app_customers` | 顾客账户、理发券余额 |
| `app_appointments` | 预约记录、状态追踪 |
| `app_services` | 服务项目、价格、时长 |
| `app_ratings` | 评价数据（多维度）|
| `app_settings` | 系统配置（JSONB）|
| `app_logs` | 审计日志 |

### Key Features
- **RLS (Row Level Security)**: 已启用，但当前策略为开放（`USING (true)`）
- **Real-time**: 监听 `postgres_changes` 事件实现即时更新
- **Voucher System**: `app_customers.vouchers` + `app_appointments.used_voucher` 闭环

完整 Schema 见 `doc/db_schema.sql`。

---

## 6. External Services Integration

### Google Gemini
**文件**: `services/geminiService.ts`

- **AI Chat**: `gemini-3-flash-preview` 模型
- **TTS**: `gemini-2.5-flash-preview-tts` (语音叫号备选)

**环境变量**:
```
GEMINI_API_KEY=your_key_here
```

### 科大讯飞 (iFLYTEK)
**文件**: `services/xfyunService.ts`

- **Primary TTS**: WebSocket 连接 `wss://tts-api.xfyun.cn/v2/tts`
- **Voice**: 小燕 (xiaoyan), 16kHz PCM
- **Auth**: HMAC-SHA256 签名

**环境变量**:
```
XFYUN_APPID=your_app_id
XFYUN_API_KEY=your_api_key
XFYUN_API_SECRET=your_api_secret
```

### Supabase
**文件**: `services/supabase.ts`

- **Connection**: 支持从 `localStorage` 或环境变量读取配置
- **Fallback**: 内置 Mock Client，无需配置即可运行演示

---

## 7. Code Style Guidelines

### TypeScript Conventions
- 使用严格类型定义，避免 `any`
- 接口名使用 PascalCase: `interface Appointment { ... }`
- 类型定义集中在 `types.ts`

### Component Structure
```typescript
// Props 接口命名
interface ComponentNameProps {
  onNavigate: (route: PageRoute) => void;
  currentUser?: User | null;
}

// 函数组件声明
export const ComponentName: React.FC<ComponentNameProps> = ({ onNavigate, currentUser }) => {
  // ...
};
```

### Tailwind CSS Classes
- 使用自定义颜色主题:
  - `bg-bg-main` (#F2F2F7) - 主背景
  - `text-primary` (#007AFF) - 品牌色
  - `text-text-main` (#1C1C1E) - 主文字
- iOS 风格类名:
  - `ios-blur` - 毛玻璃效果
  - `rounded-3xl` - 大圆角

### Path Alias
```typescript
// 使用 @/* 别名指向项目根目录
import { Layout } from '../components/Layout';  // 相对路径
import { supabase } from '@/services/supabase'; // 别名路径（推荐）
```

---

## 8. Development Notes

### Mock Mode
当 Supabase 凭证无效时，系统自动进入 Mock 模式：
- 所有数据库操作在内存中完成
- 支持实时事件模拟（`mockSubscribers`）
- 包含演示数据：3位理发师、1位顾客、示例预约

### TTS 降级策略
1. **首选**: 科大讯飞 WebSocket API（中文优化）
2. **备选**: Gemini TTS（英文优化）
3. **兜底**: 浏览器原生 `speechSynthesis` API

### Real-time Subscriptions
记得在组件卸载时清理订阅：
```typescript
useEffect(() => {
  const channel = supabase.channel('unique_channel_name')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'app_appointments' }, callback)
    .subscribe();
  
  return () => { supabase.removeChannel(channel); };
}, []);
```

---

## 9. Security Considerations

- **API Keys**: 存储在 `.env.local`，通过 Vite `define` 注入
- **Client-side**: 当前 RLS 策略为开放，生产环境应收紧
- **Passwords**: 使用 SHA256 哈希存储（演示模式）
- **TTS WebSocket**: 使用 HMAC-SHA256 签名验证

---

## 10. Testing

本项目 **无单元测试框架**。测试方式：
- **Mock Mode**: 无需配置即可本地运行全部功能
- **手动测试**: 使用演示账号 `13888888888 / 123456`
- **角色切换**: Launcher 页可快速切换 customer/barber/admin 角色

---

## 11. Deployment

### Build Output
```bash
npm run build
```
生成 `dist/` 目录，包含：
- 静态资源（JS/CSS）
- `index.html`

### Environment Variables
部署时需设置：
- `GEMINI_API_KEY` - AI 功能必需
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` - 数据持久化必需

### CDN Dependencies
以下资源通过 CDN 加载，无需打包：
- Tailwind CSS
- Google Fonts (Noto Sans SC, Material Symbols)
- ESM modules (通过 importmap)

---

## 12. Common Tasks

### Adding a New Page
1. 在 `types.ts` 中扩展 `PageRoute` 类型
2. 在 `pages/` 创建组件
3. 在 `App.tsx` 的 `renderPage()` 中添加 case
4. 在 `BottomNav.tsx` 中添加导航项（如需要）

### Modifying Database Schema
1. 编辑 `doc/db_schema.sql`
2. 在 Supabase Dashboard 执行 SQL
3. 更新 `types.ts` 中的对应类型
4. 更新 `services/supabase.ts` 中的 Mock 数据

### Adding a New Service Integration
1. 在 `services/` 创建服务文件
2. 如需环境变量，更新 `.env` 和 `vite.config.ts`
3. 在组件中通过 hooks 调用

---

## 13. Troubleshooting

| Issue | Solution |
|-------|----------|
| `GEMINI_API_KEY is missing` | 检查 `.env.local` 文件是否存在于项目根目录 |
| Supabase 连接失败 | 系统自动降级为 Mock Mode，查看 Console 确认 |
| 语音播报无声音 | WebMonitor 页面点击"手动激活"按钮初始化 AudioContext |
| 样式丢失 | 确保网络可访问 `cdn.tailwindcss.com` |
| TypeScript 路径别名错误 | 检查 `tsconfig.json` 中的 `paths` 配置 |

---

## 14. References

- [Google Gemini API Docs](https://ai.google.dev/)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/)
- [iFLYTEK TTS API](https://www.xfyun.cn/doc/tts/online_tts/API.html)
- [Vite Configuration](https://vitejs.dev/config/)
- [Tailwind CSS](https://tailwindcss.com/docs)
