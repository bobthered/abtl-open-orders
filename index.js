// libraries
const bcrypt = require('bcrypt');
const express = require('express');
const mongoose = require('mongoose');
const socketio = require('socket.io');

// dotenv
require('dotenv').config();

// mongodb
const mongoConnection = mongoose.connect(
  process.env.MONGO_PREFIX + process.env.MONGO_DB + process.env.MONGO_SUFFIX,
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: false,
  },
);
const Order = require('./src/mongoose/schema/mongoose.schema.order');
const User = require('./src/mongoose/schema/mongoose.schema.user');

// initiate express app
const app = express();

// express middleware
app.use(express.static(__dirname + '/public'));
app.use(express.json());

// app routes
app.get('/', (req, res) => {
  res.sendFile('public/index.html', { root: __dirname });
});

app.post('/signup', async (req, res) => {
  // const { first, last, email, password, type } = req.body;
  const user = new User(req.body);
  try {
    await user.save();
    res.status(200).send({ message: 'Success' });
  } catch (error) {
    console.log(error);
    res.status(409).send({ message: `Email "${email}" already exists` });
  }
});

// start express server
const server = app.listen(process.env.EXPRESS_PORT, () => {
  console.log(`Listening at http://localhost:${process.env.EXPRESS_PORT}`);
});

// socket.io setup
const io = socketio(server);

// listen for socket.io connection
io.on('connection', socket => {
  // log connection
  // console.log('SOCKET.IO - a user connected');

  // on addNavision
  socket.on('addNavision', async (req, cb) => {
    // remove all previous orders
    await Order.deleteMany({ complete: true });

    // column name reference
    const columns = {
      'No.': 'order',
      'Sell-to Customer Name': 'account',
      'Sell-to Customer No.': 'cunumber',
      'Order Date': 'orderDate',
      'Requested Delivery Date': 'requestedDate',
      'First Item Desc.': 'description',
      'Territory Code': 'territory',
      'Amount': 'amount',
      'Location Code': 'building',
    };

    // get data
    let orders = req.data.split(/\n\s*/g).map(a => a.split(/\t/g));

    // get header
    const header = orders.shift();

    // add each order
    orders = await Promise.all(
      orders.map(async arr => {
        // get so#
        const orderNumber = arr[header.indexOf('No.')];

        // check if order already in list
        const orderLookup = await Order.findOne({ order: orderNumber });

        if (!orderLookup) {
          // init obj
          const obj = {};

          // get all column values
          Object.keys(columns).forEach(column => {
            obj[columns[column]] = arr[header.indexOf(column)];
          });

          // create new document
          const order = new Order(obj);

          // save document
          await order.save();

          return order;
        } else {
          return orderLookup;
        }
      }),
    );

    // send to all other clients
    socket.broadcast.emit('addNavision', orders);

    return cb(orders);
  });

  // on findAllOrders
  socket.on('findAllOrders', async cb => {
    // find all users
    const orders = await Order.find();

    return cb(orders);
  });

  // on findAllUsers
  socket.on('findAllUsers', async cb => {
    // find all users
    const users = await User.find();

    return cb({ users });
  });

  // on onboard
  socket.on('onboard', async (req, cb) => {
    // get credentials
    let { email, password, passwordRetype } = req;

    // check if passwords do not match
    if (password !== passwordRetype)
      return cb({ error: { message: 'Passwords do not match', code: 401 } });

    password = bcrypt.hashSync(password, 10);

    // lookup a user
    const user = await User.findOneAndUpdate(
      { email },
      { password, onboarded: true },
      { new: true },
    );

    // return credentials
    return cb({ user });
  });
  // on signup
  socket.on('signin', async (req, cb) => {
    // get credentials
    const { email, password } = req;

    try {
      // lookup a user
      const user = await User.findOne({ email }).exec();

      // email doesn't exist or is not active
      if (!user || !user.active)
        return cb({
          error: {
            message: `Could not find email "${email}"`,
            code: 404,
          },
        });

      // check if password matches
      if (!bcrypt.compareSync(password, user.password))
        return cb({
          error: { message: 'Could not verify credentials', code: 401 },
        });

      // remove password from return
      delete user.password;

      // return credentials
      return cb({ user });
    } catch (error) {
      cb({ error: { message: 'Could not connect to db', code: 500 } });
    }
  });

  // on signup
  socket.on('signup', async (req, cb) => {
    // const {first, last, email, password, type } = req;
    const user = new User(req);
    try {
      await user.save();
      socket.broadcast.emit('addUser', user);
      return cb({ user });
    } catch (error) {
      console.log(error);
      return cb({ error: { message: 'Email already exists', code: 409 } });
    }
  });

  // on updateOrder
  socket.on('updateOrder', async (where, update, cb) => {
    const order = await Order.findOneAndUpdate(where, update, { new: true });
    socket.broadcast.emit('updateOrder', order);
  });
  // on updateUser
  socket.on('updateUser', async (where, update, cb) => {
    const user = await User.findOneAndUpdate(where, update, { new: true });
    socket.broadcast.emit('updateUser', user);
  });
});
