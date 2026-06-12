(function () {
    const CONFIG_MISSING_TEXT = "老板评价系统暂未配置，请稍后再来～";
    const REVIEW_EMPTY_TEXT = "暂无评价，期待第一位老板留下评价～";
    const SUCCESS_TEXT = "感谢老板的评价，君雪已经收到啦～";
    const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    const VALID_SERVICE_TYPES = ["王者荣耀", "永劫无间", "语音聊天", "其它"];

    const authStatus = document.getElementById("price-auth-status");
    const reviewStatus = document.getElementById("price-review-status");
    const reviewList = document.getElementById("price-review-list");
    const reviewToggle = document.getElementById("price-review-toggle");
    const reviewPanel = document.getElementById("price-review-panel");
    const authForm = document.getElementById("price-auth-form");
    const reviewForm = document.getElementById("price-review-form");
    const emailInput = document.getElementById("price-email");
    const passwordInput = document.getElementById("price-password");
    const nicknameInput = document.getElementById("price-review-nickname");
    const serviceInput = document.getElementById("price-review-service");
    const ratingInput = document.getElementById("price-review-rating");
    const messageInput = document.getElementById("price-review-message");
    const loginButton = document.getElementById("price-login-button");
    const logoutButton = document.getElementById("price-logout-button");
    const submitButton = document.getElementById("price-review-submit");
    const authFields = authForm ? authForm.querySelectorAll(".price-field") : [];
    const authNote = authForm ? authForm.querySelector(".price-auth-note") : null;
    const authLink = authForm ? authForm.querySelector(".price-auth-link") : null;

    let client = null;
    let currentUser = null;
    let reviewPanelExpanded = false;

    function getConfigValue(name) {
        if (typeof window[name] === "string") {
            return window[name].trim();
        }

        try {
            return typeof eval(name) === "string" ? eval(name).trim() : "";
        } catch (error) {
            return "";
        }
    }

    function hasUsableConfig() {
        const url = getConfigValue("SUPABASE_URL");
        const key = getConfigValue("SUPABASE_ANON_KEY");

        return /^https:\/\/.+\.supabase\.co$/i.test(url) &&
            !!key &&
            key.indexOf("你的 Supabase") === -1 &&
            (key.indexOf("sb_publishable_") === 0 || key.indexOf("eyJ") === 0);
    }

    function setStatus(node, text, type) {
        if (!node) {
            return;
        }

        node.textContent = text || "";
        node.className = "price-status" + (type ? " is-" + type : "");
    }

    function setReviewPanelExpanded(expanded) {
        reviewPanelExpanded = !!expanded;

        if (reviewPanel) {
            reviewPanel.hidden = !reviewPanelExpanded;
        }

        if (reviewToggle) {
            reviewToggle.textContent = reviewPanelExpanded ? "收起评价表单" : "我要留下老板评价";
            reviewToggle.setAttribute("aria-expanded", reviewPanelExpanded ? "true" : "false");
        }
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"]/g, function (char) {
            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                "\"": "&quot;"
            }[char];
        });
    }

    function formatTime(value) {
        const date = value ? new Date(value) : new Date();

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        return date.getFullYear() + "年" +
            (date.getMonth() + 1) + "月" +
            date.getDate() + "日 " +
            String(date.getHours()).padStart(2, "0") + ":" +
            String(date.getMinutes()).padStart(2, "0");
    }

    function setReviewFormEnabled(enabled) {
        if (!reviewForm) {
            return;
        }

        reviewForm.hidden = !enabled;
        reviewForm.querySelectorAll("input, select, textarea, button").forEach(function (field) {
            field.disabled = !enabled;
        });

        if (submitButton) {
            submitButton.textContent = enabled ? "发布评价" : "登录后评价";
        }
    }

    function setAuthControls(isLoggedIn) {
        authFields.forEach(function (field) {
            field.hidden = isLoggedIn;
        });

        if (loginButton) {
            loginButton.hidden = isLoggedIn;
        }

        if (logoutButton) {
            logoutButton.hidden = !isLoggedIn;
        }

        if (authNote) {
            authNote.hidden = isLoggedIn;
        }

        if (authLink) {
            authLink.hidden = isLoggedIn;
        }
    }

    function showConfigMissing() {
        setStatus(authStatus, CONFIG_MISSING_TEXT, "warning");
        setStatus(reviewStatus, CONFIG_MISSING_TEXT, "warning");
        setReviewFormEnabled(false);
        setAuthControls(false);
        setReviewPanelExpanded(false);

        if (reviewToggle) {
            reviewToggle.hidden = true;
        }

        if (reviewList) {
            reviewList.innerHTML = '<div class="price-empty">' + CONFIG_MISSING_TEXT + '</div>';
        }
    }

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            if (document.querySelector('script[src="' + src + '"]')) {
                resolve();
                return;
            }

            const script = document.createElement("script");

            script.src = src;
            script.async = true;
            script.onload = resolve;
            script.onerror = function () {
                script.remove();
                reject(new Error("script-load-failed"));
            };
            document.head.appendChild(script);
        });
    }

    function syncExpandableReviews() {
        if (!reviewList) {
            return;
        }

        reviewList.querySelectorAll(".price-review-message").forEach(function (message) {
            const item = message.closest(".price-review-item");
            const button = item ? item.querySelector(".price-review-expand") : null;

            if (!button) {
                return;
            }

            message.classList.add("is-collapsed");
            button.hidden = true;

            window.requestAnimationFrame(function () {
                const isOverflowing = message.scrollHeight > message.clientHeight + 1;

                button.hidden = !isOverflowing;
                if (!isOverflowing) {
                    message.classList.remove("is-collapsed");
                }
            });
        });
    }

    function renderReviews(reviews) {
        if (!reviewList) {
            return;
        }

        if (!reviews || !reviews.length) {
            reviewList.innerHTML = '<div class="price-empty">' + REVIEW_EMPTY_TEXT + '</div>';
            return;
        }

        reviewList.innerHTML = reviews.map(function (review) {
            const rating = Math.max(1, Math.min(5, Number(review.rating) || 5));

            return [
                '<article class="price-review-item">',
                    '<div class="price-review-head">',
                        '<strong>' + escapeHtml(review.nickname) + '</strong>',
                        '<span class="price-review-stars">' + "★".repeat(rating) + "☆".repeat(5 - rating) + '</span>',
                    '</div>',
                    '<div class="price-review-meta">' + escapeHtml(review.service_type) + ' · ' + escapeHtml(formatTime(review.created_at)) + '</div>',
                    '<p class="price-review-message is-collapsed">' + escapeHtml(review.message) + '</p>',
                    '<button class="price-review-expand" type="button" hidden>展开全文</button>',
                '</article>'
            ].join("");
        }).join("");
        syncExpandableReviews();
    }

    async function loadReviews() {
        if (!client) {
            return;
        }

        const response = await client
            .from("boss_reviews")
            .select("nickname, service_type, rating, message, created_at")
            .order("created_at", { ascending: false });

        if (response.error) {
            setStatus(reviewStatus, "评价暂时没有取到，请稍后再试～", "warning");
            renderReviews([]);
            return;
        }

        renderReviews(response.data || []);
    }

    function renderAuthState() {
        if (!currentUser) {
            setStatus(authStatus, "已有老板账号？登录后可以发布评价。", "neutral");
            setReviewFormEnabled(false);
            setAuthControls(false);
            return;
        }

        const label = currentUser.user_metadata && currentUser.user_metadata.name ?
            currentUser.user_metadata.name :
            currentUser.email;

        setStatus(authStatus, "欢迎回来，" + label, "good");
        setReviewFormEnabled(true);
        setAuthControls(true);
        if (nicknameInput && !nicknameInput.value && currentUser.email) {
            nicknameInput.value = currentUser.email.split("@")[0].slice(0, 20);
        }
    }

    async function refreshSession() {
        const sessionResponse = await client.auth.getSession();

        currentUser = sessionResponse.data && sessionResponse.data.session ?
            sessionResponse.data.session.user :
            null;
        renderAuthState();
    }

    async function handleLogin() {
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            setStatus(authStatus, "请先填写邮箱和密码。", "warning");
            return;
        }

        loginButton.disabled = true;
        const response = await client.auth.signInWithPassword({ email: email, password: password });
        loginButton.disabled = false;

        if (response.error) {
            setStatus(authStatus, "登录失败，请检查邮箱或密码。", "warning");
            return;
        }

        currentUser = response.data && response.data.session ? response.data.session.user : response.data.user;
        renderAuthState();
    }

    async function handleLogout() {
        await client.auth.signOut();
        currentUser = null;
        renderAuthState();
    }

    async function handleReviewSubmit(event) {
        event.preventDefault();

        if (!currentUser) {
            setStatus(reviewStatus, "请先登录后再评价。", "warning");
            return;
        }

        const nickname = nicknameInput.value.trim().slice(0, 20);
        const serviceType = serviceInput.value;
        const rating = Number(ratingInput.value);
        const message = messageInput.value.trim().slice(0, 300);

        if (!nickname || !message) {
            setStatus(reviewStatus, "昵称和评价内容都要填写哦。", "warning");
            return;
        }

        if (VALID_SERVICE_TYPES.indexOf(serviceType) === -1 || rating < 1 || rating > 5) {
            setStatus(reviewStatus, "评价内容有点不对，请重新检查一下。", "warning");
            return;
        }

        submitButton.disabled = true;
        const response = await client.from("boss_reviews").insert({
            user_id: currentUser.id,
            nickname: nickname,
            service_type: serviceType,
            rating: rating,
            message: message
        });
        submitButton.disabled = false;

        if (response.error) {
            setStatus(reviewStatus, response.error.message || "评价提交失败，请稍后再试～", "warning");
            return;
        }

        reviewForm.reset();
        setStatus(reviewStatus, SUCCESS_TEXT, "good");
        setReviewPanelExpanded(false);
        await loadReviews();
        renderAuthState();
    }

    async function init() {
        if (!authStatus || !reviewStatus || !reviewList || !authForm || !reviewForm) {
            return;
        }

        setReviewPanelExpanded(false);

        if (reviewToggle) {
            reviewToggle.addEventListener("click", function () {
                setReviewPanelExpanded(!reviewPanelExpanded);
            });
        }

        if (reviewList) {
            reviewList.addEventListener("click", function (event) {
                const button = event.target.closest(".price-review-expand");

                if (!button) {
                    return;
                }

                const item = button.closest(".price-review-item");
                const message = item ? item.querySelector(".price-review-message") : null;

                if (!message) {
                    return;
                }

                const isCollapsed = message.classList.toggle("is-collapsed");
                button.textContent = isCollapsed ? "展开全文" : "收起";
            });
        }

        if (!hasUsableConfig()) {
            showConfigMissing();
            return;
        }

        setStatus(authStatus, "正在连接老板评价系统…", "neutral");

        try {
            await loadScript(SUPABASE_CDN);
            client = window.supabase.createClient(getConfigValue("SUPABASE_URL"), getConfigValue("SUPABASE_ANON_KEY"));
        } catch (error) {
            setStatus(authStatus, "老板评价系统连接失败，请稍后再试～", "warning");
            setStatus(reviewStatus, "老板评价系统连接失败，请稍后再试～", "warning");
            setReviewFormEnabled(false);
            return;
        }

        loginButton.addEventListener("click", handleLogin);
        logoutButton.addEventListener("click", handleLogout);
        reviewForm.addEventListener("submit", handleReviewSubmit);

        client.auth.onAuthStateChange(function (event, session) {
            currentUser = session ? session.user : null;
            renderAuthState();
        });

        await refreshSession();
        await loadReviews();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
