(function() {
  'use strict';

  const NUMBERS_KEY = 'cigare_numbers_v1';
  const POSITIONS_KEY = 'cigare_positions_v3';
  const OLD_POSITIONS_KEY = 'cigare_positions_v2';
  const OLD_ASSIGNMENTS_KEY = 'cigare_assignments_v1';
  const GRID_SIZES_KEY = 'cigare_grid_sizes_v1';
  const BUNDLE_KEY = 'cigare_bundle_v1';
  const MACHINE_KEY = 'cigare_machine_v1';
  const CUSTOM_AREAS_KEY = 'cigare_custom_areas_v1';
  const RECEIPT_ORDER_KEY = 'cigare_receipt_order_v1';
  const CIGARE_HASH_KEY = 'cigare_hash_v1';

  const AREA_ORDER = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'BA1', 'BA2', 'BB1'];

  let AREAS, AREA_CELLS, ALL_PRODUCTS, PRODUCT_GROUPS;
  let areas = [];
  let currentArea = '';
  let viewMode = 'grid';
  let settingsMode = false;
  let pickerTarget = null;
  let receiptSections = [];
  let receiptCurrentSection = 0;
  let receiptFullView = false;
  let originalCigareText = '';
  let numberData = loadData(NUMBERS_KEY);
  let currentPositions = loadPositions();
  let gridSizes = loadData(GRID_SIZES_KEY);
  let bundleData = loadData(BUNDLE_KEY);
  let machineData = loadData(MACHINE_KEY);
  let customAreas = loadData(CUSTOM_AREAS_KEY) || {};
  let receiptOrder = loadData(RECEIPT_ORDER_KEY) || [];

  const els = {
    modeTabs: document.querySelectorAll('.mode-tab'),
    areaTabs: document.getElementById('areaTabs'),
    gridSection: document.getElementById('gridSection'),
    bundleSection: document.getElementById('bundleSection'),
    machineSection: document.getElementById('machineSection'),
    machineList: document.getElementById('machineList'),
    grid: document.getElementById('grid'),
    gridScroll: document.getElementById('gridScroll'),
    gridRemote: document.getElementById('gridRemote'),
    remotePos: document.getElementById('remotePos'),
    remoteName: document.getElementById('remoteName'),
    remoteLeft: document.getElementById('remoteLeft'),
    remoteUp: document.getElementById('remoteUp'),
    remoteDown: document.getElementById('remoteDown'),
    remoteRight: document.getElementById('remoteRight'),
    remoteInput: document.getElementById('remoteInput'),
    scrollGridUpBtn: document.getElementById('scrollGridUpBtn'),
    scrollGridDownBtn: document.getElementById('scrollGridDownBtn'),
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
    receiptViewToggleBtn: document.getElementById('receiptViewToggleBtn'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    copyBtn: document.getElementById('copyBtn'),
    exportBtn: document.getElementById('exportBtn'),
    importBtn: document.getElementById('importBtn'),
    loadCigareBtn: document.getElementById('loadCigareBtn'),
    cigareFile: document.getElementById('cigareFile'),
    configSection: document.getElementById('configSection'),
    configToggle: document.getElementById('configToggle'),
    configBody: document.getElementById('configBody'),
    exportCigareBtn: document.getElementById('exportCigareBtn'),
    areaAddBtn: document.getElementById('areaAddBtn'),
    areaModal: document.getElementById('areaModal'),
    areaModalClose: document.getElementById('areaModalClose'),
    areaModalName: document.getElementById('areaModalName'),
    areaModalRows: document.getElementById('areaModalRows'),
    areaModalCols: document.getElementById('areaModalCols'),
    areaModalAddBtn: document.getElementById('areaModalAddBtn'),
    sortReceiptBtn: document.getElementById('sortReceiptBtn'),
    receiptSortModal: document.getElementById('receiptSortModal'),
    receiptSortClose: document.getElementById('receiptSortClose'),
    receiptSortList: document.getElementById('receiptSortList'),
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

  function saveCustomAreas() {
    saveData(CUSTOM_AREAS_KEY, customAreas);
  }

  function addCustomArea(name, rows, cols) {
    const clean = name.trim();
    if (!clean) return false;
    const r = parseInt(rows, 10);
    const c = parseInt(cols, 10);
    if (isNaN(r) || r < 1 || isNaN(c) || c < 1) return false;
    customAreas[clean] = { rows: r, cols: c };
    saveCustomAreas();
    if (areas.indexOf(clean) < 0) {
      areas.push(clean);
      renderTabs();
    }
    currentArea = clean;
    renderMode();
    return true;
  }

  function removeCustomArea(name) {
    if (!customAreas[name]) return;
    delete customAreas[name];
    delete gridSizes[name];
    saveCustomAreas();
    saveGridSizes();
    const idx = areas.indexOf(name);
    if (idx >= 0) areas.splice(idx, 1);
    if (currentArea === name) currentArea = areas[0] || '';
    renderTabs();
    renderMode();
  }

  function saveReceiptOrder() {
    saveData(RECEIPT_ORDER_KEY, receiptOrder);
  }

  function initReceiptOrder() {
    if (!ALL_PRODUCTS) return;
    const valid = receiptOrder.filter(function(pid) {
      return getProductById(pid) !== null;
    });
    if (valid.length === ALL_PRODUCTS.length) {
      receiptOrder = valid;
    } else {
      receiptOrder = ALL_PRODUCTS.map(function(p) { return p.id; });
    }
    saveReceiptOrder();
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

    lines.forEach(function(line, lineIndex) {
      const trimmed = line.trim();
      if (trimmed === '---') {
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
      const isMachine = /^\[기계\]/.test(name.trim());

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

      const product = { id: productId++, name: name, status: status, positions: positions, isMachine: isMachine, lineIndex: lineIndex };
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

  function scrollGridDown() {
    if (!els.gridScroll) return;
    const scrollAmount = els.gridScroll.clientHeight * 0.8;
    els.gridScroll.scrollTop += scrollAmount;
  }

  function scrollGridUp() {
    if (!els.gridScroll) return;
    const scrollAmount = els.gridScroll.clientHeight * 0.8;
    els.gridScroll.scrollTop -= scrollAmount;
  }

  function enableGridTouchScroll() {
    if (!els.grid || !els.gridScroll) return;
    let startY = 0;
    let startScrollTop = 0;
    let startX = 0;
    let isDragging = false;

    els.grid.addEventListener('touchstart', function(e) {
      if (e.touches.length !== 1) return;
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      startScrollTop = els.gridScroll.scrollTop;
      isDragging = false;
    }, { passive: true });

    els.grid.addEventListener('touchmove', function(e) {
      if (e.touches.length !== 1) return;
      const y = e.touches[0].clientY;
      const x = e.touches[0].clientX;
      const deltaY = startY - y;
      const deltaX = Math.abs(x - startX);
      if (Math.abs(deltaY) > 8 || deltaX > 8) {
        isDragging = true;
      }
      if (isDragging) {
        els.gridScroll.scrollTop = startScrollTop + deltaY;
      }
    }, { passive: true });
  }

  function init() {
    bindEvents();
    enableGridTouchScroll();
    showCigareFileLoader();
  }

  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return String(hash);
  }

  function processCigareText(text) {
    originalCigareText = text;
    const newHash = hashString(text);
    const oldHash = loadData(CIGARE_HASH_KEY);
    if (newHash !== oldHash) {
      receiptOrder = [];
      saveData(CIGARE_HASH_KEY, newHash);
    }
    const parsed = parseCigareText(text);
    AREAS = parsed.AREAS;
    AREA_CELLS = parsed.AREA_CELLS;
    ALL_PRODUCTS = parsed.ALL_PRODUCTS;
    PRODUCT_GROUPS = parsed.PRODUCT_GROUPS;

    areas = AREA_ORDER.filter(function(a) { return AREAS[a]; });
    Object.keys(customAreas).forEach(function(name) {
      if (areas.indexOf(name) < 0) areas.push(name);
    });
    currentArea = areas[0];

    migratePositions();
    migrateBundleData();
    initReceiptOrder();
    renderTabs();
    renderMode();
  }

  function showCigareFileLoader() {
    els.grid.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'load-error';

    const msg = document.createElement('p');
    msg.textContent = 'Cigare.txt 파일을 선택해주세요.';
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
    if (customAreas[area]) {
      return { rows: customAreas[area].rows, cols: customAreas[area].cols };
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

  let selectedRemoteCell = null;

  function initRemoteCell() {
    if (!currentArea) return;
    const cfg = getGridSize(currentArea);
    selectedRemoteCell = { area: currentArea, col: 1, row: 1 };
    updateRemoteDisplay();
  }

  function findCellElement(area, col, row) {
    return els.grid.querySelector('.grid-cell[data-area="' + area + '"][data-col="' + col + '"][data-row="' + row + '"]');
  }

  function selectRemoteCell(area, col, row) {
    const cfg = getGridSize(area);
    if (col < 1) col = cfg.rows;
    if (col > cfg.rows) col = 1;
    if (row < 1) row = cfg.cols;
    if (row > cfg.cols) row = 1;

    const old = selectedRemoteCell ? findCellElement(selectedRemoteCell.area, selectedRemoteCell.col, selectedRemoteCell.row) : null;
    if (old) old.classList.remove('remote-selected');

    selectedRemoteCell = { area: area, col: col, row: row };
    const cell = findCellElement(area, col, row);
    if (cell) {
      cell.classList.add('remote-selected');
      cell.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
    updateRemoteDisplay();
  }

  function moveRemoteCell(dCol, dRow) {
    if (!selectedRemoteCell) {
      initRemoteCell();
      return;
    }
    selectRemoteCell(selectedRemoteCell.area, selectedRemoteCell.col + dCol, selectedRemoteCell.row + dRow);
  }

  function updateRemoteDisplay() {
    if (!selectedRemoteCell) return;
    const cell = findCellElement(selectedRemoteCell.area, selectedRemoteCell.col, selectedRemoteCell.row);
    if (!cell) return;

    const input = cell.querySelector('.cell-input');
    const productIds = buildAreaCells()[selectedRemoteCell.area] && buildAreaCells()[selectedRemoteCell.area][selectedRemoteCell.col + '-' + selectedRemoteCell.row];
    const product = productIds && productIds.length > 0 ? getProductById(productIds[0]) : null;

    if (els.remotePos) els.remotePos.textContent = selectedRemoteCell.area + ' ' + selectedRemoteCell.col + '-' + selectedRemoteCell.row;
    if (els.remoteName) els.remoteName.textContent = product ? cleanName(product.name) : '빈 칸';
    if (els.remoteInput) els.remoteInput.value = input ? input.value : '';
  }

  function applyRemoteValue() {
    if (!selectedRemoteCell || !els.remoteInput) return;
    const cell = findCellElement(selectedRemoteCell.area, selectedRemoteCell.col, selectedRemoteCell.row);
    if (!cell) return;
    const input = cell.querySelector('.cell-input');
    if (!input || input.disabled) return;
    const value = els.remoteInput.value.replace(/[^0-9]/g, '');
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function renderGrid(area) {
    const cfg = getGridSize(area);
    els.areaTitle.textContent = area;
    els.areaSize.textContent = cfg.rows + ' × ' + cfg.cols;
    els.grid.innerHTML = '';
    els.grid.style.gridTemplateColumns = 'repeat(' + cfg.cols + ', minmax(0, 1fr))';
    els.grid.style.gridTemplateRows = 'repeat(' + cfg.rows + ', 60px)';

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
        cell.dataset.area = area;
        cell.dataset.col = originalCol;
        cell.dataset.row = originalRow;
        els.grid.appendChild(cell);
      }
    }

    if (selectedRemoteCell && selectedRemoteCell.area === area) {
      const cell = findCellElement(area, selectedRemoteCell.col, selectedRemoteCell.row);
      if (cell) cell.classList.add('remote-selected');
    } else {
      selectedRemoteCell = { area: area, col: 1, row: 1 };
      const cell = findCellElement(area, 1, 1);
      if (cell) cell.classList.add('remote-selected');
    }
    updateRemoteDisplay();
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
    input.addEventListener('focusout', function(e) {
      if (!e.relatedTarget) {
        focusNextInput(input);
      }
    });
    input.addEventListener('focus', function() {
      setTimeout(function() {
        cell.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 300);
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
    const order = receiptOrder.length ? receiptOrder : ALL_PRODUCTS.map(function(p) { return p.id; });
    const orderIndex = {};
    order.forEach(function(pid, idx) {
      orderIndex[pid] = idx;
    });

    const groups = [];
    PRODUCT_GROUPS.forEach(function(group) {
      const sorted = group.slice().sort(function(a, b) {
        return (orderIndex[a.id] || 0) - (orderIndex[b.id] || 0);
      });

      const seen = {};
      const items = [];
      sorted.forEach(function(product) {
        const key = cleanName(product.name);
        if (!seen[key]) {
          seen[key] = {
            name: getReceiptProductName(product),
            ids: [],
            gridTotal: 0,
            bundleQty: 0,
            machineNum: 0
          };
          items.push(seen[key]);
        }
        const item = seen[key];
        item.ids.push(product.id);
        item.bundleQty += getBundleTotal(product.id);
        item.machineNum += getMachineNumber(product.id);
        const positions = getEffectivePositions(product);
        positions.forEach(function(pos) {
          const parts = pos.split('-');
          if (parts.length === 3) {
            item.gridTotal += (parseInt(getNumber(parts[0], parts[1], parts[2]), 10) || 0);
          }
        });
      });

      groups.push(items.map(function(item) {
        return {
          ids: item.ids,
          name: item.name,
          num: String(item.gridTotal + item.bundleQty * 10 + item.machineNum)
        };
      }));
    });
    return groups.filter(function(g) { return g.length > 0; });
  }

  function getReceiptProductName(product) {
    let name = (product.name || '').replace(/^\[기계\]\s*/, '').trim();
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
    let total = 0;
    positions.forEach(function(pos) {
      const parts = pos.split('-');
      if (parts.length !== 3) return;
      const num = parseInt(getNumber(parts[0], parts[1], parts[2]), 10) || 0;
      total += num;
    });
    return String(total);
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
    receiptFullView = false;
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
      if (els.receiptViewToggleBtn) els.receiptViewToggleBtn.style.display = 'none';
      return;
    }
    const sep = '<div class="receipt-separator">-------------------------------------</div>';
    let rows;
    if (receiptFullView) {
      rows = receiptSections.map(function(section) {
        return section.map(function(item) {
          const ids = (item.ids || []).join(',');
          return '<div class="receipt-row" data-product-ids="' + escapeHtml(ids) + '"><span class="receipt-name">' + escapeHtml(item.name) + '</span><span class="receipt-num">' + escapeHtml(item.num) + '</span></div>';
        }).join('');
      }).join(sep);
      els.receiptText.innerHTML = sep + rows + sep;
      els.receiptPage.textContent = '전체';
      els.receiptPrevBtn.disabled = true;
      els.receiptNextBtn.disabled = true;
    } else {
      const section = receiptSections[receiptCurrentSection];
      rows = section.map(function(item) {
        const ids = (item.ids || []).join(',');
        return '<div class="receipt-row" data-product-ids="' + escapeHtml(ids) + '"><span class="receipt-name">' + escapeHtml(item.name) + '</span><span class="receipt-num">' + escapeHtml(item.num) + '</span></div>';
      }).join('');
      els.receiptText.innerHTML = sep + rows + sep;
      els.receiptPage.textContent = (receiptCurrentSection + 1) + ' / ' + receiptSections.length;
      els.receiptPrevBtn.disabled = receiptCurrentSection === 0;
      els.receiptNextBtn.disabled = receiptCurrentSection === receiptSections.length - 1;
    }
    if (els.receiptViewToggleBtn) {
      els.receiptViewToggleBtn.style.display = 'inline-flex';
      els.receiptViewToggleBtn.textContent = receiptFullView ? '부분 보기' : '전체 보기';
    }
  }

  function toggleReceiptView() {
    receiptFullView = !receiptFullView;
    renderReceiptSection();
  }

  function generateUpdatedCigareText() {
    if (!ALL_PRODUCTS) return originalCigareText || '';
    const order = receiptOrder.length ? receiptOrder : ALL_PRODUCTS.map(function(p) { return p.id; });
    const boundaries = [];
    let count = 0;
    PRODUCT_GROUPS.forEach(function(group) {
      count += group.length;
      boundaries.push(count);
    });

    const lines = [];
    let itemCount = 0;
    order.forEach(function(pid) {
      const product = getProductById(pid);
      if (!product) return;
      const positions = getEffectivePositions(product);
      let newAfter;
      if (positions.length > 0) {
        newAfter = positions.join(' , ');
      } else if (product.status === 'discontinued') {
        newAfter = '0';
      } else {
        newAfter = '?';
      }
      lines.push(product.name + ' / ' + newAfter);
      itemCount++;
      if (boundaries.indexOf(itemCount) >= 0) {
        lines.push('---');
      }
    });
    return lines.join('\n');
  }

  function toggleConfigSection() {
    if (!els.configSection) return;
    els.configSection.classList.toggle('collapsed');
  }

  function openAreaModal() {
    if (!els.areaModal) return;
    els.areaModal.classList.add('show');
    if (els.areaModalName) els.areaModalName.value = '';
    if (els.areaModalRows) els.areaModalRows.value = '';
    if (els.areaModalCols) els.areaModalCols.value = '';
    if (els.areaModalName) els.areaModalName.focus();
  }

  function closeAreaModal() {
    if (!els.areaModal) return;
    els.areaModal.classList.remove('show');
  }

  function submitAreaModal() {
    const name = els.areaModalName ? els.areaModalName.value : '';
    const rows = els.areaModalRows ? els.areaModalRows.value : '';
    const cols = els.areaModalCols ? els.areaModalCols.value : '';
    if (addCustomArea(name, rows, cols)) {
      closeAreaModal();
    } else {
      alert('페이지 이름과 행/열을 확인해주세요.');
    }
  }

  let selectedReceiptIndex = -1;

  function openReceiptSortModal() {
    if (!els.receiptSortModal) return;
    selectedReceiptIndex = -1;
    renderReceiptSortList();
    els.receiptSortModal.classList.add('show');
  }

  function closeReceiptSortModal() {
    if (!els.receiptSortModal) return;
    els.receiptSortModal.classList.remove('show');
  }

  function renderReceiptSortList() {
    if (!els.receiptSortList) return;
    els.receiptSortList.innerHTML = '';
    const order = receiptOrder.length ? receiptOrder : ALL_PRODUCTS.map(function(p) { return p.id; });
    order.forEach(function(pid, idx) {
      const product = getProductById(pid);
      if (!product) return;
      const item = document.createElement('div');
      item.className = 'receipt-sort-item' + (idx === selectedReceiptIndex ? ' selected' : '');
      item.innerHTML = '<span class="receipt-sort-index">' + (idx + 1) + '</span><span class="receipt-sort-name">' + escapeHtml(getReceiptProductName(product)) + '</span>';
      item.addEventListener('click', function() {
        selectedReceiptIndex = idx;
        renderReceiptSortList();
        const target = prompt('이동할 위치 번호를 입력하세요 (1 ~ ' + order.length + ')', String(idx + 1));
        if (target === null) {
          selectedReceiptIndex = -1;
          renderReceiptSortList();
          return;
        }
        const targetIdx = parseInt(target, 10) - 1;
        if (isNaN(targetIdx) || targetIdx < 0 || targetIdx >= order.length) {
          selectedReceiptIndex = -1;
          renderReceiptSortList();
          alert('올바른 위치 번호를 입력해주세요.');
          return;
        }
        const moved = order.splice(idx, 1)[0];
        order.splice(targetIdx, 0, moved);
        receiptOrder = order.slice();
        saveReceiptOrder();
        selectedReceiptIndex = -1;
        renderReceiptSortList();
      });
      els.receiptSortList.appendChild(item);
    });
  }

  function exportUpdatedCigare() {
    const content = generateUpdatedCigareText();
    if (!content) {
      alert('납(납오)기할 Cigare.txt 내용이 없습니다.');
      return;
    }
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Cigare.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Cigare.txt 다운로드 완료');
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
    if (els.receiptViewToggleBtn) {
      els.receiptViewToggleBtn.addEventListener('click', toggleReceiptView);
    }
    els.receiptText.addEventListener('click', function(e) {
      const row = e.target.closest('.receipt-row');
      if (!row) return;
      const idsAttr = row.dataset.productIds || '';
      const ids = idsAttr.split(',').filter(function(s) { return s; }).map(function(s) { return parseInt(s, 10); });
      if (ids.length === 0) return;
      const product = getProductById(ids[0]);
      if (!product) return;
      const positions = [];
      ids.forEach(function(id) {
        const p = getProductById(id);
        if (p) positions.push(getProductCoordinate(p));
      });
      const coordText = positions.length > 1 ? positions.join(', ') : positions[0];
      showToast(cleanName(product.name) + ' 위치: ' + coordText);
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

    if (els.configToggle) {
      els.configToggle.addEventListener('click', toggleConfigSection);
    }
    if (els.exportCigareBtn) {
      els.exportCigareBtn.addEventListener('click', exportUpdatedCigare);
    }
    if (els.scrollGridUpBtn) {
      els.scrollGridUpBtn.addEventListener('click', scrollGridUp);
    }
    if (els.scrollGridDownBtn) {
      els.scrollGridDownBtn.addEventListener('click', scrollGridDown);
    }

    if (els.remoteLeft) els.remoteLeft.addEventListener('click', function() { moveRemoteCell(-1, 0); });
    if (els.remoteUp) els.remoteUp.addEventListener('click', function() { moveRemoteCell(0, -1); });
    if (els.remoteDown) els.remoteDown.addEventListener('click', function() { moveRemoteCell(0, 1); });
    if (els.remoteRight) els.remoteRight.addEventListener('click', function() { moveRemoteCell(1, 0); });
    if (els.remoteInput) {
      els.remoteInput.addEventListener('input', function() {
        els.remoteInput.value = els.remoteInput.value.replace(/[^0-9]/g, '');
        applyRemoteValue();
      });
      els.remoteInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          applyRemoteValue();
          els.remoteInput.blur();
        }
      });
    }

    if (els.gridScroll) {
      try {
        els.gridScroll.addEventListener('touchstart', function() {}, { passive: true });
      } catch (e) {
        els.gridScroll.addEventListener('touchstart', function() {});
      }
    }

    if (els.areaAddBtn) {
      els.areaAddBtn.addEventListener('click', function() {
        if (!AREAS) return;
        openAreaModal();
      });
    }
    if (els.areaModalClose) els.areaModalClose.addEventListener('click', closeAreaModal);
    if (els.areaModal) {
      els.areaModal.addEventListener('click', function(e) {
        if (e.target === els.areaModal) closeAreaModal();
      });
    }
    if (els.areaModalAddBtn) els.areaModalAddBtn.addEventListener('click', submitAreaModal);
    if (els.areaModalName) {
      els.areaModalName.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') submitAreaModal();
      });
    }

    if (els.sortReceiptBtn) {
      els.sortReceiptBtn.addEventListener('click', function() {
        if (!AREAS) return;
        openReceiptSortModal();
      });
    }
    if (els.receiptSortClose) els.receiptSortClose.addEventListener('click', closeReceiptSortModal);
    if (els.receiptSortModal) {
      els.receiptSortModal.addEventListener('click', function(e) {
        if (e.target === els.receiptSortModal) closeReceiptSortModal();
      });
    }
  }

  init();
})();

