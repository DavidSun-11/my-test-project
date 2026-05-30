/* Live2D 拖动定位：绑定 OhMyLive2D 真实外层容器，并同步移动兜底 hit-area。 */
(function () {
    const STORAGE_KEY = "junxue-live2d-position";
    const DRAG_THRESHOLD = 5;
    const LAYER_Z_INDEX = 55;
    const DEFAULT_RESULT_TEXT = "君雪回到左下角啦。";
    const REAL_CONTAINER_SELECTOR = "#oml2d-main, .oml2d-main";
    const INTERACTIVE_SELECTOR = "#oml2d-main, .oml2d-main, .oml2d-stage, .oml2d-canvas, #oml2d-canvas, canvas, .live2d-hit-area";
    let currentPosition = null;
    let dragState = null;
    let suppressClickUntil = 0;

    function injectDragStyles() {
        if (document.getElementById("live2d-drag-style")) {
            return;
        }

        const style = document.createElement("style");
        style.id = "live2d-drag-style";
        style.textContent = [
            "#oml2d-main,.oml2d-main,.oml2d-stage,.oml2d-canvas,#oml2d-canvas,canvas,.live2d-hit-area{pointer-events:auto!important;touch-action:none;}",
            "#oml2d-main,.oml2d-main,.live2d-hit-area{z-index:" + LAYER_Z_INDEX + "!important;cursor:grab;}",
            "#oml2d-main.is-live2d-dragging,.oml2d-main.is-live2d-dragging,.live2d-hit-area.is-live2d-dragging{cursor:grabbing!important;}",
            "body.is-live2d-dragging,body.is-live2d-dragging *{cursor:grabbing!important;user-select:none;}",
            ".live2d-position-reset{border-color:rgba(255,221,114,.62)!important;background:rgba(255,221,114,.11)!important;color:#ffe8a3!important;}"
        ].join("\n");
        document.head.appendChild(style);
    }

    function onReady(callback) {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", callback, { once: true });
            return;
        }

        callback();
    }

    function uniqueNodes(nodes) {
        const result = [];

        nodes.forEach(function (node) {
            if (node && result.indexOf(node) === -1) {
                result.push(node);
            }
        });

        return result;
    }

    function getHitArea() {
        return document.querySelector(".live2d-hit-area");
    }

    function isVisibleNode(node) {
        if (!node || !node.getBoundingClientRect) {
            return false;
        }

        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);

        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    }

    function getRealContainers() {
        return Array.from(document.querySelectorAll(REAL_CONTAINER_SELECTOR)).filter(isVisibleNode);
    }

    function getPrimaryContainer() {
        const containers = getRealContainers();

        if (containers.length) {
            return containers[0];
        }

        return getHitArea();
    }

    function getMoveTargets() {
        return uniqueNodes(getRealContainers().concat([getHitArea()]));
    }

    function getAnchorRect() {
        const primary = getPrimaryContainer();

        if (primary && primary.getBoundingClientRect) {
            return primary.getBoundingClientRect();
        }

        return {
            left: 10,
            top: Math.max(0, window.innerHeight - 486),
            width: 300,
            height: 390
        };
    }

    function clampPosition(position) {
        const rect = getAnchorRect();
        const width = Math.max(1, rect.width || 300);
        const height = Math.max(1, rect.height || 390);
        const maxLeft = Math.max(0, window.innerWidth - width);
        const maxTop = Math.max(0, window.innerHeight - height);

        return {
            left: Math.min(Math.max(0, position.left), maxLeft),
            top: Math.min(Math.max(0, position.top), maxTop)
        };
    }

    function setFixedPosition(node, position) {
        node.style.setProperty("position", "fixed", "important");
        node.style.setProperty("left", position.left + "px", "important");
        node.style.setProperty("top", position.top + "px", "important");
        node.style.setProperty("right", "auto", "important");
        node.style.setProperty("bottom", "auto", "important");
        node.style.setProperty("z-index", String(LAYER_Z_INDEX), "important");
        node.style.setProperty("pointer-events", "auto", "important");
        node.style.setProperty("touch-action", "none", "important");
    }

    function clearFixedPosition(node) {
        node.style.removeProperty("left");
        node.style.removeProperty("top");
        node.style.removeProperty("right");
        node.style.removeProperty("bottom");
        node.style.removeProperty("position");
        node.style.removeProperty("z-index");
        node.style.removeProperty("touch-action");
    }

    function forceInteractiveLayer() {
        document.querySelectorAll(INTERACTIVE_SELECTOR).forEach(function (node) {
            node.style.setProperty("pointer-events", "auto", "important");

            if (node.matches(REAL_CONTAINER_SELECTOR + ", .live2d-hit-area")) {
                node.style.setProperty("z-index", String(LAYER_Z_INDEX), "important");
                node.style.setProperty("touch-action", "none", "important");
            }
        });
    }

    function savePosition(position) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
        } catch (error) {
            // localStorage 可能被浏览器策略禁用，失败时仅保留当前页面位置。
        }
    }

    function readSavedPosition() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : null;

            if (parsed && Number.isFinite(parsed.left) && Number.isFinite(parsed.top)) {
                return parsed;
            }
        } catch (error) {
            return null;
        }

        return null;
    }

    function clearSavedPosition() {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (error) {
            // 忽略本地存储清理失败，避免影响菜单功能。
        }
    }

    function applyPosition(position, shouldSave) {
        const nextPosition = clampPosition(position);

        currentPosition = nextPosition;
        getMoveTargets().forEach(function (node) {
            setFixedPosition(node, nextPosition);
        });

        if (shouldSave) {
            savePosition(nextPosition);
        }
    }

    function resetPosition() {
        currentPosition = null;
        clearSavedPosition();
        getMoveTargets().forEach(clearFixedPosition);
        forceInteractiveLayer();
    }

    function getCurrentPosition() {
        if (currentPosition) {
            return currentPosition;
        }

        const rect = getAnchorRect();

        return clampPosition({
            left: rect.left,
            top: rect.top
        });
    }

    function isLive2DTarget(target) {
        const hitArea = getHitArea();
        const closestLive2D = target && typeof target.closest === "function"
            ? target.closest(INTERACTIVE_SELECTOR)
            : null;

        return Boolean(
            target && (
                target === hitArea ||
                (hitArea && hitArea.contains(target)) ||
                closestLive2D
            )
        );
    }

    function setDraggingClass(isDragging) {
        document.body.classList.toggle("is-live2d-dragging", isDragging);
        getMoveTargets().forEach(function (node) {
            node.classList.toggle("is-live2d-dragging", isDragging);
        });
    }

    function cleanupDragging() {
        setDraggingClass(false);
        dragState = null;
    }

    function openMenuFromClick(event) {
        if (window.JunxueLive2DInteractions && typeof window.JunxueLive2DInteractions.openMenu === "function") {
            suppressClickUntil = Date.now() + 450;
            window.JunxueLive2DInteractions.openMenu(event);
        }
    }

    function handlePointerDown(event) {
        if (event.button !== undefined && event.button !== 0) {
            return;
        }

        const rect = getAnchorRect();
        const target = event.currentTarget;
        console.log("pointerdown triggered", {
            target: target.id || target.className || target.tagName,
            x: event.clientX,
            y: event.clientY
        });

        forceInteractiveLayer();
        dragState = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            startPosition: clampPosition({
                left: rect.left,
                top: rect.top
            }),
            moved: false
        };

        if (target && target.setPointerCapture) {
            try {
                target.setPointerCapture(event.pointerId);
            } catch (error) {
                // 部分浏览器不允许捕获已结束的 pointer，忽略即可。
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

        dragState.moved = true;
        setDraggingClass(true);
        event.preventDefault();

        const nextPosition = clampPosition({
            left: dragState.startPosition.left + deltaX,
            top: dragState.startPosition.top + deltaY
        });

        console.log("dragging", nextPosition);
        applyPosition(nextPosition, false);
    }

    function handlePointerEnd(event) {
        if (!dragState || dragState.pointerId !== event.pointerId) {
            return;
        }

        if (dragState.moved) {
            const savedPosition = getCurrentPosition();

            event.preventDefault();
            event.stopPropagation();
            suppressClickUntil = Date.now() + 450;
            savePosition(savedPosition);
            console.log("drag saved", savedPosition);
            cleanupDragging();
            return;
        }

        cleanupDragging();
        openMenuFromClick(event);
    }

    function suppressLive2DClick(event) {
        if (Date.now() > suppressClickUntil || !isLive2DTarget(event.target)) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
    }

    function suppressLegacyTouchStart(event) {
        if (!isLive2DTarget(event.target)) {
            return;
        }

        event.stopPropagation();
    }

    function ensureResetButton() {
        const dialog = document.querySelector(".live2d-quiz.is-open");
        const question = dialog ? dialog.querySelector(".live2d-quiz__question") : null;
        const options = dialog ? dialog.querySelector(".live2d-quiz__options.live2d-quiz__menu") : null;

        if (!dialog || !question || !options || question.textContent.trim() !== "想和君雪做什么？") {
            return;
        }

        if (options.querySelector(".live2d-position-reset")) {
            return;
        }

        const button = document.createElement("button");
        button.className = "live2d-quiz__option live2d-position-reset";
        button.type = "button";
        button.textContent = "重置位置";
        button.addEventListener("click", function (event) {
            const result = dialog.querySelector(".live2d-quiz__result");

            event.stopPropagation();
            resetPosition();
            if (result) {
                result.textContent = DEFAULT_RESULT_TEXT;
                result.className = "live2d-quiz__result is-neutral";
            }
        });
        options.appendChild(button);
    }

    function bindDragTarget(node) {
        if (!node || node.dataset.live2dDragReady === "true") {
            return;
        }

        node.dataset.live2dDragReady = "true";
        node.style.setProperty("pointer-events", "auto", "important");
        node.style.setProperty("touch-action", "none", "important");
        node.style.setProperty("z-index", String(LAYER_Z_INDEX), "important");
        node.addEventListener("pointerdown", handlePointerDown);
        node.addEventListener("pointermove", handlePointerMove);
        node.addEventListener("pointerup", handlePointerEnd);
        node.addEventListener("pointercancel", cleanupDragging);
    }

    function bindDragTargets() {
        forceInteractiveLayer();
        const targets = getRealContainers();
        const hitArea = getHitArea();

        if (!targets.length && hitArea) {
            targets.push(hitArea);
        }

        targets.forEach(bindDragTarget);

        if (hitArea) {
            bindDragTarget(hitArea);
        }

        if (currentPosition) {
            applyPosition(currentPosition, false);
        }
    }

    function restoreSavedPosition() {
        const savedPosition = readSavedPosition();

        if (savedPosition) {
            applyPosition(savedPosition, false);
        }
    }

    function init() {
        injectDragStyles();
        bindDragTargets();
        restoreSavedPosition();
        document.addEventListener("click", suppressLive2DClick, true);
        document.addEventListener("touchstart", suppressLegacyTouchStart, true);
        window.addEventListener("resize", function () {
            if (currentPosition) {
                applyPosition(currentPosition, true);
            }
        });

        const observer = new MutationObserver(function () {
            bindDragTargets();
            ensureResetButton();
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    window.JunxueLive2DDrag = {
        resetPosition: resetPosition,
        shouldIgnoreMenuEvent: function (event) {
            return Date.now() <= suppressClickUntil && isLive2DTarget(event.target);
        }
    };

    onReady(init);
})();