import { useContext, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { io } from 'socket.io-client';
import api, { AuthCtx } from './api';

const fmt = d => new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
const Pager = ({ pg, pages, set }) => pages > 1 && (
  <div className="d-flex gap-2 justify-content-center align-items-center mt-3">
    <button className="btn btn-sm btn-light" disabled={pg <= 1} onClick={() => set(pg - 1)}>Prev</button>
    <span>{pg}/{pages}</span>
    <button className="btn btn-sm btn-light" disabled={pg >= pages} onClick={() => set(pg + 1)}>Next</button>
  </div>
);

export function AuthForm({ mode }) {
  const { login } = useContext(AuthCtx), nav = useNavigate(), reg = mode === 'register';
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const submit = async e => { e.preventDefault(); login((await api.post('/auth/' + mode, f)).data); nav('/'); };
  return (
    <form onSubmit={submit} className="mx-auto d-grid gap-2" style={{ maxWidth: 360 }}>
      <h4>{reg ? 'Register' : 'Login'}</h4>
      {(reg ? ['name', 'email', 'password'] : ['email', 'password']).map(k => (
        <input key={k} className="form-control" placeholder={k} type={k === 'password' ? 'password' : 'text'} required
          value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} />))}
      <button className="btn btn-primary">{reg ? 'Create account' : 'Login'}</button>
    </form>
  );
}

export function Movies() {
  const [f, setF] = useState({ q: '', genre: '', language: '', city: '', date: '' });
  const [pg, setPg] = useState(1), [d, setD] = useState({ items: [], pages: 1 });
  useEffect(() => {
    const t = setTimeout(() => api.get('/movies', { params: { ...f, page: pg } }).then(r => setD(r.data)), 300);
    return () => clearTimeout(t);
  }, [f, pg]);
  const set = k => e => { setF({ ...f, [k]: e.target.value }); setPg(1); };
  return (<>
    <div className="row g-2 mb-3">
      {[['q', 'Search title'], ['genre', 'Genre'], ['language', 'Language'], ['city', 'City']].map(([k, p]) =>
        <div className="col-6 col-md" key={k}><input className="form-control" placeholder={p} value={f[k]} onChange={set(k)} /></div>)}
      <div className="col-6 col-md"><input type="date" className="form-control" value={f.date} onChange={set('date')} /></div>
    </div>
    <div className="row g-3">
      {d.items.map(m => (
        <div className="col-6 col-md-3" key={m._id}>
          <Link to={'/movie/' + m._id} className="text-decoration-none text-dark">
            <div className="card h-100">
              <img src={m.poster} alt="" className="card-img-top" style={{ aspectRatio: '2/3', objectFit: 'cover' }} />
              <div className="card-body"><h6 className="mb-1">{m.title}</h6><small className="text-muted">{m.language} • {m.genre?.join(', ')}</small></div>
            </div>
          </Link>
        </div>))}
      {!d.items.length && <p className="text-muted">No movies found.</p>}
    </div>
    <Pager pg={pg} pages={d.pages} set={setPg} />
  </>);
}

export function MovieDetail() {
  const { id } = useParams(), [m, setM] = useState(), [shows, setS] = useState([]);
  useEffect(() => { api.get('/movies/' + id).then(r => setM(r.data)); api.get('/shows', { params: { movie: id } }).then(r => setS(r.data)); }, [id]);
  if (!m) return null;
  return (<>
    <h2>{m.title}</h2><p>{m.description}</p>
    <p className="text-muted">{m.duration} min • {m.language} • {m.genre?.join(', ')}</p>
    <h5>Showtimes</h5>
    {shows.length ? shows.map(s => (
      <Link key={s._id} to={'/book/' + s._id} className="btn btn-outline-primary me-2 mb-2">
        {s.theatre.name}, {s.theatre.city} — {fmt(s.startTime)} ({s.price})
      </Link>)) : <p>No upcoming shows.</p>}
  </>);
}

export function Book() {
  const { id } = useParams(), nav = useNavigate();
  const [s, setS] = useState(), [sel, setSel] = useState([]), [card, setCard] = useState('');
  const load = () => api.get('/shows/' + id).then(r => { setS(r.data); setSel([]); });
  useEffect(() => {
    load();
    const so = io(); so.emit('watch', id);
    so.on('seats', b => { setS(p => p && { ...p, bookedSeats: b }); setSel(x => x.filter(k => !b.includes(k))); });
    return () => so.disconnect();
  }, [id]);
  if (!s) return null;
  const { rows, cols } = s.theatre, toggle = k => setSel(x => x.includes(k) ? x.filter(i => i !== k) : x.length < 8 ? [...x, k] : x);
  const pay = () => api.post('/bookings', { showId: id, seats: sel, card })
    .then(() => { toast.success('Booking confirmed!'); nav('/bookings'); }).catch(load);
  return (<>
    <h4>{s.movie.title}</h4>
    <p className="text-muted">{s.theatre.name}, {s.theatre.city} • {fmt(s.startTime)} • {s.price} per seat</p>
    <div className="text-center bg-secondary text-white rounded mb-3 py-1">SCREEN</div>
    <div className="d-grid gap-1 mb-3" style={{ justifyContent: 'center' }}>
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="d-flex gap-1">
          {[...Array(cols)].map((_, j) => {
            const k = String.fromCharCode(65 + i) + (j + 1), taken = s.bookedSeats.includes(k), on = sel.includes(k);
            return <button key={k} disabled={taken} onClick={() => toggle(k)} style={{ width: 44 }}
              className={'btn btn-sm ' + (taken ? 'btn-secondary' : on ? 'btn-success' : 'btn-outline-dark')}>{k}</button>;
          })}
        </div>))}
    </div>
    <div className="d-flex gap-2 align-items-center flex-wrap">
      <b>Total: {sel.length * s.price}</b>
      <input className="form-control w-auto" maxLength={4} placeholder="Card last 4 (0000 = decline)" value={card} onChange={e => setCard(e.target.value)} />
      <button className="btn btn-primary" disabled={!sel.length} onClick={pay}>Pay & Book {sel.join(', ')}</button>
    </div>
  </>);
}

export function Bookings() {
  const [pg, setPg] = useState(1), [d, setD] = useState({ items: [], pages: 1 });
  const load = () => api.get('/bookings/mine', { params: { page: pg } }).then(r => setD(r.data));
  useEffect(() => { load(); }, [pg]);
  const cancel = id => api.patch(`/bookings/${id}/cancel`).then(() => { toast.info('Cancelled, refund issued'); load(); }).catch(() => {});
  return (<>
    <h4>My Bookings</h4>
    {d.items.map(b => {
      const up = b.status === 'confirmed' && new Date(b.show.startTime) > Date.now();
      return (
        <div className="card mb-2" key={b._id}><div className="card-body d-flex justify-content-between align-items-center">
          <div><b>{b.show.movie?.title}</b> — {b.show.theatre?.name}<br />
            <small>{fmt(b.show.startTime)} • Seats {b.seats.join(', ')} • {b.amount}</small></div>
          <div>
            <span className={'badge me-2 bg-' + (b.status === 'cancelled' ? 'danger' : up ? 'success' : 'secondary')}>
              {b.status === 'cancelled' ? 'cancelled' : up ? 'upcoming' : 'past'}</span>
            {up && <button className="btn btn-sm btn-outline-danger" onClick={() => cancel(b._id)}>Cancel</button>}
          </div>
        </div></div>);
    })}
    {!d.items.length && <p className="text-muted">No bookings yet.</p>}
    <Pager pg={pg} pages={d.pages} set={setPg} />
  </>);
}
