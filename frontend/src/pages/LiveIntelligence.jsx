import React, { useEffect, useRef, useState } from 'react';
import {
  MapPin,
  Navigation,
  Loader2,
  Zap,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Volume2,
  VolumeX,
  Route,
  Clock,
  LocateFixed,
  X,
} from 'lucide-react';

import ChargingMap from '../components/ChargingMap';

const LiveIntelligence = () => {
  // ------------------------------------------------------------
  // LOCATION / STATION STATE
  // ------------------------------------------------------------

  const [locationStatus, setLocationStatus] = useState('');
  const [coordinates, setCoordinates] = useState(null);

  const [stations, setStations] = useState([]);
  const [analysis, setAnalysis] = useState(null);

  const [loadingStations, setLoadingStations] = useState(false);
  const [error, setError] = useState('');

  // ------------------------------------------------------------
  // NAVIGATION STATE
  // ------------------------------------------------------------

  const [selectedStation, setSelectedStation] = useState(null);
  const [route, setRoute] = useState(null);

  const [navigationActive, setNavigationActive] = useState(false);

  const [nextInstruction, setNextInstruction] = useState('');
  const [nextInstructionDistance, setNextInstructionDistance] =
    useState(null);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const [remainingDistance, setRemainingDistance] = useState(0);
  const [remainingDuration, setRemainingDuration] = useState(0);

  const [voiceEnabled, setVoiceEnabled] = useState(true);

  const [rerouting, setRerouting] = useState(false);

  // ------------------------------------------------------------
  // REFS
  // ------------------------------------------------------------

  const watchIdRef = useRef(null);

  const routeRef = useRef(null);

  const selectedStationRef = useRef(null);

  const currentStepIndexRef = useRef(0);

  const lastSpokenStepRef = useRef(-1);

  const lastRerouteTimeRef = useRef(0);

  const reroutingRef = useRef(false);

  const voiceEnabledRef = useRef(true);

  // ------------------------------------------------------------
  // KEEP REFS UPDATED
  // ------------------------------------------------------------

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);

  useEffect(() => {
    routeRef.current = route;
  }, [route]);

  useEffect(() => {
    selectedStationRef.current = selectedStation;
  }, [selectedStation]);

  // ------------------------------------------------------------
  // HELPERS
  // ------------------------------------------------------------

  const toRadians = (value) => {
    return (value * Math.PI) / 180;
  };

  const distanceBetweenPoints = (
    latitude1,
    longitude1,
    latitude2,
    longitude2
  ) => {
    const earthRadius = 6371000;

    const lat1 = toRadians(latitude1);
    const lat2 = toRadians(latitude2);

    const deltaLat = toRadians(latitude2 - latitude1);
    const deltaLon = toRadians(longitude2 - longitude1);

    const a =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(deltaLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadius * c;
  };

  const formatDistance = (meters) => {
    if (!Number.isFinite(meters)) {
      return '--';
    }

    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }

    return `${(meters / 1000).toFixed(1)} km`;
  };

  const formatDuration = (seconds) => {
    if (!Number.isFinite(seconds)) {
      return '--';
    }

    const minutes = Math.round(seconds / 60);

    if (minutes < 1) {
      return '< 1 min';
    }

    if (minutes < 60) {
      return `${minutes} min`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (remainingMinutes === 0) {
      return `${hours} hr`;
    }

    return `${hours} hr ${remainingMinutes} min`;
  };

  // ------------------------------------------------------------
  // GET STEP INSTRUCTION
  // ------------------------------------------------------------

  const getStepInstruction = (step) => {
    if (!step) {
      return 'Continue following the route';
    }

    const maneuver = step.maneuver || {};
    const type = maneuver.type || '';
    const modifier = maneuver.modifier || '';
    const name = step.name || '';

    if (type === 'depart') {
      return name
        ? `Start on ${name}`
        : 'Start your journey';
    }

    if (type === 'arrive') {
      return 'You have arrived at the charging station';
    }

    if (type === 'roundabout') {
      if (maneuver.exit) {
        return `Take exit ${maneuver.exit} at the roundabout${
          name ? ` onto ${name}` : ''
        }`;
      }

      return `Enter the roundabout${name ? ` onto ${name}` : ''}`;
    }

    if (type === 'merge') {
      return `Merge${
        modifier ? ` ${modifier}` : ''
      }${name ? ` onto ${name}` : ''}`;
    }

    if (type === 'fork') {
      return `Keep ${modifier || 'straight'}${
        name ? ` onto ${name}` : ''
      }`;
    }

    if (type === 'new name') {
      return name
        ? `Continue onto ${name}`
        : 'Continue straight';
    }

    if (type === 'continue') {
      return name
        ? `Continue onto ${name}`
        : 'Continue straight';
    }

    if (type === 'turn') {
      if (modifier === 'left') {
        return name
          ? `Turn left onto ${name}`
          : 'Turn left';
      }

      if (modifier === 'right') {
        return name
          ? `Turn right onto ${name}`
          : 'Turn right';
      }

      if (modifier === 'slight left') {
        return name
          ? `Slight left onto ${name}`
          : 'Bear slightly left';
      }

      if (modifier === 'slight right') {
        return name
          ? `Slight right onto ${name}`
          : 'Bear slightly right';
      }

      if (modifier === 'sharp left') {
        return name
          ? `Sharp left onto ${name}`
          : 'Make a sharp left';
      }

      if (modifier === 'sharp right') {
        return name
          ? `Sharp right onto ${name}`
          : 'Make a sharp right';
      }

      if (modifier === 'uturn') {
        return 'Make a U-turn';
      }

      return name
        ? `Turn onto ${name}`
        : 'Turn';
    }

    if (type === 'end of road') {
      if (modifier === 'left') {
        return name
          ? `At the end of the road, turn left onto ${name}`
          : 'At the end of the road, turn left';
      }

      if (modifier === 'right') {
        return name
          ? `At the end of the road, turn right onto ${name}`
          : 'At the end of the road, turn right';
      }

      return name
        ? `At the end of the road, continue onto ${name}`
        : 'At the end of the road, continue';
    }

    return name
      ? `Continue onto ${name}`
      : 'Continue following the route';
  };

  // ------------------------------------------------------------
  // SPEAK
  // ------------------------------------------------------------

  const speak = (message) => {
    if (
      !voiceEnabledRef.current ||
      typeof window === 'undefined' ||
      !window.speechSynthesis
    ) {
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(message);

    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    window.speechSynthesis.speak(utterance);
  };

  // ------------------------------------------------------------
  // DISTANCE TO ROUTE
  // ------------------------------------------------------------

  const distanceToRoute = (latitude, longitude, routeGeometry) => {
    if (
      !routeGeometry ||
      !Array.isArray(routeGeometry.coordinates) ||
      routeGeometry.coordinates.length === 0
    ) {
      return Infinity;
    }

    let minimumDistance = Infinity;

    routeGeometry.coordinates.forEach((point) => {
      const routeLongitude = point[0];
      const routeLatitude = point[1];

      const distance = distanceBetweenPoints(
        latitude,
        longitude,
        routeLatitude,
        routeLongitude
      );

      if (distance < minimumDistance) {
        minimumDistance = distance;
      }
    });

    return minimumDistance;
  };

  // ------------------------------------------------------------
  // UPDATE CURRENT INSTRUCTION
  // ------------------------------------------------------------

  const updateNextInstruction = (currentCoordinates) => {
    const activeRoute = routeRef.current;

    if (
      !activeRoute ||
      !activeRoute.legs ||
      !activeRoute.legs[0] ||
      !Array.isArray(activeRoute.legs[0].steps)
    ) {
      return;
    }

    const steps = activeRoute.legs[0].steps;

    let stepIndex = currentStepIndexRef.current;

    if (stepIndex >= steps.length) {
      return;
    }

    // Skip the initial departure instruction after navigation starts.
    if (
      steps[stepIndex]?.maneuver?.type === 'depart' &&
      steps.length > 1
    ) {
      stepIndex += 1;
      currentStepIndexRef.current = stepIndex;
      setCurrentStepIndex(stepIndex);
    }

    if (stepIndex >= steps.length) {
      return;
    }

    const step = steps[stepIndex];

    const maneuverLocation = step.maneuver?.location;

    if (
      !maneuverLocation ||
      maneuverLocation.length < 2
    ) {
      return;
    }

    const maneuverLongitude = maneuverLocation[0];
    const maneuverLatitude = maneuverLocation[1];

    const distanceToManeuver = distanceBetweenPoints(
      currentCoordinates.latitude,
      currentCoordinates.longitude,
      maneuverLatitude,
      maneuverLongitude
    );

    setNextInstruction(getStepInstruction(step));
    setNextInstructionDistance(distanceToManeuver);

    // Speak when the maneuver is approaching.
    if (
      distanceToManeuver <= 100 &&
      lastSpokenStepRef.current !== stepIndex
    ) {
      speak(
        `${getStepInstruction(step)} in ${formatDistance(
          distanceToManeuver
        )}`
      );

      lastSpokenStepRef.current = stepIndex;
    }

    // Once we get very close to the maneuver, move to the next step.
    if (
      distanceToManeuver <= 25 &&
      stepIndex < steps.length - 1
    ) {
      currentStepIndexRef.current = stepIndex + 1;

      setCurrentStepIndex(stepIndex + 1);

      const nextStep = steps[stepIndex + 1];

      if (nextStep) {
        setNextInstruction(
          getStepInstruction(nextStep)
        );

        setNextInstructionDistance(
          Number(nextStep.distance) || 0
        );
      }
    }
  };

  // ------------------------------------------------------------
  // FETCH ROUTE
  // ------------------------------------------------------------

  const fetchRoute = async (
    startCoordinates,
    destinationCoordinates
  ) => {
    const start = `${startCoordinates.longitude},${startCoordinates.latitude}`;

    const destination = `${destinationCoordinates.longitude},${destinationCoordinates.latitude}`;

    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${start};${destination}` +
      `?overview=full&geometries=geojson&steps=true`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Routing request failed: ${response.status}`
      );
    }

    const data = await response.json();

    if (
      data.code !== 'Ok' ||
      !data.routes ||
      data.routes.length === 0
    ) {
      throw new Error(
        'No driving route was found.'
      );
    }

    const newRoute = data.routes[0];

    setRoute(newRoute);
    routeRef.current = newRoute;

    setRemainingDistance(
      Number(newRoute.distance) || 0
    );

    setRemainingDuration(
      Number(newRoute.duration) || 0
    );

    currentStepIndexRef.current = 0;
    lastSpokenStepRef.current = -1;

    setCurrentStepIndex(0);

    const firstUsefulStep =
      newRoute.legs?.[0]?.steps?.find(
        (step) =>
          step.maneuver?.type !== 'depart'
      ) ||
      newRoute.legs?.[0]?.steps?.[0];

    if (firstUsefulStep) {
      setNextInstruction(
        getStepInstruction(firstUsefulStep)
      );

      setNextInstructionDistance(
        Number(firstUsefulStep.distance) || 0
      );
    }

    return newRoute;
  };

  // ------------------------------------------------------------
  // STOP NAVIGATION
  // ------------------------------------------------------------

  const stopNavigation = (announce = true) => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(
        watchIdRef.current
      );

      watchIdRef.current = null;
    }

    setNavigationActive(false);

    routeRef.current = null;

    setRoute(null);

    setSelectedStation(null);

    setNextInstruction('');

    setNextInstructionDistance(null);

    setRemainingDistance(0);

    setRemainingDuration(0);

    setCurrentStepIndex(0);

    currentStepIndexRef.current = 0;

    lastSpokenStepRef.current = -1;

    if (
      typeof window !== 'undefined' &&
      window.speechSynthesis
    ) {
      window.speechSynthesis.cancel();
    }

    if (announce) {
      speak('Navigation ended.');
    }
  };

  // ------------------------------------------------------------
  // START NAVIGATION
  // ------------------------------------------------------------

  const startNavigation = async (station) => {
    if (!coordinates) {
      setError(
        'Please use your location before starting navigation.'
      );

      return;
    }

    const address = station?.AddressInfo;

    if (
      !address ||
      !Number.isFinite(Number(address.Latitude)) ||
      !Number.isFinite(Number(address.Longitude))
    ) {
      setError(
        'This charging station does not have valid coordinates.'
      );

      return;
    }

    const destinationCoordinates = {
      latitude: Number(address.Latitude),
      longitude: Number(address.Longitude),
    };

    try {
      setError('');

      setSelectedStation(station);

      selectedStationRef.current = station;

      setNavigationActive(true);

      const newRoute = await fetchRoute(
        coordinates,
        destinationCoordinates
      );

      speak('Navigation started.');

      updateNextInstruction(coordinates);

      return newRoute;
    } catch (err) {
      console.error(
        'Navigation route error:',
        err
      );

      setNavigationActive(false);

      setRoute(null);

      setError(
        'Unable to calculate a route to this charging station.'
      );
    }
  };

  // ------------------------------------------------------------
  // LIVE GPS WATCH
  // ------------------------------------------------------------

  useEffect(() => {
    if (!navigationActive) {
      return undefined;
    }

    if (
      typeof navigator === 'undefined' ||
      !navigator.geolocation
    ) {
      setError(
        'Live location is not supported by this browser.'
      );

      return undefined;
    }

    const handlePosition = async (position) => {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;

      const currentCoordinates = {
        latitude,
        longitude,
      };

      setCoordinates(currentCoordinates);

      const activeStation =
        selectedStationRef.current;

      const activeRoute = routeRef.current;

      if (!activeStation || !activeRoute) {
        return;
      }

      const destination =
        activeStation.AddressInfo;

      const destinationLatitude =
        Number(destination?.Latitude);

      const destinationLongitude =
        Number(destination?.Longitude);

      if (
        !Number.isFinite(destinationLatitude) ||
        !Number.isFinite(destinationLongitude)
      ) {
        return;
      }

      // --------------------------------------------------------
      // DISTANCE TO DESTINATION
      // --------------------------------------------------------

      const destinationDistance =
        distanceBetweenPoints(
          latitude,
          longitude,
          destinationLatitude,
          destinationLongitude
        );

      // --------------------------------------------------------
      // ARRIVAL
      // --------------------------------------------------------

      if (destinationDistance <= 30) {
        setRemainingDistance(0);
        setRemainingDuration(0);

        setNextInstruction(
          'You have arrived at the charging station.'
        );

        setNextInstructionDistance(0);

        speak(
          'You have arrived at the charging station.'
        );

        setNavigationActive(false);

        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(
            watchIdRef.current
          );

          watchIdRef.current = null;
        }

        return;
      }

      // --------------------------------------------------------
      // UPDATE REMAINING DISTANCE / ETA
      // --------------------------------------------------------

      const originalDistance =
        Number(activeRoute.distance) || 0;

      const originalDuration =
        Number(activeRoute.duration) || 0;

      if (originalDistance > 0) {
        const ratio = Math.min(
          1,
          destinationDistance / originalDistance
        );

        const estimatedRemainingDuration =
          originalDuration * ratio;

        setRemainingDistance(
          destinationDistance
        );

        setRemainingDuration(
          estimatedRemainingDuration
        );
      } else {
        setRemainingDistance(
          destinationDistance
        );
      }

      // --------------------------------------------------------
      // UPDATE TEXT INSTRUCTION
      // --------------------------------------------------------

      updateNextInstruction(
        currentCoordinates
      );

      // --------------------------------------------------------
      // OFF-ROUTE DETECTION
      // --------------------------------------------------------

      const routeDistance =
        distanceToRoute(
          latitude,
          longitude,
          activeRoute.geometry
        );

      if (routeDistance > 80) {
        const now = Date.now();

        const enoughTimePassed =
          now - lastRerouteTimeRef.current >
          15000;

        if (
          enoughTimePassed &&
          !reroutingRef.current
        ) {
          reroutingRef.current = true;

          setRerouting(true);

          lastRerouteTimeRef.current = now;

          try {
            const destinationCoordinates = {
              latitude:
                destinationLatitude,
              longitude:
                destinationLongitude,
            };

            const newRoute =
              await fetchRoute(
                currentCoordinates,
                destinationCoordinates
              );

            routeRef.current = newRoute;

            speak('Route updated.');

            updateNextInstruction(
              currentCoordinates
            );
          } catch (rerouteError) {
            console.error(
              'Rerouting failed:',
              rerouteError
            );
          } finally {
            reroutingRef.current = false;

            setRerouting(false);
          }
        }
      }
    };

    const handlePositionError = (positionError) => {
      console.error(
        'Live GPS error:',
        positionError
      );

      if (
        positionError.code ===
        positionError.PERMISSION_DENIED
      ) {
        setError(
          'Location permission was denied.'
        );
      } else if (
        positionError.code ===
        positionError.POSITION_UNAVAILABLE
      ) {
        setError(
          'Your current location is unavailable.'
        );
      } else if (
        positionError.code ===
        positionError.TIMEOUT
      ) {
        setError(
          'Location request timed out.'
        );
      }
    };

    const watchId =
      navigator.geolocation.watchPosition(
        handlePosition,
        handlePositionError,
        {
          enableHighAccuracy: true,
          maximumAge: 3000,
          timeout: 15000,
        }
      );

    watchIdRef.current = watchId;

    return () => {
      navigator.geolocation.clearWatch(
        watchId
      );

      if (watchIdRef.current === watchId) {
        watchIdRef.current = null;
      }
    };
  }, [navigationActive]);

  // ------------------------------------------------------------
  // USE MY LOCATION
  // ------------------------------------------------------------

  const handleUseMyLocation = () => {
    if (
      typeof navigator === 'undefined' ||
      !navigator.geolocation
    ) {
      setError(
        'Geolocation is not supported by this browser.'
      );

      return;
    }

    setLocationStatus(
      'Getting your location...'
    );

    setError('');

    setLoadingStations(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude =
          position.coords.latitude;

        const longitude =
          position.coords.longitude;

        const currentCoordinates = {
          latitude,
          longitude,
        };

        setCoordinates(
          currentCoordinates
        );

        setLocationStatus(
          'Location detected successfully.'
        );

        try {
          const response = await fetch(
  `${import.meta.env.VITE_API_URL}/live-intelligence/nearby-stations?latitude=${latitude}&longitude=${longitude}`
);

          const data = await response.json();
          console.log("LIVE INTELLIGENCE RESPONSE:", data);
            console.log("CANDIDATE AREA:", data?.analysis?.candidateArea);

          if (!response.ok || !data.success) {
            throw new Error(
              data.message ||
                'Unable to load nearby stations.'
            );
          }

          setStations(
            Array.isArray(data.stations)
              ? data.stations
              : []
          );

          setAnalysis(
            data.analysis || null
          );
        } catch (err) {
          console.error(
            'Nearby station lookup failed:',
            err
          );

          setError(
            err.message ||
              'Unable to load nearby charging stations.'
          );
        } finally {
          setLoadingStations(false);
        }
      },
      (positionError) => {
        console.error(
          'Location error:',
          positionError
        );

        setLoadingStations(false);

        if (
          positionError.code ===
          positionError.PERMISSION_DENIED
        ) {
          setError(
            'Location permission was denied. Please allow location access and try again.'
          );
        } else if (
          positionError.code ===
          positionError.POSITION_UNAVAILABLE
        ) {
          setError(
            'Your current location could not be determined.'
          );
        } else if (
          positionError.code ===
          positionError.TIMEOUT
        ) {
          setError(
            'Location request timed out. Please try again.'
          );
        } else {
          setError(
            'Unable to get your current location.'
          );
        }

        setLocationStatus('');
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  // ------------------------------------------------------------
  // CLEANUP
  // ------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(
          watchIdRef.current
        );
      }

      if (
        typeof window !== 'undefined' &&
        window.speechSynthesis
      ) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // ------------------------------------------------------------
  // UI
  // ------------------------------------------------------------

  return (
    <div className="space-y-6">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Navigation
              className="w-6 h-6 text-blue-600"
            />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Live Intelligence
            </h1>

            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Find nearby charging infrastructure and navigate to a charging station.
            </p>
          </div>
        </div>
      </div>

      {/* ======================================================
          LOCATION CONTROL
      ====================================================== */}

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Your Current Location
            </h2>

            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Use your location to discover nearby EV charging stations.
            </p>
          </div>

          <button
            onClick={handleUseMyLocation}
            disabled={loadingStations}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium transition"
          >
            {loadingStations ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <LocateFixed className="w-5 h-5" />
            )}

            {loadingStations
              ? 'Finding Stations...'
              : 'Use My Location'}
          </button>

        </div>

        {locationStatus && (
          <div className="mt-4 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="w-4 h-4" />
            {locationStatus}
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-4">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />

            <p className="text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          </div>
        )}

        {coordinates && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">

            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Latitude
              </p>

              <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                {coordinates.latitude.toFixed(6)}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Longitude
              </p>

              <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                {coordinates.longitude.toFixed(6)}
              </p>
            </div>

          </div>
        )}
      </div>

      {/* ======================================================
          MAP
      ====================================================== */}

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">

        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Charging Infrastructure Map
          </h2>

          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Your location and nearby EV charging infrastructure.
          </p>
        </div>

        <ChargingMap
            coordinates={coordinates}
            stations={stations}
            selectedStation={selectedStation}
            route={route}
            navigationActive={navigationActive}
            candidateArea={analysis?.candidateArea}
        />

        <p className="text-[11px] text-slate-400 mt-3">
          Map data © OpenStreetMap contributors. Charging station
          data provided by Open Charge Map.
        </p>

      </div>

      {/* ======================================================
          LIVE NAVIGATION
      ====================================================== */}

      {navigationActive && route && (
        <div className="rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 p-6">

          {/* Header */}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">

            <div className="flex items-center gap-3">

              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                <Navigation className="w-5 h-5 text-white" />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                  Live Navigation
                </p>

                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                  {selectedStation?.AddressInfo?.Title ||
                    'Charging Station'}
                </h3>
              </div>

            </div>

            <div className="flex items-center gap-2">

              <button
                onClick={() =>
                  setVoiceEnabled(
                    (previous) => !previous
                  )
                }
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200"
              >
                {voiceEnabled ? (
                  <Volume2 className="w-4 h-4" />
                ) : (
                  <VolumeX className="w-4 h-4" />
                )}

                {voiceEnabled
                  ? 'Voice On'
                  : 'Voice Off'}
              </button>

              <button
                onClick={() =>
                  stopNavigation(true)
                }
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium"
              >
                <X className="w-4 h-4" />
                End
              </button>

            </div>

          </div>

          {/* Rerouting */}

          {rerouting && (
            <div className="mb-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
              <Loader2 className="w-4 h-4 animate-spin" />
              Recalculating your route...
            </div>
          )}

          {/* Current instruction */}

          <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-sm">

            <div className="flex items-center gap-2 mb-3">

              <Route className="w-4 h-4 text-blue-600" />

              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Next Direction
              </p>

            </div>

            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {nextInstruction ||
                'Continue following the route'}
            </p>

            {nextInstructionDistance !== null && (
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-2 font-semibold">
                {formatDistance(
                  nextInstructionDistance
                )}
              </p>
            )}

          </div>

          {/* Remaining distance + ETA */}

          <div className="grid grid-cols-2 gap-4 mt-4">

            <div className="rounded-xl bg-white dark:bg-slate-900 p-4">

              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <Route className="w-4 h-4" />

                <p className="text-xs">
                  Remaining
                </p>
              </div>

              <p className="text-xl font-bold text-slate-900 dark:text-white mt-2">
                {formatDistance(
                  remainingDistance
                )}
              </p>

            </div>

            <div className="rounded-xl bg-white dark:bg-slate-900 p-4">

              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <Clock className="w-4 h-4" />

                <p className="text-xs">
                  ETA
                </p>
              </div>

              <p className="text-xl font-bold text-slate-900 dark:text-white mt-2">
                {formatDuration(
                  remainingDuration
                )}
              </p>

            </div>

          </div>

          {/* ==================================================
              FULL TEXT TURN-BY-TURN DIRECTIONS
          ================================================== */}

          <div className="mt-6">

            <div className="flex items-center gap-2 mb-3">

              <Navigation className="w-4 h-4 text-blue-600" />

              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                Turn-by-Turn Directions
              </h4>

            </div>

            <div className="space-y-2">

              {route.legs?.[0]?.steps?.map(
                (step, index) => {

                  const instruction =
                    getStepInstruction(step);

                  const isCurrent =
                    index === currentStepIndex;

                  const isPast =
                    index < currentStepIndex;

                  return (
                    <div
                      key={`${index}-${instruction}`}
                      className={`flex gap-3 p-3 rounded-xl border transition ${
                        isCurrent
                          ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700'
                          : 'bg-white dark:bg-slate-900 border-transparent'
                      } ${
                        isPast
                          ? 'opacity-50'
                          : ''
                      }`}
                    >

                      {/* Number */}

                      <div
                        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          isCurrent
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {index + 1}
                      </div>

                      {/* Instruction */}

                      <div className="min-w-0 flex-1">

                        <p
                          className={`text-sm font-medium ${
                            isCurrent
                              ? 'text-blue-900 dark:text-blue-100'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {instruction}
                        </p>

                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {formatDistance(
                            Number(step.distance) ||
                              0
                          )}
                        </p>

                      </div>

                    </div>
                  );
                }
              )}

            </div>

          </div>

        </div>
      )}

      {/* ======================================================
          NEARBY STATIONS
      ====================================================== */}

      {coordinates && stations.length > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">

          <div className="flex items-center justify-between mb-5">

            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Nearby Charging Stations
              </h2>

              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Charging infrastructure found near your location.
              </p>
            </div>

            <div className="px-3 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-semibold">
              {stations.length} found
            </div>

          </div>

          <div className="space-y-3">

            {stations.map((station) => {

              const address =
                station.AddressInfo || {};

              const stationName =
                address.Title ||
                'Charging Station';

              const stationAddress =
                address.AddressLine1 ||
                'Address unavailable';

              const stationDistance =
                typeof address.Distance ===
                'number'
                  ? address.Distance
                  : null;

              const connectionCount =
                Array.isArray(
                  station.Connections
                )
                  ? station.Connections.length
                  : 0;

              const operational =
                station.StatusType
                  ?.IsOperational;

              return (
                <div
                  key={station.ID}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 p-4"
                >

                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

                    <div className="min-w-0">

                      <div className="flex items-center gap-2">

                        <Zap className="w-5 h-5 text-yellow-500 flex-shrink-0" />

                        <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                          {stationName}
                        </h3>

                      </div>

                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                        {stationAddress}
                      </p>

                      <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-500 dark:text-slate-400">

                        {stationDistance !== null && (
                          <span>
                            📍{' '}
                            {stationDistance.toFixed(
                              1
                            )}{' '}
                            km
                          </span>
                        )}

                        <span>
                          ⚡ {connectionCount}{' '}
                          connectors
                        </span>

                        {typeof operational ===
                          'boolean' && (
                          <span
                            className={
                              operational
                                ? 'text-green-600'
                                : 'text-red-500'
                            }
                          >
                            {operational
                              ? 'Operational'
                              : 'Not confirmed operational'}
                          </span>
                        )}

                      </div>

                    </div>

                    <button
                      onClick={() =>
                        startNavigation(station)
                      }
                      disabled={
                        !coordinates ||
                        navigationActive
                      }
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium"
                    >
                      <Navigation className="w-4 h-4" />

                      {navigationActive &&
                      selectedStation?.ID ===
                        station.ID
                        ? 'Navigating...'
                        : 'Start Navigation'}
                    </button>

                  </div>

                </div>
              );
            })}

          </div>

          <p className="text-[11px] text-slate-400 mt-4">
            Charging station data provided by Open Charge Map.
            Availability and charger status may not represent
            real-time occupancy.
          </p>

        </div>
      )}

      {/* ======================================================
          CHARGING GAP ANALYSIS
      ====================================================== */}

      {analysis && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">

          <div className="flex items-center gap-3 mb-5">

            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-purple-600" />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Charging Gap Analysis
              </h2>

              <p className="text-sm text-slate-500 dark:text-slate-400">
                Nearby infrastructure combined with existing ML analytics.
              </p>
            </div>

          </div>

          {/* Gap level */}

          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-5">

            <div className="flex items-center justify-between">

              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Infrastructure Gap
                </p>

                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 capitalize">
                  {analysis.gapLevel ||
                    'Unknown'}
                </p>
              </div>

              <div className="text-right">

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Nearby Stations
                </p>

                <p className="text-xl font-bold text-slate-900 dark:text-white">
                  {analysis.stationCount ??
                    stations.length}
                </p>

              </div>

            </div>

            {analysis.explanation && (
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-4 leading-relaxed">
                {analysis.explanation}
              </p>
            )}

          </div>
          {analysis?.candidateArea && (
  <div className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-5">
    <div className="flex items-start justify-between gap-4">
      <div>
        <h3 className="text-lg font-semibold text-white">
          Potential New Station Area
        </h3>

        <p className="mt-1 text-sm text-slate-400">
          Data-driven area identified for further charging infrastructure
          investigation.
        </p>
      </div>

      <div className="rounded-xl bg-amber-500/20 px-3 py-2 text-center">
        <div className="text-2xl font-bold text-amber-300">
          {analysis.candidateArea.score}
        </div>
        <div className="text-xs text-slate-400">
          / 100
        </div>
      </div>
    </div>

    <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
      <div className="rounded-xl bg-slate-900/50 p-4">
        <p className="text-xs text-slate-400">Priority Level</p>
        <p className="mt-1 font-semibold capitalize text-amber-300">
          {analysis.candidateArea.level}
        </p>
      </div>

      <div className="rounded-xl bg-slate-900/50 p-4">
        <p className="text-xs text-slate-400">Nearest Station</p>
        <p className="mt-1 font-semibold text-white">
          {analysis.candidateArea.nearestStationDistanceKm != null
            ? `${analysis.candidateArea.nearestStationDistanceKm} km`
            : 'N/A'}
        </p>
      </div>

      <div className="rounded-xl bg-slate-900/50 p-4">
        <p className="text-xs text-slate-400">Recommendation</p>
        <p className="mt-1 text-sm font-medium text-white">
          Further site investigation
        </p>
      </div>
    </div>

    {analysis.candidateArea.reasons?.length > 0 && (
      <div className="mt-5">
        <h4 className="text-sm font-semibold text-white">
          Why this area?
        </h4>

        <ul className="mt-2 space-y-2">
          {analysis.candidateArea.reasons.map((reason, index) => (
            <li
              key={index}
              className="flex gap-2 text-sm text-slate-300"
            >
              <span className="text-amber-400">•</span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>
    )}

    <div className="mt-5 rounded-xl border border-amber-400/20 bg-slate-900/40 p-3 text-xs text-slate-400">
      This identifies a potential area based on distance and available
      demand indicators. It is not a final site-selection decision.
    </div>
  </div>
)}

          {/* Pressure factors */}

          {Array.isArray(
            analysis.pressureFactors
          ) &&
            analysis.pressureFactors.length >
              0 && (
              <div className="mt-5">

                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                  Pressure Factors
                </h3>

                <div className="space-y-2">

                  {analysis.pressureFactors.map(
                    (factor, index) => (
                      <div
                        key={`${factor}-${index}`}
                        className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
                      >
                        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />

                        {factor}
                      </div>
                    )
                  )}

                </div>

              </div>
            )}

          {/* ML context */}

          {analysis.mlContext && (
            <div className="mt-5">

              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                ML Demand Context
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">

                  <p className="text-xs text-slate-500">
                    Avg Demand
                  </p>

                  <p className="font-bold text-slate-900 dark:text-white mt-1">
                    {
                      analysis.mlContext
                        .averageChargingDemand
                    }
                  </p>

                </div>

                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">

                  <p className="text-xs text-slate-500">
                    Station Load
                  </p>

                  <p className="font-bold text-slate-900 dark:text-white mt-1">
                    {
                      analysis.mlContext
                        .averageStationLoad
                    }
                  </p>

                </div>

                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">

                  <p className="text-xs text-slate-500">
                    Queue
                  </p>

                  <p className="font-bold text-slate-900 dark:text-white mt-1">
                    {
                      analysis.mlContext
                        .averageQueueLength
                    }
                  </p>

                </div>

                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">

                  <p className="text-xs text-slate-500">
                    Predicted Demand
                  </p>

                  <p className="font-bold text-slate-900 dark:text-white mt-1">
                    {
                      analysis.mlContext
                        .averagePredictedDemand
                    }
                  </p>

                </div>

              </div>

            </div>
          )}

        </div>
      )}

    </div>
  );
};

export default LiveIntelligence;