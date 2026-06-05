/*
 * Live2D 看板娘陪伴脚本。
 * 使用 OhMyLive2D 的纯前端 CDN 运行时，适合直接部署到 GitHub Pages。
 * 只加载仓库内甘雨模型；如果入口、moc3 或 textures 缺失，会在控制台明确输出错误，不再回退到旧模型。
 */
(function () {
    const config = window.Live2DWidgetConfig || {};
    const widget = document.getElementById("live2d-widget");
    const message = widget ? widget.querySelector(".live2d-message") : null;
    const defaultGanyuModel = "live2d/models/ganyu/Ganyu1024.model3.json";
    const loadTimeoutMs = 10000;
    const fetchTimeoutMs = 5000;
    const scriptTimeoutMs = 7000;
    const slowLoadMessage = "甘雨加载有点慢，稍后再试试吧～";
    const readySelector = "#oml2d-main, .oml2d-main, #oml2d, .oml2d, .oml2d-stage, .oml2d-canvas";
    const waitingMessages = [
        "请稍等一下哦，我马上就来。",
        "嗯…让我整理一下思绪。",
        "今天的工作，也要认真完成呢。",
        "久等啦，我已经在路上了。",
        "请再等我片刻，好吗？",
        "月海亭的事务刚处理完呢。",
        "能见到你，我很开心。",
        "谢谢你愿意等我。",
        "接下来的时间，请多关照。",
        "希望今天也能帮到你。"
    ];
    const stableMessages = [
        "欢迎来到星空主页。",
        "点我一下，来和君雪互动吧。",
        "我会待在左下角，不影响游戏展示。",
        "接下来的时间，请多关照。",
        "希望今天也能帮到你。"
    ];

    let loadTimer = null;
    let readyObserver = null;
    let bootstrapHidden = false;

    function setMessage(text, persist) {
        if (!message || !widget) {
            return;
        }

        message.textContent = text;
        widget.classList.add("is-talking");

        window.clearTimeout(setMessage.timer);
        if (!persist) {
            setMessage.timer = window.setTimeout(function () {
                widget.classList.remove("is-talking");
            }, 3000);
        }
    }

    function getRandomMessage(messages) {
        return messages[Math.floor(Math.random() * messages.length)];
    }

    function hideBootstrapWidget() {
        if (!widget || bootstrapHidden) {
            return;
        }

        bootstrapHidden = true;
        window.clearTimeout(setMessage.timer);
        widget.classList.add("is-loaded");
        window.setTimeout(function () {
            if (widget.parentNode) {
                widget.remove();
            }
        }, 350);
    }

    function findReadyContainer() {
        return document.querySelector(readySelector);
    }

    function markLive2DReady() {
        window.clearTimeout(loadTimer);
        if (readyObserver) {
            readyObserver.disconnect();
            readyObserver = null;
        }
        hideBootstrapWidget();
    }

    function showFallbackMessage(reason, details) {
        window.clearTimeout(loadTimer);
        if (readyObserver) {
            readyObserver.disconnect();
            readyObserver = null;
        }

        console.error("Live2D fallback shown", {
            stage: reason,
            details: details || null
        });
        setMessage(slowLoadMessage, true);

        window.setTimeout(function () {
            if (!findReadyContainer()) {
                hideBootstrapWidget();
            }
        }, 3600);
    }

    function watchLive2DReady() {
        if (findReadyContainer()) {
            markLive2DReady();
            return;
        }

        readyObserver = new MutationObserver(function () {
            if (findReadyContainer()) {
                markLive2DReady();
            }
        });
        readyObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    function startLoadTimeout() {
        window.clearTimeout(loadTimer);
        loadTimer = window.setTimeout(function () {
            if (findReadyContainer()) {
                markLive2DReady();
                return;
            }

            console.error("Live2D load timeout", {
                timeout: loadTimeoutMs,
                selector: readySelector
            });
            showFallbackMessage("timeout", {
                timeout: loadTimeoutMs
            });
        }, loadTimeoutMs);
    }

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            const script = document.createElement("script");
            let done = false;
            const timer = window.setTimeout(function () {
                if (done) {
                    return;
                }
                done = true;
                script.remove();
                reject(new Error("script-timeout: " + src));
            }, scriptTimeoutMs);

            script.src = src;
            script.async = true;
            script.onload = function () {
                if (done) {
                    return;
                }
                done = true;
                window.clearTimeout(timer);
                resolve();
            };
            script.onerror = function () {
                if (done) {
                    return;
                }
                done = true;
                window.clearTimeout(timer);
                reject(new Error("script-load-failed: " + src));
            };
            document.head.appendChild(script);
        });
    }

    function fetchWithTimeout(url, stage) {
        const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        const timer = controller ? window.setTimeout(function () {
            controller.abort();
        }, fetchTimeoutMs) : null;

        return fetch(url, {
            method: "GET",
            cache: "no-store",
            signal: controller ? controller.signal : undefined
        }).finally(function () {
            if (timer) {
                window.clearTimeout(timer);
            }
        }).catch(function (error) {
            console.error("Live2D fetch failed", {
                stage: stage,
                url: url,
                error: error
            });
            throw error;
        });
    }

    function asAbsoluteUrl(path, baseUrl) {
        return new URL(path, baseUrl).href;
    }

    function toAbsoluteUrl(path) {
        return new URL(path, document.baseURI).href;
    }

    function addFile(files, file) {
        if (file && !files.includes(file)) {
            files.push(file);
        }
    }

    function collectModelFiles(modelJson, modelUrl) {
        const files = [];
        const references = modelJson.FileReferences || {};
        const absoluteModelUrl = toAbsoluteUrl(modelUrl);

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
            return asAbsoluteUrl(file, absoluteModelUrl);
        });
    }

    async function fetchRequiredFile(url, stage) {
        try {
            const response = await fetchWithTimeout(url, stage);

            if (!response.ok) {
                console.error("Live2D Ganyu resource missing", {
                    stage: stage,
                    url: url,
                    status: response.status,
                    statusText: response.statusText
                });
                return false;
            }

            return true;
        } catch (error) {
            console.error("Live2D Ganyu resource fetch failed", {
                stage: stage,
                url: url,
                error: error
            });
            return false;
        }
    }

    async function checkModelEntry(modelUrl) {
        const absoluteModelUrl = toAbsoluteUrl(modelUrl);

        try {
            const response = await fetchWithTimeout(absoluteModelUrl, "model entry");

            if (!response.ok) {
                console.error("Live2D Ganyu model entry missing", {
                    stage: "model entry",
                    url: absoluteModelUrl,
                    status: response.status,
                    statusText: response.statusText
                });
                return false;
            }

            const modelJson = await response.json();
            const requiredFiles = collectModelFiles(modelJson, absoluteModelUrl);

            for (const fileUrl of requiredFiles) {
                const lowerUrl = fileUrl.toLowerCase();
                const stage = lowerUrl.endsWith(".moc3") ? "moc3" : lowerUrl.includes("texture") ? "texture" : "model resource";
                const ok = await fetchRequiredFile(fileUrl, stage);

                if (!ok) {
                    return false;
                }
            }

            return true;
        } catch (error) {
            console.error("Live2D Ganyu model check failed", {
                stage: "model entry",
                url: absoluteModelUrl,
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
        } catch (primaryError) {
            console.error("Live2D runtime primary CDN failed", {
                stage: "runtime",
                error: primaryError
            });
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
            mobilePosition: config.mobilePosition || [0, 20],
            mobileScale: config.mobileScale || 0.075,
            mobileStageStyle: config.mobileStageStyle || {
                width: config.mobileWidth || 240,
                height: config.mobileHeight || 400
            }
        };
    }

    async function boot() {
        const dockedPosition = config.dockedPosition || "left";
        const idleMessages = config.messages || stableMessages;
        const modelPath = config.modelPath || defaultGanyuModel;
        const waitingMessage = getRandomMessage(waitingMessages);

        if (widget && dockedPosition === "left") {
            widget.classList.add("is-left");
        }

        setMessage(waitingMessage, true);
        startLoadTimeout();

        try {
            await ensureRuntime();
        } catch (error) {
            console.error("Live2D runtime load failed", {
                stage: "runtime",
                error: error
            });
            showFallbackMessage("runtime", error);
            return;
        }

        if (!window.OML2D || typeof window.OML2D.loadOml2d !== "function") {
            console.error("Live2D runtime is unavailable", {
                stage: "runtime",
                runtime: window.OML2D
            });
            showFallbackMessage("runtime unavailable", window.OML2D);
            return;
        }

        const modelReady = await checkModelEntry(modelPath);

        if (!modelReady) {
            showFallbackMessage("model resource", {
                modelPath: modelPath
            });
            return;
        }

        watchLive2DReady();

        try {
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
                    loadingMessage: waitingMessage,
                    loadSuccessMessage: "我来啦，请多关照。",
                    loadFailMessage: slowLoadMessage
                },
                models: [buildModelConfig(modelPath)],
                tips: {
                    idleTips: {
                        message: idleMessages
                    }
                }
            });

            window.setTimeout(function () {
                if (findReadyContainer()) {
                    markLive2DReady();
                }
            }, 1200);
        } catch (error) {
            console.error("Live2D Cubism init failed", {
                stage: "Cubism Init Failed",
                error: error
            });
            showFallbackMessage("Cubism Init Failed", error);
        }
    }

    boot();
})();
