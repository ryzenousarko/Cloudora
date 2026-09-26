/* ============================================================
   CLOUDORA AI 4.1 — ADVANCED WEATHER REASONING ENGINE
   ------------------------------------------------------------
   Production reasoning layer for Cloudora.

   Features:
   - Multi-factor weather analysis
   - Strong rain avoidance
   - Best / worst time detection
   - Activity-specific recommendations
   - Running / walking safety logic
   - Rain-window analysis
   - Heat / cold analysis
   - Wind analysis
   - UV analysis
   - Humidity analysis
   - Clothing recommendations
   - Today vs tomorrow comparisons
   - Tomorrow forecast questions
   - Weather-change questions
   - Air-quality awareness
   - "Why?" explanations
   ============================================================ */

(() => {
    "use strict";

    const VERSION = "4.1";

    let lastDecision = null;

    /* ========================================================
       BASIC HELPERS
       ======================================================== */

    function number(value, fallback = 0) {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }

    function round(value) {
        return Math.round(number(value));
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function normalize(text) {
        return String(text || "")
            .toLowerCase()
            .replace(/[?!,.]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function temperatureUnit() {
        return typeof window.temperatureUnit !== "undefined" &&
            window.temperatureUnit === "fahrenheit"
            ? "°F"
            : "°C";
    }

    function getWeather() {
        if (!window.weatherData) {
            return null;
        }

        return window.weatherData;
    }

    function getTemperatureUnit() {
        return temperatureUnit();
    }

    function formatTemp(value) {
        return `${round(value)}${getTemperatureUnit()}`;
    }

    function formatTime(value) {
        if (!value) return "unknown time";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "unknown time";
        }

        return date.toLocaleTimeString(undefined, {
            hour: "numeric",
            minute: "2-digit"
        });
    }

    /* ========================================================
       WEATHER DATA
       ======================================================== */

    function getHourlyData(startIndex = null, count = 24) {
        const data = getWeather();

        if (!data || !data.hourly) {
            return [];
        }

        const hourly = data.hourly;

        let index = startIndex;

        if (
            index === null &&
            typeof window.getCurrentHourlyIndex === "function"
        ) {
            index = window.getCurrentHourlyIndex();
        }

        if (!Number.isFinite(index)) {
            index = 0;
        }

        const total = hourly.time?.length || 0;
        const end = Math.min(index + count, total);

        const result = [];

        for (let i = index; i < end; i++) {
            result.push({
                index: i,

                time: hourly.time?.[i],

                temp:
                    number(
                        hourly.temperature_2m?.[i]
                    ),

                feels:
                    number(
                        hourly.apparent_temperature?.[i]
                    ),

                rainChance:
                    number(
                        hourly.precipitation_probability?.[i]
                    ),

                precipitation:
                    number(
                        hourly.precipitation?.[i]
                    ),

                wind:
                    number(
                        hourly.wind_speed_10m?.[i]
                    ),

                humidity:
                    number(
                        hourly.relative_humidity_2m?.[i]
                    ),

                uv:
                    number(
                        hourly.uv_index?.[i]
                    ),

                code:
                    number(
                        hourly.weather_code?.[i]
                    )
            });
        }

        return result;
    }

    /* ========================================================
       WEATHER CONDITION HELPERS
       ======================================================== */

    function isRainy(hour) {
        if (!hour) return false;

        return (
            number(hour.rainChance) >= 60 ||
            number(hour.precipitation) >= 0.5 ||
            [51, 53, 55, 61, 63, 65, 66, 67, 80, 81, 82]
                .includes(number(hour.code))
        );
    }

    function isHeavyRain(hour) {
        if (!hour) return false;

        return (
            number(hour.rainChance) >= 80 ||
            number(hour.precipitation) >= 2 ||
            [63, 65, 67, 81, 82]
                .includes(number(hour.code))
        );
    }

    function isStorm(hour) {
        if (!hour) return false;

        return [95, 96, 99].includes(
            number(hour.code)
        );
    }

    /* ========================================================
       WEATHER SEVERITY
       ======================================================== */

    function rainScore(hour) {
        const rain = number(hour?.rainChance);

        if (rain >= 90) return 55;
        if (rain >= 80) return 48;
        if (rain >= 70) return 40;
        if (rain >= 60) return 32;
        if (rain >= 45) return 22;
        if (rain >= 30) return 12;
        if (rain >= 20) return 5;

        return 0;
    }

    function precipitationScore(hour) {
        const precipitation =
            number(hour?.precipitation);

        if (precipitation >= 5) return 35;
        if (precipitation >= 2) return 25;
        if (precipitation >= 1) return 18;
        if (precipitation >= 0.5) return 10;

        return 0;
    }

    function windScore(hour) {
        const wind = number(hour?.wind);

        if (wind >= 50) return 35;
        if (wind >= 40) return 28;
        if (wind >= 35) return 22;
        if (wind >= 30) return 15;
        if (wind >= 25) return 10;
        if (wind >= 18) return 4;

        return 0;
    }

    function heatScore(hour) {
        const temp =
            number(hour?.feels || hour?.temp);

        if (temp >= 42) return 45;
        if (temp >= 38) return 35;
        if (temp >= 35) return 28;
        if (temp >= 33) return 20;
        if (temp >= 30) return 10;

        return 0;
    }

    function coldScore(hour) {
        const temp =
            number(hour?.feels || hour?.temp);

        if (temp <= 5) return 35;
        if (temp <= 10) return 25;
        if (temp <= 15) return 15;
        if (temp <= 18) return 7;

        return 0;
    }

    function uvScore(hour) {
        const uv = number(hour?.uv);

        if (uv >= 11) return 30;
        if (uv >= 8) return 22;
        if (uv >= 6) return 14;
        if (uv >= 3) return 6;

        return 0;
    }

    function humidityScore(hour) {
        const humidity =
            number(hour?.humidity);

        if (humidity >= 95) return 25;
        if (humidity >= 90) return 20;
        if (humidity >= 80) return 12;
        if (humidity >= 70) return 7;

        return 0;
    }

    /* ========================================================
       GENERAL COMFORT
       ======================================================== */

    function comfortScore(hour) {
        if (!hour) return 0;

        const penalties =
            rainScore(hour) +
            precipitationScore(hour) +
            windScore(hour) +
            heatScore(hour) +
            coldScore(hour) +
            uvScore(hour) +
            humidityScore(hour);

        let score =
            100 - penalties;

        if (isStorm(hour)) {
            score -= 40;
        }

        return clamp(score, 0, 100);
    }

    /*
     * General outdoor score.
     *
     * IMPORTANT:
     * High rain is now heavily penalized.
     * A 90–100% rain hour cannot casually become
     * the "best" outdoor period.
     */
    function outdoorScore(hour) {
        if (!hour) return 0;

        let score =
            comfortScore(hour);

        const rain =
            number(hour.rainChance);

        if (rain >= 90) {
            score -= 45;
        } else if (rain >= 80) {
            score -= 35;
        } else if (rain >= 70) {
            score -= 28;
        } else if (rain >= 60) {
            score -= 20;
        }

        if (isHeavyRain(hour)) {
            score -= 20;
        }

        if (isStorm(hour)) {
            score -= 50;
        }

        return clamp(score, 0, 100);
    }

    /* ========================================================
       BEST / WORST HOURS
       ======================================================== */

    function findBestHour(hours) {
        if (!hours.length) {
            return null;
        }

        return [...hours]
            .map(hour => ({
                ...hour,
                score: outdoorScore(hour)
            }))
            .sort(
                (a, b) =>
                    b.score - a.score
            )[0];
    }

    function findWorstHour(hours) {
        if (!hours.length) {
            return null;
        }

        return [...hours]
            .map(hour => ({
                ...hour,
                score: outdoorScore(hour)
            }))
            .sort(
                (a, b) =>
                    a.score - b.score
            )[0];
    }

    /* ========================================================
       RAIN ANALYSIS
       ======================================================== */

    function findRainWindow(hours) {
        if (!hours.length) {
            return null;
        }

        const rainy =
            hours.filter(
                hour =>
                    number(hour.rainChance) >= 40 ||
                    number(hour.precipitation) >= 0.5 ||
                    isRainy(hour)
            );

        if (!rainy.length) {
            return {
                exists: false,
                hours: []
            };
        }

        const strongest =
            [...rainy].sort(
                (a, b) => {
                    const aScore =
                        a.rainChance +
                        a.precipitation * 10;

                    const bScore =
                        b.rainChance +
                        b.precipitation * 10;

                    return bScore - aScore;
                }
            )[0];

        return {
            exists: true,
            hours: rainy,
            strongest
        };
    }

    /* ========================================================
       ACTIVITY PROFILES
       ======================================================== */

    function activityProfile(activity) {
        const text =
            normalize(activity);

        if (
            /run|running|jog/.test(text)
        ) {
            return {
                name: "running",

                rainLimit: 35,

                windLimit: 25,

                heatLimit: 31,

                uvLimit: 7,

                humidityLimit: 80,

                minScore: 65
            };
        }

        if (
            /cycle|cycling|bike|biking/.test(text)
        ) {
            return {
                name: "cycling",

                rainLimit: 30,

                windLimit: 25,

                heatLimit: 32,

                uvLimit: 7,

                humidityLimit: 80,

                minScore: 65
            };
        }

        if (
            /walk|walking|stroll/.test(text)
        ) {
            return {
                name: "walking",

                rainLimit: 45,

                windLimit: 32,

                heatLimit: 34,

                uvLimit: 8,

                humidityLimit: 88,

                minScore: 60
            };
        }

        if (
            /picnic|park/.test(text)
        ) {
            return {
                name: "a picnic",

                rainLimit: 25,

                windLimit: 25,

                heatLimit: 32,

                uvLimit: 7,

                humidityLimit: 82,

                minScore: 65
            };
        }

        if (
            /drive|driving|commute|travel/.test(text)
        ) {
            return {
                name: "travel",

                rainLimit: 70,

                windLimit: 45,

                heatLimit: 38,

                uvLimit: 12,

                humidityLimit: 95,

                minScore: 50
            };
        }

        return {
            name: "outdoor activity",

            rainLimit: 40,

            windLimit: 30,

            heatLimit: 34,

            uvLimit: 9,

            humidityLimit: 85,

            minScore: 60
        };
    }

    /* ========================================================
       ACTIVITY REASONING
       ======================================================== */

    function analyzeActivity(hours, activity) {
        if (!hours.length) {
            return null;
        }

        const profile =
            activityProfile(activity);

        const scored =
            hours.map(hour => {

                let score = 100;

                const rain =
                    number(hour.rainChance);

                const precipitation =
                    number(hour.precipitation);

                const wind =
                    number(hour.wind);

                const feels =
                    number(
                        hour.feels ||
                        hour.temp
                    );

                const uv =
                    number(hour.uv);

                const humidity =
                    number(hour.humidity);

                /*
                 * Rain is the strongest activity penalty.
                 */
                if (
                    rain >= 90
                ) {
                    score -= 70;
                } else if (
                    rain >= 80
                ) {
                    score -= 60;
                } else if (
                    rain >= 70
                ) {
                    score -= 45;
                } else if (
                    rain > profile.rainLimit
                ) {
                    score -= 35;
                } else if (
                    rain >= 20
                ) {
                    score -= 10;
                }

                /*
                 * Actual precipitation matters too.
                 */
                if (
                    precipitation >= 5
                ) {
                    score -= 35;
                } else if (
                    precipitation >= 2
                ) {
                    score -= 25;
                } else if (
                    precipitation >= 1
                ) {
                    score -= 15;
                } else if (
                    precipitation >= 0.5
                ) {
                    score -= 8;
                }

                if (
                    wind >= 45
                ) {
                    score -= 35;
                } else if (
                    wind > profile.windLimit
                ) {
                    score -= 25;
                }

                if (
                    feels >= profile.heatLimit + 5
                ) {
                    score -= 30;
                } else if (
                    feels > profile.heatLimit
                ) {
                    score -= 20;
                }

                if (
                    feels <= 8
                ) {
                    score -= 20;
                }

                if (
                    uv > profile.uvLimit
                ) {
                    score -= 15;
                }

                if (
                    humidity >= 95
                ) {
                    score -= 25;
                } else if (
                    humidity > profile.humidityLimit
                ) {
                    score -= 18;
                } else if (
                    humidity >= 80
                ) {
                    score -= 8;
                }

                if (isStorm(hour)) {
                    score -= 50;
                }

                return {
                    ...hour,
                    score:
                        clamp(
                            score,
                            0,
                            100
                        )
                };
            });

        scored.sort(
            (a, b) =>
                b.score - a.score
        );

        const best =
            scored[0];

        /*
         * An activity hour is not considered genuinely
         * suitable if the weather is clearly bad.
         */
        const acceptable =
            scored.filter(
                hour =>
                    hour.score >=
                    profile.minScore &&
                    number(hour.rainChance) <=
                    profile.rainLimit &&
                    number(hour.wind) <=
                    profile.windLimit &&
                    !isStorm(hour)
            );

        return {
            profile,

            best,

            acceptableBest:
                acceptable.length
                    ? acceptable[0]
                    : null,

            worst:
                scored[scored.length - 1]
        };
    }

    /* ========================================================
       TEMPERATURE SUMMARY
       ======================================================== */

    function temperatureSummary(hour) {
        if (!hour) {
            return "I don't have enough temperature data yet.";
        }

        const temp =
            number(
                hour.feels ||
                hour.temp
            );

        if (temp >= 38) {
            return "It will feel very hot, so heat exposure is the main concern.";
        }

        if (temp >= 34) {
            return "It will feel hot, especially under direct sunlight.";
        }

        if (temp >= 30) {
            return "It will feel warm, with heat becoming more noticeable outdoors.";
        }

        if (temp >= 24) {
            return "The temperature is generally comfortable for many activities.";
        }

        if (temp >= 18) {
            return "The temperature should feel mild and fairly comfortable.";
        }

        if (temp >= 10) {
            return "It will feel cool, especially during longer outdoor periods.";
        }

        return "It will feel cold, so warmer clothing is advisable.";
    }

    /* ========================================================
       CLOTHING
       ======================================================== */

    function clothingAdvice(hour) {
        if (!hour) {
            return "I don't have enough weather data for a clothing recommendation.";
        }

        const temp =
            number(
                hour.feels ||
                hour.temp
            );

        const rain =
            number(hour.rainChance);

        const wind =
            number(hour.wind);

        const humidity =
            number(hour.humidity);

        const uv =
            number(hour.uv);

        const advice = [];

        if (temp >= 36) {
            advice.push(
                "very light, breathable clothing"
            );
        } else if (temp >= 30) {
            advice.push(
                "light, breathable clothing"
            );
        } else if (temp >= 25) {
            advice.push(
                "a light outfit"
            );
        } else if (temp >= 18) {
            advice.push(
                "a light extra layer"
            );
        } else if (temp >= 10) {
            advice.push(
                "a warmer layer"
            );
        } else {
            advice.push(
                "warm layers"
            );
        }

        if (rain >= 50) {
            advice.push(
                "rain protection"
            );
        }

        if (wind >= 30) {
            advice.push(
                "a wind-resistant outer layer"
            );
        }

        if (uv >= 7) {
            advice.push(
                "sun protection"
            );
        }

        if (humidity >= 90) {
            advice.push(
                "lightweight fabric because humidity is high"
            );
        }

        return `I'd suggest ${advice.join(", ")}.`;
    }

    /* ========================================================
       EXPLANATION
       ======================================================== */

    function explainHour(hour) {
        if (!hour) {
            return "I don't have enough forecast data to explain that recommendation.";
        }

        const reasons = [];

        const rain =
            number(hour.rainChance);

        const precipitation =
            number(hour.precipitation);

        const wind =
            number(hour.wind);

        const feels =
            number(
                hour.feels ||
                hour.temp
            );

        const uv =
            number(hour.uv);

        const humidity =
            number(hour.humidity);

        if (rain >= 50) {
            reasons.push(
                `${round(rain)}% rain chance`
            );
        }

        if (precipitation >= 0.5) {
            reasons.push(
                `${precipitation.toFixed(1)} mm expected precipitation`
            );
        }

        if (wind >= 25) {
            reasons.push(
                `wind around ${round(wind)} km/h`
            );
        }

        if (feels >= 32) {
            reasons.push(
                `feels like ${formatTemp(feels)}`
            );
        }

        if (uv >= 7) {
            reasons.push(
                `UV around ${round(uv)}`
            );
        }

        if (humidity >= 80) {
            reasons.push(
                `humidity around ${round(humidity)}%`
            );
        }

        if (!reasons.length) {
            return "The forecast looks relatively balanced, without a major weather factor working against it.";
        }

        return `I chose it because the forecast has ${reasons.join(", ")}.`;
    }

    /* ========================================================
       FUTURE HOURS
       ======================================================== */

    function getFutureHours(daysAhead = 0) {
        const data =
            getWeather();

        if (!data?.hourly?.time) {
            return [];
        }

        const target =
            new Date();

        target.setDate(
            target.getDate() +
            daysAhead
        );

        const targetDate =
            target.toISOString()
                .slice(0, 10);

        const result = [];

        for (
            let i = 0;
            i < data.hourly.time.length;
            i++
        ) {
            const time =
                data.hourly.time[i];

            if (
                !String(time)
                    .startsWith(
                        targetDate
                    )
            ) {
                continue;
            }

            result.push({
                index: i,

                time,

                temp:
                    number(
                        data.hourly.temperature_2m?.[i]
                    ),

                feels:
                    number(
                        data.hourly.apparent_temperature?.[i]
                    ),

                rainChance:
                    number(
                        data.hourly.precipitation_probability?.[i]
                    ),

                precipitation:
                    number(
                        data.hourly.precipitation?.[i]
                    ),

                wind:
                    number(
                        data.hourly.wind_speed_10m?.[i]
                    ),

                humidity:
                    number(
                        data.hourly.relative_humidity_2m?.[i]
                    ),

                uv:
                    number(
                        data.hourly.uv_index?.[i]
                    ),

                code:
                    number(
                        data.hourly.weather_code?.[i]
                    )
            });
        }

        return result;
    }

    /* ========================================================
       DAY SUMMARY
       ======================================================== */

    function summarizeDay(hours) {
        if (!hours.length) {
            return null;
        }

        const temperatures =
            hours.map(
                h =>
                    number(
                        h.feels ||
                        h.temp
                    )
            );

        const rain =
            Math.max(
                ...hours.map(
                    h =>
                        number(
                            h.rainChance
                        )
                )
            );

        const avgWind =
            hours.reduce(
                (sum, h) =>
                    sum +
                    number(h.wind),
                0
            ) / hours.length;

        const best =
            findBestHour(hours);

        return {
            high:
                Math.max(
                    ...temperatures
                ),

            low:
                Math.min(
                    ...temperatures
                ),

            rainChance:
                rain,

            avgWind,

            best
        };
    }

    /* ========================================================
       NATURAL LANGUAGE INTENT
       ======================================================== */

    function detectIntent(question) {
        const text =
            normalize(question);

        if (/why/.test(text)) {
            return "why";
        }

        /*
         * Tomorrow needs to be checked BEFORE generic
         * temperature/weather detection.
         */
        if (
            /tomorrow/.test(text) &&
            !/today.*tomorrow|tomorrow.*today|compare/.test(text)
        ) {
            return "tomorrow";
        }

        if (
            /next few hours|next few hour|weather change|how will.*change|changing|change over/.test(
                text
            )
        ) {
            return "change";
        }

        if (
            /air quality|air pollution|pollution|aqi/.test(
                text
            )
        ) {
            return "air-quality";
        }

        if (
            /best time|good time|ideal time|when should i|when is the best/.test(
                text
            )
        ) {
            return "best-time";
        }

        if (
            /worst time|bad time|avoid/.test(
                text
            )
        ) {
            return "worst-time";
        }

        if (
            /rain.*when|when.*rain|rain timing|rain likely/.test(
                text
            )
        ) {
            return "rain-timing";
        }

        if (
            /wear|clothing|outfit|jacket/.test(
                text
            )
        ) {
            return "clothing";
        }

        if (
            /run|running|jog|cycle|cycling|bike|walk|walking|picnic|travel|drive|commute/.test(
                text
            )
        ) {
            return "activity";
        }

        if (
            /tomorrow.*today|today.*tomorrow|compare/.test(
                text
            )
        ) {
            return "comparison";
        }

        if (
            /temperature|temp|hot|cold|heat/.test(
                text
            )
        ) {
            return "temperature";
        }

        if (
            /wind|windy/.test(
                text
            )
        ) {
            return "wind";
        }

        if (
            /humidity|humid/.test(
                text
            )
        ) {
            return "humidity";
        }

        if (
            /uv|sun/.test(
                text
            )
        ) {
            return "uv";
        }

        if (
            /rain|raining|umbrella/.test(
                text
            )
        ) {
            return "rain";
        }

        if (
            /outside|outdoor/.test(
                text
            )
        ) {
            return "outdoor";
        }

        return "general";
    }

    /* ========================================================
       ANSWER: BEST TIME
       ======================================================== */

    function answerBestTime() {
        const hours =
            getHourlyData();

        if (!hours.length) {
            return "I'm still waiting for enough hourly forecast data to determine the best time.";
        }

        const best =
            findBestHour(hours);

        if (!best) {
            return "I couldn't identify a reliable best period from the available forecast.";
        }

        lastDecision = {
            type: "best-time",
            hour: best
        };

        /*
         * If even the best available period is bad,
         * say so instead of pretending it is good.
         */
        if (
            best.score < 45 ||
            best.rainChance >= 70 ||
            isHeavyRain(best) ||
            isStorm(best)
        ) {
            return (
                `There isn't a genuinely good outdoor window in the next several hours. ` +
                `The least-unfavorable period is around **${formatTime(best.time)}**, ` +
                `but it still has a **${round(best.rainChance)}%** rain chance ` +
                `and feels like **${formatTemp(best.feels || best.temp)}**. ` +
                `I'd keep outdoor plans flexible and use rain protection.`
            );
        }

        return (
            `The best outdoor window looks like **${formatTime(best.time)}**. ` +
            `It should feel around **${formatTemp(best.feels || best.temp)}**, ` +
            `with a **${round(best.rainChance)}%** rain chance and ` +
            `wind around **${round(best.wind)} km/h**. ` +
            `${explainHour(best)}`
        );
    }

    /* ========================================================
       ANSWER: WORST TIME
       ======================================================== */

    function answerWorstTime() {
        const hours =
            getHourlyData();

        if (!hours.length) {
            return "I don't have enough hourly data to identify the worst period.";
        }

        const worst =
            findWorstHour(hours);

        if (!worst) {
            return "I couldn't identify a clearly unfavorable period.";
        }

        lastDecision = {
            type: "worst-time",
            hour: worst
        };

        return (
            `I'd be most cautious around **${formatTime(worst.time)}**. ` +
            `Conditions are around **${formatTemp(worst.feels || worst.temp)}**, ` +
            `with a **${round(worst.rainChance)}%** rain chance and ` +
            `wind around **${round(worst.wind)} km/h**.`
        );
    }

    /* ========================================================
       ANSWER: RAIN
       ======================================================== */

    function answerRainTiming() {
        const hours =
            getHourlyData();

        const rain =
            findRainWindow(hours);

        if (!rain?.exists) {
            return "There isn't a strong rain signal in the available hourly forecast.";
        }

        const strongest =
            rain.strongest;

        lastDecision = {
            type: "rain",
            hour: strongest
        };

        return (
            `The strongest rain signal is around **${formatTime(strongest.time)}**, ` +
            `with about a **${round(strongest.rainChance)}%** chance of rain. ` +
            (
                strongest.precipitation > 0
                    ? `Expected precipitation is around **${strongest.precipitation.toFixed(1)} mm**.`
                    : "The forecast does not currently show a large precipitation amount."
            )
        );
    }

    /* ========================================================
       ANSWER: ACTIVITY
       ======================================================== */

    function answerActivity(question) {
        const hours =
            getHourlyData();

        const analysis =
            analyzeActivity(
                hours,
                question
            );

        if (!analysis) {
            return "I need the hourly forecast before I can analyze that activity.";
        }

        const profile =
            analysis.profile;

        /*
         * Prefer a genuinely acceptable hour.
         */
        const best =
            analysis.acceptableBest;

        /*
         * No acceptable hour means:
         * DO NOT recommend the least-bad rainy hour.
         */
        if (!best) {
            const fallback =
                analysis.best;

            lastDecision = {
                type: "activity",
                hour: fallback,
                activity: profile.name,
                unsuitable: true
            };

            return (
                `I wouldn't recommend **${profile.name}** outdoors during the available forecast window. ` +
                `Even the least-unfavorable period around **${formatTime(fallback.time)}** ` +
                `has a **${round(fallback.rainChance)}%** rain chance, ` +
                `feels like **${formatTemp(fallback.feels || fallback.temp)}**, ` +
                `and has wind around **${round(fallback.wind)} km/h**. ` +
                `I'd wait for a drier window if possible.`
            );
        }

        lastDecision = {
            type: "activity",
            hour: best,
            activity: profile.name,
            unsuitable: false
        };

        return (
            `For **${profile.name}**, I'd target around **${formatTime(best.time)}**. ` +
            `It should feel around **${formatTemp(best.feels || best.temp)}**, ` +
            `with a **${round(best.rainChance)}%** rain chance and ` +
            `wind around **${round(best.wind)} km/h**. ` +
            `${explainHour(best)}`
        );
    }

    /* ========================================================
       ANSWER: CLOTHING
       ======================================================== */

    function answerClothing() {
        const hours =
            getHourlyData();

        if (!hours.length) {
            return "I need the current forecast before I can recommend what to wear.";
        }

        const best =
            findBestHour(hours);

        if (!best) {
            return "I don't have enough forecast information for a clothing recommendation.";
        }

        return (
            `${clothingAdvice(best)} ` +
            `The forecast around **${formatTime(best.time)}** feels like **${formatTemp(best.feels || best.temp)}**. ` +
            (
                best.rainChance >= 60
                    ? "Because rain risk is high, keep an umbrella or waterproof layer handy."
                    : ""
            )
        );
    }

    /* ========================================================
       ANSWER: TOMORROW
       ======================================================== */

    function answerTomorrow() {
        const hours =
            getFutureHours(1);

        if (!hours.length) {
            return "I don't have enough forecast data for tomorrow yet.";
        }

        const summary =
            summarizeDay(hours);

        const best =
            findBestHour(hours);

        return (
            `Tomorrow looks like roughly **${formatTemp(summary.low)} to ${formatTemp(summary.high)}**. ` +
            `The highest rain chance is around **${round(summary.rainChance)}%**, ` +
            `with average wind near **${round(summary.avgWind)} km/h**. ` +
            `The best available outdoor period appears to be around **${formatTime(best.time)}**. ` +
            `${explainHour(best)}`
        );
    }

    /* ========================================================
       ANSWER: WEATHER CHANGE
       ======================================================== */

    function answerChange() {
        const hours =
            getHourlyData();

        if (hours.length < 2) {
            return "I need more hourly forecast data to describe how the weather will change.";
        }

        const first =
            hours[0];

        const last =
            hours[Math.min(5, hours.length - 1)];

        const changes = [];

        const tempDifference =
            number(
                last.feels ||
                last.temp
            ) -
            number(
                first.feels ||
                first.temp
            );

        if (Math.abs(tempDifference) >= 2) {
            changes.push(
                tempDifference > 0
                    ? `temperatures rise by about ${round(Math.abs(tempDifference))}°`
                    : `temperatures fall by about ${round(Math.abs(tempDifference))}°`
            );
        }

        const rainDifference =
            number(last.rainChance) -
            number(first.rainChance);

        if (Math.abs(rainDifference) >= 15) {
            changes.push(
                rainDifference > 0
                    ? `rain chances increase from ${round(first.rainChance)}% to ${round(last.rainChance)}%`
                    : `rain chances decrease from ${round(first.rainChance)}% to ${round(last.rainChance)}%`
            );
        }

        const windDifference =
            number(last.wind) -
            number(first.wind);

        if (Math.abs(windDifference) >= 8) {
            changes.push(
                windDifference > 0
                    ? `wind increases`
                    : `wind eases`
            );
        }

        if (!changes.length) {
            return (
                `The next few hours look fairly stable. ` +
                `It stays around **${formatTemp(first.feels || first.temp)}**, ` +
                `with rain chances around **${round(first.rainChance)}%**.`
            );
        }

        return (
            `Over the next few hours, ${changes.join(", ")}. ` +
            `Right now it feels around **${formatTemp(first.feels || first.temp)}** ` +
            `with a **${round(first.rainChance)}%** rain chance.`
        );
    }

    /* ========================================================
       ANSWER: AIR QUALITY
       ======================================================== */

    function answerAirQuality() {
        const air =
            window.airQualityData;

        if (!air) {
            return (
                "I don't have the live air-quality data available to the reasoning engine yet. " +
                "The weather forecast itself is available."
            );
        }

        const aqi =
            number(
                air.us_aqi ??
                air.european_aqi ??
                air.aqi
            );

        if (!aqi) {
            return "Air-quality data is available, but I couldn't determine the current AQI value.";
        }

        let meaning =
            "generally acceptable air quality";

        if (aqi <= 50) {
            meaning =
                "good air quality for most people";
        } else if (aqi <= 100) {
            meaning =
                "moderate air quality";
        } else if (aqi <= 150) {
            meaning =
                "air quality that may be less suitable for sensitive people";
        } else if (aqi <= 200) {
            meaning =
                "unhealthy air quality";
        } else if (aqi <= 300) {
            meaning =
                "very unhealthy air quality";
        } else {
            meaning =
                "hazardous air quality";
        }

        return (
            `The current AQI is around **${round(aqi)}**, which indicates **${meaning}**. ` +
            `For outdoor exercise, air quality should be considered alongside temperature, humidity, and rain.`
        );
    }

    /* ========================================================
       ANSWER: COMPARISON
       ======================================================== */

    function answerComparison() {
        const today =
            summarizeDay(
                getFutureHours(0)
            );

        const tomorrow =
            summarizeDay(
                getFutureHours(1)
            );

        if (!today || !tomorrow) {
            return "I don't have enough forecast data to make a proper today-versus-tomorrow comparison.";
        }

        const differences = [];

        if (
            tomorrow.rainChance >
            today.rainChance + 15
        ) {
            differences.push(
                "tomorrow has a noticeably higher rain risk"
            );
        } else if (
            today.rainChance >
            tomorrow.rainChance + 15
        ) {
            differences.push(
                "today has a noticeably higher rain risk"
            );
        }

        if (
            tomorrow.high >
            today.high + 2
        ) {
            differences.push(
                "tomorrow is warmer"
            );
        } else if (
            today.high >
            tomorrow.high + 2
        ) {
            differences.push(
                "today is warmer"
            );
        }

        if (
            tomorrow.avgWind >
            today.avgWind + 8
        ) {
            differences.push(
                "tomorrow is windier"
            );
        } else if (
            today.avgWind >
            tomorrow.avgWind + 8
        ) {
            differences.push(
                "today is windier"
            );
        }

        if (!differences.length) {
            return "Today and tomorrow look fairly similar overall, without a major difference in the available forecast factors.";
        }

        return (
            `The main differences are that ${differences.join(", and ")}.`
        );
    }

    /* ========================================================
       ANSWER: GENERAL
       ======================================================== */

    function answerGeneral() {
        const hours =
            getHourlyData();

        if (!hours.length) {
            return "I'm waiting for the latest weather data before giving you a detailed analysis.";
        }

        const current =
            hours[0];

        return (
            `Right now, it feels around **${formatTemp(current.feels || current.temp)}**, ` +
            `with a **${round(current.rainChance)}%** rain chance, ` +
            `wind around **${round(current.wind)} km/h**, ` +
            `humidity around **${round(current.humidity)}%**, ` +
            `and UV around **${round(current.uv)}**. ` +
            `${temperatureSummary(current)}`
        );
    }

    /* ========================================================
       ANSWER: WHY
       ======================================================== */

    function answerWhy() {
        if (!lastDecision?.hour) {
            return "I haven't made a specific weather recommendation immediately before that question.";
        }

        if (
            lastDecision.unsuitable
        ) {
            return (
                `I didn't recommend that period because the weather conditions are too unfavorable for ${lastDecision.activity}, ` +
                `especially the rain risk and overall outdoor comfort.`
            );
        }

        return explainHour(
            lastDecision.hour
        );
    }

    /* ========================================================
       MAIN ENGINE
       ======================================================== */

    function answer(question) {
        const intent =
            detectIntent(question);

        switch (intent) {

            case "best-time":
                return answerBestTime();

            case "worst-time":
                return answerWorstTime();

            case "rain-timing":
                return answerRainTiming();

            case "activity":
                return answerActivity(question);

            case "clothing":
                return answerClothing();

            case "tomorrow":
                return answerTomorrow();

            case "change":
                return answerChange();

            case "air-quality":
                return answerAirQuality();

            case "comparison":
                return answerComparison();

            case "temperature":
                return answerGeneral();

            case "rain":
                return answerRainTiming();

            case "why":
                return answerWhy();

            case "wind":
            case "humidity":
            case "uv":
            case "outdoor":
            case "general":
            default:
                return answerGeneral();
        }
    }

    /* ========================================================
       PUBLIC API
       ======================================================== */

    window.CloudoraAI41 = {

        version: VERSION,

        answer,

        getHourlyData,

        findBestHour,

        findWorstHour,

        analyzeActivity,

        clothingAdvice,

        getLastDecision() {
            return lastDecision;
        },

        refresh() {
            lastDecision = null;
        }
    };

    console.log(
        `Cloudora AI ${VERSION} — Advanced Weather Reasoning loaded.`
    );

})();