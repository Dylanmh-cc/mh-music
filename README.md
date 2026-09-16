# MH Music — 数字黑胶收藏室

> Digital Music Player × Vinyl Record × Liquid Glass × Album Art

一个沉浸式的 Web 音乐播放器。整个控制台收纳在一块**大型液态玻璃**中，漂浮在由**当前专辑封面驱动**
的动态环境光里；黑胶唱片从专辑封套后方滑出并旋转，歌曲以 **3D 透视舞台（Carousel）** 呈现，
歌词随音乐浮动，整个界面随低频轻微「呼吸」。

技术栈：**React 18 + TypeScript + Vite + Tailwind + Framer Motion + Zustand + Web Audio API**。
所有音频文件都在浏览器本地处理，不上传任何数据。

---

## 快速开始

### Windows（推荐）

双击项目根目录的 **`start.bat`**（自动定位 Node，安装依赖并启动）。

### 任意平台 / 命令行

```bash
cd "MH Music"
npm install        # 首次运行（国内网络慢可用：npm install --registry=https://registry.npmmirror.com）
npm run dev        # 打开 http://localhost:5180
```

其他命令：

```bash
npm run build      # 类型检查 + 生产构建（输出 dist/）
npm run preview    # 预览生产构建
npm run typecheck  # 仅类型检查
npm run gen:audio  # 重新生成 15 首演示曲目（WAV 合成器）
```

> 本仓库自带一份**便携版 Node.js**（`.tools/node`），`start.bat` 会优先使用它，
> 因此即使机器上没有安装 Node 也能直接运行。

### 首次使用

1. 打开页面 → **Create an account** 注册（密码使用 PBKDF2-SHA256 加盐哈希存储，绝不明文保存）。
2. 注册后自动进入 **黑胶开机动画**（约 6 秒，可点击任意处或 Skip Intro 跳过）。
3. 每个新账户会自动获得一套**演示曲库**（5 张专辑 / 15 首真实可播放的合成曲目，含 LRC 歌词），
   可直接体验全部功能；也可以在 **Folders** 里添加自己的音乐文件夹。

---

## 功能总览

### 视觉与交互
- **玻璃控制台布局**：整个界面（顶栏 / 侧栏 / 内容 / Now Playing 面板）收纳在**一块大型液态玻璃**
  （`.app-frame`）中，漂浮在动态环境光里；底部播放条是一枚悬浮的液态玻璃胶囊，微微叠在玻璃台边缘。
- **侧栏导航**：品牌标识 + 折叠按钮（可收起成 68px 图标轨，展开 212px），中间是 Home / Browse /
  Albums / Artists / Songs / Playlists / Favorites / Recently Played / Folders，**Settings 与账号固定在底部**。
- **统一 3D 卡片舞台（MH Music 最明显的视觉标志）**：Songs / Albums / Artists / Playlists / Favorites /
  Recently Played / 搜索结果**全部**用同一套 3D 舞台呈现 —— 中央大卡片为焦点（放大、发光、清晰），
  左右卡片按距离缩小、`rotateY` 透视旋转、模糊、降透明（Blur / Depth / Focus 一致），
  拖拽 / 触摸滑动 / 左右方向键 / 侧边箭头切换，下方胶片条可跳转，松手弹簧吸附到最近卡片。
  卡片内装的是各自的内容（封面、艺人唱片中心标、歌单拼贴、搜索结果），所以**点进任何入口都不会突然
  掉回普通列表**，切换时保持空间连续感。列表视图仅作为 Songs 页的可选切换保留。
- **音乐库墙（Home）**：`Recently Added` 网格 + `All Albums` 按首字母分区（大号字母 + 分隔线 + 数量），
  库内专辑达到 16 张时上方显示 **A–Z 跳转条**；专辑卡片自适应 260–360px，悬停时该卡放大提亮、
  其余卡片模糊降饱和后退。
- **3D 透视歌曲舞台**：Songs 页默认以 **3D Perspective Music Carousel** 呈现 —— 中央大卡片最突出，
  左右歌曲随距离缩小、模糊、降透明并带透视旋转；支持鼠标拖拽 / 触摸滑动 / 左右箭头 / 键盘方向键，
  松手自动吸附最近歌曲，点击卡片即居中并播放；舞台下方还有一条**缩略图胶片条**可直接跳播（可切回经典列表）。
- **动态专辑主题**：从专辑封面提取主色/辅助色/高亮色/阴影色，实时驱动页面背景、玻璃、播放按钮、
  进度条、歌词高亮、hover 光晕、黑胶反射与环境光；切换带 600–1200ms 平滑过渡（CSS `@property`
  颜色插值）。提取结果会做**可读性收敛**：环境永远不是死黑，强调色始终清晰。
- **Living Background（星空空间）**：
  - 三层视差星空，随鼠标轻微移动，随高频闪烁
  - **分子颗粒网络**——漂移的节点在 beat 上亮起并短暂连线（克制的颗粒质感）
  - **Beat 涟漪**从空间中扩散，Bass 越强半径越大
  - 底部**低频声波带**随 bass/mid/treble 起伏
  - 偶发**流星拖尾**
  - 极弱 Film Grain + 暗角（可在 Settings 关闭）
- **街头元素**：半调喷点、喷漆光斑、模板刻字（33⅓ / SIDE A）、封套胶带角与模板数字 —— 全部
  低透明度，只作为材质，不抢内容。
- **Vinyl Intro 开场（5 个阶段，约 5.6 秒）**：与需求图的五帧一一对应 ——
  ① 深色空间里**只有唱机**：34° 浅视角的立体机身（可见前厚度）、车削金属转盘边 + 频闪刻点、
  空置的中心轴，左侧暖橙主光 + 右侧冷蓝补光；
  ② **唱片随即被放上转盘**（唱机出现后约 0.6s 就开始下落，沿 Z 轴从上方降下并落定，落地时轻微一顿）；
  ③ 转盘起转（频闪刻点与光泽扫过）+ **唱臂从托架摆到唱片上方落针**（落针涟漪 + VU 表醒来）；
  ④ 整幅画面**颗粒化解构**：合计数千颗细颗粒从唱片沟槽与全屏扩散成星尘；
  ⑤ 颗粒散去，播放器浮现。
  可点击任意处或 Skip Intro 跳过；Settings 中可关闭（Skip intro）或随时**重播**。
  **复古现代的外观**：拉丝铝面板 + 铬饰条 + 胡桃木底座，机械加工转盘边与频闪刻点、唱臂枢轴罩与配重、
  速度键、VU 条、pitch 推子、电源指示灯与一条小型读数窗 —— 材质和零件营造「真机器」的质感，
  而不是靠堆阴影。**保留原来的造型比例**：转盘位置与大小、唱臂的停靠/悬停角度都是原本那套，只是唱臂
  **长度**由「枢轴 + 唱针落点」反推出来 —— 所以「唱片和唱针对得上」是构造保证的（实测落点在 1px 内，
  白色针尖稳定压在黑色沟槽区）。唱针、唱头、配重都缩到了与整台机器协调的比例。
  空间上也有了真实的层级：底座 `rotateX(38deg) rotateY(-5deg)` 的 3/4 视角、转盘在 `Z 0`、
  唱片落在 `Z +4`、唱臂停靠时抬到 `Z +30`、落针时降到 `Z +8`，唱头再往下沉 3px。
  **粒子分解更细腻**：约 3400 颗亚像素级细颗粒（每颗自带随机色相）从唱片沟槽与整幅画面剥离，
  同时 16 团彩色柔光从唱机周围向外**晕染**开来再淡去 —— 用缓存的精灵绘制，不会逐帧建渐变。
  唱片沟槽刻意用较粗的间距，否则细环在当前尺寸下会走样成摩尔纹菱形。
  性能上刻意只做能合成的东西：相机与唱盘只动 `transform/opacity` 并提升为独立层，
  唱片与光泽层 `will-change` 避免逐帧重绘，光束去掉 24px 模糊改用渐变收边，
  开场期间关闭环境星场 canvas、胶片颗粒改为静态、灰尘用纯 CSS 关键帧（不占用主线程），
  粒子解构的缓冲区在挂载时就预分配好 —— 因此阶段切换不会再出现掉帧。
- **液态玻璃系统**：`backdrop-filter` 模糊 + 半透明表面 + 边缘折射高光 + 内阴影 + 柔和外阴影 + 噪点，
  用于悬浮播放条、弹层与按钮。
- **黑胶交互**：点击专辑封面 → 黑胶从封套后方滑出约 **45%** 并旋转；再次点击收回。
  **正在播放该专辑时，黑胶会自动弹出并随音乐旋转**（暂停即停，续播从原角度继续，不会跳回 0°）；
  播放中点击可手动收回。黑胶与封套**等尺寸**（同一直径、同一透视），不会出现「小封面 + 大唱片」。
- **全屏播放页**：进入 **3D 音乐空间**而不是平面播放器。封面与黑胶**等尺寸**且中心点、垂直中心、
  透视与景深完全一致，黑胶在封套后方从右侧露出约 **45%**；封面随 bass 轻微呼吸
  （1.000 → 1.015，克制不抖动），黑胶独立旋转；排版重心让给**漂浮歌词**。
- **真正的空间视差**：鼠标 / 触摸移动时，封面层、歌词层、控制台层按不同倍数在 X/Y/Z 上位移
  （`translateZ` 20–80px 分层），整页产生透视视差而不是整体平移。
- **音乐粒子系统**：播放时 canvas 粒子场实时跟随频谱 ——
  **Bass** 把粒子云拉向封面（Gather），**鼓点**向外炸开（Explode）并撞出白色火花核心，
  **能量升高**让粒子进入环绕轨道（Orbit），**中频**把粒子压成横贯房间的波浪（Wave），
  高频带来细密抖动（Pulse），音乐平静时回到缓慢漂浮（Ambient）。
  六种状态之间按 ~0.5s 平滑混合，**不会生硬切换**；粒子分布在 8 个 Z 深度层上，
  近处更大更快、视差位移更多 —— 这就是空间的纵深感来源。
  粒子数量按设备自动调整（小屏 / 少核心自动降档），并在 `prefers-reduced-motion` 或关闭动画时整体停用。
- **专辑墙**：封面按首字母分组、整齐排列并各自缓慢悬浮（错相位）。
  **鼠标悬停某张专辑时，它放大提亮并显示操作按钮，其余专辑降低透明度、降饱和并轻微模糊。**
- **Focus / Depth**：歌曲列表同样支持 —— 悬停一行时该行清晰前移，其余行轻微模糊（纯 CSS，不触发重渲染）。
- **播放器背景：3D 立体空间 + 音乐可视化**。全屏播放页始终是同一个 3D 空间（专辑配色星云、随鼠标视差漂移的
  星场、环境雾、暗角与胶片颗粒），前面浮着一层**由频谱驱动的粒子可视化**。
- **空间是有 Z 轴的**，不是叠在一起的两层：房间在**最远的平面**（`translateZ(-520px)` + 反向缩放保持满屏），
  粒子可视化在**中景层**（`translateZ(-230px)`），专辑封面 / 黑胶在**主体层**（封面 `+22px`、黑胶 `0`，
  两者仍等尺寸、同心），歌词在**更前一层**（`+90px`），播放控制台与特效导轨在**最前**（`+70px`）。
  鼠标移动时远层与近层按不同倍数反向位移，所以纵深感是真的能看出来的。
- **专辑封面跟着音乐动**：bass 让它轻微胀大（1.000 → 1.016），mid 给它一点点倾斜与位移
  （`translate`/`rotate` 独立于 Framer 的 transform，两者叠加而不是互相覆盖），幅度刻意压得很小、过渡平滑。
- **统一的 AudioReactiveEngine**：`src/audio/engine.ts` 是唯一的分析源，每帧输出
  `bass / mid / treble / energy / beat / vol` 以及原始的 `freq`（频谱）与 `wave`（波形）数组。
  粒子、黑胶旋转、专辑呼吸、歌词、背景光晕、玻璃辉光全部只读这一个引擎，没有组件各自分析音频。
  Settings → Visuals 里的 **Music sensitivity** 与 **Beat response** 直接调这个引擎的增益与节拍阈值。
- **8 个可视化预设**（播放页左侧导轨，或 Settings → Visuals）：
  **Spatial**（默认，整个房间）· **Particle**（更密的直接反应场）· **Voxel**（3D 发光方块音乐地形）·
  **Fluid**（长拖尾涡流）· **Galaxy**（星云旋臂）· **Minimal**（一条极简波形）· **Vinyl**（环绕唱片的涟漪）· **Off**。
- **Spatial 会走完整的音乐循环**：**吸引 → 聚集 → 压缩 → 爆发 → 扩散**，每一轮重新聚成**不同的形态** ——
  环 / 球体 / 波浪 / 漩涡 / 星云 / 花朵 / 山丘 / 黑胶 / 螺旋 —— 然后再散开。所以形态不会一直停在一种。
- **Voxel 是真正的音乐地形**：26×15 的 3D 方块按频谱高度起伏，低声时平缓、Bass 增强时整体隆起、
  鼓点让局部突然跳动，方块顶/左/右三个面分别受光并按专辑配色渐变，高方块额外带一层辉光。
- **粒子数量按设备与设置自动调整**：基数 3600 × 预设系数 × 密度档（Low/Medium/High/Ultra）× 设备系数，
  上限 12000；超过约 4200 颗时自动从精灵贴图切换为 fillRect 绘制以保证帧率，小屏 / 少核心自动降档。
- **歌词与粒子互动**：唱到某一句时，整片粒子会朝这句歌词聚拢；换句的瞬间从文字周围向外爆散，再聚向下一句。
  可在 Settings → Lyrics 关闭（Lyrics and particles）。
- **每种预设共有的反应**：bass 决定整体规模与 Z 轴震动、mid 决定「多少粒子被解析出来」（密度感）、
  treble 带来闪烁与细密抖动、鼓点触发整个场景的 scale / glow / camera shake / 位移、音量决定整体存在感。
- **颜色可选**（导轨底部的 ALB / RND，或 Settings）：**Album**（默认）从当前专辑调色板推导色相，
  让粒子属于这张唱片并跟着环境光变化；**Random** 让每颗粒子自带随机色相/饱和度/明度。
- **粒子共同的性格**：约 6.5s 一次的呼吸、**一次只亮一颗**（亮度按 `sin(phase)^16` 提升，
  任意瞬间只有极少数粒子是亮的，其余保持昏暗 —— 随机位置一闪一闪的微弱亮光）、8 个 Z 深度层上的视差。
- **播放页背景 6 种模式**（Settings → Visuals）：**3D Spatial**（默认，星云/星场/雾）· **Standard**（纯色深空 + 光晕）·
  **Transparent**（近乎透明）· **Particle World**（粒子即房间）· **Voxel World**（方块世界）· **Album Reactive**（专辑主色主导）。
- **特效选择靠边站**：8 个预设收在一根**贴左侧边缘的竖直玻璃导轨**里，半透明、4 秒不动就淡到 20% 透明度，
  **永远不会压到歌词**（歌词在右侧信息栏）。
- **可自定义的视觉参数**（Settings → Visuals）：预设、粒子配色、背景模式、粒子密度、音乐灵敏度、
  节拍响应、唱片尺寸（50%–200%，封套与唱片一起缩放）、背景不透明度、玻璃模糊强度。
- **每个浏览页都能选 3D 或普通列表**：Albums / Artists / Songs / Favorites 顶部都有一个 **3D Stage / List**
  切换（同一个控件、同一套视觉），选择按页记忆、刷新后保持。默认是 3D 舞台 —— 也就是 MH Music 的招牌形态；
  想快速扫一遍大库时切成列表即可。
- **歌词是流动的**：播放页只显示设置里指定的行数（默认 4 行）作为窗口，上下用遮罩淡出，唱到哪句自动居中跟随；
  **随时可以用滚轮 / 触摸滑动自由翻阅**（手动滚动会暂停跟随并保持在你翻到的位置），
  6 秒后或点一下「Follow lyrics」重新跟唱。右侧歌词面板同样支持。
- **街头氛围**：主页玻璃控制台**内部**铺了一层低存在感的城市元素 —— 霓虹招牌（RECORDS）、演出海报、
  磁带、音箱、贴纸、墙面刮痕、城市天际线，加上原有的半调喷点、喷漆光斑与模板刻字。
  全部低透明度、随专辑强调色变色、不抢内容。（放在玻璃框内部是因为隔着 22px 模糊什么都看不见。）
- **音频律动**：Web Audio 分析 bass / mid / treble / energy / vol 与 beat，驱动背景光晕、星空亮度、
  封面呼吸、粒子状态与播放按钮轻微缩放（克制，不做频谱条）。
- **音频律动**：Web Audio 分析 bass / mid / treble / energy 与 beat，驱动背景光晕、星空亮度、
  分子连线、封面呼吸、粒子状态机与播放按钮轻微缩放（克制，不做频谱条）。
- **没有闪屏**：胶片颗粒改成**静态**（之前是一层全屏混合图层每秒重绘 4 次，在大屏上会读成闪烁）；
  全屏播放页进场不再对整层做 `filter: blur(18px)`（跨两个 canvas 与多层 3D 平面的模糊动画会闪），
  改成整体淡入 + 内容轻微上浮；开场动画在开始淡出的那一刻就通知外层显示控制台，
  于是交接是**交叉淡化**而不是「先黑一帧再淡入」。

### 音乐库
- 扫描本地文件夹（File System Access API，Chrome/Edge；其他浏览器自动降级为
  `<input webkitdirectory>` 或文件多选）。
- **上传的文件会被持久化**：选中的音频以 Blob 形式存入 IndexedDB，**刷新页面后依然可以直接播放**，
  无需重新添加（删除曲目/文件夹时会同步清理缓存）。
- 支持 MP3 / FLAC / WAV / AAC / M4A / OGG / OPUS。
- **自带标签解析器**（无第三方依赖）：ID3v2.2/2.3/2.4 + ID3v1、FLAC VORBIS_COMMENT/PICTURE、
  M4A `ilst`；读取标题、艺术家、专辑、专辑艺术家、流派、年份、音轨号、碟号、时长、内嵌封面。
- 优先使用内嵌封面并自动缩放缓存；无封面时**程序化生成**专属封面。
- **同名 `.lrc` 文件自动匹配**并解析为同步歌词。
- **同专辑自动归类**：按 `Album Artist + Album Name`（其次 `Artist + Album Name`）合并，不产生重复专辑。
- 大库性能：专辑墙 `content-visibility` + 图片懒加载、歌曲列表分批渲染、时长探测并发化、
  搜索防抖、悬停聚焦用纯 CSS 避免整墙重渲染。

### 播放器
- 播放/暂停、上一首/下一首、进度条点击与拖动跳转、时间显示 —— 全部**真实作用于 HTMLAudioElement**。
- 底部播放条是**加大的悬浮液态玻璃胶囊**：旋转迷你黑胶 + 曲名 + 艺术家 · 专辑 + 收藏 + 更多，
  中间是播放模式 / 上一首 / 播放 / 下一首，右侧是音量、Queue、Lyrics、全屏；顶沿有一条随专辑配色
  点亮的发丝高光。未播放时收缩为**一条干净的紧凑胶囊**（一句状态 + 「Browse albums」按钮）——
  这里原来放了一个唱片形状的圆钮，看着像能点其实什么也不做，已经去掉。
- **播放模式四选一，互斥**：**顺序播放** / **列表循环（Repeat All）** / **单曲循环（Repeat One）** /
  **随机播放（Shuffle）**，选中一个会自动关掉其他三个（控制条、全屏播放页与 Settings 都是同一组开关）。
  `R` 键在四种模式间循环。
- 音量：静音、平滑滑杆、跨会话记忆；Settings 可开 **Volume glide**（音量渐变）。
- **Crossfade（0–6s，可关）**：切歌时先把当前曲目音量淡出，再淡入下一首，不会有硬切爆音。
- Queue：Now Playing + Up Next，**拖拽排序**、Play Next、Add to Queue、Remove、Clear Queue。
- 歌曲列表**始终显示专辑封面** + 曲序（模板数字体）、曲名、艺术家、专辑、时长、收藏、更多。
- 键盘快捷键：`Space` 播放/暂停 · `←`/`→` 快退/快进 5s（`Shift` 上一首/下一首）· `↑`/`↓` 音量 ·
  `M` 静音 · `S` 顺序/随机切换 · `R` 顺序/单曲循环切换 · `/` 搜索 · `Esc` 关闭浮层。
- 右键菜单 / `···` 按钮：Play、Play Next、Add to Queue、Add to Playlist、Favorite、
  Go to Album、Go to Artist、Show in Folders、Remove from Library。
- 顶部常驻一枚**旋转的迷你黑胶**，显示当前专辑与播放状态。

### 删除与确认（用户添加的内容都能删掉）
所有破坏性操作都先弹出**液态玻璃确认对话框**（替代浏览器原生 `confirm`）：模糊背景、危险色描边、
取消 / 确认双按钮、支持 `Esc` 取消与 `Enter` 确认。删除**真正生效**并级联更新：
Music Library、Albums、Artists、Search、Playlists、Favorites、Recently Played 会同步移除，
不会只从界面上隐藏。

| 操作 | 入口 | 结果 |
| --- | --- | --- |
| Remove from Library | 歌曲右键 / `···` | 曲目离开库、歌单与收藏；**不动电脑上的文件** |
| Delete Local File | 上面对话框内的第二选项，**再确认一次** | 通过 File System Access `removeEntry()` 真正删除磁盘文件（仅链接文件夹中的曲目，且需读写授权） |
| Delete Album | 专辑卡右键 / `···` | 整张专辑与其全部曲目一起移除 |
| Remove Folder | Folders 页垃圾桶 | 该文件夹全部曲目移除，磁盘文件保留，并清除 IndexedDB 中的目录句柄 |
| Clear Recently Played | Recently Played / Settings → Library | 清空播放历史 |
| Remove from Playlist | 歌单详情行菜单 | 仅移出该歌单，库中保留 |
| Delete Playlist | 歌单详情 / 歌单卡 `···` | 删除歌单，歌曲保留 |
| Remove Favorite | 各处 ♥ | 取消收藏 |

删除正在播放的曲目时，播放会**干净地停止**（队列与上下文一并清理），不会出现「有声音但没有播放条」的状态。

### 设置（Settings）
分为 **Appearance / Animation / Album / Lyrics / Playback / Library / Account / Keyboard Shortcuts**：
- Appearance：主题（Dynamic / Dark / Black / Midnight / Glass）、动态专辑配色、粒子可视化（7 种，含 Off）、粒子配色（专辑封面 / 随机）、播放模式。
- Animation：界面动画总开关（关闭后同时关闭 CSS 侧的悬浮 / 聚焦模糊，并写入 `data-motion="off"`）、
  Living Background、街头材质、Skip intro、重播开场。系统 `prefers-reduced-motion` 始终优先。
- Album：全局卡片 Scale / Shadow / Reflection 滑杆、一键 Reset global、跳转到专辑墙逐个微调。
- Lyrics：字号、透明度、显示行数（1–5）、位置、对齐、行距、动画速度、逐字动画开关、高亮色、Reset。
- Playback：默认音量、Crossfade、Volume glide。
- Library：管理文件夹、清空播放历史、重置全部设置（均带确认对话框）。
- Account：修改密码、登出。

### 歌词
- 逐行高亮：当前行由模糊转为清晰、亮度提升、颜色变化与轻微缩放；其余行降透明度并加模糊。
- **逐字卡拉 OK 过渡**：当前行会被绘制两遍——暗底 + 按播放位置裁切的高亮层，高亮从句子左端
  随演唱推进到正在唱的那个字（右侧面板的两行预览同样生效）。
- 全屏播放页的字号按设置放大约 1.6 倍（默认设置下约 34px），并适当收紧行距。
- 平滑滚动（无跳变），右侧面板与全屏播放器均支持。
- **右侧面板内嵌歌词设置**（参考图的「歌词设置」）：字号、透明度、显示行数（1–5）、位置
  （Top / Center / Bottom）、**歌词动画开关**、一键 Reset，改完立刻生效。
- 可调：字号、透明度、显示句数（1–5）、位置（Left/Center/Right）、
  形态（Floating/Centered/Bottom）、行距、动画速度、高亮颜色，支持 **Reset Lyrics**。

### 账号与数据
- 注册 / 登录 / 登出 / 忘记密码（重置码流程）/ Remember me。
- **多用户数据完全隔离**：所有数据按 `noct:v1:u:{userId}:*` 命名空间存储，
   A 用户看不到 B 用户的收藏、歌单与设置。
- 每个用户独立：Music Library、Favorites、Playlists、Settings、Lyrics Preferences、
  Theme Preferences、Recently Played、Playback History。
- 密码仅以 **PBKDF2-SHA256（150,000 次迭代 + 每用户随机盐）** 形式存储；
  Remember me 保存的是随机会话令牌，而非密码。

### 歌单与导入
- 创建 / 重命名 / 删除歌单，添加 / 移除 / **拖拽排序**歌曲，顺序/随机/循环播放。
- **导入其他音乐软件歌单**：支持 JSON / M3U / M3U8 / CSV，导入后按标题+艺术家模糊匹配本地库，
  未匹配项会提示（Not Found）并允许手动处理。

### 其他
- 全局模糊搜索（实时、防抖），分类展示：Top Result / Songs / Albums / Artists / Playlists，
  支持流派与年份检索。**搜索结果同样使用统一 3D 卡片**，与浏览页无视觉割裂。
- 收藏：歌曲 / 专辑 / 艺术家；Favorites 页以 3D 歌曲卡呈现，支持播放全部、随机播放、排序、取消收藏。
- Home 仪表盘：按时间变化的问候语、Recently Added、All Albums。
- 每张专辑可单独（或全局）调整 3D 布局：X/Y/Z、Rotate X/Y/Z、Scale、Shadow、Depth、Reflection。
- 错误处理与空状态：所有失败以液态玻璃 Toast 呈现（"Unable to play this song" 等），
  每个页面都有艺术化空状态（右侧面板与底部播放条的未播放状态也做了专门设计），
  扫描时有进度浮层，不会出现空白页。

---

## 目录结构

```
 MH Music/
├─ start.bat            一键启动（优先使用内置便携版 Node）
├─ .tools/node/         便携版 Node.js
├─ public/
│  ├─ demo/            15 首程序化生成的 WAV 曲目（真实可播放）
│  └─ covers/          5 张生成式 SVG 专辑封面 + 应用图标
├─ scripts/
│  └─ generate-demo-audio.mjs   纯 Node WAV 合成器（无依赖）
└─ src/
   ├─ audio/engine.ts       HTMLAudioElement + AnalyserNode 单例，节拍检测、音量渐变与降级模拟
   ├─ components/
   │  ├─ album/             3D 封面、黑胶、专辑卡片、布局工具
   │  ├─ auth/              登录 / 注册 / 重置
   │  ├─ stage/Stage3D.tsx  统一 3D 舞台：中央大卡片 + 左右透视卡片，所有浏览入口共用
   │  ├─ intro/             黑胶开机动画（含粒子解构 Canvas）
   │  ├─ panel/             右侧面板：Now / Lyrics / Queue
   │  ├─ player/            Now Playing 全屏 3D 空间（ParticleField 音乐可视化 · 7 种模式）
   │  ├─ search/            全局搜索浮层（结果同样用 3D 卡片）
   │  ├─ shell/             AppShell / Sidebar / TopBar / ControlBar / MobileNav / ScanOverlay
   │  ├─ views/             Home / Browse / Albums / Artists / Songs / Favorites /
   │  │                     Playlists / Recent / Folders / Settings 及各详情页
   │  ├─ ConfirmDialog.tsx  液态玻璃确认对话框
   │  └─ confirmActions.ts  所有删除操作的统一确认入口
   ├─ data/demo.ts          演示曲库与 LRC 歌词
   ├─ hooks/                useTheme / useTilt / useHotkeys / useMedia / useAudioReactive
   ├─ lib/                  颜色与主题引擎、LRC 解析、模糊搜索、ID3/FLAC/M4A 解析、
   │                        IndexedDB、封面生成、工具函数
   ├─ services/             存储命名空间、认证（PBKDF2）、文件夹扫描、歌单导入
   ├─ stores/               auth / library / player / settings / ui（Zustand）
   ├─ styles/index.css      设计系统：玻璃材质、卡片墙、粒子、主题变量、响应式与 reduced-motion
   └─ types/models.ts       全部数据模型
```

## 数据模型

`User` · `Song` · `Album` · `Artist` · `Playlist` · `Favorite` · `MusicFolder` ·
`PlaybackHistory` · `Settings`（含 Lyrics Preferences、Theme Preferences、AlbumLayout）·
`LyricLine` · `QueueItem` — 全部通过 `userId` 隔离（见 `src/types/models.ts`）。

---

## 浏览器限制与降级（如实说明）

| 能力 | 实现情况 |
| --- | --- |
| 文件夹直接访问 | 使用 File System Access API（Chrome / Edge）。目录句柄存入 IndexedDB，刷新后需点击 **Rescan** 重新授权（浏览器要求用户手势）。Firefox / Safari 自动降级为目录选择上传。 |
| 上传文件持久化 | 选中的文件（`input` 方式）会以 Blob 存入 IndexedDB，刷新后自动恢复播放；受浏览器存储配额限制，配额不足时会提示但仍可用于当前会话。 |
| 音频可视化 | 使用 Web Audio `AnalyserNode`。若 AudioContext 被策略阻止，自动降级为基于播放进度的模拟律动，UI 依然「呼吸」。 |
| 其他音乐 App 歌单 | 浏览器无法读取其他 App 的私有数据，因此实现为**文件导入**（JSON / M3U / M3U8 / CSV）+ 本地匹配。若未来接入第三方 API，走 OAuth 授权（见下方接口预留）。 |
| 本地文件播放 | 通过 `blob:` URL 播放；上传文件由 IndexedDB 重建，链接文件夹由目录句柄重建。文件被移动/删除时播放会给出 Toast 提示而不是静默失败。 |
| 崩溃保护 | 全局 ErrorBoundary：任何渲染异常都会显示「The needle skipped」恢复界面（可重试或重置视觉状态），不会留下黑屏。 |
| 密码与会话 | 当前为**本地 Mock 认证**（WebCrypto PBKDF2 哈希 + 随机会话令牌）。生产环境必须替换为服务端认证（见下）。 |

## 接入真实后端的预留点

认证服务的公开接口（`src/services/auth.ts`）与 HTTP API 一一对应，替换实现即可，UI 无需改动：

```
POST /api/auth/register      → register(name, email, password)
POST /api/auth/login         → login(email, password, remember)
POST /api/auth/logout        → logout()
POST /api/auth/reset/request → requestResetCode(email)
POST /api/auth/reset/confirm → resetPassword(email, code, newPassword)
POST /api/auth/password      → changePassword(uid, current, next)
GET  /api/auth/session       → readSession()
```

生产环境应改为：服务端哈希（bcrypt/argon2）、HTTP-only Secure Cookie 会话、
限流与验证码、邮件投递重置码；数据层把 `src/services/storage.ts` 的
per-user localStorage 命名空间替换为带 `userId` 作用域的数据库访问层
（User / Song / Album / Playlist / Favorite / MusicFolder / PlaybackHistory / UserSettings 表结构
与 `src/types/models.ts` 一致）。

---

## 演示曲库

`scripts/generate-demo-audio.mjs` 是一个纯 Node 合成器：为每张专辑生成 pad、bass、琶音、
鼓组与钢琴，输出 22050Hz / 16-bit WAV（共 15 首、约 28MB，已随仓库提供）。
每张专辑有独立的调式、和声进行与音色，便于体验动态主题、律动与歌词同步。
