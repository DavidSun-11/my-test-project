(function () {
    "use strict";

    const SQL_HINT = "管理员后台需要先执行数据库升级 SQL。";
    const NO_PERMISSION_TEXT = "你没有权限访问这个后台。";
    const LOGIN_TEXT = "请先登录管理员账号。";

    const state = {
        users: [],
        client: null,
        session: null
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

        if (/admin_get_boss_users|admin_adjust_boss_points|admin_set_boss_blocked|admin_set_live_interaction_admin|boss_account_flags|boss_visit_stats|boss_admin_actions|admin_ref|schema cache|function .* does not exist|relation .* does not exist/i.test(message)) {
            return SQL_HINT;
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
        document.querySelectorAll("[data-admin-action]").forEach(function (button) {
            button.disabled = !!isBusy;
        });
        if (nodes.refresh) {
            nodes.refresh.disabled = !!isBusy;
        }
    }

    function renderAccess(message, type) {
        nodes.tableWrap.hidden = true;
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

    async function loadUsers(doneMessage) {
        setBusy(true);
        setStatus("正在读取老板账号列表...", "neutral");

        try {
            const response = await state.client.rpc("admin_get_boss_users", {});

            if (response.error) {
                throw response.error;
            }

            state.users = Array.isArray(response.data) ? response.data : [];
            renderRows();
            setStatus(doneMessage || "列表已刷新。", "good");
        } catch (error) {
            const message = getFriendlyError(error);
            renderAccess(message, message === NO_PERMISSION_TEXT ? "warning" : "warning");
        } finally {
            setBusy(false);
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
        nodes.modalForm.dataset.bossIndex = String(state.users.indexOf(user));
        nodes.modalBody.querySelector("input").focus();
    }

    function closeModal() {
        nodes.modal.hidden = true;
        nodes.modalForm.reset();
        nodes.modalForm.removeAttribute("data-boss-index");
        nodes.modalBody.innerHTML = "";
    }

    async function submitPoints(event) {
        event.preventDefault();

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
            await loadUsers("已为 " + (user.display_name || "老板用户") + " 增加 " + amount + " 积分。");
        } catch (error) {
            setStatus(getFriendlyError(error), "warning");
        } finally {
            setBusy(false);
        }
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

            await loadUsers((nextBlocked ? "已拉黑 " : "已解除拉黑 ") + label + "。");
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

            await loadUsers((nextAdmin ? "已设为管理员：" : "已取消管理员：") + label + "。");
        } catch (error) {
            setStatus(getFriendlyError(error), "warning");
        } finally {
            setBusy(false);
        }
    }

    function bindEvents() {
        nodes.refresh.addEventListener("click", loadUsers);
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

        nodes.modal.addEventListener("click", function (event) {
            if (event.target === nodes.modal || event.target.closest("[data-modal-close]")) {
                closeModal();
            }
        });
        nodes.modalForm.addEventListener("submit", submitPoints);
    }

    async function init() {
        nodes.status = $("[data-admin-status]");
        nodes.identity = $("[data-admin-identity]");
        nodes.refresh = $("[data-admin-refresh]");
        nodes.tableWrap = $("[data-admin-table-wrap]");
        nodes.tableBody = $("[data-admin-table-body]");
        nodes.empty = $("[data-admin-empty]");
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
            await loadUsers();
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
}());
