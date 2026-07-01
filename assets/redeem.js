(function () {
    "use strict";

    const VERSION = "20260701-point-redemption-mvp1";
    const LOGIN_TEXT = "请先登录老板账号。";
    const SQL_HINT = "积分兑换功能需要先执行 Supabase 第 15 节 SQL。";

    const TYPE_LABELS = {
        king_star: "王者星星",
        king_review: "王者复盘",
        naraka_companion: "永劫无间娱乐陪",
        voice_chat: "语音聊天"
    };

    const RANK_LABELS = {
        below_king: "王者以下",
        king_0_50: "王者 0 - 50 星",
        king_50_80: "王者 50 - 80 星",
        king_80_100: "王者 80 - 100 星",
        king_100_plus: "王者 100 星以上"
    };

    const RANK_COSTS = {
        below_king: 60,
        king_0_50: 80,
        king_50_80: 120,
        king_80_100: 160,
        king_100_plus: 200
    };

    const TYPE_COSTS = {
        king_review: 500,
        naraka_companion: 350,
        voice_chat: 300
    };

    const STATUS_LABELS = {
        pending: "待审核",
        approved: "已同意",
        rejected: "已拒绝"
    };

    const state = {
        client: null,
        session: null,
        records: [],
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
        nodes.status.className = "redeem-status" + (type ? " is-" + type : "");
    }

    function getFriendlyError(error) {
        const message = error && error.message ? error.message : "";

        if (/boss_point_redemptions|submit_boss_point_redemption|get_my_boss_point_redemptions|schema cache|function .* does not exist|relation .* does not exist/i.test(message)) {
            return SQL_HINT;
        }

        if (/pending redemption limit/i.test(message)) {
            return "待审核申请最多 5 个，请先等待已有申请处理。";
        }

        if (/invalid redemption type/i.test(message)) {
            return "请选择可兑换的服务类型。";
        }

        if (/invalid rank range/i.test(message)) {
            return "请选择正确的王者段位区间。";
        }

        if (/quantity/i.test(message)) {
            return "数量必须是 1 到 50 的正整数。";
        }

        if (/user note/i.test(message)) {
            return "用户备注最多 300 字，请稍微精简一下。";
        }

        if (/not authenticated|JWT|auth/i.test(message)) {
            return LOGIN_TEXT;
        }

        return "兑换申请暂时没有提交成功，请稍后再试。";
    }

    function formatTime(value) {
        if (!value) {
            return "暂未处理";
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return "暂未处理";
        }
        return date.toLocaleString("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function normalizeQuantity() {
        const value = Number(nodes.quantity ? nodes.quantity.value : 0);
        if (!Number.isInteger(value) || value < 1 || value > 50) {
            return null;
        }
        return value;
    }

    function calculateEstimate() {
        const type = nodes.type ? nodes.type.value : "king_star";
        const rank = nodes.rank ? nodes.rank.value : "below_king";
        const quantity = normalizeQuantity();

        if (!quantity) {
            return null;
        }

        if (type === "king_star") {
            return (RANK_COSTS[rank] || 0) * quantity;
        }

        return (TYPE_COSTS[type] || 0) * quantity;
    }

    function updateTypeUi() {
        const isKingStar = nodes.type && nodes.type.value === "king_star";

        if (nodes.rankField) {
            nodes.rankField.hidden = !isKingStar;
        }

        if (nodes.quantityLabel) {
            if (isKingStar) {
                nodes.quantityLabel.textContent = "兑换数量（星星数量，1-50）";
            } else if (nodes.type.value === "voice_chat") {
                nodes.quantityLabel.textContent = "兑换数量（半小时次数，1-50）";
            } else {
                nodes.quantityLabel.textContent = "兑换数量（小时数，1-50）";
            }
        }

        const estimate = calculateEstimate();
        setText(nodes.estimate, estimate == null ? "--" : String(estimate));
    }

    function setSubmitting(isSubmitting) {
        state.submitting = !!isSubmitting;
        if (nodes.submit) {
            nodes.submit.disabled = !!isSubmitting;
            nodes.submit.textContent = isSubmitting ? "提交中..." : "提交兑换申请";
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
            setText(nodes.displayName, displayName || "老板用户");
        } catch (error) {
            setText(nodes.displayName, "老板用户");
        }
    }

    async function loadPoints() {
        try {
            const response = await state.client.rpc("get_boss_checkin_status", { p_month: null });
            if (response.error) {
                throw response.error;
            }
            const row = Array.isArray(response.data) ? response.data[0] : response.data;
            const points = row && (row.total_points != null ? row.total_points : row.points);
            setText(nodes.points, points != null ? points : "0");
        } catch (error) {
            setText(nodes.points, "暂未开启");
        }
    }

    function renderRecords() {
        const records = state.records || [];
        const pendingCount = records.filter(function (record) {
            return record.status === "pending";
        }).length;

        setText(nodes.pendingCount, String(pendingCount));

        if (!records.length) {
            nodes.records.innerHTML = "";
            nodes.recordEmpty.hidden = false;
            return;
        }

        nodes.recordEmpty.hidden = true;
        nodes.records.innerHTML = records.map(function (record) {
            const status = record.status || "pending";
            const typeLabel = TYPE_LABELS[record.redeem_type] || "兑换服务";
            const rankLabel = record.rank_range ? (RANK_LABELS[record.rank_range] || record.rank_range) : "无需选择";
            const adminNote = record.admin_note ? escapeHtml(record.admin_note) : "暂无管理员批注。";

            return [
                '<article class="redeem-record-card">',
                    '<strong>' + escapeHtml(typeLabel) + ' <span class="redeem-pill is-' + escapeHtml(status) + '">' + escapeHtml(STATUS_LABELS[status] || status) + '</span></strong>',
                    '<div class="redeem-record-meta">',
                        '<span>段位 / 区间：' + escapeHtml(rankLabel) + '</span>',
                        '<span>数量：' + escapeHtml(record.quantity) + '</span>',
                        '<span>预计消耗：' + escapeHtml(record.cost_points) + ' 积分</span>',
                        '<span>提交时间：' + escapeHtml(formatTime(record.created_at)) + '</span>',
                    '</div>',
                    record.user_note ? '<div class="redeem-note">我的备注：' + escapeHtml(record.user_note) + '</div>' : '',
                    '<div class="redeem-note">管理员批注：' + adminNote + '</div>',
                '</article>'
            ].join("");
        }).join("");
    }

    async function loadRecords(message) {
        try {
            const response = await state.client.rpc("get_my_boss_point_redemptions", {});
            if (response.error) {
                throw response.error;
            }

            state.records = Array.isArray(response.data) ? response.data : [];
            renderRecords();
            setStatus(message || "兑换记录已同步。", "good");
        } catch (error) {
            setStatus(getFriendlyError(error), "warning");
        }
    }

    function validateForm() {
        const quantity = normalizeQuantity();
        const note = String(nodes.note ? nodes.note.value : "").trim();

        if (!quantity) {
            return "数量必须是 1 到 50 的正整数。";
        }

        if (note.length > 300) {
            return "用户备注最多 300 字，请稍微精简一下。";
        }

        if (nodes.type.value === "king_star" && !RANK_COSTS[nodes.rank.value]) {
            return "请选择正确的王者段位区间。";
        }

        if (!TYPE_LABELS[nodes.type.value]) {
            return "请选择可兑换的服务类型。";
        }

        return "";
    }

    async function submitRedemption(event) {
        event.preventDefault();

        if (state.submitting) {
            return;
        }

        const validationMessage = validateForm();
        if (validationMessage) {
            setStatus(validationMessage, "warning");
            return;
        }

        const type = nodes.type.value;
        const params = {
            p_redeem_type: type,
            p_rank_range: type === "king_star" ? nodes.rank.value : null,
            p_quantity: normalizeQuantity(),
            p_user_note: String(nodes.note.value || "").trim() || null
        };

        setSubmitting(true);
        setStatus("正在提交兑换申请...", "neutral");

        try {
            const response = await state.client.rpc("submit_boss_point_redemption", params);
            if (response.error) {
                throw response.error;
            }

            nodes.form.reset();
            updateTypeUi();
            await loadRecords("兑换申请已提交，等待管理员审核。");
        } catch (error) {
            setStatus(getFriendlyError(error), "warning");
        } finally {
            setSubmitting(false);
        }
    }

    async function init() {
        nodes.status = $("[data-redeem-status]");
        nodes.loggedOut = $("[data-redeem-logged-out]");
        nodes.app = $("[data-redeem-app]");
        nodes.account = $("[data-redeem-account]");
        nodes.displayName = $("[data-redeem-display-name]");
        nodes.points = $("[data-redeem-points]");
        nodes.pendingCount = $("[data-redeem-pending-count]");
        nodes.form = $("[data-redeem-form]");
        nodes.type = $("[data-redeem-type]");
        nodes.rankField = $("[data-redeem-rank-field]");
        nodes.rank = $("[data-redeem-rank]");
        nodes.quantity = $("[data-redeem-quantity]");
        nodes.quantityLabel = $("[data-redeem-quantity-label]");
        nodes.note = $("[data-redeem-note]");
        nodes.estimate = $("[data-redeem-estimate]");
        nodes.submit = $("[data-redeem-submit]");
        nodes.records = $("[data-redeem-records]");
        nodes.recordEmpty = $("[data-redeem-record-empty]");

        nodes.type.addEventListener("change", updateTypeUi);
        nodes.rank.addEventListener("change", updateTypeUi);
        nodes.quantity.addEventListener("input", updateTypeUi);
        nodes.form.addEventListener("submit", submitRedemption);
        updateTypeUi();

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
            await Promise.all([loadProfile(), loadPoints()]);
            await loadRecords("可以提交新的兑换申请。");
        } catch (error) {
            setStatus(getFriendlyError(error), "warning");
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }

    window.JunxueRedeem = {
        version: VERSION,
        calculateEstimate: calculateEstimate
    };
}());
