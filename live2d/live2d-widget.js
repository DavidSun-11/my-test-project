/*
 * Live2D 看板娘初始化脚本。
 * 使用 OhMyLive2D 的纯前端 CDN 运行时，适合直接部署到 GitHub Pages。
 * 只加载仓库内甘雨模型；如果入口、moc3 或 textures 缺失，会在控制台明确输出错误，不再回退到旧模型。
 */
(function () {
    const config = window.Live2DWidgetConfig || {};
    const widget = document.getElementById("live2d-widget");
    const message = widget ? widget.querySelector(".live2d-message") : null;
    const defaultGanyuModel = "live2d/models/ganyu/Ganyu1024.model3.json";
    const stableMessages = [
        "欢迎来到星空主页。",
        "点我一下，来和君雪互动吧。",
        "我会待在左下角，不影响游戏展示。",
        "甘雨模型正在从站内资源加载。"
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

    function asAbsoluteUrl(path, baseUrl) {
        return new URL(path, baseUrl).href;
    }

    function addFile(files, file) {
        if (file && !files.includes(file)) {
            files.push(file);
        }
    }

    function collectModelFiles(modelJson, modelUrl) {
        const files = [];
        const references = modelJson.FileReferences || {};

        addFile(files, modelJson.model);
        addFile(files, modelJson.physics);
        addFile(files, modelJson.pose);

        if (Array.isArray(modelJson.textures)) {
            modelJson.textures.forEach(function (texture) {
                addFile(files, texture);
            });
        }

        addFile(files, references.Moc);
        addFile(files, references.Physics);
        addFile(files, references.Pose);
        addFile(files, references.DisplayInfo);

        if (Array.isArray(references.Textures)) {
            references.Textures.forEach(function (texture) {
                addFile(files, texture);
            });
        }

        if (references.Motions) {
            Object.keys(references.Motions).forEach(function (groupName) {
                references.Motions[groupName].forEach(function (motion) {
                    addFile(files, motion.File);
                });
            });
        }

        if (references.Expressions) {
            references.Expressions.forEach(function (expression) {
                addFile(files, expression.File);
            });
        }

        return files.map(function (file) {
            return asAbsoluteUrl(file, modelUrl);
        });
    }

    async function fetchRequiredFile(url) {
        try {
            const response = await fetch(url, {
                method: "GET",
                cache: "no-store"
            });

            if (!response.ok) {
                console.error("Live2D Ganyu resource missing", {
                    url: url,
                    status: response.status,
                    statusText: response.statusText
                });
                return false;
            }

            return true;
        } catch (error) {
            console.error("Live2D Ganyu resource fetch failed", {
                url: url,
                error: error
            });
            return false;
        }
    }

    async function checkModelEntry(modelUrl) {
        try {
            const response = await fetch(modelUrl, {
                method: "GET",
                cache: "no-store"
            });

            if (!response.ok) {
                console.error("Live2D Ganyu model entry missing", {
                    url: modelUrl,
                    status: response.status,
                    statusText: response.statusText
                });
                return false;
            }

            const modelJson = await response.json();
            const requiredFiles = collectModelFiles(modelJson, modelUrl);

            for (const fileUrl of requiredFiles) {
                const ok = await fetchRequiredFile(fileUrl);

                if (!ok) {
                    return false;
                }
            }

            return true;
        } catch (error) {
            console.error("Live2D Ganyu model check failed", {
                url: modelUrl,
                error: error
            });
            return false;
        }
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

    function buildModelConfig(modelPath) {
        return {
            name: config.modelName || "ganyu",
            path: modelPath,
            position: config.position || [0, 20],
            scale: config.scale || 0.216,
            stageStyle: config.stageStyle || {
                width: config.width || 336,
                height: config.height || 456
            },
            mobilePosition: config.mobilePosition || [0, 25],
            mobileScale: config.mobileScale || 0.168,
            mobileStageStyle: config.mobileStageStyle || {
                width: config.mobileWidth || 228,
                height: config.mobileHeight || 312
            }
        };
    }

    async function boot() {
        const dockedPosition = config.dockedPosition || "left";
        const idleMessages = config.messages || stableMessages;
        const modelPath = config.modelPath || defaultGanyuModel;

        if (widget && dockedPosition === "left") {
            widget.classList.add("is-left");
        }

        setMessage("Live2D 加载中...");

        try {
            await ensureRuntime();
        } catch (error) {
            console.error("Live2D runtime load failed", error);
            setMessage("Live2D 运行时加载失败，请检查 CDN 是否可访问。");
            return;
        }

        if (!window.OML2D || typeof window.OML2D.loadOml2d !== "function") {
            console.error("Live2D runtime is unavailable", window.OML2D);
            setMessage("Live2D 运行时不可用，请稍后刷新页面。");
            return;
        }

        const modelReady = await checkModelEntry(modelPath);

        if (!modelReady) {
            setMessage("甘雨模型资源不可访问，请检查 GitHub Pages 文件路径。");
            return;
        }

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
                loadSuccessMessage: "甘雨已上线",
                loadFailMessage: "甘雨模型加载失败，请检查 Console 资源错误"
            },
            models: [buildModelConfig(modelPath)],
            tips: {
                idleTips: {
                    message: idleMessages
                }
            }
        });
    }

    boot();
})();
