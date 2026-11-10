# Asteria Player

一个以 **Microsoft Fluent Design（Sun Valley）** 为视觉基底、融合可选 **Apple Liquid Glass** 悬浮质感的网页音乐 / 视频播放器。底部播放栏、逐字歌词、视频弹幕、字幕与完整的响应式布局都已落地。

![桌面端预览](docs/preview-desktop.png)
![移动端预览](docs/preview-mobile.png)

## 当前能力

### 底栏

- 顶沿进度条：细轨、悬停增粗、可拖拽圆形滑块、缓冲区间、悬停时间气泡，交互参考 Salt Player for Windows。
- 左侧封面 / 视频缩略图、标题、作者与专辑。
- 中间控制：上一个、快退 10 秒、播放 / 暂停、快进 10 秒、下一个、播放模式。
- 四种播放模式：单个循环、列表循环、不循环、随机播放。
- 右侧：音量、亮度、全屏、播放列表、设置；全部为 Fluent UI System Icons。
- 音量 0–120%，通过 Web Audio `GainNode` 实现 100% 以上增益，并内置五段「调频器」均衡器与预设。
- 亮度 0–100%，影响封面 / 视频画面，不影响操作层可读性；每项都是独立悬浮卡片。

### 播放页

- 左侧大封面、标题、作者 / 专辑与采样率、位深、码率、格式信息。
- 右侧歌词：逐字高亮、翻译、自动居中滚动、点击歌词跳转、手动滚动后自动恢复跟随。
- 支持 LRC、SPL（Salt Player Lyrics）、增强型 LRC 逐字标记、SPL 行尾标记、延迟逐字标记、翻译配对。
- 支持音频标签内嵌歌词：ID3 `USLT` / `TXXX`、FLAC `LYRICS` / `UNSYNCEDLYRICS`、MP4 `©lyr`。
- 支持同名翻译文件（如 `song.trans.lrc`）与独立字幕、弹幕文件。

### 视频

- 自定义视频层、字幕、Bilibili 风格弹幕（XML / JSON）。
- 字幕支持 SRT、VTT、ASS，按文件名语言后缀自动识别（`movie.zh-CN.srt`、`movie.en.vtt`）。
- 解析滚动 / 顶部 / 底部三种弹幕模式；设置中可分别开关顶部弹幕与滚动弹幕。
- 视频全屏后底栏自动隐藏；鼠标靠近屏幕下缘时出现，移开后再次隐藏。
- 手机 / 平板上使用 16:9 视频卡片 + 媒体信息卡，避免竖屏黑边。

### 播放列表

- 右侧侧边栏，支持一键展开为全页面。
- 左上：条目统计、播放序列切换；默认「全部」，可新建自定义序列。
- 右上：导入、搜索、批量操作、展开 / 收起、关闭。
- 列表项：封面、标题、作者、时长与三点菜单。
- 三点菜单：从列表移除、下一个播放、加入播放序列、查看详细信息。
- 批量模式：全选、加入序列、移除。
- 列表使用虚拟滚动，可承载大量曲目；自定义序列持久化到 `localStorage`。

### 设置

- 主题：深色 / 浅色 / 跟随系统。
- 语言：简体中文 / 繁體中文 / English / 跟随系统，语言包来自外部 JSON。
- 液态玻璃开关：开启后增强折射高光、饱和度与背景模糊。
- 歌词字号、字重、是否显示翻译。
- 视频字幕语言 / 关闭、弹幕总开关、顶部弹幕、滚动弹幕。
- 快捷键提示与版本信息。

### 响应式

针对桌面、平板、手机横竖屏分别调整布局：

- 桌面：三栏底栏 + 左封面 / 右歌词。
- 平板：两行底栏，封面与歌词按宽度收缩。
- 手机：紧凑两行底栏、封面信息横向排列、歌词独立滚动。
- 超窄屏（≤ 380px）自动收起亮度入口；播放与列表功能仍可完整使用。
- 横屏矮窗口下自动压缩媒体列，优先保证歌词与播放控制可见。

## 快速开始

要求 Node.js 20+（本项目在 Node 26 上开发）。

```bash
npm install
npm run dev
# http://localhost:4173
```

生产构建与预览：

```bash
npm run build
npm run preview
```

静态站点可直接部署 `dist/`；Vite 使用相对路径 `base: './'`，因此也支持子目录部署。

## 使用说明

### 导入媒体

- 点击任一「导入」按钮，选择文件或文件夹；也可以把文件 / 文件夹直接拖入页面。
- 文件夹导入会按文件名自动配对同名资源：

| 资源 | 约定 |
| --- | --- |
| 歌词 | `song.lrc`、`song.spl`、`song.txt`；SPL 优先于 LRC |
| 翻译歌词 | `song.trans.lrc`、`song.translation.lrc`、`song.译文.lrc` |
| 字幕 | `movie.zh-CN.srt`、`movie.en.vtt`、`movie.ja.ass` |
| 弹幕 | `video.xml`、`video.json`，建议文件名包含 `danmaku` / `弹幕` |
| 封面 | 同名 `.jpg` / `.png` / `.webp`；音频标签内嵌封面优先 |

### 歌词规范

SPL 语法按 [Salt Player Lyrics 标准](https://moriafly.com/standards/spl.html) 实现，兼容增强型 LRC：

```text
[00:09.20]City <00:09.55>lights <00:09.95>are <00:10.25>breathing <00:10.85>slow[00:13.20]
[00:09.20]城市<00:09.55>灯火 <00:09.95>缓缓 <00:10.25>呼吸[00:13.20]
```

- 相同时间戳的后续行视为翻译。
- 无时间戳、紧跟主歌词的纯文本行也视为翻译（SPL 规则）。
- 仅含时间戳的行是显式结束标记，不生成歌词行。
- 支持 `[offset:500]`。
- 自动忽略 LX Music `[awlrc:...]` 兼容字段。

### 快捷键

| 按键 | 功能 |
| --- | --- |
| `Space` | 播放 / 暂停 |
| `←` / `→` | 快退 / 快进 5 秒 |
| `Shift` + `←` / `→` | 快退 / 快进 30 秒 |
| `↑` / `↓` | 音量 ±5% |
| `M` | 静音 |
| `F` | 全屏 |
| `Q` | 打开 / 关闭播放列表 |
| `Esc` | 关闭当前浮层 / 退出伪全屏 |

## 外部语言包

语言包位于 `public/locales/`，完全由运行时 `fetch` 加载，不参与打包：

```json
{
  "languages": [
    { "code": "zh-CN", "label": "简体中文", "nativeLabel": "简体中文", "file": "zh-CN.json" },
    { "code": "zh-TW", "label": "繁體中文", "nativeLabel": "繁體中文", "file": "zh-TW.json" },
    { "code": "en", "label": "English", "nativeLabel": "English", "file": "en.json" }
  ]
}
```

新增语言：

1. 复制一份 JSON，翻译其中的扁平键（如 `player.play`、`settings.theme`）。
2. 在 `manifest.json` 中追加条目。
3. 刷新页面，设置中的语言下拉会自动出现新选项。

「跟随系统」会根据 `navigator.languages` 匹配语言包，并正确处理 `zh-Hans` / `zh-Hant`、`en-US` 等区域变体。

## 设计与实现

### 视觉

- Fluent 设计令牌：Mica 式多层半透明、8–26px 圆角、Fluent 动效曲线、Segoe UI Variable 字体栈。
- Sun Valley 深 / 浅色双主题，`data-theme` 在首屏渲染前应用，避免闪烁。
- 可选的 Liquid Glass：**设置 → 外观 → 液态玻璃**，开启后增加高光、折射边框与更强背景模糊。
- 所有功能图标来自 [`@fluentui/react-icons`](https://github.com/microsoft/fluentui-system-icons)。

### 模块拆分

```text
src/
├─ App.tsx                     # 应用装配、拖放、全屏与外观副作用
├─ components/
│  ├─ chrome/                  # 底栏、进度条、媒体信息、传输控制、工具入口
│  ├─ common/                  # 图标按钮、滑块、开关、分段控件、菜单、弹层、对话框
│  ├─ nowplaying/              # 封面 / 技术参数、歌词视图
│  ├─ queue/                   # 侧边栏 / 全页队列、虚拟列表、批量操作
│  ├─ settings/                # 设置、音量 / 调频器、亮度卡片
│  ├─ video/                   # 视频层、字幕、弹幕
│  └─ overlays/                # 详情、新建序列、Toast、拖放提示
├─ hooks/                      # 主题、全屏、自动隐藏、快捷键、外部关闭
├─ i18n/                       # 外部语言包加载
├─ lib/
│  ├─ lyrics.ts                # LRC / SPL / 翻译 / 逐字
│  ├─ subtitles.ts             # SRT / VTT / ASS / 语言识别
│  ├─ danmaku.ts               # XML / JSON 弹幕
│  ├─ metadata/                # ID3 / FLAC / MP4 / WAV 标签读取
│  ├─ importer.ts              # 文件分组、同名资源配对、元数据
│  └─ media.ts                 # 歌词 / 字幕 / 弹幕解析缓存
├─ player/
│  ├─ engine.ts                # 双媒体元素 + Web Audio 图 + 播放状态机
│  └─ ImportProvider.tsx       # 文件选择器与导入流程
├─ state/                      # Zustand：library / playback / clock / settings / ui
└─ styles/                     # 令牌、基础、底栏、播放页、视频、队列、设置、响应式
```

### 性能设计

- **时钟与界面解耦**：播放进度只写入独立 `clock` store，约 20Hz 更新；底栏、歌词、字幕按需订阅，不触发整页重渲染。
- **虚拟列表**：队列使用 `@tanstack/react-virtual`，只渲染视口附近的行。
- **按需加载**：设置面板与队列面板通过 `React.lazy` 拆分为独立 chunk。
- **解析缓存**：歌词 / 字幕 / 弹幕按曲目缓存，拖动进度条不会重复解析文件。
- **歌词 memo**：非当前行不随时间重渲染，只更新活动行与相邻行。
- **媒体元素复用**：音频 / 视频各一个元素，切换曲目时复用 Web Audio 图与媒体源。
- **CSS 自适应**：液态玻璃可关闭，移动端减少模糊半径；`prefers-reduced-motion` 自动降级动画。

## 演示媒体

`public/demo/` 中的音频、封面、视频、歌词、字幕、弹幕全部由代码合成，不含第三方版权素材：

```bash
python scripts/generate-demo.py
```

需要 `numpy`、`Pillow`、`ffmpeg`、`mutagen`。该脚本会重新生成：

- 3 首 48kHz / 44.1kHz 音乐（MP3 / FLAC，含内嵌封面与 ID3/FLAC 标签歌词）
- 1 个 960×540 抽象视频（带音轨）
- SPL 逐字歌词 + 翻译、LRC 翻译歌词
- 中文 / 英文 / 日文字幕
- Bilibili XML 弹幕

## 验证

```bash
npm test        # 22 个解析器 / 元数据单元测试
npm run qa      # 端到端交互检查（需要本机 Edge 与运行中的 dev server）
npm run shots   # 输出桌面 / 平板 / 手机 / 视频 / 全屏截图
```

`npm run qa` 与 `npm run shots` 默认使用 Windows Edge 路径；可通过 `EDGE_PATH` 环境变量覆盖。

## 已知限制

- 本地导入的媒体保存在当前页面会话中（`File` + `blob:` URL），刷新后不会保留；演示媒体库与自定义序列会保留。
- 可播放格式取决于浏览器编解码器（Chrome / Edge 对 MKV、部分 AVI 支持有限）。
- 120% 音量依赖 Web Audio；跨域且未返回 CORS 头的远程媒体会回退到浏览器原生的 0–100% 音量。
- 弹幕使用简化泳道，不做完整的碰撞检测与密度限制。
- SPL 的 `awlrc` 字段按规范忽略；SYLT 帧不做解析，优先 `USLT`。
- iOS Safari 的标准 Fullscreen API 对普通元素支持有限，播放器会回退到页面内「伪全屏」。

## License

GPL-3.0，见 [LICENSE](LICENSE)。
