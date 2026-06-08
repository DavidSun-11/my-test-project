/* Live2D 外置拖动按钮：只拖按钮，不拖 canvas / 模型本体，避免和点击互动菜单冲突。 */
(function () {
    const STORAGE_KEY = "junxue-live2d-stage-position";
    const STAGE_SELECTOR = "#oml2d-stage";
    const CANVAS_SELECTOR = "#oml2d-canvas";
    const HIT_AREA_SELECTOR = ".live2d-hit-area";
    const BUTTON_CLASS = "live2d-drag-button";
    const BUTTON_SELECTOR = "." + BUTTON_CLASS;
    const DRAG_THRESHOLD = 5;
    const STAGE_Z_INDEX = 55;
    const BUTTON_Z_INDEX = 58;

    let dragState = null;
    let currentPosition = null;
    let hoverHideTimer = null;

    function onReady(callback) {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", callback, { once: true });
            return;
        }

        callback();
    }

    function injectStyles() {
        if (document.getElementById("live2d-external-drag-style")) {
            return;
        }

        const style = document.createElement("style");
        style.id = "live2d-external-drag-style";
        style.textContent = `
            #oml2d-stage {
                pointer-events: auto !important;
                z-index: ${STAGE_Z_INDEX} !important;
            }

            #oml2d-canvas,
            #oml2d-statusBar,
            .live2d-hit-area {
                pointer-events: auto !important;
            }

            .${BUTTON_CLASS} {
                position: fixed;
                left: 172px;
                bottom: 248px;
                z-index: ${BUTTON_Z_INDEX};
                min-width: 72px;
                min-height: 30px;
                padding: 0 10px;
                border: 1px solid rgba(120, 229, 255, 0.72);
                border-radius: 999px;
                background: rgba(8, 29, 56, 0.72);
                color: rgba(238, 252, 255, 0.96);
                font-size: 12px;
                font-weight: 700;
                line-height: 30px;
                text-align: center;
                white-space: nowrap;
                box-shadow: 0 0 14px rgba(0, 190, 255, 0.28), inset 0 0 12px rgba(255, 255, 255, 0.08);
                backdrop-filter: blur(8px);
                cursor: grab;
                pointer-events: auto;
                touch-action: none;
                user-select: none;
                opacity: 0.34;
                transform: translateY(0);
                transition: opacity 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease;
            }

            body.is-live2d-drag-hovering .${BUTTON_CLASS},
            .${BUTTON_CLASS}:hover,
            .${BUTTON_CLASS}:focus-visible,
            .${BUTTON_CLASS}.is-dragging {
                opacity: 1;
                transform: translateY(-2px);
            }

            .${BUTTON_CLASS}:hover {
                border-color: rgba(255, 232, 163, 0.86);
                box-shadow: 0 0 18px rgba(111, 220, 255, 0.38), 0 0 12px rgba(255, 232, 163, 0.24);
            }

            html.performance-low .${BUTTON_CLASS} {
                box-shadow: 0 0 8px rgba(0, 190, 255, 0.14);
                backdrop-filter: none;
            }

            html.performance-low .${BUTTON_CLASS}:hover {
                box-shadow: 0 0 10px rgba(111, 220, 255, 0.18);
            }

            .${BUTTON_CLASS}.is-dragging,
            body.is-live2d-external-dragging {
                cursor: grabbing !important;
                user-select: none;
            }

            @media (max-width: 720px) {
                .${BUTTON_CLASS} {
                    left: 126px;
                    bottom: 234px;
                    min-width: 66px;
                    min-height: 28px;
                    padding: 0 8px;
                    font-size: 11px;
                    line-height: 28px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function getStage() {
        return document.querySelector(STAGE_SELECTOR);
    }

    function getCanvas() {
        return document.querySelector(CANVAS_SELECTOR);
    }

    function getDragButton() {
        return document.querySelector(BUTTON_SELECTOR);
    }

    function getHitArea() {
        return document.querySelector(HIT_AREA_SELECTOR);
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
            width: 260,
            height: 400
        };
    }

    function clampPosition(position) {
        const rect = getStageRect();
        const width = Math.max(1, rect.width || 260);
        const height = Math.max(1, rect.height || 400);
        const maxLeft = Math.max(0, window.innerWidth - width);
        const maxTop = Math.max(0, window.innerHeight - height);

        return {
            left: Math.min(Math.max(0, position.left), maxLeft),
            top: Math.min(Math.max(0, position.top), maxTop)
        };
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

    function savePosition(position) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
        } catch (error) {
            // localStorage 被禁用时，只保持当前页面位置。
        }
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
        }

        syncHitArea(nextPosition);
        positionDragButton(nextPosition);
        notifyStagePosition(nextPosition);

        if (shouldSave) {
            savePosition(nextPosition);
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
        const hitArea = getHitArea();

        if (!hitArea) {
            return;
        }

        hitArea.style.setProperty("position", "fixed", "important");
        hitArea.style.setProperty("left", position.left + "px", "important");
        hitArea.style.setProperty("top", position.top + "px", "important");
        hitArea.style.setProperty("right", "auto", "important");
        hitArea.style.setProperty("bottom", "auto", "important");
        hitArea.style.setProperty("z-index", String(STAGE_Z_INDEX + 1), "important");
        hitArea.style.setProperty("pointer-events", "auto", "important");
    }

    function positionDragButton(stagePosition) {
        const button = getDragButton();
        const rect = getStageRect();
        const position = stagePosition || currentPosition || {
            left: rect.left,
            top: rect.top
        };

        if (!button) {
            return;
        }

        const buttonWidth = button.offsetWidth || 72;
        const buttonHeight = button.offsetHeight || 30;
        const nextLeft = Math.min(
            Math.max(8, position.left + rect.width / 2 - buttonWidth / 2),
            Math.max(8, window.innerWidth - button.offsetWidth - 8)
        );
        const nextTop = Math.min(
            Math.max(8, position.top + rect.height - buttonHeight - 36),
            Math.max(8, window.innerHeight - buttonHeight - 88)
        );

        button.style.left = nextLeft + "px";
        button.style.top = nextTop + "px";
        button.style.bottom = "auto";
    }

    function ensureDragButton() {
        let button = getDragButton();

        if (button) {
            return button;
        }

        button = document.createElement("button");
        button.type = "button";
        button.className = BUTTON_CLASS;
        button.textContent = "拖动甘雨";
        button.setAttribute("aria-label", "拖动甘雨位置");
        document.body.appendChild(button);
        bindDragButton(button);
        positionDragButton();

        return button;
    }

    function setDragging(isDragging) {
        const button = getDragButton();

        document.body.classList.toggle("is-live2d-external-dragging", isDragging);
        if (button) {
            button.classList.toggle("is-dragging", isDragging);
        }
    }

    function setHovering(isHovering) {
        window.clearTimeout(hoverHideTimer);

        if (isHovering) {
            document.body.classList.add("is-live2d-drag-hovering");
            return;
        }

        hoverHideTimer = window.setTimeout(function () {
            document.body.classList.remove("is-live2d-drag-hovering");
        }, 120);
    }

    function handlePointerDown(event) {
        if (event.button !== undefined && event.button !== 0) {
            return;
        }

        const rect = getStageRect();

        event.preventDefault();
        event.stopPropagation();

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

        if (event.currentTarget.setPointerCapture) {
            try {
                event.currentTarget.setPointerCapture(event.pointerId);
            } catch (error) {
                // 某些移动浏览器可能不支持当前 pointer 捕获，忽略即可。
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
        setDragging(true);
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

        event.preventDefault();
        event.stopPropagation();

        if (dragState.moved) {
            savePosition(currentPosition || dragState.startPosition);
            window.dispatchEvent(new CustomEvent("live2d-stage-drag-finished", {
                detail: {
                    position: currentPosition || dragState.startPosition,
                    rect: getStageRect()
                }
            }));
        }

        dragState = null;
        setDragging(false);
    }

    function bindDragButton(button) {
        if (button.dataset.live2dExternalDragReady === "true") {
            return;
        }

        button.dataset.live2dExternalDragReady = "true";
        button.addEventListener("pointerdown", handlePointerDown);
        button.addEventListener("pointermove", handlePointerMove);
        button.addEventListener("pointerup", handlePointerEnd);
        button.addEventListener("pointercancel", handlePointerEnd);
        button.addEventListener("pointerenter", function () {
            setHovering(true);
        });
        button.addEventListener("pointerleave", function () {
            setHovering(false);
        });
        button.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
        });
    }

    function bindHoverTarget(node) {
        if (!node || node.dataset.live2dDragHoverReady === "true") {
            return;
        }

        node.dataset.live2dDragHoverReady = "true";
        node.addEventListener("pointerenter", function () {
            setHovering(true);
        });
        node.addEventListener("pointerleave", function () {
            setHovering(false);
        });
    }

    function restoreSavedPosition() {
        if (currentPosition) {
            applyStagePosition(currentPosition, false);
            return;
        }

        const savedPosition = readSavedPosition();

        if (savedPosition) {
            applyStagePosition(savedPosition, false);
            return;
        }

        positionDragButton();
    }

    function syncRuntimeDom() {
        if (getStage()) {
            ensureDragButton();
            bindHoverTarget(getStage());
            bindHoverTarget(getCanvas());
            bindHoverTarget(getHitArea());
            if (dragState) {
                return;
            }
            restoreSavedPosition();
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

        window.addEventListener("resize", function () {
            if (currentPosition) {
                applyStagePosition(currentPosition, true);
                return;
            }

            positionDragButton();
        });
    }

    onReady(init);
})();
