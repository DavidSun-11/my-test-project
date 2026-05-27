# Live2D 模型说明

当前网站已经接入截图中的 OhMyLive2D 模型资源页同款左下角模型：`Senko_Normals`。

模型地址：

```text
https://model.oml2d.com/Senko_Normals/senko.model3.json
```

官方示例配置：

```js
{
    path: "https://model.oml2d.com/Senko_Normals/senko.model3.json",
    position: [-10, 20]
}
```

站点现在由 `live2d/live2d-widget.js` 自动加载这个模型，并默认停靠在左下角。它使用 OhMyLive2D CDN 运行时，部署到 GitHub Pages 后可以直接运行。

## 当前已接入页面

- `index.html`
- `about.html`
- `games.html`

三个页面都会加载同一套文件：

```text
live2d/live2d-widget.css
live2d/live2d-widget.js
```

## 资源来源

模型资源来自 OhMyLive2D 模型资源页：

```text
https://oml2d.hacxy.cn/guide/models.html
```

该页面说明这些模型资源主要用于参考和学习。公开部署前请留意模型作者与资源站的使用声明。
