import { useRef, useEffect, useState } from "react";
import QRCodeStyling from "qr-code-styling";
import { toast } from "react-toastify";

const GeneratedQR = ({ userData, onBack }) => {
  const qrRef = useRef(null);
  const [qrCode, setQrCode] = useState(null);

  useEffect(() => {
    if (qrRef.current && userData?.uniqueId) {
      // Clear previous content
      qrRef.current.innerHTML = "";

      const qr = new QRCodeStyling({
        width: 300,
        height: 300,
        data: userData.uniqueId,
        dotsOptions: {
          color: "#4267b2",
          type: "rounded",
        },
        backgroundOptions: {
          color: "#ffffff",
        },
        imageOptions: {
          crossOrigin: "anonymous",
          margin: 10,
        },
        qrOptions: {
          errorCorrectionLevel: "M",
        },
      });

      qr.append(qrRef.current);
      setQrCode(qr);

      // Add a small delay to ensure QR renders
      setTimeout(() => {
        if (qrRef.current && qrRef.current.innerHTML === "") {
          console.log("QR failed to render, trying again...");
          qr.append(qrRef.current);
        }
      }, 500);
    }
  }, [userData]);

  const downloadQRCode = () => {
    if (qrCode) {
      qrCode.download({
        name: `qr-code-${userData.name.replace(/\s+/g, "-").toLowerCase()}`,
        extension: "png",
      });
      toast.success("QR code downloaded successfully!");
    } else {
      toast.error("QR code not ready. Please wait a moment.");
    }
  };

  const copyToClipboard = async () => {
    if (userData?.uniqueId) {
      try {
        await navigator.clipboard.writeText(userData.uniqueId);
        toast.success("Unique ID copied to clipboard!");
      } catch (err) {
        toast.error("Failed to copy to clipboard");
      }
    }
  };

  return (
    <div className="generated-qr-container">
      <div className="qr-header">
        <h2>Your QR Code is Ready!</h2>
        <p>Download your unique QR code below</p>
      </div>

      <div className="qr-content">
        <div className="qr-code-display">
          <div ref={qrRef} className="qr-canvas" />
          {!qrCode && (
            <div className="qr-loading">
              <div className="loading-spinner"></div>
              <p>Generating QR code...</p>
            </div>
          )}
        </div>

        <div className="user-info">
          <h3>User Information</h3>
          <div className="info-card">
            <div className="info-row">
              <span className="info-label">Name:</span>
              <span className="info-value">{userData.name}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Email:</span>
              <span className="info-value">{userData.email}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Unique ID:</span>
              <div className="unique-id-display">
                <code>{userData.uniqueId}</code>
                <button
                  className="copy-icon-btn"
                  onClick={copyToClipboard}
                  title="Copy ID"
                >
                  📋
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="qr-actions">
        <button className="btn btn-primary" onClick={downloadQRCode}>
          Download QR Code
        </button>
        <button className="btn btn-secondary" onClick={onBack}>
          Back to Home
        </button>
      </div>

      <div className="qr-usage">
        <h4>How to use your QR code:</h4>
        <ul>
          <li>Save it to your device</li>
          <li>Print it for physical use</li>
          <li>Share it digitally</li>
          <li>Use it for identification</li>
        </ul>
      </div>
    </div>
  );
};

export default GeneratedQR;
