import { useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ScanQR from "./components/ScanQR";
import RegistrationForm from "./components/RegistrationForm";
import GeneratedQR from "./components/GeneratedQR"; // Add this import
import GetYourHuddy from "./components/GetYourHuddy";
import "./App.css";

const App = () => {
  const [currentView, setCurrentView] = useState("home");
  const [generatedQRData, setGeneratedQRData] = useState(null); // Add this state

  const navigateTo = (view) => {
    setCurrentView(view);
  };

  const handleRegistrationSuccess = (userData) => {
    // Save the user data to state
    setGeneratedQRData(userData);
    // Navigate to QR view
    setCurrentView("qr");
    toast.success("Registration successful! Your QR code is ready.");
  };

  const handleQRScan = (qrData) => {
    toast.info(`QR Code scanned: ${qrData}`);
    console.log("Scanned QR Data:", qrData);
  };

  const handleBackToHome = () => {
    setCurrentView("home");
    setGeneratedQRData(null); // Clear QR data when going back
  };

  return (
    <div className="App">
      <ToastContainer position="top-right" autoClose={3000} />

      <main className="main-content">
        {currentView === "home" && (
          <div className="home-page">
            <h1>Welcome to QR System</h1>
            <p>Scan QR codes or register to get your own QR code</p>
            <div className="action-buttons">
              <button
                className="btn btn-primary"
                onClick={() => navigateTo("scan")}
              >
                Scan QR Code
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => navigateTo("register")}
              >
                Register Now
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => navigateTo("getyourhuddy")}
              >
                Get Your Huddy
              </button>
            </div>
          </div>
        )}

        {currentView === "scan" && <ScanQR onQRScan={handleQRScan} />}
        {currentView === "getyourhuddy" && (
          <GetYourHuddy onQRScan={handleQRScan} />
        )}

        {currentView === "register" && (
          <RegistrationForm onSuccess={handleRegistrationSuccess} />
        )}

        {/* Add this GeneratedQR component rendering */}
        {currentView === "qr" && generatedQRData && (
          <GeneratedQR userData={generatedQRData} onBack={handleBackToHome} />
        )}
      </main>
    </div>
  );
};

export default App;
