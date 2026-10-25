import jwt from 'jsonwebtoken';
export const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
export const auth = (req, res, next) => {
  try { req.user = jwt.verify((req.headers.authorization || '').split(' ')[1], process.env.JWT_SECRET); next(); }
  catch { res.status(401).json({ message: 'Please log in' }); }
};
export const admin = (req, res, next) => req.user?.role === 'admin' ? next() : res.status(403).json({ message: 'Admins only' });
export const errorHandler = (err, req, res, next) => {
  const status = err.status || (err.name === 'ValidationError' || err.name === 'CastError' ? 400 : err.code === 11000 ? 409 : 500);
  if (status === 500) console.error(err);
  res.status(status).json({ message: status === 500 ? 'Server error' : err.message });
};
