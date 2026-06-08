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
            queryMatches("(max-width: 768px)") ||
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

    function writeStoredMode(mode) {
        try {
            window.localStorage.setItem(STORAGE_KEY, mode);
        } catch (error) {}
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
        button.textContent = "特效模式";
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
                writeStoredMode(mode.value);
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

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initModeSwitcher, { once: true });
    } else {
        initModeSwitcher();
    }
})();
