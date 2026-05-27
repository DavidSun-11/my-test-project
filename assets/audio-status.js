document.addEventListener("DOMContentLoaded", function () {
    const AUDIO_PATH = "assets/audio/zuichibi.mp3";
    const AUDIO_VERSION = "20260527-2";

    function getProjectRoot() {
        const marker = "/my-test-project/";
        const index = window.location.pathname.indexOf(marker);

        if (index === -1) {
            return "/";
        }

        return window.location.pathname.slice(0, index + marker.length);
    }

    function getAudioUrl() {
        const root = getProjectRoot();
        return root + AUDIO_PATH + "?v=" + AUDIO_VERSION;
    }

    document.querySelectorAll(".music-player").forEach(function (player) {
        const audio = player.querySelector("audio");
        const source = player.querySelector("source");

        if (!audio || !source) {
            return;
        }

        const audioUrl = getAudioUrl();
        source.src = audioUrl;

        const status = document.createElement("div");
        status.className = "music-player-status";
        status.textContent = "正在检查音频文件...";
        player.appendChild(status);

        function showMissing() {
            player.classList.add("is-missing-audio");
            status.textContent = "无法读取 " + AUDIO_PATH;
        }

        function showEmpty() {
            player.classList.add("is-missing-audio");
            status.textContent = "音频文件为空，请重新上传 mp3";
        }

        function showReady() {
            player.classList.remove("is-missing-audio");
            status.textContent = "音频已就绪";
        }

        audio.addEventListener("loadedmetadata", showReady);
        audio.addEventListener("error", showMissing);

        fetch(audioUrl, {
            method: "HEAD",
            cache: "no-store"
        }).then(function (response) {
            if (!response.ok) {
                showMissing();
                return;
            }

            const contentLength = response.headers.get("content-length");

            if (contentLength === "0") {
                showEmpty();
                return;
            }

            audio.load();
        }).catch(showMissing);
    });
});
