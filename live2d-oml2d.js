/*
 * OhMyLive2D 看板娘加载脚本。
 * 直接使用 OhMyLive2D CDN，它自带 Live2D 运行时，比手动组合 Pixi 依赖更适合 GitHub Pages。
 */
(function () {
    const oldPlaceholder = document.getElementById("live2d-widget");
    const oldMessage = oldPlaceholder ? oldPlaceholder.querySelector(".live2d-message") : null;
    const config = window.Live2DWidgetConfig || {};
    const oldLocalPath = "live2d/model/model.json";
    const pioModel = "https://model.oml2d.com/Pio/model.json";
    const modelPath = config.modelPath && config.modelPath !== oldLocalPath ? config.modelPath : pioModel;

    function setFallbackMessage(text) {
        if (!oldMessage || !oldPlaceholder) {
            return;
        }

        oldMessage.textContent = text;
        oldPlaceholder.classList.add("is-talking");
    }

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            const script = document.createElement("script");
            script.src = src;
            script.async = true;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    function start() {
        if (!window.OML2D || typeof OML2D.loadOml2d !== "function") {
            setFallbackMessage("OhMyLive2D 未加载成功，请刷新或检查 CDN。 ");
            return;
        }

        if (oldPlaceholder) {
            oldPlaceholder.remove();
        }

        OML2D.loadOml2d({
            dockedPosition: "right",
            mobileDisplay: true,
            primaryColor: "#38d9ff",
            sayHello: true,
            transitionTime: 900,
            models: [
                {
                    name: "Pio",
                    path: modelPath,
                    position: config.position || [0, 70],
                    scale: config.scale || 0.4,
                    stageStyle: {
                        width: config.width || 280,
                        height: config.height || 380
                    },
                    mobilePosition: config.mobilePosition || [0, 40],
                    mobileScale: config.mobileScale || 0.32,
                    mobileStageStyle: {
                        width: config.mobileWidth || 180,
                        height: config.mobileHeight || 260
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
            }
        });
    }

    setFallbackMessage("Pio 加载中...");

    if (window.OML2D) {
        start();
        return;
    }

    loadScript("https://cdn.jsdelivr.net/npm/oh-my-live2d@0.19.3/dist/index.min.js")
        .catch(function () {
            return loadScript("https://unpkg.com/oh-my-live2d@0.19.3/dist/index.min.js");
        })
        .then(start)
        .catch(function () {
            setFallbackMessage("OhMyLive2D CDN 加载失败，请检查网络或稍后刷新。");
        });
})();
