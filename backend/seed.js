import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, Movie, Theatre, Show, Booking, Payment, Notification } from './models.js';
await mongoose.connect(process.env.MONGO_URI);
await Promise.all([User, Movie, Theatre, Show, Booking, Payment, Notification].map(M => M.deleteMany()));
await User.create({ name: 'Admin', email: 'admin@imovies.com', password: await bcrypt.hash('admin123', 10), role: 'admin' });
const t = n => `https://placehold.co/300x450?text=${encodeURIComponent(n)}`;
const movies = await Movie.insertMany([
  ['Space Run', 'Action', 'English', 125], ['Love in Monsoon', 'Romance', 'Hindi', 140],
  ['Laugh Riot', 'Comedy', 'English', 110], ['Dark Harbor', 'Thriller', 'Arabic', 130]
].map(([title, g, language, duration], i) => ({ title, description: `${title} - a ${g.toLowerCase()} film.`, genre: [g], language, duration, poster: t(title), releaseDate: new Date(Date.now() - i * 864e5 * 7) })));
const theatres = await Theatre.insertMany([{ name: 'Cineplex Central', city: 'Indore' }, { name: 'Star Cinema', city: 'Kuwait City', rows: 6, cols: 8 }]);
const shows = [];
for (const m of movies) for (const th of theatres) for (let d = 1; d <= 3; d++) for (const h of [18, 21]) {
  const x = new Date(); x.setDate(x.getDate() + d); x.setHours(h, 0, 0, 0);
  shows.push({ movie: m._id, theatre: th._id, startTime: x, price: 150 });
}
await Show.insertMany(shows);
console.log('Seeded. Admin: admin@imovies.com / admin123');
process.exit(0);
