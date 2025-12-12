import React, { useRef, useEffect, useState, useCallback } from "react";
import QrScanner from "qr-scanner";
import "./ScanQR.css";
import { checkUserDirect } from "../lib/supabaseClient";

const preferRearRegex = /(back|rear|environment|wide|traseira)/i;
const preferFrontRegex = /(front|user|face|front camera)/i;

const ScanQR = ({ onQRScan }) => {
  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const audioCtxRef = useRef(null);
  const mountedRef = useRef(true);

  const [isInitializing, setIsInitializing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [message, setMessage] = useState(""); // message shown in modal
  const [messageType, setMessageType] = useState(""); // "success" | "error" | ""
  const [cameras, setCameras] = useState([]);
  const [cameraIndex, setCameraIndex] = useState(0);
  const [isFrontCamera, setIsFrontCamera] = useState(false); // for mirroring

  useEffect(() => {
    mountedRef.current = true;

    (async () => {
      let list = [];
      try {
        list = await QrScanner.listCameras(true); // { id, label }[]
      } catch (e) {
        // ignore listing errors
      }

      if (mountedRef.current && list && list.length) {
        setCameras(list);

        // choose preferred camera index:
        // 1. try to find rear/back/environment
        let preferred = list.findIndex((c) =>
          preferRearRegex.test(c.label || "")
        );
        // 2. if not found, try to find explicit environment id (some browsers return labels like "Back Camera")
        if (preferred === -1) {
          preferred = list.findIndex((c) => /environment/i.test(c.label || ""));
        }
        // 3. fallback: pick first available
        if (preferred === -1) preferred = 0;

        // set cameraIndex and set isFront based on label
        setCameraIndex(preferred);
        const lbl = list[preferred]?.label || "";
        setIsFrontCamera(preferFrontRegex.test(lbl));

        // start scanner with the preferred camera id immediately
        startScannerWithCameraId(list[preferred].id);
        return;
      }

      // No labeled cameras; start normal (browser will interpret "environment" vs "user")
      startScannerWithCameraId("environment");
    })();

    const onKey = (e) => {
      // close modal with Escape
      if (e.key === "Escape" && message) {
        closeMessage();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("keydown", onKey);
      stopScanner();
      if (audioCtxRef.current) {
        try {
          audioCtxRef.current.close();
        } catch (_) {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once

  const playBeep = (freq = 880, dur = 0.11, type = "sine") => {
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      if (!audioCtxRef.current) audioCtxRef.current = new C();
      const ctx = audioCtxRef.current;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, ctx.currentTime);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      o.stop(ctx.currentTime + dur + 0.02);
    } catch (e) {
      // silently ignore audio errors
    }
  };

  // start scanner using a specific camera id or "environment"/"user"
  const startScannerWithCameraId = useCallback(
    async (preferredCameraIdOrLabel) => {
      if (!videoRef.current) return;
      if (scannerRef.current) return; // already running
      setCameraError("");
      setIsInitializing(true);
      setMessage("");
      setMessageType("");

      try {
        const scanner = new QrScanner(videoRef.current, onDetected, {
          preferredCamera: preferredCameraIdOrLabel,
          highlightScanRegion: true,
          highlightCodeOutline: true,
        });
        scannerRef.current = scanner;
        await scanner.start();
        // stabilization
        await new Promise((r) => setTimeout(r, 220));
        if (!mountedRef.current) return;
        setIsScanning(true);
        setIsInitializing(false);

        // update isFrontCamera state by matching id to cameras[] (if available)
        if (cameras && cameras.length) {
          const found = cameras.find((c) => c.id === preferredCameraIdOrLabel);
          if (found) {
            setIsFrontCamera(preferFrontRegex.test(found.label || ""));
          } else {
            // if label isn't available, try heuristics by the passed string
            setIsFrontCamera(
              preferFrontRegex.test(String(preferredCameraIdOrLabel))
            );
          }
        } else {
          // fallback heuristics
          setIsFrontCamera(
            preferFrontRegex.test(String(preferredCameraIdOrLabel))
          );
        }
      } catch (err) {
        console.error("scanner start err", err);
        setCameraError(
          "Unable to access camera. Please grant permission and retry."
        );
        setIsInitializing(false);
        setIsScanning(false);
        if (scannerRef.current) {
          try {
            scannerRef.current.destroy();
          } catch (_) {}
          scannerRef.current = null;
        }
      }
    },
    [cameras]
  );

  // convenience: call startScannerWithCameraId with currently selected cameraIndex id
  const startScanner = useCallback(() => {
    const cam = cameras[cameraIndex];
    if (cam && cam.id) return startScannerWithCameraId(cam.id);
    // fallback to "environment" preferred
    return startScannerWithCameraId("environment");
  }, [cameraIndex, cameras, startScannerWithCameraId]);

  const stopScanner = () => {
    if (scannerRef.current) {
      try {
        scannerRef.current.stop();
        scannerRef.current.destroy();
      } catch (e) {}
      scannerRef.current = null;
    }
    setIsScanning(false);
    setIsInitializing(false);
  };

  const flipCamera = async () => {
    // if we have enumerated cameras, cycle through them
    if (scannerRef.current && cameras.length > 1) {
      const next = (cameraIndex + 1) % cameras.length;
      setCameraIndex(next);
      try {
        await scannerRef.current.setCamera(cameras[next].id);
        const lbl = cameras[next]?.label || "";
        setIsFrontCamera(preferFrontRegex.test(lbl));
      } catch (e) {
        console.error("flip camera error", e);
        setCameraError("Unable to switch camera. Try again.");
      }
      return;
    }

    // else try toggling environment/user (best-effort)
    try {
      const currentPref = isFrontCamera ? "environment" : "user";
      await scannerRef.current?.setCamera(currentPref);
      setIsFrontCamera(!isFrontCamera);
    } catch (e) {
      console.error("flip fallback error", e);
      setCameraError("Unable to switch camera. Try again.");
    }
  };

  // when a QR is detected, stop scanner and show modal; do NOT auto-restart
  const onDetected = async (result) => {
    const scanned =
      typeof result === "string"
        ? result
        : String(result?.data ?? result ?? "");
    // Immediately stop to avoid duplicates
    stopScanner();

    if (typeof onQRScan === "function") {
      try {
        onQRScan(scanned);
      } catch (_) {}
    }

    // lookup via Supabase
    try {
      const res = await checkUserDirect(scanned);
      const exists = !!res?.exists;
      const name = res?.name ?? null;
      if (exists) {
        const welcome = name
          ? `Hey ${name}, welcome!`
          : "Access granted — welcome!";
        setMessage(welcome);
        setMessageType("success");
        playBeep(880, 0.11, "sine");
      } else {
        setMessage("User not found. Please register.");
        setMessageType("error");
        playBeep(440, 0.14, "triangle");
      }
    } catch (e) {
      console.error("lookup error", e);
      setMessage("Lookup failed. Check network and try again.");
      setMessageType("error");
    }
    // no auto-restart — user must close modal to resume
  };

  // close modal and resume scanning
  const closeMessage = async () => {
    setMessage("");
    setMessageType("");
    setCameraError("");
    // small delay for smoothness
    await new Promise((r) => setTimeout(r, 120));
    // restart scanner using current cameraIndex (or fallback)
    startScanner();
  };

  return (
    <div className="qr-scanner" aria-live="polite">
      <div className="scanner-header">
        <h1>Scan QR</h1>

        <div className="scan-stats">
          <div className="stat-badge">
            {isInitializing
              ? "Initializing…"
              : isScanning
              ? "Scanning"
              : "Idle"}
          </div>
          {cameras.length > 0 && (
            <div className="stat-badge">
              {cameras.length} camera{cameras.length > 1 ? "s" : ""}
            </div>
          )}
        </div>
      </div>

      <div className="camera-view">
        <div
          className={`camera-wrapper ${isInitializing ? "skeleton" : ""}`}
          aria-hidden={!!cameraError}
        >
          <video
            ref={videoRef}
            className={`camera-video ${isFrontCamera ? "mirrored" : ""}`}
            playsInline
            muted
            autoPlay
            aria-label="QR scanner camera"
          />

          {isInitializing && (
            <div className="camera-loading" role="status" aria-live="polite">
              <div className="loading-spinner" aria-hidden="true" />
              <div style={{ textAlign: "center", fontWeight: 700 }}>
                Preparing camera…
              </div>
            </div>
          )}

          {!isInitializing && (
            <div className="camera-overlay" aria-hidden={isInitializing}>
              <div className="scan-frame" aria-hidden="true">
                <div className="corner tl" />
                <div className="corner tr" />
                <div className="corner bl" />
                <div className="corner br" />
                {isScanning && <div className="scan-line" aria-hidden="true" />}
              </div>

              <div className="scan-text">
                {isScanning ? "Point camera at QR code" : "Preparing camera…"}
              </div>
            </div>
          )}
        </div>

        <div
          className="camera-controls"
          role="group"
          aria-label="Scanner controls"
        >
          {cameras.length > 1 && (
            <button
              type="button"
              className="control-btn"
              onClick={flipCamera}
              aria-label="Flip camera"
            >
              Flip Camera
            </button>
          )}

          <button
            type="button"
            className="control-btn"
            onClick={() => {
              setCameraError("");
              setMessage("");
              setMessageType("");
              stopScanner();
              // restart using the same cameraIndex (or fallback)
              startScanner();
            }}
            aria-label="Restart scanner"
          >
            Restart
          </button>
        </div>
      </div>

      {/* camera error (when present and no message modal) */}
      {cameraError && !message && (
        <div className="error-wrap" role="alert">
          <div className="error-card">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="emoji">⚠️</div>
              <div>
                <div style={{ fontWeight: 700 }}>Camera error</div>
                <div style={{ fontSize: 13, color: "#ffd7d7" }}>
                  {cameraError}
                </div>
              </div>
            </div>
            <div className="error-actions">
              <button
                className="control-btn"
                onClick={() => {
                  setCameraError("");
                  startScanner();
                }}
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* message modal: prevent scanning until closed */}
      {message && (
        <div
          className="message-modal"
          role="dialog"
          aria-modal="true"
          aria-live="assertive"
        >
          <div className={`message-dialog ${messageType}`}>
            <button
              className="modal-close"
              aria-label="Close message"
              onClick={closeMessage}
            >
              ×
            </button>

            <div className="message-body">
              <div className="message-emoji">
                {messageType === "success" ? "🎉" : "⚠️"}
              </div>
              <div className="message-text-large">{message}</div>
            </div>

            <div className="message-actions">
              <button className="control-btn" onClick={closeMessage}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScanQR;
