import { useContext, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'react-toastify/dist/ReactToastify.css';
import { AuthCtx } from './api';
import { Movies, MovieDetail, Book, Bookings, AuthForm } from './pages';
import Admin from './Admin';

const stored = () => { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } };
const Private = ({ admin, children }) => {
  const { user } = useContext(AuthCtx);
  return !user ? <Navigate to="/login" /> : admin && user.role !== 'admin' ? <Navigate to="/" /> : children;
};
function Nav() {
  const { user, logout } = useContext(AuthCtx);
  return (
    <nav className="navbar navbar-dark bg-dark px-3 mb-4 gap-3">
      <Link to="/" className="navbar-brand">🎬 IMovies</Link>
      <div className="d-flex gap-3 align-items-center ms-auto">
        {user ? <>
          <Link to="/bookings" className="text-white">My Bookings</Link>
          {user.role === 'admin' && <Link to="/admin" className="text-warning">Admin</Link>}
          <span className="text-secondary">{user.name}</span>
          <button className="btn btn-sm btn-outline-light" onClick={logout}>Logout</button>
        </> : <><Link to="/login" className="text-white">Login</Link><Link to="/register" className="text-white">Register</Link></>}
      </div>
    </nav>
  );
}
export default function App() {
  const [user, setUser] = useState(stored);
  const login = ({ token, user }) => { localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user)); setUser(user); };
  const logout = () => { localStorage.clear(); setUser(null); };
  return (
    <AuthCtx.Provider value={{ user, login, logout }}>
      <BrowserRouter>
        <Nav />
        <div className="container pb-5">
          <Routes>
            <Route path="/" element={<Movies />} />
            <Route path="/movie/:id" element={<MovieDetail />} />
            <Route path="/login" element={<AuthForm mode="login" />} />
            <Route path="/register" element={<AuthForm mode="register" />} />
            <Route path="/book/:id" element={<Private><Book /></Private>} />
            <Route path="/bookings" element={<Private><Bookings /></Private>} />
            <Route path="/admin" element={<Private admin><Admin /></Private>} />
          </Routes>
        </div>
      </BrowserRouter>
      <ToastContainer position="bottom-right" />
    </AuthCtx.Provider>
  );
}
