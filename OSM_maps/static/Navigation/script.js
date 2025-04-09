let map, userMarker, destinationMarker, routeGeoJSON, currentStepIndex = 0, routeSteps = [];

function getCoordsFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const srcLat = parseFloat(params.get("src_lat"));
  const srcLng = parseFloat(params.get("src_lng"));
  const destLat = parseFloat(params.get("dest_lat"));
  const destLng = parseFloat(params.get("dest_lng"));
  if (!srcLat || !srcLng || !destLat || !destLng) {
    alert("Invalid coordinates passed.");
    return null;
  }
  return {
    source: [srcLng, srcLat],
    destination: [destLng, destLat],
  };
}
const coords = getCoordsFromQuery();
if (!coords) throw new Error("Missing source/destination in URL");


navigator.geolocation.getCurrentPosition(
  position => {
    const userLocation = [position.coords.longitude, position.coords.latitude];
    initialize3DMap(userLocation, coords.destination);
  },
  error => {
    alert("Location access denied. Cannot initialize map.");
    console.error("Geolocation error:", error);
  },
  { enableHighAccuracy: true }
);

function initialize3DMap(userLocation, destination) {
  map = new maplibregl.Map({
    container: 'map',
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: userLocation,
    zoom: 17,
    pitch: 60,
    bearing: 45,
    cooperativeGestures: true
  });

  map.addControl(new maplibregl.NavigationControl({ showCompass: false }));

  new maplibregl.Marker({ color: 'blue' })
    .setLngLat(userLocation)
    .setPopup(new maplibregl.Popup().setText("You are here"))
    .addTo(map);

  new maplibregl.Marker({ color: 'red' })
    .setLngLat(destination)
    .setPopup(new maplibregl.Popup().setText("Destination"))
    .addTo(map);

  map.on('load', () => {
    getRoute(userLocation, destination);
  });

  navigator.geolocation.watchPosition(
    updateUserLocation,
    console.error,
    { enableHighAccuracy: true }
  );

  window.addEventListener("deviceorientation", rotateCompass);
}

function updateUserLocation(position) {
  const currentLocation = [position.coords.longitude, position.coords.latitude];
  if (userMarker) {
    userMarker.setLngLat(currentLocation);
  }
  // Check if user is close to next step
  if (routeSteps.length > 0 && currentStepIndex < routeSteps.length) {
    const nextStep = routeSteps[currentStepIndex];
    const dist = turf.distance(turf.point(currentLocation), turf.point(nextStep.location));
    if (dist < 0.05) { // ~50m
      currentStepIndex++;
      updateDirectionUI();
    }
  }
}

function updateDirectionUI() {
  const directionBox = document.getElementById("direction");
  if (currentStepIndex < routeSteps.length) {
    directionBox.innerText = routeSteps[currentStepIndex].text;
  } else {
    directionBox.innerText = "You have arrived!";
  }
}

function rotateCompass(event) {
  const alpha = event.alpha || 0;
  const compassIcon = document.getElementById("compass");
  compassIcon.style.transform = `rotate(${-alpha}deg)`;
}

function getRoute(from, to) {
  const url = `https://router.project-osrm.org/route/v1/driving/${from[0]},${from[1]};${to[0]},${to[1]}?overview=full&geometries=geojson&steps=true`;

  fetch(url)
    .then(res => res.json())
    .then(data => {
      if (!data.routes || data.routes.length === 0) {
        document.getElementById("direction").innerText = "No route found.";
        return;
      }

      const route = data.routes[0];

      if (!route.legs || route.legs.length === 0 || !route.legs[0].steps) {
        document.getElementById("direction").innerText = "No directions available.";
        return;
      }

      const coords = route.geometry.coordinates;

      // Add route line
      if (map.getSource('route')) {
        map.getSource('route').setData({ type: 'Feature', geometry: route.geometry });
      } else {
        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: route.geometry
          }
        });

        map.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#3887be',
            'line-width': 6,
            'line-opacity': 0.75
          }
        });
      }

      // Parse steps safely
      routeSteps = route.legs[0].steps.map(step => ({
        text: step?.maneuver?.instruction || "Continue",
        location: step?.maneuver?.location || coords[0] // fallback to first coord
      }));

      currentStepIndex = 0;
      updateDirectionUI();
    })
    .catch(err => {
      console.error("Routing error:", err);
      document.getElementById("direction").innerText = "Error fetching route.";
    });
}
