(function () {
    "use strict";

    const VERSION = "20260701-point-redemption-mvp1";
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

    const state = {
        users: [],
        redemptions: [],
        redemptionFilter: "pending",
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

        if (/admin_get_boss_users|admin_adjust_boss_points|admin_set_boss_blocked|admin_set_live_interaction_admin|boss_account_flags|boss_visit_stats|boss_admin_actions|admin_ref|boss_point_redemptions|admin_get_boss_point_redemptions|admin_review_boss_point_redemption|schema cache|function .* does not exist|relation .* does not exist/i.test(message)) {
            return SQL_HINT;
        }

        if (/insufficient points/i.test(message)) {
            return "该用户当前积分不足，不能同意这条兑换申请。";
        }

        if (/redemption already processed|not pending/i.test(message)) {
            return "这条兑换申请已经处理过，不能重复操作。";
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
        $$("[data-admin-action], [data-redemption-action], [data-admin-redemption-filter]").forEach(function (button) {
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

    async function refreshAll(doneMessage) {
        await loadUsers(doneMessage);
        if (state.hasAdminAccess) {
            await loadRedemptions();
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

    function closeModal() {
        nodes.modal.hidden = true;
        nodes.modalForm.reset();
        nodes.modalForm.removeAttribute("data-mode");
        nodes.modalForm.removeAttribute("data-boss-index");
        nodes.modalForm.removeAttribute("data-redemption-index");
        nodes.modalForm.removeAttribute("data-review-status");
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

    async function submitModal(event) {
        event.preventDefault();

        if (nodes.modalForm.dataset.mode === "redemption") {
            await submitRedemptionReview();
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

        nodes.modal.addEventListener("click", function (event) {
            if (event.target === nodes.modal || event.target.closest("[data-modal-close]")) {
                closeModal();
            }
        });
        nodes.modalForm.addEventListener("submit", submitModal);
    }

    async function init() {
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
