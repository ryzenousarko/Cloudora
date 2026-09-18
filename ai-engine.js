
/* ============================================================
   CLOUDORA AI 2.0 — WEATHER INTELLIGENCE ENGINE
   Drop-in enhancement for the existing Cloudora app.
   No API key required. Uses the weather data already loaded by
   Cloudora, so answers stay grounded in the selected location.
   ============================================================ */

(() => {
    "use strict";

    const $ = id => document.getElementById(id);
    let aiBusy = false;
    let lastIntent = null;
    let lastAnswer = "";
    let responseIndex = Number(localStorage.getItem("cloudoraAIResponseIndex") || 0);

    const responseStyles = ["direct", "friendly", "detailed", "compact"];

    const intents = {
        current: ["weather now", "right now", "currently", "current weather", "what is it like", "how is it outside"],
        temperature: ["temperature", "temp", "hot", "cold", "warm", "cool", "heat", "feels like"],
        rain: ["rain", "raining", "precipitation", "umbrella", "shower", "drizzle", "wet"],
        forecast: ["forecast", "today", "tomorrow", "tonight", "this evening", "this morning", "later"],
        hourly: ["hour", "hourly", "when will", "what time", "next few hours", "next hour", "later today"],
        outdoor: ["outdoor", "outside", "go out", "walk", "walking", "run", "running", "jog", "cycling", "bike", "hike", "picnic", "sports", "exercise"],
        travel: ["travel", "trip", "drive", "driving", "commute", "commuting", "flight", "airport", "road"],
        clothing: ["wear", "clothes", "outfit", "jacket", "shirt", "dress", "clothing"],
        umbrella: ["umbrella", "carry umbrella", "bring umbrella"],
        uv: ["uv", "sun", "sunburn", "sunscreen", "sun protection"],
        wind: ["wind", "windy", "gust"],
        air: ["air quality", "aqi", "pollution", "pm2.5", "pm10", "smog", "ozone"],
        humidity: ["humidity", "humid", "moisture", "sticky"],
        visibility: ["visibility", "fog", "mist"],
        pressure: ["pressure", "barometric"],
        sunrise: ["sunrise", "sun rises", "dawn"],
        sunset: ["sunset", "sun sets", "dusk"],
        compare: ["compare", "difference", "better weather", "which city"],
        besttime: ["best time", "good time", "ideal time", "when should i"],
        tomorrow: ["tomorrow", "next day"],
        weekend: ["weekend", "saturday", "sunday"],
        why: ["why", "reason", "because"],
        summary: ["summary", "brief me", "overview", "give me an overview", "what should i know"],
    };

    function setup() {
        const card = $("chatMessages");
        const input = $("chatInput");
        const button = $("chatBtn");
        if (!card || !input || !button) return;

        // Remove the original event handlers safely.
        const freshInput = input.cloneNode(true);
        const freshButton = button.cloneNode(true);
        input.replaceWith(freshInput);
        button.replaceWith(freshButton);

        buildAIChrome();
        addWelcomeIfNeeded();

        freshButton.addEventListener("click", () => send());
        freshInput.addEventListener("keydown", e => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
            }
        });

        document.querySelectorAll("[data-ai-question]").forEach(btn => {
            btn.addEventListener("click", () => {
                freshInput.value = btn.dataset.aiQuestion;
                send();
            });
        });
    }

    function buildAIChrome() {
        const section = document.querySelector("#chatMessages")?.closest(".ai-card");
        if (!section || section.dataset.aiEnhanced) return;
        section.dataset.aiEnhanced = "true";

        const title = section.closest(".section")?.querySelector(".section-title h2");
        if (title) title.textContent = "Cloudora Weather Intelligence";

        const messages = $("chatMessages");
        const quick = section.querySelector(".quick-actions");
        const input = section.querySelector(".chat-input");

        const bar = document.createElement("div");
        bar.className = "ai-intelligence-bar";
        bar.innerHTML = `
            <div class="ai-status">
                <span class="ai-live-dot"></span>
                <div>
                    <strong>Weather Intelligence</strong>
                    <small id="aiContextLabel">Grounded in the current forecast</small>
                </div>
            </div>
            <div class="ai-tools">
                <button type="button" class="ai-tool-btn" id="aiClearBtn">Clear</button>
                <button type="button" class="ai-tool-btn" id="aiStyleBtn">Answer style</button>
            </div>
        `;
        messages.before(bar);

        if (quick) {
            quick.innerHTML = `
                <button data-ai-question="What should I know about the weather right now?">✨ Weather brief</button>
                <button data-ai-question="Will I need an umbrella today?">☔ Umbrella</button>
                <button data-ai-question="When is the best time to go outside today?">🌤️ Best time outside</button>
                <button data-ai-question="What should I wear today?">👕 What to wear</button>
                <button data-ai-question="Is today good for a run or walk?">🏃 Exercise</button>
                <button data-ai-question="How will the weather change over the next few hours?">📈 Next hours</button>
                <button data-ai-question="How is the air quality and what does it mean?">🌫️ Air quality</button>
                <button data-ai-question="What is the weather like tomorrow?">📅 Tomorrow</button>
            `;
            quick.querySelectorAll("button").forEach(btn => {
                btn.addEventListener("click", () => {
                    const input = $("chatInput");
                    if (!input) return;
                    input.value = btn.dataset.aiQuestion;
                    send();
                });
            });
        }

        if (input) {
            const hint = document.createElement("div");
            hint.className = "ai-input-hint";
            hint.textContent = "Ask naturally — Cloudora understands weather, timing, activities, clothing, rain, UV, wind, air quality and more.";
            input.before(hint);
        }

        $("aiClearBtn")?.addEventListener("click", () => {
            messages.innerHTML = "";
            addBot("Chat cleared. Ask me anything about the current forecast.");
        });

        $("aiStyleBtn")?.addEventListener("click", () => {
            responseIndex = (responseIndex + 1) % responseStyles.length;
            localStorage.setItem("cloudoraAIResponseIndex", responseIndex);
            const style = responseStyles[responseIndex];
            showToastLocal(`Answer style: ${style}`);
        });
    }

    function addWelcomeIfNeeded() {
        const box = $("chatMessages");
        if (!box) return;
        if (!box.querySelector(".bot-message")) {
            addBot("Hi! I'm Cloudora Weather Intelligence. I use the live forecast for your selected city, not generic guesses. Try asking “When should I go outside?” or “What should I wear today?”");
        }
    }

    function send() {
        if (aiBusy) return;
        const input = $("chatInput");
        if (!input) return;
        const question = input.value.trim();
        if (!question) return;

        addUser(question);
        input.value = "";
        setBusy(true);

        setTimeout(() => {
            try {
                const result = answerQuestion(question);
                lastAnswer = result.text;
                lastIntent = result.intent;
                addBot(result.text, result.meta);
            } catch (err) {
                addBot("I couldn't calculate that from the current weather data. Try asking about the temperature, rain, wind, UV, air quality, timing, or forecast.");
                console.error("Cloudora AI:", err);
            } finally {
                setBusy(false);
            }
        }, 220);
    }

    function setBusy(value) {
        aiBusy = value;
        const button = $("chatBtn");
        if (button) {
            button.disabled = value;
            button.textContent = value ? "Thinking…" : "Send";
        }
        const input = $("chatInput");
        if (input) input.setAttribute("aria-busy", String(value));
    }

    function addUser(text) {
        appendMessage(text, "user-message");
    }

    function addBot(text, meta = {}) {
        appendMessage(formatText(text), "bot-message", meta);
    }

    function appendMessage(text, className, meta = {}) {
        const container = $("chatMessages");
        if (!container) return;
        const div = document.createElement("div");
        div.className = className;
        div.innerHTML = text;

        if (className === "bot-message") {
            const actions = document.createElement("div");
            actions.className = "ai-message-actions";
            actions.innerHTML = `
                <button type="button" data-copy>Copy</button>
                <button type="button" data-again>Another answer</button>
            `;
            actions.querySelector("[data-copy]").addEventListener("click", () => {
                navigator.clipboard?.writeText(stripHTML(text));
                showToastLocal("Answer copied");
            });
            actions.querySelector("[data-again]").addEventListener("click", () => {
                if (lastIntent) {
                    const alternate = buildIntentAnswer(lastIntent, getContext(), true);
                    lastAnswer = alternate.text;
                    appendMessage(alternate.text, "bot-message");
                }
            });
            div.appendChild(actions);

            if (meta.source) {
                const source = document.createElement("small");
                source.className = "ai-source";
                source.textContent = meta.source;
                div.appendChild(source);
            }
        }

        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    function answerQuestion(raw) {
        const q = normalize(raw);
        const context = getContext();
        const intent = detectIntent(q);

        if (!context) {
            return {
                intent,
                text: "Weather data is still loading. Once the forecast appears, I can give you a location-specific answer."
            };
        }

        if (intent === "tomorrow") return buildTomorrow(context);
        if (intent === "weekend") return buildWeekend(context);
        if (intent === "summary") return buildSummary(context);
        if (intent === "compare") return buildComparisonHelp(context);

        return buildIntentAnswer(intent, context, false, q);
    }

    function detectIntent(q) {
        const explicit = [
            "umbrella","air","clothing","travel","outdoor","besttime",
            "tomorrow","weekend","sunrise","sunset","uv","wind","humidity",
            "visibility","pressure","temperature","rain","hourly","forecast",
            "summary","compare","current","why"
        ];
        for (const intent of explicit) {
            if (intents[intent].some(k => q.includes(k))) return intent;
        }
        return "summary";
    }

    function buildIntentAnswer(intent, c, alternate = false, q = "") {
        switch (intent) {
            case "umbrella": return buildUmbrella(c, alternate);
            case "rain": return buildRain(c, alternate);
            case "temperature": return buildTemperature(c, alternate);
            case "outdoor": return buildOutdoor(c, alternate, q);
            case "travel": return buildTravel(c, alternate);
            case "clothing": return buildClothing(c, alternate);
            case "uv": return buildUV(c, alternate);
            case "wind": return buildWind(c, alternate);
            case "air": return buildAir(c, alternate);
            case "humidity": return buildHumidity(c, alternate);
            case "visibility": return buildVisibility(c, alternate);
            case "pressure": return buildPressure(c, alternate);
            case "sunrise": return buildSunrise(c);
            case "sunset": return buildSunset(c);
            case "hourly": return buildNextHours(c, alternate);
            case "forecast": return buildTodayForecast(c, alternate);
            case "besttime": return buildBestTime(c, alternate);
            case "why": return buildWhy(c);
            case "current": return buildCurrent(c, alternate);
            default: return buildSummary(c, alternate);
        }
    }

    function getContext() {
        if (typeof weatherData === "undefined" || !weatherData?.current) return null;
        const h = weatherData.hourly || {};
        const d = weatherData.daily || {};
        const i = typeof getCurrentHourlyIndex === "function" ? getCurrentHourlyIndex() : 0;

        const temp = num(weatherData.current.temperature_2m);
        const feels = num(weatherData.current.apparent_temperature);
        const rainNow = num(weatherData.current.precipitation);
        const rainProb = num(d.precipitation_probability_max?.[0]);
        const uv = num(d.uv_index_max?.[0] ?? h.uv_index?.[i]);
        const wind = num(weatherData.current.wind_speed_10m);
        const humidity = num(weatherData.current.relative_humidity_2m);
        const cloud = num(weatherData.current.cloud_cover);
        const visibility = num(h.visibility?.[i]) / 1000;
        const code = num(weatherData.current.weather_code);

        const hours = [];
        for (let x = i; x < Math.min(i + 24, h.time?.length || 0); x++) {
            hours.push({
                time: h.time[x],
                temp: num(h.temperature_2m?.[x]),
                feels: num(h.apparent_temperature?.[x]),
                rain: num(h.precipitation_probability?.[x]),
                precipitation: num(h.precipitation?.[x]),
                wind: num(h.wind_speed_10m?.[x]),
                uv: num(h.uv_index?.[x]),
                humidity: num(h.relative_humidity_2m?.[x]),
                visibility: num(h.visibility?.[x]) / 1000,
                code: num(h.weather_code?.[x])
            });
        }

        return {
            city: typeof currentCity !== "undefined" ? currentCity : { name: "this location" },
            current: { temp, feels, rainNow, rainProb, uv, wind, humidity, cloud, visibility, code },
            daily: d,
            hours,
            unit: typeof temperatureUnit !== "undefined" && temperatureUnit === "fahrenheit" ? "°F" : "°C",
            unitShort: typeof temperatureUnit !== "undefined" && temperatureUnit === "fahrenheit" ? "F" : "C",
            description: typeof getWeatherDescription === "function" ? getWeatherDescription(code) : "current conditions",
            nowIndex: i
        };
    }

    function buildCurrent(c, alt) {
        const variants = [
            `Right now in **${c.city.name}**, it's **${round(c.current.temp)}${c.unit}** and feels like **${round(c.current.feels)}${c.unit}**, with **${c.description.toLowerCase()}**. Wind is **${round(c.current.wind)} km/h**, humidity is **${round(c.current.humidity)}%**, and the rain probability for today is **${round(c.current.rainProb)}%**.`,
            `**${c.city.name} now:** ${round(c.current.temp)}${c.unit}, feels ${round(c.current.feels)}${c.unit}. Conditions are **${c.description.toLowerCase()}**. Expect ${round(c.current.wind)} km/h wind and a ${round(c.current.rainProb)}% chance of rain today.`,
        ];
        return { intent: "current", text: alt ? variants[1] : variants[responseIndex % variants.length], meta: source(c) };
    }

    function buildUmbrella(c, alt) {
        const rainy = c.current.rainProb >= 50 || c.hours.slice(0, 8).some(h => h.rain >= 60);
        const peak = Math.max(...c.hours.slice(0, 12).map(h => h.rain || 0), 0);
        const time = c.hours.find(h => h.rain === peak)?.time;
        if (rainy) {
            return {
                intent: "umbrella",
                text: `**Yes — I'd carry one.** Today's maximum rain probability is about **${round(c.current.rainProb)}%**, and the next several hours reach roughly **${round(peak)}%**. ${time ? `The wetter period is around **${clock(time)}**.` : "Rain risk is spread through the day."}`,
                meta: source(c)
            };
        }
        return {
            intent: "umbrella",
            text: alt
                ? `You probably **don't need an umbrella** right now. Today's rain probability is only about **${round(c.current.rainProb)}%**, though forecasts can change.`
                : `An umbrella is **probably optional** today. Cloudora currently puts today's rain probability at about **${round(c.current.rainProb)}%**. If you're staying out for hours, carrying a compact one is still the safer choice.`,
            meta: source(c)
        };
    }

    function buildRain(c, alt) {
        const wet = c.hours.filter(h => h.rain >= 40);
        const peak = Math.max(...c.hours.map(h => h.rain || 0), 0);
        const peakHour = c.hours.find(h => h.rain === peak);
        const precip = c.hours.reduce((s, h) => s + (h.precipitation || 0), 0);
        return {
            intent: "rain",
            text: `Rain probability today is **${round(c.current.rainProb)}%**. Over the next 24 hours, ${wet.length ? `I see **${wet.length} hour${wet.length === 1 ? "" : "s"}** with at least a 40% rain chance, with the highest around **${round(peak)}%${peakHour ? ` at ${clock(peakHour.time)}` : ""}**.` : "the near-term forecast stays mostly below a 40% hourly rain chance."} Forecast precipitation across the displayed hours totals roughly **${precip.toFixed(1)} mm**.`,
            meta: source(c)
        };
    }

    function buildTemperature(c, alt) {
        const range = c.daily.temperature_2m_max && c.daily.temperature_2m_min
            ? `${round(c.daily.temperature_2m_min[0])}–${round(c.daily.temperature_2m_max[0])}${c.unit}`
            : `${round(c.current.temp)}${c.unit}`;
        return {
            intent: "temperature",
            text: `It's **${round(c.current.temp)}${c.unit}** in ${c.city.name}, with a feels-like temperature of **${round(c.current.feels)}${c.unit}**. Today's forecast range is about **${range}**. ${comfortSentence(c.current.temp, c.current.feels)}`,
            meta: source(c)
        };
    }

    function buildOutdoor(c, alt, q) {
        const rain = c.current.rainProb;
        const wind = c.current.wind;
        const uv = c.current.uv;
        const hot = c.current.temp >= 34;
        const cold = c.current.temp <= 12;
        const score = Math.max(0, 100 - rain * .55 - Math.max(0, wind - 20) * 1.1 - Math.max(0, uv - 7) * 3 - (hot ? 12 : 0) - (cold ? 8 : 0));
        let verdict;
        if (score >= 75) verdict = "Conditions look **quite favorable**.";
        else if (score >= 55) verdict = "Conditions look **mixed but workable**.";
        else verdict = "Conditions look **less comfortable**, mainly because of rain, wind, heat or cold.";

        const best = findBestWindow(c);
        return {
            intent: "outdoor",
            text: `${verdict} Current temperature is **${round(c.current.temp)}${c.unit}**, rain probability is **${round(rain)}%**, wind is **${round(wind)} km/h**, and UV peaks around **${round(uv)}**. ${best ? `For a more comfortable outing, try around **${clock(best.time)}** when the forecast is calmer.` : ""}`,
            meta: source(c)
        };
    }

    function buildTravel(c, alt) {
        const issues = [];
        if (c.current.rainProb >= 60) issues.push("rain");
        if (c.current.wind >= 35) issues.push("strong wind");
        if (c.current.visibility && c.current.visibility < 5) issues.push("reduced visibility");
        if (c.current.temp >= 36) issues.push("high heat");
        return {
            intent: "travel",
            text: issues.length
                ? `For travel around ${c.city.name}, the main weather considerations are **${issues.join(", ")}**. Current conditions are ${c.description.toLowerCase()}, with ${round(c.current.temp)}${c.unit} and ${round(c.current.wind)} km/h wind. If your timing is flexible, I can identify the calmer hours next.`
                : `Travel conditions look **fairly straightforward** from the weather data: ${round(c.current.temp)}${c.unit}, ${c.description.toLowerCase()}, ${round(c.current.wind)} km/h wind and no major rain signal in the immediate forecast.`,
            meta: source(c)
        };
    }

    function buildClothing(c, alt) {
        const t = c.current.feels;
        const pieces = [];
        if (t >= 34) pieces.push("light, breathable clothing");
        else if (t >= 26) pieces.push("a light shirt or breathable top");
        else if (t >= 18) pieces.push("a normal shirt with a light layer available");
        else if (t >= 10) pieces.push("a jacket or warm outer layer");
        else pieces.push("warm layers");
        if (c.current.rainProb >= 50) pieces.push("water-resistant footwear or an umbrella");
        if (c.current.uv >= 6) pieces.push("sun protection");
        return {
            intent: "clothing",
            text: `I'd go with **${pieces.join(", ")}**. That's based mainly on a feels-like temperature of **${round(t)}${c.unit}**, a **${round(c.current.rainProb)}%** rain probability and UV around **${round(c.current.uv)}**.`,
            meta: source(c)
        };
    }

    function buildUV(c, alt) {
        const uv = c.current.uv;
        let level = uv >= 11 ? "extreme" : uv >= 8 ? "very high" : uv >= 6 ? "high" : uv >= 3 ? "moderate" : "low";
        return {
            intent: "uv",
            text: `Today's maximum UV index is about **${round(uv)} (${level})**. ${uv >= 6 ? "If you're outside for a while, prioritize shade, protective clothing and sunscreen." : "UV exposure is relatively limited compared with higher-UV days."}`,
            meta: source(c)
        };
    }

    function buildWind(c, alt) {
        const direction = typeof weatherData !== "undefined" ? weatherData.current?.wind_direction_10m : null;
        return {
            intent: "wind",
            text: `Current wind is around **${round(c.current.wind)} km/h**${direction != null ? `, from roughly **${round(direction)}°**` : ""}. ${c.current.wind >= 40 ? "That's strong enough to noticeably affect outdoor comfort." : c.current.wind >= 25 ? "You'll likely notice it outdoors, especially while cycling or walking against it." : "That's generally a light-to-moderate breeze."}`,
            meta: source(c)
        };
    }

    function buildAir(c, alt) {
        const aqi = num($("aqiValue")?.textContent);
        const pm25 = $("pm25")?.textContent;
        const pm10 = $("pm10")?.textContent;
        const label = aqi ? (typeof getAQIDescription === "function" ? getAQIDescription(aqi) : "current air quality") : "Air-quality data is still loading";
        return {
            intent: "air",
            text: `The current air-quality reading is **AQI ${aqi || "—"}** (${label.toLowerCase()}). ${pm25 && pm25 !== "--" ? `PM2.5 is about **${pm25} µg/m³**` : ""}${pm10 && pm10 !== "--" ? ` and PM10 is about **${pm10} µg/m³**.` : "."} For sensitive people, the AQI level is more useful than the weather temperature itself when deciding how strenuous outdoor activity should be.`,
            meta: source(c)
        };
    }

    function buildHumidity(c, alt) {
        return {
            intent: "humidity",
            text: `Humidity is currently **${round(c.current.humidity)}%**. ${c.current.humidity >= 75 ? "That is quite humid and can make the air feel warmer and stickier than the thermometer suggests." : c.current.humidity >= 55 ? "That's a moderate-to-humid level, so the feels-like temperature matters for comfort." : "That's relatively dry, so the air should feel less sticky."}`,
            meta: source(c)
        };
    }

    function buildVisibility(c) {
        return {
            intent: "visibility",
            text: c.current.visibility
                ? `Current forecast visibility is about **${c.current.visibility.toFixed(1)} km**. ${c.current.visibility < 5 ? "That's reduced and can matter for driving or aviation." : "That is generally good visibility."}`
                : "Visibility data isn't available in the current forecast response.",
            meta: source(c)
        };
    }

    function buildPressure(c) {
        const p = num(weatherData?.current?.pressure_msl);
        return {
            intent: "pressure",
            text: `Mean sea-level pressure is about **${round(p)} hPa**. Pressure by itself doesn't tell you whether weather is good or bad; its change over time is more informative, and Cloudora can use the forecast trend when you ask about upcoming conditions.`,
            meta: source(c)
        };
    }

    function buildSunrise(c) {
        const value = c.daily.sunrise?.[0];
        return { intent: "sunrise", text: `Sunrise in ${c.city.name} is around **${formatTimeLocal(value)}** today.`, meta: source(c) };
    }

    function buildSunset(c) {
        const value = c.daily.sunset?.[0];
        return { intent: "sunset", text: `Sunset in ${c.city.name} is around **${formatTimeLocal(value)}** today.`, meta: source(c) };
    }

    function buildNextHours(c, alt) {
        const hours = c.hours.slice(0, 8);
        const hottest = [...hours].sort((a,b) => b.temp - a.temp)[0];
        const wettest = [...hours].sort((a,b) => b.rain - a.rain)[0];
        return {
            intent: "hourly",
            text: `Over the next several hours, temperatures range from about **${round(Math.min(...hours.map(h => h.temp)))}${c.unit} to ${round(Math.max(...hours.map(h => h.temp)))}${c.unit}**. The highest rain probability is around **${round(wettest?.rain || 0)}%**${wettest ? ` at ${clock(wettest.time)}` : ""}, while the warmest point is roughly **${round(hottest?.temp || c.current.temp)}${c.unit}**${hottest ? ` around ${clock(hottest.time)}` : ""}.`,
            meta: source(c)
        };
    }

    function buildTodayForecast(c, alt) {
        const max = num(c.daily.temperature_2m_max?.[0]);
        const min = num(c.daily.temperature_2m_min?.[0]);
        return {
            intent: "forecast",
            text: `Today's picture for **${c.city.name}**: **${round(min)}–${round(max)}${c.unit}**, ${c.description.toLowerCase()} right now, around **${round(c.current.rainProb)}%** maximum rain probability, and a peak UV index near **${round(c.current.uv)}**. ${c.current.rainProb >= 60 ? "Rain is the main thing I'd plan around." : "There isn't a strong rain signal in the current forecast."}`,
            meta: source(c)
        };
    }

    function buildBestTime(c, alt) {
        const best = findBestWindow(c);
        if (!best) return buildTodayForecast(c, alt);
        return {
            intent: "besttime",
            text: `Based on the next 24 hours, **${clock(best.time)}** is one of the more comfortable windows. At that point the forecast is around **${round(best.temp)}${c.unit}**, rain probability **${round(best.rain)}%**, wind **${round(best.wind)} km/h**, and UV **${round(best.uv)}**. Weather changes, so treat this as a forecast-based window rather than a guarantee.`,
            meta: source(c)
        };
    }

    function buildSummary(c, alt) {
        const best = findBestWindow(c);
        const variants = [
            `Here's the quick read for **${c.city.name}**: **${round(c.current.temp)}${c.unit}**, ${c.description.toLowerCase()}, feels like **${round(c.current.feels)}${c.unit}**, rain probability **${round(c.current.rainProb)}%**, wind **${round(c.current.wind)} km/h**, and UV up to **${round(c.current.uv)}**. ${best ? `A more comfortable window appears around **${clock(best.time)}**.` : ""}`,
            `**Cloudora brief:** ${round(c.current.temp)}${c.unit} now, ${c.description.toLowerCase()}, ${round(c.current.humidity)}% humidity and ${round(c.current.wind)} km/h wind. The main planning factor is **${c.current.rainProb >= 50 ? "rain risk" : c.current.uv >= 6 ? "UV exposure" : "general heat/comfort"}**.`,
        ];
        return { intent: "summary", text: alt ? variants[1] : variants[responseIndex % variants.length], meta: source(c) };
    }

    function buildTomorrow(c) {
        const i = 1;
        const max = num(c.daily.temperature_2m_max?.[i]);
        const min = num(c.daily.temperature_2m_min?.[i]);
        const rain = num(c.daily.precipitation_probability_max?.[i]);
        const code = num(c.daily.weather_code?.[i]);
        const desc = typeof getWeatherDescription === "function" ? getWeatherDescription(code) : "forecast conditions";
        return {
            intent: "tomorrow",
            text: `Tomorrow looks like **${round(min)}–${round(max)}${c.unit}** in ${c.city.name}, with **${desc.toLowerCase()}** as the dominant condition and about **${round(rain)}%** maximum rain probability. ${rain >= 60 ? "I'd plan for wet-weather flexibility." : "There is no strong rain signal in the current daily forecast."}`,
            meta: source(c)
        };
    }

    function buildWeekend(c) {
        const parts = [];
        for (let i = 0; i < Math.min(7, c.daily.time?.length || 0); i++) {
            const d = new Date(c.daily.time[i] + "T12:00:00");
            const day = d.toLocaleDateString(undefined, { weekday: "long" });
            if (day === "Saturday" || day === "Sunday") {
                parts.push(`${day}: ${round(c.daily.temperature_2m_min?.[i])}–${round(c.daily.temperature_2m_max?.[i])}${c.unit}, rain ${round(c.daily.precipitation_probability_max?.[i])}%`);
            }
        }
        return {
            intent: "weekend",
            text: parts.length ? `Weekend outlook for **${c.city.name}**:\n\n${parts.map(x => "• " + x).join("\n")}` : "The current 7-day forecast doesn't extend far enough to provide a complete weekend outlook.",
            meta: source(c)
        };
    }

    function buildComparisonHelp(c) {
        return {
            intent: "compare",
            text: `Use Cloudora's city comparison panel for a side-by-side forecast. I can compare temperature, rain probability, wind and UV for the cities you enter there.`,
            meta: source(c)
        };
    }

    function buildWhy(c) {
        return {
            intent: "why",
            text: `The current conditions are driven by several factors: temperature **${round(c.current.temp)}${c.unit}**, humidity **${round(c.current.humidity)}%**, cloud cover **${round(c.current.cloud)}%**, wind **${round(c.current.wind)} km/h**, and the current weather pattern (**${c.description.toLowerCase()}**). If you tell me what you're trying to understand — heat, rain, humidity, or wind — I can break that factor down.`,
            meta: source(c)
        };
    }

    function findBestWindow(c) {
        if (!c.hours.length) return null;
        const scored = c.hours.map(h => {
            const rainPenalty = Math.min(h.rain, 80) * 0.55;
            const windPenalty = Math.max(0, h.wind - 18) * 1.2;
            const uvPenalty = Math.max(0, h.uv - 7) * 3;
            const heatPenalty = h.temp >= 35 ? 16 : h.temp >= 32 ? 8 : 0;
            const coldPenalty = h.temp <= 10 ? 12 : 0;
            return { ...h, score: rainPenalty + windPenalty + uvPenalty + heatPenalty + coldPenalty };
        });
        return scored.sort((a,b) => a.score - b.score)[0];
    }

    function comfortSentence(temp, feels) {
        if (feels >= 36) return "The heat will be noticeable, so hydration and shade matter.";
        if (feels >= 31) return "It should feel warm to hot, especially in direct sun.";
        if (feels >= 24) return "That is generally warm and comfortable for many outdoor activities.";
        if (feels >= 17) return "That is a fairly mild range for most people.";
        if (feels >= 10) return "It will feel cool, especially if you're outside for a while.";
        return "That's cold enough that warm layers are worth considering.";
    }

    function source(c) {
        return { source: `Based on Cloudora's live ${c.city.name} forecast data.` };
    }

    function normalize(s) {
        return s.toLowerCase().replace(/[?!,.]/g, " ").replace(/\s+/g, " ").trim();
    }

    function num(v) {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    }

    function round(v) {
        return Math.round(num(v));
    }

    function clock(value) {
        if (!value) return "—";
        try {
            return new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
        } catch { return value; }
    }

    function formatTimeLocal(value) {
        return value ? clock(value) : "—";
    }

    function stripHTML(s) {
        const d = document.createElement("div");
        d.innerHTML = s;
        return d.textContent || "";
    }

    function formatText(text) {
        return String(text)
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/\n/g, "<br>");
    }

    function showToastLocal(message) {
        if (typeof showToast === "function") {
            showToast(message);
            return;
        }
        let toast = document.getElementById("cloudoraAITost");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "cloudoraAITost";
            toast.className = "cloudora-ai-toast";
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add("show");
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => toast.classList.remove("show"), 1800);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", setup, { once: true });
    } else {
        setup();
    }
})();
