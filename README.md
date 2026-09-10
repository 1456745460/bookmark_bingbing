# 启页 · 书签导航

静态书签首页，适合部署到 GitHub Pages，设为浏览器主页。

当前仓库：<https://github.com/1456745460/bookmark_bingbing>  
Pages 地址（开启后）：<https://1456745460.github.io/bookmark_bingbing/>

## 本地预览

```bash
cd htmlProject/startpage
python3 -m http.server 4173
```

浏览器打开 <http://127.0.0.1:4173>

## 用新的浏览器书签更新

Chrome / Edge：书签管理器 → 导出书签  
Firefox：书签 → 管理书签 → 导入和备份 → 导出书签到 HTML

然后在项目根目录执行：

```bash
python3 scripts/update.py /绝对路径/bookmarks_xxxx.html
```

脚本会：

1. 把文件复制到 `source/bookmarks.html`
2. 解析 Netscape 书签格式
3. 重新生成 `assets/js/bookmarks.js`

提交并推送后，GitHub Pages 即会更新。

也可以不改仓库、只在当前浏览器临时导入：把 `.html` 拖到页面上，或打开右上角设置选择文件。本地导入保存在浏览器里，换设备需要再导入，或走上面的脚本更新仓库。

手机浏览器同样可用：分类可左右滑动，卡片为双列，设置从底部弹出。建议在 Safari / Chrome 里「添加到主屏幕」，当主页或独立图标打开。

## 设为浏览器主页

1. 打开 GitHub Pages 地址
2. 浏览器设置 → 启动时打开特定网页 / 主页
3. 填入 Pages 地址

## GitHub Pages

仓库 Settings → Pages → Build and deployment：

- Source: Deploy from a branch
- Branch: `main` / `(root)`

根目录已放置 `.nojekyll`，避免 Jekyll 处理静态资源。
