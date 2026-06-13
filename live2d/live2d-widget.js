/*
 * Live2D 看板娘陪伴脚本。
 * 使用本地固定版本 OhMyLive2D 运行时，CDN 仅作为备用兜底。
 * 只加载仓库内甘雨模型；如果入口、moc3 或 textures 缺失，会在控制台明确输出错误，不再回退到旧模型。
 */
(function () {
    const config = window.Live2DWidgetConfig || {};
    const widget = document.getElementById("live2d-widget");
    const message = widget ? widget.querySelector(".live2d-message") : null;
    function joinPath(base, path) {
        if (!base || /^(?:https?:)?\/\//i.test(path) || path.charAt(0) === "/") {
            return path;
        }

        return String(base).replace(/\/+$/, "") + "/" + String(path).replace(/^\/+/, "");
    }

    const assetBasePath = typeof config.assetBasePath === "string" ? config.assetBasePath : "live2d";
    const runtimeBasePath = typeof config.runtimeBasePath === "string" ? config.runtimeBasePath : assetBasePath;
    const defaultGanyuModel = config.defaultModelPath || joinPath(assetBasePath, "models/ganyu/Ganyu1024.model3.json");
    const loadTimeoutMs = 10000;
    const fetchTimeoutMs = 5000;
    const scriptTimeoutMs = 7000;
    const slowLoadMessage = "甘雨加载有点慢，稍后再试试吧～";
    const webglWarningMessage = "当前浏览器不支持 WebGL，甘雨可能无法正常显示。";
    const localRuntimeSrc = joinPath(runtimeBasePath, "vendor/oh-my-live2d-0.19.3.min.js");
    const jsdelivrRuntimeSrc = "https://cdn.jsdelivr.net/npm/oh-my-live2d@0.19.3/dist/index.min.js";
    const unpkgRuntimeSrc = "https://unpkg.com/oh-my-live2d@0.19.3/dist/index.min.js";
    const runtimeResolutionNeedle = "resolution:2,autoStart:!0,autoDensity:!0";
    const readySelector = "#oml2d-main, .oml2d-main, #oml2d, .oml2d, .oml2d-stage, .oml2d-canvas";
    const waitingMessages = [""];
    const stableMessages = [""];

    let loadTimer = null;
    let readyObserver = null;
    let bootstrapHidden = false;
    let runtimeInjectedDpr = false;
    let runtimeUsedOriginal = false;
    let fallbackBootStarted = false;
    let pausedPixiTicker = null;
    let canvasContextListenerInstalled = false;

    window.JunxueLive2DRenderInfo = Object.assign({
        usesCanvas: false,
        canvasFound: false,
        webglSupported: false,
        webgl2Supported: false,
        actualContext: "",
        canvasCount: 0,
        estimatedInstanceCount: 0,
        isInitialized: false,
        isActuallyVisible: false,
        visibilityProblem: "",
        stageRect: null,
        canvasRect: null,
        contextLost: false,
        dprCap: getLive2DDprCap(),
        dprInjected: false,
        fallbackToOriginalResolution: false,
        runtime: "oh-my-live2d@0.19.3",
        runtimeSource: ""
    }, window.JunxueLive2DRenderInfo || {});

    if (window.__JUNXUE_LIVE2D_READY__ || window.__JUNXUE_LIVE2D_INIT_STARTED__ || hasExistingLive2DInstance()) {
        if (!hasActuallyVisibleLive2D()) {
            cleanupBrokenLive2DNodes("initial-invalid-instance");
            window.__JUNXUE_LIVE2D_INIT_STARTED__ = false;
            window.__JUNXUE_LIVE2D_READY__ = false;
            window.__JUNXUE_LIVE2D_INSTANCE__ = null;
            window.JunxueLive2DRenderInfo.isInitialized = false;
        } else {
            window.__JUNXUE_LIVE2D_INIT_STARTED__ = true;
            cleanupDuplicateLive2DNodes();
            updateCanvasRenderInfo();
            window.__JUNXUE_LIVE2D_INSTANCE__ = window.__JUNXUE_LIVE2D_INSTANCE__ || findReadyContainer();

            if (window.__JUNXUE_LIVE2D_INSTANCE__) {
                window.__JUNXUE_LIVE2D_READY__ = true;
                window.JunxueLive2DRenderInfo.isInitialized = true;
            }

            return;
        }
    }

    window.__JUNXUE_LIVE2D_INIT_STARTED__ = true;

    function setMessage(text, persist) {
        return;
    }

    function getLive2DDprCap() {
        const mode = window.JunxuePerformanceMode;

        if (mode && typeof mode.getLive2DDprCap === "function") {
            return mode.getLive2DDprCap();
        }

        return 1.5;
    }

    function hasContext(name) {
        try {
            return !!document.createElement("canvas").getContext(name, {
                alpha: true,
                antialias: true
            });
        } catch (error) {
            return false;
        }
    }

    function detectWebGLSupport() {
        const webgl2 = hasContext("webgl2");
        const webgl = webgl2 || hasContext("webgl") || hasContext("experimental-webgl");

        window.JunxueLive2DRenderInfo.webgl2Supported = webgl2;
        window.JunxueLive2DRenderInfo.webglSupported = webgl;
        return webgl;
    }

    function rectToObject(rect) {
        if (!rect) {
            return null;
        }

        return {
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            right: Math.round(rect.right),
            bottom: Math.round(rect.bottom),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
        };
    }

    function getPrimaryStage() {
        return document.querySelector("#oml2d-stage, .oml2d-stage");
    }

    function getPrimaryCanvas() {
        return document.querySelector("#oml2d-canvas, .oml2d-canvas, #oml2d-stage canvas, .oml2d-stage canvas");
    }

    function getHostCanvasFallback() {
        return config.hostMode ? document.querySelector("#live2d-widget canvas, canvas") : null;
    }

    function isStyleVisible(node) {
        if (!node || !window.getComputedStyle) {
            return false;
        }

        const style = window.getComputedStyle(node);
        return style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number(style.opacity || 1) > 0.01;
    }

    function hasViewportIntersection(rect) {
        return !!rect &&
            rect.right > 0 &&
            rect.bottom > 0 &&
            rect.left < window.innerWidth &&
            rect.top < window.innerHeight;
    }

    function isReasonableLive2DRect(rect) {
        return !!rect && rect.width >= 80 && rect.height >= 120;
    }

    function isReasonableHostRect(rect) {
        return !!rect && rect.width >= 40 && rect.height >= 40;
    }

    function getHostVisibleCandidate(nodes) {
        for (let index = 0; index < nodes.length; index += 1) {
            const node = nodes[index];
            const rect = node && node.getBoundingClientRect ? node.getBoundingClientRect() : null;

            if (node && isStyleVisible(node) && isReasonableHostRect(rect) && hasViewportIntersection(rect)) {
                return {
                    node: node,
                    rect: rect
                };
            }
        }

        return null;
    }

    function getLive2DVisibilitySnapshot() {
        const stage = getPrimaryStage();
        const canvas = getPrimaryCanvas() || getHostCanvasFallback();
        const primary = stage || canvas;
        const primaryRect = primary && primary.getBoundingClientRect ? primary.getBoundingClientRect() : null;
        const canvasRect = canvas && canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : null;
        let problem = "";

        if (config.hostMode) {
            const candidates = [stage, canvas].filter(Boolean);
            const candidate = getHostVisibleCandidate(candidates);

            if (window.JunxueLive2DRenderInfo && window.JunxueLive2DRenderInfo.contextLost) {
                problem = "webgl-context-lost";
            } else if (!candidates.length) {
                problem = "missing-stage-or-canvas";
            } else if (!candidate) {
                const hasVisibleStyle = candidates.some(isStyleVisible);
                const hasReasonableRect = candidates.some(function (node) {
                    return isReasonableHostRect(node && node.getBoundingClientRect ? node.getBoundingClientRect() : null);
                });
                const hasIntersection = candidates.some(function (node) {
                    return hasViewportIntersection(node && node.getBoundingClientRect ? node.getBoundingClientRect() : null);
                });

                if (!hasVisibleStyle) {
                    problem = "hidden-style";
                } else if (!hasReasonableRect) {
                    problem = "host-canvas-too-small";
                } else if (!hasIntersection) {
                    problem = "host-canvas-offscreen";
                } else {
                    problem = "host-canvas-not-visible";
                }
            }

            return {
                isVisible: !problem,
                problem: problem,
                stage: stage,
                canvas: canvas,
                primary: candidate ? candidate.node : primary,
                stageRect: rectToObject(primaryRect),
                canvasRect: rectToObject(canvasRect)
            };
        }

        if (window.JunxueLive2DRenderInfo && window.JunxueLive2DRenderInfo.contextLost) {
            problem = "webgl-context-lost";
        } else if (!primary) {
            problem = "missing-stage-or-canvas";
        } else if (!isStyleVisible(primary) || (canvas && !isStyleVisible(canvas))) {
            problem = "hidden-style";
        } else if (!isReasonableLive2DRect(primaryRect)) {
            problem = "stage-too-small";
        } else if (canvas && !isReasonableLive2DRect(canvasRect)) {
            problem = "canvas-too-small";
        } else if (!hasViewportIntersection(primaryRect)) {
            problem = "stage-offscreen";
        } else if (canvas && !hasViewportIntersection(canvasRect)) {
            problem = "canvas-offscreen";
        }

        return {
            isVisible: !problem,
            problem: problem,
            stage: stage,
            canvas: canvas,
            primary: primary,
            stageRect: rectToObject(primaryRect),
            canvasRect: rectToObject(canvasRect)
        };
    }

    function hasActuallyVisibleLive2D() {
        return getLive2DVisibilitySnapshot().isVisible;
    }

    function showWebGLWarning() {
        if (document.getElementById("live2d-webgl-warning")) {
            return;
        }

        const warning = document.createElement("div");

        warning.id = "live2d-webgl-warning";
        warning.textContent = webglWarningMessage;
        warning.style.cssText = [
            "position:fixed",
            "left:18px",
            "bottom:132px",
            "z-index:10011",
            "max-width:min(280px,calc(100vw - 36px))",
            "padding:9px 12px",
            "border:1px solid rgba(120,229,255,.48)",
            "border-radius:12px",
            "background:rgba(6,22,44,.82)",
            "color:rgba(234,252,255,.92)",
            "font:12px/1.5 Arial,sans-serif",
            "box-shadow:0 0 14px rgba(0,190,255,.16)",
            "pointer-events:none"
        ].join(";");
        document.body.appendChild(warning);
        window.setTimeout(function () {
            warning.remove();
        }, 6500);
    }

    function updateCanvasRenderInfo() {
        const snapshot = getLive2DVisibilitySnapshot();
        const canvas = snapshot.canvas || document.querySelector("#oml2d-canvas, .oml2d-canvas, #oml2d-stage canvas, canvas");
        const canvasCount = document.querySelectorAll("#oml2d-canvas, .oml2d-canvas, #oml2d-stage canvas").length;
        const stageCount = document.querySelectorAll("#oml2d-main, .oml2d-main, #oml2d-stage, .oml2d-stage").length;
        let contextName = "";

        if (canvas && canvas.getContext) {
            try {
                if (canvas.getContext("webgl2")) {
                    contextName = "webgl2";
                } else if (canvas.getContext("webgl")) {
                    contextName = "webgl";
                } else if (canvas.getContext("experimental-webgl")) {
                    contextName = "experimental-webgl";
                } else if (canvas.getContext("2d")) {
                    contextName = "2d";
                }
            } catch (error) {
                contextName = "";
            }
        }

        window.JunxueLive2DRenderInfo.usesCanvas = !!canvas;
        window.JunxueLive2DRenderInfo.canvasFound = !!canvas;
        window.JunxueLive2DRenderInfo.canvasCount = canvasCount;
        window.JunxueLive2DRenderInfo.estimatedInstanceCount = Math.max(canvasCount, stageCount);
        window.JunxueLive2DRenderInfo.isInitialized = !!(window.__JUNXUE_LIVE2D_READY__ || hasActuallyVisibleLive2D());
        window.JunxueLive2DRenderInfo.isActuallyVisible = snapshot.isVisible;
        window.JunxueLive2DRenderInfo.visibilityProblem = snapshot.problem;
        window.JunxueLive2DRenderInfo.stageRect = snapshot.stageRect;
        window.JunxueLive2DRenderInfo.canvasRect = snapshot.canvasRect;
        window.JunxueLive2DRenderInfo.actualContext = contextName;
        window.JunxueLive2DRenderInfo.dprCap = getLive2DDprCap();
        window.JunxueLive2DRenderInfo.dprInjected = runtimeInjectedDpr;
        window.JunxueLive2DRenderInfo.fallbackToOriginalResolution = runtimeUsedOriginal;
    }

    function hasExistingLive2DInstance() {
        return !!document.querySelector("#oml2d-canvas, .oml2d-canvas, #oml2d-stage, .oml2d-stage, #oml2d-main, .oml2d-main");
    }

    function removeDuplicateNodes(selector) {
        const nodes = Array.prototype.slice.call(document.querySelectorAll(selector));
        const visibleNode = getLive2DVisibilitySnapshot().primary;
        const keepNode = visibleNode && nodes.includes(visibleNode) ? visibleNode : nodes[0];

        if (nodes.length <= 1) {
            return;
        }

        nodes.forEach(function (node, index) {
            if (node === keepNode || (!keepNode && index === 0)) {
                return;
            }

            console.warn("Live2D duplicate runtime node removed.", {
                selector: selector,
                rect: node.getBoundingClientRect ? rectToObject(node.getBoundingClientRect()) : null
            });
            if (node && node.parentNode) {
                node.parentNode.removeChild(node);
            }
        });
    }

    function cleanupDuplicateLive2DNodes() {
        removeDuplicateNodes("#oml2d-main");
        removeDuplicateNodes(".oml2d-main");
        removeDuplicateNodes("#oml2d-stage");
        removeDuplicateNodes(".oml2d-stage");
        removeDuplicateNodes("#oml2d-canvas");
        removeDuplicateNodes(".oml2d-canvas");
        removeDuplicateNodes("#oml2d-tips");
    }

    function cleanupBrokenLive2DNodes(reason) {
        if (hasActuallyVisibleLive2D()) {
            return false;
        }

        const snapshot = getLive2DVisibilitySnapshot();
        const nodes = Array.prototype.slice.call(document.querySelectorAll("#oml2d-main, .oml2d-main, #oml2d-stage, .oml2d-stage, #oml2d-canvas, .oml2d-canvas"));

        if (!nodes.length) {
            return false;
        }

        console.warn("Live2D broken runtime nodes removed.", {
            reason: reason,
            problem: snapshot.problem,
            count: nodes.length,
            stageRect: snapshot.stageRect,
            canvasRect: snapshot.canvasRect
        });
        nodes.forEach(function (node) {
            if (node && node.parentNode) {
                node.parentNode.removeChild(node);
            }
        });
        return true;
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

    function postHostMessage(type, detail) {
        if (!config.hostMode || !window.parent || window.parent === window) {
            return;
        }

        try {
            window.parent.postMessage(Object.assign({
                type: type
            }, detail || {}), "*");
        } catch (error) {}
    }

    function findReadyContainer() {
        const snapshot = getLive2DVisibilitySnapshot();
        return snapshot.isVisible ? snapshot.primary : null;
    }

    function markLive2DReady() {
        if (!hasActuallyVisibleLive2D()) {
            updateCanvasRenderInfo();
            return false;
        }

        window.clearTimeout(loadTimer);
        if (readyObserver) {
            readyObserver.disconnect();
            readyObserver = null;
        }
        cleanupDuplicateLive2DNodes();
        window.__JUNXUE_LIVE2D_READY__ = true;
        window.__JUNXUE_LIVE2D_INSTANCE__ = findReadyContainer();
        updateCanvasRenderInfo();
        bindCanvasContextEvents();
        hideBootstrapWidget();
        postHostMessage("ganyu-host-ready", {
            renderInfo: window.JunxueLive2DRenderInfo
        });
        return true;
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
        postHostMessage("ganyu-host-error", {
            reason: reason,
            message: getFailureMessage(reason)
        });
        dispatchLoadFailure(reason);
        resetInitForRetry();

        window.setTimeout(function () {
            if (!findReadyContainer()) {
                hideBootstrapWidget();
            }
        }, 3600);
    }

    function getFailureMessage(reason) {
        if (/runtime/i.test(reason || "")) {
            return "Live2D runtime 加载失败，请点“再试一次”。";
        }

        if (/model|moc3|texture|resource/i.test(reason || "")) {
            return "甘雨模型资源加载失败，请点“再试一次”。";
        }

        if (/webgl/i.test(reason || "")) {
            return webglWarningMessage;
        }

        return "网络加载有点慢，甘雨暂时没赶到。可以点“再试一次”。";
    }

    function dispatchLoadFailure(reason) {
        try {
            window.dispatchEvent(new CustomEvent("junxue-live2d-load-failed", {
                detail: {
                    reason: reason,
                    message: getFailureMessage(reason)
                }
            }));
        } catch (error) {}
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
            showFallbackMessage(config.hostMode ? "host canvas not visible" : "timeout", {
                timeout: loadTimeoutMs
            });
        }, loadTimeoutMs);
    }

    function resetInitForRetry() {
        if (hasActuallyVisibleLive2D()) {
            return;
        }

        window.__JUNXUE_LIVE2D_INIT_STARTED__ = false;
        window.__JUNXUE_LIVE2D_READY__ = false;
        window.__JUNXUE_LIVE2D_INSTANCE__ = null;
        window.JunxueLive2DRenderInfo.isInitialized = false;
    }

    function dispatchRenderLost(message, hostMessageType) {
        postHostMessage(hostMessageType || "ganyu-host-context-lost", {
            message: message || "甘雨渲染暂时中断，点这里恢复。"
        });
        try {
            window.dispatchEvent(new CustomEvent("junxue-live2d-render-lost", {
                detail: {
                    message: message || "甘雨渲染暂时中断，点这里恢复。"
                }
            }));
        } catch (error) {}
    }

    function bindCanvasContextEvents() {
        const canvas = getPrimaryCanvas();

        if (!canvas || canvasContextListenerInstalled) {
            return;
        }

        canvasContextListenerInstalled = true;
        canvas.addEventListener("webglcontextlost", function (event) {
            event.preventDefault();
            window.JunxueLive2DRenderInfo.contextLost = true;
            window.JunxueLive2DRenderInfo.isActuallyVisible = false;
            window.JunxueLive2DRenderInfo.visibilityProblem = "webgl-context-lost";
            dispatchRenderLost("甘雨渲染暂时中断，点这里恢复。");
        }, false);
        canvas.addEventListener("webglcontextrestored", function () {
            window.JunxueLive2DRenderInfo.contextLost = false;
            updateCanvasRenderInfo();
            dispatchRenderLost("甘雨渲染已经恢复，可以点这里重新唤醒。", "ganyu-host-context-restored");
        }, false);
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

    function loadRuntimeText(src) {
        return fetch(src, {
            method: "GET",
            cache: "force-cache"
        }).then(function (response) {
            if (!response.ok) {
                throw new Error("runtime-fetch-failed: " + response.status);
            }

            return response.text();
        });
    }

    function loadScriptText(source, label) {
        return new Promise(function (resolve, reject) {
            const script = document.createElement("script");
            const blob = new Blob([source], {
                type: "application/javascript"
            });
            const url = URL.createObjectURL(blob);
            let done = false;
            const timer = window.setTimeout(function () {
                if (done) {
                    return;
                }

                done = true;
                script.remove();
                URL.revokeObjectURL(url);
                reject(new Error("script-timeout: " + label));
            }, scriptTimeoutMs);

            script.src = url;
            script.async = true;
            script.onload = function () {
                if (done) {
                    return;
                }

                done = true;
                window.clearTimeout(timer);
                URL.revokeObjectURL(url);
                resolve();
            };
            script.onerror = function () {
                if (done) {
                    return;
                }

                done = true;
                window.clearTimeout(timer);
                script.remove();
                URL.revokeObjectURL(url);
                reject(new Error("script-load-failed: " + label));
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

    async function loadRuntimeScriptChain(sources) {
        runtimeUsedOriginal = true;
        let lastError = null;

        for (let index = 0; index < sources.length; index += 1) {
            const source = sources[index];

            try {
                await loadScript(source.src);
                window.JunxueLive2DRenderInfo.runtimeSource = source.label;
                return;
            } catch (error) {
                lastError = error;
                console.error("Live2D runtime source failed", {
                    stage: "runtime",
                    source: source.label,
                    src: source.src,
                    error: error
                });
            }
        }

        throw lastError || new Error("runtime-load-failed");
    }

    async function loadOriginalRuntime() {
        await loadRuntimeScriptChain([
            { label: "local vendor", src: localRuntimeSrc },
            { label: "jsdelivr", src: jsdelivrRuntimeSrc },
            { label: "unpkg", src: unpkgRuntimeSrc }
        ]).catch(function (error) {
            console.error("Live2D runtime all sources failed", {
                stage: "runtime",
                error: error
            });
            throw error;
        });
    }

    async function loadDprInjectedRuntime(src, label) {
        const dprCap = Math.min(Math.max(1, Number(getLive2DDprCap()) || 1.5), 2);
        const source = await loadRuntimeText(src);

        if (source.indexOf(runtimeResolutionNeedle) === -1) {
            console.warn("Live2D runtime DPR injection skipped: resolution marker not found.", label);
            return false;
        }

        window.__JUNXUE_LIVE2D_DPR__ = dprCap;
        await loadScriptText(source.replace(
            runtimeResolutionNeedle,
            "resolution:(window.__JUNXUE_LIVE2D_DPR__||2),autoStart:!0,autoDensity:!0"
        ), "oh-my-live2d-dpr-" + label);
        runtimeInjectedDpr = true;
        runtimeUsedOriginal = false;
        window.JunxueLive2DRenderInfo.runtimeSource = label + " DPR injected";
        return true;
    }

    async function ensureRuntime() {
        if (window.OML2D && typeof window.OML2D.loadOml2d === "function") {
            return;
        }

        const injected = await loadDprInjectedRuntime(localRuntimeSrc, "local vendor").catch(function (error) {
            console.warn("Live2D local runtime DPR injection failed, using normal runtime chain.", error);
            return false;
        });

        if (injected) {
            return;
        }

        await loadOriginalRuntime();
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

        window.JunxueLive2DRenderInfo.dprCap = getLive2DDprCap();
        if (!detectWebGLSupport()) {
            showWebGLWarning();
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

        const oml2dOptions = {
            dockedPosition: dockedPosition,
            primaryColor: "#38d9ff",
            sayHello: config.sayHello !== false,
            mobileDisplay: true,
            menus: {
                disable: true
            },
            statusBar: {
                disable: !!config.disableStatusBar,
                loadingMessage: waitingMessage,
                loadSuccessMessage: "\u6211\u6765\u5566\uff0c\u8bf7\u591a\u5173\u7167\u3002",
                loadFailMessage: slowLoadMessage
            },
            models: [buildModelConfig(modelPath)],
            tips: {
                idleTips: {
                    message: []
                }
            }
        };

        function startOml2D(options) {
            if (window.__JUNXUE_LIVE2D_READY__ || (window.__JUNXUE_LIVE2D_INSTANCE__ && findReadyContainer())) {
                markLive2DReady();
                return;
            }

            window.OML2D.loadOml2d(options);
            window.setTimeout(function () {
                if (findReadyContainer()) {
                    markLive2DReady();
                }
            }, 1200);
        }

        function scheduleInjectedRuntimeFallback() {
            if (!runtimeInjectedDpr) {
                return;
            }

            window.setTimeout(function () {
                if (findReadyContainer() || fallbackBootStarted) {
                    if (findReadyContainer()) {
                        markLive2DReady();
                    }
                    return;
                }

                fallbackBootStarted = true;
                runtimeInjectedDpr = false;
                runtimeUsedOriginal = true;
                window.JunxueLive2DRenderInfo.fallbackToOriginalResolution = true;
                console.warn("Live2D DPR injected runtime did not become ready; falling back to original resolution runtime.");
                loadOriginalRuntime().then(function () {
                    startOml2D(oml2dOptions);
                }).catch(function (error) {
                    console.error("Live2D original runtime fallback failed", error);
                });
            }, loadTimeoutMs);
        }

        try {
            startOml2D(oml2dOptions);
            scheduleInjectedRuntimeFallback();
        } catch (error) {
            console.error("Live2D Cubism init failed", {
                stage: "Cubism Init Failed",
                error: error
            });
            showFallbackMessage("Cubism Init Failed", error);
        }
    }

    function getPixiTicker() {
        return window.PIXI && window.PIXI.Ticker && window.PIXI.Ticker.shared ? window.PIXI.Ticker.shared : null;
    }

    function handleVisibilityChange() {
        const ticker = getPixiTicker();

        if (!ticker) {
            return;
        }

        try {
            if (document.hidden) {
                if (ticker.started !== false) {
                    pausedPixiTicker = ticker;
                    ticker.stop();
                }
                return;
            }

            if (pausedPixiTicker === ticker) {
                ticker.start();
                pausedPixiTicker = null;
                updateCanvasRenderInfo();
                window.dispatchEvent(new CustomEvent("live2d-stage-position-changed"));
            }
        } catch (error) {
            console.warn("Live2D ticker visibility optimization skipped.", error);
        }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    boot();
})();
