document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".music-player").forEach(function (player) {
        const audio = player.querySelector("audio");
        const source = player.querySelector("source");

        if (!audio || !source) {
            return;
        }

        const status = document.createElement("div");
        status.className = "music-player-status";
        status.textContent = "正在检查音频文件...";
        player.appendChild(status);

        function showMissing() {
            player.classList.add("is-missing-audio");
            status.textContent = "缺少 assets/audio/zuichibi.mp3";
        }

        function showReady() {
            player.classList.remove("is-missing-audio");
            status.textContent = "音频已就绪";
        }

        audio.addEventListener("loadedmetadata", showReady);
        audio.addEventListener("error", showMissing);

        fetch(source.getAttribute("src"), {
            method: "HEAD",
            cache: "no-store"
        }).then(function (response) {
            if (!response.ok) {
                showMissing();
                return;
            }

            audio.load();
        }).catch(showMissing);
    });
});
