(function () {
    const CONFIG_MISSING_TEXT = "老板评价系统暂未配置，请稍后再来～";
    const REVIEW_EMPTY_TEXT = "这里还没有老板留下评价哦～";
    const INTERACTION_LOAD_ERROR_TEXT = "暂时加载失败";
    const SUPABASE_LOCAL_SDK = "assets/vendor/supabase-js-2.min.js?v=20260616-1";
    const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.108.2/dist/umd/supabase.min.js";
    const SUPABASE_SDK_LOAD_ERROR_TEXT = "老板评价功能加载失败，可能是网络暂时不稳定，请稍后再试。";
    const VALID_SERVICE_TYPES = ["王者荣耀", "永劫无间", "语音聊天", "其它"];

    const reviewStatus = document.getElementById("price-review-status");
    const reviewList = document.getElementById("price-review-list");
    const reviewStats = document.getElementById("price-review-stats");
    const ganyuReviewButton = document.getElementById("price-open-ganyu-review");

    let client = null;
    let currentUser = null;
    let currentReviews = [];
    let lastReviews = [];
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

    function logSupabaseError(context, error) {
        if (!error) {
            return;
        }

        console.error("[JunxueBossReviews] " + context, error);
    }

    function isConfigMissingError(error) {
        return !!error && error.message === CONFIG_MISSING_TEXT;
    }

    function isSdkLoadError(error) {
        return !!error && error.message === SUPABASE_SDK_LOAD_ERROR_TEXT;
    }

    function escapeHtml(value) {
        return String(value == null ? "" : value).replace(/[&<>"]/g, function (char) {
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
            likesFailed: !!current.likesFailed,
            commentsFailed: !!current.commentsFailed,
            commentsOpen: !!current.commentsOpen,
            commentsExpanded: !!current.commentsExpanded
        };

        reviewInteractions.set(reviewId, next);
        return next;
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

    async function loadSupabaseSdk() {
        if (window.supabase && typeof window.supabase.createClient === "function") {
            return;
        }

        try {
            await loadScript(SUPABASE_LOCAL_SDK);
        } catch (localError) {
            console.warn("[JunxueBossReviews] local Supabase SDK load failed, falling back to jsdelivr.", localError);
            try {
                await loadScript(SUPABASE_CDN);
            } catch (cdnError) {
                console.error("[JunxueBossReviews] Supabase SDK load failed.", cdnError);
                throw new Error(SUPABASE_SDK_LOAD_ERROR_TEXT);
            }
        }

        if (!window.supabase || typeof window.supabase.createClient !== "function") {
            throw new Error(SUPABASE_SDK_LOAD_ERROR_TEXT);
        }
    }

    async function ensureClient() {
        await loadScript("assets/supabase-config.js?v=20260611-1").catch(function () {});

        if (!hasUsableConfig()) {
            throw new Error(CONFIG_MISSING_TEXT);
        }

        if (!client) {
            await loadSupabaseSdk();
            client = window.supabase.createClient(getConfigValue("SUPABASE_URL"), getConfigValue("SUPABASE_ANON_KEY"));
            client.auth.onAuthStateChange(function (event, session) {
                currentUser = session ? session.user : null;
                if (reviewList) {
                    refreshReviewWall();
                }
            });
        }

        return client;
    }

    async function getSession() {
        const activeClient = await ensureClient();
        const sessionResponse = await activeClient.auth.getSession();

        currentUser = sessionResponse.data && sessionResponse.data.session ? sessionResponse.data.session.user : null;
        return sessionResponse.data ? sessionResponse.data.session : null;
    }

    async function login(email, password) {
        const activeClient = await ensureClient();
        const response = await activeClient.auth.signInWithPassword({ email: email, password: password });

        if (response.error) {
            throw response.error;
        }

        currentUser = response.data && response.data.session ? response.data.session.user : response.data.user;
        return response.data;
    }

    function normalizeBossDisplayName(displayName) {
        return String(displayName || "").trim().slice(0, 20);
    }

    function isMissingBossProfilesError(error) {
        const message = error && error.message ? error.message : "";
        const code = error && error.code ? error.code : "";

        return code === "42P01" || /boss_profiles|relation .* does not exist|schema cache/i.test(message);
    }

    async function saveBossProfile(activeClient, userId, displayName) {
        const safeDisplayName = normalizeBossDisplayName(displayName);

        if (!activeClient || !userId || !safeDisplayName) {
            return { saved: false, warning: "" };
        }

        const response = await activeClient
            .from("boss_profiles")
            .upsert({
                user_id: userId,
                display_name: safeDisplayName,
                updated_at: new Date().toISOString()
            }, { onConflict: "user_id" })
            .select("user_id")
            .single();

        if (response.error) {
            if (isMissingBossProfilesError(response.error)) {
                return {
                    saved: false,
                    warning: "老板昵称功能还需要执行数据库升级 SQL。"
                };
            }

            return {
                saved: false,
                warning: "老板账号已创建，但昵称暂时没有保存成功。稍后登录后可以再试。"
            };
        }

        return { saved: true, warning: "" };
    }

    async function register(email, password, displayName) {
        const activeClient = await ensureClient();
        const safeDisplayName = normalizeBossDisplayName(displayName);
        const response = await activeClient.auth.signUp({
            email: email,
            password: password,
            options: safeDisplayName ? {
                data: {
                    display_name: safeDisplayName,
                    nickname: safeDisplayName
                }
            } : undefined
        });

        if (response.error) {
            throw response.error;
        }

        const responseData = response.data || {};

        currentUser = responseData.session ? responseData.session.user : currentUser;
        responseData.profileWarning = "";
        responseData.profileSaved = false;

        if (safeDisplayName && responseData.session) {
            const userId = responseData.user ? responseData.user.id : "";

            try {
                const profileResult = await saveBossProfile(activeClient, userId, safeDisplayName);

                responseData.profileWarning = profileResult.warning || "";
                responseData.profileSaved = !!profileResult.saved;
            } catch (error) {
                logError("save boss profile failed", error);
                responseData.profileWarning = isMissingBossProfilesError(error) ?
                    "老板昵称功能还需要执行数据库升级 SQL。" :
                    "老板账号已创建，但昵称暂时没有保存成功。稍后登录后可以再试。";
            }
        }

        return responseData;
    }

    async function logout() {
        const activeClient = await ensureClient();
        const response = await activeClient.auth.signOut();

        if (response.error) {
            throw response.error;
        }

        currentUser = null;
        return true;
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
            interaction.likesFailed = false;
            interaction.commentsFailed = false;
        });

        let likesResponse = null;
        let commentsResponse = null;

        try {
            likesResponse = await client
                .from("boss_review_likes")
                .select("review_id, user_id")
                .in("review_id", reviewIds);
        } catch (error) {
            likesResponse = { error: error };
        }

        if (likesResponse.error) {
            logSupabaseError("boss_review_likes load failed", likesResponse.error);
            reviewIds.forEach(function (reviewId) {
                ensureInteraction(reviewId).likesFailed = true;
            });
            setStatus(reviewStatus, "点赞数据暂时加载失败：" + (likesResponse.error.message || INTERACTION_LOAD_ERROR_TEXT), "warning");
        } else {
            (likesResponse.data || []).forEach(function (like) {
                const interaction = ensureInteraction(like.review_id);

                interaction.likesCount += 1;
                if (currentUser && like.user_id === currentUser.id) {
                    interaction.userLiked = true;
                }
            });
        }

        try {
            commentsResponse = await client
                .from("boss_review_comments")
                .select("id, review_id, user_id, nickname, message, created_at")
                .in("review_id", reviewIds)
                .order("created_at", { ascending: true });
        } catch (error) {
            commentsResponse = { error: error };
        }

        if (commentsResponse.error) {
            logSupabaseError("boss_review_comments load failed", commentsResponse.error);
            reviewIds.forEach(function (reviewId) {
                ensureInteraction(reviewId).commentsFailed = true;
            });
            setStatus(reviewStatus, "评论数据暂时加载失败：" + (commentsResponse.error.message || INTERACTION_LOAD_ERROR_TEXT), "warning");
            return;
        }

        (commentsResponse.data || []).forEach(function (comment) {
            ensureInteraction(comment.review_id).comments.push(comment);
        });
    }

    async function loadReviews() {
        await ensureClient();
        await getSession();

        const response = await client
            .from("boss_reviews")
            .select("id, nickname, service_type, rating, message, created_at")
            .order("created_at", { ascending: false });

        if (response.error) {
            throw response.error;
        }

        currentReviews = response.data || [];
        lastReviews = currentReviews;
        await loadReviewInteractions(currentReviews.map(function (review) {
            return review.id;
        }));
        return currentReviews;
    }

    async function submitReview(payload) {
        await ensureClient();
        await getSession();

        if (!currentUser) {
            throw new Error("请先登录后再发布评价哦～");
        }

        const nickname = String(payload.nickname || "").trim().slice(0, 20);
        const serviceType = String(payload.serviceType || "").trim();
        const rating = Number(payload.rating);
        const message = String(payload.message || "").trim().slice(0, 300);

        if (!nickname || !message) {
            throw new Error("昵称和评价内容都要填写哦。");
        }

        if (VALID_SERVICE_TYPES.indexOf(serviceType) === -1 || rating < 1 || rating > 5) {
            throw new Error("评价内容有点不对，请重新检查一下。");
        }

        const response = await client.from("boss_reviews").insert({
            user_id: currentUser.id,
            nickname: nickname,
            service_type: serviceType,
            rating: rating,
            message: message
        });

        if (response.error) {
            throw response.error;
        }

        return true;
    }

    function calculateStats(reviews) {
        const items = Array.isArray(reviews) ? reviews : lastReviews;
        const counts = {};
        let totalRating = 0;
        let topService = "暂无";
        let topCount = 0;

        items.forEach(function (review) {
            const service = review.service_type || "其它";
            const rating = Number(review.rating) || 0;

            totalRating += rating;
            counts[service] = (counts[service] || 0) + 1;
            if (counts[service] > topCount) {
                topCount = counts[service];
                topService = service;
            }
        });

        return {
            total: items.length,
            averageRating: items.length ? (totalRating / items.length).toFixed(1) : "0.0",
            topService: topService
        };
    }

    function renderStats(reviews) {
        if (!reviewStats) {
            return;
        }

        const stats = calculateStats(reviews);

        reviewStats.innerHTML = [
            '<div class="price-review-stat"><span>总评价数</span><strong>' + stats.total + '</strong></div>',
            '<div class="price-review-stat"><span>平均星级</span><strong>' + stats.averageRating + ' ★</strong></div>',
            '<div class="price-review-stat"><span>最受欢迎服务</span><strong>' + escapeHtml(stats.topService) + '</strong></div>'
        ].join("");
    }

    function renderStatsError() {
        if (!reviewStats) {
            return;
        }

        reviewStats.innerHTML = [
            '<div class="price-review-stat"><span>总评价数</span><strong>--</strong></div>',
            '<div class="price-review-stat"><span>平均星级</span><strong>--</strong></div>',
            '<div class="price-review-stat"><span>最受欢迎服务</span><strong>加载失败</strong></div>'
        ].join("");
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
        if (interaction.commentsFailed) {
            return [
                '<div class="price-review-comments">',
                    '<div class="price-review-comment-empty">评论暂时加载失败。</div>',
                '</div>'
            ].join("");
        }

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
        const likeCountText = interaction.likesFailed ? INTERACTION_LOAD_ERROR_TEXT : interaction.likesCount + ' 赞';
        const commentCountText = interaction.commentsFailed ? INTERACTION_LOAD_ERROR_TEXT : commentsCount + ' 条评论';

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
                    '<span class="price-review-count">' + escapeHtml(likeCountText) + '</span>',
                    '<button class="price-review-action" type="button" data-action="toggle-comments">' +
                        (interaction.commentsOpen ? "收起评论" : "评论") +
                    '</button>',
                    '<span class="price-review-count">' + escapeHtml(commentCountText) + '</span>',
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
            reviewList.innerHTML = [
                '<div class="price-empty">',
                    '<strong>' + REVIEW_EMPTY_TEXT + '</strong>',
                    '<button class="price-button price-review-empty-action" type="button" data-action="open-ganyu-review">找甘雨发布第一条评价</button>',
                '</div>'
            ].join("");
            return;
        }

        reviewList.innerHTML = reviews.map(renderReviewItem).join("");
        syncExpandableReviews();
    }

    async function refreshReviewWall() {
        if (!reviewList) {
            return [];
        }

        try {
            const loadingText = "正在读取老板评价…";

            setStatus(reviewStatus, loadingText, "neutral");
            const reviews = await loadReviews();

            renderStats(reviews);
            renderReviews(reviews);
            if (!reviewStatus || reviewStatus.textContent === loadingText) {
                setStatus(reviewStatus, "", "");
            }
            return reviews;
        } catch (error) {
            renderStatsError();
            if (reviewList) {
                if (isConfigMissingError(error)) {
                    setStatus(reviewStatus, CONFIG_MISSING_TEXT, "warning");
                    reviewList.innerHTML = '<div class="price-empty">' + CONFIG_MISSING_TEXT + '</div>';
                } else {
                    logSupabaseError("boss_reviews load failed", error);
                    const message = isSdkLoadError(error) ? SUPABASE_SDK_LOAD_ERROR_TEXT : "老板评价加载失败：" + (error.message || "请稍后再试");

                    setStatus(reviewStatus, message, "warning");
                    reviewList.innerHTML = '<div class="price-empty">' + escapeHtml(message) + '</div>';
                }
            }
            return [];
        }
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

    async function openGanyuReviewMenu() {
        function openMenu() {
            if (window.Live2DInteractiveMenu && typeof window.Live2DInteractiveMenu.openBossReviews === "function") {
                window.Live2DInteractiveMenu.openBossReviews();
                return true;
            }
            if (window.JunxueGanyuLazy && typeof window.JunxueGanyuLazy.openBossReviews === "function") {
                window.JunxueGanyuLazy.openBossReviews().catch(function () {});
                return true;
            }
            return false;
        }

        if (openMenu()) {
            return;
        }

        if (window.JunxueLive2DLoader && typeof window.JunxueLive2DLoader.load === "function") {
            await window.JunxueLive2DLoader.load();
            window.setTimeout(function () {
                if (!openMenu()) {
                    setStatus(reviewStatus, "甘雨还在准备中，请稍后再点一次哦～", "warning");
                }
            }, 900);
            return;
        }

        setStatus(reviewStatus, "甘雨菜单暂时不可用，请稍后再试～", "warning");
    }

    function bindReviewWallEvents() {
        if (ganyuReviewButton) {
            ganyuReviewButton.addEventListener("click", openGanyuReviewMenu);
        }

        if (!reviewList) {
            return;
        }

        reviewList.addEventListener("click", function (event) {
            const emptyAction = event.target.closest('[data-action="open-ganyu-review"]');
            const expandButton = event.target.closest(".price-review-expand");
            const actionButton = event.target.closest("[data-action]");
            const card = event.target.closest(".price-review-item");
            const reviewId = card ? card.getAttribute("data-review-id") : "";

            if (emptyAction) {
                openGanyuReviewMenu();
                return;
            }

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

    window.JunxueBossReviews = {
        getSession: getSession,
        login: login,
        register: register,
        logout: logout,
        loadReviews: loadReviews,
        submitReview: submitReview,
        refreshReviewWall: refreshReviewWall,
        calculateStats: calculateStats
    };

    async function init() {
        bindReviewWallEvents();

        if (!reviewList) {
            return;
        }

        await refreshReviewWall();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
