/*
  - Menu toggle 
  - Cart (localStorage)
  - Render checkout & live totals
  - Add to cart from products page (quantity support)
  - Toast notifications
  - Form validation + AJAX submission (placeholder endpoints)
  - Accessibility & small UX helpers

  Comments included for assignment clarity.
*/

/* -------------------------
   Utility helpers
   ------------------------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// Currency formatting in Rands
function toCurrency(n) { return `R${Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

/* -------------------------
   Page fade-in
   ------------------------- */
window.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('loaded');
});

/* -------------------------
   Toast notifications
   ------------------------- */
function showToast(message, type = 'info', timeout = 3200) {
  const t = document.createElement('div');
  t.className = `toast ${type}`;

  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '⚠️';

  t.setAttribute('data-icon', icon);
  t.textContent = message;

  document.body.appendChild(t);
  // trigger CSS animation
  requestAnimationFrame(() => t.classList.add('show'));

  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 260);
  }, timeout);
}

/* -------------------------
   Mobile menu (sliding)
   ------------------------- */
function initMenu() {
  const btn = document.getElementById('menu-btn');
  const menu = document.getElementById('menu');
  if (!btn || !menu) return;

  function toggle(open) {
    const isOpen = typeof open === 'boolean' ? open : !menu.classList.contains('open');
    menu.classList.toggle('open', isOpen);
    btn.classList.toggle('open', isOpen);
    btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  }

  btn.addEventListener('click', () => toggle());
  // close when clicking outside
  document.addEventListener('click', (e) => {
    if (!menu.classList.contains('open')) return;
    if (btn.contains(e.target) || menu.contains(e.target)) return;
    toggle(false);
  });
  // close on Escape
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggle(false); });
}

/* -------------------------
   CART (localStorage-backed)
   Data shape: [{ id, name, price, quantity, meta }]
   ------------------------- */
const CART_KEY = 'visionaryprints_cart_v1';

function readCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch (err) {
    console.error('cart read error', err);
    return [];
  }
}
function writeCart(cart) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch (err) {
    console.error('cart write error', err);
    showToast('Could not save cart (storage).', 'error');
  }
}

/* Add item (merges duplicates by id or name) */
function addItemToCart({ id = null, name, price = 0, quantity = 1, meta = {} }) {
  const cart = readCart();
  const key = id != null ? 'id' : 'name';
  const existingIdx = cart.findIndex(it => (key === 'id' ? it.id === id : it.name === name));
  if (existingIdx > -1) {
    cart[existingIdx].quantity = Number(cart[existingIdx].quantity) + Number(quantity);
  } else {
    cart.push({ id, name, price: Number(price), quantity: Number(quantity), meta });
  }
  writeCart(cart);
  showToast(`${quantity} × ${name} added to cart.`, 'success');
  document.dispatchEvent(new CustomEvent('cart:updated', { detail: { cart } }));
}

/* Update quantity by index */
function updateCartQty(index, qty) {
  const cart = readCart();
  if (!cart[index]) return;
  cart[index].quantity = Math.max(1, Number(qty) || 1);
  writeCart(cart);
  document.dispatchEvent(new CustomEvent('cart:updated', { detail: { cart } }));
}

/* Remove item */
function removeCartItem(index) {
  const cart = readCart();
  if (!cart[index]) return;
  const removed = cart.splice(index, 1);
  writeCart(cart);
  showToast(`Removed ${removed[0].name}.`, 'error');
  document.dispatchEvent(new CustomEvent('cart:updated', { detail: { cart } }));
}

/* Clear cart */
function clearCart() {
  localStorage.removeItem(CART_KEY);
  document.dispatchEvent(new CustomEvent('cart:updated', { detail: { cart: [] } }));
}

/* -------------------------
   Products page: wire up add-to-cart buttons
   Buttons require:
     class="add-to-cart"
     data-id (optional)
     data-name
     data-price
     data-qty (id of qty input)
   ------------------------- */
function initProductButtons() {
  $$('.add-to-cart').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = btn.dataset.id || null;
      const name = btn.dataset.name || 'Product';
      const price = Number(btn.dataset.price) || 0;
      const qtyId = btn.dataset.qty;
      let qty = 1;
      if (qtyId) {
        const qtyInput = document.getElementById(qtyId);
        if (qtyInput) qty = Math.max(1, Number(qtyInput.value) || 1);
      } else {
        const sibling = btn.closest('.product-card')?.querySelector('input[type="number"]');
        if (sibling) qty = Math.max(1, Number(sibling.value) || 1);
      }
      addItemToCart({ id, name, price, quantity: qty });
    });
  });
}

/* -------------------------
   Render checkout page
   Renders into #cart-table tbody (preferred) or fallback list
   ------------------------- */
function renderCheckout() {
  const cart = readCart();
  const table = document.getElementById('cart-table');
  const cartTotalEl = document.getElementById('cart-total');

  if (table) {
    const tbody = table.querySelector('tbody');
    tbody.innerHTML = '';
    let total = 0;
    cart.forEach((item, idx) => {
      const tr = document.createElement('tr');
      const subtotal = item.price * item.quantity;
      total += subtotal;
      tr.innerHTML = `
        <td>${item.name}</td>
        <td>${toCurrency(item.price)}</td>
        <td><input class="cart-inline-qty" type="number" min="1" value="${item.quantity}" data-index="${idx}" /></td>
        <td>${toCurrency(subtotal)}</td>
        <td><button class="btn remove-item" data-index="${idx}">Remove</button></td>
      `;
      tbody.appendChild(tr);
    });

    // Qty change handlers
    tbody.querySelectorAll('.cart-inline-qty').forEach(inp => {
      inp.addEventListener('change', (e) => {
        const idx = Number(e.target.dataset.index);
        updateCartQty(idx, Number(e.target.value) || 1);
        renderCheckout();
      });
    });

    // Remove handlers
    tbody.querySelectorAll('.remove-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        removeCartItem(Number(e.target.dataset.index));
        renderCheckout();
      });
    });

    if (cartTotalEl) cartTotalEl.textContent = Number(total).toFixed(2);
    return;
  }

  // fallback: simple list (not expected since we included table)
  const list = document.getElementById('checkout-list');
  if (!list) return;
  list.innerHTML = '';
  let total = 0;
  cart.forEach((item, idx) => {
    const li = document.createElement('li');
    const subtotal = item.price * item.quantity;
    total += subtotal;
    li.innerHTML = `${item.name} - ${toCurrency(item.price)} x <input type="number" value="${item.quantity}" data-index="${idx}" class="update-qty" /> = ${toCurrency(subtotal)} <button data-index="${idx}" class="remove-item">Remove</button>`;
    list.appendChild(li);
  });
  if (cartTotalEl) cartTotalEl.textContent = Number(total).toFixed(2);

  $$('.update-qty').forEach(inp => inp.addEventListener('change', (e) => {
    updateCartQty(Number(e.target.dataset.index), Number(e.target.value) || 1);
    renderCheckout();
  }));
  $$('.remove-item').forEach(btn => btn.addEventListener('click', (e) => {
    removeCartItem(Number(e.target.dataset.index));
    renderCheckout();
  }));
}

/* -------------------------
   Form validation (client-side)
   - Uses HTML5 constraint checks + custom checks
   ------------------------- */
function validateForm(form) {
  const status = form.querySelector('#formStatus');
  if (status) status.textContent = '';
  // HTML5 checkValidity will show native tooltips in many browsers
  if (!form.checkValidity()) {
    form.reportValidity();
    showToast('Please complete required fields.', 'error');
    return false;
  }
  // Example: email regex extra check
  const email = form.querySelector('input[type="email"]');
  if (email && !/\S+@\S+\.\S+/.test(email.value)) {
    if (status) status.textContent = 'Please enter a valid email address.';
    showToast('Invalid email address.', 'error');
    return false;
  }
  return true;
}

/* -------------------------
   AJAX form submission (placeholder endpoints)
   - data-endpoint attribute on form can override default
   - expects JSON response; adapt server accordingly
   ------------------------- */
async function ajaxSubmitForm(form) {
  if (!validateForm(form)) return false;

  const endpoint = form.dataset.endpoint || '/api/submit';
  const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  // Serialize form to JSON
  const fd = new FormData(form);
  const payload = {};
  fd.forEach((v, k) => {
    payload[k] = v;
  });

  // If this is checkout, include cart contents
  if (form.classList.contains('checkout-form')) {
    payload.cart = readCart();
  }

  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      let err = `Server error: ${resp.status}`;
      try { const j = await resp.json(); if (j && j.message) err = j.message; } catch (_) {}
      throw new Error(err);
    }

    showToast('Submission successful — thank you!', 'success');
    form.reset();

    // clear cart if checkout
    if (form.classList.contains('checkout-form')) {
      clearCart();
      setTimeout(() => { window.location.href = 'index.html'; }, 900);
    }
    return true;
  } catch (err) {
    console.error('Form submit error', err);
    showToast('Submission failed. Try again later.', 'error');
    const status = form.querySelector('#formStatus');
    if (status) status.textContent = 'There was a problem submitting the form: ' + (err.message || 'Unknown error');
    return false;
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

/* -------------------------
   Wire up forms to AJAX submit
   ------------------------- */
function initForms() {
  $$('form').forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      ajaxSubmitForm(form);
    });
  });
}

/* -------------------------
   Small helpers: back-to-top + active nav
   ------------------------- */
function initUiHelpers() {
  const toTop = $('#toTop');
  if (toTop) {
    window.addEventListener('scroll', () => { toTop.style.display = window.scrollY > 600 ? 'grid' : 'none'; });
    toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  // Auto-fill year
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  // Highlight active nav link by URL
  const links = $$('.links a');
  const current = window.location.pathname.split('/').pop() || 'index.html';
  links.forEach(a => {
    const href = a.getAttribute('href');
    if (href === current || (href === 'index.html' && current === '')) a.classList.add('active');
    else a.classList.remove('active');
  });
}

/* -------------------------
   App init boot
   ------------------------- */
function boot() {
  initMenu();
  initProductButtons();
  initForms();
  initUiHelpers();
  renderCheckout();

  // update cart badge if you add one (optional)
  document.addEventListener('cart:updated', (e) => {
    const cart = (e.detail && e.detail.cart) || readCart();
    const totalCount = cart.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
    const badge = $('#cart-count');
    if (badge) badge.textContent = totalCount || '';
  });
}

document.addEventListener('DOMContentLoaded', boot);
// Simple Product Search (with "No results found")
document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("productSearch");
  const noResults = document.getElementById("noResults");
  
  if (!searchInput) return; // Only run on products page

  const products = document.querySelectorAll(".product-card");

  searchInput.addEventListener("input", () => {
    const query = searchInput.value.toLowerCase().trim();
    let matches = 0;

    products.forEach(card => {
      const name = card.querySelector("h3").textContent.toLowerCase();

      if (name.includes(query)) {
        card.style.display = "block";
        matches++;
      } else {
        card.style.display = "none";
      }
    });

    // Show / hide “No results found”
    if (matches === 0) {
      noResults.style.display = "block";
    } else {
      noResults.style.display = "none";
    }
  });
});