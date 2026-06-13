/* Lightweight Live2D loader: delays Ganyu until the page is usable. */
(function () {
    const WIDGET_SCRIPT = "live2d/live2d-widget.js?v=20260613-4";
    const INTERACTIONS_SCRIPT = "assets/live2d-interactions.js?v=20260613-3";
    const DRAG_SCRIPT = "assets/live2d-drag.js?v=20260613-1";
    const LOAD_TIMEOUT_MS = 10000;
    const AUTOLOAD_DELAY_MS = 1200;
    const currentScript = document.currentScript;
    const autoloadMode = currentScript ? currentScript.getAttribute("data-live2d-autoload") : "manual";
    const performanceMode = window.JunxuePerformanceMode;
    const isLowPerformance = !!(performanceMode && typeof performanceMode.isLow === "function" && performanceMode.isLow());
    const isHomeAutoload = autoloadMode === "home";
    const lowModeHint = "流畅模式下甘雨不会自动出现，点击这里显示甘雨。";
    const loaderState = window.JunxueLive2DLoader || {
        loading: false,
        loaded: false,
        failed: false,
        visible: true
    };

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
            "body.live2d-hidden #live2d-widget,body.live2d-hidden #oml2d-stage,body.live2d-hidden #oml2d-canvas,body.live2d-hidden #oml2d-tips,body.live2d-hidden .live2d-hit-area{display:none!important;}",
            "html.performance-low .live2d-load-control__button,html.performance-low .live2d-load-control__status{backdrop-filter:none;box-shadow:inset 0 0 8px rgba(255,255,255,.05);}",
            "@media(max-width:768px){.live2d-load-control{left:12px;bottom:88px}.live2d-load-control__button{min-height:34px;padding:0 13px;font-size:12px}.live2d-load-control__status{max-width:min(78vw,240px);font-size:12px;}}"
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
        if (loaderState.loaded) {
            setControlState("loaded");

            if (visible) {
                window.setTimeout(notifyLive2DVisible, 0);
            }
        }
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
            isVisible: !problem,
            problem: problem,
            widgetFound: !!widget,
            stageFound: !!stage,
            canvasFound: !!canvas,
            stageRect: rectToObject(primaryRect),
            canvasRect: rectToObject(canvasRect)
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
        window.__JUNXUE_LIVE2D_INIT_STARTED__ = false;
        window.__JUNXUE_LIVE2D_READY__ = false;
        window.__JUNXUE_LIVE2D_INSTANCE__ = null;
        window.JunxueLive2DRenderInfo = window.JunxueLive2DRenderInfo || {};
        window.JunxueLive2DRenderInfo.contextLost = false;
        removeScriptBySrc(WIDGET_SCRIPT);
    }

    function updateRenderInfo() {
        const snapshot = getLive2DVisibilitySnapshot();
        window.JunxueLive2DRenderInfo = window.JunxueLive2DRenderInfo || {};
        window.JunxueLive2DRenderInfo.canvasCount = document.querySelectorAll("#oml2d-canvas, .oml2d-canvas, #oml2d-stage canvas").length;
        window.JunxueLive2DRenderInfo.estimatedInstanceCount = Math.max(
            window.JunxueLive2DRenderInfo.canvasCount,
            document.querySelectorAll("#oml2d-main, .oml2d-main, #oml2d-stage, .oml2d-stage").length
        );
        window.JunxueLive2DRenderInfo.isInitialized = !!(window.__JUNXUE_LIVE2D_READY__ || hasActuallyVisibleLive2D());
        window.JunxueLive2DRenderInfo.isActuallyVisible = snapshot.isVisible;
        window.JunxueLive2DRenderInfo.visibilityProblem = snapshot.problem;
        window.JunxueLive2DRenderInfo.widgetFound = snapshot.widgetFound;
        window.JunxueLive2DRenderInfo.stageRect = snapshot.stageRect;
        window.JunxueLive2DRenderInfo.canvasRect = snapshot.canvasRect;
    }

    function markLoadedFromExisting() {
        if (!hasActuallyVisibleLive2D()) {
            updateRenderInfo();
            return false;
        }

        window.clearTimeout(loaderState.timeout);
        window.__JUNXUE_LIVE2D_INIT_STARTED__ = true;
        window.__JUNXUE_LIVE2D_READY__ = true;
        window.__JUNXUE_LIVE2D_INSTANCE__ = window.__JUNXUE_LIVE2D_INSTANCE__ || findLive2DStage();
        loaderState.loaded = true;
        loaderState.loading = false;
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
            setControlState("failed", "网络加载有点慢，甘雨暂时没赶到。可以点“再试一次”。");
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

    window.addEventListener("junxue-live2d-load-failed", function (event) {
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

        const nodes = Array.prototype.slice.call(document.querySelectorAll("#oml2d-stage, .oml2d-stage, #oml2d-canvas, .oml2d-canvas, #oml2d-main, .oml2d-main"));
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

    function recoverLive2D() {
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

    function loadLive2D() {
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

        if (isHomeAutoload && !isLowPerformance) {
            setControlState("hidden");
            window.setTimeout(loadLive2D, AUTOLOAD_DELAY_MS);
        } else {
            setControlState("ready", isLowPerformance ? lowModeHint : "");
        }
    }

    loaderState.load = loadLive2D;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
