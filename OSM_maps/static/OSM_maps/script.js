// Initialize Map
let userLocation = null;
let routeControl = null;
let markers = [];
let locationMarker = null;
let devicelocation = null;
let sourceMarker = null;
let destinationMarker = null;
let debounceTimer;
const SORT_MODES = ["Default", "Distance", "Opening"];
window.currentPlaceType = null; // Store the current place type

// Local Storage Cache
let locationCache = {
    hospitals: null,
    labs: null,
    pharmacies: null,
    doctors: null,
};
function initializeCache(lat, lon) {
    fetchLabs(lat, lon, false);
    fetchHospitals(lat, lon, false);
    fetchDoctors(lat, lon, false);
    fetchPharmacies(lat, lon, false);
}
function clearLocationCache() {
    locationCache.hospitals = null;
    locationCache.labs = null;
    locationCache.pharmacies = null;
    locationCache.doctors = null;
}
// Custom Icons
const defaultIcon = L.icon({
    iconUrl: '/static/elements/penguin.svg',
    iconSize: [44, 100],
    iconAnchor: [22, 50],
    popupAnchor: [-0, -20],
});
const pharmacyIcon = L.icon({
    iconUrl: '/static/elements/Pharmacy.png',
    iconSize: [100, 100],
    iconAnchor: [50, 50],
    popupAnchor: [0, -20]
});
const labIcon = L.icon({
    iconUrl: '/static/elements/Patho_lab.png',
    iconSize: [100, 100],
    iconAnchor: [50, 50],
    popupAnchor: [0, -20]
});
const hospitalIcon = L.icon({
    iconUrl: '/static/elements/Hospital.png',
    iconSize: [100, 100],
    iconAnchor: [50, 50],
    popupAnchor: [0, -20]
});
function getIconForType(placeType) {
    switch (placeType) {
        case "Lab": return labIcon;
        case "Hospital": return hospitalIcon;
        case "Pharmacy": return pharmacyIcon;
        case "Doctor": return hospitalIcon; // Use hospital icon for doctors
        default: return defaultIcon;
    }
}

// Create Map Object and Set Viewport
let map = L.map('map',{
    minZoom: 5, 
    maxBounds: [
        [3.0, 65.0],
        [40.0, 100.0] 
    ]}).setView([20.5937, 78.9629], 5);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

initializeUserLocation();
function initializeUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            clearLocationCache();
            let lat = position.coords.latitude;
            let lon = position.coords.longitude;
            userLocation = [lat, lon];
            devicelocation = userLocation;

            document.getElementById("sourceLocation").value = "Your location";

            if (!sourceMarker) {
                sourceMarker = L.marker([lat, lon], { draggable: true }).addTo(map)
                    .bindPopup("Your location").openPopup();

                sourceMarker.on("dragend", function (event) {
                    let newPos = event.target.getLatLng();
                    userLocation = [newPos.lat, newPos.lng];
                    console.log("📍 Source moved to:", userLocation);
                });
            } else {
                sourceMarker.setLatLng([lat, lon]);
            }
            map.setView(userLocation, 13);
        }, error => console.warn("Geolocation error:", error.message));
    } else {
        alert("Geolocation not supported.");
    }
}

// Search & Autocomplete
document.addEventListener("DOMContentLoaded", setupSearch);
function setupSearch() {
    const input = document.getElementById("locationInput");
    const searchBtn = document.getElementById("searchBtn");
    const autocompleteList = document.getElementById("autocompleteList");

    if (!input || !searchBtn || !autocompleteList) {
        console.error("❌ Search elements not found!");
        return;
    }
    input.addEventListener("keyup", function (event) {
        if (event.key === "Enter") {
            searchLocation(input.value);
            autocompleteList.style.display = "none";
        }
    });
    searchBtn.addEventListener("click", function () {
        searchLocation(input.value);
        autocompleteList.style.display = "none";
    });
    input.addEventListener("input", function () {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const query = input.value.trim().toLowerCase();
            autocompleteList.innerHTML = "";

            if (query.length < 2) {
                autocompleteList.style.display = "none";
                return;
            }

            let matchedLocations = new Set();
            Object.values(locationCache).forEach(locations => {
                if (locations) {
                    locations.forEach(location => {
                        let name = location.tags?.name || location.name;
                        if (name && name.toLowerCase().includes(query)) {
                            if (!matchedLocations.has(name)) {
                                matchedLocations.add(name);
                                const item = document.createElement("div");
                                item.textContent = name;
                                item.addEventListener("click", function () {
                                    input.value = this.textContent;
                                    autocompleteList.style.display = "none";
                                });
                                autocompleteList.appendChild(item);
                            }
                        }
                    });
                }
            });
            if (matchedLocations.size > 0) {
                autocompleteList.style.display = "block";
            }
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&countrycodes=IN`)
                .then(response => response.json())
                .then(data => {
                    if (data.length > 0) {
                        data.forEach(place => {
                            if (!matchedLocations.has(place.display_name)) { // Avoid duplicates
                                matchedLocations.add(place.display_name);
                                const item = document.createElement("div");
                                item.textContent = place.display_name;
                                item.dataset.lat = place.lat;
                                item.dataset.lon = place.lon;
                                item.addEventListener("click", function () {
                                    input.value = this.textContent;
                                    placeMarkerAndMove(this.dataset.lat, this.dataset.lon);
                                    autocompleteList.style.display = "none";
                                });
                                autocompleteList.appendChild(item);
                            }
                        });
                        autocompleteList.style.display = "block";
                    }
                })
                .catch(error => console.error("❌ Autocomplete error:", error));
        }, 300); // 300ms debounce for better UX
    });
}
function searchLocation(query) {
    if (!query.trim()) {
        alert("Please enter a location.");
        return;
    }

    const serviceMap = {
        "pharmacy": fetchPharmacies,
        "pharmacies": fetchPharmacies,
        "pharmacy near me": fetchPharmacies,
        "pharmacies near me": fetchPharmacies,
        "medicine": fetchPharmacies,
        "medicines": fetchPharmacies,
        "medicine near me": fetchPharmacies,
        "medicines near me": fetchPharmacies,

        "lab": fetchLabs,
        "labs": fetchLabs,
        "lab near me": fetchLabs,
        "labs near me": fetchLabs,

        "hospital": fetchHospitals,
        "hospitals": fetchHospitals,
        "hospital near me": fetchHospitals,
        "hospitals near me": fetchHospitals,

        "doctor": fetchDoctors,
        "doctors": fetchDoctors,
        "doctor near me": fetchDoctors,
        "doctors near me": fetchDoctors,
        "clinic": fetchDoctors,
        "clinics": fetchDoctors,
        "clinic near me": fetchDoctors,
        "clinics near me": fetchDoctors,
    };
    let lowerQuery = query.toLowerCase().trim();
    if (serviceMap[lowerQuery]) {
        serviceMap[lowerQuery](userLocation[0], userLocation[1]);
        return;
    }

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&countrycodes=IN`)
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                placeMarkerAndMove(data[0].lat, data[0].lon);
            } else {
                alert("Location not found.");
            }
        })
        .catch(error => console.error("❌ Search error:", error));
}

document.getElementById("savedBtn").addEventListener("click", function() {
    showLeftSidebar("Your Saved Locations");
    showSavedLocations();
});
function showSavedLocations() {
    fetch('/get_saved_locations/')
    .then(response => response.json())
    .then(data => {
        let listContainer = document.getElementById("leftSidebarList");
        listContainer.innerHTML = "";
        if (data.saved_locations.length === 0) {
            listContainer.innerHTML = "<p style='padding: 10px;'>No saved locations.</p>";
            return;
        }
        data.saved_locations.forEach(loc => {
            let item = document.createElement("div");
            item.classList.add("saved-location-item");
            item.textContent = loc.name;
            item.style.cursor = "pointer";
            item.addEventListener("click", function() {
                closeLeftSidebar();
                updateMarker(loc.lat, loc.lon, false);
                showSidebar(loc.name, loc.address, loc.lat, loc.lon);
            });
            listContainer.appendChild(item);
        });
    })
    .catch(err => console.error("Error fetching saved locations:", err));
}
document.getElementById("saveLocationBtn").addEventListener("click", saveLocation);
function saveLocation() {
    let name = document.getElementById("marker-title").innerText;
    let location_type = window.currentPlaceType;  // Adjust based on search category
    let lat = destinationMarker.getLatLng().lat;
    let lon = destinationMarker.getLatLng().lng;
    let address = document.getElementById("marker-info").innerText || "No address";
    fetch('/save_location/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRFToken': getCSRFToken(),
        },
        body: `name=${encodeURIComponent(name)}&location_type=${encodeURIComponent(location_type)}&lat=${lat}&lon=${lon}&address=${encodeURIComponent(address)}`
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === "success") {
            alert("Location saved successfully!");
        } else {
            alert("Error saving location: " + data.message);
        }
    })
    .catch(err => console.error("Error:", err));
}
function clearSavedLocations() {
    fetch("/clear-saved-locations/", {
        method: "POST",
        headers: {
            "X-CSRFToken": getCSRFToken(),
            "Content-Type": "application/json"
        }
    })
    .then(response => {
        if (response.ok) {
            document.getElementById("leftSidebarList").innerHTML = "<p style='padding: 10px;'>Saved locations cleared.</p>";
        }
    });
}
function showSearchHistory() {
    fetch('/get_recent_searches/')
    .then(response => response.json())
    .then(data => {
        let listContainer = document.getElementById("leftSidebarList");
        listContainer.innerHTML = "";
        let searches = data.search_history || data.recent_searches; // Try both keys
        if (!searches || searches.length === 0) {
            listContainer.innerHTML = "<p style='padding: 10px;'>No search history.</p>";
            return;
        }
        searches.forEach(search => {
            let item = document.createElement("div");
            item.classList.add("search-history-item");
            item.textContent = search.query || search.name;
            item.style.cursor = "pointer";
            item.addEventListener("click", function() {
                closeLeftSidebar();
                updateMarker(search.lat, search.lon, false);
                showSidebar(search.query || search.name, search.address, search.lat, search.lon);
            });
            listContainer.appendChild(item);
        });
    })
    .catch(err => console.error("Error fetching search history:", err));
}
function saveSearchHistory(query, address, lat, lon) {
    fetch('/save_search_history/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRFToken': getCSRFToken(),
        },
        body: `name=${encodeURIComponent(query)}&address=${encodeURIComponent(address)}&lat=${lat}&lon=${lon}`
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === "success") {
            console.log("Search history saved successfully!");
        } else {
            console.error("Error saving search history:", data.message);
        }
    })
    .catch(err => console.error("Error:", err));
}
function clearSearchHistory() {
    fetch("/clear-history/", {
        method: "POST",
        headers: {
            "X-CSRFToken": getCSRFToken(),  // Ensure CSRF token is included
            "Content-Type": "application/json"
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === "success") {
            document.getElementById("leftSidebarList").innerHTML = "<p style='padding: 10px;'>Search history cleared.</p>";
        } else {
            alert("Error clearing history: " + data.message);
        }
    });
}
function setupPlaceButton(buttonId, placeType) {
    document.getElementById(buttonId).addEventListener("click", () => {
        window.currentPlaceType = placeType;
        if (userLocation) {
            moveToLocation(userLocation[0], userLocation[1]);
            fetchPlaceData(placeType, userLocation[0], userLocation[1]);
        } else {
            alert("User location not available");
        }
    });
}
["hospitalBtn", "hospitalBtn2"].forEach(id => setupPlaceButton(id, "Hospital"));
["labBtn", "labBtn2"].forEach(id => setupPlaceButton(id, "Lab"));
["pharmacyBtn", "pharmacyBtn2"].forEach(id => setupPlaceButton(id, "Pharmacy"));
["doctorBtn", "doctorBtn2"].forEach(id => setupPlaceButton(id, "Doctor"));

document.addEventListener("DOMContentLoaded", function () {
    setupSourceLocationAutocomplete("sourceLocation", "sourceAutocompleteList", true);
    setupDestinationAutocomplete("destinationLocation", "destinationAutocompleteList");
    let closeSidebarBtn = document.getElementById("closeSidebar");
    closeSidebarBtn.onclick = closeSidebar;
    document.getElementById("closeLeftSidebar").addEventListener("click", closeLeftSidebar);
    // Add event listeners for our three new sort buttons
    document.getElementById("sortByName").addEventListener("click", function() {
        toggleSortOrder(this);
        sortByName(this.getAttribute("data-asc") === "true");
    });
    document.getElementById("sortByDistance").addEventListener("click", function() {
        toggleSortOrder(this);
        sortbyDistance(this.getAttribute("data-asc") === "true");
    });
    document.getElementById("sortByOpen").addEventListener("click", function() {
        toggleSortOrder(this);
        sortByOpeningHours(this.getAttribute("data-asc") === "true");
    });
    document.getElementById("formatData").addEventListener("click", function() {
        let action = this.getAttribute("data-action");
        if (action === "clear-history") {
            clearSearchHistory();
        } else if (action === "clear-saved") {
            clearSavedLocations();
        } else if (action === "sort") {
            dynamicSort(this);
        }
    });
    document.getElementById("resetBtn").addEventListener("click", function () {
        clearMarkers();
        initializeUserLocation();
        if (typeof closeSidebar === "function") {
            closeSidebar();
        }
    });
    document.getElementById("recentSearchesBtn").addEventListener("click", function() {
        showLeftSidebar("Your Search History");
        showSearchHistory();
    });
});

function fetchPlaceData(type, lat, lon) {
    clearMarkers();
    switch (type) {
        case "Hospital": cacheKey = "hospitals"; break;
        case "Lab": cacheKey = "labs"; break;
        case "Pharmacy": cacheKey = "pharmacies"; break;
        case "Doctor": cacheKey = "doctors"; break;
    }
    if (locationCache[cacheKey]) {
        console.log("Using cached data 🗄️");
        populateLeftSidebarFromCache(type);
        plotCachedLocations(locationCache[cacheKey], getIconForType(type), type);
    } else {
        const query = getOverpassQueryForType(type);
        executeOverpassQuery(query, type),
        executeDBQuery(type, lat, lon)
    }
}
function getOverpassQueryForType(type) {
    const queries = {
        "Hospital": `
            [out:json];
            (
                node["amenity"="hospital"](around:5000,${userLocation[0]},${userLocation[1]});
                node["healthcare"="hospital"](around:5000,${userLocation[0]},${userLocation[1]});
                node["building"="hospital"](around:5000,${userLocation[0]},${userLocation[1]});
            ); out;
        `,
        "Lab": `
            [out:json];
            (
                node["amenity"="laboratory"](around:5000,${userLocation[0]},${userLocation[1]});
                node["amenity"="medical_laboratory"](around:5000,${userLocation[0]},${userLocation[1]});
                node["healthcare"="laboratory"](around:5000,${userLocation[0]},${userLocation[1]});
                node["healthcare"="sample_collection"](around:5000,${userLocation[0]},${userLocation[1]});
                node["healthcare_speciality"="blood_check"](around:5000,${userLocation[0]},${userLocation[1]});
                node["healthcare_speciality"="clinical_pathology"](around:5000,${userLocation[0]},${userLocation[1]});
                node["healthcare_speciality"="pathology"](around:5000,${userLocation[0]},${userLocation[1]});
            ); out;
        `,
        "Doctor": `
            [out:json];
            (
                node["amenity"="doctors"](around:5000,${userLocation[0]},${userLocation[1]});
                node["amenity"="clinic"](around:5000,${userLocation[0]},${userLocation[1]});
                node["healthcare"="clinic"](around:5000,${userLocation[0]},${userLocation[1]});
                node["healthcare"="doctor"](around:5000,${userLocation[0]},${userLocation[1]});
            ); out;
        `,
        "Pharmacy": `
            [out:json];
            (
                node["amenity"="pharmacy"](around:5000,${userLocation[0]},${userLocation[1]});
                node["healthcare"="pharmacy"](around:5000,${userLocation[0]},${userLocation[1]});
                node["pharmacy"="yes"](around:5000,${userLocation[0]},${userLocation[1]});
                node["shop"="chemist"](around:5000,${userLocation[0]},${userLocation[1]});
                node["shop"="medical_supply"](around:5000,${userLocation[0]},${userLocation[1]});
                node["office"="medical"](around:5000,${userLocation[0]},${userLocation[1]});
            ); out;
        `
    };
    return queries[type];
}
function executeOverpassQuery(query, placeType, plot=true) {
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    fetch(url)
        .then(response => response.json())
        .then(osmData => {
            if (!osmData.elements || osmData.elements.length === 0) {
                alert(`No ${placeType}s found nearby.`);
                return;
            }
            let key = (placeType === "Pharmacy") ? "pharmacies" : placeType.toLowerCase() + "s";
            locationCache[key] = (locationCache[key] || []).concat(osmData.elements);
            if (plot){
                populateLeftSidebarFromCache(placeType);
                plotCachedLocations(osmData.elements, getIconForType(placeType), placeType);
            }
        })
        .catch(err => console.error(`❌ ${placeType} fetch error:`, err));
}
function executeDBQuery(locationType, lat, lon, plot=true) {
    let endpoint = "";
    // Choose the correct endpoint based on the locationType.
    switch (locationType) {
        case "Pharmacy": endpoint = "/api/pharmacies/"; break;
        case "Hospital": endpoint = "/api/hospitals/"; break;
        case "Doctor": endpoint = "/api/doctors/"; break;
        case "Lab": endpoint = "/api/labs/"; break;
        default: console.error("Unknown location type:", locationType);
            return;
    }
    fetch(`${endpoint}?lat=${lat}&lon=${lon}`)
        .then(response => response.json())
        .then(data => {
            let key = (locationType === "Pharmacy") ? "pharmacies" : locationType.toLowerCase()+"s";
            let items = data[key] || [];
            let formattedItems = items.map(item => ({
                lat: item.lat,
                lon: item.lon,
                tags: { name: item.name,
                    opening_hours: item.opening_hours,
                },
                address: item.address
            }));
            if (!locationCache[key]) {
                locationCache[key] = formattedItems;
            } else {
                locationCache[key] = [...locationCache[key], ...formattedItems]; // Merge new results
            }
            if (data[key] && data[key].length > 0) {
                console.log(`DB ${locationType} data:`, data[key]);
                if (plot){
                populateLeftSidebarFromCache(locationType);
                plotCachedLocations(data[key], getIconForType(locationType), locationType);
                }
            } else {
                console.log(`No DB ${locationType} results found.`);
            }
        })
        .catch(err => console.error(`Error fetching ${locationType} from DB:`, err));
}
function placeMarkerAndMove(lat, lon) {
    clearLocationCache();
    lat = parseFloat(lat);
    lon = parseFloat(lon);
    userLocation = [lat, lon];
    if (sourceMarker) {
        sourceMarker.setLatLng(userLocation);
    } else {
        sourceMarker = L.marker(userLocation, { draggable: true }).addTo(map)
            .bindPopup("Your location").openPopup();
        sourceMarker.on("dragend", function (event) {
            let newPos = event.target.getLatLng();
            userLocation = [newPos.lat, newPos.lng];
            console.log("📍 Source moved to:", userLocation);
        });
    }
    if (!destinationMarker) {
        destinationMarker = L.marker([lat, lon], { draggable: false }).addTo(map)
            .bindPopup("Destination").openPopup();
    } else {
        destinationMarker.setLatLng([lat, lon]);
    }
    document.getElementById("destinationLocation").value = `Lat: ${lat}, Lon: ${lon}`;
    map.setView([lat, lon], 14);
}
function moveToLocation(lat, lon) {
    if (map) {
        // userLocation = [lat, lon];
        map.setView([lat, lon], 14);
    } else {
        console.error("❌ Map is not initialized!");
    }
}
function updateMarker(lat, lon, isSource) {
    lat = parseFloat(lat);
    lon = parseFloat(lon);
    if (isSource) {
        clearLocationCache();
        if (!sourceMarker) {
            sourceMarker = L.marker([lat, lon], { draggable: true }).addTo(map)
                .bindPopup("Source").openPopup();
            sourceMarker.on("dragend", function (event) {
                let newPos = event.target.getLatLng();
                userLocation = [newPos.lat, newPos.lng];
                console.log("📍 Source moved to:", userLocation);
            });
        } else {
            sourceMarker.setLatLng([lat, lon]);
        }
    } else {
        if (!destinationMarker) {
            destinationMarker = L.marker([lat, lon], { draggable: false }).addTo(map)
                .bindPopup("Destination").openPopup();
        } else {
            destinationMarker.setLatLng([lat, lon]);
        }
    }
    map.setView([lat, lon], 14);
}
function plotCachedLocations(locations, icon, placeType) {
    locations.forEach(location => {
        let name = (location.tags && location.tags.name) ? location.tags.name : (location.name || placeType);
        let description = `Lat: ${location.lat}, Lon: ${location.lon}`;
        let marker = L.marker([location.lat, location.lon], { icon: icon }).addTo(map)
            .bindPopup(`
                <b>${name}</b><br>
                <button type="button" onclick="showSidebar('${name}', '${description}', ${location.lat}, ${location.lon});">Show Details</button>
            `);
        markers.push(marker);
    });
}
function clearMarkers() {
    if (locationMarker && map.hasLayer(locationMarker)) {
        map.removeLayer(locationMarker);
        locationMarker = null;
    }
    markers.forEach(marker => {
        if (marker && map.hasLayer(marker)) {
            map.removeLayer(marker);
        }
    });
    markers = [];
}
function getDirections() {
    if (!sourceMarker || !destinationMarker) {
        alert("Please select both a source and a destination.");
        return;
    }
    if (!userLocation) {
        alert("User location not found. Please enable location services.");
    }
    clearMarkers();
    let sourcePos = sourceMarker.getLatLng();
    let destPos = destinationMarker.getLatLng();

    if (routeControl) {
        map.removeControl(routeControl);
    }
    routeControl = L.Routing.control({
        waypoints: [
            L.latLng(sourcePos.lat, sourcePos.lng),
            L.latLng(destPos.lat, destPos.lng)
        ],
        routeWhileDragging: true,
        lineOptions: { styles: [{ color: 'blue', weight: 5 }] },
        router: L.Routing.osrmv1({
            serviceUrl: 'https://router.project-osrm.org/route/v1' // OSRM API for route calculations
        }),
        createMarker: function () { return null; } // Hide default markers
    }).addTo(map);
    routeControl.on('routesfound', function (e) {
        let routes = e.routes[0].instructions.map(inst => `<li>${inst.text}</li>`).join('');
        document.getElementById("route-info").innerHTML = `<ul>${routes}</ul>`;
    });
}
function getCSRFToken() {
    let cookieValue = null;
    let name = 'csrftoken';
    if (document.cookie && document.cookie !== '') {
        let cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            cookie = cookie.trim();
            if (cookie.startsWith(name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}
function populateLeftSidebarFromCache(locationType, sortedResults=false) {
    let cacheKey = "";
    switch(locationType) {
        case "Pharmacy": cacheKey = "pharmacies"; break;
        case "Hospital": cacheKey = "hospitals"; break;
        case "Lab": cacheKey = "labs"; break;
        case "Doctor": cacheKey = "doctors"; break;
        default: console.error("Unknown location type:", locationType);
        return;
    }
    let sidebarTitle = document.getElementById("leftSidebarTitle");
    sidebarTitle.textContent = locationType + " near you";
    showLeftSidebar(locationType + " near you");
    // Clear and populate the sidebar list.
    let sidebarList = document.getElementById("leftSidebarList");
    sidebarList.innerHTML = "";

    let results = sortedResults ? sortedResults : locationCache[cacheKey];
    if (!results || results.length === 0) {
        sidebarList.innerHTML = `<p style="padding:10px;">No ${locationType} found near you.</p>`;
    } else {
        results.forEach(result => {
            let name = (result.tags && result.tags.name) ? result.tags.name : (result.name || locationType);
            let openingHours = result.tags?.opening_hours;
            let status = openingHours ? (isOpenNow(openingHours) ? "🟢 Open Now" : "🔴 Closed") : "❓Hours Unknown";
            let distKm = result.distance ? `${result.distance.toFixed(2)} km away` : "";
            let item = document.createElement("div");

            item.textContent = `${name} ${status}`;
            item.innerHTML = `<strong>${name}</strong><br><span style="font-size: 0.9em;">${status} • ${distKm ? "" + distKm : ""}</span>`;
            item.style.cursor = "pointer";
            item.addEventListener("click", function() {
                let address = result.address ? result.address : `Lat: ${result.lat}, Lon: ${result.lon}`;
                showSidebar(name, address, result.lat, result.lon);
            });
            sidebarList.appendChild(item);
        });
    }
}
function setupSourceLocationAutocomplete(inputId, autocompleteListId, isSource) {
    const input = document.getElementById(inputId);
    const autocompleteList = document.getElementById(autocompleteListId);
    input.addEventListener("input", function () {
        const query = input.value.trim();
        if (query.length < 2) {
            autocompleteList.style.display = "none";
            return;
        }
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&countrycodes=IN`)
            .then(response => response.json())
            .then(data => {
                autocompleteList.innerHTML = "";
                if (data.length > 0) {
                    data.forEach(place => {
                        const item = document.createElement("div");
                        item.textContent = place.display_name;
                        item.dataset.lat = place.lat;
                        item.dataset.lon = place.lon;
                        item.addEventListener("click", function () {
                            input.value = this.textContent;
                            let lat = parseFloat(this.dataset.lat);
                            let lon = parseFloat(this.dataset.lon);
                            updateMarker(lat, lon, isSource);
                            autocompleteList.style.display = "none";
                        });
                        autocompleteList.appendChild(item);
                    });
                    autocompleteList.style.display = "block";
                } else {
                    autocompleteList.style.display = "none";
                }
            })
            .catch(error => console.error("❌ Autocomplete error:", error));
    });
}
function setupDestinationAutocomplete(inputId, autocompleteListId) {
    let input = document.getElementById(inputId);
    let autocompleteList = document.getElementById(autocompleteListId);
    input.addEventListener("input", function () {
        const query = input.value.trim().toLowerCase();
        let currentType = window.currentPlaceType || "Pharmacy"; // default type
        let markersList = [];
        // Determine which cache array to use based on current place type
        switch (currentType) {
            case "Lab": markersList = locationCache.labs || []; break;
            case "Hospital": markersList = locationCache.hospitals || []; break;
            case "Pharmacy": markersList = locationCache.pharmacies || []; break;
            case "Doctor": markersList = locationCache.doctors || []; break;
            default: markersList = [];
        }
        autocompleteList.innerHTML = "";
        if (markersList.length === 0) {
            autocompleteList.style.display = "none";
            return;
        }
        let filteredMarkers = markersList.filter(marker => {
            let markerName = marker.tags && marker.tags.name ? marker.tags.name : currentType;
            return markerName.toLowerCase().includes(query);
        });
        if (filteredMarkers.length > 0) {
            filteredMarkers.forEach(marker => {
                let markerName = marker.tags && marker.tags.name ? marker.tags.name : currentType;
                const item = document.createElement("div");
                item.textContent = markerName;
                item.dataset.lat = marker.lat;
                item.dataset.lon = marker.lon;
                item.addEventListener("click", function () {
                    input.value = markerName;
                    let lat = parseFloat(this.dataset.lat);
                    let lon = parseFloat(this.dataset.lon);
                    // Update marker as destination
                    updateMarker(lat, lon, false);
                    autocompleteList.style.display = "none";
                });
                autocompleteList.appendChild(item);
            });
            autocompleteList.style.display = "block";
        } else {
            autocompleteList.style.display = "none";
        }
    });
}
function showSidebar(name, description, lat, lon) {
    closeLeftSidebar()
    let sidebar = document.getElementById("sidebar");
    if (!sidebar) {
        console.error("Sidebar element not found!");
        return;
    }
    document.getElementById("marker-title").innerText = name;
    document.getElementById("marker-info").innerText = description;
    document.getElementById("route-info").innerHTML = "";
    document.getElementById("destinationLocation").value = name;
    if (!destinationMarker) {
        destinationMarker = L.marker([lat, lon], { draggable: false }).addTo(map);
    } else {
        destinationMarker.setLatLng([lat, lon]);
    }
    if (!sourceMarker) {
        if (userLocation) {
            sourceMarker = L.marker(userLocation, { draggable: true }).addTo(map);
            sourceMarker.on("dragend", function (event) {
                let newPos = event.target.getLatLng();
                userLocation = [newPos.lat, newPos.lng]; // Update source location
                console.log("📍 Source moved to:", userLocation);
            });
        } else {
            console.warn("User location not available. Source not set.");
        }
    }
    let getDirectionBtn = document.getElementById("getDirection");
    getDirectionBtn.onclick = function () {
        if (!sourceMarker || !destinationMarker) {
            alert("Please select both a source and a destination.");
            return;
        }
    
        const source = sourceMarker.getLatLng();
        const dest = destinationMarker.getLatLng();
    
        // Basic mobile browser detection
        const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    
        if (isMobile) {
            // Redirect to navigation screen with query parameters
            const url = `/navigation/?src_lat=${source.lat}&src_lng=${source.lng}&dest_lat=${dest.lat}&dest_lng=${dest.lng}`;
            window.location.href = url;
        } else {
            // fallback to in-page route drawing
            getDirections(dest.lat, dest.lng);
        }
    };
    sidebar.classList.add("sidebar-visible");
    saveSearchHistory(name, description, lat, lon);
}
function closeSidebar() {
    let sidebar = document.getElementById("sidebar");
    sidebar.classList.remove("sidebar-visible");
    if (routeControl) {
        map.removeControl(routeControl);
        routeControl = null;
    }
    if (destinationMarker && map.hasLayer(destinationMarker)) {
        map.removeLayer(destinationMarker);
        destinationMarker = null;
    }
    clearMarkers();
    document.getElementById("route-info").innerHTML = ""; 
}
// Helper to toggle the data-asc attribute and change button text (arrow up/down)
function toggleSortOrder(button) {
    let isAsc = button.getAttribute("data-asc") === "true";
    isAsc = !isAsc;
    button.setAttribute("data-asc", isAsc.toString());
    let txt = button.textContent;
    if (txt.endsWith("↑")) {
        button.textContent = txt.replace("↑", "↓");
    } else if (txt.endsWith("↓")) {
        button.textContent = txt.replace("↓", "↑");
    }
}
function showLeftSidebar(title) {
    closeSidebar()
    let leftSidebarTitle = document.getElementById("leftSidebarTitle");
    let leftSidebar = document.getElementById("leftSidebar");
    let sortButtonsContainer = document.getElementById("sortButtonsContainer");
    let formatDataButton = document.getElementById("formatData");

    leftSidebarTitle.textContent = title;
    leftSidebar.classList.add("left-sidebar-visible")

    if (title.includes("Search History")) {
        sortButtonsContainer.style.display = "none";
        formatDataButton.style.display = "block";
        formatDataButton.textContent = "Clear Search History";
        formatDataButton.setAttribute("data-action", "clear-history");
    } else if (title.includes("Saved Locations")) {
        sortButtonsContainer.style.display = "none";
        formatDataButton.style.display = "block";
        formatDataButton.textContent = "Clear Saved Locations";
        formatDataButton.setAttribute("data-action", "clear-saved");
    } else if (title.includes("Hospital near you") || title.includes("Lab near you") || title.includes("Pharmacy near you") || title.includes("Doctor near you")) {
        // Show our three sort buttons
        sortButtonsContainer.style.display = "flex";
        // Hide the formatData button for these particular views
        formatDataButton.style.display = "none";
    }
}
function closeLeftSidebar() {
    let leftSidebar = document.getElementById("leftSidebar");
    clearMarkers();
    leftSidebar.classList.remove("left-sidebar-visible");
}
function sortByName(ascending) {
    const locationType  = window.currentPlaceType;
    if (!locationType ) return;
    const cacheKey  = (locationType === "Pharmacy") ? "pharmacies" : locationType.toLowerCase() + "s";
    const list   = locationCache[cacheKey] || [];

    // Sort by the name field in loc.tags
    const sorted = [...list].sort((a, b) => {
        const nameA = a.tags?.name?.toLowerCase() || "";
        const nameB = b.tags?.name?.toLowerCase() || "";
        if (nameA < nameB) return ascending ? -1 : 1;
        if (nameA > nameB) return ascending ? 1 : -1;
        return 0;
    });

    // Now populate the left sidebar
    populateLeftSidebarFromCache(locationType , sorted);
    clearMarkers();
    plotCachedLocations(sorted, getIconForType(locationType), locationType);
}
function sortbyDistance(ascending) {
    const locationType  = window.currentPlaceType;
    if (!locationType ) return;
    const cacheKey  = (locationType  === "Pharmacy") ? "pharmacies" : locationType .toLowerCase() + "s";
    const list = locationCache[cacheKey ] || [];
    const enriched = list.map(loc => ({
        ...loc,
        distance: getDistance(
            userLocation[0], userLocation[1],
            loc.lat, loc.lon
        )
    }));
    enriched.sort((a, b) => {
        if (ascending) {
            return a.distance - b.distance;
        } else {
            return b.distance - a.distance;
        }
    });
    populateLeftSidebarFromCache(locationType , enriched);
    clearMarkers();
    plotCachedLocations(enriched, getIconForType(locationType), locationType);
}
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
function sortByOpeningHours(ascending) {
    const type = window.currentPlaceType;
    if (!type) return;
    const key = (type === "Pharmacy") ? "pharmacies" : type.toLowerCase() + "s";
    const list = locationCache[key] || [];

    const enriched = list.map(loc => {
        const openingHours = loc.tags?.opening_hours;
        const isOpen = isOpenNow(openingHours);
        // use status code for easy sorting: 0 open, 1 closed, 2 unknown
        let status = 2;
        if (openingHours) status = isOpen ? 0 : 1;
        return { ...loc, status, isOpen };
    });
    // If ascending, open sites come first, unknown last. If descending, reverse.
    enriched.sort((a, b) => {
        if (ascending) {
            return a.status - b.status;
        } else {
            return b.status - a.status;
        }
    });
    populateLeftSidebarFromCache(type, enriched);
    clearMarkers();
    plotCachedLocations(enriched, getIconForType(type), type);
}
function isOpenNow(openingHours) {
    if (!openingHours || !openingHours.includes("-")) return false;
    const [start, end] = openingHours.split("-").map(t => {
        const [h, m] = t.split(":").map(Number);
        return h * 60 + m; // convert to minutes
    });
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return currentMinutes >= start && currentMinutes <= end;
}