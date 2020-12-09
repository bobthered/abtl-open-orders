// libraries
const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  paidRush: {
    type: Boolean,
    default: false,
  },
  order: String,
  account: String,
  cunumber: String,
  orderDate: mongoose.Schema.Types.Mixed,
  requestedDate: mongoose.Schema.Types.Mixed,
  shipDate: {
    type: mongoose.Schema.Types.Mixed,
    default: '',
  },
  description: String,
  territory: String,
  amount: String,
  building: String,
  complete: {
    type: Boolean,
    default: false,
  },
  notes: [
    {
      type: String,
    },
  ],
  revisions: [
    {
      date: String,
      revision: String,
      user: String,
    },
  ],
});

module.exports = mongoose.model('Order', OrderSchema);
