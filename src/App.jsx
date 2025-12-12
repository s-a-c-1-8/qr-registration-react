import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import { useState } from "react";

import ScanQR from "./components/ScanQR";
import RegistrationForm from "./components/RegistrationForm";
import GeneratedQR from "./components/GeneratedQR";
import GetYourHuddy from "./components/GetYourHuddy";
import Dashboard from "./components/Dashboard";

import "react-toastify/dist/ReactToastify.css";
import "./App.css";

const App = () => {
  const [generatedQRData, setGeneratedQRData] = useState(null);

  const handleRegistrationSuccess = (userData, navigate) => {
    setGeneratedQRData(userData);
    toast.success("Registration successful! Your QR code is ready.");
    navigate("/qr");
  };

  return (
    <Router>
      <div className="App">
        <ToastContainer position="top-right" autoClose={3000} />

        <main className="main-content">
          <Routes>
            {/* HOME PAGE */}
            <Route
              path="/"
              element={
                <div className="home-page">
                  <h1>Welcome to QR System</h1>
                  <p>Scan QR codes or register to get your own QR code</p>
                  <div className="action-buttons">
                    <Link to="/scan">
                      <button className="btn btn-primary">Scan QR Code</button>
                    </Link>

                    <Link to="/register">
                      <button className="btn btn-secondary">Register Now</button>
                    </Link>

                    <Link to="/getyourhuddy">
                      <button className="btn btn-secondary">Get Your Huddy</button>
                    </Link>

                    <Link to="/dashboard">
                      <button className="btn btn-tertiary">View Dashboard</button>
                    </Link>
                  </div>
                </div>
              }
            />

            {/* SCAN PAGE */}
            <Route path="/scan" element={<ScanQR />} />

            {/* HUDDY PAGE */}
            <Route path="/getyourhuddy" element={<GetYourHuddy />} />

            {/* DASHBOARD PAGE */}
            <Route path="/dashboard" element={<Dashboard />} />

            {/* REGISTRATION PAGE */}
            <Route
              path="/register"
              element={
                <RegistrationForm
                  onSuccess={(userData) => {
                    const navigate = window.navigation;
                  }}
                />
              }
            />

            {/* QR PAGE */}
            <Route
              path="/qr"
              element={
                generatedQRData ? (
                  <GeneratedQR
                    userData={generatedQRData}
                    onBack={() => {
                      setGeneratedQRData(null);
                    }}
                  />
                ) : (
                  <p>No QR data available</p>
                )
              }
            />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;
