(function () {
    "use strict";

    const VERSION = "20260627-home-performance1";
    const CONFIG_SRC = "assets/supabase-config.js?v=20260611-1";
    const LOCAL_SDK_SRC = "assets/vendor/supabase-js-2.min.js?v=20260616-1";
    const sharedState = window.__JUNXUE_SUPABASE_CLIENT_STATE__ || {
        client: null,
        sdkPromise: null,
        configPromise: null
    };

    window.__JUNXUE_SUPABASE_CLIENT_STATE__ = sharedState;

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            const existing = Array.prototype.find.call(document.scripts, function (script) {
                return script.getAttribute("src") === src;
            });

            if (existing) {
                if (existing.dataset.loaded === "true" || window.supabase) {
                    resolve();
                    return;
                }
                existing.addEventListener("load", resolve, { once: true });
                existing.addEventListener("error", reject, { once: true });
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

    function hasConfig() {
        return /^https:\/\/.+\.supabase\.co$/i.test(String(window.SUPABASE_URL || "")) &&
            !!window.SUPABASE_ANON_KEY &&
            (String(window.SUPABASE_ANON_KEY).indexOf("sb_publishable_") === 0 ||
                String(window.SUPABASE_ANON_KEY).indexOf("eyJ") === 0);
    }

    async function ensureConfig() {
        if (!sharedState.configPromise) {
            sharedState.configPromise = loadScript(CONFIG_SRC).catch(function () {});
        }

        await sharedState.configPromise;

        if (!hasConfig()) {
            throw new Error("Supabase 暂未配置，请稍后再试。");
        }
    }

    async function ensureSdk() {
        if (window.supabase && typeof window.supabase.createClient === "function") {
            return;
        }

        if (!sharedState.sdkPromise) {
            sharedState.sdkPromise = loadScript(LOCAL_SDK_SRC);
        }

        await sharedState.sdkPromise;

        if (!window.supabase || typeof window.supabase.createClient !== "function") {
            throw new Error("Supabase SDK 加载失败，请稍后再试。");
        }
    }

    async function getClient() {
        if (sharedState.client) {
            return sharedState.client;
        }

        await ensureConfig();
        await ensureSdk();

        sharedState.client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
        return sharedState.client;
    }

    async function getSession() {
        const activeClient = await getClient();
        const response = await activeClient.auth.getSession();

        if (response.error) {
            throw response.error;
        }

        return response.data ? response.data.session : null;
    }

    window.JunxueSupabaseClient = {
        version: VERSION,
        getClient: getClient,
        getSession: getSession,
        loadScript: loadScript
    };
}());
