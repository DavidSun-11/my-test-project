/* Lightweight Live2D loader: desktop stays dynamic; mobile effects mode uses the same model through a guarded iframe host. */
(function () {
    const version = "20260730-mobile-live2d-menu-drag1";
    window.__JUNXUE_LIVE2D_DEBUG__ = window.__JUNXUE_LIVE2D_DEBUG__ || [];
    window.JunxueLive2DDebugLog = window.JunxueLive2DDebugLog || function (message, detail) {
        const safeMessage = String(message || "");
        const safeDetail = detail && typeof detail === "object" ? {
            version: detail.version || "",
            source: detail.source || ""
        } : null;
        try {
            window.__JUNXUE_LIVE2D_DEBUG__.push({
                time: new Date().toISOString(),
                message: safeMessage,
                detail: safeDetail
            });
            window.console.log("[live2d-debug] " + safeMessage, safeDetail || "");
        } catch (error) {
            window.console.log("[live2d-debug] " + safeMessage);
        }
    };
    window.JunxueLive2DDebugLog("loader loaded", { version: version, source: "live2d-loader" });
    window.JunxueLive2DDebugLog("lazy not loaded yet", { version: version, source: "live2d-loader" });
})();

(function () {
    const CACHE_VERSION = "20260730-mobile-live2d-menu-drag1";
    const WIDGET_SCRIPT = "live2d/live2d-widget.js?v=" + CACHE_VERSION;
    const INTERACTIONS_SCRIPT = "assets/live2d-interactions.js?v=" + CACHE_VERSION;
    const DRAG_SCRIPT = "assets/live2d-drag.js?v=" + CACHE_VERSION;
    const FRAME_HOST_SRC = "live2d/ganyu-host.html?v=" + CACHE_VERSION;
    const STATIC_WEBP = "assets/images/price-ganyu-showcase.webp";
    const STATIC_PNG = "assets/images/price-ganyu-showcase.png";
    const LOAD_TIMEOUT_MS = 10000;
    const AUTOLOAD_DELAY_MS = 1200;
    const MOBILE_EFFECTS_AUTOLOAD_DELAY_MS = 220;
    const STORAGE_KEY = "junxue-live2d-stage-position";
    const LEGACY_STORAGE_KEY = "ganyuLive2DPosition";
    const STATIC_POSITION_KEY = "junxue-live2d-static-position";
    const DYNAMIC_POSITION_KEY = "junxue-live2d-dynamic-position";
    const MOBILE_STATES = {
        idle: "idle",
        static: "static",
        loading: "loading-live2d",
        ready: "live2d-ready",
        failed: "live2d-failed",
        destroying: "destroying"
    };
    const MENU_REQUEST_EVENT = "junxue-live2d-open-menu-request";
    const STATIC_CARD_SELECTOR = "[data-live2d-static-card='true'],.ganyu-static-card";
    const STATIC_OPEN_SELECTOR = "[data-live2d-action='open-menu']";
    const STATIC_MENU_TRIGGER_DEDUPE_MS = 520;
    const STATIC_TAP_DISTANCE_PX = 8;
    const STATIC_BUTTON_OPEN_DEDUPE_MS = 520;
    const LIVE2D_DEBUG_STATUSES = [
        "button clicked",
        "button pointerup",
        "button click duplicate ignored",
        "open from static button",
        "loading scripts",
        "loading menu scripts",
        "openMenu exists",
        "JunxueGanyuLazy.openMenu exists",
        "Live2DInteractiveMenu.open exists",
        "showMenu called",
        "showDialog called",
        "menu mounted",
        "menu computed style",
        "menu option pointerup",
        "menu option click",
        "menu option open group",
        "menu option open suggest",
        "menu option open admin",
        "menu option ignored",
        "menu open called",
        "mobile menu anchored to static card",
        "mobile menu position updated",
        "mobile showEntertainmentPanel called",
        "mobile showLiveInteractionPanel called",
        "mobile showConsultPanel called",
        "mobile showKnowJunxuePanel called",
        "mobile submenu entered: daily",
        "mobile submenu entered: live",
        "mobile submenu entered: consult",
        "mobile submenu entered: know",
        "mobile static card hidden for submenu",
        "mobile static card restored",
        "mobile submenu showDialog called: daily",
        "mobile submenu showDialog called: live",
        "mobile submenu showDialog called: consult",
        "mobile submenu showDialog called: know",
        "mobile submenu mounted",
        "mobile submenu mounted: daily",
        "mobile submenu mounted: live",
        "mobile submenu mounted: consult",
        "mobile submenu mounted: know",
        "mobile input autofocus prevented",
        "mobile menu shell removed",
        "mobile feature option clicked: hero-wheel",
        "mobile feature option clicked: score-guess",
        "mobile feature option clicked: punishment",
        "mobile feature open start: hero-wheel",
        "mobile feature open start: score-guess",
        "mobile feature mounted: hero-wheel",
        "mobile feature mounted: score-guess",
        "mobile feature open failed: hero-wheel",
        "mobile feature open failed: score-guess",
        "mobile feature open failed: punishment",
        "mobile static card restored after feature",
        "mobile static card restore skipped: no hidden submenu card",
        "mobile show ganyu button clicked",
        "mobile show ganyu restored",
        "menu open failed"
    ];
    const currentScript = document.currentScript;
    const autoloadMode = currentScript ? currentScript.getAttribute("data-live2d-autoload") : "manual";
    const performanceMode = window.JunxuePerformanceMode;
    const isLowPerformance = !!(performanceMode && typeof performanceMode.isLow === "function" && performanceMode.isLow());
    const isHighPerformancePreference = !!(performanceMode && performanceMode.requestedMode === "high");
    const isHomeAutoload = autoloadMode === "home";
    const isMobileViewport = window.matchMedia && (
        window.matchMedia("(max-width: 767px)").matches ||
        window.matchMedia("(max-width: 932px) and (orientation: landscape)").matches
    );
    const isCoarsePointer = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    const useIframeMobile = !!(isMobileViewport || isCoarsePointer);
    const lowModeHint = "流畅模式下甘雨不会自动出现，点击这里显示甘雨。";
    const loaderState = window.JunxueLive2DLoader || {
        loading: false,
        loaded: false,
        failed: false,
        visible: false
    };
    let lastStaticMenuTriggerAt = 0;
    let delegatedStaticPointer = null;
    let lastDelegatedStaticOpenAt = 0;
    let lastStaticButtonOpenAt = 0;
    let requestSequence = 0;
    let attemptSequence = 0;
    let mobileRetryTimer = 0;
    let mobileResizeFrame = 0;
    let mobileAutoloadTimer = 0;
    let lifecycleBound = false;

    loaderState.mode = useIframeMobile ? (isHighPerformancePreference ? "mobile-effects" : "mobile-static") : "inline";
    loaderState.dynamicMode = useIframeMobile ? "iframe-mobile" : "inline";
    loaderState.state = loaderState.state || MOBILE_STATES.idle;
    loaderState.requestId = 0;
    loaderState.attemptId = 0;
    loaderState.retryCount = 0;
    loaderState.mobileLoadTimings = {};
    loaderState.staticVisible = false;
    loaderState.dynamicAttempted = false;
    loaderState.dynamicReady = false;
    loaderState.videoPausedForLive2D = false;
    window.JunxueLive2DLoader = loaderState;

    function recordMobileLoadStage(stage, detail) {
        const now = window.performance && typeof window.performance.now === "function" ? window.performance.now() : Date.now();
        const elapsed = loaderState.mobileLoadStartedAt ? Math.max(0, Math.round(now - loaderState.mobileLoadStartedAt)) : 0;
        const entry = Object.assign({
            stage: stage,
            at: Math.round(now),
            elapsed: elapsed,
            requestId: loaderState.requestId || 0,
            attemptId: loaderState.attemptId || 0
        }, detail || {});

        loaderState.mobileLoadTimings = loaderState.mobileLoadTimings || {};
        loaderState.mobileLoadTimings[stage] = entry;
        if (typeof window.JunxueLive2DDebugLog === "function") {
            window.JunxueLive2DDebugLog("mobile live2d " + stage, {
                version: CACHE_VERSION,
                source: "live2d-loader"
            });
        }
        if (window.console && typeof window.console.debug === "function") {
            window.console.debug("[Live2D timing]", entry);
        }
    }

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
            ".ganyu-static-card{position:fixed;left:12px;bottom:max(132px,calc(env(safe-area-inset-bottom) + 130px));z-index:57;width:clamp(154px,48vw,210px);max-width:54vw;max-height:36vh;padding:8px;border:1px solid rgba(196,238,255,.72);border-radius:18px;background:linear-gradient(145deg,rgba(13,38,78,.78),rgba(44,112,172,.52) 52%,rgba(154,118,222,.42));box-shadow:0 0 22px rgba(90,213,255,.28),0 16px 34px rgba(2,10,30,.26),inset 0 0 16px rgba(255,255,255,.12);backdrop-filter:blur(12px);font-family:Arial,sans-serif;color:rgba(239,252,255,.96);overflow:hidden;pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-user-drag:none;cursor:pointer;transition:transform .16s ease,box-shadow .16s ease;}",
            ".ganyu-static-card:focus,.ganyu-static-card:focus-visible,.ganyu-static-card__dynamic:focus,.ganyu-static-card__dynamic:focus-visible{outline:none!important;box-shadow:0 0 18px rgba(120,229,255,.26),inset 0 0 12px rgba(255,255,255,.08);}",
            ".ganyu-static-card:active{transform:scale(.985);box-shadow:0 0 28px rgba(120,229,255,.34),0 12px 26px rgba(2,10,30,.24),inset 0 0 18px rgba(255,255,255,.14);}",
            ".ganyu-static-card.is-hidden{display:none!important;}",
            ".ganyu-static-card.is-hidden-for-submenu{visibility:hidden!important;opacity:0!important;pointer-events:none!important;}",
            ".ganyu-static-card.is-dynamic-ready .ganyu-static-card__visual{opacity:.28;filter:saturate(.75) blur(.2px);}",
            ".ganyu-static-card__visual{position:relative;display:grid;place-items:center;min-height:104px;max-height:22vh;border-radius:14px;overflow:hidden;background:radial-gradient(circle at 50% 20%,rgba(220,250,255,.24),rgba(75,160,226,.16) 50%,rgba(8,26,58,.62));}",
            ".ganyu-static-card__visual picture,.ganyu-static-card__visual img{display:block;width:100%;height:100%;min-height:104px;max-height:22vh;pointer-events:none;user-select:none;-webkit-user-select:none;-webkit-user-drag:none;}",
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
            "#ganyu-live2d-frame-shell{position:fixed;left:10px;bottom:max(86px,calc(env(safe-area-inset-bottom) + 84px));width:min(54vw,196px);height:min(58vh,360px);z-index:58;overflow:visible;background:transparent;border:0;pointer-events:none;outline:none;-webkit-tap-highlight-color:transparent;}#ganyu-live2d-frame-shell.is-loading{visibility:hidden;pointer-events:none;}",
            "#ganyu-live2d-frame{display:block;width:100%;height:100%;border:0;background:transparent;overflow:visible;pointer-events:none;outline:none;-webkit-tap-highlight-color:transparent;}",
            "#ganyu-live2d-frame-shell>.live2d-hit-area{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;border:0!important;border-radius:0!important;background:transparent!important;padding:0!important;margin:0!important;cursor:grab;touch-action:none;pointer-events:auto!important;z-index:59!important;outline:none!important;-webkit-tap-highlight-color:transparent!important;box-shadow:none!important;}",
            "#ganyu-live2d-frame-shell:focus,#ganyu-live2d-frame:focus,#ganyu-live2d-frame-shell>.live2d-hit-area:focus{outline:none!important;box-shadow:none!important;}",
            "body.live2d-hidden #live2d-widget,body.live2d-hidden #oml2d-stage,body.live2d-hidden #oml2d-canvas,body.live2d-hidden #oml2d-tips,body.live2d-hidden #ganyu-live2d-frame-shell,body.live2d-hidden .live2d-hit-area,body.live2d-hidden .ganyu-static-card{display:none!important;}",
            "html.performance-low .live2d-load-control__button,html.performance-low .live2d-load-control__status,html.performance-low .ganyu-static-card{backdrop-filter:none;box-shadow:inset 0 0 8px rgba(255,255,255,.05);transition:none;}",
            "html.performance-low .ganyu-static-card{background:linear-gradient(145deg,rgba(13,38,78,.72),rgba(44,112,172,.42));}",
            "html.performance-low .ganyu-static-card:active{transform:none;box-shadow:inset 0 0 8px rgba(255,255,255,.06);}",
            "html.performance-low .ganyu-static-card.is-dynamic-ready .ganyu-static-card__visual{opacity:.42;filter:none;}",
            "html.performance-low .ganyu-static-card__dynamic{box-shadow:none;}",
            "@media(max-width:767px),(max-width:932px) and (orientation:landscape){.live2d-load-control{left:max(12px,env(safe-area-inset-left));bottom:max(84px,calc(env(safe-area-inset-bottom) + 72px));}.live2d-load-control__button{min-height:34px;padding:0 13px;font-size:12px}.live2d-load-control__status{max-width:min(78vw,240px);font-size:12px;}#ganyu-live2d-frame-shell{--live2d-mobile-width:clamp(125px,40vw,168px);--live2d-mobile-height:clamp(250px,38dvh,340px);left:max(10px,env(safe-area-inset-left));bottom:max(88px,calc(env(safe-area-inset-bottom) + 84px));width:var(--live2d-mobile-width);height:var(--live2d-mobile-height);}.ganyu-static-card{left:max(14px,env(safe-area-inset-left));bottom:max(82px,calc(env(safe-area-inset-bottom) + 76px));width:clamp(132px,40vw,168px);max-width:46vw;max-height:32vh;max-height:32dvh;padding:7px;border-radius:16px;box-shadow:0 0 18px rgba(90,213,255,.22),0 12px 26px rgba(2,10,30,.22),inset 0 0 12px rgba(255,255,255,.10);}.ganyu-static-card__visual{min-height:86px;max-height:17vh;max-height:17dvh;border-radius:12px;}.ganyu-static-card__visual picture,.ganyu-static-card__visual img{min-height:86px;max-height:17vh;max-height:17dvh;}.ganyu-static-card__visual img{border-radius:12px;}.ganyu-static-card__body{gap:4px;padding:7px 3px 2px;}.ganyu-static-card__title{font-size:12px;}.ganyu-static-card__hint,.ganyu-static-card__status{font-size:10.5px;line-height:1.34;}.ganyu-static-card__dynamic{min-height:28px;padding:0 10px;font-size:11px;box-shadow:0 0 10px rgba(109,217,255,.16);}}@media(max-width:767px) and (max-height:700px){#ganyu-live2d-frame-shell{--live2d-mobile-height:clamp(220px,32dvh,280px);}}@media(max-width:932px) and (orientation:landscape){#ganyu-live2d-frame-shell{--live2d-mobile-width:clamp(110px,26vw,150px);--live2d-mobile-height:clamp(180px,52dvh,250px);bottom:max(62px,calc(env(safe-area-inset-bottom) + 54px));}}"
        ].join("");
        document.head.appendChild(style);
    }

    function isIframeMobileMode() {
        return useIframeMobile;
    }

    function isMobileEffectsMode() {
        return isIframeMobileMode() && isHighPerformancePreference;
    }

    function shouldUseStaticMobileMode() {
        return isIframeMobileMode() && !isMobileEffectsMode();
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
            if (loaderState.state === MOBILE_STATES.failed) {
                button.textContent = "再试一次动态甘雨";
                return;
            }
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
            debugStaticMenu("show ganyu button clicked");
            setStaticDebugStatus("mobile show ganyu button clicked");
            if (loaderState.loading) {
                return;
            }

            if (isMobileEffectsMode()) {
                if (loaderState.state === MOBILE_STATES.idle && isStaticCardVisible()) {
                    window.clearTimeout(mobileAutoloadTimer);
                    mobileAutoloadTimer = 0;
                    setMobileGanyuVisible(false);
                    return;
                }
                if (loaderState.state === MOBILE_STATES.ready && hasActuallyVisibleLive2D()) {
                    setLive2DVisible(!loaderState.visible);
                    return;
                }
                startMobileLive2DRequest("control");
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
            sendFrameMessage(visible ? "resume" : "pause");
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
            if (visible) {
                card.classList.remove("is-hidden-for-submenu");
                card.removeAttribute("aria-hidden");
                debugStaticMenu("show ganyu restored");
                setStaticDebugStatus("mobile show ganyu restored");
            }
            loaderState.staticVisible = visible;
        }

        if (getFrameShell()) {
            sendFrameMessage(visible ? "resume" : "pause");
        }

        updateRenderInfo();
        setControlState("loaded");
        if (visible) {
            loadStaticGanyuDrag();
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

    function debugStaticMenu(message) {
        if (window.console && typeof window.console.debug === "function") {
            window.console.debug("[live2d-mobile] " + message);
        }
        if (typeof window.JunxueLive2DDebugLog === "function") {
            window.JunxueLive2DDebugLog("mobile " + message, { source: "live2d-loader" });
        }
    }

    function isLive2DDebugEnabled() {
        return /(?:^|[?&])live2dDebug=1(?:&|$)/.test(window.location.search || "");
    }

    function setStaticDebugStatus(status) {
        if (!isLive2DDebugEnabled()) {
            return;
        }

        const safeStatus = String(status || "").replace(/[^\w\s:.\-]/g, "").trim().slice(0, 80);
        const isAllowed = LIVE2D_DEBUG_STATUSES.indexOf(safeStatus) !== -1 ||
            /^menu z-index: [\w.\-]+$/.test(safeStatus) ||
            /^mobile menu shell remains: [\w\s:.\-]+$/.test(safeStatus) ||
            /^mobile feature option clicked: [\w\s:.\-]+$/.test(safeStatus) ||
            /^mobile feature open start: [\w\s:.\-]+$/.test(safeStatus) ||
            /^mobile feature mounted: [\w\s:.\-]+$/.test(safeStatus) ||
            /^mobile feature open failed: [\w\s:.\-]+$/.test(safeStatus) ||
            /^mobile static card restore skipped: [\w\s:.\-]+$/.test(safeStatus) ||
            /^open failed: [\w.\-]+$/.test(safeStatus);
        if (!isAllowed) {
            return;
        }

        const card = getStaticCard();
        const statusNode = card ? card.querySelector(".ganyu-static-card__status") : null;
        if (statusNode) {
            statusNode.textContent = safeStatus;
        }
    }

    loaderState.setDebugStatus = setStaticDebugStatus;

    function isStaticActionButton(node) {
        return !!(node && node.matches && node.matches(".ganyu-static-card__dynamic"));
    }

    function getStaticMenuTrigger(target) {
        if (!target || !target.closest) {
            return null;
        }

        const action = target.closest(".ganyu-static-card__dynamic");
        if (action) {
            return {
                node: action,
                action: "button"
            };
        }

        const card = target.closest(STATIC_CARD_SELECTOR);
        if (card) {
            return {
                node: card,
                action: "card"
            };
        }

        return null;
    }

    function stopStaticButtonEvent(event) {
        if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
        }
        if (event && typeof event.stopPropagation === "function") {
            event.stopPropagation();
        }
        if (event && typeof event.stopImmediatePropagation === "function") {
            event.stopImmediatePropagation();
        }
    }

    function handleStaticOpenButtonEvent(event) {
        const button = event ? event.currentTarget : null;
        if (!isStaticActionButton(button)) {
            return;
        }

        stopStaticButtonEvent(event);
        if (button.getAttribute("data-live2d-action") === "retry-dynamic") {
            startMobileLive2DRequest("static-retry");
            return;
        }
        debugStaticMenu("static button clicked");
        setStaticDebugStatus("button clicked");

        if (event.type === "click" && Date.now() - lastStaticButtonOpenAt < STATIC_BUTTON_OPEN_DEDUPE_MS) {
            debugStaticMenu("button click duplicate ignored");
            setStaticDebugStatus("button click duplicate ignored");
            return;
        }

        if (event.type === "pointerup") {
            setStaticDebugStatus("button pointerup");
        }

        openStaticGanyuMenuFromButton(event);
    }

    function bindStaticOpenButton(card) {
        if (!card) {
            return;
        }

        const button = card.querySelector(".ganyu-static-card__dynamic");
        if (!button || button.dataset.live2dOpenBound === "true") {
            return;
        }

        button.dataset.live2dOpenBound = "true";
        button.addEventListener("pointerup", handleStaticOpenButtonEvent, true);
        button.addEventListener("click", handleStaticOpenButtonEvent, true);
    }

    function prepareStaticCardMenuTargets(card) {
        if (!card) {
            return;
        }

        card.setAttribute("data-live2d-static-card", "true");

        const button = card.querySelector(".ganyu-static-card__dynamic");
        if (button) {
            if (!button.getAttribute("data-live2d-action")) {
                button.setAttribute("data-live2d-action", "open-menu");
            }
            button.disabled = false;
            button.removeAttribute("disabled");
        }

        bindStaticOpenButton(card);
    }

    function ensureFrameShell() {
        let shell = getFrameShell();

        if (shell) {
            return shell;
        }

        injectStyles();
        shell = document.createElement("div");
        shell.id = "ganyu-live2d-frame-shell";
        shell.classList.add("is-loading");
        shell.dataset.live2dRenderMode = "dynamic";
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
        recordMobileLoadStage("iframe-created");
        applySavedPosition(shell);
        return shell;
    }

    function ensureStaticCard() {
        let card = getStaticCard();

        if (card) {
            prepareStaticCardMenuTargets(card);
            return card;
        }

        injectStyles();
        card = document.createElement("section");
        card.className = "ganyu-static-card";
        card.setAttribute("data-live2d-static-card", "true");
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
            '<span class="ganyu-static-card__hint">点我可以打开甘雨菜单～也可以拖动我换个位置。</span>',
            '<span class="ganyu-static-card__status" aria-live="polite"></span>',
            '<button class="ganyu-static-card__dynamic" type="button" data-live2d-action="open-menu">尝试对话甘雨</button>',
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

        prepareStaticCardMenuTargets(card);

        document.body.appendChild(card);
        applySavedPosition(card);
        loadStaticGanyuDrag();
        return card;
    }

    function updateStaticCardStatus(message, buttonText, action) {
        const card = ensureStaticCard();
        const status = card.querySelector(".ganyu-static-card__status");
        const button = card.querySelector(".ganyu-static-card__dynamic");

        status.textContent = message || "";
        button.textContent = buttonText || (loaderState.dynamicAttempted ? "再试一次对话甘雨" : "尝试对话甘雨");
        button.setAttribute("data-live2d-action", action || "open-menu");
        button.disabled = false;
        button.removeAttribute("disabled");
    }

    function showStaticFallback(options) {
        const settings = options || {};
        removeInlineRuntimeNodes();
        const card = ensureStaticCard();
        card.classList.remove("is-hidden");
        card.classList.remove("is-hidden-for-submenu");
        card.removeAttribute("aria-hidden");
        loaderState.staticVisible = true;
        loaderState.visible = true;
        loaderState.loaded = false;
        loaderState.failed = !!settings.failed;
        if (settings.state) {
            loaderState.state = settings.state;
        } else if (!isMobileEffectsMode()) {
            loaderState.state = MOBILE_STATES.static;
        }
        document.body.classList.remove("live2d-hidden");
        updateStaticCardStatus(settings.message || "", settings.buttonText || (loaderState.dynamicAttempted ? "再试一次对话甘雨" : "尝试对话甘雨"), settings.action || "open-menu");
        updateRenderInfo();
        setControlState("loaded");
        debugStaticMenu("show ganyu restored");
        setStaticDebugStatus("mobile show ganyu restored");
        loadStaticGanyuDrag();
        window.setTimeout(notifyLive2DVisible, 0);
    }

    function isStaticCardVisible() {
        const card = getStaticCard();
        return !!(card && !card.classList.contains("is-hidden") && isStyleVisible(card) && hasViewportIntersection(card.getBoundingClientRect()));
    }

    function hasAnyVisibleGanyu() {
        return isStaticCardVisible() || hasActuallyVisibleLive2D();
    }

    function getViewportSize() {
        const viewport = window.visualViewport;
        return {
            width: Math.max(1, Math.floor((viewport && viewport.width) || window.innerWidth || document.documentElement.clientWidth || 1)),
            height: Math.max(1, Math.floor((viewport && viewport.height) || window.innerHeight || document.documentElement.clientHeight || 1))
        };
    }

    function parseSavedPosition(raw) {
        try {
            const parsed = raw ? JSON.parse(raw) : null;
            if (parsed && Number.isFinite(parsed.left) && Number.isFinite(parsed.top)) {
                const viewport = getViewportSize();
                const maxOffsetX = Math.max(viewport.width, 360) * 3;
                const maxOffsetY = Math.max(viewport.height, 640) * 3;
                if (Math.abs(parsed.left) > maxOffsetX || Math.abs(parsed.top) > maxOffsetY) {
                    return null;
                }
                return parsed;
            }
        } catch (error) {}
        return null;
    }

    function getSavedPosition(node) {
        try {
            const isDynamic = !!(node && node.id === "ganyu-live2d-frame-shell");
            const scopedKey = isDynamic ? DYNAMIC_POSITION_KEY : STATIC_POSITION_KEY;
            const scopedPosition = parseSavedPosition(localStorage.getItem(scopedKey));

            if (scopedPosition || isDynamic) {
                return scopedPosition;
            }

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
        const viewport = getViewportSize();
        const width = Math.max(1, rect && rect.width ? rect.width : 180);
        const height = Math.max(1, rect && rect.height ? rect.height : 220);
        const minLeft = 8;
        const maxLeft = Math.max(minLeft, viewport.width - width - 8);
        const minTop = 8;
        const bottomReserve = Math.max(84, Math.round(viewport.height * 0.12));
        const maxTop = Math.max(minTop, viewport.height - height - bottomReserve);
        return {
            left: clamp(position.left, minLeft, maxLeft),
            top: clamp(position.top, minTop, maxTop)
        };
    }

    function applySavedPosition(node) {
        if (!isIframeMobileMode() || !node || !node.getBoundingClientRect) {
            return;
        }

        const saved = getSavedPosition(node);
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
        const params = [
            "requestId=" + encodeURIComponent(String(loaderState.requestId || 0)),
            "attemptId=" + encodeURIComponent(String(loaderState.attemptId || 0)),
            "cacheVersion=" + encodeURIComponent(CACHE_VERSION)
        ];
        if (forceFresh) {
            params.push("retry=" + Date.now());
        }
        frame.src = FRAME_HOST_SRC + separator + params.join("&");
    }

    function sendFrameMessage(type, detail) {
        const frame = getFrame();

        if (!frame || !frame.contentWindow) {
            return;
        }

        try {
            frame.contentWindow.postMessage(Object.assign({
                type: type,
                requestId: loaderState.requestId || 0,
                attemptId: loaderState.attemptId || 0,
                cacheVersion: CACHE_VERSION
            }, detail || {}), window.location.origin);
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

    function syncStaticGanyuDrag() {
        if (window.JunxueLive2DDrag && typeof window.JunxueLive2DDrag.sync === "function") {
            window.JunxueLive2DDrag.sync();
        }
    }

    function loadStaticGanyuDrag() {
        loadScript(DRAG_SCRIPT).then(syncStaticGanyuDrag).catch(function () {});
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

    function shouldDeduplicateStaticMenuTrigger() {
        const now = Date.now();

        if (now - lastStaticMenuTriggerAt < STATIC_MENU_TRIGGER_DEDUPE_MS) {
            return true;
        }

        lastStaticMenuTriggerAt = now;
        return false;
    }

    function handleOpenLive2DMenuFromStaticCard(event) {
        if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
        }

        if (event && typeof event.stopPropagation === "function") {
            event.stopPropagation();
        }

        requestOpenLive2DMenuFromStaticCard(event);
    }

    function openStaticMenuFromDelegatedEvent(event, trigger) {
        const source = trigger && trigger.action === "button" ? "open button clicked" : "static card pointerup";
        const isButtonTrigger = trigger && trigger.action === "button";

        debugStaticMenu(source);
        if (isButtonTrigger) {
            debugStaticMenu("static button clicked");
            debugStaticMenu("open menu from static button");
        }
        lastDelegatedStaticOpenAt = Date.now();

        if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
        }

        requestOpenLive2DMenuFromStaticCard(event, isButtonTrigger ? {
            source: "static-open-button",
            bypassSuppress: true
        } : undefined);
    }

    function handleStaticMenuPointerDown(event) {
        if (event.button !== undefined && event.button !== 0) {
            return;
        }

        const trigger = getStaticMenuTrigger(event.target);
        if (!trigger) {
            delegatedStaticPointer = null;
            return;
        }
        if (trigger.action === "button") {
            delegatedStaticPointer = null;
            return;
        }

        delegatedStaticPointer = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            action: trigger.action
        };
    }

    function handleStaticMenuPointerUp(event) {
        const trigger = getStaticMenuTrigger(event.target);
        if (!trigger) {
            delegatedStaticPointer = null;
            return;
        }
        if (trigger.action === "button") {
            delegatedStaticPointer = null;
            return;
        }

        const pointer = delegatedStaticPointer && delegatedStaticPointer.pointerId === event.pointerId ? delegatedStaticPointer : null;
        delegatedStaticPointer = null;

        if (pointer) {
            const deltaX = event.clientX - pointer.startX;
            const deltaY = event.clientY - pointer.startY;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            if (distance > STATIC_TAP_DISTANCE_PX) {
                return;
            }
        }

        openStaticMenuFromDelegatedEvent(event, trigger);
    }

    function handleStaticMenuClick(event) {
        const trigger = getStaticMenuTrigger(event.target);
        if (!trigger) {
            return;
        }
        if (trigger.action === "button") {
            return;
        }

        if (Date.now() - lastDelegatedStaticOpenAt < STATIC_MENU_TRIGGER_DEDUPE_MS) {
            if (event && typeof event.preventDefault === "function") {
                event.preventDefault();
            }
            if (event && typeof event.stopPropagation === "function") {
                event.stopPropagation();
            }
            return;
        }

        debugStaticMenu(trigger.action === "button" ? "open button clicked" : "static card click");
        if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
        }
        if (event && typeof event.stopPropagation === "function") {
            event.stopPropagation();
        }
        requestOpenLive2DMenuFromStaticCard(event, trigger.action === "button" ? {
            source: "static-open-button",
            bypassSuppress: true
        } : undefined);
    }

    function installStaticMenuDelegate() {
        if (window.__JUNXUE_LIVE2D_STATIC_MENU_DELEGATE__) {
            return;
        }

        window.__JUNXUE_LIVE2D_STATIC_MENU_DELEGATE__ = true;
        document.addEventListener("pointerdown", handleStaticMenuPointerDown, true);
        document.addEventListener("pointerup", handleStaticMenuPointerUp, true);
        document.addEventListener("click", handleStaticMenuClick, true);
    }

    function requestOpenLive2DMenuFromStaticCard(event, options) {
        const settings = options || {};

        debugStaticMenu("static menu open requested");

        if (shouldDeduplicateStaticMenuTrigger()) {
            debugStaticMenu("static menu open ignored: drag/ghost click");
            return;
        }

        debugStaticMenu("static card menu trigger");

        openStaticGanyuMenu(event, settings);
    }

    function openStaticGanyuMenuFromButton(event) {
        if (Date.now() - lastStaticButtonOpenAt < STATIC_BUTTON_OPEN_DEDUPE_MS) {
            debugStaticMenu("button click duplicate ignored");
            setStaticDebugStatus("button click duplicate ignored");
            return;
        }

        lastStaticButtonOpenAt = Date.now();
        debugStaticMenu("open from static button");
        setStaticDebugStatus("open from static button");
        openStaticGanyuMenu(event, {
            source: "static-open-button",
            bypassSuppress: true
        });
    }

    function callExistingStaticMenuOpen() {
        if (window.JunxueGanyuLazy && typeof window.JunxueGanyuLazy.openMenu === "function") {
            debugStaticMenu("JunxueGanyuLazy.openMenu exists");
            setStaticDebugStatus("JunxueGanyuLazy.openMenu exists");
            setStaticDebugStatus("openMenu exists");
            window.JunxueGanyuLazy.openMenu();
            setStaticDebugStatus("menu open called");
            debugStaticMenu("static menu opened");
            return true;
        }

        if (window.Live2DInteractiveMenu && typeof window.Live2DInteractiveMenu.open === "function") {
            debugStaticMenu("Live2DInteractiveMenu.open exists");
            setStaticDebugStatus("Live2DInteractiveMenu.open exists");
            setStaticDebugStatus("openMenu exists");
            window.Live2DInteractiveMenu.open();
            setStaticDebugStatus("menu open called");
            debugStaticMenu("static menu opened");
            return true;
        }

        return false;
    }

    function openStaticGanyuMenu(event, options) {
        const settings = options || {};
        const bypassSuppress = settings.bypassSuppress === true;

        if (bypassSuppress) {
            debugStaticMenu(settings.source === "static-open-button" ? "bypass suppress for static button" : "bypass suppress for drag tap");
        }

        window.__JUNXUE_LIVE2D_OPEN_SOURCE__ = settings.source || "";

        if (!bypassSuppress && window.JunxueLive2DDrag && typeof window.JunxueLive2DDrag.shouldIgnoreMenuEvent === "function" && window.JunxueLive2DDrag.shouldIgnoreMenuEvent(event)) {
            debugStaticMenu("static menu open ignored: drag/ghost click");
            return;
        }

        debugStaticMenu("open allowed");

        if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
        }

        debugStaticMenu("opening menu from smooth mode");

        if (callExistingStaticMenuOpen()) {
            return;
        }

        debugStaticMenu("loading menu scripts");
        setStaticDebugStatus("loading menu scripts");
        setStaticDebugStatus("loading scripts");
        loadSupportScripts().then(function () {
            debugStaticMenu("lazy menu ready");

            if (callExistingStaticMenuOpen()) {
                return;
            }

            throw new Error("menu-open-unavailable");
        }).catch(function (error) {
            const reason = error && error.message ? error.message : "load-failed";
            setStaticDebugStatus("menu open failed");
            setStaticDebugStatus("open failed: " + reason);
            debugStaticMenu("menu open failed: " + reason);
            updateStaticCardStatus("甘雨菜单暂时没唤醒，请刷新后再试。", "再试一次");
        });
    }

    function isGanyuMenuRequestTarget(target) {
        if (!target || !target.closest) {
            return false;
        }

        return !!target.closest(STATIC_OPEN_SELECTOR + "," + STATIC_CARD_SELECTOR + ",#ganyu-live2d-frame-shell,.live2d-hit-area,#oml2d-canvas,#oml2d-stage");
    }

    function handleGanyuMenuRequest(event) {
        if (!event || !isGanyuMenuRequestTarget(event.target)) {
            return;
        }

        requestOpenLive2DMenuFromStaticCard(event, event.detail || {});
    }

    function isCurrentFrameMessage(event, data) {
        const frame = getFrame();
        return !!(
            event &&
            data &&
            frame &&
            event.origin === window.location.origin &&
            event.source === frame.contentWindow &&
            String(data.cacheVersion || "") === CACHE_VERSION &&
            Number(data.requestId) === Number(loaderState.requestId) &&
            Number(data.attemptId) === Number(loaderState.attemptId) &&
            Number(loaderState.attemptId) > 0
        );
    }

    function clearMobileAttemptTimers() {
        window.clearTimeout(loaderState.timeout);
        window.clearTimeout(mobileRetryTimer);
        loaderState.timeout = 0;
        mobileRetryTimer = 0;
    }

    function resolveCurrentFramePromise() {
        if (typeof loaderState.frameResolve === "function") {
            loaderState.frameResolve();
        }
        loaderState.frameResolve = null;
    }

    function destroyCurrentMobileFrame(reason) {
        if (!isIframeMobileMode()) {
            return;
        }

        loaderState.state = MOBILE_STATES.destroying;
        clearMobileAttemptTimers();
        sendFrameMessage("destroy", { reason: reason || "destroy" });
        removeFrameShell();
        loaderState.attemptId = 0;
        loaderState.frameReady = false;
        loaderState.frameError = false;
        loaderState.dynamicReady = false;
        loaderState.loading = false;
        loaderState.promise = null;
        resolveCurrentFramePromise();
    }

    function beginMobileLive2DAttempt(requestId, source) {
        if (!isMobileEffectsMode() || Number(requestId) !== Number(loaderState.requestId)) {
            return Promise.resolve();
        }

        clearMobileAttemptTimers();
        if (getFrameShell()) {
            destroyCurrentMobileFrame("replace-attempt");
        }

        loaderState.attemptId = ++attemptSequence;
        loaderState.state = MOBILE_STATES.loading;
        loaderState.mode = "mobile-effects";
        loaderState.dynamicAttempted = true;
        loaderState.loading = true;
        loaderState.loaded = false;
        loaderState.failed = false;
        loaderState.dynamicReady = false;
        loaderState.frameReady = false;
        loaderState.frameError = false;
        loaderState.visible = true;
        loaderState.lastError = "";

        showStaticFallback({
            state: MOBILE_STATES.loading,
            message: loaderState.retryCount ? "正在再次尝试动态甘雨……" : "正在尝试动态甘雨……",
            buttonText: "打开甘雨菜单",
            action: "open-menu"
        });

        const shell = ensureFrameShell();
        shell.classList.add("is-loading");
        shell.dataset.live2dAttemptId = String(loaderState.attemptId);
        shell.dataset.live2dRequestId = String(loaderState.requestId);
        setFrameSrc(loaderState.retryCount > 0);
        setControlState("loading");
        updateRenderInfo();
        startLoadTimeout(loaderState.attemptId);

        loaderState.promise = new Promise(function (resolve) {
            loaderState.frameResolve = resolve;
        });
        return loaderState.promise;
    }

    function startMobileLive2DRequest(source) {
        if (!isMobileEffectsMode()) {
            showStaticFallback();
            return Promise.resolve();
        }

        if (loaderState.loading && loaderState.promise) {
            return loaderState.promise;
        }

        if (window.JunxueHomeEffects && typeof window.JunxueHomeEffects.pauseMobileVideoForLive2D === "function") {
            loaderState.videoPausedForLive2D = !!window.JunxueHomeEffects.pauseMobileVideoForLive2D();
        }
        const requestId = ++requestSequence;
        clearMobileAttemptTimers();
        loaderState.requestId = requestId;
        loaderState.retryCount = 0;
        loaderState.mobileLoadStartedAt = window.performance && typeof window.performance.now === "function" ? window.performance.now() : Date.now();
        loaderState.mobileLoadTimings = {};
        recordMobileLoadStage("request-start", { source: source || "manual" });
        return beginMobileLive2DAttempt(requestId, source || "manual");
    }

    function handleMobileAttemptFailure(reason, message) {
        if (!isMobileEffectsMode() || !loaderState.attemptId) {
            return;
        }

        const requestId = loaderState.requestId;
        const safeReason = reason || "mobile-live2d-failed";
        const safeMessage = message || "动态甘雨暂时加载失败，先用静态甘雨陪你。";
        console.warn("Live2D mobile attempt failed; keeping static fallback.", {
            reason: safeReason,
            requestId: requestId,
            attemptId: loaderState.attemptId,
            retryCount: loaderState.retryCount
        });

        destroyCurrentMobileFrame(safeReason);
        loaderState.lastError = safeReason;

        if (loaderState.retryCount < 1 && Number(requestId) === Number(loaderState.requestId)) {
            loaderState.retryCount += 1;
            loaderState.state = MOBILE_STATES.loading;
            showStaticFallback({
                state: MOBILE_STATES.loading,
                message: "动态甘雨加载未完成，正在再试一次……",
                buttonText: "打开甘雨菜单",
                action: "open-menu"
            });
            setControlState("loading");
            mobileRetryTimer = window.setTimeout(function () {
                beginMobileLive2DAttempt(requestId, "automatic-retry");
            }, 420);
            return;
        }

        loaderState.state = MOBILE_STATES.failed;
        loaderState.failed = true;
        loaderState.loading = false;
        loaderState.visible = true;
        showStaticFallback({
            state: MOBILE_STATES.failed,
            failed: true,
            message: safeMessage,
            buttonText: "再试一次动态甘雨",
            action: "retry-dynamic"
        });
        setControlState("failed", safeMessage);
    }

    function startLoadTimeout(attemptId) {
        window.clearTimeout(loaderState.timeout);
        loaderState.timeout = window.setTimeout(function () {
            if (Number(attemptId) !== Number(loaderState.attemptId)) {
                return;
            }
            if (hasActuallyVisibleLive2D() && markLoadedFromExisting()) {
                return;
            }

            if (isMobileEffectsMode()) {
                handleMobileAttemptFailure("iframe-timeout", "动态甘雨加载超时，先用静态甘雨陪你。");
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
        const data = event.data || {};

        if (!isIframeMobileMode() || typeof data.type !== "string" || !isCurrentFrameMessage(event, data)) {
            return;
        }

        if (data.type === "ganyu-host-ready") {
            recordMobileLoadStage("live2d-ready", data.renderInfo || {});
            clearMobileAttemptTimers();
            loaderState.frameReady = true;
            loaderState.frameError = false;
            loaderState.loading = false;
            loaderState.loaded = true;
            loaderState.failed = false;
            loaderState.visible = true;
            loaderState.dynamicReady = true;
            loaderState.lastError = "";
            loaderState.state = MOBILE_STATES.ready;
            window.JunxueLive2DRenderInfo = Object.assign(window.JunxueLive2DRenderInfo || {}, data.renderInfo || {}, {
                mode: "mobile-effects",
                contextLost: false
            });
            const shell = getFrameShell();
            if (shell) {
                shell.classList.remove("is-loading");
            }
            const card = getStaticCard();
            if (card) {
                card.classList.add("is-dynamic-ready");
                card.classList.add("is-hidden");
                loaderState.staticVisible = false;
            }
            updateRenderInfo();
            setLive2DVisible(true);
            loadSupportScripts();
            if (window.JunxueLive2DDrag && typeof window.JunxueLive2DDrag.scheduleSync === "function") {
                window.JunxueLive2DDrag.scheduleSync();
            }

            resolveCurrentFramePromise();
            return;
        }

        const stageMessages = {
            "ganyu-host-script-loaded": "host-script-loaded",
            "ganyu-host-runtime-ready": "runtime-ready",
            "ganyu-host-model-ready": "model-ready"
        };
        if (stageMessages[data.type]) {
            recordMobileLoadStage(stageMessages[data.type], data);
            return;
        }

        if (data.type === "ganyu-host-error") {
            handleMobileAttemptFailure(data.reason || "ganyu-host-error", data.message);
            return;
        }

        if (data.type === "ganyu-host-context-lost") {
            window.JunxueLive2DRenderInfo = window.JunxueLive2DRenderInfo || {};
            window.JunxueLive2DRenderInfo.contextLost = true;
            handleMobileAttemptFailure("webgl-context-lost", data.message || "动态甘雨渲染中断，先用静态甘雨陪你。");
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
            startMobileLive2DRequest("recover");
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
            return loadLive2D();
        }

        if (window.JunxueHomeEffects && typeof window.JunxueHomeEffects.pauseMobileVideoForLive2D === "function") {
            loaderState.videoPausedForLive2D = !!window.JunxueHomeEffects.pauseMobileVideoForLive2D();
        }

        return startMobileLive2DRequest("dynamic-request");
    }

    function loadFrameLive2D() {
        return startMobileLive2DRequest("frame-request");
    }

    function scheduleMobileFrameLayout() {
        if (!isIframeMobileMode() || mobileResizeFrame) {
            return;
        }

        mobileResizeFrame = window.requestAnimationFrame(function () {
            mobileResizeFrame = 0;
            if (loaderState.state === MOBILE_STATES.ready && getFrameShell()) {
                sendFrameMessage("resize");
            }
            if (window.JunxueLive2DDrag && typeof window.JunxueLive2DDrag.scheduleSync === "function") {
                window.JunxueLive2DDrag.scheduleSync();
            }
            if (window.JunxueGanyuTalk && typeof window.JunxueGanyuTalk.sync === "function") {
                window.JunxueGanyuTalk.sync();
            }
        });
    }

    function bindMobileLifecycle() {
        if (lifecycleBound) {
            return;
        }

        lifecycleBound = true;
        document.addEventListener("visibilitychange", function () {
            if (!isIframeMobileMode() || loaderState.state !== MOBILE_STATES.ready) {
                return;
            }
            sendFrameMessage(document.hidden || !loaderState.visible ? "pause" : "resume");
            if (!document.hidden) {
                scheduleMobileFrameLayout();
            }
        });
        window.addEventListener("resize", scheduleMobileFrameLayout);
        window.addEventListener("orientationchange", scheduleMobileFrameLayout);
        if (window.visualViewport) {
            window.visualViewport.addEventListener("resize", scheduleMobileFrameLayout);
            window.visualViewport.addEventListener("scroll", scheduleMobileFrameLayout, { passive: true });
        }
        window.addEventListener("pagehide", function () {
            if (isIframeMobileMode() && getFrameShell()) {
                destroyCurrentMobileFrame("pagehide");
            }
        });
    }

    function loadLive2D() {
        if (isIframeMobileMode()) {
            return isMobileEffectsMode() ? tryDynamicGanyu() : (showStaticFallback(), Promise.resolve());
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
        loaderState.state = isIframeMobileMode() ? MOBILE_STATES.idle : loaderState.state;
        bindMobileLifecycle();
        updateRenderInfo();

        if (isHomeAutoload && !isLowPerformance && !isIframeMobileMode()) {
            setControlState("hidden");
            window.setTimeout(loadLive2D, AUTOLOAD_DELAY_MS);
        } else if (isHomeAutoload && isMobileEffectsMode()) {
            showStaticFallback({
                state: MOBILE_STATES.idle,
                message: "正在准备动态甘雨……",
                buttonText: "打开甘雨菜单",
                action: "open-menu"
            });
            mobileAutoloadTimer = window.setTimeout(function () {
                mobileAutoloadTimer = 0;
                if (!loaderState.visible || loaderState.state !== MOBILE_STATES.idle) {
                    return;
                }
                tryDynamicGanyu();
            }, MOBILE_EFFECTS_AUTOLOAD_DELAY_MS);
        } else {
            setControlState("ready", isLowPerformance ? lowModeHint : "");
        }
    }

    loaderState.load = loadLive2D;
    loaderState.recover = recoverLive2D;
    loaderState.tryDynamic = tryDynamicGanyu;
    loaderState.showStaticFallback = showStaticFallback;
    loaderState.openMenuFromStaticCard = requestOpenLive2DMenuFromStaticCard;
    loaderState.isIframeMobile = isIframeMobileMode;
    installStaticMenuDelegate();
    window.addEventListener(MENU_REQUEST_EVENT, handleGanyuMenuRequest);

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
