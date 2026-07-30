/* Live2D 轻量启动脚本：首屏只保留开场提示、点击入口和懒加载控制。 */
(function () {
    const version = "20260730-mobile-live2d-menu-drag1";
    if (typeof window.JunxueLive2DDebugLog !== "function") {
        window.__JUNXUE_LIVE2D_DEBUG__ = window.__JUNXUE_LIVE2D_DEBUG__ || [];
        window.JunxueLive2DDebugLog = function (message, detail) {
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
    }
    window.JunxueLive2DDebugLog("interactions loaded", { version: version, source: "live2d-interactions" });
})();

(function () {
    if (window.__JUNXUE_LIVE2D_INTERACTIONS_INSTALLED__) {
        return;
    }

    window.__JUNXUE_LIVE2D_INTERACTIONS_INSTALLED__ = true;

    const LAZY_SCRIPT_SRC = "assets/live2d-interactions-lazy.js?v=20260730-mobile-live2d-menu-drag1";
    const BOSS_NAME_FALLBACK = "旅行者";
    const MOBILE_LAYOUT_QUERY = "(max-width: 767px)";
    const MOBILE_LANDSCAPE_QUERY = "(max-width: 932px) and (orientation: landscape)";
    if (typeof window.enableGanyuMemory !== "boolean") {
        window.enableGanyuMemory = true;
    }

    function isMobileLayoutViewport() {
        return !!(window.matchMedia && (
            window.matchMedia(MOBILE_LAYOUT_QUERY).matches ||
            window.matchMedia(MOBILE_LANDSCAPE_QUERY).matches
        ));
    }

    const memoryStorageKeys = {
        visitCount: "ganyuVisitCount",
        firstVisitAt: "ganyuFirstVisitAt",
        lastVisitAt: "ganyuLastVisitAt",
        lastSeenDate: "ganyuLastSeenDate",
        streakDays: "ganyuStreakDays",
        favoriteCity: "ganyuFavoriteCity",
        cityHistory: "ganyuCityHistory",
        lastSongTitle: "ganyuLastSongTitle",
        lastSongSrc: "ganyuLastSongSrc",
        lastFortune: "ganyuLastFortune",
        lastFeature: "ganyuLastFeature"
    };
    const preferenceMemoryKeys = [
        memoryStorageKeys.favoriteCity,
        memoryStorageKeys.cityHistory,
        memoryStorageKeys.lastSongTitle,
        memoryStorageKeys.lastSongSrc,
        memoryStorageKeys.lastFortune,
        memoryStorageKeys.lastFeature
    ];
    const memoryRetryDelay = 1600;
    const memoryMaxAttempts = 8;
    const openingVoiceText = "万家灯火就在眼前，人们的生活究竟是什么样的呢…欸？你想邀我去夜市？啊…不，不好意思，我就不去了吧。";
    const openingVoicePath = "assets/audio/ganyu_opening.mp3";
    const firstClickVoiceStorageKey = "live2d_first_click_voice_played";
    const touchDialogueLines = {
        head: [
            { text: "嗯？是在叫我吗？", voice: "assets/audio/ganyu_touch_head_1.mp3" },
            { text: "请、请不要突然碰我的头发……", voice: "assets/audio/ganyu_touch_head_2.mp3" },
            { text: "有什么事吗？", voice: "assets/audio/ganyu_touch_head_3.mp3" }
        ],
        body: [
            { text: "今天也请多关照。", voice: "assets/audio/ganyu_touch_body_1.mp3" },
            { text: "有什么需要我帮忙的吗？", voice: "assets/audio/ganyu_touch_body_2.mp3" },
            { text: "我会认真听你说的。", voice: "assets/audio/ganyu_touch_body_3.mp3" }
        ],
        foot: [
            { text: "如果想换个位置，可以拖动我哦。", voice: "assets/audio/ganyu_touch_foot_1.mp3" },
            { text: "我会乖乖待在这里的。", voice: "assets/audio/ganyu_touch_foot_2.mp3" }
        ]
    };
    const dragDialogueLines = [
        { text: "这里也不错呢。", voice: "assets/audio/ganyu_drag_done_1.mp3" },
        { text: "甘雨会乖乖待在这里的。", voice: "assets/audio/ganyu_drag_done_2.mp3" },
        { text: "唔……下次轻一点呀。", voice: "assets/audio/ganyu_drag_done_3.mp3" },
        { text: "你把甘雨放到这里了吗？", voice: "assets/audio/ganyu_drag_done_4.mp3" },
        { text: "好吧，那甘雨就在这里陪你。", voice: "assets/audio/ganyu_drag_done_5.mp3" }
    ];
    const ganyuIdleLines = [
        "今天也辛苦了，记得休息一下哦。",
        "如果累了，就休息一下吧。",
        "我会在这里陪着你的。",
        "希望今天也能遇见一点幸运。",
        "别忘记喝水哦。",
        "如果累了，就先停下来看看星空吧。",
        "月光很安静，像是适合思考的夜晚。",
        "不用着急，慢慢来也可以。",
        "你回来啦，我刚好也在等你。",
        "今天想听歌，还是想占卜呢？",
        "如果有什么烦恼，也可以告诉我。",
        "星光很远，但总会抵达眼前。",
        "希望今天的你，也能被温柔以待。",
        "别总是熬夜哦，身体也很重要。",
        "天气冷的话，要记得添衣。",
        "今天的心情怎么样？",
        "能再见到你，我很开心。",
        "即使只是安静待着，也很好。",
        "愿你今天遇到一点小小的幸运。",
        "如果不知道该做什么，就先喝口水吧。",
        "我会认真听你说的。",
        "今晚的星空，看起来很适合许愿。",
        "请不要太勉强自己。",
        "云很轻，心事也可以慢慢放轻。",
        "愿星光替你留住一点温柔。",
        "今天也请把自己放在心上。",
        "不开心的时候，也可以先深呼吸一下。",
        "慢慢整理思绪，答案会清楚起来的。",
        "月海亭的工作很多，但我会抽空陪你。",
        "无论今天怎样，都请温柔地对待自己。",
        "夜风很轻，适合把烦恼暂时放下。",
        "愿你抬头时，刚好能看见一点光。"
    ];
    const timeDialogueLines = {
        morning: ["早上好。", "新的一天开始了呢。", "早晨的风很清爽，愿你今天顺利。"],
        afternoon: ["工作还顺利吗？", "下午也请不要太勉强自己。", "要不要稍微休息一下呢？"],
        evening: ["今天也辛苦了。", "已经很晚了呢。", "夜色安静下来，也该照顾自己了。"],
        lateNight: ["还没休息吗？", "要注意身体哦。", "夜已经深了，请不要太勉强。"]
    };

    let openingVoicePlaying = false;
    let openingVoiceRetryPending = false;
    let openingVoiceRetryBound = false;
    let lazyLoadPromise = null;
    let bootstrapReady = false;
    let openingBubble = null;
    let companionBubble = null;
    let idleTalkTimer = null;
    let hitArea = null;
    let memoryMessage = "";
    let currentMemoryState = null;
    let memoryPending = false;
    let memoryShownThisPage = false;
    let memoryAttempts = 0;
    let bossNameRefreshTimer = 0;
    let bossNameAuthListenerBound = false;
    let currentBossNameUserId = "";
    let lastDragStartDialogueAt = 0;
    let popupSyncFrame = 0;
    let popupSyncInProgress = false;
    const bossNameState = window.JunxueGanyuBossNameState || {
        displayName: BOSS_NAME_FALLBACK,
        loading: false,
        loaded: false,
        refreshPromise: null,
        updatedAt: 0
    };

    bossNameState.displayName = sanitizeBossDisplayName(bossNameState.displayName) || BOSS_NAME_FALLBACK;
    bossNameState.loading = !!bossNameState.loading;
    bossNameState.loaded = !!bossNameState.loaded;
    bossNameState.refreshPromise = bossNameState.refreshPromise || null;
    bossNameState.updatedAt = Number(bossNameState.updatedAt) || 0;
    window.JunxueGanyuBossNameState = bossNameState;
    const boundNodes = new WeakSet();
    const live2dBindSelectors = [
        "#oml2d-stage",
        ".oml2d-stage",
        "#oml2d-main",
        ".oml2d-main",
        "#oml2d",
        ".oml2d",
        "#live2d-widget",
        "#live2d-widget canvas",
        "#oml2d-canvas",
        ".oml2d-canvas",
        "#oml2d-stage canvas",
        "canvas#live2d",
        "canvas[id*='live2d']",
        "canvas[class*='live2d']",
        "#ganyu-live2d-frame-shell",
        "#ganyu-live2d-frame",
        ".live2d-hit-area",
        ".ganyu-static-card"
    ];
    let lastBindCandidateSignature = "";
    let bindSelectorLogged = false;
    let hitDiagnosticInstalled = false;
    const ganyuUIState = installGanyuUIState();

    function installGanyuUIState() {
        const state = window.JunxueGanyuUIState || {};

        state.menuDepth = state.menuDepth || 0;
        state.panelDepth = state.panelDepth || 0;
        state.menuOpen = !!state.menuOpen;
        state.panelOpen = !!state.panelOpen;
        state.hideOrdinaryBubble = function () {
            if (window.JunxueGanyuTalk && typeof window.JunxueGanyuTalk.hide === "function") {
                window.JunxueGanyuTalk.hide();
            }
        };
        state.openMenu = function () {
            state.menuDepth = Math.max(1, state.menuDepth || 0);
            state.menuOpen = true;
            state.hideOrdinaryBubble();
        };
        state.closeMenu = function () {
            state.menuDepth = 0;
            state.menuOpen = false;
        };
        state.openPanel = function () {
            state.panelDepth = Math.max(1, state.panelDepth || 0);
            state.panelOpen = true;
            state.hideOrdinaryBubble();
        };
        state.closePanel = function () {
            state.panelDepth = 0;
            state.panelOpen = false;
        };
        state.closeAll = function () {
            state.closeMenu();
            state.closePanel();
        };
        state.isBusy = function () {
            return !!(state.menuOpen || state.panelOpen);
        };

        window.JunxueGanyuUIState = state;
        return state;
    }

    function isGanyuUIBusy() {
        return !!(ganyuUIState && typeof ganyuUIState.isBusy === "function" && ganyuUIState.isBusy());
    }

    function onReady(callback) {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", callback, { once: true });
            return;
        }

        callback();
    }

    function isLive2DDebugEnabled() {
        return /(?:^|[?&])live2dDebug=1(?:&|$)/.test(window.location.search || "");
    }

    function describeDomNode(node) {
        if (!node) {
            return null;
        }

        return {
            tagName: node.tagName || "",
            id: node.id || "",
            className: typeof node.className === "string" ? node.className : (node.className && node.className.baseVal ? node.className.baseVal : "")
        };
    }

    function sanitizeLive2DDebugDetail(detail) {
        if (!detail || typeof detail !== "object") {
            return null;
        }

        const safe = {};
        if (typeof detail.count === "number") {
            safe.count = detail.count;
        }
        if (detail.selector) {
            safe.selector = String(detail.selector).slice(0, 120);
        }
        if (detail.selectors && Array.isArray(detail.selectors)) {
            safe.selectors = detail.selectors.map(function (selector) {
                return String(selector).slice(0, 120);
            }).slice(0, 24);
        }
        if (detail.node) {
            safe.node = describeDomNode(detail.node);
        }
        if (detail.nodes && Array.isArray(detail.nodes)) {
            safe.nodes = detail.nodes.map(describeDomNode).filter(Boolean).slice(0, 8);
        }
        if (detail.path && Array.isArray(detail.path)) {
            safe.path = detail.path.map(describeDomNode).filter(Boolean).slice(0, 3);
        }
        if (detail.reason) {
            safe.reason = String(detail.reason).slice(0, 80);
        }
        return safe;
    }

    function pushLive2DDebug(message, detail) {
        const safeMessage = String(message || "");
        const safeDetail = sanitizeLive2DDebugDetail(detail);
        try {
            window.__JUNXUE_LIVE2D_DEBUG__ = window.__JUNXUE_LIVE2D_DEBUG__ || [];
            window.__JUNXUE_LIVE2D_DEBUG__.push({
                time: new Date().toISOString(),
                message: safeMessage,
                detail: safeDetail
            });
            window.console.log("[live2d-debug] " + safeMessage, safeDetail || "");
        } catch (error) {
            window.console.log("[live2d-debug] " + safeMessage);
        }
    }

    function debugLive2DEntry(scope, message, detail) {
        if (window.console && typeof window.console.debug === "function") {
            window.console.debug("[" + scope + "] " + message, sanitizeLive2DDebugDetail(detail) || "");
        }
        pushLive2DDebug((scope === "live2d-pc" ? "pc " : "mobile ") + message, detail);
    }

    function logBindSelectorsOnce() {
        if (bindSelectorLogged) {
            return;
        }

        bindSelectorLogged = true;
        debugLive2DEntry("live2d-pc", "bind selectors", {
            selectors: live2dBindSelectors
        });
    }

    function installClickHitDiagnostic() {
        if (hitDiagnosticInstalled || !isLive2DDebugEnabled()) {
            return;
        }

        hitDiagnosticInstalled = true;
        document.addEventListener("click", function (event) {
            const path = event.composedPath ? event.composedPath() : [];
            const nodes = path.length ? path : [event.target];
            debugLive2DEntry("live2d-pc", "click hit path", {
                path: nodes.slice(0, 3)
            });
        }, true);
    }

    function playOpeningVoice() {
        const audio = new Audio(openingVoicePath);

        audio.volume = 0.8;
        return new Promise(function (resolve) {
            let done = false;
            let started = false;
            const timer = window.setTimeout(finish, 8000);

            function finish() {
                if (done) {
                    return;
                }

                done = true;
                window.clearTimeout(timer);
                resolve(started);
            }

            function markStarted() {
                started = true;
            }

            audio.addEventListener("ended", finish, { once: true });
            audio.addEventListener("error", finish, { once: true });

            const playRequest = audio.play();

            if (playRequest && typeof playRequest.then === "function") {
                playRequest.then(markStarted).catch(finish);
                return;
            }

            markStarted();
        });
    }

    function ensureOpeningBubbleStyles() {
        if (document.getElementById("live2d-opening-bubble-style")) {
            return;
        }

        const style = document.createElement("style");
        style.id = "live2d-opening-bubble-style";
        style.textContent = [
            ".live2d-opening-bubble{position:fixed;left:252px;top:160px;z-index:61;width:min(328px,calc(100vw - 32px));padding:12px 14px;border:1px solid rgba(255,236,245,.88);border-radius:16px;background:rgba(255,178,211,.76);box-shadow:0 0 22px rgba(255,142,196,.38),inset 0 0 14px rgba(255,255,255,.16);backdrop-filter:blur(10px);color:rgba(92,28,58,.96);font-size:14px;line-height:1.55;letter-spacing:0;pointer-events:none;opacity:0;transform:translateY(8px);transition:opacity .35s ease,transform .35s ease;}",
            ".live2d-opening-bubble.is-open{opacity:1;transform:translateY(0);}",
            ".live2d-opening-bubble.is-fading{opacity:0;transform:translateY(-6px);}",
            ".live2d-quiz-exit-bubble{position:fixed;left:252px;top:160px;z-index:62;width:min(318px,calc(100vw - 32px));padding:12px 14px;border:1px solid rgba(213,244,255,.76);border-radius:16px;background:linear-gradient(145deg,rgba(255,178,218,.7),rgba(126,219,255,.58));box-shadow:0 0 22px rgba(126,219,255,.28),0 0 18px rgba(255,142,196,.24),inset 0 0 14px rgba(255,255,255,.14);backdrop-filter:blur(10px);color:rgba(50,32,72,.96);font-size:14px;line-height:1.55;letter-spacing:0;white-space:pre-line;pointer-events:none;opacity:0;transform:translateY(8px);transition:opacity .35s ease,transform .35s ease;}",
            ".live2d-quiz-exit-bubble.is-open{opacity:1;transform:translateY(0);}",
            ".live2d-quiz-exit-bubble.is-fading{opacity:0;transform:translateY(-6px);}",
            ".live2d-companion-bubble{display:none!important;}",
            "#oml2d-tips{display:none!important;}",
            "@media (max-width:767px),(max-width:932px) and (orientation:landscape){.live2d-opening-bubble,.live2d-quiz-exit-bubble{width:min(92vw,320px);max-width:calc(100vw - 24px);font-size:13px;box-sizing:border-box;}body.keyboard-open .live2d-opening-bubble,body.keyboard-open .live2d-quiz-exit-bubble{left:50%!important;right:auto!important;top:max(12px,env(safe-area-inset-top))!important;bottom:auto!important;width:min(92vw,320px)!important;max-width:calc(100vw - 24px)!important;max-height:min(54vh,320px);max-height:min(54dvh,320px);overflow:auto;transform:translateX(-50%)!important;}}"
        ].join("");
        document.head.appendChild(style);
    }

    function createOpeningBubble() {
        ensureOpeningBubbleStyles();

        const bubble = document.createElement("div");
        bubble.className = "live2d-opening-bubble";
        bubble.setAttribute("aria-live", "polite");
        document.body.appendChild(bubble);
        return bubble;
    }

    function createCompanionBubble() {
        ensureOpeningBubbleStyles();

        const bubble = document.createElement("div");

        bubble.className = "live2d-companion-bubble";
        bubble.setAttribute("aria-live", "polite");
        document.body.appendChild(bubble);
        return bubble;
    }

    function getLive2DRect() {
        const selectors = ["#ganyu-live2d-frame-shell>.live2d-hit-area", "#ganyu-live2d-frame-shell", "#ganyu-live2d-frame", ".ganyu-static-card", "#oml2d-stage", "#oml2d-canvas", ".live2d-hit-area"];

        for (let index = 0; index < selectors.length; index += 1) {
            const node = document.querySelector(selectors[index]);

            if (node && node.getBoundingClientRect) {
                const rect = node.getBoundingClientRect();

                if (rect.width > 0 && rect.height > 0) {
                    return rect;
                }
            }
        }

        return {
            left: 10,
            top: Math.max(0, window.innerHeight - 500),
            right: 270,
            bottom: window.innerHeight,
            width: 260,
            height: 400
        };
    }

    function positionLive2DPopup(node, options) {
        if (!node) {
            return;
        }

        const settings = Object.assign({
            width: 328,
            height: 96,
            offsetY: 56,
            gap: 18,
            margin: 12
        }, options || {});
        const rect = getLive2DRect();
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        const mobileMaxWidth = Math.max(160, Math.floor(viewportWidth * 0.72));
        const desktopMaxWidth = Math.max(160, viewportWidth - settings.margin * 2);
        const mobileLayout = isMobileLayoutViewport();
        const popupWidth = Math.min(node.offsetWidth || settings.width, mobileLayout ? mobileMaxWidth : desktopMaxWidth);
        const popupHeight = node.offsetHeight || settings.height;
        const maxLeft = Math.max(settings.margin, viewportWidth - popupWidth - settings.margin);
        const maxTop = Math.max(settings.margin, viewportHeight - popupHeight - settings.margin);
        const headBottom = rect.top + rect.height * 0.35;
        const preferredTop = Math.min(Math.max(settings.margin, rect.top + Math.max(settings.offsetY, rect.height * 0.38)), maxTop);
        const footTop = Math.min(Math.max(settings.margin, rect.bottom - popupHeight - settings.gap), maxTop);
        const candidates = [
            { left: rect.right + settings.gap, top: preferredTop },
            { left: rect.left - settings.gap - popupWidth, top: preferredTop },
            { left: Math.min(Math.max(settings.margin, rect.right - popupWidth), maxLeft), top: footTop }
        ];
        let nextLeft = candidates[2].left;
        let nextTop = candidates[2].top;

        node.style.maxWidth = mobileLayout ? "72vw" : "calc(100vw - " + (settings.margin * 2) + "px)";

        function overlapsHead(left, top) {
            const right = left + popupWidth;
            const bottom = top + popupHeight;
            const overlapsX = right > rect.left && left < rect.right;
            const overlapsY = bottom > rect.top && top < headBottom;

            return overlapsX && overlapsY;
        }

        for (let index = 0; index < candidates.length; index += 1) {
            const candidate = candidates[index];
            const fitsViewport = candidate.left >= settings.margin &&
                candidate.left + popupWidth <= viewportWidth - settings.margin &&
                candidate.top >= settings.margin &&
                candidate.top + popupHeight <= viewportHeight - settings.margin;

            if (fitsViewport && !overlapsHead(candidate.left, candidate.top)) {
                nextLeft = candidate.left;
                nextTop = candidate.top;
                break;
            }
        }

        node.style.setProperty("position", "fixed", "important");
        if (node.classList && node.classList.contains("live2d-quiz")) {
            node.style.zIndex = "63";
        }
        node.style.left = Math.min(Math.max(settings.margin, nextLeft), maxLeft) + "px";
        node.style.top = Math.min(Math.max(settings.margin, nextTop), maxTop) + "px";
        node.style.right = "auto";
        node.style.bottom = "auto";
    }

    function showOpeningBubble() {
        if (isGanyuUIBusy()) {
            return;
        }

        if (!openingBubble) {
            return;
        }

        openingBubble.textContent = openingVoiceText;
        positionLive2DPopup(openingBubble, {
            width: 328,
            height: 96,
            offsetY: 56
        });
        openingBubble.classList.remove("is-fading");
        openingBubble.classList.add("is-open");
        window.clearTimeout(showOpeningBubble.timer);
        showOpeningBubble.timer = window.setTimeout(hideOpeningBubble, 7000);
    }

    function hideOpeningBubble() {
        if (!openingBubble) {
            return;
        }

        window.clearTimeout(showOpeningBubble.timer);
        openingBubble.classList.add("is-fading");
        openingBubble.classList.remove("is-open");
        window.clearTimeout(hideOpeningBubble.timer);
        hideOpeningBubble.timer = window.setTimeout(function () {
            openingBubble.classList.remove("is-fading");
            openingBubble.textContent = "";
        }, 360);
    }

    function syncBubbleNodePosition(bubble, options) {
        if (!bubble || !bubble.textContent) {
            return;
        }

        positionLive2DPopup(bubble, options);
    }

    function syncOpeningBubblePosition() {
        syncBubbleNodePosition(openingBubble, {
            width: 328,
            height: 96,
            offsetY: 56
        });
    }

    function syncCompanionBubblePosition() {
        const bubble = companionBubble || openingBubble;
        const usesOpeningBubble = bubble === openingBubble;
        syncBubbleNodePosition(bubble, usesOpeningBubble ? {
            width: 328,
            height: 96,
            offsetY: 56
        } : {
            width: 318,
            height: 92,
            offsetY: 62
        });
    }

    function syncVisibleBubblePositions() {
        if (popupSyncInProgress) {
            return;
        }

        popupSyncInProgress = true;
        try {
            syncOpeningBubblePosition();
            if (companionBubble && companionBubble !== openingBubble) {
                syncCompanionBubblePosition();
            }
        } finally {
            popupSyncInProgress = false;
        }
    }

    function schedulePopupPositionSync() {
        if (popupSyncFrame) {
            return;
        }

        popupSyncFrame = window.requestAnimationFrame(function () {
            popupSyncFrame = 0;
            syncVisibleBubblePositions();
        });
    }

    function pickRandomItem(items) {
        return items[Math.floor(Math.random() * items.length)];
    }

    function readStorage(key) {
        try {
            return localStorage.getItem(key) || "";
        } catch (error) {
            return "";
        }
    }

    function writeStorage(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (error) {
            return false;
        }
    }

    function removeStorage(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            return false;
        }
    }

    function readJsonStorage(key, fallback) {
        try {
            const raw = localStorage.getItem(key);

            return raw ? JSON.parse(raw) : fallback;
        } catch (error) {
            return fallback;
        }
    }

    function getNumericStorage(key, fallback) {
        const number = parseInt(readStorage(key), 10);

        return Number.isFinite(number) && number > 0 ? number : fallback;
    }

    function sanitizeBossDisplayName(value) {
        return String(value || "").trim().slice(0, 20);
    }

    function getGanyuBossDisplayName() {
        return sanitizeBossDisplayName(bossNameState.displayName) || BOSS_NAME_FALLBACK;
    }

    function setGanyuBossDisplayName(displayName, userId) {
        const nextName = sanitizeBossDisplayName(displayName) || BOSS_NAME_FALLBACK;

        bossNameState.displayName = nextName;
        bossNameState.loaded = true;
        bossNameState.loading = false;
        bossNameState.updatedAt = Date.now();
        currentBossNameUserId = userId || "";

        if (currentMemoryState && !memoryShownThisPage) {
            memoryMessage = buildGanyuMemoryMessage(currentMemoryState);
        }

        window.dispatchEvent(new CustomEvent("junxue-ganyu-boss-name-changed", {
            detail: {
                displayName: nextName
            }
        }));
    }

    function resetGanyuBossDisplayName() {
        setGanyuBossDisplayName(BOSS_NAME_FALLBACK, "");
    }

    function loadScriptOnce(src) {
        return new Promise(function (resolve, reject) {
            const existing = Array.prototype.find.call(document.scripts, function (script) {
                return script.getAttribute("src") === src;
            });

            if (existing) {
                if (existing.dataset.loaded === "true" || window.JunxueSupabaseClient) {
                    resolve();
                    return;
                }

                existing.addEventListener("load", resolve, { once: true });
                existing.addEventListener("error", reject, { once: true });
                return;
            }

            const script = document.createElement("script");

            script.src = src;
            script.async = true;
            script.onload = function () {
                script.dataset.loaded = "true";
                resolve();
            };
            script.onerror = function () {
                reject(new Error("script-load-failed"));
            };
            document.head.appendChild(script);
        });
    }

    async function getGanyuSupabaseClient() {
        if (!window.JunxueSupabaseClient || typeof window.JunxueSupabaseClient.getClient !== "function") {
            await loadScriptOnce("assets/supabase-client.js?v=20260627-home-performance1").catch(function () {});
        }

        if (!window.JunxueSupabaseClient || typeof window.JunxueSupabaseClient.getClient !== "function") {
            return null;
        }

        return await window.JunxueSupabaseClient.getClient();
    }

    function scheduleBossNameRefresh() {
        window.clearTimeout(bossNameRefreshTimer);
        bossNameRefreshTimer = window.setTimeout(function () {
            refreshGanyuBossDisplayName(true).catch(function () {});
        }, 120);
    }

    function bindBossNameAuthListener(client) {
        if (bossNameAuthListenerBound || !client || !client.auth || typeof client.auth.onAuthStateChange !== "function") {
            return;
        }

        bossNameAuthListenerBound = true;
        client.auth.onAuthStateChange(function (event) {
            if (event === "SIGNED_OUT") {
                resetGanyuBossDisplayName();
                return;
            }

            scheduleBossNameRefresh();
        });
    }

    async function refreshGanyuBossDisplayName(force) {
        if (bossNameState.refreshPromise && !force) {
            return bossNameState.refreshPromise;
        }

        bossNameState.loading = true;
        bossNameState.refreshPromise = (async function () {
            try {
                const client = await getGanyuSupabaseClient();

                if (!client || !client.auth || typeof client.auth.getSession !== "function") {
                    resetGanyuBossDisplayName();
                    return getGanyuBossDisplayName();
                }

                bindBossNameAuthListener(client);

                const sessionResponse = await client.auth.getSession();
                if (sessionResponse.error) {
                    throw sessionResponse.error;
                }

                const session = sessionResponse.data ? sessionResponse.data.session : null;
                const user = session && session.user ? session.user : null;
                if (!user || !user.id) {
                    resetGanyuBossDisplayName();
                    return getGanyuBossDisplayName();
                }

                if (!force && currentBossNameUserId === user.id && sanitizeBossDisplayName(bossNameState.displayName) && bossNameState.loaded) {
                    return getGanyuBossDisplayName();
                }

                const response = await client
                    .from("boss_profiles")
                    .select("display_name")
                    .eq("user_id", user.id)
                    .maybeSingle();

                if (response.error) {
                    throw response.error;
                }

                setGanyuBossDisplayName(response.data && response.data.display_name, user.id);
                return getGanyuBossDisplayName();
            } catch (error) {
                resetGanyuBossDisplayName();
                return getGanyuBossDisplayName();
            } finally {
                bossNameState.loading = false;
                bossNameState.refreshPromise = null;
            }
        }());

        return bossNameState.refreshPromise;
    }

    function getFavoriteCityFromHistory() {
        const history = readJsonStorage(memoryStorageKeys.cityHistory, {});
        let favoriteCity = "";
        let favoriteCount = 0;

        Object.keys(history || {}).forEach(function (city) {
            const count = Number(history[city]) || 0;

            if (count > favoriteCount) {
                favoriteCity = city;
                favoriteCount = count;
            }
        });

        return favoriteCity || readStorage(memoryStorageKeys.favoriteCity);
    }

    function getDaysKnown(firstVisitAt) {
        const first = firstVisitAt ? new Date(firstVisitAt) : null;

        if (!first || Number.isNaN(first.getTime())) {
            return 0;
        }

        const firstDay = new Date(first.getFullYear(), first.getMonth(), first.getDate()).getTime();
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const days = Math.floor((today - firstDay) / (24 * 60 * 60 * 1000)) + 1;

        return Math.max(1, days);
    }

    function getDateDistanceInDays(previousDate, currentDate) {
        if (!previousDate || !currentDate) {
            return null;
        }

        const previousParts = previousDate.split("-").map(Number);
        const currentParts = currentDate.split("-").map(Number);

        if (previousParts.length !== 3 || currentParts.length !== 3) {
            return null;
        }

        const previousTime = new Date(previousParts[0], previousParts[1] - 1, previousParts[2]).getTime();
        const currentTime = new Date(currentParts[0], currentParts[1] - 1, currentParts[2]).getTime();

        if (!Number.isFinite(previousTime) || !Number.isFinite(currentTime)) {
            return null;
        }

        return Math.round((currentTime - previousTime) / (24 * 60 * 60 * 1000));
    }

    function playOptionalVoice(file) {
        if (!file) {
            return;
        }

        try {
            const audio = new Audio(file);

            audio.volume = 0.8;
            audio.addEventListener("error", function () {
                pushLive2DDebug("optional voice load failed", {
                    reason: "audio error"
                });
            }, { once: true });
            audio.play().catch(function () {
                pushLive2DDebug("optional voice play skipped", {
                    reason: "play rejected"
                });
            });
        } catch (error) {}
    }

    function getLive2DStageNode() {
        return document.querySelector("#oml2d-stage") ||
            document.querySelector(".oml2d-stage") ||
            document.querySelector("#live2d-widget");
    }

    function animateLive2DStage(className, duration) {
        const stage = getLive2DStageNode();

        if (!stage) {
            return;
        }

        stage.classList.remove(className);
        void stage.offsetWidth;
        stage.classList.add(className);
        window.clearTimeout(animateLive2DStage[className]);
        animateLive2DStage[className] = window.setTimeout(function () {
            stage.classList.remove(className);
        }, duration);
    }

    function tryTriggerLive2DGesture(kind) {
        const candidates = [
            window.OML2D,
            window.oml2d,
            window.Live2DWidget,
            window.Live2DWidget && window.Live2DWidget.model,
            window.Live2DWidget && window.Live2DWidget.stage
        ];
        const motionNames = kind === "start" ? ["FlickHead", "TapBody"] : ["TapBody", "Idle"];
        const expressionNames = kind === "start" ? ["sad", "shy", "f01"] : ["smile", "happy", "f02"];

        candidates.forEach(function (api) {
            if (!api) {
                return;
            }

            try {
                if (typeof api.motion === "function") {
                    api.motion(motionNames[0]);
                } else if (typeof api.startMotion === "function") {
                    api.startMotion(motionNames[0]);
                } else if (typeof api.expression === "function") {
                    api.expression(expressionNames[0]);
                } else if (typeof api.setExpression === "function") {
                    api.setExpression(expressionNames[0]);
                }
            } catch (error) {}
        });
    }

    function canShowDragStartDialogue() {
        const now = Date.now();

        if (now - lastDragStartDialogueAt < 8000) {
            return false;
        }

        if (isGanyuInteractionBusy()) {
            return false;
        }

        lastDragStartDialogueAt = now;
        return true;
    }

    function showCompanionBubble(text, voice, duration) {
        if (!text) {
            return;
        }

        if (isGanyuUIBusy()) {
            return;
        }

        if (!openingBubble) {
            openingBubble = createOpeningBubble();
        }

        openingBubble.textContent = text;
        positionLive2DPopup(openingBubble, {
            width: 328,
            height: 96,
            offsetY: 56
        });
        openingBubble.classList.remove("is-fading");
        openingBubble.classList.add("is-open");
        playOptionalVoice(voice);
        window.clearTimeout(showCompanionBubble.timer);
        window.clearTimeout(showOpeningBubble.timer);
        showCompanionBubble.timer = window.setTimeout(function () {
            openingBubble.classList.add("is-fading");
            openingBubble.classList.remove("is-open");
            window.clearTimeout(showCompanionBubble.fadeTimer);
            showCompanionBubble.fadeTimer = window.setTimeout(function () {
                openingBubble.classList.remove("is-fading");
                openingBubble.textContent = "";
            }, 360);
        }, duration || 5200);
    }

    function hideCompanionBubble() {
        if (!openingBubble) {
            return;
        }

        window.clearTimeout(showCompanionBubble.timer);
        window.clearTimeout(showCompanionBubble.fadeTimer);
        window.clearTimeout(showOpeningBubble.timer);
        openingBubble.classList.remove("is-open", "is-fading");
        openingBubble.textContent = "";
    }

    function getTimePeriod() {
        const hour = new Date().getHours();

        if (hour >= 6 && hour < 12) {
            return "morning";
        }

        if (hour >= 12 && hour < 18) {
            return "afternoon";
        }

        if (hour >= 18) {
            return "evening";
        }

        return "lateNight";
    }

    function getIdleLine() {
        const periodLines = timeDialogueLines[getTimePeriod()] || [];
        const lastFeature = readStorage(memoryStorageKeys.lastFeature);

        if (lastFeature && Math.random() < 0.18) {
            return "上次你用了" + lastFeature + "，今天还想继续吗？";
        }

        if (periodLines.length && Math.random() < 0.45) {
            return pickRandomItem(periodLines);
        }

        return pickRandomItem(ganyuIdleLines);
    }

    function formatLocalDate(date) {
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return date.getFullYear() + "-" + month + "-" + day;
    }

    function getStoredVisitCount() {
        const rawCount = readStorage(memoryStorageKeys.visitCount);
        const count = parseInt(rawCount || "0", 10);

        return Number.isFinite(count) && count > 0 ? count : 0;
    }

    function countGanyuVisitOnce() {
        if (window.__junxueGanyuMemoryCounted) {
            return window.__junxueGanyuMemoryState || null;
        }

        try {
            const now = new Date();
            const nowValue = now.toISOString();
            const today = formatLocalDate(now);
            const previousLastVisitAt = readStorage(memoryStorageKeys.lastVisitAt);
            const previousSeenDate = readStorage(memoryStorageKeys.lastSeenDate);
            const previousCount = getStoredVisitCount();
            const visitCount = previousCount + 1;
            const previousStreak = getNumericStorage(memoryStorageKeys.streakDays, 0);
            const dateDistance = getDateDistanceInDays(previousSeenDate, today);
            let streakDays = 1;
            let firstVisitAt = readStorage(memoryStorageKeys.firstVisitAt);

            if (dateDistance === 0 && previousStreak > 0) {
                streakDays = previousStreak;
            } else if (dateDistance === 1 && previousStreak > 0) {
                streakDays = previousStreak + 1;
            }

            if (!firstVisitAt) {
                firstVisitAt = nowValue;
                writeStorage(memoryStorageKeys.firstVisitAt, firstVisitAt);
            }

            writeStorage(memoryStorageKeys.visitCount, String(visitCount));
            writeStorage(memoryStorageKeys.streakDays, String(streakDays));
            writeStorage(memoryStorageKeys.lastVisitAt, nowValue);
            writeStorage(memoryStorageKeys.lastSeenDate, today);

            window.__junxueGanyuMemoryCounted = true;
            window.__junxueGanyuMemoryState = {
                visitCount: visitCount,
                firstVisitAt: firstVisitAt,
                previousLastVisitAt: previousLastVisitAt,
                currentVisitAt: nowValue,
                streakDays: streakDays,
                daysKnown: getDaysKnown(firstVisitAt)
            };

            return window.__junxueGanyuMemoryState;
        } catch (error) {
            return null;
        }
    }

    function buildGanyuMemoryMessage(memoryState) {
        if (!memoryState || !memoryState.visitCount) {
            return "";
        }

        let baseLine = "";
        const count = memoryState.visitCount;
        const displayName = getGanyuBossDisplayName();

        if (count === 1) {
            baseLine = "你好呀，" + displayName + "，我是甘雨。\n以后这里也会记得你来过哦。";
        } else if (count === 2) {
            baseLine = "欢迎回来，" + displayName + "。\n能再见到你，我很开心。";
        } else if (count < 10) {
            baseLine = pickRandomItem([
                "今天也见到你了呢，" + displayName + "。",
                "欢迎回来，" + displayName + "。",
                "最近常常能见到你，" + displayName + "。"
            ]);
        } else {
            baseLine = pickRandomItem([
                "已经见过你很多次了呢，" + displayName + "。",
                "能陪你这么久，我很开心，" + displayName + "。",
                "欢迎回来，" + displayName + "，这里一直为你留着位置。"
            ]);
        }

        if (memoryState.streakDays >= 2) {
            baseLine += "\n已经连续来看我" + memoryState.streakDays + "天了呢。\n谢谢你一直来看我。";
        }

        if (memoryState.previousLastVisitAt) {
            const previous = new Date(memoryState.previousLastVisitAt).getTime();
            const now = new Date(memoryState.currentVisitAt).getTime();

            if (Number.isFinite(previous) && Number.isFinite(now) && now > previous) {
                const elapsed = now - previous;
                const oneDay = 24 * 60 * 60 * 1000;
                const sevenDays = 7 * oneDay;

                if (elapsed > sevenDays) {
                    baseLine += "\n好久不见。\n这段时间，你还好吗？";
                } else if (elapsed > oneDay) {
                    baseLine += "\n距离上次见面，已经过了一天呢。";
                }
            }
        }

        return baseLine;
    }

    function hasVisibleLive2D() {
        const selectors = ["#oml2d-stage", "#oml2d-canvas", ".live2d-hit-area"];

        if (document.body.classList.contains("live2d-hidden")) {
            return false;
        }

        for (let index = 0; index < selectors.length; index += 1) {
            const node = document.querySelector(selectors[index]);

            if (node && node.getBoundingClientRect) {
                const rect = node.getBoundingClientRect();

                if (rect.width > 0 && rect.height > 0) {
                    return true;
                }
            }
        }

        return false;
    }

    function isGanyuInteractionBusy() {
        return document.hidden ||
            isGanyuUIBusy() ||
            !!document.querySelector(".live2d-quiz.is-open") ||
            !!document.querySelector(".live2d-opening-bubble.is-open,.live2d-opening-bubble.is-fading") ||
            !!document.querySelector(".live2d-quiz-exit-bubble.is-open,.live2d-quiz-exit-bubble.is-fading") ||
            !!document.querySelector(".live2d-companion-bubble.is-open,.live2d-companion-bubble.is-fading") ||
            !!(openingBubble && openingBubble.textContent) ||
            !!(companionBubble && companionBubble.textContent);
    }

    function canShowGanyuMemory() {
        return window.enableGanyuMemory !== false &&
            !!memoryMessage &&
            !memoryShownThisPage &&
            !document.documentElement.classList.contains("performance-low") &&
            hasVisibleLive2D() &&
            !isGanyuInteractionBusy();
    }

    function tryShowGanyuMemory() {
        if (window.enableGanyuMemory === false || memoryShownThisPage || !memoryMessage) {
            memoryPending = false;
            return;
        }

        if (document.documentElement.classList.contains("performance-low") || document.body.classList.contains("live2d-hidden")) {
            memoryPending = false;
            return;
        }

        if (!canShowGanyuMemory()) {
            memoryAttempts += 1;

            if (memoryAttempts <= memoryMaxAttempts) {
                window.setTimeout(tryShowGanyuMemory, memoryRetryDelay);
                return;
            }

            memoryPending = false;
            return;
        }

        memoryPending = false;
        memoryShownThisPage = true;
        showCompanionBubble(memoryMessage, "", 6200);
    }

    function scheduleGanyuMemory(delay) {
        if (!memoryMessage || memoryShownThisPage || window.enableGanyuMemory === false) {
            return;
        }

        memoryPending = true;
        window.setTimeout(tryShowGanyuMemory, delay || 6500 + Math.random() * 1500);
    }

    function showBossNamePromptNotice() {
        showCompanionBubble("以后我会跟随老板账号昵称称呼你哦。", "", 4600);
    }

    function recordFeature(name) {
        if (name) {
            writeStorage(memoryStorageKeys.lastFeature, String(name));
        }
    }

    function recordWeatherCity(city) {
        const cityName = String(city || "").trim();

        if (!cityName) {
            return;
        }

        const history = readJsonStorage(memoryStorageKeys.cityHistory, {});

        history[cityName] = (Number(history[cityName]) || 0) + 1;
        writeStorage(memoryStorageKeys.cityHistory, JSON.stringify(history));
        writeStorage(memoryStorageKeys.favoriteCity, getFavoriteCityFromHistory());
    }

    function recordSong(title, src) {
        if (title) {
            writeStorage(memoryStorageKeys.lastSongTitle, String(title));
        }

        if (src) {
            writeStorage(memoryStorageKeys.lastSongSrc, String(src));
        }
    }

    function recordFortune(summary) {
        if (summary) {
            writeStorage(memoryStorageKeys.lastFortune, String(summary));
        }
    }

    function clearPreferences() {
        preferenceMemoryKeys.forEach(removeStorage);
    }

    function resetAllMemory() {
        try {
            const legacyNameKey = "ganyu" + "UserName";

            Object.keys(localStorage).forEach(function (key) {
                if (key.indexOf("ganyu") === 0 && key !== legacyNameKey) {
                    localStorage.removeItem(key);
                }
            });
        } catch (error) {}

        memoryMessage = "";
        memoryPending = false;
        memoryShownThisPage = true;
        showCompanionBubble("我明白了。不过，如果你愿意，我们还可以重新开始。", "", 5600);
    }

    function getGanyuMemorySnapshot() {
        const visitCount = getStoredVisitCount();
        const firstVisitAt = readStorage(memoryStorageKeys.firstVisitAt);
        const lastVisitAt = readStorage(memoryStorageKeys.lastVisitAt);

        return {
            visitCount: visitCount,
            streakDays: getNumericStorage(memoryStorageKeys.streakDays, 1),
            daysKnown: getDaysKnown(firstVisitAt),
            firstVisitAt: firstVisitAt,
            lastVisitAt: lastVisitAt,
            lastFeature: readStorage(memoryStorageKeys.lastFeature),
            favoriteCity: getFavoriteCityFromHistory(),
            cityHistory: readJsonStorage(memoryStorageKeys.cityHistory, {}),
            lastSongTitle: readStorage(memoryStorageKeys.lastSongTitle),
            lastSongSrc: readStorage(memoryStorageKeys.lastSongSrc),
            lastFortune: readStorage(memoryStorageKeys.lastFortune)
        };
    }

    function canShowCompanionIdle() {
        return window.enableGanyuIdleTalk !== false &&
            !memoryPending &&
            !document.hidden &&
            !document.querySelector(".live2d-quiz.is-open") &&
            !(openingBubble && openingBubble.textContent) &&
            !(companionBubble && companionBubble.textContent) &&
            !/(^|\/)suggest\.html(?:$|[?#])/i.test(window.location.pathname + window.location.search + window.location.hash);
    }

    function scheduleCompanionIdle(first) {
        window.clearTimeout(idleTalkTimer);

        if (window.enableGanyuIdleTalk === false) {
            return;
        }

        idleTalkTimer = window.setTimeout(function () {
            if (canShowCompanionIdle()) {
                showCompanionBubble(getIdleLine(), "", 4000 + Math.random() * 2000);
            }

            scheduleCompanionIdle(false);
        }, first ? 10000 : 45000 + Math.random() * 45000);
    }

    function getTouchRegion(event) {
        const rect = getLive2DRect();
        const touch = event && event.touches && event.touches[0] ? event.touches[0] : null;
        const clientY = event && typeof event.clientY === "number" ? event.clientY : (touch && typeof touch.clientY === "number" ? touch.clientY : rect.top + rect.height * 0.5);
        const ratio = rect.height > 0 ? (clientY - rect.top) / rect.height : 0.5;

        if (ratio <= 0.34) {
            return "head";
        }

        if (ratio >= 0.78) {
            return "foot";
        }

        return "body";
    }

    function hasPlayedFirstClickVoice() {
        try {
            return localStorage.getItem(firstClickVoiceStorageKey) === "true";
        } catch (error) {
            return true;
        }
    }

    function showTouchDialogue(event) {
        if (!event || !hasPlayedFirstClickVoice() || isGanyuUIBusy()) {
            return;
        }

        const lines = touchDialogueLines[getTouchRegion(event)] || touchDialogueLines.body;
        const line = pickRandomItem(lines);

        showCompanionBubble(line.text, line.voice, 4800);
    }

    function removeOpeningVoiceFallback() {
        document.removeEventListener("click", handleOpeningVoiceGesture, true);
        document.removeEventListener("touchstart", handleOpeningVoiceGesture, true);
        openingVoiceRetryBound = false;
        openingVoiceRetryPending = false;
    }

    function bindOpeningVoiceFallback() {
        if (openingVoiceRetryBound) {
            return;
        }

        openingVoiceRetryBound = true;
        document.addEventListener("click", handleOpeningVoiceGesture, true);
        document.addEventListener("touchstart", handleOpeningVoiceGesture, {
            capture: true,
            passive: true
        });
    }

    function tryPlayOpeningVoice(allowRetry) {
        if (openingVoicePlaying) {
            return Promise.resolve(false);
        }

        openingVoicePlaying = true;
        return playOpeningVoice().then(function (played) {
            openingVoicePlaying = false;

            if (!played && allowRetry) {
                openingVoiceRetryPending = true;
                bindOpeningVoiceFallback();
            } else if (played) {
                removeOpeningVoiceFallback();
            }

            return played;
        });
    }

    function retryOpeningVoiceFromGesture() {
        if (!openingVoiceRetryPending) {
            return;
        }

        removeOpeningVoiceFallback();
        tryPlayOpeningVoice(false);
    }

    function handleOpeningVoiceGesture() {
        retryOpeningVoiceFromGesture();
    }

    function createHitArea() {
        const existing = document.querySelector(".live2d-hit-area");

        if (existing) {
            return existing;
        }

        const area = document.createElement("button");
        area.className = "live2d-hit-area";
        area.type = "button";
        area.setAttribute("aria-label", "点击 Live2D 看板娘");
        document.body.appendChild(area);
        return area;
    }

    function findLive2DRoots() {
        const roots = [];

        live2dBindSelectors.forEach(function (selector) {
            document.querySelectorAll(selector).forEach(function (node) {
                if (!roots.includes(node)) {
                    roots.push(node);
                }
            });
        });

        return roots;
    }

    function loadLazyInteractions() {
        if (window.Live2DInteractiveMenu && typeof window.Live2DInteractiveMenu.open === "function") {
            return Promise.resolve(window.Live2DInteractiveMenu);
        }

        if (lazyLoadPromise) {
            return lazyLoadPromise;
        }

        lazyLoadPromise = new Promise(function (resolve, reject) {
            const script = document.createElement("script");
            let done = false;

            function finish(error) {
                if (done) {
                    return;
                }

                done = true;
                if (error) {
                    reject(error);
                    return;
                }

                if (window.Live2DInteractiveMenu && typeof window.Live2DInteractiveMenu.open === "function") {
                    resolve(window.Live2DInteractiveMenu);
                    return;
                }

                reject(new Error("live2d-lazy-module-missing"));
            }

            script.src = LAZY_SCRIPT_SRC;
            script.async = true;
            script.onload = function () {
                finish();
            };
            script.onerror = function () {
                finish(new Error("live2d-lazy-module-load-failed"));
            };
            document.head.appendChild(script);
        }).catch(function (error) {
            lazyLoadPromise = null;
            throw error;
        });

        return lazyLoadPromise;
    }

    function shouldOpenBossLoginFromQuery() {
        try {
            const params = new URLSearchParams(window.location.search);
            return params.get("bossLogin") === "1";
        } catch (error) {
            return false;
        }
    }

    function shouldOpenBossRegisteredFromQuery() {
        try {
            const params = new URLSearchParams(window.location.search);
            return params.get("bossRegistered") === "1";
        } catch (error) {
            return false;
        }
    }

    function openLazyMenu(event) {
        const isStaticButtonOpen = window.__JUNXUE_LIVE2D_OPEN_SOURCE__ === "static-open-button";
        const debugScope = isStaticButtonOpen ? "live2d-mobile" : "live2d-pc";
        if (!isStaticButtonOpen) {
            debugLive2DEntry("live2d-pc", "model click", {
                node: event && event.currentTarget ? event.currentTarget : null
            });
        }
        debugLive2DEntry(debugScope, "openLazyMenu start", {
            node: event && event.currentTarget ? event.currentTarget : null
        });

        if (window.JunxueLive2DDrag && typeof window.JunxueLive2DDrag.shouldIgnoreMenuEvent === "function" && window.JunxueLive2DDrag.shouldIgnoreMenuEvent(event)) {
            debugLive2DEntry(debugScope, "open ignored: drag suppress", {
                reason: "drag suppress"
            });
            return;
        }

        debugLive2DEntry(debugScope, "open allowed");

        if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
        }

        if (event && typeof event.stopPropagation === "function") {
            event.stopPropagation();
        }

        retryOpeningVoiceFromGesture();
        loadLazyInteractions().then(function (menu) {
            if (menu && typeof menu.open === "function") {
                debugLive2DEntry(debugScope, "Live2DInteractiveMenu.open exists");
            }
            menu.open(event);
            debugLive2DEntry(debugScope, "menu open called");
        }).catch(function () {});
    }

    function bindNode(node) {
        if (!node || !(node instanceof Element)) {
            debugLive2DEntry("live2d-pc", "bindNode skipped", {
                reason: "invalid node"
            });
            return;
        }

        if (boundNodes.has(node)) {
            return;
        }

        debugLive2DEntry("live2d-pc", "bindNode called", {
            node: node
        });

        boundNodes.add(node);
        node.style.pointerEvents = "auto";
        node.addEventListener("click", openLazyMenu, true);
        debugLive2DEntry("live2d-pc", "bindNode attached", {
            node: node
        });
    }

    function bindLive2DRoots() {
        const roots = findLive2DRoots();
        const signature = roots.map(function (node) {
            const info = describeDomNode(node);
            return [info.tagName, info.id, info.className].join(".");
        }).join("|");

        if (signature !== lastBindCandidateSignature) {
            lastBindCandidateSignature = signature;
            debugLive2DEntry("live2d-pc", roots.length ? "bind candidates found" : "bind target not found", {
                count: roots.length,
                nodes: roots
            });
        }

        roots.forEach(bindNode);
    }

    function initBootstrap() {
        if (bootstrapReady) {
            return;
        }

        bootstrapReady = true;
        logBindSelectorsOnce();
        installClickHitDiagnostic();
        openingBubble = createOpeningBubble();
        hitArea = createHitArea();
        bindNode(hitArea);
        bindLive2DRoots();

        const observer = new MutationObserver(bindLive2DRoots);
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        window.setTimeout(bindLive2DRoots, 500);
        window.setTimeout(bindLive2DRoots, 1500);
        window.setTimeout(bindLive2DRoots, 3000);
        window.addEventListener("live2d-stage-position-changed", schedulePopupPositionSync);
        window.addEventListener("resize", schedulePopupPositionSync);
        window.addEventListener("orientationchange", schedulePopupPositionSync);
        if (window.visualViewport) {
            window.visualViewport.addEventListener("resize", schedulePopupPositionSync);
            window.visualViewport.addEventListener("scroll", schedulePopupPositionSync, { passive: true });
        }
        document.addEventListener("visibilitychange", function () {
            if (!document.hidden) {
                schedulePopupPositionSync();
            }
        });
        window.setTimeout(syncVisibleBubblePositions, 500);
        window.setTimeout(syncVisibleBubblePositions, 1500);
        window.setTimeout(syncVisibleBubblePositions, 3000);
        currentMemoryState = countGanyuVisitOnce();
        memoryMessage = buildGanyuMemoryMessage(currentMemoryState);
        if (!memoryMessage) {
            showOpeningBubble();
        }
        refreshGanyuBossDisplayName(false).catch(function () {});
        tryPlayOpeningVoice(true);
        scheduleGanyuMemory();
        scheduleCompanionIdle(true);
        window.JunxueGanyuTalk = {
            handlesIdle: true,
            say: showCompanionBubble,
            hide: hideCompanionBubble,
            sync: syncCompanionBubblePosition
        };
        window.JunxueGanyuMemory = {
            getSnapshot: getGanyuMemorySnapshot,
            clearPreferences: clearPreferences,
            resetAllMemory: resetAllMemory,
            recordFeature: recordFeature,
            recordWeatherCity: recordWeatherCity,
            recordSong: recordSong,
            recordFortune: recordFortune
        };
        window.JunxueGanyuMemory["show" + "NamePrompt"] = showBossNamePromptNotice;
        window.JunxueGanyuLazy = {
            load: loadLazyInteractions,
            openMenu: openLazyMenu,
            openBossReviews: function () {
                return loadLazyInteractions().then(function (menu) {
                    if (menu && typeof menu.openBossReviews === "function") {
                        menu.openBossReviews();
                        return;
                    }

                    if (menu && typeof menu.open === "function") {
                        menu.open();
                    }
                });
            }
        };
        if (shouldOpenBossLoginFromQuery()) {
            loadLazyInteractions().then(function (menu) {
                if (menu && typeof menu.openBossLogin === "function") {
                    menu.openBossLogin();
                }
            }).catch(function () {});
        }
        if (shouldOpenBossRegisteredFromQuery()) {
            loadLazyInteractions().then(function (menu) {
                if (menu && typeof menu.openBossRegisteredPrompt === "function") {
                    menu.openBossRegisteredPrompt();
                }
            }).catch(function () {});
        }
        window.addEventListener("live2d-stage-drag-started", function () {
            animateLive2DStage("is-ganyu-drag-startled", 560);
            tryTriggerLive2DGesture("start");

            if (canShowDragStartDialogue()) {
                showCompanionBubble("你要带甘雨去哪里呀？", "", 3600);
            }
        });
        window.addEventListener("live2d-stage-drag-finished", function () {
            const line = pickRandomItem(dragDialogueLines);

            animateLive2DStage("is-ganyu-drag-bounce", 680);
            tryTriggerLive2DGesture("finish");
            showCompanionBubble(line.text, line.voice, 4800);
        });
        window.addEventListener("ganyu-live2d-visible", function () {
            if (!memoryShownThisPage && memoryMessage) {
                memoryAttempts = 0;
                scheduleGanyuMemory(900);
            }
        });
    }

    onReady(initBootstrap);
})();
