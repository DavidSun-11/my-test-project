(function () {
    const SCRIPT_VERSION = "20260709-boss-reviews-mobile-moonlake2";
    const REVIEW_QUERY_TIMEOUT_MS = 9000;
    const OPTIONAL_QUERY_TIMEOUT_MS = 3500;
    const REVIEW_LOADING_TEXT = "\u6b63\u5728\u8bfb\u53d6\u8001\u677f\u8bc4\u4ef7...";
    const BOSS_REVIEW_TABLE = "boss_reviews";
    const BOSS_REVIEW_QUERY_FIELDS = "id, nickname, service_type, rating, message, created_at";
    const BOSS_REVIEW_QUERY_FILTERS = "none";
    const CONFIG_MISSING_TEXT = "老板评价连接暂时不可用，请稍后再来～";
    const REVIEW_EMPTY_TEXT = "还没有老板评价，欢迎第一位老板来写下反馈～";
    const REVIEW_LOAD_ERROR_TEXT = "老板评价暂时加载失败，请稍后再试。";
    const INTERACTION_LOAD_ERROR_TEXT = "暂时加载失败";
    const SUPABASE_LOCAL_SDK = "assets/vendor/supabase-js-2.min.js?v=20260616-1";
    const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.108.2/dist/umd/supabase.min.js";
    const SUPABASE_SDK_LOAD_ERROR_TEXT = "老板评价功能加载失败，可能是网络暂时不稳定，请稍后再试。";
    const BLOCKED_INTERACTION_TEXT = "当前账号暂时不能参与互动，如有疑问可以联系君雪。";
    const REVIEW_SORT_LATEST = "latest";
    const REVIEW_SORT_LIKES = "likes";
    const REVIEW_SORT_ALL = "all";
    const REVIEW_PAGE_SIZE_DESKTOP = 6;
    const REVIEW_PAGE_SIZE_MOBILE = 4;
    const VALID_SERVICE_TYPES = ["王者荣耀", "永劫无间", "语音聊天", "其它"];

    const PENDING_BOSS_REGISTER_KEY = "junxuePendingBossRegistration";
    const PENDING_BOSS_REGISTER_TTL = 24 * 60 * 60 * 1000;
    const BOSS_NICKNAME_CACHE_PREFIX = "junxueBossNickname:";

    const reviewStatus = document.getElementById("price-review-status");
    const reviewList = document.getElementById("price-review-list");
    const reviewStats = document.getElementById("price-review-stats");
    const ganyuReviewButton = document.getElementById("price-open-ganyu-review");
    const reviewSortControls = document.getElementById("price-review-sort-controls");
    const reviewPagination = document.getElementById("price-review-pagination");
    const reviewListTop = document.getElementById("boss-review-list-top");
    const isBossReviewsMobilePage = !!(
        document.querySelector(".boss-reviews-mobile-page") ||
        /(^|\/)boss-reviews-mobile\.html$/i.test(window.location.pathname || "")
    );
    const isBossReviewsPage = !!(
        !isBossReviewsMobilePage &&
        (
            document.querySelector(".boss-reviews-page") ||
            document.getElementById("boss-reviews") ||
            /(^|\/)boss-reviews\.html$/i.test(window.location.pathname || "")
        )
    );

    let client = null;
    let currentUser = null;
    let currentReviews = [];
    let lastReviews = [];
    let currentBossDisplayName = "";
    let authListenerBound = false;
    let reviewWallEventsBound = false;
    let reviewWallInitStarted = false;
    let refreshReviewWallToken = 0;
    let scheduledReviewRefreshTimer = null;
    let missingDomDebugged = false;
    let activeReviewSort = REVIEW_SORT_LATEST;
    let currentReviewPage = 1;
    let lastReviewPageSize = 0;
    let reviewResizeTimer = null;
    const expandedReviewIds = new Set();
    const reviewInteractions = new Map();

    function debugBossReviews(message, detail) {
        const text = String(message || "").slice(0, 160);
        const payload = detail && typeof detail === "object" ? detail : null;

        window.__JUNXUE_BOSS_REVIEWS_DEBUG__ = window.__JUNXUE_BOSS_REVIEWS_DEBUG__ || [];
        window.__JUNXUE_BOSS_REVIEWS_DEBUG__.push({
            message: text,
            detail: payload,
            time: new Date().toISOString()
        });
        if (window.__JUNXUE_BOSS_REVIEWS_DEBUG__.length > 80) {
            window.__JUNXUE_BOSS_REVIEWS_DEBUG__.shift();
        }

        if (window.console && typeof window.console.debug === "function") {
            if (payload) {
                window.console.debug("[JunxueBossReviews] " + text, payload);
            } else {
                window.console.debug("[JunxueBossReviews] " + text);
            }
        }
    }

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

    function summarizeSupabaseError(error) {
        if (!error) {
            return {};
        }

        return {
            message: error.message ? String(error.message).slice(0, 180) : "unknown",
            code: error.code ? String(error.code).slice(0, 40) : "",
            status: error.status ? String(error.status).slice(0, 20) : ""
        };
    }

    function logSupabaseError(context, error) {
        if (!error) {
            return;
        }

        console.warn("[JunxueBossReviews] " + context, summarizeSupabaseError(error));
    }

    function getSafeErrorReason(error) {
        const message = error && error.message ? String(error.message) : "";
        const code = error && error.code ? String(error.code) : "";
        const status = error && error.status ? String(error.status) : "";

        if (message === CONFIG_MISSING_TEXT) {
            return "missing-config";
        }
        if (message === SUPABASE_SDK_LOAD_ERROR_TEXT) {
            return "sdk-load-failed";
        }
        if (message === "boss-reviews-timeout") {
            return "timeout";
        }
        if (message === "boss-reviews-auth-session-timeout") {
            return "auth-session-timeout";
        }
        if (message === "boss-reviews-likes-timeout") {
            return "likes-timeout";
        }
        if (message === "boss-reviews-comments-timeout") {
            return "comments-timeout";
        }
        if (/row-level security|violates row-level security|permission|not authorized|forbidden|denied|42501|403/i.test(message + " " + code + " " + status)) {
            return "permission-denied";
        }
        if (/failed to fetch|network|fetch|load failed/i.test(message)) {
            return "network-error";
        }
        if (/relation .* does not exist|schema cache|does not exist|42P01/i.test(message + " " + code)) {
            return "schema-missing";
        }
        if (status) {
            return "supabase-status-" + status.replace(/[^\w-]/g, "").slice(0, 24);
        }
        if (code) {
            return "supabase-code-" + code.replace(/[^\w-]/g, "").slice(0, 24);
        }
        return "unknown-error";
    }

    function withTimeout(promise, timeoutMs, timeoutMessage) {
        let timer = null;
        const timeout = new Promise(function (resolve, reject) {
            timer = window.setTimeout(function () {
                reject(new Error(timeoutMessage || "boss-reviews-timeout"));
            }, timeoutMs);
        });

        return Promise.race([promise, timeout]).finally(function () {
            window.clearTimeout(timer);
        });
    }

    function getReviewWallDomState() {
        const missing = [];

        if (!reviewStatus) {
            missing.push("price-review-status");
        }
        if (!reviewList) {
            missing.push("price-review-list");
        }
        if (!reviewStats) {
            missing.push("price-review-stats");
        }
        if (!ganyuReviewButton) {
            missing.push("price-open-ganyu-review");
        }
        if (missing.length && !missingDomDebugged) {
            missingDomDebugged = true;
            debugBossReviews("boss reviews query failed: missing-dom", {
                missing: missing.join(",")
            });
        }

        return {
            missing: missing,
            canRenderList: !!reviewList
        };
    }

    function debugBossProfile(context) {
        if (window.console && typeof window.console.debug === "function") {
            window.console.debug("[JunxueBossReviews] " + context);
        }
    }

    function isConfigMissingError(error) {
        return !!error && error.message === CONFIG_MISSING_TEXT;
    }

    function isSdkLoadError(error) {
        return !!error && error.message === SUPABASE_SDK_LOAD_ERROR_TEXT;
    }

    function isBlockedInteractionError(error) {
        const message = error && error.message ? String(error.message) : "";
        return message === BLOCKED_INTERACTION_TEXT ||
            /account.*blocked|blocked.*account|账号.*暂时不能参与互动|row-level security|violates row-level security|policy/i.test(message);
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

    function normalizeBossEmail(email) {
        return String(email || "").trim().toLowerCase();
    }

    function maskBossEmail(email) {
        const value = String(email || "").trim();
        const atIndex = value.indexOf("@");

        if (atIndex <= 0) {
            return "";
        }

        const local = value.slice(0, atIndex);
        const domain = value.slice(atIndex + 1);
        return local.slice(0, 1) + "***@" + domain;
    }

    function getBossMetadataDisplayName(user) {
        const metadata = user && user.user_metadata ? user.user_metadata : {};
        return normalizeBossDisplayName(
            metadata.boss_nickname ||
            metadata.display_name ||
            metadata.nickname ||
            metadata.full_name ||
            metadata.name
        );
    }

    function createShortHash(value) {
        let hash = 2166136261;
        const text = String(value || "");

        for (let index = 0; index < text.length; index += 1) {
            hash ^= text.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }

        return (hash >>> 0).toString(36);
    }

    function getBossNicknameCacheKey(user) {
        return user && user.id ? BOSS_NICKNAME_CACHE_PREFIX + createShortHash(user.id) : "";
    }

    function readCachedBossNickname(user) {
        const key = getBossNicknameCacheKey(user);

        if (!key) {
            return "";
        }

        try {
            return normalizeBossDisplayName(window.localStorage.getItem(key));
        } catch (error) {
            return "";
        }
    }

    function writeCachedBossNickname(user, displayName) {
        const key = getBossNicknameCacheKey(user);
        const safeDisplayName = normalizeBossDisplayName(displayName);

        if (!key || !safeDisplayName) {
            return;
        }

        try {
            window.localStorage.setItem(key, safeDisplayName);
        } catch (error) {}
    }

    function clearPendingBossRegistration() {
        try {
            window.sessionStorage.removeItem(PENDING_BOSS_REGISTER_KEY);
        } catch (error) {}
    }

    function readPendingBossRegistration() {
        let pending = null;

        try {
            pending = JSON.parse(window.sessionStorage.getItem(PENDING_BOSS_REGISTER_KEY) || "null");
        } catch (error) {
            pending = null;
        }

        if (!pending || typeof pending !== "object") {
            return null;
        }

        const createdAt = Number(pending.createdAt) || 0;
        if (!createdAt || Date.now() - createdAt > PENDING_BOSS_REGISTER_TTL) {
            clearPendingBossRegistration();
            return null;
        }

        const email = normalizeBossEmail(pending.email);
        const displayName = normalizeBossDisplayName(pending.displayName);

        if (!email || !displayName) {
            return null;
        }

        return {
            email: email,
            displayName: displayName,
            createdAt: createdAt,
            dismissed: !!pending.dismissed,
            maskedEmail: maskBossEmail(email)
        };
    }

    function savePendingBossRegistration(email, displayName) {
        const safeEmail = normalizeBossEmail(email);
        const safeDisplayName = normalizeBossDisplayName(displayName);

        if (!safeEmail || !safeDisplayName) {
            return null;
        }

        try {
            window.sessionStorage.setItem(PENDING_BOSS_REGISTER_KEY, JSON.stringify({
                email: safeEmail,
                displayName: safeDisplayName,
                createdAt: Date.now(),
                dismissed: false
            }));
        } catch (error) {}

        return readPendingBossRegistration();
    }

    function dismissPendingBossRegistration() {
        const pending = readPendingBossRegistration();

        if (!pending) {
            return null;
        }

        try {
            window.sessionStorage.setItem(PENDING_BOSS_REGISTER_KEY, JSON.stringify({
                email: pending.email,
                displayName: pending.displayName,
                createdAt: pending.createdAt,
                dismissed: true
            }));
        } catch (error) {}

        return readPendingBossRegistration();
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

    function isFullReviewPageMode() {
        return !!(
            reviewList &&
            reviewList.getAttribute("data-review-pagination") === "true" &&
            !reviewList.getAttribute("data-review-limit")
        );
    }

    function isBossReviewsFullPageMode() {
        return isBossReviewsPage && isFullReviewPageMode();
    }

    function isBossReviewsMobileFullPageMode() {
        return isBossReviewsMobilePage && isFullReviewPageMode();
    }

    function getReviewPageSize() {
        if (window.matchMedia && window.matchMedia("(max-width: 640px)").matches) {
            return REVIEW_PAGE_SIZE_MOBILE;
        }

        return REVIEW_PAGE_SIZE_DESKTOP;
    }

    function getReviewTimeValue(review) {
        const value = review && review.created_at ? Date.parse(review.created_at) : 0;

        return Number.isFinite(value) ? value : 0;
    }

    function getReviewLikeCount(reviewId) {
        return ensureInteraction(reviewId).likesCount || 0;
    }

    function calculateTopLikeCount(reviews) {
        const items = Array.isArray(reviews) ? reviews : lastReviews;

        if (!items.length) {
            return "--";
        }

        return items.reduce(function (top, review) {
            return Math.max(top, getReviewLikeCount(review.id));
        }, 0);
    }

    function getReviewAvatarText(name) {
        const text = String(name || "").trim();

        return text ? text.slice(0, 1) : "雪";
    }

    function sortReviewsForDisplay(reviews) {
        const items = (reviews || []).slice();

        items.sort(function (left, right) {
            if (activeReviewSort === REVIEW_SORT_LIKES) {
                const likeDelta = getReviewLikeCount(right.id) - getReviewLikeCount(left.id);

                if (likeDelta !== 0) {
                    return likeDelta;
                }
            }

            return getReviewTimeValue(right) - getReviewTimeValue(left);
        });

        return items;
    }

    function syncReviewSortControls() {
        if (!reviewSortControls) {
            return;
        }

        const enabled = isFullReviewPageMode();

        reviewSortControls.hidden = !enabled;
        reviewSortControls.querySelectorAll("[data-review-sort]").forEach(function (button) {
            const active = button.getAttribute("data-review-sort") === activeReviewSort;

            button.classList.toggle("is-active", active);
            button.setAttribute("aria-selected", active ? "true" : "false");
        });
    }

    function scrollToReviewListTop() {
        if (!isFullReviewPageMode()) {
            return;
        }

        const target = reviewListTop || reviewList;

        if (target && typeof target.scrollIntoView === "function") {
            target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }

    function renderReviewPagination(totalItems, pageSize) {
        if (!reviewPagination || !isFullReviewPageMode()) {
            return;
        }

        const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));

        if (totalItems <= pageSize) {
            reviewPagination.hidden = true;
            reviewPagination.innerHTML = "";
            return;
        }

        reviewPagination.hidden = false;
        reviewPagination.innerHTML = [
            '<button type="button" data-review-page="prev"' + (currentReviewPage <= 1 ? " disabled" : "") + '>上一页</button>',
            '<span>第 ' + currentReviewPage + ' / ' + pageCount + ' 页</span>',
            '<button type="button" data-review-page="next"' + (currentReviewPage >= pageCount ? " disabled" : "") + '>下一页</button>'
        ].join("");
    }

    function toggleReviewExpanded(reviewId) {
        if (!reviewId) {
            return;
        }

        if (expandedReviewIds.has(reviewId)) {
            expandedReviewIds.delete(reviewId);
        } else {
            expandedReviewIds.add(reviewId);
        }
    }

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            const existing = document.querySelector('script[src="' + src + '"]');

            if (existing) {
                if (existing.dataset.loaded === "true" || (src === SUPABASE_LOCAL_SDK && window.supabase && typeof window.supabase.createClient === "function")) {
                    resolve();
                    return;
                }
                existing.addEventListener("load", resolve, { once: true });
                existing.addEventListener("error", function () {
                    reject(new Error("script-load-failed"));
                }, { once: true });
                return;
            }

            const script = document.createElement("script");

            script.src = src;
            script.async = true;
            script.onload = function () {
                script.dataset.loaded = "true";
                resolve();
            };
            script.onerror = function () {
                script.remove();
                reject(new Error("script-load-failed"));
            };
            document.head.appendChild(script);
        });
    }

    async function loadSupabaseSdk() {
        debugBossReviews("boss reviews supabase sdk load start");
        if (window.supabase && typeof window.supabase.createClient === "function") {
            debugBossReviews("boss reviews supabase sdk loaded: true");
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
                debugBossReviews("boss reviews supabase sdk loaded: false");
                debugBossReviews("boss reviews supabase sdk load failed: script-load-failed");
                throw new Error(SUPABASE_SDK_LOAD_ERROR_TEXT);
            }
        }

        if (!window.supabase || typeof window.supabase.createClient !== "function") {
            debugBossReviews("boss reviews supabase sdk loaded: false");
            debugBossReviews("boss reviews supabase sdk load failed: missing-global");
            throw new Error(SUPABASE_SDK_LOAD_ERROR_TEXT);
        }
        debugBossReviews("boss reviews supabase sdk loaded: true");
    }

    function rememberSharedSupabaseClient(activeClient) {
        if (!activeClient) {
            return;
        }

        window.__JUNXUE_SUPABASE_CLIENT_STATE__ = window.__JUNXUE_SUPABASE_CLIENT_STATE__ || {};
        window.__JUNXUE_SUPABASE_CLIENT_STATE__.client = activeClient;
    }

    function scheduleReviewWallRefresh() {
        if (!reviewList) {
            return;
        }

        window.clearTimeout(scheduledReviewRefreshTimer);
        scheduledReviewRefreshTimer = window.setTimeout(function () {
            refreshReviewWall();
        }, 0);
    }

    async function ensureClient() {
        await loadScript("assets/supabase-config.js?v=20260611-1").catch(function () {});

        if (!client) {
            if (window.JunxueSupabaseClient && typeof window.JunxueSupabaseClient.getClient === "function") {
                try {
                    client = await window.JunxueSupabaseClient.getClient();
                    debugBossReviews("boss reviews client created");
                } catch (error) {
                    debugBossReviews("boss reviews client missing");
                    logSupabaseError("shared Supabase client unavailable", error);
                    client = null;
                }
            }

            if (!client && window.__JUNXUE_SUPABASE_CLIENT_STATE__ && window.__JUNXUE_SUPABASE_CLIENT_STATE__.client) {
                client = window.__JUNXUE_SUPABASE_CLIENT_STATE__.client;
            }

            if (!client) {
                if (!hasUsableConfig()) {
                    throw new Error(CONFIG_MISSING_TEXT);
                }

                await loadSupabaseSdk();
                client = window.supabase.createClient(getConfigValue("SUPABASE_URL"), getConfigValue("SUPABASE_ANON_KEY"));
                rememberSharedSupabaseClient(client);
                debugBossReviews("boss reviews client created");
            }
        }

        if (!client) {
            debugBossReviews("boss reviews client missing");
        }

        if (!authListenerBound && client && client.auth && typeof client.auth.onAuthStateChange === "function") {
            authListenerBound = true;
            client.auth.onAuthStateChange(function (event, session) {
                currentUser = session ? session.user : null;
                if (session && session.user) {
                    applyPendingBossNicknameForSession(session).catch(function () {
                        debugBossProfile("pending boss nickname apply unavailable");
                    });
                }
                scheduleReviewWallRefresh();
            });
        }

        return client;
    }

    async function syncOptionalSession() {
        try {
            await withTimeout(getSession(), OPTIONAL_QUERY_TIMEOUT_MS, "boss-reviews-auth-session-timeout");
        } catch (error) {
            currentUser = null;
            debugBossReviews("boss reviews query failed: " + getSafeErrorReason(error));
            logSupabaseError("boss review session sync skipped", error);
        }
    }

    async function getSession() {
        const activeClient = await ensureClient();
        const sessionResponse = await activeClient.auth.getSession();

        if (sessionResponse.error) {
            throw sessionResponse.error;
        }

        currentUser = sessionResponse.data && sessionResponse.data.session ? sessionResponse.data.session.user : null;
        return sessionResponse.data ? sessionResponse.data.session : null;
    }

    async function getOwnBossAccountFlags() {
        const activeClient = await ensureClient();
        const response = await activeClient.rpc("get_own_boss_account_flags", {});

        if (response.error) {
            if (/get_own_boss_account_flags|schema cache|function .* does not exist/i.test(response.error.message || "")) {
                return { isBlocked: false, blockedReason: "", warning: "老板账号管理功能还需要执行数据库升级 SQL。" };
            }
            throw response.error;
        }

        const row = Array.isArray(response.data) ? response.data[0] : response.data;

        return {
            isBlocked: !!(row && (row.is_blocked || row.isBlocked)),
            blockedReason: row && (row.blocked_reason || row.blockedReason) ? String(row.blocked_reason || row.blockedReason) : "",
            warning: ""
        };
    }

    async function ensureNotBlocked() {
        const flags = await getOwnBossAccountFlags();

        if (flags.isBlocked) {
            throw new Error(BLOCKED_INTERACTION_TEXT);
        }

        return flags;
    }

    async function login(email, password) {
        const activeClient = await ensureClient();
        const response = await activeClient.auth.signInWithPassword({ email: email, password: password });

        if (response.error) {
            throw response.error;
        }

        currentUser = response.data && response.data.session ? response.data.session.user : response.data.user;
        if (response.data && response.data.session) {
            try {
                await applyPendingBossNicknameForSession(response.data.session);
            } catch (error) {
                debugBossProfile("pending boss nickname apply unavailable");
            }
        }
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

    async function updateBossAuthMetadata(activeClient, user, displayName) {
        const safeDisplayName = normalizeBossDisplayName(displayName);

        if (!activeClient || !user || !safeDisplayName || !activeClient.auth || typeof activeClient.auth.updateUser !== "function") {
            return { saved: false, warning: "" };
        }

        const nextMetadata = Object.assign({}, user.user_metadata || {}, {
            boss_nickname: safeDisplayName,
            display_name: safeDisplayName,
            nickname: safeDisplayName
        });
        let response = null;

        try {
            response = await activeClient.auth.updateUser({ data: nextMetadata });
        } catch (error) {
            response = { error: error };
        }

        if (response.error) {
            debugBossProfile("boss metadata update unavailable");
            return {
                saved: false,
                warning: "老板昵称已尝试保存，但账号资料暂时同步失败。"
            };
        }

        if (response.data && response.data.user) {
            currentUser = response.data.user;
        }

        return { saved: true, warning: "" };
    }

    async function saveBossProfile(activeClient, userId, displayName) {
        const safeDisplayName = normalizeBossDisplayName(displayName);

        if (!activeClient || !userId || !safeDisplayName) {
            return { saved: false, warning: "" };
        }

        let response = null;

        try {
            response = await activeClient
                .from("boss_profiles")
                .upsert({
                    user_id: userId,
                    display_name: safeDisplayName,
                    updated_at: new Date().toISOString()
                }, { onConflict: "user_id" })
                .select("user_id")
                .single();
        } catch (error) {
            response = { error: error };
        }

        if (response.error) {
            debugBossProfile("boss profile save unavailable");
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

    async function applyPendingBossNicknameForSession(session) {
        const pending = readPendingBossRegistration();

        if (!pending || !session || !session.user) {
            return { applied: false, warning: "" };
        }

        if (normalizeBossEmail(session.user.email) !== pending.email) {
            return { applied: false, warning: "" };
        }

        const activeClient = await ensureClient();
        const metadataName = getBossMetadataDisplayName(session.user);
        const displayName = metadataName || pending.displayName;
        let metadataResult = { saved: !!metadataName, warning: "" };
        let profileResult = { saved: false, warning: "" };

        if (!displayName) {
            return { applied: false, warning: "" };
        }

        if (!metadataName) {
            metadataResult = await updateBossAuthMetadata(activeClient, session.user, displayName);
        }

        profileResult = await saveBossProfile(activeClient, session.user.id, displayName);
        writeCachedBossNickname(session.user, displayName);

        if (metadataResult.saved || metadataName) {
            clearPendingBossRegistration();
        }

        return {
            applied: !!(metadataResult.saved || metadataName),
            displayName: displayName,
            warning: profileResult.warning || metadataResult.warning || ""
        };
    }

    async function loadBossProfile() {
        const activeClient = await ensureClient();
        const session = await getSession();

        if (!session || !session.user) {
            currentBossDisplayName = "";
            return { displayName: "", warning: "" };
        }

        let response = null;
        const fallbackName = getBossMetadataDisplayName(session.user) || readCachedBossNickname(session.user);

        try {
            response = await activeClient
                .from("boss_profiles")
                .select("display_name")
                .eq("user_id", session.user.id)
                .maybeSingle();
        } catch (error) {
            response = { error: error };
        }

        if (response.error) {
            debugBossProfile("boss profile load unavailable");
            if (fallbackName) {
                currentBossDisplayName = fallbackName;
                writeCachedBossNickname(session.user, fallbackName);
                return {
                    displayName: fallbackName,
                    warning: isMissingBossProfilesError(response.error) ?
                        "老板昵称功能还需要执行数据库升级 SQL。" :
                        ""
                };
            }

            if (isMissingBossProfilesError(response.error)) {
                return {
                    displayName: "",
                    warning: "老板昵称功能还需要执行数据库升级 SQL。"
                };
            }

            return {
                displayName: "",
                warning: "老板昵称暂时读取失败，请稍后再试。"
            };
        }

        currentBossDisplayName = normalizeBossDisplayName(response.data && response.data.display_name);
        if (!currentBossDisplayName && fallbackName) {
            currentBossDisplayName = fallbackName;
            writeCachedBossNickname(session.user, fallbackName);
            saveBossProfile(activeClient, session.user.id, fallbackName).catch(function () {
                debugBossProfile("boss profile fallback save unavailable");
            });
        }

        if (currentBossDisplayName) {
            writeCachedBossNickname(session.user, currentBossDisplayName);
        }

        return { displayName: currentBossDisplayName, warning: "" };
    }

    async function syncOwnReviewNicknames(displayName) {
        const safeDisplayName = normalizeBossDisplayName(displayName);

        if (!client || !currentUser || !safeDisplayName) {
            return { synced: false, warning: "" };
        }

        const response = await client
            .from(BOSS_REVIEW_TABLE)
            .update({ nickname: safeDisplayName })
            .eq("user_id", currentUser.id);

        if (response.error) {
            logSupabaseError("boss_reviews nickname sync failed", response.error);
            return {
                synced: false,
                warning: "昵称已保存，部分旧评价昵称可能稍后再同步。"
            };
        }

        return { synced: true, warning: "" };
    }

    async function updateBossDisplayName(displayName) {
        const activeClient = await ensureClient();
        const session = await getSession();
        const safeDisplayName = normalizeBossDisplayName(displayName);

        if (!session || !session.user) {
            throw new Error("请先登录老板账号后再修改昵称哦。");
        }

        if (!safeDisplayName) {
            throw new Error("老板昵称不能为空哦");
        }

        if (String(displayName || "").trim().length > 20) {
            throw new Error("老板昵称最多 20 个字");
        }

        const metadataResult = await updateBossAuthMetadata(activeClient, session.user, safeDisplayName);
        const profileResult = await saveBossProfile(activeClient, session.user.id, safeDisplayName);

        if (!profileResult.saved && !metadataResult.saved) {
            throw new Error(profileResult.warning || metadataResult.warning || "老板昵称暂时保存失败，请稍后再试。");
        }

        currentBossDisplayName = safeDisplayName;
        writeCachedBossNickname(currentUser || session.user, safeDisplayName);
        const syncResult = await syncOwnReviewNicknames(safeDisplayName);

        return {
            displayName: safeDisplayName,
            warning: syncResult.warning || (!profileResult.saved ? profileResult.warning : "") || metadataResult.warning || ""
        };
    }

    async function getPreferredBossNickname(fallbackName) {
        const fallback = normalizeBossDisplayName(fallbackName) || getEmailNickname() || "老板";
        const profile = await loadBossProfile();

        if (profile.displayName) {
            return {
                displayName: profile.displayName,
                warning: profile.warning || ""
            };
        }

        if (fallback && currentUser && !profile.warning) {
            try {
                const result = await saveBossProfile(client, currentUser.id, fallback);
                return {
                    displayName: fallback,
                    warning: result.warning || ""
                };
            } catch (error) {
                return {
                    displayName: fallback,
                    warning: isMissingBossProfilesError(error) ?
                        "老板昵称功能还需要执行数据库升级 SQL。" :
                        ""
                };
            }
        }

        return {
            displayName: fallback,
            warning: profile.warning || ""
        };
    }

    async function register(email, password, displayName) {
        const activeClient = await ensureClient();
        const safeDisplayName = normalizeBossDisplayName(displayName);
        const response = await activeClient.auth.signUp({
            email: email,
            password: password,
            options: safeDisplayName ? {
                data: {
                    boss_nickname: safeDisplayName,
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
            const user = responseData.session.user || responseData.user;
            const userId = user ? user.id : "";
            writeCachedBossNickname(user, safeDisplayName);

            try {
                const profileResult = await saveBossProfile(activeClient, userId, safeDisplayName);

                responseData.profileWarning = profileResult.warning || "";
                responseData.profileSaved = !!profileResult.saved;
            } catch (error) {
                debugBossProfile("boss profile save after register unavailable");
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
            likesResponse = await withTimeout(
                client
                    .from("boss_review_likes")
                    .select("review_id, user_id")
                    .in("review_id", reviewIds),
                OPTIONAL_QUERY_TIMEOUT_MS,
                "boss-reviews-likes-timeout"
            );
        } catch (error) {
            likesResponse = { error: error };
        }

        if (likesResponse.error) {
            debugBossReviews("boss reviews query failed: " + getSafeErrorReason(likesResponse.error));
            logSupabaseError("boss_review_likes load failed", likesResponse.error);
            reviewIds.forEach(function (reviewId) {
                ensureInteraction(reviewId).likesFailed = true;
            });
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
            commentsResponse = await withTimeout(
                client
                    .from("boss_review_comments")
                    .select("id, review_id, user_id, nickname, message, created_at")
                    .in("review_id", reviewIds)
                    .order("created_at", { ascending: true }),
                OPTIONAL_QUERY_TIMEOUT_MS,
                "boss-reviews-comments-timeout"
            );
        } catch (error) {
            commentsResponse = { error: error };
        }

        if (commentsResponse.error) {
            debugBossReviews("boss reviews query failed: " + getSafeErrorReason(commentsResponse.error));
            logSupabaseError("boss_review_comments load failed", commentsResponse.error);
            reviewIds.forEach(function (reviewId) {
                ensureInteraction(reviewId).commentsFailed = true;
            });
            return;
        }

        (commentsResponse.data || []).forEach(function (comment) {
            ensureInteraction(comment.review_id).comments.push(comment);
        });
    }

    async function loadReviews() {
        await ensureClient();

        const response = await client
            .from(BOSS_REVIEW_TABLE)
            .select(BOSS_REVIEW_QUERY_FIELDS)
            .order("created_at", { ascending: false });

        if (response.error) {
            throw response.error;
        }

        currentReviews = response.data || [];
        lastReviews = currentReviews;
        return currentReviews;
    }

    async function submitReview(payload) {
        await ensureClient();
        await getSession();

        if (!currentUser) {
            throw new Error("请先登录后再发布评价哦～");
        }

        const preferredNickname = await getPreferredBossNickname(payload.nickname);
        const nickname = normalizeBossDisplayName(preferredNickname.displayName);
        const serviceType = String(payload.serviceType || "").trim();
        const rating = Number(payload.rating);
        const message = String(payload.message || "").trim().slice(0, 300);

        if (!nickname || !message) {
            throw new Error("昵称和评价内容都要填写哦。");
        }

        if (VALID_SERVICE_TYPES.indexOf(serviceType) === -1 || rating < 1 || rating > 5) {
            throw new Error("评价内容有点不对，请重新检查一下。");
        }

        await ensureNotBlocked();

        const response = await client.from(BOSS_REVIEW_TABLE).insert({
            user_id: currentUser.id,
            nickname: nickname,
            service_type: serviceType,
            rating: rating,
            message: message
        });

        if (response.error) {
            throw response.error;
        }

        return {
            ok: true,
            nickname: nickname,
            warning: preferredNickname.warning || ""
        };
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
            averageRating: items.length ? (totalRating / items.length).toFixed(1) : "--",
            topService: topService
        };
    }

    function renderStats(reviews) {
        if (!reviewStats) {
            return;
        }

        const stats = calculateStats(reviews);
        const ratingText = stats.averageRating === "--" ? "--" : stats.averageRating + " ★";

        if (isBossReviewsMobileFullPageMode()) {
            const topLikes = calculateTopLikeCount(reviews);

            reviewStats.innerHTML = [
                '<div class="price-review-stat reviews-mobile-stat reviews-mobile-stat--total">',
                    '<span class="reviews-mobile-stat-icon" aria-hidden="true"></span>',
                    '<span class="reviews-mobile-stat-copy">',
                        '<strong>总评价数</strong>',
                        '<small>条真实反馈</small>',
                    '</span>',
                    '<b>' + stats.total + '</b>',
                    '<i aria-hidden="true">›</i>',
                '</div>',
                '<div class="price-review-stat reviews-mobile-stat reviews-mobile-stat--rating">',
                    '<span class="reviews-mobile-stat-icon" aria-hidden="true"></span>',
                    '<span class="reviews-mobile-stat-copy">',
                        '<strong>平均星级</strong>',
                        '<small>基于真实评价</small>',
                    '</span>',
                    '<b>' + escapeHtml(ratingText) + '</b>',
                    '<i aria-hidden="true">›</i>',
                '</div>',
                '<div class="price-review-stat reviews-mobile-stat reviews-mobile-stat--likes">',
                    '<span class="reviews-mobile-stat-icon" aria-hidden="true"></span>',
                    '<span class="reviews-mobile-stat-copy">',
                        '<strong>最高点赞数</strong>',
                        '<small>来自互动数据</small>',
                    '</span>',
                    '<b>' + escapeHtml(String(topLikes)) + '</b>',
                    '<i aria-hidden="true">›</i>',
                '</div>',
                '<div class="price-review-stat reviews-mobile-stat reviews-mobile-stat--service">',
                    '<span class="reviews-mobile-stat-icon" aria-hidden="true"></span>',
                    '<span class="reviews-mobile-stat-copy">',
                        '<strong>最受欢迎服务</strong>',
                        '<small>按评价数量统计</small>',
                    '</span>',
                    '<b>' + escapeHtml(stats.topService || "暂无") + '</b>',
                    '<i aria-hidden="true">›</i>',
                '</div>'
            ].join("");
            return;
        }

        if (isBossReviewsFullPageMode()) {
            const topLikes = calculateTopLikeCount(reviews);

            reviewStats.innerHTML = [
                '<div class="price-review-stat reviews-cosmic-stat reviews-cosmic-stat--total">',
                    '<span class="reviews-cosmic-stat-icon" aria-hidden="true"></span>',
                    '<span>总评价数</span>',
                    '<strong>' + stats.total + '</strong>',
                    '<small>条真实反馈</small>',
                '</div>',
                '<div class="price-review-stat reviews-cosmic-stat reviews-cosmic-stat--rating">',
                    '<span class="reviews-cosmic-stat-icon" aria-hidden="true"></span>',
                    '<span>平均星级</span>',
                    '<strong>' + escapeHtml(ratingText) + '</strong>',
                    '<small>基于真实评价</small>',
                '</div>',
                '<div class="price-review-stat reviews-cosmic-stat reviews-cosmic-stat--likes">',
                    '<span class="reviews-cosmic-stat-icon" aria-hidden="true"></span>',
                    '<span>最高点赞数</span>',
                    '<strong>' + escapeHtml(String(topLikes)) + '</strong>',
                    '<small>来自互动数据</small>',
                '</div>',
                '<div class="price-review-stat reviews-cosmic-stat reviews-cosmic-stat--service">',
                    '<span class="reviews-cosmic-stat-icon" aria-hidden="true"></span>',
                    '<span>最受欢迎服务</span>',
                    '<strong>' + escapeHtml(stats.topService || "暂无") + '</strong>',
                    '<small>按评价数量统计</small>',
                '</div>'
            ].join("");
            return;
        }

        reviewStats.innerHTML = [
            '<div class="price-review-stat"><span>总评价数</span><strong>' + stats.total + '</strong></div>',
            '<div class="price-review-stat"><span>平均星级</span><strong>' + ratingText + '</strong></div>',
            '<div class="price-review-stat"><span>最受欢迎服务</span><strong>' + escapeHtml(stats.topService) + '</strong></div>'
        ].join("");
    }

    function renderStatsError() {
        if (!reviewStats) {
            return;
        }

        if (isBossReviewsMobileFullPageMode()) {
            reviewStats.innerHTML = [
                '<div class="price-review-stat reviews-mobile-stat reviews-mobile-stat--total">',
                    '<span class="reviews-mobile-stat-icon" aria-hidden="true"></span>',
                    '<span class="reviews-mobile-stat-copy"><strong>总评价数</strong><small>加载失败</small></span>',
                    '<b>--</b>',
                    '<i aria-hidden="true">›</i>',
                '</div>',
                '<div class="price-review-stat reviews-mobile-stat reviews-mobile-stat--rating">',
                    '<span class="reviews-mobile-stat-icon" aria-hidden="true"></span>',
                    '<span class="reviews-mobile-stat-copy"><strong>平均星级</strong><small>加载失败</small></span>',
                    '<b>--</b>',
                    '<i aria-hidden="true">›</i>',
                '</div>',
                '<div class="price-review-stat reviews-mobile-stat reviews-mobile-stat--likes">',
                    '<span class="reviews-mobile-stat-icon" aria-hidden="true"></span>',
                    '<span class="reviews-mobile-stat-copy"><strong>最高点赞数</strong><small>加载失败</small></span>',
                    '<b>--</b>',
                    '<i aria-hidden="true">›</i>',
                '</div>',
                '<div class="price-review-stat reviews-mobile-stat reviews-mobile-stat--service">',
                    '<span class="reviews-mobile-stat-icon" aria-hidden="true"></span>',
                    '<span class="reviews-mobile-stat-copy"><strong>最受欢迎服务</strong><small>加载失败</small></span>',
                    '<b>暂无</b>',
                    '<i aria-hidden="true">›</i>',
                '</div>'
            ].join("");
            return;
        }

        if (isBossReviewsFullPageMode()) {
            reviewStats.innerHTML = [
                '<div class="price-review-stat reviews-cosmic-stat reviews-cosmic-stat--total">',
                    '<span class="reviews-cosmic-stat-icon" aria-hidden="true"></span>',
                    '<span>总评价数</span>',
                    '<strong>--</strong>',
                    '<small>加载失败</small>',
                '</div>',
                '<div class="price-review-stat reviews-cosmic-stat reviews-cosmic-stat--rating">',
                    '<span class="reviews-cosmic-stat-icon" aria-hidden="true"></span>',
                    '<span>平均星级</span>',
                    '<strong>--</strong>',
                    '<small>加载失败</small>',
                '</div>',
                '<div class="price-review-stat reviews-cosmic-stat reviews-cosmic-stat--likes">',
                    '<span class="reviews-cosmic-stat-icon" aria-hidden="true"></span>',
                    '<span>最高点赞数</span>',
                    '<strong>--</strong>',
                    '<small>加载失败</small>',
                '</div>',
                '<div class="price-review-stat reviews-cosmic-stat reviews-cosmic-stat--service">',
                    '<span class="reviews-cosmic-stat-icon" aria-hidden="true"></span>',
                    '<span>最受欢迎服务</span>',
                    '<strong>暂无</strong>',
                    '<small>加载失败</small>',
                '</div>'
            ].join("");
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

            const isExpanded = item && item.classList.contains("is-expanded");

            message.classList.toggle("is-collapsed", !isExpanded);
            button.textContent = isExpanded ? "收起" : "展开全文";
            button.hidden = true;

            window.requestAnimationFrame(function () {
                const isOverflowing = message.scrollHeight > message.clientHeight + 1;

                button.hidden = !isExpanded && !isOverflowing;
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
        const fullPageMode = isFullReviewPageMode();
        const isExpanded = fullPageMode && expandedReviewIds.has(review.id);
        const interactiveAttrs = fullPageMode ? ' tabindex="0" aria-expanded="' + (isExpanded ? "true" : "false") + '"' : "";

        if (isBossReviewsMobileFullPageMode()) {
            const avatarText = getReviewAvatarText(review.nickname);

            return [
                '<article class="price-review-item reviews-mobile-card' + (isExpanded ? ' is-expanded' : '') + '" data-review-id="' + escapeHtml(review.id) + '"' + interactiveAttrs + '>',
                    '<div class="price-review-head reviews-mobile-card-head">',
                        '<span class="reviews-mobile-avatar" aria-hidden="true">' + escapeHtml(avatarText) + '</span>',
                        '<span class="reviews-mobile-person">',
                            '<strong>' + escapeHtml(review.nickname || "老板") + '</strong>',
                            '<small class="reviews-mobile-service-tag">' + escapeHtml(review.service_type || "其它") + '</small>',
                        '</span>',
                        '<time class="reviews-mobile-date">' + escapeHtml(formatTime(review.created_at)) + '</time>',
                    '</div>',
                    '<div class="price-review-stars reviews-mobile-stars" aria-label="' + rating + ' 星评价">' + "★".repeat(rating) + "☆".repeat(5 - rating) + '</div>',
                    '<p class="price-review-message reviews-mobile-message' + (isExpanded ? '' : ' is-collapsed') + '">' + escapeHtml(review.message) + '</p>',
                    '<button class="price-review-expand" type="button" hidden>' + (isExpanded ? "收起" : "展开全文") + '</button>',
                    '<div class="price-review-actions reviews-mobile-actions">',
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

        if (isBossReviewsFullPageMode()) {
            const avatarText = getReviewAvatarText(review.nickname);

            return [
                '<article class="price-review-item reviews-cosmic-review-card' + (isExpanded ? ' is-expanded' : '') + '" data-review-id="' + escapeHtml(review.id) + '"' + interactiveAttrs + '>',
                    '<span class="reviews-cosmic-card-corner reviews-cosmic-card-corner--tl" aria-hidden="true"></span>',
                    '<span class="reviews-cosmic-card-corner reviews-cosmic-card-corner--br" aria-hidden="true"></span>',
                    '<div class="price-review-head reviews-cosmic-review-head">',
                        '<span class="reviews-cosmic-avatar" aria-hidden="true">' + escapeHtml(avatarText) + '</span>',
                        '<span class="reviews-cosmic-review-person">',
                            '<strong>' + escapeHtml(review.nickname) + '</strong>',
                            '<small>真实老板反馈</small>',
                        '</span>',
                        '<span class="reviews-cosmic-service-tag">' + escapeHtml(review.service_type || "其它") + '</span>',
                    '</div>',
                    '<div class="price-review-stars reviews-cosmic-stars" aria-label="' + rating + ' 星评价">' + "★".repeat(rating) + "☆".repeat(5 - rating) + '</div>',
                    '<div class="price-review-meta reviews-cosmic-review-meta">',
                        '<span>' + escapeHtml(review.service_type || "其它") + '</span>',
                        '<span>' + escapeHtml(formatTime(review.created_at)) + '</span>',
                    '</div>',
                    '<p class="price-review-message reviews-cosmic-message' + (isExpanded ? '' : ' is-collapsed') + '">' + escapeHtml(review.message) + '</p>',
                    '<button class="price-review-expand" type="button" hidden>' + (isExpanded ? "收起" : "展开全文") + '</button>',
                    '<div class="price-review-actions reviews-cosmic-actions">',
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

        return [
            '<article class="price-review-item' + (isExpanded ? ' is-expanded' : '') + '" data-review-id="' + escapeHtml(review.id) + '"' + interactiveAttrs + '>',
                '<div class="price-review-head">',
                    '<strong>' + escapeHtml(review.nickname) + '</strong>',
                    '<span class="price-review-stars">' + "★".repeat(rating) + "☆".repeat(5 - rating) + '</span>',
                '</div>',
                '<div class="price-review-meta">' + escapeHtml(review.service_type) + ' · ' + escapeHtml(formatTime(review.created_at)) + '</div>',
                '<p class="price-review-message' + (isExpanded ? '' : ' is-collapsed') + '">' + escapeHtml(review.message) + '</p>',
                '<button class="price-review-expand" type="button" hidden>' + (isExpanded ? "收起" : "展开全文") + '</button>',
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

        syncReviewSortControls();

        if (!reviews || !reviews.length) {
            reviewList.innerHTML = [
                '<div class="price-empty">',
                    '<strong>' + REVIEW_EMPTY_TEXT + '</strong>',
                    '<button class="price-button price-review-empty-action" type="button" data-action="open-ganyu-review">找甘雨发布第一条评价</button>',
                '</div>'
            ].join("");
            renderReviewPagination(0, getReviewPageSize());
            return;
        }

        const rawLimit = Number(reviewList.getAttribute("data-review-limit") || 0);

        if (rawLimit > 0) {
            const visibleReviews = reviews.slice(0, rawLimit);

            if (reviewPagination) {
                reviewPagination.hidden = true;
                reviewPagination.innerHTML = "";
            }
            reviewList.innerHTML = visibleReviews.map(renderReviewItem).join("");
            syncExpandableReviews();
            return;
        }

        if (isFullReviewPageMode()) {
            const sortedReviews = sortReviewsForDisplay(reviews);
            const pageSize = getReviewPageSize();
            const pageCount = Math.max(1, Math.ceil(sortedReviews.length / pageSize));

            currentReviewPage = Math.min(Math.max(1, currentReviewPage), pageCount);
            lastReviewPageSize = pageSize;

            const start = (currentReviewPage - 1) * pageSize;
            const visibleReviews = sortedReviews.slice(start, start + pageSize);

            reviewList.innerHTML = visibleReviews.map(renderReviewItem).join("");
            renderReviewPagination(sortedReviews.length, pageSize);
            syncExpandableReviews();
            return;
        }

        reviewList.innerHTML = reviews.map(renderReviewItem).join("");
        syncExpandableReviews();
    }

    function refreshRenderedReviewInteractions(reviews, token) {
        const reviewIds = (reviews || []).map(function (review) {
            return review.id;
        }).filter(Boolean);

        if (!reviewIds.length) {
            return;
        }

        syncOptionalSession().then(function () {
            if (token !== refreshReviewWallToken) {
                return null;
            }
            return loadReviewInteractions(reviewIds);
        }).then(function () {
            if (token !== refreshReviewWallToken) {
                return;
            }
            renderReviews(currentReviews);
            if (isBossReviewsFullPageMode() || isBossReviewsMobileFullPageMode()) {
                renderStats(currentReviews);
            }
        }).catch(function (error) {
            logSupabaseError("boss review interactions load failed", error);
        });
    }

    async function refreshReviewWall() {
        const domState = getReviewWallDomState();

        if (!domState.canRenderList) {
            return [];
        }

        const requestToken = refreshReviewWallToken + 1;
        refreshReviewWallToken = requestToken;
        debugBossReviews("boss reviews query start");
        setStatus(reviewStatus, REVIEW_LOADING_TEXT, "neutral");

        try {
            const reviews = await withTimeout(loadReviews(), REVIEW_QUERY_TIMEOUT_MS);

            if (requestToken !== refreshReviewWallToken) {
                return reviews;
            }

            debugBossReviews("boss reviews query success: count=" + reviews.length);
            if (!reviews.length) {
                debugBossReviews("boss reviews query empty");
            }
            renderStats(reviews);
            renderReviews(reviews);
            refreshRenderedReviewInteractions(reviews, requestToken);
            debugBossReviews("boss reviews render complete");
            return reviews;
        } catch (error) {
            if (requestToken !== refreshReviewWallToken) {
                return [];
            }

            debugBossReviews("boss reviews query failed: " + getSafeErrorReason(error));
            renderStatsError();
            if (reviewPagination) {
                reviewPagination.hidden = true;
                reviewPagination.innerHTML = "";
            }
            if (reviewList) {
                logSupabaseError("boss_reviews load failed", error);
                if (isConfigMissingError(error)) {
                    setStatus(reviewStatus, CONFIG_MISSING_TEXT, "warning");
                    reviewList.innerHTML = '<div class="price-empty">' + escapeHtml(CONFIG_MISSING_TEXT) + '</div>';
                } else {
                    const message = isSdkLoadError(error) ? SUPABASE_SDK_LOAD_ERROR_TEXT : REVIEW_LOAD_ERROR_TEXT;

                    setStatus(reviewStatus, message, "warning");
                    reviewList.innerHTML = '<div class="price-empty">' + escapeHtml(message) + '</div>';
                }
            }
            return [];
        } finally {
            if (requestToken === refreshReviewWallToken) {
                if (reviewStatus && reviewStatus.textContent === REVIEW_LOADING_TEXT) {
                    setStatus(reviewStatus, "", "");
                }
                debugBossReviews("boss reviews loading cleared");
            }
        }
    }

    async function refreshSingleReview(reviewId) {
        await loadReviewInteractions([reviewId]);
        updateReviewCard(reviewId);
    }

    function updateReviewCard(reviewId) {
        const review = getReviewById(reviewId);
        const card = reviewList ? reviewList.querySelector('[data-review-id="' + reviewId + '"]') : null;

        if (isFullReviewPageMode() && activeReviewSort === REVIEW_SORT_LIKES) {
            renderReviews(currentReviews);
            return;
        }

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

        try {
            await ensureNotBlocked();
        } catch (error) {
            setStatus(reviewStatus, isBlockedInteractionError(error) ? BLOCKED_INTERACTION_TEXT : "互动状态暂时确认失败，请稍后再试。", "warning");
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
            setStatus(reviewStatus, isBlockedInteractionError(response.error) ? BLOCKED_INTERACTION_TEXT : response.error.message, "warning");
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

        try {
            await ensureNotBlocked();
        } catch (error) {
            setStatus(reviewStatus, isBlockedInteractionError(error) ? BLOCKED_INTERACTION_TEXT : "互动状态暂时确认失败，请稍后再试。", "warning");
            return;
        }

        const response = await client.from("boss_review_comments").insert({
            review_id: reviewId,
            user_id: currentUser.id,
            nickname: nickname,
            message: message
        });

        if (response.error) {
            setStatus(reviewStatus, isBlockedInteractionError(response.error) ? BLOCKED_INTERACTION_TEXT : response.error.message, "warning");
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

    function setReviewSort(sortKey) {
        if (!isFullReviewPageMode()) {
            return;
        }

        if ([REVIEW_SORT_LATEST, REVIEW_SORT_LIKES, REVIEW_SORT_ALL].indexOf(sortKey) === -1) {
            return;
        }

        activeReviewSort = sortKey;
        currentReviewPage = 1;
        renderReviews(currentReviews);
        scrollToReviewListTop();
    }

    function setReviewPage(direction) {
        if (!isFullReviewPageMode()) {
            return;
        }

        const pageSize = getReviewPageSize();
        const totalItems = sortReviewsForDisplay(currentReviews).length;
        const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));

        if (direction === "prev") {
            currentReviewPage = Math.max(1, currentReviewPage - 1);
        } else if (direction === "next") {
            currentReviewPage = Math.min(pageCount, currentReviewPage + 1);
        }

        renderReviews(currentReviews);
        scrollToReviewListTop();
    }

    function isInteractiveReviewTarget(target) {
        return !!(
            target &&
            target.closest("button, a, input, textarea, select, label, .price-review-comments")
        );
    }

    function bindReviewWallEvents() {
        if (reviewWallEventsBound) {
            return;
        }

        reviewWallEventsBound = true;

        if (ganyuReviewButton) {
            ganyuReviewButton.addEventListener("click", openGanyuReviewMenu);
        }

        if (reviewSortControls) {
            reviewSortControls.addEventListener("click", function (event) {
                const button = event.target.closest("[data-review-sort]");

                if (!button) {
                    return;
                }

                setReviewSort(button.getAttribute("data-review-sort"));
            });
        }

        if (reviewPagination) {
            reviewPagination.addEventListener("click", function (event) {
                const button = event.target.closest("[data-review-page]");

                if (!button || button.disabled) {
                    return;
                }

                setReviewPage(button.getAttribute("data-review-page"));
            });
        }

        window.addEventListener("resize", function () {
            if (!isFullReviewPageMode()) {
                return;
            }

            window.clearTimeout(reviewResizeTimer);
            reviewResizeTimer = window.setTimeout(function () {
                const nextPageSize = getReviewPageSize();

                if (nextPageSize !== lastReviewPageSize) {
                    currentReviewPage = 1;
                    renderReviews(currentReviews);
                }
            }, 120);
        });

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
                toggleReviewExpanded(reviewId);
                updateReviewCard(reviewId);
                return;
            }

            if (!actionButton || !reviewId) {
                if (card && reviewId && isFullReviewPageMode() && !isInteractiveReviewTarget(event.target)) {
                    toggleReviewExpanded(reviewId);
                    updateReviewCard(reviewId);
                }
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

        reviewList.addEventListener("keydown", function (event) {
            if (event.key !== "Enter" && event.key !== " ") {
                return;
            }

            const card = event.target.closest(".price-review-item");

            if (!card || !isFullReviewPageMode() || isInteractiveReviewTarget(event.target)) {
                return;
            }

            event.preventDefault();
            toggleReviewExpanded(card.getAttribute("data-review-id"));
            updateReviewCard(card.getAttribute("data-review-id"));
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
        savePendingBossRegistration: savePendingBossRegistration,
        getPendingBossRegistration: readPendingBossRegistration,
        dismissPendingBossRegistration: dismissPendingBossRegistration,
        clearPendingBossRegistration: clearPendingBossRegistration,
        applyPendingBossNicknameForSession: applyPendingBossNicknameForSession,
        loadBossProfile: loadBossProfile,
        updateBossDisplayName: updateBossDisplayName,
        logout: logout,
        getClient: ensureClient,
        getOwnBossAccountFlags: getOwnBossAccountFlags,
        ensureNotBlocked: ensureNotBlocked,
        loadReviews: loadReviews,
        submitReview: submitReview,
        refreshReviewWall: refreshReviewWall,
        calculateStats: calculateStats
    };

    async function init() {
        if (reviewWallInitStarted) {
            if (reviewList) {
                refreshReviewWall();
            }
            return;
        }

        reviewWallInitStarted = true;
        debugBossReviews("boss reviews init");
        debugBossReviews("boss reviews script version", { version: SCRIPT_VERSION });
        debugBossReviews("boss reviews publish table: " + BOSS_REVIEW_TABLE);
        debugBossReviews("boss reviews read table: " + BOSS_REVIEW_TABLE);
        debugBossReviews("boss reviews query fields: " + BOSS_REVIEW_QUERY_FIELDS.replace(/\s+/g, ""));
        debugBossReviews("boss reviews query filters: " + BOSS_REVIEW_QUERY_FILTERS);
        getReviewWallDomState();
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
