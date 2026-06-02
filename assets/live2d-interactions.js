/* Live2D 轻量启动脚本：首屏只保留开场提示、点击入口和懒加载控制。 */
(function () {
    const LAZY_SCRIPT_SRC = "assets/live2d-interactions-lazy.js?v=20260602-1";
    const openingVoiceText = "万家灯火就在眼前，人们的生活究竟是什么样的呢…欸？你想邀我去夜市？啊…不，不好意思，我就不去了吧。";
    const openingVoicePath = "assets/audio/ganyu_opening.mp3";

    let openingVoicePlaying = false;
    let openingVoiceRetryPending = false;
    let openingVoiceRetryBound = false;
    let lazyLoadPromise = null;
    let bootstrapReady = false;
    let openingBubble = null;
    let hitArea = null;
    const boundNodes = new WeakSet();

    function onReady(callback) {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", callback, { once: true });
            return;
        }

        callback();
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
            "@media (max-width:720px){.live2d-opening-bubble{width:min(300px,calc(100vw - 28px));font-size:13px;}}"
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

    function getLive2DRect() {
        const selectors = ["#oml2d-stage", "#oml2d-canvas", ".live2d-hit-area"];

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
        const canShowRight = rect.right + settings.gap + settings.width <= viewportWidth - settings.margin;
        const rawLeft = canShowRight ? rect.right + settings.gap : rect.left - settings.gap - settings.width;
        const rawTop = rect.top + settings.offsetY;
        const nextLeft = Math.min(
            Math.max(settings.margin, rawLeft),
            Math.max(settings.margin, viewportWidth - settings.width - settings.margin)
        );
        const nextTop = Math.min(
            Math.max(settings.margin, rawTop),
            Math.max(settings.margin, viewportHeight - settings.height - settings.margin)
        );

        node.style.left = nextLeft + "px";
        node.style.top = nextTop + "px";
        node.style.right = "auto";
        node.style.bottom = "auto";
    }

    function showOpeningBubble() {
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

    function syncOpeningBubblePosition() {
        if (openingBubble && openingBubble.textContent) {
            positionLive2DPopup(openingBubble, {
                width: 328,
                height: 96,
                offsetY: 56
            });
        }
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
        const selectors = [
            "#live2d-widget",
            "#oml2d-stage",
            "#oml2d-canvas",
            ".live2d-hit-area"
        ];
        const roots = [];

        selectors.forEach(function (selector) {
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

    function openLazyMenu(event) {
        if (window.JunxueLive2DDrag && typeof window.JunxueLive2DDrag.shouldIgnoreMenuEvent === "function" && window.JunxueLive2DDrag.shouldIgnoreMenuEvent(event)) {
            return;
        }

        if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
        }

        if (event && typeof event.stopPropagation === "function") {
            event.stopPropagation();
        }

        retryOpeningVoiceFromGesture();
        loadLazyInteractions().then(function (menu) {
            menu.open(event);
        }).catch(function () {});
    }

    function bindNode(node) {
        if (!node || boundNodes.has(node)) {
            return;
        }

        boundNodes.add(node);
        node.style.pointerEvents = "auto";
        node.addEventListener("click", openLazyMenu, true);
        node.addEventListener("touchstart", openLazyMenu, {
            capture: true,
            passive: false
        });
    }

    function bindLive2DRoots() {
        findLive2DRoots().forEach(bindNode);
    }

    function initBootstrap() {
        if (bootstrapReady) {
            return;
        }

        bootstrapReady = true;
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
        window.addEventListener("live2d-stage-position-changed", syncOpeningBubblePosition);
        window.addEventListener("resize", syncOpeningBubblePosition);
        window.setTimeout(syncOpeningBubblePosition, 500);
        window.setTimeout(syncOpeningBubblePosition, 1500);
        window.setTimeout(syncOpeningBubblePosition, 3000);
        showOpeningBubble();
        tryPlayOpeningVoice(true);
    }

    onReady(initBootstrap);
})();
