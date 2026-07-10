(function () {
    "use strict";

    const VERSION = "20260710-starlake-messages-render-fix1";
    const BOSS_LOGIN_URL = "boss-register.html?mode=login&redirect=index";
    const BOSS_REGISTER_URL = "boss-register.html?mode=register&redirect=index";
    const AVATAR_BUCKET = "boss-avatars";
    const MAX_AVATAR_BYTES = 1024 * 1024;
    const AVATAR_SIZE = 512;
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

    const state = {
        client: null,
        session: null,
        userHash: "",
        profile: null,
        avatarPath: "",
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
        actionNodes: $$("[data-my-action]"),
        mobileMessageLink: $("[data-my-mobile-message]"),
        mobileMessageBadge: $("[data-my-mobile-message-badge]"),
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

    function isMobileViewport() {
        if (!window.matchMedia) {
            return (window.innerWidth || document.documentElement.clientWidth || 0) <= 768;
        }

        return window.matchMedia("(hover: none), (max-width: 768px)").matches;
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

    function simpleHash(value) {
        let hash = 2166136261;
        const source = String(value || "");

        for (let index = 0; index < source.length; index += 1) {
            hash ^= source.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }

        return (hash >>> 0).toString(36);
    }

    async function getSafeUserHash(userId) {
        const value = String(userId || "");

        if (window.crypto && window.crypto.subtle && window.TextEncoder) {
            try {
                const bytes = new TextEncoder().encode(value);
                const digest = await window.crypto.subtle.digest("SHA-256", bytes);
                return Array.prototype.map.call(new Uint8Array(digest).slice(0, 10), function (byte) {
                    return byte.toString(16).padStart(2, "0");
                }).join("");
            } catch (error) {}
        }

        return simpleHash(value);
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

    async function renderCloudAvatar(path) {
        if (!path) {
            renderEmptyAvatar();
            return;
        }

        try {
            const response = await state.client.storage.from(AVATAR_BUCKET).createSignedUrl(path, 3600);

            if (response.error || !response.data || !response.data.signedUrl) {
                throw response.error || new Error("signed-url-missing");
            }

            if (nodes.avatarImg) {
                nodes.avatarImg.src = response.data.signedUrl;
                nodes.avatarImg.hidden = false;
            }
            setHidden(nodes.avatarPlaceholder, true);
        } catch (error) {
            renderEmptyAvatar();
            setAvatarStatus(isAvatarSetupError(error) ? "头像上传功能还需要完成云端配置。" : "头像暂时读取失败，请稍后再试。");
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

    function sortMessageRecords(records) {
        return records.map(function (record, index) {
            return {
                index: index,
                record: record,
                time: getOrderMessageTimestamp(record)
            };
        }).sort(function (left, right) {
            if (left.time || right.time) {
                return right.time - left.time;
            }
            return left.index - right.index;
        }).slice(0, MOBILE_MESSAGE_LIMIT).map(function (item) {
            return item.record;
        });
    }

    function renderMessageCards(records) {
        const rows = sortMessageRecords(records || []).filter(function (record) {
            return !!ORDER_MESSAGE_LABELS[record && record.order_status];
        });

        if (!rows.length) {
            return "<div class=\"my-message-empty\">暂无消息</div>";
        }

        return "<div class=\"my-message-list\">" + rows.map(function (record) {
            const status = record.order_status || "pending";
            const paymentStatus = record.manual_payment_status || "";
            const time = formatDateTime(getOrderMessageTime(record));
            const meta = [
                record.game_type || record.service_type ? escapeHtml([record.game_type, record.service_type].filter(Boolean).join(" / ")) : "",
                time ? escapeHtml(time) : "",
                paymentStatus && MANUAL_PAYMENT_LABELS[paymentStatus] ? escapeHtml(MANUAL_PAYMENT_LABELS[paymentStatus]) : "",
                record.voucher_title ? "兑换券：" + escapeHtml(record.voucher_title) : ""
            ].filter(Boolean).map(function (item) {
                return "<span class=\"my-message-pill\">" + item + "</span>";
            }).join("");
            const adminNote = record.admin_note ? "<div class=\"my-message-note\">管理员批注：" + escapeHtml(record.admin_note) + "</div>" : "";
            const paymentNote = record.payment_note ? "<div class=\"my-message-note\">人工转账备注：" + escapeHtml(record.payment_note) + "</div>" : "";

            return [
                "<article class=\"my-message-card\">",
                    "<strong>" + escapeHtml(ORDER_MESSAGE_LABELS[status]) + "</strong>",
                    meta ? "<div class=\"my-message-meta\">" + meta + "</div>" : "",
                    adminNote,
                    paymentNote,
                "</article>"
            ].join("");
        }).join("") + "</div>";
    }

    function renderMessagesModal(body, subtitle, actions) {
        setModalContent(
            "星湖消息",
            subtitle || "这里会显示最近的预约状态提醒。",
            body || "<div class=\"my-message-empty\">暂无消息</div>",
            actions || "<button class=\"my-button my-button--primary\" type=\"button\" data-my-modal-close>返回</button>"
        );
    }

    function renderMessageLoginModal() {
        renderMessagesModal(
            "<div class=\"my-message-empty\">登录老板账号后，可以查看预约消息。</div>",
            "登录后会按你的预约订单生成轻量提醒。",
            "<button class=\"my-button\" type=\"button\" data-my-message-login>去登录</button><button class=\"my-button my-button--primary\" type=\"button\" data-my-modal-close>返回</button>"
        );
    }

    function renderMessageLoadingModal() {
        setModalContent(
            "星湖消息",
            "星湖有新动静，会轻轻提醒你。",
            renderMobileMessageLoading(),
            "<button class=\"my-button my-button--primary\" type=\"button\" data-my-modal-close>返回</button>"
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
            messages.push({
                key: "checkin-missing-" + getShanghaiDate(),
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
                        record.redeem_type || "",
                        record.quantity || "",
                        record.cost_points || "",
                        record.created_at || "",
                        recordTime || "",
                        record.status || ""
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
        const badgeCount = Math.max(unreadCount, hasActiveCheckinReminder ? 1 : 0);

        if (nodes.mobileMessageBadge) {
            nodes.mobileMessageBadge.hidden = badgeCount === 0;
            nodes.mobileMessageBadge.textContent = badgeCount > 9 ? "9+" : String(badgeCount);
        }
        if (nodes.mobileMessageLink) {
            nodes.mobileMessageLink.classList.toggle("has-unread", badgeCount > 0);
            nodes.mobileMessageLink.setAttribute("aria-label", badgeCount > 0 ? "消息，有未读提醒" : "消息");
        }

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

    function renderMobileMessageEmpty() {
        return "<div class=\"my-message-empty\"><strong>星湖暂时很安静</strong><span>新的预约、兑换和签到提醒，会在这里慢慢出现。</span></div>";
    }

    function renderMobileMessageLoading() {
        return "<div class=\"my-message-empty is-loading\"><strong>正在同步星湖消息...</strong><span>正在读取预约、兑换和每日签到提醒。</span></div>";
    }

    function renderMobileMessageFailure() {
        return "<div class=\"my-message-empty is-warning\"><strong>星湖消息暂时没有同步完成</strong><span>已显示可以确认的提醒，稍后再试一次吧。</span></div>";
    }

    function renderMobileMessagePartialFailure() {
        const failedSources = getMobileMessageFailedSources();
        if (!failedSources.length) {
            return "";
        }
        return "<div class=\"my-message-sync-note\">部分消息同步失败，已显示可以确认的提醒。</div>";
    }

    function renderMobileMessageCards(messages) {
        if (areMobileMessageSourcesLoading()) {
            return renderMobileMessageLoading();
        }

        if (!messages.length) {
            return getMobileMessageFailedSources().length ? renderMobileMessageFailure() : renderMobileMessageEmpty();
        }

        const content = "<div class=\"my-message-list\">" + messages.map(function (message) {
            const time = formatDateTime(getOrderMessageTime(message));
            const meta = [];
            const notes = [];
            if (message.type === "order") {
                if (message.game_type || message.service_type) {
                    meta.push([message.game_type, message.service_type].filter(Boolean).join(" / "));
                }
                if (ORDER_STATUS_LABELS[message.order_status]) {
                    meta.push(ORDER_STATUS_LABELS[message.order_status]);
                }
                if (MANUAL_PAYMENT_LABELS[message.manual_payment_status]) {
                    meta.push(MANUAL_PAYMENT_LABELS[message.manual_payment_status]);
                }
                if (message.voucher_title) {
                    meta.push("兑换券：" + message.voucher_title);
                }
                if (message.admin_note) {
                    notes.push("管理员批注：" + message.admin_note);
                }
                if (message.payment_note) {
                    notes.push("人工转账备注：" + message.payment_note);
                }
            }
            if (message.type === "redemption") {
                if (message.redeem_type) {
                    meta.push("积分兑换已通过");
                }
                if (message.admin_note) {
                    notes.push("管理员批注：" + message.admin_note);
                }
            }
            if (time) {
                meta.push(time);
            }

            return [
                "<article class=\"my-message-card is-" + escapeHtml(message.type) + "\" data-my-message-key=\"" + escapeHtml(message.key) + "\">",
                    "<div class=\"my-message-card-head\"><strong>" + escapeHtml(message.title) + "</strong><span class=\"my-message-read\">" + (message.read ? "已查看" : "未查看") + "</span></div>",
                    "<p class=\"my-message-copy\">" + escapeHtml(message.description) + "</p>",
                    meta.length ? "<div class=\"my-message-meta\">" + meta.map(function (item) { return "<span class=\"my-message-pill\">" + escapeHtml(item) + "</span>"; }).join("") + "</div>" : "",
                    notes.map(function (note) { return "<div class=\"my-message-note\">" + escapeHtml(note) + "</div>"; }).join(""),
                    "<div class=\"my-message-card-actions\"><button class=\"my-button my-button--primary\" type=\"button\" data-my-message-action=\"" + escapeHtml(message.action) + "\">" + escapeHtml(message.actionLabel) + "</button></div>",
                "</article>"
            ].join("");
        }).join("") + renderMobileMessagePartialFailure() + "</div>";

        return content;
    }

    function renderStarlakeMessagesModal(messages) {
        const renderedMessages = messages || [];
        logMobileMessageDiagnostics(renderedMessages, areMobileMessageSourcesLoading() ? "loading" : "final");
        setModalContent(
            "星湖消息",
            "这里会汇总你的预约进度、兑换结果和每日签到提醒。",
            renderMobileMessageCards(renderedMessages),
            "<button class=\"my-button my-button--primary\" type=\"button\" data-my-modal-close>返回</button>"
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

        if (!nodes.modal || state.mobileMessageInFlight) {
            return;
        }

        if (!state.client || !state.session || !state.session.user) {
            renderMessageLoginModal();
            openModal("messages", trigger);
            return;
        }

        state.mobileMessageInFlight = true;
        renderMessageLoadingModal();
        openModal("messages", trigger);

        try {
            if (state.mobileMessageLoadPromise) {
                await state.mobileMessageLoadPromise;
            }
            renderStarlakeMessagesModal(markMobileMessagesRead(buildMobileMessageItems()));
        } finally {
            state.mobileMessageInFlight = false;
        }
    }

    function closeMobileMessagePopup() {
        closeModal();
    }

    async function openMobileMessages(trigger) {
        return openMobileMessagePopup(trigger);
    }

    function handleMobileMessageEvent(event, trigger) {
        if (!trigger) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (!isMobileViewport()) {
            console.warn("[my-mobile-message] ignored: non-mobile viewport.");
            return;
        }

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
            return "请选择头像图片。";
        }

        if (!AVATAR_TYPES[file.type]) {
            return "头像只支持 JPG、PNG 或 WebP 图片。";
        }

        if (file.size > MAX_AVATAR_BYTES) {
            return "头像图片请控制在 1MB 以内。";
        }

        return "";
    }

    function loadImageFromFile(file) {
        return new Promise(function (resolve, reject) {
            const url = URL.createObjectURL(file);
            const image = new Image();

            image.onload = function () {
                URL.revokeObjectURL(url);
                resolve(image);
            };
            image.onerror = function () {
                URL.revokeObjectURL(url);
                reject(new Error("image-load-failed"));
            };
            image.src = url;
        });
    }

    function canvasToBlob(canvas, type, quality) {
        return new Promise(function (resolve, reject) {
            canvas.toBlob(function (blob) {
                if (!blob) {
                    reject(new Error("canvas-blob-failed"));
                    return;
                }

                resolve(blob);
            }, type, quality);
        });
    }

    async function compressAvatar(file) {
        const image = await loadImageFromFile(file);
        const canvas = document.createElement("canvas");
        const size = Math.min(AVATAR_SIZE, Math.max(1, Math.min(image.naturalWidth || image.width, image.naturalHeight || image.height)));
        const sourceSize = Math.min(image.naturalWidth || image.width, image.naturalHeight || image.height);
        const sourceX = Math.max(0, ((image.naturalWidth || image.width) - sourceSize) / 2);
        const sourceY = Math.max(0, ((image.naturalHeight || image.height) - sourceSize) / 2);

        canvas.width = size;
        canvas.height = size;
        canvas.getContext("2d").drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);

        let blob = await canvasToBlob(canvas, "image/webp", 0.86);
        if (blob.size > MAX_AVATAR_BYTES) {
            blob = await canvasToBlob(canvas, "image/webp", 0.72);
        }

        if (blob.size > MAX_AVATAR_BYTES) {
            throw new Error("compressed-avatar-too-large");
        }

        return blob;
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
        const validationMessage = validateAvatarFile(file);
        if (validationMessage) {
            setAvatarStatus(validationMessage);
            return;
        }

        setBusy(nodes.avatarButton, true, "上传中...");
        setAvatarStatus("正在压缩并上传头像...");

        let nextPath = "";

        try {
            const blob = await compressAvatar(file);
            nextPath = "avatars/" + state.userHash + "/avatar-" + Date.now() + ".webp";
            const uploadResponse = await state.client.storage.from(AVATAR_BUCKET).upload(nextPath, blob, {
                cacheControl: "3600",
                contentType: "image/webp",
                upsert: true
            });

            if (uploadResponse.error) {
                throw uploadResponse.error;
            }

            const oldPath = state.avatarPath;
            await saveAvatarPath(nextPath);

            if (oldPath && oldPath !== nextPath) {
                state.client.storage.from(AVATAR_BUCKET).remove([oldPath]).catch(function () {});
            }

            await renderCloudAvatar(nextPath);
            setAvatarStatus("头像已上传到云端。");
        } catch (error) {
            if (nextPath) {
                state.client.storage.from(AVATAR_BUCKET).remove([nextPath]).catch(function () {});
            }

            setAvatarStatus(isAvatarSetupError(error) ? "头像上传功能还需要完成云端配置。" : "头像上传失败，请稍后再试。");
        } finally {
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
            loadMobileMessageRedemptions()
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
                return;
            }

            state.userHash = await getSafeUserHash(state.session.user.id);
            loadMobileMessageReadState();
            renderLoggedInShell();
            renderProfile(null);
            await refreshAll();
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
                nodes.avatarInput.click();
            });
            nodes.avatarInput.addEventListener("change", function () {
                uploadAvatar(nodes.avatarInput.files && nodes.avatarInput.files[0]);
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
                const messageAction = event.target.closest("[data-my-message-action]");
                if (messageAction) {
                    const action = messageAction.getAttribute("data-my-message-action");
                    if (action === "checkin") {
                        closeModal();
                        openModal("checkin", messageAction);
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
