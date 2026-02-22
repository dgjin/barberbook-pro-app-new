# BarberBook Pro 安全指南

> ⚠️ **重要提示**: 本文档包含关键的安全配置信息，请仔细阅读。

---

## 🔐 API 密钥管理

### 1. 环境变量配置

所有敏感信息（API 密钥、密码等）都必须存储在环境变量中，**切勿硬编码到源代码中**。

#### 支持的配置文件

| 文件 | 用途 | 是否提交到 Git |
|------|------|---------------|
| `.env.local` | 本地开发环境 | ❌ 否 |
| `.env.production` | 生产环境 | ❌ 否 |
| `.env.example` | 配置模板示例 | ✅ 是 |

#### 配置步骤

1. **复制模板文件**:
   ```bash
   cp .env.example .env.local
   ```

2. **填写您的 API 密钥**:
   ```bash
   # 编辑 .env.local
   GEMINI_API_KEY=your_actual_api_key_here
   ```

3. **验证配置**:
   ```bash
   npm run dev
   # 检查控制台是否有 "API Key 未配置" 的警告
   ```

---

## 🛡️ 安全最佳实践

### 1. 密钥保护

- ✅ **定期轮换密钥**：建议每 90 天更换一次 API 密钥
- ✅ **使用不同环境的密钥**：开发、测试、生产环境使用不同的密钥
- ✅ **限制密钥权限**：为 API 密钥设置最小必要的权限范围
- ✅ **监控使用情况**：定期检查 API 使用量，发现异常及时处理

### 2. 代码安全

- ❌ **永远不要这样做**:
  ```typescript
  // 危险！密钥会暴露在客户端代码中
  const API_KEY = "AIzaSyD..."; 
  ```

- ✅ **正确做法**:
  ```typescript
  // 从环境变量读取
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  ```

### 3. 生产环境额外措施

1. **使用密钥管理服务**:
   - AWS Secrets Manager
   - Azure Key Vault
   - Google Cloud Secret Manager

2. **启用 API 密钥限制**:
   - 限制 IP 地址范围
   - 限制 HTTP Referer
   - 设置使用配额

3. **启用审计日志**:
   - 记录所有 API 调用
   - 监控异常访问模式

---

## 🚨 应急响应

### 如果密钥泄露了怎么办？

**立即执行以下步骤**:

1. **撤销密钥** (1分钟内):
   - Google AI Studio: https://aistudio.google.com/app/apikey
   - 找到泄露的密钥并点击删除/撤销

2. **生成新密钥** (2分钟内):
   - 在同一页面生成新的 API 密钥

3. **更新配置** (5分钟内):
   ```bash
   # 更新 .env.local
   GEMINI_API_KEY=your_new_api_key
   ```

4. **重启服务** (1分钟内):
   ```bash
   npm run dev  # 或 pm2 restart / docker restart
   ```

5. **检查日志** (30分钟内):
   - 查看是否有异常 API 调用
   - 确认服务正常运行

---

## 🔍 安全检查清单

在提交代码前，请确认以下事项：

- [ ] `.env.local` 文件已添加到 `.gitignore`
- [ ] 没有在任何文件中硬编码 API 密钥
- [ ] 日志中不包含敏感信息
- [ ] 错误提示不泄露密钥信息
- [ ] 仅使用 `import.meta.env` 或 `process.env` 访问环境变量

### 自动检查脚本

```bash
# 检查是否有可能泄露的密钥
grep -r "AIzaSy" src/ --include="*.ts" --include="*.tsx" && echo "⚠️ 发现可能的密钥泄露！"

# 检查 .env 文件是否被跟踪
git ls-files | grep -E "^\.env" && echo "⚠️ 发现 .env 文件被 Git 跟踪！"
```

---

## 📞 获取帮助

如果遇到安全问题或发现潜在漏洞，请立即：

1. **撤销相关密钥**
2. **联系项目维护者**
3. **提交安全报告** (如适用)

---

## 📚 参考资源

- [Google AI Studio - API 密钥管理](https://aistudio.google.com/app/apikey)
- [Vite 环境变量文档](https://vitejs.dev/guide/env-and-mode.html)
- [OWASP 密钥管理最佳实践](https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html)

---

**最后更新**: 2026-02-21  
**版本**: 1.0.0
