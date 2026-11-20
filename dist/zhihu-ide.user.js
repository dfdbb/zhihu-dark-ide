// ==UserScript==
// @name         知乎 · 暗色 IDE 皮肤
// @namespace    https://github.com/dfdbb/zhihu-dark-ide
// @version      1.6.3
// @description  把知乎重绘为暗色 IDE：活动栏 + 文件树 + 标签页 + minimap + 状态栏，正文按代码编辑器排版。完全本地运行，不联网、不采集数据。
// @author       dfdbb
// @match        https://www.zhihu.com/*
// @match        https://zhihu.com/*
// @match        https://zhuanlan.zhihu.com/*
// @run-at       document-start
// @grant        none
// @noframes
// ==/UserScript==

/*
 * 知乎 · 暗色 IDE 皮肤 —— 核心脚本
 * 扩展直接加载本文件；油猴版由 tools/build-userscript.mjs 拼接元数据后生成到 dist/。
 */

(function () {
  'use strict';

  /* ============================================================
     0. 配置与状态
     ============================================================ */
  const KEY = 'zhihu-ide:enabled';
  const KEY_CLEAN = 'zhihu-ide:clean';
  const KEY_REVIEW = 'zhihu-ide:review';
  const KEY_FUSE = 'zhihu-ide:fuse';
  const PREF = {
    mono: '"JetBrains Mono","Cascadia Mono",Consolas,"SF Mono",Menlo,"Microsoft YaHei",monospace',
    ui: '"Segoe UI","Microsoft YaHei UI","Microsoft YaHei",system-ui,sans-serif',
  };
  let enabled = true;
  try { enabled = localStorage.getItem(KEY) !== '0'; } catch (e) {}
  // 专注模式：隐藏顶部站内导航与右侧推荐/广告栏
  let clean = true;
  try { clean = localStorage.getItem(KEY_CLEAN) !== '0'; } catch (e) {}
  // 变更审阅分栏：右侧一条 diff，代码由当前文章主题派生
  let review = true;
  try { review = localStorage.getItem(KEY_REVIEW) !== '0'; } catch (e) {}
  // 融合模式：不用侧栏，代码单元直接插进正文流（与分栏互斥）
  let fuse = true;
  try { fuse = localStorage.getItem(KEY_FUSE) !== '0'; } catch (e) {}

  const $ = (s, r) => (r || document).querySelector(s);

  // document-start 时 <html> 可能尚未生成，做一次带重试的早期标记，避免原生亮色界面闪现
  function markEarly() {
    const de = document.documentElement;
    if (de && enabled) {
      de.classList.add('zide');
      if (clean) de.classList.add('zide-clean');
      if (review) de.classList.add('zide-rv');
      if (fuse) de.classList.add('zide-fuse');
    }
    return !!de;
  }

  /* ============================================================
     1. 样式层
     ============================================================ */
  const CSS = `
/* ---------- 设计令牌 ----------
   中性色取自常见暗色 IDE 的实测像素值，和编辑器并排使用不串色。
   ⚠ 层次关系与 VS Code Dark Modern 相反：外壳更亮（#1f1f1f）、内容区更暗
   （#141414），内容区是「凹」进去的。照搬 VS Code 会把明暗关系做反。 */
:root{
  --z-bg-0:#1f1f1f;    /* IDE 外壳：活动栏 / 文件树 / 标签栏 / 状态栏 / minimap */
  --z-bg-1:#141414;    /* 内容区（正文底） */
  --z-bg-2:#1d1e1f;    /* 浮层 / 弹窗 */
  --z-bg-3:#242629;    /* 输入框 / 按钮 / 抬高面（实测略偏蓝） */
  --z-code:#181818;    /* 代码块底：本机 IDE 的代码块与正文几乎同底，只做极轻的抬高 */
  --z-hover:#292929;   /* 悬停行 */
  --z-sel:#3a3a3a;     /* 激活 / 选中项（实测本机 IDE 左面板的当前任务卡片） */
  --z-line:#2a2a2a; --z-line-2:#34363a;
  /* 正文列宽。分栏模式下收窄到 660 把宽度让给代码；融合模式下放宽到 760，
     因为代码要跟文字挤在同一列里，需要更多字符位 */
  --z-measure:660px;
  --z-fg:#e4e4e4;      /* 正文 */
  --z-fg-hi:#ececec;   /* 强调文字 */
  --z-fg-dim:#9c9c9c;  /* 次要 */
  --z-fg-mute:#7a7a7a; /* 更次要 / CodeLens */
  --z-gutter:#696a6a;  /* 行号（实测本机 IDE 的行号灰） */

  /* 语义色（第 10 轮：调亮、加彩度 —— 原先是「保亮度压饱和」的低彩度稿，代码不够显眼）。
     现在按「保留可读性、放开彩度」取值，每组都在 #141414 上实测过 WCAG 对比度：
       keyword 6.25 / type 9.04 / func 13.04 / string 6.97 / comment 5.53
       num 10.84 / var 12.35 / ctrl 6.62 / const 8.46 —— 全部 ≥ 5.5:1（AA 正文级）。
     状态色（绿/红）刻意比正文更艳：它们只承担「加/删」语义，不承担长文阅读。 */
  --z-blue:#2f6ba8; --z-link:#86a6c3;
  /* 主行动按钮（关注/写回答/推荐 tab）：知乎原色是 #0084ff 那种高饱和蓝，
     在暗底上是整屏最亮的一块，一眼就是「网页社区」。换成 IDE 的主按钮蓝
     （VS Code dark+ 的 #0e639c），同样能读出「这是主操作」，但不再是噪声 */
  --z-btn:#0e639c; --z-btn-hi:#1177bb; --z-btn-fg:#e8f2fa;
  --z-comment:#6a9955; --z-string:#ce9178; --z-keyword:#569cd6; --z-ctrl:#c586c0;
  --z-func:#dcdcaa; --z-var:#9cdcfe; --z-type:#4ec9b0; --z-num:#b5cea8; --z-const:#79b8d6;
  --z-yellow:#8e8146; --z-green:#3fb950; --z-red:#f85149;
  /* 审阅栏专用行号灰：比正文左侧的注释号（--z-gutter）更亮，5.73:1，扫读时不会糊成一片 */
  --z-rv-gutter:#8a9099;
  --z-rv-code:#e8e8e8;      /* 审阅栏的代码正文（比文章正文更亮一档，衬托「这是代码」） */
  --z-mono:${PREF.mono};
  --z-ui:${PREF.ui};
}

/* ---------- 排版与底色 ---------- */
html.zide{ background:var(--z-bg-1)!important; color-scheme:dark; }
html.zide body{
  background:var(--z-bg-1)!important; color:var(--z-fg)!important;
  margin:34px 86px 22px 256px!important;
  font-family:var(--z-ui)!important;
  -webkit-font-smoothing:antialiased;
}
html.zide ::selection{ background:#2e4358!important; color:#e9e9e9!important; }
html.zide ::-webkit-scrollbar{ width:12px; height:12px; }
html.zide ::-webkit-scrollbar-track{ background:transparent; }
html.zide ::-webkit-scrollbar-thumb{ background:#4e4e4e; border:3px solid transparent; background-clip:content-box; border-radius:6px; }
html.zide ::-webkit-scrollbar-thumb:hover{ background:#6b6b6b; background-clip:content-box; }
html.zide *{ border-color:var(--z-line)!important; }
html.zide a, html.zide a:visited{ color:var(--z-link)!important; }
html.zide svg{ fill:currentColor; }

/* ---------- 通用大白底 / 阴影清除 ---------- */
html.zide .Card,
html.zide .List-item,
html.zide .AnswerItem,
html.zide .ArticleItem,
html.zide .Topstory,
html.zide .TopstoryItem,
html.zide .QuestionHeader,
html.zide .Question-mainColumn,
html.zide .Question-sideColumn,
html.zide .GlobalSideBar,
html.zide .ContentItem,
html.zide .RichContent-inner,
html.zide .RichContent,
html.zide .Modal,
html.zide .Modal-content,
html.zide .Popover,
html.zide .Popover-content,
html.zide .Menu,
html.zide .AppHeader,
html.zide .AppHeader-inner,
html.zide .Input-wrapper,
html.zide .SearchBar,
html.zide .SearchBar-input,
html.zide .Notification,
html.zide .css-1qyytj7,
html.zide div[role="dialog"],
html.zide div[role="menu"]{
  background:var(--z-bg-1)!important;
  box-shadow:none!important;
}
html.zide .Modal-content,
html.zide .Popover-content,
html.zide div[role="dialog"],
html.zide div[role="menu"]{
  background:var(--z-bg-2)!important;
  border:1px solid var(--z-line-2)!important;
  border-radius:6px!important;
  box-shadow:0 8px 26px #000000bf!important;
}
html.zide .Card,
html.zide .List-item,
html.zide .AnswerItem,
html.zide .TopstoryItem{
  border-bottom:1px solid var(--z-line)!important;
  border-radius:0!important;
}
/* 输入控件 */
html.zide input, html.zide textarea, html.zide select{
  background:var(--z-bg-3)!important; color:var(--z-fg)!important;
  border:1px solid var(--z-line-2)!important; border-radius:4px!important;
}
html.zide input::placeholder, html.zide textarea::placeholder{ color:var(--z-fg-mute)!important; }
html.zide button{
  background:var(--z-bg-3)!important; color:var(--z-fg)!important;
  border:1px solid var(--z-line-2)!important; border-radius:4px!important;
}
html.zide button:hover{ background:#2e3033!important; }
html.zide .Button--blue, html.zide button.Button--blue{
  background:var(--z-btn)!important; border-color:var(--z-btn-hi)!important; color:var(--z-btn-fg)!important;
  border-radius:3px!important;
}
html.zide .Button--blue:hover, html.zide button.Button--blue:hover{ background:var(--z-btn-hi)!important; }
html.zide img{ opacity:.94; }
html.zide .Avatar{ border:1px solid var(--z-line-2)!important; }
/* 头像底色：真站上是 <img src>，但图片未加载/透明 PNG 时会露出底层色 ——
   知乎默认给的是 #ddd，落在暗底上就是一颗 24×24 的亮点，属于同一类「白块」投诉 */
html.zide .Avatar, html.zide .Avatar img, html.zide .AuthorInfo-avatar{ background-color:var(--z-bg-3)!important; }

/* ---------- 列表页（首页信息流 / 搜索 / 专栏）布局接管 ----------
   皮肤原先只认 .Question-mainColumn，而首页用的是另一套：
   .Topstory-container > .Topstory-mainColumn + .Topstory-sideColumn。
   结果就是首页右栏（关注的问题 / 推荐关注 / 广告 / 相关人物）原样留着，
   主列却被 body 的右外边距挤成一条窄柱 —— 这是真机上最刺眼的一处。
   这里按知乎真实类名接管；未知页面继续由 applySideColumns() 的几何兜底。 */
html.zide.zide-clean .Topstory-sideColumn,
html.zide.zide-clean .GlobalSideBar,
html.zide.zide-clean .Question-sideColumn,
html.zide.zide-clean .Post-Row-Content-right,
html.zide.zide-clean .Search-container > div:last-child,
html.zide.zide-clean .Topstory-container > div:last-child,
html.zide.zide-clean .Pc-feedAd,
html.zide.zide-clean .Pc-feedAd-container,
html.zide.zide-clean .Pc-feedAd-card-content-detail,
html.zide.zide-clean .TopstoryItem--advertCard,
html.zide.zide-clean .Pc-Business-Card-PcTopFeedBanner,
html.zide.zide-clean .Card.AuthorCard,
html.zide.zide-clean .HotSearchCard,
html.zide.zide-clean .CreatorEntrance,
html.zide.zide-clean .Question-sideColumnAdContainer{ display:none!important; }

/* 右栏没了，容器就没必要再当 flex 两栏用；主列铺开后再用 --z-measure 收敛 */
html.zide.zide-clean .Topstory-container,
html.zide.zide-clean .Search-container,
html.zide.zide-clean .Question-main{
  display:block!important; max-width:none!important; width:auto!important; margin:0!important;
}
html.zide.zide-clean .Topstory-mainColumn,
html.zide.zide-clean .SearchMain,
html.zide.zide-clean .Post-Row-Content-left{
  width:auto!important; max-width:var(--z-measure)!important;
  margin-left:auto!important; margin-right:auto!important;
}
/* 信息流的每一张卡：去掉圆角阴影，压成 IDE 里的「列表行」区块，卡间距即行距 */
html.zide .TopstoryItem .Card,
html.zide .TopstoryItem.Card{
  border-radius:0!important; box-shadow:none!important;
  border-bottom:1px solid var(--z-line)!important;
  margin-bottom:0!important;
}
html.zide .ContentItem-title{ font-size:16px!important; }
/* 首页卡片的标题色一定要显式给：知乎把它写死成 #121212 那一挂，
   皮肤只改了容器底色的话，标题就是黑底黑字（在真机截图上直接「消失」） */
html.zide .ContentItem-title,
html.zide .ContentItem-title a,
html.zide .QuestionItem-title,
html.zide .QuestionItem-title a,
html.zide .TopstoryItem h2,
html.zide .TopstoryItem h2 a{ color:var(--z-fg-hi)!important; }
/* 专栏文章页的大标题同理：知乎写死 #121212，暗底上等于消失 */
html.zide .Post-Title,
html.zide .Post-Title a,
html.zide h1.Post-Title{ color:var(--z-fg-hi)!important; }
html.zide .FollowButton,
html.zide .Button--blue{ background:var(--z-btn)!important; color:var(--z-btn-fg)!important; border-color:var(--z-btn-hi)!important; border-radius:3px!important; }
html.zide .FollowButton:hover,
html.zide .Button--blue:hover{ background:var(--z-btn-hi)!important; }
/* 信息流顶部的「推荐 / 关注」分段控件：知乎渲染成两颗高饱和胶囊，
   在暗底上比正文还抢眼。改成编辑器标签页的静态观感 —— 无圆角、无阴影，
   选中的加一条下划线亮边，跟 .zide-tab 的选中态是同一套语言 */
html.zide .Topstory-tabs button,
html.zide .Topstory-container > div:first-child button,
html.zide button[class*="tabs"]{
  border-radius:2px!important; box-shadow:none!important;
  font-size:12.5px!important; letter-spacing:.02em;
}

/* ---------- 顶部导航：让位给标签栏，并去掉品牌标识 ---------- */
html.zide .AppHeader,
html.zide header.AppHeader,
html.zide [role="banner"]{
  top:34px!important;
  background:var(--z-bg-0)!important;
  border-bottom:1px solid var(--z-line)!important;
  box-shadow:none!important;
}
html.zide .AppHeader-inner{ background:transparent!important; }
html.zide .AppHeader-Tabs a,
html.zide .AppHeader-nav a,
html.zide .AppHeader-Tab{ color:var(--z-fg-dim)!important; font-size:13px!important; }
html.zide .AppHeader-Tabs a:hover,
html.zide .AppHeader-nav a:hover{ color:#fff!important; }
/* 隐藏知乎品牌标识，换成工程标识 */
html.zide .AppHeader-Logo img,
html.zide .AppHeader-Logo svg{ display:none!important; }
html.zide .AppHeader-Logo::after{
  content:"</> zhihu-web";
  font-family:var(--z-mono)!important;
  font-size:13px;
  color:var(--z-func)!important;
  letter-spacing:-.02em;
}
html.zide .SearchBar-input,
html.zide .Input-wrapper{ background:var(--z-bg-3)!important; }
html.zide .SearchBar-toolListButton{ color:var(--z-fg-dim)!important; }

/* ---------- 专注模式：隐藏顶部站内导航与右侧推荐/广告栏 ---------- */
html.zide.zide-clean header.AppHeader,
html.zide.zide-clean .AppHeader,
html.zide.zide-clean [role="banner"]{
  display:none!important;
}
/* 右栏的类名模式（知乎改版频繁，这里列全常见写法；匹配不到时由 JS 结构定位兜底） */
html.zide.zide-clean .Question-sideColumn,
html.zide.zide-clean .Topstory-sideColumn,
html.zide.zide-clean .GlobalSideBar,
html.zide.zide-clean [class*="sideColumn"],
html.zide.zide-clean [class*="SideColumn"],
html.zide.zide-clean [class*="SideBar"],
html.zide.zide-clean [class*="sideBar"],
html.zide.zide-clean [class*="Sidebar"],
html.zide.zide-clean [class*="sidebar"],
html.zide.zide-clean [class*="RightColumn"],
html.zide.zide-clean [class*="rightColumn"],
html.zide.zide-clean [role="complementary"]{
  display:none!important;
}
/* 明确标记的广告容器（不依赖知乎的内部类名） */
html.zide.zide-clean [data-ad],
html.zide.zide-clean [data-ad-slot],
html.zide.zide-clean ins.adsbygoogle,
html.zide.zide-clean iframe[name^="google_ads"],
html.zide.zide-clean [id^="cproIframe"],
html.zide.zide-clean [id*="bd_ad"]{
  display:none!important;
}
/* 侧栏移除后正文会拉得过宽，收敛到接近编辑器的可读宽度，
   右侧留白正好读作编辑器的空白区，minimap 仍贴右缘。
   注意：只收敛问题页主列。首页信息流由下面的列表页规则用 --z-measure 管，
   写在这里会被「同特异度、后出现者胜」压掉（本轮踩过）。 */
html.zide.zide-clean .Question-mainColumn{
  max-width:1040px!important;
}

/* ---------- 查找框：替代被隐藏的站内搜索 ----------
   第 14 轮：原来是 display:none + 只能点活动栏图标，实际上等于「没有搜索框」。
   改成悬浮式 —— 平时收在标签栏下面（透明度 0、不吃鼠标事件），
   鼠标移到标签栏右上角的感应区就滑下来；离开 300ms 自动收回（输入过内容则保持）。
   位置贴在标签栏下沿，所以上边不做圆角，做成一枚「挂下来的抽屉」。 */
.zide-find-hot{
  position:fixed; z-index:2147483001; top:0; right:0;
  width:300px; height:34px;              /* 与 .zide-tabbar 同高，正好压在它的右段上 */
  display:flex; align-items:center; justify-content:flex-end;
  padding-right:10px; cursor:text;
}
.zide-find-chip{
  font-family:var(--z-mono); font-size:11px; color:var(--z-fg-mute);
  opacity:.5; transition:opacity .15s ease, color .15s ease; pointer-events:none;
  white-space:nowrap;
}
.zide-find-hot:hover .zide-find-chip{ opacity:1; color:var(--z-fg-dim); }
.zide-find-chip b{
  font-weight:400; margin-left:6px; padding:0 4px; border-radius:2px;
  background:#ffffff0f; border:1px solid var(--z-line-2); color:var(--z-fg-dim);
}
.zide-find{
  position:fixed; z-index:2147483002; right:96px; top:34px;
  display:flex; align-items:center; gap:7px;
  background:var(--z-bg-2); border:1px solid var(--z-line-2); border-top:0;
  border-radius:0 0 6px 6px;
  padding:7px 8px 8px; box-shadow:0 10px 26px #000000b8;
  opacity:0; transform:translateY(-10px); pointer-events:none;
  transition:opacity .15s ease, transform .15s ease;
}
.zide-find.zide-show{ opacity:1; transform:translateY(0); pointer-events:auto; }
.zide-find input{
  width:320px; height:26px; padding:0 8px; border-radius:4px;
  background:var(--z-bg-3)!important; color:var(--z-fg)!important;
  border:1px solid var(--z-blue)!important; outline:0;
  font-size:13px; font-family:var(--z-mono)!important;
}
.zide-find .zide-hint{ font-family:var(--z-mono); font-size:11px; color:var(--z-fg-mute); }
@media (max-width:1360px){ .zide-find{ right:16px; } }

/* ---------- 正文：按代码编辑器排版 ---------- */
html.zide .RichText{
  counter-reset:zline 0;
  font-size:15px!important;
  line-height:1.86!important;
  padding-left:56px!important;
  padding-right:26px!important;
  color:var(--z-fg)!important;
  font-family:var(--z-mono)!important;
  letter-spacing:.005em;
}
html.zide .RichText,
html.zide .RichText *{ color:var(--z-fg)!important; }
html.zide .RichText > p{
  position:relative!important;
  counter-increment:zline;
  margin:0 0 15px!important;
}
/* 行号槽：按段落递增，视觉上等同于编辑器 gutter */
html.zide .RichText > p::before{
  content:counter(zline);
  position:absolute!important;
  left:-46px; top:1px;
  width:32px;
  text-align:right;
  font-family:var(--z-mono)!important;
  font-size:11px;
  line-height:1.9;
  color:var(--z-gutter)!important;
  user-select:none;
  pointer-events:none;
}
html.zide .RichText h1,
html.zide .RichText h2,
html.zide .RichText h3,
html.zide .RichText h4{
  color:var(--z-fg-hi)!important;
  font-family:var(--z-mono)!important;
  font-weight:600!important;
  margin:22px 0 12px!important;
  line-height:1.5!important;
}
html.zide .RichText h2{ font-size:17px!important; }
html.zide .RichText h3{ font-size:15.5px!important; color:#d5d5d5!important; }
html.zide .RichText h2::before,
html.zide .RichText h3::before{
  content:"// ";
  color:var(--z-comment)!important;
  font-weight:400;
}
html.zide .RichText blockquote{
  background:transparent!important;
  border-left:3px solid var(--z-comment)!important;
  padding:2px 0 2px 16px!important;
  margin:0 0 15px!important;
  color:var(--z-fg-dim)!important;
  font-style:italic;
}
html.zide .RichText blockquote *{ color:var(--z-fg-dim)!important; }
html.zide .RichText a{ color:var(--z-link)!important; text-decoration:none!important; border-bottom:1px dashed #4daafc66!important; }
html.zide .RichText a:hover{ border-bottom-style:solid!important; }
html.zide .RichText strong{ color:var(--z-fg-hi)!important; font-weight:600!important; }
html.zide .RichText em{ color:var(--z-string)!important; font-style:italic!important; }
html.zide .RichText code{
  background:#ffffff14!important;
  border:0!important;
  border-radius:3px!important;
  color:var(--z-fg)!important;
  font-family:var(--z-mono)!important;
  font-size:.92em!important;
  padding:1px 5px!important;
}
html.zide .RichText pre,
html.zide .RichText .highlight{
  position:relative;
  background:var(--z-code)!important;
  border:1px solid var(--z-line)!important;
  border-radius:6px!important;
  padding:30px 16px 14px!important;
  margin:0 0 16px!important;
  overflow:auto!important;
}
html.zide .RichText pre::before{
  content:"\\60\\60\\60";
  position:absolute; left:14px; top:7px;
  color:var(--z-comment)!important;
  font-family:var(--z-mono)!important;
  font-size:11px;
  letter-spacing:1px;
}
html.zide .RichText pre code{
  background:transparent!important; border:0!important; padding:0!important;
  color:var(--z-fg)!important; font-size:13px!important; line-height:1.7!important;
}
html.zide .RichText img,
html.zide .RichText figure{ border-radius:6px!important; border:1px solid var(--z-line)!important; }
html.zide .RichText hr{ border:0!important; border-top:1px solid var(--z-line)!important; margin:22px 0!important; }
html.zide .RichText table{ border-collapse:collapse!important; }
html.zide .RichText td, html.zide .RichText th{
  border:1px solid var(--z-line)!important; padding:6px 10px!important; color:var(--z-fg)!important;
}
html.zide .RichText li{ margin:4px 0!important; }
html.zide .RichText ul > li::marker,
html.zide .RichText ol > li::marker{ color:var(--z-func)!important; }

/* ---------- 评论区：文字颜色与正文对齐 ----------
   正文的着色规则只覆盖 .RichText，评论区是独立元素，会保留知乎原生
   在浅色主题下的深灰文字（实测 #444），落到 #141414 深底上对比度只有约
   1.9:1，几乎不可见。此处统一为正文色 #e4e4e4（对比度约 14.5:1）。
   用 class 子串匹配而非写死类名，可同时覆盖 CommentContent / CommentItemV2
   / Comments-container 等既有写法。
   注意：徽标 / 标签一类元素自带底色与配色对，必须整体排除，
   否则会造出「浅底 + 浅字」或「黄底 + 白字」这类更糟的组合。 */
html.zide [class*="Comment"]:not([class*="badge" i]):not([class*="tag" i]):not([class*="label" i]),
html.zide [class*="comment"]:not([class*="badge" i]):not([class*="tag" i]):not([class*="label" i]),
html.zide [class*="Comment"] div:not([class*="badge" i]):not([class*="tag" i]):not([class*="label" i]),
html.zide [class*="Comment"] span:not([class*="badge" i]):not([class*="tag" i]):not([class*="label" i]),
html.zide [class*="Comment"] p,
html.zide [class*="Comment"] li,
html.zide [class*="comment"] div:not([class*="badge" i]):not([class*="tag" i]):not([class*="label" i]),
html.zide [class*="comment"] span:not([class*="badge" i]):not([class*="tag" i]):not([class*="label" i]),
html.zide [class*="comment"] p,
html.zide [class*="comment"] li{
  color:var(--z-fg)!important;
}
/* 评论内的链接与行内代码保留语义色，与正文保持一致 */
html.zide [class*="Comment"] a,
html.zide [class*="Comment"] a *,
html.zide [class*="comment"] a,
html.zide [class*="comment"] a *{ color:var(--z-link)!important; }
html.zide [class*="Comment"] code,
html.zide [class*="comment"] code{ color:var(--z-string)!important; }
/* 评论区的浅色底必须一并压掉，否则改完字会变成「浅底 + 浅字」。
   只列容器类名，不用宽泛的 [class*="Comment"]，避免连徽标底色一起刷掉。 */
html.zide [class*="Comments"],
html.zide .CommentList,
html.zide .CommentItem,
html.zide .CommentItemV2,
html.zide .CommentContent{
  background-color:transparent!important;
}

/* ---------- 元信息（作者、时间、计数）按代码样式收敛 ---------- */
html.zide .AuthorInfo-name,
html.zide .ContentItem-meta,
html.zide .ContentItem-time,
html.zide .AnswerItem-meta,
html.zide .List-itemMeta,
html.zide .TopstoryItem-meta{ color:var(--z-fg-dim)!important; }
html.zide .AuthorInfo-name{ color:var(--z-var)!important; font-weight:600!important; }
html.zide .ContentItem-time{ font-family:var(--z-mono)!important; font-size:12px!important; }
html.zide .ContentItem-actions,
html.zide .ContentItem-actions > *{ color:var(--z-fg-dim)!important; }
html.zide .QuestionHeader-title,
html.zide .QuestionHeader h1{
  color:var(--z-fg-hi)!important;
  font-family:var(--z-mono)!important;
  font-size:20px!important;
  font-weight:600!important;
  line-height:1.5!important;
}
html.zide .QuestionHeader-title::before{
  content:"export const topic = ";
  color:var(--z-keyword)!important;
  font-size:14px;
}
html.zide .Tab, html.zide .Tabs-item, html.zide .Tabs{ background:transparent!important; color:var(--z-fg-dim)!important; }
html.zide .Tabs-item.is-active{ color:var(--z-fg)!important; }
html.zide .Tabs-item--active, html.zide .Tabs-item.active{
  color:#fff!important; border-bottom:1px solid var(--z-fg)!important; background:transparent!important;
}
html.zide .HotItem, html.zide .HotList-item{ background:var(--z-bg-1)!important; border-bottom:1px solid var(--z-line)!important; }
html.zide .NumberBoard-itemValue, html.zide .NumberBoard-item{ color:var(--z-fg)!important; background:transparent!important; }

/* ============================================================
   编辑器化加强：把「暗色论坛」拉回「打开了一个源码文件」
   论坛味的四处来源，逐个换成语汇：
     1. 社交操作栏（赞同/评论/收藏/喜欢 的蓝色药丸按钮）→ CodeLens 式灰色元信息
     2. 评论区（头像 + 昵称 + 时间 + 徽标）→ 行内注释
     3. 问题统计行 → 文件元信息
     4. 卡片列表分隔 → 由回答头部的「文件头横线」承担
   原则：只改观感，不动知乎的 DOM 结构与交互，点赞/评论功能保持可用。
   ============================================================ */

/* --- 1. gutter 分隔线：行号与正文之间的 1px 竖线（VS Code 的 editorGroup 边线） --- */
/* 用背景渐变而非 ::after + position:relative，避免给 .RichText 引入定位上下文而
   影响知乎内部可能存在的绝对定位元素 */
html.zide .RichText{
  background-image:linear-gradient(to right,
    transparent 0 41px,
    var(--z-line) 41px 42px,
    transparent 42px)!important;
  background-repeat:no-repeat!important;
  background-size:100% 100%!important;
}

/* --- 2. 当前行高亮：悬停段落时正文行淡亮、行号转亮色 --- */
/* 高亮只落在正文区（从 56px 起），不覆盖 gutter 分隔线 */
html.zide .RichText > p,
html.zide .RichText > h2,
html.zide .RichText > h3,
html.zide .RichText > ul,
html.zide .RichText > ol,
html.zide .RichText > blockquote{ transition:background-color .08s linear; }

html.zide .RichText > p:hover,
html.zide .RichText > h2:hover,
html.zide .RichText > h3:hover,
html.zide .RichText > ul:hover,
html.zide .RichText > ol:hover{
  background-color:#ffffff09!important;
  box-shadow:26px 0 0 0 #ffffff09;
}
html.zide .RichText > p:hover::before{ color:var(--z-fg)!important; }

/* --- 3. 社交操作栏 → CodeLens --- */
/* 去掉药丸按钮的底色/描边/内边距，整体降为 monospace 灰色小字，
   视觉上等同于 VS Code 在函数上方渲染的那行 CodeLens */
html.zide .ContentItem-actions,
html.zide .ContentItem-actions *{
  font-family:var(--z-mono)!important;
  font-size:11.5px!important;
  color:var(--z-fg-mute)!important;
  letter-spacing:-.01em!important;
}
html.zide .ContentItem-actions button,
html.zide .ContentItem-actions .Button,
html.zide .ContentItem-actions .VoteButton{
  background:transparent!important;
  background-image:none!important;
  border:0!important;
  border-radius:0!important;
  box-shadow:none!important;
  padding:0!important;
  margin:0!important;
  height:auto!important;
  min-height:0!important;
  color:var(--z-fg-mute)!important;
  font-family:var(--z-mono)!important;
  font-size:11.5px!important;
  cursor:pointer!important;
}
html.zide .ContentItem-actions button:hover,
html.zide .ContentItem-actions .Button:hover,
html.zide .ContentItem-actions button:hover *{
  background:transparent!important;
  color:var(--z-link)!important;
}
html.zide .ContentItem-actions button > *{ color:inherit!important; }
html.zide .ContentItem-actions .IconGif,
html.zide .ContentItem-actions svg{ opacity:.6; }

/* --- 4. 评论区 → 行内注释 --- */
/* 每条评论以 // 起头，读起来就是源码里的注释行 */
html.zide [class*="CommentContent-item"]::before,
html.zide [class*="Comment-content"]::before{
  content:"//  ";
  color:var(--z-comment)!important;
  font-family:var(--z-mono)!important;
  user-select:none;
}
/* 评论作者 → 行内引用色（带 :not 三重排除提权，压过基线规则） */
html.zide [class*="Comment"] [class*="author"]:not([class*="badge" i]):not([class*="tag" i]):not([class*="label" i]),
html.zide [class*="Comment"][class*="author"]:not([class*="badge" i]):not([class*="tag" i]):not([class*="label" i]){
  color:var(--z-fg-dim)!important;
  font-family:var(--z-mono)!important;
}
/* 评论区整体当作一个注释块：顶部虚线开口，左侧一条注释专用竖线 */
html.zide [class*="Comments-container"],
html.zide .CommentList{
  border-top:1px dashed var(--z-line)!important;
  border-left:2px solid #6a99553d!important;
  padding-left:14px!important;
  margin-left:2px!important;
}
/* 评论元信息（时间 / 赞同 / 回复）压小变暗。
   变暗用 opacity 而不是 color：基线规则 html.zide [class*="Comment"]:not()×3
   的特异度是 (0,5,1)，用 color 得构造更长的选择器才压得过；而且 opacity 会
   同时作用于前景与背景，不会像改色那样把文字压到不可读（也不会波及徽标配色）。 */
html.zide [class*="Comment"] [class*="meta"],
html.zide [class*="Comment"] [class*="footer"],
html.zide [class*="Comment"] [class*="time"]{
  font-family:var(--z-mono)!important;
  font-size:11.5px!important;
  opacity:.78!important;
}
/* 评论内的徽标：纯社交装饰，降饱和 + 压小，避免彩色药丸把论坛感带回来。
   保留底色（只降饱和）——改成透明底会让黄底徽标的深字落到深底上不可读。
   用 :not 提一档特异度，确保上面的 font-size 不会把它撑大。 */
html.zide [class*="Comment"] [class*="badge" i]:not([class*="meta" i]),
html.zide [class*="Comment"] [class*="vipTag" i],
html.zide [class*="Comment"] [class*="badgeTag" i]{
  font-family:var(--z-mono)!important;
  font-size:10px!important;
  padding:0 4px!important;
  border-radius:2px!important;
  filter:saturate(.5)!important;
  opacity:.85!important;
}

/* --- 5. 排序 Tab → 排序指示 --- */
html.zide .Tabs-item, html.zide .Tab{
  font-family:var(--z-mono)!important;
  font-size:12px!important;
  color:var(--z-fg-mute)!important;
}
html.zide .Tabs-item.is-active::before,
html.zide .Tabs-item--active::before,
html.zide .Tab.is-active::before{
  content:"\\25b8  ";
  color:var(--z-func)!important;
}

/* --- 6. 卡片边界退成极淡的分隔线，削弱「卡片列表」观感 --- */
html.zide .List-item,
html.zide .AnswerItem,
html.zide .TopstoryItem{ border-bottom:1px solid #1d1d1d!important; }

/* --- 7. 去社交化：署名降级 + 头像去圆形 + 问题统计降为文件元信息 --- */
/* 署名行现在与文件头（@作者 · 日期）信息重复，降为次级灰度标签即可 */
html.zide .AuthorInfo-name,
html.zide .AuthorInfo-name a{
  color:var(--z-fg-dim)!important;
  font-weight:400!important;
  font-size:13px!important;
  font-family:var(--z-ui)!important;
}
html.zide .AuthorInfo-name:hover, html.zide .AuthorInfo-name a:hover{ color:var(--z-link)!important; }

/* 圆形头像是最强的「社交网络」信号；改成方形并降饱和，读起来像文件图标。
   降饱和只作用于 img，避免给 .Avatar 加 filter 而创建新的层叠上下文 */
html.zide .Avatar{ border-radius:3px!important; }
html.zide .Avatar img{ border-radius:3px!important; filter:saturate(.35)!important; }

/* 问题统计行（128 个回答 · 4.2 万关注 · …）→ 文件元信息 */
html.zide .QuestionHeader-title ~ div,
html.zide .QuestionHeader-title ~ span,
html.zide .QuestionHeader-info,
html.zide .QuestionHeader-status{
  font-family:var(--z-mono)!important;
  font-size:11.5px!important;
  color:var(--z-fg-mute)!important;
}

/* ---------- IDE 外壳 ---------- */
#zide-root, #zide-root *{ box-sizing:border-box; }
#zide-root{ font-family:var(--z-ui); }
.zide-part{
  position:fixed; z-index:2147483000; background:var(--z-bg-0);
  border-color:var(--z-line)!important; user-select:none;
}
.zide-activity{
  left:0; top:0; bottom:0; width:48px;
  display:flex; flex-direction:column; align-items:center; padding-top:4px;
  border-right:1px solid var(--z-line);
}
.zide-act{
  width:48px; height:48px; display:flex; align-items:center; justify-content:center;
  color:#868686; position:relative; cursor:pointer;
}
.zide-act:hover{ color:var(--z-fg); }
.zide-act.zide-on{ color:var(--z-fg-hi); }
.zide-act.zide-on::before{ content:""; position:absolute; left:0; top:0; bottom:0; width:2px; background:#d4d4d4; }
.zide-act svg{ width:23px; height:23px; }
.zide-act .zide-badge{
  position:absolute; right:9px; bottom:10px; background:var(--z-blue); color:#fff;
  font-size:9px; line-height:12px; padding:0 4px; border-radius:8px;
}
.zide-grow{ flex:1; }

.zide-side{
  left:48px; top:0; bottom:0; width:208px; display:flex; flex-direction:column;
  border-right:1px solid var(--z-line);
}
.zide-side-title{
  height:35px; flex:0 0 35px; display:flex; align-items:center; justify-content:space-between;
  padding:0 12px; font-size:11px; letter-spacing:.05em; text-transform:uppercase;
  color:var(--z-fg-dim); border-bottom:1px solid var(--z-line);
}
.zide-side-body{ flex:1; overflow:auto; padding:4px 0 14px; }
.zide-sec{
  height:22px; display:flex; align-items:center; gap:5px; padding:0 6px;
  font-size:11px; font-weight:700; color:var(--z-fg); text-transform:uppercase; letter-spacing:.04em;
  font-family:var(--z-ui);
}
.zide-sec i{ width:12px; font-style:normal; font-size:9px; color:var(--z-fg-dim); }
.zide-node{
  height:22px; display:flex; align-items:center; gap:6px; padding:0 8px 0 6px;
  font-size:13px; color:var(--z-fg); position:relative; white-space:nowrap; overflow:hidden;
}
.zide-node .zide-nm{ overflow:hidden; text-overflow:ellipsis; font-family:var(--z-ui); }
.zide-node .zide-git{ margin-left:auto; color:var(--z-yellow); font-family:var(--z-mono); font-size:12px; }
.zide-node.zide-sel{ background:var(--z-sel); color:var(--z-fg-hi); }
.zide-node.zide-sel::before{ content:""; position:absolute; left:0; top:0; bottom:0; width:2px; background:var(--z-link); }
.zide-node.zide-cur .zide-nm{ font-family:var(--z-mono); font-size:12.5px; color:var(--z-const); }
.zide-ico{ width:15px; flex:0 0 15px; display:flex; align-items:center; justify-content:center; }
.zide-pad1{ padding-left:10px; } .zide-pad2{ padding-left:24px; }
.zide-pad3{ padding-left:38px; } .zide-pad4{ padding-left:52px; }
.zide-meta{
  padding:6px 12px 8px; font-family:var(--z-mono); font-size:11px; line-height:1.75;
  color:var(--z-fg-mute); border-top:1px solid var(--z-line);
}
.zide-meta b{ color:var(--z-fg-dim); font-weight:400; }
.zide-meta .zide-k{ color:var(--z-keyword); }
.zide-meta .zide-s{ color:var(--z-string); }
.zide-meta .zide-c{ color:var(--z-comment); }
.zide-meta .zide-t{ color:var(--z-type); }

.zide-tabbar{
  left:256px; right:0; top:0; height:34px;
  display:flex; align-items:stretch; overflow:hidden;
  border-bottom:1px solid var(--z-line);
}
.zide-tab{
  display:flex; align-items:center; gap:7px; padding:0 12px; min-width:130px; max-width:250px;
  border-right:1px solid var(--z-line); color:var(--z-fg-dim); font-size:13px; position:relative;
  font-family:var(--z-ui); cursor:default;
}
.zide-tab .zide-tn{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.zide-tab.zide-on{ background:var(--z-bg-1); color:#fff; }
.zide-tab.zide-on::before{ content:""; position:absolute; left:0; right:0; top:0; height:1px; background:var(--z-link); }
.zide-tab .zide-dot{ width:7px; height:7px; border-radius:50%; background:var(--z-fg-dim); flex:0 0 auto; }
.zide-tab .zide-x{ margin-left:auto; opacity:.55; font-size:14px; line-height:1; }

.zide-map{
  right:0; top:34px; bottom:22px; width:78px; border-left:1px solid #ffffff0a;
  overflow:hidden; cursor:pointer;
}
.zide-map-inner{ position:absolute; left:6px; right:26px; top:0; }
.zide-ml{ height:2px; margin-bottom:1px; border-radius:1px; background:#5a5a5a; opacity:.75; }
.zide-ml.k{ background:#569cd6; } .zide-ml.s{ background:#ce9178; }
.zide-ml.c{ background:#6a9955; } .zide-ml.t{ background:#4ec9b0; }
.zide-ml.f{ background:#dcdcaa; }
.zide-map .zide-slider{ position:absolute; right:0; top:0; bottom:0; width:22px; background:var(--z-bg-1); border-left:1px solid #ffffff08; }
.zide-vp{
  position:absolute; left:0; right:0; background:#ffffff18; pointer-events:none;
  border-top:1px solid #ffffff14; border-bottom:1px solid #ffffff14;
}

.zide-status{
  left:0; right:0; bottom:0; height:22px; display:flex; align-items:center;
  font-size:12px; color:#fff; padding:0 2px; gap:0;
}
.zide-sb{ display:flex; align-items:center; gap:4px; padding:0 7px; height:22px; border-radius:3px; cursor:default; white-space:nowrap; }
.zide-sb:hover{ background:#ffffff1f; }
.zide-sb.zide-brand{ background:#ffffff14; }
.zide-sb.zide-mono{ font-family:var(--z-mono); font-size:11px; }
.zide-sb.zide-push{ margin-left:auto; }
.zide-sb svg{ width:13px; height:13px; }
.zide-sb.zide-toggle{ cursor:pointer; }

/* 回答/文章头部的「文件头」：路径 ──────── @作者 · 日期
   必须带 html.zide 前缀，否则关闭皮肤后会残留在原生浅色页面上 */
html.zide .zide-anno{
  display:flex; align-items:center; gap:9px;
  margin:14px 0 10px; padding:0 2px;
  font-family:var(--z-mono); font-size:11.5px; color:var(--z-fg-mute)!important;
  user-select:none; white-space:nowrap; overflow:hidden;
}
html.zide .zide-anno .zide-anno-ico{ color:var(--z-keyword)!important; font-size:10px; }
html.zide .zide-anno .zide-anno-path{ color:var(--z-fg-hi)!important; }
html.zide .zide-anno .zide-anno-fill{ flex:1; height:1px; min-width:16px; background:var(--z-line-2); }
html.zide .zide-anno .zide-anno-at{ color:var(--z-fg-dim)!important; }
html.zide .zide-anno .zide-anno-s{ color:var(--z-fg-mute)!important; }
html.zide .zide-anno .zide-anno-f{ color:var(--z-func)!important; }

/* ---------- 变更审阅分栏（右侧 diff） ----------
   布局模型对齐本机 IDE：编辑区被切成两块「紧贴」的面板，中间只有一条 1px 分隔线，
   整体铺满编辑区，不留空洞（本机 IDE 的文档/表格就是这么分的）。
   右栏宽度 = 可用宽的 47%，但有一条硬约束：正文必须守住 --z-measure（660px）。
   所以公式是 min(47% 可用宽, 可用宽 - 660)，再夹在 340–820px。
   第 11 轮把比例从 0.4 提到 0.47、上限 640→820：原方案里代码只占 41%，用户嫌少。
   栏的底色与正文同为 --z-bg-1，所以留白不会读成「空洞」。 */
html.zide.zide-rv{
  --z-rv-w:clamp(340px, min(calc(47vw - 161px), calc(100vw - 1002px)), 820px);
}
html.zide.zide-rv body{ margin-right:calc(86px + var(--z-rv-w) + 1px)!important; }
/* 注意：主列的 max-width **不在这里设**。它由 applySideColumns() 以「内联 !important」
   写入，而内联 !important 压得过样式表里任何 !important，写在这里只会得到一条
   静默失效的规则（这个坑踩过一次）。 */
html.zide.zide-rv .RichText,
html.zide.zide-rv .RichContent-inner,
html.zide.zide-rv .zide-anno,
html.zide.zide-rv .ContentItem-actions,
html.zide.zide-rv .QuestionHeader{
  max-width:var(--z-measure)!important; margin-left:auto!important; margin-right:auto!important;
}

.zide-review{
  position:fixed; z-index:2147483002;
  right:86px; top:34px; bottom:22px;
  width:var(--z-rv-w, 520px);
  display:none; flex-direction:column;
  background:var(--z-bg-1);
  border-left:1px solid #3b3e43;
  /* 从正文里「浮」出来：一层向内的投影把审阅栏和文章切开，扫读时不会串行 */
  box-shadow:-12px 0 28px -8px #000000b8;
  font-family:var(--z-mono); font-size:12px;
  overflow:hidden;
}
html.zide.zide-rv .zide-review{ display:flex; }
.zide-rv-head{
  flex:0 0 28px; display:flex; align-items:center; gap:7px; padding:0 8px;
  background:var(--z-bg-2); border-bottom:1px solid var(--z-line);
  color:var(--z-fg-dim); white-space:nowrap; overflow:hidden; font-size:11.5px;
}
.zide-rv-file{ color:var(--z-fg-hi); font-weight:600; overflow:hidden; text-overflow:ellipsis; }
.zide-rv-badge{ color:var(--z-yellow); }
.zide-rv-stat{ margin-left:auto; }
.zide-rv-stat .zide-add{ color:var(--z-green); }
.zide-rv-stat .zide-del{ color:var(--z-red); }
.zide-rv-x{ cursor:pointer; padding:0 2px; color:var(--z-fg-mute); }
.zide-rv-x:hover{ color:var(--z-fg); }
.zide-rv-main{ flex:1; display:flex; min-height:0; }
.zide-rv-body{ flex:1; min-width:0; overflow:hidden; padding:5px 0 24px; }
.zide-rv-ruler{ flex:0 0 9px; border-left:1px solid var(--z-line); background:var(--z-bg-0); position:relative; }
.zide-rv-tick{ position:absolute; left:1px; right:1px; height:3px; border-radius:1px; }
.zide-rv-tick.a{ background:var(--z-green); }
.zide-rv-tick.d{ background:var(--z-red); }
.zide-rv-tick.m{ background:#8bbf77; }

/* 第 10 轮：把审阅栏的代码整体调亮、做显眼。
   三条手段：① 语义色换成高彩度稿；② 字号 11→12、行距 1.62→1.72，gutter 加分隔线；
             ③ 加/删行底色提高透明度、hunk 头加粗提亮。 */
.zide-rl{ display:flex; white-space:pre; line-height:1.72; }
.zide-rl-no{
  flex:0 0 34px; text-align:right; padding-right:8px;
  color:var(--z-rv-gutter)!important; user-select:none;
  box-shadow:inset -1px 0 0 #ffffff12;   /* 行号与代码之间的分隔，像真编辑器的 gutter */
}
.zide-rl-mk{ flex:0 0 13px; color:var(--z-fg-mute)!important; font-weight:700; }
.zide-rl-tx{ flex:1; min-width:0; overflow:hidden; color:var(--z-rv-code); }
.zide-rl-tx i{ font-style:normal; }
.zide-rl-tx i.k{ color:var(--z-keyword); font-weight:600; }
.zide-rl-tx i.t{ color:var(--z-type); }
.zide-rl-tx i.f{ color:var(--z-func); }
.zide-rl-tx i.s{ color:var(--z-string); }
.zide-rl-tx i.c{ color:var(--z-comment); }
.zide-rl-tx i.n{ color:var(--z-num); }
.zide-rl-tx i.v{ color:var(--z-var); }
.zide-rl.ctx .zide-rl-tx{ color:var(--z-rv-code); }
.zide-rl.add{ background:#3fb9501f; }
.zide-rl.add .zide-rl-mk{ color:var(--z-green)!important; }
.zide-rl.del{ background:#f851491f; }
.zide-rl.del .zide-rl-tx{ color:#b9b9b9; }
.zide-rl.del .zide-rl-mk{ color:var(--z-red)!important; }
.zide-rl.hunk{ background:#ffffff12; color:#9ec7ea!important; font-weight:600; }
.zide-rl.hunk .zide-rl-no{ color:transparent!important; box-shadow:none; }
.zide-rl.cur{
  /* 用 background-image 叠加，而不是覆盖 background-color ——
     否则「当前行」会把 add/del 的红绿整条吃掉（旧版就是这个毛病） */
  background-image:linear-gradient(#ffffff14,#ffffff14);
  box-shadow:inset 2px 0 0 var(--z-keyword);
}
.zide-rl.cur .zide-rl-no{ color:#d2d6db!important; }

/* ---------- 融合模式：代码单元直接插进正文流 ----------
   两种版式互斥：分栏（右侧固定 diff 栏）↔ 融合（代码跟着段落走）。
   融合时正文放宽到 760，代码单元与正文同宽、同列，读起来是「一篇带实现的文档」，
   而不是「一个网页 + 一条侧栏」。 */
html.zide.zide-fuse{ --z-measure:760px; }
/* 首页信息流：卡片是「列表行」，度量放宽到 820 才不至于每行只放二十来个字。
   这条必须排在 .zide-fuse 之后 —— 同特异度时靠文档顺序决胜 */
html.zide.zide-feed{ --z-measure:820px; }
/* 搜索结果页：同样是「列表行」，度量跟信息流一致。
   必须排在这两条之后 —— 同特异度时靠文档顺序决胜 */
html.zide.zide-search{ --z-measure:820px; }
html.zide.zide-fuse .zide-review{ display:none!important; }
html.zide.zide-fuse body{ margin-right:86px!important; }
html.zide.zide-fuse #zideRv{ display:none!important; }   /* 分栏模式下才有意义的开关，收起来 */
html.zide.zide-fuse .RichText,
html.zide.zide-fuse .RichContent-inner,
html.zide.zide-fuse .zide-anno,
html.zide.zide-fuse .ContentItem-actions,
html.zide.zide-fuse .QuestionHeader{
  max-width:var(--z-measure)!important; margin-left:auto!important; margin-right:auto!important;
}

.zide-cell{
  margin:4px 0 20px;
  border:1px solid var(--z-line);
  border-left:2px solid #3f556b;
  border-radius:4px;
  background:var(--z-code);
  font-family:var(--z-mono); font-size:12px;
  overflow:hidden;
}
.zide-cell-head{
  display:flex; align-items:center; gap:8px; height:24px; padding:0 9px;
  background:#1d1e1f; border-bottom:1px solid var(--z-line);
  color:var(--z-fg-mute); font-size:11px; white-space:nowrap; overflow:hidden;
}
.zide-cell-head .zide-cell-file{ color:#a8c6e0; overflow:hidden; text-overflow:ellipsis; }
.zide-cell-head .zide-cell-rg{ color:var(--z-fg-mute); }
.zide-cell-head .zide-cell-tag{
  margin-left:auto; flex:0 0 auto; padding:0 5px; border-radius:2px;
  background:#2a3a49; color:#9dc0dd;
}
.zide-cell-body{ padding:6px 0 8px; }
/* 单元里的行复用审阅栏的行样式，但不要 +/- 标记列 */
.zide-cell .zide-rl-mk{ display:none; }
.zide-cell .zide-rl:hover{ background:#ffffff0a; }
/* ⚠ 正文里有一条 html.zide .RichText * { color: !important } 的通配规则，
   而融合单元就插在 .RichText 内部 —— 语法色会被它整片压平成正文灰。
   这里用更高的特异度（0,4,2 > 0,2,1）顶回来，否则代码会变成一坨白色。 */
html.zide .zide-cell .zide-rl-tx{ color:var(--z-rv-code)!important; }
html.zide .zide-cell .zide-rl-no{ color:var(--z-rv-gutter)!important; }
html.zide .zide-cell .zide-rl-tx i.k{ color:var(--z-keyword)!important; font-weight:600; }
html.zide .zide-cell .zide-rl-tx i.t{ color:var(--z-type)!important; }
html.zide .zide-cell .zide-rl-tx i.f{ color:var(--z-func)!important; }
html.zide .zide-cell .zide-rl-tx i.s{ color:var(--z-string)!important; }
html.zide .zide-cell .zide-rl-tx i.c{ color:var(--z-comment)!important; }
html.zide .zide-cell .zide-rl-tx i.n{ color:var(--z-num)!important; }
html.zide .zide-cell .zide-rl-tx i.v{ color:var(--z-var)!important; }
html.zide .zide-cell .zide-cell-head,
html.zide .zide-cell .zide-cell-head span{ color:var(--z-fg-mute)!important; }
html.zide .zide-cell .zide-cell-head .zide-cell-file{ color:#a8c6e0!important; }
html.zide .zide-cell .zide-cell-head .zide-cell-tag{ color:#9dc0dd!important; }

/* 超宽屏（用户的屏是 2560）：正文列跟着长一点，否则两侧空白会明显到像「坏了」。
   上限压在 860px —— 13px 中文一行约 48 字，再宽就开始串行 */
@media (min-width:2100px){
  html.zide.zide-rv{ --z-measure:760px; }
  html.zide.zide-fuse{ --z-measure:860px; }
  /* 信息流在超宽屏上放宽到 980：卡片是「列表行」，不像正文那样怕行太长 */
  html.zide.zide-feed{ --z-measure:980px; }
  html.zide.zide-search{ --z-measure:980px; }
}

@media (max-width:1360px){
  html.zide.zide-rv body{ margin-right:calc(12px + var(--z-rv-w) + 1px)!important; }
  html.zide.zide-rv .zide-review{ right:12px; }
}
@media (max-width:1360px){
  .zide-map{ display:none; }
  html.zide body{ margin-right:12px!important; }
}
@media (max-width:1180px){
  .zide-side{ display:none; }
  html.zide body{ margin-left:48px!important; }
  .zide-tabbar{ left:48px; }
}
/* 太窄时整条收起：硬分栏会把正文挤成碎片，比不分栏更假。
   正文的度量保留 —— 窄屏下它本来就是更舒服的读数 */
@media (max-width:1199px){
  html.zide.zide-rv .zide-review{ display:none!important; }
  html.zide.zide-rv body{ margin-right:12px!important; }
  /* 融合模式在窄屏不改度量：侧栏收起后可用宽会突然变 1040，
     若跟着铺满，13px 中文一行会到 78 字，读起来是灾难。保持 760。 */
}
`;

  function injectCSS() {
    if ($('#zide-style')) return true;
    const host = document.head || document.documentElement;
    if (!host) return false;
    const st = document.createElement('style');
    st.id = 'zide-style';
    st.textContent = CSS;
    host.appendChild(st);
    return true;
  }

  (function earlyBoot() {
    let tries = 0;
    (function step() {
      const okCss = injectCSS();
      const okCls = markEarly();
      if ((okCss && okCls) || tries++ > 600) return;
      setTimeout(step, 0);
    })();
  })();

  /* ============================================================
     2. 图标
     ============================================================ */
  const svg = (d, w) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 1.5) + '" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
  const ICON = {
    files: svg('<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M13 2v7h7"/>'),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/>', 1.6),
    git: svg('<circle cx="6" cy="6" r="2.6"/><circle cx="6" cy="18" r="2.6"/><circle cx="17" cy="12" r="2.6"/><path d="M6 8.6v6.8M8.6 6H14a3 3 0 0 1 3 3v.6"/>'),
    debug: svg('<path d="M5 3l14 9-14 9z"/><circle cx="18" cy="5" r="2"/>'),
    ext: svg('<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><path d="M17 13v8M13 17h8"/>'),
    power: svg('<path d="M12 3v9"/><path d="M6.8 6.5a8 8 0 1 0 10.4 0"/>', 1.6),
    file: '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="#519aba" stroke-width="1.3"><path d="M9 1.6H4.2A1.2 1.2 0 0 0 3 2.8v10.4A1.2 1.2 0 0 0 4.2 14.4h7.6A1.2 1.2 0 0 0 13 13.2V5.6z"/><path d="M9 1.6v4h4"/></svg>',
    json: '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="#cbcb41" stroke-width="1.3"><path d="M9 1.6H4.2A1.2 1.2 0 0 0 3 2.8v10.4A1.2 1.2 0 0 0 4.2 14.4h7.6A1.2 1.2 0 0 0 13 13.2V5.6z"/><path d="M9 1.6v4h4"/></svg>',
    dir: '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="#dcb67a" stroke-width="1.3"><path d="M1.8 12.6V3.8A1 1 0 0 1 2.8 2.8h3.4l1.4 1.7h5.6a1 1 0 0 1 1 1v7.1a1 1 0 0 1-1 1H2.8a1 1 0 0 1-1-1z"/></svg>',
    branch: svg('<circle cx="4.5" cy="4" r="1.8"/><circle cx="4.5" cy="12" r="1.8"/><circle cx="11.5" cy="8" r="1.8"/><path d="M4.5 5.8v4.4M6.3 4h3.4a1.8 1.8 0 0 1 1.8 1.8v.4"/>', 1.4),
    check: svg('<path d="M4 8.4 7.2 11.6 13 4.8"/>', 1.8),
    bell: svg('<path d="M8 2a4 4 0 0 1 4 4v3l1.2 1.6H2.8L4 9V6a4 4 0 0 1 4-4z"/><path d="M6.6 12.6a1.4 1.4 0 0 0 2.8 0"/>', 1.4),
    err: svg('<circle cx="8" cy="8" r="6"/><path d="M8 5.2v3.6"/><circle cx="8" cy="11" r=".7" fill="currentColor"/>', 1.4),
    warn: svg('<path d="M8 2.4 14.4 13.6H1.6z"/><path d="M8 6.4v3.2"/><circle cx="8" cy="11.6" r=".7" fill="currentColor"/>', 1.4),
  };

  /* ============================================================
     3. 当前页面 -> 虚拟文件映射
     ============================================================ */
  function currentFile() {
    const p = location.pathname;
    let m;
    if ((m = p.match(/^\/question\/(\d+)\/answer\/(\d+)/))) return { name: 'answer-' + m[2] + '.ts', kind: 'answer', lang: 'TypeScript' };
    if ((m = p.match(/^\/question\/(\d+)/))) return { name: 'question-' + m[1] + '.ts', kind: 'question', lang: 'TypeScript' };
    if ((m = p.match(/^\/p\/(\d+)/))) return { name: 'article-' + m[1] + '.ts', kind: 'article', lang: 'Markdown' };
    if ((m = p.match(/^\/people\/([^\/?#]+)/))) return { name: 'people-' + m[1] + '.ts', kind: 'people', lang: 'TypeScript' };
    if ((m = p.match(/^\/hot/))) return { name: 'hot.ts', kind: 'hot', lang: 'TypeScript' };
    if ((m = p.match(/^\/follow/))) return { name: 'follow.ts', kind: 'follow', lang: 'TypeScript' };
    if ((m = p.match(/^\/collection/))) return { name: 'collection.ts', kind: 'collection', lang: 'TypeScript' };
    if ((m = p.match(/^\/search/))) return { name: 'search.ts', kind: 'search', lang: 'TypeScript' };
    if (p === '/' || p === '') return { name: 'feed.ts', kind: 'home', lang: 'TypeScript' };
    const seg = p.replace(/\/+$/, '').split('/').filter(Boolean).pop() || 'index';
    return { name: seg + '.ts', kind: 'other', lang: 'TypeScript' };
  }

  /* ============================================================
     4. 骨架构建
     ============================================================ */
  function buildRoot() {
    if ($('#zide-root')) return;
    const root = document.createElement('div');
    root.id = 'zide-root';
    root.innerHTML = `
      <div class="zide-part zide-activity">
        <div class="zide-act zide-on" title="资源管理器 (Ctrl+Shift+E)">${ICON.files}</div>
        <div class="zide-act" id="zideActSearch" title="搜索知乎 (Ctrl+K · 或把鼠标移到标签栏右上角)">${ICON.search}</div>
        <div class="zide-act" id="zideActGit" title="源代码管理 · 变更审阅 (Ctrl+Shift+G)">${ICON.git}<span class="zide-badge">3</span></div>
        <div class="zide-act" title="运行和调试 (Ctrl+Shift+D)">${ICON.debug}</div>
        <div class="zide-act" title="扩展 (Ctrl+Shift+X)">${ICON.ext}</div>
        <div class="zide-grow"></div>
        <div class="zide-act zide-toggle" id="zideToggle" title="切换 IDE 皮肤 (Ctrl+\`)">${ICON.power}</div>
      </div>

      <div class="zide-part zide-side">
        <div class="zide-side-title"><span>资源管理器</span><span style="opacity:.7;letter-spacing:1px">···</span></div>
        <div class="zide-side-body" id="zideTree"></div>
        <div class="zide-meta" id="zideMeta"></div>
      </div>

      <div class="zide-part zide-tabbar" id="zideTabs"></div>

      <div class="zide-part zide-map" id="zideMap">
        <div class="zide-map-inner" id="zideMapInner"></div>
        <div class="zide-slider"></div>
        <div class="zide-vp" id="zideVp"></div>
      </div>

      <div class="zide-part zide-status" id="zideStatus"></div>

      <div class="zide-part zide-review" id="zideReview">
        <div class="zide-rv-head">
          <span class="zide-rv-file" id="zideRvFile">reader.ts</span>
          <span class="zide-rv-badge">M</span>
          <span class="zide-rv-stat" id="zideRvStat"></span>
          <span class="zide-rv-x" id="zideRvClose" title="收起审阅栏 (Ctrl+Shift+G)">&#215;</span>
        </div>
        <div class="zide-rv-main">
          <div class="zide-rv-body" id="zideRvBody"></div>
          <div class="zide-rv-ruler" id="zideRvRuler"></div>
        </div>
      </div>

      <!-- 搜索感应区：压在标签栏右段上，鼠标靠近就把下面的抽屉拉下来 -->
      <div class="zide-find-hot" id="zideFindHot">
        <span class="zide-find-chip">&#9906; 搜索<b>Ctrl K</b></span>
      </div>
      <div class="zide-find" id="zideFind">
        <input id="zideFindInput" placeholder="搜索知乎…" spellcheck="false" autocomplete="off">
        <span class="zide-hint">↵ 搜索 · Esc 取消</span>
      </div>
    `;
    document.body.appendChild(root);

    const map = $('#zideMap');
    map.addEventListener('click', function (e) {
      const r = map.getBoundingClientRect();
      const ratio = (e.clientY - r.top) / r.height;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: Math.max(0, ratio * max), behavior: 'auto' });
    });
    $('#zideToggle').addEventListener('click', () => setEnabled(!enabled));
    const actSearch = $('#zideActSearch');
    if (actSearch) actSearch.addEventListener('click', function () { toggleFind(true); });
    const actGit = $('#zideActGit');
    if (actGit) actGit.addEventListener('click', function () { setReview(!review); });
    const rvClose = $('#zideRvClose');
    if (rvClose) rvClose.addEventListener('click', function () { setReview(false); });
    const findInput = $('#zideFindInput');
    if (findInput) {
      findInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); submitFind(); }
        else if (e.key === 'Escape') { e.preventDefault(); toggleFind(false); }
        e.stopPropagation();
      });
      // 只要动过键盘，就不再自动收回 —— 否则鼠标一抖就把正在输的内容顶掉
      findInput.addEventListener('input', function () { findTyped = true; });
    }
    // 悬浮感应：靠近标签栏右上角滑出，离开 300ms 收回。
    // 鼠标唤起也直接聚焦输入框 —— 「靠近 → 打字 → 回车」一步到位，
    // 中间不必再点一下；没敲字就离开时照样会自动收回（见 scheduleCloseFind）
    const hot = $('#zideFindHot');
    if (hot) {
      hot.addEventListener('mouseenter', function () { openFind(true); });
      hot.addEventListener('mouseleave', function () { scheduleCloseFind(); });
    }
    const findBox = $('#zideFind');
    if (findBox) {
      findBox.addEventListener('mouseenter', function () { clearTimeout(findTimer); });
      findBox.addEventListener('mouseleave', function () { scheduleCloseFind(); });
    }
  }

  /* ============================================================
     5. 侧栏：文件树（真实映射当前页面）+ 元信息
     ============================================================ */
  const REPO = [
    { d: 1, n: '.vscode', t: 'dir' },
    { d: 2, n: 'settings.json', t: 'json' },
    { d: 1, n: 'public', t: 'dir' },
    { d: 2, n: 'favicon.svg', t: 'file' },
    { d: 1, n: 'src', t: 'dir' },
    { d: 2, n: 'api', t: 'dir' },
    { d: 3, n: 'reader.ts', t: 'file', git: 'M' },
    { d: 2, n: 'hooks', t: 'dir' },
    { d: 3, n: 'useFeed.ts', t: 'file' },
    { d: 3, n: 'useScrollRestore.ts', t: 'file', git: 'M' },
    { d: 2, n: 'pages', t: 'dir' },
    { d: 2, n: 'store', t: 'dir' },
    { d: 3, n: 'prefs.ts', t: 'file' },
    { d: 2, n: 'utils', t: 'dir' },
    { d: 3, n: 'markdown.ts', t: 'file' },
    { d: 3, n: 'throttle.ts', t: 'file' },
    { d: 2, n: 'main.tsx', t: 'file' },
    { d: 1, n: 'package.json', t: 'json', git: 'M' },
    { d: 1, n: 'tsconfig.json', t: 'json' },
    { d: 1, n: 'README.md', t: 'file' },
  ];
  const ico = (t) => t === 'dir' ? ICON.dir : (t === 'json' ? ICON.json : ICON.file);

  function renderTree() {
    const host = $('#zideTree');
    if (!host) return;
    const cur = currentFile();
    const rows = [];
    for (const it of REPO) {
      rows.push(
        '<div class="zide-node zide-pad' + Math.min(it.d, 4) + '">'
        + '<span class="zide-ico">' + ico(it.t) + '</span>'
        + '<span class="zide-nm">' + it.n + '</span>'
        + (it.git ? '<span class="zide-git">' + it.git + '</span>' : '')
        + '</div>'
      );
      if (it.n === 'pages') {
        rows.push(
          '<div class="zide-node zide-pad3 zide-cur zide-sel">'
          + '<span class="zide-ico">' + ICON.file + '</span>'
          + '<span class="zide-nm">' + cur.name + '</span>'
          + '<span class="zide-git">M</span>'
          + '</div>'
        );
      }
    }
    host.innerHTML = rows.join('');

    const meta = $('#zideMeta');
    if (meta) {
      meta.innerHTML =
          '<div><span class="zide-c">// 当前模块</span></div>'
        + '<div><span class="zide-k">export const</span> <span class="zide-t">moduleName</span> = <span class="zide-s">\'' + cur.name + '\'</span></div>'
        + '<div><span class="zide-k">export const</span> <span class="zide-t">routeKind</span> = <span class="zide-s">\'' + cur.kind + '\'</span></div>'
        + '<div><span class="zide-c">// 快捷键</span></div>'
        + '<div><b>Ctrl+&#96;</b> 切换皮肤 · <b>Ctrl+Shift+G</b> 审阅栏 · <b>Ctrl+Shift+H</b> 老板键</div>';
    }
  }

  /* ============================================================
     6. 标签页 / 状态栏
     ============================================================ */
  const STATIC_TABS = ['feed.ts', 'prefs.ts', 'markdown.ts'];

  function renderTabs() {
    const host = $('#zideTabs');
    if (!host) return;
    const cur = currentFile();
    const tabs = [cur.name].concat(STATIC_TABS);
    host.innerHTML = tabs.map(function (n, i) {
      return '<div class="zide-tab' + (i === 0 ? ' zide-on' : '') + '">'
        + '<span class="zide-ico" style="width:13px;flex:0 0 13px">' + (i === 0 ? ICON.file : ICON.file) + '</span>'
        + '<span class="zide-tn">' + n + '</span>'
        + (i === 0 ? '<span class="zide-dot"></span>' : '<span class="zide-x">×</span>')
        + '</div>';
    }).join('');
  }

  function renderStatus() {
    const host = $('#zideStatus');
    if (!host) return;
    const cur = currentFile();
    host.innerHTML =
        '<div class="zide-sb zide-brand" title="远程：本地">' + svg('<path d="M2 5.5 8 2l6 3.5v5L8 14l-6-3.5z"/><path d="M2 5.5 8 9l6-3.5M8 9v5"/>', 1.3) + '</div>'
      + '<div class="zide-sb zide-mono" title="Git 分支">' + ICON.branch + '<span>main*</span></div>'
      + '<div class="zide-sb zide-mono" title="错误与警告">' + ICON.err + '<span>0</span>' + ICON.warn + '<span>0</span></div>'
      + '<div class="zide-sb zide-mono" id="zidePos" title="光标位置">行 1，列 1</div>'
      + '<div class="zide-sb zide-mono zide-push" title="端口">端口:5173</div>'
      + '<div class="zide-sb zide-mono" title="缩进">空格: 2</div>'
      + '<div class="zide-sb zide-mono" title="编码">UTF-8</div>'
      + '<div class="zide-sb zide-mono" title="行尾">LF</div>'
      + '<div class="zide-sb zide-mono" title="语言模式">{ } ' + cur.lang + '</div>'
      + '<div class="zide-sb" title="Prettier 已启用">' + ICON.check + '</div>'
      + '<div class="zide-sb" title="通知">' + ICON.bell + '</div>'
      + '<div class="zide-sb zide-mono zide-toggle" id="zideFuse" title="融合模式：代码单元插进正文流 (Ctrl+Shift+M)">融合:' + (fuse ? 'on' : 'off') + '</div>'
      + '<div class="zide-sb zide-mono zide-toggle" id="zideRv" title="变更审阅分栏：右侧 diff (Ctrl+Shift+G)">审阅:' + (review ? 'on' : 'off') + '</div>'
      + '<div class="zide-sb zide-mono zide-toggle" id="zideClean" title="专注模式：隐藏顶部导航与右侧推荐/广告栏 (Ctrl+Shift+B)">专注:' + (clean ? 'on' : 'off') + '</div>'
      + '<div class="zide-sb zide-mono zide-toggle" id="zideOff" title="切换 IDE 皮肤 (Ctrl+&#96;)">zhihu-web</div>';
    const cleanEl = $('#zideClean');
    if (cleanEl) cleanEl.addEventListener('click', () => setClean(!clean));
    const fuseEl = $('#zideFuse');
    if (fuseEl) fuseEl.addEventListener('click', () => setFuse(!fuse));
    const rvEl = $('#zideRv');
    if (rvEl) rvEl.addEventListener('click', () => { if (fuse) setFuse(false); else setReview(!review); });
    const off = $('#zideOff');
    if (off) off.addEventListener('click', () => setEnabled(false));
  }

  // 专注模式：隐藏顶部站内导航与右侧推荐/广告栏
  function applyClean() {
    const de = document.documentElement;
    de.classList.toggle('zide-clean', enabled && clean);
    const el = $('#zideClean');
    if (el) el.textContent = '专注:' + (clean ? 'on' : 'off');
  }

  function applyReview() {
    document.documentElement.classList.toggle('zide-rv', !!(enabled && review));
  }

  function applyFuse() {
    document.documentElement.classList.toggle('zide-fuse', !!(enabled && fuse));
    const el = $('#zideFuse');
    if (el) el.textContent = '融合:' + (fuse ? 'on' : 'off');
  }

  function setReview(next) {
    review = !!next;
    try { localStorage.setItem(KEY_REVIEW, review ? '1' : '0'); } catch (e) {}
    applyReview();
    const el = $('#zideRv');
    if (el) el.textContent = '审阅:' + (review ? 'on' : 'off');
    // 主列的 max-width 由 applySideColumns 以「内联 !important」写入，
    // 样式表改不动它，必须重新跑一次
    try { applySideColumns(); } catch (e) {}
    if (review && enabled) { reviewSig = ''; renderReview(false); syncReview(true); }
  }

  // 融合 / 分栏是两种版式，同一时刻只可能有一种在显示。
  // 打开融合 = 收起右栏并把代码插进正文；关闭融合 = 回到分栏（若审阅仍开着）。
  function setFuse(next) {
    fuse = !!next;
    try { localStorage.setItem(KEY_FUSE, fuse ? '1' : '0'); } catch (e) {}
    applyFuse();
    try { applySideColumns(); } catch (e) {}
    try { renderMap(); } catch (e) {}
    fuseSig = '';
    try { renderFusion(true); } catch (e) {}
    if (!fuse && review && enabled) { reviewSig = ''; renderReview(true); syncReview(true); }
  }

  function setClean(next) {
    clean = !!next;
    try { localStorage.setItem(KEY_CLEAN, clean ? '1' : '0'); } catch (e) {}
    applyClean();
    // 布局宽度变化，重算右栏与 minimap；不回到顶部，避免打断阅读
    try { applySideColumns(); } catch (e) {}
    try { renderMap(); } catch (e) {}
    updatePos();
  }

  // 查找框：替代被隐藏的站内搜索。
  // 三种打开方式共用一套状态：靠近感应区（鼠标）、活动栏图标（点击）、Ctrl+K / Ctrl+Shift+F（键盘）。
  // 收起规则分两类：只是「扫过去看了一眼」→ 鼠标离开就收；已经敲过字 → 必须 Esc / 回车 / 点走才收。
  let findTimer = 0;
  let findTyped = false;
  function openFind(focus) {
    const box = $('#zideFind');
    if (!box) return;
    clearTimeout(findTimer);
    // 已经开着就只续命，不再抢焦点/重选 —— 否则输到一半把鼠标划过头顶，
    // 已输入的内容会被 select() 全选，下一次按键就把它替换掉了
    const wasShown = box.classList.contains('zide-show');
    box.classList.add('zide-show');
    if (!focus || wasShown) return;
    const i = $('#zideFindInput');
    // 延后一帧：刚显示出来的节点直接 focus 在部分版本上会丢
    if (i) setTimeout(function () { try { i.focus(); i.select(); } catch (e) {} }, 0);
  }
  function closeFind() {
    const box = $('#zideFind');
    if (!box) return;
    clearTimeout(findTimer);
    const i = $('#zideFindInput');
    if (i && document.activeElement === i) { try { i.blur(); } catch (e) {} }
    box.classList.remove('zide-show');
    findTyped = false;
  }
  function scheduleCloseFind() {
    clearTimeout(findTimer);
    findTimer = setTimeout(function () {
      const box = $('#zideFind');
      if (box && box.matches(':hover')) return;   // 指针还在抽屉上
      if (findTyped) return;                      // 正在输入，别抢
      closeFind();
    }, 300);
  }
  function toggleFind(force) {
    const box = $('#zideFind');
    if (!box) return;
    const show = force === undefined ? !box.classList.contains('zide-show') : !!force;
    if (!show) { closeFind(); return; }
    // 显式唤起（图标 / 快捷键）时清空上次的内容；悬浮唤起则保留
    if (!box.classList.contains('zide-show')) {
      const i = $('#zideFindInput');
      if (i) { i.value = ''; findTyped = false; }
    }
    openFind(true);
  }

  function submitFind() {
    const i = $('#zideFindInput');
    const q = ((i && i.value) || '').trim();
    if (!q) return;
    toggleFind(false);
    location.href = 'https://www.zhihu.com/search?type=content&q=' + encodeURIComponent(q);
  }

  function updatePos() {
    const el = $('#zidePos');
    if (!el) return;
    const doc = document.documentElement;
    const max = Math.max(1, doc.scrollHeight - window.innerHeight);
    const ratio = Math.min(1, Math.max(0, window.scrollY / max));
    const total = Math.max(40, Math.round(doc.scrollHeight / 19));
    const ln = Math.max(1, Math.round(ratio * (total - 1)) + 1);
    el.textContent = '行 ' + ln + '，列 ' + (1 + (window.scrollX % 40));
  }

  /* ============================================================
     7. minimap：由页面真实内容块生成
     ============================================================ */
  function contentBlocks() {
    const sel = '.List-item, .AnswerItem, .TopstoryItem, .ArticleItem, .RichText > p, .RichText > h2, .RichText > h3, .RichText > blockquote, .RichText > pre, .RichText > figure';
    let list = [];
    try { list = Array.prototype.slice.call(document.querySelectorAll(sel)); } catch (e) {}
    // 排除已被隐藏的元素（例如专注模式隐藏的右栏），避免 minimap 出现无内容的空条
    list = list.filter(function (el) {
      if (typeof el.checkVisibility === 'function') return el.checkVisibility();
      return el.offsetParent !== null;
    });
    return list.slice(0, 900);
  }

  function renderMap() {
    const inner = $('#zideMapInner');
    const map = $('#zideMap');
    if (!inner || !map) return;
    const blocks = contentBlocks();
    if (!blocks.length) { inner.innerHTML = ''; mapSignature = ''; return; }
    // 知乎的 DOM 持续变动，用签名守卫避免无意义的重绘
    const sig = blocks.length + ':' + Math.round(document.documentElement.scrollHeight / 48);
    if (sig === mapSignature) { syncMap(); return; }
    mapSignature = sig;
    const H = map.clientHeight || 0;
    const rowH = blocks.length > 0 ? Math.max(1.2, Math.min(9, (H / blocks.length) * 0.62)) : 2;
    const gap = Math.max(0.6, rowH * 0.4);

    inner.innerHTML = blocks.map(function (el) {
      const tag = el.tagName.toLowerCase();
      let c = '';
      if (tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'pre') c = 'k';
      else if (tag === 'blockquote') c = 'c';
      else if (tag === 'figure' || tag === 'img') c = 't';
      else if (el.querySelector && el.querySelector('pre')) c = 'k';
      else if (el.querySelector && el.querySelector('img')) c = 't';
      else if (el.classList && (el.classList.contains('List-item') || el.classList.contains('AnswerItem'))) c = 'f';

      const text = (el.textContent || '').trim();
      const w = Math.min(100, Math.max(12, 8 + text.length * 0.22));
      const indent = Math.min(26, (text.length % 7) * 3);
      return '<div class="zide-ml ' + c + '" style="height:' + rowH.toFixed(1) + 'px;margin-bottom:' + gap.toFixed(1) + 'px;width:' + w.toFixed(1) + '%;margin-left:' + indent + '%"></div>';
    }).join('');
    syncMap();
  }

  function syncMap() {
    const vp = $('#zideVp');
    const map = $('#zideMap');
    if (!vp || !map) return;
    const doc = document.documentElement;
    const total = Math.max(1, doc.scrollHeight);
    const ratio = Math.min(1, window.innerHeight / total);
    const h = Math.max(18, (map.clientHeight || 0) * ratio);
    const top = Math.min((map.clientHeight || 0) - h, (map.clientHeight || 0) * (window.scrollY / total));
    vp.style.height = h.toFixed(0) + 'px';
    vp.style.top = Math.max(0, top).toFixed(0) + 'px';
  }

  /* ============================================================
     8. 内容装饰：给每个回答加一条「文件头」
     目的不是标注序号，而是把回答列表改写成一组源文件：
       ▸ answers/001.ans.ts ────────── @沈知远  2026-10-14
     这样回答之间的分界由「文件头横线」承担，而不是卡片边框，
     论坛味的「帖子列表」观感随之消失。
     ============================================================ */
  function escText(s) { return String(s).replace(/[<>'"]/g, ''); }

  function decorate() {
    if (!enabled) return;
    let items = [];
    try {
      items = Array.prototype.slice.call(document.querySelectorAll('.List-item, .AnswerItem, .ArticleItem'));
    } catch (e) { return; }

    items.slice(0, 40).forEach(function (it, i) {
      if (it.getAttribute('data-zide') === '1') return;
      it.setAttribute('data-zide', '1');
      const host = it.querySelector('.RichText, .RichContent-inner') || it;
      const authorEl = it.querySelector('.AuthorInfo-name a, .AuthorInfo-name, .UserLink-link');
      const author = escText((authorEl && authorEl.textContent.trim()) || 'anonymous');
      // 时间：优先取内容项的发布时间，取不到就留空（不要编造）
      let date = '';
      try {
        const timeEl = it.querySelector('.ContentItem-time, [class*="ContentItem"][class*="time"], time');
        const tm = timeEl && timeEl.textContent.match(/(\d{4}-\d{2}-\d{2})/);
        if (tm) date = tm[1];
      } catch (e) {}
      const no = ('00' + (i + 1)).slice(-3);

      const anno = document.createElement('div');
      anno.className = 'zide-anno';
      anno.innerHTML =
        '<span class="zide-anno-ico">\u25b8</span>' +
        '<span class="zide-anno-path">answers/' + no + '.ans.ts</span>' +
        '<span class="zide-anno-fill"></span>' +
        '<span class="zide-anno-at">@' + author + '</span>' +
        (date ? '<span class="zide-anno-s">' + date + '</span>' : '');

      // 插到内容项最前面，作为「文件头」；找不到 RichText 的项就退回插在正文前
      if (it.firstChild) it.insertBefore(anno, it.firstChild);
      else if (host.parentNode) host.parentNode.insertBefore(anno, host);
    });
  }

  // 关闭皮肤时必须把注入的节点真正删掉。
  // 只去掉 html.zide 类是不够的：CSS 失效后这些节点会以裸文本留在
  // 知乎原生浅色页面上（例如「▸ answers/001.ans.ts ──── @沈知远」）。
  function clearAnno() {
    let els;
    try { els = document.querySelectorAll('.zide-anno'); } catch (e) { els = []; }
    for (let i = els.length - 1; i >= 0; i--) {
      if (els[i].parentNode) els[i].parentNode.removeChild(els[i]);
    }
    try { els = document.querySelectorAll('[data-zide="1"]'); } catch (e) { return; }
    for (let i = 0; i < els.length; i++) els[i].removeAttribute('data-zide');
  }

  /* ============================================================
     8b. 评论区底色兜底
     知乎可能用 css-* 动态类名承载浅色底，纯 CSS 无法预知类名，
     这里按计算样式把仍然偏亮的底色压成透明，避免「浅底 + 浅字」。
     带处理标记，重复执行时只对新增节点付出开销。
     ============================================================ */
  const SURFACE_MARK = 'data-zide-bg';
  const PREV_BG_ATTR = 'data-zide-bg-prev';

  // 压平 / 还原统一走这一对函数：
  // 页面本身若写了内联 background-color，先存下原值，还原时按原值回填，
  // 避免 removeProperty 把页面自己的内联样式一起抹掉。
  //
  // ⚠ 优先级：这里**故意只用普通内联声明**，不加 !important。
  // 原因：皮肤自己的设计规则（如 .RichText pre 的 --z-code 底）带 !important，
  // 若压平也加 !important，内联会永久压死设计层，代码块底色再也上不来。
  // 普通内联声明已经能盖住知乎自家不带 !important 的浅底规则，足够用。
  // 只有当页面确实用 !important 顶住时，才升级为 !important（见下面的回读判断）。
  function flattenBg(el) {
    try {
      const prev = el.style.getPropertyValue('background-color');
      if (prev) el.setAttribute(PREV_BG_ATTR, prev);
      el.style.setProperty('background-color', 'transparent');
      // 回读：若仍是浅色，说明页面用了 !important，普通声明压不住 → 升级
      const still = getComputedStyle(el).backgroundColor;
      const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(still || '');
      if (!m) return;
      const a = m[4] === undefined ? 1 : parseFloat(m[4]);
      if (a >= 0.5 && (+m[1] + +m[2] + +m[3]) / 3 >= 140) {
        el.style.setProperty('background-color', 'transparent', 'important');
      }
    } catch (e) {}
  }
  function restoreBg(el) {
    try {
      const prev = el.getAttribute(PREV_BG_ATTR);
      if (prev) { el.style.setProperty('background-color', prev); el.removeAttribute(PREV_BG_ATTR); }
      else if (el.style) el.style.removeProperty('background-color');
    } catch (e) {}
  }

  function fixCommentSurfaces() {
    if (!enabled) return;
    let nodes;
    try { nodes = document.querySelectorAll('[class*="Comment"] *, [class*="Comment"]'); } catch (e) { return; }
    let budget = 800;
    for (let i = 0; i < nodes.length && budget > 0; i++) {
      const el = nodes[i];
      if (el.getAttribute(SURFACE_MARK) === '1') continue;
      budget--;
      // 徽标 / 标签 / 头像类元素自带主题底色，跳过
      // （注意：跳过的元素不能打处理标记，否则关闭皮肤时会误删页面自己的内联背景色）
      const cls = typeof el.className === 'string' ? el.className : '';
      if (/badge|label|tag|avatar|icon/i.test(cls)) continue;
      let bg;
      try { bg = getComputedStyle(el).backgroundColor; } catch (e) { continue; }
      const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(bg || '');
      if (!m) continue;
      const alpha = m[4] === undefined ? 1 : parseFloat(m[4]);
      if (alpha < 0.5) continue;                              // 本来就是透明
      if ((+m[1] + +m[2] + +m[3]) / 3 < 140) continue;         // 本来就是深色
      flattenBg(el);
      el.setAttribute(SURFACE_MARK, '1');
    }
  }

  // 关闭皮肤时必须还原内联样式，否则原生浅色页面上会留下透明底
  function clearSurfaceFixes() {
    let els;
    try { els = document.querySelectorAll('[' + SURFACE_MARK + '="1"]'); } catch (e) { return; }
    for (let i = 0; i < els.length; i++) {
      restoreBg(els[i]);
      els[i].removeAttribute(SURFACE_MARK);
    }
  }

  /* ============================================================
     8b2. 页面级浅底压平（不依赖类名的兜底）
     知乎的容器类名大量是 css-* 运行时生成，且改版频繁；纯 CSS 规则无法穷举，
     残留的大片白底正是由此产生。这里不再猜类名，而是直接读「计算背景色」：
     凡是不透明的浅色背景一律压成透明，让页面暗底透出来。
     为控制开销：只处理块级元素（跳过 inline，绝大多数节点在这一步被排除），
     用游标分批扫描 + 处理标记，单次预算固定。
     ============================================================ */
  const FLAT_MARK = 'data-zide-flat';
  const FLAT_SKIP_TAG = /^(IMG|SVG|VIDEO|CANVAS|IFRAME|PICTURE|SOURCE|OBJECT|EMBED|INPUT|TEXTAREA|SELECT|OPTION|BR|HR)$/;
  // 跳过「前景色与背景色成对设计」的元素（徽标/头像等），压平它们会造成深底深字；
  // 注意不要把 highlight / katex / code 列入：它们自带浅底时代码块会留白。
  const FLAT_SKIP_CLS = /badge|label|tag|avatar|icon|logo|thumb|cover|emoji|btn|button/i;
  let flatCursor = 0;

  function flattenLightSurfaces() {
    if (!enabled) return;
    let all;
    try { all = document.querySelectorAll('body *'); } catch (e) { return; }
    const total = all.length;
    if (!total) return;
    if (flatCursor >= total) flatCursor = 0;

    const rootEl = document.getElementById('zide-root');
    const budget = flatCursor + 1500;
    let i = flatCursor;
    for (; i < total && i < budget; i++) {
      const el = all[i];
      if (!el || el.nodeType !== 1) continue;
      if (el.getAttribute(FLAT_MARK) === '1') continue;
      // 绝不碰皮肤自身的 UI
      if (rootEl && (el === rootEl || rootEl.contains(el))) continue;
      if (FLAT_SKIP_TAG.test(el.tagName)) continue;

      const cls = typeof el.className === 'string' ? el.className : '';
      if (cls && cls.indexOf('zide') === 0) continue;          // .zide-anno 等注入物
      if (FLAT_SKIP_CLS.test(cls)) continue;

      let cs;
      try { cs = getComputedStyle(el); } catch (e) { continue; }
      // 自身隐藏的元素不打标记：等它再次可见时仍需压平
      // （例如关闭专注模式后右侧栏重新出现，不能留白底）
      if (cs.display === 'none') continue;

      const bg = cs.backgroundColor;
      const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(bg || '');
      if (!m) continue;
      const alpha = m[4] === undefined ? 1 : parseFloat(m[4]);
      if (alpha < 0.5) continue;                               // 本来就是透明
      if ((+m[1] + +m[2] + +m[3]) / 3 < 140) continue;          // 本来就是深色，保留

      flattenBg(el);
      el.setAttribute(FLAT_MARK, '1');
    }
    flatCursor = i >= total ? 0 : i;
  }

  function clearFlatSurfaces() {
    let els;
    try { els = document.querySelectorAll('[' + FLAT_MARK + '="1"]'); } catch (e) { return; }
    for (let i = 0; i < els.length; i++) {
      restoreBg(els[i]);
      els[i].removeAttribute(FLAT_MARK);
    }
    flatCursor = 0;
  }

  /* ============================================================
     8c. 右侧栏：按结构定位，不依赖类名
     知乎大量容器使用 css-* 运行时类名，且改版频繁，写死类名会失效
     （实测：顶部导航被正确隐藏，但右栏未被隐藏，说明其类名不在预期集合内）。
     这里以回答正文为锚点，向上找到布局行，再把「位于主列右侧、比主列窄」
     的兄弟节点判定为右栏并整体隐藏。
     ============================================================ */
  const SIDE_MARK = 'data-zide-side';
  const SIDE_MAIN = 'data-zide-maincol';
  const SIDE_GRID = 'data-zide-gridcol';

  // 锚点必须落在「正文」上，不能落在页头标题上：
  // querySelector 的选择器列表按文档顺序返回首个匹配项，而 .QuestionHeader-title
  // 在文档中位于正文之前，会让爬升从页头开始、到 body 就断了。
  // 因此这里按优先级逐个查询。
  const ANCHOR_SELECTORS = [
    '.RichText', '.Post-RichText', '.List-item', '.AnswerItem', 'article',
    '.QuestionHeader-title'
  ];

  // 定位结果缓存。
  // 关键：几何判定在元素被隐藏后必然失败 —— display:none 的元素 rect 归零，
  // 于是「关掉皮肤 → 再打开」时 findSideColumns 找不到任何候选，定位结果丢失。
  // 已知类名的右栏还能被 CSS 兜住，未知 css-* 类名的右栏就会重新露出来
  // （实测：未知夹具开关往返后 sideStripeDisplay 从 none 变成 block，主列 1040 → 444）。
  // 所以标记必须跨 clearSideColumns 保留，并在这里优先复用。
  function memoColumns() {
    let main, sides;
    try {
      main = document.querySelector('[' + SIDE_MAIN + '="1"]');
      sides = Array.prototype.slice.call(document.querySelectorAll('[' + SIDE_MARK + '="1"]'));
    } catch (e) { return null; }
    if (!main || !main.isConnected || !sides.length) return null;
    for (let i = 0; i < sides.length; i++) if (!sides[i].isConnected) return null;   // 已被 SPA 换掉
    return { main: main, sides: sides };
  }

  function findSideColumns() {
    const memo = memoColumns();
    if (memo) return memo;
    let anchor = null;
    for (let i = 0; i < ANCHOR_SELECTORS.length; i++) {
      try { const e = document.querySelector(ANCHOR_SELECTORS[i]); if (e) { anchor = e; break; } } catch (err) {}
    }
    if (!anchor) return null;

    const vw = window.innerWidth;
    let node = anchor;
    for (let i = 0; i < 10 && node && node.parentElement; i++) {
      const parent = node.parentElement;
      if (parent === document.documentElement || parent === document.body) break;
      if (parent.id === 'zide-root') return null;
      const pr = parent.getBoundingClientRect();
      const nr = node.getBoundingClientRect();
      if (pr.width >= vw * 0.5 && nr.width >= 200) {
        const sides = [];
        const kids = Array.prototype.slice.call(parent.children);
        for (let k = 0; k < kids.length; k++) {
          const c = kids[k];
          if (c === node || c.contains(anchor) || node.contains(c)) continue;
          if (c.id === 'zide-root' || (c.classList && c.classList.contains('zide-part'))) continue;
          const r = c.getBoundingClientRect();
          if (r.width < 140 || r.height < 120) continue;   // 不是「栏」级元素
          if (r.width > vw * 0.5) continue;                // 过宽，可能是另一主列
          if (r.width >= nr.width) continue;               // 右栏应比主列窄
          if (r.left < nr.right - 40) continue;            // 必须落在主列右侧
          sides.push(c);
        }
        if (sides.length) return { main: node, sides: sides };
      }
      node = parent;
    }
    return null;
  }

  function applySideColumns() {
    if (!enabled || !clean) { clearSideColumns(); return; }
    const found = findSideColumns();
    if (!found) return;
    for (let i = 0; i < found.sides.length; i++) {
      found.sides[i].setAttribute(SIDE_MARK, '1');
      found.sides[i].style.setProperty('display', 'none', 'important');
    }
    // 右栏移除后正文会拉宽，收敛到接近编辑器的可读宽度
    // max-width 只是上限：对固定宽度主列无副作用，对 flex:1 主列则防止过宽
    // 开审阅栏时改为 none —— 这一层是内联 !important，样式表压不过它，
    // 所以「正文铺满、由 .RichText 单独收敛度量」必须在这里体现。
    // 融合模式下右栏是收起的，所以这里按「分栏真的在显示」来判断。
    // 列表页（首页/搜索）交给样式表的 --z-measure 收，内联写死会把卡片宽度钉住。
    const paneOn = review && !fuse;
    const kindNow = lastKind || 'other';
    const listPage = kindNow === 'feed' || kindNow === 'search';
    const m = found.main;
    if (m) {
      m.setAttribute(SIDE_MAIN, '1');
      // 列表页：**不要**写内联。内联 !important 会压掉样式表里的 --z-measure，
      // 卡片会一路铺到 2000px。这里把属性摘掉，宽度交给 CSS。
      if (listPage) m.style.removeProperty('max-width');
      else m.style.setProperty('max-width', paneOn ? 'none' : '1040px', 'important');
    }
    // Grid 布局坑：grid-template-columns 里那一列在元素 display:none 后仍被保留，
    // 右侧会残留一条空白。此时把父容器收敛成单列。
    const parent = m && m.parentElement;
    if (parent && parent.id !== 'zide-root') {
      let pd = '';
      try { pd = getComputedStyle(parent).display; } catch (e) {}
      if (pd === 'grid') {
        parent.setAttribute(SIDE_GRID, '1');
        parent.style.setProperty('grid-template-columns', '1fr', 'important');
      }
    }
  }

  function clearSideColumns() {
    let els;
    // ⚠ 这里**故意不摘掉 data-zide-* 标记**：标记是定位结果的记忆，
    // 几何判定在元素被隐藏后失效，摘掉就无法在重新启用时复用（见 memoColumns）。
    // 属性本身是惰性的，留着无副作用；节点被 SPA 换掉后 isConnected 会变 false，
    // memoColumns 自然回退到几何定位。
    try { els = document.querySelectorAll('[' + SIDE_MARK + '="1"]'); } catch (e) { els = []; }
    for (let i = 0; i < els.length; i++) {
      if (els[i].style) els[i].style.removeProperty('display');
    }
    try { els = document.querySelectorAll('[' + SIDE_GRID + '="1"]'); } catch (e) { els = []; }
    for (let i = 0; i < els.length; i++) {
      if (els[i].style) els[i].style.removeProperty('grid-template-columns');
    }
    try { els = document.querySelectorAll('[' + SIDE_MAIN + '="1"]'); } catch (e) { return; }
    for (let i = 0; i < els.length; i++) {
      if (els[i].style) els[i].style.removeProperty('max-width');
    }
  }

  /* ============================================================
     8d. 变更审阅分栏：右侧一条 diff
     这里的目标不是「随机代码」，而是「看起来正在改和这篇文章有关的东西」。
     随机标识符一眼假，反而更可疑，所以内容全部由当前文章派生：
       · 注释直接引用文章的小标题（中文代码库里这是常态）
       · 标识符从文章里出现的拉丁词派生（技术类回答从不缺这种词）
       · 整段 diff 由「标题 + 小标题 + 词表」的哈希驱动 —— 同一篇文章
         永远得到同一份 diff，翻页则整套跟着换
     ============================================================ */
  const VP = {
    verb: ['resolve', 'guard', 'sync', 'bind', 'mount', 'hydrate', 'derive', 'throttle',
           'collapse', 'normalize', 'restore', 'strip', 'clamp', 'probe', 'drain', 'flush',
           'merge', 'collect', 'seal', 'skip'],
    noun: ['mask', 'reader', 'shell', 'session', 'cursor', 'viewport', 'focus', 'gutter',
           'anchor', 'budget', 'queue', 'ledger', 'patch', 'cache', 'guard', 'branch'],
    adj:  ['lazy', 'strict', 'silent', 'stale', 'passive', 'virtual', 'hidden', 'dirty', 'warm', 'flat'],
    type: ['Options', 'State', 'Result', 'Handle', 'Context', 'Snapshot', 'Binding', 'Scope', 'Draft'],
    note: ['提取为独立 hook，避免依赖全局状态',
           '收敛到单一入口，去掉旁路分支',
           '加一层防御，防止重复绑定',
           '缓存结果，避免每帧重算',
           '改成纯函数，方便补单测',
           '去掉对 window 的直接引用',
           '补齐卸载路径，防止监听器泄漏',
           '把同步逻辑降级为可重入'],
    evt:  ['blur', 'keydown', 'visibilitychange', 'resize', 'scroll', 'focus'],
    tail: ['Mask', 'Guard', 'Reader', 'Shell', 'Sync', 'Patch', 'Cache', 'Probe'],
  };

  function hash32(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rngFrom(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const cap1 = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
  const low1 = (s) => s ? s.charAt(0).toLowerCase() + s.slice(1).toLowerCase() : '';
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // 读正文纯文本，跳过皮肤自己插入的节点（融合单元、注解）。
  // 直接用 textContent 会把自己生成的代码又读回主题词表里，种子不稳定的根源就在这。
  function readArticleText(host) {
    if (!host) return '';
    let out = '';
    (function walk(n) {
      for (let c = n.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) { out += c.nodeValue; continue; }
        if (c.nodeType !== 1) continue;
        const cls = c.className ? String(c.className) : '';
        if (cls.indexOf('zide-cell') >= 0 || cls.indexOf('zide-anno') >= 0) continue;
        walk(c);
      }
    })(host);
    return out;
  }

  // 取一篇文章的「主题」：标题、小标题、以及文中出现的拉丁词
  // hostArg：融合宿主。必须跟插入代码用的是**同一个** .RichText，
  // 否则可能读到别处（真站上第一个 .RichText 有可能是评论输入框 .RichText--editable）
  function articleTopic(hostArg) {
    const title = [];
    const heads = [];
    try {
      // 专栏文章页的标题是 .Post-Title，不是 .QuestionHeader
      const q = document.querySelector('.QuestionHeader-title, .QuestionHeader h1, .Post-Title, h1.Post-Title');
      if (q && q.textContent.trim()) title.push(q.textContent.trim());
      document.querySelectorAll('.RichText h1, .RichText h2, .RichText h3').forEach(function (h) {
        const x = (h.textContent || '').replace(/\s+/g, ' ').trim();
        if (x && heads.length < 12) heads.push(x);
      });
    } catch (e) {}
    if (!title.length) {
      title.push((document.title || '').replace(/\s*[-|]\s*知乎\s*$/, '').trim());
    }
    const host = hostArg || document.querySelector('.RichText, .RichContent-inner');
    // ⚠ 融合模式下代码单元就插在 .RichText 里，它的 textContent 会混进主题词表：
    // 种子 → 代码 → 种子，形成自我反馈，单元每轮重建一次（滚动发涩、还可能抖动）。
    // 所以取正文时先把我们自己插的节点剔掉。
    const full = readArticleText(host);
    const bodyTxt = full.slice(0, 1600);
    const STOP = /^(the|and|for|with|from|that|this|not|are|was|has|have|you|can|will|use|uses|used|using|what|how|why|when|which|into|out|all|any|but|its|our|their|they|one|two|new|get|set|html|http|https|www|com|div|span|class|style|true|false|null|undefined|zhihu)$/i;
    const toks = [];
    const re = /[A-Za-z][A-Za-z0-9]{1,18}/g;
    const pool = title.join(' ') + ' ' + heads.join(' ') + ' ' + bodyTxt;
    let m;
    while ((m = re.exec(pool)) && toks.length < 40) {
      const w = m[0];
      if (w.length < 3 || STOP.test(w)) continue;
      if (toks.indexOf(w) < 0) toks.push(w);
    }
    return { title: title[0] || '', heads: heads, toks: toks, chars: full.length };
  }

  // 一行代码 = 一串带语义类的片段，用同一套低饱和令牌着色
  const tk = {
    k: (s) => '<i class="k">' + esc(s) + '</i>',
    t: (s) => '<i class="t">' + esc(s) + '</i>',
    f: (s) => '<i class="f">' + esc(s) + '</i>',
    s: (s) => '<i class="s">' + esc(s) + '</i>',
    c: (s) => '<i class="c">' + esc(s) + '</i>',
    n: (s) => '<i class="n">' + esc(s) + '</i>',
    v: (s) => '<i class="v">' + esc(s) + '</i>',
  };
  const tx = (s) => esc(s);

  // 生成器要用它拼标识符，所以必须先洗成合法 JS 名字。
  // 反例（真踩过）：信息流上没有拉丁词 → 回退到文件名 "mock-zhihu-feed.html"
  // → 生成的代码里出现 `mock-zhihu-feed.html ??= 15`，一眼就是假的。
  function safeIdent(s) {
    // 先按「/」取末段，再按「.」切掉**所有**扩展名段。
    // 只去最后一个后缀是不够的：file:// 下 currentFile() 会给出
    // "mock-zhihu-feed.html.ts"，那样子串是 html 而不是 feed
    let x = String(s || '').split('/').pop() || '';
    x = x.split('.')[0] || '';
    x = x.replace(/[^A-Za-z0-9_$]+/g, ' ').trim();
    const parts = x.split(/\s+/).filter(Boolean);
    return parts.length ? parts[parts.length - 1] : '';
  }

  // 卡片标题要当注释用，必须显式收尾。
  // 直接 slice(0,20) 会把 "vibe coding" 切成 "vi"，读起来像乱码；
  // 超长时按词边界断，并补一个省略号 —— 让人一眼看出「这是被截断的引用」而不是打错字
  function clipNote(s, max) {
    const t = String(s || '').replace(/\s+/g, ' ').trim();
    if (t.length <= max) return t;
    let cut = t.slice(0, max);
    const sp = cut.lastIndexOf(' ');
    if (sp > max - 8) cut = cut.slice(0, sp);   // 只在贴近尾部时按空格断，别截得太狠
    return cut.replace(/[，。、；：,.;:\s]+$/, '') + '…';
  }

  // 代码生成器：diff 与融合单元共用同一套词表/模板，两处加起来才不会互相打架
  function makeCodeGen(topic, rnd) {
    const pick = (a) => a[Math.floor(rnd() * a.length) % a.length];
    const rawBase = topic.toks.length ? topic.toks[0] : currentFile().name;
    const base = safeIdent(rawBase) || 'reader';
    const stem = low1(base) || 'reader';
    const file = 'src/hooks/'
      + pick(['use', 'use', '']) + cap1(base) + pick(VP.tail) + '.ts';

    // 词表：一个主符号 + 若干派生符号，全文复用，读起来才像在改同一个东西
    const ids = [];
    const push = (x) => { if (x && ids.indexOf(x) < 0) ids.push(x); };
    push(stem + pick(VP.tail));
    push('_' + stem);
    for (let i = 0; i < 10; i++) push(low1(pick(VP.verb)) + cap1(pick(VP.noun)));
    for (let i = 0; i < 4; i++) push(low1(pick(VP.adj)) + cap1(pick(VP.noun)));
    // 符号池要够宽，否则同一个函数名在全篇反复出现，看久了就露馅
    const A = () => ids[Math.floor(rnd() * ids.length) % ids.length];
    const T = () => pick(VP.type);
    const N = (lo, hi) => String(lo + Math.floor(rnd() * (hi - lo)));
    const line = (parts) => parts.join('');

    const body = () => line([tk.k('const'), ' { ' + A() + ' } ', tx('= '), tk.f(A()), tx('('), tk.n(N(1, 40)), tx(')')]);
    const guard = () => line(['  ', tk.k('if'), tx(' (!'), tk.v(A()), tx('.'), tk.v(pick(VP.noun)), tx(') '), tk.k('return'), tx(' '), tk.k('null')]);
    const effect = () => line(['  ', tk.f('useEffect'), tx('('), tk.k('()'), tx(' => { '), tk.f(A()), tx('() }'), tx(', ['), tk.v(A()), tx('])')]);
    const assign = () => line(['  ', tk.v(A()), tx('.'), tk.v(pick(VP.noun)), tx(' = '), tk.k('true')]);
    const bind = () => line(['  ', tk.f('bind'), tx('('), tk.k('window'), tx(', '), tk.s("'" + pick(VP.evt) + "'"), tx(', '), tk.f(A()), tx(')')]);
    const ret = () => line(['  ', tk.k('return'), tx(' '), tk.v(A()), tx('.'), tk.f('map'), tx('((it) => it.'), tk.v(pick(VP.noun)), tx(')')]);
    const typeL = () => line(['  ', tk.k('type'), ' ' + tk.t(T()), tx(' = '), tk.s("'" + pick(VP.adj) + "'"), tx(' | '), tk.s("'" + pick(VP.adj) + "'")]);
    const opt = () => line(['  ', tk.v(A()), tx('?.'), tk.v(pick(VP.noun)), tx(' ?? '), tk.s("'" + pick(VP.adj) + "'")]);
    const tries = () => line(['  ', tk.k('try'), tx(' { '), tk.f(A()), tx('() } '), tk.k('catch'), tx(' (err) { '), tk.f('report'), tx('(err) }')]);
    const grow = () => line(['  ', tk.k('if'), tx(' ('), tk.v(A()), tx('.length > '), tk.n(N(8, 68)), tx(') { '), tk.f(A()), tx('() }')]);
    const state = () => line(['  ', tk.k('const'), tx(' ['), tk.v(low1(pick(VP.noun))), tx(', set'), tk.f(cap1(pick(VP.noun))), tx('] = '), tk.f('useState'), tx('<'), tk.t(T()), tx('>('), tk.n(N(0, 6)), tx(')')]);
    const ro = () => line(['  ', tk.k('export'), ' ' + tk.k('type'), ' ' + tk.t(T()), tx(' = '), tk.f('Readonly'), tx('<'), tk.t(T()), tx('>')]);
    const ref = () => line(['  ', tk.k('const'), ' ' + tk.v(A()), tx(' = '), tk.f('useRef'), tx('<'), tk.t(T()), tx(' | '), tk.k('null'), tx('>(null)')]);
    const each = () => line(['  ', tk.v(A()), tx('.'), tk.f('forEach'), tx('((k) => { '), tk.f(A()), tx('(k) })')]);
    const sw = () => line(['  ', tk.k('switch'), tx(' ('), tk.v(A()), tx(') { '), tk.k('case'), tx(' '), tk.s("'" + pick(VP.adj) + "'"), tx(': '), tk.k('return'), tx(' '), tk.f(A()), tx('() }')]);
    const andOr = () => line(['  ', tk.k('if'), tx(' ('), tk.v(A()), tx(' && !'), tk.v(A()), tx(') { '), tk.f(A()), tx('() }')]);
    const nullish = () => line(['  ', tk.v(A()), tx(' ??= '), tk.n(N(1, 24))]);
    const settle = () => line(['  ', tk.k('await'), ' ', tk.f(A()), tx('.settle({ '), tk.v(pick(VP.noun)), tx(': '), tk.n(N(1, 12)), tx(' })')]);
    const cast = () => line(['  ', tk.k('const'), ' ' + tk.v(A()), tx(' = '), tk.v(A()), tx(' '), tk.k('as'), ' ', tk.t(T())]);
    const empty = () => line(['  ', tk.c('// ' + pick(VP.note))]);

    const TPL = [body, guard, effect, assign, bind, ret, typeL, opt, tries, grow,
                 state, ro, ref, each, sw, andOr, nullish, settle, cast, empty];

    return { pick: pick, file: file, TPL: TPL, A: A, T: T, N: N, stem: stem, ids: ids };
  }

  function buildDiff(topic, rnd) {
    const g = makeCodeGen(topic, rnd);
    const pick = g.pick, file = g.file, TPL = g.TPL, A = g.A, N = g.N;

    const lines = [];
    let ln = 1 + Math.floor(rnd() * 14);
    let adds = 0, dels = 0;
    const hunkAt = [];

    function emit(k, html) {
      lines.push({ k: k, n: k === 'hunk' ? '' : String(ln), html: html });
      if (k !== 'hunk') ln++;
    }

    const hunks = 9 + Math.floor(rnd() * 4);
    for (let h = 0; h < hunks; h++) {
      const sym = low1(pick(VP.verb)) + cap1(pick(VP.noun));
      // hunk 之间的上下文行：既是真实 diff 该有的样子，也让内容足够长到能滚动联动
      const ctxBefore = 3 + Math.floor(rnd() * 4);
      for (let i = 0; i < ctxBefore; i++) emit('ctx', pick(TPL)());
      // 先排 hunk 体，再回头算 @@ 的行数与偏移
      const bodyLines = [];
      const nDel = 1 + Math.floor(rnd() * 2);
      const nAdd = 1 + Math.floor(rnd() * 2) + (rnd() < 0.45 ? 1 : 0);
      // 有些 hunk 只加不删（纯新增），有些有增有删（修改），比例自然
      const onlyAdd = rnd() < 0.22;
      if (rnd() < 0.42) {
        const note = topic.heads.length ? topic.heads[Math.floor(rnd() * topic.heads.length)] : '';
        bodyLines.push({ k: 'add', html: '  ' + tk.c('// ' + (note ? note + ' —— ' : '') + pick(VP.note)) });
      }
      for (let i = 0; i < (onlyAdd ? 0 : nDel); i++) bodyLines.push({ k: 'del', html: pick(TPL)() });
      for (let i = 0; i < nAdd; i++) bodyLines.push({ k: 'add', html: pick(TPL)() });
      const oldLen = ctxBefore + bodyLines.filter((x) => x.k !== 'add').length + 1;
      const newLen = ctxBefore + bodyLines.filter((x) => x.k !== 'del').length + 1;
      const oldStart = ln;
      emit('hunk', '@@ -' + oldStart + ',' + oldLen + ' +' + oldStart + ',' + newLen
        + ' @@ ' + tk.k('export function') + ' ' + tk.f(sym) + tx('()'));
      const at = lines.length - 1;
      bodyLines.forEach(function (b) { emit(b.k, b.html); if (b.k === 'add') adds++; else dels++; });
      emit('ctx', pick(TPL)());
      hunkAt.push({ i: at, t: onlyAdd ? 'a' : (nDel > nAdd ? 'd' : (nDel === nAdd ? 'm' : 'a')) });
    }

    // 概览尺的刻度位置必须用「最终总行数」换算，否则最后一根会越过 100%
    const total = Math.max(1, lines.length);
    const ruler = hunkAt.map(function (t) { return { i: t.i / total, t: t.t }; });

    const html = lines.map(function (l) {
      const mk = l.k === 'add' ? '+' : (l.k === 'del' ? '-' : (l.k === 'hunk' ? '' : ' '));
      return '<div class="zide-rl ' + l.k + '" data-k="' + l.k + '">'
        + '<span class="zide-rl-no">' + esc(l.n) + '</span>'
        + '<span class="zide-rl-mk">' + esc(mk) + '</span>'
        + '<span class="zide-rl-tx">' + l.html + '</span></div>';
    }).join('');

    return { file: file, html: html, adds: adds, dels: dels, ruler: ruler, count: lines.length };
  }

  let reviewSig = '';
  function renderReview(force) {
    const host = $('#zideRvBody');
    if (!host || !enabled || !review) return;
    const topic = articleTopic();
    const sig = hash32(topic.title + '|' + topic.heads.join('|') + '|' + topic.toks.join(',')) + ':' + currentFile().name;
    if (!force && sig === reviewSig) return;
    reviewSig = sig;

    const d = buildDiff(topic, rngFrom(hash32(sig)));
    const fn = $('#zideRvFile');
    if (fn) fn.textContent = d.file;
    const st = $('#zideRvStat');
    if (st) st.innerHTML = '<span class="zide-add">+' + d.adds + '</span> <span class="zide-del">\u2212' + d.dels + '</span>';
    host.innerHTML = d.html;
    const ruler = $('#zideRvRuler');
    if (ruler) {
      ruler.innerHTML = d.ruler.map(function (t) {
        return '<div class="zide-rv-tick ' + t.t + '" style="top:' + (t.i * 100).toFixed(2) + '%"></div>';
      }).join('');
    }
    syncReview(true);
  }

  // 与正文滚动联动：diff 跟着走，并高亮「当前行」。
  // 用比例映射而不是像素映射 —— 两边可滚高度本来就不同，像素映射会中途跑飞。
  let reviewCur = -1;
  function syncReview(force) {
    const body = $('#zideRvBody');
    if (!body || !enabled || !review || fuse) return;
    const rows = body.children;
    if (!rows.length || !body.clientHeight) return;

    const doc = document.documentElement;
    const max = Math.max(1, doc.scrollHeight - window.innerHeight);
    const ratio = Math.min(1, Math.max(0, window.scrollY / max));
    const rmax = Math.max(0, body.scrollHeight - body.clientHeight);
    body.scrollTop = ratio * rmax;

    // 行高实测，不写死（字体度量一变就错）。取第一行「非 hunk」的行 ——
    // hunk 头是加粗的，用它当基准会把整条映射压歪
    let rowH = 0;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].getAttribute('data-k') === 'hunk') continue;
      rowH = rows[i].offsetHeight;
      break;
    }
    if (!rowH) rowH = rows[0].offsetHeight || 20;
    let n = Math.floor((body.scrollTop + body.clientHeight * 0.5) / rowH);
    n = Math.min(rows.length - 1, Math.max(0, n));
    if (!force && n === reviewCur) return;
    reviewCur = n;

    for (let i = 0; i < rows.length; i++) {
      const on = i === n && rows[i].getAttribute('data-k') !== 'hunk';
      const want = 'zide-rl ' + rows[i].getAttribute('data-k') + (on ? ' cur' : '');
      if (rows[i].className !== want) rows[i].className = want;
    }
  }

  /* ============================================================
     8e 节：融合模式 —— 代码单元直接插进正文流
     ------------------------------------------------------------
     动机（用户第 11 轮反馈）：分栏时"代码占比太少"。
     侧栏再怎么加宽，本质仍是「一个网页 + 一条边栏」；融合是让代码成为文章的
     一个层级：小标题下读完解释，紧接着就是这段解释对应的实现。
     第 12 轮补：首页信息流没有小标题、没有长文，改为「卡片之间插单元」，
     否则信息流上既没有代码、皮肤又只接管了半张页面（真机截图就是这么崩的）。
     做法：不碰原 DOM 结构，只 insertBefore 插入独立的 .zide-cell 节点，
     因此随时可以整批摘掉，皮肤关掉时页面能完全复原。
     ============================================================ */
  const FUSE_MARK = 'data-zide-fuse';
  let fuseSig = '';

  // 页面类型：皮肤对它们的接管方式完全不同
  function pageKind() {
    try {
      // ⚠ 判定顺序是**先认页面专属容器，最后才看信息流标记**。
      // 反例（真站复现过）：专栏文章页 / 问题页在登录态下也会挂 .TopstoryItem
      // （页尾推荐卡）。若先判 feed，就会被误判成首页 —— 宿主去查
      // .Topstory-mainColumn 查不到，renderFusion 静默 return，整篇一片代码都没有。
      // 而文章页/问题页绝不会出现 .Post-RichTextContainer 或 .Question-mainColumn，
      // 所以把它们放前面既准确又不会连锁误判。
      if (document.querySelector('.Post-RichTextContainer, .Post-RichText, .Post-Title, .Post-Row-Content-left')) return 'article';
      if (document.querySelector('.Question-mainColumn, .QuestionHeader')) return 'question';
      if (document.querySelector('.SearchMain, .Search-container')) return 'search';
      if (document.querySelector('.Topstory-container, .Topstory-mainColumn, .TopstoryItem')) return 'feed';
      if (document.querySelector('.Profile-main, .ProfileHeader')) return 'people';
    } catch (e) {}
    return 'other';
  }
  const KIND_CLASS = { feed: 'zide-feed', search: 'zide-search', article: 'zide-article', question: 'zide-q', people: 'zide-people' };
  let lastKind = '';
  function applyPageKind() {
    const k = pageKind();
    if (k === lastKind) return k;
    lastKind = k;
    const de = document.documentElement;
    Object.keys(KIND_CLASS).forEach(function (x) { de.classList.remove(KIND_CLASS[x]); });
    if (enabled && KIND_CLASS[k]) de.classList.add(KIND_CLASS[k]);
    return k;
  }

  // 当前正在读的那篇文章：第一个「可见 + 有实质文字 + 不属于信息流卡片」的 .RichText
  function fuseHost() {
    // 按「越像正文越靠前」的顺序找宿主。
    // 真站登录态下页面里会混进各种推荐卡的 .RichText（甚至评论输入框
    // .RichText--editable），纯按 DOM 顺序抓第一个 .RichText 有可能抓到它们，
    // 结果是代码被插进了看不见的地方 —— 看上去就是「没有代码」。
    const ORDER = [
      '.Post-RichTextContainer .RichText',
      '.Post-RichText',
      '.Question-mainColumn .RichText',
      '.RichContent-inner',
      '.RichText'
    ];
    for (let k = 0; k < ORDER.length; k++) {
      const list = document.querySelectorAll(ORDER[k]);
      for (let i = 0; i < list.length; i++) {
        const el = list[i];
        if (!el.getClientRects().length) continue;
        // 信息流卡片里的 .RichText 只是摘要，不能在卡片内部塞代码
        if (el.closest && el.closest('.TopstoryItem, .Pc-feedAd, .Card.TopstoryItem')) continue;
        // 评论框 / 编辑器不是正文
        if (el.closest && el.closest('.Dropzone, .RichText--editable, .Editable, form')) continue;
        if ((el.textContent || '').trim().length < 120) continue;
        return el;
      }
    }
    return null;
  }

  // 列表页的「行」。**不能写死 .TopstoryItem**：首页是它，搜索结果页是
  // .List-item / .SearchResult-Card，专栏列表又是 .Post-Row-Content-left 那一挂，
  // 而且这些 css-* 类名每隔几版就换。所以先试几个已知类名，再按**结构**兜底：
  // 同一父节点下、带标题元素、有实质文字的兄弟块，就算「行」。
  // （踩过：搜索页 .TopstoryItem 数为 0，feed 分支一张卡都抓不到 → 全页零代码）
  function listRows(host) {
    if (!host) return [];
    const KNOWN = ['.TopstoryItem', '.SearchResult-Card', '.List-item', '.Card'];
    for (let i = 0; i < KNOWN.length; i++) {
      const set = host.querySelectorAll(KNOWN[i]);
      if (set.length >= 2) return Array.prototype.slice.call(set);
    }
    const looksRow = function (el) {
      if (!el || el.nodeType !== 1) return false;
      if (!el.getClientRects().length) return false;
      if (!el.querySelector('h2, .ContentItem-title, [class*="title"]')) return false;
      return (el.textContent || '').trim().length > 20;
    };
    const walk = function (node, depth) {
      if (!node || depth > 4) return null;
      const kids = Array.prototype.slice.call(node.children);
      const rows = kids.filter(looksRow);
      if (rows.length >= 2) return rows;
      for (let i = 0; i < kids.length; i++) {
        const r = walk(kids[i], depth + 1);
        if (r) return r;
      }
      return null;
    };
    return walk(host, 0) || [];
  }

  // 信息流的「主题」= 各条卡片的标题
  function feedTopic() {
    const base = articleTopic();
    const heads = [];
    const ts = document.querySelectorAll('.ContentItem-title, .TopstoryItem h2');
    for (let i = 0; i < ts.length && heads.length < 8; i++) {
      const x = (ts[i].textContent || '').replace(/\s+/g, ' ').trim().slice(0, 22);
      if (x && heads.indexOf(x) < 0) heads.push(x);
    }
    return {
      title: heads[0] || base.title,
      heads: heads.length ? heads : base.heads,
      toks: base.toks,
      chars: base.chars,
    };
  }

  function clearFusion() {
    const old = document.querySelectorAll('.zide-cell[' + FUSE_MARK + ']');
    for (let i = old.length - 1; i >= 0; i--) {
      if (old[i].parentNode) old[i].parentNode.removeChild(old[i]);
    }
  }

  // 一个代码单元：函数头 + N 行实现 + 收尾括号，行号从 start 起连续编
  function buildCell(topic, seed, opt) {
    const rnd = rngFrom(seed);
    const g = makeCodeGen(topic, rnd);
    const sym = low1(g.pick(VP.verb)) + cap1(g.pick(VP.noun));
    const out = [];
    let ln = opt.start;
    out.push({ n: String(ln++), html: tk.k('export function') + ' ' + tk.f(sym) + tx('() {') });
    // 首行固定写一句「对应本文第几节」的注释：让「代码是从这段文字长出来的」
    // 是看得见的，而不是靠读者猜。固定出现，不要随机 —— 有的有有的没有会显得乱
    if (opt.note) out.push({ n: String(ln++), html: '  ' + tk.c('// 对应「' + opt.note + '」') });
    for (let i = 0; i < opt.rows; i++) {
      out.push({ n: String(ln++), html: g.TPL[Math.floor(rnd() * g.TPL.length) % g.TPL.length]() });
    }
    out.push({ n: String(ln++), html: tx('}') });
    return { lines: out, file: g.file, start: opt.start, end: ln - 1 };
  }

  // 造一个单元节点（正文 / 信息流共用）
  // 信息流的单元是插在「卡片之间」的兄弟节点，宽度跟着主列走；
  // 但卡片正文自己有内边距（20px），贴主列边缘会比正文整体向左凸出，
  // 代码块和正文明显不在同一列（窄屏截图上一眼能看出来）。
  // 基准取 .RichText 的**外框**而不是 <p>：<p> 左侧还压着 56px 的行号 gutter，
  // 拿它当基准会把代码块整整右移一格，反而错得更明显。
  function alignCellToCardText(node, card, host) {
    const ref = card.querySelector('.RichText') || card.querySelector('.RichText > p');
    if (!ref) return;
    // 基准取单元的**父节点**，不是 host —— 搜索结果页里行可能挂在 host 的某个内层容器上，
    // 拿 host 算出来的外扩量会整体偏掉
    const base = node.parentElement || host;
    const hr = base.getBoundingClientRect();
    const rr = ref.getBoundingClientRect();
    if (!hr.width || !rr.width) return;
    const padL = Math.round(rr.left - hr.left);
    const padR = Math.round(hr.right - rr.right);
    // 负数说明正文比父容器还宽（某些卡片带负外边距），那种情况别硬掰
    if (padL > 0) node.style.marginLeft = padL + 'px';
    if (padR > 0) node.style.marginRight = padR + 'px';
  }

  function makeCellNode(topic, seed, start, rows, note) {
    const cell = buildCell(topic, seed, { start: start, rows: rows, note: note });
    const div = document.createElement('div');
    div.className = 'zide-cell';
    div.setAttribute(FUSE_MARK, '1');
    div.innerHTML = '<div class="zide-cell-head">'
      + '<span class="zide-cell-file">' + esc(cell.file) + '</span>'
      + '<span class="zide-cell-rg">L' + cell.start + '\u2013' + cell.end + '</span>'
      + '<span class="zide-cell-tag">ts</span>'
      + '</div>'
      + '<div class="zide-cell-body">'
      + cell.lines.map(function (l) {
          return '<div class="zide-rl"><span class="zide-rl-no">' + esc(l.n) + '</span>'
            + '<span class="zide-rl-tx">' + l.html + '</span></div>';
        }).join('')
      + '</div>';
    return { node: div, end: cell.end };
  }

  function renderFusion(force) {
    if (!enabled || !fuse) { clearFusion(); fuseSig = ''; return; }
    const kind = pageKind();
    // 列表页标记在、但主列不在（混合页面 / 版式改版）：退回长文模式按正文插。
    // 不退回的话 isFeed 分支找不到卡片，会「静默地一片都不插」——最难查的那种 bug。
    let isFeed = kind === 'feed' || kind === 'search';
    let host = isFeed ? document.querySelector('.Topstory-mainColumn, .SearchMain') : null;
    if (!host) { isFeed = false; }
    if (!host) host = fuseHost();
    if (!host) return;

    const topic = isFeed ? feedTopic() : articleTopic(host);
    const fileName = currentFile().name;
    const sig = hash32('fuse|' + kind + '|' + topic.title + '|' + topic.heads.join('|') + '|' + topic.toks.join(',') + '|' + fileName + '|' + topic.chars);
    // 签名没变且单元还在 → 立刻返回。否则 body 上的 MutationObserver 会被我们
    // 自己插入的节点再触发一次，形成 1.2s 一轮的重建循环（滚动会明显发涩）
    if (!force && sig === fuseSig && document.querySelector('.zide-cell[' + FUSE_MARK + ']')) return;
    fuseSig = sig;
    clearFusion();

    const topicSeed = hash32(topic.title + '|' + fileName);
    let lnCursor = 1 + (topicSeed % 24);
    let cellNo = 0;
    const heads = topic.heads;

    // ---- 信息流：卡片之间插单元 ----
    // 信息流没有小标题、卡片正文也只是摘要，所以不能按「段落 + 实现」来挂。
    // 改成每两张卡之后挂一个单元，注释引用上一张卡的标题，读起来像
    // 「一边刷信息流，一边在改它对应的那个文件」。
    if (isFeed) {
      const cards = listRows(host);
      let real = 0;   // 只数「真卡片」：广告卡不该参与节奏，
                      // 否则一条广告就能把下面所有单元的落点整体错开
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        if (!card.getClientRects().length) continue;
        if (card.className && String(card.className).indexOf('Pc-feedAd') >= 0) continue;
        if (card.querySelector && card.querySelector('.Pc-feedAd')) continue;
        real++;
        // 第 1、3、5… 张卡之后挂单元。第一张就挂 —— 否则首屏（折叠线以上）
        // 全是被折叠的卡片，一眼看过去还是没有代码，"摸鱼"当场破功
        if (real % 2 === 0) continue;
        if (cellNo >= 8) break;

        cellNo++;
        const t = card.querySelector('.ContentItem-title, h2');
        const cardTitle = t ? clipNote(t.textContent, 18) : '';
        const seed = hash32('f' + cellNo + '|' + topicSeed + '|' + cardTitle);
        const rnd0 = rngFrom(seed);
        const rows = 11 + Math.floor(rnd0() * 5);
        const made = makeCellNode(topic, seed, lnCursor, rows, cardTitle || (heads[0] || ''));
        lnCursor = made.end + 3 + Math.floor(rnd0() * 7);
        alignCellToCardText(made.node, card, host);
        card.parentNode.insertBefore(made.node, card.nextSibling);
      }
      return;
    }

    // ---- 长文页：正文块之间插单元 ----
    // 逐块扫描：每 2 个正文块后面挂一个单元。
    // 跳过 pre/figure/hr —— 那些块本身已经是「代码/图」，再贴代码会重复。
    // ⚠ 必须先快照成数组：host.children 是活集合，插入节点会让后面每个下标都位移
    const kids = Array.prototype.slice.call(host.children);
    // 什么算「可插块的正文块」：标题另算；pre/figure/hr/img 跳过；
    // 真站上还大量存在 <p class="ztext-empty-paragraph">（空段落，常用来撑图间距），
    // 它们不该占用节奏，否则节奏会被空段落吃掉，代码落点看着像随机的
    const isBodyBlock = function (el) {
      if (!el || el.nodeType !== 1) return false;
      const tag = el.tagName;
      if (tag === 'H2' || tag === 'H3' || tag === 'H4') return false;
      if (tag === 'PRE' || tag === 'FIGURE' || tag === 'HR' || tag === 'IMG') return false;
      if (el.className && String(el.className).indexOf('zide-cell') >= 0) return false;
      if (!(el.textContent || '').trim() && !el.querySelector('img, pre')) return false;
      return true;
    };
    // 节奏要跟着文章长度走。原来的固定「每 2 块一片」在短文章上会一片都不出：
    // 真站复现过一篇 193 字、正文只有 1 个 <p> 的专栏文章，cells = 0。
    const eligible = kids.filter(isBodyBlock).length;
    if (!eligible) return;
    const step = eligible >= 4 ? 2 : 1;   // 短文章每块都给，长文章回到每 2 块
    const cap = eligible >= 4 ? 14 : 1;   // 短文章只给一片，别让代码淹了正文

    let since = 0, secName = '';
    for (let i = 0; i < kids.length; i++) {
      const el = kids[i];
      if (!el || el.nodeType !== 1) continue;
      const tag = el.tagName;
      if (tag === 'H2' || tag === 'H3' || tag === 'H4') {
        // 记住当前小节标题：单元里的注释要用「它所在的那一节」，
        // 而不是随便挑一个标题 —— 否则代码和旁边那段文字对不上，一眼假
        secName = (el.textContent || '').trim().slice(0, 24);
        if (step === 2) since = 0;   // 长文章按小节重新起算；短文章不必，否则永远凑不满
        continue;
      }
      if (!isBodyBlock(el)) continue;
      since++;
      if (since < step) continue;
      since = 0;
      if (cellNo >= cap) break;

      cellNo++;
      const seed = hash32('c' + cellNo + '|' + topicSeed + '|' + (el.textContent || '').slice(0, 40));
      const rnd0 = rngFrom(seed);
      // 12–17 行。太短会像装饰，太长会把正文挤散
      const rows = 12 + Math.floor(rnd0() * 6);
      const note = secName || (heads.length ? heads[0] : '');
      const made = makeCellNode(topic, seed, lnCursor, rows, note);
      lnCursor = made.end + 3 + Math.floor(rnd0() * 7);   // 片段之间留出「跳过的行」
      el.parentNode.insertBefore(made.node, el.nextSibling);
    }
  }

  /* ============================================================
     9. 刷新（含 SPA 路由适配）
     ============================================================ */
  let lastUrl = '';
  let mapSignature = '';
  function refresh(force) {
    if (!enabled) return;
    if (!document.body) return;
    buildRoot();
    const url = location.pathname + location.search;
    if (force || url !== lastUrl) {
      lastUrl = url;
      mapSignature = '';
      fuseSig = '';
      try { renderTree(); renderTabs(); renderStatus(); } catch (e) {}
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
    try { decorate(); } catch (e) {}
    try { fixCommentSurfaces(); } catch (e) {}
    try { flattenLightSurfaces(); } catch (e) {}
    // 页面类型决定后面所有布局参数（度量、主列宽度、融合的挂载点），必须先跑
    try { applyPageKind(); } catch (e) {}
    try { applySideColumns(); } catch (e) {}
    try { renderMap(); } catch (e) {}
    try { renderReview(false); } catch (e) {}
    try { renderFusion(false); } catch (e) {}
    updatePos();
  }

  function scheduleRefresh(delay) {
    clearTimeout(scheduleRefresh._t);
    scheduleRefresh._t = setTimeout(function () { try { refresh(false); } catch (e) {} }, delay || 320);
  }

  function hookRouting() {
    ['pushState', 'replaceState'].forEach(function (fn) {
      const orig = history[fn];
      if (!orig) return;
      history[fn] = function () {
        const r = orig.apply(this, arguments);
        scheduleRefresh(380);
        return r;
      };
    });
    window.addEventListener('popstate', function () { scheduleRefresh(380); });

    // 知乎为 SPA，路由变化不一定改 URL，但一定会改 <title>
    const watchTitle = function () {
      const t = document.querySelector('title');
      if (!t) { scheduleRefresh(600); return; }
      new MutationObserver(function () { scheduleRefresh(400); }).observe(t, { childList: true, characterData: true, subtree: true });
    };
    if (document.querySelector('title')) watchTitle();
    else document.addEventListener('DOMContentLoaded', watchTitle);

    // 内容懒加载 / 无限滚动：知乎 DOM 持续变动，去抖放宽，重绘由签名守卫兜住
    if (document.body) {
      new MutationObserver(function () { scheduleRefresh(1200); }).observe(document.body, { childList: true, subtree: true });
    }
  }

  // 兜底：Chrome 扩展的内容脚本运行在隔离世界，劫持不到页面自身的 history.pushState，
  // 因此用低频轮询兜住路由变化。成本可忽略（仅做字符串比较）。
  function watchUrl() {
    let lastHref = location.href;
    setInterval(function () {
      if (location.href !== lastHref) { lastHref = location.href; scheduleRefresh(260); }
    }, 700);
  }

  /* ============================================================
     10. 开关与快捷键
     ============================================================ */
  function setEnabled(next) {
    enabled = !!next;
    try { localStorage.setItem(KEY, enabled ? '1' : '0'); } catch (e) {}
    document.documentElement.classList.toggle('zide', enabled);
    applyClean();
    applyReview();
    applyFuse();
    if (!enabled) { clearSurfaceFixes(); clearFlatSurfaces(); clearSideColumns(); clearAnno(); reviewSig = ''; }
    // 融合单元是往正文里插的节点，关皮肤必须整批摘掉，页面才真的恢复原样
    if (!enabled) clearFusion();
    fuseSig = '';
    const root = $('#zide-root');
    if (root) root.style.display = enabled ? '' : 'none';
    if (enabled) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      refresh(true);
    }
  }

  function bossKey() {
    // 老板键：先摘掉 IDE 装饰，必要时直接把窗口关掉
    const opener = (function () { try { return window.opener && !window.opener.closed; } catch (e) { return false; } })();
    if (opener) { try { window.close(); } catch (e) {} }
    setEnabled(false);
  }

  function bindKeys() {
    window.addEventListener('keydown', function (e) {
      // 焦点在输入框内时不劫持按键，避免影响知乎自身的评论 / 回答编辑
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === '`') { e.preventDefault(); setEnabled(!enabled); return; }
      if (ctrl && e.shiftKey && (e.key === 'H' || e.key === 'h')) { e.preventDefault(); bossKey(); return; }
      if (ctrl && e.shiftKey && (e.key === 'Q' || e.key === 'q')) { e.preventDefault(); bossKey(); return; }
      if (ctrl && e.shiftKey && (e.key === 'B' || e.key === 'b')) { e.preventDefault(); setClean(!clean); return; }
      if (ctrl && !e.shiftKey && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); toggleFind(true); return; }
      if (ctrl && e.shiftKey && (e.key === 'F' || e.key === 'f')) { e.preventDefault(); toggleFind(true); return; }
      if (ctrl && e.shiftKey && (e.key === 'G' || e.key === 'g')) { e.preventDefault(); if (fuse) setFuse(false); else setReview(!review); return; }
      if (ctrl && e.shiftKey && (e.key === 'M' || e.key === 'm')) { e.preventDefault(); setFuse(!fuse); return; }
      if (e.key === 'Escape') { toggleFind(false); return; }
    }, true);
    window.addEventListener('scroll', function () { updatePos(); syncMap(); syncReview(); }, { passive: true });
    window.addEventListener('resize', function () { scheduleRefresh(120); }, { passive: true });
  }

  /* ============================================================
     11. 启动
     ============================================================ */
  function start() {
    if (!enabled) {
      // 仍需允许用快捷键重新打开
      bindKeys();
      return;
    }
    buildRoot();
    applyClean();
    applyReview();
    applyFuse();
    refresh(true);
    hookRouting();
    watchUrl();
    bindKeys();
    // 首屏后补两次刷新，兜住知乎的异步渲染
    setTimeout(function () { refresh(false); }, 900);
    setTimeout(function () { refresh(false); }, 2200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { try { start(); } catch (e) { console.warn('[zhihu-ide]', e); } });
  } else {
    try { start(); } catch (e) { console.warn('[zhihu-ide]', e); }
  }
})();
