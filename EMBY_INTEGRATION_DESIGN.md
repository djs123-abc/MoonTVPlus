# Emby 集成设计方案

## 一、可行性分析

### 1.1 Emby vs OpenList 对比

#### 相似点
| 特性 | OpenList | Emby |
|------|----------|------|
| 服务类型 | 外部 API 服务 | 外部 API 服务 |
| 认证方式 | 用户名/密码 + Token | API Key 或用户名/密码 |
| 媒体列表 | ✅ 提供 | ✅ 提供 |
| 播放链接 | ✅ 提供 | ✅ 提供 |
| 元数据 | 需自行获取 | ✅ 内置完整元数据 |

#### 关键差异
| 维度 | OpenList | Emby |
|------|----------|------|
| **元数据来源** | 项目通过 TMDB API 获取 | Emby 自带（已从 TMDB/TVDB 获取） |
| **API 结构** | 文件系统 API | 媒体库 API |
| **组织方式** | 文件夹结构 | 媒体库（Movies/TV Shows） |
| **播放链接** | 云存储直链 | 流媒体 URL（支持转码） |
| **复杂度** | 需要文件名解析 + TMDB 查询 | 直接使用 Emby 元数据 |

### 1.2 可行性结论

**✅ 完全可行！** Emby 的集成甚至比 OpenList 更简单，因为：
- Emby 自带完整元数据系统
- API 更加成熟和标准化
- 不需要复杂的文件名解析和 TMDB 查询
- 媒体已经按照标准格式组织

---

## 二、CMS-Proxy 实现方案

### 2.1 为什么使用 CMS-Proxy

项目本身是聚合 CMS API 的（苹果 CMS V10 格式），使用 CMS-Proxy 的优势：

1. **网页播放**：复用现有播放逻辑，无需单独开发
2. **TVBOX 支持**：直接支持，无需额外适配
3. **代码复用**：统一接口，降低维护成本
4. **扩展性强**：未来添加其他源（如 Jellyfin）只需实现 cms-proxy

### 2.2 CMS API 格式要求

```json
{
  "code": 1,
  "msg": "数据列表",
  "page": 1,
  "pagecount": 1,
  "limit": 20,
  "total": 100,
  "list": [
    {
      "vod_id": "唯一ID",
      "vod_name": "视频名称",
      "vod_pic": "海报URL",
      "vod_remarks": "备注（如'电影'/'剧集'）",
      "vod_year": "年份",
      "vod_content": "简介",
      "vod_play_from": "播放源名称",
      "vod_play_url": "第1集$url1#第2集$url2#第3集$url3",
      "type_name": "类型"
    }
  ]
}
```

### 2.3 Emby 数据映射

```typescript
// Emby Item → CMS Format
{
  vod_id: item.Id,
  vod_name: item.Name,
  vod_pic: `${embyUrl}/Items/${item.Id}/Images/Primary`,
  vod_remarks: item.Type === 'Movie' ? '电影' : '剧集',
  vod_year: item.ProductionYear?.toString() || '',
  vod_content: item.Overview || '',
  vod_play_from: 'Emby',
  vod_play_url: buildPlayUrl(item),
  type_name: item.Type === 'Movie' ? '电影' : '电视剧'
}
```

### 2.4 核心实现

#### 路由结构
```
/api/emby/cms-proxy/[token]?ac=videolist&wd=关键词
/api/emby/cms-proxy/[token]?ac=detail&ids=视频ID
```

#### 关键逻辑

**1. 搜索/列表**
```typescript
async function handleSearch(client: EmbyClient, query: string) {
  const items = await client.getItems({
    searchTerm: query,
    IncludeItemTypes: 'Movie,Series',
    Recursive: true,
    Fields: 'Overview,ProductionYear',
    Limit: 100
  });

  return items.map(item => ({
    vod_id: item.Id,
    vod_name: item.Name,
    vod_pic: getEmbyImageUrl(item.Id),
    vod_remarks: item.Type === 'Movie' ? '电影' : '剧集',
    vod_year: item.ProductionYear?.toString() || '',
    vod_content: item.Overview || '',
    type_name: item.Type === 'Movie' ? '电影' : '电视剧'
  }));
}
```

**2. 详情（关键）**
```typescript
async function handleDetail(client: EmbyClient, itemId: string) {
  const item = await client.getItem(itemId);

  let vodPlayUrl = '';

  if (item.Type === 'Movie') {
    // 电影：单个播放链接
    const playUrl = buildPlayUrl(client, itemId);
    vodPlayUrl = `正片$${playUrl}`;
  } else if (item.Type === 'Series') {
    // 剧集：获取所有季和集
    const episodes = await getAllEpisodes(client, itemId);
    vodPlayUrl = episodes
      .map(ep => `第${ep.IndexNumber}集$${buildPlayUrl(client, ep.Id)}`)
      .join('#');
  }

  return {
    vod_id: item.Id,
    vod_name: item.Name,
    vod_play_url: vodPlayUrl,
    vod_play_from: 'Emby',
    // ... 其他字段
  };
}
```

**3. 播放链接构建**
```typescript
function buildPlayUrl(client: EmbyClient, itemId: string): string {
  // 方案 1: 直接返回 Emby 流媒体链接（推荐）
  return `${client.serverUrl}/Videos/${itemId}/stream?api_key=${client.apiKey}&Static=true`;

  // 方案 2: 通过项目代理（支持去广告等功能）
  const baseUrl = process.env.SITE_BASE;
  const token = process.env.TVBOX_SUBSCRIBE_TOKEN;
  return `${baseUrl}/api/emby/play/${token}?id=${itemId}`;
}
```

---

## 三、前台页面集成方案

### 3.1 设计思路

将 Emby 集成到现有的"私人影库"页面，使用 **CapsuleSwitch** 组件切换 OpenList 和 Emby。

**优势：**
- 统一入口，用户体验更好
- 复用现有 UI 组件（VideoCard、分页等）
- 代码更简洁，维护成本低

### 3.2 页面结构

```
┌─────────────────────────────────────────┐
│           私人影库                       │
│   观看自我收藏的高清视频吧                │
├─────────────────────────────────────────┤
│                                         │
│    ┌─────────────────────────┐         │
│    │ OpenList  │  Emby       │  ← CapsuleSwitch
│    └─────────────────────────┘         │
│                                         │
├─────────────────────────────────────────┤
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐       │
│  │   │ │   │ │   │ │   │ │   │       │
│  └───┘ └───┘ └───┘ └───┘ └───┘       │
│                                         │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐       │
│  │   │ │   │ │   │ │   │ │   │       │
│  └───┘ └───┘ └───┘ └───┘ └───┘       │
│                                         │
├─────────────────────────────────────────┤
│     上一页    第 1 / 5 页    下一页     │
└─────────────────────────────────────────┘
```

### 3.3 核心代码

```typescript
// src/app/private-library/page.tsx

'use client';

import { useState, useEffect } from 'react';
import CapsuleSwitch from '@/components/CapsuleSwitch';
import VideoCard from '@/components/VideoCard';

type LibrarySource = 'openlist' | 'emby';

export default function PrivateLibraryPage() {
  const [source, setSource] = useState<LibrarySource>('openlist');
  const [videos, setVideos] = useState([]);
  const [page, setPage] = useState(1);

  // 切换源时重置页码
  useEffect(() => {
    setPage(1);
  }, [source]);

  useEffect(() => {
    const endpoint = source === 'openlist'
      ? `/api/openlist/list?page=${page}`
      : `/api/emby/list?page=${page}`;

    fetch(endpoint).then(res => res.json()).then(setVideos);
  }, [page, source]);

  return (
    <div>
      <h1>私人影库</h1>

      {/* 源切换器 */}
      <CapsuleSwitch
        options={[
          { label: 'OpenList', value: 'openlist' },
          { label: 'Emby', value: 'emby' }
        ]}
        active={source}
        onChange={(value) => setSource(value as LibrarySource)}
      />

      {/* 视频网格 */}
      <div className="grid">
        {videos.map(video => (
          <VideoCard key={video.id} {...video} source={source} />
        ))}
      </div>

      {/* 分页 */}
    </div>
  );
}
```

---

## 四、完整实现步骤

### Phase 1: 基础设施

#### 1. 配置类型定义
```typescript
// src/lib/admin.types.ts

interface EmbyConfig {
  Enabled: boolean
  ServerURL: string              // Emby 服务器地址
  ApiKey?: string                // API Key（推荐）
  Username?: string              // 或使用用户名/密码
  Password?: string
  UserId?: string                // 用户 ID
  Libraries?: string[]           // 要显示的媒体库 ID
  EnableTranscoding?: boolean    // 是否启用转码
  MaxBitrate?: number            // 最大码率
  LastSyncTime?: number
  ItemCount?: number
}
```

#### 2. Emby 客户端
```typescript
// src/lib/emby.client.ts

export class EmbyClient {
  private serverUrl: string
  private apiKey?: string
  private userId?: string

  constructor(config: EmbyConfig) {
    this.serverUrl = config.ServerURL.replace(/\/$/, '')
    this.apiKey = config.ApiKey
    this.userId = config.UserId
  }

  // 核心方法
  async authenticate(username: string, password: string): Promise<AuthResult>
  async getLibraries(): Promise<Library[]>
  async getItems(params: GetItemsParams): Promise<ItemsResult>
  async getItem(itemId: string): Promise<EmbyItem>
  async getSeasons(seriesId: string): Promise<Season[]>
  async getEpisodes(seriesId: string, seasonId: string): Promise<Episode[]>
  async checkConnectivity(): Promise<boolean>
}
```

### Phase 2: API 端点

#### 1. CMS-Proxy（核心）
```
src/app/api/emby/cms-proxy/[token]/route.ts
```
- 支持搜索：`?ac=videolist&wd=关键词`
- 支持详情：`?ac=detail&ids=视频ID`
- 支持列表：`?ac=videolist`
- 返回苹果 CMS V10 格式

#### 2. 列表 API
```
src/app/api/emby/list/route.ts
```
- 用于前台页面显示
- 支持分页
- 返回格式与 OpenList 一致

#### 3. 详情 API
```
src/app/api/emby/detail/route.ts
```
- 获取媒体详情
- 获取剧集列表
- 返回播放链接

#### 4. 播放代理（可选）
```
src/app/api/emby/play/[token]/route.ts
```
- 代理播放请求
- 支持去广告等功能

#### 5. 管理 API
```
src/app/api/admin/emby/route.ts
```
- 保存/更新 Emby 配置
- 测试连接
- 同步媒体库

### Phase 3: 前台集成

#### 1. 修改私人影库页面
```
src/app/private-library/page.tsx
```
- 添加 CapsuleSwitch 组件
- 支持切换 OpenList/Emby
- 复用现有 VideoCard 和分页逻辑

#### 2. 修改播放页面
```
src/app/play/page.tsx
```
- 支持 `source=emby` 参数
- 处理 Emby 播放链接

#### 3. 管理面板集成
```
src/app/admin/page.tsx
```
- 添加 Emby 配置区域
- 连接测试
- 媒体库同步

#### 4. 导航集成
```
src/components/Sidebar.tsx
```
- 保持"私人影库"入口不变
- 内部通过 CapsuleSwitch 切换

### Phase 4: TVBOX 集成

#### 修改订阅接口
```typescript
// src/app/api/tvbox/subscribe/[token]/route.ts

const sites = [
  // 现有的 CMS 站点
  ...existingSites,

  // 添加 OpenList
  {
    key: 'openlist',
    name: '私人影库-OpenList',
    type: 1,
    api: `${baseUrl}/api/cms-proxy?api=openlist`,
    searchable: 1
  },

  // 添加 Emby
  {
    key: 'emby',
    name: '私人影库-Emby',
    type: 1,
    api: `${baseUrl}/api/emby/cms-proxy/${token}`,
    searchable: 1
  }
];
```

---

## 五、文件结构

```
src/
├── app/
│   ├── api/
│   │   ├── admin/
│   │   │   └── emby/
│   │   │       └── route.ts          # Emby 配置管理
│   │   └── emby/
│   │       ├── cms-proxy/
│   │       │   └── [token]/
│   │       │       └── route.ts      # CMS API 代理（核心）
│   │       ├── list/
│   │       │   └── route.ts          # 媒体列表
│   │       ├── detail/
│   │       │   └── route.ts          # 媒体详情
│   │       └── play/
│   │           └── [token]/
│   │               └── route.ts      # 播放代理（可选）
│   ├── private-library/
│   │   └── page.tsx                  # 私人影库页面（集成 CapsuleSwitch）
│   └── admin/
│       └── page.tsx                  # 管理面板（添加 Emby 配置）
├── lib/
│   ├── emby.client.ts                # Emby API 客户端
│   ├── emby-adapter.ts               # 数据适配器
│   ├── emby-cache.ts                 # 缓存层（可选）
│   └── admin.types.ts                # 类型定义（添加 EmbyConfig）
└── components/
    ├── CapsuleSwitch.tsx             # 切换组件（已存在）
    └── VideoCard.tsx                 # 视频卡片（已存在）
```

---

## 六、关键技术点

### 6.1 Emby API 认证

```typescript
// 方式 1: API Key（推荐）
const headers = {
  'X-Emby-Token': apiKey
}

// 方式 2: 用户认证
const authResponse = await fetch(`${serverUrl}/Users/AuthenticateByName`, {
  method: 'POST',
  body: JSON.stringify({ Username: username, Pw: password })
});
const { AccessToken, User } = await authResponse.json();
```

### 6.2 获取媒体列表

```typescript
// GET /Users/{userId}/Items
const params = new URLSearchParams({
  ParentId: libraryId,
  IncludeItemTypes: 'Movie,Series',
  Recursive: 'true',
  Fields: 'Overview,ProductionYear',
  StartIndex: '0',
  Limit: '20'
});
```

### 6.3 获取播放链接

```typescript
// 直接播放（无转码）
const playUrl = `${serverUrl}/Videos/${itemId}/stream?api_key=${apiKey}&Static=true`;

// 转码播放
const playUrl = `${serverUrl}/Videos/${itemId}/master.m3u8?api_key=${apiKey}&VideoCodec=h264`;
```

### 6.4 获取剧集

```typescript
// 获取季列表
const seasons = await fetch(`${serverUrl}/Shows/${seriesId}/Seasons?userId=${userId}`);

// 获取某季的所有集
const episodes = await fetch(`${serverUrl}/Shows/${seriesId}/Episodes?seasonId=${seasonId}`);
```

---

## 七、优势总结

### 7.1 相比传统方式

| 特性 | 传统方式 | CMS-Proxy 方式 |
|------|---------|---------------|
| **网页播放** | 需要单独开发 Emby 播放页面 | 复用现有播放逻辑 |
| **TVBOX 支持** | 需要单独适配 | 直接支持，无需额外开发 |
| **代码复用** | 低 | 高 |
| **维护成本** | 高（两套逻辑） | 低（统一接口） |
| **扩展性** | 每个源都要适配 | 新增源只需实现 cms-proxy |

### 7.2 相比 OpenList

| 维度 | OpenList | Emby |
|------|----------|------|
| **实现复杂度** | 复杂（需要文件名解析 + TMDB 查询） | 简单（直接使用 Emby 元数据） |
| **元数据质量** | 依赖 TMDB API | Emby 自带完整元数据 |
| **播放能力** | 云存储直链 | 支持转码、字幕、多音轨 |
| **媒体组织** | 基于文件夹 | 标准媒体库结构 |

---

## 八、预估工作量

- **核心功能**：约 800-1000 行代码
- **完整集成**：约 1200-1500 行代码
- **开发时间**：2-3 天（有 OpenList 参考）

### 代码量分解

| 模块 | 代码量 | 说明 |
|------|--------|------|
| Emby 客户端 | 200-300 行 | API 封装 |
| CMS-Proxy | 300-400 行 | 核心转换逻辑 |
| 列表/详情 API | 200-300 行 | 前台接口 |
| 前台页面修改 | 100-150 行 | CapsuleSwitch 集成 |
| 管理面板 | 150-200 行 | 配置界面 |
| 类型定义 | 50-100 行 | TypeScript 类型 |
| **总计** | **1000-1450 行** | |

---

## 九、实现建议

1. **优先使用 API Key 认证**（比用户名/密码更简单）
2. **实现良好的缓存策略**（减少对 Emby 服务器的请求）
3. **支持多媒体库**（让用户选择显示哪些库）
4. **考虑转码选项**（根据网络情况动态调整）
5. **复用现有组件**（VideoCard、播放器等）
6. **先实现 CMS-Proxy**（这样 TVBOX 和网页都能用）
7. **再实现前台集成**（CapsuleSwitch 切换）

---

## 十、测试计划

### 10.1 功能测试

- [ ] Emby 连接测试
- [ ] 媒体列表获取（电影/剧集）
- [ ] 搜索功能
- [ ] 详情页面（电影/剧集）
- [ ] 播放功能（直接播放/转码）
- [ ] 剧集切换
- [ ] 分页功能
- [ ] CapsuleSwitch 切换

### 10.2 集成测试

- [ ] 网页播放测试
- [ ] TVBOX 订阅测试
- [ ] TVBOX 搜索测试
- [ ] TVBOX 播放测试
- [ ] OpenList 和 Emby 切换测试

### 10.3 性能测试

- [ ] 大型媒体库加载速度
- [ ] 缓存效果验证
- [ ] 并发请求处理

---

## 十一、后续扩展

### 可能的增强功能

1. **媒体库过滤**：按类型、年份、评分过滤
2. **收藏功能**：标记喜欢的媒体
3. **观看历史**：记录播放进度
4. **字幕支持**：加载 Emby 字幕
5. **转码设置**：用户自定义转码参数
6. **多用户支持**：不同用户看到不同的媒体库
7. **Jellyfin 支持**：Jellyfin API 与 Emby 类似，可以复用大部分代码

---

## 十二、总结

Emby 集成方案通过 **CMS-Proxy** 和 **CapsuleSwitch** 的组合，实现了：

✅ **统一接口**：网页和 TVBOX 都使用 CMS API 格式
✅ **统一入口**：私人影库页面集成 OpenList 和 Emby
✅ **代码复用**：最大化复用现有组件和逻辑
✅ **扩展性强**：未来添加其他源（Jellyfin、Plex）只需实现 cms-proxy
✅ **用户体验好**：无缝切换，流畅播放

这是一个**优雅、高效、可扩展**的设计方案！
