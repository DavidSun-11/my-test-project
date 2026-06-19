/* Live2D 互动模块：菜单、无奖竞答题库、英雄池转盘、咨询功能都集中在这里，方便后续继续加题。 */
(function () {
    if (window.__JUNXUE_LIVE2D_LAZY_INTERACTIONS_INSTALLED__ && window.Live2DInteractiveMenu && window.Live2DInteractiveMenu.ready) {
        return;
    }

    window.__JUNXUE_LIVE2D_LAZY_INTERACTIONS_INSTALLED__ = true;

    if (window.Live2DInteractiveMenu && window.Live2DInteractiveMenu.ready) {
        return;
    }

    if (typeof window.enableGanyuIdleTalk !== "boolean") {
        window.enableGanyuIdleTalk = true;
    }

    const SUPABASE_LOCAL_SDK = "assets/vendor/supabase-js-2.min.js?v=20260616-1";
    const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.108.2/dist/umd/supabase.min.js";
    const SUPABASE_SDK_LOAD_ERROR_TEXT = "老板评价功能加载失败，可能是网络暂时不稳定，请稍后再试。";
    const SCORE_GUESS_CHOICES = ["铜牌", "银牌", "金牌", "顶级", "无"];
    const SCORE_GUESS_LOAD_ERROR_TEXT = "评分竞猜暂时加载失败，可能是网络不稳定，请稍后再试。";
    let scoreGuessRealtimeChannels = [];
    let scoreGuessRealtimeWarningShown = false;
    let scoreGuessState = {
        client: null,
        session: null,
        authSession: null,
        votes: [],
        isAdmin: false,
        realtimeWarning: false
    };

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
    const quizExitVoiceText = "今天的题目就到这里啦～\n如果下次还想考考自己，记得再来找甘雨哦。";
    const quizExitVoicePath = "assets/audio/ganyu_quiz_exit.mp3";
    const fortuneVoicePath = "assets/audio/ganyu_fortune.mp3";
    const fortuneBubbleText = "星象已经给出答案了，剩下的路，要由你自己决定。";
    const fortuneStorageKeyPrefix = "junxue_fortune_";
    // 以后新增本地歌曲，只需要把 mp3 放到 assets/audio/，然后在 LOCAL_MUSIC_TRACKS 里加一项。
    // lrc 可以先预留，后续再做歌词显示。本轮不要加载 lrc。
    const LOCAL_MUSIC_TRACKS = [
        { title: "感谢你曾来过", artist: "", src: "assets/audio/music.mp3" },
        { title: "不要说话", artist: "", src: "assets/audio/dont-speak.mp3" },
        {
            title: "学会自己长大",
            artist: "Rom邢锐",
            src: "assets/audio/xuehui-ziji-zhangda.mp3",
            lrc: "assets/lyrics/xuehui-ziji-zhangda.lrc"
        },
        {
            title: "妈妈的话",
            artist: "渡川",
            src: "assets/audio/mamadehua.mp3",
            lrc: "assets/lyrics/mamadehua.lrc"
        },
        {
            title: "念旧",
            artist: "姜铭杨",
            src: "assets/audio/nianjiu.mp3",
            lrc: "assets/lyrics/nianjiu.lrc"
        }
    ];
    const musicList = LOCAL_MUSIC_TRACKS;
    const fortuneLevels = ["大吉", "中吉", "小吉", "平", "小凶"];
    const fortuneLevelClasses = {
        "大吉": "live2d-fortune-value--great",
        "中吉": "live2d-fortune-value--good",
        "小吉": "live2d-fortune-value--small-good",
        "平": "live2d-fortune-value--plain",
        "小凶": "live2d-fortune-value--caution"
    };
    const luckyColors = ["月白", "星蓝", "霜紫", "云粉", "雪青", "晨金", "海盐蓝", "薄荷绿", "樱花粉"];
    const fortuneAdviceList = [
        "把重要的事情放在上午完成，心会更安定。",
        "慢一点也没关系，今天适合稳稳地前进。",
        "适合整理计划，也适合给自己留一点休息时间。",
        "遇到犹豫时，先做最小的一步。",
        "今天适合和可靠的人说说心里话。",
        "别急着否定自己，答案会在行动里慢慢清楚。",
        "给桌面、心情和任务都留一点空白。",
        "如果感到疲惫，就先把呼吸放慢。",
        "适合尝试一件一直想做的小事。",
        "保持温柔，但也别忘了坚定自己的边界。"
    ];
    const ganyuCalendarTips = [
        "今天也要认真完成自己的事务哦。",
        "把事情一件一件整理好，心也会慢慢安定下来。",
        "如果累了，就给自己留一点休息时间吧。",
        "愿今天的你，也能遇到一点温柔的幸运。",
        "先完成最重要的小事，剩下的路会清楚很多。",
        "不要太勉强自己，稳定前进也很好。",
        "记得喝水，也记得照顾好心情。",
        "今日的星光很安静，适合认真生活。"
    ];
    const ganyuQuotes = [
        "星空会指引方向，但选择的人始终是你。",
        "月光落下来的时候，也会替努力的人照亮脚边的路。",
        "若今天的风有些冷，就把心事先交给云吧。",
        "甘雨相信，慢慢走的人也会抵达很远的地方。",
        "星河不会催促你，它只是在安静地陪你向前。",
        "愿你今晚睡得安稳，明天醒来仍有期待。",
        "温柔不是软弱，是在风雪里仍愿意守住光。",
        "有些答案不必立刻找到，先照顾好自己也很好。",
        "若前路暂时看不清，就先看向离你最近的一颗星。",
        "今天已经做得很好了，请把这句话也算进收获里。",
        "每一盏灯火背后，都有值得被珍惜的平凡愿望。",
        "云散之前，月亮也一直在那里。",
        "愿你的努力像霜花一样，安静却闪闪发亮。",
        "把不安放轻一点，把喜欢的事握紧一点。",
        "就算只是小小一步，也是在向自己的明天靠近。"
    ];
    const ganyuIdleLines = [
        "今天也辛苦了，记得休息一下哦。",
        "如果累了，就先停下来看看星空吧。",
        "我会在这里陪着你的。",
        "月光很安静，像是适合思考的夜晚。",
        "不用着急，慢慢来也可以。",
        "你回来啦，我刚好也在等你。",
        "今天想听歌，还是想占卜呢？",
        "如果有什么烦恼，也可以告诉我。",
        "星光很远，但总会抵达眼前。",
        "希望今天的你，也能被温柔以待。",
        "别总是熬夜哦，身体也很重要。",
        "天气冷的话，要记得添衣。",
        "今天的心情怎么样？",
        "能再见到你，我很开心。",
        "即使只是安静待着，也很好。",
        "愿你今天遇到一点小小的幸运。",
        "如果不知道该做什么，就先喝口水吧。",
        "我会认真听你说的。",
        "今晚的星空，看起来很适合许愿。",
        "请不要太勉强自己。",
        "云很轻，心事也可以慢慢放轻。",
        "就算只是安静地待一会儿，也没关系。",
        "愿星光替你留住一点温柔。",
        "今天也请把自己放在心上。",
        "不开心的时候，也可以先深呼吸一下。",
        "慢慢整理思绪，答案会清楚起来的。",
        "月海亭的工作很多，但我会抽空陪你。",
        "无论今天怎样，都请温柔地对待自己。",
        "夜风很轻，适合把烦恼暂时放下。",
        "愿你抬头时，刚好能看见一点光。",
        "如果今天有些疲惫，也请允许自己慢下来。",
        "把心事说出来一点，也许会轻松些。",
        "我会在这里，安静地陪你一会儿。"
    ];
    let musicAudio = null;

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

    function getDisplayNameFromAuthUser(user) {
        if (!user) {
            return "未登录";
        }

        const metadata = user.user_metadata || {};
        const name = metadata.nickname || metadata.display_name || metadata.full_name || metadata.name;

        if (typeof name === "string" && name.trim()) {
            return name.trim();
        }

        if (typeof user.email === "string" && user.email.indexOf("@") > 0) {
            return user.email.split("@")[0] || "已登录";
        }

        return "已登录";
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
            ".live2d-quiz-exit-bubble{position:fixed;left:252px;top:160px;z-index:62;width:min(318px,calc(100vw - 32px));padding:12px 14px;border:1px solid rgba(213,244,255,.76);border-radius:16px;background:linear-gradient(145deg,rgba(255,178,218,.7),rgba(126,219,255,.58));box-shadow:0 0 22px rgba(126,219,255,.28),0 0 18px rgba(255,142,196,.24),inset 0 0 14px rgba(255,255,255,.14);backdrop-filter:blur(10px);color:rgba(50,32,72,.96);font-size:14px;line-height:1.55;letter-spacing:0;white-space:pre-line;pointer-events:none;opacity:0;transform:translateY(8px);transition:opacity .35s ease,transform .35s ease;}",
            ".live2d-quiz-exit-bubble.is-open{opacity:1;transform:translateY(0);}",
            ".live2d-quiz-exit-bubble.is-fading{opacity:0;transform:translateY(-6px);}",
            ".live2d-idle-bubble{position:fixed;left:252px;top:160px;z-index:62;width:min(318px,calc(100vw - 32px));padding:12px 14px;border:1px solid rgba(213,244,255,.78);border-radius:16px;background:linear-gradient(145deg,rgba(255,182,220,.72),rgba(132,221,255,.58));box-shadow:0 0 20px rgba(126,219,255,.26),0 0 16px rgba(255,142,196,.22),inset 0 0 14px rgba(255,255,255,.14);backdrop-filter:blur(10px);color:rgba(48,32,72,.96);font-size:14px;line-height:1.55;letter-spacing:0;pointer-events:none;opacity:0;transform:translateY(8px);transition:opacity .35s ease,transform .35s ease;}",
            ".live2d-idle-bubble.is-open{opacity:1;transform:translateY(0);}",
            ".live2d-idle-bubble.is-fading{opacity:0;transform:translateY(-6px);}",
            ".live2d-quiz.is-main-menu,.live2d-quiz.is-score-guess{border:1px solid rgba(173,234,255,.72);border-radius:22px;background:radial-gradient(circle at 18% 0%,rgba(128,221,255,.26),transparent 38%),radial-gradient(circle at 88% 14%,rgba(213,170,255,.18),transparent 36%),linear-gradient(145deg,rgba(16,39,68,.9),rgba(24,57,90,.78) 52%,rgba(31,42,84,.82));box-shadow:0 18px 46px rgba(3,18,42,.48),0 0 30px rgba(93,204,255,.24),inset 0 1px 0 rgba(255,255,255,.24),inset 0 -18px 34px rgba(123,94,220,.14);-webkit-backdrop-filter:blur(18px) saturate(1.18);backdrop-filter:blur(18px) saturate(1.18);}",
            ".live2d-quiz.is-main-menu::before,.live2d-quiz.is-score-guess::before{content:\"\";position:absolute;left:18px;right:52px;top:10px;height:1px;background:linear-gradient(90deg,transparent,rgba(202,246,255,.78),rgba(213,178,255,.46),transparent);pointer-events:none;}",
            ".live2d-quiz.is-main-menu .live2d-quiz__close,.live2d-quiz.is-score-guess .live2d-quiz__close{width:30px;height:30px;border-radius:999px;border:1px solid rgba(207,242,255,.72);background:rgba(9,28,54,.56);box-shadow:0 0 16px rgba(109,218,255,.22),inset 0 0 10px rgba(255,255,255,.12);color:rgba(235,250,255,.98);}",
            ".live2d-quiz.is-main-menu .live2d-quiz__close:hover,.live2d-quiz.is-score-guess .live2d-quiz__close:hover{background:rgba(72,160,218,.5);box-shadow:0 0 22px rgba(121,223,255,.36);}",
            ".live2d-menu-header,.score-guess-header{display:grid;gap:8px;}",
            ".live2d-menu-title,.score-guess-title{font-size:20px;font-weight:800;color:rgba(237,250,255,.98);text-shadow:0 0 16px rgba(102,213,255,.32);letter-spacing:0;}",
            ".live2d-menu-user,.score-guess-account{display:inline-flex;align-items:center;width:max-content;max-width:100%;padding:5px 10px;border:1px solid rgba(179,234,255,.52);border-radius:999px;background:linear-gradient(90deg,rgba(87,185,230,.18),rgba(184,145,255,.16));color:rgba(218,244,255,.92);font-size:12px;line-height:1.35;}",
            ".live2d-quiz.is-main-menu .live2d-quiz__menu{grid-template-columns:1fr 1fr;gap:10px;}",
            ".live2d-quiz.is-main-menu .live2d-quiz__option{position:relative;min-height:50px;justify-content:flex-start;padding:12px 14px 12px 40px;border:1px solid rgba(171,232,255,.55);border-radius:16px;background:linear-gradient(145deg,rgba(33,77,116,.66),rgba(28,48,92,.55));box-shadow:inset 0 1px 0 rgba(255,255,255,.2),0 8px 20px rgba(0,16,44,.2);font-weight:750;color:rgba(235,250,255,.98);}",
            ".live2d-quiz.is-main-menu .live2d-quiz__option::before{content:attr(data-menu-icon);position:absolute;left:13px;top:50%;transform:translateY(-50%);width:18px;height:18px;display:grid;place-items:center;border-radius:50%;background:radial-gradient(circle,rgba(206,250,255,.72),rgba(103,199,255,.28));box-shadow:0 0 14px rgba(133,221,255,.34);font-size:12px;color:#fff;}",
            ".live2d-quiz.is-main-menu .live2d-quiz__option:hover:not(:disabled){border-color:rgba(220,249,255,.88);background:linear-gradient(145deg,rgba(54,111,156,.78),rgba(55,68,130,.7));box-shadow:0 0 22px rgba(102,213,255,.26),inset 0 1px 0 rgba(255,255,255,.3);}",
            ".score-guess-header{padding:2px 0 4px;}",
            ".score-guess-kicker{width:max-content;padding:4px 10px;border:1px solid rgba(180,235,255,.56);border-radius:999px;background:rgba(103,202,255,.16);color:rgba(199,239,255,.96);font-size:12px;font-weight:700;}",
            ".score-guess-subtitle{color:rgba(218,237,255,.86);font-size:13px;line-height:1.55;}",
            ".score-guess-pill{display:inline-flex;width:max-content;padding:5px 10px;border-radius:999px;border:1px solid rgba(185,231,255,.52);background:linear-gradient(90deg,rgba(78,192,255,.22),rgba(184,139,255,.18));color:rgba(235,250,255,.94);font-size:12px;font-weight:750;}",
            ".score-guess-status{grid-column:1/-1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:2px;}",
            ".score-guess-status__item{padding:9px 10px;border:1px solid rgba(164,223,255,.42);border-radius:14px;background:linear-gradient(145deg,rgba(255,255,255,.09),rgba(91,173,233,.12));color:rgba(224,244,255,.92);font-size:12px;line-height:1.45;}",
            ".score-guess-grid{grid-column:1/-1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}",
            ".score-guess-option{position:relative;min-height:78px;text-align:left;overflow:hidden;border-radius:17px!important;padding:13px 13px 12px 48px!important;}",
            ".score-guess-option::before{content:\"\";position:absolute;left:14px;top:16px;width:22px;height:22px;border-radius:999px;background:var(--score-dot,rgba(170,216,255,.62));box-shadow:0 0 18px var(--score-glow,rgba(139,218,255,.38));}",
            ".score-guess-option::after{content:\"\";position:absolute;right:-18px;bottom:-22px;width:72px;height:72px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.16),transparent 64%);pointer-events:none;}",
            ".score-guess-option--bronze{--score-dot:linear-gradient(135deg,#ffe0ae,#b87835);--score-glow:rgba(225,147,65,.42);}",
            ".score-guess-option--silver{--score-dot:linear-gradient(135deg,#ffffff,#9fc2da);--score-glow:rgba(212,239,255,.46);}",
            ".score-guess-option--gold{--score-dot:linear-gradient(135deg,#fff7a8,#f0b332);--score-glow:rgba(255,210,68,.5);}",
            ".score-guess-option--top{--score-dot:radial-gradient(circle,#fff,#b891ff 45%,#64d6ff);--score-glow:rgba(188,137,255,.5);}",
            ".score-guess-option--none{--score-dot:linear-gradient(135deg,#c8d4e8,#6681a9);--score-glow:rgba(132,161,204,.36);}",
            ".score-guess-option .score-guess-option__name{display:block;color:rgba(245,252,255,.98);font-size:16px;font-weight:850;}",
            ".score-guess-option .score-guess-option__count{display:block;margin-top:5px;color:rgba(202,229,245,.86);font-size:12px;}",
            ".score-guess-option .score-guess-option__mark{display:inline-flex;margin-top:8px;padding:3px 8px;border-radius:999px;background:rgba(125,229,255,.18);border:1px solid rgba(181,243,255,.62);color:rgba(234,252,255,.98);font-size:11px;font-weight:800;}",
            ".score-guess-option.is-selected{border-color:rgba(224,250,255,.94)!important;background:linear-gradient(145deg,rgba(74,151,204,.82),rgba(95,70,158,.72))!important;box-shadow:0 0 26px rgba(112,221,255,.36),inset 0 0 18px rgba(255,255,255,.13)!important;}",
            ".score-guess-actions{grid-column:1/-1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:2px;}",
            ".score-guess-actions .live2d-quiz__option{min-height:42px;border-radius:13px;}",
            ".score-guess-actions .score-guess-action--primary{border-color:rgba(191,243,255,.82);background:linear-gradient(135deg,rgba(75,202,255,.78),rgba(160,112,255,.72));box-shadow:0 0 18px rgba(98,210,255,.28);}",
            ".score-guess-actions .score-guess-action--danger{border-color:rgba(255,198,216,.82);background:linear-gradient(135deg,rgba(245,105,156,.68),rgba(132,94,220,.68));}",
            ".score-guess-actions .score-guess-action--soft{background:rgba(32,65,104,.58);}",
            ".live2d-quiz.is-score-guess{background:radial-gradient(circle at 18% 0%,rgba(129,224,255,.34),transparent 34%),radial-gradient(circle at 94% 8%,rgba(209,160,255,.24),transparent 34%),linear-gradient(150deg,rgba(14,35,67,.94),rgba(27,61,101,.86) 48%,rgba(39,44,92,.88));box-shadow:0 20px 56px rgba(1,14,38,.58),0 0 40px rgba(94,207,255,.28),0 0 26px rgba(169,117,255,.18),inset 0 1px 0 rgba(255,255,255,.28),inset 0 -24px 44px rgba(93,74,184,.16);}",
            ".live2d-quiz.is-score-guess::after{content:\"\";position:absolute;right:20px;bottom:18px;width:86px;height:86px;border-radius:28px;background:linear-gradient(135deg,rgba(206,246,255,.12),rgba(168,129,255,.08));box-shadow:inset 0 0 0 1px rgba(215,247,255,.2);transform:rotate(12deg);pointer-events:none;}",
            ".score-guess-panel{display:grid!important;grid-template-columns:1fr!important;gap:12px!important;}",
            ".score-guess-panel__header{position:relative;display:grid;grid-template-columns:1fr auto;gap:8px 12px;align-items:start;padding:14px 16px;border:1px solid rgba(172,232,255,.42);border-radius:18px;background:linear-gradient(145deg,rgba(255,255,255,.1),rgba(108,196,255,.1));box-shadow:inset 0 1px 0 rgba(255,255,255,.22);}",
            ".score-guess-panel__header::before{content:\"\";position:absolute;left:18px;right:18px;top:0;height:1px;background:linear-gradient(90deg,transparent,rgba(224,250,255,.8),transparent);}",
            ".score-guess-panel__heading{display:grid;gap:7px;min-width:0;}",
            ".score-guess-panel__badge{width:max-content;padding:4px 10px;border-radius:999px;border:1px solid rgba(181,236,255,.6);background:rgba(92,201,255,.17);color:rgba(211,243,255,.96);font-size:12px;font-weight:750;}",
            ".score-guess-panel__state{justify-self:end;align-self:start;white-space:nowrap;padding:6px 11px;border-radius:999px;border:1px solid rgba(196,236,255,.58);background:linear-gradient(90deg,rgba(78,192,255,.24),rgba(184,139,255,.2));color:rgba(238,252,255,.96);font-size:12px;font-weight:850;box-shadow:0 0 16px rgba(100,211,255,.16);}",
            ".score-guess-panel__title{font-size:22px;font-weight:900;color:rgba(244,252,255,.98);text-shadow:0 0 18px rgba(111,218,255,.32);line-height:1.12;}",
            ".score-guess-panel__subtitle{color:rgba(214,237,255,.88);font-size:13px;line-height:1.55;}",
            ".score-guess-panel__meta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;padding:11px;border:1px solid rgba(158,222,255,.42);border-radius:17px;background:linear-gradient(145deg,rgba(8,30,58,.38),rgba(96,174,232,.12));}",
            ".score-guess-panel__meta-item{min-width:0;padding:10px 11px;border-radius:13px;background:rgba(255,255,255,.075);box-shadow:inset 0 1px 0 rgba(255,255,255,.14);}",
            ".score-guess-panel__meta-label{display:block;margin-bottom:4px;color:rgba(179,222,242,.82);font-size:11px;}",
            ".score-guess-panel__meta-value{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:rgba(242,252,255,.98);font-size:13px;font-weight:850;}",
            ".score-guess-panel__options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;}",
            ".score-guess-panel__options .score-guess-option--wide{grid-column:1/-1;}",
            ".score-guess-option{min-height:92px;padding:15px 14px 13px 54px!important;background:radial-gradient(circle at 95% 18%,rgba(255,255,255,.12),transparent 34%),linear-gradient(145deg,rgba(255,255,255,.1),rgba(70,135,190,.12))!important;border:1px solid rgba(165,228,255,.46)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 12px 22px rgba(0,12,38,.18)!important;}",
            ".score-guess-option::before{left:16px;top:17px;width:26px;height:26px;}",
            ".score-guess-option .score-guess-option__name{font-size:17px;line-height:1.2;}",
            ".score-guess-option .score-guess-option__count{margin-top:7px;font-size:12px;}",
            ".score-guess-option .score-guess-option__mark{position:absolute;right:12px;top:11px;margin:0;}",
            ".score-guess-option:hover:not(:disabled){border-color:rgba(221,250,255,.88)!important;box-shadow:0 0 22px rgba(105,217,255,.25),inset 0 1px 0 rgba(255,255,255,.25)!important;}",
            ".score-guess-option:disabled{cursor:default;}",
            ".score-guess-panel__actions{display:flex;flex-wrap:wrap;gap:9px;justify-content:flex-end;padding:11px;border:1px solid rgba(154,217,255,.34);border-radius:16px;background:linear-gradient(145deg,rgba(255,255,255,.07),rgba(90,165,224,.1));}",
            ".score-guess-panel__actions .live2d-quiz__option{width:auto;min-width:132px;min-height:42px;padding:10px 14px;border-radius:999px;}",
            ".score-guess-panel__actions .score-guess-action--soft:last-child{opacity:.82;}",
            ".score-guess-panel__footer-note{padding:10px 12px;border:1px solid rgba(169,226,255,.34);border-radius:14px;background:rgba(11,31,59,.36);color:rgba(220,240,255,.88);font-size:12px;line-height:1.5;}",
            "@media (max-width:768px){.live2d-quiz.is-main-menu .live2d-quiz__menu,.score-guess-grid,.score-guess-status,.score-guess-actions{grid-template-columns:1fr;}.live2d-menu-title,.score-guess-title{font-size:18px;}.live2d-menu-user,.score-guess-account,.score-guess-pill{font-size:11px;}.score-guess-option{min-height:70px;padding-left:44px!important;}.score-guess-option::before{left:13px;top:15px;width:20px;height:20px;}.score-guess-panel__header{grid-template-columns:1fr;}.score-guess-panel__state{justify-self:start;}.score-guess-panel__meta{grid-template-columns:1fr;}.score-guess-panel__options{grid-template-columns:1fr;}.score-guess-panel__actions{display:grid;grid-template-columns:1fr;}.score-guess-panel__actions .live2d-quiz__option{width:100%;min-width:0;}.score-guess-panel__title{font-size:20px;}}",
            "html.performance-low .live2d-quiz.is-main-menu,html.performance-low .live2d-quiz.is-score-guess{box-shadow:0 12px 28px rgba(3,18,42,.38),inset 0 1px 0 rgba(255,255,255,.18);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);}",
            "@media (max-width:768px){.live2d-opening-bubble,.live2d-quiz-exit-bubble,.live2d-idle-bubble{width:min(92vw,320px);max-width:calc(100vw - 24px);font-size:13px;box-sizing:border-box;}body.keyboard-open .live2d-opening-bubble,body.keyboard-open .live2d-quiz-exit-bubble,body.keyboard-open .live2d-idle-bubble{left:50%!important;right:auto!important;top:max(12px,env(safe-area-inset-top))!important;bottom:auto!important;width:min(92vw,320px)!important;max-width:calc(100vw - 24px)!important;max-height:min(54vh,320px);overflow:auto;transform:translateX(-50%)!important;}}"
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

    function createIdleBubble() {
        ensureOpeningBubbleStyles();

        const bubble = document.createElement("div");
        bubble.className = "live2d-idle-bubble";
        bubble.setAttribute("aria-live", "polite");
        document.body.appendChild(bubble);
        return bubble;
    }

    function createQuizExitBubble() {
        ensureOpeningBubbleStyles();

        const bubble = document.createElement("div");
        bubble.className = "live2d-quiz-exit-bubble";
        bubble.setAttribute("aria-live", "polite");
        document.body.appendChild(bubble);
        return bubble;
    }

    function createFortuneBubble() {
        ensureOpeningBubbleStyles();

        const bubble = document.createElement("div");
        bubble.className = "live2d-quiz-exit-bubble";
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

    function showQuizExitBubble(bubble) {
        bubble.textContent = quizExitVoiceText;
        positionLive2DPopup(bubble, {
            width: 318,
            height: 92,
            offsetY: 62
        });
        bubble.classList.remove("is-fading");
        bubble.classList.add("is-open");
        window.clearTimeout(showQuizExitBubble.timer);
        showQuizExitBubble.timer = window.setTimeout(function () {
            hideQuizExitBubble(bubble);
        }, 5000);
    }

    function hideQuizExitBubble(bubble) {
        window.clearTimeout(showQuizExitBubble.timer);
        bubble.classList.add("is-fading");
        bubble.classList.remove("is-open");
        window.clearTimeout(hideQuizExitBubble.timer);
        hideQuizExitBubble.timer = window.setTimeout(function () {
            bubble.classList.remove("is-fading");
            bubble.textContent = "";
        }, 360);
    }

    function showFortuneBubble(bubble) {
        bubble.textContent = fortuneBubbleText;
        positionLive2DPopup(bubble, {
            width: 318,
            height: 92,
            offsetY: 62
        });
        bubble.classList.remove("is-fading");
        bubble.classList.add("is-open");
        window.clearTimeout(showFortuneBubble.timer);
        showFortuneBubble.timer = window.setTimeout(function () {
            hideFortuneBubble(bubble);
        }, 6000);
    }

    function hideFortuneBubble(bubble) {
        window.clearTimeout(showFortuneBubble.timer);
        bubble.classList.add("is-fading");
        bubble.classList.remove("is-open");
        window.clearTimeout(hideFortuneBubble.timer);
        hideFortuneBubble.timer = window.setTimeout(function () {
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
        const margin = settings.margin || 8;
        const fallbackWidth = settings.width || 330;
        const fallbackHeight = settings.height || 160;
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        const mobileMaxWidth = Math.max(160, Math.floor(viewportWidth * 0.72));
        const desktopMaxWidth = Math.max(160, viewportWidth - margin * 2);
        const popupWidth = Math.min(node.offsetWidth || fallbackWidth, viewportWidth <= 768 ? mobileMaxWidth : desktopMaxWidth);
        const popupHeight = node.offsetHeight || fallbackHeight;
        const maxLeft = Math.max(margin, viewportWidth - popupWidth - margin);
        const maxTop = Math.max(margin, viewportHeight - popupHeight - margin);
        const headBottom = rect.top + rect.height * 0.35;
        const preferredRatio = typeof settings.preferredRatio === "number" ? settings.preferredRatio : 0.22;
        const preferredOffset = typeof settings.offsetY === "number" ? settings.offsetY : rect.height * preferredRatio;
        const preferredTop = clamp(rect.top + preferredOffset, margin, maxTop);
        const footTop = clamp(rect.bottom - popupHeight - gap, margin, maxTop);
        const candidates = [
            { left: rect.right + gap, top: preferredTop },
            { left: rect.left - gap - popupWidth, top: preferredTop },
            { left: clamp(rect.right - popupWidth, margin, maxLeft), top: footTop }
        ];
        let nextLeft = candidates[2].left;
        let nextTop = candidates[2].top;

        node.style.maxWidth = viewportWidth <= 768 ? "72vw" : "calc(100vw - " + (margin * 2) + "px)";

        function overlapsHead(left, top) {
            const right = left + popupWidth;
            const bottom = top + popupHeight;
            const overlapsX = right > rect.left && left < rect.right;
            const overlapsY = bottom > rect.top && top < headBottom;

            return overlapsX && overlapsY;
        }

        for (let index = 0; index < candidates.length; index += 1) {
            const candidate = candidates[index];
            const fitsViewport = candidate.left >= margin &&
                candidate.left + popupWidth <= viewportWidth - margin &&
                candidate.top >= margin &&
                candidate.top + popupHeight <= viewportHeight - margin;

            if (fitsViewport && !overlapsHead(candidate.left, candidate.top)) {
                nextLeft = candidate.left;
                nextTop = candidate.top;
                break;
            }
        }

        node.style.left = clamp(nextLeft, margin, maxLeft) + "px";
        node.style.top = clamp(nextTop, margin, maxTop) + "px";
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
        const openingBubble = document.querySelector(".live2d-opening-bubble") || createOpeningBubble();
        const quizExitBubble = createQuizExitBubble();
        const idleBubble = createIdleBubble();
        const fortuneBubble = createFortuneBubble();
        const hitArea = document.querySelector(".live2d-hit-area") || createHitArea();
        const closeButton = dialog.querySelector(".live2d-quiz__close");
        const meta = dialog.querySelector(".live2d-quiz__meta");
        const question = dialog.querySelector(".live2d-quiz__question");
        const options = dialog.querySelector(".live2d-quiz__options");
        const result = dialog.querySelector(".live2d-quiz__result");
        const boundNodes = new WeakSet();
        const isSuggestionPage = /(^|\/)suggest\.html(?:$|[?#])/i.test(window.location.pathname + window.location.search + window.location.hash);
        let idleTalkTimer = null;
        let fortuneProcessTimer = null;
        let dialogMode = "menu";
        let popupSyncFrame = 0;

        function clearSpinTimers() {
            window.clearInterval(heroSpinTimer);
            window.clearTimeout(heroSpinTimeout);
            heroSpinTimer = null;
            heroSpinTimeout = null;
        }

        function refreshMusicPlayerContent() {
            if (dialog.classList.contains("is-music")) {
                renderMusicPlayerContent();
            }
        }

        function ensureMusicAudio() {
            if (!musicAudio) {
                musicAudio = new Audio();
                musicAudio.preload = "none";
                musicAudio.onended = function () {
                    selectMusic(currentMusicIndex + 1, true);
                };
                musicAudio.onerror = function () {
                    const failedSrc = musicAudio.currentSrc || musicAudio.getAttribute("src") || "";

                    if (failedSrc) {
                        console.warn("[JunxueMusic] Audio failed to load:", failedSrc);
                    }
                    musicPlaying = false;
                    result.textContent = "这首歌暂时播放不了，换一首试试吧～";
                    result.className = "live2d-quiz__result is-warning";
                    refreshMusicPlayerContent();
                };
            }

            return musicAudio;
        }

        function closeCurrentMusic() {
            if (!musicAudio) {
                musicPlaying = false;
                refreshMusicPlayerContent();
                return;
            }

            musicAudio.pause();
            try {
                musicAudio.currentTime = 0;
            } catch (error) {
                // Ignore browsers that block seeking before audio metadata is loaded.
            }
            musicAudio.removeAttribute("src");
            try {
                musicAudio.load();
            } catch (error) {
                // Ignore browsers that do not like loading after src cleanup.
            }
            musicPlaying = false;
            refreshMusicPlayerContent();
        }

        function getGanyuUIState() {
            return window.JunxueGanyuUIState || null;
        }

        function setDialogMode(mode) {
            dialogMode = mode === "panel" ? "panel" : "menu";
        }

        function notifyDialogOpen() {
            const state = getGanyuUIState();

            if (!state) {
                return;
            }

            if (dialogMode === "panel") {
                if (typeof state.openMenu === "function") {
                    state.openMenu();
                }

                if (typeof state.openPanel === "function") {
                    state.openPanel();
                }

                return;
            }

            if (typeof state.openMenu === "function") {
                state.openMenu();
            }

            if (typeof state.closePanel === "function") {
                state.closePanel();
            }
        }

        function notifyDialogClosed() {
            const state = getGanyuUIState();

            if (state && typeof state.closeAll === "function") {
                state.closeAll();
            }
        }

        function clearDialog() {
            if (dialog.classList.contains("is-score-guess")) {
                cleanupScoreGuessRealtime();
            }

            clearSpinTimers();
            window.clearTimeout(fortuneProcessTimer);
            fortuneProcessTimer = null;
            dialog.classList.remove("is-opening", "is-wheel", "is-weather", "is-music", "is-fortune", "is-memory", "is-boss-auth", "is-boss-review", "is-score-guess", "is-main-menu");
            meta.textContent = "";
            question.textContent = "";
            options.innerHTML = "";
            result.textContent = "";
            result.className = "live2d-quiz__result";
            options.className = "live2d-quiz__options";
        }

        function safeText(value, fallback) {
            return typeof value === "string" ? value : (fallback || "");
        }

        function randomBetween(min, max) {
            return Math.random() * (max - min) + min;
        }

        function getIdleDelayMultiplier() {
            const mode = window.JunxuePerformanceMode;

            return mode && typeof mode.getLive2DIdleDelayMultiplier === "function" ?
                mode.getLive2DIdleDelayMultiplier() :
                1;
        }

        function pickRandomItem(items) {
            return items[Math.floor(Math.random() * items.length)];
        }

        function replayOpenAnimation() {
            dialog.classList.remove("is-opening");
            void dialog.offsetWidth;
            dialog.classList.add("is-opening");
        }

        function getDialogPositionOptions() {
            let width = 400;

            if (dialog.classList.contains("is-boss-review")) {
                width = 720;
            } else if (dialog.classList.contains("is-boss-auth")) {
                width = 660;
            } else if (dialog.classList.contains("is-score-guess")) {
                width = 620;
            } else if (dialog.classList.contains("is-fortune") || dialog.classList.contains("is-memory")) {
                width = 440;
            }

            return {
                width: width,
                height: 220,
                preferredRatio: 0.22,
                gap: 20
            };
        }

        function refreshDialogPosition() {
            if (!dialog.classList.contains("is-open")) {
                return;
            }

            positionLive2DPopup(dialog, getDialogPositionOptions());
        }

        function showDialog() {
            hideIdleTalk();
            notifyDialogOpen();
            positionLive2DPopup(dialog, getDialogPositionOptions());
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
                refreshDialogPosition();
            }

            if (openingBubble.textContent) {
                positionLive2DPopup(openingBubble, {
                    width: 328,
                    height: 96,
                    offsetY: 56
                });
            }

            if (quizExitBubble.textContent) {
                positionLive2DPopup(quizExitBubble, {
                    width: 318,
                    height: 92,
                    offsetY: 62
                });
            }

            if (idleBubble.textContent) {
                positionLive2DPopup(idleBubble, {
                    width: 318,
                    height: 92,
                    offsetY: 62
                });
            }

            if (fortuneBubble.textContent) {
                positionLive2DPopup(fortuneBubble, {
                    width: 318,
                    height: 92,
                    offsetY: 62
                });
            }
        }

        function scheduleLive2DPopupPositions() {
            if (popupSyncFrame) {
                return;
            }

            popupSyncFrame = window.requestAnimationFrame(function () {
                popupSyncFrame = 0;
                syncLive2DPopupPositions();
            });
        }

        function closeDialog() {
            clearSpinTimers();
            if (dialog.classList.contains("is-score-guess")) {
                cleanupScoreGuessRealtime();
            }
            dialog.classList.remove("is-open", "is-opening");
            window.clearTimeout(showDialog.closeTimer);
            notifyDialogClosed();
        }

        function hideIdleTalk() {
            window.clearTimeout(showIdleTalk.timer);
            idleBubble.classList.add("is-fading");
            idleBubble.classList.remove("is-open");
            window.clearTimeout(hideIdleTalk.timer);
            hideIdleTalk.timer = window.setTimeout(function () {
                idleBubble.classList.remove("is-fading");
                idleBubble.textContent = "";
            }, 360);
        }

        function canShowIdleTalk() {
            const state = getGanyuUIState();

            if (window.JunxueGanyuTalk && window.JunxueGanyuTalk.handlesIdle) {
                return false;
            }

            return window.enableGanyuIdleTalk !== false &&
                !(state && typeof state.isBusy === "function" && state.isBusy()) &&
                !isSuggestionPage &&
                !document.hidden &&
                !dialog.classList.contains("is-open") &&
                !openingBubble.textContent &&
                !quizExitBubble.textContent &&
                !idleBubble.textContent;
        }

        function showIdleTalk() {
            if (!canShowIdleTalk()) {
                return;
            }

            if (window.JunxueGanyuTalk && typeof window.JunxueGanyuTalk.say === "function") {
                window.JunxueGanyuTalk.say(pickRandomItem(ganyuIdleLines), "", randomBetween(4000, 6000));
                return;
            }

            window.clearTimeout(showIdleTalk.timer);
        }

        function scheduleIdleTalk(first) {
            window.clearTimeout(idleTalkTimer);

            if ((window.JunxueGanyuTalk && window.JunxueGanyuTalk.handlesIdle) || window.enableGanyuIdleTalk === false || isSuggestionPage) {
                return;
            }

            const delayMultiplier = getIdleDelayMultiplier();

            idleTalkTimer = window.setTimeout(function () {
                showIdleTalk();
                scheduleIdleTalk(false);
            }, (first ? randomBetween(8000, 12000) : randomBetween(45000, 90000)) * delayMultiplier);
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
                setDialogMode("menu");
                question.textContent = firstClickVoiceText;
                showDialog();
                playVoice(firstClickVoicePath).then(function () {
                    firstClickVoicePlaying = false;
                    showMenu();
                });
                return;
            }

            clearDialog();
            setDialogMode("menu");
            dialog.classList.add("is-main-menu");
            meta.textContent = "甘雨菜单";
            question.innerHTML = [
                '<div class="live2d-menu-header">',
                    '<div class="live2d-menu-title">想和甘雨做什么？</div>',
                    '<div class="live2d-menu-user">当前登录：未登录</div>',
                '</div>'
            ].join("");
            options.classList.add("live2d-quiz__menu");
            addOption("日常娱乐", showEntertainmentPanel).setAttribute("data-menu-icon", "乐");
            addOption("直播互动", showLiveInteractionPanel).setAttribute("data-menu-icon", "播");
            addOption("咨询", showConsultPanel).setAttribute("data-menu-icon", "询");
            addOption("认识君雪", showKnowJunxuePanel).setAttribute("data-menu-icon", "雪");
            addOption("意见箱", function () {
                recordGanyuFeature("意见箱");
                window.location.href = "suggest.html";
            }).setAttribute("data-menu-icon", "信");
            updateAccountLine(".live2d-menu-user", "当前登录：");
            showDialog();
        }

        function showEntertainmentPanel() {
            clearDialog();
            setDialogMode("menu");
            meta.textContent = "日常娱乐";
            question.textContent = "今天想和甘雨轻松一下吗？";
            options.classList.add("live2d-consult-grid");
            addConsultCard("无奖竞答", "题目挑战", false, startQuiz);
            addConsultCard("查看天气", "天气查询", false, showWeatherInput);
            addConsultCard("占卜", "今日运势", false, showFortunePanel);
            addConsultCard("听歌", "甘雨歌单", false, showMusicPlayer);
            addConsultCard("返回", "回到主菜单", false, function () {
                showMenu();
            });
            result.textContent = "选一个日常小功能吧。";
            result.className = "live2d-quiz__result is-neutral";
            showDialog();
        }

        function showLiveInteractionPanel() {
            clearDialog();
            setDialogMode("menu");
            meta.textContent = "直播互动";
            question.textContent = "直播时可以一起玩的内容都放在这里。";
            options.classList.add("live2d-consult-grid");
            addConsultCard("英雄池转盘", "今天玩谁？", false, showHeroWheel);
            addConsultCard("评分竞猜", "猜猜这局评分", false, showScoreGuessPanel);
            addConsultCard("直播惩罚", "敬请期待", false, function () {
                recordGanyuFeature("直播惩罚");
                result.textContent = "直播惩罚玩法还在设计中，先欠着你一局～";
                result.className = "live2d-quiz__result is-neutral";
            });
            addConsultCard("更多互动", "敬请期待", false, function () {
                recordGanyuFeature("更多互动");
                result.textContent = "更多直播互动还在慢慢准备中，之后会补上～";
                result.className = "live2d-quiz__result is-neutral";
            });
            addConsultCard("返回", "回到主菜单", false, function () {
                showMenu();
            });
            result.textContent = "直播互动入口先放在这里啦。";
            result.className = "live2d-quiz__result is-neutral";
            showDialog();
        }

        function showKnowJunxuePanel() {
            clearDialog();
            setDialogMode("menu");
            meta.textContent = "认识君雪";
            question.textContent = "这些事情，甘雨都替君雪记着呢。";
            options.classList.add("live2d-consult-grid");
            addConsultCard("认识一下", "关于君雪", false, function () {
                recordGanyuFeature("认识一下");
                closeDialog();
                const memory = getGanyuMemory();

                if (memory && typeof memory.showNamePrompt === "function") {
                    memory.showNamePrompt();
                }
            });
            addConsultCard("甘雨记得你", "看看甘雨记住的小事", false, function () {
                showMemoryPanel();
            });
            addConsultCard("返回", "回到主菜单", false, function () {
                showMenu();
            });
            result.textContent = "想先聊哪一件事呢？";
            result.className = "live2d-quiz__result is-neutral";
            showDialog();
        }

        function getSupabaseConfigValue(name) {
            return typeof window[name] === "string" ? window[name].trim() : "";
        }

        function hasBossRegisterConfig() {
            const url = getSupabaseConfigValue("SUPABASE_URL");
            const key = getSupabaseConfigValue("SUPABASE_ANON_KEY");

            return /^https:\/\/.+\.supabase\.co$/i.test(url) &&
                !!key &&
                key.indexOf("你的 Supabase") === -1 &&
                (key.indexOf("sb_publishable_") === 0 || key.indexOf("eyJ") === 0);
        }

        function loadExternalScript(src) {
            return new Promise(function (resolve, reject) {
                const existing = Array.prototype.find.call(document.scripts, function (script) {
                    return script.getAttribute("src") === src;
                });

                if (existing) {
                    resolve();
                    return;
                }

                const script = document.createElement("script");

                script.src = src;
                script.async = true;
                script.onload = resolve;
                script.onerror = function () {
                    script.remove();
                    reject(new Error("script-load-failed"));
                };
                document.head.appendChild(script);
            });
        }

        async function loadSupabaseSdk() {
            if (window.supabase && typeof window.supabase.createClient === "function") {
                return;
            }

            try {
                await loadExternalScript(SUPABASE_LOCAL_SDK);
            } catch (localError) {
                console.warn("[JunxueBossReviews] local Supabase SDK load failed, falling back to jsdelivr.", localError);
                try {
                    await loadExternalScript(SUPABASE_CDN);
                } catch (cdnError) {
                    console.error("[JunxueBossReviews] Supabase SDK load failed.", cdnError);
                    throw new Error(SUPABASE_SDK_LOAD_ERROR_TEXT);
                }
            }

            if (!window.supabase || typeof window.supabase.createClient !== "function") {
                throw new Error(SUPABASE_SDK_LOAD_ERROR_TEXT);
            }
        }

        async function ensureBossRegisterClient() {
            await loadExternalScript("assets/supabase-config.js?v=20260611-1").catch(function () {});

            if (!hasBossRegisterConfig()) {
                throw new Error("老板账号注册暂未配置，请稍后再试。");
            }

            await loadSupabaseSdk();
            return window.supabase.createClient(
                getSupabaseConfigValue("SUPABASE_URL"),
                getSupabaseConfigValue("SUPABASE_ANON_KEY")
            );
        }

        function showBossRegisterPanel() {
            clearDialog();
            setDialogMode("panel");
            meta.textContent = "老板账号注册";
            question.textContent = "这是 Supabase 老板账号，不会覆盖甘雨本地记忆里的称呼。";
            options.innerHTML = [
                '<form class="live2d-weather-form live2d-boss-register-form">',
                    '<input class="live2d-weather-input" name="email" type="email" autocomplete="email" placeholder="邮箱">',
                    '<input class="live2d-weather-input" name="password" type="password" autocomplete="new-password" placeholder="密码">',
                    '<input class="live2d-weather-input" name="confirmPassword" type="password" autocomplete="new-password" placeholder="确认密码">',
                    '<div class="live2d-weather-actions">',
                        '<button class="live2d-quiz__option" type="submit">注册老板账号</button>',
                        '<button class="live2d-quiz__option" type="button" data-action="price-login" hidden>去收费咨询页登录</button>',
                        '<button class="live2d-quiz__option" type="button" data-action="back">返回</button>',
                    '</div>',
                '</form>'
            ].join("");
            result.textContent = "注册后，请到收费咨询页登录并留下老板评价。";
            result.className = "live2d-quiz__result is-neutral";
            showDialog();

            const form = options.querySelector(".live2d-boss-register-form");
            const submitButton = form.querySelector('button[type="submit"]');
            const loginButton = form.querySelector('[data-action="price-login"]');
            const backButton = form.querySelector('[data-action="back"]');

            loginButton.addEventListener("click", function (event) {
                event.stopPropagation();
                window.location.href = "price.html";
            });

            backButton.addEventListener("click", function (event) {
                event.stopPropagation();
                showKnowJunxuePanel();
            });

            form.addEventListener("submit", async function (event) {
                event.preventDefault();
                event.stopPropagation();

                const email = form.elements.email.value.trim();
                const password = form.elements.password.value;
                const confirmPassword = form.elements.confirmPassword.value;

                if (!email || !password || !confirmPassword) {
                    result.textContent = "请先把邮箱、密码和确认密码都填好哦。";
                    result.className = "live2d-quiz__result is-warning";
                    return;
                }

                if (password !== confirmPassword) {
                    result.textContent = "两次密码不一致，请再检查一下。";
                    result.className = "live2d-quiz__result is-warning";
                    return;
                }

                submitButton.disabled = true;
                result.textContent = "正在帮你注册老板账号……";
                result.className = "live2d-quiz__result is-neutral";

                try {
                    const client = await ensureBossRegisterClient();
                    const response = await client.auth.signUp({ email: email, password: password });

                    if (response.error) {
                        result.textContent = response.error.message + " 这个邮箱可能已经注册过了，可以去收费咨询页直接登录试试。";
                        result.className = "live2d-quiz__result is-warning";
                        return;
                    }

                    form.reset();
                    loginButton.hidden = false;
                    result.textContent = response.data && response.data.session ?
                        "注册成功啦～现在可以去收费咨询页登录并留下老板评价。" :
                        "注册成功，请先去邮箱确认账号，再回来登录。";
                    result.className = "live2d-quiz__result is-good";
                } catch (error) {
                    result.textContent = error.message || "老板账号注册暂时不可用，请稍后再试。";
                    result.className = "live2d-quiz__result is-warning";
                } finally {
                    submitButton.disabled = false;
                }
            });
        }


        async function ensureBossReviewsApi() {
            await loadExternalScript("assets/supabase-config.js?v=20260611-1").catch(function () {});
            await loadExternalScript("assets/price-reviews.js?v=20260616-1");

            if (!window.JunxueBossReviews) {
                throw new Error("老板评价系统暂未配置，请稍后再来～");
            }

            return window.JunxueBossReviews;
        }

        async function ensureScoreGuessClient() {
            await loadExternalScript("assets/supabase-config.js?v=20260611-1").catch(function () {});

            if (!hasBossRegisterConfig()) {
                throw new Error("评分竞猜暂时还没有配置好，请稍后再试。");
            }

            await loadSupabaseSdk();
            return window.supabase.createClient(
                getSupabaseConfigValue("SUPABASE_URL"),
                getSupabaseConfigValue("SUPABASE_ANON_KEY")
            );
        }

        async function getCurrentAuthDisplayName() {
            try {
                const client = await ensureScoreGuessClient();
                const response = await client.auth.getSession();

                if (response.error || !response.data || !response.data.session) {
                    return "未登录";
                }

                return getDisplayNameFromAuthUser(response.data.session.user);
            } catch (error) {
                return "未登录";
            }
        }

        function updateAccountLine(selector, prefix) {
            const line = dialog.querySelector(selector);

            if (!line) {
                return;
            }

            getCurrentAuthDisplayName().then(function (name) {
                if (dialog.contains(line)) {
                    line.textContent = prefix + name;
                }
            });
        }

        function getScoreGuessChoiceTone(choice) {
            return ({
                "铜牌": "bronze",
                "银牌": "silver",
                "金牌": "gold",
                "顶级": "top",
                "无": "none"
            })[choice] || "none";
        }

        function createEmptyScoreGuessCounts() {
            return SCORE_GUESS_CHOICES.reduce(function (counts, choice) {
                counts[choice] = 0;
                return counts;
            }, {});
        }

        function getScoreGuessCounts(votes) {
            const counts = createEmptyScoreGuessCounts();

            (votes || []).forEach(function (vote) {
                if (Object.prototype.hasOwnProperty.call(counts, vote.choice)) {
                    counts[vote.choice] += 1;
                }
            });

            return counts;
        }

        function getScoreGuessUserChoice(votes, userId) {
            if (!userId) {
                return "";
            }

            const vote = (votes || []).find(function (item) {
                return item.user_id === userId;
            });

            return vote ? vote.choice : "";
        }

        async function getScoreGuessAuthSession(client) {
            const response = await client.auth.getSession();

            if (response.error) {
                throw response.error;
            }

            return response.data ? response.data.session : null;
        }

        async function loadActiveScoreGuessSession(client) {
            let response = await client
                .from("live_score_guess_sessions")
                .select("*")
                .eq("status", "open")
                .order("created_at", { ascending: false })
                .limit(1);

            if (response.error) {
                throw response.error;
            }

            if (response.data && response.data.length) {
                return response.data[0];
            }

            response = await client
                .from("live_score_guess_sessions")
                .select("*")
                .eq("status", "closed")
                .order("created_at", { ascending: false })
                .limit(1);

            if (response.error) {
                throw response.error;
            }

            return response.data && response.data.length ? response.data[0] : null;
        }

        async function loadScoreGuessVotes(client, sessionId) {
            if (!sessionId) {
                return [];
            }

            const response = await client
                .from("live_score_guess_votes")
                .select("session_id,user_id,choice,updated_at")
                .eq("session_id", sessionId);

            if (response.error) {
                throw response.error;
            }

            return response.data || [];
        }

        async function checkScoreGuessAdmin(client, userId) {
            if (!userId) {
                return false;
            }

            const response = await client
                .from("live_interaction_admins")
                .select("user_id")
                .eq("user_id", userId)
                .maybeSingle();

            if (response.error) {
                console.warn("[JunxueScoreGuess] admin check failed.", response.error);
                return false;
            }

            return !!response.data;
        }

        async function loadScoreGuessData() {
            const client = await ensureScoreGuessClient();
            const authSession = await getScoreGuessAuthSession(client);
            const session = await loadActiveScoreGuessSession(client);
            const votes = await loadScoreGuessVotes(client, session && session.id);
            const isAdmin = await checkScoreGuessAdmin(client, authSession && authSession.user && authSession.user.id);

            scoreGuessState = {
                client: client,
                session: session,
                authSession: authSession,
                votes: votes,
                isAdmin: isAdmin,
                realtimeWarning: scoreGuessState.realtimeWarning
            };

            return scoreGuessState;
        }

        function cleanupScoreGuessRealtime() {
            if (!scoreGuessRealtimeChannels.length) {
                return;
            }

            scoreGuessRealtimeChannels.forEach(function (channel) {
                if (scoreGuessState.client && typeof scoreGuessState.client.removeChannel === "function") {
                    scoreGuessState.client.removeChannel(channel);
                }
            });
            scoreGuessRealtimeChannels = [];
        }

        function handleScoreGuessRealtimeProblem() {
            if (scoreGuessRealtimeWarningShown) {
                return;
            }

            scoreGuessRealtimeWarningShown = true;
            scoreGuessState.realtimeWarning = true;

            if (dialog.classList.contains("is-score-guess")) {
                result.textContent = "实时同步暂时不可用，数据会在操作后刷新。";
                result.className = "live2d-quiz__result is-warning";
            }
        }

        function subscribeScoreGuessRealtime(client) {
            if (!client || typeof client.channel !== "function" || scoreGuessRealtimeChannels.length) {
                return;
            }

            const refresh = function () {
                if (dialog.classList.contains("is-score-guess")) {
                    refreshScoreGuessPanel();
                }
            };
            const statusHandler = function (status) {
                if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
                    handleScoreGuessRealtimeProblem();
                }
            };
            const sessionChannel = client
                .channel("junxue-live-score-guess-sessions")
                .on("postgres_changes", { event: "*", schema: "public", table: "live_score_guess_sessions" }, refresh)
                .subscribe(statusHandler);
            const voteChannel = client
                .channel("junxue-live-score-guess-votes")
                .on("postgres_changes", { event: "*", schema: "public", table: "live_score_guess_votes" }, refresh)
                .subscribe(statusHandler);

            scoreGuessRealtimeChannels = [sessionChannel, voteChannel];
        }

        function getScoreGuessActionMessage(error, fallback) {
            const message = error && error.message ? error.message : "";

            if (/permission|policy|rls|denied|not allowed|violates/i.test(message)) {
                return "只有君雪可以开启或结束竞猜哦～";
            }

            return fallback || SCORE_GUESS_LOAD_ERROR_TEXT;
        }

        function renderScoreGuessResults(state, message, type) {
            const activeSession = state.session || null;
            const currentUserId = state.authSession && state.authSession.user ? state.authSession.user.id : "";
            const userChoice = getScoreGuessUserChoice(state.votes, currentUserId);
            const counts = getScoreGuessCounts(state.votes);
            const isOpen = activeSession && activeSession.status === "open";
            const isClosed = activeSession && activeSession.status === "closed";
            const canVote = !!(isOpen && currentUserId);
            const statusLabel = activeSession ? (isOpen ? "竞猜进行中" : "竞猜已结束") : "暂未开启";
            const statusText = activeSession ? (isOpen ? "进行中" : "已结束") : "暂未开启";
            const accountLabel = getDisplayNameFromAuthUser(state.authSession && state.authSession.user);
            const choiceLabel = userChoice ? userChoice : "你还没有选择";

            meta.textContent = "直播互动";
            question.innerHTML = [
                '<div class="score-guess-panel__header">',
                    '<div class="score-guess-panel__heading">',
                        '<div class="score-guess-panel__badge">直播互动</div>',
                        '<div class="score-guess-panel__title">评分竞猜</div>',
                        '<div class="score-guess-panel__subtitle">猜猜这局最后会是什么评分？</div>',
                    '</div>',
                    '<div class="score-guess-panel__state">' + escapeHtml(statusLabel) + '</div>',
                '</div>'
            ].join("");

            options.className = "live2d-quiz__options score-guess-panel";
            options.innerHTML = [
                '<div class="score-guess-panel__meta">',
                    '<div class="score-guess-panel__meta-item">',
                        '<span class="score-guess-panel__meta-label">当前账号</span>',
                        '<span class="score-guess-panel__meta-value">' + escapeHtml(accountLabel) + '</span>',
                    '</div>',
                    '<div class="score-guess-panel__meta-item">',
                        '<span class="score-guess-panel__meta-label">当前状态</span>',
                        '<span class="score-guess-panel__meta-value">' + escapeHtml(statusText) + '</span>',
                    '</div>',
                    '<div class="score-guess-panel__meta-item">',
                        '<span class="score-guess-panel__meta-label">你当前选择</span>',
                        '<span class="score-guess-panel__meta-value">' + escapeHtml(choiceLabel) + '</span>',
                    '</div>',
                '</div>',
                '<div class="score-guess-panel__options">'
            ].join("") + SCORE_GUESS_CHOICES.map(function (choice) {
                const selected = userChoice === choice;
                const tone = getScoreGuessChoiceTone(choice);
                return [
                    '<button class="live2d-consult-card live2d-score-guess-choice score-guess-option score-guess-option--' + tone + (choice === "无" ? ' score-guess-option--wide' : '') + (selected ? ' is-selected' : '') + '" type="button" data-score-choice="' + escapeHtml(choice) + '"' + (canVote ? "" : " disabled") + '>',
                        '<span class="score-guess-option__name">' + escapeHtml(choice) + '</span>',
                        '<span class="score-guess-option__count">' + counts[choice] + ' 人选择</span>',
                        selected ? '<span class="score-guess-option__mark">已选择</span>' : '',
                    '</button>'
                ].join("");
            }).join("") + '</div>';

            options.innerHTML += [
                '<div class="live2d-weather-actions live2d-score-guess-actions score-guess-actions score-guess-panel__actions">',
                    !currentUserId ? '<button class="live2d-quiz__option score-guess-action score-guess-action--primary" type="button" data-score-action="login">登录 / 注册老板账号</button>' : '',
                    state.isAdmin && !isOpen ? '<button class="live2d-quiz__option score-guess-action score-guess-action--primary" type="button" data-score-action="start">开启评分竞猜</button>' : '',
                    state.isAdmin && isOpen ? '<button class="live2d-quiz__option score-guess-action score-guess-action--danger" type="button" data-score-action="end">结束竞猜</button>' : '',
                    '<button class="live2d-quiz__option score-guess-action score-guess-action--soft" type="button" data-score-action="refresh">刷新结果</button>',
                    '<button class="live2d-quiz__option score-guess-action score-guess-action--soft" type="button" data-score-action="back">返回直播互动</button>',
                '</div>',
                '<div class="score-guess-panel__footer-note">投票结果会同步给所有观众；竞猜结束后只展示结果，不能再修改选择。</div>'
            ].join("");

            if (message) {
                result.textContent = message;
                result.className = "live2d-quiz__result " + (type || "is-neutral");
            } else if (!activeSession) {
                result.textContent = state.isAdmin ? "当前没有开启中的竞猜，可以开启一场新的评分竞猜。" : "当前没有开启中的竞猜。";
                result.className = "live2d-quiz__result is-neutral";
            } else if (!currentUserId) {
                result.textContent = "登录后才能参与评分竞猜哦～";
                result.className = "live2d-quiz__result is-warning";
            } else if (isClosed) {
                result.textContent = "竞猜已结束，看看大家猜得怎么样吧～";
                result.className = "live2d-quiz__result is-neutral";
            } else if (userChoice) {
                result.textContent = "你当前选择了：" + userChoice + "。竞猜结束前还可以改选。";
                result.className = "live2d-quiz__result is-good";
            } else {
                result.textContent = "猜猜这局最后是什么评分？";
                result.className = "live2d-quiz__result is-neutral";
            }

            Array.prototype.forEach.call(options.querySelectorAll("[data-score-choice]"), function (button) {
                button.addEventListener("click", function (event) {
                    event.stopPropagation();
                    submitScoreGuessVote(button.getAttribute("data-score-choice"));
                });
            });

            Array.prototype.forEach.call(options.querySelectorAll("[data-score-action]"), function (button) {
                button.addEventListener("click", function (event) {
                    event.stopPropagation();
                    const action = button.getAttribute("data-score-action");

                    if (action === "login") {
                        showBossReviewAuthPanel("login", { returnTo: "scoreGuess" });
                    } else if (action === "start") {
                        startScoreGuessSession();
                    } else if (action === "end") {
                        endScoreGuessSession();
                    } else if (action === "refresh") {
                        refreshScoreGuessPanel("评分竞猜结果刷新好了。", "is-good");
                    } else if (action === "back") {
                        showLiveInteractionPanel();
                    }
                });
            });

            refreshDialogPosition();
        }

        async function refreshScoreGuessPanel(message, type) {
            if (!dialog.classList.contains("is-score-guess")) {
                return;
            }

            try {
                const state = await loadScoreGuessData();
                renderScoreGuessResults(state, message, type);
                subscribeScoreGuessRealtime(state.client);
            } catch (error) {
                console.error("[JunxueScoreGuess] load failed.", error);
                options.innerHTML = [
                    '<div class="live2d-weather-actions">',
                        '<button class="live2d-quiz__option" type="button" data-score-action="retry">再试一次</button>',
                        '<button class="live2d-quiz__option" type="button" data-score-action="back">返回直播互动</button>',
                    '</div>'
                ].join("");
                result.textContent = /^评分竞猜/.test(error.message || "") ? error.message : SCORE_GUESS_LOAD_ERROR_TEXT;
                result.className = "live2d-quiz__result is-warning";
                Array.prototype.forEach.call(options.querySelectorAll("[data-score-action]"), function (button) {
                    button.addEventListener("click", function (event) {
                        event.stopPropagation();
                        if (button.getAttribute("data-score-action") === "retry") {
                            refreshScoreGuessPanel();
                        } else {
                            showLiveInteractionPanel();
                        }
                    });
                });
            }
        }

        function showScoreGuessPanel() {
            setDialogMode("panel");
            recordGanyuFeature("评分竞猜");
            clearDialog();
            dialog.classList.add("is-score-guess");
            meta.textContent = "评分竞猜";
            question.innerHTML = [
                '<div class="score-guess-panel__header">',
                    '<div class="score-guess-panel__heading">',
                        '<div class="score-guess-panel__badge">直播互动</div>',
                        '<div class="score-guess-panel__title">评分竞猜</div>',
                        '<div class="score-guess-panel__subtitle">猜猜这局最后会是什么评分？</div>',
                    '</div>',
                    '<div class="score-guess-panel__state">正在读取</div>',
                '</div>'
            ].join("");
            options.innerHTML = '<div class="live2d-quiz__loading">正在读取评分竞猜…</div>';
            result.textContent = "";
            result.className = "live2d-quiz__result is-neutral";
            showDialog();
            refreshScoreGuessPanel();
        }

        async function startScoreGuessSession() {
            if (!scoreGuessState.authSession || !scoreGuessState.authSession.user || !scoreGuessState.isAdmin) {
                result.textContent = "只有君雪可以开启或结束竞猜哦～";
                result.className = "live2d-quiz__result is-warning";
                return;
            }

            try {
                const response = await scoreGuessState.client
                    .from("live_score_guess_sessions")
                    .insert({
                        title: "评分竞猜",
                        status: "open",
                        created_by: scoreGuessState.authSession.user.id
                    })
                    .select()
                    .single();

                if (response.error) {
                    throw response.error;
                }

                await refreshScoreGuessPanel("评分竞猜已经开启啦。", "is-good");
            } catch (error) {
                console.error("[JunxueScoreGuess] start failed.", error);
                result.textContent = getScoreGuessActionMessage(error, "评分竞猜暂时没能开启，请稍后再试。");
                result.className = "live2d-quiz__result is-warning";
            }
        }

        async function endScoreGuessSession() {
            if (!scoreGuessState.authSession || !scoreGuessState.authSession.user || !scoreGuessState.isAdmin) {
                result.textContent = "只有君雪可以开启或结束竞猜哦～";
                result.className = "live2d-quiz__result is-warning";
                return;
            }

            if (!scoreGuessState.session || scoreGuessState.session.status !== "open") {
                result.textContent = "当前没有开启中的竞猜。";
                result.className = "live2d-quiz__result is-neutral";
                return;
            }

            try {
                const response = await scoreGuessState.client
                    .from("live_score_guess_sessions")
                    .update({ status: "closed", ended_at: new Date().toISOString() })
                    .eq("id", scoreGuessState.session.id)
                    .eq("status", "open");

                if (response.error) {
                    throw response.error;
                }

                await refreshScoreGuessPanel("竞猜已结束，看看大家猜得怎么样吧～", "is-good");
            } catch (error) {
                console.error("[JunxueScoreGuess] end failed.", error);
                result.textContent = getScoreGuessActionMessage(error, "竞猜暂时没能结束，请稍后再试。");
                result.className = "live2d-quiz__result is-warning";
            }
        }

        async function submitScoreGuessVote(choice) {
            if (!scoreGuessState.authSession || !scoreGuessState.authSession.user) {
                result.textContent = "登录后才能参与竞猜。";
                result.className = "live2d-quiz__result is-warning";
                return;
            }

            if (!scoreGuessState.session || scoreGuessState.session.status !== "open") {
                result.textContent = "竞猜已经结束，不能再修改选择啦～";
                result.className = "live2d-quiz__result is-warning";
                return;
            }

            if (SCORE_GUESS_CHOICES.indexOf(choice) === -1) {
                return;
            }

            try {
                const response = await scoreGuessState.client
                    .from("live_score_guess_votes")
                    .upsert({
                        session_id: scoreGuessState.session.id,
                        user_id: scoreGuessState.authSession.user.id,
                        choice: choice,
                        updated_at: new Date().toISOString()
                    }, { onConflict: "session_id,user_id" });

                if (response.error) {
                    throw response.error;
                }

                await refreshScoreGuessPanel("你选择了：" + choice + "。", "is-good");
            } catch (error) {
                console.error("[JunxueScoreGuess] vote failed.", error);
                const message = /closed|status/i.test(error.message || "") ?
                    "竞猜已经结束，不能再修改选择啦～" :
                    "评分竞猜暂时加载失败，可能是网络不稳定，请稍后再试。";
                result.textContent = message;
                result.className = "live2d-quiz__result is-warning";
            }
        }

        function isPricePage() {
            return /(^|\/)price\.html$/i.test(window.location.pathname) || window.location.pathname === "/price.html";
        }

        function scrollToBossReviewWall() {
            const wall = document.getElementById("boss-reviews");

            if (wall && typeof wall.scrollIntoView === "function") {
                wall.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }

        function getBossReviewEmail(session) {
            return session && session.user && session.user.email ? session.user.email : "老板";
        }

        function showBossReviewsPanel(message, type) {
            clearDialog();
            setDialogMode("menu");
            meta.textContent = "老板评价";
            question.textContent = "想看看老板们留下的话，还是也写一句给君雪呢？";
            options.classList.add("live2d-consult-grid");
            addConsultCard("查看老板评价", "评价墙与互动", false, function () {
                recordGanyuFeature("老板评价");

                if (isPricePage()) {
                    closeDialog();
                    scrollToBossReviewWall();
                    return;
                }

                window.location.href = "price.html#boss-reviews";
            });
            addConsultCard("登录/注册", "老板账号", false, function () {
                recordGanyuFeature("老板评价登录");
                showBossReviewAuthPanel("login");
            });
            addConsultCard("发布评价", "写给君雪", false, function () {
                recordGanyuFeature("发布老板评价");
                showBossReviewSubmitPanel();
            });
            addConsultCard("返回", "回到主菜单", false, function () {
                showMenu();
            });
            const safeMessage = safeText(message, "老板评价会展示在收费咨询页的评价墙里。");
            const safeType = safeText(type, "is-neutral");
            result.textContent = safeMessage;
            result.className = "live2d-quiz__result " + safeType;
            showDialog();
        }

        function showBossReviewAuthPanel(mode, authOptions) {
            const returnToScoreGuess = authOptions && authOptions.returnTo === "scoreGuess";
            clearDialog();
            setDialogMode("panel");
            dialog.classList.add("is-weather", "is-boss-auth");
            meta.textContent = "老板评价账号";
            question.textContent = "登录后可以发布老板评价、点赞和评论。";
            options.innerHTML = [
                '<form class="live2d-boss-auth-card live2d-boss-auth-form">',
                    '<div class="live2d-boss-auth-heading">' + (mode === "register" ? "还没有老板账号的话，可以先注册。" : "已有老板账号的话，可以先登录。") + '</div>',
                    '<div class="live2d-boss-auth-fields">',
                        '<input class="live2d-weather-input live2d-boss-auth-input" name="email" type="email" autocomplete="email" placeholder="邮箱">',
                        '<input class="live2d-weather-input live2d-boss-auth-input" name="password" type="password" autocomplete="' + (mode === "register" ? "new-password" : "current-password") + '" placeholder="密码">',
                    '</div>',
                    '<div class="live2d-boss-auth-actions">',
                        '<button class="live2d-quiz__option live2d-boss-auth-primary" type="submit">' + (mode === "register" ? "注册" : "登录") + '</button>',
                        '<button class="live2d-quiz__option" type="button" data-action="toggle">' + (mode === "register" ? "去登录" : "去注册") + '</button>',
                        '<button class="live2d-quiz__option" type="button" data-action="back">返回</button>',
                    '</div>',
                    '<p class="live2d-boss-auth-hint">还没有老板账号？点击“去注册”，甘雨会带你完成注册。</p>',
                '</form>'
            ].join("");
            result.textContent = "老板账号使用 Supabase Auth，不会覆盖甘雨本地记忆里的称呼。";
            result.className = "live2d-quiz__result live2d-boss-auth-note is-neutral";
            showDialog();

            const form = options.querySelector(".live2d-boss-auth-form");
            const submitButton = form.querySelector('button[type="submit"]');
            const toggleButton = form.querySelector('[data-action="toggle"]');
            const backButton = form.querySelector('[data-action="back"]');

            toggleButton.addEventListener("click", function (event) {
                event.stopPropagation();
                showBossReviewAuthPanel(mode === "register" ? "login" : "register", authOptions);
            });

            backButton.addEventListener("click", function (event) {
                event.stopPropagation();
                if (returnToScoreGuess) {
                    showScoreGuessPanel();
                    return;
                }
                showBossReviewsPanel();
            });

            form.addEventListener("submit", async function (event) {
                event.preventDefault();
                event.stopPropagation();

                const email = form.elements.email.value.trim();
                const password = form.elements.password.value;

                if (!email || !password) {
                    result.textContent = "请先填好邮箱和密码哦。";
                    result.className = "live2d-quiz__result is-warning";
                    return;
                }

                submitButton.disabled = true;
                result.textContent = mode === "register" ? "正在注册老板账号……" : "正在登录老板账号……";
                result.className = "live2d-quiz__result is-neutral";

                try {
                    const api = await ensureBossReviewsApi();
                    const response = mode === "register" ?
                        await api.register(email, password) :
                        await api.login(email, password);

                    if (response && response.error) {
                        result.textContent = response.error.message + (mode === "register" ? " 这个邮箱可能已经注册过了，可以直接登录试试。" : "");
                        result.className = "live2d-quiz__result is-warning";
                        return;
                    }

                    const session = await api.getSession();
                    form.reset();
                    result.textContent = mode === "register" && !(response && response.session) ?
                        "注册成功，请先去邮箱确认账号，再回来登录。" :
                        "欢迎回来，" + getBossReviewEmail(session) + "。";
                    result.className = "live2d-quiz__result is-good";
                    if (returnToScoreGuess && session && session.user) {
                        window.setTimeout(showScoreGuessPanel, 650);
                    }
                } catch (error) {
                    result.textContent = error.message || "老板评价系统暂时不可用，请稍后再试。";
                    result.className = "live2d-quiz__result is-warning";
                } finally {
                    submitButton.disabled = false;
                }
            });
        }

        async function showBossReviewSubmitPanel() {
            clearDialog();
            setDialogMode("panel");
            dialog.classList.add("is-weather", "is-boss-review");
            meta.textContent = "老板评价 · 发布评价";
            question.textContent = "谢谢你愿意把体验告诉君雪。";
            options.innerHTML = '<div class="live2d-quiz__loading">正在确认老板账号……</div>';
            result.textContent = "";
            result.className = "live2d-quiz__result is-neutral";
            showDialog();

            let api;
            let session;

            try {
                api = await ensureBossReviewsApi();
                session = await api.getSession();
            } catch (error) {
                result.textContent = error.message || "老板评价系统暂时不可用，请稍后再试。";
                result.className = "live2d-quiz__result is-warning";
                return;
            }

            if (!session || !session.user) {
                options.innerHTML = '<div class="live2d-quiz__loading">请先登录后再发布评价哦～</div>';
                options.innerHTML += '<div class="live2d-weather-actions"><button class="live2d-quiz__option" type="button" data-action="login">登录/注册</button><button class="live2d-quiz__option" type="button" data-action="back">返回</button></div>';
                result.textContent = "登录后，你的评价会展示在老板评价墙里。";
                result.className = "live2d-quiz__result is-warning";
                refreshDialogPosition();
                options.querySelector('[data-action="login"]').addEventListener("click", function (event) {
                    event.stopPropagation();
                    showBossReviewAuthPanel("login");
                });
                options.querySelector('[data-action="back"]').addEventListener("click", function (event) {
                    event.stopPropagation();
                    showBossReviewsPanel();
                });
                return;
            }

            options.innerHTML = [
                '<form class="boss-modal-panel live2d-boss-review-form">',
                    '<div class="boss-form-heading"><span class="boss-form-badge">★ 老板评价</span><span>把这次体验写下来吧。</span></div>',
                    '<div class="boss-form-grid">',
                        '<input class="live2d-weather-input boss-form-control" name="nickname" maxlength="20" placeholder="昵称（最多 20 字）">',
                        '<select class="live2d-weather-input boss-form-control" name="serviceType">',
                            '<option>王者荣耀</option>',
                            '<option>永劫无间</option>',
                            '<option>语音聊天</option>',
                            '<option>其它</option>',
                        '</select>',
                        '<select class="live2d-weather-input boss-form-control" name="rating">',
                            '<option value="5">★★★★★ 5 星</option>',
                            '<option value="4">★★★★☆ 4 星</option>',
                            '<option value="3">★★★☆☆ 3 星</option>',
                            '<option value="2">★★☆☆☆ 2 星</option>',
                            '<option value="1">★☆☆☆☆ 1 星</option>',
                        '</select>',
                        '<div class="boss-form-stars" aria-hidden="true">★★★★★</div>',
                        '<textarea class="live2d-weather-input boss-form-control boss-form-textarea" name="message" maxlength="300" placeholder="评价内容（最多 300 字）"></textarea>',
                    '</div>',
                    '<div class="boss-modal-actions">',
                        '<button class="live2d-quiz__option boss-modal-primary" type="submit">发布评价</button>',
                        '<button class="live2d-quiz__option" type="button" data-action="back">返回</button>',
                    '</div>',
                '</form>'
            ].join("");
            result.textContent = "当前账号：" + getBossReviewEmail(session);
            result.className = "live2d-quiz__result boss-info-strip is-neutral";
            refreshDialogPosition();

            const form = options.querySelector(".live2d-boss-review-form");
            const submitButton = form.querySelector('button[type="submit"]');
            const backButton = form.querySelector('[data-action="back"]');

            backButton.addEventListener("click", function (event) {
                event.stopPropagation();
                showBossReviewsPanel();
            });

            form.addEventListener("submit", async function (event) {
                event.preventDefault();
                event.stopPropagation();

                const message = form.elements.message.value.trim();

                if (!message) {
                    result.textContent = "评价内容不能为空哦。";
                    result.className = "live2d-quiz__result is-warning";
                    return;
                }

                submitButton.disabled = true;
                result.textContent = "正在帮你发布评价……";
                result.className = "live2d-quiz__result is-neutral";

                try {
                    const response = await api.submitReview({
                        nickname: form.elements.nickname.value.trim() || getBossReviewEmail(session).split("@")[0].slice(0, 20) || "老板",
                        serviceType: form.elements.serviceType.value,
                        rating: form.elements.rating.value,
                        message: message
                    });

                    if (response && response.error) {
                        result.textContent = response.error.message;
                        result.className = "live2d-quiz__result is-warning";
                        return;
                    }

                    form.reset();
                    if (typeof api.refreshReviewWall === "function") {
                        await api.refreshReviewWall();
                    }
                    if (window.JunxueGanyuTalk && typeof window.JunxueGanyuTalk.say === "function") {
                        window.JunxueGanyuTalk.say("谢谢你的评价，我会认真收好的。", { duration: 4200 });
                    }
                    showBossReviewsPanel("谢谢你的评价，我会认真收好的。", "is-good");
                } catch (error) {
                    result.textContent = error.message || "评价发布失败，请稍后再试。";
                    result.className = "live2d-quiz__result is-warning";
                } finally {
                    submitButton.disabled = false;
                }
            });
        }

        function startQuiz() {
            setDialogMode("panel");
            recordGanyuFeature("无奖问答");
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
            hideIdleTalk();
            showQuizExitBubble(quizExitBubble);
            playVoice(quizExitVoicePath);
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

        function renderMemoryRow(label, value) {
            return '<div class="live2d-memory-row"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>';
        }

        function showMemoryPanel(message) {
            setDialogMode("panel");
            if (!message) {
                recordGanyuFeature("记忆面板");
            }
            const snapshot = getMemorySnapshot();
            clearDialog();
            dialog.classList.add("is-memory");
            options.classList.add("live2d-memory-panel");
            meta.textContent = "甘雨记得你";
            question.textContent = "这些是甘雨悄悄记下的事情。";
            options.innerHTML = [
                '<section class="live2d-memory-card" aria-label="甘雨记忆面板">',
                    renderMemoryRow("昵称", getMemoryText(snapshot.userName, "还没有告诉甘雨")),
                    renderMemoryRow("累计访问次数", String(snapshot.visitCount || 0) + "次"),
                    renderMemoryRow("连续访问", String(snapshot.streakDays || 1) + "天"),
                    renderMemoryRow("认识甘雨", "已经认识你" + String(snapshot.daysKnown || 1) + "天啦。"),
                    renderMemoryRow("第一次访问时间", formatMemoryTime(snapshot.firstVisitAt)),
                    renderMemoryRow("上次访问时间", formatMemoryTime(snapshot.lastVisitAt)),
                    renderMemoryRow("最近使用功能", getMemoryText(snapshot.lastFeature, "还没有记录")),
                    renderMemoryRow("最常查询城市", getMemoryText(snapshot.favoriteCity, "还没有记录")),
                    renderMemoryRow("最近听过歌曲", getMemoryText(snapshot.lastSongTitle, "还没有记录")),
                    renderMemoryRow("最近占卜结果", getMemoryText(snapshot.lastFortune, "还没有记录")),
                '</section>',
                '<div class="live2d-memory-actions">',
                    '<button class="live2d-wheel__small" type="button" data-memory-action="name">修改称呼</button>',
                    '<button class="live2d-wheel__small" type="button" data-memory-action="clear-preferences">清除偏好</button>',
                    '<button class="live2d-wheel__small" type="button" data-memory-action="reset">重置全部记忆</button>',
                    '<button class="live2d-wheel__small" type="button" data-memory-action="menu">回到菜单</button>',
                '</div>'
            ].join("");

            options.querySelectorAll("[data-memory-action]").forEach(function (button) {
                button.addEventListener("click", function (event) {
                    const memory = getGanyuMemory();
                    const action = button.dataset.memoryAction;

                    event.stopPropagation();

                    if (action === "name") {
                        closeDialog();
                        if (memory && typeof memory.showNamePrompt === "function") {
                            memory.showNamePrompt();
                        }
                        return;
                    }

                    if (action === "clear-preferences") {
                        if (memory && typeof memory.clearPreferences === "function") {
                            memory.clearPreferences();
                        }
                        showMemoryPanel("偏好已经清空啦，甘雨会重新慢慢了解你。");
                        return;
                    }

                    if (action === "reset") {
                        if (window.confirm("真的要让甘雨忘记这些吗？")) {
                            if (memory && typeof memory.resetAllMemory === "function") {
                                memory.resetAllMemory();
                            }
                            closeDialog();
                        }
                        return;
                    }

                    if (action === "menu") {
                        showMenu();
                    }
                });
            });

            const safeMessage = safeText(message, "");
            result.textContent = safeMessage || "如果想重新开始，也可以告诉甘雨。";
            result.className = safeMessage ? "live2d-quiz__result is-good" : "live2d-quiz__result is-neutral";
            showDialog();
        }

        function showConsultPanel() {
            clearDialog();
            setDialogMode("menu");
            meta.textContent = "咨询";
            question.textContent = "君雪可以帮你看看这些事情。";
            options.classList.add("live2d-consult-grid");
            addConsultCard("收费咨询", "价目与服务", false, function () {
                recordGanyuFeature("收费咨询");
                window.location.href = "price.html";
            });
            addConsultCard("老板号注册", "注册老板账号", false, function () {
                recordGanyuFeature("老板号注册");
                showBossRegisterPanel();
            });
            addConsultCard("老板评价", "查看与发布", false, function () {
                showBossReviewsPanel();
            });
            addConsultCard("敬请期待", "更多咨询", false, function () {
                recordGanyuFeature("更多咨询");
                result.textContent = "这个咨询入口还在准备中，之后会慢慢补上～";
                result.className = "live2d-quiz__result is-neutral";
            });
            addConsultCard("返回", "回到主菜单", false, function () {
                showMenu();
            });
            result.textContent = "想先看看哪一项呢？";
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

        function randomItem(items) {
            return items[Math.floor(Math.random() * items.length)];
        }

        function getGanyuMemory() {
            return window.JunxueGanyuMemory || null;
        }

        function getMemorySnapshot() {
            const memory = getGanyuMemory();

            if (memory && typeof memory.getSnapshot === "function") {
                return memory.getSnapshot();
            }

            return {};
        }

        function recordGanyuFeature(name) {
            const memory = getGanyuMemory();

            if (memory && typeof memory.recordFeature === "function") {
                memory.recordFeature(name);
            }
        }

        function formatMemoryTime(value) {
            if (!value) {
                return "还没有记录";
            }

            const date = new Date(value);

            if (Number.isNaN(date.getTime())) {
                return value;
            }

            return date.getFullYear() + "年" + (date.getMonth() + 1) + "月" + date.getDate() + "日 " + String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0");
        }

        function getMemoryText(value, fallback) {
            return value ? String(value) : fallback;
        }

        function getAllHeroes() {
            return Object.keys(heroPools).reduce(function (heroes, lane) {
                return heroes.concat(heroPools[lane]);
            }, []);
        }

        function getTodayKey() {
            const now = new Date();
            const month = String(now.getMonth() + 1).padStart(2, "0");
            const day = String(now.getDate()).padStart(2, "0");

            return fortuneStorageKeyPrefix + now.getFullYear() + "-" + month + "-" + day;
        }

        function readTodayFortune() {
            try {
                const rawFortune = localStorage.getItem(getTodayKey());

                return rawFortune ? JSON.parse(rawFortune) : null;
            } catch (error) {
                return null;
            }
        }

        function saveTodayFortune(fortune) {
            try {
                localStorage.setItem(getTodayKey(), JSON.stringify(fortune));
                return true;
            } catch (error) {
                return false;
            }
        }

        function buildFortune() {
            const level = randomItem(fortuneLevels);

            return {
                level: level,
                levelClass: fortuneLevelClasses[level] || "",
                number: String(Math.floor(Math.random() * 99) + 1),
                color: randomItem(luckyColors),
                hero: randomItem(getAllHeroes()),
                song: randomItem(musicList).title,
                advice: randomItem(fortuneAdviceList),
                quote: randomItem(ganyuQuotes)
            };
        }

        function setFortuneShell() {
            clearDialog();
            dialog.classList.add("is-fortune");
            options.classList.add("live2d-fortune-panel");
            meta.textContent = "日常娱乐 · 占卜";
            question.textContent = "🌙 甘雨占卜屋";
        }

        function renderFortuneResult(fortune, message) {
            const levelClass = fortune.levelClass || fortuneLevelClasses[fortune.level] || "";
            options.innerHTML = [
                '<div class="live2d-fortune-body">',
                '<section class="live2d-fortune-list" aria-label="君雪占卜结果">',
                    '<article class="live2d-fortune-item">',
                        '<span class="live2d-fortune-label">今日运势：</span>',
                        '<span class="live2d-fortune-value ' + levelClass + '">' + escapeHtml(fortune.level) + '</span>',
                    '</article>',
                    '<article class="live2d-fortune-item">',
                        '<span class="live2d-fortune-label">幸运数字：</span>',
                        '<span class="live2d-fortune-value">' + escapeHtml(fortune.number) + '</span>',
                    '</article>',
                    '<article class="live2d-fortune-item">',
                        '<span class="live2d-fortune-label">幸运颜色：</span>',
                        '<span class="live2d-fortune-value">' + escapeHtml(fortune.color) + '</span>',
                    '</article>',
                    '<article class="live2d-fortune-item">',
                        '<span class="live2d-fortune-label">幸运英雄：</span>',
                        '<span class="live2d-fortune-value">' + escapeHtml(fortune.hero) + '</span>',
                    '</article>',
                    '<article class="live2d-fortune-item">',
                        '<span class="live2d-fortune-label">幸运歌曲：</span>',
                        '<span class="live2d-fortune-value">' + escapeHtml(fortune.song) + '</span>',
                    '</article>',
                    '<article class="live2d-fortune-item">',
                        '<span class="live2d-fortune-label">今日建议：</span>',
                        '<span class="live2d-fortune-value">' + escapeHtml(fortune.advice) + '</span>',
                    '</article>',
                    '<article class="live2d-fortune-item live2d-fortune-item--quote">',
                        '<span class="live2d-fortune-label">甘雨赠言：</span>',
                        '<span class="live2d-fortune-value">' + escapeHtml(fortune.quote) + '</span>',
                    '</article>',
                '</section>',
                '<section class="live2d-fortune-message" aria-label="甘雨今日建议">',
                    '<div class="live2d-fortune-message__quote">' + escapeHtml(message || "星光已经落在纸上，请慢慢读完今天的答案。") + '</div>',
                '</section>',
                '</div>',
                '<div class="live2d-weather-actions">',
                    '<button class="live2d-wheel__small" type="button" data-fortune-action="again">再占一次</button>',
                    '<button class="live2d-wheel__small" type="button" data-fortune-action="save">保存今日占卜</button>',
                    '<button class="live2d-wheel__small" type="button" data-fortune-action="back">返回日常娱乐</button>',
                '</div>'
            ].join("");

            options.querySelector('[data-fortune-action="again"]').addEventListener("click", function (event) {
                event.stopPropagation();
                startFortuneProcess(false);
            });
            options.querySelector('[data-fortune-action="save"]').addEventListener("click", function (event) {
                event.stopPropagation();
                const saved = saveTodayFortune(fortune);

                result.textContent = saved ? "今日占卜已经收好啦。" : "今天的占卜暂时没能保存，请稍后再试。";
                result.className = saved ? "live2d-quiz__result is-good" : "live2d-quiz__result is-warning";
            });
            options.querySelector('[data-fortune-action="back"]').addEventListener("click", function (event) {
                event.stopPropagation();
                showEntertainmentPanel();
            });

            result.textContent = "";
            result.className = "live2d-quiz__result is-fortune-hidden";
            showDialog();
        }

        function showFortuneResult(fortune, options) {
            const settings = options || {};

            setFortuneShell();
            renderFortuneResult(fortune, settings.message);

            if (!settings.skipEffects) {
                const memory = getGanyuMemory();

                if (memory && typeof memory.recordFortune === "function") {
                    memory.recordFortune("今日运势：" + fortune.level + "，幸运英雄：" + fortune.hero);
                }
                playVoice(fortuneVoicePath);
                showFortuneBubble(fortuneBubble);
            }
        }

        function startFortuneProcess(overwriteToday) {
            setFortuneShell();
            options.innerHTML = [
                '<div class="live2d-fortune-process" aria-live="polite">',
                    '<span class="live2d-fortune-process__moon">☾</span>',
                    '<span>甘雨正在观察星象……</span>',
                '</div>'
            ].join("");
            result.textContent = "";
            result.className = "live2d-quiz__result is-fortune-hidden";
            showDialog();

            window.clearTimeout(fortuneProcessTimer);
            fortuneProcessTimer = window.setTimeout(function () {
                const fortune = buildFortune();

                if (overwriteToday) {
                    saveTodayFortune(fortune);
                }

                showFortuneResult(fortune);
            }, 1500);
        }

        function showFortuneSavedPrompt(savedFortune) {
            setFortuneShell();
            options.innerHTML = [
                '<div class="live2d-fortune-message live2d-fortune-message--center">',
                    '<div class="live2d-fortune-message__quote">今天已经占卜过啦，要看看之前的结果吗？</div>',
                '</div>',
                '<div class="live2d-weather-actions">',
                    '<button class="live2d-wheel__small" type="button" data-fortune-action="view">查看今日结果</button>',
                    '<button class="live2d-wheel__small" type="button" data-fortune-action="restart">重新占卜</button>',
                    '<button class="live2d-wheel__small" type="button" data-fortune-action="back">返回日常娱乐</button>',
                '</div>'
            ].join("");

            options.querySelector('[data-fortune-action="view"]').addEventListener("click", function (event) {
                event.stopPropagation();
                showFortuneResult(savedFortune, {
                    skipEffects: true,
                    message: "这是甘雨为你保存的今日占卜。"
                });
            });
            options.querySelector('[data-fortune-action="restart"]').addEventListener("click", function (event) {
                event.stopPropagation();
                startFortuneProcess(true);
            });
            options.querySelector('[data-fortune-action="back"]').addEventListener("click", function (event) {
                event.stopPropagation();
                showEntertainmentPanel();
            });

            result.textContent = "";
            result.className = "live2d-quiz__result is-fortune-hidden";
            showDialog();
        }

        function showFortuneIntro() {
            setFortuneShell();
            options.innerHTML = [
                '<div class="live2d-fortune-message live2d-fortune-message--center">',
                    '<div class="live2d-fortune-message__title">请把心里的问题轻轻放下。</div>',
                    '<div class="live2d-fortune-message__quote">甘雨会认真观察星象，为你写下今日的指引。</div>',
                '</div>',
                '<div class="live2d-weather-actions">',
                    '<button class="live2d-wheel__small" type="button" data-fortune-action="start">开始占卜</button>',
                    '<button class="live2d-wheel__small" type="button" data-fortune-action="back">返回日常娱乐</button>',
                '</div>'
            ].join("");

            options.querySelector('[data-fortune-action="start"]').addEventListener("click", function (event) {
                event.stopPropagation();
                startFortuneProcess(false);
            });
            options.querySelector('[data-fortune-action="back"]').addEventListener("click", function (event) {
                event.stopPropagation();
                showEntertainmentPanel();
            });

            result.textContent = "";
            result.className = "live2d-quiz__result is-fortune-hidden";
            showDialog();
        }

        function showFortunePanel() {
            setDialogMode("panel");
            recordGanyuFeature("占卜");
            const savedFortune = readTodayFortune();
            const lastFortune = getMemorySnapshot().lastFortune;

            if (savedFortune) {
                showFortuneSavedPrompt(savedFortune);
                if (lastFortune) {
                    result.textContent = "上次的占卜结果是：" + lastFortune + "。";
                    result.className = "live2d-quiz__result is-neutral";
                }
                return;
            }

            showFortuneIntro();
            if (lastFortune) {
                result.textContent = "上次的占卜结果是：" + lastFortune + "。";
                result.className = "live2d-quiz__result is-neutral";
            }
        }

        function getCurrentMusic() {
            return musicList[currentMusicIndex] || musicList[0];
        }

        function applyLastSongPreference() {
            const snapshot = getMemorySnapshot();

            if (musicPlaying || !snapshot.lastSongSrc) {
                return "";
            }

            const lastIndex = musicList.findIndex(function (music) {
                return music.src === snapshot.lastSongSrc;
            });

            if (lastIndex >= 0) {
                currentMusicIndex = lastIndex;
            }

            return snapshot.lastSongTitle || "";
        }

        function syncMusicAudioSource() {
            const currentMusic = getCurrentMusic();
            const audio = ensureMusicAudio();

            if (!currentMusic || audio.getAttribute("src") === currentMusic.src) {
                return;
            }

            audio.src = currentMusic.src;
        }

        function renderMusicPlayerContent() {
            const currentMusic = getCurrentMusic();
            const listHtml = musicList.map(function (music, index) {
                const isCurrent = index === currentMusicIndex ? " is-current" : "";
                const artistText = music.artist ? " · " + music.artist : "";

                return '<button class="live2d-music-track' + isCurrent + '" type="button" data-music-index="' + index + '">' + escapeHtml(music.title + artistText) + '</button>';
            }).join("");
            const currentArtistText = currentMusic && currentMusic.artist ? " · " + currentMusic.artist : "";
            const currentStatus = musicPlaying ? "播放中" : "待播放";

            options.innerHTML = [
                '<div class="live2d-music-player">',
                    '<div class="live2d-music-current">当前播放：<span>' + escapeHtml(currentMusic ? currentMusic.title + currentArtistText : "暂无歌曲") + '</span><small> · ' + currentStatus + '</small></div>',
                    '<div class="live2d-music-list" aria-label="歌曲列表">' + listHtml + '</div>',
                    '<div class="live2d-music-controls">',
                        '<button class="live2d-wheel__small" type="button" data-music-action="prev">上一首</button>',
                        '<button class="live2d-wheel__small" type="button" data-music-action="toggle">' + (musicPlaying ? "暂停" : "播放") + '</button>',
                        '<button class="live2d-wheel__small" type="button" data-music-action="next">下一首</button>',
                    '</div>',
                    '<div class="live2d-music-actions">',
                        '<button class="live2d-wheel__small" type="button" data-music-action="back">返回日常娱乐</button>',
                        '<button class="live2d-wheel__small" type="button" data-music-action="menu">回到菜单</button>',
                        '<button class="live2d-wheel__small" type="button" data-music-action="close">关闭歌曲</button>',
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
            ensureMusicAudio().play().then(function () {
                musicPlaying = true;
                const memory = getGanyuMemory();

                if (memory && typeof memory.recordSong === "function") {
                    memory.recordSong(currentMusic.title, currentMusic.src);
                }
                refreshMusicPlayerContent();
            }).catch(function (error) {
                console.warn("[JunxueMusic] Audio play failed:", currentMusic.src, error);
                musicPlaying = false;
                result.textContent = "这首歌暂时播放不了，换一首试试吧～";
                result.className = "live2d-quiz__result is-warning";
                refreshMusicPlayerContent();
            });
        }

        function pauseCurrentMusic() {
            if (musicAudio) {
                musicAudio.pause();
            }
            musicPlaying = false;
            refreshMusicPlayerContent();
        }

        function selectMusic(index, shouldPlay) {
            if (!musicList.length) {
                return;
            }

            currentMusicIndex = (index + musicList.length) % musicList.length;
            if (musicAudio) {
                musicAudio.pause();
                musicAudio.removeAttribute("src");
                musicAudio.load();
            }
            musicPlaying = false;
            refreshMusicPlayerContent();

            if (shouldPlay) {
                playCurrentMusic();
            }
        }

        function bindMusicPlayerActions() {
            options.querySelectorAll("[data-music-index]").forEach(function (button) {
                button.addEventListener("click", function (event) {
                    event.stopPropagation();
                    selectMusic(Number(button.dataset.musicIndex), true);
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

                    if (action === "close") {
                        closeCurrentMusic();
                        return;
                    }

                    if (action === "back") {
                        showEntertainmentPanel();
                        return;
                    }

                    if (action === "menu") {
                        showMenu();
                    }
                });
            });
        }

        function showMusicPlayer() {
            setDialogMode("panel");
            recordGanyuFeature("听歌");
            const lastSongTitle = applyLastSongPreference();

            clearDialog();
            dialog.classList.add("is-music");
            options.classList.add("live2d-music-panel");
            meta.textContent = "日常娱乐 · 听歌";
            question.innerHTML = '<span class="live2d-music-title">♪ 听歌</span><span class="live2d-music-subtitle">甘雨想和你分享一些音乐呢～</span>';
            renderMusicPlayerContent();
            result.textContent = lastSongTitle ? "上次听到的是《" + lastSongTitle + "》，还想继续吗？歌曲文件较大，首次播放可能需要等待几秒。" : "需要你点播放，甘雨才会开始放歌。歌曲文件较大，首次播放可能需要等待几秒。";
            result.className = "live2d-quiz__result is-neutral";
            showDialog();
        }

        function showWeatherInput() {
            setDialogMode("panel");
            recordGanyuFeature("天气");
            const favoriteCity = getMemorySnapshot().favoriteCity || "";

            clearDialog();
            dialog.classList.add("is-weather");
            options.classList.add("live2d-weather-panel");
            meta.textContent = "日常娱乐 · 查看天气";
            question.textContent = "请输入你想查询天气的城市";
            options.innerHTML = [
                '<form class="live2d-weather-form">',
                    '<input class="live2d-weather-input" type="text" name="city" placeholder="例如：北京 / 上海 / 杭州" autocomplete="off">',
                    '<button class="live2d-weather-submit" type="submit">查询</button>',
                '</form>',
                '<div class="live2d-weather-actions">',
                    '<button class="live2d-wheel__small" type="button" data-weather-action="back">返回日常娱乐</button>',
                    '<button class="live2d-wheel__small" type="button" data-weather-action="menu">回到菜单</button>',
                '</div>'
            ].join("");

            const form = options.querySelector(".live2d-weather-form");
            const cityInput = options.querySelector(".live2d-weather-input");
            const backButton = options.querySelector('[data-weather-action="back"]');
            const menuButton = options.querySelector('[data-weather-action="menu"]');

            if (favoriteCity) {
                cityInput.value = favoriteCity;
            }

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
                showEntertainmentPanel();
            });
            menuButton.addEventListener("click", function (event) {
                event.stopPropagation();
                showMenu();
            });

            result.textContent = favoriteCity ? "今天还想看看" + favoriteCity + "的天气吗？" : "哼，可不是特意帮你查天气哦～只是顺手看看那边有没有下雨而已。";
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
                    if (window.JunxueGanyuMemory && typeof window.JunxueGanyuMemory.recordWeatherCity === "function") {
                        window.JunxueGanyuMemory.recordWeatherCity(fallbackPlace.name || cityName);
                    }
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
                if (window.JunxueGanyuMemory && typeof window.JunxueGanyuMemory.recordWeatherCity === "function") {
                    window.JunxueGanyuMemory.recordWeatherCity(place.name || cityName);
                }
                renderWeatherCard(place, forecastData.daily || {});
            } catch (error) {
                result.textContent = "天气被云层挡住啦，稍后再试吧～";
                result.className = "live2d-quiz__result is-warning";
            }
        }

        function getWeatherDialogue(code) {
            if ([71, 73, 75, 77, 85, 86].indexOf(code) >= 0) {
                return {
                    text: "天气有些冷呢，记得多添一件衣服。",
                    voice: "assets/audio/ganyu_weather_snow.mp3"
                };
            }

            if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].indexOf(code) >= 0) {
                return {
                    text: "记得带伞哦，路上也要小心。",
                    voice: "assets/audio/ganyu_weather_rain.mp3"
                };
            }

            if ([0, 1, 2].indexOf(code) >= 0) {
                return {
                    text: "今天适合出门走走呢。",
                    voice: "assets/audio/ganyu_weather_sunny.mp3"
                };
            }

            return {
                text: "天气变化不定，出门前再确认一下会更安心。",
                voice: "assets/audio/ganyu_weather_cloudy.mp3"
            };
        }

        function showWeatherDialogue(code) {
            if (!window.JunxueGanyuTalk || typeof window.JunxueGanyuTalk.say !== "function") {
                return;
            }

            const dialogue = getWeatherDialogue(code);

            window.JunxueGanyuTalk.say(dialogue.text, dialogue.voice, 5200);
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

            function bindWeatherActions() {
                const againButton = options.querySelector('[data-weather-action="again"]');
                const backButton = options.querySelector('[data-weather-action="back"]');
                const calendarButton = options.querySelector('[data-weather-action="calendar"]');
                const weatherButton = options.querySelector('[data-weather-action="weather"]');

                if (againButton) {
                    againButton.addEventListener("click", function (event) {
                        event.stopPropagation();
                        showWeatherInput();
                    });
                }

                if (backButton) {
                    backButton.addEventListener("click", function (event) {
                        event.stopPropagation();
                        showEntertainmentPanel();
                    });
                }

                if (calendarButton) {
                    calendarButton.addEventListener("click", function (event) {
                        event.stopPropagation();
                        renderCalendarPage();
                    });
                }

                if (weatherButton) {
                    weatherButton.addEventListener("click", function (event) {
                        event.stopPropagation();
                        renderForecastPage();
                    });
                }
            }

            function getCalendarInfo() {
                const now = new Date();
                const day = now.getDay();
                const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
                const isRestDay = day === 0 || day === 6;

                return {
                    dateText: now.getFullYear() + "年" + (now.getMonth() + 1) + "月" + now.getDate() + "日",
                    weekdayText: weekdays[day],
                    statusText: isRestDay ? "休息日" : "工作日",
                    monthText: now.getFullYear() + "年" + (now.getMonth() + 1) + "月",
                    tipText: pickRandomItem(ganyuCalendarTips)
                };
            }

            function renderForecastPage() {
                meta.textContent = "日常娱乐 · 查看天气";
                question.textContent = cityTitle;
                options.innerHTML = [
                    '<section class="live2d-weather-page" aria-label="三天天气预报">',
                        '<button class="live2d-weather-flip" type="button" data-weather-action="calendar" aria-label="查看甘雨日历">📅</button>',
                        '<div class="live2d-weather-card">',
                            rows,
                        '</div>',
                    '</section>',
                    '<div class="live2d-weather-actions">',
                        '<button class="live2d-wheel__small" type="button" data-weather-action="again">换个城市</button>',
                        '<button class="live2d-wheel__small" type="button" data-weather-action="back">返回日常娱乐</button>',
                    '</div>'
                ].join("");
                bindWeatherActions();
            }

            function renderCalendarPage() {
                const calendar = getCalendarInfo();

                meta.textContent = "日常娱乐 · 甘雨日历";
                question.textContent = "甘雨日历";
                options.innerHTML = [
                    '<section class="live2d-weather-page" aria-label="甘雨日历">',
                        '<button class="live2d-weather-flip" type="button" data-weather-action="weather" aria-label="返回天气预报">↩</button>',
                        '<div class="live2d-calendar-card">',
                            '<h3>甘雨日历</h3>',
                            '<div class="live2d-calendar-row"><span>今天是：</span><strong>' + escapeHtml(calendar.dateText) + '</strong></div>',
                            '<div class="live2d-calendar-row"><span>星期：</span><strong>' + escapeHtml(calendar.weekdayText) + '</strong></div>',
                            '<div class="live2d-calendar-row"><span>状态：</span><strong>' + escapeHtml(calendar.statusText) + '</strong></div>',
                            '<div class="live2d-calendar-row"><span>当前月份：</span><strong>' + escapeHtml(calendar.monthText) + '</strong></div>',
                            '<div class="live2d-calendar-tip"><span>甘雨提示：</span><p>' + escapeHtml(calendar.tipText) + '</p></div>',
                        '</div>',
                    '</section>',
                    '<div class="live2d-weather-actions">',
                        '<button class="live2d-wheel__small" type="button" data-weather-action="again">换个城市</button>',
                        '<button class="live2d-wheel__small" type="button" data-weather-action="back">返回日常娱乐</button>',
                    '</div>'
                ].join("");
                bindWeatherActions();
            }

            clearDialog();
            dialog.classList.add("is-weather");
            options.classList.add("live2d-weather-panel");
            renderForecastPage();
            result.textContent = "天气小卡片准备好了。";
            result.className = "live2d-quiz__result is-good";
            showDialog();
            showWeatherDialogue(codes[0]);
        }

        function showHeroWheel() {
            setDialogMode("panel");
            recordGanyuFeature("英雄池");
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
        }

        function bindLive2DRoots() {
            findLive2DRoots().forEach(bindNode);
        }

        window.addEventListener("live2d-stage-position-changed", scheduleLive2DPopupPositions);
        window.addEventListener("resize", scheduleLive2DPopupPositions);
        document.addEventListener("visibilitychange", function () {
            if (!document.hidden) {
                scheduleLive2DPopupPositions();
            }
        });
        window.setTimeout(syncLive2DPopupPositions, 500);
        window.setTimeout(syncLive2DPopupPositions, 1500);
        window.setTimeout(syncLive2DPopupPositions, 3000);
        scheduleIdleTalk(true);

        closeButton.addEventListener("click", function (event) {
            event.stopPropagation();
            closeDialog();
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                closeDialog();
            }
        });

        window.Live2DInteractiveMenu = {
            ready: true,
            open: showMenu,
            openBossReviews: showBossReviewsPanel,
            sync: syncLive2DPopupPositions
        };
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initInteractions);
        return;
    }

    initInteractions();
})();
