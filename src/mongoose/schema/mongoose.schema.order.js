// libraries
const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  order: String,
  account: String,
  cunumber: String,
  orderDate: String,
  requestedDate: String,
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
