# Live2D 模型资源放置说明

当前网页已经预留了右下角 Live2D 看板娘容器，默认会加载：

```text
live2d/model/model.json
```

你需要新建 `live2d/model/` 文件夹，并把模型资源放进去。

## Cubism 2 模型

常见入口文件是 `model.json`，同目录通常还会包含：

```text
live2d/model/model.json
live2d/model/*.moc
live2d/model/textures/
live2d/model/motions/
live2d/model/physics.json
```

如果入口文件名不是 `model.json`，请修改每个 HTML 页面里的：

```html
<script>
    window.Live2DWidgetConfig = {
        modelPath: "live2d/model/你的入口文件.model.json"
    };
</script>
```

## Cubism 3 / Cubism 4 模型

常见入口文件是 `*.model3.json`，同目录通常还会包含：

```text
live2d/model/角色名.model3.json
live2d/model/角色名.moc3
live2d/model/textures/
live2d/model/motions/
live2d/model/角色名.physics3.json
live2d/model/角色名.cdi3.json
```

如果使用 Cubism 3 / 4 模型，页面还需要在 `pixi-live2d-display` 前引入 `live2dcubismcore.min.js`。这个文件通常来自 Live2D Cubism SDK，请确认授权后放到仓库，例如：

```text
live2d/runtime/live2dcubismcore.min.js
```

然后在 HTML 中加入：

```html
<script src="live2d/runtime/live2dcubismcore.min.js"></script>
```

## 已接入的页面

- `index.html`
- `about.html`
- `games.html`

样式在 `live2d-widget.css`，初始化逻辑在 `live2d-widget.js`。
