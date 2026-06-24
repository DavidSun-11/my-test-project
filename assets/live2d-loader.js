/* Lightweight Live2D loader: desktop keeps dynamic Ganyu, mobile uses a stable static fallback first. */
(function () {
    const WIDGET_SCRIPT = "live2d/live2d-widget.js?v=20260613-5";
    const INTERACTIONS_SCRIPT = "assets/live2d-interactions.js?v=20260624-boss-profile-display1";
    const DRAG_SCRIPT = "assets/live2d-drag.js?v=20260613-2";
    const FRAME_HOST_SRC = "live2d/ganyu-host.html?v=20260613-iframe1";
    const STATIC_WEBP = "assets/images/price-ganyu-showcase.webp";
    const STATIC_PNG = "assets/images/price-ganyu-showcase.png";
    const LOAD_TIMEOUT_MS = 10000;
    const AUTOLOAD_DELAY_MS = 1200;
    const STORAGE_KEY = "junxue-live2d-stage-position";
    const LEGACY_STORAGE_KEY = "ganyuLive2DPosition";
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
        visible: false
    };

    loaderState.mode = useIframeMobile ? "mobile-static" : "inline";
    loaderState.dynamicMode = useIframeMobile ? "iframe-mobile" : "inline";
    loaderState.staticVisible = false;
    loaderState.dynamicAttempted = false;
    loaderState.dynamicReady = false;
    loaderState.videoPausedForLive2D = false;
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
            ".ganyu-static-card{position:fixed;left:12px;bottom:max(132px,calc(env(safe-area-inset-bottom) + 130px));z-index:57;width:clamp(154px,48vw,210px);max-width:54vw;max-height:36vh;padding:8px;border:1px solid rgba(196,238,255,.72);border-radius:18px;background:linear-gradient(145deg,rgba(13,38,78,.78),rgba(44,112,172,.52) 52%,rgba(154,118,222,.42));box-shadow:0 0 22px rgba(90,213,255,.28),0 16px 34px rgba(2,10,30,.26),inset 0 0 16px rgba(255,255,255,.12);backdrop-filter:blur(12px);font-family:Arial,sans-serif;color:rgba(239,252,255,.96);overflow:hidden;pointer-events:auto;cursor:pointer;transition:transform .16s ease,box-shadow .16s ease;}",
            ".ganyu-static-card:active{transform:scale(.985);box-shadow:0 0 28px rgba(120,229,255,.34),0 12px 26px rgba(2,10,30,.24),inset 0 0 18px rgba(255,255,255,.14);}",
            ".ganyu-static-card.is-hidden{display:none!important;}",
            ".ganyu-static-card.is-dynamic-ready .ganyu-static-card__visual{opacity:.28;filter:saturate(.75) blur(.2px);}",
            ".ganyu-static-card__visual{position:relative;display:grid;place-items:center;min-height:104px;max-height:22vh;border-radius:14px;overflow:hidden;background:radial-gradient(circle at 50% 20%,rgba(220,250,255,.24),rgba(75,160,226,.16) 50%,rgba(8,26,58,.62));}",
            ".ganyu-static-card__visual picture,.ganyu-static-card__visual img{display:block;width:100%;height:100%;min-height:104px;max-height:22vh;pointer-events:none;}",
            ".ganyu-static-card__visual img{object-fit:cover;object-position:center 36%;border-radius:14px;pointer-events:none;}",
            ".ganyu-static-card__fallback{display:none;place-items:center;min-height:104px;padding:12px;text-align:center;font-size:13px;line-height:1.45;color:rgba(238,252,255,.9);}",
            ".ganyu-static-card.is-image-failed .ganyu-static-card__fallback{display:grid;}",
            ".ganyu-static-card.is-image-failed .ganyu-static-card__visual picture{display:none;}",
            ".ganyu-static-card__body{display:grid;gap:5px;padding:8px 4px 2px;text-align:center;}",
            ".ganyu-static-card__title{font-size:13px;font-weight:800;}",
            ".ganyu-static-card__hint,.ganyu-static-card__status{font-size:11px;line-height:1.35;color:rgba(218,242,255,.78);}",
            ".ganyu-static-card__status:empty{display:none;}",
            ".ganyu-static-card__dynamic{justify-self:center;min-height:28px;margin-top:2px;padding:0 10px;border:1px solid rgba(184,235,255,.66);border-radius:999px;background:linear-gradient(135deg,rgba(68,202,255,.48),rgba(177,122,255,.38));color:rgba(247,253,255,.96);font-size:11px;font-weight:800;white-space:nowrap;cursor:pointer;box-shadow:0 0 12px rgba(109,217,255,.18);pointer-events:auto;}",
            ".ganyu-static-card__dynamic:disabled{cursor:wait;opacity:.7;}",
            "#ganyu-live2d-frame-shell{position:fixed;left:10px;bottom:max(86px,calc(env(safe-area-inset-bottom) + 84px));width:min(54vw,196px);height:min(58vh,360px);z-index:58;overflow:visible;background:transparent;border:0;pointer-events:none;}",
            "#ganyu-live2d-frame{display:block;width:100%;height:100%;border:0;background:transparent;overflow:visible;pointer-events:none;}",
            "#ganyu-live2d-frame-shell>.live2d-hit-area{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;border:0!important;border-radius:0!important;background:transparent!important;padding:0!important;margin:0!important;cursor:grab;touch-action:none;pointer-events:auto!important;z-index:59!important;}",
            "body.live2d-hidden #live2d-widget,body.live2d-hidden #oml2d-stage,body.live2d-hidden #oml2d-canvas,body.live2d-hidden #oml2d-tips,body.live2d-hidden #ganyu-live2d-frame-shell,body.live2d-hidden .live2d-hit-area,body.live2d-hidden .ganyu-static-card{display:none!important;}",
            "html.performance-low .live2d-load-control__button,html.performance-low .live2d-load-control__status,html.performance-low .ganyu-static-card{backdrop-filter:none;box-shadow:inset 0 0 8px rgba(255,255,255,.05);}",
            "@media(max-width:768px){.live2d-load-control{left:12px;bottom:88px}.live2d-load-control__button{min-height:34px;padding:0 13px;font-size:12px}.live2d-load-control__status{max-width:min(78vw,240px);font-size:12px;}#ganyu-live2d-frame-shell{left:10px;bottom:max(88px,calc(env(safe-area-inset-bottom) + 86px));width:min(54vw,204px);height:min(60vh,376px);}.ganyu-static-card{left:12px;bottom:max(132px,calc(env(safe-area-inset-bottom) + 130px));width:clamp(154px,48vw,210px);}}"
        ].join("");
        document.head.appendChild(style);
    }

    function isIframeMobileMode() {
        return useIframeMobile;
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
        control.querySelector("button").addEventListener("click", handleMainButtonClick);
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
            button.textContent = "甘雨加载中";
            return;
        }

        button.disabled = false;

        if (isIframeMobileMode()) {
            button.textContent = hasAnyVisibleGanyu() ? "隐藏甘雨" : "显示甘雨";
            return;
        }

        if (state === "loaded") {
            const renderInfo = window.JunxueLive2DRenderInfo || {};
            button.textContent = loaderState.visible && (renderInfo.contextLost || !getLive2DVisibilitySnapshot().isVisible) ? "恢复甘雨" : loaderState.visible ? "隐藏甘雨" : "显示甘雨";
            return;
        }

        button.textContent = state === "failed" ? "再试一次" : "显示甘雨";
    }

    function handleMainButtonClick() {
        if (isIframeMobileMode()) {
            if (loaderState.loading) {
                return;
            }

            if (hasAnyVisibleGanyu()) {
                setMobileGanyuVisible(false);
                return;
            }

            showStaticFallback();
            return;
        }

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

        if (loaderState.loaded || isIframeMobileMode()) {
            setControlState("loaded");

            if (visible) {
                window.setTimeout(notifyLive2DVisible, 0);
            }
        }
    }

    function setMobileGanyuVisible(visible) {
        loaderState.visible = visible;
        document.body.classList.toggle("live2d-hidden", !visible);

        const card = getStaticCard();
        if (card) {
            card.classList.toggle("is-hidden", !visible);
            loaderState.staticVisible = visible;
        }

        if (getFrameShell()) {
            sendFrameMessage(visible ? "show" : "hide");
        }

        updateRenderInfo();
        setControlState("loaded");
        if (visible) {
            window.setTimeout(notifyLive2DVisible, 0);
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

    function getFrameShell() {
        return document.getElementById("ganyu-live2d-frame-shell");
    }

    function getFrame() {
        return document.getElementById("ganyu-live2d-frame");
    }

    function getStaticCard() {
        return document.querySelector(".ganyu-static-card");
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
        applySavedPosition(shell);
        return shell;
    }

    function ensureStaticCard() {
        let card = getStaticCard();

        if (card) {
            return card;
        }

        injectStyles();
        card = document.createElement("section");
        card.className = "ganyu-static-card";
        card.setAttribute("aria-label", "甘雨静态看板");
        card.innerHTML = [
            '<div class="ganyu-static-card__visual">',
            '<picture>',
            '<source srcset="' + STATIC_WEBP + '" type="image/webp">',
            '<img src="' + STATIC_PNG + '" alt="甘雨静态看板" loading="lazy" decoding="async">',
            '</picture>',
            '<div class="ganyu-static-card__fallback">甘雨暂时以静态看板出现～</div>',
            '</div>',
            '<div class="ganyu-static-card__body">',
            '<strong class="ganyu-static-card__title">甘雨已在这里啦～</strong>',
            '<span class="ganyu-static-card__hint">点我可以打开甘雨菜单～动态甘雨可以手动尝试。</span>',
            '<span class="ganyu-static-card__status" aria-live="polite"></span>',
            '<button class="ganyu-static-card__dynamic" type="button">尝试动态甘雨</button>',
            '</div>'
        ].join("");

        const img = card.querySelector("img");
        img.addEventListener("error", function () {
            const source = card.querySelector("source");
            if (source && source.parentNode) {
                source.remove();
                img.src = STATIC_PNG;
                return;
            }
            card.classList.add("is-image-failed");
        });

        card.querySelector(".ganyu-static-card__dynamic").addEventListener("click", function (event) {
            if (event && typeof event.preventDefault === "function") {
                event.preventDefault();
            }
            event.stopPropagation();
            tryDynamicGanyu();
        });
        card.addEventListener("click", openStaticGanyuMenu);

        document.body.appendChild(card);
        applySavedPosition(card);
        return card;
    }

    function updateStaticCardStatus(message, buttonText) {
        const card = ensureStaticCard();
        const status = card.querySelector(".ganyu-static-card__status");
        const button = card.querySelector(".ganyu-static-card__dynamic");

        status.textContent = message || "";
        button.textContent = buttonText || (loaderState.dynamicAttempted ? "再试一次动态甘雨" : "尝试动态甘雨");
        button.disabled = !!loaderState.loading;
    }

    function showStaticFallback() {
        removeInlineRuntimeNodes();
        const card = ensureStaticCard();
        card.classList.remove("is-hidden");
        loaderState.staticVisible = true;
        loaderState.visible = true;
        loaderState.loaded = false;
        loaderState.failed = false;
        document.body.classList.remove("live2d-hidden");
        updateStaticCardStatus("", loaderState.dynamicAttempted ? "再试一次动态甘雨" : "尝试动态甘雨");
        updateRenderInfo();
        setControlState("loaded");
        window.setTimeout(notifyLive2DVisible, 0);
    }

    function isStaticCardVisible() {
        const card = getStaticCard();
        return !!(card && !card.classList.contains("is-hidden") && isStyleVisible(card) && hasViewportIntersection(card.getBoundingClientRect()));
    }

    function hasAnyVisibleGanyu() {
        return isStaticCardVisible() || hasActuallyVisibleLive2D();
    }

    function parseSavedPosition(raw) {
        try {
            const parsed = raw ? JSON.parse(raw) : null;
            if (parsed && Number.isFinite(parsed.left) && Number.isFinite(parsed.top)) {
                const maxOffsetX = Math.max(window.innerWidth || 0, 360) * 3;
                const maxOffsetY = Math.max(window.innerHeight || 0, 640) * 3;
                if (Math.abs(parsed.left) > maxOffsetX || Math.abs(parsed.top) > maxOffsetY) {
                    return null;
                }
                return parsed;
            }
        } catch (error) {}
        return null;
    }

    function getSavedPosition() {
        try {
            return parseSavedPosition(localStorage.getItem(STORAGE_KEY)) || parseSavedPosition(localStorage.getItem(LEGACY_STORAGE_KEY));
        } catch (error) {
            return null;
        }
    }

    function clamp(value, min, max) {
        if (max < min) {
            return min;
        }
        return Math.min(Math.max(value, min), max);
    }

    function clampPosition(position, rect) {
        const width = Math.max(1, rect && rect.width ? rect.width : 180);
        const height = Math.max(1, rect && rect.height ? rect.height : 220);
        const minLeft = 8;
        const maxLeft = Math.max(minLeft, window.innerWidth - width - 8);
        const minTop = 8;
        const maxTop = Math.max(minTop, window.innerHeight - height - 84);
        return {
            left: clamp(position.left, minLeft, maxLeft),
            top: clamp(position.top, minTop, maxTop)
        };
    }

    function applySavedPosition(node) {
        if (!isIframeMobileMode() || !node || !node.getBoundingClientRect) {
            return;
        }

        const saved = getSavedPosition();
        if (!saved) {
            return;
        }

        window.requestAnimationFrame(function () {
            const rect = node.getBoundingClientRect();
            const safePosition = clampPosition(saved, rect);
            node.style.left = safePosition.left + "px";
            node.style.top = safePosition.top + "px";
            node.style.right = "auto";
            node.style.bottom = "auto";
        });
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
        window.JunxueLive2DRenderInfo.isActuallyVisible = snapshot.isVisible || isStaticCardVisible();
        window.JunxueLive2DRenderInfo.visibilityProblem = snapshot.problem;
        window.JunxueLive2DRenderInfo.stageRect = snapshot.stageRect;
        window.JunxueLive2DRenderInfo.canvasRect = snapshot.canvasRect;
        window.JunxueLive2DRenderInfo.mobileFallbackVisible = isStaticCardVisible();
        window.JunxueLive2DRenderInfo.staticCardVisible = isStaticCardVisible();
        window.JunxueLive2DRenderInfo.dynamicAttempted = !!loaderState.dynamicAttempted;
        window.JunxueLive2DRenderInfo.dynamicReady = !!loaderState.dynamicReady;
        window.JunxueLive2DRenderInfo.videoPausedForLive2D = !!loaderState.videoPausedForLive2D;

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
        loaderState.dynamicReady = isIframeMobileMode();
        updateRenderInfo();
        setLive2DVisible(true);
        return true;
    }

    function loadSupportScripts() {
        return loadScript(INTERACTIONS_SCRIPT).then(function () {
            return loadScript(DRAG_SCRIPT);
        });
    }

    function openStaticGanyuMenu(event) {
        if (!isIframeMobileMode()) {
            return;
        }

        if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
        }

        loadSupportScripts().then(function () {
            if (window.JunxueGanyuLazy && typeof window.JunxueGanyuLazy.openMenu === "function") {
                window.JunxueGanyuLazy.openMenu(event);
                return;
            }

            if (window.Live2DInteractiveMenu && typeof window.Live2DInteractiveMenu.open === "function") {
                window.Live2DInteractiveMenu.open(event);
            }
        }).catch(function () {});
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
            loaderState.dynamicReady = false;
            loaderState.lastError = isIframeMobileMode() ? "iframe-timeout" : "inline-timeout";
            updateRenderInfo();
            if (isIframeMobileMode()) {
                updateStaticCardStatus("动态甘雨加载有点慢，先用静态甘雨陪你。", "再试一次动态甘雨");
                setControlState("loaded");
                return;
            }
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
            loaderState.dynamicReady = true;
            loaderState.lastError = "";
            window.JunxueLive2DRenderInfo = Object.assign(window.JunxueLive2DRenderInfo || {}, data.renderInfo || {}, {
                mode: "mobile-static",
                contextLost: false
            });
            const card = getStaticCard();
            if (card) {
                card.classList.add("is-dynamic-ready");
                card.classList.add("is-hidden");
                loaderState.staticVisible = false;
            }
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
            loaderState.dynamicReady = false;
            loaderState.promise = null;
            loaderState.lastError = data.message || data.reason || "ganyu-host-error";
            updateRenderInfo();
            updateStaticCardStatus("动态甘雨暂时加载失败，先用静态甘雨陪你。", "再试一次动态甘雨");
            setControlState("loaded");
            return;
        }

        if (data.type === "ganyu-host-context-lost") {
            loaderState.frameError = true;
            loaderState.loading = false;
            loaderState.loaded = false;
            loaderState.failed = true;
            loaderState.dynamicReady = false;
            loaderState.visible = true;
            loaderState.lastError = data.message || "webgl-context-lost";
            window.JunxueLive2DRenderInfo = window.JunxueLive2DRenderInfo || {};
            window.JunxueLive2DRenderInfo.contextLost = true;
            showStaticFallback();
            updateStaticCardStatus("动态甘雨暂时加载失败，先用静态甘雨陪你。", "再试一次动态甘雨");
            return;
        }

        if (data.type === "ganyu-host-context-restored") {
            loaderState.frameError = false;
            loaderState.lastError = "";
            window.JunxueLive2DRenderInfo = window.JunxueLive2DRenderInfo || {};
            window.JunxueLive2DRenderInfo.contextLost = false;
            updateRenderInfo();
            setControlState(hasAnyVisibleGanyu() ? "loaded" : "failed");
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
            tryDynamicGanyu();
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

    function tryDynamicGanyu() {
        if (!isIframeMobileMode()) {
            loadLive2D();
            return;
        }

        showStaticFallback();
        loaderState.dynamicAttempted = true;
        loaderState.loading = true;
        loaderState.failed = false;
        loaderState.dynamicReady = false;
        updateStaticCardStatus("正在尝试动态甘雨……", "甘雨加载中");
        setControlState("loading");

        if (window.JunxueHomeEffects && typeof window.JunxueHomeEffects.pauseMobileVideoForLive2D === "function") {
            loaderState.videoPausedForLive2D = !!window.JunxueHomeEffects.pauseMobileVideoForLive2D();
        }

        window.setTimeout(function () {
            loadFrameLive2D();
        }, 0);
    }

    function loadFrameLive2D() {
        if (loaderState.loading && loaderState.promise) {
            return loaderState.promise;
        }

        if (loaderState.dynamicReady && hasActuallyVisibleLive2D()) {
            setLive2DVisible(true);
            return loadSupportScripts();
        }

        removeInlineRuntimeNodes();
        removeFrameShell();
        ensureFrameShell();
        setFrameSrc(!!loaderState.retryCount);

        loaderState.loading = true;
        loaderState.loaded = false;
        loaderState.failed = false;
        loaderState.frameReady = false;
        loaderState.frameError = false;
        loaderState.visible = true;
        document.body.classList.remove("live2d-hidden");
        updateRenderInfo();
        startLoadTimeout();

        loaderState.promise = new Promise(function (resolve) {
            loaderState.frameResolve = resolve;
        });
        return loaderState.promise;
    }

    function loadLive2D() {
        if (isIframeMobileMode()) {
            showStaticFallback();
            return Promise.resolve();
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
        removeInlineRuntimeNodes();
        loaderState.loaded = !isIframeMobileMode() && loaderState.loaded;
        loaderState.visible = false;
        updateRenderInfo();

        if (isHomeAutoload && !isLowPerformance && !isIframeMobileMode()) {
            setControlState("hidden");
            window.setTimeout(loadLive2D, AUTOLOAD_DELAY_MS);
        } else {
            setControlState("ready", isLowPerformance ? lowModeHint : "");
        }
    }

    loaderState.load = loadLive2D;
    loaderState.recover = recoverLive2D;
    loaderState.tryDynamic = tryDynamicGanyu;
    loaderState.showStaticFallback = showStaticFallback;
    loaderState.isIframeMobile = isIframeMobileMode;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
