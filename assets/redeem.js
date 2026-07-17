(function () {
    "use strict";

    const VERSION = "20260717-redemption-pagination1";
    const LOGIN_TEXT = "请先登录老板账号。";
    const SQL_HINT = "积分兑换功能需要先执行 Supabase 第 15 节 SQL。";
    const ARCHIVE_SQL_HINT = "删除记录功能需要先执行 Supabase 第 19 节 SQL。";
    const PAGINATION_SQL_HINT = "兑换申请分页需要先执行 Supabase 第 20 节 SQL。";
    const INSUFFICIENT_POINTS_TEXT = "当前积分不足，暂时无法提交该兑换申请。";
    const PENDING_LIMIT_TEXT = "待审核申请最多 5 个，请先等待已有申请处理。";
    const RECORDS_PAGE_SIZE = 5;
    const SWIPE_THRESHOLD = 64;

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
        submitting: false,
        balanceLoaded: false,
        currentPoints: 0,
        pendingReservedPoints: 0,
        availablePoints: 0,
        pendingCount: 0,
        currentPage: 1,
        pageSize: RECORDS_PAGE_SIZE,
        totalCount: 0,
        totalPages: 0,
        recordsLoading: false,
        recordsRequestBatch: 0,
        archivingRedeemRefs: new Set(),
        locallyArchivedRedeemRefs: new Set()
    };

    const nodes = {};
    const archiveButtonRecords = new WeakMap();
    let recordsTouchStart = null;

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

    function setBalanceMessage(message, type) {
        if (!nodes.balanceMessage) {
            return;
        }
        nodes.balanceMessage.textContent = message || "";
        nodes.balanceMessage.className = "redeem-balance-message" + (type ? " is-" + type : "");
    }

    function normalizeRpcNumber(value, label) {
        if (value == null || value === "") {
            console.warn("[JunxueRedeem] " + label + " is missing; using 0.");
            return 0;
        }
        const number = Number(value);
        if (!Number.isFinite(number) || number < 0) {
            console.warn("[JunxueRedeem] " + label + " is invalid; using 0.");
            return 0;
        }
        return Math.floor(number);
    }

    function getRpcRow(data) {
        return Array.isArray(data) ? (data[0] || null) : (data || null);
    }

    function getFriendlyError(error) {
        const message = error && error.message ? error.message : "";

        if (/积分不足|insufficient points/i.test(message)) {
            return INSUFFICIENT_POINTS_TEXT;
        }

        if (/get_my_boss_point_redemptions_page/i.test(message)) {
            return PAGINATION_SQL_HINT;
        }

        if (/boss_point_redemptions|submit_boss_point_redemption|get_boss_redemption_balance_summary|get_my_boss_point_redemptions|schema cache|function .* does not exist|relation .* does not exist/i.test(message)) {
            return SQL_HINT;
        }

        if (/pending redemption limit/i.test(message)) {
            return PENDING_LIMIT_TEXT;
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

    function getArchiveFriendlyError(error) {
        const message = error && error.message ? error.message : "";

        if (/archive_my_boss_point_redemption|user_archived_at|schema cache|function .* does not exist/i.test(message)) {
            return ARCHIVE_SQL_HINT;
        }

        if (/只有已拒绝|only rejected/i.test(message)) {
            return "只有已拒绝的兑换申请可以删除记录。";
        }

        if (/不存在或不属于|redemption not found/i.test(message)) {
            return "没有找到这条兑换申请，请刷新页面后再试。";
        }

        if (/not authenticated|JWT|auth/i.test(message)) {
            return LOGIN_TEXT;
        }

        return "删除记录暂时没有成功，请稍后再试。";
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

    function renderBalanceSummary() {
        setText(nodes.points, state.balanceLoaded ? String(state.currentPoints) : "--");
        setText(nodes.pendingPoints, state.balanceLoaded ? String(state.pendingReservedPoints) : "--");
        setText(nodes.availablePoints, state.balanceLoaded ? String(state.availablePoints) : "--");
        setText(nodes.pendingCount, state.balanceLoaded ? String(state.pendingCount) : "--");
    }

    function applyBalanceSummary(row) {
        if (!row) {
            throw new Error("invalid redemption balance summary response");
        }

        const currentPoints = normalizeRpcNumber(row.current_points, "current_points");
        const pendingReservedPoints = normalizeRpcNumber(row.pending_reserved_points, "pending_reserved_points");
        const reportedAvailablePoints = normalizeRpcNumber(row.available_points, "available_points");
        const availablePoints = Math.max(currentPoints - pendingReservedPoints, 0);

        if (reportedAvailablePoints !== availablePoints) {
            console.warn("[JunxueRedeem] available_points did not match the balance summary; using the calculated value.");
        }

        state.currentPoints = currentPoints;
        state.pendingReservedPoints = pendingReservedPoints;
        state.availablePoints = availablePoints;
        state.pendingCount = normalizeRpcNumber(row.pending_count, "pending_count");
        state.balanceLoaded = true;
        renderBalanceSummary();
        updateSubmissionAvailability();
    }

    function getSubmissionBlockReason() {
        const estimate = calculateEstimate();

        if (!state.balanceLoaded) {
            return "正在读取可兑换积分，请稍候。";
        }
        const validationMessage = validateForm();
        if (validationMessage) {
            return validationMessage;
        }
        if (state.pendingCount >= 5) {
            return PENDING_LIMIT_TEXT;
        }
        if (estimate > state.availablePoints) {
            return INSUFFICIENT_POINTS_TEXT;
        }
        return "";
    }

    function updateSubmissionAvailability() {
        const blockReason = getSubmissionBlockReason();
        if (nodes.submit) {
            nodes.submit.disabled = state.submitting || !!blockReason;
            nodes.submit.textContent = state.submitting ? "提交中..." : "提交兑换申请";
        }

        if (!state.balanceLoaded) {
            setBalanceMessage(blockReason, "");
        } else if (blockReason) {
            setBalanceMessage(blockReason, "warning");
        } else {
            setBalanceMessage("", "");
        }
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
        updateSubmissionAvailability();
    }

    function setSubmitting(isSubmitting) {
        state.submitting = !!isSubmitting;
        updateSubmissionAvailability();
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

    async function loadBalanceSummary() {
        state.balanceLoaded = false;
        renderBalanceSummary();
        updateSubmissionAvailability();

        try {
            const response = await state.client.rpc("get_boss_redemption_balance_summary", {});
            if (response.error) {
                throw response.error;
            }

            applyBalanceSummary(getRpcRow(response.data));
            return { ok: true, error: null };
        } catch (error) {
            state.balanceLoaded = false;
            renderBalanceSummary();
            updateSubmissionAvailability();
            return { ok: false, error: error };
        }
    }

    function renderPagination() {
        if (!nodes.pagination) {
            return;
        }

        const hasRecords = state.totalCount > 0 && state.totalPages > 0;
        nodes.pagination.hidden = !hasRecords;
        if (!hasRecords) {
            setText(nodes.pageInfo, "");
            setText(nodes.pageTotal, "");
            return;
        }

        setText(nodes.pageInfo, "第 " + state.currentPage + " / " + state.totalPages + " 页");
        setText(nodes.pageTotal, "共 " + state.totalCount + " 条记录");
        nodes.pagePrev.disabled = state.recordsLoading || state.currentPage <= 1;
        nodes.pageNext.disabled = state.recordsLoading || state.currentPage >= state.totalPages;
    }

    function renderRecords() {
        const records = state.records || [];
        if (!records.length) {
            nodes.records.innerHTML = "";
            nodes.recordEmpty.textContent = state.totalCount === 0 ? "暂无兑换申请" : "本页暂无可显示的兑换申请。";
            nodes.recordEmpty.hidden = false;
            renderPagination();
            return;
        }

        nodes.recordEmpty.hidden = true;
        nodes.records.innerHTML = records.map(function (record) {
            const status = record.status || "pending";
            const typeLabel = TYPE_LABELS[record.redeem_type] || "兑换服务";
            const rankLabel = record.rank_range ? (RANK_LABELS[record.rank_range] || record.rank_range) : "无需选择";
            const adminNote = record.admin_note ? escapeHtml(record.admin_note) : "暂无管理员批注。";
            const redeemRef = String(record.redeem_ref || "");
            const isArchiving = state.archivingRedeemRefs.has(redeemRef);
            const archiveAction = status === "rejected" ? [
                '<div class="redeem-record-actions">',
                    '<button class="redeem-button redeem-button--archive" type="button" data-redeem-action="archive"' + (state.archivingRedeemRefs.size ? ' disabled' : '') + '>' + (isArchiving ? '正在删除...' : '删除记录') + '</button>',
                    '<small class="redeem-record-archive-note">删除仅会从你的记录中隐藏，后台审核记录仍会保留。</small>',
                '</div>'
            ].join("") : "";

            return [
                '<article class="redeem-record-card">',
                    '<strong>' + escapeHtml(typeLabel) + ' <span class="redeem-pill is-' + escapeHtml(status) + '">' + escapeHtml(STATUS_LABELS[status] || status) + '</span></strong>',
                    '<div class="redeem-record-meta">',
                        '<span>段位 / 区间：' + escapeHtml(rankLabel) + '</span>',
                        '<span>数量：' + escapeHtml(normalizeRpcNumber(record.quantity, "record quantity")) + '</span>',
                        '<span>预计消耗：' + escapeHtml(normalizeRpcNumber(record.cost_points, "record cost_points")) + ' 积分</span>',
                        '<span>提交时间：' + escapeHtml(formatTime(record.created_at)) + '</span>',
                    '</div>',
                    record.user_note ? '<div class="redeem-note">我的备注：' + escapeHtml(record.user_note) + '</div>' : '',
                    '<div class="redeem-note">管理员批注：' + adminNote + '</div>',
                    archiveAction,
                '</article>'
            ].join("");
        }).join("");

        const archiveButtons = nodes.records.querySelectorAll('[data-redeem-action="archive"]');
        const rejectedRecords = records.filter(function (record) {
            return (record.status || "pending") === "rejected";
        });
        archiveButtons.forEach(function (button, index) {
            if (rejectedRecords[index]) {
                archiveButtonRecords.set(button, rejectedRecords[index]);
            }
        });
        renderPagination();
    }

    function normalizeRecordsPage(payload) {
        if (!payload || typeof payload !== "object") {
            throw new Error("invalid redemption page response");
        }

        const pageSize = normalizeRpcNumber(payload.page_size, "page_size");
        const totalCount = normalizeRpcNumber(payload.total_count, "total_count");
        const totalPages = normalizeRpcNumber(payload.total_pages, "total_pages");
        const page = normalizeRpcNumber(payload.page, "page");
        const expectedTotalPages = totalCount ? Math.ceil(totalCount / RECORDS_PAGE_SIZE) : 0;

        if (pageSize !== RECORDS_PAGE_SIZE || totalPages !== expectedTotalPages) {
            throw new Error("invalid redemption page metadata");
        }
        if ((totalCount === 0 && page !== 1) || (totalCount > 0 && (page < 1 || page > totalPages))) {
            throw new Error("invalid redemption page number");
        }

        return {
            page: page,
            pageSize: pageSize,
            totalCount: totalCount,
            totalPages: totalPages,
            items: Array.isArray(payload.items) ? payload.items : []
        };
    }

    async function loadRecords(page, message, silent) {
        const targetPage = Math.max(Math.floor(Number(page) || 1), 1);
        const requestBatch = state.recordsRequestBatch + 1;
        state.recordsRequestBatch = requestBatch;
        state.recordsLoading = true;
        if (nodes.records) {
            nodes.records.setAttribute("aria-busy", "true");
        }
        renderPagination();

        try {
            const response = await state.client.rpc("get_my_boss_point_redemptions_page", {
                p_page: targetPage,
                p_page_size: state.pageSize
            });
            if (response.error) {
                throw response.error;
            }
            if (requestBatch !== state.recordsRequestBatch) {
                return { ok: false, stale: true, error: null };
            }

            const pageResult = normalizeRecordsPage(getRpcRow(response.data));
            state.currentPage = pageResult.page;
            state.pageSize = pageResult.pageSize;
            state.totalCount = pageResult.totalCount;
            state.totalPages = pageResult.totalPages;
            state.records = pageResult.items.filter(function (record) {
                return !state.locallyArchivedRedeemRefs.has(String(record && record.redeem_ref || ""));
            });
            renderRecords();
            if (!silent) {
                setStatus(message || "兑换记录已同步。", "good");
            }
            return { ok: true, error: null };
        } catch (error) {
            if (requestBatch !== state.recordsRequestBatch) {
                return { ok: false, stale: true, error: null };
            }
            if (!silent) {
                setStatus(getFriendlyError(error), "warning");
            }
            return { ok: false, error: error };
        } finally {
            if (requestBatch === state.recordsRequestBatch) {
                state.recordsLoading = false;
                if (nodes.records) {
                    nodes.records.setAttribute("aria-busy", "false");
                }
                renderPagination();
            }
        }
    }

    function keepRecordsInView() {
        if (!nodes.recordSection || typeof nodes.recordSection.scrollIntoView !== "function") {
            return;
        }
        window.requestAnimationFrame(function () {
            nodes.recordSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
    }

    async function goToRecordsPage(page) {
        if (state.recordsLoading || state.totalPages < 1) {
            return;
        }

        const targetPage = Math.min(Math.max(Math.floor(Number(page) || 1), 1), state.totalPages);
        if (targetPage === state.currentPage) {
            return;
        }

        const result = await loadRecords(targetPage, "", true);
        if (result.ok) {
            keepRecordsInView();
        } else if (!result.stale) {
            setStatus(getFriendlyError(result.error), "warning");
        }
    }

    function handleRecordsTouchStart(event) {
        if (state.recordsLoading || !event.touches || event.touches.length !== 1) {
            recordsTouchStart = null;
            return;
        }
        if (event.target.closest("button, a, input, select, textarea, label, [role='button']")) {
            recordsTouchStart = null;
            return;
        }

        recordsTouchStart = {
            x: event.touches[0].clientX,
            y: event.touches[0].clientY
        };
    }

    function handleRecordsTouchEnd(event) {
        if (!recordsTouchStart || !event.changedTouches || event.changedTouches.length !== 1) {
            recordsTouchStart = null;
            return;
        }

        const deltaX = event.changedTouches[0].clientX - recordsTouchStart.x;
        const deltaY = event.changedTouches[0].clientY - recordsTouchStart.y;
        const horizontalDistance = Math.abs(deltaX);
        const verticalDistance = Math.abs(deltaY);
        recordsTouchStart = null;

        if (horizontalDistance < SWIPE_THRESHOLD || horizontalDistance <= verticalDistance * 1.35) {
            return;
        }

        if (deltaX < 0 && state.currentPage < state.totalPages) {
            goToRecordsPage(state.currentPage + 1);
        } else if (deltaX > 0 && state.currentPage > 1) {
            goToRecordsPage(state.currentPage - 1);
        }
    }

    async function archiveRedemption(record) {
        const redeemRef = String(record && record.redeem_ref || "");
        if (!redeemRef || (record.status || "pending") !== "rejected" || state.archivingRedeemRefs.size) {
            return;
        }

        if (!window.confirm("确认删除这条已拒绝的兑换申请吗？删除后将不再显示。")) {
            return;
        }

        state.archivingRedeemRefs.add(redeemRef);
        renderRecords();
        setStatus("正在隐藏这条兑换记录...", "neutral");

        try {
            const response = await state.client.rpc("archive_my_boss_point_redemption", {
                p_redeem_ref: redeemRef
            });
            if (response.error) {
                throw response.error;
            }

            const result = getRpcRow(response.data);
            if (!result || result.archived !== true) {
                throw new Error("archive response invalid");
            }

            state.locallyArchivedRedeemRefs.add(redeemRef);
            state.records = state.records.filter(function (item) {
                return String(item && item.redeem_ref || "") !== redeemRef;
            });
            renderRecords();

            const recordsResult = await loadRecords(state.currentPage, "", true);
            if (recordsResult.ok) {
                setStatus("这条已拒绝的兑换申请已从你的记录中隐藏。", "good");
            } else {
                setStatus("记录已隐藏，但列表刷新失败，请稍后重新打开页面确认。", "warning");
            }
        } catch (error) {
            setStatus(getArchiveFriendlyError(error), "warning");
        } finally {
            state.archivingRedeemRefs.delete(redeemRef);
            renderRecords();
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

        const blockReason = getSubmissionBlockReason();
        if (blockReason) {
            setBalanceMessage(blockReason, "warning");
            setStatus(blockReason, "warning");
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

            applyBalanceSummary(getRpcRow(response.data));
            nodes.form.reset();
            updateTypeUi();
            const recordsResult = await loadRecords(1, "", true);
            setStatus(recordsResult.ok ? "兑换申请已提交，等待管理员审核。" : "兑换申请已提交，但记录暂时没有刷新，请稍后再试。", recordsResult.ok ? "good" : "warning");
        } catch (error) {
            const friendlyError = getFriendlyError(error);
            if (friendlyError === INSUFFICIENT_POINTS_TEXT) {
                await loadBalanceSummary();
            }
            setStatus(friendlyError, "warning");
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
        nodes.pendingPoints = $("[data-redeem-pending-points]");
        nodes.availablePoints = $("[data-redeem-available-points]");
        nodes.pendingCount = $("[data-redeem-pending-count]");
        nodes.form = $("[data-redeem-form]");
        nodes.type = $("[data-redeem-type]");
        nodes.rankField = $("[data-redeem-rank-field]");
        nodes.rank = $("[data-redeem-rank]");
        nodes.quantity = $("[data-redeem-quantity]");
        nodes.quantityLabel = $("[data-redeem-quantity-label]");
        nodes.note = $("[data-redeem-note]");
        nodes.estimate = $("[data-redeem-estimate]");
        nodes.balanceMessage = $("[data-redeem-balance-message]");
        nodes.submit = $("[data-redeem-submit]");
        nodes.recordSection = $("[data-redeem-record-section]");
        nodes.recordRegion = $("[data-redeem-record-region]");
        nodes.records = $("[data-redeem-records]");
        nodes.recordEmpty = $("[data-redeem-record-empty]");
        nodes.pagination = $("[data-redeem-pagination]");
        nodes.pagePrev = $("[data-redeem-page-prev]");
        nodes.pageNext = $("[data-redeem-page-next]");
        nodes.pageInfo = $("[data-redeem-page-info]");
        nodes.pageTotal = $("[data-redeem-page-total]");

        nodes.type.addEventListener("change", updateTypeUi);
        nodes.rank.addEventListener("change", updateTypeUi);
        nodes.quantity.addEventListener("input", updateTypeUi);
        nodes.form.addEventListener("submit", submitRedemption);
        nodes.pagePrev.addEventListener("click", function () {
            goToRecordsPage(state.currentPage - 1);
        });
        nodes.pageNext.addEventListener("click", function () {
            goToRecordsPage(state.currentPage + 1);
        });
        nodes.recordRegion.addEventListener("touchstart", handleRecordsTouchStart, { passive: true });
        nodes.recordRegion.addEventListener("touchend", handleRecordsTouchEnd, { passive: true });
        nodes.recordRegion.addEventListener("touchcancel", function () {
            recordsTouchStart = null;
        }, { passive: true });
        nodes.records.addEventListener("click", function (event) {
            const button = event.target.closest('[data-redeem-action="archive"]');
            if (!button || !nodes.records.contains(button)) {
                return;
            }

            const record = archiveButtonRecords.get(button);
            if (record) {
                archiveRedemption(record);
            }
        });
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
            const results = await Promise.all([loadProfile(), loadBalanceSummary(), loadRecords(1, "", true)]);
            const balanceResult = results[1];
            const recordsResult = results[2];

            if (!balanceResult.ok) {
                setStatus(getFriendlyError(balanceResult.error), "warning");
            } else if (!recordsResult.ok) {
                setStatus(getFriendlyError(recordsResult.error), "warning");
            } else {
                setStatus("可以提交新的兑换申请。", "good");
            }
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
