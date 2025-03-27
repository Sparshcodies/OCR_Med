// Initialize Map
let map = L.map('map').setView([20.5937, 78.9629], 5);
let userLocation = null;
let routeControl = null;
let markers = [];
let locationMarker = null;
let devicelocation = null;

// Custom Icons
const defaultIcon = L.icon({
    iconUrl: '/static/elements/penguin.svg',
    iconSize: [42, 100],
    iconAnchor: [20, 94],
    popupAnchor: [-11, -76],
});

const pharmacyIcon = L.icon({
    iconUrl: '/static/elements/Pharmacy.png',
    iconSize: [120, 120],
    iconAnchor: [30, 30],
    popupAnchor: [0, -50]
});

const labIcon = L.icon({
    iconUrl: '/static/elements/Patho_lab.png',
    iconSize: [120, 120],
    iconAnchor: [15, 30],
    popupAnchor: [0, -25]
});

const hospitalIcon = L.icon({
    iconUrl: '/static/elements/Hospital.png',
    iconSize: [120, 120],
    iconAnchor: [15, 30],
    popupAnchor: [0, -25]
});

// Add Map Tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Locate User Position
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(position => {
        userLocation = [position.coords.latitude, position.coords.longitude];
        devicelocation = userLocation;
        map.setView(userLocation, 13);
        L.marker(userLocation, { icon: defaultIcon }).addTo(map)
            .bindPopup("You are here!")
            .openPopup();
    }, error => console.warn("Geolocation error:", error.message));
} else {
    alert("Geolocation not supported.");
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
    });
}

function searchLocation(query) {
    if (!query.trim()) {
        alert("Please enter a location.");
        return;
    }

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}`)
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
    lat = parseFloat(lat);
    lon = parseFloat(lon);

    userLocation = [lat, lon]; // Update user location
    moveToLocation(lat, lon);

    if (locationMarker) {
        locationMarker.setLatLng([lat, lon]); // Move existing marker
    } else {
        locationMarker = L.marker([lat, lon], { draggable: true }).addTo(map);
        
        locationMarker.on("dragend", function (event) {
            const newPos = event.target.getLatLng();
            userLocation = [newPos.lat, newPos.lng]; // Update user location on drag
            console.log("📍 Marker moved to:", userLocation);
        });
    }
}

document.addEventListener("DOMContentLoaded", setupSearch);

// Added Now

document.getElementById("labBtn").addEventListener("click", function () {
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
document.getElementById("pharmacyBtn").addEventListener("click", function () {
    if (userLocation) {
        moveToLocation(userLocation[0], userLocation[1]);
        fetchPharmacies(userLocation[0], userLocation[1]);
    } else {
        alert("User location not available");
    }
});

document.getElementById("resetBtn").addEventListener("click", function () {
    clearMarkers();
    if (userLocation) {
        moveToLocation(devicelocation[0], devicelocation[1]);
    }
});

function moveToLocation(lat, lon) {
    if (map) {
        userLocation = [lat, lon];
        map.setView([lat, lon], 14);
    } else {
        console.error("❌ Map is not initialized!");
    }
}


function fetchLabs(lat, lon) {
    clearMarkers();
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
    const query = `
        [out:json];
        (
            node["amenity"="hospital"](around:5000,${lat},${lon});
            node["amenity"="doctors"](around:5000,${lat},${lon});
            node["amenity"="clinic"](around:5000,${lat},${lon});
            node["healthcare"="clinic"](around:5000,${lat},${lon});
            node["healthcare"="hospital"](around:5000,${lat},${lon});
            node["healthcare"="doctor"](around:5000,${lat},${lon});
            node["building"="hospital"](around:5000,${lat},${lon});
        );
        out;
    `;
    executeOverpassQuery(query, "Hospital");
}

function fetchPharmacies(lat, lon) {
    clearMarkers();
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
            if (!osmData.elements || osmData.elements.length === 0) {
                alert(`No ${placeType}s found nearby.`);
                return;
            }
            let customIcon;
            switch (placeType) {
                case "Lab":
                    customIcon = labIcon;
                    break;
                case "Hospital":
                    customIcon = hospitalIcon;
                    break;
                case "Pharmacy":
                    customIcon = pharmacyIcon;
                    break;
                default:
                    customIcon = defaultIcon;
            }

            osmData.elements.forEach(location => {
                let marker = L.marker([location.lat, location.lon], { icon: customIcon }).addTo(map)
                    .bindPopup(`<b>${location.tags.name || placeType}</b>`);
                markers.push(marker);
            });
        })
        .catch(err => console.error(`❌ ${placeType} fetch error:`, err));
}


function clearMarkers() {
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
}

function getDirections(destLat, destLon) {
    if (!userLocation) {
        alert("User location not found. Please enable location services.");
        return;
    }
    clearMarkers();
    let destinationMarker = L.marker([destLat, destLon], { icon: pharmacyIcon }).addTo(map)
        .bindPopup("<b>Destination</b>").openPopup();

    markers.push(destinationMarker);

    if (routeControl) {
        map.removeControl(routeControl);
    }

    routeControl = L.Routing.control({
        waypoints: [
            L.latLng(userLocation[0], userLocation[1]),
            L.latLng(destLat, destLon)
        ],
        routeWhileDragging: true,
        createMarker: function () { return null; }  // Remove default Leaflet Routing markers
    }).addTo(map);
}
