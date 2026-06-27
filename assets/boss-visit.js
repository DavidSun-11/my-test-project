(function () {
    "use strict";

    if (window.__JUNXUE_BOSS_VISIT_TRACKER_INSTALLED__) {
        return;
    }

    window.__JUNXUE_BOSS_VISIT_TRACKER_INSTALLED__ = true;

    const SETUP_HINT = /record_boss_site_visit|boss_visit_stats|schema cache|function .* does not exist|relation .* does not exist/i;
    const VISIT_INTERVAL_MS = 30 * 60 * 1000;
    const VISIT_STORAGE_PREFIX = "junxue_boss_visit_recorded_at:";

    function shouldIgnore(error) {
        const message = error && error.message ? error.message : "";
        return SETUP_HINT.test(message);
    }

    function getVisitStorageKey() {
        return VISIT_STORAGE_PREFIX + (window.location.pathname || "/");
    }

    function shouldSkipRecentVisit() {
        try {
            const recordedAt = Number(window.localStorage.getItem(getVisitStorageKey()) || 0);
            return recordedAt > 0 && Date.now() - recordedAt < VISIT_INTERVAL_MS;
        } catch (error) {
            return false;
        }
    }

    function markVisitRecorded() {
        try {
            window.localStorage.setItem(getVisitStorageKey(), String(Date.now()));
        } catch (error) {
            // Visit recording is best-effort; storage may be unavailable in private modes.
        }
    }

    async function recordVisit() {
        if (shouldSkipRecentVisit()) {
            return;
        }

        if (!window.JunxueSupabaseClient || typeof window.JunxueSupabaseClient.getClient !== "function") {
            return;
        }

        try {
            const client = await window.JunxueSupabaseClient.getClient();
            const sessionResponse = await client.auth.getSession();
            const session = sessionResponse.data ? sessionResponse.data.session : null;

            if (!session || !session.user) {
                return;
            }

            const response = await client.rpc("record_boss_site_visit", {
                p_page_path: window.location.pathname || "/"
            });

            if (response.error && !shouldIgnore(response.error)) {
                console.warn("[JunxueBossVisit] record failed.", response.error);
                return;
            }

            if (!response.error) {
                markVisitRecorded();
            }
        } catch (error) {
            if (!shouldIgnore(error)) {
                console.warn("[JunxueBossVisit] record failed.", error);
            }
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
            window.setTimeout(recordVisit, 800);
        }, { once: true });
    } else {
        window.setTimeout(recordVisit, 800);
    }
}());
