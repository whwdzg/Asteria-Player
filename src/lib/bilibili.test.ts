import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchBilibiliDanmaku,
  fetchBilibiliPlayUrl,
  fetchDanmuApiDanmaku,
  searchDanmuApiEpisodes,
  fetchBilibiliPages,
  fetchBilibiliSubtitles,
  searchBilibiliVideos,
} from './bilibili';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Bilibili service', () => {
  it('searches, normalises covers and parses durations', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      expect(url).toContain('search%2Ftype');
      expect(init?.signal).toBeTruthy();
      return jsonResponse({
        code: 0,
        data: {
          result: [{
            bvid: 'BV1xx',
            title: '<em class="keyword">My</em> Video',
            author: 'Uploader',
            pic: '//i0.hdslb.com/cover.jpg',
            duration: '01:23',
            play: 42,
          }],
        },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const results = await searchBilibiliVideos('My Video', 'https://proxy.test/?url={url}');
    expect(results[0]).toMatchObject({
      bvid: 'BV1xx',
      title: 'My Video',
      author: 'Uploader',
      cover: 'https://i0.hdslb.com/cover.jpg',
      duration: 83,
      play: 42,
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain('https%3A%2F%2Fapi.bilibili.com');
  });

  it('loads pages and follows the P-number subtitle', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      code: 0,
      data: {
        bvid: 'BV1xx',
        title: 'My Video',
        owner: { name: 'Uploader' },
        pic: '//i0.hdslb.com/cover.jpg',
        duration: 100,
        pages: [
          { page: 1, cid: 11, part: 'P1' },
          { page: 2, cid: 22, part: 'P2' },
        ],
      },
    })));
    const { video, pages } = await fetchBilibiliPages('BV1xx', '');
    expect(video.title).toBe('My Video');
    expect(pages.map((page) => page.cid)).toEqual([11, 22]);
  });

  it('parses XML danmaku and converts subtitle JSON to WebVTT', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('dm/list.so')) {
        return new Response('<?xml version="1.0"?><i><d p="1.5,1,25,16777215,0,0,0,0">Hello</d></i>', { status: 200 });
      }
      if (url.includes('player/v2')) {
        return jsonResponse({
          code: 0,
          data: { subtitle: { subtitles: [{ lan: 'zh-CN', lan_doc: '中文', subtitle_url: '//sub.example/a.json' }] } },
        });
      }
      if (url.includes('sub.example')) {
        return jsonResponse({ body: [{ from: 1.2, to: 3.4, content: 'Subtitle text' }] });
      }
      throw new Error(`Unexpected URL: ${url}`);
    }));

    const danmaku = JSON.parse(await fetchBilibiliDanmaku(11, ''));
    expect(danmaku[0]).toMatchObject({ time: 1.5, text: 'Hello' });

    const subtitles = await fetchBilibiliSubtitles('BV1xx', 11, '');
    expect(subtitles).toHaveLength(1);
    expect(subtitles[0]).toMatchObject({ lang: 'zh-CN', format: 'vtt' });
    expect(subtitles[0].text).toContain('WEBVTT');
    expect(subtitles[0].text).toContain('00:00:01.200 --> 00:00:03.400');
  });

  it('searches the open-source danmu_api server and parses its XML comments', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/search/episodes')) {
        return jsonResponse({
          animes: [{
            animeTitle: 'Test Show',
            typeDescription: 'TV series',
            imageUrl: 'https://img.example/poster.jpg',
            episodes: [{ episodeId: 77, episodeTitle: 'Episode 1' }],
          }],
        });
      }
      if (url.includes('/comment/77')) {
        return new Response('<i><d p="1.0,1,25,16777215,0,0,0,0">Hello</d></i>', { status: 200 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    }));

    const results = await searchDanmuApiEpisodes('Test Show', 'https://danmu.example/87654321/');
    expect(results[0]).toMatchObject({
      bvid: '',
      episodeId: 77,
      source: 'danmu_api',
      title: 'Test Show · Episode 1',
      author: 'TV series',
      cover: 'https://img.example/poster.jpg',
    });
    const danmaku = JSON.parse(await fetchDanmuApiDanmaku(77, 'https://danmu.example/87654321'));
    expect(danmaku[0]).toMatchObject({ time: 1, text: 'Hello' });
  });

  it('resolves a progressive Bilibili stream through the proxy', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const raw = String(input);
      const url = raw.includes('url=') ? decodeURIComponent(raw.slice(raw.indexOf('url=') + 4)) : raw;
      expect(url).toContain('playurl');
      expect(url).toContain('fnval=0');
      return jsonResponse({
        code: 0,
        data: { durl: [{ url: 'https://cdn.example/video.mp4', size: 2048 }] },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchBilibiliPlayUrl('BV1xx411c7mD', 123, '')).resolves.toBe('https://cdn.example/video.mp4');
    await expect(fetchBilibiliPlayUrl('BV1xx411c7mD', 123, 'https://proxy.example/?url='))
      .resolves.toBe(`https://proxy.example/?url=${encodeURIComponent('https://cdn.example/video.mp4')}`);
  });

  it('reports API and empty-result errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ code: -400, message: 'blocked' })));
    await expect(searchBilibiliVideos('x', '')).rejects.toThrow(/blocked/);

    vi.stubGlobal('fetch', vi.fn(async () => new Response('<i></i>', { status: 200 })));
    await expect(fetchBilibiliDanmaku(11, '')).rejects.toThrow(/No danmaku/);
  });
});
