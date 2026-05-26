# Live2D 模型资源说明

当前网站已经接入右下角 Live2D 看板娘，默认使用 OhMyLive2D 模型资源页提供的 Pio 模型：

```text
https://model.oml2d.com/Pio/model.json
```

来源页面：

```text
https://oml2d.hacxy.cn/guide/models.html
```

该模型是远程公开资源，GitHub Pages 可以直接加载，所以你现在不需要额外上传模型文件。

## 当前已接入页面

- `index.html`
- `about.html`
- `games.html`

样式在 `live2d-widget.css`，初始化逻辑在 `live2d-widget.js`。

## 想换成自己的本地模型

如果以后你想把模型文件放进自己的仓库，可以新建：

```text
live2d/model/
```

然后把 Cubism 2 模型资源放进去，例如：

```text
live2d/model/model.json
live2d/model/*.moc
live2d/model/textures/
live2d/model/motions/
live2d/model/physics.json
```

再把 HTML 里的配置改成本地路径：

```html
<script>
    window.Live2DWidgetConfig = {
        modelPath: "live2d/model/model.json"
    };
</script>
```

## 使用 Cubism 3 / Cubism 4 模型

Cubism 3 / 4 常见入口文件是 `*.model3.json`，同目录通常还会包含：

```text
live2d/model/角色名.model3.json
live2d/model/角色名.moc3
live2d/model/textures/
live2d/model/motions/
live2d/model/角色名.physics3.json
live2d/model/角色名.cdi3.json
```

如果使用 Cubism 3 / 4 模型，页面还需要在 `pixi-live2d-display` 前引入 `live2dcubismcore.min.js`。该文件通常来自 Live2D Cubism SDK，请确认授权后放入仓库，例如：

```text
live2d/runtime/live2dcubismcore.min.js
```

然后在 HTML 中加入：

```html
<script src="live2d/runtime/live2dcubismcore.min.js"></script>
```

## 使用限制提醒

OhMyLive2D 模型资源页说明这些模型主要用于参考和学习，不建议用于商业盈利项目。公开模型地址依赖第三方服务器，如果对稳定性要求很高，后续可以把授权允许的模型资源下载后放到本仓库中。
