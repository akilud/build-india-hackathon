import { Routes, Route, Link } from "react-router-dom";
import HostPage from "./pages/HostPage";
import GuestPage from "./pages/GuestPage";

function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
      <div className="max-w-md w-full p-8 bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-4xl font-bold mb-6 text-center">AI Livestream</h1>
        <p className="text-gray-300 mb-8 text-center">
          Choose your role to enter the room
        </p>

        <div className="space-y-4">
          <Link
            to="/host"
            className="block w-full bg-blue-600 hover:bg-blue-700 px-6 py-4 rounded-lg font-semibold text-center transition-colors"
          >
            Join as Host
          </Link>
          <Link
            to="/guest"
            className="block w-full bg-green-600 hover:bg-green-700 px-6 py-4 rounded-lg font-semibold text-center transition-colors"
          >
            Join as Guest
          </Link>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/host" element={<HostPage />} />
      <Route path="/guest" element={<GuestPage />} />
    </Routes>
  );
}

export default App;
