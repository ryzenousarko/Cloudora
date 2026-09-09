/* =========================================================
   CLOUDORA WEATHER APP
   Live weather powered by Open-Meteo
========================================================= */


const API = {

    geocode:
        "https://geocoding-api.open-meteo.com/v1/search",

    forecast:
        "https://api.open-meteo.com/v1/forecast",

    air:
        "https://air-quality-api.open-meteo.com/v1/air-quality",

    archive:
        "https://archive-api.open-meteo.com/v1/archive"

};


/* =========================================================
   STATE
========================================================= */

let currentCity = {
    name: "Kolkata",
    country: "India",
    latitude: 22.5726,
    longitude: 88.3639
};

let weatherData = null;

let temperatureUnit =
    localStorage.getItem("cloudoraUnit") || "celsius";

let savedCities =
    JSON.parse(
        localStorage.getItem("cloudoraSavedCities") || "[]"
    );

let weatherChart = null;

let map = null;

let marker = null;

let deferredInstallPrompt = null;


/* =========================================================
   DOM
========================================================= */

const $ = id => document.getElementById(id);

const cityInput = $("cityInput");

const searchBtn = $("searchBtn");

const searchResults = $("searchResults");

const loading = $("loading");

const errorBox = $("error");

const themeBtn = $("themeBtn");

const unitBtn = $("unitBtn");

const locationBtn = $("locationBtn");

const notifyBtn = $("notifyBtn");

const installBtn = $("installBtn");

const saveCityBtn = $("saveCityBtn");

const chartType = $("chartType");

const historyBtn = $("historyBtn");

const historyDate = $("historyDate");

const chatInput = $("chatInput");

const chatBtn = $("chatBtn");


/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    loadTheme();

    updateUnitButton();

    setupHistoryDate();

    renderSavedCities();

    loadWeather(currentCity);

    startWorldClocks();

    setupPWAInstall();

    setupEvents();

});


/* =========================================================
   EVENTS
========================================================= */

function setupEvents() {

    searchBtn.addEventListener(
        "click",
        searchCity
    );


    cityInput.addEventListener(
        "keydown",
        event => {

            if (event.key === "Enter") {

                searchCity();

            }

        }
    );


    cityInput.addEventListener(
        "input",
        debounce(showSearchSuggestions, 350)
    );


    themeBtn.addEventListener(
        "click",
        toggleTheme
    );


    unitBtn.addEventListener(
        "click",
        toggleUnit
    );


    locationBtn.addEventListener(
        "click",
        useCurrentLocation
    );


    notifyBtn.addEventListener(
        "click",
        enableNotifications
    );


    saveCityBtn.addEventListener(
        "click",
        saveCurrentCity
    );


    chartType.addEventListener(
        "change",
        () => {

            if (weatherData) {

                renderChart();

            }

        }
    );


    historyBtn.addEventListener(
        "click",
        loadHistoricalWeather
    );


    chatBtn.addEventListener(
        "click",
        sendChatMessage
    );


    chatInput.addEventListener(
        "keydown",
        event => {

            if (event.key === "Enter") {

                sendChatMessage();

            }

        }
    );


    document
        .querySelectorAll(".quick-actions button")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    chatInput.value =
                        button.dataset.question;

                    sendChatMessage();

                }
            );

        });

}


/* =========================================================
   WEATHER SEARCH
========================================================= */

async function searchCity() {

    const query =
        cityInput.value.trim();

    if (!query) return;

    try {

        showLoading(true);

        hideError();

        const response =
            await fetch(
                `${API.geocode}?name=${encodeURIComponent(query)}&count=10&language=en&format=json`
            );

        if (!response.ok) {

            throw new Error(
                "Unable to search cities."
            );

        }

        const data =
            await response.json();

        if (!data.results?.length) {

            throw new Error(
                "No city found."
            );

        }

        const city =
            data.results[0];

        currentCity = {

            name: city.name,

            country:
                city.country || city.country_code || "",

            latitude: city.latitude,

            longitude: city.longitude

        };

        searchResults.innerHTML = "";

        cityInput.value = city.name;

        await loadWeather(currentCity);

    } catch (error) {

        showError(error.message);

    } finally {

        showLoading(false);

    }

}


/* =========================================================
   SEARCH SUGGESTIONS
========================================================= */

async function showSearchSuggestions() {

    const query =
        cityInput.value.trim();

    if (query.length < 2) {

        searchResults.innerHTML = "";

        return;

    }


    try {

        const response =
            await fetch(
                `${API.geocode}?name=${encodeURIComponent(query)}&count=6&language=en&format=json`
            );

        const data =
            await response.json();

        searchResults.innerHTML = "";

        (data.results || []).forEach(city => {

            const item =
                document.createElement("div");

            item.className =
                "search-result";

            item.textContent =
                `${city.name}, ${city.country || ""}`;

            item.addEventListener(
                "click",
                async () => {

                    currentCity = {

                        name: city.name,

                        country:
                            city.country || "",

                        latitude:
                            city.latitude,

                        longitude:
                            city.longitude

                    };

                    cityInput.value =
                        city.name;

                    searchResults.innerHTML =
                        "";

                    await loadWeather(
                        currentCity
                    );

                }
            );

            searchResults.appendChild(item);

        });

    } catch {

        searchResults.innerHTML = "";

    }

}


/* =========================================================
   LOAD WEATHER
========================================================= */

async function loadWeather(city) {

    showLoading(true);

    hideError();

    try {

        const params = new URLSearchParams({

            latitude: city.latitude,

            longitude: city.longitude,

            timezone: "auto",

            temperature_unit:
                temperatureUnit === "celsius"
                    ? "celsius"
                    : "fahrenheit",

            wind_speed_unit: "kmh",

            precipitation_unit: "mm",

            forecast_days: "7",

            current: [
                "temperature_2m",
                "relative_humidity_2m",
                "apparent_temperature",
                "is_day",
                "precipitation",
                "rain",
                "weather_code",
                "cloud_cover",
                "pressure_msl",
                "surface_pressure",
                "wind_speed_10m",
                "wind_direction_10m"
            ].join(","),

            hourly: [
                "temperature_2m",
                "relative_humidity_2m",
                "apparent_temperature",
                "precipitation_probability",
                "precipitation",
                "rain",
                "weather_code",
                "wind_speed_10m",
                "uv_index",
                "visibility",
                "cloud_cover"
            ].join(","),

            daily: [
                "weather_code",
                "temperature_2m_max",
                "temperature_2m_min",
                "apparent_temperature_max",
                "apparent_temperature_min",
                "sunrise",
                "sunset",
                "uv_index_max",
                "precipitation_sum",
                "precipitation_probability_max",
                "wind_speed_10m_max"
            ].join(",")

        });


        const response =
            await fetch(
                `${API.forecast}?${params}`
            );


        if (!response.ok) {

            throw new Error(
                "Weather service unavailable."
            );

        }


        weatherData =
            await response.json();


        currentCity = city;


        renderCurrentWeather();

        renderHourly();

        renderDaily();

        renderChart();

        renderSunMoon();

        renderAlert();

        updateMap();

        await loadAirQuality();

        renderSavedCities();

    } catch (error) {

        showError(
            error.message ||
            "Something went wrong."
        );

    } finally {

        showLoading(false);

    }

}


/* =========================================================
   CURRENT WEATHER
========================================================= */

function renderCurrentWeather() {

    const current =
        weatherData.current;

    const unit =
        temperatureUnit === "celsius"
            ? "C"
            : "F";


    $("cityName").textContent =
        currentCity.name;

    $("countryName").textContent =
        currentCity.country;


    $("temperature").textContent =
        Math.round(
            current.temperature_2m
        );


    $("feelsLike").textContent =
        `${Math.round(
            current.apparent_temperature
        )}°${unit}`;


    $("weatherDescription").textContent =
        getWeatherDescription(
            current.weather_code
        );


    $("weatherIcon").textContent =
        getWeatherIcon(
            current.weather_code,
            current.is_day
        );


    $("humidity").textContent =
        `${current.relative_humidity_2m}%`;


    $("wind").textContent =
        `${Math.round(
            current.wind_speed_10m
        )} km/h`;


    $("pressure").textContent =
        `${Math.round(
            current.pressure_msl
        )} hPa`;


    const currentHour =
        getCurrentHourlyIndex();


    if (
        currentHour >= 0 &&
        weatherData.hourly.uv_index
    ) {

        $("uv").textContent =
            Number(
                weatherData.hourly.uv_index[currentHour]
            ).toFixed(1);

        $("visibility").textContent =
            `${(
                weatherData.hourly.visibility[currentHour]
                / 1000
            ).toFixed(1)} km`;

        $("cloudCover").textContent =
            `${weatherData.hourly.cloud_cover[currentHour]}%`;

    }


    $("timezoneText").textContent =
        `${weatherData.timezone} (${formatUTCOffset(
            weatherData.utc_offset_seconds
        )})`;


    $("dateText").textContent =
        formatDate(
            new Date()
        );


    updateLocalClock();


    const daily =
        weatherData.daily;


    $("sunrise").textContent =
        formatTime(
            daily.sunrise[0]
        );


    $("sunset").textContent =
        formatTime(
            daily.sunset[0]
        );


    $("astroSunrise").textContent =
        formatTime(
            daily.sunrise[0]
        );


    $("astroSunset").textContent =
        formatTime(
            daily.sunset[0]
        );


    saveCityBtn.textContent =
        isCitySaved()
            ? "★ Saved City"
            : "☆ Save City";

}


/* =========================================================
   HOURLY FORECAST
========================================================= */

function renderHourly() {

    const container =
        $("hourlyForecast");

    container.innerHTML = "";


    const hourly =
        weatherData.hourly;


    const start =
        getCurrentHourlyIndex();


    const end =
        Math.min(
            start + 24,
            hourly.time.length
        );


    for (
        let i = start;
        i < end;
        i++
    ) {

        const card =
            document.createElement("div");

        card.className =
            "hourly-card";

        if (i === start) {

            card.classList.add("active");

        }


        const time =
            formatHour(
                hourly.time[i]
            );


        const temperature =
            Math.round(
                hourly.temperature_2m[i]
            );


        const rain =
            hourly.precipitation_probability?.[i] ?? 0;


        card.innerHTML = `

            <span>${time}</span>

            <div class="hourly-icon">
                ${getWeatherIcon(
                    hourly.weather_code[i],
                    1
                )}
            </div>

            <div class="hourly-temp">
                ${temperature}°
            </div>

            <small>
                💧 ${rain}%
            </small>

            <small>
                💨 ${Math.round(
                    hourly.wind_speed_10m[i]
                )} km/h
            </small>

        `;


        container.appendChild(card);

    }

}


/* =========================================================
   DAILY FORECAST
========================================================= */

function renderDaily() {

    const container =
        $("dailyForecast");

    container.innerHTML = "";


    const daily =
        weatherData.daily;


    for (
        let i = 0;
        i < 7;
        i++
    ) {

        const card =
            document.createElement("div");


        card.className =
            "daily-card";


        if (i === 0) {

            card.classList.add("today");

        }


        const date =
            new Date(
                daily.time[i] + "T12:00:00"
            );


        const day =
            i === 0
                ? "Today"
                : date.toLocaleDateString(
                    undefined,
                    {
                        weekday: "short"
                    }
                );


        card.innerHTML = `

            <small>${day}</small>

            <div class="daily-icon">
                ${getWeatherIcon(
                    daily.weather_code[i],
                    1
                )}
            </div>

            <div class="daily-temp">
                ${Math.round(
                    daily.temperature_2m_max[i]
                )}°
                /
                ${Math.round(
                    daily.temperature_2m_min[i]
                )}°
            </div>

            <small>
                💧 ${daily.precipitation_probability_max[i] ?? 0}%
            </small>

            <small>
                💨 ${Math.round(
                    daily.wind_speed_10m_max[i]
                )} km/h
            </small>

        `;


        container.appendChild(card);

    }

}


/* =========================================================
   CHART
========================================================= */

function renderChart() {

    const canvas =
        $("weatherChart");

    if (weatherChart) {

        weatherChart.destroy();

    }


    const hourly =
        weatherData.hourly;


    const start =
        getCurrentHourlyIndex();


    const labels = [];

    const values = [];


    for (
        let i = start;
        i < Math.min(start + 24, hourly.time.length);
        i++
    ) {

        labels.push(
            formatHour(
                hourly.time[i]
            )
        );


        let value;


        switch (chartType.value) {

            case "rain":

                value =
                    hourly.precipitation_probability[i] || 0;

                break;


            case "humidity":

                value =
                    hourly.relative_humidity_2m[i] || 0;

                break;


            case "wind":

                value =
                    hourly.wind_speed_10m[i] || 0;

                break;


            default:

                value =
                    hourly.temperature_2m[i];

        }


        values.push(value);

    }


    let label;


    switch (chartType.value) {

        case "rain":
            label = "Rain Probability (%)";
            break;

        case "humidity":
            label = "Humidity (%)";
            break;

        case "wind":
            label = "Wind Speed (km/h)";
            break;

        default:
            label =
                `Temperature (°${temperatureUnit === "celsius" ? "C" : "F"})`;

    }


    weatherChart =
        new Chart(canvas, {

            type: "line",

            data: {

                labels,

                datasets: [

                    {

                        label,

                        data: values,

                        fill: true,

                        tension: 0.35,

                        borderWidth: 3

                    }

                ]

            },

            options: {

                responsive: true,

                maintainAspectRatio: false,

                plugins: {

                    legend: {

                        display: true

                    }

                },

                scales: {

                    y: {

                        beginAtZero:
                            chartType.value !== "temperature"

                    }

                }

            }

        });

}


/* =========================================================
   AIR QUALITY
========================================================= */

async function loadAirQuality() {

    try {

        const params =
            new URLSearchParams({

                latitude:
                    currentCity.latitude,

                longitude:
                    currentCity.longitude,

                timezone: "auto",

                current: [
                    "european_aqi",
                    "us_aqi",
                    "pm2_5",
                    "pm10",
                    "carbon_monoxide",
                    "nitrogen_dioxide",
                    "sulphur_dioxide",
                    "ozone",
                    "alder_pollen",
                    "birch_pollen",
                    "grass_pollen",
                    "mugwort_pollen",
                    "ragweed_pollen"
                ].join(",")

            });


        const response =
            await fetch(
                `${API.air}?${params}`
            );


        if (!response.ok) {

            return;

        }


        const data =
            await response.json();


        const current =
            data.current;


        const aqi =
            current.us_aqi ??
            current.european_aqi ??
            0;


        $("aqiValue").textContent =
            Math.round(aqi);


        $("aqiText").textContent =
            getAQIDescription(aqi);


        $("pm25").textContent =
            formatNumber(
                current.pm2_5
            );


        $("pm10").textContent =
            formatNumber(
                current.pm10
            );


        $("no2").textContent =
            formatNumber(
                current.nitrogen_dioxide
            );


        $("o3").textContent =
            formatNumber(
                current.ozone
            );

    } catch (error) {

        console.log(
            "Air quality unavailable",
            error
        );

    }

}


/* =========================================================
   WEATHER MAP
========================================================= */

function updateMap() {

    if (!map) {

        map =
            L.map("weatherMap")
                .setView(
                    [
                        currentCity.latitude,
                        currentCity.longitude
                    ],
                    8
                );


        L.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
                maxZoom: 19,
                attribution:
                    "&copy; OpenStreetMap contributors"
            }
        ).addTo(map);

    } else {

        map.setView(
            [
                currentCity.latitude,
                currentCity.longitude
            ],
            8
        );

    }


    if (marker) {

        marker.remove();

    }


    marker =
        L.marker([
            currentCity.latitude,
            currentCity.longitude
        ])
        .addTo(map)
        .bindPopup(
            `<strong>${escapeHTML(
                currentCity.name
            )}</strong><br>Cloudora weather location`
        )
        .openPopup();

}


/* =========================================================
   SUN & MOON
========================================================= */

function renderSunMoon() {

    const sunrise =
        new Date(
            weatherData.daily.sunrise[0]
        );


    const sunset =
        new Date(
            weatherData.daily.sunset[0]
        );


    const daylight =
        sunset - sunrise;


    $("daylight").textContent =
        formatDuration(
            daylight
        );


    $("moonPhase").textContent =
        getMoonPhase(
            new Date()
        );

}


/* =========================================================
   WEATHER ALERTS
========================================================= */

function renderAlert() {

    const current =
        weatherData.current;

    const daily =
        weatherData.daily;


    let title = "";

    let message = "";


    if (
        daily.uv_index_max[0] >= 8
    ) {

        title =
            "High UV Index";

        message =
            "UV levels may be very high. Consider shade, sunscreen and protective clothing.";

    }


    else if (
        daily.precipitation_probability_max[0] >= 80
    ) {

        title =
            "High Rain Chance";

        message =
            "There is a high probability of precipitation today. Carry an umbrella.";

    }


    else if (
        current.wind_speed_10m >= 45
    ) {

        title =
            "Strong Winds";

        message =
            "Wind speeds are currently strong. Be careful outdoors.";

    }


    else if (
        current.temperature_2m >= 40
    ) {

        title =
            "Extreme Heat";

        message =
            "Temperatures are extremely high. Stay hydrated and avoid prolonged exposure.";

    }


    if (message) {

        $("alertTitle").textContent =
            title;

        $("alertText").textContent =
            message;

        $("weatherAlert")
            .classList.remove("hidden");

    } else {

        $("weatherAlert")
            .classList.add("hidden");

    }

}


/* =========================================================
   SAVE CITIES
========================================================= */

function saveCurrentCity() {

    if (isCitySaved()) {

        savedCities =
            savedCities.filter(
                city =>
                    !sameCity(
                        city,
                        currentCity
                    )
            );

    } else {

        savedCities.push(
            currentCity
        );

    }


    localStorage.setItem(
        "cloudoraSavedCities",
        JSON.stringify(savedCities)
    );


    saveCityBtn.textContent =
        isCitySaved()
            ? "★ Saved City"
            : "☆ Save City";


    renderSavedCities();

}


function isCitySaved() {

    return savedCities.some(
        city =>
            sameCity(
                city,
                currentCity
            )
    );

}


function sameCity(a, b) {

    return (
        Math.abs(
            a.latitude - b.latitude
        ) < 0.01 &&
        Math.abs(
            a.longitude - b.longitude
        ) < 0.01
    );

}


function renderSavedCities() {

    const container =
        $("savedCities");

    container.innerHTML = "";


    if (!savedCities.length) {

        container.innerHTML =
            `<div class="saved-city">
                No saved cities yet.
            </div>`;

        return;

    }


    savedCities.forEach(
        (city, index) => {

            const card =
                document.createElement("div");

            card.className =
                "saved-city";


            const info =
                document.createElement("div");


            info.innerHTML = `
                <strong>
                    ${escapeHTML(city.name)}
                </strong>
                <small>
                    ${escapeHTML(city.country || "")}
                </small>
            `;


            const button =
                document.createElement("button");


            button.textContent =
                "×";


            button.title =
                "Remove city";


            button.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    savedCities.splice(
                        index,
                        1
                    );

                    localStorage.setItem(
                        "cloudoraSavedCities",
                        JSON.stringify(
                            savedCities
                        )
                    );

                    renderSavedCities();

                }
            );


            card.addEventListener(
                "click",
                () => {

                    currentCity = city;

                    cityInput.value =
                        city.name;

                    loadWeather(city);

                }
            );


            card.appendChild(info);

            card.appendChild(button);

            container.appendChild(card);

        }
    );

}


/* =========================================================
   HISTORICAL WEATHER
========================================================= */

function setupHistoryDate() {

    const today =
        new Date();

    today.setDate(
        today.getDate() - 1
    );


    historyDate.value =
        today.toISOString()
            .split("T")[0];


    historyDate.max =
        today.toISOString()
            .split("T")[0];

}


async function loadHistoricalWeather() {

    const date =
        historyDate.value;


    if (!date) return;


    try {

        historyBtn.disabled =
            true;

        historyBtn.textContent =
            "Loading...";


        const params =
            new URLSearchParams({

                latitude:
                    currentCity.latitude,

                longitude:
                    currentCity.longitude,

                start_date:
                    date,

                end_date:
                    date,

                timezone:
                    "auto",

                daily: [
                    "weather_code",
                    "temperature_2m_max",
                    "temperature_2m_min",
                    "precipitation_sum",
                    "wind_speed_10m_max"
                ].join(",")

            });


        const response =
            await fetch(
                `${API.archive}?${params}`
            );


        if (!response.ok) {

            throw new Error(
                "Historical weather unavailable."
            );

        }


        const data =
            await response.json();


        const daily =
            data.daily;


        $("historyResult").innerHTML = `

            <strong>
                ${formatLongDate(date)}
            </strong>

            <br><br>

            🌡️ High:
            <strong>
                ${Math.round(
                    daily.temperature_2m_max[0]
                )}°
            </strong>

            <br>

            🌡️ Low:
            <strong>
                ${Math.round(
                    daily.temperature_2m_min[0]
                )}°
            </strong>

            <br>

            🌧️ Precipitation:
            <strong>
                ${daily.precipitation_sum[0]} mm
            </strong>

            <br>

            💨 Maximum Wind:
            <strong>
                ${Math.round(
                    daily.wind_speed_10m_max[0]
                )} km/h
            </strong>

            <br>

            ☁️ Condition:
            <strong>
                ${getWeatherDescription(
                    daily.weather_code[0]
                )}
            </strong>

        `;


        $("historyResult")
            .classList.remove("hidden");

    } catch (error) {

        showError(
            error.message
        );

    } finally {

        historyBtn.disabled =
            false;

        historyBtn.textContent =
            "View Weather";

    }

}


/* =========================================================
   LOCATION
========================================================= */

function useCurrentLocation() {

    if (!navigator.geolocation) {

        showError(
            "Geolocation is not supported by this browser."
        );

        return;

    }


    showLoading(true);


    navigator.geolocation.getCurrentPosition(

        async position => {

            try {

                const latitude =
                    position.coords.latitude;

                const longitude =
                    position.coords.longitude;


                const response =
                    await fetch(
                        `${API.geocode}?latitude=${latitude}&longitude=${longitude}&count=1&language=en&format=json`
                    );


                const data =
                    await response.json();


                const place =
                    data.results?.[0];


                currentCity = {

                    name:
                        place?.name ||
                        "My Location",

                    country:
                        place?.country ||
                        "",

                    latitude,

                    longitude

                };


                await loadWeather(
                    currentCity
                );

            } catch {

                await loadWeather({
                    name: "My Location",
                    country: "",
                    latitude:
                        position.coords.latitude,
                    longitude:
                        position.coords.longitude
                });

            } finally {

                showLoading(false);

            }

        },

        error => {

            showLoading(false);

            showError(
                "Location permission was denied or unavailable."
            );

        },

        {

            enableHighAccuracy: true,

            timeout: 10000,

            maximumAge: 300000

        }

    );

}


/* =========================================================
   THEME
========================================================= */

function loadTheme() {

    const theme =
        localStorage.getItem(
            "cloudoraTheme"
        );


    if (theme === "dark") {

        document.body.classList.add(
            "dark"
        );

        themeBtn.textContent =
            "☀️";

    }

}


function toggleTheme() {

    document.body.classList.toggle(
        "dark"
    );


    const dark =
        document.body.classList.contains(
            "dark"
        );


    localStorage.setItem(
        "cloudoraTheme",
        dark
            ? "dark"
            : "light"
    );


    themeBtn.textContent =
        dark
            ? "☀️"
            : "🌙";

}


/* =========================================================
   UNIT
========================================================= */

function updateUnitButton() {

    unitBtn.textContent =
        temperatureUnit === "celsius"
            ? "°C"
            : "°F";

}


function toggleUnit() {

    temperatureUnit =
        temperatureUnit === "celsius"
            ? "fahrenheit"
            : "celsius";


    localStorage.setItem(
        "cloudoraUnit",
        temperatureUnit
    );


    updateUnitButton();

    loadWeather(currentCity);

}


/* =========================================================
   WORLD CLOCKS
========================================================= */

function startWorldClocks() {

    updateWorldClocks();

    setInterval(
        updateWorldClocks,
        1000
    );

}


function updateWorldClocks() {

    const zones = {

        clockKolkata:
            "Asia/Kolkata",

        clockLondon:
            "Europe/London",

        clockNewYork:
            "America/New_York",

        clockTokyo:
            "Asia/Tokyo",

        clockDubai:
            "Asia/Dubai",

        clockSingapore:
            "Asia/Singapore",

        clockSydney:
            "Australia/Sydney",

        clockToronto:
            "America/Toronto"

    };


    Object.entries(zones)
        .forEach(
            ([id, timezone]) => {

                const element =
                    $(id);

                if (!element) return;


                element.textContent =
                    new Intl.DateTimeFormat(
                        "en-US",
                        {

                            timeZone:
                                timezone,

                            hour:
                                "2-digit",

                            minute:
                                "2-digit",

                            second:
                                "2-digit",

                            hour12:
                                typeof timeFormat !== "undefined" ? timeFormat === "12" : true

                        }
                    ).format(
                        new Date()
                    );

            }
        );


    updateLocalClock();

}


function updateLocalClock() {

    if (!weatherData) return;


    const timezone =
        weatherData.timezone;


    $("localClock").textContent =
        new Intl.DateTimeFormat(
            "en-US",
            {

                timeZone:
                    timezone,

                hour:
                    "2-digit",

                minute:
                    "2-digit",

                second:
                    "2-digit",

                hour12:
                    true

            }
        ).format(
            new Date()
        );


    $("localDate").textContent =
        new Intl.DateTimeFormat(
            "en-US",
            {

                timeZone:
                    timezone,

                weekday:
                    "long",

                month:
                    "short",

                day:
                    "numeric"

            }
        ).format(
            new Date()
        );

}


/* =========================================================
   NOTIFICATIONS
========================================================= */

async function enableNotifications() {

    if (!("Notification" in window)) {

        showError(
            "Notifications are not supported by this browser."
        );

        return;

    }


    const permission =
        await Notification.requestPermission();


    if (permission === "granted") {

        new Notification(
            "Cloudora Notifications Enabled ☁️",
            {
                body:
                    "Cloudora can now send weather notifications."
            }
        );

        notifyBtn.textContent =
            "🔔 On";

    } else {

        showError(
            "Notification permission was not granted."
        );

    }

}


/* =========================================================
   PWA INSTALL
========================================================= */

function setupPWAInstall() {

    window.addEventListener(
        "beforeinstallprompt",
        event => {

            event.preventDefault();

            deferredInstallPrompt =
                event;

            installBtn.classList.remove(
                "hidden"
            );

        }
    );


    installBtn.addEventListener(
        "click",
        async () => {

            if (!deferredInstallPrompt) {

                return;

            }


            deferredInstallPrompt.prompt();


            const result =
                await deferredInstallPrompt.userChoice;


            if (
                result.outcome === "accepted"
            ) {

                installBtn.classList.add(
                    "hidden"
                );

            }


            deferredInstallPrompt =
                null;

        }
    );


    window.addEventListener(
        "appinstalled",
        () => {

            installBtn.classList.add(
                "hidden"
            );

        }
    );

}


/* =========================================================
   CLOUDORA AI
========================================================= */

function sendChatMessage() {

    const question =
        chatInput.value.trim();


    if (!question) return;


    addChatMessage(
        question,
        "user"
    );


    chatInput.value = "";


    const answer =
        generateAIAnswer(
            question.toLowerCase()
        );


    setTimeout(
        () => {

            addChatMessage(
                answer,
                "bot"
            );

        },
        400
    );

}


function addChatMessage(
    message,
    type
) {

    const container =
        $("chatMessages");


    const div =
        document.createElement("div");


    div.className =
        type === "user"
            ? "user-message"
            : "bot-message";


    div.textContent =
        message;


    container.appendChild(div);


    container.scrollTop =
        container.scrollHeight;

}


function generateAIAnswer(question) {

    if (!weatherData) {

        return "Weather information is still loading.";

    }


    const current =
        weatherData.current;


    const daily =
        weatherData.daily;


    const temperature =
        Math.round(
            current.temperature_2m
        );


    const rain =
        daily.precipitation_probability_max[0] || 0;


    const uv =
        daily.uv_index_max[0] || 0;


    const wind =
        Math.round(
            current.wind_speed_10m
        );


    if (
        question.includes("umbrella") ||
        question.includes("rain")
    ) {

        if (rain >= 60) {

            return `Yes ☔. There is about a ${rain}% chance of precipitation today, so carrying an umbrella is a good idea.`;

        }

        return `Probably not necessary ☀️. The precipitation chance is around ${rain}% today.`;

    }


    if (
        question.includes("hot") ||
        question.includes("temperature")
    ) {

        if (temperature >= 35) {

            return `Yes 🔥. It is currently around ${temperature}°. Stay hydrated and avoid prolonged exposure to the heat.`;

        }

        if (temperature <= 15) {

            return `It is quite cool 🧥 at around ${temperature}°. You may want an extra layer.`;

        }

        return `The temperature is around ${temperature}°, which is fairly comfortable.`;

    }


    if (
        question.includes("outdoor") ||
        question.includes("outside") ||
        question.includes("activity")
    ) {

        if (
            rain >= 60 ||
            wind >= 40
        ) {

            return `Outdoor activities may be less comfortable today because of rain or wind.`;

        }

        return `Conditions look reasonably suitable for outdoor activities today. ☀️`;

    }


    if (
        question.includes("air") ||
        question.includes("pollution")
    ) {

        const aqi =
            $("aqiValue").textContent;

        return `The current Cloudora air-quality reading is AQI ${aqi}. Check the Air Quality section for pollutant details.`;

    }


    if (
        question.includes("uv")
    ) {

        return `Today's maximum UV index is around ${uv}. ${uv >= 6 ? "Consider sun protection." : "UV levels should be relatively manageable."}`;

    }


    if (
        question.includes("wind")
    ) {

        return `The current wind speed is around ${wind} km/h.`;

    }


    return `In ${currentCity.name}, it is currently ${temperature}° with ${getWeatherDescription(current.weather_code).toLowerCase()}. Today's rain probability is about ${rain}%.`;

}


/* =========================================================
   WEATHER CODE
========================================================= */

function getWeatherDescription(code) {

    const descriptions = {

        0: "Clear sky",

        1: "Mainly clear",

        2: "Partly cloudy",

        3: "Overcast",

        45: "Foggy",

        48: "Depositing rime fog",

        51: "Light drizzle",

        53: "Moderate drizzle",

        55: "Dense drizzle",

        56: "Freezing drizzle",

        57: "Heavy freezing drizzle",

        61: "Slight rain",

        63: "Moderate rain",

        65: "Heavy rain",

        66: "Freezing rain",

        67: "Heavy freezing rain",

        71: "Slight snow",

        73: "Moderate snow",

        75: "Heavy snow",

        77: "Snow grains",

        80: "Rain showers",

        81: "Moderate rain showers",

        82: "Violent rain showers",

        85: "Snow showers",

        86: "Heavy snow showers",

        95: "Thunderstorm",

        96: "Thunderstorm with hail",

        99: "Severe thunderstorm with hail"

    };


    return descriptions[code] ||
        "Unknown weather";

}


function getWeatherIcon(
    code,
    isDay = 1
) {

    if (code === 0) {

        return isDay
            ? "☀️"
            : "🌙";

    }


    if (
        code === 1 ||
        code === 2
    ) {

        return isDay
            ? "🌤️"
            : "☁️";

    }


    if (code === 3) {

        return "☁️";

    }


    if (
        code === 45 ||
        code === 48
    ) {

        return "🌫️";

    }


    if (
        code >= 51 &&
        code <= 67
    ) {

        return "🌧️";

    }


    if (
        code >= 71 &&
        code <= 77
    ) {

        return "❄️";

    }


    if (
        code >= 80 &&
        code <= 82
    ) {

        return "🌦️";

    }


    if (
        code >= 85 &&
        code <= 86
    ) {

        return "🌨️";

    }


    if (code >= 95) {

        return "⛈️";

    }


    return "☁️";

}


/* =========================================================
   AQI
========================================================= */

function getAQIDescription(aqi) {

    if (aqi <= 50)
        return "Good air quality.";

    if (aqi <= 100)
        return "Moderate air quality.";

    if (aqi <= 150)
        return "Unhealthy for sensitive groups.";

    if (aqi <= 200)
        return "Unhealthy air quality.";

    if (aqi <= 300)
        return "Very unhealthy air quality.";

    return "Hazardous air quality.";

}


/* =========================================================
   MOON PHASE
========================================================= */

function getMoonPhase(date) {

    const knownNewMoon =
        new Date(
            "2000-01-06T18:14:00Z"
        );


    const lunarCycle =
        29.530588853;


    const days =
        (
            date -
            knownNewMoon
        )
        /
        86400000;


    const phase =
        (
            days %
            lunarCycle +
            lunarCycle
        )
        %
        lunarCycle;


    if (phase < 1.85)
        return "New Moon 🌑";

    if (phase < 7.38)
        return "Waxing Crescent 🌒";

    if (phase < 9.23)
        return "First Quarter 🌓";

    if (phase < 14.77)
        return "Waxing Gibbous 🌔";

    if (phase < 16.61)
        return "Full Moon 🌕";

    if (phase < 22.15)
        return "Waning Gibbous 🌖";

    if (phase < 23.99)
        return "Last Quarter 🌗";

    return "Waning Crescent 🌘";

}


/* =========================================================
   HELPERS
========================================================= */

function getCurrentHourlyIndex() {

    if (!weatherData?.hourly?.time) {

        return 0;

    }


    const now =
        new Date();


    let closestIndex = 0;

    let smallestDifference =
        Infinity;


    weatherData.hourly.time
        .forEach(
            (time, index) => {

                const date =
                    new Date(time);


                const difference =
                    Math.abs(
                        date - now
                    );


                if (
                    difference <
                    smallestDifference
                ) {

                    smallestDifference =
                        difference;

                    closestIndex =
                        index;

                }

            }
        );


    return closestIndex;

}


function formatTime(value) {

    if (!value) return "--";


    const date =
        new Date(value);


    return date.toLocaleTimeString(
        undefined,
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    );

}


function formatHour(value) {

    const date =
        new Date(value);


    return date.toLocaleTimeString(
        undefined,
        {
            hour: "numeric",
            minute: "2-digit"
        }
    );

}


function formatDate(date) {

    return date.toLocaleDateString(
        undefined,
        {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
        }
    );

}


function formatLongDate(value) {

    return new Date(
        value + "T12:00:00"
    ).toLocaleDateString(
        undefined,
        {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
        }
    );

}


function formatDuration(milliseconds) {

    const minutes =
        Math.round(
            milliseconds / 60000
        );


    const hours =
        Math.floor(
            minutes / 60
        );


    const remaining =
        minutes % 60;


    return `${hours}h ${remaining}m`;

}


function formatUTCOffset(seconds) {

    const sign =
        seconds >= 0
            ? "+"
            : "-";


    const absolute =
        Math.abs(seconds);


    const hours =
        Math.floor(
            absolute / 3600
        );


    const minutes =
        Math.floor(
            (absolute % 3600) / 60
        );


    return `UTC${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

}


function formatNumber(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "--";

    }


    return Number(value)
        .toFixed(1);

}


function debounce(
    functionToRun,
    delay
) {

    let timeout;


    return (...args) => {

        clearTimeout(timeout);


        timeout =
            setTimeout(
                () => functionToRun(...args),
                delay
            );

    };

}


function escapeHTML(text) {

    const div =
        document.createElement("div");


    div.textContent =
        text;


    return div.innerHTML;

}


/* =========================================================
   UI HELPERS
========================================================= */

function showLoading(show) {

    loading.classList.toggle(
        "hidden",
        !show
    );

}


function showError(message) {

    errorBox.textContent =
        message;

    errorBox.classList.remove(
        "hidden"
    );

}


function hideError() {

    errorBox.classList.add(
        "hidden"
    );

}


/* =========================================================
   AUTO REFRESH
========================================================= */

setInterval(
    () => {

        if (
            document.visibilityState ===
            "visible"
        ) {

            loadWeather(
                currentCity
            );

        }

    },
    10 * 60 * 1000
);


/* =========================================================
   SERVICE WORKER
========================================================= */

if (
    "serviceWorker" in navigator
) {

    window.addEventListener(
        "load",
        () => {

            navigator.serviceWorker
                .register(
                    "service-worker.js"
                )
                .then(
                    registration => {

                        console.log(
                            "Cloudora Service Worker registered:",
                            registration.scope
                        );

                    }
                )
                .catch(
                    error => {

                        console.log(
                            "Service Worker registration failed:",
                            error
                        );

                    }
                );

        }
    );

}

/* =========================================================
   CLOUDORA 2.0 FEATURE PACK
========================================================= */

let satelliteLayer = null;
let radarLayer = null;
let temperatureLayer = null;
let windLayer = null;
let mapBaseLayer = null;
let mapLayersReady = false;
let timeFormat = localStorage.getItem("cloudoraTimeFormat") || "24";
let sceneMode = localStorage.getItem("cloudoraSceneMode") || "auto";

function setupFeaturePack() {
    setupMapLayers();
    setupCompare();
    setupSharing();
    setupAlerts();
    setupVoice();
    setupSettings();
    updateSmartInsights();
    updateWeatherScene();
}

function setupSettings() {
    const tf = $("timeFormatSelect");
    const scene = $("sceneSelect");
    if (tf) {
        tf.value = timeFormat;
        tf.addEventListener("change", () => {
            timeFormat = tf.value;
            localStorage.setItem("cloudoraTimeFormat", timeFormat);
            startWorldClocks();
        });
    }
    if (scene) {
        scene.value = sceneMode;
        scene.addEventListener("change", () => {
            sceneMode = scene.value;
            localStorage.setItem("cloudoraSceneMode", sceneMode);
            updateWeatherScene();
        });
    }
}

function setupSharing() {
    const btn = $("shareWeatherBtn");
    if (!btn) return;
    btn.addEventListener("click", async () => {
        if (!weatherData) return;
        const c = weatherData.current;
        const rain = weatherData.daily?.precipitation_probability_max?.[0] ?? 0;
        const text = `Cloudora — ${currentCity.name}: ${Math.round(c.temperature_2m)}°${temperatureUnit === "celsius" ? "C" : "F"}, ${getWeatherDescription(c.weather_code)}, rain chance ${rain}%.`;
        try {
            if (navigator.share) await navigator.share({ title: `Weather in ${currentCity.name}`, text });
            else await navigator.clipboard.writeText(text);
            showToast(navigator.share ? "Weather shared" : "Weather copied to clipboard");
        } catch (_) {}
    });
}

function setupAlerts() {
    const toggle = $("alertSettingsBtn");
    const panel = $("alertSettings");
    if (toggle && panel) toggle.addEventListener("click", () => panel.classList.toggle("hidden"));
    const enable = $("enableNotificationsBtn");
    if (enable) enable.addEventListener("click", requestNotificationPermission);
    if (notifyBtn) notifyBtn.addEventListener("click", requestNotificationPermission);
}

async function requestNotificationPermission() {
    if (!("Notification" in window)) { showToast("Browser notifications are not supported here"); return; }
    const permission = await Notification.requestPermission();
    showToast(permission === "granted" ? "Notifications enabled" : "Notifications not enabled");
}

function sendWeatherNotification(title, body) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    try { new Notification(title, { body }); } catch (_) {}
}

function setupVoice() {
    const btn = $("voiceBtn");
    if (!btn) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { btn.disabled = true; btn.textContent = "Voice unavailable"; return; }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.onstart = () => { btn.classList.add("voice-active"); btn.textContent = "Listening…"; };
    recognition.onend = () => { btn.classList.remove("voice-active"); btn.textContent = "Start listening"; };
    recognition.onerror = () => { btn.classList.remove("voice-active"); btn.textContent = "Try again"; };
    recognition.onresult = e => {
        const text = e.results[0][0].transcript;
        chatInput.value = text;
        sendChatMessage();
    };
    btn.addEventListener("click", () => recognition.start());
}

function setupCompare() {
    const btn = $("compareBtn");
    if (btn) btn.addEventListener("click", compareCities);
}

async function compareCities() {
    const names = [$("compareCity1")?.value, $("compareCity2")?.value, $("compareCity3")?.value].map(x => (x || "").trim()).filter(Boolean).slice(0,3);
    const container = $("compareResults");
    if (!container || names.length < 2) { showToast("Enter at least two cities"); return; }
    container.innerHTML = `<div class="status">Comparing cities…</div>`;
    try {
        const results = await Promise.all(names.map(async name => {
            const geo = await fetch(`${API.geocode}?name=${encodeURIComponent(name)}&count=1&language=en&format=json`).then(r => r.json());
            const place = geo.results?.[0];
            if (!place) throw new Error(`Could not find ${name}`);
            const p = new URLSearchParams({ latitude: place.latitude, longitude: place.longitude, timezone: "auto", temperature_unit: temperatureUnit === "celsius" ? "celsius" : "fahrenheit", wind_speed_unit: "kmh", forecast_days: "1", current: "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m", daily: "precipitation_probability_max,uv_index_max" });
            const data = await fetch(`${API.forecast}?${p}`).then(r => r.json());
            return { place, data };
        }));
        container.innerHTML = results.map(({place,data}) => {
            const c=data.current, d=data.daily;
            return `<article class="compare-card"><h3>${escapeHTML(place.name)}</h3><small>${escapeHTML(place.country || "")}</small><div class="compare-temp">${Math.round(c.temperature_2m)}°</div><p>${getWeatherDescription(c.weather_code)}</p><div class="compare-row"><span>💧 Humidity</span><strong>${Math.round(c.relative_humidity_2m)}%</strong></div><div class="compare-row"><span>🌧️ Rain</span><strong>${d.precipitation_probability_max?.[0] ?? 0}%</strong></div><div class="compare-row"><span>💨 Wind</span><strong>${Math.round(c.wind_speed_10m)} km/h</strong></div><div class="compare-row"><span>☀️ UV</span><strong>${d.uv_index_max?.[0] ?? "--"}</strong></div></article>`;
        }).join("");
    } catch (e) { container.innerHTML = `<div class="error">${escapeHTML(e.message || "Comparison failed")}</div>`; }
}

function updateSmartInsights() {
    const container = $("smartInsights");
    const briefing = $("dailyBriefing");
    if (!container || !weatherData) return;
    const c = weatherData.current, d = weatherData.daily;
    const temp = c.temperature_2m;
    const rain = d.precipitation_probability_max?.[0] ?? 0;
    const uv = d.uv_index_max?.[0] ?? 0;
    const wind = c.wind_speed_10m;
    const humidity = c.relative_humidity_2m;
    const cards = [
      [rain >= 60 ? "☔" : "☀️", "Umbrella", rain >= 60 ? "Take one" : "Probably not needed", `${rain}% rain chance today`],
      [temp >= 35 ? "🔥" : temp <= 15 ? "🧥" : "👕", "What to wear", temp >= 35 ? "Light clothing" : temp <= 15 ? "Extra layer" : "Comfortable layers", `Feels like ${Math.round(c.apparent_temperature)}°`],
      [rain >= 60 || wind >= 40 ? "⚠️" : "🏃", "Outdoor activity", rain >= 60 || wind >= 40 ? "Use caution" : "Good conditions", `Wind ${Math.round(wind)} km/h`],
      [uv >= 6 ? "🧴" : "🕶️", "Sun protection", uv >= 6 ? "Recommended" : "Light protection", `UV index ${uv}`],
      [humidity >= 80 ? "💦" : "🌬️", "Comfort", humidity >= 80 ? "Humid" : "Comfortable", `Humidity ${Math.round(humidity)}%`]
    ];
    container.innerHTML = cards.map(x => `<div class="insight-card"><div class="insight-icon">${x[0]}</div><small>${x[1]}</small><strong>${x[2]}</strong><small>${x[3]}</small></div>`).join("");
    const mood = rain >= 70 ? "Keep an umbrella close" : temp >= 35 ? "Plan outdoor time around cooler hours" : "Conditions look fairly manageable";
    briefing.textContent = `🌤️ ${currentCity.name} briefing: ${Math.round(temp)}° now with ${getWeatherDescription(c.weather_code).toLowerCase()}. ${mood}. Rain chance is ${rain}%, UV peaks near ${uv}, and wind is around ${Math.round(wind)} km/h.`;
}

function updateWeatherScene() {
    document.body.classList.remove("weather-scene-sunny","weather-scene-rain","weather-scene-storm","weather-scene-night","weather-scene-fog");
    if (sceneMode === "minimal" || !weatherData) return;
    const c = weatherData.current;
    const code = c.weather_code;
    let cls = "weather-scene-sunny";
    if (c.is_day === 0) cls = "weather-scene-night";
    else if ([95,96,99].includes(code)) cls = "weather-scene-storm";
    else if ([45,48].includes(code)) cls = "weather-scene-fog";
    else if (code >= 51 && code <= 82) cls = "weather-scene-rain";
    document.body.classList.add(cls);
}

function setupMapLayers() {
    const buttons = document.querySelectorAll(".map-layer-btn");
    buttons.forEach(btn => btn.addEventListener("click", () => switchMapLayer(btn.dataset.mapLayer)));
}

async function switchMapLayer(type) {
    if (!map) return;
    document.querySelectorAll(".map-layer-btn").forEach(b => b.classList.toggle("active", b.dataset.mapLayer === type));
    if (!mapLayersReady) initializeMapLayers();
    [satelliteLayer, radarLayer, temperatureLayer, windLayer].forEach(layer => { if (layer && map.hasLayer(layer)) map.removeLayer(layer); });
    if (mapBaseLayer && map.hasLayer(mapBaseLayer)) map.removeLayer(mapBaseLayer);
    if (type === "standard") {
        if (mapBaseLayer) mapBaseLayer.addTo(map);
    } else if (type === "satellite" && satelliteLayer) {
        satelliteLayer.addTo(map);
    } else if (type === "radar") {
        if (mapBaseLayer) mapBaseLayer.addTo(map);
        if (radarLayer) radarLayer.addTo(map);
        else { await loadRadarLayer(); if (radarLayer) radarLayer.addTo(map); }
    } else if (type === "temperature" && temperatureLayer) {
        if (mapBaseLayer) mapBaseLayer.addTo(map);
        temperatureLayer.setLatLng([currentCity.latitude, currentCity.longitude]).addTo(map);
    } else if (type === "wind" && windLayer) {
        if (mapBaseLayer) mapBaseLayer.addTo(map);
        windLayer.setLatLng([currentCity.latitude, currentCity.longitude]).addTo(map);
    }
}

function initializeMapLayers() {
    if (!map || mapLayersReady) return;
    mapLayersReady = true;
    map.eachLayer(layer => {
        if (layer instanceof L.TileLayer && !mapBaseLayer) mapBaseLayer = layer;
    });
    satelliteLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Tiles &copy; Esri" });
    temperatureLayer = L.circle([currentCity.latitude, currentCity.longitude], { radius: 18000, color: "#ff9f43", fillOpacity: .12, weight: 2 });
    windLayer = L.marker([currentCity.latitude, currentCity.longitude], {
        icon: L.divIcon({ className: "wind-map-marker", html: `<div style="font-size:34px;transform:rotate(${Number(weatherData?.current?.wind_direction_10m || 0)}deg)">➤</div>`, iconSize: [40,40], iconAnchor: [20,20] })
    }).bindTooltip(`Wind: ${Math.round(weatherData?.current?.wind_speed_10m || 0)} km/h`, { permanent: true, direction: "top" });
}

async function loadRadarLayer() {
    const status = $("radarStatus");
    try {
        const data = await fetch("https://api.rainviewer.com/public/weather-maps.json").then(r => r.json());
        const radar = data.radar?.past?.at(-1);
        if (!radar) throw new Error("Radar unavailable");
        radarLayer = L.tileLayer(`${data.host}${radar.path}/256/{z}/{x}/{y}/2/1_1.png`, { tileSize: 256, opacity: .62, attribution: "Radar: RainViewer" });
        if (status) status.textContent = "Live precipitation radar";
    } catch (_) {
        if (status) status.textContent = "Radar unavailable right now";
    }
}

function renderPollen(data) {
    const c=data?.current || {};
    const vals=[c.alder_pollen,c.birch_pollen,c.grass_pollen,c.mugwort_pollen,c.ragweed_pollen].filter(v => Number.isFinite(v));
    const max=vals.length ? Math.max(...vals) : null;
    const level=max==null ? "Unavailable" : max < 10 ? "Low" : max < 50 ? "Moderate" : max < 200 ? "High" : "Very high";
    if ($("pollenLevel")) $("pollenLevel").textContent=level;
    if ($("pollenDetail")) $("pollenDetail").textContent=max==null ? "Not reported" : `Peak ${Math.round(max)}`;
    if ($("grassPollen")) $("grassPollen").textContent=formatNumber(c.grass_pollen);
    if ($("birchPollen")) $("birchPollen").textContent=formatNumber(c.birch_pollen);
    if ($("ragweedPollen")) $("ragweedPollen").textContent=formatNumber(c.ragweed_pollen);
}

function renderMoonDetails() {
    const el=$("moonDetails"); if(!el) return;
    const now=new Date(); const phase=getMoonPhaseInfo(now);
    el.innerHTML=`<div class="moon-detail"><span>Illumination</span><strong>${phase.illumination}%</strong></div><div class="moon-detail"><span>Next full moon</span><strong>${phase.nextFull}</strong></div><div class="moon-detail"><span>Next new moon</span><strong>${phase.nextNew}</strong></div>`;
}

function getMoonPhaseInfo(date) {
    const synodic=29.530588853, known=new Date("2000-01-06T18:14:00Z");
    const age=((date-known)/86400000)%synodic; const normalized=(age+synodic)%synodic;
    const illumination=Math.round((1-Math.cos((normalized/synodic)*2*Math.PI))/2*100);
    function nextTarget(target) { let delta=(target-normalized+synodic)%synodic; if(delta<.01) delta=synodic; return new Date(date.getTime()+delta*86400000).toLocaleDateString([], {month:"short",day:"numeric",year:"numeric"}); }
    return { illumination, nextFull: nextTarget(synodic/2), nextNew: nextTarget(0) };
}

function showToast(message) {
    let toast=$("cloudoraToast");
    if(!toast){ toast=document.createElement("div"); toast.id="cloudoraToast"; toast.style.cssText="position:fixed;right:20px;bottom:20px;z-index:9999;padding:13px 17px;border-radius:14px;background:var(--text);color:var(--card);box-shadow:var(--shadow);font-weight:700;opacity:0;transform:translateY(10px);transition:.2s"; document.body.appendChild(toast); }
    toast.textContent=message; requestAnimationFrame(()=>{toast.style.opacity="1";toast.style.transform="translateY(0)"}); clearTimeout(toast._timer); toast._timer=setTimeout(()=>{toast.style.opacity="0";toast.style.transform="translateY(10px)"},2200);
}

// Hook feature rendering into the existing weather pipeline without replacing the original app.
const _originalUpdateMap = updateMap;
updateMap = function() { _originalUpdateMap(); initializeMapLayers(); };
const _originalLoadAirQuality = loadAirQuality;
loadAirQuality = async function() {
    const result = await _originalLoadAirQuality();
    try {
        const p=new URLSearchParams({latitude:currentCity.latitude,longitude:currentCity.longitude,timezone:"auto",current:"alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,ragweed_pollen"});
        const r=await fetch(`${API.air}?${p}`); if(r.ok) renderPollen(await r.json());
    } catch(_) {}
    return result;
};
const _originalRenderSunMoon = renderSunMoon;
renderSunMoon = function(){ _originalRenderSunMoon(); renderMoonDetails(); };
const _originalRenderCurrentWeather = renderCurrentWeather;
renderCurrentWeather = function(){ _originalRenderCurrentWeather(); updateWeatherScene(); updateSmartInsights(); };
const _originalRenderAlert = renderAlert;
renderAlert = function(){ _originalRenderAlert(); if(weatherData) { const c=weatherData.current,d=weatherData.daily; if(d?.precipitation_probability_max?.[0]>=80 && $("rainAlerts")?.checked) sendWeatherNotification("Rain alert", `${currentCity.name}: rain chance is ${d.precipitation_probability_max[0]}% today.`); if(c.temperature_2m>=40 && $("heatAlerts")?.checked) sendWeatherNotification("Heat alert", `${currentCity.name}: temperature is ${Math.round(c.temperature_2m)}°.`); } };

// Initialize after the original DOMContentLoaded setup has run.
document.addEventListener("DOMContentLoaded", setupFeaturePack);
