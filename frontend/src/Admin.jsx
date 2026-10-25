import { useEffect, useState } from 'react';
import api from './api';

function Crud({ path, fields, cols, tf = x => x }) {
  const [rows, setR] = useState([]), [f, setF] = useState({});
  const load = () => api.get(path, { params: { limit: 50 } }).then(r => setR(r.data.items || r.data));
  useEffect(() => { load(); }, []);
  const add = async e => { e.preventDefault(); await api.post(path, tf(f)); setF({}); load(); };
  const del = id => api.delete(`${path}/${id}`).then(load);
  return (<>
    <form onSubmit={add} className="row g-2 mb-3">
      {fields.map(({ k, p, t = 'text', opts }) => (
        <div className="col-6 col-md-3" key={k}>
          {opts ? (
            <select className="form-select" required value={f[k] || ''} onChange={e => setF({ ...f, [k]: e.target.value })}>
              <option value="">{p}</option>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          ) : <input className="form-control" type={t} placeholder={p} title={p} required={k !== 'description' && k !== 'poster'}
            value={f[k] || ''} onChange={e => setF({ ...f, [k]: e.target.value })} />}
        </div>))}
      <div className="col-auto"><button className="btn btn-primary">Add</button></div>
    </form>
    <table className="table table-sm align-middle">
      <thead><tr>{cols.map(([h]) => <th key={h}>{h}</th>)}<th /></tr></thead>
      <tbody>{rows.map(x => (
        <tr key={x._id}>{cols.map(([h, fn]) => <td key={h}>{fn(x)}</td>)}
          <td><button className="btn btn-sm btn-outline-danger" onClick={() => del(x._id)}>Delete</button></td></tr>))}</tbody>
    </table>
  </>);
}

export default function Admin() {
  const [tab, setTab] = useState('movies'), [st, setSt] = useState({}), [mv, setMv] = useState([]), [th, setTh] = useState([]);
  useEffect(() => {
    api.get('/admin/stats').then(r => setSt(r.data));
    api.get('/movies', { params: { limit: 50 } }).then(r => setMv(r.data.items));
    api.get('/theatres').then(r => setTh(r.data));
  }, [tab]);
  const T = {
    movies: { path: '/movies',
      fields: [{ k: 'title', p: 'Title' }, { k: 'genre', p: 'Genres (comma separated)' }, { k: 'language', p: 'Language' },
        { k: 'duration', p: 'Duration (min)', t: 'number' }, { k: 'poster', p: 'Poster URL' }, { k: 'description', p: 'Description' }],
      cols: [['Title', x => x.title], ['Language', x => x.language], ['Genre', x => x.genre?.join(', ')]],
      tf: f => ({ ...f, genre: (f.genre || '').split(',').map(s => s.trim()).filter(Boolean) }) },
    theatres: { path: '/theatres',
      fields: [{ k: 'name', p: 'Name' }, { k: 'city', p: 'City' }, { k: 'rows', p: 'Rows (max 26)', t: 'number' }, { k: 'cols', p: 'Seats per row', t: 'number' }],
      cols: [['Name', x => x.name], ['City', x => x.city], ['Layout', x => `${x.rows}×${x.cols}`]] },
    shows: { path: '/shows',
      fields: [{ k: 'movie', p: 'Movie', opts: mv.map(m => [m._id, m.title]) }, { k: 'theatre', p: 'Theatre', opts: th.map(t => [t._id, `${t.name} (${t.city})`]) },
        { k: 'startTime', p: 'Start time', t: 'datetime-local' }, { k: 'price', p: 'Price', t: 'number' }],
      cols: [['Movie', x => x.movie?.title], ['Theatre', x => x.theatre?.name], ['Start', x => new Date(x.startTime).toLocaleString()], ['Price', x => x.price], ['Booked', x => x.bookedSeats.length]],
      tf: f => ({ ...f, startTime: new Date(f.startTime).toISOString() }) }
  };
  return (<>
    <div className="row g-2 mb-3 text-center">
      {Object.entries(st).map(([k, v]) => <div className="col-6 col-md-3" key={k}><div className="card p-2"><small className="text-muted text-capitalize">{k}</small><b>{v}</b></div></div>)}
    </div>
    <ul className="nav nav-tabs mb-3">{Object.keys(T).map(k => (
      <li className="nav-item" key={k}><button className={'nav-link text-capitalize ' + (tab === k ? 'active' : '')} onClick={() => setTab(k)}>{k}</button></li>))}</ul>
    <Crud key={tab} {...T[tab]} />
  </>);
}
