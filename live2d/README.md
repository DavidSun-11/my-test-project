# Live2D 模型放置说明

当前网站已经接入 GitHub Pages 可用的纯前端 Live2D 加载方式，页面会优先读取：

```text
live2d/models/miku-style/model.json
```

请下载一个你有权使用和发布的 Live2D Web 模型，风格可选择蓝绿色双马尾、二次元看板娘。模型目录里通常会包含：

```text
model.json 或 *.model3.json
*.moc 或 *.moc3
textures/
motions/ 或 expressions/
physics.json 或 *.physics3.json
```

## 推荐放置位置

如果下载到的是 Cubism 2 模型，并且入口文件名是 `model.json`，直接放成：

```text
live2d/models/miku-style/model.json
live2d/models/miku-style/*.moc
live2d/models/miku-style/textures/
live2d/models/miku-style/motions/
```

如果下载到的是 Cubism 3/4 模型，并且入口文件名是 `xxx.model3.json`，请把它重命名为 `model.json`，或者把页面里的配置改成对应文件名：

```html
modelPath: "live2d/models/miku-style/xxx.model3.json"
```

## 当前已接入页面

- `index.html`
- `about.html`
- `games.html`

三个页面都会加载同一套文件：

```text
live2d/live2d-widget.css
live2d/live2d-widget.js
```

## 说明

- 没有上传本地模型时，脚本会临时使用 CDN 示例模型，保证页面不会空白。
- 想要接近初音未来风格，请使用合法授权的蓝绿色双马尾 Live2D 模型资源；不要直接上传未授权的商业角色模型。
- 所有资源都使用相对路径，部署到 GitHub Pages 后可以直接运行。
