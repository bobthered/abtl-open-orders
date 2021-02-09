import moment from '../lib/moment/moment.js';
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
    modal: {
      body: document.querySelector('modal .body'),
      container: document.querySelector('modal'),
      closes: document.querySelectorAll('[data-modal-close]'),
      title: document.querySelector('modal .title'),
    },
    page: {
      nodes: document.querySelectorAll('[data-page]'),
    },
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

  // modal closes listeners
  node.modal.closes.forEach(elem => elem.addEventListener('click', modal.hide));

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
      .sort((a, b) => (a.requestedDate < b.requestedDate ? -1 : 1))
      .forEach(addOrder);
    user.updateType();
  });
  socket.on('addUser', users.add);
  socket.on('removeOrder', removeOrder);
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

  // set revision
  const revision = {};
  revision.date = currentDateString();
  revision.revision = 'Added from Navision';
  revision.user = `${user.data.first} ${user.data.last}`;

  // send credentials to server
  socket.emit('addNavision', form.serialize(e.target), revision, data => {
    table.clear();
    form.clear(e.target);
    data
      .sort((a, b) => (a.requestedDate < b.requestedDate ? -1 : 1))
      .forEach(addOrder);
    user.updateType();
    page.show('orders');
    spinner.hide();
  });
};
const addOrder = obj => {
  // add note event listener function
  const addNoteEventListener = e => {
    // get tr
    const tr = e.target.closest('tr');

    // get order _id
    const _id = tr.getAttribute('data-id');

    // get order so
    const order = tr.querySelector('[data-field="order"]').innerHTML;

    // set body
    const body =
      '<form class="w-96 flex flex-col space-y-4 items-end"><textarea class="h-48 w-full resize-none"></textarea><button>Add Note</button></form>';

    // show modal
    modal.show({
      body,
      title: `Add Note - ${order}`,
    });

    // add submit listener
    node.modal.body.querySelector('form').addEventListener('submit', e => {
      e.preventDefault();

      // get note
      const note = e.target.querySelector('textarea').value;

      // set revision
      const revision = {
        date: currentDateString(),
        revision: `Added Note - ${note}`,
        user: `${user.data.first} ${user.data.last}`,
      };

      // send update
      socket.emit(
        'updateOrder',
        { _id },
        { $push: { notes: note, revisions: revision } },
      );

      // hide modal
      modal.hide();

      // increment note button
      tr.querySelector('[data-field="notes"]').innerHTML =
        +tr.querySelector('[data-field="notes"]').innerHTML + 1;

      // increment revision button
      tr.querySelector('[data-field="revisions"]').innerHTML =
        +tr.querySelector('[data-field="revisions"]').innerHTML + 1;
    });
  };

  // complete toggle event listener function
  const completeToggle = e => {
    // get the id
    const { _id } = obj;

    // get the tr element
    const tr = e.target.closest('tr');

    // toggle complete class
    tr.classList.toggle('complete');

    // update complete date
    if (e.target.checked === true) obj.shipDate = Date.now();
    if (e.target.checked === false) obj.shipDate = '';
    socket.emit('updateOrder', { _id }, { shipDate: obj.shipDate });
    updateField('shipDate', tr);
  };

  // delete event listener function
  const deleteEventListener = e => {
    // get tr
    const tr = e.target.closest('tr');

    // get the _id
    const _id = tr.getAttribute('data-id');

    // get the so#
    const order = tr.querySelector('[data-field="order"]').innerHTML;

    // modal info
    const body = `<form class="flex flex-col space-y-8 text-gray-800"><p>Are you sure you want to delete <span class="font-bold">${order}</span>?</p><div class="flex justify-end space-x-4 w-full"><a href="#" class="px-2 py-3 rounded ring-1 ring-gray-400 ring-inset" data-modal-close>Cancel</a><button>Delete</button></div></form>`;
    const title = 'Delete Order';

    // show modal
    modal.show({ body, title });

    // modal close event listener
    node.modal.body
      .querySelector('[data-modal-close]')
      .addEventListener('click', modal.hide);

    // form submit event listener
    node.modal.body.querySelector('form').addEventListener('submit', e => {
      e.preventDefault();

      // send the delete socket
      socket.emit('removeOrder', { _id });

      // hide modal
      modal.hide();

      // remove the tr
      tr.parentNode.removeChild(tr);
    });
  };

  // input event listener function
  const inputEventListener = elem => {
    elem.addEventListener('change', e => {
      const tr = e.target.closest('tr');
      const _id = tr.getAttribute('data-id');
      const field = e.target.getAttribute('data-field');
      const update = {};
      if (
        e.target.nodeName === 'INPUT' &&
        elem.getAttribute('type') === 'checkbox'
      )
        update[field] = e.target.checked;
      if (e.target.nodeName === 'INPUT' && elem.getAttribute('type') === 'text')
        update[field] = e.target.value;
      socket.emit('updateOrder', { _id }, update);

      // check if is complete button
      if (field === 'complete') {
        const revision = {};
        revision.date = currentDateString();
        revision.revision = e.target.checked ? 'Completed' : 'Uncompleted';
        revision.user = `${user.data.first} ${user.data.last}`;
        tr.querySelector('[data-field="revisions"]').innerHTML =
          +tr.querySelector('[data-field="revisions"]').innerHTML + 1;
        socket.emit('updateOrder', { _id }, { $push: { revisions: revision } });
      }

      // check if is paid rush button
      if (field === 'paidRush') {
        const revision = {};
        revision.date = currentDateString();
        revision.revision = e.target.checked
          ? 'Added - Paid Rush'
          : 'Removed - Paid Rush';
        revision.user = `${user.data.first} ${user.data.last}`;
        tr.querySelector('[data-field="revisions"]').innerHTML =
          +tr.querySelector('[data-field="revisions"]').innerHTML + 1;
        socket.emit('updateOrder', { _id }, { $push: { revisions: revision } });
      }

      table.update();
    });
  };

  // note event listener function
  const noteEventListener = e => {
    // show spinner
    spinner.show();

    // get order _id
    const _id = e.target.closest('tr').getAttribute('data-id');

    socket.emit(
      'findOneOrder',
      { where: { _id }, select: { notes: 1, order: 1 } },
      data => {
        const body =
          '<div class="overflow-auto shadow" style="max-height:60vh"><table class="w-full"><thead><th>Note</th></thead><tbody>' +
          data.notes.map(note => `<tr><td>${note}</td></tr>`).join('\n') +
          '</tbody></table></div>';

        // hike spinner
        spinner.hide();

        // show modal
        modal.show({
          body,
          title: `Notes - ${data.order}`,
        });
      },
    );
  };

  // paid rush event listener function
  const paidRushEventListener = e => {
    // get the id
    const { _id } = obj;

    // get the tr element
    const tr = e.target.closest('tr');

    // get value
    const paidRush = e.target.checked;

    // change tr class
    tr.classList[paidRush ? 'add' : 'remove']('rush');

    // update complete date
    socket.emit('updateOrder', { _id }, { paidRush });
  };

  // revision event listener function
  const revisionEventListener = e => {
    // show spinner
    spinner.show();

    // get order _id
    const _id = e.target.closest('tr').getAttribute('data-id');

    socket.emit(
      'findOneOrder',
      { where: { _id }, select: { revisions: 1, order: 1 } },
      data => {
        const body =
          '<div class="overflow-auto shadow" style="max-height:60vh"><table class="w-full"><thead><th>Date</th><th>User</th><th>Revision</th></thead><tbody>' +
          data.revisions
            .reverse()
            .map(
              obj =>
                `<tr><td>${obj.date}</td><td>${obj.user}</td><td>${obj.revision}</td></tr>`,
            )
            .join('\n') +
          '</tbody></table></div>';

        // hike spinner
        spinner.hide();

        // show modal
        modal.show({
          body,
          title: `Revisions - ${data.order}`,
        });
      },
    );
  };

  // update information function
  const updateField = (field, tr = null) => {
    // get update field nodes
    const elems =
      tr !== null
        ? tr.querySelectorAll(`[data-field="${field}"]`)
        : clone.querySelectorAll(`[data-field="${field}"]`);

    elems.forEach(elem => {
      // check if field needs to be formatted
      if (elem.hasAttribute('data-field-format')) {
        if (elem.getAttribute('data-field-format') === 'currency') {
          elem.setAttribute('data-sort', parseFloat(obj[field]));
          obj[field] = '$' + parseFloat(obj[field]).toFixed(2);
        }
        if (elem.getAttribute('data-field-format') === 'date') {
          elem.setAttribute('data-sort', obj[field]);
          obj[field] =
            obj[field] === '' ? '' : moment(obj[field], 'x').format('M/D/YY');
        }
      }
      // update field
      if (elem.nodeName === 'BUTTON') elem.innerHTML = obj[field].length || 0;
      if (elem.nodeName === 'INPUT' && elem.getAttribute('type') === 'checkbox')
        elem.checked = obj[field];
      if (elem.nodeName === 'INPUT' && elem.getAttribute('type') === 'text')
        elem.value = obj[field];
      if (elem.nodeName === 'TD') elem.innerHTML = obj[field];
    });
  };

  // clone template
  const clone = node.orders.template.cloneNode(true);

  // update information
  [
    'complete',
    'paidRush',
    'order',
    'requestedDate',
    'shipDate',
    'account',
    'cunumber',
    'amount',
    'territory',
    'building',
    'revisions',
    'notes',
  ].forEach(field => updateField(field));

  // get tr elem
  const tr = clone.querySelector('tr');

  // check if complete
  tr.classList[obj.complete ? 'add' : 'remove']('complete');

  // check if late
  if (
    moment(obj.requestedDate, 'M/D/YY').format('x') <
    Math.floor(Date.now() / (1000 * 60 * 60 * 24)) * (1000 * 60 * 60 * 24)
  )
    tr.classList.add('late');

  // check if paid rush
  if (obj.paidRush) tr.classList.add('rush');

  // input event listeners
  clone.querySelectorAll('input, select, textarea').forEach(inputEventListener);

  // delete event listener
  clone
    .querySelector('[data-button="delete"]')
    .addEventListener('click', deleteEventListener);

  // revision event listener
  clone
    .querySelector('[data-field="revisions"]')
    .addEventListener('click', revisionEventListener);

  // note event listener
  clone
    .querySelector('[data-field="notes"]')
    .addEventListener('click', noteEventListener);

  // add note event listener
  clone
    .querySelector('[data-add-note]')
    .addEventListener('click', addNoteEventListener);

  // complete toggle event listener
  clone
    .querySelector('[data-field="complete"]')
    .addEventListener('click', completeToggle);

  // paid rush event listener
  clone
    .querySelector('[data-field="paidRush"]')
    .addEventListener('click', paidRushEventListener);

  // set row id
  tr.setAttribute('data-id', obj._id);

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
const currentDateString = () => {
  const date = new Date();
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()} @ ${
    date.getHours() % 12
  }:${('0' + date.getMinutes()).slice(-2)}:${('0' + date.getSeconds()).slice(
    -2,
  )} ${date.getHours() < 12 ? 'AM' : 'PM'}`;
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
  const today =
    Math.floor(new Date().getTime() / (1000 * 60 * 60 * 24)) *
    1000 *
    60 *
    60 *
    24;
  await new Promise(res => {
    socket.emit(
      'findOrders',
      { where: { $or: [{ shipDate: '' }, { shipDate: { $gte: today } }] } },
      orders => {
        orders
          .sort((a, b) => (a.requestedDate < b.requestedDate ? -1 : 1))
          .forEach(addOrder);
        res();
      },
    );
  });
};
const modal = {
  hide: (e = null) => {
    if (e !== null) e.preventDefault();
    node.modal.container.classList.add('pointer-events-none');
    node.modal.container.classList.remove('opacity-100');
  },
  show: params => {
    // update title
    if ('title' in params) node.modal.title.innerHTML = params.title;

    // update body
    if ('body' in params) node.modal.body.innerHTML = params.body;

    node.modal.container.classList.remove('pointer-events-none');
    node.modal.container.classList.add('opacity-100');
  },
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
      [...node.page.nodes].forEach(elem =>
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
const removeOrder = _id => {
  // find tr
  const tr = node.orders.tbody.querySelector(`tr[data-id="${_id}"]`);

  // remove tr
  tr.parentNode.removeChild(tr);
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
    if (filterType === 'paidRush') querySelector = 'tr.rush';
    tableRows.show([...node.orders.tbody.querySelectorAll(querySelector)]);
  },
};
const updateOrder = obj => {
  // update information function
  const updateField = field => {
    // get update field nodes
    const elems = tr.querySelectorAll(`[data-field="${field}"]`);

    elems.forEach(elem => {
      // check if field needs to be formatted
      if (elem.hasAttribute('data-field-format')) {
        if (elem.getAttribute('data-field-format') === 'currency') {
          elem.setAttribute('data-sort', parseFloat(obj[field]));
          obj[field] = '$' + parseFloat(obj[field]).toFixed(2);
        }
        if (elem.getAttribute('data-field-format') === 'date') {
          elem.setAttribute('data-sort', obj[field]);
          obj[field] =
            obj[field] === '' ? '' : moment(obj[field], 'x').format('M/D/YY');
        }
      }
      // update field
      if (elem.nodeName === 'BUTTON') elem.innerHTML = obj[field].length || 0;
      if (elem.nodeName === 'INPUT' && elem.getAttribute('type') === 'checkbox')
        elem.checked = obj[field];
      if (elem.nodeName === 'INPUT' && elem.getAttribute('type') === 'text')
        elem.value = obj[field];
      if (elem.nodeName === 'TD') elem.innerHTML = obj[field];
    });
  };

  // get tr element
  const tr = node.orders.tbody.querySelector(`tr[data-id="${obj._id}"]`);

  // update information
  [
    'complete',
    'paidRush',
    'order',
    'requestedDate',
    'shipDate',
    'account',
    'cunumber',
    'amount',
    'territory',
    'building',
    'revisions',
    'notes',
  ].forEach(updateField);

  // get complete toggle
  tr.querySelectorAll('[data-field="complete"]').forEach(
    elem => (elem.checked = obj.complete),
  );
  tr.classList[obj.complete ? 'add' : 'remove']('complete');

  // check if late
  if (
    moment(obj.requestedDate, 'M/D/YY').format('x') <
    Math.floor(Date.now() / (1000 * 60 * 60 * 24)) * (1000 * 60 * 60 * 24)
  )
    tr.classList.add('late');

  // check if paid rush
  tr.classList[obj.paidRush ? 'add' : 'remove']('rush');

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
        socket.emit('updateUser', { _id: data.user._id }, { onboarded: true });
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

    // delete event listener function
    const deleteEventListener = e => {
      // get tr
      const tr = e.target.closest('tr');

      // get the _id
      const _id = tr.getAttribute('data-id');

      // get user full name
      const first = tr.querySelector('[data-field="first"]').innerHTML;
      const last = tr.querySelector('[data-field="last"]').innerHTML;
      const full = `${first} ${last}`;

      // modal info
      const body = `<form class="flex flex-col space-y-8 text-gray-800"><p>Are you sure you want to delete <span class="font-bold">${full}</span>?</p><div class="flex justify-end space-x-4 w-full"><a href="#" class="px-2 py-3 rounded ring-1 ring-gray-400 ring-inset" data-modal-close>Cancel</a><button>Delete</button></div></form>`;
      const title = 'Delete User';

      // show modal
      modal.show({ body, title });

      // modal close event listener
      node.modal.body
        .querySelector('[data-modal-close]')
        .addEventListener('click', modal.hide);

      // form submit event listener
      node.modal.body.querySelector('form').addEventListener('submit', e => {
        e.preventDefault();

        // send the delete socket
        socket.emit('removeUser', { _id });

        // hide modal
        modal.hide();

        // remove the tr
        tr.parentNode.removeChild(tr);
      });
    };

    // update information function
    const updateField = field => {
      const elem = clone.querySelector(`[data-field="${field}"]`);
      if (elem.nodeName === 'INPUT' && elem.getAttribute('type') === 'checkbox')
        elem.checked = obj[field];
      if (elem.nodeName === 'TD') elem.innerHTML = obj[field];
    };

    // clone template
    const clone = node.users.template.cloneNode(true);

    // update the tr with the _id
    clone.querySelector('tr').setAttribute('data-id', obj._id);

    // update information
    ['first', 'last', 'email', 'type', 'onboarded', 'active'].forEach(
      updateField,
    );

    // active toggle event listener
    clone
      .querySelector('[data-field="active"]')
      .addEventListener('click', activeComplete);

    // remove user event listener
    clone
      .querySelector('[data-button="delete"]')
      .addEventListener('click', deleteEventListener);

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
