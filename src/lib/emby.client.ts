/* eslint-disable @typescript-eslint/no-explicit-any */

interface EmbyConfig {
  ServerURL: string;
  ApiKey?: string;
  Username?: string;
  Password?: string;
  UserId?: string;
}

interface EmbyItem {
  Id: string;
  Name: string;
  Type: 'Movie' | 'Series' | 'Season' | 'Episode';
  Overview?: string;
  ProductionYear?: number;
  CommunityRating?: number;
  PremiereDate?: string;
  ImageTags?: { Primary?: string };
  ParentIndexNumber?: number;
  IndexNumber?: number;
  MediaSources?: Array<{
    Id: string;
    MediaStreams?: Array<{
      Type: string;
      Index: number;
      DisplayTitle?: string;
      Language?: string;
      Codec?: string;
      IsExternal?: boolean;
      DeliveryUrl?: string;
    }>;
  }>;
}

interface EmbyItemsResult {
  Items: EmbyItem[];
  TotalRecordCount: number;
}

interface GetItemsParams {
  ParentId?: string;
  IncludeItemTypes?: string;
  Recursive?: boolean;
  Fields?: string;
  SortBy?: string;
  SortOrder?: string;
  StartIndex?: number;
  Limit?: number;
  searchTerm?: string;
}

export class EmbyClient {
  private serverUrl: string;
  private apiKey?: string;
  private userId?: string;
  private authToken?: string;

  constructor(config: EmbyConfig) {
    let serverUrl = config.ServerURL.replace(/\/$/, '');
    // 如果 URL 不包含 /emby 路径，自动添加
    if (!serverUrl.endsWith('/emby')) {
      serverUrl += '/emby';
    }
    this.serverUrl = serverUrl;
    this.apiKey = config.ApiKey;
    this.userId = config.UserId;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['X-Emby-Token'] = this.apiKey;
    } else if (this.authToken) {
      headers['X-Emby-Token'] = this.authToken;
    }

    return headers;
  }

  async authenticate(username: string, password: string): Promise<{ AccessToken: string; User: { Id: string } }> {
    const response = await fetch(`${this.serverUrl}/Users/AuthenticateByName`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Username: username,
        Pw: password,
      }),
    });

    if (!response.ok) {
      throw new Error('Emby 认证失败');
    }

    const data = await response.json();
    this.authToken = data.AccessToken;
    this.userId = data.User.Id;
    return data;
  }

  async getCurrentUser(): Promise<{ Id: string; Name: string }> {
    const url = `${this.serverUrl}/Users/Me`;
    const headers = this.getHeaders();

    console.log('[EmbyClient] getCurrentUser - URL:', url);
    console.log('[EmbyClient] getCurrentUser - Headers:', JSON.stringify(headers, null, 2));

    try {
      const response = await fetch(url, { headers });

      console.log('[EmbyClient] getCurrentUser - Status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[EmbyClient] getCurrentUser - Error Response:', errorText);
        throw new Error(`获取当前用户信息失败 (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      console.log('[EmbyClient] getCurrentUser - Success:', data);
      return data;
    } catch (error) {
      console.error('[EmbyClient] getCurrentUser - Exception:', error);
      throw error;
    }
  }

  async getItems(params: GetItemsParams): Promise<EmbyItemsResult> {
    if (!this.userId) {
      throw new Error('未配置 Emby 用户 ID，请在管理面板重新保存 Emby 配置');
    }

    const searchParams = new URLSearchParams();

    if (params.ParentId) searchParams.set('ParentId', params.ParentId);
    if (params.IncludeItemTypes) searchParams.set('IncludeItemTypes', params.IncludeItemTypes);
    if (params.Recursive !== undefined) searchParams.set('Recursive', params.Recursive.toString());
    if (params.Fields) searchParams.set('Fields', params.Fields);
    if (params.SortBy) searchParams.set('SortBy', params.SortBy);
    if (params.SortOrder) searchParams.set('SortOrder', params.SortOrder);
    if (params.StartIndex !== undefined) searchParams.set('StartIndex', params.StartIndex.toString());
    if (params.Limit !== undefined) searchParams.set('Limit', params.Limit.toString());
    if (params.searchTerm) searchParams.set('searchTerm', params.searchTerm);

    // 添加认证参数
    const token = this.apiKey || this.authToken;
    if (token) {
      searchParams.set('X-Emby-Token', token);
    }

    const url = `${this.serverUrl}/Users/${this.userId}/Items?${searchParams.toString()}`;

    console.log('[EmbyClient] getItems - URL:', url);
    console.log('[EmbyClient] getItems - Token:', token);
    console.log('[EmbyClient] getItems - UserId:', this.userId);

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`获取 Emby 媒体列表失败 (${response.status}): ${errorText}`);
    }

    return await response.json();
  }

  async getItem(itemId: string): Promise<EmbyItem> {
    const token = this.apiKey || this.authToken;
    const url = `${this.serverUrl}/Users/${this.userId}/Items/${itemId}?Fields=MediaSources${token ? `&api_key=${token}` : ''}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('获取 Emby 媒体详情失败');
    }

    return await response.json();
  }

  async getSeasons(seriesId: string): Promise<EmbyItem[]> {
    const token = this.apiKey || this.authToken;
    const url = `${this.serverUrl}/Shows/${seriesId}/Seasons?userId=${this.userId}${token ? `&api_key=${token}` : ''}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('获取 Emby 季列表失败');
    }

    const data = await response.json();
    return data.Items || [];
  }

  async getEpisodes(seriesId: string, seasonId?: string): Promise<EmbyItem[]> {
    const token = this.apiKey || this.authToken;
    const searchParams = new URLSearchParams({
      userId: this.userId!,
      Fields: 'MediaSources',
    });

    if (seasonId) {
      searchParams.set('seasonId', seasonId);
    }

    if (token) {
      searchParams.set('api_key', token);
    }

    const url = `${this.serverUrl}/Shows/${seriesId}/Episodes?${searchParams.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('获取 Emby 集列表失败');
    }

    const data = await response.json();
    return data.Items || [];
  }

  async checkConnectivity(): Promise<boolean> {
    try {
      const token = this.apiKey || this.authToken;
      const url = `${this.serverUrl}/System/Info/Public${token ? `?api_key=${token}` : ''}`;
      const response = await fetch(url);
      return response.ok;
    } catch {
      return false;
    }
  }

  getImageUrl(itemId: string, imageType: 'Primary' | 'Backdrop' | 'Logo' = 'Primary', maxWidth?: number): string {
    const params = new URLSearchParams();
    const token = this.apiKey || this.authToken;

    if (maxWidth) params.set('maxWidth', maxWidth.toString());
    if (token) params.set('api_key', token);

    const queryString = params.toString();
    return `${this.serverUrl}/Items/${itemId}/Images/${imageType}${queryString ? '?' + queryString : ''}`;
  }

  getStreamUrl(itemId: string, direct: boolean = true): string {
    if (direct) {
      return `${this.serverUrl}/Videos/${itemId}/stream?Static=true&api_key=${this.apiKey || this.authToken}`;
    }
    return `${this.serverUrl}/Videos/${itemId}/master.m3u8?api_key=${this.apiKey || this.authToken}`;
  }

  getSubtitles(item: EmbyItem): Array<{ url: string; language: string; label: string }> {
    const subtitles: Array<{ url: string; language: string; label: string }> = [];

    if (!item.MediaSources || item.MediaSources.length === 0) {
      return subtitles;
    }

    const mediaSource = item.MediaSources[0];
    if (!mediaSource.MediaStreams) {
      return subtitles;
    }

    const token = this.apiKey || this.authToken;

    mediaSource.MediaStreams
      .filter((stream) => stream.Type === 'Subtitle')
      .forEach((stream) => {
        const language = stream.Language || 'unknown';
        const label = stream.DisplayTitle || `${language} (${stream.Codec})`;

        // 外部字幕使用 DeliveryUrl
        if (stream.IsExternal && stream.DeliveryUrl) {
          subtitles.push({
            url: `${this.serverUrl}${stream.DeliveryUrl}`,
            language,
            label,
          });
        } else {
          // 内嵌字幕使用 Stream API
          subtitles.push({
            url: `${this.serverUrl}/Videos/${item.Id}/${mediaSource.Id}/Subtitles/${stream.Index}/Stream.vtt?api_key=${token}`,
            language,
            label,
          });
        }
      });

    return subtitles;
  }
}
