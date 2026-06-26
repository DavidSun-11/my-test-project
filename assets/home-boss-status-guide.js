(function () {
    "use strict";

    if (window.__JUNXUE_HOME_BOSS_STATUS_GUIDE_INSTALLED__) {
        return;
    }

    window.__JUNXUE_HOME_BOSS_STATUS_GUIDE_INSTALLED__ = true;

    const GUIDE_SEEN_KEY = "junxue_ganyu_guide_seen_v1";
    const CLIENT_WAIT_ATTEMPTS = 30;
    const CLIENT_WAIT_DELAY_MS = 100;
    const HIGHLIGHT_MS = 1800;

    const state = {
        client: null,
        loggedIn: false,
        sessionReady: false,
        refreshToken: 0,
        guideDismissedInPage: false
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

    function readGuideSeen() {
        if (state.guideDismissedInPage) {
            return true;
        }

        try {
            return window.localStorage.getItem(GUIDE_SEEN_KEY) === "true";
        } catch (error) {
            return false;
        }
    }

    function writeGuideSeen() {
        state.guideDismissedInPage = true;

        try {
            window.localStorage.setItem(GUIDE_SEEN_KEY, "true");
        } catch (error) {
            // Storage can be unavailable in private modes. The in-page fallback above is enough.
        }
    }

    function wait(ms) {
        return new Promise(function (resolve) {
            window.setTimeout(resolve, ms);
        });
    }

    async function waitForSharedSupabaseClient() {
        for (let attempt = 0; attempt < CLIENT_WAIT_ATTEMPTS; attempt += 1) {
            if (window.JunxueSupabaseClient && typeof window.JunxueSupabaseClient.getClient === "function") {
                return window.JunxueSupabaseClient;
            }

            await wait(CLIENT_WAIT_DELAY_MS);
        }

        throw new Error("shared-client-unavailable");
    }

    function setBossStatus(mainText, subText) {
        const main = document.querySelector("[data-home-boss-status-main]");
        const sub = document.querySelector("[data-home-boss-status-sub]");

        if (main) {
            main.textContent = mainText;
        }
        if (sub) {
            sub.textContent = subText || "";
        }
    }

    function setSyncingStatus() {
        setBossStatus("老板状态同步中", "正在确认账号");
    }

    async function refreshBossStatus(client) {
        const token = state.refreshToken + 1;
        state.refreshToken = token;

        if (!state.sessionReady) {
            setSyncingStatus();
        }

        let session = null;

        try {
            const response = await client.auth.getSession();
            if (token !== state.refreshToken) {
                return;
            }

            if (response.error) {
                throw response.error;
            }

            session = response.data ? response.data.session : null;
        } catch (error) {
            state.sessionReady = true;
            state.loggedIn = false;
            setBossStatus("老板状态同步中", "稍后再试");
            console.debug("[JunxueHome] boss status session unavailable.");
            return;
        }

        state.sessionReady = true;
        state.loggedIn = !!(session && session.user);

        if (!state.loggedIn) {
            setBossStatus("未注册", "点甘雨开启互动");
            return;
        }

        setBossStatus("老板：已登录", "正在读取昵称");

        try {
            const response = await client
                .from("boss_profiles")
                .select("display_name")
                .eq("user_id", session.user.id)
                .maybeSingle();

            if (token !== state.refreshToken) {
                return;
            }

            if (response.error) {
                console.debug("[JunxueHome] boss profile display name unavailable.");
                setBossStatus("老板：已登录", "账号已同步");
                return;
            }

            const displayName = safeTrim(response.data && response.data.display_name);
            if (displayName) {
                setBossStatus("老板：" + displayName, "账号已同步");
                return;
            }

            setBossStatus("老板：已登录", "账号已同步");
        } catch (error) {
            console.debug("[JunxueHome] boss profile display name unavailable.");
            setBossStatus("老板：已登录", "账号已同步");
        }
    }

    function openBossLogin() {
        if (!state.sessionReady || state.loggedIn) {
            return;
        }

        if (window.JunxueGanyuLazy && typeof window.JunxueGanyuLazy.load === "function") {
            window.JunxueGanyuLazy.load().then(function (menu) {
                if (menu && typeof menu.openBossLogin === "function") {
                    menu.openBossLogin();
                    return;
                }

                window.location.href = "index.html?bossLogin=1";
            }).catch(function () {
                window.location.href = "index.html?bossLogin=1";
            });
            return;
        }

        if (window.Live2DInteractiveMenu && typeof window.Live2DInteractiveMenu.openBossLogin === "function") {
            window.Live2DInteractiveMenu.openBossLogin();
            return;
        }

        window.location.href = "index.html?bossLogin=1";
    }

    function initBossStatus() {
        const button = document.querySelector("[data-home-boss-status]");
        if (!button) {
            return;
        }

        setSyncingStatus();
        button.addEventListener("click", openBossLogin);

        waitForSharedSupabaseClient().then(function (sharedClient) {
            return sharedClient.getClient();
        }).then(function (client) {
            state.client = client;

            if (client.auth && typeof client.auth.onAuthStateChange === "function") {
                client.auth.onAuthStateChange(function (event) {
                    if (event === "SIGNED_OUT") {
                        state.sessionReady = true;
                        state.loggedIn = false;
                        state.refreshToken += 1;
                        setBossStatus("未注册", "点甘雨开启互动");
                        return;
                    }

                    refreshBossStatus(client);
                });
            }

            refreshBossStatus(client);
        }).catch(function () {
            console.debug("[JunxueHome] boss status shared client unavailable.");
            setBossStatus("老板状态同步中", "稍后再试");
        });
    }

    function highlightGanyuEntry() {
        const selectors = [
            "#ganyu-live2d-frame-shell",
            ".ganyu-static-card",
            ".live2d-hit-area",
            ".live2d-load-control__button"
        ];
        let target = null;

        for (let index = 0; index < selectors.length; index += 1) {
            target = document.querySelector(selectors[index]);
            if (target) {
                break;
            }
        }

        if (!target) {
            return;
        }

        target.classList.remove("home-ganyu-guide-highlight");
        void target.offsetWidth;
        target.classList.add("home-ganyu-guide-highlight");
        window.setTimeout(function () {
            target.classList.remove("home-ganyu-guide-highlight");
        }, HIGHLIGHT_MS);
    }

    function closeGuide(shouldHighlight) {
        const guide = document.querySelector("[data-home-ganyu-guide]");
        writeGuideSeen();

        if (guide) {
            guide.hidden = true;
        }

        if (shouldHighlight) {
            window.setTimeout(highlightGanyuEntry, 60);
        }
    }

    function initGanyuGuide() {
        const guide = document.querySelector("[data-home-ganyu-guide]");
        if (!guide || readGuideSeen()) {
            return;
        }

        const closeButton = guide.querySelector("[data-home-ganyu-guide-close]");
        const ganyuButton = guide.querySelector("[data-home-ganyu-guide-ganyu]");
        const laterButton = guide.querySelector("[data-home-ganyu-guide-later]");

        guide.hidden = false;

        if (closeButton) {
            closeButton.addEventListener("click", function () {
                closeGuide(false);
            });
        }

        if (ganyuButton) {
            ganyuButton.addEventListener("click", function () {
                closeGuide(true);
            });
        }

        if (laterButton) {
            laterButton.addEventListener("click", function () {
                closeGuide(false);
            });
        }
    }

    onReady(function () {
        initBossStatus();
        initGanyuGuide();
    });

    window.JunxueHomeBossStatusGuide = {
        refresh: function () {
            if (state.client) {
                return refreshBossStatus(state.client);
            }

            return Promise.resolve();
        }
    };
}());
