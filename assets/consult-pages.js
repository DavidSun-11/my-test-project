(function initConsultPageUi() {
    "use strict";

    if (window.JunxueConsultPageUi && window.JunxueConsultPageUi.initialized) {
        return;
    }

    const state = {
        initialized: true,
        hideTimer: 0
    };

    window.JunxueConsultPageUi = state;

    function getStatusBubble() {
        return document.querySelector(".live2d-load-control__status");
    }

    function hideStatusBubble() {
        const bubble = getStatusBubble();

        if (!bubble) {
            return;
        }

        bubble.classList.add("is-consult-auto-hidden");
    }

    function scheduleStatusHide() {
        window.clearTimeout(state.hideTimer);
        state.hideTimer = window.setTimeout(hideStatusBubble, 3000);
    }

    function watchStatusBubble() {
        const bubble = getStatusBubble();

        if (bubble) {
            scheduleStatusHide();
        }

        const observer = new MutationObserver(function () {
            const current = getStatusBubble();

            if (!current || current.hidden) {
                return;
            }

            current.classList.remove("is-consult-auto-hidden");
            scheduleStatusHide();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["hidden"]
        });

        window.addEventListener("scroll", hideStatusBubble, { passive: true });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", watchStatusBubble, { once: true });
    } else {
        watchStatusBubble();
    }
})();
