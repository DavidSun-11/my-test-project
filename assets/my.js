(function () {
    "use strict";

    const VERSION = "20260716-my-admin-message-center1";
    const BOSS_LOGIN_URL = "boss-register.html?mode=login&redirect=index";
    const BOSS_REGISTER_URL = "boss-register.html?mode=register&redirect=index";
    const AVATAR_BUCKET = "boss-avatars";
    const MAX_AVATAR_SOURCE_BYTES = 3 * 1024 * 1024;
    const MAX_AVATAR_UPLOAD_BYTES = 3 * 1024 * 1024;
    const TARGET_AVATAR_BYTES = 800 * 1024;
    const AVATAR_MAX_EDGE = 768;
    const AVATAR_SAFE_MAX_EDGE = 8192;
    const AVATAR_SAFE_MAX_PIXELS = 24 * 1000 * 1000;
    const AVATAR_QUALITY_STEPS = [0.85, 0.78, 0.70, 0.62, 0.55];
    const AVATAR_TYPES = {
        "image/jpeg": true,
        "image/png": true,
        "image/webp": true
    };
    const MOBILE_MESSAGE_LIMIT = 10;
    const MOBILE_MESSAGE_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
    const MOBILE_MESSAGE_READ_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;
    const MOBILE_MESSAGE_READ_STORAGE_PREFIX = "junxue:starlake-message-read:";
    const MOBILE_MESSAGE_LOGIN_URL = "index.html?bossLogin=1";
    const ADMIN_MESSAGE_CACHE_MS = 60 * 1000;
    const ADMIN_MESSAGE_RPC = "admin_get_my_page_pending_messages";
    const ORDER_MESSAGE_LABELS = {
        pending: "你的预约已提交，正在等待君雪确认。",
        confirmed: "你的预约已确认，请查看管理员批注。",
        need_reschedule: "你的预约需要改期，请查看管理员批注。",
        completed: "你的预约已完成。",
        rejected: "你的预约已被拒绝，请查看管理员批注。",
        cancelled: "你的预约已取消。"
    };
    const ORDER_STATUS_LABELS = {
        pending: "待确认",
        confirmed: "已确认预约",
        need_reschedule: "需要改期",
        completed: "已完成",
        rejected: "已拒绝",
        cancelled: "已取消"
    };
    const ORDER_PROGRESS_STATUSES = {
        pending: true,
        confirmed: true,
        need_reschedule: true,
        rejected: true,
        completed: true,
        cancelled: true
    };
    const MANUAL_PAYMENT_LABELS = {
        manual_unpaid: "待人工转账",
        manual_paid: "已人工确认转账",
        not_required: "无需补款",
        voucher_reserved: "已锁定兑换券",
        voucher_used: "已使用兑换券",
        partial_voucher: "已用兑换券，仍需补款"
    };
    const REDEMPTION_TYPE_LABELS = {
        king_star: "王者星星",
        king_review: "王者复盘",
        naraka_companion: "永劫无间娱乐陪",
        voice_chat: "语音聊天"
    };
    const REDEMPTION_RANK_LABELS = {
        below_king: "王者以下",
        king_0_50: "王者 0 - 50 星",
        king_50_80: "王者 50 - 80 星",
        king_80_100: "王者 80 - 100 星",
        king_100_plus: "王者 100 星以上"
    };

    const state = {
        client: null,
        session: null,
        profile: null,
        avatarPath: "",
        avatarUploadInFlight: false,
        checkinStatus: null,
        loadingToken: 0,
        checkinInFlight: false,
        checkinUnavailable: false,
        mobileMessageInFlight: false,
        mobileMessageLoadPromise: null,
        mobileMessageOrders: [],
        mobileMessageRedemptions: [],
        mobileMessageOrdersLoaded: false,
        mobileMessageRedemptionsLoaded: false,
        mobileMessageSources: {
            checkin: "idle",
            orders: "idle",
            redemptions: "idle"
        },
        mobileMessageDiagnosticsLogged: false,
        mobileMessageReadState: {},
        isAdmin: false,
        adminCheckLoaded: false,
        adminCheckFailed: false,
        adminMessageOwnerUserId: "",
        adminMessageLoadedAt: 0,
        adminMessageRequestToken: 0,
        adminMessageLoadPromise: null,
        adminMessageDetail: null,
        adminMessageCapabilityError: "",
        adminMessageSources: {
            orders: "idle",
            redemptions: "idle"
        },
        adminMessageTotals: {
            orders: 0,
            redemptions: 0
        },
        adminMessageItems: {
            orders: [],
            redemptions: []
        },
        authSubscription: null,
        activeModal: "",
        lastModalTrigger: null
    };

    function $(selector) {
        return document.querySelector(selector);
    }

    function $$(selector) {
        return Array.prototype.slice.call(document.querySelectorAll(selector));
    }

    const nodes = {
        loggedOut: $("[data-my-logged-out]"),
        app: $("[data-my-app]"),
        displayName: $("[data-my-display-name]"),
        accountType: $("[data-my-account-type]"),
        registeredAt: $("[data-my-registered-at]"),
        avatarImg: $("[data-my-avatar-img]"),
        avatarPlaceholder: $("[data-my-avatar-placeholder]"),
        avatarInput: $("[data-my-avatar-input]"),
        avatarButton: $("[data-my-avatar-button]"),
        avatarStatus: $("[data-my-avatar-status]"),
        refreshButton: $("[data-my-refresh]"),
        checkinButton: $("[data-my-checkin-button]"),
        benefitCheckinButton: $("[data-my-benefit-checkin]"),
        points: $("[data-my-points]"),
        exchangePoints: $("[data-my-exchange-points]"),
        totalCheckins: $("[data-my-total-checkins]"),
        currentStreak: $("[data-my-current-streak]"),
        monthlyCheckins: $("[data-my-monthly-checkins]"),
        todayStatus: $("[data-my-today-status]"),
        todayStatusCopy: $("[data-my-today-status-copy]"),
        todayDate: $("[data-my-today-date]"),
        rewardPoints: $("[data-my-reward-points]"),
        checkinMessage: $("[data-my-checkin-message]"),
        checkinSection: $("[data-my-checkin-section]"),
        actionNodes: $$("[data-my-action]"),
        messageLinks: $$("[data-my-mobile-message]"),
        mobileMessageLink: $(".my-mobile-tabbar [data-my-mobile-message]"),
        mobileMessageBadge: $("[data-my-mobile-message-badge]"),
        adminShortcut: $("[data-my-admin-shortcut]"),
        modal: $("[data-my-modal]"),
        modalPanel: $("[data-my-modal] .my-modal-panel"),
        modalTitle: $("[data-my-modal-title]"),
        modalSubtitle: $("[data-my-modal-subtitle]"),
        modalBody: $("[data-my-modal-body]"),
        modalActions: $("[data-my-modal-actions]"),
        modalClose: $("[data-my-modal-close]")
    };

    function onReady(callback) {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", callback, { once: true });
            return;
        }

        callback();
    }

    function safeTrim(value) {
        return String(value || "").replace(/\s+/g, " ").trim();
    }

    function setText(node, value) {
        if (node) {
            node.textContent = value;
        }
    }

    function setHidden(node, hidden) {
        if (node) {
            node.hidden = !!hidden;
        }
    }

    function setAvatarStatus(message) {
        setText(nodes.avatarStatus, message || "");
    }

    function setCheckinMessage(message) {
        setText(nodes.checkinMessage, message || "");
    }

    function setBusy(button, busy, label) {
        if (!button) {
            return;
        }

        button.disabled = !!busy;
        if (label) {
            button.textContent = label;
        }
    }

    function normalizeBossAuthLinks() {
        $$("[data-my-login-link], a[href*='bossLogin=1']").forEach(function (link) {
            link.setAttribute("href", BOSS_LOGIN_URL);
            link.addEventListener("click", function (event) {
                event.preventDefault();
                window.location.href = BOSS_LOGIN_URL;
            });
        });

        $$("[data-my-register-link]").forEach(function (link) {
            link.setAttribute("href", BOSS_REGISTER_URL);
            link.addEventListener("click", function (event) {
                event.preventDefault();
                window.location.href = BOSS_REGISTER_URL;
            });
        });
    }

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function formatDate(value) {
        if (!value) {
            return "--";
        }

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return "--";
        }

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return year + "-" + month + "-" + day;
    }

    function formatDateTime(value) {
        if (!value) {
            return "";
        }

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return "";
        }

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hour = String(date.getHours()).padStart(2, "0");
        const minute = String(date.getMinutes()).padStart(2, "0");
        return year + "-" + month + "-" + day + " " + hour + ":" + minute;
    }

    function getOrderMessageTime(record) {
        return (record && (record.processed_at || record.updated_at || record.created_at)) || "";
    }

    function getOrderMessageTimestamp(record) {
        const value = getOrderMessageTime(record);
        if (!value) {
            return 0;
        }

        const time = new Date(value).getTime();
        return Number.isNaN(time) ? 0 : time;
    }

    function isSigned(status) {
        return !!(status && (status.signedToday || status.alreadySigned));
    }

    function getErrorMessage(error) {
        return String((error && (error.message || error.error_description || error.details)) || "");
    }

    function getErrorCode(error) {
        return String((error && error.code) || "");
    }

    function isCheckinSetupError(error) {
        const message = getErrorMessage(error);
        const code = getErrorCode(error);

        return code === "42P01" ||
            code === "42883" ||
            code === "PGRST202" ||
            /claim_boss_daily_checkin|get_boss_checkin_status|boss_points|boss_daily_checkins|schema cache|function .* does not exist|relation .* does not exist/i.test(message);
    }

    function isAvatarSetupError(error) {
        const message = getErrorMessage(error);
        const code = getErrorCode(error);

        return code === "42P01" ||
            code === "42703" ||
            code === "PGRST204" ||
            /boss-avatars|avatar_path|avatar_updated_at|storage|bucket|row-level security|violates row-level|not found|permission denied|policy|schema cache/i.test(message);
    }

    function isOrderMessageSetupError(error) {
        const message = getErrorMessage(error);
        const code = getErrorCode(error);

        return code === "42P01" ||
            code === "42883" ||
            code === "PGRST202" ||
            /boss_paid_orders|get_my_boss_paid_orders|schema cache|function .* does not exist|relation .* does not exist/i.test(message);
    }

    function normalizeNumber(value) {
        const number = Number(value);
        return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
    }

    function normalizeCheckinRow(data) {
        const row = Array.isArray(data) ? (data[0] || {}) : (data || {});
        const signedDates = Array.isArray(row.signed_dates) ? row.signed_dates : [];

        return {
            signedToday: !!(row.today_signed || row.signed_today),
            alreadySigned: !!row.already_signed,
            todayDate: row.today_date || row.sign_date || "",
            signDate: row.sign_date || row.today_date || "",
            rewardPoints: normalizeNumber(row.reward_points),
            totalPoints: normalizeNumber(row.total_points || row.points),
            totalCheckins: normalizeNumber(row.total_checkins),
            currentStreak: normalizeNumber(row.current_streak),
            monthlyCheckins: normalizeNumber(row.monthly_checkins),
            signedDates: signedDates,
            message: String(row.message || "")
        };
    }

    function getMetadataDisplayName(user) {
        const metadata = (user && user.user_metadata) || {};
        const name = metadata.boss_nickname || metadata.nickname || metadata.display_name || metadata.full_name || metadata.name;
        return safeTrim(name).slice(0, 20) || "星湖用户";
    }

    function renderLoggedOut() {
        setHidden(nodes.loggedOut, false);
        setHidden(nodes.app, true);
        if (!state.mobileMessageDiagnosticsLogged) {
            state.mobileMessageDiagnosticsLogged = true;
            console.debug("[star-lake-messages] init");
            console.debug("[star-lake-messages] user logged in:", false);
        }
        if (nodes.mobileMessageBadge) {
            nodes.mobileMessageBadge.hidden = true;
        }
        if (nodes.mobileMessageLink) {
            nodes.mobileMessageLink.classList.remove("has-unread");
            nodes.mobileMessageLink.setAttribute("aria-label", "消息");
        }
    }

    function renderLoggedInShell() {
        setHidden(nodes.loggedOut, true);
        setHidden(nodes.app, false);
    }

    function renderProfile(profile) {
        const displayName = safeTrim(profile && profile.display_name);
        setText(nodes.displayName, displayName ? "星湖昵称：" + displayName : "星湖昵称：已登录");
        if (nodes.displayName) {
            nodes.displayName.dataset.shortName = displayName || "已登录";
        }
        setText(nodes.accountType, "星湖账号");
        setText(nodes.registeredAt, state.session && state.session.user ? formatDate(state.session.user.created_at) : "--");
    }

    function renderEmptyAvatar() {
        if (nodes.avatarImg) {
            nodes.avatarImg.hidden = true;
            nodes.avatarImg.removeAttribute("src");
        }
        setHidden(nodes.avatarPlaceholder, false);
    }

    async function getCloudAvatarSignedUrl(path) {
        const response = await state.client.storage.from(AVATAR_BUCKET).createSignedUrl(path, 3600);

        if (response.error || !response.data || !response.data.signedUrl) {
            throw response.error || new Error("signed-url-missing");
        }

        return response.data.signedUrl;
    }

    function preloadAvatarUrl(url) {
        return new Promise(function (resolve, reject) {
            const image = new Image();

            image.onload = function () {
                image.onload = null;
                image.onerror = null;
                image.src = "";
                resolve();
            };
            image.onerror = function () {
                image.onload = null;
                image.onerror = null;
                image.src = "";
                reject(new Error("avatar-preview-load-failed"));
            };
            image.src = url;
        });
    }

    async function getReadableCloudAvatarUrl(path) {
        const url = await getCloudAvatarSignedUrl(path);
        await preloadAvatarUrl(url);
        return url;
    }

    function applyCloudAvatarUrl(url) {
        if (nodes.avatarImg) {
            nodes.avatarImg.src = url;
            nodes.avatarImg.hidden = false;
        }
        setHidden(nodes.avatarPlaceholder, true);
    }

    async function renderCloudAvatar(path) {
        if (!path) {
            renderEmptyAvatar();
            return false;
        }

        try {
            const url = await getReadableCloudAvatarUrl(path);
            applyCloudAvatarUrl(url);
            return true;
        } catch (error) {
            renderEmptyAvatar();
            setAvatarStatus(isAvatarSetupError(error) ? "头像上传功能还需要完成云端配置。" : "头像暂时读取失败，请稍后再试。");
            return false;
        }
    }

    async function loadProfile() {
        try {
            const response = await state.client
                .from("boss_profiles")
                .select("display_name,avatar_path,avatar_updated_at")
                .eq("user_id", state.session.user.id)
                .maybeSingle();

            if (response.error) {
                throw response.error;
            }

            state.profile = response.data || null;
            state.avatarPath = response.data && response.data.avatar_path ? String(response.data.avatar_path) : "";
            renderProfile(state.profile);
            await renderCloudAvatar(state.avatarPath);
        } catch (error) {
            if (isAvatarSetupError(error)) {
                setAvatarStatus("头像上传功能还需要完成云端配置。");

                try {
                    const fallback = await state.client
                        .from("boss_profiles")
                        .select("display_name")
                        .eq("user_id", state.session.user.id)
                        .maybeSingle();

                    state.profile = fallback.data || null;
                    renderProfile(state.profile);
                } catch (fallbackError) {
                    renderProfile(null);
                }
                renderEmptyAvatar();
                return;
            }

            renderProfile(null);
            renderEmptyAvatar();
            setAvatarStatus("资料暂时读取失败，请稍后再试。");
        }
    }

    function renderCheckinStatus(status, message) {
        state.checkinStatus = status || null;
        const signed = isSigned(status);
        const todayText = status ? (signed ? "今天已签到" : "今天还没签到") : "--";
        const rewardText = status && status.rewardPoints ? String(status.rewardPoints) : "--";

        setText(nodes.points, status ? String(status.totalPoints) : "--");
        setText(nodes.exchangePoints, status ? String(status.totalPoints) : "--");
        setText(nodes.totalCheckins, status ? String(status.totalCheckins) + " 天" : "--");
        setText(nodes.currentStreak, status ? String(status.currentStreak) + " 天" : "--");
        setText(nodes.monthlyCheckins, status ? String(status.monthlyCheckins) + " 天" : "--");
        setText(nodes.todayStatus, todayText);
        setText(nodes.todayStatusCopy, todayText);
        setText(nodes.todayDate, status && status.todayDate ? String(status.todayDate).slice(0, 10) : "--");
        setText(nodes.rewardPoints, rewardText);

        if (nodes.checkinButton) {
            nodes.checkinButton.disabled = !!signed;
            nodes.checkinButton.textContent = signed ? "今天已签到" : "立即签到";
        }

        if (nodes.benefitCheckinButton) {
            nodes.benefitCheckinButton.disabled = !!signed;
            nodes.benefitCheckinButton.textContent = signed ? "今天已签到" : "立即签到";
        }

        setCheckinMessage(message || (signed ? "今日已完成签到。" : "今日还可以签到。"));
        updateMobileMessageBadge();
        refreshOpenStarlakeMessages();
        updateOpenModal();
    }

    async function loadCheckinStatus(message) {
        try {
            const response = await state.client.rpc("get_boss_checkin_status", { p_month: null });

            if (response.error) {
                throw response.error;
            }

            state.checkinUnavailable = false;
            state.mobileMessageSources.checkin = "success";
            renderCheckinStatus(normalizeCheckinRow(response.data), message);
        } catch (error) {
            state.mobileMessageSources.checkin = "error";
            console.warn("[star-lake-messages] query failed: checkin unavailable.");
            if (isCheckinSetupError(error)) {
                state.checkinUnavailable = true;
                renderCheckinStatus(null, "签到功能还需要执行数据库升级 SQL。");
                setText(nodes.points, "积分暂未开启");
                setText(nodes.exchangePoints, "暂未开启");
                setText(nodes.totalCheckins, "--");
                setText(nodes.currentStreak, "--");
                setText(nodes.monthlyCheckins, "--");
                if (nodes.checkinButton) {
                    nodes.checkinButton.disabled = true;
                    nodes.checkinButton.textContent = "暂未开启";
                }
                if (nodes.benefitCheckinButton) {
                    nodes.benefitCheckinButton.disabled = true;
                    nodes.benefitCheckinButton.textContent = "暂未开启";
                }
                updateOpenModal();
                return;
            }

            renderCheckinStatus(null, "签到状态暂时读取失败，请稍后再试。");
        }
    }

    function setCheckinButtonsBusy(busy, label) {
        setBusy(nodes.checkinButton, busy, label);
        setBusy(nodes.benefitCheckinButton, busy, label);

        const modalCheckinButton = $("[data-my-modal-checkin]");
        if (modalCheckinButton) {
            setBusy(modalCheckinButton, busy, label);
        }
    }

    async function claimCheckin() {
        if (!state.client || !state.session) {
            return;
        }

        if (state.checkinInFlight) {
            return;
        }

        state.checkinInFlight = true;
        setCheckinButtonsBusy(true, "签到中...");
        let setupFailed = false;

        try {
            const response = await state.client.rpc("claim_boss_daily_checkin", {});

            if (response.error) {
                throw response.error;
            }

            const status = normalizeCheckinRow(response.data);
            renderCheckinStatus(status, status.message || (status.alreadySigned ? "今天已经签到过啦。" : "签到成功。"));
        } catch (error) {
            if (isCheckinSetupError(error)) {
                setupFailed = true;
                state.checkinUnavailable = true;
                renderCheckinStatus(null, "签到功能还需要执行数据库升级 SQL。");
                if (nodes.checkinButton) {
                    nodes.checkinButton.disabled = true;
                    nodes.checkinButton.textContent = "暂未开启";
                }
                if (nodes.benefitCheckinButton) {
                    nodes.benefitCheckinButton.disabled = true;
                    nodes.benefitCheckinButton.textContent = "暂未开启";
                }
                updateOpenModal();
                return;
            }

            setCheckinMessage("签到暂时失败，请稍后再试。");
            updateOpenModal();
        } finally {
            state.checkinInFlight = false;
            if (!setupFailed && !(state.checkinStatus && (state.checkinStatus.signedToday || state.checkinStatus.alreadySigned))) {
                setCheckinButtonsBusy(false, "立即签到");
            }
        }
    }

    function renderRows(rows) {
        return rows.map(function (row) {
            return "<div class=\"my-meta-row\"><span>" + escapeHtml(row.label) + "</span><strong>" + escapeHtml(row.value) + "</strong></div>";
        }).join("");
    }

    function createMessageElement(tagName, className, text) {
        const element = document.createElement(tagName);
        if (className) {
            element.className = className;
        }
        if (text != null) {
            element.textContent = String(text);
        }
        return element;
    }

    function createMessageButton(label, className, attributeName, attributeValue) {
        const button = createMessageElement("button", className || "my-button", label);
        button.type = "button";
        if (attributeName) {
            button.setAttribute(attributeName, attributeValue == null ? "" : String(attributeValue));
        }
        return button;
    }

    function createMessageEmpty(title, copy, type) {
        const empty = createMessageElement("div", "my-message-empty" + (type ? " is-" + type : ""));
        empty.append(
            createMessageElement("strong", "", title),
            createMessageElement("span", "", copy)
        );
        return empty;
    }

    function setMessageModalContent(title, subtitle, body, actions) {
        setText(nodes.modalTitle, title);
        setText(nodes.modalSubtitle, subtitle);
        if (nodes.modalBody) {
            nodes.modalBody.replaceChildren(body || document.createDocumentFragment());
        }
        if (nodes.modalActions) {
            nodes.modalActions.replaceChildren();
            (actions || []).forEach(function (action) {
                nodes.modalActions.append(action);
            });
        }
    }

    function renderMessageLoginModal() {
        const actions = [
            createMessageButton("去登录", "my-button", "data-my-message-login", ""),
            createMessageButton("返回", "my-button my-button--primary", "data-my-modal-close", "")
        ];
        setMessageModalContent(
            "星湖消息",
            "登录后会按你的预约订单生成轻量提醒。",
            createMessageEmpty("登录老板账号后，可以查看预约消息。", "登录后再来看看星湖的新动静吧。"),
            actions
        );
    }

    function getShanghaiDate() {
        try {
            const parts = new Intl.DateTimeFormat("en-CA", {
                timeZone: "Asia/Shanghai",
                year: "numeric",
                month: "2-digit",
                day: "2-digit"
            }).formatToParts(new Date()).reduce(function (result, part) {
                result[part.type] = part.value;
                return result;
            }, {});
            return parts.year + "-" + parts.month + "-" + parts.day;
        } catch (error) {
            const now = new Date();
            return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
        }
    }

    async function loadMobileMessageOrders() {
        try {
            const response = await state.client.rpc("get_my_boss_paid_orders", {});
            if (response.error) {
                throw response.error;
            }
            state.mobileMessageOrders = Array.isArray(response.data) ? response.data : [];
            state.mobileMessageSources.orders = "success";
        } catch (error) {
            state.mobileMessageOrders = [];
            state.mobileMessageSources.orders = "error";
            console.warn("[star-lake-messages] query failed: appointments unavailable.");
        } finally {
            state.mobileMessageOrdersLoaded = true;
        }
    }

    async function loadMobileMessageRedemptions() {
        try {
            const response = await state.client.rpc("get_my_boss_point_redemptions", {});
            if (response.error) {
                throw response.error;
            }
            state.mobileMessageRedemptions = Array.isArray(response.data) ? response.data : [];
            state.mobileMessageSources.redemptions = "success";
        } catch (error) {
            state.mobileMessageRedemptions = [];
            state.mobileMessageSources.redemptions = "error";
            console.warn("[star-lake-messages] query failed: redemptions unavailable.");
        } finally {
            state.mobileMessageRedemptionsLoaded = true;
        }
    }

    function getMobileMessageReadStorageKey() {
        const userId = state.session && state.session.user ? state.session.user.id : "";
        return userId ? MOBILE_MESSAGE_READ_STORAGE_PREFIX + userId : "";
    }

    function pruneMobileMessageReadState(readState) {
        const cutoff = Date.now() - MOBILE_MESSAGE_READ_RETENTION_MS;
        return Object.keys(readState || {}).reduce(function (next, key) {
            if (Number(readState[key]) >= cutoff) {
                next[key] = Number(readState[key]);
            }
            return next;
        }, {});
    }

    function loadMobileMessageReadState() {
        const storageKey = getMobileMessageReadStorageKey();
        if (!storageKey) {
            state.mobileMessageReadState = {};
            return;
        }

        try {
            const raw = window.localStorage.getItem(storageKey);
            const parsed = raw ? JSON.parse(raw) : {};
            state.mobileMessageReadState = pruneMobileMessageReadState(parsed && typeof parsed === "object" ? parsed : {});
            window.localStorage.setItem(storageKey, JSON.stringify(state.mobileMessageReadState));
        } catch (error) {
            state.mobileMessageReadState = {};
            console.warn("[JunxueMy] message read state is unavailable in this browser.");
        }
    }

    function saveMobileMessageReadState() {
        const storageKey = getMobileMessageReadStorageKey();
        state.mobileMessageReadState = pruneMobileMessageReadState(state.mobileMessageReadState);
        if (!storageKey) {
            return;
        }

        try {
            window.localStorage.setItem(storageKey, JSON.stringify(state.mobileMessageReadState));
        } catch (error) {
            console.warn("[JunxueMy] message read state could not be saved.");
        }
    }

    function makeMobileMessageKey(type, values) {
        return type + ":" + values.map(function (value) {
            return encodeURIComponent(String(value == null ? "" : value));
        }).join(":");
    }

    function isRecentMobileMessageRecord(record) {
        const timestamp = getOrderMessageTimestamp(record);
        return !timestamp || timestamp >= Date.now() - MOBILE_MESSAGE_MAX_AGE_MS;
    }

    function sortMobileMessageItems(items) {
        return items.map(function (item, index) {
            return { item: item, index: index, timestamp: getOrderMessageTimestamp(item) };
        }).sort(function (left, right) {
            if (left.timestamp || right.timestamp) {
                return right.timestamp - left.timestamp;
            }
            return left.index - right.index;
        }).slice(0, MOBILE_MESSAGE_LIMIT).map(function (entry) {
            return entry.item;
        });
    }

    function buildMobileMessageItems() {
        const messages = [];
        const checkinStatus = state.checkinStatus;

        if (checkinStatus && !state.checkinUnavailable && !isSigned(checkinStatus)) {
            const checkinDate = getShanghaiDate();
            messages.push({
                key: makeMobileMessageKey("checkin", [checkinDate, "pending", checkinDate]),
                type: "checkin",
                title: "今日还没有签到",
                description: "去星湖签到，领取今天的积分吧。",
                actionLabel: "去签到",
                action: "checkin",
                created_at: new Date().toISOString()
            });
        }

        if (state.mobileMessageOrdersLoaded) {
            (state.mobileMessageOrders || []).filter(function (record) {
                return !!(record && ORDER_PROGRESS_STATUSES[record.order_status] && isRecentMobileMessageRecord(record));
            }).forEach(function (record) {
                const status = record.order_status || "pending";
                const recordTime = getOrderMessageTime(record);
                messages.push({
                    key: makeMobileMessageKey("order", [record.order_ref || "", status, recordTime || record.created_at || ""]),
                    type: "order",
                    title: "预约有新进展",
                    description: "你的预约状态已更新，记得查看一下。",
                    actionLabel: "查看预约",
                    action: "order",
                    order_status: status,
                    manual_payment_status: record.manual_payment_status || "",
                    game_type: record.game_type || "",
                    service_type: record.service_type || "",
                    voucher_title: record.voucher_title || "",
                    admin_note: record.admin_note || "",
                    payment_note: record.payment_note || "",
                    updated_at: recordTime || record.created_at || "",
                    processed_at: record.processed_at || "",
                    created_at: record.created_at || ""
                });
            });
        }

        if (state.mobileMessageRedemptionsLoaded) {
            (state.mobileMessageRedemptions || []).filter(function (record) {
                return !!(record && record.status === "approved" && isRecentMobileMessageRecord(record));
            }).forEach(function (record) {
                const recordTime = getOrderMessageTime(record);
                messages.push({
                    key: makeMobileMessageKey("redemption", [
                        record.redeem_ref || "",
                        record.status || "",
                        recordTime || record.created_at || ""
                    ]),
                    type: "redemption",
                    title: "兑换已完成",
                    description: "你的积分兑换已经处理完成，可以查看兑换记录。",
                    actionLabel: "查看兑换",
                    action: "redemption",
                    redeem_type: record.redeem_type || "",
                    quantity: record.quantity || "",
                    cost_points: record.cost_points || "",
                    admin_note: record.admin_note || "",
                    updated_at: recordTime || record.created_at || "",
                    processed_at: record.processed_at || "",
                    created_at: record.created_at || ""
                });
            });
        }

        return sortMobileMessageItems(messages).map(function (message) {
            message.read = !!state.mobileMessageReadState[message.key];
            return message;
        });
    }

    function areMobileMessageSourcesLoading() {
        return Object.keys(state.mobileMessageSources).some(function (source) {
            const status = state.mobileMessageSources[source];
            return status === "idle" || status === "loading";
        });
    }

    function getMobileMessageFailedSources() {
        return Object.keys(state.mobileMessageSources).filter(function (source) {
            return state.mobileMessageSources[source] === "error";
        });
    }

    function logMobileMessageDiagnostics(messages, mode) {
        if (state.mobileMessageDiagnosticsLogged || mode !== "final") {
            return;
        }

        state.mobileMessageDiagnosticsLogged = true;
        console.debug("[star-lake-messages] init");
        console.debug("[star-lake-messages] user logged in:", !!(state.session && state.session.user));
        console.debug("[star-lake-messages] checkin reminder:", messages.some(function (message) { return message.type === "checkin"; }));
        console.debug("[star-lake-messages] appointments count:", state.mobileMessageOrders.length);
        console.debug("[star-lake-messages] redeem messages count:", messages.filter(function (message) { return message.type === "redemption"; }).length);
        console.debug("[star-lake-messages] render messages count:", messages.length);
        if (!messages.length) {
            console.debug("[star-lake-messages] render empty");
        }
    }

    function updateMobileMessageBadge() {
        const messages = buildMobileMessageItems();
        const unreadCount = messages.filter(function (message) { return !message.read; }).length;
        const hasActiveCheckinReminder = messages.some(function (message) { return message.type === "checkin"; });
        const personalCount = Math.max(unreadCount, hasActiveCheckinReminder ? 1 : 0);
        const adminTotalsLoaded = state.isAdmin
            && state.adminMessageSources.orders === "success"
            && state.adminMessageSources.redemptions === "success";
        const badgeCount = state.isAdmin
            ? (adminTotalsLoaded ? state.adminMessageTotals.orders + state.adminMessageTotals.redemptions : 0)
            : personalCount;

        if (nodes.mobileMessageBadge) {
            nodes.mobileMessageBadge.hidden = badgeCount === 0;
            nodes.mobileMessageBadge.textContent = badgeCount > 99 ? "99+" : String(badgeCount);
        }
        nodes.messageLinks.forEach(function (link) {
            link.classList.toggle("has-unread", badgeCount > 0);
            link.setAttribute("aria-label", badgeCount > 0 ? "消息，有未读提醒" : "消息");
        });

        return messages;
    }

    function markMobileMessagesRead(messages) {
        let changed = false;
        (messages || []).forEach(function (message) {
            if (message && message.key && !state.mobileMessageReadState[message.key]) {
                state.mobileMessageReadState[message.key] = Date.now();
                changed = true;
            }
        });
        if (changed) {
            saveMobileMessageReadState();
        }
        return updateMobileMessageBadge();
    }

    function appendMessageMeta(container, values) {
        const items = (values || []).filter(Boolean);
        if (!items.length) {
            return;
        }
        const meta = createMessageElement(container.tagName === "BUTTON" ? "span" : "div", "my-message-meta");
        items.forEach(function (value) {
            meta.append(createMessageElement("span", "my-message-pill", value));
        });
        container.append(meta);
    }

    function createPersonalMessageCard(message) {
        const card = createMessageElement("article", "my-message-card is-" + message.type);
        const head = createMessageElement("div", "my-message-card-head");
        const meta = [];
        const notes = [];
        const time = formatDateTime(getOrderMessageTime(message));

        head.append(
            createMessageElement("strong", "", message.title),
            createMessageElement("span", "my-message-read", message.read ? "已查看" : "未查看")
        );
        card.append(head, createMessageElement("p", "my-message-copy", message.description));

        if (message.type === "order") {
            if (message.game_type || message.service_type) {
                meta.push([message.game_type, message.service_type].filter(Boolean).join(" / "));
            }
            meta.push(ORDER_STATUS_LABELS[message.order_status] || "");
            meta.push(MANUAL_PAYMENT_LABELS[message.manual_payment_status] || "");
            if (message.voucher_title) {
                meta.push("兑换券：" + message.voucher_title);
            }
            if (message.admin_note) {
                notes.push("管理员批注：" + message.admin_note);
            }
            if (message.payment_note) {
                notes.push("人工转账备注：" + message.payment_note);
            }
        } else if (message.type === "redemption") {
            meta.push("积分兑换已通过");
            if (message.admin_note) {
                notes.push("管理员批注：" + message.admin_note);
            }
        }
        if (time) {
            meta.push(time);
        }
        appendMessageMeta(card, meta);
        notes.forEach(function (note) {
            card.append(createMessageElement("div", "my-message-note", note));
        });

        const actions = createMessageElement("div", "my-message-card-actions");
        actions.append(createMessageButton(message.actionLabel, "my-button my-button--primary", "data-my-message-action", message.action));
        card.append(actions);
        return card;
    }

    function createPersonalMessagesSection(messages) {
        const section = createMessageElement("section", "my-message-section");
        section.append(createMessageElement("h3", "my-message-section-title", "我的消息"));
        if (areMobileMessageSourcesLoading()) {
            section.append(createMessageEmpty("正在同步星湖消息...", "正在读取预约、兑换和每日签到提醒。", "loading"));
            return section;
        }
        if (!messages.length) {
            section.append(getMobileMessageFailedSources().length
                ? createMessageEmpty("星湖消息暂时没有同步完成", "已显示可以确认的提醒，稍后再试一次吧。", "warning")
                : createMessageEmpty("星湖暂时很安静", "新的预约、兑换和签到提醒，会在这里慢慢出现。"));
            return section;
        }

        const list = createMessageElement("div", "my-message-list");
        messages.forEach(function (message) {
            list.append(createPersonalMessageCard(message));
        });
        if (getMobileMessageFailedSources().length) {
            list.append(createMessageElement("div", "my-message-sync-note", "部分个人消息同步失败，已显示可以确认的提醒。"));
        }
        section.append(list);
        return section;
    }

    function getAdminMessageItem(messageType, index) {
        const items = state.adminMessageItems[messageType];
        return Array.isArray(items) ? items[index] || null : null;
    }

    function getAdminMessageStatusLabel(messageType, status) {
        if (messageType === "orders") {
            return ORDER_STATUS_LABELS[status] || status || "待处理";
        }
        return status === "pending" ? "待审核" : (status || "待处理");
    }

    function getAdminMessageTitle(messageType, item) {
        const summary = item && item.summary && typeof item.summary === "object" ? item.summary : {};
        if (messageType === "redemptions") {
            return REDEMPTION_TYPE_LABELS[summary.redeem_type] || item.title || "积分兑换申请";
        }
        return item.title || [summary.game_type, summary.service_type].filter(Boolean).join(" / ") || "服务预约";
    }

    function createAdminOverviewPanel() {
        const panel = createMessageElement("section", "my-admin-message-panel is-overview");
        const ordersReady = state.adminMessageSources.orders === "success";
        const redemptionsReady = state.adminMessageSources.redemptions === "success";
        const totalReady = ordersReady && redemptionsReady;
        const rows = [
            ["待审核预约", ordersReady ? state.adminMessageTotals.orders : "--"],
            ["待审核积分兑换", redemptionsReady ? state.adminMessageTotals.redemptions : "--"],
            ["待处理总数", totalReady ? state.adminMessageTotals.orders + state.adminMessageTotals.redemptions : "--"]
        ];
        panel.append(createMessageElement("h4", "my-admin-message-panel-title", "待处理总览"));
        const stats = createMessageElement("div", "my-admin-message-stats");
        rows.forEach(function (row) {
            const item = createMessageElement("div", "my-admin-message-stat");
            item.append(createMessageElement("span", "", row[0]), createMessageElement("strong", "", row[1]));
            stats.append(item);
        });
        panel.append(stats);
        return panel;
    }

    function createAdminMessageItem(messageType, item, index) {
        const summary = item && item.summary && typeof item.summary === "object" ? item.summary : {};
        const button = createMessageButton("", "my-admin-message-item", "data-my-admin-message-type", messageType);
        button.setAttribute("data-my-admin-message-index", String(index));
        const head = createMessageElement("span", "my-admin-message-item-head");
        head.append(
            createMessageElement("strong", "", item.display_name || "星湖用户"),
            createMessageElement("span", "my-message-pill", getAdminMessageStatusLabel(messageType, item.status))
        );
        button.append(head, createMessageElement("span", "my-admin-message-item-title", getAdminMessageTitle(messageType, item)));

        const meta = [];
        if (messageType === "orders") {
            const schedule = [item.scheduled_date || "", summary.scheduled_time || ""].filter(Boolean).join(" ");
            if (schedule) {
                meta.push(schedule);
            }
            if (MANUAL_PAYMENT_LABELS[summary.manual_payment_status]) {
                meta.push(MANUAL_PAYMENT_LABELS[summary.manual_payment_status]);
            }
        } else {
            const rank = REDEMPTION_RANK_LABELS[summary.rank_range] || summary.rank_range || "";
            if (rank) {
                meta.push(rank);
            }
            if (summary.quantity != null && summary.quantity !== "") {
                meta.push("数量 " + summary.quantity);
            }
            meta.push("预计 " + (Number(item.cost_points) || 0) + " 积分");
        }
        const createdAt = formatDateTime(item.created_at);
        if (createdAt) {
            meta.push(createdAt);
        }
        appendMessageMeta(button, meta);
        if (summary.user_note) {
            button.append(createMessageElement("span", "my-admin-message-note-preview", "备注：" + summary.user_note));
        }
        return button;
    }

    function createAdminRequestsPanel(messageType, title) {
        const panel = createMessageElement("section", "my-admin-message-panel is-" + messageType);
        panel.append(createMessageElement("h4", "my-admin-message-panel-title", title));
        const source = state.adminMessageSources[messageType];
        if (source === "idle" || source === "loading") {
            panel.append(createMessageEmpty("正在读取" + title + "...", "稍等片刻，列表会自动更新。", "loading"));
            return panel;
        }
        if (source === "error") {
            panel.append(createMessageEmpty(title + "暂时读取失败", "另一个待处理面板仍可继续使用。", "warning"));
            return panel;
        }

        const items = state.adminMessageItems[messageType] || [];
        if (!items.length) {
            panel.append(createMessageEmpty("目前没有待处理申请。", "这里会显示最近提交的待处理记录。"));
            return panel;
        }
        const list = createMessageElement("div", "my-admin-message-items");
        items.forEach(function (item, index) {
            list.append(createAdminMessageItem(messageType, item, index));
        });
        panel.append(list);
        return panel;
    }

    function createAdminMessageCenter() {
        const section = createMessageElement("section", "my-admin-message-center");
        const head = createMessageElement("div", "my-admin-message-center-head");
        head.append(
            createMessageElement("h3", "my-message-section-title", "待处理消息"),
            createMessageButton("刷新消息", "my-button my-button--compact", "data-my-admin-message-refresh", "")
        );
        section.append(head);

        if (state.adminMessageCapabilityError) {
            section.append(createMessageEmpty(state.adminMessageCapabilityError, "个人消息仍可正常查看。", "warning"));
            return section;
        }
        const panels = createMessageElement("div", "my-admin-message-panels");
        panels.append(
            createAdminOverviewPanel(),
            createAdminRequestsPanel("orders", "预约申请"),
            createAdminRequestsPanel("redemptions", "积分兑换申请")
        );
        section.append(panels);
        return section;
    }

    function appendAdminDetailRow(container, label, value) {
        if (value == null || value === "") {
            return;
        }
        const row = createMessageElement("div", "my-admin-message-detail-row");
        row.append(createMessageElement("span", "", label), createMessageElement("strong", "", value));
        container.append(row);
    }

    function renderAdminMessageDetail() {
        const detail = state.adminMessageDetail || {};
        const item = getAdminMessageItem(detail.messageType, detail.index);
        if (!item) {
            state.adminMessageDetail = null;
            renderStarlakeMessagesModal(buildMobileMessageItems());
            return;
        }
        const summary = item.summary && typeof item.summary === "object" ? item.summary : {};
        const body = createMessageElement("div", "my-admin-message-detail");
        appendAdminDetailRow(body, "老板昵称", item.display_name || "星湖用户");
        appendAdminDetailRow(body, "脱敏邮箱", item.email_masked || "未绑定邮箱");
        appendAdminDetailRow(body, "申请内容", getAdminMessageTitle(detail.messageType, item));
        appendAdminDetailRow(body, "当前状态", getAdminMessageStatusLabel(detail.messageType, item.status));
        if (detail.messageType === "orders") {
            appendAdminDetailRow(body, "预约时间", [item.scheduled_date || "", summary.scheduled_time || ""].filter(Boolean).join(" "));
            appendAdminDetailRow(body, "预计时长", summary.duration_hours ? summary.duration_hours + " 小时" : "");
            appendAdminDetailRow(body, "人工转账", MANUAL_PAYMENT_LABELS[summary.manual_payment_status] || summary.manual_payment_status);
            appendAdminDetailRow(body, "兑换券", summary.voucher_title);
            appendAdminDetailRow(body, "人工转账备注", summary.payment_note);
        } else {
            appendAdminDetailRow(body, "段位区间", REDEMPTION_RANK_LABELS[summary.rank_range] || summary.rank_range);
            appendAdminDetailRow(body, "数量", summary.quantity);
            appendAdminDetailRow(body, "预计消耗积分", (Number(item.cost_points) || 0) + " 积分");
        }
        appendAdminDetailRow(body, "用户备注", summary.user_note || "暂无");
        appendAdminDetailRow(body, "管理员批注", summary.admin_note || "暂无");
        appendAdminDetailRow(body, "提交时间", formatDateTime(item.created_at));

        const back = createMessageButton("返回消息", "my-button", "data-my-admin-message-back", "");
        const enterAdmin = createMessageElement("a", "my-button my-button--primary", "进入后台处理");
        const orderStatus = item.status === "need_reschedule" ? "need_reschedule" : "pending";
        enterAdmin.href = detail.messageType === "orders"
            ? "admin.html?panel=orders&status=" + orderStatus
            : "admin.html?panel=redemptions&status=pending";
        setMessageModalContent("申请详情", "查看申请摘要，审批操作仍在管理员后台完成。", body, [back, enterAdmin]);
    }

    function renderStarlakeMessagesModal(messages) {
        if (state.adminMessageDetail) {
            renderAdminMessageDetail();
            return;
        }
        const renderedMessages = messages || [];
        const body = createMessageElement("div", "my-message-center");
        logMobileMessageDiagnostics(renderedMessages, areMobileMessageSourcesLoading() ? "loading" : "final");
        body.append(createPersonalMessagesSection(renderedMessages));
        if (state.isAdmin || state.adminMessageCapabilityError) {
            body.append(createAdminMessageCenter());
        }
        setMessageModalContent(
            "星湖消息",
            state.isAdmin ? "这里汇总个人提醒和管理员待处理申请。" : "这里会汇总你的预约进度、兑换结果和每日签到提醒。",
            body,
            [
                createMessageButton("刷新消息", "my-button", "data-my-message-refresh", ""),
                createMessageButton("返回", "my-button my-button--primary", "data-my-modal-close", "")
            ]
        );
    }

    function refreshOpenStarlakeMessages() {
        if (state.activeModal === "messages" && nodes.modal && !nodes.modal.hidden) {
            renderStarlakeMessagesModal(buildMobileMessageItems());
        }
    }

    function setModalContent(title, subtitle, body, actions) {
        setText(nodes.modalTitle, title);
        setText(nodes.modalSubtitle, subtitle);
        if (nodes.modalBody) {
            nodes.modalBody.innerHTML = body || "";
        }
        if (nodes.modalActions) {
            nodes.modalActions.innerHTML = actions || "<button class=\"my-button\" type=\"button\" data-my-modal-close>关闭</button>";
        }
    }

    function getStatusRows() {
        const status = state.checkinStatus;
        const signed = isSigned(status);

        return [
            { label: "当前积分", value: status ? String(status.totalPoints) : "--" },
            { label: "总签到", value: status ? String(status.totalCheckins) + " 天" : "--" },
            { label: "连续签到", value: status ? String(status.currentStreak) + " 天" : "--" },
            { label: "本月签到", value: status ? String(status.monthlyCheckins) + " 天" : "--" },
            { label: "今日状态", value: status ? (signed ? "今天已签到" : "今天还没签到") : "--" },
            { label: "签到奖励", value: status && status.rewardPoints ? String(status.rewardPoints) + " 积分" : "--" }
        ];
    }

    function renderPointsModal() {
        setModalContent(
            "个人积分",
            "这里展示星湖签到带来的积分概览，明细系统后续可以继续接入。",
            "<div class=\"my-modal-grid\">" +
                renderRows(getStatusRows().slice(0, 4)) +
                "<div class=\"my-empty-state\">积分明细列表正在准备中。当前页面会先同步你的真实积分、签到次数和连续签到状态。</div>" +
            "</div>",
            "<button class=\"my-button\" type=\"button\" data-my-modal-refresh>刷新状态</button><button class=\"my-button my-button--primary\" type=\"button\" data-my-modal-close>知道了</button>"
        );
    }

    function renderCheckinModal() {
        const status = state.checkinStatus;
        const signed = isSigned(status);
        const disabled = signed || state.checkinInFlight || state.checkinUnavailable ? " disabled" : "";
        const buttonLabel = state.checkinUnavailable ? "暂未开启" : (state.checkinInFlight ? "签到中..." : (signed ? "今天已签到" : "立即签到"));
        const message = nodes.checkinMessage ? nodes.checkinMessage.textContent : "";

        setModalContent(
            "星湖签到",
            "每天来星湖报到一次，积一点温柔的小积分。",
            "<div class=\"my-modal-grid\">" +
                renderRows(getStatusRows()) +
                "<div class=\"my-alert\">" + escapeHtml(message || (signed ? "今日已完成签到。" : "今日还可以签到。")) + "</div>" +
            "</div>",
            "<button class=\"my-button\" type=\"button\" data-my-modal-refresh>刷新状态</button><button class=\"my-button my-button--primary\" type=\"button\" data-my-modal-checkin" + disabled + ">" + escapeHtml(buttonLabel) + "</button>"
        );
    }

    function renderExchangeModal() {
        const points = state.checkinStatus ? String(state.checkinStatus.totalPoints) : "--";

        setModalContent(
            "积分兑换",
            "兑换礼物 / 小权益的入口已经预留，后续可以继续接入兑换列表。",
            "<div class=\"my-modal-grid\" data-my-exchange-panel>" +
                renderRows([{ label: "当前积分", value: points }, { label: "可兑换内容", value: "准备中" }]) +
                "<div class=\"my-empty-state\" data-my-exchange-empty>兑换内容正在准备中。这里会保留后续接入兑换列表、权益说明和兑换按钮的位置。</div>" +
            "</div>",
            "<button class=\"my-button my-button--primary\" type=\"button\" data-my-modal-close>知道了</button>"
        );
    }

    function renderSettingsModal() {
        const displayName = nodes.displayName ? nodes.displayName.textContent : "星湖昵称：已登录";

        setModalContent(
            "账号设置",
            "账号设置入口已预留，当前可先维护云端头像并查看账号基础信息。",
            "<div class=\"my-modal-grid\">" +
                renderRows([
                    { label: "星湖昵称", value: displayName.replace(/^星湖昵称：/, "") || "已登录" },
                    { label: "账号身份", value: "星湖账号" },
                    { label: "加入时间", value: nodes.registeredAt ? nodes.registeredAt.textContent : "--" }
                ]) +
                "<div class=\"my-empty-state\">更多账号设置正在准备中。头像修改仍使用当前页面的云端头像上传功能。</div>" +
            "</div>",
            "<button class=\"my-button\" type=\"button\" data-my-modal-avatar>更换头像</button><button class=\"my-button my-button--primary\" type=\"button\" data-my-modal-close>关闭</button>"
        );
    }

    function updateOpenModal() {
        if (!state.activeModal || !nodes.modal || nodes.modal.hidden) {
            return;
        }

        if (state.activeModal === "points") {
            renderPointsModal();
            return;
        }
        if (state.activeModal === "checkin") {
            renderCheckinModal();
            return;
        }
        if (state.activeModal === "exchange") {
            renderExchangeModal();
            return;
        }
        if (state.activeModal === "settings") {
            renderSettingsModal();
            return;
        }
        if (state.activeModal === "messages") {
            return;
        }
    }

    function openModal(type, trigger) {
        if (!nodes.modal) {
            return;
        }

        state.activeModal = type;
        state.lastModalTrigger = trigger || document.activeElement;
        nodes.modal.hidden = false;
        nodes.modal.classList.toggle("is-mobile-message", type === "messages");
        if (nodes.modalPanel) {
            nodes.modalPanel.classList.toggle("is-mobile-message-panel", type === "messages");
        }
        updateOpenModal();
        document.body.classList.add("is-my-modal-open");

        if (nodes.modalClose) {
            nodes.modalClose.focus({ preventScroll: true });
        }
    }

    function closeModal() {
        if (!nodes.modal) {
            return;
        }

        if (state.activeModal === "messages") {
            state.adminMessageRequestToken += 1;
            state.adminMessageLoadPromise = null;
            state.adminMessageDetail = null;
        }
        nodes.modal.hidden = true;
        nodes.modal.classList.remove("is-mobile-message");
        if (nodes.modalPanel) {
            nodes.modalPanel.classList.remove("is-mobile-message-panel");
        }
        document.body.classList.remove("is-my-modal-open");
        state.activeModal = "";

        if (state.lastModalTrigger && typeof state.lastModalTrigger.focus === "function") {
            state.lastModalTrigger.focus({ preventScroll: true });
        }
        state.lastModalTrigger = null;
    }

    async function openMobileMessagePopup(trigger) {
        console.debug("[my-mobile-message] open");

        if (!nodes.modal) {
            return;
        }

        if (!state.client || !state.session || !state.session.user) {
            renderMessageLoginModal();
            openModal("messages", trigger);
            return;
        }

        renderStarlakeMessagesModal(markMobileMessagesRead(buildMobileMessageItems()));
        openModal("messages", trigger);

        if (state.mobileMessageInFlight) {
            return;
        }
        state.mobileMessageInFlight = true;
        const userId = getCurrentSessionUserId();
        try {
            if (state.mobileMessageLoadPromise) {
                await state.mobileMessageLoadPromise;
            }
            if (userId !== getCurrentSessionUserId() || state.activeModal !== "messages") {
                return;
            }
            renderStarlakeMessagesModal(markMobileMessagesRead(buildMobileMessageItems()));
            if (state.isAdmin) {
                loadAdminMessages(false);
            }
        } finally {
            state.mobileMessageInFlight = false;
        }
    }

    async function refreshMessageCenter() {
        const userId = getCurrentSessionUserId();
        if (!state.client || !userId || state.mobileMessageInFlight) {
            return;
        }

        state.mobileMessageInFlight = true;
        state.mobileMessageSources.checkin = "loading";
        state.mobileMessageSources.orders = "loading";
        state.mobileMessageSources.redemptions = "loading";
        refreshOpenStarlakeMessages();
        try {
            await Promise.allSettled([
                loadCheckinStatus(),
                loadMobileMessageOrders(),
                loadMobileMessageRedemptions(),
                loadAdminIdentity()
            ]);
            if (userId !== getCurrentSessionUserId()) {
                return;
            }
            markMobileMessagesRead(buildMobileMessageItems());
            refreshOpenStarlakeMessages();
            if (state.isAdmin) {
                await loadAdminMessages(true);
            }
        } finally {
            state.mobileMessageInFlight = false;
        }
    }

    function closeMobileMessagePopup() {
        closeModal();
    }

    function activateCheckinSection() {
        console.debug("[star-lake-messages] navigate to checkin section");
        const section = nodes.checkinSection;
        console.debug("[star-lake-messages] checkin section found:", !!section);

        if (!section) {
            return;
        }

        window.requestAnimationFrame(function () {
            section.scrollIntoView({ behavior: "smooth", block: "center" });
            if (typeof section.focus === "function") {
                section.focus({ preventScroll: true });
            }
            console.debug("[star-lake-checkin] section activated");
        });
    }

    function handleMobileMessageEvent(event, trigger) {
        if (!trigger) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        openMobileMessagePopup(trigger);
    }

    function bindMobileMessageEntry() {
        if (document.documentElement.dataset.myMessageBound === "true") {
            return;
        }

        document.documentElement.dataset.myMessageBound = "true";

        if (nodes.mobileMessageLink) {
            nodes.mobileMessageLink.dataset.myMessageBound = "true";
        }

        document.addEventListener("click", function (event) {
            const trigger = event.target && event.target.closest ? event.target.closest("[data-my-mobile-message]") : null;
            if (trigger) {
                handleMobileMessageEvent(event, trigger);
            }
        });

        document.addEventListener("keydown", function (event) {
            if (event.key !== "Enter" && event.key !== " ") {
                return;
            }

            const trigger = event.target && event.target.closest ? event.target.closest("[data-my-mobile-message]") : null;
            if (trigger) {
                handleMobileMessageEvent(event, trigger);
            }
        });
    }

    function validateAvatarFile(file) {
        if (!file) {
            return "";
        }

        if (!AVATAR_TYPES[file.type]) {
            return "头像只支持 JPG、PNG 或 WebP 图片。";
        }

        if (file.size > MAX_AVATAR_SOURCE_BYTES) {
            return "图片超过 3MB，请压缩后重新选择。";
        }

        return "";
    }

    function readBlobAsArrayBuffer(blob) {
        if (blob && typeof blob.arrayBuffer === "function") {
            return blob.arrayBuffer();
        }

        return new Promise(function (resolve, reject) {
            const reader = new FileReader();
            reader.onload = function () {
                resolve(reader.result);
            };
            reader.onerror = function () {
                reject(reader.error || new Error("avatar-file-read-failed"));
            };
            reader.readAsArrayBuffer(blob);
        });
    }

    async function detectAvatarMime(file) {
        const buffer = await readBlobAsArrayBuffer(file.slice(0, 16));
        const bytes = new Uint8Array(buffer);

        if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
            return "image/jpeg";
        }

        if (
            bytes.length >= 8
            && bytes[0] === 0x89
            && bytes[1] === 0x50
            && bytes[2] === 0x4e
            && bytes[3] === 0x47
            && bytes[4] === 0x0d
            && bytes[5] === 0x0a
            && bytes[6] === 0x1a
            && bytes[7] === 0x0a
        ) {
            return "image/png";
        }

        if (
            bytes.length >= 12
            && bytes[0] === 0x52
            && bytes[1] === 0x49
            && bytes[2] === 0x46
            && bytes[3] === 0x46
            && bytes[8] === 0x57
            && bytes[9] === 0x45
            && bytes[10] === 0x42
            && bytes[11] === 0x50
        ) {
            return "image/webp";
        }

        return "";
    }

    async function loadAvatarImageSource(file) {
        if (typeof window.createImageBitmap === "function") {
            try {
                const bitmap = await window.createImageBitmap(file, { imageOrientation: "from-image" });
                if (bitmap && bitmap.width > 0 && bitmap.height > 0) {
                    return {
                        source: bitmap,
                        width: bitmap.width,
                        height: bitmap.height,
                        cleanup: function () {
                            if (typeof bitmap.close === "function") {
                                bitmap.close();
                            }
                        }
                    };
                }
                if (bitmap && typeof bitmap.close === "function") {
                    bitmap.close();
                }
            } catch (error) {}
        }

        return new Promise(function (resolve, reject) {
            let url = "";
            const image = new Image();
            let cleaned = false;

            function releaseUrl() {
                if (url) {
                    URL.revokeObjectURL(url);
                    url = "";
                }
            }

            function cleanup() {
                if (cleaned) {
                    return;
                }
                cleaned = true;
                releaseUrl();
                image.onload = null;
                image.onerror = null;
                image.src = "";
            }

            image.decoding = "async";
            image.onload = function () {
                const width = image.naturalWidth || image.width;
                const height = image.naturalHeight || image.height;
                releaseUrl();

                if (!width || !height) {
                    cleanup();
                    reject(new Error("image-load-failed"));
                    return;
                }

                resolve({
                    source: image,
                    width: width,
                    height: height,
                    cleanup: cleanup
                });
            };
            image.onerror = function () {
                cleanup();
                reject(new Error("image-load-failed"));
            };

            try {
                url = URL.createObjectURL(file);
                image.src = url;
            } catch (error) {
                cleanup();
                reject(new Error("image-load-failed"));
            }
        });
    }

    function createAvatarCanvas(source, width, height, maxEdge) {
        const longestEdge = Math.max(width, height);
        const scale = Math.min(1, maxEdge / longestEdge);
        const canvas = document.createElement("canvas");
        const targetWidth = Math.max(1, Math.round(width * scale));
        const targetHeight = Math.max(1, Math.round(height * scale));

        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const context = canvas.getContext("2d", { alpha: true });

        if (!context) {
            releaseAvatarCanvas(canvas);
            throw new Error("canvas-context-failed");
        }

        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(source, 0, 0, targetWidth, targetHeight);
        return canvas;
    }

    function releaseAvatarCanvas(canvas) {
        if (!canvas) {
            return;
        }
        canvas.width = 0;
        canvas.height = 0;
    }

    function canvasHasTransparency(canvas) {
        try {
            const context = canvas.getContext("2d", { alpha: true });
            const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;

            for (let index = 3; index < pixels.length; index += 4) {
                if (pixels[index] < 255) {
                    return true;
                }
            }
            return false;
        } catch (error) {
            return true;
        }
    }

    function getCurrentSessionUserId() {
        return state.session && state.session.user ? String(state.session.user.id || "") : "";
    }

    function setAdminShortcutVisible(visible) {
        if (nodes.adminShortcut) {
            nodes.adminShortcut.hidden = !visible;
        }
    }

    function resetAdminMessageData(capabilityError) {
        state.adminMessageRequestToken += 1;
        state.adminMessageOwnerUserId = "";
        state.adminMessageLoadedAt = 0;
        state.adminMessageLoadPromise = null;
        state.adminMessageDetail = null;
        state.adminMessageCapabilityError = capabilityError || "";
        state.adminMessageSources.orders = "idle";
        state.adminMessageSources.redemptions = "idle";
        state.adminMessageTotals.orders = 0;
        state.adminMessageTotals.redemptions = 0;
        state.adminMessageItems.orders = [];
        state.adminMessageItems.redemptions = [];
    }

    function clearAdminAccess(capabilityError) {
        state.isAdmin = false;
        state.adminCheckLoaded = true;
        state.adminCheckFailed = !!capabilityError;
        resetAdminMessageData(capabilityError);
        setAdminShortcutVisible(false);
        updateMobileMessageBadge();
        refreshOpenStarlakeMessages();
    }

    async function loadAdminIdentity() {
        const userId = getCurrentSessionUserId();
        if (!state.client || !userId) {
            clearAdminAccess("");
            return false;
        }

        try {
            const response = await state.client
                .from("live_interaction_admins")
                .select("user_id")
                .eq("user_id", userId)
                .maybeSingle();

            if (getCurrentSessionUserId() !== userId) {
                return false;
            }
            if (response.error) {
                throw response.error;
            }

            state.isAdmin = !!response.data;
            state.adminCheckLoaded = true;
            state.adminCheckFailed = false;
            state.adminMessageCapabilityError = "";
            setAdminShortcutVisible(state.isAdmin);
            if (!state.isAdmin) {
                resetAdminMessageData("");
            }
            updateMobileMessageBadge();
            return state.isAdmin;
        } catch (error) {
            console.warn("[star-lake-messages] admin identity check unavailable.");
            clearAdminAccess("");
            return false;
        }
    }

    function isAdminMessageSetupError(error) {
        const message = error && error.message ? String(error.message) : "";
        return /admin_get_my_page_pending_messages|schema cache|function .* does not exist|PGRST202/i.test(message);
    }

    function isAdminMessagePermissionError(error) {
        const message = error && error.message ? String(error.message) : "";
        return /not authorized|permission denied|row-level security|JWT|auth/i.test(message);
    }

    function normalizeAdminMessagePayload(data, messageType) {
        let payload = Array.isArray(data) ? data[0] : data;
        if (typeof payload === "string") {
            try {
                payload = JSON.parse(payload);
            } catch (error) {
                payload = null;
            }
        }
        if (!payload || typeof payload !== "object" || payload.message_type !== messageType) {
            throw new Error("invalid admin message payload");
        }

        const total = Number(payload.type_total);
        return {
            messageType: messageType,
            total: Number.isFinite(total) && total > 0 ? Math.floor(total) : 0,
            items: Array.isArray(payload.items) ? payload.items.slice(0, 5) : []
        };
    }

    function isAdminMessageRequestCurrent(token, userId) {
        return token === state.adminMessageRequestToken
            && userId === getCurrentSessionUserId()
            && state.isAdmin
            && state.adminMessageOwnerUserId === userId;
    }

    async function loadAdminMessageSource(messageType, token, userId) {
        try {
            const response = await state.client.rpc(ADMIN_MESSAGE_RPC, {
                p_message_type: messageType
            });
            if (!isAdminMessageRequestCurrent(token, userId)) {
                return;
            }
            if (response.error) {
                throw response.error;
            }

            const payload = normalizeAdminMessagePayload(response.data, messageType);
            if (!isAdminMessageRequestCurrent(token, userId)) {
                return;
            }
            state.adminMessageTotals[messageType] = payload.total;
            state.adminMessageItems[messageType] = payload.items;
            state.adminMessageSources[messageType] = "success";
            refreshOpenStarlakeMessages();
        } catch (error) {
            if (!isAdminMessageRequestCurrent(token, userId)) {
                return;
            }
            if (isAdminMessageSetupError(error)) {
                clearAdminAccess("管理员消息功能需要先完成数据库升级。");
                return;
            }
            if (isAdminMessagePermissionError(error)) {
                clearAdminAccess("管理员消息暂时无法读取。");
                return;
            }

            state.adminMessageTotals[messageType] = 0;
            state.adminMessageItems[messageType] = [];
            state.adminMessageSources[messageType] = "error";
            console.warn("[star-lake-messages] admin " + messageType + " messages unavailable.");
            refreshOpenStarlakeMessages();
        }
    }

    function hasFreshAdminMessageCache(userId) {
        return state.adminMessageOwnerUserId === userId
            && state.adminMessageSources.orders === "success"
            && state.adminMessageSources.redemptions === "success"
            && Date.now() - state.adminMessageLoadedAt < ADMIN_MESSAGE_CACHE_MS;
    }

    function loadAdminMessages(force) {
        const userId = getCurrentSessionUserId();
        if (!state.client || !state.isAdmin || !userId) {
            return Promise.resolve();
        }
        if (!force && hasFreshAdminMessageCache(userId)) {
            return Promise.resolve();
        }
        if (!force && state.adminMessageLoadPromise) {
            return state.adminMessageLoadPromise;
        }

        const token = state.adminMessageRequestToken + 1;
        state.adminMessageRequestToken = token;
        state.adminMessageOwnerUserId = userId;
        state.adminMessageLoadedAt = 0;
        state.adminMessageDetail = null;
        state.adminMessageCapabilityError = "";
        state.adminMessageSources.orders = "loading";
        state.adminMessageSources.redemptions = "loading";
        state.adminMessageTotals.orders = 0;
        state.adminMessageTotals.redemptions = 0;
        state.adminMessageItems.orders = [];
        state.adminMessageItems.redemptions = [];
        refreshOpenStarlakeMessages();

        const promise = Promise.allSettled([
            loadAdminMessageSource("orders", token, userId),
            loadAdminMessageSource("redemptions", token, userId)
        ]).then(function () {
            if (!isAdminMessageRequestCurrent(token, userId)) {
                return;
            }
            if (state.adminMessageSources.orders === "success" && state.adminMessageSources.redemptions === "success") {
                state.adminMessageLoadedAt = Date.now();
            }
            state.adminMessageLoadPromise = null;
            updateMobileMessageBadge();
            refreshOpenStarlakeMessages();
        });

        state.adminMessageLoadPromise = promise;
        return promise;
    }

    function canvasToBlob(canvas, type, quality) {
        return new Promise(function (resolve) {
            canvas.toBlob(function (blob) {
                resolve(blob || null);
            }, type, quality);
        });
    }

    async function encodeLossyAvatar(canvas, contentType, extension) {
        let latest = null;

        for (let index = 0; index < AVATAR_QUALITY_STEPS.length; index += 1) {
            const blob = await canvasToBlob(canvas, contentType, AVATAR_QUALITY_STEPS[index]);
            if (!blob || blob.type !== contentType) {
                return null;
            }

            latest = {
                blob: blob,
                extension: extension,
                contentType: contentType
            };
            if (blob.size <= TARGET_AVATAR_BYTES) {
                return latest;
            }
        }

        return latest;
    }

    async function encodePngAvatar(canvas) {
        const blob = await canvasToBlob(canvas, "image/png");
        if (!blob || blob.type !== "image/png") {
            return null;
        }

        return {
            blob: blob,
            extension: "png",
            contentType: "image/png"
        };
    }

    function getAvatarEdgeSteps(longestEdge) {
        const baseEdge = Math.min(AVATAR_MAX_EDGE, longestEdge);
        const values = [baseEdge, Math.min(baseEdge, 640), Math.min(baseEdge, 512), Math.min(baseEdge, 384)];
        return values.filter(function (value, index) {
            return value > 0 && values.indexOf(value) === index;
        });
    }

    function keepSmallerAvatarResult(current, candidate) {
        if (!candidate || !candidate.blob) {
            return current;
        }
        if (!current || !current.blob || candidate.blob.size < current.blob.size) {
            return candidate;
        }
        return current;
    }

    async function compressAvatar(file, detectedMime) {
        let imageSource = null;
        let bestResult = null;
        let webpSupported = true;
        let fallbackType = "";

        try {
            imageSource = await loadAvatarImageSource(file);
            const width = imageSource.width;
            const height = imageSource.height;
            const longestEdge = Math.max(width, height);

            if (longestEdge > AVATAR_SAFE_MAX_EDGE || width * height > AVATAR_SAFE_MAX_PIXELS) {
                throw new Error("avatar-pixels-too-large");
            }

            const edgeSteps = getAvatarEdgeSteps(longestEdge);
            for (let index = 0; index < edgeSteps.length; index += 1) {
                let canvas = null;

                try {
                    canvas = createAvatarCanvas(imageSource.source, width, height, edgeSteps[index]);
                    let candidate = null;

                    if (webpSupported) {
                        candidate = await encodeLossyAvatar(canvas, "image/webp", "webp");
                        if (candidate) {
                            bestResult = keepSmallerAvatarResult(bestResult, candidate);
                            if (candidate.blob.size <= TARGET_AVATAR_BYTES) {
                                return candidate;
                            }
                            continue;
                        }
                        webpSupported = false;
                    }

                    if (!fallbackType) {
                        const needsTransparency = detectedMime !== "image/jpeg" && canvasHasTransparency(canvas);
                        fallbackType = needsTransparency ? "image/png" : "image/jpeg";
                    }

                    candidate = fallbackType === "image/png"
                        ? await encodePngAvatar(canvas)
                        : await encodeLossyAvatar(canvas, "image/jpeg", "jpg");

                    if (!candidate) {
                        throw new Error("canvas-blob-failed");
                    }

                    bestResult = keepSmallerAvatarResult(bestResult, candidate);
                    if (candidate.blob.size <= TARGET_AVATAR_BYTES) {
                        return candidate;
                    }
                } finally {
                    releaseAvatarCanvas(canvas);
                    canvas = null;
                }
            }

            if (!bestResult || !bestResult.blob) {
                throw new Error("canvas-blob-failed");
            }
            if (bestResult.blob.size > MAX_AVATAR_UPLOAD_BYTES) {
                throw new Error("compressed-avatar-too-large");
            }

            return bestResult;
        } finally {
            if (imageSource && typeof imageSource.cleanup === "function") {
                imageSource.cleanup();
            }
            imageSource = null;
        }
    }

    function getAvatarRandomToken() {
        if (window.crypto && typeof window.crypto.randomUUID === "function") {
            return window.crypto.randomUUID().replace(/-/g, "").slice(0, 12);
        }

        if (window.crypto && typeof window.crypto.getRandomValues === "function") {
            const bytes = new Uint8Array(6);
            window.crypto.getRandomValues(bytes);
            return Array.prototype.map.call(bytes, function (byte) {
                return byte.toString(16).padStart(2, "0");
            }).join("");
        }

        return Math.random().toString(36).slice(2, 14);
    }

    function buildAvatarPath(extension) {
        const userId = state.session && state.session.user ? String(state.session.user.id || "") : "";
        return userId + "/avatar-" + Date.now() + "-" + getAvatarRandomToken() + "." + extension;
    }

    function isCurrentUserAvatarPath(path) {
        const userId = state.session && state.session.user ? String(state.session.user.id || "") : "";
        const source = String(path || "");
        const parts = source.split("/");

        return !!userId
            && source.charAt(0) !== "/"
            && parts.length >= 2
            && parts[0] === userId
            && parts.every(function (part) {
                return !!part && part !== "." && part !== "..";
            });
    }

    async function removeOwnedAvatar(path) {
        if (!path || !isCurrentUserAvatarPath(path)) {
            if (path) {
                console.warn("[JunxueMy] skipped avatar cleanup outside the current user directory.");
            }
            return false;
        }

        const response = await state.client.storage.from(AVATAR_BUCKET).remove([path]);
        if (response.error) {
            throw response.error;
        }
        return true;
    }

    function getAvatarErrorMessage(error) {
        const code = error && error.message ? String(error.message) : "";

        if (/avatar-file-read-failed|invalid-avatar-file|image-load-failed/i.test(code)) {
            return "无法读取这张图片，请换一张 JPG、PNG 或 WebP 图片。";
        }
        if (code === "avatar-pixels-too-large") {
            return "图片像素过大，请换一张尺寸更小的 JPG、PNG 或 WebP 图片。";
        }
        if (code === "compressed-avatar-too-large") {
            return "图片压缩后仍然过大，请换一张尺寸更小的图片。";
        }
        if (/canvas|compress/i.test(code)) {
            return "头像压缩失败，请换一张图片后重试。";
        }
        if (isAvatarSetupError(error)) {
            return "头像上传功能还需要完成云端配置。";
        }
        return "头像上传失败，请稍后再试。";
    }

    async function saveAvatarPath(path) {
        const displayName = safeTrim(state.profile && state.profile.display_name) || getMetadataDisplayName(state.session.user);
        const payload = {
            user_id: state.session.user.id,
            display_name: displayName,
            avatar_path: path,
            avatar_updated_at: new Date().toISOString()
        };
        const response = await state.client
            .from("boss_profiles")
            .upsert(payload, { onConflict: "user_id" })
            .select("display_name,avatar_path,avatar_updated_at")
            .maybeSingle();

        if (response.error) {
            throw response.error;
        }

        state.profile = response.data || payload;
        state.avatarPath = path;
        renderProfile(state.profile);
    }

    async function uploadAvatar(file) {
        if (!file || state.avatarUploadInFlight) {
            return;
        }

        const validationMessage = validateAvatarFile(file);
        if (validationMessage) {
            setAvatarStatus(validationMessage);
            return;
        }

        state.avatarUploadInFlight = true;
        setBusy(nodes.avatarButton, true, "处理中...");
        setAvatarStatus("正在压缩头像…");

        let nextPath = "";
        const oldPath = state.avatarPath;
        let profileUpdated = false;
        let newAvatarReadable = false;
        let compressed = null;

        try {
            const detectedMime = await detectAvatarMime(file);
            if (!detectedMime || detectedMime !== file.type) {
                throw new Error("invalid-avatar-file");
            }

            compressed = await compressAvatar(file, detectedMime);
            if (!compressed || !compressed.blob) {
                throw new Error("canvas-blob-failed");
            }
            if (compressed.blob.size > MAX_AVATAR_UPLOAD_BYTES) {
                throw new Error("compressed-avatar-too-large");
            }

            nextPath = buildAvatarPath(compressed.extension);
            setBusy(nodes.avatarButton, true, "上传中...");
            setAvatarStatus("正在上传头像…");

            const uploadResponse = await state.client.storage.from(AVATAR_BUCKET).upload(nextPath, compressed.blob, {
                cacheControl: "3600",
                contentType: compressed.contentType,
                upsert: false
            });

            if (uploadResponse.error) {
                throw uploadResponse.error;
            }

            await saveAvatarPath(nextPath);
            profileUpdated = true;

            const signedUrl = await getReadableCloudAvatarUrl(nextPath);
            applyCloudAvatarUrl(signedUrl);
            newAvatarReadable = true;

            if (oldPath && oldPath !== nextPath) {
                try {
                    await removeOwnedAvatar(oldPath);
                } catch (removeError) {
                    console.warn("[JunxueMy] old avatar cleanup failed.");
                }
            }

            setAvatarStatus("头像已保存到云端");
        } catch (error) {
            if (profileUpdated && !newAvatarReadable) {
                try {
                    await saveAvatarPath(oldPath);
                    await renderCloudAvatar(oldPath);
                } catch (rollbackError) {
                    console.warn("[JunxueMy] avatar path rollback failed.");
                }
            }

            if (nextPath) {
                try {
                    await removeOwnedAvatar(nextPath);
                } catch (cleanupError) {
                    console.warn("[JunxueMy] new avatar cleanup failed.");
                }
            }

            setAvatarStatus(getAvatarErrorMessage(error));
        } finally {
            compressed = null;
            state.avatarUploadInFlight = false;
            setBusy(nodes.avatarButton, false, "更换头像");
            if (nodes.avatarInput) {
                nodes.avatarInput.value = "";
            }
        }
    }

    async function refreshAll(message) {
        const token = state.loadingToken + 1;
        state.loadingToken = token;
        setAvatarStatus("正在读取星湖资料...");
        setCheckinMessage("正在读取签到状态...");
        state.mobileMessageSources.checkin = "loading";
        state.mobileMessageSources.orders = "loading";
        state.mobileMessageSources.redemptions = "loading";
        state.mobileMessageOrdersLoaded = false;
        state.mobileMessageRedemptionsLoaded = false;
        state.mobileMessageOrders = [];
        state.mobileMessageRedemptions = [];

        state.mobileMessageLoadPromise = Promise.allSettled([
            loadProfile(),
            loadCheckinStatus(message),
            loadMobileMessageOrders(),
            loadMobileMessageRedemptions(),
            loadAdminIdentity()
        ]);
        await state.mobileMessageLoadPromise;
        if (token !== state.loadingToken) {
            return;
        }
        updateMobileMessageBadge();
        refreshOpenStarlakeMessages();
        logMobileMessageDiagnostics(buildMobileMessageItems(), "final");
        if (nodes.avatarStatus && nodes.avatarStatus.textContent === "正在读取星湖资料...") {
            setAvatarStatus("");
        }
    }

    function resetSessionBoundState() {
        state.loadingToken += 1;
        state.mobileMessageInFlight = false;
        state.mobileMessageLoadPromise = null;
        state.mobileMessageOrders = [];
        state.mobileMessageRedemptions = [];
        state.mobileMessageOrdersLoaded = false;
        state.mobileMessageRedemptionsLoaded = false;
        state.mobileMessageSources.checkin = "idle";
        state.mobileMessageSources.orders = "idle";
        state.mobileMessageSources.redemptions = "idle";
        state.mobileMessageReadState = {};
        state.mobileMessageDiagnosticsLogged = false;
        state.checkinStatus = null;
        state.profile = null;
        state.avatarPath = "";
        state.isAdmin = false;
        state.adminCheckLoaded = false;
        state.adminCheckFailed = false;
        resetAdminMessageData("");
        setAdminShortcutVisible(false);
        if (nodes.mobileMessageBadge) {
            nodes.mobileMessageBadge.hidden = true;
            nodes.mobileMessageBadge.textContent = "0";
        }
        nodes.messageLinks.forEach(function (link) {
            link.classList.remove("has-unread");
            link.setAttribute("aria-label", "消息");
        });
    }

    async function bootstrapAuthenticatedSession() {
        if (!state.session || !state.session.user) {
            renderLoggedOut();
            return;
        }
        loadMobileMessageReadState();
        renderLoggedInShell();
        renderProfile(null);
        await refreshAll();
    }

    async function handleAuthStateChange(nextSession) {
        const previousUserId = getCurrentSessionUserId();
        const nextUserId = nextSession && nextSession.user ? String(nextSession.user.id || "") : "";
        if (previousUserId === nextUserId) {
            state.session = nextSession || null;
            return;
        }

        if (nodes.modal && !nodes.modal.hidden) {
            closeModal();
        }
        resetSessionBoundState();
        state.session = nextSession || null;
        if (!nextUserId) {
            renderLoggedOut();
            return;
        }

        try {
            await bootstrapAuthenticatedSession();
        } catch (error) {
            resetSessionBoundState();
            state.session = null;
            renderLoggedOut();
            console.debug("[JunxueMy] session change refresh failed.");
        }
    }

    async function init() {
        try {
            if (!window.JunxueSupabaseClient || typeof window.JunxueSupabaseClient.getClient !== "function") {
                throw new Error("shared-client-missing");
            }

            state.client = await window.JunxueSupabaseClient.getClient();
            const sessionResponse = await state.client.auth.getSession();

            if (sessionResponse.error) {
                throw sessionResponse.error;
            }

            state.session = sessionResponse.data ? sessionResponse.data.session : null;
            if (!state.session || !state.session.user) {
                renderLoggedOut();
            } else {
                await bootstrapAuthenticatedSession();
            }

            const authListener = state.client.auth.onAuthStateChange(function (event, nextSession) {
                window.setTimeout(function () {
                    handleAuthStateChange(nextSession);
                }, 0);
            });
            state.authSubscription = authListener && authListener.data ? authListener.data.subscription : null;
        } catch (error) {
            renderLoggedOut();
            console.debug("[JunxueMy] init failed.");
        }
    }

    onReady(function () {
        normalizeBossAuthLinks();
        bindMobileMessageEntry();

        if (nodes.avatarImg) {
            nodes.avatarImg.addEventListener("error", function () {
                renderEmptyAvatar();
                setAvatarStatus("头像暂时读取失败，已显示默认头像。");
            });
        }

        if (nodes.avatarButton && nodes.avatarInput) {
            nodes.avatarButton.addEventListener("click", function () {
                if (state.avatarUploadInFlight) {
                    return;
                }
                nodes.avatarInput.click();
            });
            nodes.avatarInput.addEventListener("change", function () {
                const file = nodes.avatarInput.files && nodes.avatarInput.files[0];
                if (!file) {
                    return;
                }
                uploadAvatar(file);
            });
        }

        if (nodes.refreshButton) {
            nodes.refreshButton.addEventListener("click", function () {
                refreshAll("状态已刷新。");
            });
        }

        if (nodes.checkinButton) {
            nodes.checkinButton.addEventListener("click", claimCheckin);
        }

        if (nodes.benefitCheckinButton) {
            nodes.benefitCheckinButton.addEventListener("click", claimCheckin);
        }

        nodes.actionNodes.forEach(function (node) {
            node.addEventListener("click", function (event) {
                const interactive = event.target.closest("a,button,input,select,textarea,label");
                const action = node.getAttribute("data-my-action");

                if (interactive && interactive !== node) {
                    return;
                }

                if (!action) {
                    return;
                }

                event.preventDefault();
                if (action === "exchange") {
                    window.location.href = "redeem.html";
                    return;
                }
                openModal(action, node);
            });

            node.addEventListener("keydown", function (event) {
                if (event.key !== "Enter" && event.key !== " ") {
                    return;
                }

                event.preventDefault();
                if (node.getAttribute("data-my-action") === "exchange") {
                    window.location.href = "redeem.html";
                    return;
                }
                openModal(node.getAttribute("data-my-action"), node);
            });
        });

        if (nodes.modal) {
            nodes.modal.addEventListener("click", function (event) {
                const adminMessageItem = event.target.closest("[data-my-admin-message-type][data-my-admin-message-index]");
                if (adminMessageItem) {
                    const messageType = adminMessageItem.getAttribute("data-my-admin-message-type");
                    const index = Number(adminMessageItem.getAttribute("data-my-admin-message-index"));
                    if ((messageType === "orders" || messageType === "redemptions") && Number.isInteger(index) && getAdminMessageItem(messageType, index)) {
                        state.adminMessageDetail = { messageType: messageType, index: index };
                        renderAdminMessageDetail();
                    }
                    return;
                }

                if (event.target.closest("[data-my-admin-message-back]")) {
                    state.adminMessageDetail = null;
                    renderStarlakeMessagesModal(buildMobileMessageItems());
                    return;
                }

                if (event.target.closest("[data-my-message-refresh], [data-my-admin-message-refresh]")) {
                    refreshMessageCenter();
                    return;
                }

                const messageAction = event.target.closest("[data-my-message-action]");
                if (messageAction) {
                    const action = messageAction.getAttribute("data-my-message-action");
                    if (action === "checkin") {
                        console.debug("[star-lake-messages] checkin action clicked");
                        console.debug("[star-lake-messages] close messages before checkin");
                        closeMobileMessagePopup();
                        console.debug("[star-lake-messages] old checkin modal blocked");
                        activateCheckinSection();
                        return;
                    }
                    if (action === "order") {
                        window.location.href = "order.html";
                        return;
                    }
                    if (action === "redemption") {
                        window.location.href = "redeem.html";
                        return;
                    }
                }

                if (event.target === nodes.modal || event.target.closest("[data-my-modal-close]")) {
                    closeMobileMessagePopup();
                    return;
                }

                if (event.target.closest("[data-my-modal-refresh]")) {
                    refreshAll("状态已刷新。");
                    return;
                }

                if (event.target.closest("[data-my-modal-checkin]")) {
                    claimCheckin();
                    return;
                }

                if (event.target.closest("[data-my-modal-avatar]")) {
                    if (state.avatarUploadInFlight) {
                        return;
                    }
                    closeModal();
                    if (nodes.avatarInput) {
                        nodes.avatarInput.click();
                    }
                    return;
                }

                if (event.target.closest("[data-my-message-login]")) {
                    window.location.href = MOBILE_MESSAGE_LOGIN_URL;
                }
            });
        }

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && nodes.modal && !nodes.modal.hidden) {
                closeMobileMessagePopup();
            }
        });

        init();
    });

    window.JunxueMyPage = {
        version: VERSION,
        refresh: refreshAll
    };
}());
