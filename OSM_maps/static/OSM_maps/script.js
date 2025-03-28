// Initialize Map
let map = L.map('map').setView([20.5937, 78.9629], 5);
let userLocation = null;
let routeControl = null;
let markers = [];
let locationMarker = null;
let devicelocation = null;

// Local Storage Cache
let locationCache = {
    hospitals: null,
    labs: null,
    pharmacies: null
};

// Custom Icons
const defaultIcon = L.icon({
    iconUrl: '/static/elements/penguin.svg',
    iconSize: [44, 100],
    iconAnchor: [22, 50],
    popupAnchor: [-11, -76],
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
        userLocation = devicelocation;
        moveToLocation(devicelocation[0], devicelocation[1]);
    }
    // Close any open sidebar
    if (typeof closeSidebar === "function") {
        closeSidebar();
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

            plotCachedLocations(osmData.elements, getIconForType(placeType), placeType);

            // let customIcon;
            // switch (placeType) {
            //     case "Lab":
            //         customIcon = labIcon;
            //         break;
            //     case "Hospital":
            //         customIcon = hospitalIcon;
            //         break;
            //     case "Pharmacy":
            //         customIcon = pharmacyIcon;
            //         break;
            //     default:
            //         customIcon = defaultIcon;
            // }

            // osmData.elements.forEach(location => {
            //     // console.log("Location Data:", location); // Debugging step
            //     let name = 'Made up name';
            //     let description = 'Hello';
            //     let marker = L.marker([location.lat, location.lon], { icon: customIcon }).addTo(map)
            //     .bindPopup(`
            //         <b>${location.tags.name || placeType}</b><br>
            //         <button type="button" onclick="showSidebar('${name}', '${description}', ${location.lat}, ${location.lon});">Show Details</button>
            //     `);
                
            //     markers.push(marker);
            // });
        })
        .catch(err => console.error(`❌ ${placeType} fetch error:`, err));
}

function plotCachedLocations(locations, icon, placeType) {
    locations.forEach(location => {
        let name = 'Made up name';
        let description = 'Hello';
        let marker = L.marker([location.lat, location.lon], { icon: icon }).addTo(map)
            .bindPopup(`
                <b>${location.tags.name || placeType}</b><br>
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
        default: return defaultIcon;
    }
}

function clearMarkers() {
    if (locationMarker) {
        map.removeLayer(locationMarker);
        locationMarker = null;
    }
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
        .bindPopup(`<b>Destination</b>`)
        .openPopup();

    markers.push(destinationMarker);

    if (routeControl) {
        map.removeControl(routeControl);
    }

    // Add Leaflet Routing Machine to calculate and display the route inside the map
    routeControl = L.Routing.control({
        waypoints: [
            L.latLng(userLocation[0], userLocation[1]),
            L.latLng(destLat, destLon)
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

    // Update Get Directions button to call getDirections
    let getDirectionBtn = document.getElementById("getDirection");
    getDirectionBtn.onclick = function() {
        getDirections(lat, lon);
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
        clearMarkers();
    }
    document.getElementById("route-info").innerHTML = ""; 
}


document.addEventListener("DOMContentLoaded", function () {
    let closeSidebarBtn = document.getElementById("closeSidebar");
    if (closeSidebarBtn) {
        closeSidebarBtn.onclick = closeSidebar;
    } else {
        console.error("Close Sidebar button not found!");
    }
});