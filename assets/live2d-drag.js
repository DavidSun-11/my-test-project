/* Live2D 拖动定位：只接管外层 hit-area，并同步移动模型外层节点。 */
(function () {
    const STORAGE_KEY = "junxue-live2d-position";
    const DRAG_THRESHOLD = 5;
    const DEFAULT_RESULT_TEXT = "君雪回到左下角啦。";
    let currentPosition = null;
    let dragState = null;
    let suppressClickUntil = 0;
    let observer = null;

    function injectDragStyles() {
        if (document.getElementById("live2d-drag-style")) {
            return;
        }

        const style = document.createElement("style");
        style.id = "live2d-drag-style";
        style.textContent = [
            ".live2d-hit-area{touch-action:none;}",
            ".live2d-hit-area.is-dragging{cursor:grabbing;}",
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

    function getHitArea() {
        return document.querySelector(".live2d-hit-area");
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

    function getMoveTargets() {
        return uniqueNodes([
            getHitArea(),
            document.getElementById("live2d-widget")
        ].concat(Array.from(document.querySelectorAll("#oml2d-main, .oml2d-main"))));
    }

    function getAnchorSize() {
        const hitArea = getHitArea();
        const rect = hitArea ? hitArea.getBoundingClientRect() : null;

        return {
            width: Math.max(1, rect ? rect.width : 300),
            height: Math.max(1, rect ? rect.height : 390)
        };
    }

    function clampPosition(position) {
        const size = getAnchorSize();
        const maxLeft = Math.max(0, window.innerWidth - size.width);
        const maxTop = Math.max(0, window.innerHeight - size.height);

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
    }

    function clearFixedPosition(node) {
        node.style.removeProperty("left");
        node.style.removeProperty("top");
        node.style.removeProperty("right");
        node.style.removeProperty("bottom");
        node.style.removeProperty("position");
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
    }

    function getCurrentPosition() {
        if (currentPosition) {
            return currentPosition;
        }

        const hitArea = getHitArea();
        const rect = hitArea ? hitArea.getBoundingClientRect() : { left: 10, top: window.innerHeight - 486 };

        return clampPosition({
            left: rect.left,
            top: rect.top
        });
    }

    function isLive2DTarget(target) {
        const hitArea = getHitArea();

        return Boolean(
            target && (
                target === hitArea ||
                (hitArea && hitArea.contains(target)) ||
                target.closest("#live2d-widget, #oml2d-main, .oml2d-main, [id^='oml2d'], [class*='oml2d']")
            )
        );
    }

    function cleanupDragging() {
        const hitArea = getHitArea();

        document.body.classList.remove("is-live2d-dragging");
        if (hitArea) {
            hitArea.classList.remove("is-dragging");
        }
        dragState = null;
    }

    function handlePointerDown(event) {
        if (event.button !== undefined && event.button !== 0) {
            return;
        }

        const hitArea = getHitArea();
        dragState = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            startPosition: getCurrentPosition(),
            moved: false
        };

        if (hitArea && hitArea.setPointerCapture) {
            try {
                hitArea.setPointerCapture(event.pointerId);
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
        document.body.classList.add("is-live2d-dragging");
        event.currentTarget.classList.add("is-dragging");
        event.preventDefault();
        applyPosition({
            left: dragState.startPosition.left + deltaX,
            top: dragState.startPosition.top + deltaY
        }, false);
    }

    function handlePointerEnd(event) {
        if (!dragState || dragState.pointerId !== event.pointerId) {
            return;
        }

        if (dragState.moved) {
            event.preventDefault();
            event.stopPropagation();
            suppressClickUntil = Date.now() + 450;
            savePosition(getCurrentPosition());
        }

        cleanupDragging();
    }

    function suppressDraggedClick(event) {
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

    function bindDragWhenReady() {
        const hitArea = getHitArea();

        if (!hitArea) {
            window.setTimeout(bindDragWhenReady, 120);
            return;
        }

        if (hitArea.dataset.live2dDragReady === "true") {
            return;
        }

        hitArea.dataset.live2dDragReady = "true";
        hitArea.addEventListener("pointerdown", handlePointerDown);
        hitArea.addEventListener("pointermove", handlePointerMove);
        hitArea.addEventListener("pointerup", handlePointerEnd);
        hitArea.addEventListener("pointercancel", cleanupDragging);

        const savedPosition = readSavedPosition();
        if (savedPosition) {
            applyPosition(savedPosition, false);
        }
    }

    function init() {
        injectDragStyles();
        bindDragWhenReady();
        document.addEventListener("click", suppressDraggedClick, true);
        document.addEventListener("touchstart", suppressLegacyTouchStart, true);
        window.addEventListener("resize", function () {
            if (currentPosition) {
                applyPosition(currentPosition, true);
            }
        });

        observer = new MutationObserver(function () {
            bindDragWhenReady();
            ensureResetButton();
            if (currentPosition) {
                applyPosition(currentPosition, false);
            }
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["class"]
        });
    }

    onReady(init);
})();
