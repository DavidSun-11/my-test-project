/* Live2D 互动模块：菜单、无奖竞答题库、英雄池转盘、咨询功能都集中在这里，方便后续继续加题。 */
(function () {
    const quizBank = [
        {
            question: "你觉得君雪是怎么样的人？",
            options: ["天资卓越", "完美无瑕", "才富五车", "一般"],
            correct: [0, 1, 2]
        },
        {
            question: "如果君雪打游戏坑了怎么办？",
            options: ["继续带飞", "安慰她", "偷偷举报", "压力队友"],
            correct: [0, 1]
        },
        {
            question: "你会一直留在这个网站吗？",
            options: ["会", "当然会", "每天都来", "不会"],
            correct: [0, 1, 2]
        },
        {
            question: "君雪和游戏哪个更重要？",
            options: ["君雪", "都重要", "先看情况", "游戏！"],
            correct: [0, 1, 2]
        },
        {
            question: "君雪在星空下最适合做什么？",
            options: ["继续变强", "发呆看星星", "偷偷休息", "拆掉网站"],
            correct: [0, 1, 2]
        },
        { question: "7 + 8 = ?", options: ["13", "14", "15", "16"], correct: [2] },
        { question: "9 x 6 = ?", options: ["42", "48", "54", "56"], correct: [2] },
        { question: "56 ÷ 7 = ?", options: ["6", "7", "8", "9"], correct: [2] },
        { question: "18 + 27 = ?", options: ["35", "45", "46", "55"], correct: [1] },
        { question: "81 - 36 = ?", options: ["35", "45", "55", "57"], correct: [1] },
        { question: "12 x 4 = ?", options: ["36", "42", "48", "52"], correct: [2] },
        { question: "100 - 37 = ?", options: ["53", "63", "67", "73"], correct: [1] },
        { question: "45 ÷ 5 = ?", options: ["7", "8", "9", "10"], correct: [2] },
        { question: "23 + 19 = ?", options: ["40", "41", "42", "43"], correct: [2] },
        { question: "6 x 7 = ?", options: ["36", "40", "42", "49"], correct: [2] },
        { question: "什么东西越洗越脏？", options: ["脸", "水", "手帕", "肥皂"], correct: [1] },
        { question: "什么门永远关不上？", options: ["木门", "球门", "铁门", "校门"], correct: [1] },
        { question: "什么东西越吃越少？", options: ["米饭", "年龄", "空气", "影子"], correct: [0] },
        { question: "什么东西有脚却不会走？", options: ["桌子", "小猫", "鞋子", "钟表"], correct: [0] },
        { question: "什么东西天气越热爬得越高？", options: ["太阳", "温度计", "气球", "云"], correct: [1] },
        { question: "什么车不会动？", options: ["火车", "风车", "汽车", "电车"], correct: [1] },
        { question: "什么布剪不断？", options: ["瀑布", "棉布", "桌布", "花布"], correct: [0] },
        { question: "什么东西越用越有光？", options: ["灯泡", "镜子", "脑子", "蜡烛"], correct: [2] },
        { question: "什么东西明明是你的，别人却用得最多？", options: ["名字", "书包", "手机", "铅笔"], correct: [0] },
        { question: "什么桥下面没有水？", options: ["木桥", "天桥", "石桥", "铁桥"], correct: [1] }
    ];

    // 王者荣耀英雄池可继续补充英雄；这里先按常见主要分路分类，方便后续增删。
    const heroPools = {
        jungle: ["澜", "镜", "露娜", "韩信", "李白", "赵云", "孙悟空", "娜可露露", "云缨", "暃", "裴擒虎", "兰陵王", "阿轲", "曜", "宫本武藏"],
        marksman: ["孙尚香", "公孙离", "马可波罗", "伽罗", "后羿", "鲁班七号", "狄仁杰", "虞姬", "李元芳", "蒙犽", "百里守约", "黄忠", "戈娅", "莱西奥"],
        mid: ["貂蝉", "上官婉儿", "不知火舞", "诸葛亮", "干将莫邪", "王昭君", "小乔", "安琪拉", "西施", "弈星", "沈梦溪", "海月", "嬴政", "周瑜", "嫦娥"],
        support: ["瑶", "蔡文姬", "大乔", "孙膑", "张飞", "牛魔", "太乙真人", "鲁班大师", "明世隐", "庄周", "盾山", "鬼谷子", "桑启", "刘禅"],
        clash: ["花木兰", "马超", "关羽", "吕布", "夏洛特", "狂铁", "孙策", "亚瑟", "老夫子", "铠", "司空震", "白起", "项羽", "廉颇", "姬小满"]
    };

    const laneLabels = {
        jungle: "打野",
        marksman: "射手",
        mid: "中路",
        support: "辅助",
        clash: "对抗路"
    };

    const weatherCodeLabels = {
        0: "晴朗",
        1: "大部晴朗",
        2: "局部多云",
        3: "阴天",
        45: "有雾",
        48: "雾凇",
        51: "小毛毛雨",
        53: "毛毛雨",
        55: "较强毛毛雨",
        56: "冻毛毛雨",
        57: "强冻毛毛雨",
        61: "小雨",
        63: "中雨",
        65: "大雨",
        66: "冻雨",
        67: "强冻雨",
        71: "小雪",
        73: "中雪",
        75: "大雪",
        77: "雪粒",
        80: "阵雨",
        81: "较强阵雨",
        82: "强阵雨",
        85: "阵雪",
        86: "强阵雪",
        95: "雷暴",
        96: "雷暴伴冰雹",
        99: "强雷暴伴冰雹"
    };

    const letters = ["A", "B", "C", "D"];
    let quizState = null;
    let selectedLane = "jungle";
    let wheelRotation = 0;
    let heroSpinTimer = null;
    let heroSpinTimeout = null;
    let openingVoicePlaying = false;
    let openingVoiceRetryPending = false;
    let openingVoiceRetryBound = false;
    let currentMusicIndex = 0;
    let musicPlaying = false;
    const openingVoiceText = "万家灯火就在眼前，人们的生活究竟是什么样的呢…欸？你想邀我去夜市？啊…不，不好意思，我就不去了吧。";
    const openingVoicePath = "assets/audio/ganyu_opening.mp3";
    let firstClickVoicePlaying = false;
    const firstClickVoiceStorageKey = "live2d_first_click_voice_played";
    const firstClickVoiceText = "早上好...嗯？是哪里没有梳理好吗，请不要盯着我的...盯着我的头饰看。";
    const firstClickVoicePath = "assets/audio/ganyu_first_click.mp3";
    const musicList = [
        { title: "感谢你曾来过", src: "assets/audio/music.mp3" },
        { title: "Don't Speak", src: "assets/audio/dont-speak.mp3" }
    ];
    const musicAudio = new Audio();

    function playVoice(file) {
        const audio = new Audio(file);

        audio.volume = 0.8;
        return new Promise(function (resolve) {
            let done = false;
            const timer = window.setTimeout(finish, 15000);

            function finish() {
                if (done) {
                    return;
                }

                done = true;
                window.clearTimeout(timer);
                resolve();
            }

            audio.addEventListener("ended", finish, { once: true });
            audio.addEventListener("error", finish, { once: true });
            audio.play().catch(finish);
        });
    }

    function playOpeningVoice() {
        const audio = new Audio(openingVoicePath);

        audio.volume = 0.8;
        return new Promise(function (resolve) {
            let done = false;
            let started = false;
            const timer = window.setTimeout(finish, 8000);

            function finish() {
                if (done) {
                    return;
                }

                done = true;
                window.clearTimeout(timer);
                resolve(started);
            }

            function markStarted() {
                started = true;
            }

            audio.addEventListener("ended", finish, { once: true });
            audio.addEventListener("error", finish, { once: true });

            const playRequest = audio.play();

            if (playRequest && typeof playRequest.then === "function") {
                playRequest.then(markStarted).catch(finish);
                return;
            }

            markStarted();
        });
    }

    function hasPlayedStoredVoice(key) {
        try {
            return localStorage.getItem(key) === "true";
        } catch (error) {
            return false;
        }
    }

    function markStoredVoicePlayed(key) {
        try {
            localStorage.setItem(key, "true");
        } catch (error) {
            // localStorage 不可用时，只在当前页面避免重复播放。
        }
    }

    function hasPlayedFirstClickVoice() {
        return hasPlayedStoredVoice(firstClickVoiceStorageKey);
    }

    function markFirstClickVoicePlayed() {
        markStoredVoicePlayed(firstClickVoiceStorageKey);
    }

    function shuffle(items) {
        const copy = items.slice();

        for (let index = copy.length - 1; index > 0; index -= 1) {
            const target = Math.floor(Math.random() * (index + 1));
            const temp = copy[index];
            copy[index] = copy[target];
            copy[target] = temp;
        }

        return copy;
    }

    function pickQuizQuestion() {
        const candidates = quizState && quizState.lastQuestion
            ? quizBank.filter(function (item) {
                return item !== quizState.lastQuestion;
            })
            : quizBank;

        return candidates[Math.floor(Math.random() * candidates.length)];
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"]/g, function (char) {
            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                "\"": "&quot;"
            }[char];
        });
    }

    function formatTemperature(value) {
        return Number.isFinite(value) ? Math.round(value) + "°C" : "--";
    }

    function getDayLabel(index) {
        return ["今天", "明天", "后天"][index] || "第 " + (index + 1) + " 天";
    }

    function getWeatherLabel(code) {
        return weatherCodeLabels[code] || "天气变化中";
    }

    function getPrecipitationText(daily, index) {
        const probabilities = daily.precipitation_probability_max || [];
        const sums = daily.precipitation_sum || [];

        if (probabilities[index] !== null && probabilities[index] !== undefined) {
            return "降水概率 " + probabilities[index] + "%";
        }

        if (sums[index] !== null && sums[index] !== undefined) {
            return "降水量 " + sums[index] + "mm";
        }

        return "降水数据暂无";
    }

    function normalizeCityName(cityName) {
        return cityName.trim().replace(/\s+/g, "").replace(/[市区县]+$/, "");
    }

    const cityFallbackMap = {
        "莱州": {
            name: "莱州",
            admin1: "山东",
            country: "中国",
            latitude: 37.18,
            longitude: 119.94
        },
        "扬州": {
            name: "扬州",
            admin1: "江苏",
            country: "中国",
            latitude: 32.39,
            longitude: 119.42
        }
    };

    function createDialog() {
        const dialog = document.createElement("div");
        dialog.className = "live2d-quiz";
        dialog.setAttribute("role", "dialog");
        dialog.setAttribute("aria-live", "polite");
        dialog.setAttribute("aria-label", "Live2D 互动");
        dialog.innerHTML = [
            '<button class="live2d-quiz__close" type="button" aria-label="关闭">×</button>',
            '<div class="live2d-quiz__meta"></div>',
            '<div class="live2d-quiz__question"></div>',
            '<div class="live2d-quiz__options"></div>',
            '<div class="live2d-quiz__result"></div>'
        ].join("");
        document.body.appendChild(dialog);
        return dialog;
    }

    function ensureOpeningBubbleStyles() {
        if (document.getElementById("live2d-opening-bubble-style")) {
            return;
        }

        const style = document.createElement("style");
        style.id = "live2d-opening-bubble-style";
        style.textContent = [
            ".live2d-opening-bubble{position:fixed;left:252px;top:160px;z-index:61;width:min(328px,calc(100vw - 32px));padding:12px 14px;border:1px solid rgba(255,236,245,.88);border-radius:16px;background:rgba(255,178,211,.76);box-shadow:0 0 22px rgba(255,142,196,.38),inset 0 0 14px rgba(255,255,255,.16);backdrop-filter:blur(10px);color:rgba(92,28,58,.96);font-size:14px;line-height:1.55;letter-spacing:0;pointer-events:none;opacity:0;transform:translateY(8px);transition:opacity .35s ease,transform .35s ease;}",
            ".live2d-opening-bubble.is-open{opacity:1;transform:translateY(0);}",
            ".live2d-opening-bubble.is-fading{opacity:0;transform:translateY(-6px);}",
            "@media (max-width:720px){.live2d-opening-bubble{width:min(300px,calc(100vw - 28px));font-size:13px;}}"
        ].join("");
        document.head.appendChild(style);
    }

    function createOpeningBubble() {
        ensureOpeningBubbleStyles();

        const bubble = document.createElement("div");
        bubble.className = "live2d-opening-bubble";
        bubble.setAttribute("aria-live", "polite");
        document.body.appendChild(bubble);
        return bubble;
    }

    function showOpeningBubble(bubble) {
        bubble.textContent = openingVoiceText;
        positionLive2DPopup(bubble, {
            width: 328,
            height: 96,
            offsetY: 56
        });
        bubble.classList.remove("is-fading");
        bubble.classList.add("is-open");
        window.clearTimeout(showOpeningBubble.timer);
        showOpeningBubble.timer = window.setTimeout(function () {
            hideOpeningBubble(bubble);
        }, 7000);
    }

    function hideOpeningBubble(bubble) {
        window.clearTimeout(showOpeningBubble.timer);
        bubble.classList.add("is-fading");
        bubble.classList.remove("is-open");
        window.clearTimeout(hideOpeningBubble.timer);
        hideOpeningBubble.timer = window.setTimeout(function () {
            bubble.classList.remove("is-fading");
            bubble.textContent = "";
        }, 360);
    }

    function createHitArea() {
        const hitArea = document.createElement("button");
        hitArea.className = "live2d-hit-area";
        hitArea.type = "button";
        hitArea.setAttribute("aria-label", "点击 Live2D 看板娘");
        document.body.appendChild(hitArea);
        return hitArea;
    }

    function findLive2DRoots() {
        const selectors = [
            "#live2d-widget",
            "#oml2d-main",
            "#oml2d-stage",
            "#oml2d-canvas",
            ".oml2d-main",
            ".oml2d-stage",
            ".oml2d-canvas",
            "[id^='oml2d']",
            "[class*='oml2d']",
            "canvas"
        ];
        const roots = [];

        selectors.forEach(function (selector) {
            document.querySelectorAll(selector).forEach(function (node) {
                const rect = node.getBoundingClientRect();
                const isLeftBottom = rect.left < 360 && rect.bottom > window.innerHeight - 520;

                if ((selector !== "canvas" || isLeftBottom) && !roots.includes(node)) {
                    roots.push(node);
                }
            });
        });

        return roots;
    }

    function getLive2DRect() {
        const selectors = ["#oml2d-stage", "#oml2d-canvas", ".live2d-hit-area"];

        for (let index = 0; index < selectors.length; index += 1) {
            const node = document.querySelector(selectors[index]);

            if (node && node.getBoundingClientRect) {
                const rect = node.getBoundingClientRect();

                if (rect.width > 0 && rect.height > 0) {
                    return rect;
                }
            }
        }

        return {
            left: 10,
            top: Math.max(0, window.innerHeight - 500),
            right: 310,
            bottom: window.innerHeight - 96,
            width: 300,
            height: 390
        };
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function positionLive2DPopup(node, options) {
        if (!node) {
            return;
        }

        const settings = options || {};
        const rect = getLive2DRect();
        const gap = settings.gap || 14;
        const fallbackWidth = settings.width || 330;
        const fallbackHeight = settings.height || 160;
        const popupWidth = node.offsetWidth || fallbackWidth;
        const popupHeight = node.offsetHeight || fallbackHeight;
        const rightLeft = rect.right + gap;
        const hasRightSpace = rightLeft + popupWidth + 12 <= window.innerWidth;
        const nextLeft = hasRightSpace
            ? rightLeft
            : rect.left - popupWidth - gap;
        const nextTop = rect.top + (settings.offsetY || Math.max(36, rect.height * 0.16));
        const maxLeft = Math.max(8, window.innerWidth - popupWidth - 8);
        const maxTop = Math.max(8, window.innerHeight - popupHeight - 8);

        node.style.left = clamp(nextLeft, 8, maxLeft) + "px";
        node.style.top = clamp(nextTop, 8, maxTop) + "px";
        node.style.right = "auto";
        node.style.bottom = "auto";
    }

    function positionDefaultTips() {
        const tips = document.querySelector("#oml2d-tips");

        if (!tips) {
            return;
        }

        tips.style.setProperty("position", "fixed", "important");
        tips.style.setProperty("z-index", "62", "important");
        tips.style.setProperty("pointer-events", "none", "important");
        positionLive2DPopup(tips, {
            width: 190,
            height: 72,
            offsetY: 92,
            gap: 12
        });
    }

    function initInteractions() {
        const dialog = createDialog();
        const openingBubble = createOpeningBubble();
        const hitArea = createHitArea();
        const closeButton = dialog.querySelector(".live2d-quiz__close");
        const meta = dialog.querySelector(".live2d-quiz__meta");
        const question = dialog.querySelector(".live2d-quiz__question");
        const options = dialog.querySelector(".live2d-quiz__options");
        const result = dialog.querySelector(".live2d-quiz__result");
        const boundNodes = new WeakSet();

        function clearSpinTimers() {
            window.clearInterval(heroSpinTimer);
            window.clearTimeout(heroSpinTimeout);
            heroSpinTimer = null;
            heroSpinTimeout = null;
        }

        function stopMusicPlayback() {
            musicAudio.pause();
            musicPlaying = false;
        }

        function clearDialog() {
            clearSpinTimers();
            stopMusicPlayback();
            dialog.classList.remove("is-wheel", "is-weather", "is-music");
            meta.textContent = "";
            question.textContent = "";
            options.innerHTML = "";
            result.textContent = "";
            result.className = "live2d-quiz__result";
            options.className = "live2d-quiz__options";
        }

        function replayOpenAnimation() {
            dialog.classList.remove("is-opening");
            void dialog.offsetWidth;
            dialog.classList.add("is-opening");
        }

        function showDialog() {
            positionLive2DPopup(dialog, {
                width: 362,
                height: 220,
                offsetY: 68
            });
            dialog.classList.add("is-open");
            replayOpenAnimation();
            window.clearTimeout(showDialog.closeTimer);
        }

        function removeOpeningVoiceFallback() {
            document.removeEventListener("click", handleOpeningVoiceGesture, true);
            document.removeEventListener("touchstart", handleOpeningVoiceGesture, true);
            openingVoiceRetryBound = false;
            openingVoiceRetryPending = false;
        }

        function bindOpeningVoiceFallback() {
            if (openingVoiceRetryBound) {
                return;
            }

            openingVoiceRetryBound = true;
            document.addEventListener("click", handleOpeningVoiceGesture, true);
            document.addEventListener("touchstart", handleOpeningVoiceGesture, {
                capture: true,
                passive: true
            });
        }

        function tryPlayOpeningVoice(allowRetry) {
            if (openingVoicePlaying) {
                return Promise.resolve(false);
            }

            openingVoicePlaying = true;
            return playOpeningVoice().then(function (played) {
                openingVoicePlaying = false;

                if (!played && allowRetry) {
                    openingVoiceRetryPending = true;
                    bindOpeningVoiceFallback();
                } else if (played) {
                    removeOpeningVoiceFallback();
                }

                return played;
            });
        }

        function retryOpeningVoiceFromGesture() {
            if (!openingVoiceRetryPending) {
                return;
            }

            removeOpeningVoiceFallback();
            tryPlayOpeningVoice(false);
        }

        function handleOpeningVoiceGesture() {
            retryOpeningVoiceFromGesture();
        }

        function syncLive2DPopupPositions() {
            positionDefaultTips();

            if (dialog.classList.contains("is-open")) {
                positionLive2DPopup(dialog, {
                    width: 362,
                    height: 220,
                    offsetY: 68
                });
            }

            if (openingBubble.textContent) {
                positionLive2DPopup(openingBubble, {
                    width: 328,
                    height: 96,
                    offsetY: 56
                });
            }
        }

        function closeDialog() {
            clearSpinTimers();
            stopMusicPlayback();
            dialog.classList.remove("is-open", "is-opening");
            window.clearTimeout(showDialog.closeTimer);
        }

        function addOption(label, onClick) {
            const button = document.createElement("button");
            button.className = "live2d-quiz__option";
            button.type = "button";
            button.textContent = label;
            button.addEventListener("click", function (event) {
                event.stopPropagation();
                onClick(button, event);
            });
            options.appendChild(button);
            return button;
        }

        function showMenu(event) {
            if (window.JunxueLive2DDrag && typeof window.JunxueLive2DDrag.shouldIgnoreMenuEvent === "function" && window.JunxueLive2DDrag.shouldIgnoreMenuEvent(event)) {
                return;
            }

            if (event && typeof event.preventDefault === "function") {
                event.preventDefault();
            }

            if (firstClickVoicePlaying) {
                return;
            }

            if (event) {
                retryOpeningVoiceFromGesture();
            }

            if (event && !openingVoicePlaying && !hasPlayedFirstClickVoice()) {
                firstClickVoicePlaying = true;
                markFirstClickVoicePlayed();
                clearDialog();
                question.textContent = firstClickVoiceText;
                showDialog();
                playVoice(firstClickVoicePath).then(function () {
                    firstClickVoicePlaying = false;
                    showMenu();
                });
                return;
            }

            clearDialog();
            question.textContent = "想和君雪做什么？";
            options.classList.add("live2d-quiz__menu");
            addOption("无奖竞答", startQuiz);
            addOption("英雄池转盘", showHeroWheel);
            addOption("咨询", showConsultPanel);
            showDialog();
        }

        function startQuiz() {
            quizState = {
                correct: 0,
                wrong: 0,
                correctStreak: 0,
                wrongStreak: 0,
                lastQuestion: null,
                currentQuestion: null,
                answered: false
            };
            renderQuizQuestion();
            showDialog();
        }

        function renderQuizQuestion() {
            const current = pickQuizQuestion();

            quizState.currentQuestion = current;
            quizState.answered = false;
            clearDialog();
            meta.textContent = "无奖竞答 · 第 " + (quizState.correct + quizState.wrong + 1) + " 题";
            question.textContent = current.question;

            current.options.forEach(function (option, index) {
                addOption(letters[index] + "：" + option, function (button) {
                    answerQuiz(index, button);
                });
            });
        }

        function answerQuiz(selectedIndex, selectedButton) {
            const current = quizState.currentQuestion;
            const optionButtons = options.querySelectorAll(".live2d-quiz__option");
            const isCorrect = current.correct.indexOf(selectedIndex) !== -1;

            if (quizState.answered) {
                return;
            }

            quizState.answered = true;
            quizState.lastQuestion = current;
            optionButtons.forEach(function (button) {
                button.disabled = true;
            });

            current.correct.forEach(function (answerIndex) {
                if (optionButtons[answerIndex]) {
                    optionButtons[answerIndex].classList.add("is-correct");
                }
            });

            if (isCorrect) {
                quizState.correct += 1;
                quizState.correctStreak += 1;
                quizState.wrongStreak = 0;
                selectedButton.classList.add("is-correct");
                result.textContent = quizState.correctStreak >= 3 ? "看来你很懂君雪呢～" : "真棒，离天才又进一步";
                result.className = "live2d-quiz__result is-good";
            } else {
                quizState.wrong += 1;
                quizState.wrongStreak += 1;
                quizState.correctStreak = 0;
                selectedButton.classList.add("is-wrong");
                result.textContent = quizState.wrongStreak >= 3 ? "你还没有君雪一半聪明哦～" : "真笨，这么简单都不会，去问问君雪吧";
                result.className = "live2d-quiz__result is-warning";
            }

            addPostAnswerActions();
        }

        function addPostAnswerActions() {
            addOption("继续挑战", renderQuizQuestion);
            addOption("换个问题", renderQuizQuestion);
            addOption("不玩了", showQuizScore);
        }

        function showQuizScore() {
            clearDialog();
            meta.textContent = "无奖竞答结算";
            question.innerHTML = "本次成绩：<br>答对 " + quizState.correct + " 题<br>答错 " + quizState.wrong + " 题";
            options.classList.add("live2d-quiz__menu");
            addOption("继续挑战", startQuiz);
            addOption("回到菜单", function () {
                showMenu();
            });
            result.textContent = quizState.correct >= quizState.wrong ? "不错嘛，君雪记下这次成绩了" : "下次再来，君雪等你反超";
            result.className = quizState.correct >= quizState.wrong ? "live2d-quiz__result is-good" : "live2d-quiz__result is-neutral";
        }

        function showConsultPanel() {
            clearDialog();
            meta.textContent = "咨询";
            question.textContent = "君雪可以帮你看看这些事情。";
            options.classList.add("live2d-consult-grid");
            addConsultCard("查看天气", "查询近三天天气", false, showWeatherInput);
            addConsultCard("听歌", "播放本地歌曲", false, showMusicPlayer);
            addConsultCard("暂未开放", "君雪还在准备", true);
            addConsultCard("暂未开放", "先留一个小悬念", true);
            result.textContent = "先试试天气吧。";
            result.className = "live2d-quiz__result is-neutral";
            showDialog();
        }

        function addConsultCard(title, description, disabled, onClick) {
            const button = document.createElement("button");
            button.className = "live2d-consult-card";
            button.type = "button";
            button.disabled = disabled;
            button.innerHTML = '<span class="live2d-consult-card__title">' + escapeHtml(title) + '</span><span class="live2d-consult-card__desc">' + escapeHtml(description) + '</span>';

            if (!disabled && typeof onClick === "function") {
                button.addEventListener("click", function (event) {
                    event.stopPropagation();
                    onClick();
                });
            }

            options.appendChild(button);
            return button;
        }

        function getCurrentMusic() {
            return musicList[currentMusicIndex] || musicList[0];
        }

        function syncMusicAudioSource() {
            const currentMusic = getCurrentMusic();

            if (!currentMusic || musicAudio.getAttribute("src") === currentMusic.src) {
                return;
            }

            musicAudio.src = currentMusic.src;
        }

        function renderMusicPlayerContent() {
            const currentMusic = getCurrentMusic();
            const listHtml = musicList.map(function (music, index) {
                const isCurrent = index === currentMusicIndex ? " is-current" : "";

                return '<button class="live2d-music-track' + isCurrent + '" type="button" data-music-index="' + index + '">' + escapeHtml(music.title) + '</button>';
            }).join("");

            options.innerHTML = [
                '<div class="live2d-music-player">',
                    '<div class="live2d-music-current">当前播放：<span>' + escapeHtml(currentMusic ? currentMusic.title : "暂无歌曲") + '</span></div>',
                    '<div class="live2d-music-list" aria-label="歌曲列表">' + listHtml + '</div>',
                    '<div class="live2d-music-controls">',
                        '<button class="live2d-wheel__small" type="button" data-music-action="prev">上一首</button>',
                        '<button class="live2d-wheel__small" type="button" data-music-action="toggle">' + (musicPlaying ? "暂停" : "播放") + '</button>',
                        '<button class="live2d-wheel__small" type="button" data-music-action="next">下一首</button>',
                    '</div>',
                    '<div class="live2d-music-actions">',
                        '<button class="live2d-wheel__small" type="button" data-music-action="back">返回咨询</button>',
                        '<button class="live2d-wheel__small" type="button" data-music-action="menu">回到菜单</button>',
                    '</div>',
                '</div>'
            ].join("");

            bindMusicPlayerActions();
        }

        function playCurrentMusic() {
            const currentMusic = getCurrentMusic();

            if (!currentMusic) {
                return;
            }

            syncMusicAudioSource();
            musicAudio.play().then(function () {
                musicPlaying = true;
                renderMusicPlayerContent();
            }).catch(function () {
                musicPlaying = false;
                renderMusicPlayerContent();
            });
        }

        function pauseCurrentMusic() {
            musicAudio.pause();
            musicPlaying = false;
            renderMusicPlayerContent();
        }

        function selectMusic(index, shouldPlay) {
            if (!musicList.length) {
                return;
            }

            currentMusicIndex = (index + musicList.length) % musicList.length;
            musicAudio.pause();
            musicAudio.removeAttribute("src");
            musicAudio.load();
            musicPlaying = false;
            renderMusicPlayerContent();

            if (shouldPlay) {
                playCurrentMusic();
            }
        }

        function bindMusicPlayerActions() {
            options.querySelectorAll("[data-music-index]").forEach(function (button) {
                button.addEventListener("click", function (event) {
                    event.stopPropagation();
                    selectMusic(Number(button.dataset.musicIndex), musicPlaying);
                });
            });

            options.querySelectorAll("[data-music-action]").forEach(function (button) {
                button.addEventListener("click", function (event) {
                    event.stopPropagation();
                    const action = button.dataset.musicAction;

                    if (action === "toggle") {
                        if (musicPlaying) {
                            pauseCurrentMusic();
                            return;
                        }

                        playCurrentMusic();
                        return;
                    }

                    if (action === "prev") {
                        selectMusic(currentMusicIndex - 1, musicPlaying);
                        return;
                    }

                    if (action === "next") {
                        selectMusic(currentMusicIndex + 1, musicPlaying);
                        return;
                    }

                    if (action === "back") {
                        showConsultPanel();
                        return;
                    }

                    if (action === "menu") {
                        showMenu();
                    }
                });
            });
        }

        function showMusicPlayer() {
            clearDialog();
            dialog.classList.add("is-music");
            options.classList.add("live2d-music-panel");
            meta.textContent = "咨询 · 听歌";
            question.innerHTML = '<span class="live2d-music-title">♪ 听歌</span><span class="live2d-music-subtitle">甘雨想和你分享一些音乐呢～</span>';
            syncMusicAudioSource();
            renderMusicPlayerContent();
            result.textContent = "需要你点播放，君雪才会开始放歌。";
            result.className = "live2d-quiz__result is-neutral";
            musicAudio.onended = function () {
                musicPlaying = false;
                renderMusicPlayerContent();
            };
            showDialog();
        }

        function showWeatherInput() {
            clearDialog();
            dialog.classList.add("is-weather");
            options.classList.add("live2d-weather-panel");
            meta.textContent = "咨询 · 查看天气";
            question.textContent = "请输入你想查询天气的城市";
            options.innerHTML = [
                '<form class="live2d-weather-form">',
                    '<input class="live2d-weather-input" type="text" name="city" placeholder="例如：北京 / 上海 / 杭州" autocomplete="off">',
                    '<button class="live2d-weather-submit" type="submit">查询</button>',
                '</form>',
                '<div class="live2d-weather-actions">',
                    '<button class="live2d-wheel__small" type="button" data-weather-action="back">返回咨询</button>',
                    '<button class="live2d-wheel__small" type="button" data-weather-action="menu">回到菜单</button>',
                '</div>'
            ].join("");

            const form = options.querySelector(".live2d-weather-form");
            const cityInput = options.querySelector(".live2d-weather-input");
            const backButton = options.querySelector('[data-weather-action="back"]');
            const menuButton = options.querySelector('[data-weather-action="menu"]');

            form.addEventListener("submit", function (event) {
                event.preventDefault();
                const cityName = cityInput.value.trim();

                if (!cityName) {
                    result.textContent = "先告诉君雪城市名哦～";
                    result.className = "live2d-quiz__result is-warning";
                    return;
                }

                fetchWeather(cityName);
            });
            backButton.addEventListener("click", function (event) {
                event.stopPropagation();
                showConsultPanel();
            });
            menuButton.addEventListener("click", function (event) {
                event.stopPropagation();
                showMenu();
            });

            result.textContent = "哼，可不是特意帮你查天气哦～只是顺手看看那边有没有下雨而已。";
            result.className = "live2d-quiz__result is-neutral";
            showDialog();
            window.setTimeout(function () {
                cityInput.focus();
            }, 80);
        }

        async function fetchWeather(cityName) {
            const normalizedCity = normalizeCityName(cityName);
            const fallbackPlace = cityFallbackMap[normalizedCity];
            const encodedCity = encodeURIComponent(cityName);
            const geocodeUrl = "https://geocoding-api.open-meteo.com/v1/search?name=" + encodedCity + "&count=1&language=zh&format=json";

            result.textContent = "君雪正在翻天气书...";
            result.className = "live2d-quiz__result is-neutral";

            try {
                if (fallbackPlace) {
                    const fallbackForecastUrl = "https://api.open-meteo.com/v1/forecast?latitude=" + encodeURIComponent(fallbackPlace.latitude) + "&longitude=" + encodeURIComponent(fallbackPlace.longitude) + "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum&timezone=auto&forecast_days=3";
                    const fallbackForecastResponse = await fetch(fallbackForecastUrl);

                    if (!fallbackForecastResponse.ok) {
                        throw new Error("weather-request-failed");
                    }

                    const fallbackForecastData = await fallbackForecastResponse.json();
                    renderWeatherCard(fallbackPlace, fallbackForecastData.daily || {});
                    return;
                }

                const geoResponse = await fetch(geocodeUrl);

                if (!geoResponse.ok) {
                    throw new Error("weather-request-failed");
                }

                const geoData = await geoResponse.json();

                if (!geoData.results || !geoData.results.length) {
                    result.textContent = "君雪没有找到这个地方哦～";
                    result.className = "live2d-quiz__result is-warning";
                    return;
                }

                const place = geoData.results[0];
                const forecastUrl = "https://api.open-meteo.com/v1/forecast?latitude=" + encodeURIComponent(place.latitude) + "&longitude=" + encodeURIComponent(place.longitude) + "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum&timezone=auto&forecast_days=3";
                const forecastResponse = await fetch(forecastUrl);

                if (!forecastResponse.ok) {
                    throw new Error("weather-request-failed");
                }

                const forecastData = await forecastResponse.json();
                renderWeatherCard(place, forecastData.daily || {});
            } catch (error) {
                result.textContent = "天气被云层挡住啦，稍后再试吧～";
                result.className = "live2d-quiz__result is-warning";
            }
        }

        function renderWeatherCard(place, daily) {
            const cityTitle = [place.name, place.admin1, place.country].filter(Boolean).join(" · ");
            const dates = daily.time || [];
            const maxTemps = daily.temperature_2m_max || [];
            const minTemps = daily.temperature_2m_min || [];
            const codes = daily.weather_code || [];
            const rows = [0, 1, 2].map(function (index) {
                return [
                    '<article class="live2d-weather-day">',
                        '<div class="live2d-weather-day__label">' + getDayLabel(index) + '</div>',
                        '<div class="live2d-weather-day__date">' + escapeHtml(dates[index] || "") + '</div>',
                        '<div class="live2d-weather-day__status">' + escapeHtml(getWeatherLabel(codes[index])) + '</div>',
                        '<div class="live2d-weather-day__temp">' + formatTemperature(maxTemps[index]) + ' / ' + formatTemperature(minTemps[index]) + '</div>',
                        '<div class="live2d-weather-day__rain">' + escapeHtml(getPrecipitationText(daily, index)) + '</div>',
                    '</article>'
                ].join("");
            }).join("");

            clearDialog();
            dialog.classList.add("is-weather");
            options.classList.add("live2d-weather-panel");
            meta.textContent = "咨询 · 查看天气";
            question.textContent = cityTitle;
            options.innerHTML = [
                '<section class="live2d-weather-card" aria-label="三天天气预报">',
                    rows,
                '</section>',
                '<div class="live2d-weather-actions">',
                    '<button class="live2d-wheel__small" type="button" data-weather-action="again">换个城市</button>',
                    '<button class="live2d-wheel__small" type="button" data-weather-action="back">返回咨询</button>',
                '</div>'
            ].join("");

            options.querySelector('[data-weather-action="again"]').addEventListener("click", function (event) {
                event.stopPropagation();
                showWeatherInput();
            });
            options.querySelector('[data-weather-action="back"]').addEventListener("click", function (event) {
                event.stopPropagation();
                showConsultPanel();
            });
            result.textContent = "天气小卡片准备好了。";
            result.className = "live2d-quiz__result is-good";
            showDialog();
        }

        function showHeroWheel() {
            clearDialog();
            dialog.classList.add("is-wheel");
            options.classList.add("live2d-quiz__wheel-panel");
            meta.textContent = "英雄池转盘";
            question.textContent = "先选分路，再让君雪帮你抽一个英雄。";
            options.innerHTML = [
                '<div class="live2d-wheel__lanes" aria-label="选择分路"></div>',
                '<div class="live2d-wheel" aria-label="英雄转盘">',
                    '<div class="live2d-wheel__pointer"></div>',
                    '<div class="live2d-wheel__disc">',
                        '<div class="live2d-wheel__ring"></div>',
                    '</div>',
                    '<div class="live2d-wheel__hero" aria-live="polite">准备抽取</div>',
                '</div>',
                '<button class="live2d-wheel__draw" type="button">开始抽取</button>',
                '<div class="live2d-wheel__actions">',
                    '<button class="live2d-wheel__small" type="button" data-action="again">重新抽取</button>',
                    '<button class="live2d-wheel__small" type="button" data-action="back">回到菜单</button>',
                '</div>'
            ].join("");

            const lanes = options.querySelector(".live2d-wheel__lanes");
            const disc = options.querySelector(".live2d-wheel__disc");
            const heroName = options.querySelector(".live2d-wheel__hero");
            const drawButton = options.querySelector(".live2d-wheel__draw");
            const againButton = options.querySelector('[data-action="again"]');
            const backButton = options.querySelector('[data-action="back"]');

            Object.keys(heroPools).forEach(function (lane) {
                const button = document.createElement("button");
                button.className = "live2d-wheel__lane";
                button.type = "button";
                button.dataset.lane = lane;
                button.textContent = laneLabels[lane];
                button.addEventListener("click", function (event) {
                    event.stopPropagation();
                    if (drawButton.disabled) {
                        return;
                    }

                    selectedLane = lane;
                    updateLaneButtons();
                    previewHeroNames();
                    result.textContent = "已选择：" + laneLabels[selectedLane];
                    result.className = "live2d-quiz__result is-neutral";
                });
                lanes.appendChild(button);
            });

            function setControlsDisabled(disabled) {
                drawButton.disabled = disabled;
                againButton.disabled = disabled;
                lanes.querySelectorAll("button").forEach(function (button) {
                    button.disabled = disabled;
                });
            }

            function updateLaneButtons() {
                lanes.querySelectorAll("button").forEach(function (button) {
                    button.classList.toggle("is-active", button.dataset.lane === selectedLane);
                });
            }

            function previewHeroNames() {
                heroName.textContent = shuffle(heroPools[selectedLane]).slice(0, 3).join(" / ");
            }

            function drawHero() {
                const pool = heroPools[selectedLane];
                const hero = pool[Math.floor(Math.random() * pool.length)];

                clearSpinTimers();
                setControlsDisabled(true);
                result.textContent = "转盘启动中，君雪正在认真思考...";
                result.className = "live2d-quiz__result is-neutral";
                disc.classList.add("is-spinning");
                wheelRotation += 1440 + Math.floor(Math.random() * 720);
                disc.style.transform = "rotate(" + wheelRotation + "deg)";

                heroSpinTimer = window.setInterval(function () {
                    heroName.textContent = pool[Math.floor(Math.random() * pool.length)];
                }, 80);

                heroSpinTimeout = window.setTimeout(function () {
                    clearSpinTimers();
                    heroName.textContent = hero;
                    disc.classList.remove("is-spinning");
                    setControlsDisabled(false);
                    result.textContent = "君雪为你抽到了：" + hero;
                    result.className = "live2d-quiz__result is-good";
                }, 1900);
            }

            drawButton.addEventListener("click", function (event) {
                event.stopPropagation();
                drawHero();
            });
            againButton.addEventListener("click", function (event) {
                event.stopPropagation();
                drawHero();
            });
            backButton.addEventListener("click", function (event) {
                event.stopPropagation();
                showMenu();
            });

            updateLaneButtons();
            previewHeroNames();
            result.textContent = "已选择：" + laneLabels[selectedLane];
            result.className = "live2d-quiz__result is-neutral";
            showDialog();
        }

        function bindNode(node) {
            if (!node || boundNodes.has(node) || node === dialog || dialog.contains(node)) {
                return;
            }

            boundNodes.add(node);
            node.style.pointerEvents = "auto";

            if (node !== hitArea) {
                node.style.zIndex = node.style.zIndex || "42";
            }

            node.addEventListener("click", showMenu, true);
            node.addEventListener("touchstart", showMenu, {
                capture: true,
                passive: false
            });
        }

        function bindLive2DRoots() {
            findLive2DRoots().forEach(bindNode);
        }

        bindNode(hitArea);
        bindLive2DRoots();

        const observer = new MutationObserver(bindLive2DRoots);
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        window.setTimeout(bindLive2DRoots, 500);
        window.setTimeout(bindLive2DRoots, 1500);
        window.setTimeout(bindLive2DRoots, 3000);
        window.addEventListener("live2d-stage-position-changed", syncLive2DPopupPositions);
        window.addEventListener("resize", syncLive2DPopupPositions);
        window.setTimeout(syncLive2DPopupPositions, 500);
        window.setTimeout(syncLive2DPopupPositions, 1500);
        window.setTimeout(syncLive2DPopupPositions, 3000);
        showOpeningBubble(openingBubble);
        tryPlayOpeningVoice(true);

        closeButton.addEventListener("click", function (event) {
            event.stopPropagation();
            closeDialog();
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                closeDialog();
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initInteractions);
        return;
    }

    initInteractions();
})();
