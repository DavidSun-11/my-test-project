/* Lightweight Live2D loader: delays Ganyu until the page is usable. */
(function () {
    const WIDGET_SCRIPT = "live2d/live2d-widget.js?v=20260613-5";
    const INTERACTIONS_SCRIPT = "assets/live2d-interactions.js?v=20260614-music1";
    const DRAG_SCRIPT = "assets/live2d-drag.js?v=20260613-2";
    const FRAME_HOST_SRC = "live2d/ganyu-host.html?v=20260613-iframe1";
    const LOAD_TIMEOUT_MS = 10000;
    const AUTOLOAD_DELAY_MS = 1200;
    const currentScript = document.currentScript;
    const autoloadMode = currentScript ? currentScript.getAttribute("data-live2d-autoload") : "manual";
    const performanceMode = window.JunxuePerformanceMode;
    const isLowPerformance = !!(performanceMode && typeof performanceMode.isLow === "function" && performanceMode.isLow());
    const isHomeAutoload = autoloadMode === "home";
    const isMobileViewport = window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
    const isCoarsePointer = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    const isMobileUserAgent = /Android|iPhone|iPad|iPod|Mobile|HarmonyOS/i.test(navigator.userAgent || "");
    const useIframeMobile = !!(isMobileViewport || isCoarsePointer || isMobileUserAgent);
    const lowModeHint = "流畅模式下甘雨不会自动出现，点击这里显示甘雨。";
    const loaderState = window.JunxueLive2DLoader || {
        loading: false,
        loaded: false,
        failed: false,
        visible: true
    };

    loaderState.mode = useIframeMobile ? "iframe-mobile" : "inline";
    window.JunxueLive2DLoader = loaderState;

    function injectStyles() {
        if (document.getElementById("junxue-live2d-loader-style")) {
            return;
        }

        const style = document.createElement("style");
        style.id = "junxue-live2d-loader-style";
        style.textContent = [
            ".live2d-load-control{position:fixed;left:18px;bottom:86px;z-index:10010;display:grid;gap:7px;justify-items:start;font-family:Arial,sans-serif;}",
            ".live2d-load-control__button{min-height:34px;padding:0 14px;border:1px solid rgba(120,229,255,.58);border-radius:999px;background:rgba(6,22,44,.78);color:rgba(234,252,255,.94);font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 0 14px rgba(0,190,255,.18),inset 0 0 10px rgba(255,255,255,.06);backdrop-filter:blur(8px);transition:opacity .2s ease,transform .2s ease,box-shadow .2s ease;}",
            ".live2d-load-control__button:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 0 18px rgba(0,190,255,.28),inset 0 0 10px rgba(255,255,255,.08);}",
            ".live2d-load-control__button:disabled{cursor:wait;opacity:.72;}",
            ".live2d-load-control__status{max-width:min(240px,calc(100vw - 36px));padding:8px 10px;border:1px solid rgba(213,244,255,.5);border-radius:12px;background:rgba(6,22,44,.7);color:rgba(234,252,255,.86);font-size:12px;line-height:1.45;box-shadow:0 0 12px rgba(0,190,255,.14);backdrop-filter:blur(8px);}",
            ".live2d-load-control.is-hidden{display:none;}",
            "#ganyu-live2d-frame-shell{position:fixed;left:10px;bottom:max(86px,calc(env(safe-area-inset-bottom) + 84px));width:min(54vw,196px);height:min(58vh,360px);z-index:55;overflow:visible;background:transparent;border:0;pointer-events:none;}",
            "#ganyu-live2d-frame{display:block;width:100%;height:100%;border:0;background:transparent;overflow:visible;pointer-events:none;}",
            "#ganyu-live2d-frame-shell>.live2d-hit-area{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;border:0!important;border-radius:0!important;background:transparent!important;padding:0!important;margin:0!important;cursor:grab;touch-action:none;pointer-events:auto!important;z-index:56!important;}",
            "body.live2d-hidden #live2d-widget,body.live2d-hidden #oml2d-stage,body.live2d-hidden #oml2d-canvas,body.live2d-hidden #oml2d-tips,body.live2d-hidden #ganyu-live2d-frame-shell,body.live2d-hidden .live2d-hit-area{display:none!important;}",
            "html.performance-low .live2d-load-control__button,html.performance-low .live2d-load-control__status{backdrop-filter:none;box-shadow:inset 0 0 8px rgba(255,255,255,.05);}",
            "@media(max-width:768px){.live2d-load-control{left:12px;bottom:88px}.live2d-load-control__button{min-height:34px;padding:0 13px;font-size:12px}.live2d-load-control__status{max-width:min(78vw,240px);font-size:12px;}#ganyu-live2d-frame-shell{left:10px;bottom:max(88px,calc(env(safe-area-inset-bottom) + 86px));width:min(54vw,204px);height:min(60vh,376px);}}"
        ].join("");
        document.head.appendChild(style);
    }

    function getControl() {
        let control = document.querySelector(".live2d-load-control");

        if (control) {
            return control;
        }

        injectStyles();
        control = document.createElement("div");
        control.className = "live2d-load-control";
        control.innerHTML = [
            '<button class="live2d-load-control__button" type="button">显示甘雨</button>',
            '<div class="live2d-load-control__status" aria-live="polite" hidden></div>'
        ].join("");
        document.body.appendChild(control);
        control.querySelector("button").addEventListener("click", function () {
            if (loaderState.loaded) {
                if (!getLive2DVisibilitySnapshot().isVisible) {
                    recoverLive2D();
                    return;
                }

                setLive2DVisible(!loaderState.visible);
                return;
            }

            if (loaderState.failed) {
                resetFailedLoadState();
            }

            loadLive2D();
        });
        return control;
    }

    function setControlState(state, message) {
        const control = getControl();
        const button = control.querySelector("button");
        const status = control.querySelector(".live2d-load-control__status");

        if (state === "hidden") {
            control.classList.add("is-hidden");
            return;
        }

        control.classList.remove("is-hidden");
        status.hidden = !message;
        status.textContent = message || "";

        if (state === "loading") {
            button.disabled = true;
            button.textContent = "甘雨正在过来…";
        } else {
            button.disabled = false;
            button.textContent = state === "failed" ? "再试一次" : "显示甘雨";
        }

        if (state === "loaded") {
            const renderInfo = window.JunxueLive2DRenderInfo || {};
            button.disabled = false;
            button.textContent = loaderState.visible && (renderInfo.contextLost || !getLive2DVisibilitySnapshot().isVisible) ? "恢复甘雨" : loaderState.visible ? "隐藏甘雨" : "显示甘雨";
        }
    }

    function notifyLive2DVisible() {
        try {
            window.dispatchEvent(new CustomEvent("ganyu-live2d-visible"));
        } catch (error) {}
    }

    function setLive2DVisible(visible) {
        loaderState.visible = visible;
        document.body.classList.toggle("live2d-hidden", !visible);
        if (isIframeMobileMode()) {
            sendFrameMessage(visible ? "show" : "hide");
        }

        if (loaderState.loaded) {
            setControlState("loaded");

            if (visible) {
                window.setTimeout(notifyLive2DVisible, 0);
            }
        }
    }

    function isIframeMobileMode() {
        return loaderState.mode === "iframe-mobile";
    }

    function ensureWidget() {
        let widget = document.getElementById("live2d-widget");

        if (widget) {
            document.querySelectorAll("#live2d-widget").forEach(function (node) {
                if (node !== widget && node.parentNode) {
                    node.parentNode.removeChild(node);
                }
            });
            return widget;
        }

        widget = document.createElement("div");
        widget.className = "live2d-widget";
        widget.id = "live2d-widget";
        widget.setAttribute("aria-label", "Live2D 看板娘");
        widget.innerHTML = "";
        document.body.appendChild(widget);
        return widget;
    }

    function getFrameShell() {
        return document.getElementById("ganyu-live2d-frame-shell");
    }

    function getFrame() {
        return document.getElementById("ganyu-live2d-frame");
    }

    function ensureFrameShell() {
        let shell = getFrameShell();

        if (shell) {
            return shell;
        }

        injectStyles();
        shell = document.createElement("div");
        shell.id = "ganyu-live2d-frame-shell";
        shell.setAttribute("aria-label", "甘雨 Live2D");

        const frame = document.createElement("iframe");
        frame.id = "ganyu-live2d-frame";
        frame.title = "甘雨 Live2D";
        frame.setAttribute("allowtransparency", "true");
        frame.setAttribute("scrolling", "no");

        const hitArea = document.createElement("button");
        hitArea.type = "button";
        hitArea.className = "live2d-hit-area";
        hitArea.setAttribute("aria-label", "打开甘雨菜单");

        shell.append(frame, hitArea);
        document.body.appendChild(shell);
        return shell;
    }

    function setFrameSrc(forceFresh) {
        const frame = getFrame();

        if (!frame) {
            return;
        }

        const separator = FRAME_HOST_SRC.indexOf("?") === -1 ? "?" : "&";
        frame.src = forceFresh ? FRAME_HOST_SRC + separator + "retry=" + Date.now() : FRAME_HOST_SRC;
    }

    function sendFrameMessage(type, detail) {
        const frame = getFrame();

        if (!frame || !frame.contentWindow) {
            return;
        }

        try {
            frame.contentWindow.postMessage(Object.assign({ type: type }, detail || {}), "*");
        } catch (error) {}
    }

    function scriptExists(src) {
        return Array.prototype.some.call(document.scripts, function (script) {
            return script.getAttribute("src") === src;
        });
    }

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            if (scriptExists(src)) {
                resolve();
                return;
            }

            const script = document.createElement("script");
            script.src = src;
            script.async = false;
            script.onload = resolve;
            script.onerror = function () {
                script.remove();
                reject(new Error("script-load-failed: " + src));
            };
            document.body.appendChild(script);
        });
    }

    function findLive2DStage() {
        return document.querySelector("#oml2d-stage, .oml2d-stage") ||
            document.querySelector("#oml2d-canvas, .oml2d-canvas");
    }

    function getLive2DCanvas() {
        return document.querySelector("#oml2d-canvas, .oml2d-canvas, #oml2d-stage canvas, .oml2d-stage canvas");
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

    function getLive2DVisibilitySnapshot() {
        if (isIframeMobileMode()) {
            return getFrameVisibilitySnapshot();
        }

        const widget = document.getElementById("live2d-widget");
        const stage = document.querySelector("#oml2d-stage, .oml2d-stage");
        const canvas = getLive2DCanvas();
        const primary = stage || canvas;
        const primaryRect = primary && primary.getBoundingClientRect ? primary.getBoundingClientRect() : null;
        const canvasRect = canvas && canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : null;
        let problem = "";

        const renderInfo = window.JunxueLive2DRenderInfo || {};

        if (renderInfo.contextLost) {
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
            mode: "inline",
            isVisible: !problem,
            problem: problem,
            widgetFound: !!widget,
            stageFound: !!stage,
            canvasFound: !!canvas,
            stageRect: rectToObject(primaryRect),
            canvasRect: rectToObject(canvasRect)
        };
    }

    function getFrameVisibilitySnapshot() {
        const shell = getFrameShell();
        const frame = getFrame();
        const shellRect = shell && shell.getBoundingClientRect ? shell.getBoundingClientRect() : null;
        const frameRect = frame && frame.getBoundingClientRect ? frame.getBoundingClientRect() : null;
        const renderInfo = window.JunxueLive2DRenderInfo || {};
        let problem = "";

        if (renderInfo.contextLost) {
            problem = "webgl-context-lost";
        } else if (!shell || !frame) {
            problem = "missing-frame";
        } else if (!isStyleVisible(shell) || !isStyleVisible(frame)) {
            problem = "hidden-frame";
        } else if (!isReasonableLive2DRect(shellRect) || !isReasonableLive2DRect(frameRect)) {
            problem = "frame-too-small";
        } else if (!hasViewportIntersection(shellRect)) {
            problem = "frame-offscreen";
        } else if (!loaderState.frameReady) {
            problem = "frame-not-ready";
        }

        return {
            mode: "iframe-mobile",
            isVisible: !problem,
            problem: problem,
            widgetFound: !!shell,
            frameFound: !!frame,
            stageFound: false,
            canvasFound: false,
            stageRect: rectToObject(shellRect),
            canvasRect: rectToObject(frameRect),
            frameRect: rectToObject(shellRect)
        };
    }

    function hasActuallyVisibleLive2D() {
        return getLive2DVisibilitySnapshot().isVisible;
    }

    function removeScriptBySrc(src) {
        Array.prototype.slice.call(document.scripts).forEach(function (script) {
            if (script.getAttribute("src") === src && script.parentNode) {
                script.parentNode.removeChild(script);
            }
        });
    }

    function resetFailedLoadState() {
        if (hasActuallyVisibleLive2D()) {
            return;
        }

        window.clearTimeout(loaderState.timeout);
        loaderState.loading = false;
        loaderState.loaded = false;
        loaderState.failed = false;
        loaderState.promise = null;
        loaderState.frameReady = false;
        loaderState.frameError = false;
        loaderState.frameResolve = null;

        if (isIframeMobileMode()) {
            loaderState.retryCount = (loaderState.retryCount || 0) + 1;
            removeFrameShell();
        } else {
            window.__JUNXUE_LIVE2D_INIT_STARTED__ = false;
            window.__JUNXUE_LIVE2D_READY__ = false;
            window.__JUNXUE_LIVE2D_INSTANCE__ = null;
            removeScriptBySrc(WIDGET_SCRIPT);
        }

        window.JunxueLive2DRenderInfo = window.JunxueLive2DRenderInfo || {};
        window.JunxueLive2DRenderInfo.contextLost = false;
    }

    function updateRenderInfo() {
        const snapshot = getLive2DVisibilitySnapshot();

        window.JunxueLive2DRenderInfo = window.JunxueLive2DRenderInfo || {};
        window.JunxueLive2DRenderInfo.mode = loaderState.mode;
        window.JunxueLive2DRenderInfo.contextLost = !!window.JunxueLive2DRenderInfo.contextLost;
        window.JunxueLive2DRenderInfo.isActuallyVisible = snapshot.isVisible;
        window.JunxueLive2DRenderInfo.visibilityProblem = snapshot.problem;
        window.JunxueLive2DRenderInfo.stageRect = snapshot.stageRect;
        window.JunxueLive2DRenderInfo.canvasRect = snapshot.canvasRect;

        if (isIframeMobileMode()) {
            window.JunxueLive2DRenderInfo.canvasCount = document.querySelectorAll("#oml2d-canvas, .oml2d-canvas, #oml2d-stage canvas").length;
            window.JunxueLive2DRenderInfo.estimatedInstanceCount = document.querySelectorAll("#ganyu-live2d-frame").length;
            window.JunxueLive2DRenderInfo.isInitialized = !!loaderState.frameReady;
            window.JunxueLive2DRenderInfo.frameReady = !!loaderState.frameReady;
            window.JunxueLive2DRenderInfo.frameError = !!loaderState.frameError;
            window.JunxueLive2DRenderInfo.frameRect = snapshot.frameRect || snapshot.stageRect;
            window.JunxueLive2DRenderInfo.retryCount = loaderState.retryCount || 0;
            window.JunxueLive2DRenderInfo.lastError = loaderState.lastError || "";
            return;
        }

        window.JunxueLive2DRenderInfo.canvasCount = document.querySelectorAll("#oml2d-canvas, .oml2d-canvas, #oml2d-stage canvas").length;
        window.JunxueLive2DRenderInfo.estimatedInstanceCount = Math.max(
            window.JunxueLive2DRenderInfo.canvasCount,
            document.querySelectorAll("#oml2d-main, .oml2d-main, #oml2d-stage, .oml2d-stage").length
        );
        window.JunxueLive2DRenderInfo.isInitialized = !!(window.__JUNXUE_LIVE2D_READY__ || hasActuallyVisibleLive2D());
        window.JunxueLive2DRenderInfo.widgetFound = snapshot.widgetFound;
    }

    function markLoadedFromExisting() {
        if (!hasActuallyVisibleLive2D()) {
            updateRenderInfo();
            return false;
        }

        window.clearTimeout(loaderState.timeout);
        window.__JUNXUE_LIVE2D_INIT_STARTED__ = !isIframeMobileMode();
        window.__JUNXUE_LIVE2D_READY__ = !isIframeMobileMode();
        window.__JUNXUE_LIVE2D_INSTANCE__ = isIframeMobileMode() ? null : (window.__JUNXUE_LIVE2D_INSTANCE__ || findLive2DStage());
        loaderState.loaded = true;
        loaderState.loading = false;
        loaderState.failed = false;
        updateRenderInfo();
        setLive2DVisible(true);
        return true;
    }

    function loadSupportScripts() {
        return loadScript(INTERACTIONS_SCRIPT).then(function () {
            return loadScript(DRAG_SCRIPT);
        });
    }

    function startLoadTimeout() {
        window.clearTimeout(loaderState.timeout);
        loaderState.timeout = window.setTimeout(function () {
            if (hasActuallyVisibleLive2D() && markLoadedFromExisting()) {
                return;
            }

            loaderState.failed = true;
            loaderState.loading = false;
            loaderState.promise = null;
            loaderState.frameError = isIframeMobileMode();
            loaderState.lastError = isIframeMobileMode() ? "iframe-timeout" : "inline-timeout";
            updateRenderInfo();
            setControlState("failed", isIframeMobileMode() ? "甘雨加载有点慢，点这里再试一次。" : "网络加载有点慢，甘雨暂时没赶到。可以点“再试一次”。");
        }, LOAD_TIMEOUT_MS);
    }

    function finishIfReady() {
        if (hasActuallyVisibleLive2D()) {
            markLoadedFromExisting();
            return;
        }

        updateRenderInfo();
        if (loaderState.loaded) {
            setControlState("loaded");
        }
    }

    window.addEventListener("message", function (event) {
        const frame = getFrame();
        const data = event.data || {};

        if (!isIframeMobileMode() || !frame || event.source !== frame.contentWindow || typeof data.type !== "string") {
            return;
        }

        if (data.type === "ganyu-host-ready") {
            window.clearTimeout(loaderState.timeout);
            loaderState.frameReady = true;
            loaderState.frameError = false;
            loaderState.loading = false;
            loaderState.loaded = true;
            loaderState.failed = false;
            loaderState.visible = true;
            loaderState.lastError = "";
            window.JunxueLive2DRenderInfo = Object.assign(window.JunxueLive2DRenderInfo || {}, data.renderInfo || {}, {
                mode: "iframe-mobile",
                contextLost: false
            });
            updateRenderInfo();
            setLive2DVisible(true);
            loadSupportScripts();

            if (typeof loaderState.frameResolve === "function") {
                loaderState.frameResolve();
                loaderState.frameResolve = null;
            }
            return;
        }

        if (data.type === "ganyu-host-error") {
            window.clearTimeout(loaderState.timeout);
            loaderState.frameError = true;
            loaderState.loading = false;
            loaderState.loaded = false;
            loaderState.failed = true;
            loaderState.promise = null;
            loaderState.lastError = data.message || data.reason || "ganyu-host-error";
            updateRenderInfo();
            setControlState("failed", "甘雨加载失败了，点这里再试一次。");
            return;
        }

        if (data.type === "ganyu-host-context-lost") {
            loaderState.frameError = true;
            loaderState.loading = false;
            loaderState.loaded = true;
            loaderState.failed = true;
            loaderState.visible = true;
            loaderState.lastError = data.message || "webgl-context-lost";
            window.JunxueLive2DRenderInfo = window.JunxueLive2DRenderInfo || {};
            window.JunxueLive2DRenderInfo.contextLost = true;
            updateRenderInfo();
            document.body.classList.remove("live2d-hidden");
            setControlState("loaded", "甘雨渲染暂时中断，点这里恢复。");
            return;
        }

        if (data.type === "ganyu-host-context-restored") {
            loaderState.frameError = false;
            loaderState.lastError = "";
            window.JunxueLive2DRenderInfo = window.JunxueLive2DRenderInfo || {};
            window.JunxueLive2DRenderInfo.contextLost = false;
            updateRenderInfo();
            setControlState(loaderState.frameReady ? "loaded" : "failed");
        }
    });

    window.addEventListener("junxue-live2d-load-failed", function (event) {
        if (isIframeMobileMode()) {
            return;
        }

        if (hasActuallyVisibleLive2D()) {
            markLoadedFromExisting();
            return;
        }

        window.clearTimeout(loaderState.timeout);
        loaderState.failed = true;
        loaderState.loading = false;
        loaderState.promise = null;
        setControlState("failed", event.detail && event.detail.message ? event.detail.message : "甘雨加载有点慢，请点“再试一次”。");
    });

    window.addEventListener("junxue-live2d-render-lost", function (event) {
        if (isIframeMobileMode()) {
            return;
        }

        loaderState.failed = true;
        loaderState.loading = false;
        loaderState.loaded = true;
        loaderState.visible = true;
        updateRenderInfo();
        document.body.classList.remove("live2d-hidden");
        setControlState("loaded", event.detail && event.detail.message ? event.detail.message : "甘雨渲染暂时中断，点这里恢复。");
    });

    function warnAndRemoveBrokenNodes() {
        if (hasActuallyVisibleLive2D()) {
            return false;
        }

        const nodes = Array.prototype.slice.call(document.querySelectorAll("#oml2d-stage, .oml2d-stage, #oml2d-canvas, .oml2d-canvas, #oml2d-main, .oml2d-main, #live2d-widget"));
        const snapshot = getLive2DVisibilitySnapshot();

        if (!nodes.length) {
            return false;
        }

        console.warn("Live2D removing broken runtime nodes before recovery.", {
            reason: snapshot.problem,
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

    function removeInlineRuntimeNodes() {
        if (!isIframeMobileMode()) {
            return;
        }

        document.querySelectorAll("#live2d-widget, #oml2d-stage, .oml2d-stage, #oml2d-canvas, .oml2d-canvas, #oml2d-main, .oml2d-main, #oml2d-tips").forEach(function (node) {
            if (node && node.parentNode) {
                node.parentNode.removeChild(node);
            }
        });
        window.__JUNXUE_LIVE2D_INIT_STARTED__ = false;
        window.__JUNXUE_LIVE2D_READY__ = false;
        window.__JUNXUE_LIVE2D_INSTANCE__ = null;
    }

    function removeFrameShell() {
        const shell = getFrameShell();

        if (shell && shell.parentNode) {
            shell.parentNode.removeChild(shell);
        }
    }

    function recoverLive2D() {
        if (isIframeMobileMode()) {
            recoverFrameLive2D();
            return;
        }

        setControlState("loading", "正在恢复甘雨的位置和渲染状态……");

        if (window.JunxueLive2DDrag && typeof window.JunxueLive2DDrag.scheduleSync === "function") {
            window.JunxueLive2DDrag.scheduleSync();
        }

        window.setTimeout(function () {
            if (hasActuallyVisibleLive2D() && markLoadedFromExisting()) {
                return;
            }

            warnAndRemoveBrokenNodes();
            window.clearTimeout(loaderState.timeout);
            loaderState.loading = false;
            loaderState.loaded = false;
            loaderState.failed = false;
            loaderState.promise = null;
            window.JunxueLive2DRenderInfo = window.JunxueLive2DRenderInfo || {};
            window.JunxueLive2DRenderInfo.contextLost = false;
            window.__JUNXUE_LIVE2D_INIT_STARTED__ = false;
            window.__JUNXUE_LIVE2D_READY__ = false;
            window.__JUNXUE_LIVE2D_INSTANCE__ = null;
            removeScriptBySrc(WIDGET_SCRIPT);
            loadLive2D();
        }, 180);
    }

    function recoverFrameLive2D() {
        setControlState("loading", "正在恢复甘雨……");
        sendFrameMessage("recover");
        window.setTimeout(function () {
            if (hasActuallyVisibleLive2D() && markLoadedFromExisting()) {
                return;
            }

            window.clearTimeout(loaderState.timeout);
            loaderState.loading = false;
            loaderState.loaded = false;
            loaderState.failed = false;
            loaderState.promise = null;
            loaderState.frameReady = false;
            loaderState.frameError = false;
            loaderState.frameResolve = null;
            loaderState.retryCount = (loaderState.retryCount || 0) + 1;
            loaderState.lastError = "";
            window.JunxueLive2DRenderInfo = window.JunxueLive2DRenderInfo || {};
            window.JunxueLive2DRenderInfo.contextLost = false;
            removeFrameShell();
            loadLive2D();
        }, 160);
    }

    function loadFrameLive2D() {
        if (loaderState.loading) {
            return loaderState.promise || Promise.resolve();
        }

        if (loaderState.loaded && hasActuallyVisibleLive2D()) {
            setLive2DVisible(true);
            return loadSupportScripts();
        }

        removeInlineRuntimeNodes();
        ensureFrameShell();
        setFrameSrc(!!loaderState.retryCount);

        loaderState.loading = true;
        loaderState.loaded = false;
        loaderState.failed = false;
        loaderState.frameReady = false;
        loaderState.frameError = false;
        loaderState.visible = true;
        setLive2DVisible(true);
        setControlState("loading");
        updateRenderInfo();
        startLoadTimeout();

        loaderState.promise = new Promise(function (resolve) {
            loaderState.frameResolve = resolve;
        });
        return loaderState.promise;
    }

    function loadLive2D() {
        if (isIframeMobileMode()) {
            return loadFrameLive2D();
        }

        if (loaderState.loading) {
            return loaderState.promise || Promise.resolve();
        }

        if (loaderState.loaded || window.__JUNXUE_LIVE2D_READY__ || findLive2DStage()) {
            setLive2DVisible(true);
            if (hasActuallyVisibleLive2D()) {
                markLoadedFromExisting();
            } else {
                recoverLive2D();
            }
            return loadSupportScripts();
        }

        loaderState.loading = true;
        loaderState.failed = false;
        ensureWidget();
        setLive2DVisible(true);
        setControlState("loading");
        startLoadTimeout();

        loaderState.promise = loadScript(WIDGET_SCRIPT)
            .then(loadSupportScripts)
            .then(function () {
                window.setTimeout(finishIfReady, 1200);
                window.setTimeout(finishIfReady, 3000);
            })
            .catch(function () {
                loaderState.failed = true;
                loaderState.loading = false;
                loaderState.promise = null;
                setControlState("failed", "Live2D 脚本加载失败，请点“再试一次”。");
            });

        return loaderState.promise;
    }

    function init() {
        getControl();
        updateRenderInfo();

        if (isHomeAutoload && !isLowPerformance) {
            setControlState("hidden");
            window.setTimeout(loadLive2D, AUTOLOAD_DELAY_MS);
        } else {
            setControlState("ready", isLowPerformance ? lowModeHint : "");
        }
    }

    loaderState.load = loadLive2D;
    loaderState.recover = recoverLive2D;
    loaderState.isIframeMobile = isIframeMobileMode;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
