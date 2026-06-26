/* Live2D direct drag: drag the Ganyu model area, while simple clicks still open the menu. */
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
    const STAGE_SELECTOR = "#oml2d-stage";
    const CANVAS_SELECTOR = "#oml2d-canvas";
    const FRAME_SHELL_SELECTOR = "#ganyu-live2d-frame-shell";
    const FRAME_SELECTOR = "#ganyu-live2d-frame";
    const HIT_AREA_SELECTOR = ".live2d-hit-area";
    const STATIC_CARD_SELECTOR = ".ganyu-static-card";
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
    let suppressNextClickUntil = 0;
    let resizeFrame = 0;

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

        return rect.right > 0 &&
            rect.bottom > 0 &&
            rect.left < window.innerWidth &&
            rect.top < window.innerHeight;
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

        return {
            left: 10,
            top: Math.max(0, window.innerHeight - 500),
            right: 310,
            bottom: window.innerHeight - 96,
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

    function clampPosition(position) {
        const rect = getStageRect();
        const width = Math.max(1, rect.width || 260);
        const height = Math.max(1, rect.height || 400);
        const stage = getStage();

        if (stage === getStaticCard()) {
            const margin = 12;
            const bottomReserve = Math.max(96, Math.round((window.innerHeight || 640) * 0.16));
            const maxLeft = Math.max(margin, window.innerWidth - width - margin);
            const maxTop = Math.max(margin, window.innerHeight - height - bottomReserve);

            return {
                left: clamp(position.left, margin, maxLeft),
                top: clamp(position.top, margin, maxTop)
            };
        }

        const minLeft = EDGE_LIMITS.leftVisible - width;
        const maxLeft = Math.max(minLeft, window.innerWidth - EDGE_LIMITS.rightVisible);
        const minTop = EDGE_LIMITS.topVisible - height;
        const maxTop = Math.max(minTop, window.innerHeight - EDGE_LIMITS.bottomVisible);

        return {
            left: clamp(position.left, minLeft, maxLeft),
            top: clamp(position.top, minTop, maxTop)
        };
    }

    function parseSavedPosition(raw) {
        try {
            const parsed = raw ? JSON.parse(raw) : null;

            if (parsed && Number.isFinite(parsed.left) && Number.isFinite(parsed.top)) {
                const maxOffsetX = Math.max(window.innerWidth || 0, 360) * 3;
                const maxOffsetY = Math.max(window.innerHeight || 0, 640) * 3;

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

    function readSavedPosition() {
        try {
            return parseSavedPosition(localStorage.getItem(STORAGE_KEY)) ||
                parseSavedPosition(localStorage.getItem(LEGACY_STORAGE_KEY));
        } catch (error) {
            return null;
        }
    }

    function savePosition(position) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
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
            savePosition(nextPosition);
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

    function shouldIgnoreMenuEvent(event) {
        if (Date.now() > suppressNextClickUntil) {
            return false;
        }

        if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
        }

        if (event && typeof event.stopPropagation === "function") {
            event.stopPropagation();
        }

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
            window.dispatchEvent(new CustomEvent("live2d-stage-drag-started", {
                detail: {
                    position: currentPosition || dragState.startPosition,
                    rect: getStageRect()
                }
            }));
        }

        event.preventDefault();
        event.stopPropagation();
        applyStagePosition({
            left: dragState.startPosition.left + deltaX,
            top: dragState.startPosition.top + deltaY
        }, false);
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
            markSuppressNextClick();
            savePosition(currentPosition || dragState.startPosition);
            window.dispatchEvent(new CustomEvent("live2d-stage-drag-finished", {
                detail: {
                    position: currentPosition || dragState.startPosition,
                    rect: getStageRect()
                }
            }));
            playDragEndAnimation();
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
        const savedPosition = currentPosition || readSavedPosition();

        if (savedPosition) {
            applyStagePosition(savedPosition, false);
        }
    }

    function syncAfterResize() {
        resizeFrame = 0;
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

    function syncRuntimeDom() {
        removeLegacyDragButton();

        if (!getStage()) {
            return;
        }

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
    }

    window.JunxueLive2DDrag = window.JunxueLive2DDrag || {};
    window.JunxueLive2DDrag.shouldIgnoreMenuEvent = shouldIgnoreMenuEvent;
    window.JunxueLive2DDrag.sync = syncRuntimeDom;
    window.JunxueLive2DDrag.scheduleSync = scheduleResizeSync;

    onReady(init);
})();
