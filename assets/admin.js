(function () {
    "use strict";

    const VERSION = "20260716-my-admin-message-center1";
    const SQL_HINT = "管理员后台需要先执行数据库升级 SQL。";
    const NO_PERMISSION_TEXT = "你没有权限访问这个后台。";
    const LOGIN_TEXT = "请先登录管理员账号。";

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

    const STATUS_LABELS = {
        pending: "待审核",
        approved: "已同意",
        rejected: "已拒绝"
    };

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

    const SCORE_GUESS_CHOICES = ["铜牌", "银牌", "金牌", "顶级", "无"];

    const SCORE_SETTLEMENT_LABELS = {
        pending: "待结算",
        settled: "已结算",
        no_winner: "无人猜中"
    };

    const state = {
        users: [],
        redemptions: [],
        paidOrders: [],
        scoreGuessSessions: [],
        redemptionFilter: "pending",
        paidOrderFilter: "pending",
        deepLink: null,
        deepLinkApplied: false,
        hasAdminAccess: false,
        client: null,
        session: null
    };

    const nodes = {};

    function $(selector) {
        return document.querySelector(selector);
    }

    function $$(selector) {
        return Array.prototype.slice.call(document.querySelectorAll(selector));
    }

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function formatNumber(value) {
        const num = Number(value);
        return Number.isFinite(num) ? String(num) : "0";
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
            return "暂无";
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

    function parseAdminDeepLink() {
        const params = new URLSearchParams(window.location.search);
        const panel = params.get("panel") || "";
        const status = params.get("status") || "";
        const allowedStatuses = {
            orders: ["pending", "confirmed", "need_reschedule", "rejected", "completed", "cancelled", "all"],
            redemptions: ["pending", "approved", "rejected", "all"]
        };

        if (!Object.prototype.hasOwnProperty.call(allowedStatuses, panel) || allowedStatuses[panel].indexOf(status) === -1) {
            return null;
        }
        return { panel: panel, status: status };
    }

    function focusAdminDeepLink(deepLink) {
        if (!deepLink || !state.hasAdminAccess) {
            return;
        }
        const panel = deepLink.panel === "orders" ? nodes.paidOrderPanel : nodes.redemptionPanel;
        if (!panel || panel.hidden) {
            return;
        }
        const heading = panel.querySelector(".admin-panel-title");
        window.requestAnimationFrame(function () {
            panel.scrollIntoView({ behavior: "smooth", block: "start" });
            if (heading) {
                heading.setAttribute("tabindex", "-1");
                heading.focus({ preventScroll: true });
            }
        });
    }

    function maskEmail(email) {
        const value = String(email || "").trim();
        const at = value.indexOf("@");

        if (!value) {
            return "已登录账号";
        }

        if (at <= 0) {
            return value.length <= 2 ? value.charAt(0) + "*" : value.charAt(0) + "***" + value.charAt(value.length - 1);
        }

        const name = value.slice(0, at);
        const domain = value.slice(at + 1) || "邮箱";
        const maskedName = name.length <= 1 ? name + "***" : name.charAt(0) + "***" + name.charAt(name.length - 1);

        return maskedName + "@" + domain;
    }

    function getFriendlyError(error) {
        const message = error && error.message ? error.message : "";

        if (/admin_get_boss_users|admin_adjust_boss_points|admin_set_boss_blocked|admin_set_live_interaction_admin|boss_account_flags|boss_visit_stats|boss_admin_actions|admin_ref|boss_point_redemptions|admin_get_boss_point_redemptions|admin_review_boss_point_redemption|boss_paid_orders|boss_service_vouchers|admin_get_boss_paid_orders|admin_update_boss_paid_order|live_score_guess|point_ledger|admin_get_live_score_guess_settlement|admin_set_live_score_guess_result|schema cache|function .* does not exist|relation .* does not exist/i.test(message)) {
            return SQL_HINT;
        }

        if (/insufficient points/i.test(message)) {
            return "该用户当前积分不足，不能同意这条兑换申请。";
        }

        if (/redemption already processed/i.test(message)) {
            return "这条兑换申请已经处理过，不能重复操作。";
        }

        if (/order already finalized/i.test(message)) {
            return "这条预约订单已经是终态，不能重复处理。";
        }

        if (/invalid order transition/i.test(message)) {
            return "当前预约状态不能执行这个操作。";
        }

        if (/admin note required for reschedule/i.test(message)) {
            return "选择需要改期时，请在管理员批注里写清楚改期说明。";
        }

        if (/admin note/i.test(message)) {
            return "管理员批注最多 200 字，请稍微精简一下。";
        }

        if (/not authorized|permission denied|row-level security|JWT|auth/i.test(message)) {
            return NO_PERMISSION_TEXT;
        }

        if (/blocked user cannot be admin/i.test(message)) {
            return "已拉黑用户不能设为管理员。";
        }

        if (/cannot block yourself/i.test(message)) {
            return "不能拉黑自己的管理员账号。";
        }

        if (/cannot revoke your own admin role/i.test(message)) {
            return "不能取消自己的管理员身份。";
        }

        if (/cannot revoke the last admin/i.test(message)) {
            return "不能取消最后一个管理员。";
        }

        if (/points amount/i.test(message)) {
            return "积分数量必须是 1 到 10000 的正整数。";
        }

        if (/already settled|no_winner|not pending/i.test(message)) {
            return "这场评分竞猜已经结算过，不能重复结算。";
        }

        if (/session must be closed|open session/i.test(message)) {
            return "请先在直播互动里结束竞猜，再公布正确结果并结算。";
        }

        return "操作暂时没有成功，请稍后再试。";
    }

    function setStatus(message, type) {
        if (!nodes.status) {
            return;
        }

        nodes.status.textContent = message || "";
        nodes.status.className = "admin-status" + (type ? " is-" + type : "");
    }

    function setBusy(isBusy) {
        $$("[data-admin-action], [data-redemption-action], [data-admin-redemption-filter], [data-paid-order-action], [data-admin-paid-order-filter], [data-score-guess-action], [data-admin-score-guess-refresh]").forEach(function (button) {
            button.disabled = !!isBusy;
        });
        if (nodes.refresh) {
            nodes.refresh.disabled = !!isBusy;
        }
    }

    function renderAccess(message, type) {
        nodes.tableWrap.hidden = true;
        if (nodes.redemptionPanel) {
            nodes.redemptionPanel.hidden = true;
        }
        if (nodes.paidOrderPanel) {
            nodes.paidOrderPanel.hidden = true;
        }
        if (nodes.scoreGuessPanel) {
            nodes.scoreGuessPanel.hidden = true;
        }
        nodes.empty.hidden = false;
        nodes.empty.innerHTML = [
            '<strong>' + escapeHtml(message) + '</strong>',
            message === LOGIN_TEXT ? '<a class="admin-button admin-button--primary" href="index.html?bossLogin=1">去登录</a>' : '',
            '<a class="admin-button" href="index.html">返回首页</a>'
        ].join("");
        setStatus(message, type || "warning");
    }

    function renderRows() {
        if (!state.users.length) {
            nodes.tableBody.innerHTML = "";
            nodes.tableWrap.hidden = true;
            nodes.empty.hidden = false;
            nodes.empty.innerHTML = '<strong>暂无老板账号记录。</strong>';
            return;
        }

        nodes.empty.hidden = true;
        nodes.tableWrap.hidden = false;
        nodes.tableBody.innerHTML = state.users.map(function (user, index) {
            const blocked = !!user.is_blocked;
            const admin = !!user.is_admin;

            return [
                '<tr>',
                    '<td data-label="老板昵称"><strong>' + escapeHtml(user.display_name || "老板用户") + '</strong></td>',
                    '<td data-label="邮箱">' + escapeHtml(user.email_masked || "未绑定邮箱") + '</td>',
                    '<td data-label="积分">' + formatNumber(user.points) + '</td>',
                    '<td data-label="总签到">' + formatNumber(user.total_checkins) + '</td>',
                    '<td data-label="当前连续">' + formatNumber(user.current_streak) + '</td>',
                    '<td data-label="本月累计">' + formatNumber(user.monthly_checkins) + '</td>',
                    '<td data-label="访问次数">' + formatNumber(user.visit_count) + '</td>',
                    '<td data-label="最近访问">' + escapeHtml(formatTime(user.last_seen_at)) + '</td>',
                    '<td data-label="状态"><span class="admin-pill ' + (blocked ? "is-blocked" : "is-good") + '">' + (blocked ? "已拉黑" : "正常") + '</span></td>',
                    '<td data-label="权限"><span class="admin-pill ' + (admin ? "is-admin" : "") + '">' + (admin ? "管理员" : "普通用户") + '</span></td>',
                    '<td data-label="操作">',
                        '<div class="admin-actions">',
                            '<button type="button" data-admin-action="points" data-index="' + index + '">加积分</button>',
                            '<button type="button" data-admin-action="block" data-index="' + index + '">' + (blocked ? "解除拉黑" : "拉黑") + '</button>',
                            '<button type="button" data-admin-action="admin" data-index="' + index + '">' + (admin ? "取消管理员" : "设为管理员") + '</button>',
                        '</div>',
                    '</td>',
                '</tr>'
            ].join("");
        }).join("");
    }

    function renderRedemptions() {
        if (!nodes.redemptionPanel) {
            return;
        }

        nodes.redemptionPanel.hidden = false;
        const records = state.redemptions || [];

        $$("[data-admin-redemption-filter]").forEach(function (button) {
            const active = button.dataset.adminRedemptionFilter === state.redemptionFilter;
            button.classList.toggle("admin-button--primary", active);
        });

        if (!records.length) {
            nodes.redemptionBody.innerHTML = "";
            nodes.redemptionTableWrap.hidden = true;
            nodes.redemptionEmpty.hidden = false;
            nodes.redemptionEmpty.innerHTML = '<strong>当前筛选下暂无兑换申请。</strong>';
            return;
        }

        nodes.redemptionTableWrap.hidden = false;
        nodes.redemptionEmpty.hidden = true;
        nodes.redemptionBody.innerHTML = records.map(function (record, index) {
            const status = record.status || "pending";
            const pending = status === "pending";
            const typeLabel = TYPE_LABELS[record.redeem_type] || record.redeem_type || "兑换服务";
            const rankLabel = record.rank_range ? (RANK_LABELS[record.rank_range] || record.rank_range) : "无需选择";
            const adminNote = record.admin_note || "暂无";
            const userNote = record.user_note || "暂无";

            return [
                '<tr>',
                    '<td data-label="老板昵称"><strong>' + escapeHtml(record.display_name || "老板用户") + '</strong></td>',
                    '<td data-label="脱敏邮箱">' + escapeHtml(record.email_masked || "未绑定邮箱") + '</td>',
                    '<td data-label="兑换类型">' + escapeHtml(typeLabel) + '<br><span class="admin-pill">' + escapeHtml(rankLabel) + '</span></td>',
                    '<td data-label="数量">' + escapeHtml(record.quantity) + '</td>',
                    '<td data-label="消耗积分">' + formatNumber(record.cost_points) + '</td>',
                    '<td data-label="状态"><span class="admin-pill is-' + escapeHtml(status) + '">' + escapeHtml(STATUS_LABELS[status] || status) + '</span></td>',
                    '<td data-label="用户备注">' + escapeHtml(userNote) + '</td>',
                    '<td data-label="管理员批注">' + escapeHtml(adminNote) + '</td>',
                    '<td data-label="提交时间">' + escapeHtml(formatTime(record.created_at)) + '</td>',
                    '<td data-label="操作">',
                        pending ? '<div class="admin-actions"><button type="button" data-redemption-action="approved" data-index="' + index + '">同意</button><button type="button" data-redemption-action="rejected" data-index="' + index + '">拒绝</button></div>' : '<span class="admin-pill">已处理</span>',
                    '</td>',
                '</tr>'
            ].join("");
        }).join("");
    }

    function renderPaidOrders() {
        if (!nodes.paidOrderPanel) {
            return;
        }

        nodes.paidOrderPanel.hidden = false;
        const records = state.paidOrders || [];

        $$("[data-admin-paid-order-filter]").forEach(function (button) {
            const active = button.dataset.adminPaidOrderFilter === state.paidOrderFilter;
            button.classList.toggle("admin-button--primary", active);
        });

        if (!records.length) {
            nodes.paidOrderBody.innerHTML = "";
            nodes.paidOrderTableWrap.hidden = true;
            nodes.paidOrderEmpty.hidden = false;
            nodes.paidOrderEmpty.innerHTML = '<strong>当前筛选下暂无预约订单。</strong>';
            return;
        }

        nodes.paidOrderTableWrap.hidden = false;
        nodes.paidOrderEmpty.hidden = true;
        nodes.paidOrderBody.innerHTML = records.map(function (record, index) {
            const status = record.order_status || "pending";
            const manualStatus = record.manual_payment_status || "manual_unpaid";
            const isFinal = ["rejected", "completed", "cancelled"].indexOf(status) !== -1;
            const orderRef = String(record.order_ref || "").slice(0, 8) || "--------";
            const scheduleText = formatDate(record.scheduled_date) + (record.scheduled_time ? " " + record.scheduled_time : "");
            const voucherText = record.voucher_title ? record.voucher_title + (record.voucher_status ? " / " + record.voucher_status : "") : "未使用兑换券";

            return [
                '<tr>',
                    '<td data-label="预约用户"><strong>' + escapeHtml(record.display_name || "星湖用户") + '</strong><br><span class="admin-pill">#' + escapeHtml(orderRef) + '</span></td>',
                    '<td data-label="脱敏邮箱">' + escapeHtml(record.email_masked || "未绑定邮箱") + '</td>',
                    '<td data-label="服务内容">' + escapeHtml(record.game_type || "服务") + '<br><span class="admin-pill">' + escapeHtml(record.service_type || "预约") + ' / ' + escapeHtml(record.duration_hours || "--") + ' 小时</span></td>',
                    '<td data-label="预约时间">' + escapeHtml(scheduleText) + '<br><span class="admin-pill">' + escapeHtml(formatTime(record.created_at)) + '</span></td>',
                    '<td data-label="状态"><span class="admin-pill is-' + escapeHtml(status) + '">' + escapeHtml(ORDER_STATUS_LABELS[status] || status) + '</span></td>',
                    '<td data-label="人工转账"><span class="admin-pill is-' + escapeHtml(manualStatus) + '">' + escapeHtml(MANUAL_PAYMENT_LABELS[manualStatus] || manualStatus) + '</span><br>' + escapeHtml(formatMoney(record.final_amount_cents)) + '</td>',
                    '<td data-label="兑换券">' + escapeHtml(voucherText) + '</td>',
                    '<td data-label="备注">' + escapeHtml(record.user_note || "暂无") + '<br><span class="admin-pill">' + escapeHtml(record.contact_info || "暂无联系方式") + '</span></td>',
                    '<td data-label="管理员批注">' + escapeHtml(record.admin_note || "暂无") + (record.payment_note ? '<br><span class="admin-pill">' + escapeHtml(record.payment_note) + '</span>' : '') + '</td>',
                    '<td data-label="操作">',
                        isFinal ? '<span class="admin-pill">已处理</span>' : [
                            '<div class="admin-actions">',
                                status === "pending" || status === "need_reschedule" ? '<button type="button" data-paid-order-action="confirmed" data-index="' + index + '">确认</button>' : '',
                                status === "pending" ? '<button type="button" data-paid-order-action="need_reschedule" data-index="' + index + '">需要改期</button>' : '',
                                status === "pending" ? '<button type="button" data-paid-order-action="rejected" data-index="' + index + '">拒绝</button>' : '',
                                status === "confirmed" ? '<button type="button" data-paid-order-action="completed" data-index="' + index + '">标记完成</button>' : '',
                                '<button type="button" data-paid-order-action="cancelled" data-index="' + index + '">取消</button>',
                            '</div>'
                        ].join(""),
                    '</td>',
                '</tr>'
            ].join("");
        }).join("");
    }

    function getScoreGuessShortRef(id) {
        return String(id || "").slice(0, 8) || "--------";
    }

    function renderScoreGuessSessions() {
        if (!nodes.scoreGuessPanel) {
            return;
        }

        nodes.scoreGuessPanel.hidden = false;
        const sessions = state.scoreGuessSessions || [];

        if (!sessions.length) {
            nodes.scoreGuessBody.innerHTML = "";
            nodes.scoreGuessTableWrap.hidden = true;
            nodes.scoreGuessEmpty.hidden = false;
            nodes.scoreGuessEmpty.innerHTML = '<strong>暂无评分竞猜场次。</strong>';
            return;
        }

        nodes.scoreGuessTableWrap.hidden = false;
        nodes.scoreGuessEmpty.hidden = true;
        nodes.scoreGuessBody.innerHTML = sessions.map(function (session, index) {
            const status = session.status || "closed";
            const settlementStatus = session.settlement_status || "pending";
            const canSettle = status === "closed" && settlementStatus === "pending";
            const choiceOptions = SCORE_GUESS_CHOICES.map(function (choice) {
                return '<option value="' + escapeHtml(choice) + '">' + escapeHtml(choice) + '</option>';
            }).join("");

            return [
                '<tr>',
                    '<td data-label="场次"><strong>#' + escapeHtml(getScoreGuessShortRef(session.id)) + '</strong><br><span class="admin-pill">' + escapeHtml(formatTime(session.created_at)) + '</span></td>',
                    '<td data-label="状态"><span class="admin-pill ' + (status === "open" ? "is-good" : "is-admin") + '">' + (status === "open" ? "进行中" : "已结束") + '</span></td>',
                    '<td data-label="结算"><span class="admin-pill ' + (settlementStatus === "pending" ? "is-pending" : (settlementStatus === "settled" ? "is-approved" : "is-rejected")) + '">' + escapeHtml(SCORE_SETTLEMENT_LABELS[settlementStatus] || settlementStatus) + '</span></td>',
                    '<td data-label="正确结果">' + escapeHtml(session.correct_choice || "未公布") + '</td>',
                    '<td data-label="输方池">' + formatNumber(session.total_losing_pool) + '</td>',
                    '<td data-label="赢家投入">' + formatNumber(session.total_winning_stake) + '</td>',
                    '<td data-label="结束时间">' + escapeHtml(formatTime(session.ended_at)) + '</td>',
                    '<td data-label="操作">',
                        '<div class="admin-actions">',
                            canSettle ? '<label class="admin-field"><span>正确结果</span><select data-score-guess-choice="' + index + '">' + choiceOptions + '</select></label><button type="button" data-score-guess-action="settle" data-index="' + index + '">公布结果 / 结算积分</button>' : '',
                            '<button type="button" data-score-guess-action="details" data-index="' + index + '">查看明细</button>',
                        '</div>',
                    '</td>',
                '</tr>'
            ].join("");
        }).join("");
    }

    async function loadUsers(doneMessage) {
        setBusy(true);
        setStatus("正在读取老板账号列表...", "neutral");

        try {
            const response = await state.client.rpc("admin_get_boss_users", {});

            if (response.error) {
                throw response.error;
            }

            state.users = Array.isArray(response.data) ? response.data : [];
            state.hasAdminAccess = true;
            renderRows();
            setStatus(doneMessage || "列表已刷新。", "good");
        } catch (error) {
            state.hasAdminAccess = false;
            const message = getFriendlyError(error);
            renderAccess(message, message === NO_PERMISSION_TEXT ? "warning" : "warning");
        } finally {
            setBusy(false);
        }
    }

    async function loadRedemptions(doneMessage) {
        if (!nodes.redemptionPanel) {
            return;
        }

        setBusy(true);
        if (nodes.redemptionEmpty) {
            nodes.redemptionEmpty.hidden = false;
            nodes.redemptionEmpty.innerHTML = '<strong>正在读取兑换申请...</strong>';
        }

        try {
            const filter = state.redemptionFilter === "all" ? null : state.redemptionFilter;
            const response = await state.client.rpc("admin_get_boss_point_redemptions", {
                p_status: filter
            });

            if (response.error) {
                throw response.error;
            }

            state.redemptions = Array.isArray(response.data) ? response.data : [];
            renderRedemptions();
            if (doneMessage) {
                setStatus(doneMessage, "good");
            }
        } catch (error) {
            nodes.redemptionTableWrap.hidden = true;
            nodes.redemptionEmpty.hidden = false;
            nodes.redemptionEmpty.innerHTML = '<strong>' + escapeHtml(getFriendlyError(error)) + '</strong>';
        } finally {
            setBusy(false);
        }
    }

    async function loadPaidOrders(doneMessage) {
        if (!nodes.paidOrderPanel) {
            return;
        }

        setBusy(true);
        if (nodes.paidOrderEmpty) {
            nodes.paidOrderEmpty.hidden = false;
            nodes.paidOrderEmpty.innerHTML = '<strong>正在读取预约订单...</strong>';
        }

        try {
            const filter = state.paidOrderFilter === "all" ? null : state.paidOrderFilter;
            const response = await state.client.rpc("admin_get_boss_paid_orders", {
                p_status: filter
            });

            if (response.error) {
                throw response.error;
            }

            state.paidOrders = Array.isArray(response.data) ? response.data : [];
            renderPaidOrders();
            if (doneMessage) {
                setStatus(doneMessage, "good");
            }
        } catch (error) {
            nodes.paidOrderTableWrap.hidden = true;
            nodes.paidOrderEmpty.hidden = false;
            nodes.paidOrderEmpty.innerHTML = '<strong>' + escapeHtml(getFriendlyError(error)) + '</strong>';
        } finally {
            setBusy(false);
        }
    }

    async function loadScoreGuessSessions(doneMessage) {
        if (!nodes.scoreGuessPanel) {
            return;
        }

        setBusy(true);
        if (nodes.scoreGuessEmpty) {
            nodes.scoreGuessEmpty.hidden = false;
            nodes.scoreGuessEmpty.innerHTML = '<strong>正在读取评分竞猜场次...</strong>';
        }

        try {
            const response = await state.client
                .from("live_score_guess_sessions")
                .select("id,title,status,created_at,ended_at,correct_choice,settlement_status,total_losing_pool,total_winning_stake,settled_at")
                .order("created_at", { ascending: false })
                .limit(12);

            if (response.error) {
                throw response.error;
            }

            state.scoreGuessSessions = Array.isArray(response.data) ? response.data : [];
            renderScoreGuessSessions();
            if (doneMessage) {
                setStatus(doneMessage, "good");
            }
        } catch (error) {
            nodes.scoreGuessTableWrap.hidden = true;
            nodes.scoreGuessEmpty.hidden = false;
            nodes.scoreGuessEmpty.innerHTML = '<strong>' + escapeHtml(getFriendlyError(error)) + '</strong>';
        } finally {
            setBusy(false);
        }
    }

    async function refreshAll(doneMessage) {
        await loadUsers(doneMessage);
        if (state.hasAdminAccess) {
            const deepLink = !state.deepLinkApplied ? state.deepLink : null;
            if (deepLink) {
                if (deepLink.panel === "orders") {
                    state.paidOrderFilter = deepLink.status;
                } else {
                    state.redemptionFilter = deepLink.status;
                }
            }
            await loadRedemptions();
            await loadPaidOrders();
            await loadScoreGuessSessions();
            if (deepLink) {
                state.deepLinkApplied = true;
                focusAdminDeepLink(deepLink);
            }
        }
    }

    function openPointsModal(user) {
        nodes.modal.hidden = false;
        nodes.modalTitle.textContent = "为 " + (user.display_name || "老板用户") + " 增加积分";
        nodes.modalBody.innerHTML = [
            '<label class="admin-field"><span>积分数量</span><input name="amount" type="number" min="1" max="10000" step="1" placeholder="1-10000" required></label>',
            '<label class="admin-field"><span>原因</span><textarea name="reason" maxlength="120" placeholder="可选，最多 120 字"></textarea></label>',
            '<div class="admin-modal-actions">',
                '<button class="admin-button admin-button--primary" type="submit">确认加积分</button>',
                '<button class="admin-button" type="button" data-modal-close>取消</button>',
            '</div>'
        ].join("");
        nodes.modalForm.dataset.mode = "points";
        nodes.modalForm.dataset.bossIndex = String(state.users.indexOf(user));
        nodes.modalBody.querySelector("input").focus();
    }

    function openRedemptionModal(record, nextStatus) {
        const title = nextStatus === "approved" ? "同意兑换申请" : "拒绝兑换申请";
        const typeLabel = TYPE_LABELS[record.redeem_type] || record.redeem_type || "兑换服务";

        nodes.modal.hidden = false;
        nodes.modalTitle.textContent = title + "：" + (record.display_name || "老板用户");
        nodes.modalBody.innerHTML = [
            '<div class="admin-field"><span>申请内容</span><strong>' + escapeHtml(typeLabel) + ' / ' + escapeHtml(record.quantity) + ' / ' + formatNumber(record.cost_points) + ' 积分</strong></div>',
            '<label class="admin-field"><span>管理员批注（最多 200 字）</span><textarea name="admin_note" maxlength="200" placeholder="例如：这天可能打不了，可以换一天。"></textarea></label>',
            '<div class="admin-modal-actions">',
                '<button class="admin-button admin-button--primary" type="submit">' + (nextStatus === "approved" ? "确认同意" : "确认拒绝") + '</button>',
                '<button class="admin-button" type="button" data-modal-close>取消</button>',
            '</div>'
        ].join("");
        nodes.modalForm.dataset.mode = "redemption";
        nodes.modalForm.dataset.redemptionIndex = String(state.redemptions.indexOf(record));
        nodes.modalForm.dataset.reviewStatus = nextStatus;
        nodes.modalBody.querySelector("textarea").focus();
    }

    function getPaidOrderActionLabel(nextStatus) {
        return {
            confirmed: "确认预约",
            need_reschedule: "需要改期",
            rejected: "拒绝预约",
            completed: "标记完成",
            cancelled: "取消预约"
        }[nextStatus] || "处理预约";
    }

    function getDefaultManualPaymentStatus(record, nextStatus) {
        if ((nextStatus === "rejected" || nextStatus === "cancelled") && record.voucher_title) {
            return "not_required";
        }

        if (nextStatus === "completed" && record.voucher_title) {
            return "voucher_used";
        }

        if (nextStatus === "confirmed" && record.voucher_title) {
            return "partial_voucher";
        }

        if (nextStatus === "confirmed") {
            return "manual_unpaid";
        }

        return record.manual_payment_status || "manual_unpaid";
    }

    function openPaidOrderModal(record, nextStatus) {
        const title = getPaidOrderActionLabel(nextStatus);
        const scheduleText = formatDate(record.scheduled_date) + (record.scheduled_time ? " " + record.scheduled_time : "");
        const defaultManualStatus = getDefaultManualPaymentStatus(record, nextStatus);
        const currentAmount = record.final_amount_cents == null ? NaN : Number(record.final_amount_cents);
        const amountValue = Number.isFinite(currentAmount) ? String(currentAmount / 100) : "";

        nodes.modal.hidden = false;
        nodes.modalTitle.textContent = title + "：" + (record.display_name || "星湖用户");
        nodes.modalBody.innerHTML = [
            '<div class="admin-field"><span>预约内容</span><strong>' + escapeHtml(record.game_type || "服务") + ' / ' + escapeHtml(record.service_type || "预约") + ' / ' + escapeHtml(scheduleText) + '</strong></div>',
            '<div class="admin-field"><span>联系方式</span><strong>' + escapeHtml(record.contact_info || "暂无") + '</strong></div>',
            '<div class="admin-field"><span>兑换券</span><strong>' + escapeHtml(record.voucher_title || "未使用兑换券") + '</strong></div>',
            '<label class="admin-field"><span>管理员批注（最多 200 字）</span><textarea name="admin_note" maxlength="200" placeholder="' + (nextStatus === "need_reschedule" ? "请写清楚建议改到哪天或哪个时间段。" : "例如：已确认档期，稍后联系人工转账。") + '">' + escapeHtml(record.admin_note || "") + '</textarea></label>',
            '<label class="admin-field"><span>最终需人工转账金额（元，可留空）</span><input name="final_amount_yuan" type="number" min="0" step="0.01" value="' + escapeHtml(amountValue) + '" placeholder="例如 88"></label>',
            '<label class="admin-field"><span>人工转账状态</span><select name="manual_payment_status">',
                Object.keys(MANUAL_PAYMENT_LABELS).map(function (status) {
                    return '<option value="' + escapeHtml(status) + '"' + (status === defaultManualStatus ? " selected" : "") + '>' + escapeHtml(MANUAL_PAYMENT_LABELS[status]) + '</option>';
                }).join(""),
            '</select></label>',
            '<label class="admin-field"><span>人工转账备注（最多 200 字）</span><textarea name="payment_note" maxlength="200" placeholder="例如：已微信确认转账，或无需补款。">' + escapeHtml(record.payment_note || "") + '</textarea></label>',
            '<div class="admin-modal-actions">',
                '<button class="admin-button admin-button--primary" type="submit">' + escapeHtml(title) + '</button>',
                '<button class="admin-button" type="button" data-modal-close>取消</button>',
            '</div>'
        ].join("");
        nodes.modalForm.dataset.mode = "paid-order";
        nodes.modalForm.dataset.paidOrderIndex = String(state.paidOrders.indexOf(record));
        nodes.modalForm.dataset.orderStatus = nextStatus;
        nodes.modalBody.querySelector("textarea").focus();
    }

    function closeModal() {
        nodes.modal.hidden = true;
        nodes.modalForm.reset();
        nodes.modalForm.removeAttribute("data-mode");
        nodes.modalForm.removeAttribute("data-boss-index");
        nodes.modalForm.removeAttribute("data-redemption-index");
        nodes.modalForm.removeAttribute("data-review-status");
        nodes.modalForm.removeAttribute("data-paid-order-index");
        nodes.modalForm.removeAttribute("data-order-status");
        nodes.modalBody.innerHTML = "";
    }

    async function submitPoints() {
        const index = Number(nodes.modalForm.dataset.bossIndex);
        const user = state.users[index];
        const amount = Number(nodes.modalForm.elements.amount.value);
        const reason = String(nodes.modalForm.elements.reason.value || "").trim().slice(0, 120);

        if (!user) {
            closeModal();
            return;
        }

        if (!Number.isInteger(amount) || amount < 1 || amount > 10000) {
            setStatus("积分数量必须是 1 到 10000 的正整数。", "warning");
            return;
        }

        setBusy(true);
        try {
            const response = await state.client.rpc("admin_adjust_boss_points", {
                p_boss_ref: user.boss_ref,
                p_amount: amount,
                p_reason: reason || null
            });

            if (response.error) {
                throw response.error;
            }

            closeModal();
            await refreshAll("已为 " + (user.display_name || "老板用户") + " 增加 " + amount + " 积分。");
        } catch (error) {
            setStatus(getFriendlyError(error), "warning");
        } finally {
            setBusy(false);
        }
    }

    async function submitRedemptionReview() {
        const index = Number(nodes.modalForm.dataset.redemptionIndex);
        const record = state.redemptions[index];
        const nextStatus = nodes.modalForm.dataset.reviewStatus;
        const adminNote = String(nodes.modalForm.elements.admin_note.value || "").trim();

        if (!record) {
            closeModal();
            return;
        }

        if (adminNote.length > 200) {
            setStatus("管理员批注最多 200 字，请稍微精简一下。", "warning");
            return;
        }

        setBusy(true);
        try {
            const response = await state.client.rpc("admin_review_boss_point_redemption", {
                p_redeem_ref: record.redeem_ref,
                p_status: nextStatus,
                p_admin_note: adminNote || null
            });

            if (response.error) {
                throw response.error;
            }

            closeModal();
            await loadRedemptions(nextStatus === "approved" ? "已同意兑换申请并完成积分处理。" : "已拒绝兑换申请，未扣除积分。");
            await loadUsers();
        } catch (error) {
            setStatus(getFriendlyError(error), "warning");
        } finally {
            setBusy(false);
        }
    }

    async function submitPaidOrderUpdate() {
        const index = Number(nodes.modalForm.dataset.paidOrderIndex);
        const record = state.paidOrders[index];
        const nextStatus = nodes.modalForm.dataset.orderStatus;
        const adminNote = String(nodes.modalForm.elements.admin_note.value || "").trim();
        const paymentNote = String(nodes.modalForm.elements.payment_note.value || "").trim();
        const amountRaw = String(nodes.modalForm.elements.final_amount_yuan.value || "").trim();
        const manualPaymentStatus = String(nodes.modalForm.elements.manual_payment_status.value || "").trim();
        let finalAmountCents = null;

        if (!record) {
            closeModal();
            return;
        }

        if (adminNote.length > 200) {
            setStatus("管理员批注最多 200 字，请稍微精简一下。", "warning");
            return;
        }

        if (nextStatus === "need_reschedule" && !adminNote) {
            setStatus("选择需要改期时，请在管理员批注里写清楚改期说明。", "warning");
            return;
        }

        if (paymentNote.length > 200) {
            setStatus("人工转账备注最多 200 字，请稍微精简一下。", "warning");
            return;
        }

        if (amountRaw) {
            const amountYuan = Number(amountRaw);
            if (!Number.isFinite(amountYuan) || amountYuan < 0) {
                setStatus("最终需人工转账金额不能为负数。", "warning");
                return;
            }
            finalAmountCents = Math.round(amountYuan * 100);
        }

        setBusy(true);
        try {
            const response = await state.client.rpc("admin_update_boss_paid_order", {
                p_order_ref: record.order_ref,
                p_order_status: nextStatus,
                p_admin_note: adminNote || null,
                p_final_amount_cents: finalAmountCents,
                p_manual_payment_status: manualPaymentStatus || null,
                p_payment_note: paymentNote || null
            });

            if (response.error) {
                throw response.error;
            }

            closeModal();
            await loadPaidOrders("预约订单已更新。");
        } catch (error) {
            setStatus(getFriendlyError(error), "warning");
        } finally {
            setBusy(false);
        }
    }

    async function showScoreGuessDetails(session) {
        if (!session) {
            return;
        }

        setBusy(true);
        try {
            const response = await state.client.rpc("admin_get_live_score_guess_settlement", {
                p_session_id: session.id
            });

            if (response.error) {
                throw response.error;
            }

            const rows = Array.isArray(response.data) ? response.data : [];
            nodes.modal.hidden = false;
            nodes.modalTitle.textContent = "评分竞猜明细 #" + getScoreGuessShortRef(session.id);
            nodes.modalBody.innerHTML = rows.length ? [
                '<div class="admin-table-wrap">',
                    '<table class="admin-table">',
                        '<thead><tr><th>昵称</th><th>选择</th><th>投入</th><th>结果</th><th>返还</th><th>奖励</th><th>时间</th></tr></thead>',
                        '<tbody>',
                            rows.map(function (row) {
                                return [
                                    '<tr>',
                                        '<td data-label="昵称"><strong>' + escapeHtml(row.display_name || "星湖用户") + '</strong><br><span class="admin-pill">#' + escapeHtml(row.vote_ref || "----") + '</span></td>',
                                        '<td data-label="选择">' + escapeHtml(row.choice || "暂无") + '</td>',
                                        '<td data-label="投入">' + formatNumber(row.staked_points) + '</td>',
                                        '<td data-label="结果">' + (row.is_correct === null || typeof row.is_correct === "undefined" ? "待结算" : (row.is_correct ? "猜对" : "未中")) + '</td>',
                                        '<td data-label="返还">' + formatNumber(row.settled_points) + '</td>',
                                        '<td data-label="奖励">' + formatNumber(row.settlement_bonus) + '</td>',
                                        '<td data-label="时间">' + escapeHtml(formatTime(row.created_at)) + '</td>',
                                    '</tr>'
                                ].join("");
                            }).join(""),
                        '</tbody>',
                    '</table>',
                '</div>',
                '<div class="admin-modal-actions"><button class="admin-button" type="button" data-modal-close>关闭</button></div>'
            ].join("") : [
                '<div class="admin-empty"><strong>这场竞猜暂无投票明细。</strong></div>',
                '<div class="admin-modal-actions"><button class="admin-button" type="button" data-modal-close>关闭</button></div>'
            ].join("");
            nodes.modalForm.dataset.mode = "score-guess-details";
        } catch (error) {
            setStatus(getFriendlyError(error), "warning");
        } finally {
            setBusy(false);
        }
    }

    async function settleScoreGuess(session, correctChoice) {
        if (!session || SCORE_GUESS_CHOICES.indexOf(correctChoice) === -1) {
            setStatus("请选择正确结果。", "warning");
            return;
        }

        if (session.status !== "closed") {
            setStatus("请先结束竞猜，再进行结算。", "warning");
            return;
        }

        if ((session.settlement_status || "pending") !== "pending") {
            setStatus("这场评分竞猜已经结算过，不能重复结算。", "warning");
            return;
        }

        const confirmed = window.confirm("确认公布正确结果为「" + correctChoice + "」并结算积分吗？\n\n结算后不可重复结算；MVP 第一版不支持撤销，如果选错需要后续人工处理。");
        if (!confirmed) {
            return;
        }

        setBusy(true);
        try {
            const response = await state.client.rpc("admin_set_live_score_guess_result", {
                p_session_id: session.id,
                p_correct_choice: correctChoice
            });

            if (response.error) {
                throw response.error;
            }

            await loadScoreGuessSessions("评分竞猜已经公布结果并完成积分结算。");
            await loadUsers();
        } catch (error) {
            setStatus(getFriendlyError(error), "warning");
        } finally {
            setBusy(false);
        }
    }

    async function submitModal(event) {
        event.preventDefault();

        if (nodes.modalForm.dataset.mode === "score-guess-details") {
            closeModal();
            return;
        }

        if (nodes.modalForm.dataset.mode === "redemption") {
            await submitRedemptionReview();
            return;
        }

        if (nodes.modalForm.dataset.mode === "paid-order") {
            await submitPaidOrderUpdate();
            return;
        }

        await submitPoints();
    }

    async function toggleBlocked(user) {
        const nextBlocked = !user.is_blocked;
        const label = user.display_name || "老板用户";

        if (!window.confirm((nextBlocked ? "确认拉黑 " : "确认解除拉黑 ") + label + "？")) {
            return;
        }

        let reason = "";
        if (nextBlocked) {
            reason = window.prompt("请输入拉黑原因（可选，最多 120 字）：", "") || "";
        }

        setBusy(true);
        try {
            const response = await state.client.rpc("admin_set_boss_blocked", {
                p_boss_ref: user.boss_ref,
                p_is_blocked: nextBlocked,
                p_reason: reason.slice(0, 120) || null
            });

            if (response.error) {
                throw response.error;
            }

            await refreshAll((nextBlocked ? "已拉黑 " : "已解除拉黑 ") + label + "。");
        } catch (error) {
            setStatus(getFriendlyError(error), "warning");
        } finally {
            setBusy(false);
        }
    }

    async function toggleAdmin(user) {
        const nextAdmin = !user.is_admin;
        const label = user.display_name || "老板用户";

        if (!window.confirm((nextAdmin ? "确认设为管理员：" : "确认取消管理员：") + label + "？")) {
            return;
        }

        setBusy(true);
        try {
            const response = await state.client.rpc("admin_set_live_interaction_admin", {
                p_boss_ref: user.boss_ref,
                p_is_admin: nextAdmin
            });

            if (response.error) {
                throw response.error;
            }

            await refreshAll((nextAdmin ? "已设为管理员：" : "已取消管理员：") + label + "。");
        } catch (error) {
            setStatus(getFriendlyError(error), "warning");
        } finally {
            setBusy(false);
        }
    }

    function bindEvents() {
        nodes.refresh.addEventListener("click", function () {
            refreshAll("列表已刷新。");
        });

        nodes.tableBody.addEventListener("click", function (event) {
            const button = event.target.closest("[data-admin-action]");
            if (!button) {
                return;
            }

            const user = state.users[Number(button.dataset.index)];
            if (!user) {
                return;
            }

            if (button.dataset.adminAction === "points") {
                openPointsModal(user);
            } else if (button.dataset.adminAction === "block") {
                toggleBlocked(user);
            } else if (button.dataset.adminAction === "admin") {
                toggleAdmin(user);
            }
        });

        if (nodes.redemptionBody) {
            nodes.redemptionBody.addEventListener("click", function (event) {
                const button = event.target.closest("[data-redemption-action]");
                if (!button) {
                    return;
                }

                const record = state.redemptions[Number(button.dataset.index)];
                if (!record) {
                    return;
                }

                openRedemptionModal(record, button.dataset.redemptionAction);
            });
        }

        $$("[data-admin-redemption-filter]").forEach(function (button) {
            button.addEventListener("click", function () {
                state.redemptionFilter = button.dataset.adminRedemptionFilter || "pending";
                loadRedemptions();
            });
        });

        if (nodes.paidOrderBody) {
            nodes.paidOrderBody.addEventListener("click", function (event) {
                const button = event.target.closest("[data-paid-order-action]");
                if (!button) {
                    return;
                }

                const record = state.paidOrders[Number(button.dataset.index)];
                if (!record) {
                    return;
                }

                openPaidOrderModal(record, button.dataset.paidOrderAction);
            });
        }

        $$("[data-admin-paid-order-filter]").forEach(function (button) {
            button.addEventListener("click", function () {
                state.paidOrderFilter = button.dataset.adminPaidOrderFilter || "pending";
                loadPaidOrders();
            });
        });

        if (nodes.scoreGuessRefresh) {
            nodes.scoreGuessRefresh.addEventListener("click", function () {
                loadScoreGuessSessions("评分竞猜场次已刷新。");
            });
        }

        if (nodes.scoreGuessBody) {
            nodes.scoreGuessBody.addEventListener("click", function (event) {
                const button = event.target.closest("[data-score-guess-action]");
                if (!button) {
                    return;
                }

                const index = Number(button.dataset.index);
                const session = state.scoreGuessSessions[index];
                if (!session) {
                    return;
                }

                if (button.dataset.scoreGuessAction === "details") {
                    showScoreGuessDetails(session);
                    return;
                }

                const select = nodes.scoreGuessBody.querySelector('[data-score-guess-choice="' + index + '"]');
                settleScoreGuess(session, select ? select.value : "");
            });
        }

        nodes.modal.addEventListener("click", function (event) {
            if (event.target === nodes.modal || event.target.closest("[data-modal-close]")) {
                closeModal();
            }
        });
        nodes.modalForm.addEventListener("submit", submitModal);
    }

    async function init() {
        state.deepLink = parseAdminDeepLink();
        nodes.status = $("[data-admin-status]");
        nodes.identity = $("[data-admin-identity]");
        nodes.refresh = $("[data-admin-refresh]");
        nodes.tableWrap = $("[data-admin-table-wrap]");
        nodes.tableBody = $("[data-admin-table-body]");
        nodes.empty = $("[data-admin-empty]");
        nodes.redemptionPanel = $("[data-admin-redemption-panel]");
        nodes.redemptionTableWrap = $("[data-admin-redemption-table-wrap]");
        nodes.redemptionBody = $("[data-admin-redemption-body]");
        nodes.redemptionEmpty = $("[data-admin-redemption-empty]");
        nodes.paidOrderPanel = $("[data-admin-paid-order-panel]");
        nodes.paidOrderTableWrap = $("[data-admin-paid-order-table-wrap]");
        nodes.paidOrderBody = $("[data-admin-paid-order-body]");
        nodes.paidOrderEmpty = $("[data-admin-paid-order-empty]");
        nodes.scoreGuessPanel = $("[data-admin-score-guess-panel]");
        nodes.scoreGuessTableWrap = $("[data-admin-score-guess-table-wrap]");
        nodes.scoreGuessBody = $("[data-admin-score-guess-body]");
        nodes.scoreGuessEmpty = $("[data-admin-score-guess-empty]");
        nodes.scoreGuessRefresh = $("[data-admin-score-guess-refresh]");
        nodes.modal = $("[data-admin-modal]");
        nodes.modalForm = $("[data-admin-modal-form]");
        nodes.modalTitle = $("[data-admin-modal-title]");
        nodes.modalBody = $("[data-admin-modal-body]");

        bindEvents();

        try {
            state.client = await window.JunxueSupabaseClient.getClient();
            const sessionResponse = await state.client.auth.getSession();
            state.session = sessionResponse.data ? sessionResponse.data.session : null;

            if (!state.session || !state.session.user) {
                nodes.identity.textContent = "当前未登录";
                renderAccess(LOGIN_TEXT, "warning");
                return;
            }

            nodes.identity.textContent = "当前管理员：" + maskEmail(state.session.user.email);
            await refreshAll();
        } catch (error) {
            setStatus(getFriendlyError(error), "warning");
            renderAccess(SQL_HINT, "warning");
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }

    window.JunxueAdmin = {
        version: VERSION
    };
}());
