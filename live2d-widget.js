/*
 * Live2D 看板娘初始化脚本。
 * 使用 OhMyLive2D 官方 CDN 链路加载 Pio 模型；它自带运行时，适合直接部署到 GitHub Pages。
 */
(function () {
    const placeholder = document.getElementById("live2d-widget");
    const message = placeholder ? placeholder.querySelector(".live2d-message") : null;
    const config = window.Live2DWidgetConfig || {};
    const localPlaceholderPath = "live2d/model/model.json";
    const defaultModelPath = "https://model.oml2d.com/Pio/model.json";
    const modelPath = config.modelPath && config.modelPath !== localPlaceholderPath
        ? config.modelPath
        : defaultModelPath;

    function setMessage(text) {
        if (message) {
            message.textContent = text;
            placeholder.classList.add("is-talking");
        }
    }

    function loadScript(src, onLoad, onError) {
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.onload = onLoad;
        script.onerror = onError;
        document.head.appendChild(script);
    }

    function bootOml2d() {
        if (!window.OML2D || typeof OML2D.loadOml2d !== "function") {
            setMessage("OhMyLive2D 没有加载成功，请检查 CDN 是否可访问。");
            return;
        }

        if (placeholder) {
            placeholder.remove();
        }

        OML2D.loadOml2d({
            primaryColor: "#38d9ff",
            sayHello: true,
            models: [
                {
                    name: "Pio",
                    path: modelPath,
                    position: config.position || [0, 70],
                    scale: config.scale || 0.4,
                    stageStyle: {
                        width: config.width || 280,
                        height: config.height || 380
                    }
                }
            ],
            statusBar: {
                disable: false,
                loadingMessage: "Pio 加载中...",
                loadSuccessMessage: "Pio 已上线"
            },
            tips: {
                idleTips: {
                    message: config.messages || [
                        "欢迎来到星空主页。",
                        "今天也要打出漂亮操作。",
                        "我是来自 OhMyLive2D 的 Pio。"
                    ]
                }
            },
            menus: {
                disable: true
            },
            mobileDisplay: true
        });
    }

    setMessage("Pio 加载中...");

    if (window.OML2D) {
        bootOml2d();
        return;
    }

    loadScript(
        "https://cdn.jsdelivr.net/npm/oh-my-live2d@0.19.3/dist/index.min.js",
        bootOml2d,
        function () {
            setMessage("OhMyLive2D CDN 加载失败，请检查网络或稍后刷新。");
        }
    );
})();
