(function () {
    "use strict";

    const VERSION = "20260701-my-page-mvp1";
    const AVATAR_BUCKET = "boss-avatars";
    const MAX_AVATAR_BYTES = 1024 * 1024;
    const AVATAR_SIZE = 512;
    const AVATAR_TYPES = {
        "image/jpeg": true,
        "image/png": true,
        "image/webp": true
    };

    const state = {
        client: null,
        session: null,
        userHash: "",
        profile: null,
        avatarPath: "",
        checkinStatus: null,
        loadingToken: 0
    };

    function $(selector) {
        return document.querySelector(selector);
    }

    const nodes = {
        loggedOut: $("[data-my-logged-out]"),
        app: $("[data-my-app]"),
        displayName: $("[data-my-display-name]"),
        avatarImg: $("[data-my-avatar-img]"),
        avatarPlaceholder: $("[data-my-avatar-placeholder]"),
        avatarInput: $("[data-my-avatar-input]"),
        avatarButton: $("[data-my-avatar-button]"),
        avatarStatus: $("[data-my-avatar-status]"),
        refreshButton: $("[data-my-refresh]"),
        checkinButton: $("[data-my-checkin-button]"),
        points: $("[data-my-points]"),
        totalCheckins: $("[data-my-total-checkins]"),
        currentStreak: $("[data-my-current-streak]"),
        monthlyCheckins: $("[data-my-monthly-checkins]"),
        todayStatus: $("[data-my-today-status]"),
        todayDate: $("[data-my-today-date]"),
        checkinMessage: $("[data-my-checkin-message]")
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
        return safeTrim(name).slice(0, 20) || "老板用户";
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
    }

    function renderLoggedInShell() {
        setHidden(nodes.loggedOut, true);
        setHidden(nodes.app, false);
    }

    function renderProfile(profile) {
        const displayName = safeTrim(profile && profile.display_name);
        setText(nodes.displayName, displayName ? "老板：" + displayName : "老板：已登录");
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

        setText(nodes.points, status ? String(status.totalPoints) : "--");
        setText(nodes.totalCheckins, status ? String(status.totalCheckins) + " 天" : "--");
        setText(nodes.currentStreak, status ? String(status.currentStreak) + " 天" : "--");
        setText(nodes.monthlyCheckins, status ? String(status.monthlyCheckins) + " 天" : "--");
        setText(nodes.todayStatus, status ? (status.signedToday || status.alreadySigned ? "今日已签到" : "今日未签到") : "--");
        setText(nodes.todayDate, status && status.todayDate ? String(status.todayDate).slice(0, 10) : "--");

        if (nodes.checkinButton) {
            nodes.checkinButton.disabled = !!(status && (status.signedToday || status.alreadySigned));
            nodes.checkinButton.textContent = status && (status.signedToday || status.alreadySigned) ? "今日已签到" : "立即签到";
        }

        setCheckinMessage(message || (status && (status.signedToday || status.alreadySigned) ? "今日已完成签到。" : "今日还可以签到。"));
    }

    async function loadCheckinStatus(message) {
        try {
            const response = await state.client.rpc("get_boss_checkin_status", { p_month: null });

            if (response.error) {
                throw response.error;
            }

            renderCheckinStatus(normalizeCheckinRow(response.data), message);
        } catch (error) {
            if (isCheckinSetupError(error)) {
                renderCheckinStatus(null, "签到功能还需要执行数据库升级 SQL。");
                setText(nodes.points, "积分暂未开启");
                setText(nodes.totalCheckins, "--");
                setText(nodes.currentStreak, "--");
                setText(nodes.monthlyCheckins, "--");
                if (nodes.checkinButton) {
                    nodes.checkinButton.disabled = true;
                    nodes.checkinButton.textContent = "暂未开启";
                }
                return;
            }

            renderCheckinStatus(null, "签到状态暂时读取失败，请稍后再试。");
        }
    }

    async function claimCheckin() {
        if (!state.client || !state.session) {
            return;
        }

        setBusy(nodes.checkinButton, true, "签到中...");

        try {
            const response = await state.client.rpc("claim_boss_daily_checkin", {});

            if (response.error) {
                throw response.error;
            }

            const status = normalizeCheckinRow(response.data);
            renderCheckinStatus(status, status.message || (status.alreadySigned ? "今天已经签到过啦。" : "签到成功。"));
        } catch (error) {
            if (isCheckinSetupError(error)) {
                renderCheckinStatus(null, "签到功能还需要执行数据库升级 SQL。");
                return;
            }

            setCheckinMessage("签到暂时失败，请稍后再试。");
        } finally {
            if (nodes.checkinButton && !(state.checkinStatus && (state.checkinStatus.signedToday || state.checkinStatus.alreadySigned))) {
                setBusy(nodes.checkinButton, false, "立即签到");
            }
        }
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
            setBusy(nodes.avatarButton, false, "添加 / 修改头像");
            if (nodes.avatarInput) {
                nodes.avatarInput.value = "";
            }
        }
    }

    async function refreshAll(message) {
        const token = state.loadingToken + 1;
        state.loadingToken = token;
        setAvatarStatus("正在读取老板资料...");
        setCheckinMessage("正在读取签到状态...");

        await loadProfile();
        if (token !== state.loadingToken) {
            return;
        }
        await loadCheckinStatus(message);
        if (nodes.avatarStatus && nodes.avatarStatus.textContent === "正在读取老板资料...") {
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
            renderLoggedInShell();
            renderProfile(null);
            await refreshAll();
        } catch (error) {
            renderLoggedOut();
            console.debug("[JunxueMy] init failed.");
        }
    }

    onReady(function () {
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

        init();
    });

    window.JunxueMyPage = {
        version: VERSION,
        refresh: refreshAll
    };
}());
