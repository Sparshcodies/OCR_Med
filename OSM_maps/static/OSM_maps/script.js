// Initialize Map
let userLocation = null;
let routeControl = null;
let markers = [];
let locationMarker = null;
let devicelocation = null;
let sourceMarker = null;
let destinationMarker = null;
let debounceTimer;
window.currentPlaceType = null; // Store the current place type

// Local Storage Cache
let locationCache = {
    hospitals: null,
    labs: null,
    pharmacies: null,
    doctors: null
};
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
        case "Doctors": return hospitalIcon; // Use hospital icon for doctors
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
// Add Map Tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Initialize User Location
initializeUserLocation();
function initializeUserLocation() {
    // Get user's current location using geolocation API
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

    // Pressing "Enter" triggers search
    input.addEventListener("keyup", function (event) {
        if (event.key === "Enter") {
            searchLocation(input.value);
            autocompleteList.style.display = "none";
        }
    });

    // Clicking the search button triggers search
    searchBtn.addEventListener("click", function () {
        searchLocation(input.value);
        autocompleteList.style.display = "none";
    });

    // Autocomplete logic
    input.addEventListener("input", function () {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const query = input.value.trim().toLowerCase();
            autocompleteList.innerHTML = ""; // Clear previous results

            if (query.length < 2) {
                autocompleteList.style.display = "none";
                return;
            }

            let matchedLocations = new Set(); // Use Set to avoid duplicates

            // Fetch from cache first
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

            // If cache had results, show them first
            if (matchedLocations.size > 0) {
                autocompleteList.style.display = "block";
            }

            // Fetch from Nominatim and add results **without erasing previous ones**
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

// Fetch and display saved locations
document.getElementById("savedBtn").addEventListener("click", function() {
    showLeftSidebar("Your Saved Locations");
    showSavedLocations();
});
function showSavedLocations() {
    fetch('/get_saved_locations/')
    .then(response => response.json())
    .then(data => {
        let listContainer = document.getElementById("leftSidebarList");
        listContainer.innerHTML = "";  // Clear previous list
        // Show message if no saved locations exist
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
document.getElementById("recentSearchesBtn").addEventListener("click", function() {
    showLeftSidebar("Your Search History");
    showSearchHistory();
});
function showSearchHistory() {
    fetch('/get_recent_searches/')
    .then(response => response.json())
    .then(data => {
        console.log("Recent searches data:", data); // Debug: log the response
        let listContainer = document.getElementById("leftSidebarList");
        listContainer.innerHTML = ""; // Clear previous list

        // Check if the key exists as expected
        let searches = data.search_history || data.recent_searches; // Try both keys

        // Show message if no search history exists
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
document.getElementById("labBtn").addEventListener("click", function () {
    window.currentPlaceType = "Lab";
    if (userLocation) {
        moveToLocation(userLocation[0], userLocation[1]);
        fetchLabs(userLocation[0], userLocation[1]);
    } else {
        alert("User location not available");
    }
});
document.getElementById("labBtn2").addEventListener("click", function () {
    window.currentPlaceType = "Lab";
    if (userLocation) {
        moveToLocation(userLocation[0], userLocation[1]);
        fetchLabs(userLocation[0], userLocation[1]);
    } else {
        alert("User location not available");
    }
});
document.getElementById("hospitalBtn").addEventListener("click", function () {
    window.currentPlaceType = "Hospital";
    if (userLocation) {
        moveToLocation(userLocation[0], userLocation[1]);
        fetchHospitals(userLocation[0], userLocation[1]);
    } else {
        alert("User location not available");
    }
});
document.getElementById("hospitalBtn2").addEventListener("click", function () {
    window.currentPlaceType = "Hospital";
    if (userLocation) {
        moveToLocation(userLocation[0], userLocation[1]);
        fetchHospitals(userLocation[0], userLocation[1]);
    } else {
        alert("User location not available");
    }
});
document.getElementById("pharmacyBtn").addEventListener("click", function () {
    window.currentPlaceType = "Pharmacy";
    if (userLocation) {
        moveToLocation(userLocation[0], userLocation[1]);
        fetchPharmacies(userLocation[0], userLocation[1]);
    } else {
        alert("User location not available");
    }
});
document.getElementById("pharmacyBtn2").addEventListener("click", function () {
    window.currentPlaceType = "Pharmacy";
    if (userLocation) {
        moveToLocation(userLocation[0], userLocation[1]);
        fetchPharmacies(userLocation[0], userLocation[1]);
    } else {
        alert("User location not available");
    }
});
document.getElementById("doctorBtn").addEventListener("click", function () {
    window.currentPlaceType = "Doctor"
    if (userLocation) {
        moveToLocation(userLocation[0], userLocation[1]);
        fetchDoctors(userLocation[0], userLocation[1]);
    } else {
        alert("User location not available");
    }
});
document.getElementById("doctorBtn2").addEventListener("click", function () {
    window.currentPlaceType = "Doctor"
    if (userLocation) {
        moveToLocation(userLocation[0], userLocation[1]);
        fetchDoctors(userLocation[0], userLocation[1]);
    } else {
        alert("User location not available");
    }
});
function fetchLabs(lat, lon) {
    clearMarkers();

    if (locationCache.labs) {
        console.log("Using cached lab data 🗄️");
        plotCachedLocations(locationCache.labs, getIconForType("Lab"), "Lab");
        populateLeftSidebarFromCache("Lab");
        return;
    }

    const query = `
        [out:json];
        (
            node["amenity"="laboratory"](around:5000,${lat},${lon});
            node["amenity"="medical_laboratory"](around:5000,${lat},${lon});
            node["healthcare"="laboratory"](around:5000,${lat},${lon});
            node["healthcare"="sample_collection"](around:5000,${lat},${lon});
            node["healthcare_speciality"="blood_check"](around:5000,${lat},${lon});
            node["healthcare_speciality"="clinical_pathology"](around:5000,${lat},${lon});
            node["healthcare_speciality"="pathology"](around:5000,${lat},${lon});
        );
        out;
    `;
    executeOverpassQuery(query, "Lab"),
    executeDBQuery("Lab", lat, lon)

    if (locationCache.labs) {
        plotCachedLocations(locationCache.labs, getIconForType("Lab"), "Lab");
        populateLeftSidebarFromCache("Lab");
    } else {
        console.warn("No labs found in cache after queries.");
    }
}
function fetchHospitals(lat, lon) {
    clearMarkers();

    if (locationCache.hospitals) {
        console.log("Using cached hospital data 🗄️");
        plotCachedLocations(locationCache.hospitals, getIconForType("Hospital"), "Hospital");
        populateLeftSidebarFromCache("Hospital");
        return;
    }

    const query = `
        [out:json];
        (
            node["amenity"="hospital"](around:5000,${lat},${lon});
            node["healthcare"="hospital"](around:5000,${lat},${lon});
            node["building"="hospital"](around:5000,${lat},${lon});
        );
        out;
    `;

    executeOverpassQuery(query, "Hospital"),
    executeDBQuery("Hospital", lat, lon)


    if (locationCache.hospitals) {
        plotCachedLocations(locationCache.hospitals, getIconForType("Hospital"), "Hospital");
        populateLeftSidebarFromCache("Hospital");
    } else {
        console.warn("No hospitals found in cache after queries.");
    }
}
function fetchDoctors(lat, lon) {
    clearMarkers();

    if (locationCache.doctors) {
        console.log("Using cached doctor data 🗄️");
        plotCachedLocations(locationCache.doctors, getIconForType("Doctors"), "Doctor");
        populateLeftSidebarFromCache("Doctor");
        return;
    }

    const query = `
        [out:json];
        (
            node["amenity"="doctors"](around:5000,${lat},${lon});
            node["amenity"="clinic"](around:5000,${lat},${lon});
            node["healthcare"="clinic"](around:5000,${lat},${lon});
            node["healthcare"="doctor"](around:5000,${lat},${lon});
        );
        out;
    `;

    executeOverpassQuery(query, "Doctors"),
    executeDBQuery("Doctors", lat, lon)

    if (locationCache.doctors) {
        plotCachedLocations(locationCache.doctors, getIconForType("Doctors"), "Doctor");
        populateLeftSidebarFromCache("Doctor");
    } else {
        console.warn("No doctors found in cache after queries.");
    }
}
function fetchPharmacies(lat, lon) {
    clearMarkers();

    if (locationCache.pharmacies) {
        console.log("Using cached pharmacy data 🗄️");
        plotCachedLocations(locationCache.pharmacies, getIconForType("Pharmacy"), "Pharmacy");
        populateLeftSidebarFromCache("Pharmacy");
        return;
    }

    const query = `
        [out:json];
        (
            node["amenity"="pharmacy"](around:5000,${lat},${lon});
            node["healthcare"="pharmacy"](around:5000,${lat},${lon});
            node["pharmacy"="yes"](around:5000,${lat},${lon});
            node["shop"="chemist"](around:5000,${lat},${lon});
            node["shop"="medical_supply"](around:5000,${lat},${lon});
            node["office"="medical"](around:5000,${lat},${lon});
        );
        out;
    `;

    executeOverpassQuery(query, "Pharmacy"),
    executeDBQuery("Pharmacy", lat, lon)


    if (locationCache.pharmacies) {
        plotCachedLocations(locationCache.pharmacies, getIconForType("Pharmacy"), "Pharmacy");
        populateLeftSidebarFromCache("Pharmacy");
    } else {
        console.warn("No pharmacies found in cache after queries.");
    }
}
function executeOverpassQuery(query, placeType) {
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    fetch(url)
        .then(response => response.json())
        .then(osmData => {
            // console.log("Overpass API Response:", osmData); // Debugging step
            if (!osmData.elements || osmData.elements.length === 0) {
                alert(`No ${placeType}s found nearby.`);
                return;
            }
            // Store in cache based on placeType
            if (placeType === "Hospital") locationCache.hospitals = osmData.elements;
            else if (placeType === "Lab") locationCache.labs = osmData.elements;
            else if (placeType === "Pharmacy") locationCache.pharmacies = osmData.elements;
            else if (placeType === "Doctors") locationCache.doctors = osmData.elements;

            // plotCachedLocations(osmData.elements, getIconForType(placeType), placeType);
        })
        .catch(err => console.error(`❌ ${placeType} fetch error:`, err));
}
function executeDBQuery(locationType, lat, lon) {
    let endpoint = "";
    // Choose the correct endpoint based on the locationType.
    switch (locationType) {
        case "Pharmacy":
            endpoint = "/api/pharmacies/";
            break;
        case "Hospital":
            endpoint = "/api/hospitals/";
            break;
        case "Doctors":
            endpoint = "/api/doctors/";
            break;
        case "Lab":
            endpoint = "/api/labs/";
            break;
        default:
            console.error("Unknown location type:", locationType);
            return;
    }

    fetch(`${endpoint}?lat=${lat}&lon=${lon}`)
        .then(response => response.json())
        .then(data => {
            let key = locationType.toLowerCase() + "s";
            let items = data[key] || [];
            // Normalize to match Overpass format
            let formattedItems = items.map(item => ({
                lat: item.lat,
                lon: item.lon,
                tags: { name: item.name },
                address: item.address
            }));
            // **Save to cache**
            if (!locationCache[key]) {
                locationCache[key] = formattedItems;
            } else {
                locationCache[key] = [...locationCache[key], ...formattedItems]; // Merge new results
            }
            // The response key is the lower-case plural of the model name.
            if (data[key] && data[key].length > 0) {
                console.log(`DB ${locationType} data:`, data[key]);
                // Plot these DB markers using your generic plotting function.
                // plotCachedLocations(data[key], getIconForType(locationType), locationType);
            } else {
                console.log(`No DB ${locationType} results found.`);
            }
        })
        .catch(err => console.error(`Error fetching ${locationType} from DB:`, err));
}
document.getElementById("resetBtn").addEventListener("click", function () {
    clearMarkers();
    initializeUserLocation();
    // Close any open sidebar
    if (typeof closeSidebar === "function") {
        closeSidebar();
    }
});

// Place marker and move the map
function placeMarkerAndMove(lat, lon) {
    clearLocationCache();
    lat = parseFloat(lat);
    lon = parseFloat(lon);
    userLocation = [lat, lon];

    // Update (or create) the source marker to reflect the searched location
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

    // Update (or create) the destination marker as before
    if (!destinationMarker) {
        destinationMarker = L.marker([lat, lon], { draggable: false }).addTo(map)
            .bindPopup("Destination").openPopup();
    } else {
        destinationMarker.setLatLng([lat, lon]);
    }

    // Update the destination input box
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
        // Use location.tags.name if available; otherwise use location.name
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

    // Add Leaflet Routing Machine to calculate and display the route inside the map
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

    // Capture route instructions and show them in the sidebar
    routeControl.on('routesfound', function (e) {
        let routes = e.routes[0].instructions.map(inst => `<li>${inst.text}</li>`).join('');
        document.getElementById("route-info").innerHTML = `<ul>${routes}</ul>`;
    });
}

// Initialize both autocompletes
document.getElementById("saveLocationBtn").addEventListener("click", saveLocation);
document.addEventListener("DOMContentLoaded", function () {
    setupSourceLocationAutocomplete("sourceLocation", "sourceAutocompleteList", true);
    setupDestinationAutocomplete("destinationLocation", "destinationAutocompleteList");
});
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
            case "Lab":
                markersList = locationCache.labs || [];
                break;
            case "Hospital":
                markersList = locationCache.hospitals || [];
                break;
            case "Pharmacy":
                markersList = locationCache.pharmacies || [];
                break;
            case "Doctor":
                markersList = locationCache.doctors || [];
                break;
            default:
                markersList = [];
        }

        autocompleteList.innerHTML = "";
        if (markersList.length === 0) {
            autocompleteList.style.display = "none";
            return;
        }

        // Filter markers based on query (if any)
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
document.addEventListener("DOMContentLoaded", function () {
    let closeSidebarBtn = document.getElementById("closeSidebar");
    closeSidebarBtn.onclick = closeSidebar;
});
document.addEventListener("DOMContentLoaded", function() {
    document.getElementById("closeLeftSidebar").addEventListener("click", closeLeftSidebar);
});
// Function to Show Sidebar
function showSidebar(name, description, lat, lon) {
    let sidebar = document.getElementById("sidebar");
    if (!sidebar) {
        console.error("Sidebar element not found!");
        return;
    }
    
    document.getElementById("marker-title").innerText = name;
    document.getElementById("marker-info").innerText = description;
    document.getElementById("route-info").innerHTML = "";
    document.getElementById("destinationLocation").value = name;
    // Set the destination marker to the selected marker location (default)
    if (!destinationMarker) {
        destinationMarker = L.marker([lat, lon], { draggable: false }).addTo(map);
    } else {
        destinationMarker.setLatLng([lat, lon]);
    }

    // Set the source marker to the user location by default if not set
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

    // Update Get Directions button to call getDirections
    let getDirectionBtn = document.getElementById("getDirection");
    getDirectionBtn.onclick = function() {
        if (!sourceMarker || !destinationMarker) {
            alert("Please select both a source and a destination.");
            return;
        }
        getDirections(destinationMarker.getLatLng().lat, destinationMarker.getLatLng().lng);
    };

    // Show sidebar
    sidebar.classList.add("sidebar-visible");

    // Save this search history record to the DB
    saveSearchHistory(name, description, lat, lon);
}
// Function to Close Sidebar
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
    if (sourceMarker && map.hasLayer(sourceMarker)) {
        map.removeLayer(sourceMarker);
        sourceMarker = null;
    }
    clearMarkers();
    initializeUserLocation();
    document.getElementById("route-info").innerHTML = ""; 
}
function showLeftSidebar(title) {
    document.getElementById("leftSidebarTitle").textContent = title;
    document.getElementById("leftSidebar").classList.add("left-sidebar-visible");

    let formatDataButton = document.getElementById("formatData");

    if (title.includes("Search History")) {
        formatDataButton.textContent = "Clear Search History";
        formatDataButton.setAttribute("data-action", "clear-history");
    } else if (title.includes("Saved Locations")) {
        formatDataButton.textContent = "Clear Saved Locations";
        formatDataButton.setAttribute("data-action", "clear-saved");
    }
}
function closeLeftSidebar() {
    let leftSidebar = document.getElementById("leftSidebar");

    // Hide left sidebar
    leftSidebar.classList.remove("left-sidebar-visible");
}
// Function to get CSRF token from cookies (required for Django POST requests)
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
function populateLeftSidebarFromCache(locationType) {
    // Determine the cache key from the location type.
    let cacheKey = "";
    switch(locationType) {
        case "Pharmacy":
            cacheKey = "pharmacies";
            break;
            case "Hospital":
                cacheKey = "hospitals";
                break;
                case "Lab":
                    cacheKey = "labs";
                    break;
                    case "Doctor":
                        cacheKey = "doctors";
                        break;
                        default:
                            console.error("Unknown location type:", locationType);
                            return;
                        }
                        
                        // Set the sidebar title.
                        let sidebarTitle = document.getElementById("leftSidebarTitle");
                        sidebarTitle.textContent = locationType + " near you";
                        
                        // Clear and populate the sidebar list.
                        let sidebarList = document.getElementById("leftSidebarList");
                        sidebarList.innerHTML = "";
                        let results = locationCache[cacheKey];
                        if (!results || results.length === 0) {
                            sidebarList.innerHTML = `<p style="padding:10px;">No ${locationType} found near you.</p>`;
                        } else {
                            results.forEach(result => {
                                let name = (result.tags && result.tags.name) ? result.tags.name : (result.name || locationType);
                                let item = document.createElement("div");
                                item.textContent = name;
                                item.style.cursor = "pointer";
                                item.addEventListener("click", function() {
                                    closeLeftSidebar();
                                    let address = result.address ? result.address : `Lat: ${result.lat}, Lon: ${result.lon}`;
                                    showSidebar(name, address, result.lat, result.lon);
                                });
                                sidebarList.appendChild(item);
                            });
                        }
                        
                        // Show the left sidebar (it should overlay the navRibbon due to its high z-index).
                        document.getElementById("leftSidebar").classList.add("left-sidebar-visible");
}
document.getElementById("formatData").addEventListener("click", function() {
    let action = this.getAttribute("data-action");

    if (action === "clear-history") {
        clearSearchHistory();
    } else if (action === "clear-saved") {
        clearSavedLocations();
    }
});
