/* Performance mode: auto-detect low power devices and expose a tiny shared API. */
(function () {
    const LEGACY_STORAGE_KEY = "performanceMode";
    const PREFERENCE_STORAGE_KEY = "junxuePerformanceModePreferenceV2";
    const MIGRATION_STORAGE_KEY = "junxuePerformanceModeMigrationV2";
    const HIGH_EFFECT_REQUEST_KEY = "junxueManualHighEffectRequestedAt";
    const HIGH_EFFECT_LOADING_KEY = "junxueManualHighLoadingPending";
    const VALID_MODES = ["auto", "low", "high"];
    const root = document.documentElement;
    let runtimeState = root.dataset.live2dRuntimeState || "idle";
    let modeButton = null;

    function readStorage(key) {
        try {
            return window.localStorage.getItem(key);
        } catch (error) {
            return null;
        }
    }

    function writeStorage(key, value) {
        try {
            window.localStorage.setItem(key, value);
        } catch (error) {}
    }

    function removeStorage(key) {
        try {
            window.localStorage.removeItem(key);
        } catch (error) {}
    }

    function normalizeMode(mode) {
        return VALID_MODES.indexOf(mode) >= 0 ? mode : "auto";
    }

    function queryMatches(query) {
        return typeof window.matchMedia === "function" && window.matchMedia(query).matches;
    }

    function supportsWebGL() {
        try {
            const canvas = document.createElement("canvas");
            return !!(canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
        } catch (error) {
            return false;
        }
    }

    function detectPerformanceMode() {
        const cores = Number(navigator.hardwareConcurrency);
        const memory = Number(navigator.deviceMemory);
        const hasCoreSignal = Number.isFinite(cores) && cores > 0;
        const hasMemorySignal = Number.isFinite(memory) && memory > 0;
        const webgl = supportsWebGL();
        const lowCoreCount = hasCoreSignal && cores <= 4;
        const lowMemory = hasMemorySignal && memory <= 4;
        const strongCoreCount = hasCoreSignal && cores >= 6;
        const strongMemory = hasMemorySignal && memory >= 6;
        const reducedMotion = queryMatches("(prefers-reduced-motion: reduce)");
        let result = "low";
        let reason = "insufficient-capability-signals";

        console.info("[live2d-mode] performance detection start");

        if (!webgl) {
            reason = "webgl-unavailable";
        } else if (reducedMotion) {
            reason = "reduced-motion";
        } else if (lowCoreCount) {
            reason = "low-cpu";
        } else if (lowMemory) {
            reason = "low-memory";
        } else if (strongCoreCount && strongMemory) {
            result = "high";
            reason = "positive-capability-signals";
        }

        console.info("[live2d-mode] performance detection result: " + (result === "high" ? "effects" : "performance"), {
            reason: reason
        });

        return {
            mode: result,
            reasons: {
                webgl: webgl,
                lowCoreCount: lowCoreCount,
                lowMemory: lowMemory,
                reducedMotion: reducedMotion,
                hasCoreSignal: hasCoreSignal,
                hasMemorySignal: hasMemorySignal,
                result: reason
            },
            isLow: result === "low"
        };
    }

    function parseStoredPreference(raw) {
        try {
            const parsed = raw ? JSON.parse(raw) : null;
            if (!parsed || parsed.version !== 2 || parsed.source !== "manual" || VALID_MODES.indexOf(parsed.mode) < 0) {
                return null;
            }

            return parsed;
        } catch (error) {
            return null;
        }
    }

    function readSessionHighRequest() {
        try {
            return !!window.sessionStorage.getItem(HIGH_EFFECT_REQUEST_KEY);
        } catch (error) {
            return false;
        }
    }

    function writeManualPreference(mode) {
        writeStorage(PREFERENCE_STORAGE_KEY, JSON.stringify({
            version: 2,
            mode: mode,
            source: "manual"
        }));
        removeStorage(LEGACY_STORAGE_KEY);
        writeStorage(MIGRATION_STORAGE_KEY, "done");
    }

    function resolveStoredPreference() {
        const v2Preference = parseStoredPreference(readStorage(PREFERENCE_STORAGE_KEY));

        if (v2Preference) {
            return {
                mode: v2Preference.mode,
                source: "saved"
            };
        }

        const legacyMode = normalizeMode(readStorage(LEGACY_STORAGE_KEY));
        const hasLegacyValue = readStorage(LEGACY_STORAGE_KEY) !== null;

        if (hasLegacyValue && readStorage(MIGRATION_STORAGE_KEY) !== "done") {
            if (legacyMode === "high" && readSessionHighRequest()) {
                writeManualPreference("high");
                console.info("[live2d-mode] init source: saved", { migration: "legacy-high-confirmed" });
                return {
                    mode: "high",
                    source: "saved"
                };
            }

            if (legacyMode === "low" || legacyMode === "high") {
                removeStorage(LEGACY_STORAGE_KEY);
                writeStorage(MIGRATION_STORAGE_KEY, "done");
                console.info("[live2d-mode] init source: auto-detect", { migration: "legacy-unverified-cleared" });
                return {
                    mode: "auto",
                    source: "auto-detect"
                };
            }

            removeStorage(LEGACY_STORAGE_KEY);
            writeStorage(MIGRATION_STORAGE_KEY, "done");
        }

        return {
            mode: "auto",
            source: "auto-detect"
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

    function getLive2DDprCap() {
        if (requestedMode === "high") {
            return 2;
        }

        if (resolvedMode === "low") {
            return 1;
        }

        return 1.5;
    }

    function getLive2DIdleDelayMultiplier() {
        return resolvedMode === "low" ? 1.6 : 1;
    }

    function markManualHighEffectRequest(mode) {
        try {
            if (mode === "high") {
                const timestamp = String(Date.now());
                window.sessionStorage.setItem(HIGH_EFFECT_REQUEST_KEY, timestamp);
                window.sessionStorage.setItem(HIGH_EFFECT_LOADING_KEY, timestamp);
                return;
            }

            window.sessionStorage.removeItem(HIGH_EFFECT_REQUEST_KEY);
            window.sessionStorage.removeItem(HIGH_EFFECT_LOADING_KEY);
        } catch (error) {}
    }

    function prepareManualHighLoadingTransition() {
        document.querySelectorAll(".ganyu-static-card").forEach(function (card) {
            card.classList.add("is-hidden");
            card.classList.remove("is-hidden-for-submenu");
            card.setAttribute("aria-hidden", "true");
        });
        console.info("[live2d-runtime] manual high selected");
    }

    function initKeyboardViewportClass() {
        let focusTimer = null;

        function isTextControl(element) {
            return !!element && /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName || "");
        }

        function updateKeyboardClass(forceOpen) {
            if (!document.body) {
                return;
            }

            const viewport = window.visualViewport;
            const viewportShrunk = !!(viewport && window.innerHeight - viewport.height > 120);
            const hasFocusedInput = isTextControl(document.activeElement);
            document.body.classList.toggle("keyboard-open", !!(hasFocusedInput && (forceOpen || viewportShrunk)));
        }

        window.addEventListener("focusin", function () {
            window.clearTimeout(focusTimer);
            updateKeyboardClass(true);
        });

        window.addEventListener("focusout", function () {
            window.clearTimeout(focusTimer);
            focusTimer = window.setTimeout(function () {
                updateKeyboardClass(false);
            }, 120);
        });

        if (window.visualViewport) {
            window.visualViewport.addEventListener("resize", function () {
                updateKeyboardClass(false);
            });
            window.visualViewport.addEventListener("scroll", function () {
                updateKeyboardClass(false);
            });
        }
    }

    function injectModeSwitcherStyles() {
        if (document.getElementById("junxue-performance-style")) {
            return;
        }

        const style = document.createElement("style");
        style.id = "junxue-performance-style";
        style.textContent = `
            .performance-switcher {
                position: fixed;
                top: 14px;
                right: 14px;
                z-index: 10020;
                font-family: Arial, sans-serif;
            }

            .performance-switcher__button {
                min-height: 30px;
                padding: 0 12px;
                border: 1px solid rgba(120, 229, 255, 0.58);
                border-radius: 999px;
                background: rgba(6, 22, 44, 0.76);
                color: rgba(234, 252, 255, 0.94);
                font-size: 12px;
                font-weight: 700;
                line-height: 30px;
                cursor: pointer;
                box-shadow: 0 0 14px rgba(0, 190, 255, 0.18), inset 0 0 10px rgba(255, 255, 255, 0.06);
                backdrop-filter: blur(8px);
            }

            .performance-switcher__menu {
                position: absolute;
                top: calc(100% + 8px);
                right: 0;
                width: 138px;
                padding: 8px;
                border: 1px solid rgba(120, 229, 255, 0.46);
                border-radius: 14px;
                background: rgba(5, 18, 36, 0.92);
                box-shadow: 0 0 18px rgba(0, 190, 255, 0.2), inset 0 0 12px rgba(255, 255, 255, 0.05);
                backdrop-filter: blur(10px);
            }

            .performance-switcher__menu[hidden] {
                display: none;
            }

            .performance-switcher__option {
                display: block;
                width: 100%;
                min-height: 30px;
                border: 0;
                border-radius: 10px;
                background: transparent;
                color: rgba(234, 252, 255, 0.88);
                font: inherit;
                font-size: 12px;
                text-align: left;
                cursor: pointer;
                padding: 0 9px;
            }

            .performance-switcher__option:hover,
            .performance-switcher__option:focus-visible {
                outline: none;
                background: rgba(108, 229, 255, 0.12);
                color: #ffffff;
            }

            .performance-switcher__option.is-active {
                background: rgba(108, 229, 255, 0.18);
                color: #eafcff;
                box-shadow: inset 0 0 8px rgba(108, 229, 255, 0.1);
            }

            html.performance-low .performance-switcher__button,
            html.performance-low .performance-switcher__menu {
                box-shadow: 0 0 8px rgba(0, 190, 255, 0.12);
                backdrop-filter: none;
            }

            @media (max-width: 768px) {
                .performance-switcher {
                    top: 10px;
                    right: 10px;
                }

                .performance-switcher__button {
                    min-height: 28px;
                    padding: 0 10px;
                    font-size: 11px;
                    line-height: 28px;
                }

                .performance-switcher__menu {
                    width: 128px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function getModeButtonLabel() {
        const fallbackSuffix = runtimeState === "live2d-failed" ? "·临时回退" : runtimeState === "loading-live2d" ? "·加载中" : "";
        if (requestedMode === "high") {
            return "特效模式" + fallbackSuffix;
        }

        if (requestedMode === "low") {
            return "流畅模式";
        }

        return (resolvedMode === "low" ? "自动·流畅" : "自动·特效") + fallbackSuffix;
    }

    function refreshModeButton() {
        if (modeButton) {
            modeButton.textContent = getModeButtonLabel();
        }
    }

    function initModeSwitcher() {
        if (document.querySelector(".performance-switcher")) {
            return;
        }

        injectModeSwitcherStyles();

        const wrapper = document.createElement("div");
        const button = document.createElement("button");
        const menu = document.createElement("div");
        const modes = [
            { value: "auto", label: "自动模式" },
            { value: "low", label: "流畅模式" },
            { value: "high", label: "全特效模式" }
        ];

        wrapper.className = "performance-switcher";
        button.className = "performance-switcher__button";
        button.type = "button";
        button.textContent = getModeButtonLabel();
        modeButton = button;
        button.setAttribute("aria-haspopup", "true");
        button.setAttribute("aria-expanded", "false");

        menu.className = "performance-switcher__menu";
        menu.hidden = true;

        modes.forEach(function (mode) {
            const option = document.createElement("button");
            option.className = "performance-switcher__option";
            option.type = "button";
            option.textContent = mode.label;
            option.dataset.mode = mode.value;

            if (mode.value === requestedMode) {
                option.classList.add("is-active");
                option.setAttribute("aria-current", "true");
            }

            option.addEventListener("click", function () {
                if (mode.value === "high") {
                    button.textContent = "特效加载中…";
                    button.disabled = true;
                }
                console.info("[live2d-mode] manual mode selected: " + mode.value);
                markManualHighEffectRequest(mode.value);
                if (mode.value === "high") {
                    prepareManualHighLoadingTransition();
                }
                writeManualPreference(mode.value);
                window.location.reload();
            });
            menu.appendChild(option);
        });

        button.addEventListener("click", function (event) {
            event.stopPropagation();
            menu.hidden = !menu.hidden;
            button.setAttribute("aria-expanded", String(!menu.hidden));
        });

        menu.addEventListener("click", function (event) {
            event.stopPropagation();
        });

        document.addEventListener("click", function () {
            if (!menu.hidden) {
                menu.hidden = true;
                button.setAttribute("aria-expanded", "false");
            }
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && !menu.hidden) {
                menu.hidden = true;
                button.setAttribute("aria-expanded", "false");
                button.focus();
            }
        });

        wrapper.appendChild(button);
        wrapper.appendChild(menu);
        document.body.appendChild(wrapper);
    }

    const storedPreference = resolveStoredPreference();
    const requestedMode = storedPreference.mode;
    const detected = detectPerformanceMode();
    const resolvedMode = requestedMode === "auto" ? detected.mode : requestedMode;

    console.info("[live2d-mode] init source: " + storedPreference.source, {
        requestedMode: requestedMode,
        resolvedMode: resolvedMode
    });

    root.classList.remove("performance-low", "performance-high");
    root.classList.add("performance-" + resolvedMode);
    root.dataset.performanceMode = resolvedMode;
    root.dataset.performancePreference = requestedMode;

    window.JunxuePerformanceMode = {
        requestedMode: requestedMode,
        resolvedMode: resolvedMode,
        source: storedPreference.source,
        reasons: detected.reasons,
        isLow: function () {
            return resolvedMode === "low";
        },
        isHigh: function () {
            return resolvedMode === "high";
        },
        getLive2DDprCap: getLive2DDprCap,
        getLive2DIdleDelayMultiplier: getLive2DIdleDelayMultiplier,
        applyLive2DConfig: applyLive2DConfig
    };

    window.addEventListener("junxue-live2d-runtime-state", function (event) {
        const detail = event && event.detail ? event.detail : {};
        runtimeState = String(detail.state || "idle");
        root.dataset.live2dRuntimeState = runtimeState;
        refreshModeButton();
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
            initModeSwitcher();
            initKeyboardViewportClass();
        }, { once: true });
    } else {
        initModeSwitcher();
        initKeyboardViewportClass();
    }
})();
