// src/App.tsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import StudentForm from './pages/StudentForm';
import Login from './pages/Login';
import Register from "./pages/Register";
import AdminManagement from "./pages/AdminManagement";
import Stats from "./pages/Stats";
import Requests from './pages/Requests';
import Templates from './pages/Templates';
import StudentTemplateForm from './pages/StudentTemplateForm';
import ProcessRequest from './pages/ProcessRequest';
import TrackRequest from './pages/TrackRequest';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoadingSpinner from './components/LoadingSpinner';

// Protected route wrapper
const ProtectedRoute = ({
  children,
}: {
  children: JSX.Element;
}) => {
  const { token, initializing } = useAuth();

  if (initializing) {
    return <LoadingSpinner />;
  }

  return token
    ? children
    : <Navigate to="/login" replace />;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="App">
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<StudentForm />} />
            <Route path="/templates/:templateId/form" element={<StudentTemplateForm />} />
            <Route path="/track" element={<TrackRequest />} />
        
            {/* Routes using Layout (top navbar + optional sidebar) */}
            <Route element={<Layout showHeader={true} />}>

              {/* Admin pages (protected, sidebar + top navbar) */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Stats />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/admins"
                element={
                  <ProtectedRoute>
                    <AdminManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/requests"
                element={
                  <ProtectedRoute>
                    <Requests />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/templates"
                element={
                  <ProtectedRoute>
                    <Templates />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/requests/:id/process"
                element={
                  <ProtectedRoute>
                    <ProcessRequest />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          <Toaster position="top-right" />
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
