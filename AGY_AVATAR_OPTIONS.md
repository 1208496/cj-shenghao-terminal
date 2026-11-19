# 随机头像 + 图床：可选方案（AGY · 2026-11-18）

> 对应 `想法池/未实施想法.md` 第 01 条。本文只列方案和取舍，**不改任何源码**。执行由 YG 选定方案后交 DSH。
> 适用版本：2.0.0-rc.30（`cardContractRevision` 26）。玩家发行状态：**未发行**，所以不做旧存档兼容。

---

## 0. 先摸清的现状（只读核对结果）

| 位置 | 现状 | 对本功能意味着什么 |
|---|---|---|
| `src/ui/app.js:96` `image(pid,slot,alt)` | 只从 `imageCache[chatKey:pid:slot]` 取 URL，已带 `loading="lazy"`、`referrerpolicy="no-referrer"` | 随机头像插在这里最省事；`no-referrer` 已在，CDN 拿不到酒馆地址 |
| `src/ui/app.js:97` `avatar(c)` | `<div class="avatar">` + 图片或姓名首字 | 优先级应为：**玩家手动上传 > 随机头像 > 首字** |
| `src/ui/app.js:137-141` `mediaStore / loadMedia / wireImages / imageEditor` | 手动头像存在 IndexedDB `images`，按聊天隔离；`img` 出错时退回首字 | 加载失败兜底已有，只需在“退回首字”前先换下一个 CDN host |
| `src/runtime/host.js:23-24, 268` | `prefs` 存 `localStorage['cj-shenghao:ui:v3:'+branch()]`，**按聊天分支隔离**；`api.preferences(patch)` 写盘并 `publish()` | 现有设置项其实都是“每个聊天一份”；要做全局开关得另开键 |
| `src/ui/app.js:217` `receive()` 的 `signature` | 只列了 `theme / phoneSize…` 等若干 prefs 字段，变了才重绘 | 新开关字段**必须加进 signature**，否则切换后不立即生效 |
| `src/ui/screens.js:110` `settings()` | 检测更新 / 显示位置 / 手机尺寸 / 字体大小 / 外观主题 / 已隐藏人物 | 新增一行“随机头像”，沿用 `settingrow + choice-row + chip` 样式 |
| `src/runtime/schema.js:26` | `avatarRef: short.nullable().default(null)`，`short = z.string().max(150)` | 能存一个短 ID，不改 schema |
| `src/core/engine.js:586` | 新人物建档时 `avatarRef:null` | 可在建档时由脚本播种 |
| `src/runtime/settlement.js:62` | 结算时 `avatarRef` 强制取旧值，模型写不进去 | 模型无法篡改，安全；但脚本要写也得走这里之外的确定性路径 |
| `src/runtime/settlement.js:93` | 某分支把 `avatarRef` 重置为 `null` | 若用 `avatarRef` 存配对结果，DSH 要确认该分支是否该保留 |
| `src/core/engine.js:1104-1111` 投影 | 白名单投影，`avatarRef` 不进模型上下文 | 头像信息不会喂给模型，也不占 token |
| `src/update/release-contract.js` | `CDN_HOSTS = testingcf / fastly / cdn`，`cdnUrl` 只允许 `c.file` 和 `c.metadataFile` 两个文件 | 头像 URL **不能**直接复用 `cdnUrl`，要另写一个白名单函数 |
| `src/runtime/script-loader.js` | 热更新按指针取 `dist/terminal.js`，校验 sha256，长度上限 3,000,000 字节；`worldbookHash` 不一致才要求重导整卡 | 只改 JS、不动世界书/正则/开场白 → 走热更新，**不用重导卡** |
| 现有体积 | `terminal.js` 359,758 B；整卡 JSON 733,255 B（内嵌一份 runtime 作兜底） | 方案三的内联体积要算进 3 MB 上限 |
| 用户颜值分档 `beautyTier` | `<20 / 20–49 / 50–69 / 70–89 / ≥90` | 这是**玩家**的颜值档；人物头像分档以 YG 实际的分组为准，写进清单，不在代码里写死 |

---

## 1. 三个方案共用的部分（流水线 + 规格 + 清单）

三个方案的差别在“图放哪、清单怎么到前端、配对结果存哪、开关怎么做”。图片裁切、命名和清单格式是共用的，先统一写在这里。

### 1.1 图片规格

| 项 | 取值 | 理由 |
|---|---|---|
| 尺寸 | **192×192**，正方形，脸部居中，头顶留约 8% 空白 | 列表头像 44px、玩家头像 46px，3 倍屏需要 132px，192 留余量；详情页需要大图时另行设计 |
| 格式 | **WebP**，质量 78–82，去掉全部元数据 | 酒馆运行环境都是现代浏览器，WebP 都支持；同画质比 JPEG 小 30% 左右 |
| 单张体积 | 目标 **8–14 KB**，硬上限 20 KB（超了就降质量重压） | |
| 总量预估 | 5 档 × 每档 12–20 张 = 60–100 张 → **0.6–1.4 MB** | 远低于 jsDelivr 单仓 150 MB、Cloudflare Pages 2 万文件的限制 |
| 元数据 | **必须清空 EXIF / PNG tEXt** | SD/ComfyUI 出的 PNG 会把完整提示词写进元数据，原样上传就等于把生图咒语公开 |

### 1.2 目录与命名

```
assets-src/avatars/grids/            ← 宫格原图，只放本地，加进 .gitignore，不进公开仓
  b1/ grid-01.png …                  ← 文件夹名 = 颜值分档 ID
  b2/ …
assets/avatars/                      ← 裁切压缩后的成品（方案一、二进仓；方案三只作构建输入）
  b1/b1-0001.webp
  b3/b3-0007.webp
  manifest.json
tools/avatars/build-avatars.mjs      ← DSH 写的裁切/压缩/清单脚本（Node + sharp，开发依赖）
```

命名规则：`{分档ID}-{四位流水号}.webp`。

- 流水号**只增不复用**。删掉的图在清单里标 `retired`，号码不给下一张用。
- **已发布的文件不得原地覆盖**。要换就发新号，避免 CDN 缓存旧图、清单 sha256 对不上。
- 分档 ID 用 `b1…b5` 这种中性编号，不用“丑/美”之类的词。URL 是公开的，这样命名也不会把档位含义暴露出去。

### 1.3 清单文件 `assets/avatars/manifest.json`

```json
{
  "schema": 1,
  "version": "2026.11.18-1",
  "assetRef": "<包含这批图片的 40 位 commit SHA>",
  "basePath": "assets/avatars",
  "tiers": [
    { "id": "b1", "min": 1,  "max": 19  },
    { "id": "b2", "min": 20, "max": 49  },
    { "id": "b3", "min": 50, "max": 69  },
    { "id": "b4", "min": 70, "max": 89  },
    { "id": "b5", "min": 90, "max": 100 }
  ],
  "items": [
    { "id": "b3-0007", "tier": "b3", "file": "b3/b3-0007.webp", "bytes": 11234, "sha256": "…", "retired": false }
  ]
}
```

- `tiers` 区间由 YG 的实际分组决定，必须覆盖 1–100、不能重叠（脚本校验）。
- `assetRef` 必须是 commit SHA，不能写分支名。jsDelivr 按 commit 取的文件可以永久缓存，按分支取的会有缓存延迟。
- 方案三不需要 `assetRef / basePath`，`file` 换成内联的 `data`（见方案三）。

### 1.4 DSH 流水线（共用）

1. 读 `assets-src/avatars/grids/<档>/*.png`，按 YG 告知的宫格行列数（如 3×3）等分裁切。要么在脚本参数里给 `--grid 3x3`，要么每个文件夹放一个 `grid.json` 写明行列和外边距。
2. 每格先按人脸居中裁成正方形（宫格本身是正方形格子就直接取格子，不做人脸检测）→ 缩到 192 → WebP q80 → 清空元数据。
3. 单张超过 20 KB 就降到 q72 再压一次；还超就报错，由人工看图。
4. 与已有清单比对：内容相同（sha256 一致）跳过，新图发下一个流水号。
5. 写 `manifest.json`，并自检：每档至少 1 张、区间覆盖 1–100、无重号、所有 `file` 都存在。
6. 发布：方案一、二提交图片，拿到 commit SHA 后回填 `assetRef`；方案三直接进构建。
7. **加图**：把新宫格放进对应档文件夹，重跑脚本，只会追加新号。之后的发布步骤因方案而异（见各方案第 3 点）。

### 1.5 配对算法的共用部件

- **种子**：`chatSeed = state.meta.initKey`（每局开局唯一），`charSeed = chatSeed + ':' + c.id`。哈希沿用 `engine.js` 里 `seedInnerLife` / `pick()` 已在用的确定性哈希（FNV-1a 一类），**不引入新的随机源**。
- **选档**：`c.beautyScore` 落在哪个 `tier` 区间就用哪档。`beautyScore == null`（详情显示“尚未记录”）时**不配图**，显示首字，等颜值记录下来再配。
- **档内选图用 HRW（最高随机权重）**：对档内每张未退役的图算 `hash(charSeed + ':' + item.id)`，按分数从高到低排，取第一张没被本局其他人占用的。好处是以后给该档加图时，大部分人的头像不会变，只有新图恰好分数更高的少数人会换。
- **防撞图**：本局所有人物（含 `HIDDEN`，避免恢复后撞图）按稳定顺序（`s.characters` 插入顺序，即建档先后）依次分配，已占用的图跳过。新人物总排在最后，不会把老人物挤掉。
- **某档没图 / 档内全被占**：
  1. 先去**相邻档**找，优先离该人物分数更近的一侧（例如 68 分先找 b4 再找 b2）；
  2. 全部档都占满了，就允许撞图，在原档里选**被占用次数最少**的那张；
  3. 清单为空或加载失败，显示姓名首字（现有行为）。
- **手动头像永远优先**：`imageCache` 里有玩家自己上传或填写的链接，就不显示随机头像。玩家点“移除”后回到随机头像（开关开着时）。

---

## 方案一：主仓同发，清单编译进终端脚本

**一句话**：头像放进现在的 `1208496/cj-shenghao-terminal` 仓库，走现有三个 jsDelivr host；清单在构建时编进 `terminal.js`；配对每次现场算，不存任何地方。

### 1）图床选型
- **托管**：现有 GitHub 公开仓 `1208496/cj-shenghao-terminal`，路径 `assets/avatars/`。
- **线路**：`https://{host}/gh/1208496/cj-shenghao-terminal@{assetRef}/assets/avatars/{file}`，host 依次试 `testingcf.jsdelivr.net → fastly.jsdelivr.net → cdn.jsdelivr.net`，和终端本体用同一组线路。
- **国内外可用性**：testingcf / fastly 在国内实测可用；`cdn.jsdelivr.net` 在国内有 DNS 污染史，放在最后。海外三个都可用。
- **免费额度与硬限制**：jsDelivr 不限流量（按合理使用原则）。官方限制：GitHub 来源单文件 ≤ 20 MB，单个仓库/包 ≤ 150 MB，建议活跃文件 ≤ 1 万个。GitHub 仓库建议 ≤ 1 GB、单文件 ≤ 100 MB。头像总量约 1 MB，离这些上限差两到三个数量级。
- **额度用尽怎么降级**：正常不会碰到上限。如果 jsDelivr 判定滥用并屏蔽该仓库，头像全部加载失败、退回首字，同时**终端本体的热更新也会受影响**（见风险）。

### 2）图片规格
按 §1.1：192px WebP，单张 8–14 KB，共 60–100 张，约 0.6–1.4 MB。

### 3）链接怎么存
- 卡里**不存任何头像链接**。`assets/avatars/manifest.json` 在 `npm run build` 时由构建脚本读进去，生成 `src/ui/avatar-manifest.generated.js`（只含 `assetRef`、`tiers`、`items[id,tier,file]`），打包进 `terminal.js`。
- URL 在前端拼出来：新增 `avatarCdnUrl(host, assetRef, file)`，校验 `assetRef` 是 40 位 SHA、`file` 匹配 `^b\d+/b\d+-\d{4}\.webp$`。不改动现有 `cdnUrl` 的白名单。
- **换图 / 加图**：DSH 跑流水线 → 提交图片 → 回填 `assetRef` → 重新构建 → 推送 → 切作者测试指针。也就是走一遍 HANDOFF 里约定的“发布到 GitHub”流程。**不用重导卡**：没动世界书、开场白、正则，`worldbookHash` 不变，热更新就能拿到。
- 卡内嵌的那份兜底 runtime 不含新清单。热更新失败、回落到卡内版本时，没有随机头像，显示首字，不会报错。

### 4）开关设计
- **位置**：只放小手机设置页 `screens.js` `settings()`，加在“外观主题”上面一行：“随机头像　[开] [关]”，说明文字写“按颜值从头像库配图，手动上传的头像优先”。
- **默认**：**开**。图很小，失败也只是退回首字，默认开能让玩家第一眼看到效果。
- **状态存哪**：现有 `prefs`（`localStorage['cj-shenghao:ui:v3:'+branch()]`），字段 `randomAvatar: true|false`，缺省视为 `true`。注意现有 prefs 是**每个聊天分支一份**，所以这个开关也是每个聊天单独记。要做全局开关就改用方案三的独立键。
- **立即生效**：`app.js` 点击处理加 `if(d.randomAvatar){api.preferences({randomAvatar:d.randomAvatar==='on'});phone();}`，并把 `v.prefs.randomAvatar` 加进 `receive()` 的 `signature` 数组。`avatar(c)` 每次渲染都读这个开关，切换后当场重绘，不用刷新。

### 5）随机配对
- **确定性哈希，不存储**：每次渲染按 §1.5 现场算一遍（人物不多，计算量可以忽略），结果缓存在内存 `Map`，`revision` 变化时清空。
- 同一局、同一份清单，在任何设备、任何浏览器上算出来都一样，换设备打开也是同一张脸。
- **代价**：人物颜值跨档（例如 `beautyScore` 从 69 变到 70）时会换头像；某档加图后，少数人会换到新图（HRW 已把影响降到最小，但不是零）。
- 防撞、兜底按 §1.5。

### 6）落地成本
- **要改的文件**：
  - 新增 `src/ui/avatar-pool.js`（选档 + HRW + 防撞 + URL 拼接，约 80 行纯函数）
  - 新增 `tools/avatars/build-avatars.mjs`、`src/ui/avatar-manifest.generated.js`（构建产物）
  - 改 `src/ui/app.js`：`avatar(c)` 调用 avatar-pool；`wireImages` 的 `error` 处理先换下一个 host，三个都失败再退回首字；点击处理和 `signature`
  - 改 `src/ui/screens.js`：`settings()` 加一行
  - 改构建脚本：读入清单
  - 改 `.gitignore`：忽略 `assets-src/`
  - 新增单测 `tests/avatar-pool.test.mjs`（选档边界、空档兜底、防撞、HRW 加图稳定性、null 颜值）
- `style.css` **基本不用改**：`.avatar img{object-fit:cover}` 已有。只建议给 `.avatar img` 加 `background` 占位色，避免加载时闪白。
- **重发卡**：不需要，热更新即可。
- **后续维护**：每次加图都要走一次完整发版（构建 + 推送 + 切指针）。图和代码的版本绑在一起，回滚终端版本时头像清单也跟着回滚，不会出现代码和清单对不上的情况。

### 7）风险
- **CDN 被墙**：头像和终端本体走同一组 host。真被墙时终端本身也加载不了，头像不会单独出问题。反过来说，也没有额外的备用线路。
- **图片失效 / 误删**：按 commit SHA 取文件，仓库里后来删了，jsDelivr 通常仍有缓存，但不保证。所以规定**只退役、不删除**。加载失败会退回首字，不会裂图。
- **卡体积**：卡不变；`terminal.js` 只多出清单（100 条约 5 KB）和约 3 KB 代码。
- **隐私 / 合规**：
  - 头像和卡在同一个公开仓库，看到头像 URL 的人能直接找到卡的源码。不过仓库本来就是公开的，这一点不算新增暴露。
  - **jsDelivr 条款禁止色情内容，也禁止把它当通用图床。** 头像必须是穿着得体的正常面部图。在“分发项目自带资源”的前提下使用，被判为滥用的概率低。但一旦被判，连带的是**整个主仓**，热更新也会受影响，这是本方案最大的单点风险。
  - 配对结果只在本地计算，不上传；`no-referrer` 已开，CDN 只能看到玩家 IP，看不到酒馆地址。

**什么情况下选它**：图片数量基本固定、一个季度加不了几次图，并且希望改动最少、版本最好管、不想多维护一个仓库或一张配置表时。

---

## 方案二：独立头像仓 + 远程清单 + 双线路，配对结果写进 `avatarRef`

**一句话**：头像单独放一个公开仓，jsDelivr 为主线路、Cloudflare Pages 为备用线路；清单运行时远程拉取，版本指针放进现有 Supabase 配置表；每个人物的配对结果由脚本写进 MVU 的 `avatarRef`，跟着聊天走、一旦确定就不再变。

### 1）图床选型
- **托管**：新建公开仓 `1208496/cj-shenghao-avatars`，带 README 和开源许可（如 CC BY-NC 4.0），满足 jsDelivr 对仓库要有“正常项目形态”的要求。仓库只放 `avatars/` 和 `manifest.json`，不放卡内容。
- **主线路**：jsDelivr `https://{host}/gh/1208496/cj-shenghao-avatars@{assetRef}/avatars/{file}`，三个 host 顺序同方案一。
- **备用线路**：Cloudflare Pages 免费版，直接连这个 GitHub 仓库自动部署，`https://cj-shenghao-avatars.pages.dev/avatars/{file}`。
- **国内外可用性**：jsDelivr 同方案一。`pages.dev` 海外很稳，国内时好时坏（有 DNS 污染和限速报告），**只能当第二道保险，不能当主线路**。
- **免费额度与硬限制**：
  - jsDelivr：同方案一（单文件 20 MB、单仓 150 MB）。
  - Cloudflare Pages 免费版：每站 2 万个文件、单文件 25 MiB、静态流量不限、每月 500 次构建。加图一次算一次构建，每月 500 次不可能用完。用完会怎样：当月不再自动部署，备用线路停在旧版本，主线路不受影响。
  - Supabase：只多读一行配置，用的是现有的公开读取键（publishable key）读法，不新增密钥。免费项目长期不活跃会被暂停，暂停后读不到指针，前端改用**构建时写死的 `fallbackAssetRef`**（和现有 `fallbackRef` 同一个思路）。
- **不需要任何新密钥**：Cloudflare Pages 用 YG 的 GitHub 授权连仓，前端只读公开 URL。

### 2）图片规格
同 §1.1。另外每个 `item` 加 `w/h` 字段，以后加 384px 的详情大图时不用改清单结构。

### 3）链接怎么存
- **卡里**：不存图片 URL。`release/loader.config.json` 的同级位置（或构建常量）加一项 `avatarRepository: "1208496/cj-shenghao-avatars"` 和 `fallbackAssetRef`。
- **清单指针**：Supabase 表 `cj_shenghao_script_config` 加一个键 `cj_shenghao_avatars_ref`，值为头像仓的 commit SHA，复用现有指针读取代码 `pointer()` 的模式。
- **清单本体**：运行时取 `https://{host}/gh/1208496/cj-shenghao-avatars@{ref}/manifest.json`，限制 ≤ 64 KB，校验 `schema` 和 `items[].file` 格式。拿到后在 `localStorage['cj-shenghao:avatars:manifest']` 缓存一份，并记下 ref，下次先用缓存渲染、后台再刷新。
- **每个人物的配对结果**：写进 MVU `characters[id].avatarRef`，值是短 ID，例如 `"av1:b3-0007"`（`av1` 是格式版本，最长约 12 字符，远小于 150）。**只存 ID，不存 URL**，以后换 host 或换线路都不影响存档。
- **换图 / 加图**：DSH 往头像仓推图 → 改 Supabase 里那一行的 SHA。**不重新构建 `terminal.js`，不切终端指针，不重导卡。** 这是本方案相对方案一的主要好处。

### 4）开关设计
- **位置**：两处都放。
  1. **开局表单**：放在最后一步，开局摘要上方，一个勾选项“为人物随机配头像（需联网加载图片）”。
  2. **设置页**：一行“随机头像　[开] [关]”，和开局选项是同一个状态，开局后可以随时改。
- **默认**：**关**。原因：本方案要多访问两个外部服务（Supabase、Pages），首次加载有网络请求；成人向卡默认不主动去拉外部图片，让玩家自己勾选。
- **状态存哪**：开局时写进现有 `prefs` 的 `randomAvatar`（开局草稿阶段写进 `draftStore`，正式开局后由 `api.preferences` 落盘）。和方案一一样是每个聊天一份，符合“这一局要不要头像”的语义。
- **立即生效**：同方案一（点击处理加 `phone()` + `signature` 加字段）。**关闭时不清空 `avatarRef`**，只是不显示；重新打开，还是原来那张脸。

### 5）随机配对
- **确定性挑选 + 写入后固定**：
  - 人物第一次进入 `RECORDED` 且 `beautyScore` 不为 null，而清单已加载时，按 §1.5 算出图片 ID，**在下一次正常结算时**由脚本写入 `avatarRef`（`settlement.js` 里只有脚本能写这个字段，模型写不进去，第 62 行已经保证）。
  - 写入之前，前端用同一算法现场算结果来显示，所以写入前后看到的是同一张图，不会闪。
- **写入后就固定**：之后颜值跨档、给该档加图、某张图退役，都**不改** `avatarRef`。只有一种例外：它指向的图 `retired` 了，前端按同一算法临时选一张替代来显示，下次结算再写回新 ID。
- **防撞**：分配时把本局所有人物已有的 `avatarRef` 都算作已占用，再从清单里选。
- **兜底**：同 §1.5。另外：`avatarRef` 指向的 ID 不在当前清单里（例如清单回滚了），按“退役”处理。
- **刻意不在 UI 渲染时直接调用 `mutateState`**：HANDOFF rc.30 记录的问题一说明了，界面操作写进的是最后一条消息的变量，回退楼层会被悄悄撤销。所以写入搭在正常结算的顺风车上；回退楼层后 `avatarRef` 变回 null 也没关系，算法是确定性的，下次会算出同一个 ID 再写回去。
- 需要 DSH 确认 `settlement.js:93` 把 `avatarRef` 置 null 的那条分支是在什么场景触发的。如果是“恢复已隐藏人物”，应改为保留 `avatarRef`。

### 6）落地成本
- **要改的文件**：
  - 新增 `src/ui/avatar-pool.js`（同方案一，加“读已有 avatarRef”）
  - 新增 `src/runtime/avatar-manifest.js`（取指针、取清单、多 host + Pages 回退、本地缓存、校验）
  - 改 `src/update/release-contract.js`：加一个独立的 `avatarUrl()` 白名单函数，不动原有 `cdnUrl`
  - 改 `src/runtime/settlement.js`：结算末尾给 `avatarRef` 为空、且符合条件的人物补写
  - 改 `src/runtime/host.js`：在 `stateView` 里把清单交给 UI
  - 改 `src/ui/app.js`：`avatar(c)`、`wireImages`、点击处理、`signature`
  - 改 `src/ui/screens.js`：设置页一行
  - 改开局表单模板 `setup.template.html` 及 `app.js` 开局最后一步（加勾选项）
  - 改 `release/loader.config.json`（或构建常量）
  - 新增单测：清单校验、回退顺序、写入后不变、退役替换、回退楼层后重算出同一个 ID
- **外部配置**：新建头像仓；Cloudflare Pages 连仓（一次性，在网页上操作）；Supabase 加一行。
- **重发卡**：代码改动走热更新。但如果开局表单的勾选项要在**新开的聊天**里出现，内嵌的开局页走的是卡内版本还是热更新版本，需要 DSH 核对；若是卡内版本，就要重导一次卡（世界书没动，只是让新开局页生效）。
- **后续维护**：加图只动头像仓和一行 Supabase，最省事。但要多维护一个仓库、一个 Pages 站点和一个指针键，出问题时排查链路最长。

### 7）风险
- **CDN 被墙**：jsDelivr 被墙时还有 Pages 备用。两者都不通时，已写入的 `avatarRef` 不会丢，只是暂时显示首字，网络恢复后自动回来。头像仓和主仓分开，**头像仓被 jsDelivr 屏蔽不会连累终端热更新**，这是本方案最大的安全优势。
- **图片失效 / 误删**：只退役不删除；Pages 每次部署的是仓库全量，误删的文件会在下次部署时从 Pages 上消失，但 jsDelivr 按旧 SHA 仍可能有缓存。误删后从 Git 历史恢复即可。
- **卡体积**：卡不变；`terminal.js` 多约 5 KB 代码；MVU 变量里每个人物多约 12 字节。
- **隐私**：
  - 头像仓里只有头像，和卡内容的关联最弱（仓库名可以起得中性一些，比如 `cj-faces`）。
  - `avatarRef` 不进模型投影（白名单），也不会出现在正文里。
  - 玩家每次开局都会向 Supabase 发一次读请求（现在热更新本来就会发）。
  - 合规要求同方案一：头像必须是正常面部图。

**什么情况下选它**：头像库会持续扩充、希望加图不碰发版流程，并且看重“同一个人物在这局里一直是同一张脸”和“头像仓出事不连累终端”时。

---

## 方案三：零图床，小图内联进终端脚本

**一句话**：不用任何图床。构建时把压缩后的小头像转成 Base64 打进 `terminal.js`，头像能不能显示，取决于终端本体能不能加载；配对用“真随机 + 本地锁定”，并给玩家一个“换一张”按钮。

### 1）图床选型
- **托管**：没有单独的图床。图片打包进 `dist/terminal.js`，跟着现有的 jsDelivr 热更新一起下发（终端本体本来就是这么下发的）。
- **国内外可用性**：和终端本体完全一样，**终端能打开，头像就一定能显示**，不存在单张图片加载失败。
- **免费额度与硬限制**：
  - 不新增任何外部额度。
  - 硬限制是 `script-loader.js` 规定的 `terminal.js` ≤ **3,000,000 字节**。现在是 359,758 字节。
  - Base64 会让体积变大约 1/3，所以**图片要更小**（见第 2 点）。
  - 上限预算：留 1 MB 给以后的代码增长，最多约 **1.6 MB 用于头像**，大约 140 张 128px 头像。
- **额度用尽怎么降级**：超过预算时构建脚本**直接报错**，不输出产物。这时要么每档减少图片，要么降到 96px，要么改用方案一或方案二。

### 2）图片规格
- **128×128**，WebP q72，清空元数据，单张目标 **5–8 KB**，转 Base64 后约 7–11 KB。
- 44px 头像在 3 倍屏上需要 132px，128px 只是略低，肉眼基本看不出来。
- 总量：60 张约 0.55 MB，100 张约 0.9 MB。`terminal.js` 会从 0.36 MB 涨到 **0.9–1.3 MB**。
- **不建议放进卡本体**（PNG/JSON）：卡 JSON 已有 733 KB，再塞 1 MB，导入会变慢，而且每次加图都要重导卡，还得提升契约版本号。所以本方案只内联进热更新脚本。

### 3）链接怎么存
- **没有链接**。构建脚本把 `assets/avatars/*.webp` 转成 `src/ui/avatar-pack.generated.js`：`export const AVATAR_PACK={schema:1,version,tiers:[…],items:[{id,tier,data:'data:image/webp;base64,…'}]}`。
- `image()` 直接输出 `data:` URL，不发任何网络请求。
- `assets/avatars/` 只作构建输入，**可以不进公开仓库**。成品只存在于构建出的 `terminal.js` 里，图片没有单独的地址可以访问。
- **换图 / 加图**：跑流水线 → 构建 → 推送 → 切指针，流程同方案一，同样不用重导卡。

### 4）开关设计
- **位置**：设置页一行“随机头像　[开] [关]”，外加一个人物详情页的小按钮（见第 5 点）。
- **默认**：**开**。不联网、不会裂图、对隐私也没有额外影响，没有理由默认关闭。
- **状态存哪**：开关做成**全局**的，新开键 `localStorage['cj-shenghao:ui:global']` 存 `{randomAvatar:true}`。理由是“要不要显示随机头像”属于玩家个人偏好，不该每开一局都设置一遍。
  - 实现上：`host.js` 的 `stateView()` 把全局键合并进 `prefs`；`api.preferences` 遇到 `randomAvatar` 时写全局键，而不是分支键。
  - 这会和现有“每个聊天一份”的设置项并存，设置页说明文字要写明“对所有聊天生效”。
- **立即生效**：同方案一（点击处理加 `phone()` + `signature` 加字段）。

### 5）随机配对
- **真随机 + 本地锁定**：人物第一次需要头像时，用 `crypto.getRandomValues` 从对应档里随机选一张**本局还没人用的**图，把 `{charId: itemId}` 存进当前分支 prefs 的 `avatarPicks`（借用现有按聊天隔离的存储）。之后一直用这张。
- **“换一张”按钮**：在人物头像编辑弹窗 `imageEditor()` 里加一个“🎲 换一张随机头像”，只在同档未被占用的图里重新抽，结果写回 `avatarPicks`。这满足“随机”的字面意思，玩家不喜欢可以自己换。
- **防撞**：抽图时排除本局 `avatarPicks` 里已经出现的 ID。
- **兜底**：同 §1.5（相邻档 → 允许撞图 → 首字）。
- **代价**：`avatarPicks` 存在浏览器本地，**换设备、换浏览器或清理缓存后会重新抽**，和手动上传的头像一样不跨设备（现有提示语“图片保存在当前浏览器，不随聊天跨设备同步”已经说明了这一点）。如果希望跨设备也一致，可以把“真随机”换成 §1.5 的确定性 HRW，并把 `avatarPicks` 只用来记录“换一张”的结果。这是本方案里可以选择的一个变体。

### 6）落地成本
- **要改的文件**：
  - 新增 `src/ui/avatar-pool.js`（选档 + 随机抽取 + 防撞）
  - 新增 `tools/avatars/build-avatars.mjs`（多一步：转 Base64、生成 pack、检查体积预算）
  - 新增 `src/ui/avatar-pack.generated.js`
  - 改 `src/runtime/host.js`：全局偏好键的读写合并
  - 改 `src/ui/app.js`：`avatar(c)`、`imageEditor()` 加“换一张”、点击处理、`signature`
  - 改 `src/ui/screens.js`：设置页一行
  - 改构建脚本
  - 新增单测：体积预算、抽取不撞图、锁定后不变、换一张、全局键合并
- `wireImages` 不用改（不存在网络失败）。
- **重发卡**：不需要。
- **后续维护**：没有外部服务要维护。但每加一批图，`terminal.js` 都会变大，热更新首次下载变慢（1 MB 左右，在 jsDelivr 上一般 1–3 秒），并且要一直盯着 3 MB 预算。

### 7）风险
- **CDN 被墙**：和终端本体同生共死，没有单独的头像故障。
- **图片失效 / 误删**：不可能出现。图片就在脚本里，回滚终端版本时图片也跟着回滚。
- **体积**：卡不变，但 `terminal.js` 涨 2.5–3.5 倍。每次打开聊天都要校验 sha256，开销跟着变大（1 MB 量级感觉不到）。如果以后头像库扩到几百张，本方案就不适用了。
- **隐私**：
  - 三个方案里最好：图片**没有单独的公开地址**，`assets/avatars/` 也可以不进仓库，加载头像不发任何网络请求，CDN 连“谁在看哪张头像”都看不到。
  - 但 `terminal.js` 本身是公开的，有人愿意的话可以从里面解出全部头像。
  - 合规：图片不再是 jsDelivr 上能直接访问的单独媒体文件，被判为“当图床用”的风险最低。但内容依然随公开仓分发，仍然要求是正常面部图。

**什么情况下选它**：头像库规模可控（≤ 140 张），最在意“国内能不能稳定显示”和隐私，并且愿意用 `terminal.js` 变大来换零外部依赖时。

---

## 横向对比

| 维度 | 方案一 主仓同发 + 编译清单 | 方案二 独立头像仓 + 远程清单 + avatarRef | 方案三 零图床内联 |
|---|---|---|---|
| 图床 | 现有主仓 + jsDelivr 三个 host | 独立公开仓 + jsDelivr，Cloudflare Pages 备用 | 无，Base64 打进 `terminal.js` |
| 存链接方式 | 构建时把清单编进 `terminal.js`，前端拼 URL | Supabase 存清单 SHA，运行时拉清单；`avatarRef` 存图片 ID | 不存链接，`data:` URL 在脚本里 |
| 加图要做什么 | 完整发版（构建 + 推送 + 切指针） | 推头像仓 + 改一行 Supabase | 完整发版（构建 + 推送 + 切指针） |
| 要不要重导卡 | 不用 | 代码不用；开局勾选项可能需要（待 DSH 核对） | 不用 |
| 开关位置 / 默认 | 设置页 / 开 / 每个聊天一份 | 开局表单 + 设置页 / 关 / 每个聊天一份 | 设置页 / 开 / 全局 |
| 配对策略 | 确定性 HRW，现场算，不存储 | 确定性 HRW 选出后写进 `avatarRef`，之后固定 | 真随机 + 本地锁定，可“换一张” |
| 跨设备一致 | 是（同一份清单下） | 是（跟着聊天变量走） | 否（变体可以做到） |
| 颜值跨档或加图后 | 少数人会换脸 | 不变 | 不变 |
| 国内可用性 | 同终端本体 | 同终端本体，另有一条不太稳的备用线路 | 同终端本体，且不会出现单张图片失败 |
| 维护成本 | 低（一个仓库、一条流程） | 中（多一个仓库、一个 Pages 站点、一个指针键） | 低（但要盯体积预算） |
| 主要风险 | jsDelivr 若屏蔽主仓，会连带终端热更新 | 链路最长、排查最难；Supabase 暂停时只能用写死的保底 SHA | `terminal.js` 变大，图片规模有上限 |

### 我的倾向：**方案二**，次选方案三

理由：

1. **隔离风险**：成人向卡的头像放在 jsDelivr 上，最坏的情况是被判违规后屏蔽整个仓库。方案一把头像和终端本体放在同一个仓库，一旦出事，热更新也一起失效，这个代价太大。方案二把头像放到单独的仓库，出事只影响头像。
2. **人物的脸固定不变**：这张卡里人物的颜值会被剧情改写（结算会动 `beautyScore`），人物也会越来越多。方案一现场计算，跨档就换脸，对沉浸感伤害很大。方案二写进 `avatarRef` 后固定，而且这个字段现在就有、不进模型投影、模型也改不了，等于给它派上了原本预留的用途。
3. **加图不碰发版**：后续 DSH 持续补图时，只动头像仓和一行指针，不用重新构建终端、不切测试指针，不会和正在进行的 rc 版本迭代互相干扰。

如果 YG 更在意“国内一定能显示 + 零外部依赖 + 隐私”，并且能接受头像库不超过约 140 张、换设备后头像重抽，就选**方案三**。方案一只在“图片基本不再增加、并且确认头像内容绝对不会触发 jsDelivr 条款”时才是最省事的选择。

---

## 附：排除掉的免费选项（及原因）

| 选项 | 排除原因 |
|---|---|
| `raw.githubusercontent.com` 直接引用 | 国内 DNS 污染严重，还有访问频率限制，GitHub 也不鼓励拿它当热链 |
| GitHub Pages（`*.github.io`） | 国内访问不稳定；可以当方案二的备用线路，但不比 Cloudflare Pages 好 |
| Gitee / Gitee Pages | Pages 服务已停；raw 有防盗链；需要实名 |
| SM.MS、路过图床等公共图床 | 要上传账号和 token（多一个密钥要管），免费额度和国内线路说变就变，删图不可控 |
| Imgur | 国内无法访问 |
| Netlify 免费版 | 每月 100 GB 流量，超了直接暂停站点，属于硬停；Cloudflare Pages 流量不限，更合适 |
| Supabase Storage 免费版 | 存储和外网流量都有月度上限，项目长期不活跃会被暂停；适合存指针，不适合存图 |
| 图片放进卡本体（PNG/JSON） | 每次加图都要重导卡、提升契约版本号，卡 JSON 体积翻倍 |

> 文中的额度数字来自 2026-11 公开资料（jsDelivr 官方文档：GitHub 来源单文件 20 MB、单包 150 MB，禁止色情内容和当通用图床使用；Cloudflare Pages 免费版：2 万文件、单文件 25 MiB、流量不限、每月 500 次构建）。DSH 落地前应再查一次官网。
