/*
 * Live2D 看板娘初始化脚本。
 * 使用 OhMyLive2D 的纯前端 CDN 运行时，适合直接部署到 GitHub Pages。
 * 当前默认使用 npm 上稳定公开的 shizuku 示例模型，并在加载前检查 model / moc / textures 是否可访问。
 */
(function () {
    const config = window.Live2DWidgetConfig || {};
    const widget = document.getElementById("live2d-widget");
    const message = widget ? widget.querySelector(".live2d-message") : null;
    const legacyLocalModel = "live2d/models/miku-style/model.json";
    const senkoModel = "https://model.oml2d.com/Senko_Normals/senko.model3.json";
    const stableModels = [
        "https://cdn.jsdelivr.net/npm/live2d-widget-model-shizuku@1.0.5/assets/shizuku.model.json",
        "https://unpkg.com/live2d-widget-model-shizuku@1.0.5/assets/shizuku.model.json"
    ];
    const stableMessages = [
        "欢迎来到星空主页。",
        "我已切换到稳定示例模型。",
        "我会待在左下角，不影响游戏展示。",
        "点我一下，有个小问题想问你。"
    ];

    function setMessage(text) {
        if (!message || !widget) {
            return;
        }

        message.textContent = text;
        widget.classList.add("is-talking");

        window.clearTimeout(setMessage.timer);
        setMessage.timer = window.setTimeout(function () {
            widget.classList.remove("is-talking");
        }, 3000);
    }

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            const script = document.createElement("script");
            script.src = src;
            script.async = true;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    function asAbsoluteUrl(path, baseUrl) {
        return new URL(path, baseUrl).href;
    }

    function collectModelFiles(modelJson, modelUrl) {
        const files = [];

        if (modelJson.model) {
            files.push(modelJson.model);
        }

        if (Array.isArray(modelJson.textures)) {
            files.push.apply(files, modelJson.textures);
        }

        if (modelJson.physics) {
            files.push(modelJson.physics);
        }

        if (modelJson.pose) {
            files.push(modelJson.pose);
        }

        return files.map(function (file) {
            return asAbsoluteUrl(file, modelUrl);
        });
    }

    async function canFetch(url) {
        try {
            const response = await fetch(url, {
                method: "GET",
                cache: "no-store"
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    async function checkModelEntry(modelUrl) {
        try {
            const response = await fetch(modelUrl, {
                method: "GET",
                cache: "no-store"
            });

            if (!response.ok) {
                return false;
            }

            const modelJson = await response.json();
            const requiredFiles = collectModelFiles(modelJson, modelUrl);

            for (const fileUrl of requiredFiles) {
                const ok = await canFetch(fileUrl);

                if (!ok) {
                    return false;
                }
            }

            return true;
        } catch (error) {
            return false;
        }
    }

    function shouldUseStableModel(path) {
        return !path || path === legacyLocalModel || path === senkoModel;
    }

    async function resolveModelPath() {
        const requestedPath = config.modelPath;

        if (!shouldUseStableModel(requestedPath)) {
            const ok = await checkModelEntry(requestedPath);

            if (ok) {
                return requestedPath;
            }
        }

        for (const modelUrl of stableModels) {
            const ok = await checkModelEntry(modelUrl);

            if (ok) {
                return modelUrl;
            }
        }

        return "";
    }

    async function ensureRuntime() {
        if (window.OML2D && typeof window.OML2D.loadOml2d === "function") {
            return;
        }

        try {
            await loadScript("https://cdn.jsdelivr.net/npm/oh-my-live2d@0.19.3/dist/index.min.js");
        } catch (error) {
            await loadScript("https://unpkg.com/oh-my-live2d@0.19.3/dist/index.min.js");
        }
    }

    function buildModelConfig(modelPath) {
        return {
            name: "shizuku",
            path: modelPath,
            position: config.position || [0, 20],
            scale: config.scale || 0.18,
            stageStyle: config.stageStyle || {
                width: config.width || 280,
                height: config.height || 380
            },
            mobilePosition: config.mobilePosition || [0, 25],
            mobileScale: config.mobileScale || 0.14,
            mobileStageStyle: config.mobileStageStyle || {
                width: config.mobileWidth || 190,
                height: config.mobileHeight || 260
            }
        };
    }

    function createQuizDialog() {
        const dialog = document.createElement("div");
        dialog.className = "live2d-quiz";
        dialog.setAttribute("role", "dialog");
        dialog.setAttribute("aria-live", "polite");
        dialog.setAttribute("aria-label", "Live2D 问答");
        dialog.innerHTML = [
            '<button class="live2d-quiz__close" type="button" aria-label="关闭">×</button>',
            '<div class="live2d-quiz__question">你觉得君雪是怎么样的人？</div>',
            '<div class="live2d-quiz__options">',
            '    <button class="live2d-quiz__option" type="button" data-answer="good">A：天资卓越</button>',
            '    <button class="live2d-quiz__option" type="button" data-answer="good">B：完美无瑕</button>',
            '    <button class="live2d-quiz__option" type="button" data-answer="good">C：才富五车</button>',
            '    <button class="live2d-quiz__option" type="button" data-answer="lie">D：一般</button>',
            '</div>',
            '<div class="live2d-quiz__result"></div>'
        ].join("");
        document.body.appendChild(dialog);
        return dialog;
    }

    function createHitArea() {
        const hitArea = document.createElement("button");
        hitArea.className = "live2d-hit-area";
        hitArea.type = "button";
        hitArea.setAttribute("aria-label", "点击 Live2D 看板娘");
        document.body.appendChild(hitArea);
        return hitArea;
    }

    function findLive2DRoots() {
        const selectors = [
            "#live2d-widget",
            "#oml2d-main",
            "#oml2d-stage",
            "#oml2d-canvas",
            ".oml2d-main",
            ".oml2d-stage",
            ".oml2d-canvas",
            "[id^='oml2d']",
            "[class*='oml2d']",
            "canvas"
        ];
        const roots = [];

        selectors.forEach(function (selector) {
            document.querySelectorAll(selector).forEach(function (node) {
                const rect = node.getBoundingClientRect();
                const isLeftBottom = rect.left < 360 && rect.bottom > window.innerHeight - 520;

                if ((selector !== "canvas" || isLeftBottom) && !roots.includes(node)) {
                    roots.push(node);
                }
            });
        });

        return roots;
    }

    function initLive2DQuiz() {
        const dialog = createQuizDialog();
        const hitArea = createHitArea();
        const closeButton = dialog.querySelector(".live2d-quiz__close");
        const result = dialog.querySelector(".live2d-quiz__result");
        const boundNodes = new WeakSet();

        function openDialog(event) {
            if (event) {
                event.preventDefault();
            }

            dialog.classList.add("is-open");
            result.textContent = "";
            result.classList.remove("is-warning");
            window.clearTimeout(openDialog.closeTimer);
        }

        function closeDialog() {
            dialog.classList.remove("is-open");
            window.clearTimeout(openDialog.closeTimer);
        }

        function bindNode(node) {
            if (!node || boundNodes.has(node) || node === dialog || dialog.contains(node)) {
                return;
            }

            boundNodes.add(node);
            node.style.pointerEvents = "auto";

            if (node !== hitArea) {
                node.style.zIndex = node.style.zIndex || "42";
            }

            node.addEventListener("click", openDialog, true);
            node.addEventListener("touchstart", openDialog, {
                capture: true,
                passive: false
            });
        }

        function bindLive2DRoots() {
            findLive2DRoots().forEach(bindNode);
        }

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

        closeButton.addEventListener("click", function (event) {
            event.stopPropagation();
            closeDialog();
        });

        dialog.addEventListener("click", function (event) {
            const option = event.target.closest(".live2d-quiz__option");

            if (!option) {
                return;
            }

            event.stopPropagation();

            const isPraise = option.dataset.answer === "good";
            result.textContent = isPraise ? "你的眼光真不错" : "你骗人";
            result.classList.toggle("is-warning", !isPraise);

            window.clearTimeout(openDialog.closeTimer);
            openDialog.closeTimer = window.setTimeout(closeDialog, 3500);
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                closeDialog();
            }
        });
    }

    async function boot() {
        const dockedPosition = config.dockedPosition || "left";
        const idleMessages = config.messages || stableMessages;

        initLive2DQuiz();

        if (widget && dockedPosition === "left") {
            widget.classList.add("is-left");
        }

        setMessage("Live2D 加载中...");

        try {
            await ensureRuntime();
        } catch (error) {
            setMessage("Live2D 运行时加载失败，请检查 CDN 是否可访问。");
            return;
        }

        if (!window.OML2D || typeof window.OML2D.loadOml2d !== "function") {
            setMessage("Live2D 运行时不可用，请稍后刷新页面。");
            return;
        }

        const modelPath = await resolveModelPath();

        if (!modelPath) {
            setMessage("模型文件不可访问，请检查网络或 CDN。 ");
            return;
        }

        if (widget) {
            widget.classList.add("is-loaded");
            window.setTimeout(function () {
                widget.remove();
            }, 350);
        }

        window.OML2D.loadOml2d({
            dockedPosition: dockedPosition,
            primaryColor: "#38d9ff",
            sayHello: true,
            mobileDisplay: true,
            menus: {
                disable: true
            },
            statusBar: {
                disable: false,
                loadingMessage: "Live2D 加载中...",
                loadSuccessMessage: "看板娘已上线",
                loadFailMessage: "模型加载失败，请刷新或稍后再试"
            },
            models: [buildModelConfig(modelPath)],
            tips: {
                idleTips: {
                    message: idleMessages
                }
            }
        });
    }

    boot();
})();
