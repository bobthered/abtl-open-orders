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

// express view engine
app.set('view engine', 'ejs');

// app routes
app.get('/', (req, res) => {
  res.render('routes/index');
});

app.post('/signup', async (req, res) => {
  const user = new User(req.body);
  try {
    await user.save();
    res.status(200).send({ message: 'Success' });
  } catch (error) {
    console.log(error);
    res.status(409).send({ message: `Email "${email}" already exists` });
  }
});

app.post('/fixdb', async (req, res) => {
  // get all orders
  const orders = await Order.find();

  // update the date
  await Order.updateMany({ complete: true }, { shipDate: Date.now() });
  // await Promise.all(
  //   orders.map(async order => {
  //     const _id = order._id;
  //     // const orderDate =
  //     //   order.orderDate === '' ? '' : new Date(order.orderDate).getTime();
  //     // const requestedDate =
  //     //   order.requestedDate === ''
  //     //     ? ''
  //     //     : new Date(order.requestedDate).getTime();

  //     await Order.findOneAndUpdate({ _id }, { shipDate: Date.now() });
  //   }),
  // );
  res.status(200).send({ message: 'Success' });
});

// start express server
const server = app.listen(process.env.PORT || 5500, () => {
  console.log(`Listening at http://localhost:${process.env.PORT}`);
});

// socket.io setup
const io = socketio(server);

// listen for socket.io connection
io.on('connection', socket => {
  // log connection
  // console.log('SOCKET.IO - a user connected');

  // on addNavision
  socket.on('addNavision', async (req, revision, cb) => {
    // remove all previous orders
    // await Order.deleteMany({ complete: true });

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

    // column types
    const columnTypes = {
      date: {
        columns: ['Order Date', 'Requested Delivery Date'],
        format: s =>
          s === '' ? '' : new Date(s).getTime() + +process.env.TIME_OFFSET,
      },
    };

    // get data
    let orders = req.data.split(/\n\s*/g).map(a => a.split(/\t/g));

    // get header
    const header = orders.shift();

    // add each order
    await Promise.all(
      orders.map(async (arr, i) => {
        // init obj
        const obj = {};

        // get all column values
        Object.keys(columns).forEach(column => {
          obj[columns[column]] = arr[header.indexOf(column)];
          // loop through columnTypes
          Object.keys(columnTypes).forEach(type => {
            if (columnTypes[type].columns.indexOf(column) !== -1) {
              obj[columns[column]] = columnTypes[type].format(
                arr[header.indexOf(column)],
              );
            }
          });
        });

        // add revision
        // obj.revision = [revision];

        // create new document
        const order = await Order.findOneAndUpdate({ order: obj.order }, obj, {
          upsert: true,
          setDefaultsOnInsert: true,
        });

        if (order === null)
          await Order.findOneAndUpdate(
            { order: obj.order },
            { revisions: [revision] },
          );
      }),
    );

    const today =
      Math.floor(new Date().getTime() / (1000 * 60 * 60 * 24)) *
      1000 *
      60 *
      60 *
      24;

    orders = await Order.find({
      $or: [{ shipDate: '' }, { shipDate: { $gte: today } }],
    });

    // send to all other clients
    socket.broadcast.emit('addNavision', orders);

    return cb(orders);
  });

  // on findOrder
  socket.on('findOneOrder', async (params, cb) => {
    // set defaults
    const defaults = { where: {}, select: {} };

    // merge defaults with params
    params = { ...defaults, ...params };

    // find order
    const order =
      Object.keys(params.select).length === 0
        ? await Order.findOne(params.where)
        : await Order.findOne(params.where).select(params.select);

    // return order
    return cb(order);
  });

  // on findOrders
  socket.on('findOrders', async (params, cb) => {
    // set defaults
    const defaults = { where: {}, select: {} };

    // merge defaults with params;
    params = { ...defaults, ...params };

    // find orders
    const orders =
      Object.keys(params.select).length === 0
        ? await Order.find(params.where)
        : await Order.find(params.where).select(params.select);

    // return orders
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
  // on removeOrder
  socket.on('removeOrder', async req => {
    // get user _id
    const { _id } = req;

    try {
      await Order.findOneAndDelete({ _id });
      socket.broadcast.emit('removeOrder', _id);
    } catch (error) {
      console.log(error);
    }
  });
  // on removeUser
  socket.on('removeUser', async req => {
    // get user _id
    const { _id } = req;

    try {
      await User.findOneAndRemove({ _id });
      socket.broadcast.emit('removeUser', _id);
    } catch (error) {}
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
