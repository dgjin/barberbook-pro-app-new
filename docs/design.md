# BarberBook Pro 系统设计说明书 (SDD)

## 1. 技术栈整体架构
本项目采用 **B/A/S (Browser/Agent/Serverless)** 架构，各层角色如下：
- **前端 (Frontend)**: React 19 + Vite + TailwindCSS (组件库级实现)。
- **后端 (Backend-as-a-Service)**: Supabase (PostgreSQL + Realtime + Edge Functions)。
- **外部能力**: 科大讯飞星火 TTS (语音播报) + 极速预约二维码服务。

## 2. 核心架构设计

### 2.1 实时叫号协议 (Realtime Engine)
系统采用双轨并行驱动：
1. **WebSocket (Primary)**: 通过 `supabase.channel()` 订阅 `app_appointments` 表的 `UPDATE` 事件。
2. **Polling (Fallback)**: 针对移动网络下 WebSocket 易断连的问题，前端内置 5 秒/次的增量拉取机制。自愈逻辑如下：
   - 监听 `announcedIdsRef` 记录，确保两者在切换时不会产生重复播报。

### 2.2 TTS 链路设计 (Audio Infrastructure)
为解决中国地域性 API 访问不稳定及浏览器 CORS 限制，设计了三级转发机制：
1. **Vite Local Proxy**: 开发环境下，Vite 代理拦截 `/api/xfyun-tts` 请求。
2. **Supabase Edge Function**: 云端代理处理讯飞 WebSocket 鉴权、签名与 PCM/WAV 转换。
3. **Audio Context Pipeline**: 前端使用 `AudioContext` 配合原生 WAV 解码器输出 16kHz 音效，规避传统 `<audio>` 标签在处理流数据时的随机卡顿。

## 3. 数据库模型与性能优化 (Schema & Performance)

### 3.1 核心表设计 (app_appointments)
这是系统流量最大的表，我们针对其查询模式进行了深度优化：
- **idx_appointments_monitor**: 联合索引 `(date_str, status)`，加速大屏的筛选性能。
- **idx_appointments_barber_queue**: 联合索引 `(barber_name, date_str)`，提升个人工作台加载速度。

### 3.2 完整脚本
所有表结构、索引及 RLS 策略已整合至单文件：
- **脚本位置**: `docs/init_db.sql` (包含 7 张核心表及 6 组高性能索引)。

## 4. 前端性能优化方案
- **组件原子化**: 提取 `BarberCard`、`StatItem` 等原子组件并包裹 `React.memo`。
- **计算属性优化**: 使用 `useMemo` 为各理发师预处理队列数据，避免在每秒时钟跳动时执行全局 Filter。
- **渲染加速**: 对于动画密集型组件（如叫号大屏），开启 GPU 硬件加速 (`transform-gpu`)。
