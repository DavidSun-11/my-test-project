/* Live2D direct drag: drag the Ganyu model area, while simple clicks still open the menu. */
(function () {
    const version = "20260730-mobile-live2d-voice-layout1";
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
    window.JunxueLive2DDebugLog("drag loaded", { version: version, source: "live2d-drag" });
})();

(function () {
    if (window.__JUNXUE_LIVE2D_DRAG_INSTALLED__) {
        if (window.JunxueLive2DDrag && typeof window.JunxueLive2DDrag.scheduleSync === "function") {
            window.JunxueLive2DDrag.scheduleSync();
        }
        return;
    }

    window.__JUNXUE_LIVE2D_DRAG_INSTALLED__ = true;

    const STORAGE_KEY = "junxue-live2d-stage-position";
    const LEGACY_STORAGE_KEY = "ganyuLive2DPosition";
    const STATIC_POSITION_KEY = "junxue-live2d-static-position";
    const DYNAMIC_POSITION_KEY = "junxue-live2d-dynamic-position";
    const STAGE_SELECTOR = "#oml2d-stage";
    const CANVAS_SELECTOR = "#oml2d-canvas";
    const FRAME_SHELL_SELECTOR = "#ganyu-live2d-frame-shell";
    const FRAME_SELECTOR = "#ganyu-live2d-frame";
    const HIT_AREA_SELECTOR = ".live2d-hit-area";
    const STATIC_CARD_SELECTOR = ".ganyu-static-card";
    const MENU_REQUEST_EVENT = "junxue-live2d-open-menu-request";
    const BUTTON_CLASS = "live2d-drag-button";
    const DRAG_THRESHOLD = 8;
    const STAGE_Z_INDEX = 55;
    const CLICK_SUPPRESS_MS = 450;
    const EDGE_LIMITS = {
        leftVisible: 40,
        rightVisible: 80,
        topVisible: 40,
        bottomVisible: 80
    };

    let dragState = null;
    let currentPosition = null;
    let currentPositionMode = "";
    let suppressNextClickUntil = 0;
    let resizeFrame = 0;
    let stageResizeObserver = null;
    let observedStage = null;

    function debugMobile(message) {
        if (window.console && typeof window.console.debug === "function") {
            window.console.debug("[live2d-mobile] " + message);
        }
    }

    function onReady(callback) {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", callback, { once: true });
            return;
        }

        callback();
    }

    function injectStyles() {
        if (document.getElementById("live2d-direct-drag-style")) {
            return;
        }

        const style = document.createElement("style");
        style.id = "live2d-direct-drag-style";
        style.textContent = `
            .${BUTTON_CLASS} {
                display: none !important;
            }

            #oml2d-stage {
                pointer-events: auto !important;
                z-index: ${STAGE_Z_INDEX} !important;
            }

            #ganyu-live2d-frame-shell {
                pointer-events: none !important;
                z-index: ${STAGE_Z_INDEX} !important;
                overflow: visible !important;
            }

            #oml2d-canvas,
            #ganyu-live2d-frame-shell > .live2d-hit-area,
            #oml2d-statusBar,
            .live2d-hit-area,
            .ganyu-static-card {
                pointer-events: auto !important;
                touch-action: none;
                user-select: none;
                -webkit-user-select: none;
                -webkit-user-drag: none;
                cursor: grab;
            }

            .ganyu-static-card img {
                user-select: none;
                -webkit-user-select: none;
                -webkit-user-drag: none;
            }

            body.is-live2d-external-dragging,
            body.is-live2d-external-dragging #oml2d-stage,
            body.is-live2d-external-dragging #oml2d-canvas,
            body.is-live2d-external-dragging #ganyu-live2d-frame-shell,
            body.is-live2d-external-dragging .live2d-hit-area,
            body.is-live2d-external-dragging .ganyu-static-card {
                cursor: grabbing !important;
                user-select: none;
            }
        `;
        document.head.appendChild(style);
    }

    function isVisibleDragNode(node) {
        if (!node || !node.getBoundingClientRect) {
            return false;
        }

        const rect = node.getBoundingClientRect();

        if (rect.width <= 0 || rect.height <= 0) {
            return false;
        }

        if (window.getComputedStyle) {
            const style = window.getComputedStyle(node);

            if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity || 1) <= 0.01) {
                return false;
            }
        }

        const viewport = getViewportSize();
        return rect.right > 0 &&
            rect.bottom > 0 &&
            rect.left < viewport.width &&
            rect.top < viewport.height;
    }

    function firstUsableNode(selectors) {
        const nodes = selectors.map(function (selector) {
            return document.querySelector(selector);
        }).filter(Boolean);

        return nodes.find(isVisibleDragNode) || nodes[0] || null;
    }

    function getStage() {
        return firstUsableNode([STAGE_SELECTOR, FRAME_SHELL_SELECTOR, STATIC_CARD_SELECTOR]);
    }

    function isMobileViewport() {
        return !!(window.matchMedia && (
            window.matchMedia("(max-width: 767px)").matches ||
            window.matchMedia("(max-width: 932px) and (orientation: landscape)").matches
        ));
    }

    function getStageMode(stage) {
        if (stage && stage.matches && stage.matches(STATIC_CARD_SELECTOR)) {
            return "mobile-static";
        }
        if (stage && stage.id === "ganyu-live2d-frame-shell") {
            return "mobile-dynamic";
        }
        return "desktop";
    }

    function getPositionStorageKey(stage) {
        const mode = getStageMode(stage);
        if (mode === "mobile-static") {
            return STATIC_POSITION_KEY;
        }
        if (mode === "mobile-dynamic") {
            return DYNAMIC_POSITION_KEY;
        }
        return STORAGE_KEY;
    }

    function syncPositionMode(stage) {
        const nextMode = getStageMode(stage || getStage());
        if (currentPositionMode && currentPositionMode !== nextMode) {
            currentPosition = null;
        }
        currentPositionMode = nextMode;
        return nextMode;
    }

    function getCanvas() {
        return firstUsableNode([CANVAS_SELECTOR, FRAME_SELECTOR, STATIC_CARD_SELECTOR]);
    }

    function getStaticCard() {
        return document.querySelector(STATIC_CARD_SELECTOR);
    }

    function getHitArea() {
        return document.querySelector(HIT_AREA_SELECTOR);
    }

    function getDragTargets() {
        const targets = [];
        const stage = getStage();
        const staticCard = getStaticCard();
        const candidates = stage === staticCard ? [stage] : [stage, getCanvas(), getHitArea()];

        candidates.forEach(function (node) {
            if (node && !targets.includes(node)) {
                targets.push(node);
            }
        });
        return targets;
    }

    function getStageRect() {
        const stage = getStage();

        if (stage && stage.getBoundingClientRect) {
            const rect = stage.getBoundingClientRect();

            if (rect.width > 0 && rect.height > 0) {
                return rect;
            }
        }

        const canvas = getCanvas();

        if (canvas && canvas.getBoundingClientRect) {
            const rect = canvas.getBoundingClientRect();

            if (rect.width > 0 && rect.height > 0) {
                return rect;
            }
        }

        const viewport = getViewportSize();
        return {
            left: 10,
            top: Math.max(0, viewport.height - 500),
            right: 310,
            bottom: viewport.height - 96,
            width: 260,
            height: 400
        };
    }

    function clamp(value, min, max) {
        if (max < min) {
            return min;
        }

        return Math.min(Math.max(value, min), max);
    }

    function getViewportSize() {
        const viewport = window.visualViewport;
        return {
            width: Math.max(1, Math.floor((viewport && viewport.width) || window.innerWidth || document.documentElement.clientWidth || 1)),
            height: Math.max(1, Math.floor((viewport && viewport.height) || window.innerHeight || document.documentElement.clientHeight || 1))
        };
    }

    function clampPosition(position) {
        const viewport = getViewportSize();
        const rect = getStageRect();
        const width = Math.max(1, rect.width || 260);
        const height = Math.max(1, rect.height || 400);
        const stage = getStage();

        const stageMode = getStageMode(stage);
        if (stageMode === "mobile-static" || (stageMode === "mobile-dynamic" && isMobileViewport())) {
            const margin = 12;
            const bottomReserve = stageMode === "mobile-static" ? Math.max(96, Math.round(viewport.height * 0.16)) : Math.max(84, Math.round(viewport.height * 0.14));
            const maxLeft = Math.max(margin, viewport.width - width - margin);
            const maxTop = Math.max(margin, viewport.height - height - bottomReserve);

            return {
                left: clamp(position.left, margin, maxLeft),
                top: clamp(position.top, margin, maxTop)
            };
        }

        const minLeft = EDGE_LIMITS.leftVisible - width;
        const maxLeft = Math.max(minLeft, viewport.width - EDGE_LIMITS.rightVisible);
        const minTop = EDGE_LIMITS.topVisible - height;
        const maxTop = Math.max(minTop, viewport.height - EDGE_LIMITS.bottomVisible);

        return {
            left: clamp(position.left, minLeft, maxLeft),
            top: clamp(position.top, minTop, maxTop)
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
                    console.warn("Live2D saved position ignored because it is far outside the viewport.", parsed);
                    return null;
                }

                return parsed;
            }
        } catch (error) {
            return null;
        }

        return null;
    }

    function readSavedPosition(stage) {
        try {
            const target = stage || getStage();
            const mode = getStageMode(target);
            const scoped = parseSavedPosition(localStorage.getItem(getPositionStorageKey(target)));
            if (scoped || mode === "mobile-dynamic") {
                return scoped;
            }
            return parseSavedPosition(localStorage.getItem(STORAGE_KEY)) ||
                parseSavedPosition(localStorage.getItem(LEGACY_STORAGE_KEY));
        } catch (error) {
            return null;
        }
    }

    function savePosition(position, stage) {
        try {
            localStorage.setItem(getPositionStorageKey(stage || getStage()), JSON.stringify(position));
        } catch (error) {
            // Keep the current in-page position when localStorage is unavailable.
        }
    }

    function notifyStagePosition(position) {
        const rect = getStageRect();

        window.dispatchEvent(new CustomEvent("live2d-stage-position-changed", {
            detail: {
                position: position,
                rect: {
                    left: rect.left,
                    top: rect.top,
                    right: rect.right,
                    bottom: rect.bottom,
                    width: rect.width,
                    height: rect.height
                }
            }
        }));
    }

    function syncHitArea(position) {
        if (getStage() === getStaticCard()) {
            return;
        }

        const hitArea = getHitArea();
        const rect = getStageRect();

        if (!hitArea) {
            return;
        }

        hitArea.style.setProperty("position", "fixed", "important");
        hitArea.style.setProperty("left", position.left + "px", "important");
        hitArea.style.setProperty("top", position.top + "px", "important");
        hitArea.style.setProperty("right", "auto", "important");
        hitArea.style.setProperty("bottom", "auto", "important");
        hitArea.style.setProperty("width", rect.width + "px", "important");
        hitArea.style.setProperty("height", rect.height + "px", "important");
        hitArea.style.setProperty("z-index", String(STAGE_Z_INDEX + 1), "important");
        hitArea.style.setProperty("pointer-events", "auto", "important");
        hitArea.style.setProperty("touch-action", "none", "important");
        hitArea.style.setProperty("cursor", "grab", "important");
    }

    function applyStagePosition(position, shouldSave) {
        const stage = getStage();
        syncPositionMode(stage);
        const nextPosition = clampPosition(position);

        currentPosition = nextPosition;

        if (stage) {
            stage.style.setProperty("position", "fixed", "important");
            stage.style.setProperty("left", nextPosition.left + "px", "important");
            stage.style.setProperty("top", nextPosition.top + "px", "important");
            stage.style.setProperty("right", "auto", "important");
            stage.style.setProperty("bottom", "auto", "important");
            stage.style.setProperty("z-index", String(STAGE_Z_INDEX), "important");
            stage.style.setProperty("pointer-events", "auto", "important");
            stage.style.setProperty("touch-action", "none", "important");
            stage.style.setProperty("user-select", "none", "important");
            stage.style.setProperty("-webkit-user-select", "none", "important");
            stage.style.setProperty("-webkit-user-drag", "none", "important");
            stage.style.setProperty("cursor", "grab", "important");
        }

        syncHitArea(nextPosition);
        notifyStagePosition(nextPosition);

        if (shouldSave) {
            savePosition(nextPosition, stage);
        }
    }

    function removeLegacyDragButton() {
        document.querySelectorAll("." + BUTTON_CLASS).forEach(function (button) {
            button.remove();
        });
    }

    function setDragging(isDragging) {
        const stage = getStage();

        document.body.classList.toggle("is-live2d-external-dragging", isDragging);
        if (stage) {
            stage.classList.toggle("ganyu-dragging", isDragging);
            if (isDragging) {
                stage.classList.remove("ganyu-drag-end");
            }
        }
    }

    function playDragEndAnimation() {
        const stage = getStage();

        if (!stage) {
            return;
        }

        stage.classList.remove("ganyu-drag-end");
        window.requestAnimationFrame(function () {
            stage.classList.add("ganyu-drag-end");
            window.setTimeout(function () {
                stage.classList.remove("ganyu-drag-end");
            }, 720);
        });
    }

    function markSuppressNextClick() {
        suppressNextClickUntil = Date.now() + CLICK_SUPPRESS_MS;
    }

    function requestMenuFromTap(event, target) {
        if (!target || event.type !== "pointerup") {
            return;
        }

        if (!target.closest || !target.closest(STATIC_CARD_SELECTOR)) {
            return;
        }

        if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
        }

        if (event && typeof event.stopPropagation === "function") {
            event.stopPropagation();
        }

        target.dispatchEvent(new CustomEvent(MENU_REQUEST_EVENT, {
            bubbles: true,
            detail: {
                source: "live2d-drag-tap",
                bypassSuppress: true
            }
        }));

        if (window.JunxueLive2DLoader && typeof window.JunxueLive2DLoader.openMenuFromStaticCard === "function") {
            window.JunxueLive2DLoader.openMenuFromStaticCard(event, {
                source: "live2d-drag-tap",
                bypassSuppress: true
            });
        }
    }

    function shouldIgnoreMenuEvent(event) {
        if (!event) {
            return false;
        }

        if (Date.now() > suppressNextClickUntil) {
            return false;
        }

        if (event.type && event.type !== "click") {
            return false;
        }

        const target = event.target;
        if (target && target.closest && target.closest(".live2d-quiz")) {
            return false;
        }

        if (target && target.closest && target.closest("[data-live2d-action='open-menu']")) {
            return false;
        }

        if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
        }

        if (event && typeof event.stopPropagation === "function") {
            event.stopPropagation();
        }

        debugMobile("ignore ghost click after drag");
        return true;
    }

    function handlePointerDown(event) {
        if (event.button !== undefined && event.button !== 0) {
            return;
        }

        const interactiveTarget = event.target && event.target.closest ? event.target.closest("button,a,input,textarea,select") : null;
        if (interactiveTarget && interactiveTarget !== event.currentTarget && !interactiveTarget.classList.contains("live2d-hit-area")) {
            return;
        }

        const rect = getStageRect();
        const target = event.currentTarget;

        dragState = {
            pointerId: event.pointerId,
            target: target,
            startX: event.clientX,
            startY: event.clientY,
            startPosition: clampPosition({
                left: rect.left,
                top: rect.top
            }),
            pendingPosition: null,
            frame: 0,
            moved: false,
            started: false
        };

        if (target && target.setPointerCapture) {
            try {
                target.setPointerCapture(event.pointerId);
            } catch (error) {
                // Some mobile browsers may reject pointer capture for this target.
            }
        }
    }

    function flushDragPosition() {
        if (!dragState || !dragState.pendingPosition) {
            return;
        }

        const position = dragState.pendingPosition;
        dragState.pendingPosition = null;
        dragState.frame = 0;
        applyStagePosition(position, false);
    }

    function scheduleDragPosition(position) {
        if (!dragState) {
            return;
        }

        dragState.pendingPosition = position;

        if (dragState.frame) {
            return;
        }

        dragState.frame = window.requestAnimationFrame(flushDragPosition);
    }

    function handlePointerMove(event) {
        if (!dragState || dragState.pointerId !== event.pointerId) {
            return;
        }

        const deltaX = event.clientX - dragState.startX;
        const deltaY = event.clientY - dragState.startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (!dragState.moved && distance <= DRAG_THRESHOLD) {
            return;
        }

        if (!dragState.started) {
            dragState.started = true;
            dragState.moved = true;
            setDragging(true);
            debugMobile("static drag start");
            window.dispatchEvent(new CustomEvent("live2d-stage-drag-started", {
                detail: {
                    position: currentPosition || dragState.startPosition,
                    rect: getStageRect()
                }
            }));
        }

        event.preventDefault();
        event.stopPropagation();
        debugMobile("static drag move");
        scheduleDragPosition({
            left: dragState.startPosition.left + deltaX,
            top: dragState.startPosition.top + deltaY
        });
    }

    function handlePointerEnd(event) {
        if (!dragState || dragState.pointerId !== event.pointerId) {
            return;
        }

        const completedDrag = dragState.moved;
        const captureTarget = dragState.target;

        if (captureTarget && captureTarget.releasePointerCapture) {
            try {
                captureTarget.releasePointerCapture(event.pointerId);
            } catch (error) {
                // Ignore unsupported pointer release.
            }
        }

        if (completedDrag) {
            event.preventDefault();
            event.stopPropagation();
            if (dragState.frame) {
                window.cancelAnimationFrame(dragState.frame);
                dragState.frame = 0;
            }
            flushDragPosition();
            markSuppressNextClick();
            savePosition(currentPosition || dragState.startPosition, getStage());
            window.dispatchEvent(new CustomEvent("live2d-stage-drag-finished", {
                detail: {
                    position: currentPosition || dragState.startPosition,
                    rect: getStageRect()
                }
            }));
            playDragEndAnimation();
            debugMobile("static drag end");
        } else {
            requestMenuFromTap(event, captureTarget);
        }

        dragState = null;
        setDragging(false);
    }

    function bindDragTarget(node) {
        if (!node || node.dataset.live2dDirectDragReady === "true") {
            return;
        }

        node.dataset.live2dDirectDragReady = "true";
        node.addEventListener("pointerdown", handlePointerDown);
        node.addEventListener("pointermove", handlePointerMove);
        node.addEventListener("pointerup", handlePointerEnd);
        node.addEventListener("pointercancel", handlePointerEnd);
        node.addEventListener("click", function (event) {
            shouldIgnoreMenuEvent(event);
        }, true);
    }

    function restoreSavedPosition() {
        const stage = getStage();
        syncPositionMode(stage);
        const savedPosition = currentPosition || readSavedPosition(stage);

        if (savedPosition) {
            applyStagePosition(savedPosition, false);
        }
    }

    function syncAfterResize() {
        resizeFrame = 0;
        syncPositionMode(getStage());
        if (currentPosition) {
            applyStagePosition(currentPosition, true);
            return;
        }

        restoreSavedPosition();
    }

    function scheduleResizeSync() {
        if (resizeFrame) {
            return;
        }

        resizeFrame = window.requestAnimationFrame(syncAfterResize);
    }

    function observeStageSize(stage) {
        if (!stage || typeof window.ResizeObserver !== "function" || observedStage === stage) {
            return;
        }

        if (!stageResizeObserver) {
            stageResizeObserver = new window.ResizeObserver(scheduleResizeSync);
        }
        if (observedStage) {
            stageResizeObserver.unobserve(observedStage);
        }

        observedStage = stage;
        stageResizeObserver.observe(stage);
    }

    function syncRuntimeDom() {
        removeLegacyDragButton();

        const stage = getStage();
        if (!stage) {
            return;
        }

        syncPositionMode(stage);
        observeStageSize(stage);

        getDragTargets().forEach(bindDragTarget);

        if (dragState) {
            return;
        }

        restoreSavedPosition();

        const rect = getStageRect();
        if (rect.width < 80 || rect.height < 120) {
            console.warn("Live2D drag sync skipped abnormal stage rect.", {
                width: rect.width,
                height: rect.height
            });
        }
    }

    function init() {
        injectStyles();
        syncRuntimeDom();

        const observer = new MutationObserver(syncRuntimeDom);
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        window.addEventListener("resize", scheduleResizeSync);
        window.addEventListener("orientationchange", scheduleResizeSync);
        if (window.visualViewport) {
            window.visualViewport.addEventListener("resize", scheduleResizeSync);
            window.visualViewport.addEventListener("scroll", scheduleResizeSync, { passive: true });
        }
    }

    window.JunxueLive2DDrag = window.JunxueLive2DDrag || {};
    window.JunxueLive2DDrag.shouldIgnoreMenuEvent = shouldIgnoreMenuEvent;
    window.JunxueLive2DDrag.sync = syncRuntimeDom;
    window.JunxueLive2DDrag.scheduleSync = scheduleResizeSync;

    onReady(init);
})();
