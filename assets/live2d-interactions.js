/* Live2D 轻量启动脚本：首屏只保留开场提示、点击入口和懒加载控制。 */
(function () {
    const LAZY_SCRIPT_SRC = "assets/live2d-interactions-lazy.js?v=20260609-1";
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
        { text: "这里的位置不错呢。", voice: "assets/audio/ganyu_drag_done_1.mp3" },
        { text: "嗯，我会记住这里的。", voice: "assets/audio/ganyu_drag_done_2.mp3" },
        { text: "谢谢你帮我换了个位置。", voice: "assets/audio/ganyu_drag_done_3.mp3" }
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
            ".live2d-companion-bubble{position:fixed;left:252px;top:160px;z-index:63;width:min(318px,calc(100vw - 32px));padding:12px 14px;border:1px solid rgba(213,244,255,.78);border-radius:16px;background:linear-gradient(145deg,rgba(255,182,220,.72),rgba(132,221,255,.58));box-shadow:0 0 20px rgba(126,219,255,.26),0 0 16px rgba(255,142,196,.22),inset 0 0 14px rgba(255,255,255,.14);backdrop-filter:blur(10px);color:rgba(48,32,72,.96);font-size:14px;line-height:1.55;letter-spacing:0;pointer-events:none;white-space:pre-line;opacity:0;transform:translateY(8px);transition:opacity .35s ease,transform .35s ease;}",
            ".live2d-companion-bubble.is-open{opacity:1;transform:translateY(0);}",
            ".live2d-companion-bubble.is-fading{opacity:0;transform:translateY(-6px);}",
            "@media (max-width:768px){.live2d-opening-bubble,.live2d-quiz-exit-bubble,.live2d-companion-bubble{width:min(80vw,300px);max-width:80vw;font-size:13px;}}"
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
        const popupWidth = Math.min(node.offsetWidth || settings.width, Math.max(160, viewportWidth - settings.margin * 2));
        const popupHeight = node.offsetHeight || settings.height;
        const maxLeft = Math.max(settings.margin, viewportWidth - popupWidth - settings.margin);
        const maxTop = Math.max(settings.margin, viewportHeight - popupHeight - settings.margin);
        const hasRightSpace = rect.right + settings.gap + popupWidth <= viewportWidth - settings.margin;
        const hasLeftSpace = rect.left - settings.gap - popupWidth >= settings.margin;
        let nextLeft = rect.right + settings.gap;
        let nextTop = Math.min(Math.max(settings.margin, rect.top + settings.offsetY), maxTop);

        node.style.maxWidth = viewportWidth <= 768 ? "80vw" : "calc(100vw - " + (settings.margin * 2) + "px)";

        if (!hasRightSpace) {
            if (hasLeftSpace) {
                nextLeft = rect.left - settings.gap - popupWidth;
                nextTop = Math.min(Math.max(settings.margin, rect.top + settings.offsetY), maxTop);
            } else {
                nextLeft = Math.min(Math.max(settings.margin, rect.right - popupWidth), maxLeft);
                nextTop = rect.top - popupHeight - settings.gap;

                if (nextTop < settings.margin && rect.bottom + settings.gap + popupHeight <= viewportHeight - settings.margin) {
                    nextTop = rect.bottom + settings.gap;
                }
            }
        }

        node.style.left = Math.min(Math.max(settings.margin, nextLeft), maxLeft) + "px";
        node.style.top = Math.min(Math.max(settings.margin, nextTop), maxTop) + "px";
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

        syncCompanionBubblePosition();
    }

    function syncCompanionBubblePosition() {
        if (companionBubble && companionBubble.textContent) {
            positionLive2DPopup(companionBubble, {
                width: 318,
                height: 92,
                offsetY: 62
            });
        }
    }

    function pickRandomItem(items) {
        return items[Math.floor(Math.random() * items.length)];
    }

    function playOptionalVoice(file) {
        if (!file) {
            return;
        }

        try {
            const audio = new Audio(file);

            audio.volume = 0.8;
            audio.play().catch(function () {});
        } catch (error) {}
    }

    function showCompanionBubble(text, voice, duration) {
        if (!text) {
            return;
        }

        if (!companionBubble) {
            companionBubble = createCompanionBubble();
        }

        companionBubble.textContent = text;
        positionLive2DPopup(companionBubble, {
            width: 318,
            height: 92,
            offsetY: 62
        });
        companionBubble.classList.remove("is-fading");
        companionBubble.classList.add("is-open");
        playOptionalVoice(voice);
        window.clearTimeout(showCompanionBubble.timer);
        showCompanionBubble.timer = window.setTimeout(function () {
            companionBubble.classList.add("is-fading");
            companionBubble.classList.remove("is-open");
            window.clearTimeout(showCompanionBubble.fadeTimer);
            showCompanionBubble.fadeTimer = window.setTimeout(function () {
                companionBubble.classList.remove("is-fading");
                companionBubble.textContent = "";
            }, 360);
        }, duration || 5200);
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

        if (periodLines.length && Math.random() < 0.45) {
            return pickRandomItem(periodLines);
        }

        return pickRandomItem(ganyuIdleLines);
    }

    function canShowCompanionIdle() {
        return window.enableGanyuIdleTalk !== false &&
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
        if (!event || !hasPlayedFirstClickVoice()) {
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
        showTouchDialogue(event);
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
        scheduleCompanionIdle(true);
        window.JunxueGanyuTalk = {
            handlesIdle: true,
            say: showCompanionBubble,
            sync: syncCompanionBubblePosition
        };
        window.addEventListener("live2d-stage-drag-finished", function () {
            const line = pickRandomItem(dragDialogueLines);

            showCompanionBubble(line.text, line.voice, 4800);
        });
    }

    onReady(initBootstrap);
})();
