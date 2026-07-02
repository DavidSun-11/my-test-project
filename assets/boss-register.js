(function () {
    "use strict";

    const VERSION = "20260702-boss-auth-unified1";
    const DEFAULT_MODE = "register";
    const LOGIN_MODE = "login";
    const REGISTER_MODE = "register";
    const LOGIN_URL = "boss-register.html?mode=login&redirect=index";
    const REGISTER_URL = "boss-register.html?mode=register&redirect=index";
    const DEFAULT_REDIRECT = "index.html";
    const REDIRECT_ALIASES = {
        index: "index.html"
    };
    const REDIRECT_ALLOWLIST = {
        "index.html": true,
        "my.html": true,
        "price.html": true
    };

    const form = document.querySelector("[data-boss-register-form]");
    const statusNode = document.querySelector("[data-boss-register-status]");
    const submitButton = document.querySelector("[data-boss-register-submit]");
    const modeToggleButton = document.querySelector("[data-boss-register-login]");
    const menuButton = document.querySelector("[data-boss-register-menu]");
    const titleNode = document.querySelector("[data-boss-register-title]");
    const subtitleNode = document.querySelector("[data-boss-register-subtitle]");
    const copyNode = document.querySelector("[data-boss-register-copy]");
    const noteNode = document.querySelector("[data-boss-register-note]");
    const registerOnlyNodes = Array.prototype.slice.call(document.querySelectorAll("[data-boss-register-register-only]"));

    let currentMode = getModeFromUrl();

    function getUrlParams() {
        return new URLSearchParams(window.location.search || "");
    }

    function getModeFromUrl() {
        const mode = getUrlParams().get("mode");
        return mode === LOGIN_MODE ? LOGIN_MODE : DEFAULT_MODE;
    }

    function getRedirectTarget() {
        const rawValue = String(getUrlParams().get("redirect") || "index").trim();
        const aliasValue = REDIRECT_ALIASES[rawValue] || rawValue;

        if (!aliasValue ||
            /^https?:\/\//i.test(aliasValue) ||
            /^\/\//.test(aliasValue) ||
            /\\/.test(aliasValue) ||
            aliasValue.indexOf("..") !== -1) {
            return DEFAULT_REDIRECT;
        }

        return REDIRECT_ALLOWLIST[aliasValue] ? aliasValue : DEFAULT_REDIRECT;
    }

    function buildModeUrl(mode) {
        const params = getUrlParams();

        params.set("mode", mode === LOGIN_MODE ? LOGIN_MODE : REGISTER_MODE);
        if (!params.get("redirect")) {
            params.set("redirect", "index");
        }

        return window.location.pathname.split("/").pop() + "?" + params.toString();
    }

    function setStatus(message, type) {
        if (!statusNode) {
            return;
        }

        statusNode.textContent = message || "";
        statusNode.className = "boss-register-status" + (type ? " is-" + type : "");
    }

    function getModeCopy(mode) {
        if (mode === LOGIN_MODE) {
            return {
                subtitle: "欢迎回来，老板账号",
                copy: "登录后可以继续查看头像、昵称、积分、签到记录，并使用已解锁的互动功能。",
                note: "还没有老板账号的话，可以切换到注册模式先创建一个。",
                status: "登录老板账号后，可以同步你的资料、积分和签到状态。",
                submit: "登录老板账号",
                loading: "正在登录老板账号...",
                toggle: "去注册",
                passwordPlaceholder: "请输入登录密码",
                passwordAutocomplete: "current-password"
            };
        }

        return {
            subtitle: "欢迎来到君雪的小小互动星湖",
            copy: "注册成为老板后，你可以参与互动、发布评价、参与投票，并使用更多专属功能。",
            note: "注册后可参与互动、发布评价，并使用更多专属功能。",
            status: "账号仅用于本站互动与评价，不会影响本地记忆中的称呼。",
            submit: "注册老板账号",
            loading: "正在点亮账号...",
            toggle: "去登录",
            passwordPlaceholder: "请设置登录密码",
            passwordAutocomplete: "new-password"
        };
    }

    function setInputRequired(name, required) {
        if (!form || !form.elements[name]) {
            return;
        }

        form.elements[name].required = !!required;
    }

    function renderMode(shouldResetStatus) {
        const isLogin = currentMode === LOGIN_MODE;
        const copy = getModeCopy(currentMode);
        const passwordInput = form && form.elements.password;

        if (titleNode) {
            titleNode.textContent = "老板账号";
        }
        if (subtitleNode) {
            subtitleNode.textContent = copy.subtitle;
        }
        if (copyNode) {
            copyNode.textContent = copy.copy;
        }
        if (noteNode) {
            noteNode.textContent = copy.note;
        }
        if (submitButton && !submitButton.disabled) {
            submitButton.textContent = copy.submit;
        }
        if (modeToggleButton) {
            modeToggleButton.textContent = copy.toggle;
        }
        if (passwordInput) {
            passwordInput.setAttribute("autocomplete", copy.passwordAutocomplete);
            passwordInput.setAttribute("placeholder", copy.passwordPlaceholder);
        }

        registerOnlyNodes.forEach(function (node) {
            node.hidden = isLogin;
        });

        setInputRequired("displayName", !isLogin);
        setInputRequired("confirmPassword", !isLogin);

        if (isLogin) {
            if (form && form.elements.displayName) {
                form.elements.displayName.value = "";
            }
            if (form && form.elements.confirmPassword) {
                form.elements.confirmPassword.value = "";
            }
        }

        if (shouldResetStatus) {
            setStatus(copy.status, "neutral");
        }
    }

    function setMode(nextMode) {
        currentMode = nextMode === LOGIN_MODE ? LOGIN_MODE : REGISTER_MODE;

        if (window.history && typeof window.history.replaceState === "function") {
            window.history.replaceState(null, "", buildModeUrl(currentMode));
        } else {
            window.location.href = currentMode === LOGIN_MODE ? LOGIN_URL : REGISTER_URL;
            return;
        }

        renderMode(true);
    }

    function setLoading(isLoading) {
        if (!submitButton) {
            return;
        }

        const copy = getModeCopy(currentMode);

        submitButton.disabled = !!isLoading;
        submitButton.setAttribute("aria-busy", isLoading ? "true" : "false");
        submitButton.textContent = isLoading ? copy.loading : copy.submit;
    }

    function getBossReviewsApi(requiredMethod) {
        if (!window.JunxueBossReviews || typeof window.JunxueBossReviews[requiredMethod] !== "function") {
            throw new Error("老板账号 API 暂时没有加载完成，请刷新页面后再试。");
        }

        return window.JunxueBossReviews;
    }

    async function confirmSession(api, responseData) {
        if (responseData && responseData.session && responseData.session.user) {
            return responseData.session;
        }

        if (api && typeof api.getSession === "function") {
            return await api.getSession();
        }

        if (api && typeof api.getClient === "function") {
            const client = await api.getClient();
            if (client && client.auth && typeof client.auth.getSession === "function") {
                const response = await client.auth.getSession();
                if (response.error) {
                    throw response.error;
                }
                return response.data ? response.data.session : null;
            }
        }

        return null;
    }

    async function handleLogin() {
        const email = form.elements.email ? form.elements.email.value.trim() : "";
        const password = form.elements.password ? form.elements.password.value : "";

        if (!email || !password) {
            setStatus("请先填写邮箱和密码。", "warning");
            return;
        }

        setLoading(true);
        setStatus("正在登录老板账号...", "neutral");

        try {
            const api = getBossReviewsApi("login");
            const response = await api.login(email, password);
            const session = await confirmSession(api, response);

            if (!session || !session.user) {
                throw new Error("session-missing");
            }

            setStatus("登录成功，正在带你回到首页。", "good");
            window.setTimeout(function () {
                window.location.href = getRedirectTarget();
            }, 450);
        } catch (error) {
            setStatus("邮箱或密码不对，再检查一下哦～", "warning");
            setLoading(false);
        }
    }

    async function handleRegister() {
        const email = form.elements.email ? form.elements.email.value.trim() : "";
        const displayName = form.elements.displayName ? form.elements.displayName.value.trim() : "";
        const password = form.elements.password ? form.elements.password.value : "";
        const confirmPassword = form.elements.confirmPassword ? form.elements.confirmPassword.value : "";

        if (!displayName || !email || !password || !confirmPassword) {
            setStatus("请先把老板昵称、邮箱、密码和确认密码都填好。", "warning");
            return;
        }

        if (displayName.length > 20) {
            setStatus("老板昵称最多 20 个字符，请稍微收短一点。", "warning");
            return;
        }

        if (password !== confirmPassword) {
            setStatus("两次密码不一致，请再检查一下。", "warning");
            return;
        }

        setLoading(true);
        setStatus("正在为你点亮老板账号，请稍等...", "neutral");

        try {
            const api = getBossReviewsApi("register");
            const response = await api.register(email, password, displayName);

            if (response && response.session) {
                setStatus("注册成功啦，正在带你回到首页。", "good");
                form.reset();
                window.setTimeout(function () {
                    window.location.href = "index.html";
                }, 500);
                return;
            }

            if (typeof api.savePendingBossRegistration === "function") {
                api.savePendingBossRegistration(email, displayName);
            }

            form.reset();
            if (response && response.profileWarning) {
                setStatus(response.profileWarning + " 老板账号已创建，正在带你回到首页登录。", "warning");
            } else {
                setStatus("注册成功，请先前往邮箱确认账号，再回到首页登录。", "good");
            }

            window.setTimeout(function () {
                window.location.href = "index.html?bossRegistered=1";
            }, 700);
        } catch (error) {
            const message = error && error.message ?
                error.message :
                "老板账号注册暂时不可用，请稍后再试。";
            setStatus(message + (message.indexOf("已经") === -1 && message.indexOf("registered") === -1 ? "" : " 可以去登录试试。"), "warning");
        } finally {
            setLoading(false);
        }
    }

    if (modeToggleButton) {
        modeToggleButton.addEventListener("click", function () {
            setMode(currentMode === LOGIN_MODE ? REGISTER_MODE : LOGIN_MODE);
        });
    }

    if (menuButton) {
        menuButton.addEventListener("click", function () {
            window.location.href = "index.html";
        });
    }

    if (form) {
        form.addEventListener("submit", async function (event) {
            event.preventDefault();

            if (submitButton && submitButton.disabled) {
                return;
            }

            if (currentMode === LOGIN_MODE) {
                await handleLogin();
                return;
            }

            await handleRegister();
        });
    }

    renderMode(true);

    window.JunxueBossRegisterPage = {
        version: VERSION,
        getMode: function () {
            return currentMode;
        },
        getRedirectTarget: getRedirectTarget
    };
})();
