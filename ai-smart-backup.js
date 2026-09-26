/* ============================================================
   CLOUDORA AI 3.0 — SMART CONTEXT LAYER
   Works on top of Cloudora AI 2.0.
   Does not replace ai-engine.js.
   ============================================================ */

(() => {
    "use strict";

    const STORAGE_KEY = "cloudoraAI3Context";
    const MAX_HISTORY = 8;

    let history = [];
    let intercepting = false;

    const $ = id => document.getElementById(id);

    /* ---------------------------------------------------------
       INITIALIZATION
    --------------------------------------------------------- */

    function init() {
        if (!$("chatMessages") || !$("chatInput") || !$("chatBtn")) {
            setTimeout(init, 500);
            return;
        }

        loadContext();
        addSmartChrome();
        attachInterceptors();
        updateContextLabel();

        console.log("Cloudora AI 3.0 — Smart Context loaded.");
    }

    /* ---------------------------------------------------------
       LOCAL CONTEXT
    --------------------------------------------------------- */

    function loadContext() {
        try {
            history = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

            if (!Array.isArray(history)) {
                history = [];
            }
        } catch {
            history = [];
        }
    }

    function saveContext() {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(history.slice(-MAX_HISTORY))
            );
        } catch {
            // Storage may be unavailable in private/restricted browsers.
        }
    }

    function remember(question, answer, meta = {}) {
        history.push({
            question,
            answer: stripHTML(answer),
            timestamp: Date.now(),
            intent: meta.intent || detectIntent(question),
            topic: meta.topic || detectTopic(question),
            timeReference: detectTimeReference(question)
        });

        history = history.slice(-MAX_HISTORY);
        saveContext();
        updateContextLabel();
    }

    /* ---------------------------------------------------------
       CONTEXT DETECTION
    --------------------------------------------------------- */

    function detectTimeReference(q) {
        const text = normalize(q);

        if (/\bday after tomorrow\b/.test(text)) return "day-after-tomorrow";
        if (/\btomorrow\b/.test(text)) return "tomorrow";
        if (/\btonight\b/.test(text)) return "tonight";
        if (/\btoday\b|\bright now\b|\bcurrently\b/.test(text)) return "today";
        if (/\bthis weekend\b|\bweekend\b/.test(text)) return "weekend";
        if (/\bthis evening\b|\bevening\b/.test(text)) return "evening";
        if (/\bthis morning\b|\bmorning\b/.test(text)) return "morning";
        if (/\bafternoon\b/.test(text)) return "afternoon";

        return null;
    }

    function detectTopic(q) {
        const text = normalize(q);

        if (/rain|rainy|raining|precipitation|umbrella/.test(text)) return "rain";
        if (/temperature|temp|hot|cold|warm|cool|heat/.test(text)) return "temperature";
        if (/wind|windy|gust/.test(text)) return "wind";
        if (/humidity|humid|sticky/.test(text)) return "humidity";
        if (/air quality|aqi|pollution|pm2/.test(text)) return "air";
        if (/uv|sunburn|sunscreen|sun protection/.test(text)) return "uv";
        if (/wear|clothes|outfit|jacket|shirt|clothing/.test(text)) return "clothing";
        if (/outside|outdoor|walk|run|running|cycling|bike|hike|picnic|exercise/.test(text)) return "outdoor";
        if (/travel|trip|drive|driving|commute/.test(text)) return "travel";
        if (/sunrise|dawn/.test(text)) return "sunrise";
        if (/sunset|dusk/.test(text)) return "sunset";
        if (/weather|forecast|conditions/.test(text)) return "weather";

        return "general";
    }

    function detectIntent(q) {
        const text = normalize(q);

        if (/umbrella/.test(text)) return "umbrella";
        if (/rain|raining|precipitation/.test(text)) return "rain";
        if (/temperature|temp|hot|cold|warm|cool|heat/.test(text)) return "temperature";
        if (/air quality|aqi|pollution|pm2/.test(text)) return "air";
        if (/outdoor|outside|walk|run|cycling|bike|hike|exercise/.test(text)) return "outdoor";
        if (/wear|clothes|outfit|jacket|shirt|clothing/.test(text)) return "clothing";
        if (/wind|windy|gust/.test(text)) return "wind";
        if (/humidity|humid|sticky/.test(text)) return "humidity";
        if (/uv|sunburn|sunscreen/.test(text)) return "uv";
        if (/sunrise|dawn/.test(text)) return "sunrise";
        if (/sunset|dusk/.test(text)) return "sunset";

        return "general";
    }

    function getLastContext() {
        return history.length ? history[history.length - 1] : null;
    }

    /* ---------------------------------------------------------
       SMART FOLLOW-UP DETECTION
    --------------------------------------------------------- */

    function isFollowUp(question) {
        const text = normalize(question);

        if (!history.length) return false;

        return (
            /^(what about|how about|and what about|and|then what|what if)\b/.test(text) ||
            /^(morning|evening|afternoon|tonight|tomorrow|later)\b/.test(text) ||
            /^(why|when|where|how much|how long)\b/.test(text) ||
            /^(is it|will it|should i|can i)\b/.test(text) ||
            /^(there|that|this|it)\b/.test(text)
        );
    }

    function contextualize(question) {
        const last = getLastContext();

        if (!last) {
            return {
                handled: false,
                question
            };
        }

        const text = normalize(question);
        const lastTime = last.timeReference;
        const lastTopic = last.topic;

        /* ---------------------------------------------
           "What about tomorrow?"
        --------------------------------------------- */

        if (
            /\bwhat about tomorrow\b|\band tomorrow\b|\bhow about tomorrow\b/.test(text)
        ) {
            return {
                handled: true,
                type: "standard",
                question: buildExplicitQuestion(lastTopic, "tomorrow")
            };
        }

        /* ---------------------------------------------
           "What about evening?"
        --------------------------------------------- */

        if (
            /\bwhat about evening\b|\bhow about evening\b|\bevening\b/.test(text)
        ) {
            return {
                handled: true,
                type: "time",
                time: "evening",
                previousTime: lastTime,
                topic: lastTopic
            };
        }

        /* ---------------------------------------------
           "What about morning?"
        --------------------------------------------- */

        if (
            /\bwhat about morning\b|\bhow about morning\b|\bmorning\b/.test(text)
        ) {
            return {
                handled: true,
                type: "time",
                time: "morning",
                previousTime: lastTime,
                topic: lastTopic
            };
        }

        /* ---------------------------------------------
           "What about afternoon?"
        --------------------------------------------- */

        if (
            /\bwhat about afternoon\b|\bhow about afternoon\b/.test(text)
        ) {
            return {
                handled: true,
                type: "time",
                time: "afternoon",
                previousTime: lastTime,
                topic: lastTopic
            };
        }

        /* ---------------------------------------------
           "What about tonight?"
        --------------------------------------------- */

        if (/\bwhat about tonight\b|\bhow about tonight\b/.test(text)) {
            return {
                handled: true,
                type: "time",
                time: "tonight",
                previousTime: lastTime,
                topic: lastTopic
            };
        }

        /* ---------------------------------------------
           "Is it good?" / "Should I?"
        --------------------------------------------- */

        if (
            /^(is it good|is it okay|is it fine|should i|can i|will it be okay)/.test(text)
        ) {
            return {
                handled: true,
                type: "topic",
                topic: lastTopic,
                time: lastTime || "today"
            };
        }

        return {
            handled: false,
            question
        };
    }

    function buildExplicitQuestion(topic, time) {
        const subject = {
            rain: "rain",
            temperature: "temperature",
            wind: "wind",
            humidity: "humidity",
            air: "air quality",
            uv: "UV",
            clothing: "what should I wear",
            outdoor: "outdoor conditions",
            travel: "travel conditions",
            weather: "weather"
        }[topic] || "weather";

        if (subject === "what should I wear") {
            return `What should I wear ${time}?`;
        }

        return `What is the ${subject} ${time}?`;
    }

    /* ---------------------------------------------------------
       SMART TIME RESPONSES
    --------------------------------------------------------- */

    function handleTimeQuestion(info) {
        const context = getWeatherContext();

        if (!context) {
            return {
                text: "I'm still waiting for the latest weather data to load.",
                topic: info.topic
            };
        }

        const hours = context.hours;

        if (!hours.length) {
            return {
                text: "I don't have enough hourly forecast data to compare that time period yet.",
                topic: info.topic
            };
        }

        let candidates = hours.filter(h => {
            const hour = getHour(h.time);

            if (info.time === "morning") {
                return hour >= 6 && hour < 12;
            }

            if (info.time === "afternoon") {
                return hour >= 12 && hour < 17;
            }

            if (info.time === "evening") {
                return hour >= 17 && hour < 22;
            }

            if (info.time === "tonight") {
                return hour >= 20 || hour < 6;
            }

            return true;
        });

        if (!candidates.length) {
            candidates = hours;
        }

        const best = findBestHour(candidates);
        const wettest = [...candidates].sort(
            (a, b) => (b.rain || 0) - (a.rain || 0)
        )[0];

        const timeLabel = capitalize(info.time);

        let text =
            `For **${timeLabel.toLowerCase()}**, the forecast is around ` +
            `**${round(best.temp)}${context.unit}**, ` +
            `with a **${round(best.rain)}%** rain chance and ` +
            `wind around **${round(best.wind)} km/h**. `;

        if (wettest && wettest.rain >= 50) {
            text += `The wetter point in this period is around **${clock(wettest.time)}**. `;
        }

        if (info.topic === "rain") {
            text += best.rain >= 50
                ? "Rain is something I'd plan around during this period."
                : "There isn't a strong rain signal during this period.";
        } else if (info.topic === "temperature") {
            text += comfortSentence(best.feels || best.temp);
        } else if (info.topic === "outdoor") {
            text += outdoorSentence(best);
        } else if (info.topic === "clothing") {
            text += clothingSentence(best, context);
        } else {
            text += outdoorSentence(best);
        }

        return {
            text,
            topic: info.topic,
            time: info.time
        };
    }

    /* ---------------------------------------------------------
       WEATHER DATA ACCESS
    --------------------------------------------------------- */

    function getWeatherContext() {
        if (
            typeof weatherData === "undefined" ||
            !weatherData ||
            !weatherData.current
        ) {
            return null;
        }

        const hourly = weatherData.hourly || {};
        const index =
            typeof getCurrentHourlyIndex === "function"
                ? getCurrentHourlyIndex()
                : 0;

        const unit =
            typeof temperatureUnit !== "undefined" &&
            temperatureUnit === "fahrenheit"
                ? "°F"
                : "°C";

        const hours = [];

        for (
            let i = index;
            i < Math.min(index + 24, hourly.time?.length || 0);
            i++
        ) {
            hours.push({
                time: hourly.time?.[i],
                temp: num(hourly.temperature_2m?.[i]),
                feels: num(hourly.apparent_temperature?.[i]),
                rain: num(hourly.precipitation_probability?.[i]),
                precipitation: num(hourly.precipitation?.[i]),
                wind: num(hourly.wind_speed_10m?.[i]),
                uv: num(hourly.uv_index?.[i]),
                humidity: num(hourly.relative_humidity_2m?.[i]),
                code: num(hourly.weather_code?.[i])
            });
        }

        return {
            city:
                typeof currentCity !== "undefined"
                    ? currentCity?.name || "your location"
                    : "your location",
            unit,
            hours
        };
    }

    /* ---------------------------------------------------------
       SMART SCORING
    --------------------------------------------------------- */

    function findBestHour(hours) {
        if (!hours.length) return null;

        return [...hours]
            .map(h => {
                const rainPenalty = Math.min(h.rain || 0, 80) * 0.55;
                const windPenalty = Math.max(0, (h.wind || 0) - 18) * 1.2;
                const uvPenalty = Math.max(0, (h.uv || 0) - 7) * 3;
                const heatPenalty =
                    h.temp >= 35 ? 16 :
                    h.temp >= 32 ? 8 :
                    0;

                return {
                    ...h,
                    score:
                        rainPenalty +
                        windPenalty +
                        uvPenalty +
                        heatPenalty
                };
            })
            .sort((a, b) => a.score - b.score)[0];
    }

    function comfortSentence(temp) {
        if (temp >= 36) {
            return "It will feel quite hot, so shade and hydration will matter.";
        }

        if (temp >= 31) {
            return "It should feel warm to hot, especially in direct sun.";
        }

        if (temp >= 24) {
            return "That is generally a comfortable range for many outdoor activities.";
        }

        if (temp >= 17) {
            return "That is a fairly mild range for most people.";
        }

        if (temp >= 10) {
            return "It will feel cool, especially if you're outside for a while.";
        }

        return "That's cold enough that warm layers are worth considering.";
    }

    function outdoorSentence(h) {
        if (!h) return "";

        if (h.rain >= 60) {
            return "I'd be cautious about outdoor plans because of the higher rain risk.";
        }

        if (h.wind >= 35) {
            return "The stronger wind may make outdoor activities less comfortable.";
        }

        if (h.temp >= 34) {
            return "The heat may make longer outdoor activity uncomfortable.";
        }

        if (h.uv >= 7) {
            return "Outdoor plans look more comfortable with sun protection.";
        }

        return "That looks like one of the more comfortable periods for being outside.";
    }

    function clothingSentence(h, context) {
        if (!h) return "";

        if (h.temp >= 32) {
            return "I'd choose light, breathable clothing.";
        }

        if (h.temp >= 24) {
            return "A normal light outfit should work well.";
        }

        if (h.temp >= 17) {
            return "A light extra layer could be useful.";
        }

        return "I'd go with warmer layers.";
    }

    /* ---------------------------------------------------------
       EVENT INTERCEPTION
    --------------------------------------------------------- */

    function attachInterceptors() {
        const input = $("chatInput");
        const button = $("chatBtn");

        if (!input || !button) return;

        input.addEventListener(
            "keydown",
            event => {
                if (event.key !== "Enter" || event.shiftKey) return;

                const question = input.value.trim();

                if (!isFollowUp(question)) return;

                const result = contextualize(question);

                if (!result.handled) return;

                event.preventDefault();
                event.stopImmediatePropagation();

                handleSmartQuestion(question, result);
            },
            true
        );

        button.addEventListener(
            "click",
            event => {
                const question = input.value.trim();

                if (!isFollowUp(question)) return;

                const result = contextualize(question);

                if (!result.handled) return;

                event.preventDefault();
                event.stopImmediatePropagation();

                handleSmartQuestion(question, result);
            },
            true
        );
    }

    function handleSmartQuestion(question, result) {
        if (intercepting) return;

        intercepting = true;

        try {
            addMessage(question, "user-message");

            const response =
                result.type === "time"
                    ? handleTimeQuestion(result)
                    : {
                        text: buildFollowUpResponse(result),
                        topic: result.topic
                    };

            addMessage(response.text, "bot-message");

            remember(question, response.text, {
                topic: response.topic || result.topic,
                intent: detectIntent(question),
                timeReference:
                    result.time ||
                    result.previousTime ||
                    detectTimeReference(question)
            });

            showSuggestions(response.topic, result.time);
        } finally {
            intercepting = false;
        }
    }

    function buildFollowUpResponse(result) {
        const context = getWeatherContext();

        if (!context) {
            return "I'm still waiting for the latest weather data.";
        }

        const time = result.time || result.previousTime || "today";
        const topic = result.topic || "weather";

        if (topic === "temperature") {
            return buildExplicitQuestion("temperature", time);
        }

        if (topic === "rain") {
            return `For **${time}**, I can check the rain risk from the hourly forecast.`;
        }

        if (topic === "outdoor") {
            return `For **${time}**, I can compare the forecast's rain, wind, temperature and UV to find a comfortable window.`;
        }

        return `For **${time}**, I'll keep the previous **${topic}** context in mind.`;
    }

    /* ---------------------------------------------------------
       UI
    --------------------------------------------------------- */

    function addSmartChrome() {
        const card = $("chatMessages")?.closest(".ai-card");

        if (!card || card.dataset.ai3Chrome) return;

        card.dataset.ai3Chrome = "true";

        const status = document.createElement("div");

        status.className = "ai3-context-bar";

        status.innerHTML = `
            <div class="ai3-status-left">
                <span class="ai3-dot"></span>
                <div>
                    <strong>Smart Context</strong>
                    <small id="ai3ContextText">Ready to remember your conversation</small>
                </div>
            </div>

            <button type="button" id="ai3ClearContext">
                Clear memory
            </button>
        `;

        $("chatMessages").before(status);

        $("ai3ClearContext")?.addEventListener("click", () => {
            history = [];
            saveContext();
            updateContextLabel();

            if (typeof showToast === "function") {
                showToast("AI 3.0 memory cleared");
            }
        });
    }

    function updateContextLabel() {
        const label = $("ai3ContextText");

        if (!label) return;

        const last = getLastContext();

        if (!last) {
            label.textContent = "Ready to remember your conversation";
            return;
        }

        const city =
            typeof currentCity !== "undefined"
                ? currentCity?.name
                : null;

        const parts = [];

        if (city) parts.push(city);
        if (last.timeReference) parts.push(last.timeReference);
        if (last.topic && last.topic !== "general") {
            parts.push(last.topic);
        }

        label.textContent =
            parts.length
                ? `Context: ${parts.join(" · ")}`
                : "Conversation context active";
    }

    function showSuggestions(topic, time) {
        const card = $("chatMessages")?.closest(".ai-card");
        if (!card) return;

        const old = card.querySelector(".ai3-suggestions");
        old?.remove();

        const quick = getSuggestions(topic, time);

        if (!quick.length) return;

        const wrapper = document.createElement("div");
        wrapper.className = "ai3-suggestions";

        wrapper.innerHTML = `
            <span class="ai3-suggestions-title">Continue the conversation</span>
            <div class="ai3-suggestion-list">
                ${quick
                    .map(
                        item =>
                            `<button type="button" data-ai3-question="${escapeAttr(item.question)}">${item.icon} ${escapeHTML(item.label)}</button>`
                    )
                    .join("")}
            </div>
        `;

        $("chatMessages").after(wrapper);

        wrapper.querySelectorAll("[data-ai3-question]").forEach(button => {
            button.addEventListener("click", () => {
                const input = $("chatInput");

                if (!input) return;

                input.value = button.dataset.ai3Question;
                input.focus();
            });
        });
    }

    function getSuggestions(topic, time) {
        const prefix =
            time && time !== "today"
                ? `${time} `
                : "";

        const map = {
            rain: [
                {
                    icon: "☔",
                    label: "Umbrella?",
                    question: `Will I need an umbrella ${prefix}today?`
                },
                {
                    icon: "🕐",
                    label: "Rain timing",
                    question: `When is rain most likely ${prefix}today?`
                },
                {
                    icon: "🏃",
                    label: "Outdoor plans",
                    question: `Is ${prefix}good for outdoor activities?`
                }
            ],

            temperature: [
                {
                    icon: "👕",
                    label: "What to wear",
                    question: `What should I wear ${prefix}today?`
                },
                {
                    icon: "🌡️",
                    label: "Feels like",
                    question: `What will it feel like ${prefix}today?`
                },
                {
                    icon: "🏃",
                    label: "Go outside?",
                    question: `Is ${prefix}good for going outside?`
                }
            ],

            outdoor: [
                {
                    icon: "🕐",
                    label: "Best time",
                    question: `What's the best time to go outside ${prefix}today?`
                },
                {
                    icon: "☔",
                    label: "Rain risk",
                    question: `What's the rain risk ${prefix}today?`
                },
                {
                    icon: "👕",
                    label: "What to wear",
                    question: `What should I wear ${prefix}today?`
                }
            ],

            clothing: [
                {
                    icon: "☔",
                    label: "Rain?",
                    question: `Will it rain ${prefix}today?`
                },
                {
                    icon: "🌡️",
                    label: "Temperature",
                    question: `What's the temperature ${prefix}today?`
                }
            ]
        };

        return (
            map[topic] || [
                {
                    icon: "🌧️",
                    label: "Rain",
                    question: `Will it rain ${prefix}today?`
                },
                {
                    icon: "🌡️",
                    label: "Temperature",
                    question: `What's the temperature ${prefix}today?`
                },
                {
                    icon: "🏃",
                    label: "Outdoors",
                    question: `Is ${prefix}good for outdoor activities?`
                }
            ]
        );
    }

    /* ---------------------------------------------------------
       MESSAGE HELPERS
    --------------------------------------------------------- */

    function addMessage(text, className) {
        const container = $("chatMessages");

        if (!container) return;

        const div = document.createElement("div");

        div.className = className;

        if (className === "bot-message") {
            div.innerHTML = formatText(text);

            const actions = document.createElement("div");

            actions.className = "ai3-message-actions";

            actions.innerHTML = `
                <button type="button" data-ai3-copy>Copy</button>
            `;

            actions
                .querySelector("[data-ai3-copy]")
                ?.addEventListener("click", () => {
                    navigator.clipboard?.writeText(stripHTML(text));

                    if (typeof showToast === "function") {
                        showToast("Answer copied");
                    }
                });

            div.appendChild(actions);
        } else {
            div.textContent = text;
        }

        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    function formatText(text) {
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/\n/g, "<br>");
    }

    function stripHTML(text) {
        const div = document.createElement("div");
        div.innerHTML = text;
        return div.textContent || "";
    }

    function escapeHTML(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function escapeAttr(value) {
        return escapeHTML(value);
    }

    /* ---------------------------------------------------------
       UTILITIES
    --------------------------------------------------------- */

    function normalize(text) {
        return String(text)
            .toLowerCase()
            .replace(/[?!,.]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function num(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n : 0;
    }

    function round(value) {
        return Math.round(num(value));
    }

    function getHour(value) {
        if (!value) return -1;

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return -1;

        return date.getHours();
    }

    function clock(value) {
        if (!value) return "—";

        try {
            return new Date(value).toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit"
            });
        } catch {
            return value;
        }
    }

    function capitalize(value) {
        return String(value).charAt(0).toUpperCase() + String(value).slice(1);
    }

    function currentLocationChanged() {
        updateContextLabel();
    }

    window.CloudoraAI3 = {
        clearMemory() {
            history = [];
            saveContext();
            updateContextLabel();
        },

        getContext() {
            return [...history];
        },

        refresh() {
            loadContext();
            updateContextLabel();
        },

        locationChanged: currentLocationChanged
    };

    /* ---------------------------------------------------------
       START
    --------------------------------------------------------- */

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }

})();