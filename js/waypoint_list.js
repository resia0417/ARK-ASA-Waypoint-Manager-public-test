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
// 操作する設計とし、Waypoint配列を直接いじらせない。
// Map Viewerも、このクラスのAPI(getVisibleItems等)経由で
// 表示中の一覧を取得している。
//
// 列幅・検索文字・ソート状態は SettingsStore(settings_store.js)を
// 通じて永続化される(列の表示/順序は固定)。このクラス自身は
// localStorageを直接参照しない。
// =============================================================

// 列構成(Icon / Name / Map / Lat / Lon / CustomTag)と並びは固定で、
// ユーザーが変更できるのは列幅(ドラッグリサイズ)だけ
// (v0.6.3で列の表示/順序を変える設定UIは廃止した)。
// Map列は、特定マップ選択中は冗長なため自動で隠れる。
//
// Lat/Lonの値そのものはこのクラスでは計算しない。「UIから直接座標計算を
// 行わないでください」という要件のため、値の算出は app.js が注入する
// getLatLon(wp) コールバック(内部でCoordinateConverter/MapConfigを
// 利用する)に委譲し、このクラスは受け取った結果を表示するだけに徹する。
// Icon列も同様に、実際の描画は app.js が注入する getIconMarkup(wp)
// コールバック(内部でwaypoint_icon.jsのWaypointIconを利用する)に委譲する
// (要件12「アイコン描画処理はWaypointIconへ集約してください」への対応)。
import { escapeHtml as esc, formatNum, roundTo } from './util.js';

const CONFIGURABLE_COLUMNS = [
  { key: 'lat', label: 'Lat', numeric: true },
  { key: 'lon', label: 'Lon', numeric: true },
  { key: 'customTag', label: 'CustomTag', numeric: false },
];

/** Icon列の初期幅(px)。要件通り40〜48pxの範囲で固定する。 */
const ICON_COLUMN_DEFAULT_WIDTH = 44;

/** Lat/Lon列の初期幅(px)。表示は最大でも「100.0」程度(3桁+小数)なので、
 * 等幅フォント5文字+セル余白に収まるギリギリの幅にする(v0.8.2)。 */
const LAT_LON_COLUMN_DEFAULT_WIDTH = 64;

export class WaypointListController {
  /**
   * @param {object} config
   * @param {string} config.listKey - 'ini' | 'storage' | 'library' | 'log'
   * @param {HTMLElement} config.theadRow - 列ヘッダーを描画する<tr>
   * @param {HTMLElement} config.tbody
   * @param {HTMLElement} config.emptyStateEl
   * @param {HTMLElement} config.countEl
   * @param {HTMLElement} config.searchInputEl
   * @param {import('./settings_store.js').SettingsStore} config.settingsStore
   * @param {(waypoint: object|null, listKey: string) => void} [config.onSelect]
   */
  constructor({
    listKey, theadRow, tbody, emptyStateEl, countEl, searchInputEl,
    categoryFilterEl, settingsStore, onSelect, getLatLon, getIconMarkup,
    rowActions, onEditRequest, onDeleteRequest, getMapKey, onVisibleChange,
  }) {
    this.listKey = listKey;
    this.theadRow = theadRow;
    this.tbody = tbody;
    this.emptyStateEl = emptyStateEl;
    this.countEl = countEl;
    this.searchInputEl = searchInputEl;
    this.categoryFilterEl = categoryFilterEl;
    this.settingsStore = settingsStore;
    this.onSelect = onSelect || (() => {});
    // Lat/Lonの値を算出する外部コールバック。(wp) => {lat:number, lon:number} | null を返す。
    // nullは「config未読込などで算出できない」ことを示し、'…'として表示する。
    this.getLatLon = getLatLon || (() => null);
    // MarkIconのアイコン表示(HTML文字列)を算出する外部コールバック。
    // (wp) => string を返す(waypoint_icon.jsのrenderWaypointIconHtmlを利用する)。
    this.getIconMarkup = getIconMarkup || (() => '');
    // Current Mapフィルター用のキー算出(v0.5.1: Genesis陸/海など実効名で比較する)。
    this.getMapKey = getMapKey || ((wp) => wp.parsed.map);
    // 行内アクション(編集/削除アイコンボタン、v0.5.0)。logなど読み取り専用リストでは無効。
    this.rowActions = !!rowActions;
    this.onEditRequest = onEditRequest || (() => {});
    this.onDeleteRequest = onDeleteRequest || (() => {});
    // 表示件数(検索・フィルター適用後)が変わり得る描画の通知先(v0.8.4: マップ連動用)
    this.onVisibleChange = onVisibleChange || (() => {});

    this.items = [];
    this.selectedId = null;
    this.highlightMatcher = null; // app.js が同期ハイライト判定関数を差し込む
    this.mapColumnVisible = true; // Current Mapが「All Maps」の時のみtrue(app.jsが制御)
    this.externalMapFilter = '__all__'; // Current Map(グローバルフィルター)
    this.categoryFilter = '__all__'; // このリスト内のCategoryフィルター

    this.searchText = this.settingsStore.get(this._settingsKey('search'), '');
    this.sortState = this.settingsStore.get(this._settingsKey('sort'), { field: null, dir: 'asc' });
    // v0.6.3: 表示列・列順の設定UIを廃止。列順・表示列は常にデフォルトとし、
    // 保存済みの設定からは列幅だけを引き継ぐ(過去に列を隠した設定が残っていても全列表示に戻る)。
    const storedColumns = this.settingsStore.get(this._settingsKey('columns'), null);
    this.columnConfig = {
      widths: (storedColumns && storedColumns.widths) || {},
    };
    // Icon列は固定列のため表示列設定(order/visible)には含めないが、
    // 列幅だけは他の列と同じ仕組み(columnConfig.widths + ドラッグリサイズ)で
    // 管理する。初回はここで既定幅(40〜48px)を補完する。
    if (this.columnConfig.widths.icon == null) {
      this.columnConfig.widths.icon = ICON_COLUMN_DEFAULT_WIDTH;
    }
    if (this.columnConfig.widths.lat == null) {
      this.columnConfig.widths.lat = LAT_LON_COLUMN_DEFAULT_WIDTH;
    }
    if (this.columnConfig.widths.lon == null) {
      this.columnConfig.widths.lon = LAT_LON_COLUMN_DEFAULT_WIDTH;
    }

    this.searchInputEl.value = this.searchText;

    this.tbody.addEventListener('click', (e) => this._handleRowClick(e));
    this.searchInputEl.addEventListener('input', () => {
      this.searchText = this.searchInputEl.value;
      this.settingsStore.set(this._settingsKey('search'), this.searchText);
      this.render();
    });
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
    this._updateSelectionClasses();
    this.onSelect(null, this.listKey);
  }

  setSelectedId(id) {
    this.selectedId = id;
    this._updateSelectionClasses();
  }

  setHighlightMatcher(fn) {
    this.highlightMatcher = fn;
    this._updateHighlightClasses();
  }

  // 選択ハイライトだけを付け替える(全行再描画しない。v0.8.6 軽量化①)
  _updateSelectionClasses() {
    for (const tr of this.tbody.querySelectorAll('tr.selected')) tr.classList.remove('selected');
    if (this.selectedId) {
      const tr = this.tbody.querySelector(`tr[data-id="${CSS.escape(this.selectedId)}"]`);
      if (tr) tr.classList.add('selected');
    }
  }

  // 同期ハイライトだけを付け替える(全行再描画しない。v0.8.6 軽量化①)
  _updateHighlightClasses() {
    for (const tr of this.tbody.querySelectorAll('tr')) {
      const wp = this.find(tr.dataset.id);
      tr.classList.toggle('sync-highlight', !!(this.highlightMatcher && wp && this.highlightMatcher(wp)));
    }
  }

  /** フィルターとMap列表示をまとめて設定し、描画は最大1回にする(v0.8.6 軽量化④) */
  setMapFilter(mapValue, columnVisible) {
    const v = mapValue || '__all__';
    if (this.externalMapFilter === v && this.mapColumnVisible === columnVisible) return;
    this.externalMapFilter = v;
    this.mapColumnVisible = columnVisible;
    this.render();
  }

  // --- イベントハンドラ -----------------------------------------------

  _handleRowClick(e) {
    const tr = e.target.closest('tr');
    if (!tr) return;
    // 行内アクション(編集/削除)は選択トグルではなく、そのWaypointへの操作として扱う
    const actionBtn = e.target.closest('[data-row-action]');
    if (actionBtn) {
      const wp = this.items.find((w) => w.id === tr.dataset.id);
      if (wp) {
        if (actionBtn.dataset.rowAction === 'edit') this.onEditRequest(wp);
        else if (actionBtn.dataset.rowAction === 'delete') this.onDeleteRequest(wp);
      }
      return;
    }
    const id = tr.dataset.id;

    this.selectedId = this.selectedId === id ? null : id;
    this._updateSelectionClasses();
    this.onSelect(this.getSelected(), this.listKey);
  }

  bindDragEvents() {
    this.tbody.addEventListener('dragstart', (e) => {
      if (e.target.closest('[data-row-action]')) { e.preventDefault(); return; } // アイコン操作をドラッグにしない
      const tr = e.target.closest('tr');
      if (!tr) return;
      tr.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify({ listKey: this.listKey, id: tr.dataset.id }));
    });
    this.tbody.addEventListener('dragend', (e) => {
      const tr = e.target.closest('tr');
      if (tr) tr.classList.remove('dragging');
    });
  }

  // --- 検索・ソート・フィルターを適用した表示用リストを取得 -------------------

  /** 検索・Category・Current Mapフィルター適用後の表示中アイテム */
  getVisibleItems() {
    let list = this.items;

    if (this.externalMapFilter && this.externalMapFilter !== '__all__') {
      list = list.filter((w) => this.getMapKey(w) === this.externalMapFilter);
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
    // tfoot(Add行)のcolspanは実際の列数に合わせる。固定値(99等)にすると
    // table-layout:fixed の列数が膨らみ、可変幅の列が潰れる(v0.6.0で実測特定)
    const footCell = this.theadRow.closest('table')?.querySelector('tfoot .add-row-cell');
    if (footCell) footCell.colSpan = this._activeColumns().length + (this.rowActions ? 1 : 0);
    this._renderCategoryFilterOptions();

    const visible = this.getVisibleItems();
    this.onVisibleChange();
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

      tr.innerHTML = columns.map((col) => this._renderCell(col, wp)).join('') +
        (this.rowActions ? this._renderActionsCell() : '');
      this.tbody.appendChild(tr);
    }
  }

  /** Categoryフィルターの選択肢を、このリストに実際に存在するCategoryから生成する(件数付き)
   * 件数は表示中のマップ(ExternalMapFilter)で絞った範囲で数える(v0.8.0) */
  _renderCategoryFilterOptions() {
    if (!this.categoryFilterEl) return;
    const current = this.categoryFilterEl.value || '__all__';
    const counts = new Map();
    let unsetCount = 0;

    const scoped = (this.externalMapFilter && this.externalMapFilter !== '__all__')
      ? this.items.filter((w) => this.getMapKey(w) === this.externalMapFilter)
      : this.items;

    for (const w of scoped) {
      const c = (w.parsed.category || '').trim();
      if (!c) { unsetCount += 1; continue; }
      counts.set(c, (counts.get(c) || 0) + 1);
    }

    const cats = Array.from(counts.keys()).sort((a, b) => a.localeCompare(b, 'ja'));
    const options = [`<option value="__all__">All (${scoped.length})</option>`];
    if (unsetCount > 0) options.push(`<option value="__none__">(未設定) (${unsetCount})</option>`);
    options.push(...cats.map((c) => `<option value="${esc(c)}">${esc(c)} (${counts.get(c)})</option>`));

    this.categoryFilterEl.innerHTML = options.join('');
    this.categoryFilterEl.value = ['__all__', '__none__', ...cats].includes(current) ? current : '__all__';
    this.categoryFilter = this.categoryFilterEl.value;
  }

  _activeColumns() {
    // 列の並び・表示は固定(v0.6.3で設定UIを廃止)。可変なのは列幅のみ
    const cols = [
      { key: 'icon', label: 'Icon', numeric: false },
      { key: 'name', label: 'Name', numeric: false },
    ];
    if (this.mapColumnVisible) cols.push({ key: 'map', label: 'Map', numeric: false });
    for (const def of CONFIGURABLE_COLUMNS) cols.push(def);
    return cols;
  }

  /** 列幅の style 属性文字列(未設定なら空)。 */
  _widthStyle(key) {
    const width = this.columnConfig.widths[key];
    return width ? ` style="width:${width}px;max-width:${width}px;"` : '';
  }

  _renderCell(col, wp) {
    if (col.key === 'icon') {
      return `<td class="icon-cell"${this._widthStyle(col.key)}>${this.getIconMarkup(wp)}</td>`;
    }

    let value = '';
    if (col.key === 'name') value = wp.parsed.name;
    else if (col.key === 'map') value = wp.parsed.map;
    else if (col.key === 'customTag') value = wp.parsed.customTag;
    else if (col.key === 'lat' || col.key === 'lon') {
      const latLon = this.getLatLon(wp);
      value = latLon && Number.isFinite(latLon[col.key]) ? formatNum(roundTo(latLon[col.key], 2)) : '…';
    }
    return `<td class="${col.numeric ? 'num' : ''}"${this._widthStyle(col.key)}>${esc(value)}</td>`;
  }

  /** 行内アクション(編集=ペン / 削除=ゴミ箱)のセル。ARK本編のWaypoint一覧と同じ並び */
  _renderActionsCell() {
    const pencil = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>';
    const trash = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
    return `<td class="row-actions"><span class="row-actions-wrap"><button type="button" class="row-action" data-row-action="edit" title="編集" draggable="false">${pencil}</button><button type="button" class="row-action row-action-danger" data-row-action="delete" title="削除" draggable="false">${trash}</button></span></td>`;
  }

  _renderHeader() {
    const columns = this._activeColumns();
    this.theadRow.innerHTML = columns.map((col) => {
      const style = this._widthStyle(col.key);
      const sortable = col.key !== 'icon';
      const sortIndicator = sortable && this.sortState.field === col.key ? (this.sortState.dir === 'asc' ? ' ▲' : ' ▼') : '';
      return `<th class="${col.numeric ? 'num' : ''} ${sortable ? 'sortable' : ''}" data-col="${col.key}"${style}>${esc(col.label)}${sortIndicator}<span class="col-resizer" data-col="${col.key}"></span></th>`;
    }).join('') + (this.rowActions ? '<th class="row-actions-th"></th>' : '');

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

    let resizeFrame = 0;
    const onMove = (moveEvent) => {
      const newWidth = Math.max(40, Math.round(startWidth + (moveEvent.clientX - startX)));
      this.columnConfig.widths[colKey] = newWidth;
      if (resizeFrame) return; // 再描画はフレーム単位に間引く
      resizeFrame = requestAnimationFrame(() => { resizeFrame = 0; this.render(); });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (resizeFrame) { cancelAnimationFrame(resizeFrame); resizeFrame = 0; }
      this.render();
      this.settingsStore.set(this._settingsKey('columns'), { widths: this.columnConfig.widths });
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

}
