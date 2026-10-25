import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'crypto';
import { User, Movie, Theatre, Show, Booking, Payment, Notification } from './models.js';
import { auth, admin, fail } from './middleware.js';

const r = Router();
const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sign = u => jwt.sign({ id: u._id, role: u.role, name: u.name }, process.env.JWT_SECRET, { expiresIn: '7d' });
const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20 });
const paging = q => { const p = Math.max(+q.page || 1, 1), limit = Math.min(+q.limit || 12, 50); return { p, limit, skip: (p - 1) * limit }; };
const out = (items, total, p, limit) => ({ items, total, page: p, pages: Math.ceil(total / limit) });
const broadcast = async (req, id) => {
  const s = await Show.findById(id).select('bookedSeats');
  req.app.get('io').to(String(id)).emit('seats', s.bookedSeats);
};
const showFilter = async ({ movie, city, theatre, date }) => {
  const f = { startTime: { $gt: new Date() } };
  if (movie) f.movie = movie;
  if (theatre) f.theatre = theatre;
  else if (city) f.theatre = { $in: await Theatre.find({ city: new RegExp('^' + esc(city) + '$', 'i') }).distinct('_id') };
  if (date) { const d = new Date(date); f.startTime = { $gte: new Date(Math.max(+d, Date.now())), $lt: new Date(+d + 864e5) }; }
  return f;
};

// ---- auth
const session = u => ({ token: sign(u), user: { name: u.name, email: u.email, role: u.role } });
r.post('/auth/register', authLimit, async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !/^\S+@\S+\.\S+$/.test(email || '') || (password || '').length < 6) fail(400, 'Name, valid email and 6+ char password required');
  if (await User.findOne({ email: email.toLowerCase() })) fail(409, 'Email already registered');
  res.status(201).json(session(await User.create({ name, email, password: await bcrypt.hash(password, 10) })));
});
r.post('/auth/login', authLimit, async (req, res) => {
  const u = await User.findOne({ email: String(req.body.email || '').toLowerCase() });
  if (!u || !(await bcrypt.compare(String(req.body.password || ''), u.password))) fail(401, 'Invalid credentials');
  res.json(session(u));
});

// ---- movies / theatres / shows (public reads)
r.get('/movies', async (req, res) => {
  const { q, genre, language, city, theatre, date } = req.query, f = {};
  if (q) f.title = { $regex: esc(q), $options: 'i' };
  if (genre) f.genre = new RegExp('^' + esc(genre) + '$', 'i');
  if (language) f.language = new RegExp('^' + esc(language) + '$', 'i');
  if (city || theatre || date) f._id = { $in: await Show.find(await showFilter(req.query)).distinct('movie') };
  const { p, limit, skip } = paging(req.query);
  const [items, total] = await Promise.all([Movie.find(f).sort('-releaseDate').skip(skip).limit(limit), Movie.countDocuments(f)]);
  res.json(out(items, total, p, limit));
});
r.get('/movies/:id', async (req, res) => res.json((await Movie.findById(req.params.id)) || fail(404, 'Movie not found')));
r.get('/theatres', async (req, res) => res.json(await Theatre.find().sort('city name')));
r.get('/shows', async (req, res) =>
  res.json(await Show.find(await showFilter(req.query)).sort('startTime').limit(200).populate(['theatre', 'movie'])));
r.get('/shows/:id', async (req, res) =>
  res.json((await Show.findById(req.params.id).populate(['theatre', 'movie'])) || fail(404, 'Show not found')));

// ---- admin CRUD
const crud = (path, M) => {
  r.post(path, auth, admin, async (q, s) => s.status(201).json(await M.create(q.body)));
  r.put(path + '/:id', auth, admin, async (q, s) =>
    s.json((await M.findByIdAndUpdate(q.params.id, q.body, { new: true, runValidators: true })) || fail(404, 'Not found')));
  r.delete(path + '/:id', auth, admin, async (q, s) => { (await M.findByIdAndDelete(q.params.id)) || fail(404, 'Not found'); s.json({ ok: true }); });
};
crud('/movies', Movie); crud('/theatres', Theatre); crud('/shows', Show);
r.get('/admin/stats', auth, admin, async (req, res) => {
  const [users, movies, bookings, rev] = await Promise.all([User.countDocuments(), Movie.countDocuments(),
    Booking.countDocuments({ status: 'confirmed' }), Payment.aggregate([{ $match: { status: 'success' } }, { $group: { _id: null, t: { $sum: '$amount' } } }])]);
  res.json({ users, movies, bookings, revenue: rev[0]?.t || 0 });
});

// ---- bookings
r.post('/bookings', auth, async (req, res) => {
  const { showId, seats, card } = req.body;
  if (!Array.isArray(seats) || !seats.length || seats.length > 8 || new Set(seats).size !== seats.length) fail(400, 'Select 1-8 unique seats');
  const show0 = await Show.findById(showId).populate('theatre');
  if (!show0) fail(404, 'Show not found');
  const { rows, cols } = show0.theatre;
  const valid = s => /^[A-Z]\d{1,2}$/.test(s) && s.charCodeAt(0) - 65 < rows && +s.slice(1) >= 1 && +s.slice(1) <= cols;
  if (!seats.every(valid)) fail(400, 'Invalid seat');
  // atomic lock: succeeds only if none of the seats are already booked
  const show = await Show.findOneAndUpdate({ _id: showId, startTime: { $gt: new Date() }, bookedSeats: { $nin: seats } },
    { $addToSet: { bookedSeats: { $each: seats } } }, { new: true });
  if (!show) fail(409, 'Some seats are taken or the show has started');
  const amount = show.price * seats.length, txnId = randomUUID();
  if (!/^\d{4}$/.test(card || '') || card === '0000') { // mock gateway
    await Show.updateOne({ _id: showId }, { $pull: { bookedSeats: { $in: seats } } });
    await Payment.create({ user: req.user.id, amount, status: 'failed', txnId });
    await broadcast(req, showId);
    fail(402, 'Payment failed');
  }
  const b = await Booking.create({ user: req.user.id, show: showId, seats, amount });
  await Payment.create({ booking: b._id, user: req.user.id, amount, status: 'success', txnId });
  await Notification.create({ user: req.user.id, message: `Booking confirmed: seats ${seats.join(', ')}` });
  await broadcast(req, showId);
  res.status(201).json(b);
});
r.get('/bookings/mine', auth, async (req, res) => {
  const { p, limit, skip } = paging(req.query), f = { user: req.user.id };
  const [items, total] = await Promise.all([
    Booking.find(f).sort('-createdAt').skip(skip).limit(limit).populate({ path: 'show', populate: ['movie', 'theatre'] }), Booking.countDocuments(f)]);
  res.json(out(items, total, p, limit));
});
r.patch('/bookings/:id/cancel', auth, async (req, res) => {
  const b = await Booking.findOne({ _id: req.params.id, user: req.user.id }).populate('show');
  if (!b) fail(404, 'Booking not found');
  if (b.status === 'cancelled') fail(400, 'Already cancelled');
  if (b.show.startTime - Date.now() < 2 * 36e5) fail(400, 'Cancellation closes 2 hours before showtime');
  b.status = 'cancelled'; await b.save();
  await Show.updateOne({ _id: b.show._id }, { $pull: { bookedSeats: { $in: b.seats } } });
  await Payment.updateOne({ booking: b._id }, { status: 'refunded' });
  await Notification.create({ user: req.user.id, message: `Booking cancelled, refund issued (seats ${b.seats.join(', ')})` });
  await broadcast(req, b.show._id);
  res.json(b);
});
r.get('/notifications', auth, async (req, res) => res.json(await Notification.find({ user: req.user.id }).sort('-createdAt').limit(20)));

export default r;
