// Initialize Map
let userLocation = null;
let routeControl = null;
let markers = [];
let locationMarker = null;
let devicelocation = null;
let sourceMarker = null;
let destinationMarker = null;
let debounceTimer;

let map = L.map('map',{
    minZoom: 5, 
    maxBounds: [
        [3.0, 65.0],  // Southwest corner (approximate)
        [40.0, 100.0]  // Northeast corner (approximate)
    ]}).setView([20.5937, 78.9629], 5);

// Local Storage Cache
let locationCache = {
    hospitals: null,
    labs: null,
    pharmacies: null,
    doctors: null
};

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

// Add Map Tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

initializeUserLocation();

document.addEventListener("DOMContentLoaded", setupSearch);

document.addEventListener("DOMContentLoaded", function () {
    let closeSidebarBtn = document.getElementById("closeSidebar");
    if (closeSidebarBtn) {
        closeSidebarBtn.onclick = closeSidebar;
    } else {
        console.error("Close Sidebar button not found!");
    }
});

document.getElementById("labBtn").addEventListener("click", function () {
    if (userLocation) {
        moveToLocation(userLocation[0], userLocation[1]);
        fetchLabs(userLocation[0], userLocation[1]);
    } else {
        alert("User location not available");
    }
});

document.getElementById("labBtn2").addEventListener("click", function () {
    if (userLocation) {
        moveToLocation(userLocation[0], userLocation[1]);
        fetchLabs(userLocation[0], userLocation[1]);
    } else {
        alert("User location not available");
    }
});

document.getElementById("hospitalBtn").addEventListener("click", function () {
    if (userLocation) {
        moveToLocation(userLocation[0], userLocation[1]);
        fetchHospitals(userLocation[0], userLocation[1]);
    } else {
        alert("User location not available");
    }
});

document.getElementById("hospitalBtn2").addEventListener("click", function () {
    if (userLocation) {
        moveToLocation(userLocation[0], userLocation[1]);
        fetchHospitals(userLocation[0], userLocation[1]);
    } else {
        alert("User location not available");
    }
});

document.getElementById("pharmacyBtn").addEventListener("click", function () {
    if (userLocation) {
        moveToLocation(userLocation[0], userLocation[1]);
        fetchPharmacies(userLocation[0], userLocation[1]);
    } else {
        alert("User location not available");
    }
});

document.getElementById("pharmacyBtn2").addEventListener("click", function () {
    if (userLocation) {
        moveToLocation(userLocation[0], userLocation[1]);
        fetchPharmacies(userLocation[0], userLocation[1]);
    } else {
        alert("User location not available");
    }
});

document.getElementById("doctorBtn").addEventListener("click", function () {
    if (userLocation) {
        moveToLocation(userLocation[0], userLocation[1]);
        fetchDoctors(userLocation[0], userLocation[1]);
    } else {
        alert("User location not available");
    }
});

document.getElementById("doctorBtn2").addEventListener("click", function () {
    if (userLocation) {
        moveToLocation(userLocation[0], userLocation[1]);
        fetchDoctors(userLocation[0], userLocation[1]);
    } else {
        alert("User location not available");
    }
});

document.getElementById("resetBtn").addEventListener("click", function () {
    clearMarkers();
    initializeUserLocation();
    // Close any open sidebar
    if (typeof closeSidebar === "function") {
        closeSidebar();
    }
});

// Initialize both autocompletes
document.addEventListener("DOMContentLoaded", function () {
    setupLocationAutocomplete("sourceLocation", "sourceAutocompleteList", true);
    setupLocationAutocomplete("destinationLocation", "destinationAutocompleteList", false);
});


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
        if (event.key === "Enter") searchLocation(input.value);
        autocompleteList.style.display = "none";
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
                                placeMarkerAndMove(this.dataset.lat, this.dataset.lon);
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
        }, 300); // 300ms delay before fetching
    });
}

function searchLocation(query) {
    if (!query.trim()) {
        alert("Please enter a location.");
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


function fetchLabs(lat, lon) {
    clearMarkers();
    if (locationCache.labs) {
        console.log("Using cached lab data 🗄️");
        plotCachedLocations(locationCache.labs, labIcon, "Lab");
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
    executeOverpassQuery(query, "Lab");
}

function fetchHospitals(lat, lon) {
    clearMarkers();
    if (locationCache.hospitals) {
        console.log("Using cached hospital data 🗄️");
        plotCachedLocations(locationCache.hospitals, hospitalIcon, "Hospital");
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
    executeOverpassQuery(query, "Hospital");
}

function fetchDoctors(lat, lon) {
    clearMarkers();
    if (locationCache.doctors) {
        console.log("Using cached doctor data 🗄️");
        plotCachedLocations(locationCache.hospitals, hospitalIcon, "Hospital");
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
    executeOverpassQuery(query, "Doctors");
}

function fetchPharmacies(lat, lon) {
    clearMarkers();
    if (locationCache.pharmacies) {
        console.log("Using cached pharmacy data 🗄️");
        plotCachedLocations(locationCache.pharmacies, pharmacyIcon, "Pharmacy");
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
    executeOverpassQuery(query, "Pharmacy");
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

            plotCachedLocations(osmData.elements, getIconForType(placeType), placeType);
        })
        .catch(err => console.error(`❌ ${placeType} fetch error:`, err));
}

function plotCachedLocations(locations, icon, placeType) {
    locations.forEach(location => {
        let name = location.tags.name || placeType;
        let description = `Lat: ${location.lat}, Lon: ${location.lon}`;
        let marker = L.marker([location.lat, location.lon], { icon: icon }).addTo(map)
            .bindPopup(`
                <b>${name}</b><br>
                <button type="button" onclick="showSidebar('${name}', '${description}', ${location.lat}, ${location.lon});">Show Details</button>
            `);
        markers.push(marker);
    });
}

function getIconForType(placeType) {
    switch (placeType) {
        case "Lab": return labIcon;
        case "Hospital": return hospitalIcon;
        case "Pharmacy": return pharmacyIcon;
        case "Doctors": return hospitalIcon; // Use hospital icon for doctors
        default: return defaultIcon;
    }
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
    document.getElementById("route-info").innerHTML = ""; 
}


function setupLocationAutocomplete(inputId, autocompleteListId, isSource) {
    const input = document.getElementById(inputId);
    const autocompleteList = document.getElementById(autocompleteListId);

    input.addEventListener("input", function () {
        const query = input.value.trim();
        if (query.length < 2) {
            autocompleteList.style.display = "none";
            return;
        }

        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}`)
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

function clearLocationCache() {
    locationCache.hospitals = null;
    locationCache.labs = null;
    locationCache.pharmacies = null;
    locationCache.doctors = null;
}
