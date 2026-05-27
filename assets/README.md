# Assets

这个目录用于放网站后续新增的静态资源，例如图片、贴纸、音频或展示素材。

## 网易云音乐播放器

当前网站没有上传 mp3，使用网易云音乐外链 iframe 播放器。

《醉赤壁》林俊杰的网易云歌曲 ID 预留为：

```text
108478
```

播放器样式在：

```text
assets/music-player.css
```

页面里的外链播放器地址为：

```text
https://music.163.com/outchain/player?type=2&id=108478&auto=0&height=66
```

如果该歌曲因为版权或地区限制无法外链播放，只需要替换 URL 里的 `id=108478` 为其他可播放歌曲 ID。

## Live2D

Live2D Web 模型文件如果以后要本地化，请优先放在：

```text
live2d/models/miku-style/
```

这样首页、关于页和游戏展示页可以读取同一个模型。
