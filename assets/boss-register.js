(function () {
    const form = document.querySelector("[data-boss-register-form]");
    const statusNode = document.querySelector("[data-boss-register-status]");
    const submitButton = document.querySelector("[data-boss-register-submit]");
    const loginButton = document.querySelector("[data-boss-register-login]");
    const menuButton = document.querySelector("[data-boss-register-menu]");

    function setStatus(message, type) {
        if (!statusNode) {
            return;
        }

        statusNode.textContent = message || "";
        statusNode.className = "boss-register-status" + (type ? " is-" + type : "");
    }

    function setLoading(isLoading) {
        if (!submitButton) {
            return;
        }

        submitButton.disabled = !!isLoading;
        submitButton.setAttribute("aria-busy", isLoading ? "true" : "false");
        submitButton.textContent = isLoading ? "正在点亮账号..." : "注册老板账号";
    }

    function getBossReviewsApi() {
        if (!window.JunxueBossReviews || typeof window.JunxueBossReviews.register !== "function") {
            throw new Error("老板账号注册 API 暂时没有加载完成，请刷新页面后再试。");
        }

        return window.JunxueBossReviews;
    }

    if (loginButton) {
        loginButton.addEventListener("click", function () {
            window.location.href = "index.html?bossLogin=1";
        });
    }

    if (menuButton) {
        menuButton.addEventListener("click", function () {
            window.location.href = "index.html";
        });
    }

    if (!form) {
        return;
    }

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

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
            const api = getBossReviewsApi();
            const response = await api.register(email, password, displayName);

            form.reset();
            if (response && response.profileWarning) {
                setStatus(response.profileWarning + " 老板账号已创建，可以继续返回登录。", "warning");
                return;
            }

            if (response && response.session) {
                setStatus("注册成功啦。现在可以返回登录，继续参与互动、评价与投票。", "good");
            } else {
                setStatus("注册成功，请先前往邮箱确认账号，再返回登录。", "good");
            }
        } catch (error) {
            const message = error && error.message ?
                error.message :
                "老板账号注册暂时不可用，请稍后再试。";
            setStatus(message + (message.indexOf("已经") === -1 && message.indexOf("registered") === -1 ? "" : " 可以返回登录试试。"), "warning");
        } finally {
            setLoading(false);
        }
    });
})();
