// Expense & Budget Visualizer — vanilla JS, data disimpan di Local Storage

const STORAGE_KEY = 'ebv-data';
const THEME_KEY = 'ebv-theme';
const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Fun'];
const FIXED_COLORS = { Food: '#f59e0b', Transport: '#3b82f6', Fun: '#ec4899' };

const $ = (id) => document.getElementById(id);
const money = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

let state = loadState();
let chart = null;

// ---------- Storage ----------
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.transactions)) {
      return {
        transactions: saved.transactions,
        categories: saved.categories || [...DEFAULT_CATEGORIES],
      };
    }
  } catch (err) {
    // data rusak -> mulai dari awal
  }
  return { transactions: [], categories: [...DEFAULT_CATEGORIES] };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ---------- Helpers ----------
function colorFor(category) {
  if (FIXED_COLORS[category]) return FIXED_COLORS[category];
  const index = state.categories.indexOf(category);
  return `hsl(${(index * 67) % 360}, 55%, 55%)`;
}

function sortedTransactions() {
  const list = [...state.transactions];
  switch ($('sort').value) {
    case 'high': return list.sort((a, b) => b.amount - a.amount);
    case 'low': return list.sort((a, b) => a.amount - b.amount);
    case 'category': return list.sort((a, b) => a.category.localeCompare(b.category));
    default: return list.sort((a, b) => b.id - a.id);
  }
}

// ---------- Rendering ----------
function renderCategories(selected = '') {
  const select = $('category');
  select.innerHTML = '';
  select.append(new Option('Select category', ''));
  state.categories.forEach((name) => select.append(new Option(name, name)));
  select.value = selected;
}

function renderTotal() {
  const total = state.transactions.reduce((sum, t) => sum + t.amount, 0);
  $('total').textContent = money.format(total);
}

function renderList() {
  const list = $('list');
  list.innerHTML = '';

  if (state.transactions.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = 'No transactions yet.';
    list.append(empty);
    return;
  }

  sortedTransactions().forEach((t) => {
    const li = document.createElement('li');

    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = colorFor(t.category);

    const info = document.createElement('div');
    info.className = 'info';
    const name = document.createElement('strong');
    name.textContent = t.name; // textContent -> aman dari HTML injection
    const category = document.createElement('span');
    category.className = 'muted';
    category.textContent = t.category;
    info.append(name, category);

    const amount = document.createElement('span');
    amount.className = 'amount';
    amount.textContent = money.format(t.amount);

    const del = document.createElement('button');
    del.className = 'delete';
    del.type = 'button';
    del.dataset.id = t.id;
    del.textContent = 'Delete';
    del.setAttribute('aria-label', `Delete ${t.name}`);

    li.append(dot, info, amount, del);
    list.append(li);
  });
}

function renderChart() {
  if (typeof Chart === 'undefined') return; // Chart.js gagal dimuat (offline)

  const totals = {};
  state.transactions.forEach((t) => {
    totals[t.category] = (totals[t.category] || 0) + t.amount;
  });
  const labels = Object.keys(totals);
  const isEmpty = labels.length === 0;

  $('chart-empty').hidden = !isEmpty;
  $('chart').hidden = isEmpty;

  if (isEmpty) {
    if (chart) { chart.destroy(); chart = null; }
    return;
  }

  const data = {
    labels,
    datasets: [{
      data: labels.map((l) => totals[l]),
      backgroundColor: labels.map(colorFor),
      borderWidth: 0,
    }],
  };

  if (chart) {
    chart.data = data;
    chart.update();
  } else {
    chart = new Chart($('chart'), {
      type: 'pie',
      data,
      options: {
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: { label: (ctx) => ` ${ctx.label}: ${money.format(ctx.parsed)}` },
          },
        },
      },
    });
  }
}

// ---------- Monthly summary ----------
function monthKey(t) {
  // id = timestamp saat transaksi dibuat, jadi bulan diambil dari sini
  const d = new Date(t.id);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key) {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function renderSummary() {
  const select = $('month');
  const summary = $('summary');
  const previous = select.value;
  const months = [...new Set(state.transactions.map(monthKey))].sort().reverse();

  select.innerHTML = '';
  summary.innerHTML = '';
  select.hidden = months.length === 0;

  if (months.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'Add a transaction to see your monthly summary.';
    summary.append(empty);
    return;
  }

  months.forEach((key) => select.append(new Option(monthLabel(key), key)));
  select.value = months.includes(previous) ? previous : months[0];

  const items = state.transactions.filter((t) => monthKey(t) === select.value);
  const total = items.reduce((sum, t) => sum + t.amount, 0);
  const byCategory = {};
  items.forEach((t) => {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
  });

  const head = document.createElement('p');
  head.className = 'summary-total';
  head.textContent = `${money.format(total)} across ${items.length} transaction${items.length === 1 ? '' : 's'}`;
  summary.append(head);

  Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, value]) => {
      const row = document.createElement('div');
      row.className = 'bar-row';

      const label = document.createElement('span');
      label.textContent = category;

      const track = document.createElement('div');
      track.className = 'bar-track';
      const fill = document.createElement('div');
      fill.className = 'bar-fill';
      fill.style.width = `${(value / total) * 100}%`;
      fill.style.background = colorFor(category);
      track.append(fill);

      const amount = document.createElement('span');
      amount.className = 'amount';
      amount.textContent = money.format(value);

      row.append(label, track, amount);
      summary.append(row);
    });
}

function render() {
  renderTotal();
  renderList();
  renderChart();
  renderSummary();
}

// ---------- Theme (dark / light) ----------
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $('theme-toggle').textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
  localStorage.setItem(THEME_KEY, theme);

  if (typeof Chart !== 'undefined') {
    // warna teks chart mengikuti tema; buat ulang chart agar warna terbarui
    Chart.defaults.color = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
    if (chart) { chart.destroy(); chart = null; }
    renderChart();
  }
}

$('theme-toggle').addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});

// ---------- Events ----------
$('expense-form').addEventListener('submit', (e) => {
  e.preventDefault();

  const name = $('item-name').value.trim();
  const amount = parseFloat($('amount').value);
  const category = $('category').value;

  if (!name || !(amount > 0) || !category) {
    $('form-error').textContent = 'Please fill in the item name, a valid amount and a category.';
    return;
  }

  $('form-error').textContent = '';
  state.transactions.push({ id: Date.now(), name, amount, category });
  saveState();
  e.target.reset();
  render();
});

$('list').addEventListener('click', (e) => {
  const button = e.target.closest('button[data-id]');
  if (!button) return;

  state.transactions = state.transactions.filter((t) => t.id !== Number(button.dataset.id));
  saveState();
  render();
});

$('category-form').addEventListener('submit', (e) => {
  e.preventDefault();

  const input = $('new-category');
  const name = input.value.trim();
  if (!name) return;

  const exists = state.categories.some((c) => c.toLowerCase() === name.toLowerCase());
  if (!exists) {
    state.categories.push(name);
    saveState();
  }

  const chosen = state.categories.find((c) => c.toLowerCase() === name.toLowerCase());
  renderCategories(chosen);
  input.value = '';
});

$('sort').addEventListener('change', renderList);
$('month').addEventListener('change', renderSummary);

// ---------- Init ----------
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
applyTheme(localStorage.getItem(THEME_KEY) || (prefersDark ? 'dark' : 'light'));
renderCategories();
render();
