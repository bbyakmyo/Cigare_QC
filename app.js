(function() {
  'use strict';

  const NUMBERS_KEY = 'cigare_numbers_v1';
  const POSITIONS_KEY = 'cigare_positions_v3';
  const OLD_POSITIONS_KEY = 'cigare_positions_v2';
  const OLD_ASSIGNMENTS_KEY = 'cigare_assignments_v1';
  const GRID_SIZES_KEY = 'cigare_grid_sizes_v1';
  const BUNDLE_KEY = 'cigare_bundle_v1';
  const MACHINE_KEY = 'cigare_machine_v1';

  const AREA_ORDER = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'BA1', 'BA2', 'BB1'];

  let AREAS, AREA_CELLS, ALL_PRODUCTS, PRODUCT_GROUPS;
  let areas = [];
  let currentArea = '';
  let viewMode = 'grid';
  let settingsMode = false;
  let pickerTarget = null;
  let receiptSections = [];
  let receiptCurrentSection = 0;
  let numberData = loadData(NUMBERS_KEY);
  let currentPositions = loadPositions();
  let gridSizes = loadData(GRID_SIZES_KEY);
  let bundleData = loadData(BUNDLE_KEY);
  let machineData = loadData(MACHINE_KEY);

  const els = {
    modeTabs: document.querySelectorAll('.mode-tab'),
    areaTabs: document.getElementById('areaTabs'),
    gridSection: document.getElementById('gridSection'),
    bundleSection: document.getElementById('bundleSection'),
    machineSection: document.getElementById('machineSection'),
    machineList: document.getElementById('machineList'),
    grid: document.getElementById('grid'),
    areaTitle: document.getElementById('areaTitle'),
    areaSize: document.getElementById('areaSize'),
    settingsBar: document.getElementById('settingsBar'),
    sizeRows: document.getElementById('sizeRows'),
    sizeCols: document.getElementById('sizeCols'),
    doneSettingsBtn: document.getElementById('doneSettingsBtn'),
    bundleList: document.getElementById('bundleList'),
    printBtn: document.getElementById('printBtn'),
    clearBtn: document.getElementById('clearBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    pickerModal: document.getElementById('pickerModal'),
    pickerClose: document.getElementById('pickerClose'),
    pickerTarget: document.getElementById('pickerTarget'),
    pickerSearch: document.getElementById('pickerSearch'),
    pickerResults: document.getElementById('pickerResults'),
    pickerClearBtn: document.getElementById('pickerClearBtn'),
    receiptModal: document.getElementById('receiptModal'),
    receiptText: document.getElementById('receiptText'),
    receiptClose: document.getElementById('receiptClose'),
    receiptPrevBtn: document.getElementById('receiptPrevBtn'),
    receiptNextBtn: document.getElementById('receiptNextBtn'),
    receiptPage: document.getElementById('receiptPage'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    copyBtn: document.getElementById('copyBtn'),
    exportBtn: document.getElementById('exportBtn'),
    importBtn: document.getElementById('importBtn'),
    loadCigareBtn: document.getElementById('loadCigareBtn'),
    cigareFile: document.getElementById('cigareFile'),
    toast: document.getElementById('toast')
  };

  function loadData(key) {
    try {
      const saved = localStorage.getItem(key);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('load error', e);
    }
    return {};
  }

  function saveData(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error('save error', e);
    }
  }

  function loadPositions() {
    let pos = loadData(POSITIONS_KEY);
    if (Object.keys(pos).length === 0) {
      pos = loadData(OLD_POSITIONS_KEY);
      if (Object.keys(pos).length === 0) {
        const old = loadData(OLD_ASSIGNMENTS_KEY);
        if (Object.keys(old).length > 0) {
          pos = old;
        }
      }
    }
    return pos;
  }

  function savePositions() {
    saveData(POSITIONS_KEY, currentPositions);
  }

  function saveGridSizes() {
    saveData(GRID_SIZES_KEY, gridSizes);
  }

  function migrateBundleData() {
    if (!bundleData.items) bundleData = { items: [] };
    const items = bundleData.items.map(function(item) {
      if (typeof item.id === 'number') return item;
      const found = ALL_PRODUCTS ? ALL_PRODUCTS.find(function(p) {
        return cleanName(p.name) === cleanName(item.name || '');
      }) : null;
      return { id: found ? found.id : -1, qty: item.qty };
    }).filter(function(item) {
      return item.id >= 0;
    });
    bundleData = { items: items };
    saveBundle();
  }

  function saveBundle() {
    saveData(BUNDLE_KEY, bundleData);
  }

  function saveMachine() {
    saveData(MACHINE_KEY, machineData);
  }

  function getProductById(id) {
    if (!ALL_PRODUCTS) return null;
    return ALL_PRODUCTS.find(function(p) { return p.id === id; }) || null;
  }

  function parsePositions(text) {
    const result = [];
    const parts = text.split(' , ');
    parts.forEach(function(part) {
      part = part.trim();
      if (/^[A-Za-z0-9]+-\d+-\d+$/.test(part)) {
        result.push(part);
      }
    });
    return result;
  }

  function getStatus(text) {
    const trimmed = text.trim();
    if (/^[A-Za-z0-9]+-\d+-\d+/.test(trimmed)) {
      return 'positioned';
    }
    if (trimmed === '0' || trimmed.indexOf('0') >= 0) {
      return 'discontinued';
    }
    return 'unknown';
  }

  function parseCigareText(text) {
    const lines = text.split(/\r?\n/);
    const rawAreas = {};
    const areaCells = {};
    const allProducts = [];
    const groups = [];
    let currentGroup = [];
    let productId = 0;

    lines.forEach(function(line) {
      line = line.trim();
      if (line === '---') {
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
          currentGroup = [];
        }
        return;
      }

      const idx = line.indexOf('/');
      if (idx < 0) return;

      const name = line.substring(0, idx).trim();
      const after = line.substring(idx + 1).trim();
      const positions = parsePositions(after);
      const status = getStatus(after);

      positions.forEach(function(pos) {
        const parts = pos.split('-');
        if (parts.length !== 3) return;
        const area = parts[0];
        const col = parseInt(parts[1], 10);
        const row = parseInt(parts[2], 10);

        if (!rawAreas[area]) rawAreas[area] = { maxCol: 0, maxRow: 0 };
        rawAreas[area].maxCol = Math.max(rawAreas[area].maxCol, col);
        rawAreas[area].maxRow = Math.max(rawAreas[area].maxRow, row);

        if (!areaCells[area]) areaCells[area] = {};
        const key = col + '-' + row;
        if (!areaCells[area][key]) areaCells[area][key] = [];
        areaCells[area][key].push(name);
      });

      const isMachine = /^\[기계\]/.test(name.trim());
      const product = { id: productId++, name: name, status: status, positions: positions, isMachine: isMachine };
      allProducts.push(product);
      currentGroup.push(product);
    });

    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    const visualAreas = {};
    Object.keys(rawAreas).forEach(function(area) {
      visualAreas[area] = {
        rows: rawAreas[area].maxCol,
        cols: rawAreas[area].maxRow
      };
    });

    return {
      AREAS: visualAreas,
      AREA_CELLS: areaCells,
      ALL_PRODUCTS: allProducts,
      PRODUCT_GROUPS: groups
    };
  }

  function init() {
    bindEvents();
    fetch('Cigare.txt')
      .then(function(res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function(text) {
        processCigareText(text);
      })
      .catch(function(err) {
        console.error('Failed to load Cigare.txt', err);
        showCigareFileLoader();
      });
  }

  function processCigareText(text) {
    const parsed = parseCigareText(text);
    AREAS = parsed.AREAS;
    AREA_CELLS = parsed.AREA_CELLS;
    ALL_PRODUCTS = parsed.ALL_PRODUCTS;
    PRODUCT_GROUPS = parsed.PRODUCT_GROUPS;

    areas = AREA_ORDER.filter(function(a) { return AREAS[a]; });
    currentArea = areas[0];

    migratePositions();
    migrateBundleData();
    renderTabs();
    renderMode();
  }

  function showCigareFileLoader() {
    els.grid.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'load-error';

    const msg = document.createElement('p');
    msg.textContent = 'Cigare.txt를 자동으로 불러올 수 없습니다.';
    wrapper.appendChild(msg);

    const sub = document.createElement('p');
    sub.textContent = '아래 버튼으로 Cigare.txt 파일을 직접 선택해주세요.';
    sub.style.fontSize = '13px';
    sub.style.color = 'var(--text-secondary)';
    wrapper.appendChild(sub);

    const label = document.createElement('label');
    label.className = 'btn btn-primary file-label';
    label.textContent = 'Cigare.txt 선택';
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,text/plain';
    input.hidden = true;
    input.addEventListener('change', function(e) {
      if (e.target.files.length > 0) {
        loadCigareFile(e.target.files[0]);
      }
    });
    label.appendChild(input);
    wrapper.appendChild(label);

    els.grid.appendChild(wrapper);
  }

  function loadCigareFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      processCigareText(e.target.result);
      if (settingsMode) exitSettingsMode();
    };
    reader.onerror = function() {
      alert('파일을 읽을 수 없습니다.');
    };
    reader.readAsText(file);
  }

  function getEffectivePositions(product) {
    if (currentPositions[product.id]) {
      return currentPositions[product.id].slice();
    }
    return product.positions || [];
  }

  function setProductPosition(product, positions) {
    const original = product.positions || [];
    if (arraysEqual(original, positions)) {
      delete currentPositions[product.id];
    } else {
      currentPositions[product.id] = positions.slice();
    }
    savePositions();
  }

  function migratePositions() {
    if (!ALL_PRODUCTS) return;
    const keys = Object.keys(currentPositions);
    let hasNameKey = false;
    keys.forEach(function(key) {
      if (isNaN(parseInt(key, 10))) hasNameKey = true;
    });
    if (!hasNameKey) return;
    const migrated = {};
    keys.forEach(function(key) {
      const positions = currentPositions[key];
      if (!Array.isArray(positions)) return;
      ALL_PRODUCTS.forEach(function(p) {
        if (p.name === key) {
          migrated[p.id] = positions.slice();
        }
      });
    });
    currentPositions = migrated;
    savePositions();
  }

  function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  function buildAreaCells() {
    const cells = {};
    ALL_PRODUCTS.forEach(function(product) {
      const positions = getEffectivePositions(product);
      positions.forEach(function(pos) {
        const parts = pos.split('-');
        if (parts.length !== 3) return;
        const area = parts[0];
        const key = parts[1] + '-' + parts[2];
        if (!cells[area]) cells[area] = {};
        if (!cells[area][key]) cells[area][key] = [];
        cells[area][key].push(product.id);
      });
    });
    return cells;
  }

  function getGridSize(area) {
    if (gridSizes[area]) {
      return { rows: gridSizes[area].rows, cols: gridSizes[area].cols };
    }
    return AREAS[area];
  }

  function setGridSize(area, rows, cols) {
    const original = AREAS[area];
    if (original && original.rows === rows && original.cols === cols) {
      delete gridSizes[area];
    } else {
      gridSizes[area] = { rows: rows, cols: cols };
    }
    saveGridSizes();
  }

  function getNumber(area, col, row) {
    return numberData[area + '-' + col + '-' + row] || '';
  }

  function setNumber(area, col, row, value) {
    const key = area + '-' + col + '-' + row;
    if (value === '') {
      delete numberData[key];
    } else {
      numberData[key] = value;
    }
    saveData(NUMBERS_KEY, numberData);
  }

  function renderTabs() {
    els.areaTabs.innerHTML = '';
    areas.forEach(function(area) {
      const btn = document.createElement('button');
      btn.className = 'area-tab' + (area === currentArea ? ' active' : '');
      btn.textContent = area;
      btn.addEventListener('click', function() {
        currentArea = area;
        updateActiveTab();
        if (viewMode === 'grid') {
          renderGrid(currentArea);
          renderSettingsBar();
        }
      });
      els.areaTabs.appendChild(btn);
    });
  }

  function updateActiveTab() {
    const tabs = els.areaTabs.querySelectorAll('.area-tab');
    tabs.forEach(function(tab) {
      tab.classList.toggle('active', tab.textContent === currentArea);
    });
  }

  function renderMode() {
    els.modeTabs.forEach(function(tab) {
      tab.classList.toggle('active', tab.dataset.mode === viewMode);
    });

    if (viewMode === 'grid') {
      els.gridSection.style.display = 'block';
      els.bundleSection.style.display = 'none';
      els.machineSection.style.display = 'none';
      els.areaTabs.style.display = 'flex';
      renderGrid(currentArea);
      renderSettingsBar();
    } else if (viewMode === 'bundle') {
      els.gridSection.style.display = 'none';
      els.bundleSection.style.display = 'block';
      els.machineSection.style.display = 'none';
      els.areaTabs.style.display = 'none';
      if (settingsMode) {
        applyGridSize();
        exitSettingsMode();
      }
      renderBundle();
    } else {
      els.gridSection.style.display = 'none';
      els.bundleSection.style.display = 'none';
      els.machineSection.style.display = 'block';
      els.areaTabs.style.display = 'none';
      if (settingsMode) {
        applyGridSize();
        exitSettingsMode();
      }
      renderMachine();
    }
  }

  function renderGrid(area) {
    const cfg = getGridSize(area);
    els.areaTitle.textContent = area;
    els.areaSize.textContent = cfg.rows + ' × ' + cfg.cols;
    els.grid.innerHTML = '';
    els.grid.style.gridTemplateColumns = 'repeat(' + cfg.cols + ', minmax(44px, 1fr))';
    els.grid.style.gridTemplateRows = 'repeat(' + cfg.rows + ', minmax(44px, 1fr))';

    const cells = buildAreaCells();

    for (let r = 1; r <= cfg.rows; r++) {
      for (let c = 1; c <= cfg.cols; c++) {
        const originalCol = r;
        const originalRow = c;
        const key = originalCol + '-' + originalRow;
        const productIds = (cells[area] && cells[area][key]) || [];
        const cell = createCell(area, originalCol, originalRow, productIds);
        cell.style.gridRow = r;
        cell.style.gridColumn = c;
        els.grid.appendChild(cell);
      }
    }
  }

  function createCell(area, col, row, productIds) {
    const hasProduct = productIds.length > 0;
    const firstProduct = hasProduct ? getProductById(productIds[0]) : null;
    const cell = document.createElement('div');
    cell.className = 'grid-cell' + (hasProduct ? ' filled' : '') + (settingsMode ? ' editable' : '');

    const pos = document.createElement('span');
    pos.className = 'cell-pos';
    pos.textContent = col + '-' + row;
    cell.appendChild(pos);

    const name = document.createElement('span');
    name.className = 'cell-name';
    name.textContent = firstProduct ? cleanName(firstProduct.name) : '';
    cell.appendChild(name);

    const input = document.createElement('input');
    input.type = 'tel';
    input.className = 'cell-input';
    input.inputMode = 'numeric';
    input.pattern = '[0-9]*';
    input.autocomplete = 'off';
    input.value = hasProduct ? getNumber(area, col, row) : '';
    input.disabled = !hasProduct || settingsMode;
    input.addEventListener('input', function() {
      if (hasProduct) {
        setNumber(area, col, row, input.value.replace(/[^0-9]/g, ''));
      }
    });
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        focusNextInput(input);
      }
    });
    cell.appendChild(input);

    if (settingsMode) {
      cell.addEventListener('click', function() {
        openPicker({ type: 'grid', area: area, col: col, row: row });
      });
    }

    return cell;
  }

  function focusNextInput(currentInput) {
    const inputs = Array.from(els.grid.querySelectorAll('.cell-input:not(:disabled)'));
    const idx = inputs.indexOf(currentInput);
    if (idx >= 0 && idx < inputs.length - 1) {
      inputs[idx + 1].focus();
      inputs[idx + 1].select();
    }
  }

  function cleanName(name) {
    if (!name) return '';
    return name
      .replace(/^[A-Z]\)/, '')
      .replace(/^\[[^\]]+\]\s*/, '')
      .trim();
  }

  function getChosung(text) {
    const chosung = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
    let result = '';
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code >= 0xAC00 && code <= 0xD7A3) {
        result += chosung[Math.floor((code - 0xAC00) / 588)];
      } else {
        result += text.charAt(i);
      }
    }
    return result;
  }

  function isChosungOnly(text) {
    return /^[ㄱ-ㅎ]+$/.test(text);
  }

  function normalizeChosungQuery(text) {
    const double = {
      'ㄳ': 'ㄱㅅ', 'ㄵ': 'ㄴㅈ', 'ㄶ': 'ㄴㅎ', 'ㄺ': 'ㄹㄱ', 'ㄻ': 'ㄹㅁ',
      'ㄼ': 'ㄹㅂ', 'ㄽ': 'ㄹㅅ', 'ㄾ': 'ㄹㅌ', 'ㄿ': 'ㄹㅍ', 'ㅀ': 'ㄹㅎ', 'ㅄ': 'ㅂㅅ'
    };
    let result = '';
    for (let i = 0; i < text.length; i++) {
      const ch = text.charAt(i);
      result += double[ch] || ch;
    }
    return result;
  }

  function enterSettingsMode() {
    settingsMode = true;
    els.settingsBtn.textContent = '설정 완료';
    els.settingsBar.classList.add('show');
    renderSettingsBar();
    renderGrid(currentArea);
  }

  function exitSettingsMode() {
    settingsMode = false;
    els.settingsBtn.textContent = '설정';
    els.settingsBar.classList.remove('show');
    renderGrid(currentArea);
  }

  function renderSettingsBar() {
    const cfg = getGridSize(currentArea);
    els.sizeRows.value = cfg.rows;
    els.sizeCols.value = cfg.cols;
  }

  function applyGridSize() {
    const rows = parseInt(els.sizeRows.value, 10);
    const cols = parseInt(els.sizeCols.value, 10);
    if (isNaN(rows) || isNaN(cols) || rows < 1 || cols < 1) {
      alert('유효한 행과 열 수를 입력하세요.');
      return false;
    }
    setGridSize(currentArea, rows, cols);
    renderGrid(currentArea);
    return true;
  }

  function getProductsAtPosition(area, col, row) {
    const cells = buildAreaCells();
    return (cells[area] && cells[area][col + '-' + row]) || [];
  }

  function openPicker(target) {
    pickerTarget = target;
    if (target.type === 'grid') {
      els.pickerTarget.textContent = '위치: ' + target.area + ' ' + target.col + '-' + target.row;
      const productIds = getProductsAtPosition(target.area, target.col, target.row);
      const firstProduct = productIds.length > 0 ? getProductById(productIds[0]) : null;
      els.pickerSearch.value = firstProduct ? cleanName(firstProduct.name) : '';
      els.pickerClearBtn.textContent = '이 위치 비우기';
    } else {
      els.pickerTarget.textContent = '볼 루 제품 선택';
      els.pickerSearch.value = target.input ? target.input.value : '';
      els.pickerClearBtn.textContent = '입력 취소';
    }
    renderPickerResults(els.pickerSearch.value);
    els.pickerModal.classList.add('show');
    els.pickerSearch.focus();
  }

  function closePicker() {
    pickerTarget = null;
    els.pickerModal.classList.remove('show');
  }

  function getProductCoordinate(product) {
    if (product.status === 'discontinued') return '0';
    const positions = getEffectivePositions(product);
    if (positions.length > 0) return positions[0];
    return '?-' + product.id;
  }

  function renderPickerResults(query) {
    let q = query.trim().toLowerCase();
    let filtered = ALL_PRODUCTS.filter(function(p) {
      return p.status !== 'discontinued';
    });

    if (q) {
      if (isChosungOnly(q)) {
        q = normalizeChosungQuery(q);
        filtered = filtered.filter(function(p) {
          return getChosung(cleanName(p.name)).indexOf(q) >= 0;
        });
      } else {
        filtered = filtered.filter(function(p) {
          return cleanName(p.name).toLowerCase().indexOf(q) >= 0;
        });
      }
    }

    els.pickerResults.innerHTML = '';
    if (filtered.length === 0) {
      els.pickerResults.innerHTML = '<div class="product-result-item">검색 결과 없음</div>';
    } else {
      filtered.slice(0, 50).forEach(function(p) {
        const item = document.createElement('div');
        item.className = 'product-result-item';
        item.textContent = cleanName(p.name) + ' (' + getProductCoordinate(p) + ')';
        item.addEventListener('click', function() {
          selectPickerProduct(p);
        });
        els.pickerResults.appendChild(item);
      });
    }
  }

  function selectPickerProduct(product) {
    if (!pickerTarget || !product) return;

    if (pickerTarget.type === 'grid') {
      const area = pickerTarget.area;
      const col = pickerTarget.col;
      const row = pickerTarget.row;
      const targetPos = area + '-' + col + '-' + row;

      const oldProductIds = getProductsAtPosition(area, col, row);
      oldProductIds.forEach(function(pid) {
        const p = getProductById(pid);
        if (!p) return;
        const positions = getEffectivePositions(p).filter(function(pos) { return pos !== targetPos; });
        setProductPosition(p, positions);
      });

      const newPositions = getEffectivePositions(product).filter(function(pos) { return pos !== targetPos; });
      newPositions.push(targetPos);
      setProductPosition(product, newPositions);

      closePicker();
      renderGrid(currentArea);
    } else {
      const nameInput = pickerTarget.input;
      const qtyInput = pickerTarget.qtyInput;
      const row = pickerTarget.row;
      nameInput.value = cleanName(product.name);
      if (row) {
        row.dataset.productId = product.id;
        const codeSpan = row.querySelector('.bundle-code');
        if (codeSpan) codeSpan.textContent = getProductCoordinate(product);
      }
      syncBundleRow(pickerTarget.idx, product.id, qtyInput.value);
      closePicker();
      qtyInput.focus();
    }
  }

  function clearPickerCell() {
    if (!pickerTarget) return;

    if (pickerTarget.type === 'grid') {
      const area = pickerTarget.area;
      const col = pickerTarget.col;
      const row = pickerTarget.row;
      const targetPos = area + '-' + col + '-' + row;

      const oldProductIds = getProductsAtPosition(area, col, row);
      oldProductIds.forEach(function(pid) {
        const p = getProductById(pid);
        if (!p) return;
        const positions = getEffectivePositions(p).filter(function(pos) { return pos !== targetPos; });
        setProductPosition(p, positions);
      });

      closePicker();
      renderGrid(currentArea);
    } else {
      const row = pickerTarget.row;
      pickerTarget.input.value = '';
      if (row) {
        row.dataset.productId = -1;
        const codeSpan = row.querySelector('.bundle-code');
        if (codeSpan) codeSpan.textContent = '';
      }
      syncBundleRow(pickerTarget.idx, -1, pickerTarget.qtyInput.value);
      closePicker();
    }
  }

  function renderBundle() {
    els.bundleList.innerHTML = '';
    const items = bundleData.items || [];

    items.forEach(function(item, idx) {
      const row = createBundleRow(item.id, item.qty, idx);
      els.bundleList.appendChild(row);
    });

    const emptyRow = createBundleRow(-1, '', items.length, true);
    els.bundleList.appendChild(emptyRow);
  }

  function renderMachine() {
    els.machineList.innerHTML = '';
    if (!ALL_PRODUCTS) return;
    const machineProducts = ALL_PRODUCTS.filter(function(p) { return p.isMachine; });
    machineProducts.forEach(function(product) {
      const row = createMachineRow(product);
      els.machineList.appendChild(row);
    });
  }

  function createMachineRow(product) {
    const row = document.createElement('div');
    row.className = 'machine-row';

    const name = document.createElement('span');
    name.className = 'machine-name';
    name.textContent = cleanName(product.name);

    const input = document.createElement('input');
    input.type = 'tel';
    input.className = 'machine-input';
    input.inputMode = 'numeric';
    input.pattern = '[0-9]*';
    input.placeholder = '0';
    input.value = machineData[product.id] || '';

    input.addEventListener('input', function() {
      input.value = input.value.replace(/[^0-9]/g, '');
      setMachineNumber(product.id, input.value);
    });

    row.appendChild(name);
    row.appendChild(input);
    return row;
  }

  function createBundleRow(productId, qty, idx, isEmpty) {
    const product = productId >= 0 ? getProductById(productId) : null;
    const row = document.createElement('div');
    row.className = 'bundle-row';
    row.dataset.productId = productId;

    const nameWrap = document.createElement('div');
    nameWrap.className = 'bundle-name-wrap';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'bundle-name';
    nameInput.placeholder = '담배 이름';
    nameInput.value = product ? cleanName(product.name) : '';
    nameInput.autocomplete = 'off';
    nameInput.readOnly = true;

    const codeSpan = document.createElement('span');
    codeSpan.className = 'bundle-code';
    codeSpan.textContent = product ? getProductCoordinate(product) : '';

    nameWrap.appendChild(nameInput);
    nameWrap.appendChild(codeSpan);

    const qtyInput = document.createElement('input');
    qtyInput.type = 'tel';
    qtyInput.className = 'bundle-qty';
    qtyInput.inputMode = 'numeric';
    qtyInput.pattern = '[0-9]*';
    qtyInput.placeholder = '수량';
    qtyInput.value = qty;

    const delBtn = document.createElement('button');
    delBtn.className = 'bundle-delete';
    delBtn.textContent = '×';
    delBtn.addEventListener('click', function() {
      if (isEmpty) return;
      removeBundleItem(idx);
    });

    row.appendChild(nameWrap);
    row.appendChild(qtyInput);
    row.appendChild(delBtn);

    function getRowProductId() {
      const pid = parseInt(row.dataset.productId, 10);
      return isNaN(pid) ? -1 : pid;
    }

    let debounceTimer = null;
    nameInput.addEventListener('focus', function() {
      openPicker({ type: 'bundle', row: row, idx: idx, input: nameInput, qtyInput: qtyInput, currentId: getRowProductId() });
    });
    nameInput.addEventListener('click', function() {
      openPicker({ type: 'bundle', row: row, idx: idx, input: nameInput, qtyInput: qtyInput, currentId: getRowProductId() });
    });

    qtyInput.addEventListener('input', function() {
      qtyInput.value = qtyInput.value.replace(/[^0-9]/g, '');
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function() {
        syncBundleRow(idx, getRowProductId(), qtyInput.value);
      }, 200);
    });

    nameInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        qtyInput.focus();
      }
    });

    qtyInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        const nextRow = row.nextElementSibling;
        if (nextRow) {
          const nextName = nextRow.querySelector('.bundle-name');
          if (nextName) nextName.focus();
        }
      }
    });

    return row;
  }
  function syncBundleRow(idx, productId, qty) {
    if (!bundleData.items) bundleData.items = [];
    const validQty = parseInt(qty, 10);

    if (idx < bundleData.items.length) {
      if (productId < 0 || isNaN(validQty) || validQty <= 0) {
        removeBundleItem(idx);
      } else {
        bundleData.items[idx] = { id: productId, qty: validQty };
        saveBundle();
      }
    } else {
      if (productId >= 0 && !isNaN(validQty) && validQty > 0) {
        bundleData.items.push({ id: productId, qty: validQty });
        saveBundle();
        renderBundle();
        const lastRow = els.bundleList.lastElementChild;
        if (lastRow) {
          const input = lastRow.querySelector('.bundle-name');
          if (input) input.focus();
        }
      }
    }
  }

  function removeBundleItem(idx) {
    if (!bundleData.items) return;
    bundleData.items.splice(idx, 1);
    saveBundle();
    renderBundle();
  }

  function generateReceipt() {
    const groups = [];
    PRODUCT_GROUPS.forEach(function(group) {
      const items = [];
      group.forEach(function(product) {
        const num = getTotalForProduct(product);
        items.push({ id: product.id, name: getReceiptProductName(product), num: String(num) });
      });
      groups.push(items);
    });
    return groups;
  }

  function getReceiptProductName(product) {
    const name = cleanName(product.name);
    if (product.status === 'unknown') {
      return name + ' (' + getProductCoordinate(product) + ')';
    }
    return name;
  }

  function getTotalForProduct(product) {
    if (product.status === 'discontinued') return '0';
    const gridNum = getGridNumberForProduct(product);
    const bundleQty = getBundleTotal(product.id);
    const machineNum = getMachineNumber(product.id);
    const total = (parseInt(gridNum, 10) || 0) + bundleQty * 10 + machineNum;
    return String(total);
  }

  function getGridNumberForProduct(product) {
    const positions = getEffectivePositions(product);
    if (positions.length === 0) return '0';
    const firstPos = positions[0];
    const parts = firstPos.split('-');
    if (parts.length !== 3) return '0';
    return getNumber(parts[0], parts[1], parts[2]) || '0';
  }

  function getBundleTotal(productId) {
    let total = 0;
    (bundleData.items || []).forEach(function(item) {
      if (item.id === productId) {
        total += (parseInt(item.qty, 10) || 0);
      }
    });
    return total;
  }

  function getMachineNumber(productId) {
    return parseInt(machineData[productId], 10) || 0;
  }

  function setMachineNumber(productId, value) {
    const num = parseInt(value, 10);
    if (isNaN(num) || num <= 0) {
      delete machineData[productId];
    } else {
      machineData[productId] = num;
    }
    saveMachine();
  }

  function showReceipt() {
    receiptSections = generateReceipt();
    receiptCurrentSection = 0;
    renderReceiptSection();
    els.receiptModal.classList.add('show');
  }

  function hideReceipt() {
    els.receiptModal.classList.remove('show');
  }

  function renderReceiptSection() {
    if (!receiptSections.length) {
      els.receiptText.innerHTML = '<div class="receipt-separator">-------------------------------------</div>';
      els.receiptPage.textContent = '0 / 0';
      els.receiptPrevBtn.disabled = true;
      els.receiptNextBtn.disabled = true;
      return;
    }
    const section = receiptSections[receiptCurrentSection];
    const sep = '<div class="receipt-separator">-------------------------------------</div>';
    const rows = section.map(function(item) {
      return '<div class="receipt-row" data-product-id="' + item.id + '"><span class="receipt-name">' + escapeHtml(item.name) + '</span><span class="receipt-num">' + escapeHtml(item.num) + '</span></div>';
    }).join('');
    els.receiptText.innerHTML = sep + rows + sep;
    els.receiptPage.textContent = (receiptCurrentSection + 1) + ' / ' + receiptSections.length;
    els.receiptPrevBtn.disabled = receiptCurrentSection === 0;
    els.receiptNextBtn.disabled = receiptCurrentSection === receiptSections.length - 1;
  }

  function showToast(message) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.classList.add('show');
    setTimeout(function() {
      els.toast.classList.remove('show');
    }, 2000);
  }

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function prevReceiptSection() {
    if (receiptCurrentSection > 0) {
      receiptCurrentSection--;
      renderReceiptSection();
    }
  }

  function nextReceiptSection() {
    if (receiptCurrentSection < receiptSections.length - 1) {
      receiptCurrentSection++;
      renderReceiptSection();
    }
  }

  function copyReceipt() {
    const sep = '-------------------------------------';
    const lines = [];
    receiptSections.forEach(function(section) {
      lines.push(sep);
      section.forEach(function(item) {
        lines.push(item.name + ' ' + item.num);
      });
    });
    lines.push(sep);
    const text = lines.join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        alert('복사 완료');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      alert('복사 완료');
    } catch (e) {
      alert('복사 실패');
    }
    document.body.removeChild(ta);
  }

  function clearAllNumbers() {
    if (!confirm('입력한 모든 숫자를 지우시겠습니까?')) return;
    numberData = {};
    bundleData = { items: [] };
    machineData = {};
    saveData(NUMBERS_KEY, numberData);
    saveBundle();
    saveMachine();
    if (viewMode === 'grid') renderGrid(currentArea);
    else if (viewMode === 'bundle') renderBundle();
    else renderMachine();
  }

  function exportConfig() {
    const data = {
      numbers: numberData,
      positions: currentPositions,
      gridSizes: gridSizes,
      bundle: bundleData,
      machine: machineData,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cigare_config_' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importConfig(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = JSON.parse(e.target.result);
        if (data.numbers) numberData = data.numbers;
        if (data.positions) currentPositions = data.positions;
        if (data.gridSizes) gridSizes = data.gridSizes;
        if (data.bundle) {
          bundleData = data.bundle;
          migrateBundleData();
        }
        if (data.machine) machineData = data.machine;
        migratePositions();
        saveData(NUMBERS_KEY, numberData);
        savePositions();
        saveGridSizes();
        saveBundle();
        renderMode();
        alert('불러오기 완료');
      } catch (err) {
        alert('파일을 읽을 수 없습니다.');
      }
    };
    reader.readAsText(file);
  }

  function bindEvents() {
    els.modeTabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        if (!AREAS) return;
        viewMode = tab.dataset.mode;
        renderMode();
      });
    });

    els.printBtn.addEventListener('click', function() {
      if (!AREAS) return;
      showReceipt();
    });
    els.clearBtn.addEventListener('click', function() {
      if (!AREAS) return;
      clearAllNumbers();
    });
    els.settingsBtn.addEventListener('click', function() {
      if (!AREAS) return;
      if (viewMode !== 'grid') {
        alert('그리드 모드에서만 설정이 가능합니다.');
        return;
      }
      if (settingsMode) {
        if (applyGridSize()) exitSettingsMode();
      } else {
        enterSettingsMode();
      }
    });

    els.doneSettingsBtn.addEventListener('click', function() {
      if (applyGridSize()) exitSettingsMode();
    });

    els.sizeRows.addEventListener('change', function() {
      if (!AREAS) return;
      applyGridSize();
    });
    els.sizeCols.addEventListener('change', function() {
      if (!AREAS) return;
      applyGridSize();
    });

    els.pickerClose.addEventListener('click', closePicker);
    els.pickerClearBtn.addEventListener('click', clearPickerCell);
    els.pickerSearch.addEventListener('input', function() {
      renderPickerResults(els.pickerSearch.value);
    });
    els.pickerModal.addEventListener('click', function(e) {
      if (e.target === els.pickerModal) closePicker();
    });

    els.receiptClose.addEventListener('click', hideReceipt);
    els.closeModalBtn.addEventListener('click', hideReceipt);
    els.copyBtn.addEventListener('click', copyReceipt);
    els.receiptPrevBtn.addEventListener('click', prevReceiptSection);
    els.receiptNextBtn.addEventListener('click', nextReceiptSection);
    els.receiptText.addEventListener('click', function(e) {
      const row = e.target.closest('.receipt-row');
      if (!row) return;
      const pid = parseInt(row.dataset.productId, 10);
      if (isNaN(pid)) return;
      const product = getProductById(pid);
      if (!product) return;
      showToast(cleanName(product.name) + ' 위치: ' + getProductCoordinate(product));
    });
    els.receiptModal.addEventListener('click', function(e) {
      if (e.target === els.receiptModal) hideReceipt();
    });

    els.exportBtn.addEventListener('click', exportConfig);
    els.importBtn.addEventListener('change', function(e) {
      if (e.target.files.length > 0) {
        importConfig(e.target.files[0]);
        e.target.value = '';
      }
    });

    els.loadCigareBtn.addEventListener('click', function() {
      els.cigareFile.click();
    });
    els.cigareFile.addEventListener('change', function(e) {
      if (e.target.files.length > 0) {
        loadCigareFile(e.target.files[0]);
        e.target.value = '';
      }
    });
  }

  init();
})();

