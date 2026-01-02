# Emby 集成使用指南

## 🎉 实现完成

Emby 已经成功集成到 MoonTVPlus 项目中！所有核心功能都已实现并可以使用。

---

## 📋 已实现的功能

### 1. 核心基础设施
- ✅ EmbyConfig 类型定义 (`src/lib/admin.types.ts`)
- ✅ Emby 客户端 (`src/lib/emby.client.ts`)

### 2. API 端点
- ✅ `/api/emby/list` - 媒体列表（分页）
- ✅ `/api/emby/detail` - 媒体详情
- ✅ `/api/emby/cms-proxy/[token]` - CMS API 代理（核心）
- ✅ `/api/admin/emby` - 管理配置

### 3. 前台集成
- ✅ 私人影库页面集成 CapsuleSwitch（OpenList ↔ Emby 切换）
- ✅ 播放页面支持 `source=emby` 参数

### 4. 管理面板
- ✅ Emby 配置区域（服务器地址、API Key、用户名/密码）
- ✅ 连接测试功能
- ✅ 保存配置功能

---

## 🚀 快速开始

### 步骤 1: 配置 Emby

1. 登录管理面板
2. 找到 **"Emby 媒体库"** 配置区域
3. 填写以下信息：
   - **服务器地址**: 你的 Emby 服务器地址（如 `http://192.168.1.100:8096`）
   - **API Key**（推荐）: 在 Emby 设置中生成 API Key
   - 或者填写 **用户名** 和 **密码**
4. 点击 **"测试连接"** 验证配置
5. 点击 **"保存配置"**
6. 启用 **"启用 Emby 媒体库"** 开关

### 步骤 2: 访问私人影库

1. 访问 **"私人影库"** 页面
2. 使用顶部的 **CapsuleSwitch** 切换到 **"Emby"**
3. 浏览你的 Emby 媒体库
4. 点击任意视频即可播放

### 步骤 3: TVBOX 订阅（可选）

如果你启用了 TVBOX 订阅功能，Emby 会自动添加到订阅源中：

**订阅地址格式**:
```
http://your-domain.com/api/emby/cms-proxy/{TVBOX_SUBSCRIBE_TOKEN}
```

在 TVBOX 中添加此订阅源，即可在 TVBOX 中浏览和播放 Emby 媒体库。

---

## 🔧 配置说明

### Emby 服务器地址

- 格式: `http://IP:PORT` 或 `https://domain.com`
- 示例: `http://192.168.1.100:8096`
- 注意: 确保 MoonTVPlus 服务器能够访问 Emby 服务器

### 认证方式

**方式 1: API Key（推荐）**
- 在 Emby 设置中生成 API Key
- 优点: 更安全，不需要存储密码
- 获取方式: Emby 设置 → 高级 → API Keys

**方式 2: 用户名/密码**
- 使用 Emby 用户账号
- 优点: 简单直接
- 注意: 密码会加密存储在数据库中

---

## 📖 功能特性

### 1. 网页播放

- **统一入口**: 私人影库页面
- **无缝切换**: CapsuleSwitch 在 OpenList 和 Emby 之间切换
- **完整支持**: 电影、剧集、季、集
- **自动播放**: 点击即播，无需额外配置

### 2. CMS-Proxy

Emby 的 CMS-Proxy 将 Emby 媒体库转换为苹果 CMS V10 格式，实现：

- ✅ 网页播放复用现有逻辑
- ✅ TVBOX 直接支持
- ✅ 统一接口，降低维护成本
- ✅ 扩展性强，未来可添加 Jellyfin、Plex 等

### 3. 播放链接

**直接播放**（默认）:
```
http://emby-server:8096/Videos/{itemId}/stream?Static=true&api_key={apiKey}
```

**转码播放**（可选）:
```
http://emby-server:8096/Videos/{itemId}/master.m3u8?api_key={apiKey}
```

---

## 🎯 使用场景

### 场景 1: 家庭媒体中心

- 在家中搭建 Emby 服务器
- 使用 MoonTVPlus 作为统一的观影入口
- 在私人影库中浏览和播放 Emby 媒体

### 场景 2: 多源聚合

- OpenList: 云存储媒体
- Emby: 本地媒体服务器
- CMS 源: 在线资源
- 统一在 MoonTVPlus 中管理和播放

### 场景 3: TVBOX 集成

- 在 TVBOX 中添加 Emby 订阅源
- 在电视上浏览和播放 Emby 媒体
- 无需单独安装 Emby 客户端

---

## 🔍 故障排查

### 问题 1: 连接测试失败

**可能原因**:
- Emby 服务器地址错误
- 网络不通（防火墙、端口未开放）
- API Key 或用户名/密码错误

**解决方法**:
1. 检查 Emby 服务器地址是否正确
2. 确保 MoonTVPlus 服务器能够访问 Emby 服务器
3. 验证 API Key 或用户名/密码是否正确
4. 检查 Emby 服务器日志

### 问题 2: 媒体列表为空

**可能原因**:
- Emby 媒体库为空
- 用户权限不足
- 媒体库未扫描完成

**解决方法**:
1. 在 Emby 中检查媒体库是否有内容
2. 确保使用的用户有访问媒体库的权限
3. 等待 Emby 完成媒体库扫描

### 问题 3: 播放失败

**可能原因**:
- 媒体文件损坏
- 网络带宽不足
- 浏览器不支持视频格式

**解决方法**:
1. 在 Emby 客户端中测试播放
2. 检查网络连接
3. 尝试使用其他浏览器
4. 考虑启用转码

---

## 📊 性能优化

### 1. 缓存策略

- 媒体列表缓存: 减少对 Emby 服务器的请求
- 播放链接缓存: 提高播放响应速度

### 2. 网络优化

- 使用本地网络: Emby 服务器和 MoonTVPlus 在同一网络
- 启用转码: 根据网络情况动态调整码率

### 3. 媒体库优化

- 定期清理无效媒体
- 使用 SSD 存储媒体文件
- 优化 Emby 服务器配置

---

## 🔐 安全建议

1. **使用 HTTPS**: 在生产环境中使用 HTTPS 访问 Emby
2. **强密码**: 使用强密码保护 Emby 账号
3. **API Key**: 优先使用 API Key 而不是用户名/密码
4. **防火墙**: 限制 Emby 服务器的访问来源
5. **定期更新**: 保持 Emby 和 MoonTVPlus 更新到最新版本

---

## 🎨 自定义

### 修改播放链接格式

编辑 `src/lib/emby.client.ts` 中的 `getStreamUrl` 方法：

```typescript
getStreamUrl(itemId: string, direct: boolean = true): string {
  if (direct) {
    // 直接播放
    return `${this.serverUrl}/Videos/${itemId}/stream?Static=true&api_key=${this.apiKey}`;
  }
  // 转码播放
  return `${this.serverUrl}/Videos/${itemId}/master.m3u8?api_key=${this.apiKey}&VideoCodec=h264`;
}
```

### 添加媒体库过滤

在 `src/lib/admin.types.ts` 中的 `EmbyConfig` 添加 `Libraries` 字段，然后在 API 中使用：

```typescript
const result = await client.getItems({
  ParentId: config.EmbyConfig.Libraries?.[0], // 指定媒体库
  IncludeItemTypes: 'Movie,Series',
  // ...
});
```

---

## 🚧 已知限制

1. **字幕支持**: 当前版本不支持加载 Emby 字幕（计划中）
2. **转码设置**: 不支持用户自定义转码参数（计划中）
3. **多用户**: 不支持不同用户看到不同的媒体库（计划中）
4. **收藏同步**: 不支持与 Emby 的收藏同步（计划中）

---

## 🔮 未来计划

- [ ] 字幕支持
- [ ] 转码设置
- [ ] 多用户支持
- [ ] 收藏同步
- [ ] 观看历史同步
- [ ] Jellyfin 支持（API 与 Emby 类似）
- [ ] Plex 支持

---

## 📞 支持

如果遇到问题或有建议，请：

1. 查看本文档的故障排查部分
2. 查看 Emby 服务器日志
3. 查看 MoonTVPlus 服务器日志
4. 在 GitHub 上提交 Issue

---

## 🎉 总结

Emby 集成为 MoonTVPlus 带来了强大的本地媒体服务器支持，通过 CMS-Proxy 的设计，实现了：

- ✅ 统一的播放体验
- ✅ TVBOX 无缝集成
- ✅ 代码复用和维护简化
- ✅ 良好的扩展性

享受你的 Emby 媒体库吧！🎬
