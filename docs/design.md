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

### 2.3 语音叫号播报系统 (Voice Announcement System)

#### 2.3.1 系统架构
监控大屏 (`WebMonitor.tsx`) 作为语音播报中枢，接收来自多渠道的触发事件：

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   客户签到       │     │  理发师完成      │     │  呼叫下一位      │
│  (Supabase RT)   │     │  (Supabase RT)   │     │ (BroadcastChannel│
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                    ┌─────────────────────┐
                    │   全局播报队列        │
                    │ globalAnnouncement  │
                    │     QueueRef        │
                    └──────────┬──────────┘
                               ▼
                    ┌─────────────────────┐
                    │   顺序播报处理器      │
                    │  processGlobalQueue │
                    │   (防重叠机制)       │
                    └──────────┬──────────┘
                               ▼
                    ┌─────────────────────┐
                    │  科大讯飞 TTS 引擎     │
                    │   发音人: 聆小旋      │
                    │  (大气宣传片风格)      │
                    └─────────────────────┘
```

#### 2.3.2 触发规则矩阵

| 触发源 | 触发条件 | 行为 | 日志标记 |
|--------|----------|------|----------|
| 客户签到 | 理发师空闲 (`!currentServingRef[barber]`) | 立即加入全局队列播报 | `[空闲叫号]` |
| 客户签到 | 理发师忙碌 | 加入理发师私有队列，等待 | `[加入队列]` |
| 服务完成 | `status: completed` | 延迟2秒后触发队列播报 | `[完成播报]` |
| 主动呼叫 | 点击"呼叫下一位"按钮 | 立即加入全局队列播报 | `[呼叫下一位]` |

#### 2.3.3 全局队列管理
- **数据结构**: `Array<{ barberName: string; appt: Appointment; source: TriggerSource }>`
- **防重叠机制**: `isProcessingAnnouncementRef` 原子锁，确保单条播报完成前不处理下一条
- **间隔控制**: 连续播报间隔 500ms，确保语音清晰可辨
- **去重策略**: 
  - 内存去重: `announcedIdsRef` (Set)
  - 持久化去重: `sessionStorage` (页面刷新后保持)

#### 2.3.4 跨页面通信
理发师工作台与监控屏通过 `BroadcastChannel` API 实现跨标签页通信：

```typescript
// Workbench.tsx 发送
const broadcast = new BroadcastChannel('barberbook_call_next');
broadcast.postMessage({ barberName: currentUser.name });

// WebMonitor.tsx 接收
const broadcastChannel = new BroadcastChannel('barberbook_call_next');
broadcastChannel.onmessage = (event) => {
    const { barberName } = event.data;
    processBarberQueue(barberName, 'call_next');
};
```

#### 2.3.5 TTS 引擎配置
系统采用 **科大讯飞 (iFLYTEK) 云语音合成** 作为播报引擎：

| 配置项 | 值 | 说明 |
|--------|-----|------|
| **发音人** | `xiaoxuan` (聆小旋) | 大气宣传片风格女声，音质饱满专业 |
| **音频格式** | PCM 16kHz | 高保真音质，适合商业场所 |
| **调用方式** | Supabase Edge Function | 解决浏览器 CORS 和签名安全问题 |
| **代理链路** | Vite Dev Proxy → Edge Function → 讯飞 API | 三级转发确保稳定性 |

**备选降级**: 如讯飞服务不可用，系统自动降级至浏览器原生 `speechSynthesis`

#### 2.3.6 状态持久化
已播报记录使用 `sessionStorage` 持久化，防止以下场景导致重复播报：
- 用户误刷新监控页面
- WebSocket 重连后的数据同步
- 多标签页同时打开监控屏

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
