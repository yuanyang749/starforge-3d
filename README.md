# 《星穹战翼：破晓远征》(STARFORGE: ECLIPSE VANGUARD)

一款基于 **Three.js + TypeScript + Vite** 打造的浏览器即开即玩 **3D 星际战机走廊肉鸽射击游戏**。玩家将作为破晓远征舰队王牌飞行员，穿梭于「轨道城峡谷 → 碎星跃迁门廊 → 龙骨母舰空域」三大战区，驾驭四大军工阵营的可变形星际战机迎战多关节重装 Boss 与无尽深空敌潮。

> **全机械可动战机与沉浸式战术座舱**：游戏内战机、敌军与关底巨型 Boss 均具备实时联动的可动旋翼、折叠掠翼、全动气动舵面、防空炮塔及可破坏重武装部位；机库与战区 HUD 完整呈现军工阵营档案、威胁评级与实时战术情报。

![HUD & Hangar Concept](./docs/ui_concept_hud_hangar.png)

---

## 核心特性

- **精密机械可动战机与多关节敌军编队**
  - 涵盖 4 架四大军工阵营星际战机、3 尊可破坏子部位关底 Boss、4 类敌军单位、1 架双翼护航无人僚机，以及轨道城高架区块与重型机械跃迁星门。
  - 通过实例池化预热、静态子网格合并、`Box3` 归一化与 `compileAsync` 着色器预编译，保障机库切换秒开与高速空战流畅帧率。
- **四大军工阵营战机与专属被动 / 超频大招**
  - **日曜四旋翼穿梭机 (`SOLARIS VTOL · X-01`)**（赫利俄斯航宇）：四联涵道旋翼变频旋转；主武器高频双联脉冲激光；大招 **轨道离子过载光束**（`2.5s` 贯穿光柱焚毁路径敌弹并高频灼烧敌阵）。
  - **铁砧倾转旋翼突击舰 (`ANVIL GUNSHIP · C-55`)**（伏尔甘重工）：倾转旋翼短舱与舱门联动；三向电浆扇面；大招 **电磁护盾新星**（回复护盾并将全屏敌弹逆转为追踪友方导弹）。
  - **苍穹可变翼截击舰 (`VALKYRIE MORPH · A-103`)**（瓦尔基里特装）：全收放折叠外翼与内置武器舱；主炮自带 `+1` 基础穿甲贯穿；大招 **幻影齐射风暴**（18 枚高爆追踪导弹全向清场）。
  - **疾风气动重型战机 (`TEMPEST STRIKER · G-08`)**（暴风气动院）：全动副翼 `Aileron` 与升降舵 `Elevator` 随侧倾/俯仰实时偏转；主炮自带 `+15%` 基础暴击与 `16m` 折射紫光弹射（`65%` 伤害）；大招 **棱镜时空缓速场**（`4s` 全局敌机与敌弹减速 + 必定暴击）。
- **三幕战役 + Boss 实时破部位 & 1.8s 慢动作解体 + 无尽深空**
  - **Act I 轨道城峡谷 → Act II 碎星跃迁门廊 → Act III 龙骨母舰空域**：关底 3 尊巨型 Boss 均支持瞄准可破坏子部位（肩炮、巨钳、背脊防空炮、舰首投射臂等），击破后永久削弱对应弹幕，致命一击触发清弹、3s 护盾无敌与未缩放 `rawDt` 驱动的多部位连锁殉爆解体。
  - **12 种肉鸽战术芯片**：每波间隙通过原生 `<dialog>` 弹出三选一强化芯片（含召唤双翼护航僚机、智能追踪导弹舱、特斯拉电弧链、偏转能量矩阵等），通关第 3 幕后解锁 **无尽深空模式** 并持久化单舰战绩。
- **5 层程序化 GLSL 爆炸、HDR 泛光后处理与全 3 幕生态天穹 (`v2.0`)**
  - **PBR IBL + 2K 弧形全景 + 3 幕立体空域**：内置 `RoomEnvironment` IBL 反射、GLSL 极光星空天穹球与 4 幅 `1920×1080` WebP 全景环幕（`public/env/`），搭配 3D 轨道机库甲板、Act 1 日照云海光轨高速/装甲高架台面与 `prop_city_tile` 天际线、Act 2 48 座旋转晶石小行星群与跃迁等离子河、Act 3 熔核战舰甲板/多层阶梯装甲隔舱与扫射探照光柱。
  - **HDR 弹道、导弹尾焰与六边形护盾**：主通道启用 `EffectComposer` + `UnrealBloomPass(res, 0.35, 0.30, 0.90)` + `OutputPass`；提供 5 种舰艇专属 HDR 交叉光束弹丸、3D 掠翼追踪导弹与 640 段高饱和橙金-品红-深紫 18 轨分明拖尾、双戒环敌军等离子弹幕、48 槽枪口星芒焰、64 槽命中微爆、双马赫环加力喷口 + 翼尖拉烟，以及通透菲涅尔六边形滚筒护盾与 440 槽流线型 HDR 火花针。
- **重工业 3D 倒角金属 UI 框架、无遮挡通透战区 HUD 与微交互动效 (`v4.1`)**
  - `public/ui/frames/` 定制 7 套透明斜切重工边框贴图（机库高面板、弹窗外框、青/琥珀双态卡槽、琥珀点火箭出击铭牌，以及实战状态栏 `hud_status_frame.webp` 与 Boss 目标锁定框 `hud_boss_frame.webp`），彻底移除旧版四角遮罩大图并替换为通透战区 HUD，搭配矢量 SVG 预测准星、双层延迟衰减血条、`<kbd>` 飞控按键条与全局零 `"//"` 文案清洗。
  - 机库左侧底部实时绘制四型战机 **矢量全息结构投影 SVG + 扫描光束 + 四维规格网格**；所有面板、卡片与按钮接入 `@property --spot-inner / --spot-outer` 指针追踪光晕、`L` 形目标锁定四角标框、斜向扫光以及悬停反馈音，原生 `<dialog>` 遵循 `@starting-style` + `allow-discrete` 顶层出入场过渡。
- **全界面实时 FPS 遥测、硬件参数识别与 4K 高分屏自选分辨率优化 (`v4.2 / v4.3`)**
  - 右上角接入原生 Top-Layer 遥测胶囊 `#fps-hud[popover="manual"]`（每次开启 `<dialog>` 自动置顶），在加载舱、整备机库、高强度空战与所有弹窗界面实时显示移动平均 FPS、单帧耗时（ms）与当前分辨率档位，并应用 `text-box: trim-both cap alphabetic`、`tabular-nums` 与 `contain: layout style paint`。
  - **硬件参数自动识别 + 5 档手动分辨率选择面板（`v4.3`）**：点击右上角 FPS 胶囊即可展开硬件与分辨率设置面板（支持 `ESC` 或点击外部收起，按 `G` 键亦可快捷循环切档），自动读取 WebGL 显卡型号（`UNMASKED_RENDERER_WEBGL`）、CPU 线程数、设备内存及 4K 显示器物理像素并评定 `核显节能档 / 主流均衡档 / 旗舰独显档`，提供 **`智能硬件适配` / `1280 × 720` / `1920 × 1080` / `2560 × 1440` / `原生满血分辨率`** 五档一键切换与持久化；DPR 区间支持 `0.25..2` 并结合动态稳帧 Auto-DRS（`0.65x..1.0x`）、MSAA 自适应开关（`>2M px` 自动关闭）与 Half-Res Bloom 降采样。
  - 清理 7 处逐帧刷新 HUD/机库面板上的 `backdrop-filter: blur` 与容器级 `drop-shadow`，引入 `contain: layout style paint` 隔离局部重绘，同时剪枝天空盒与云海 GLSL 分支噪声（`hash33` 去 `sin()`、低八度 FBM、`discard` 早退出）。
- **电影级 `48kHz` 三层分轨声场与全场景 Synthwave 配乐 (`v6.0`)**
  - **6 首分场景无缝配乐交叉淡入淡出**：涵盖加载舱首秀主题（`bgm_boot.mp3`）、星港机库（`bgm_hangar.mp3`）、Act 1/2/3（`bgm_act1/2/3.mp3`）及 Boss 压轴战（`bgm_boss.mp3`），随战局自动平滑切换（`setBgmTrack`），开启暂停或芯片升级弹窗触发 `1650Hz` 低通战术闷音（`setMuffled`）与全息展开音（`hud_deploy.mp3`），通关/战损播放专属定音 Stinger。
  - **全量 ElevenLabs SFX v3 定制母带管线（`npm run fetch-audio`）**：内置零 CC0 依赖的 `ELEVENLABS_API_KEY`（兼容 `.env` / `~/.zshrc`）合成与 `48kHz / 192kbps` FFmpeg 响度母带流程，生成全部 6 首 `48kHz` 暗黑电影级 Synthwave 循环配乐与 35 组 `eleven_text_to_sound_v3` 定制战斗拟音（含四战机主炮与大招、机库选舰变形扫描、防爆门启闭、芯片锁扣、红警 Klaxon 与铜管太鼓双轨并发 Boss 渐强高潮等，保留振荡器兜底）。
  - **Web Audio 三层母带总线**：内置 `DynamicsCompressorNode` 防爆音压限器、平滑侧链闪避（`duckBgm`）、随连击 `1.0x..8.0x` 递增的命中音高以及基于目标 `X` 坐标的左右声道立体声像（`StereoPannerNode`）。

---

## 操作指南

| 操作 | 按键 / 鼠标 | 说明 |
| :--- | :--- | :--- |
| **移动 / 瞄准** | 鼠标跟随 / `W` `A` `S` `D` / 方向键 | 二阶弹簧阻尼侧倾飞行与双层预测准星 |
| **主炮开火** | 自动连射（按 `F` 切换手动左键） | 战场默认开启自动连射，可按 `F` 切手动点射 |
| **战术翻滚弹反** | 鼠标右键 / `Shift` | `0.46s` 无敌帧并弹反敌方弹幕 |
| **阵营超频大招** | `Space` / `Q` | 充能满 100% 释放各战机专属终极技能 |
| **三选一芯片** | 点击卡片 / `1` `2` `3` | 波次间隙选择强化芯片协议 |
| **分辨率 / 硬件面板** | 点击右上角 FPS 胶囊 / `G` | 展开硬件识别与 5 档分辨率面板（`智能适配 / 720P / 1080P / 2K / 原生4K`）或按 `G` 循环切换 |
| **静音 / 暂停** | `M` / `Esc` | 一键开关合成音效或呼出战术暂停面板 |

---

## 本地运行与自动化测试

环境要求：Node.js `>= 20`（E2E 测试需本机安装 Google Chrome 或 Chromium）。

```bash
# 1. 安装依赖
npm install

# 2. 启动本地开发服务器（默认端口 5179）
npm run dev

# 3. TypeScript 严格检查与 Vite 生产构建（输出至 dist/）
npm run build

# 4. 运行 8 阶段（247 断言，含全界面 FPS、硬件识别五档分辨率、35 SFX + 6 BGM 全链路音频与零 404 验证）无头 Chrome WebGL E2E 自动化测试（基于 dist/ 预览服务）
npm run test:e2e

# （可选）从 Hugging Face 重新拉取原始模型并压缩 WebP 贴图
npm run fetch-models

# （可选）调用 ElevenLabs SFX v3 批量重新合成 48kHz 配乐与战斗音效并完成 FFmpeg 母带（支持 ELEVENLABS_API_KEY / .env）
npm run fetch-audio
```

更多架构细节、模型拆包数据与里程碑记录请查阅：[PLAN.md](./PLAN.md)。

---

## 开源协议与致谢 (Attribution)

- **游戏源码与 UI 脚本**：采用 **MIT License** 开源。
- **3D 模型资产归属（CC BY 4.0）**：`public/models/` 中的全部 14 份 3D 模型基于 Hugging Face 数据集 [`scenario-labs/3d-collection`](https://huggingface.co/datasets/scenario-labs/3d-collection)（[Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)）改编制作，保留原始多节点结构、蒙皮骨骼与关键帧动画，仅将贴图无损/有损转换为 WebP 并配本地化 Draco 解码器（`public/draco/`）。
- **定制配乐与战斗音效（ElevenLabs SFX v3）**：`public/audio/` 中的全部 6 首分场景无缝 Synthwave 配乐与 35 组战斗/UI 拟音均由项目音频管线调用 ElevenLabs SFX v3（`eleven_text_to_sound_v3`）合成，并经 FFmpeg 响度归一化与 `48kHz / 192kbps` 立体声母带处理。
