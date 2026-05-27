# Assets

这个目录用于放网站新增的静态资源，例如图片、贴纸、音频或展示素材。

## 本地音乐播放器

当前网站使用 HTML `<audio>` 播放本地仓库音频，不再使用网易云 iframe，也不会引用电脑 D 盘路径。

页面播放器读取：

```text
assets/audio/zuichibi.mp3
```

播放器样式在：

```text
assets/music-player.css
```

如果音频文件没有出现在 GitHub 仓库中，GitHub Pages 会请求不到该文件，播放器会显示但无法播放。请确认拥有公开发布/托管该音频的授权后，把文件上传到：

```text
assets/audio/zuichibi.mp3
```

## Live2D

Live2D Web 模型文件如果以后要本地化，请优先放在：

```text
live2d/models/miku-style/
```

这样首页、关于页和游戏展示页可以读取同一个模型。
