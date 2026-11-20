// =============================================================
// waypoint_list.js
// GameUserSettings.ini / My Storage / Location Library / Waypoint Log の
// 4つすべてで共通利用する「Waypoint一覧」コンポーネント。
//
// 各リストの違いは「データ取得元・保存先・編集可否」のみであり、
// 一覧の描画・検索・ソート・列設定・選択・ドラッグ開始は、
// すべてこのクラスが共通で担当する(要件8「共通WaypointList」)。
//
// 管理ロジック(add/remove/find等のデータ操作)と表示ロジック(render)を
// 1クラスにまとめてはいるが、外部(app.js)からは常にメソッド経由で
// 操作する設計とし、Waypoint配列を直接いじらせないことで、
// 将来Map Viewerなど他の画面を追加する際も、このクラスのAPIだけを
// 経由すれば安全にWaypoint一覧を扱えるようにしている。
//
// 列設定(表示列・列順・列幅)・検索文字・ソート状態は SettingsStore
// (settings_store.js)を通じて永続化される。このクラス自身は
// localStorageを直接参照しない。
// =============================================================

// Icon / Name / Map は常に固定表示・固定位置(Iconが最左列、次にName、
// Mapは外部からの表示切替のみ)とし、ユーザーが表示/非表示・順序を
// 変更できるのは Lat / Lon / CustomTag の3列のみ。
// これは「列幅変更・列順変更・表示列変更」という要件を、
// 実装コストを抑えつつ満たすための設計上の割り切りである
// (Name/Mapを非表示にできてしまうと行の内容が分からなくなるため。
//  Iconは「ICON列を最左列としてください」という要件のため、
//  ユーザーが順序を動かせない固定列として扱う)。
//
// Lat/Lonの値そのものはこのクラスでは計算しない。「UIから直接座標計算を
// 行わないでください」という要件のため、値の算出は app.js が注入する
// getLatLon(wp) コールバック(内部でCoordinateConverter/MapConfigを
// 利用する)に委譲し、このクラスは受け取った結果を表示するだけに徹する。
// Icon列も同様に、実際の描画は app.js が注入する getIconMarkup(wp)
// コールバック(内部でwaypoint_icon.jsのWaypointIconを利用する)に委譲する
// (要件12「アイコン描画処理はWaypointIconへ集約してください」への対応)。
const CONFIGURABLE_COLUMNS = [
  { key: 'lat', label: 'Lat', numeric: true },
  { key: 'lon', label: 'Lon', numeric: true },
  { key: 'customTag', label: 'CustomTag', numeric: false },
];

/** Icon列の初期幅(px)。要件通り40〜48pxの範囲で固定する。 */
const ICON_COLUMN_DEFAULT_WIDTH = 44;

export class WaypointListController {
  /**
   * @param {object} config
   * @param {string} config.listKey - 'ini' | 'storage' | 'library' | 'log'
   * @param {HTMLElement} config.theadRow - 列ヘッダーを描画する<tr>
   * @param {HTMLElement} config.tbody
   * @param {HTMLElement} config.emptyStateEl
   * @param {HTMLElement} config.countEl
   * @param {HTMLElement} config.searchInputEl
   * @param {HTMLElement} config.columnSettingsBtn - 列設定ポップオーバーを開くボタン
   * @param {import('./settings_store.js').SettingsStore} config.settingsStore
   * @param {(waypoint: object|null, listKey: string) => void} [config.onSelect]
   */
  constructor({
    listKey, theadRow, tbody, emptyStateEl, countEl, searchInputEl, columnSettingsBtn,
    categoryFilterEl, settingsStore, onSelect, getLatLon, getIconMarkup,
  }) {
    this.listKey = listKey;
    this.theadRow = theadRow;
    this.tbody = tbody;
    this.emptyStateEl = emptyStateEl;
    this.countEl = countEl;
    this.searchInputEl = searchInputEl;
    this.columnSettingsBtn = columnSettingsBtn;
    this.categoryFilterEl = categoryFilterEl;
    this.settingsStore = settingsStore;
    this.onSelect = onSelect || (() => {});
    // Lat/Lonの値を算出する外部コールバック。(wp) => {lat:number, lon:number} | null を返す。
    // nullは「未キャリブレーション等でまだ算出できない」ことを示し、'…'として表示する。
    this.getLatLon = getLatLon || (() => null);
    // MarkIconのアイコン表示(HTML文字列)を算出する外部コールバック。
    // (wp) => string を返す(waypoint_icon.jsのrenderWaypointIconHtmlを利用する)。
    this.getIconMarkup = getIconMarkup || (() => '');

    this.items = [];
    this.selectedId = null;
    this.highlightMatcher = null; // app.js が同期ハイライト判定関数を差し込む
    this.mapColumnVisible = true; // Current Mapが「All Maps」の時のみtrue(app.jsが制御)
    this.externalMapFilter = '__all__'; // Current Map(グローバルフィルター)
    this.categoryFilter = '__all__'; // このリスト内のCategoryフィルター

    this.searchText = this.settingsStore.get(this._settingsKey('search'), '');
    this.sortState = this.settingsStore.get(this._settingsKey('sort'), { field: null, dir: 'asc' });
    this.columnConfig = this.settingsStore.get(this._settingsKey('columns'), {
      order: ['lat', 'lon', 'customTag'],
      visible: { lat: true, lon: true, customTag: true },
      widths: {},
    });
    // Icon列は固定列のため表示列設定(order/visible)には含めないが、
    // 列幅だけは他の列と同じ仕組み(columnConfig.widths + ドラッグリサイズ)で
    // 管理する。初回はここで既定幅(40〜48px)を補完する。
    if (this.columnConfig.widths.icon == null) {
      this.columnConfig.widths.icon = ICON_COLUMN_DEFAULT_WIDTH;
    }

    this.searchInputEl.value = this.searchText;

    this.tbody.addEventListener('click', (e) => this._handleRowClick(e));
    this.searchInputEl.addEventListener('input', () => {
      this.searchText = this.searchInputEl.value;
      this.settingsStore.set(this._settingsKey('search'), this.searchText);
      this.render();
    });
    if (this.columnSettingsBtn) {
      this.columnSettingsBtn.addEventListener('click', (e) => this._toggleColumnPopover(e));
    }
    if (this.categoryFilterEl) {
      this.categoryFilterEl.addEventListener('change', () => {
        this.categoryFilter = this.categoryFilterEl.value || '__all__';
        this.render();
      });
    }
  }

  _settingsKey(name) {
    return `list.${this.listKey}.${name}`;
  }

  // --- データ操作(管理ロジック) -------------------------------------

  getAll() { return this.items; }

  setAll(items) {
    this.items = items;
    this.selectedId = null;
    this.render();
    this.onSelect(null, this.listKey);
  }

  find(id) { return this.items.find((w) => w.id === id); }

  add(wp) { this.items.push(wp); this.render(); }

  remove(id) {
    this.items = this.items.filter((w) => w.id !== id);
    if (this.selectedId === id) this.clearSelection();
    this.render();
  }

  replace(id, wp) {
    const idx = this.items.findIndex((w) => w.id === id);
    if (idx === -1) return;
    this.items[idx] = wp;
    this.render();
  }

  getSelected() { return this.selectedId ? this.find(this.selectedId) : null; }

  clearSelection() {
    this.selectedId = null;
    this.render();
    this.onSelect(null, this.listKey);
  }

  setSelectedId(id) {
    this.selectedId = id;
    this.render();
  }

  setHighlightMatcher(fn) {
    this.highlightMatcher = fn;
    this.render();
  }

  /** Current Map(グローバルフィルター)が変化した際に app.js から呼ばれる */
  setExternalMapFilter(mapValue) {
    this.externalMapFilter = mapValue || '__all__';
    this.render();
  }

  /** Map列の表示/非表示(Current Mapが「All Maps」かどうか)を切り替える */
  setMapColumnVisible(visible) {
    this.mapColumnVisible = visible;
    this.render();
  }

  // --- イベントハンドラ -----------------------------------------------

  _handleRowClick(e) {
    const tr = e.target.closest('tr');
    if (!tr) return;
    const id = tr.dataset.id;

    this.selectedId = this.selectedId === id ? null : id;
    this.render();
    this.onSelect(this.getSelected(), this.listKey);
  }

  bindDragEvents(onDragStart) {
    this.tbody.addEventListener('dragstart', (e) => {
      const tr = e.target.closest('tr');
      if (!tr) return;
      tr.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify({ listKey: this.listKey, id: tr.dataset.id }));
      onDragStart?.(tr.dataset.id);
    });
    this.tbody.addEventListener('dragend', (e) => {
      const tr = e.target.closest('tr');
      if (tr) tr.classList.remove('dragging');
    });
  }

  // --- 検索・ソート・フィルターを適用した表示用リストを取得 -------------------

  _visibleItems() {
    let list = this.items;

    if (this.externalMapFilter && this.externalMapFilter !== '__all__') {
      list = list.filter((w) => w.parsed.map === this.externalMapFilter);
    }

    if (this.categoryFilter && this.categoryFilter !== '__all__') {
      if (this.categoryFilter === '__none__') {
        list = list.filter((w) => !w.parsed.category || w.parsed.category.trim() === '');
      } else {
        list = list.filter((w) => w.parsed.category === this.categoryFilter);
      }
    }

    const q = this.searchText.trim().toLowerCase();
    if (q !== '') {
      list = list.filter((w) => {
        const name = String(w.parsed.name ?? '').toLowerCase();
        const tag = String(w.parsed.customTag ?? '').toLowerCase();
        const map = String(w.parsed.map ?? '').toLowerCase();
        return name.includes(q) || tag.includes(q) || map.includes(q);
      });
    }

    if (this.sortState.field) {
      const field = this.sortState.field;
      const dir = this.sortState.dir === 'desc' ? -1 : 1;
      const valueOf = (item) => {
        if (field === 'lat' || field === 'lon') {
          const latLon = this.getLatLon(item);
          return latLon ? latLon[field] : null;
        }
        return item.parsed[field];
      };
      list = [...list].sort((a, b) => {
        const va = valueOf(a);
        const vb = valueOf(b);
        if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
        return String(va ?? '').localeCompare(String(vb ?? ''), 'ja') * dir;
      });
    }

    return list;
  }

  // --- 描画(表示ロジック) ---------------------------------------------

  render() {
    this._renderHeader();
    this._renderCategoryFilterOptions();

    const visible = this._visibleItems();
    // Current Map等のフィルターが効いている間は「現在表示中の件数」を、
    // 何もフィルターされていない状態(=全件表示)では自然に全件数と
    // 一致する。要件の「ALL選択時のみ全Waypoint数」は、フィルター無しなら
    // 表示件数=全件数になるという形で満たされる。
    this.countEl.textContent = `${visible.length} Waypoints`;
    this.tbody.innerHTML = '';

    if (visible.length === 0) {
      this.emptyStateEl.style.display = 'block';
      return;
    }
    this.emptyStateEl.style.display = 'none';

    const columns = this._activeColumns();

    for (const wp of visible) {
      const tr = document.createElement('tr');
      tr.dataset.id = wp.id;
      tr.draggable = true;

      if (this.selectedId === wp.id) tr.classList.add('selected');
      if (this.highlightMatcher && this.highlightMatcher(wp)) tr.classList.add('sync-highlight');

      tr.innerHTML = columns.map((col) => this._renderCell(col, wp)).join('');
      this.tbody.appendChild(tr);
    }
  }

  /** Categoryフィルターの選択肢を、このリストに実際に存在するCategoryから生成する(件数付き) */
  _renderCategoryFilterOptions() {
    if (!this.categoryFilterEl) return;
    const current = this.categoryFilterEl.value || '__all__';
    const counts = new Map();
    let unsetCount = 0;

    for (const w of this.items) {
      const c = (w.parsed.category || '').trim();
      if (!c) { unsetCount += 1; continue; }
      counts.set(c, (counts.get(c) || 0) + 1);
    }

    const cats = Array.from(counts.keys()).sort((a, b) => a.localeCompare(b, 'ja'));
    const options = [`<option value="__all__">All (${this.items.length})</option>`];
    if (unsetCount > 0) options.push(`<option value="__none__">(未設定) (${unsetCount})</option>`);
    options.push(...cats.map((c) => `<option value="${esc(c)}">${esc(c)} (${counts.get(c)})</option>`));

    this.categoryFilterEl.innerHTML = options.join('');
    this.categoryFilterEl.value = ['__all__', '__none__', ...cats].includes(current) ? current : '__all__';
    this.categoryFilter = this.categoryFilterEl.value;
  }

  _activeColumns() {
    const cols = [
      { key: 'icon', label: 'Icon', numeric: false, fixed: true },
      { key: 'name', label: 'Name', numeric: false, fixed: true },
    ];
    if (this.mapColumnVisible) cols.push({ key: 'map', label: 'Map', numeric: false, fixed: true });

    for (const key of this.columnConfig.order) {
      if (this.columnConfig.visible[key] === false) continue;
      const def = CONFIGURABLE_COLUMNS.find((c) => c.key === key);
      if (def) cols.push(def);
    }
    return cols;
  }

  _renderCell(col, wp) {
    if (col.key === 'icon') {
      const width = this.columnConfig.widths[col.key];
      const style = width ? ` style="width:${width}px;max-width:${width}px;"` : '';
      return `<td class="icon-cell"${style}>${this.getIconMarkup(wp)}</td>`;
    }

    let value;
    if (col.key === 'name') value = wp.parsed.name;
    else if (col.key === 'map') value = wp.parsed.map;
    else if (col.key === 'customTag') value = wp.parsed.customTag;
    else if (col.key === 'lat' || col.key === 'lon') {
      const latLon = this.getLatLon(wp);
      value = latLon && Number.isFinite(latLon[col.key]) ? formatNum(round2(latLon[col.key])) : '…';
    } else {
      value = '';
    }
    const width = this.columnConfig.widths[col.key];
    const style = width ? ` style="width:${width}px;max-width:${width}px;"` : '';
    return `<td class="${col.numeric ? 'num' : ''}"${style}>${esc(value)}</td>`;
  }

  _renderHeader() {
    const columns = this._activeColumns();
    this.theadRow.innerHTML = columns.map((col) => {
      const width = this.columnConfig.widths[col.key];
      const style = width ? ` style="width:${width}px;max-width:${width}px;"` : '';
      const sortable = col.key !== 'icon';
      const sortIndicator = sortable && this.sortState.field === col.key ? (this.sortState.dir === 'asc' ? ' ▲' : ' ▼') : '';
      return `<th class="${col.numeric ? 'num' : ''} ${sortable ? 'sortable' : ''}" data-col="${col.key}"${style}>${esc(col.label)}${sortIndicator}<span class="col-resizer" data-col="${col.key}"></span></th>`;
    }).join('');

    // ソートクリック(Icon列は対象外)
    this.theadRow.querySelectorAll('th.sortable').forEach((th) => {
      th.addEventListener('click', (e) => {
        if (e.target.classList.contains('col-resizer')) return;
        this._toggleSort(th.dataset.col);
      });
    });

    // 列幅リサイズ
    this.theadRow.querySelectorAll('.col-resizer').forEach((handle) => {
      handle.addEventListener('mousedown', (e) => this._startResize(e, handle.dataset.col));
    });
  }

  _toggleSort(field) {
    if (this.sortState.field === field) {
      this.sortState.dir = this.sortState.dir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortState = { field, dir: 'asc' };
    }
    this.settingsStore.set(this._settingsKey('sort'), this.sortState);
    this.render();
  }

  _startResize(e, colKey) {
    e.preventDefault();
    e.stopPropagation();
    const th = e.target.closest('th');
    const startX = e.clientX;
    const startWidth = th.getBoundingClientRect().width;

    const onMove = (moveEvent) => {
      const newWidth = Math.max(40, Math.round(startWidth + (moveEvent.clientX - startX)));
      this.columnConfig.widths[colKey] = newWidth;
      this.render();
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      this.settingsStore.set(this._settingsKey('columns'), this.columnConfig);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // --- 列設定ポップオーバー(表示列・列順) ---------------------------------

  _toggleColumnPopover(e) {
    if (this._popoverEl) {
      this._closePopover();
      return;
    }
    const popover = document.createElement('div');
    popover.className = 'col-settings-popover';
    popover.innerHTML = this._popoverHtml();
    document.body.appendChild(popover);

    const rect = e.target.getBoundingClientRect();
    popover.style.top = `${rect.bottom + 4}px`;
    popover.style.left = `${Math.max(8, rect.right - popover.offsetWidth - 220)}px`;

    this._popoverEl = popover;
    this._wirePopover(popover);

    // 外側クリックで閉じる
    setTimeout(() => {
      this._outsideClickHandler = (evt) => {
        if (!popover.contains(evt.target) && evt.target !== this.columnSettingsBtn) this._closePopover();
      };
      document.addEventListener('click', this._outsideClickHandler);
    }, 0);
  }

  _closePopover() {
    if (this._popoverEl) {
      this._popoverEl.remove();
      this._popoverEl = null;
    }
    if (this._outsideClickHandler) {
      document.removeEventListener('click', this._outsideClickHandler);
      this._outsideClickHandler = null;
    }
  }

  _popoverHtml() {
    const rows = this.columnConfig.order.map((key, idx) => {
      const def = CONFIGURABLE_COLUMNS.find((c) => c.key === key);
      const visible = this.columnConfig.visible[key] !== false;
      return `
        <div class="col-row" data-key="${key}">
          <label><input type="checkbox" class="col-visible" data-key="${key}" ${visible ? 'checked' : ''}/> ${esc(def.label)}</label>
          <span class="col-order-btns">
            <button class="col-up" data-key="${key}" ${idx === 0 ? 'disabled' : ''}>↑</button>
            <button class="col-down" data-key="${key}" ${idx === this.columnConfig.order.length - 1 ? 'disabled' : ''}>↓</button>
          </span>
        </div>`;
    }).join('');
    return `<div class="col-popover-title">表示列 / 列順</div>${rows}`;
  }

  _wirePopover(popover) {
    popover.querySelectorAll('.col-visible').forEach((cb) => {
      cb.addEventListener('change', () => {
        this.columnConfig.visible[cb.dataset.key] = cb.checked;
        this.settingsStore.set(this._settingsKey('columns'), this.columnConfig);
        this.render();
      });
    });
    popover.querySelectorAll('.col-up').forEach((btn) => {
      btn.addEventListener('click', () => this._moveColumn(btn.dataset.key, -1));
    });
    popover.querySelectorAll('.col-down').forEach((btn) => {
      btn.addEventListener('click', () => this._moveColumn(btn.dataset.key, 1));
    });
  }

  _moveColumn(key, delta) {
    const order = this.columnConfig.order;
    const idx = order.indexOf(key);
    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= order.length) return;
    [order[idx], order[newIdx]] = [order[newIdx], order[idx]];
    this.settingsStore.set(this._settingsKey('columns'), this.columnConfig);
    this._closePopover();
    this.render();
  }
}

function esc(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}

function formatNum(n) {
  return Number.isFinite(n) ? String(n) : '0';
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
