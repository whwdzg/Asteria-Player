# Bilibili API 实测记录

参考：[bilibili-plugins/bilibili-api-collect](https://github.com/bilibili-plugins/bilibili-api-collect)

测试环境：2026-11-13，未登录，使用带浏览器 UA / `Referer: https://www.bilibili.com/` 的服务端请求和本地 CORS 代理。测试视频 `BV1xx411c7mD`，`cid=62131`。B 站风控、区域和视频本身状态会改变结果，以下仅记录本次结果。

| 用途 | 接口 | 本次结果 | 备注 |
| --- | --- | --- | --- |
| 视频信息 | `x/web-interface/view` | `code: 0` | 返回标题、UP、封面、分 P 与 `cid` |
| 视频流（当前） | `x/player/wbi/playurl` | `code: 0`, `durl` 1 个 MP4 | 请求 `platform=html5&high_quality=1`，未签名也成功 |
| 视频流（旧） | `x/player/playurl` | `code: 0` | 旧接口仍可用，代码中作为后备 |
| 播放器 / 字幕 | `x/player/v2`、`x/player/wbi/v2` | `code: 0` | 该视频字幕列表为空；接口本身可用 |
| XML 弹幕 | `x/v1/dm/list.so?oid=62131` | `HTTP 200`，约 320 KB XML | 需要服务端解压 deflate |
| XML 弹幕备用 | `comment.bilibili.com/62131.xml` | 接口等价 | 代码中作为后备 |
| 搜索 | `x/web-interface/search/type` | 无 Cookie：`HTTP 412`；加 `buvid3` Cookie：`code: 0` 20 条 | 搜索需要代理补充 Cookie，不能依赖纯前端跨域请求 |
| 媒体 CDN | `durl[0].url` | `HTTP 200 video/mp4`，约 98 MB | 本次 html5 MP4 在带 / 不带 Referer 时都返回 200 |

## 对代理的要求

B 站 API 没有稳定的公开 CORS 头。代理至少应：

- 转发 `User-Agent`、`Referer`；
- 为搜索等风控接口补充 `Cookie: buvid3=...`（可用任意符合格式的值测试，实际以 B 站策略为准）；
- 原样转发 `Range`、`Content-Range`、`Content-Length`，否则视频拖动会失效；
- 返回 `Access-Control-Allow-Origin` 并暴露 `Content-Length` / `Content-Range` / `Accept-Ranges`。

## 项目内的处理

- 视频流优先请求 `x/player/wbi/playurl`，失败时回退旧 `x/player/playurl`。
- 弹幕优先 `x/v1/dm/list.so`，失败时尝试 `comment.bilibili.com/{cid}.xml`。
- 412 会给出“代理需转发 buvid3 Cookie 和浏览器请求头”的明确错误。
- 单视频、BV/AV、`?p=` 分 P 可用；列表 / 空间 / 收藏夹 / `b23.tv` 短链仍未实现。

本次通过本地代理端到端验证：B 站单视频导入成功，视频流可播放，导入的 XML 弹幕正常渲染。
