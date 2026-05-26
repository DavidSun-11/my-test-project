/*
 * Live2D 看板娘初始化脚本。
 * 默认使用 OhMyLive2D 提供的 Pio 模型；换模型时可在页面里设置 window.Live2DWidgetConfig.modelPath。
 */
(function () {
    const widget = document.getElementById("live2d-widget");
    const canvas = document.getElementById("live2d-canvas");
    const message = widget ? widget.querySelector(".live2d-message") : null;

    if (!widget || !canvas) {
        return;
    }

    const config = window.Live2DWidgetConfig || {};
    const localPlaceholderPath = "live2d/model/model.json";
    const defaultModelPath = "https://model.oml2d.com/Pio/model.json";
    const modelPath = config.modelPath && config.modelPath !== localPlaceholderPath
        ? config.modelPath
        : defaultModelPath;
    const messages = config.messages || [
        "欢迎来到星空主页。",
        "今天也要打出漂亮操作。",
        "我是来自 OhMyLive2D 的 Pio。",
        "点击我会切换一句小提示。"
    ];

    function say(text, keepVisible) {
        if (!message) {
            return;
        }

        message.textContent = text;
        widget.classList.add("is-talking");

        if (!keepVisible) {
            window.clearTimeout(widget._talkTimer);
            widget._talkTimer = window.setTimeout(function () {
                widget.classList.remove("is-talking");
            }, 2600);
        }
    }

    if (!window.PIXI || !PIXI.live2d || !PIXI.live2d.Live2DModel) {
        say("Live2D CDN 还没加载好，请检查网络或脚本地址。", true);
        return;
    }

    const app = new PIXI.Application({
        view: canvas,
        autoStart: true,
        backgroundAlpha: 0,
        transparent: true,
        antialias: true,
        width: widget.clientWidth,
        height: widget.clientHeight
    });

    function resizeRenderer() {
        app.renderer.resize(widget.clientWidth, widget.clientHeight);
    }

    resizeRenderer();
    window.addEventListener("resize", resizeRenderer);

    PIXI.live2d.Live2DModel.from(modelPath, { autoInteract: true })
        .then(function (model) {
            widget.classList.add("is-loaded");
            app.stage.addChild(model);

            model.anchor.set(0.5, 1);

            function fitModel() {
                resizeRenderer();

                const scaleX = widget.clientWidth / model.width;
                const scaleY = widget.clientHeight / model.height;
                const scale = Math.min(scaleX, scaleY) * (config.scale || 0.9);

                model.scale.set(scale);
                model.x = app.renderer.width / 2 + (config.offsetX || 0);
                model.y = app.renderer.height + (config.offsetY || 0);
            }

            fitModel();
            window.addEventListener("resize", fitModel);

            say(messages[0]);

            widget.addEventListener("click", function () {
                const text = messages[Math.floor(Math.random() * messages.length)];
                say(text);
            });
        })
        .catch(function () {
            say("Pio 模型加载失败，请检查 https://model.oml2d.com/Pio/model.json 是否可访问。", true);
        });
})();
