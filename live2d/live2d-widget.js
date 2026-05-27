/*
 * Live2D 看板娘初始化脚本。
 * 使用 OhMyLive2D 的纯前端 CDN 运行时，适合直接部署到 GitHub Pages。
 * 模型优先读取 live2d/models/miku-style/model.json；如果还没上传模型，则自动回退到 CDN 示例模型，避免页面空白。
 */
(function () {
    const config = window.Live2DWidgetConfig || {};
    const widget = document.getElementById("live2d-widget");
    const message = widget ? widget.querySelector(".live2d-message") : null;
    const defaultLocalModel = "live2d/models/miku-style/model.json";
    const fallbackModel = "https://model.oml2d.com/Pio/model.json";

    function setMessage(text) {
        if (!message || !widget) {
            return;
        }

        message.textContent = text;
        widget.classList.add("is-talking");

        window.clearTimeout(setMessage.timer);
        setMessage.timer = window.setTimeout(function () {
            widget.classList.remove("is-talking");
        }, 3000);
    }

    function isRemotePath(path) {
        return /^https?:\/\//i.test(path);
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

    async function resolveModelPath() {
        const requestedPath = config.modelPath || defaultLocalModel;

        if (isRemotePath(requestedPath)) {
            return requestedPath;
        }

        try {
            const response = await fetch(requestedPath, {
                method: "HEAD",
                cache: "no-store"
            });

            if (response.ok) {
                return requestedPath;
            }
        } catch (error) {
            // GitHub Pages 可正常 HEAD；本地 file:// 预览失败时走兜底模型。
        }

        setMessage("本地 Live2D 模型未找到，已临时使用示例模型。");
        return config.fallbackModelPath || fallbackModel;
    }

    async function ensureRuntime() {
        if (window.OML2D && typeof window.OML2D.loadOml2d === "function") {
            return;
        }

        try {
            await loadScript("https://cdn.jsdelivr.net/npm/oh-my-live2d@0.19.3/dist/index.min.js");
        } catch (error) {
            await loadScript("https://unpkg.com/oh-my-live2d@0.19.3/dist/index.min.js");
        }
    }

    async function boot() {
        setMessage("Live2D 加载中...");

        try {
            await ensureRuntime();
        } catch (error) {
            setMessage("Live2D 运行时加载失败，请检查 CDN 是否可访问。");
            return;
        }

        if (!window.OML2D || typeof window.OML2D.loadOml2d !== "function") {
            setMessage("Live2D 运行时不可用，请稍后刷新页面。");
            return;
        }

        const modelPath = await resolveModelPath();

        if (widget) {
            widget.classList.add("is-loaded");
            window.setTimeout(function () {
                widget.remove();
            }, 350);
        }

        window.OML2D.loadOml2d({
            dockedPosition: "right",
            primaryColor: "#38d9ff",
            sayHello: true,
            mobileDisplay: true,
            menus: {
                disable: true
            },
            statusBar: {
                disable: false,
                loadingMessage: "Live2D 加载中...",
                loadSuccessMessage: "看板娘已上线"
            },
            models: [
                {
                    name: "Miku Style",
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
            tips: {
                idleTips: {
                    message: config.messages || [
                        "欢迎来到星空主页。",
                        "今天也要元气满满。",
                        "我会固定待在右下角，不挡住游戏展示。"
                    ]
                }
            }
        });
    }

    boot();
})();
