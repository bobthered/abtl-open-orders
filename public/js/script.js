import sortable from '../lib/sortable/sortable.es6.js';
import sortableSortFunc from './sortFunction.js';

/********************************************************************/
/************************** SERVICE WORKER **************************/
/********************************************************************/
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('./sw.js')
    .then(() => console.log('service worker registered'))
    .catch(err => console.log('service worker not registered', err));
}
/********************************************************************/
/************************** SERVICE WORKER **************************/
/********************************************************************/

// make variables globally available
let node, filterType, socket;

document.addEventListener('DOMContentLoaded', async () => {
  // cache query selectors
  node = {
    filters: document.querySelectorAll('filter button'),
    form: {
      addNavision: document.querySelector('[data-form="add-navision'),
      addUser: document.querySelector('[data-form="add-user"]'),
      onboard: document.querySelector('[data-form="onboard"]'),
      signin: document.querySelector('[data-form="signin"]'),
    },
    header: document.querySelector('header'),
    onboard: document.querySelector('onboard'),
    orders: {
      tbody: document.querySelector('[data-page="orders"] tbody'),
      template: document.querySelector('[data-page="orders"] template').content,
    },
    menu: document.querySelector('[data-menu]'),
    pages: document.querySelectorAll('[data-page]'),
    signin: document.querySelector('signin'),
    signout: document.querySelector('[data-signout]'),
    spinner: document.querySelector('spinner'),
    showPages: document.querySelectorAll('[data-show-page]'),
    users: {
      tbody: document.querySelector('[data-page="users"] tbody'),
      template: document.querySelector('[data-page="users"] template').content,
    },
  };

  // socket.io
  socket = io();

  // initiate filter type to all
  filterType = 'all';

  // filter listeners
  node.filters.forEach(addFilterListener);

  // form listeners
  node.form.addNavision.addEventListener('submit', addNavision);
  node.form.addUser.addEventListener('submit', addUser);
  node.form.onboard.addEventListener('submit', user.onboard);
  node.form.signin.addEventListener('submit', signinUser);

  // sign out listener
  node.signout.addEventListener('click', user.signout);

  // show pages listeners
  node.showPages.forEach(addShowPageListener);

  // check if already logged in
  if (localStorage.getItem('user'))
    user.signin(JSON.parse(localStorage.getItem('user')));

  // check if not logged in
  if (!localStorage.getItem('user')) spinner.hide();

  // add sortable
  sortable(document, sortableSortFunc);

  // global sockets
  socket.on('addNavision', orders => {
    table.clear();
    orders
      .sort((a, b) =>
        a.requestedDate === ''
          ? 1
          : b.requestedDate === ''
          ? -1
          : convertDateString(a.requestedDate) <
            convertDateString(b.requestedDate)
          ? -1
          : 1,
      )
      .forEach(addOrder);
  });
  socket.on('addUser', users.add);
  socket.on('removeUser', users.remove);
  socket.on('updateOrder', updateOrder);
  socket.on('updateUser', users.update);
});

const addFilterListener = elem => {
  // set current filter button function
  const setCurrent = () => {
    node.filters.forEach(button => button.classList.remove('current'));
    elem.classList.add('current');
    filterType = elem.getAttribute('data-filter');
  };

  // add event listener
  elem.addEventListener('click', () => {
    // set current filter button
    setCurrent();

    // update table
    table.update();
  });
};
const addNavision = e => {
  // prevent default form submission
  e.preventDefault();

  // reset form
  form.reset(e.target);

  // show spinner
  spinner.show();

  // send credentials to server
  socket.emit('addNavision', form.serialize(e.target), data => {
    table.clear();
    form.clear(e.target);
    data
      .sort((a, b) =>
        a.requestedDate === ''
          ? 1
          : b.requestedDate === ''
          ? -1
          : convertDateString(a.requestedDate) <
            convertDateString(b.requestedDate)
          ? -1
          : 1,
      )
      .forEach(addOrder);
    page.show('orders');
    spinner.hide();
  });
};
const addOrder = obj => {
  // complete toggle event listener function
  const completeToggle = e => {
    const tr = e.target.closest('tr');
    tr.classList.toggle('complete');
    const _id = tr.getAttribute('data-id');
    const complete = e.target.checked;
    socket.emit('updateOrder', { _id }, { complete });
    table.update();
  };

  // update information function
  const updateField = field => {
    // get update field nodes
    const elems = clone.querySelectorAll(`[data-field="${field}"]`);

    elems.forEach(elem => {
      // check field nodeName
      if (elem.nodeName === 'INPUT') elem.checked = obj[field];
      if (elem.nodeName === 'TD') elem.innerHTML = obj[field];
    });
  };

  // clone template
  const clone = node.orders.template.cloneNode(true);

  // update information
  [
    'complete',
    'order',
    'requestedDate',
    'account',
    'cunumber',
    'territory',
    'building',
  ].forEach(updateField);

  // update complete toggle
  clone.querySelector('input').checked = obj.complete;
  clone
    .querySelector('tr')
    .classList[obj.complete ? 'add' : 'remove']('complete');

  // complete toggle event listener
  clone.querySelector('input').addEventListener('click', completeToggle);

  // set row id
  clone.querySelector('tr').setAttribute('data-id', obj._id);

  // check if late
  if (
    convertDateString(obj.requestedDate) <
    Math.floor(Date.now() / (1000 * 60 * 60 * 24)) * (1000 * 60 * 60 * 24)
  )
    clone.querySelector('tr').classList.add('late');

  // append clone to tbody
  node.orders.tbody.appendChild(clone);
};
const addShowPageListener = elem => {
  elem.addEventListener('click', () => {
    // get page id
    const id = elem.getAttribute('data-show-page');

    // show page
    page.show(id);
  });
};
const addUser = e => {
  // prevent default form submission
  e.preventDefault();

  // reset form
  form.reset(e.target);

  // show spinner
  spinner.show();

  // send credentials to server
  socket.emit('signup', form.serialize(e.target), data => {
    // check if error
    if ('error' in data) {
      if (data.error.code === 409)
        e.target.querySelector('[name="email"]').classList.add('error');
    } else {
      form.clear(e.target);
      users.add(data.user);
    }
    spinner.hide();
  });
};
const convertDateString = s => {
  s = s.split('/');
  return new Date(2000 + +s[2], s[0] - 1, s[1]).getTime();
};
const form = {
  clear: elem => {
    [...elem.elements].forEach(elem => {
      if (
        elem.hasAttribute('name') &&
        elem.getAttribute('type') !== 'hidden' &&
        elem.nodeName !== 'SELECT'
      )
        elem.value = '';
    });
  },
  reset: elem => {
    [...elem.elements].forEach(elem => elem.classList.remove('error'));
  },
  serialize: elem => {
    // init obj
    const obj = {};

    // loop through all form inputs
    [...elem.elements].forEach(elem => {
      if (elem.hasAttribute('name'))
        obj[elem.getAttribute('name')] = elem.value;
    });

    return obj;
  },
};
const header = {
  reset: () => {
    [...node.header.querySelectorAll('button')].forEach(elem =>
      elem.classList.add('hidden'),
    );
    node.header.classList.remove(
      ...[
        'grid-cols-1',
        'grid-cols-2',
        'grid-cols-3',
        'grid-cols-4',
        'grid-cols-5',
      ],
    );
  },
  update: () => {
    header.reset();
    [
      ...node.header.querySelectorAll(
        `button[data-${user.data.type.toLowerCase()}]`,
      ),
    ].forEach(elem => elem.classList.remove('hidden'));
    node.header.classList.add(
      `grid-cols-${
        [...node.header.querySelectorAll('button:not(.hidden)')].length
      }`,
    );
  },
};
const loadData = async () => {
  await new Promise(res => {
    socket.emit('findAllOrders', orders => {
      orders
        .sort((a, b) =>
          a.requestedDate === ''
            ? 1
            : b.requestedDate === ''
            ? -1
            : convertDateString(a.requestedDate) <
              convertDateString(b.requestedDate)
            ? -1
            : 1,
        )
        .forEach(addOrder);
      res();
    });
  });
};
const onboard = {
  hide: () => {
    node.onboard.classList.add('pointer-events-none');
    node.onboard.classList.remove('opacity-100');
  },
  show: () => {
    node.onboard.querySelector('[name="email"]').value = user.data.email;
    node.onboard.classList.remove('pointer-events-none');
    node.onboard.classList.add('opacity-100');
  },
};
const page = {
  hide: (id = null) => {
    if (id === null)
      [...node.pages].forEach(elem =>
        elem.classList.add('opacity-0', 'pointer-events-none'),
      );
    if (id !== null)
      document
        .querySelector(`[data-page="${id}"]`)
        .classList.add('opacity-0', 'pointer-events-none');
  },
  show: id => {
    page.hide();
    document
      .querySelector(`[data-page="${id}"]`)
      .classList.remove('opacity-0', 'pointer-events-none');
  },
};
const signinUser = e => {
  // prevent default form submission
  e.preventDefault();

  // reset form
  form.reset(e.target);

  // show spinner
  spinner.show();

  // send credentials to server
  socket.emit('signin', form.serialize(e.target), async data => {
    // check if error
    if ('error' in data) {
      if (data.error.code === 401)
        e.target.querySelector('[name="password"]').classList.add('error');
      if (data.error.code === 404)
        e.target.querySelector('[name="email"]').classList.add('error');
      spinner.hide();
    } else {
      await user.signin(data.user);
      form.clear(e.target);
    }
  });
};
const spinner = {
  hide: () => {
    node.spinner.classList.add('pointer-events-none');
    node.spinner.classList.remove('opacity-100');
  },
  show: () => {
    node.spinner.classList.add('opacity-100');
    node.spinner.classList.remove('pointer-events-none');
  },
};
const table = {
  clear: () => (node.orders.tbody.innerHTML = ''),
  update: () => {
    // hide all table rows function
    const tableRows = {
      hide: () =>
        node.orders.tbody
          .querySelectorAll('tr')
          .forEach(elem => elem.classList.add('hidden')),
      show: elems => elems.forEach(elem => elem.classList.remove('hidden')),
    };

    // hide all table rows
    tableRows.hide();

    // update complete

    let querySelector;
    if (filterType === 'all') querySelector = 'tr';
    if (filterType === 'complete') querySelector = 'tr.complete';
    if (filterType === 'open') querySelector = 'tr:not(.complete)';
    if (filterType === 'late') querySelector = 'tr.late';
    tableRows.show([...node.orders.tbody.querySelectorAll(querySelector)]);
  },
};
const updateOrder = obj => {
  // update information function
  const updateField = field =>
    (tr.querySelector(`[data-field="${field}"]`).innerHTML = obj[field]);

  // get tr element
  const tr = node.orders.tbody.querySelector(`tr[data-id="${obj._id}"]`);

  // update information
  [
    'order',
    'requestedDate',
    'account',
    'cunumber',
    'territory',
    'building',
  ].forEach(updateField);

  // get complete toggle
  tr.querySelectorAll('input').forEach(elem => (elem.checked = obj.complete));
  tr.classList[obj.complete ? 'add' : 'remove']('complete');

  // check if late
  if (
    convertDateString(obj.requestedDate) <
    Math.floor(Date.now() / (1000 * 60 * 60 * 24)) * (1000 * 60 * 60 * 24)
  )
    tr.classList.add('late');

  table.update();
};
const user = {
  data: {},
  onboard: e => {
    // prevent default form submission
    e.preventDefault();

    // reset form
    form.reset(e.target);

    // show spinner
    spinner.show();

    // send credentials to server
    socket.emit('onboard', form.serialize(e.target), data => {
      // check if error
      if ('error' in data) {
        if (data.error.code === 401)
          e.target
            .querySelector('[name="passwordRetype"]')
            .classList.add('error');
        spinner.hide();
      } else {
        form.clear(e.target);
        onboard.hide();
        user.signin(data.user);
      }
    });
  },
  signin: async (data = null) => {
    if (data !== null) {
      user.data = data;
      localStorage.setItem('user', JSON.stringify(user.data));
    }
    header.update();
    table.clear();
    users.clear();
    await Promise.all([users.findAll(), loadData()]);
    user.updateType();
    node.signin.classList.remove('opacity-100');
    node.signin.classList.add('pointer-events-none');
    if (user.data.onboarded === false) {
      onboard.show();
    } else {
      page.show('orders');
    }
    spinner.hide();
  },
  signout: () => {
    localStorage.removeItem('user');
    node.signin.classList.add('opacity-100');
    node.signin.classList.remove('pointer-events-none');
    page.hide();
  },
  updateType: () => {
    document
      .querySelectorAll(
        '[data-admin], [data-super], [data-shipping], [data-user]',
      )
      .forEach(elem => elem.classList.add('hidden'));
    document
      .querySelectorAll(`[data-${user.data.type.toLowerCase()}]`)
      .forEach(elem => elem.classList.remove('hidden'));
  },
};
const users = {
  add: obj => {
    // complete toggle event listener function
    const activeComplete = e => {
      // check if active or not
      const active = e.target.checked;

      // get _id
      const _id = e.target.closest('tr').getAttribute('data-id');

      // send socket request
      socket.emit('updateUser', { _id }, { active }, data => {
        console.log(data);
      });
    };

    // remove user
    const removeUser = e => {
      const tr = e.target.closest('tr');
      const _id = tr.getAttribute('data-id');
      socket.emit('removeUser', { _id });
      tr.parentNode.removeChild(tr);
    };

    // update information function
    const updateField = field =>
      (clone.querySelector(`[data-field="${field}"]`).innerHTML = obj[field]);

    // clone template
    const clone = node.users.template.cloneNode(true);

    // update the tr with the _id
    clone.querySelector('tr').setAttribute('data-id', obj._id);

    // update information
    ['first', 'last', 'email', 'type'].forEach(updateField);

    // update active
    clone.querySelector('input').checked = obj.active;

    // complete toggle event listener
    clone.querySelector('input').addEventListener('click', activeComplete);

    // remove user event listener
    clone
      .querySelector('[data-button="delete"]')
      .addEventListener('click', removeUser);

    // append clone to tbody
    node.users.tbody.appendChild(clone);

    // sort the users
    users.sort();
  },
  clear: () => (node.users.tbody.innerHTML = ''),
  findAll: async () => {
    await new Promise((res, req) => {
      socket.emit('findAllUsers', data => {
        data.users
          .sort((a, b) => a.first.localeCompare(b.first))
          .forEach(users.add);
        res();
      });
    });
  },
  remove: _id => {
    const tr = node.users.tbody.querySelector(`tr[data-id="${_id}"]`);
    tr.parentNode.removeChild(tr);
  },
  sort: () => {
    [...node.users.tbody.querySelectorAll('tr')]
      .sort((a, b) =>
        `${a.querySelector('[data-field="first"]').innerHTML} ${
          a.querySelector('[data-field="last"]').innerHTML
        }`.localeCompare(
          `${b.querySelector('[data-field="first"]').innerHTML} ${
            b.querySelector('[data-field="last"]').innerHTML
          }`,
        ),
      )
      .forEach(elem => node.users.tbody.appendChild(elem));
  },
  update: obj => {
    // check if user is current user
    if (obj.email === user.data.email && obj.active === false) {
      return user.signout();
    }
    // update information function
    const updateField = field =>
      (tr.querySelector(`[data-field="${field}"]`).innerHTML = obj[field]);

    // get tr
    const tr = node.users.tbody.querySelector(`[data-id="${obj._id}"]`);

    // update information
    ['first', 'last', 'email', 'type'].forEach(updateField);

    // update active
    tr.querySelector('input').checked = obj.active;
  },
};
