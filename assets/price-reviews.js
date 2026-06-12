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
    let currentReviews = [];
    let reviewPanelExpanded = false;
    const reviewInteractions = new Map();

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

    function getEmailNickname() {
        return currentUser && currentUser.email ? currentUser.email.split("@")[0].slice(0, 20) : "";
    }

    function getReviewById(reviewId) {
        return currentReviews.find(function (review) {
            return review.id === reviewId;
        }) || null;
    }

    function ensureInteraction(reviewId) {
        const current = reviewInteractions.get(reviewId) || {};
        const next = {
            likesCount: Number(current.likesCount) || 0,
            userLiked: !!current.userLiked,
            comments: Array.isArray(current.comments) ? current.comments : [],
            commentsOpen: !!current.commentsOpen,
            commentsExpanded: !!current.commentsExpanded
        };

        reviewInteractions.set(reviewId, next);
        return next;
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

    function syncExpandableReviews(root) {
        const container = root || reviewList;

        if (!container) {
            return;
        }

        container.querySelectorAll(".price-review-message").forEach(function (message) {
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

    function renderComments(reviewId, interaction) {
        const comments = interaction.comments || [];
        const visibleComments = interaction.commentsExpanded ? comments : comments.slice(0, 3);
        const commentsHtml = visibleComments.length ? visibleComments.map(function (comment) {
            return [
                '<div class="price-review-comment">',
                    '<div class="price-review-comment-meta">',
                        '<strong>' + escapeHtml(comment.nickname || "老板") + '</strong>',
                        '<span>' + escapeHtml(formatTime(comment.created_at)) + '</span>',
                    '</div>',
                    '<p>' + escapeHtml(comment.message || "") + '</p>',
                '</div>'
            ].join("");
        }).join("") : '<div class="price-review-comment-empty">暂无评论。</div>';
        const moreButton = comments.length > 3 ?
            '<button class="price-review-small-button" type="button" data-action="toggle-more-comments">' +
                (interaction.commentsExpanded ? "收起评论" : "查看更多评论") +
            '</button>' :
            '';
        const formHtml = currentUser ? [
            '<form class="price-review-comment-form">',
                '<input name="nickname" maxlength="20" placeholder="昵称，可选" value="' + escapeHtml(getEmailNickname()) + '">',
                '<textarea name="message" maxlength="120" placeholder="写一条评论，最多 120 字"></textarea>',
                '<button class="price-review-small-button" type="submit">发布评论</button>',
            '</form>'
        ].join("") : '<div class="price-review-comment-login">登录后可以发表评论。</div>';

        return [
            '<div class="price-review-comments">',
                '<div class="price-review-comment-list">',
                    commentsHtml,
                '</div>',
                moreButton,
                formHtml,
            '</div>'
        ].join("");
    }

    function renderReviewItem(review) {
        const rating = Math.max(1, Math.min(5, Number(review.rating) || 5));
        const interaction = ensureInteraction(review.id);
        const commentsCount = interaction.comments.length;

        return [
            '<article class="price-review-item" data-review-id="' + escapeHtml(review.id) + '">',
                '<div class="price-review-head">',
                    '<strong>' + escapeHtml(review.nickname) + '</strong>',
                    '<span class="price-review-stars">' + "★".repeat(rating) + "☆".repeat(5 - rating) + '</span>',
                '</div>',
                '<div class="price-review-meta">' + escapeHtml(review.service_type) + ' · ' + escapeHtml(formatTime(review.created_at)) + '</div>',
                '<p class="price-review-message is-collapsed">' + escapeHtml(review.message) + '</p>',
                '<button class="price-review-expand" type="button" hidden>展开全文</button>',
                '<div class="price-review-actions">',
                    '<button class="price-review-action' + (interaction.userLiked ? ' is-liked' : '') + '" type="button" data-action="toggle-like">' +
                        (interaction.userLiked ? "♥ 已赞" : "♡ 点赞") +
                    '</button>',
                    '<span class="price-review-count">' + interaction.likesCount + ' 赞</span>',
                    '<button class="price-review-action" type="button" data-action="toggle-comments">' +
                        (interaction.commentsOpen ? "收起评论" : "评论") +
                    '</button>',
                    '<span class="price-review-count">' + commentsCount + ' 条评论</span>',
                '</div>',
                interaction.commentsOpen ? renderComments(review.id, interaction) : '',
            '</article>'
        ].join("");
    }

    function renderReviews(reviews) {
        if (!reviewList) {
            return;
        }

        if (!reviews || !reviews.length) {
            reviewList.innerHTML = '<div class="price-empty">' + REVIEW_EMPTY_TEXT + '</div>';
            return;
        }

        reviewList.innerHTML = reviews.map(renderReviewItem).join("");
        syncExpandableReviews();
    }

    async function loadReviewInteractions(reviewIds) {
        if (!client || !reviewIds.length) {
            return;
        }

        reviewIds.forEach(function (reviewId) {
            const interaction = ensureInteraction(reviewId);

            interaction.likesCount = 0;
            interaction.userLiked = false;
            interaction.comments = [];
        });

        const likesResponse = await client
            .from("boss_review_likes")
            .select("review_id, user_id")
            .in("review_id", reviewIds);

        if (likesResponse.error) {
            setStatus(reviewStatus, likesResponse.error.message, "warning");
        } else {
            (likesResponse.data || []).forEach(function (like) {
                const interaction = ensureInteraction(like.review_id);

                interaction.likesCount += 1;
                if (currentUser && like.user_id === currentUser.id) {
                    interaction.userLiked = true;
                }
            });
        }

        const commentsResponse = await client
            .from("boss_review_comments")
            .select("id, review_id, user_id, nickname, message, created_at")
            .in("review_id", reviewIds)
            .order("created_at", { ascending: true });

        if (commentsResponse.error) {
            setStatus(reviewStatus, commentsResponse.error.message, "warning");
            return;
        }

        (commentsResponse.data || []).forEach(function (comment) {
            ensureInteraction(comment.review_id).comments.push(comment);
        });
    }

    async function refreshSingleReview(reviewId) {
        await loadReviewInteractions([reviewId]);
        updateReviewCard(reviewId);
    }

    function updateReviewCard(reviewId) {
        const review = getReviewById(reviewId);
        const card = reviewList ? reviewList.querySelector('[data-review-id="' + reviewId + '"]') : null;

        if (!review || !card) {
            renderReviews(currentReviews);
            return;
        }

        card.outerHTML = renderReviewItem(review);
        const nextCard = reviewList.querySelector('[data-review-id="' + reviewId + '"]');
        syncExpandableReviews(nextCard);
    }

    async function loadReviews() {
        if (!client) {
            return;
        }

        const response = await client
            .from("boss_reviews")
            .select("id, nickname, service_type, rating, message, created_at")
            .order("created_at", { ascending: false });

        if (response.error) {
            setStatus(reviewStatus, response.error.message, "warning");
            renderReviews([]);
            return;
        }

        currentReviews = response.data || [];
        await loadReviewInteractions(currentReviews.map(function (review) {
            return review.id;
        }));
        renderReviews(currentReviews);
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
            nicknameInput.value = getEmailNickname();
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
            setStatus(authStatus, response.error.message, "warning");
            return;
        }

        currentUser = response.data && response.data.session ? response.data.session.user : response.data.user;
        renderAuthState();
        await loadReviews();
    }

    async function handleLogout() {
        await client.auth.signOut();
        currentUser = null;
        renderAuthState();
        await loadReviews();
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

    async function toggleLike(reviewId) {
        const interaction = ensureInteraction(reviewId);
        let response = null;

        if (!currentUser) {
            setStatus(reviewStatus, "请先登录后再点赞。", "warning");
            return;
        }

        if (interaction.userLiked) {
            response = await client
                .from("boss_review_likes")
                .delete()
                .eq("review_id", reviewId)
                .eq("user_id", currentUser.id);
        } else {
            response = await client.from("boss_review_likes").insert({
                review_id: reviewId,
                user_id: currentUser.id
            });
        }

        if (response.error) {
            setStatus(reviewStatus, response.error.message, "warning");
            return;
        }

        setStatus(reviewStatus, "", "");
        await refreshSingleReview(reviewId);
    }

    async function submitComment(form) {
        const card = form.closest(".price-review-item");
        const reviewId = card ? card.getAttribute("data-review-id") : "";
        const nicknameInputLocal = form.elements.nickname;
        const messageInputLocal = form.elements.message;
        const nickname = (nicknameInputLocal.value.trim() || getEmailNickname() || "老板").slice(0, 20);
        const message = messageInputLocal.value.trim().slice(0, 120);

        if (!currentUser) {
            setStatus(reviewStatus, "请先登录后再评论。", "warning");
            return;
        }

        if (!message) {
            setStatus(reviewStatus, "评论内容不能为空。", "warning");
            return;
        }

        const response = await client.from("boss_review_comments").insert({
            review_id: reviewId,
            user_id: currentUser.id,
            nickname: nickname,
            message: message
        });

        if (response.error) {
            setStatus(reviewStatus, response.error.message, "warning");
            return;
        }

        messageInputLocal.value = "";
        if (nicknameInputLocal.value.trim()) {
            nicknameInputLocal.value = nickname;
        }
        setStatus(reviewStatus, "评论已发布。", "good");
        await refreshSingleReview(reviewId);
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
                const expandButton = event.target.closest(".price-review-expand");
                const actionButton = event.target.closest("[data-action]");
                const card = event.target.closest(".price-review-item");
                const reviewId = card ? card.getAttribute("data-review-id") : "";

                if (expandButton) {
                    const item = expandButton.closest(".price-review-item");
                    const message = item ? item.querySelector(".price-review-message") : null;

                    if (!message) {
                        return;
                    }

                    const isCollapsed = message.classList.toggle("is-collapsed");
                    expandButton.textContent = isCollapsed ? "展开全文" : "收起";
                    return;
                }

                if (!actionButton || !reviewId) {
                    return;
                }

                if (actionButton.dataset.action === "toggle-like") {
                    toggleLike(reviewId);
                    return;
                }

                if (actionButton.dataset.action === "toggle-comments") {
                    const interaction = ensureInteraction(reviewId);

                    interaction.commentsOpen = !interaction.commentsOpen;
                    updateReviewCard(reviewId);
                    return;
                }

                if (actionButton.dataset.action === "toggle-more-comments") {
                    const interaction = ensureInteraction(reviewId);

                    interaction.commentsExpanded = !interaction.commentsExpanded;
                    updateReviewCard(reviewId);
                }
            });

            reviewList.addEventListener("submit", function (event) {
                const form = event.target.closest(".price-review-comment-form");

                if (!form) {
                    return;
                }

                event.preventDefault();
                submitComment(form);
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
            loadReviews();
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
