# Live2D 模型说明

当前网站已经接入截图中的 OhMyLive2D 模型资源页同款左下角模型：`Senko_Normals`。

模型主地址：

```text
https://model.oml2d.com/Senko_Normals/senko.model3.json
```

为避免单个模型 CDN 在某些网络下加载失败，`live2d/live2d-widget.js` 已配置多源兜底：

```text
https://model.oml2d.com/Senko_Normals/senko.model3.json
https://registry.npmmirror.com/oml2d-models/latest/files/models/Senko_Normals/senko.model3.json
https://cdn.jsdelivr.net/gh/Eikanya/Live2d-model/Live2D/Senko_Normals/senko.model3.json
```

当前模型配置包含：

```js
{
    path: [/* 多源地址 */],
    position: [-10, 20],
    scale: 0.08,
    stageStyle: {
        width: 350,
        height: 450
    }
}
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

## 加载失败原因

页面出现红色“加载失败”时，说明 OhMyLive2D 运行时已经加载成功，失败发生在模型文件请求阶段。常见原因是模型 CDN 请求失败、跨域/CDN 临时异常，或模型子资源被网络拦截。当前代码已通过多源模型地址降低这个问题出现的概率。

## 资源来源

模型资源来自 OhMyLive2D 模型资源页：

```text
https://oml2d.hacxy.cn/guide/models.html
```

该页面说明这些模型资源主要用于参考和学习。公开部署前请留意模型作者与资源站的使用声明。
