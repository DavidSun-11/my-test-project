(function () {
    "use strict";

    const VERSION = "20260707-paid-order-mvp1";
    const LOGIN_TEXT = "请先登录老板账号。";
    const SQL_HINT = "服务预约功能需要先执行 Supabase 第 17 节 SQL。";
    const VOUCHER_SQL_HINT = "兑换券功能需要先完成积分兑换数据库升级。";

    const ORDER_STATUS_LABELS = {
        pending: "待确认",
        confirmed: "已确认预约",
        need_reschedule: "需要改期",
        rejected: "已拒绝",
        completed: "已完成",
        cancelled: "已取消"
    };

    const MANUAL_PAYMENT_LABELS = {
        manual_unpaid: "待人工转账",
        manual_paid: "已人工确认转账",
        not_required: "无需补款",
        voucher_reserved: "已锁定兑换券",
        voucher_used: "已使用兑换券",
        partial_voucher: "已用兑换券，仍需补款"
    };

    const OPEN_STATUSES = ["pending", "confirmed", "need_reschedule"];

    const state = {
        client: null,
        session: null,
        records: [],
        vouchers: [],
        submitting: false
    };

    const nodes = {};

    function $(selector) {
        return document.querySelector(selector);
    }

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function setText(node, value) {
        if (node) {
            node.textContent = value == null ? "" : String(value);
        }
    }

    function setStatus(message, type) {
        if (!nodes.status) {
            return;
        }

        nodes.status.textContent = message || "";
        nodes.status.className = "order-status" + (type ? " is-" + type : "");
    }

    function getFriendlyError(error) {
        const message = error && error.message ? error.message : "";

        if (/boss_service_vouchers|get_my_available_service_vouchers|create_boss_service_voucher|boss_point_redemptions/i.test(message)) {
            return VOUCHER_SQL_HINT;
        }

        if (/boss_paid_orders|submit_boss_paid_order|get_my_boss_paid_orders|schema cache|function .* does not exist|relation .* does not exist/i.test(message)) {
            return SQL_HINT;
        }

        if (/open order limit/i.test(message)) {
            return "待处理预约最多 10 个，请先等待已有预约处理。";
        }

        if (/voucher/i.test(message)) {
            return "这张兑换券暂时不可用，可能已被锁定或使用。";
        }

        if (/scheduled date|date/i.test(message)) {
            return "预约日期不能早于今天。";
        }

        if (/contact/i.test(message)) {
            return "联系方式需要填写，且最多 120 字。";
        }

        if (/user note/i.test(message)) {
            return "用户备注最多 300 字，请稍微精简一下。";
        }

        if (/duration/i.test(message)) {
            return "请选择正确的预计时长。";
        }

        if (/not authenticated|JWT|auth/i.test(message)) {
            return LOGIN_TEXT;
        }

        return "服务预约暂时没有提交成功，请稍后再试。";
    }

    function formatTime(value) {
        if (!value) {
            return "暂无";
        }

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return "暂无";
        }

        return date.toLocaleString("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function formatDate(value) {
        if (!value) {
            return "未选择";
        }

        const date = new Date(value + "T00:00:00");
        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return date.toLocaleDateString("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        });
    }

    function formatMoney(cents) {
        if (cents == null || cents === "") {
            return "待确认";
        }

        const value = Number(cents);
        if (!Number.isFinite(value)) {
            return "待确认";
        }

        return (value / 100).toLocaleString("zh-CN", {
            minimumFractionDigits: value % 100 === 0 ? 0 : 2,
            maximumFractionDigits: 2
        }) + " 元";
    }

    function todayIso() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        return year + "-" + month + "-" + day;
    }

    function setSubmitting(isSubmitting) {
        state.submitting = !!isSubmitting;
        if (nodes.submit) {
            nodes.submit.disabled = !!isSubmitting;
            nodes.submit.textContent = isSubmitting ? "提交中..." : "提交服务预约";
        }
    }

    async function loadProfile() {
        try {
            const response = await state.client
                .from("boss_profiles")
                .select("display_name")
                .eq("user_id", state.session.user.id)
                .maybeSingle();

            const displayName = response && response.data && response.data.display_name;
            setText(nodes.displayName, displayName || "星湖用户");
        } catch (error) {
            setText(nodes.displayName, "星湖用户");
        }
    }

    function renderVouchers() {
        const vouchers = state.vouchers || [];
        setText(nodes.voucherCount, String(vouchers.length));

        if (!nodes.voucher) {
            return;
        }

        nodes.voucher.innerHTML = '<option value="">不使用兑换券</option>' + vouchers.map(function (voucher) {
            return '<option value="' + escapeHtml(voucher.voucher_ref) + '">' + escapeHtml(voucher.voucher_title || "服务兑换券") + '</option>';
        }).join("");

        renderVoucherDetail();
    }

    function renderVoucherDetail() {
        if (!nodes.voucherDetail || !nodes.voucher) {
            return;
        }

        const value = nodes.voucher.value;
        if (!value) {
            nodes.voucherDetail.textContent = state.vouchers.length ? "不使用兑换券，管理员确认后会告知是否需要人工转账。" : "当前暂无可用兑换券。";
            return;
        }

        const voucher = state.vouchers.find(function (item) {
            return String(item.voucher_ref) === String(value);
        });

        if (!voucher) {
            nodes.voucherDetail.textContent = "这张兑换券暂时不可用，请重新选择。";
            return;
        }

        nodes.voucherDetail.textContent = [
            voucher.voucher_title || "服务兑换券",
            voucher.game_type ? "游戏：" + voucher.game_type : "",
            voucher.service_type ? "服务：" + voucher.service_type : "",
            voucher.quantity ? "数量：" + voucher.quantity : "",
            voucher.expires_at ? "有效期至：" + formatTime(voucher.expires_at) : "暂无固定有效期"
        ].filter(Boolean).join(" / ");
    }

    async function loadVouchers() {
        try {
            const response = await state.client.rpc("get_my_available_service_vouchers", {});
            if (response.error) {
                throw response.error;
            }

            state.vouchers = Array.isArray(response.data) ? response.data : [];
            renderVouchers();
        } catch (error) {
            state.vouchers = [];
            renderVouchers();
            if (nodes.voucherDetail) {
                nodes.voucherDetail.textContent = getFriendlyError(error);
            }
        }
    }

    function renderRecords() {
        const records = state.records || [];
        const openCount = records.filter(function (record) {
            return OPEN_STATUSES.indexOf(record.order_status) !== -1;
        }).length;

        setText(nodes.openCount, String(openCount));

        if (!records.length) {
            nodes.records.innerHTML = "";
            nodes.recordEmpty.hidden = false;
            return;
        }

        nodes.recordEmpty.hidden = true;
        nodes.records.innerHTML = records.map(function (record) {
            const status = record.order_status || "pending";
            const manualStatus = record.manual_payment_status || "manual_unpaid";
            const orderRef = String(record.order_ref || "").slice(0, 8) || "--------";
            const scheduleText = formatDate(record.scheduled_date) + (record.scheduled_time ? " " + record.scheduled_time : "");
            const adminNote = record.admin_note || "暂无管理员批注。";
            const paymentNote = record.payment_note || "";

            return [
                '<article class="order-record-card">',
                    '<strong>',
                        escapeHtml(record.game_type || "服务预约") + ' / ' + escapeHtml(record.service_type || "服务"),
                        '<span class="order-pill is-' + escapeHtml(status) + '">' + escapeHtml(ORDER_STATUS_LABELS[status] || status) + '</span>',
                        '<span class="order-pill is-' + escapeHtml(manualStatus) + '">' + escapeHtml(MANUAL_PAYMENT_LABELS[manualStatus] || manualStatus) + '</span>',
                    '</strong>',
                    '<div class="order-record-meta">',
                        '<span>预约编号：#' + escapeHtml(orderRef) + '</span>',
                        '<span>预约时间：' + escapeHtml(scheduleText) + '</span>',
                        '<span>预计时长：' + escapeHtml(record.duration_hours || "--") + ' 小时</span>',
                        '<span>联系方式：' + escapeHtml(record.contact_info || "暂无") + '</span>',
                        '<span>最终需人工转账：' + escapeHtml(formatMoney(record.final_amount_cents)) + '</span>',
                        '<span>提交时间：' + escapeHtml(formatTime(record.created_at)) + '</span>',
                    '</div>',
                    record.voucher_title ? '<div class="order-note">已选择兑换券：' + escapeHtml(record.voucher_title) + '</div>' : '',
                    record.user_note ? '<div class="order-note">我的备注：' + escapeHtml(record.user_note) + '</div>' : '',
                    '<div class="order-note">管理员批注：' + escapeHtml(adminNote) + '</div>',
                    paymentNote ? '<div class="order-note">人工转账备注：' + escapeHtml(paymentNote) + '</div>' : '',
                '</article>'
            ].join("");
        }).join("");
    }

    async function loadRecords(message) {
        try {
            const response = await state.client.rpc("get_my_boss_paid_orders", {});
            if (response.error) {
                throw response.error;
            }

            state.records = Array.isArray(response.data) ? response.data : [];
            renderRecords();
            setStatus(message || "预约记录已同步。", "good");
        } catch (error) {
            setStatus(getFriendlyError(error), "warning");
        }
    }

    function validateForm() {
        const scheduledDate = nodes.date ? nodes.date.value : "";
        const duration = Number(nodes.duration ? nodes.duration.value : 0);
        const contact = String(nodes.contact ? nodes.contact.value : "").trim();
        const note = String(nodes.note ? nodes.note.value : "").trim();

        if (!scheduledDate || scheduledDate < todayIso()) {
            return "预约日期不能早于今天。";
        }

        if (!Number.isFinite(duration) || duration <= 0 || duration > 24) {
            return "请选择正确的预计时长。";
        }

        if (!contact) {
            return "请填写微信 / QQ / 其它联系方式。";
        }

        if (contact.length > 120) {
            return "联系方式最多 120 字，请稍微精简一下。";
        }

        if (note.length > 300) {
            return "用户备注最多 300 字，请稍微精简一下。";
        }

        return "";
    }

    async function submitOrder(event) {
        event.preventDefault();

        if (state.submitting) {
            return;
        }

        const validationMessage = validateForm();
        if (validationMessage) {
            setStatus(validationMessage, "warning");
            return;
        }

        const params = {
            p_game_type: nodes.game.value,
            p_service_type: nodes.service.value,
            p_scheduled_date: nodes.date.value,
            p_scheduled_time: String(nodes.time.value || "").trim() || null,
            p_duration_hours: Number(nodes.duration.value),
            p_contact_info: String(nodes.contact.value || "").trim(),
            p_user_note: String(nodes.note.value || "").trim() || null,
            p_voucher_ref: nodes.voucher && nodes.voucher.value ? nodes.voucher.value : null
        };

        setSubmitting(true);
        setStatus("正在提交服务预约...", "neutral");

        try {
            const response = await state.client.rpc("submit_boss_paid_order", params);
            if (response.error) {
                throw response.error;
            }

            nodes.form.reset();
            setupDateMin();
            await Promise.all([loadVouchers(), loadRecords("服务预约已提交，等待管理员确认。")]);
        } catch (error) {
            setStatus(getFriendlyError(error), "warning");
        } finally {
            setSubmitting(false);
        }
    }

    function setupDateMin() {
        if (!nodes.date) {
            return;
        }

        const minDate = todayIso();
        nodes.date.min = minDate;
        if (!nodes.date.value || nodes.date.value < minDate) {
            nodes.date.value = minDate;
        }
    }

    async function init() {
        nodes.status = $("[data-order-status]");
        nodes.loggedOut = $("[data-order-logged-out]");
        nodes.app = $("[data-order-app]");
        nodes.account = $("[data-order-account]");
        nodes.displayName = $("[data-order-display-name]");
        nodes.voucherCount = $("[data-order-voucher-count]");
        nodes.openCount = $("[data-order-open-count]");
        nodes.form = $("[data-order-form]");
        nodes.game = $("[data-order-game]");
        nodes.service = $("[data-order-service]");
        nodes.date = $("[data-order-date]");
        nodes.time = $("[data-order-time]");
        nodes.duration = $("[data-order-duration]");
        nodes.contact = $("[data-order-contact]");
        nodes.note = $("[data-order-note]");
        nodes.voucher = $("[data-order-voucher]");
        nodes.voucherDetail = $("[data-order-voucher-detail]");
        nodes.submit = $("[data-order-submit]");
        nodes.records = $("[data-order-records]");
        nodes.recordEmpty = $("[data-order-record-empty]");

        setupDateMin();

        if (nodes.voucher) {
            nodes.voucher.addEventListener("change", renderVoucherDetail);
        }

        if (nodes.form) {
            nodes.form.addEventListener("submit", submitOrder);
        }

        try {
            state.client = await window.JunxueSupabaseClient.getClient();
            const sessionResponse = await state.client.auth.getSession();
            state.session = sessionResponse.data ? sessionResponse.data.session : null;

            if (!state.session || !state.session.user) {
                nodes.loggedOut.hidden = false;
                nodes.app.hidden = true;
                nodes.account.hidden = true;
                setStatus(LOGIN_TEXT, "warning");
                return;
            }

            nodes.loggedOut.hidden = true;
            nodes.app.hidden = false;
            nodes.account.hidden = false;
            await loadProfile();
            await Promise.all([loadVouchers(), loadRecords("可以提交新的服务预约。")]);
        } catch (error) {
            setStatus(getFriendlyError(error), "warning");
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }

    window.JunxueOrder = {
        version: VERSION
    };
}());
