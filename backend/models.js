import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const ref = n => ({ type: Schema.Types.ObjectId, ref: n, required: true });

export const User = model('User', new Schema({
  name: { type: String, required: true }, email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true }, role: { type: String, enum: ['user', 'admin'], default: 'user' }
}, { timestamps: true }));

const movieS = new Schema({ title: { type: String, required: true }, description: String, genre: [String], language: String,
  duration: Number, poster: String, releaseDate: Date }, { timestamps: true });
movieS.index({ title: 1 }); movieS.index({ genre: 1, language: 1 });
export const Movie = model('Movie', movieS);

export const Theatre = model('Theatre', new Schema({ name: { type: String, required: true }, city: { type: String, required: true, index: true },
  rows: { type: Number, default: 8, max: 26 }, cols: { type: Number, default: 10, max: 40 } }));

const showS = new Schema({ movie: ref('Movie'), theatre: ref('Theatre'), startTime: { type: Date, required: true },
  price: { type: Number, required: true }, bookedSeats: { type: [String], default: [] } });
showS.index({ movie: 1, startTime: 1 }); showS.index({ theatre: 1, startTime: 1 });
export const Show = model('Show', showS);

const bookS = new Schema({ user: ref('User'), show: ref('Show'), seats: [String], amount: Number,
  status: { type: String, enum: ['confirmed', 'cancelled'], default: 'confirmed' } }, { timestamps: true });
bookS.index({ user: 1, createdAt: -1 });
export const Booking = model('Booking', bookS);

export const Payment = model('Payment', new Schema({ booking: { type: Schema.Types.ObjectId, ref: 'Booking' }, user: ref('User'),
  amount: Number, status: { type: String, enum: ['success', 'failed', 'refunded'] }, txnId: String }, { timestamps: true }));

export const Notification = model('Notification', new Schema({ user: ref('User'), message: String, read: { type: Boolean, default: false } },
  { timestamps: true }));
