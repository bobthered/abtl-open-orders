// libraries
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');

// salt factor
const SALT_WORK_FACTOR = 10;

const UserSchema = new mongoose.Schema({
  active: {
    type: Boolean,
    default: true,
  },
  first: {
    type: String,
    required: [true, 'First name is required'],
  },
  last: {
    type: String,
    required: [true, 'Last name is required'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    index: { unique: true },
  },
  onboarded: {
    type: Boolean,
    default: false,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
  },
  type: {
    type: String,
    default: 'User',
  },
});

UserSchema.pre('save', function (next) {
  this.password = bcrypt.hashSync(this.password, SALT_WORK_FACTOR);
  next();
});

module.exports = mongoose.model('User', UserSchema);
