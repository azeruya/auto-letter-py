// src/App.tsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import StudentForm from './pages/StudentForm';
import StudentTemplateList from './pages/StudentTemplateList';
import Login from './pages/Login';
import Register from "./pages/Register";
import AdminManagement from "./pages/AdminManagement";
import Stats from "./pages/Stats";
import Requests from './pages/Requests';
import Templates from './pages/Templates';
import StudentTemplateForm from './pages/StudentTemplateForm';
import AdminDashboardLayout from "./pages/AdminDashboardLayout";
import { AuthProvider, useAuth } from './context/AuthContext';

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="App">
          <Layout>
            <Routes>
              {/* public routes */}
              <Route path="/" element={<StudentForm />} />
              <Route path="/templates" element={<StudentTemplateList />} />
              <Route path="/templates/:templateId/form" element={<StudentTemplateForm />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* protected admin routes */}
              <Route path="/dashboard" element={<ProtectedRoute><AdminDashboardLayout /></ProtectedRoute>}>
                <Route index element={<Stats />} />
                <Route path="admins" element={<AdminManagement />} />
                <Route path="requests" element={<Requests />} />
                <Route path="templates" element={<Templates />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Layout>

          <Toaster position="top-right" />
        </div>
      </AuthProvider>
    </Router>
  );
}


export default App;
