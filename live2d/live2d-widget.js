/*
 * Live2D 看板娘初始化脚本。
 * 使用 OhMyLive2D 的纯前端 CDN 运行时，适合直接部署到 GitHub Pages。
 * 当前默认使用 OhMyLive2D 模型资源页中的 Senko_Normals 模型，并配置多源兜底避免单个模型 CDN 加载失败。
 */
(function () {
    const config = window.Live2DWidgetConfig || {};
    const widget = document.getElementById("live2d-widget");
    const message = widget ? widget.querySelector(".live2d-message") : null;
    const senkoModelPaths = [
        "https://model.oml2d.com/Senko_Normals/senko.model3.json",
        "https://registry.npmmirror.com/oml2d-models/latest/files/models/Senko_Normals/senko.model3.json",
        "https://cdn.jsdelivr.net/gh/Eikanya/Live2d-model/Live2D/Senko_Normals/senko.model3.json"
    ];
    const senkoModel = senkoModelPaths[0];
    const legacyLocalModel = "live2d/models/miku-style/model.json";
    const senkoMessages = [
        "欢迎来到星空主页。",
        "我换成 Senko_Normals 啦。",
        "我会待在左下角，不影响游戏展示。"
    ];

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

    function getRequestedModelPath() {
        if (!config.modelPath || config.modelPath === legacyLocalModel || config.modelPath === senkoModel) {
            return senkoModelPaths;
        }

        return config.modelPath;
    }

    async function resolveModelPath(requestedPath) {
        if (Array.isArray(requestedPath)) {
            return requestedPath;
        }

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
            // GitHub Pages 可正常 HEAD；本地 file:// 预览失败时走官方 Senko 多源兜底模型。
        }

        setMessage("本地 Live2D 模型未找到，已临时使用 Senko_Normals。");
        return config.fallbackModelPath || senkoModelPaths;
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

    function buildModelConfig(modelPath, usesDefaultSenko) {
        const modelConfig = {
            name: usesDefaultSenko ? "Senko_Normals" : (config.name || "Live2D"),
            path: modelPath,
            position: usesDefaultSenko ? [-10, 20] : (config.position || [0, 70])
        };

        if (usesDefaultSenko) {
            modelConfig.scale = 0.08;
            modelConfig.stageStyle = {
                width: 350,
                height: 450
            };
            modelConfig.mobileScale = 0.06;
            modelConfig.mobilePosition = [0, 40];
            modelConfig.mobileStageStyle = {
                width: 250,
                height: 300
            };
            return modelConfig;
        }

        if (config.scale != null) {
            modelConfig.scale = config.scale;
        }

        if (config.width || config.height || config.stageStyle) {
            modelConfig.stageStyle = config.stageStyle || {
                width: config.width,
                height: config.height
            };
        }

        if (config.mobilePosition) {
            modelConfig.mobilePosition = config.mobilePosition;
        }

        if (config.mobileScale != null) {
            modelConfig.mobileScale = config.mobileScale;
        }

        if (config.mobileWidth || config.mobileHeight || config.mobileStageStyle) {
            modelConfig.mobileStageStyle = config.mobileStageStyle || {
                width: config.mobileWidth,
                height: config.mobileHeight
            };
        }

        return modelConfig;
    }

    async function boot() {
        const requestedPath = getRequestedModelPath();
        const usesDefaultSenko = Array.isArray(requestedPath)
            ? requestedPath[0] === senkoModel
            : requestedPath === senkoModel;
        const dockedPosition = config.dockedPosition || (usesDefaultSenko ? "left" : "right");
        const idleMessages = usesDefaultSenko ? senkoMessages : (config.messages || senkoMessages);

        if (widget && dockedPosition === "left") {
            widget.classList.add("is-left");
        }

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

        const modelPath = await resolveModelPath(requestedPath);

        if (widget) {
            widget.classList.add("is-loaded");
            window.setTimeout(function () {
                widget.remove();
            }, 350);
        }

        window.OML2D.loadOml2d({
            dockedPosition: dockedPosition,
            primaryColor: "#38d9ff",
            sayHello: true,
            mobileDisplay: true,
            menus: {
                disable: true
            },
            statusBar: {
                disable: false,
                loadingMessage: "Live2D 加载中...",
                loadSuccessMessage: "Senko_Normals 已上线",
                loadFailMessage: "模型加载失败，请刷新或稍后再试"
            },
            models: [buildModelConfig(modelPath, usesDefaultSenko)],
            tips: {
                idleTips: {
                    message: idleMessages
                }
            }
        });
    }

    boot();
})();
