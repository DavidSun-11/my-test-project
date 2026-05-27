# Live2D 模型说明

当前网站已经切换到稳定公开的 Live2D 示例模型：`shizuku`。

模型入口：

```text
https://cdn.jsdelivr.net/npm/live2d-widget-model-shizuku@1.0.5/assets/shizuku.model.json
```

备用入口：

```text
https://unpkg.com/live2d-widget-model-shizuku@1.0.5/assets/shizuku.model.json
```

`live2d/live2d-widget.js` 会先检查模型入口 JSON，再检查它引用的必要资源是否可读，包括：

```text
moc/shizuku.moc
moc/shizuku.1024/texture_00.png
moc/shizuku.1024/texture_01.png
moc/shizuku.1024/texture_02.png
moc/shizuku.1024/texture_03.png
moc/shizuku.1024/texture_04.png
moc/shizuku.1024/texture_05.png
shizuku.physics.json
shizuku.pose.json
```

检查通过后，脚本才会把单个可用的模型 URL 交给 OhMyLive2D 加载。

## 当前已接入页面

- `index.html`
- `about.html`
- `games.html`

三个页面都会加载同一套文件：

```text
live2d/live2d-widget.css
live2d/live2d-widget.js
```

## 本仓库缺失的本地模型文件

`live2d/models/miku-style/` 目录目前只有占位说明文件，没有真正的本地模型资源。缺少：

```text
live2d/models/miku-style/model.json
live2d/models/miku-style/*.moc 或 *.moc3
live2d/models/miku-style/textures/
live2d/models/miku-style/motions/ 或 expressions/
live2d/models/miku-style/physics.json 或 *.physics3.json
```

如果以后要改成本地模型，请把完整模型资源放到 `live2d/models/miku-style/`，并确保入口文件和它内部引用的 textures、moc、motions 路径完全对应。

## 之前 GitHub Pages 加载失败的原因

页面出现红色“模型加载失败，请刷新或稍后再试”时，说明 OhMyLive2D 运行时已经加载成功，失败发生在模型文件加载阶段。之前的问题主要有三点：

1. 本仓库没有真正的本地 Live2D 模型文件，`live2d/models/miku-style/model.json` 不存在。
2. `Senko_Normals` 依赖第三方模型 CDN；该 CDN 或它的子资源在某些网络环境下可能不可访问。
3. 之前的兜底写法把多个模型地址数组直接传给 `path`，而 OhMyLive2D 需要一个单独的模型入口 URL，导致模型加载失败。

当前修复改为使用 npm/CDN 上文件结构完整的 shizuku 示例模型，并在加载前主动检查 `model.json`、`moc`、`textures`、`physics`、`pose` 是否都能被浏览器读取。
