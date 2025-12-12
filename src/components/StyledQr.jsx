import { useRef, useEffect, useState } from "react";
import QRCodeStyling from "qr-code-styling";
import { toast } from "react-toastify";

const GeneratedQR = ({ userData, onBack }) => {
  const qrRef = useRef(null);
  const [qrCode, setQrCode] = useState(null);

  useEffect(() => {
    if (qrRef.current) {
      const qr = new QRCodeStyling({
        width: 300,
        height: 300,
        data: userData.uniqueId,
        dotsOptions: {
          color: "#000000",
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
    }
  }, [userData.uniqueId]);

  const downloadQRCode = () => {
    if (qrCode) {
      qrCode.download({
        name: `qr-code-${userData.name.replace(/\s+/g, "-").toLowerCase()}`,
        extension: "png",
      });
      toast.success("QR code downloaded successfully!");
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
        </div>

        <div className="user-info">
          <h3>User Information</h3>
          <div className="info-item">
            <strong>Name:</strong> {userData.name}
          </div>
          <div className="info-item">
            <strong>Email:</strong> {userData.email}
          </div>
          <div className="info-item">
            <strong>Unique ID:</strong>
            <code className="unique-id">{userData.uniqueId}</code>
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
