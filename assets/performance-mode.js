/* Performance mode: auto-detect low power devices and expose a tiny shared API. */
(function () {
    const STORAGE_KEY = "performanceMode";
    const VALID_MODES = ["auto", "low", "high"];
    const root = document.documentElement;

    function readStoredMode() {
        try {
            return window.localStorage.getItem(STORAGE_KEY);
        } catch (error) {
            return null;
        }
    }

    function normalizeMode(mode) {
        return VALID_MODES.indexOf(mode) >= 0 ? mode : "auto";
    }

    function queryMatches(query) {
        return typeof window.matchMedia === "function" && window.matchMedia(query).matches;
    }

    function detectLowPerformance() {
        const cores = navigator.hardwareConcurrency || 0;
        const memory = navigator.deviceMemory || 0;
        const isMobile =
            queryMatches("(max-width: 760px)") ||
            queryMatches("(pointer: coarse)") ||
            /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
        const lowCoreCount = cores > 0 && cores <= 4;
        const lowMemory = memory > 0 && memory <= 4;
        const reducedMotion = queryMatches("(prefers-reduced-motion: reduce)");

        return {
            isLow: isMobile || lowCoreCount || lowMemory || reducedMotion,
            reasons: {
                mobile: isMobile,
                lowCoreCount: lowCoreCount,
                lowMemory: lowMemory,
                reducedMotion: reducedMotion
            }
        };
    }

    function scaleStageStyle(style, ratio) {
        if (!style || typeof style.width !== "number" || typeof style.height !== "number") {
            return style;
        }

        return {
            width: Math.max(1, Math.round(style.width * ratio)),
            height: Math.max(1, Math.round(style.height * ratio))
        };
    }

    function applyLive2DConfig(config) {
        if (!config || resolvedMode !== "low" || config.performanceModeApplied === "low") {
            return config;
        }

        if (typeof config.scale === "number") {
            config.scale = Number((config.scale * 0.84).toFixed(3));
        }

        if (typeof config.mobileScale === "number") {
            config.mobileScale = Number((config.mobileScale * 0.88).toFixed(3));
        }

        config.stageStyle = scaleStageStyle(config.stageStyle, 0.86);
        config.mobileStageStyle = scaleStageStyle(config.mobileStageStyle, 0.9);
        config.performanceModeApplied = "low";
        return config;
    }

    const requestedMode = normalizeMode(readStoredMode());
    const detected = detectLowPerformance();
    const resolvedMode = requestedMode === "auto" ? (detected.isLow ? "low" : "high") : requestedMode;

    root.classList.remove("performance-low", "performance-high");
    root.classList.add("performance-" + resolvedMode);
    root.dataset.performanceMode = resolvedMode;
    root.dataset.performancePreference = requestedMode;

    window.JunxuePerformanceMode = {
        requestedMode: requestedMode,
        resolvedMode: resolvedMode,
        reasons: detected.reasons,
        isLow: function () {
            return resolvedMode === "low";
        },
        isHigh: function () {
            return resolvedMode === "high";
        },
        applyLive2DConfig: applyLive2DConfig
    };
})();
