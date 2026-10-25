/* ระบบหลังบ้าน */
const Admin = (() => {
  const S = () => Store.settings();
  const DAY = 864e5;

  // สีชุดหมวดหมู่ (ตรวจค่าความต่างสำหรับผู้มีภาวะตาบอดสีแล้ว) ใช้ตามลำดับเสมอ
  const SERIES = ['#eb6834', '#2a78d6', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
  const C_COUNT = '#eb6834';

  const staleDays = () => Math.max(1, +S().staleDays || 7);
  const isStale = t => UI.OPEN.includes(t.status) && (Date.now() - new Date(t.createdAt)) / DAY > staleDays();
  const finishAt = t => t.completion?.at || t.cannot?.at || null;
  const daysBetween = (a, b) => (new Date(b) - new Date(a)) / DAY;
  const firstAction = t => t.history[1]?.at || null;

  // ───────── Chart.js ─────────
  let charts = [];
  function chart(canvas, config) {
    if (!canvas) return null;
    if (!window.Chart) { canvas.parentElement.innerHTML = '<p class="small faint">โหลดไลบรารีกราฟไม่สำเร็จ (ต้องเชื่อมต่ออินเทอร์เน็ต)</p>'; return null; }
    const c = new Chart(canvas, config);
    charts.push(c);
    return c;
  }
  function destroyCharts() { charts.forEach(c => c.destroy()); charts = []; }
  function chartDefaults() {
    if (!window.Chart || Chart.__pcshs) return;
    Chart.__pcshs = true;
    Chart.defaults.font.family = '"IBM Plex Sans Thai", "Prompt", system-ui, sans-serif';
    Chart.defaults.font.size = 13;
    Chart.defaults.color = '#898781';
    Chart.defaults.plugins.legend.display = false;
    Chart.defaults.plugins.tooltip.backgroundColor = '#10133A';
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 10;
    Chart.defaults.plugins.tooltip.titleFont = { family: '"Prompt", sans-serif', weight: '500' };
    Chart.defaults.maintainAspectRatio = false;
  }
  const axis = (extra = {}) => ({ grid: { color: '#EFEDE8', drawTicks: false }, border: { display: false }, ticks: { padding: 8 }, ...extra });
  const hBar = (labels, data, color, fmt = v => UI.num(v)) => ({
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: color, borderRadius: 4, borderSkipped: 'start', barThickness: 14, maxBarThickness: 16 }] },
    options: {
      indexAxis: 'y', interaction: { mode: 'nearest', axis: 'y', intersect: false },
      scales: { x: axis({ beginAtZero: true, ticks: { padding: 8, precision: 0, callback: v => fmt(v) } }), y: axis({ grid: { display: false }, ticks: { color: '#52514e', padding: 6 } }) },
      plugins: { tooltip: { callbacks: { label: c => ' ' + fmt(c.raw) } } }
    }
  });
  function lineConfig(labels, series) {
    return {
      type: 'line',
      data: { labels, datasets: series.map(s => ({ label: s.label, data: s.data, borderColor: s.color, backgroundColor: s.color, borderWidth: 2, pointRadius: 4, pointHoverRadius: 6, pointBackgroundColor: '#fff', pointBorderWidth: 2, tension: .3, fill: false })) },
      options: {
        interaction: { mode: 'index', intersect: false },
        scales: { x: axis({ grid: { display: false } }), y: axis({ beginAtZero: true, ticks: { precision: 0, padding: 8 } }) },
        plugins: { tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${UI.num(c.raw)}` } } }
      }
    };
  }

  // นับตามคีย์ คืน [[label, count], ...] เรียงมากไปน้อย
  function countBy(list, keyFn) {
    const m = new Map();
    for (const t of list) for (const k of [].concat(keyFn(t)).filter(Boolean)) m.set(k, (m.get(k) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }
  const catKeys = t => {
    return [...new Set(t.items.map(i => i.catName))];
  };
  function rankList(rows, fmt = v => UI.num(v), max) {
    if (!rows.length) return '';
    const top = max ?? rows[0][1];
    return `<ol class="rank-list">${rows.map(([k, v, extra], i) => `
      <li><span class="rank-no">${i + 1}</span><div style="min-width:0"><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(k)}${extra ? ` ${extra}` : ''}</div><div class="rank-bar"><span style="width:${top ? v / top * 100 : 0}%"></span></div></div><strong class="num">${fmt(v)}</strong></li>`).join('')}</ol>`;
  }

  // ═══════════ ภาพรวม (แอดมิน) ═══════════
  function overview() {
    const me = Store.me();
    return {
      title: 'ภาพรวม', subtitle: `สวัสดี ${Store.fullName(me)} · ${UI.dateLong(new Date().toISOString())}`,
      html: `
        <div class="kpi-row" id="ovKpi"></div>
        <div class="chart-grid">
          <section class="card span-7"><div class="card-head"><h3>${icon('inbox')}งานรออนุมัติ</h3><a class="link small" href="#/admin/jobs?status=pending">จัดการทั้งหมด ${icon('arrow')}</a></div><div class="card-body" id="queue" style="padding-top:6px"></div></section>
          <section class="card span-5"><div class="card-head"><h3>${icon('activity')}ความเคลื่อนไหวล่าสุด</h3></div><div class="card-body" id="feed"></div></section>
          <section class="card chart-card span-8"><div class="card-head"><h3>${icon('chart')}แนวโน้ม 6 เดือนล่าสุด</h3><div class="legend"><span><i style="background:${SERIES[0]}"></i>แจ้งซ่อม</span><span><i style="background:${SERIES[1]}"></i>เสร็จสิ้น</span></div></div><div class="card-body"><div class="chart-box"><canvas id="trend"></canvas></div></div></section>
          <section class="card chart-card span-4"><div class="card-head"><h3>${icon('layers')}แยกตามหมวดหลัก</h3><span class="chart-sub">งานที่ยังไม่ปิด</span></div><div class="card-body" id="byForm"></div></section>
        </div>`,
      mount(root) {
        chartDefaults();
        const render = () => {
          destroyCharts();
          const all = Store.visibleTickets();
          const d0 = new Date(); d0.setHours(0, 0, 0, 0);
          const n = st => all.filter(t => t.status === st).length;
          const kpis = [
            ['งานใหม่วันนี้', 'inbox', all.filter(t => new Date(t.createdAt) >= d0).length, 'dark', ''],
            ['รออนุมัติ', 'clock', n('pending'), '', '?status=pending'],
            ['กำลังดำเนินการซ่อม', 'wrench', n('in_progress'), '', '?status=in_progress'],
            ['รอพิจารณา', 'hourglass', n('review'), '', '?status=review'],
          ];
          $('#ovKpi', root).innerHTML = kpis.map(([l, ic, v, cls, q]) => `<a class="kpi ${cls}" href="#/admin/jobs${q}"><div class="kpi-label">${l}${icon(ic)}</div><div class="kpi-value">${v}<small>รายการ</small></div></a>`).join('');
          const pending = all.filter(t => t.status === 'pending').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
          $('#queue', root).innerHTML = pending.length ? pending.slice(0, 8).map(t => `
            <a class="queue-item" href="#/admin/job/${t.id}">
              <span class="t-ic" style="width:44px;height:44px;font-size:20px">${icon(Views.ticketIcon(t))}</span>
              <div style="flex:1;min-width:0"><div class="row" style="gap:8px"><span class="t-id">${esc(t.id)}</span>${Views.formChip(t.formType)}${isStale(t) ? '<span class="badge tone-red">ค้างนาน</span>' : ''}</div>
                <div class="small muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(Views.itemsTitle(t))} · ${esc(UI.locationText(t))}</div></div>
              <span class="small faint nowrap">${UI.ago(t.createdAt)}</span>
            </a>`).join('') : `<div class="empty" style="padding:30px">${icon('checkCircle')}<strong>ไม่มีงานรออนุมัติ</strong></div>`;
          const feed = all.flatMap(t => t.history.map(h => ({ ...h, id: t.id }))).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 7);
          $('#feed', root).innerHTML = `<ol class="timeline">${feed.map(h => `<li><span class="tl-dot">${icon('check')}</span><div class="tl-title"><a href="#/admin/job/${h.id}">${esc(h.action)} · ${esc(h.id)}</a></div><div class="tl-meta">${esc(h.by)} · ${UI.ago(h.at)}</div></li>`).join('')}</ol>`;
          const months = [];
          for (let i = 5; i >= 0; i--) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); months.push([d.getFullYear(), d.getMonth()]); }
          const inM = (iso, [y, m]) => { if (!iso) return false; const d = new Date(iso); return d.getFullYear() === y && d.getMonth() === m; };
          chart($('#trend', root), lineConfig(months.map(([y, m]) => `${UI.TH_MONTHS_SHORT[m]} ${String(y + 543).slice(2)}`), [
            { label: 'แจ้งซ่อม', data: months.map(mm => all.filter(t => inM(t.createdAt, mm)).length), color: SERIES[0] },
            { label: 'เสร็จสิ้น', data: months.map(mm => all.filter(t => t.status === 'done' && inM(finishAt(t), mm)).length), color: SERIES[1] }
          ]));
          const open = all.filter(t => UI.OPEN.includes(t.status));
          $('#byForm', root).innerHTML = rankList(Store.FORM_KEYS.map(k => [Views.formName(k), open.filter(t => t.formType === k).length]), v => `${v} งาน`, Math.max(1, ...Store.FORM_KEYS.map(k => open.filter(t => t.formType === k).length)))
            + `<a class="btn btn-soft btn-sm" href="#/admin/stats" style="margin-top:18px">${icon('chart')} ดูสถิติทั้งหมด</a>`;
        };
        render();
        App.onCleanup(Store.subscribe(render));
        App.onCleanup(destroyCharts);
      }
    };
  }

  // ═══════════ เปลี่ยนสถานะ (ทีละรายการหรือหลายรายการ) ═══════════
  function openStatus(ids, status) {
    const s = S();
    const many = ids.length > 1;
    const sub = many ? `${ids.length} รายการที่เลือก` : `${ids[0]} · ${Views.itemsTitle(Store.ticket(ids[0]))}`;
    const run = async payload => {
      const r = await Store.setStatus(ids, status, payload);
      UI.toast(`อัปเดตเป็น "${UI.STATUS[status].label}" แล้ว ${r.ok} รายการ${r.skipped ? ` (ข้าม ${r.skipped} รายการที่ไม่มีสิทธิ์)` : ''}`);
      App.emit('selection-clear');
    };
    const quick = (list, target) => `<div class="row" style="gap:6px">${list.map(v => `<button type="button" class="chip" data-fill="${esc(v)}" data-target="${target}" style="border:0;cursor:pointer">${esc(v)}</button>`).join('')}</div>`;
    const bindQuick = api => api.body.addEventListener('click', e => { const c = e.target.closest('[data-fill]'); if (c) $('#' + c.dataset.target, api.body).value = c.dataset.fill; });
    const sigNote = () => {
      const me = Store.me();
      return me.signature ? `<div class="notice">${icon('sign')}<div>ลายเซ็นของคุณจะลงในช่อง <strong>ผู้ตรวจงาน</strong> ของใบแจ้งซ่อม</div></div>`
        : `<div class="notice orange">${icon('alert')}<div>คุณยังไม่มีลายเซ็น เอกสารจะแสดงเพียงชื่อ ตั้งค่าได้ที่ <a class="link" href="#/profile">โปรไฟล์</a></div></div>`;
    };
    if (status === 'in_progress') {
      return UI.modal({ title: 'กำลังดำเนินการซ่อม', subtitle: sub, size: 'sm',
        body: `<div class="notice">${icon('sign')}<div>ระบบจะลงลายเซ็นผู้อนุมัติตามตำแหน่งในใบแจ้งซ่อมให้อัตโนมัติ</div></div>
          <div class="field"><label for="note">หมายเหตุ (ถ้ามี)</label><input class="input" id="note" placeholder="เช่น ช่างเข้าซ่อมวันพรุ่งนี้"></div>`,
        actions: [{ label: 'ยกเลิก', kind: 'btn-ghost-dark' }, { label: 'ยืนยัน', kind: 'btn st-btn st-in_progress', icon: 'wrench', onClick: api => run({ note: $('#note', api.body).value.trim() }) }] });
    }
    if (status === 'review') {
      return UI.modal({ title: 'รอพิจารณา', subtitle: sub,
        body: `<div class="field"><label for="note">เหตุผล / สิ่งที่รอ</label><input class="input" id="note" placeholder="เช่น รอจัดซื้ออะไหล่"></div>${quick(s.reviewReasons, 'note')}`,
        onOpen: bindQuick,
        actions: [{ label: 'ยกเลิก', kind: 'btn-ghost-dark' }, { label: 'ยืนยัน', kind: 'btn st-btn st-review', icon: 'hourglass', onClick: api => run({ note: $('#note', api.body).value.trim() }) }] });
    }
    if (status === 'done') {
      let ph;
      return UI.modal({ title: 'ซ่อมเสร็จสิ้น', subtitle: sub, size: 'lg',
        body: `
          <div class="grid-2">
            <div class="field"><label for="worker">ผู้ปฏิบัติงาน / ช่าง <span class="faint">(ไม่บังคับ)</span></label><input class="input" id="worker" list="wl" placeholder="พิมพ์หรือเลือกชื่อ"><datalist id="wl">${s.workers.map(w => `<option value="${esc(w)}">`).join('')}</datalist></div>
            <div class="field"><label>วันที่เสร็จ</label><input class="input" value="${UI.dateLong(new Date().toISOString())}" readonly></div>
          </div>
          <div class="field"><label for="note">อธิบายเพิ่มเติม <span class="faint">(ไม่บังคับ)</span></label><textarea class="textarea" id="note" placeholder="เช่น เปลี่ยนหลอด LED 2 หลอด ทดสอบใช้งานได้ปกติ"></textarea></div>
          <div class="field"><span class="label">${icon('camera')}แนบรูปเพิ่มเติม <span class="faint">(ไม่บังคับ)</span></span><div id="ph"></div></div>
          ${sigNote()}`,
        onOpen: api => { ph = UI.photoInput($('#ph', api.body), { max: 6, hint: 'แนบรูปหลังซ่อม' }); },
        actions: [{ label: 'ยกเลิก', kind: 'btn-ghost-dark' }, { label: many ? `ยืนยันเสร็จสิ้น ${ids.length} รายการ` : 'ยืนยันเสร็จสิ้น', kind: 'btn st-btn st-done', icon: 'checkCircle',
          onClick: api => run({ worker: $('#worker', api.body).value.trim(), note: $('#note', api.body).value.trim(), photos: ph.get() }) }] });
    }
    if (status === 'cannot_fix') {
      let ph;
      return UI.modal({ title: 'ไม่สามารถซ่อมได้', subtitle: sub,
        body: `<div class="field"><label for="reason">เนื่องจาก <span class="req">*</span></label><select class="select" id="reason"><option value="">เลือกเหตุผล</option>${s.cannotReasons.map(r => `<option>${esc(r)}</option>`).join('')}<option value="__other">อื่น ๆ (ระบุ)</option></select></div>
          <div class="field"><label for="note">รายละเอียดเพิ่มเติม</label><textarea class="textarea" id="note" placeholder="เช่น มอเตอร์ไหม้ ต้องเปลี่ยนทั้งชุด เสนอจัดซื้อใหม่"></textarea></div>
          <div class="field"><span class="label">${icon('camera')}รูปประกอบ <span class="faint">(ไม่บังคับ)</span></span><div id="ph"></div></div>${sigNote()}`,
        onOpen: api => { ph = UI.photoInput($('#ph', api.body), { max: 4 }); },
        actions: [{ label: 'ยกเลิก', kind: 'btn-ghost-dark' }, { label: 'บันทึก', kind: 'btn st-btn st-cannot_fix', icon: 'x', onClick: api => {
          let reason = $('#reason', api.body).value;
          const note = $('#note', api.body).value.trim();
          if (reason === '__other') { if (!note) throw new Error('กรุณาระบุรายละเอียด'); reason = note; }
          if (!reason) { $('#reason', api.body).closest('.field').classList.add('invalid'); throw new Error('กรุณาเลือกเหตุผล'); }
          return run({ reason, note: reason === note ? '' : note, photos: ph.get() });
        } }] });
    }
  }

  // ปุ่มสถานะตามสิทธิ์ของผู้ใช้
  function statusButtons(me, tickets, { block = false, size = '' } = {}) {
    return Store.ACTIONS.filter(a => Store.actionsOf(me).includes(a) && tickets.some(t => Store.can(me, a, t)))
      .map(a => `<button class="btn st-btn st-${a} ${size} ${block ? 'btn-block' : ''}" data-set="${a}">${icon(UI.STATUS[a].icon)} ${UI.STATUS[a].label}</button>`).join('');
  }

  // ═══════════ พิมพ์รวม (ไฟล์เดียว) ═══════════
  function openPrint(tickets, { scopeLabel = '' } = {}) {
    if (!tickets.length) return UI.toast('ไม่มีรายการให้พิมพ์', 'error');
    UI.modal({ title: 'พิมพ์รวมเป็นไฟล์เดียว', subtitle: `${tickets.length} รายการ${scopeLabel ? ` · ${scopeLabel}` : ''}`, size: 'lg',
      body: `
        <div class="field"><span class="label">รูปแบบเอกสาร</span>
          <div class="print-opts">
            <label class="print-opt"><input type="radio" name="style" value="memo" checked><span><span class="po-ic">${icon('file')}</span><strong>บันทึกข้อความ</strong><small>มีตราครุฑ ตามแบบฟอร์มราชการ รายการละ 1 หน้า</small></span></label>
            <label class="print-opt"><input type="radio" name="style" value="plain"><span><span class="po-ic">${icon('printer')}</span><strong>ใบแจ้งซ่อม</strong><small>ไม่มีตราครุฑ หัวกระดาษตราโรงเรียน รายการละ 1 หน้า</small></span></label>
            <label class="print-opt"><input type="radio" name="style" value="table"><span><span class="po-ic">${icon('list')}</span><strong>ตารางสรุป</strong><small>หลายรายการต่อหน้า เหมาะสำหรับรายงาน</small></span></label>
          </div></div>
        <label class="checkbox"><input type="checkbox" id="group" checked> แยกเป็นส่วนตามหมวด (ทั่วไป / หอพัก / เครื่องปรับอากาศ) พร้อมหน้าคั่น</label>
        <label class="checkbox"><input type="checkbox" id="cover" checked> มีหน้าปกสรุปจำนวนตามสถานะ</label>
        <label class="checkbox"><input type="checkbox" id="photos" checked> แนบหน้ารูปภาพต่อท้ายใบแจ้งซ่อมแต่ละใบ (ถ้ามีรูป)</label>
        <div class="field"><label for="ptitle">หัวข้อเอกสาร</label><input class="input" id="ptitle" value="รายงานการแจ้งซ่อมอาคารและสถานที่"></div>`,
      actions: [{ label: 'ยกเลิก', kind: 'btn-ghost-dark' }, { label: 'เปิดหน้าพิมพ์', kind: 'btn-primary', icon: 'printer', onClick: api => {
        const job = { ids: tickets.map(t => t.id), style: $('input[name=style]:checked', api.body).value, group: $('#group', api.body).checked,
          cover: $('#cover', api.body).checked, photos: $('#photos', api.body).checked, title: $('#ptitle', api.body).value.trim() || 'รายงานการแจ้งซ่อมอาคารและสถานที่', scope: scopeLabel };
        try { sessionStorage.setItem('pcshs-print', JSON.stringify(job)); } catch (e) { throw new Error('เปิดหน้าพิมพ์ไม่สำเร็จ'); }
        App.go('/print');
      } }] });
  }

  // ═══════════ รายการงานแจ้งซ่อม ═══════════
  function jobs(params) {
    const me = Store.me();
    const myForms = Store.formsOf(me);
    const state = { form: myForms.includes(params.form) ? params.form : '', status: params.status || '', q: '', cat: '', loc: '', from: '', to: '', sort: 'new', page: 1, stale: false };
    const selected = new Set();
    const PER = 20;
    return {
      title: 'งานแจ้งซ่อม', subtitle: 'เลือกหลายรายการเพื่ออัปเดตสถานะหรือพิมพ์รวมได้ในครั้งเดียว',
      actions: `<button class="btn btn-outline btn-sm" id="printAll">${icon('printer')} พิมพ์รวม PDF</button><button class="btn btn-outline btn-sm" id="exportCsv">${icon('download')} ส่งออก CSV</button>`,
      html: `
        <div class="card" style="padding:16px" id="ftabs"></div>
        <div class="card">
          <div class="filters" style="border-bottom:1px solid var(--line-2)"><div class="seg seg-line" id="stTabs"></div></div>
          <div class="filters" id="filters">
            <div class="input-icon">${icon('search')}<input class="input sm" id="q" placeholder="ค้นหาเลขที่ ผู้แจ้ง รายการ สถานที่" style="padding-left:40px"></div>
            <button type="button" class="btn btn-outline btn-sm filter-toggle" id="fToggle" aria-expanded="false" aria-controls="fMore">${icon('filter')} ตัวกรอง<b id="fCount" hidden></b></button>
            <div class="filters-more" id="fMore">
              <select class="select sm" id="cat" aria-label="หมวดงาน"><option value="">ทุกหมวดงาน</option>${Store.allCategories().filter(c => c.forms.some(f => myForms.includes(f))).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
              <select class="select sm" id="loc" aria-label="สถานที่"><option value="">ทุกสถานที่</option>${Store.allLocations().map(l => `<option>${esc(l.name)}</option>`).join('')}</select>
              <span class="filter-label">วันที่แจ้ง</span><input type="date" class="input sm" id="from" aria-label="ตั้งแต่"><span class="faint fm-dash">–</span><input type="date" class="input sm" id="to" aria-label="ถึง">
              <select class="select sm" id="sort" aria-label="เรียงลำดับ"><option value="new">ใหม่ล่าสุด</option><option value="old">เก่าสุด</option></select>
              <label class="checkbox small"><input type="checkbox" id="stale"> ค้างเกิน ${staleDays()} วัน</label>
              <button type="button" class="link small fm-reset" id="fReset">ล้างตัวกรอง</button>
            </div>
          </div>
          <div id="bulk" class="bulk-slot"></div>
          <label class="sel-all-m"><input type="checkbox" id="selAllM"> เลือกทั้งหมดในหน้านี้ <span class="faint" id="selAllMn"></span></label>
          <div class="table-wrap"><table class="table jobs-table">
            <thead><tr><th class="cb-cell"><input type="checkbox" class="sel-all" id="selAll" aria-label="เลือกทั้งหมดในหน้านี้"></th><th>เลขที่ / วันที่แจ้ง</th><th>รายการ</th><th>สถานที่</th><th>ผู้แจ้ง</th><th>สถานะ</th><th class="r"></th></tr></thead>
            <tbody id="rows"></tbody>
          </table></div>
          <div class="pager" id="pager"></div>
        </div>`,
      mount(root) {
        const filtered = () => {
          const q = state.q.toLowerCase();
          const from = state.from ? new Date(state.from) : null, to = state.to ? new Date(new Date(state.to).getTime() + DAY) : null;
          return Store.visibleTickets(me).filter(t => {
            if (state.form && t.formType !== state.form) return false;
            if (state.status && t.status !== state.status) return false;
            if (state.stale && !isStale(t)) return false;
            if (state.cat && !t.items.some(i => i.catId === state.cat)) return false;
            if (state.loc && t.location.locationName !== state.loc) return false;
            const d = new Date(t.createdAt);
            if (from && d < from) return false;
            if (to && d >= to) return false;
            if (q && ![t.id, t.reporter.name, Views.itemsTitle(t), UI.locationText(t), UI.detailsText(t)].join(' ').toLowerCase().includes(q)) return false;
            return true;
          }).sort((a, b) => state.sort === 'old' ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt));
        };
        const renderBulk = () => {
          const sel = [...selected].map(id => Store.ticket(id)).filter(Boolean);
          // แถบจัดการอยู่ด้านบนตารางเสมอ ปุ่มกดได้เมื่อเลือกรายการแล้ว
          const btns = Store.ACTIONS.filter(a => Store.actionsOf(me).includes(a)).map(a => {
            const ok = sel.some(t => Store.can(me, a, t));
            return `<button class="btn st-btn st-${a} btn-sm" data-set="${a}" ${ok ? '' : 'disabled'}>${icon(UI.STATUS[a].icon)} ${UI.STATUS[a].label}</button>`;
          }).join('');
          $('#bulk', root).innerHTML = `
            <div class="bulk-bar ${sel.length ? 'is-active' : ''}" role="region" aria-label="จัดการรายการที่เลือก">
              <span class="count" title="ติ๊กเลือกรายการในตาราง แล้วกดปุ่มสถานะ"><b>${sel.length}</b>เลือกแล้ว</span>
              ${btns}
              <span class="spacer"></span>
              <button class="btn btn-outline btn-sm" data-bulk="print" ${sel.length ? '' : 'disabled'}>${icon('printer')} พิมพ์รวม</button>
              <button class="btn btn-outline btn-sm" data-bulk="clear" ${sel.length ? '' : 'disabled'}>${icon('close')} ล้างการเลือก</button>
            </div>`;
        };
        const render = () => {
          const base = Store.visibleTickets(me);
          const counts = { all: base.length, ...Object.fromEntries(myForms.map(k => [k, base.filter(t => t.formType === k).length])) };
          $('#ftabs', root).innerHTML = Pages.formTabs(state.form, counts, myForms);
          const inForm = base.filter(t => !state.form || t.formType === state.form);
          $('#stTabs', root).innerHTML = [['', 'ทั้งหมด', inForm.length], ...UI.STATUS_KEYS.map(k => [k, UI.STATUS[k].label, inForm.filter(t => t.status === k).length])]
            .map(([k, l, n]) => `<button type="button" data-st="${k}" class="${state.status === k ? 'is-active' : ''}">${k ? `<i class="dot" style="color:${UI.STATUS[k].color}"></i>` : ''}<span class="st-long">${l}</span><span class="st-short">${k ? UI.STATUS[k].short : l}</span> <span class="faint">${n}</span></button>`).join('');
          const nf = ['cat', 'loc', 'from', 'to'].filter(k => state[k]).length + (state.stale ? 1 : 0);
          $('#fCount', root).hidden = !nf; $('#fCount', root).textContent = nf;
          const list = filtered();
          for (const id of [...selected]) if (!Store.ticket(id) || !Store.canSee(me, Store.ticket(id))) selected.delete(id);
          const pages = Math.max(1, Math.ceil(list.length / PER));
          state.page = Math.min(state.page, pages);
          const slice = list.slice((state.page - 1) * PER, state.page * PER);
          $('#rows', root).innerHTML = slice.length ? slice.map(t => {
            const acts = Store.ACTIONS.filter(a => Store.can(me, a, t));
            return `
            <tr class="clickable ${selected.has(t.id) ? 'is-selected' : ''}" data-href="/admin/job/${t.id}">
              <td class="cb-cell"><input type="checkbox" data-sel="${t.id}" ${selected.has(t.id) ? 'checked' : ''} aria-label="เลือก ${esc(t.id)}"></td>
              <td><div class="id-cell">${esc(t.id)}</div><div class="sub">${UI.dateTime(t.createdAt)}</div>${t.batchIds?.length > 1 ? `<button type="button" class="batch-pill ${t.batchIds.every(id => selected.has(id)) ? 'is-on' : ''}" data-batch="${t.id}" title="แจ้งพร้อมกัน ${t.batchIds.length} สถานที่">${icon('layers')} ชุด ${t.batchIds.length} ใบ · เลือกทั้งชุด</button>` : ''}</td>
              <td style="max-width:240px"><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(Views.itemsTitle(t))}</div><div class="sub">${Views.formChip(t.formType)}</div></td>
              <td style="max-width:180px"><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(UI.locationText(t))}</div></td>
              <td><div class="nowrap">${esc(t.reporter.name)}</div><div class="sub nowrap">${esc(t.reporter.phone || '')}</div></td>
              <td>${UI.statusBadge(t.status)}${isStale(t) ? `<div class="sub" style="color:#B91C1C">ค้าง ${Math.floor(daysBetween(t.createdAt, new Date()))} วัน</div>` : ''}</td>
              <td class="r nowrap">
                <div class="dropdown row-menu" data-open="false" style="position:relative;display:inline-block">
                  <button class="icon-btn sm" data-dd aria-label="จัดการ ${esc(t.id)}" aria-expanded="false">${icon('more')}</button>
                  <div class="dropdown-panel right">
                    ${acts.map(a => `<button class="dd-item" data-one="${a}" data-id="${t.id}"><span class="di-icon">${icon(UI.STATUS[a].icon)}</span><span><strong>${UI.STATUS[a].label}</strong></span></button>`).join('')}
                    ${acts.length ? '<div class="dd-sep"></div>' : ''}
                    <a href="#/doc/${t.id}"><span class="di-icon">${icon('file')}</span><span><strong>พิมพ์ (มีตราครุฑ)</strong></span></a>
                    <a href="#/doc/${t.id}?style=plain"><span class="di-icon">${icon('printer')}</span><span><strong>พิมพ์ (ไม่มีตราครุฑ)</strong></span></a>
                  </div>
                </div>
              </td>
            </tr>`;
          }).join('') : `<tr><td colspan="7"><div class="empty">${icon('search')}<strong>ไม่พบรายการ</strong><span>ลองปรับตัวกรองหรือคำค้น</span></div></td></tr>`;
          $('#selAll', root).checked = $('#selAllM', root).checked = slice.length > 0 && slice.every(t => selected.has(t.id));
          $('#selAllMn', root).textContent = slice.length ? `(${slice.length} รายการ)` : '';
          $('#pager', root).innerHTML = `<span>แสดง ${list.length ? (state.page - 1) * PER + 1 : 0}–${Math.min(state.page * PER, list.length)} จาก ${list.length} รายการ
              ${list.length > slice.length ? ` · <button class="link" data-selall-filtered>เลือกทั้ง ${list.length} รายการตามตัวกรอง</button>` : ''}</span>
            <span class="row"><button class="btn btn-outline btn-sm" data-pg="-1" ${state.page <= 1 ? 'disabled' : ''}>ก่อนหน้า</button><span>${state.page} / ${pages}</span><button class="btn btn-outline btn-sm" data-pg="1" ${state.page >= pages ? 'disabled' : ''}>ถัดไป</button></span>`;
          renderBulk();
        };
        render();
        root.addEventListener('input', e => {
          if (e.target.id === 'stale') { state.stale = e.target.checked; state.page = 1; render(); return; }
          if (e.target.id in state) { state[e.target.id] = e.target.value; state.page = 1; render(); }
          // ระบบจริง: ค้นวันที่เก่ากว่าข้อมูลที่โหลดไว้ → โหลดเพิ่ม
          if (e.target.id === 'from' && state.from) Store.ensureRange(state.from).then(c => { if (c && root.isConnected) render(); }).catch(err => UI.toast(err.message, 'error'));
        });
        root.addEventListener('change', e => {
          if (e.target.dataset.sel) { e.target.checked ? selected.add(e.target.dataset.sel) : selected.delete(e.target.dataset.sel); e.target.closest('tr').classList.toggle('is-selected', e.target.checked); renderBulk(); }
          if (e.target.id === 'selAll' || e.target.id === 'selAllM') {
            const ids = $$('[data-sel]', root).map(x => x.dataset.sel);
            ids.forEach(id => e.target.checked ? selected.add(id) : selected.delete(id));
            render();
          }
        });
        root.addEventListener('click', e => {
          if (e.target.closest('.cb-cell, .row-menu')) {
            const one = e.target.closest('[data-one]');
            if (one) openStatus([one.dataset.id], one.dataset.one);
            return;
          }
          if (e.target.closest('#fToggle')) {
            const open = $('#filters', root).classList.toggle('is-open');
            $('#fToggle', root).setAttribute('aria-expanded', open); return;
          }
          if (e.target.closest('#fReset')) {
            Object.assign(state, { cat: '', loc: '', from: '', to: '', sort: 'new', stale: false, page: 1 });
            ['cat', 'loc', 'from', 'to'].forEach(k => { $('#' + k, root).value = ''; });
            $('#sort', root).value = 'new'; $('#stale', root).checked = false;
            render(); return;
          }
          const f = e.target.closest('[data-form]'); if (f) { state.form = f.dataset.form; state.status = ''; state.page = 1; selected.clear(); render(); return; }
          const st = e.target.closest('[data-st]'); if (st) { state.status = st.dataset.st; state.page = 1; render(); return; }
          const pg = e.target.closest('[data-pg]'); if (pg) { state.page += +pg.dataset.pg; render(); return; }
          const bt = e.target.closest('[data-batch]');
          if (bt) {
            const ids = Store.ticket(bt.dataset.batch).batchIds.filter(id => Store.ticket(id) && Store.canSee(me, Store.ticket(id)));
            const allOn = ids.every(id => selected.has(id));
            ids.forEach(id => allOn ? selected.delete(id) : selected.add(id));
            render();
            if (!allOn) UI.toast(`เลือกทั้งชุด ${ids.length} ใบแล้ว · กดอนุมัติหรือพิมพ์รวมได้จากแถบด้านบน`);
            return;
          }
          if (e.target.closest('[data-selall-filtered]')) { filtered().forEach(t => selected.add(t.id)); render(); return; }
          const set = e.target.closest('[data-set]'); if (set) { openStatus([...selected], set.dataset.set); return; }
          const b = e.target.closest('[data-bulk]');
          if (b) { if (b.dataset.bulk === 'clear') { selected.clear(); render(); } else openPrint([...selected].map(id => Store.ticket(id)), { scopeLabel: 'รายการที่เลือก' }); return; }
          const tr = e.target.closest('tr[data-href]'); if (tr) App.go(tr.dataset.href);
        });
        const formLabel = () => state.form ? Views.formName(state.form) : 'ทุกหมวด';
        $('#printAll').addEventListener('click', () => openPrint(filtered(), { scopeLabel: `${formLabel()}${state.status ? ' · ' + UI.STATUS[state.status].label : ''}` }));
        $('#exportCsv').addEventListener('click', () => exportCsv(filtered(), `รายการแจ้งซ่อม-${formLabel()}`));
        App.onCleanup(App.on('selection-clear', () => { selected.clear(); render(); }));
        App.onCleanup(Store.subscribe(render));
      }
    };
  }

  function exportCsv(list, name) {
    const rows = [['เลขที่', 'เลขที่เอกสาร', 'วันที่แจ้ง', 'หมวดหลัก', 'หมวดงาน', 'รายการ', 'อาการ', 'สถานที่', 'ผู้แจ้ง', 'ฝ่าย/กลุ่มสาระ', 'เบอร์', 'สถานะ', 'ผู้ปฏิบัติงาน', 'วันที่ปิดงาน', 'จำนวนวัน', 'หมายเหตุ']];
    for (const t of list) {
      const fin = finishAt(t);
      rows.push([t.id, t.docNo, UI.dateTime(t.createdAt), Views.formName(t.formType), catKeys(t).join(' / '), UI.itemsText(t), UI.detailsText(t), UI.locationText(t), t.reporter.name, t.reporter.dept, t.reporter.phone,
        UI.STATUS[t.status].label, t.completion?.worker || '', fin ? UI.dateTime(fin) : '', fin ? daysBetween(t.createdAt, fin).toFixed(1) : '',
        t.cannot?.reason || t.review?.note || t.completion?.note || '']);
    }
    UI.download(`${name}-${new Date().toISOString().slice(0, 10)}.csv`, UI.csv(rows));
    UI.toast(`ส่งออก ${list.length} รายการแล้ว`);
  }

  // ═══════════ รายละเอียดงาน ═══════════
  function job(params) {
    return {
      title: params.id, subtitle: 'รายละเอียดและการอัปเดตสถานะ',
      actions: `<a class="btn btn-outline btn-sm" href="#/admin/jobs">${icon('back')} กลับ</a>`,
      html: `<div id="detail"></div>`,
      mount(root) {
        const render = () => {
          const t = Store.ticket(params.id);
          const me = Store.me();
          if (!t || !Store.canSee(me, t)) { $('#detail', root).innerHTML = `<div class="card empty">${icon('alert')}<strong>${t ? 'คุณไม่มีสิทธิ์ดูรายการในหมวดนี้' : 'ไม่พบใบแจ้งซ่อม'}</strong></div>`; return; }
          const btns = statusButtons(me, [t], { block: true });
          $('#detail', root).innerHTML = `
            <div class="detail-layout">
              <div class="stack" style="gap:20px">
                ${Views.headCard(t)}
                ${Views.infoCard(t)}
                ${Views.resultCard(t)}
                ${Views.historyCard(t)}
              </div>
              <aside class="stack action-panel" style="gap:20px;top:96px">
                <section class="card">
                  <div class="card-head"><h3>${icon('sliders')}อัปเดตสถานะ</h3></div>
                  <div class="card-body stack">
                    <div class="notice ${isStale(t) ? 'orange' : ''}">${icon(isStale(t) ? 'alert' : UI.STATUS[t.status].icon)}<div>สถานะปัจจุบัน: <strong>${UI.STATUS[t.status].label}</strong>${isStale(t) ? `<br>ค้างมา ${Math.floor(daysBetween(t.createdAt, new Date()))} วัน` : ''}</div></div>
                    <div class="action-list">${btns || '<p class="small faint">คุณไม่มีสิทธิ์เปลี่ยนสถานะของรายการนี้</p>'}</div>
                  </div>
                </section>
                <section class="card">
                  <div class="card-head"><h3>${icon('printer')}พิมพ์เอกสาร</h3></div>
                  <div class="card-body stack">
                    <a class="btn btn-primary btn-block" href="#/doc/${t.id}">${icon('file')} บันทึกข้อความ (มีตราครุฑ)</a>
                    <a class="btn btn-outline btn-block" href="#/doc/${t.id}?style=plain">${icon('printer')} ใบแจ้งซ่อม (ไม่มีตราครุฑ)</a>
                  </div>
                </section>
                <section class="card">
                  <div class="card-head"><h3>${icon('user')}ผู้แจ้งซ่อม</h3></div>
                  <div class="card-body stack small">
                    <div class="row" style="gap:12px">${UI.avatar(t.reporter.name)}<div><strong>${esc(t.reporter.name)}</strong><div class="faint">${esc(t.reporter.dept || '')}</div></div></div>
                    <a class="row" style="gap:10px" href="tel:${esc(t.reporter.phone)}">${icon('phone')}${esc(t.reporter.phone || '-')}</a>
                    <a class="row" style="gap:10px" href="mailto:${esc(t.reporter.email)}">${icon('mail')}${esc(t.reporter.email)}</a>
                  </div>
                </section>
              </aside>
            </div>`;
        };
        render();
        Views.bindZoom(root);
        root.addEventListener('click', e => { const b = e.target.closest('[data-set]'); if (b) openStatus([params.id], b.dataset.set); });
        App.onCleanup(Store.subscribe(render));
      }
    };
  }

  // ═══════════ สถิติและรายงาน ═══════════
  function computeStats(list, from, to) {
    const done = list.filter(t => t.status === 'done');
    const avgFix = done.length ? done.reduce((a, t) => a + daysBetween(t.createdAt, t.completion.at), 0) / done.length : 0;
    const responded = list.filter(firstAction);
    const avgResp = responded.length ? responded.reduce((a, t) => a + daysBetween(t.createdAt, firstAction(t)) * 24, 0) / responded.length : 0;
    const byStatus = Object.fromEntries(UI.STATUS_KEYS.map(k => [k, list.filter(t => t.status === k).length]));
    const spanDays = (to - from) / DAY;
    const buckets = [];
    if (spanDays <= 45) {
      for (let d = new Date(from.getFullYear(), from.getMonth(), from.getDate()); d < to; d = new Date(d.getTime() + DAY)) buckets.push({ label: `${d.getDate()} ${UI.TH_MONTHS_SHORT[d.getMonth()]}`, s: d, e: new Date(d.getTime() + DAY) });
    } else {
      for (let d = new Date(from.getFullYear(), from.getMonth(), 1); d < to; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) buckets.push({ label: `${UI.TH_MONTHS_SHORT[d.getMonth()]} ${String(d.getFullYear() + 543).slice(2)}`, s: d, e: new Date(d.getFullYear(), d.getMonth() + 1, 1) });
    }
    const inB = (iso, b) => iso && new Date(iso) >= b.s && new Date(iso) < b.e;
    return {
      total: list.length, byStatus, avgFix, avgResp, stale: list.filter(isStale).length,
      successPct: list.length ? Math.round(byStatus.done / list.length * 100) : 0,
      daily: spanDays <= 45, buckets: buckets.map(b => ({ label: b.label, created: list.filter(t => inB(t.createdAt, b)).length, done: list.filter(t => t.status === 'done' && inB(finishAt(t), b)).length })),
      forms: Store.FORM_KEYS.map((k, i) => ({ key: k, name: Views.formName(k), n: list.filter(t => t.formType === k).length, color: SERIES[i] })),
      cats: countBy(list, catKeys), items: countBy(list, t => t.items.map(i => i.name)).slice(0, 10),
      locs: countBy(list, t => `${t.location.locationName}${t.location.room ? ' · ' + t.location.room : ''}`).slice(0, 10),
      depts: countBy(list, t => t.reporter.dept).slice(0, 8),
      cannot: countBy(list.filter(t => t.cannot), t => t.cannot.reason),
      workers: countBy(done, t => t.completion.worker || 'ไม่ระบุ'),
      formTime: Store.FORM_KEYS.map(k => {
        const ts = list.filter(t => t.formType === k), d = ts.filter(t => t.status === 'done');
        return { name: Views.formName(k), n: ts.length, done: d.length, open: ts.filter(t => UI.OPEN.includes(t.status)).length,
          avg: d.length ? d.reduce((a, t) => a + daysBetween(t.createdAt, t.completion.at), 0) / d.length : null };
      })
    };
  }

  function statsRange(state) {
    const now = new Date();
    let from, to = null;
    if (state.range === 'custom') { from = state.from ? new Date(state.from) : null; to = state.to ? new Date(new Date(state.to).getTime() + DAY) : null; }
    else from = Pages.rangeStart(state.range);
    const list = Store.tickets().filter(t => {
      if (t.status === 'cancelled') return false;
      const d = new Date(t.createdAt);
      if (from && d < from) return false;
      if (to && d >= to) return false;
      if (state.form && t.formType !== state.form) return false;
      if (state.cat && !catKeys(t).includes(state.cat)) return false;
      if (state.loc && t.location.locationName !== state.loc) return false;
      if (state.dept && t.reporter.dept !== state.dept) return false;
      return true;
    });
    return { list, from: from || (list.length ? new Date(Math.min(...list.map(t => +new Date(t.createdAt)))) : now), to: to || now };
  }

  function stats(params) {
    const state = { range: params.range || '365d', from: '', to: '', form: params.form || '', cat: '', loc: '', dept: '' };
    const s = S();
    const ranges = ['month', '30d', '90d', 'sem', 'fy', '365d', 'all', 'custom'];
    const sel = (id, label, opts) => `<select class="select sm" id="${id}" aria-label="${label}"><option value="">${label}</option>${opts}</select>`;
    return {
      title: 'สถิติและรายงาน', subtitle: 'วิเคราะห์งานซ่อมแยกตามหมวดหลัก และพิมพ์รายงานเป็น PDF',
      actions: `<button class="btn btn-outline btn-sm" id="statCsv">${icon('download')} ส่งออก CSV</button><button class="btn btn-primary btn-sm" id="statPdf">${icon('printer')} พิมพ์รายงาน PDF</button>`,
      html: `
        <div class="card" style="padding:16px" id="ftabs"></div>
        <div class="card filters">
          ${icon('filter')}
          <select class="select sm" id="range" aria-label="ช่วงเวลา">${ranges.map(k => `<option value="${k}" ${k === state.range ? 'selected' : ''}>${Pages.RANGE_LABEL[k]}</option>`).join('')}</select>
          <span id="customR" class="row" hidden><input type="date" class="input sm" id="from" aria-label="ตั้งแต่"><span class="faint">–</span><input type="date" class="input sm" id="to" aria-label="ถึง"></span>
          ${sel('cat', 'ทุกหมวดงาน', Store.allCategories().map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join(''))}
          ${sel('loc', 'ทุกสถานที่', Store.allLocations().map(l => `<option>${esc(l.name)}</option>`).join(''))}
          ${sel('dept', 'ทุกฝ่าย/กลุ่มสาระ', s.departments.map(d => `<option>${esc(d)}</option>`).join(''))}
          <button class="btn btn-ghost-dark btn-sm" id="reset">ล้างตัวกรอง</button>
          <span class="spacer"></span><span class="small faint" id="rangeLabel"></span>
        </div>
        <div class="kpi-row" id="k1"></div>
        <div class="chart-grid" id="charts"></div>`,
      mount(root) {
        chartDefaults();
        const render = () => {
          destroyCharts();
          // ระบบจริง: โหลดใบแจ้งซ่อมย้อนหลังตามช่วงที่เลือก (ถ้ายังไม่ได้โหลด) แล้ววาดใหม่
          const want = state.range === 'custom' ? (state.from || '2000-01-01') : (Pages.rangeStart(state.range) || '2000-01-01');
          Store.ensureRange(want).then(changed => { if (changed && root.isConnected) render(); }).catch(e => UI.toast(e.message, 'error'));
          const base = statsRange({ ...state, form: '' });
          const counts = { all: base.list.length, ...Object.fromEntries(Store.FORM_KEYS.map(k => [k, base.list.filter(t => t.formType === k).length])) };
          $('#ftabs', root).innerHTML = Pages.formTabs(state.form, counts);
          const { list, from, to } = statsRange(state);
          const st = computeStats(list, from, to);
          $('#rangeLabel', root).textContent = `${UI.date(from.toISOString())} – ${UI.date(new Date(to - 1).toISOString())} · ${list.length} รายการ`;
          const kpi = (l, ic, v, unit, foot, cls = '') => `<div class="kpi ${cls}"><div class="kpi-label">${l}${icon(ic)}</div><div class="kpi-value">${v}<small>${unit}</small></div><div class="kpi-foot">${foot}</div></div>`;
          $('#k1', root).innerHTML = [
            kpi('แจ้งซ่อมทั้งหมด', 'inbox', UI.num(st.total), 'รายการ', `รออนุมัติ ${st.byStatus.pending} · ค้างเกิน ${staleDays()} วัน ${st.stale}`, 'dark'),
            kpi('เสร็จสิ้น', 'checkCircle', UI.num(st.byStatus.done), 'รายการ', `อัตราสำเร็จ ${st.successPct}% · ซ่อมไม่ได้ ${st.byStatus.cannot_fix}`),
            kpi('กำลังดำเนินการ / รอพิจารณา', 'wrench', UI.num(st.byStatus.in_progress + st.byStatus.review), 'รายการ', `กำลังซ่อม ${st.byStatus.in_progress} · รอพิจารณา ${st.byStatus.review}`),
            kpi('เวลาเฉลี่ย แจ้ง → เสร็จสิ้น', 'clock', st.avgFix.toFixed(1), 'วัน', `ตอบรับครั้งแรกเฉลี่ย ${st.avgResp.toFixed(1)} ชม.`)
          ].join('');
          const totalForms = st.forms.reduce((a, f) => a + f.n, 0);
          const statusRows = UI.STATUS_KEYS.map(k => [UI.STATUS[k].label, st.byStatus[k]]);
          $('#charts', root).innerHTML = `
            <section class="card chart-card span-8"><div class="card-head"><h3>${icon('chart')}แนวโน้มการแจ้งซ่อม <span class="chart-sub">${st.daily ? 'รายวัน' : 'รายเดือน'}</span></h3><div class="legend"><span><i style="background:${SERIES[0]}"></i>แจ้งซ่อม</span><span><i style="background:${SERIES[1]}"></i>เสร็จสิ้น</span></div></div><div class="card-body"><div class="chart-box tall"><canvas id="cTrend"></canvas></div></div></section>
            <section class="card span-4"><div class="card-head"><h3>${icon('activity')}สถานะงาน</h3></div><div class="card-body stack">
              <div class="share-bar" role="img" aria-label="สัดส่วนสถานะ">${UI.STATUS_KEYS.filter(k => st.byStatus[k]).map(k => `<span style="width:${st.byStatus[k] / Math.max(1, st.total) * 100}%;background:${UI.STATUS[k].color}" title="${UI.STATUS[k].label} ${st.byStatus[k]}"></span>`).join('')}</div>
              <ul class="rank-list">${UI.STATUS_KEYS.map(k => `<li style="grid-template-columns:14px minmax(0,1fr) auto"><i style="width:12px;height:12px;border-radius:3px;background:${UI.STATUS[k].color}"></i><span>${UI.STATUS[k].label}</span><strong class="num">${st.byStatus[k]} <span class="small faint">(${st.total ? Math.round(st.byStatus[k] / st.total * 100) : 0}%)</span></strong></li>`).join('')}</ul>
            </div></section>
            ${state.form ? '' : `<section class="card span-12"><div class="card-head"><h3>${icon('layers')}เปรียบเทียบ 3 หมวดหลัก</h3></div><div class="card-body table-wrap"><table class="table">
              <thead><tr><th>หมวดหลัก</th><th class="r">แจ้งซ่อม</th><th class="r">สัดส่วน</th><th class="r">ยังไม่ปิดงาน</th><th class="r">เสร็จสิ้น</th><th class="r">เวลาเฉลี่ย (วัน)</th></tr></thead>
              <tbody>${st.formTime.map((f, i) => `<tr><td><span class="row" style="gap:10px"><i style="width:12px;height:12px;border-radius:3px;background:${SERIES[i]}"></i>${esc(f.name)}</span></td><td class="r num">${f.n}</td><td class="r num">${totalForms ? Math.round(f.n / totalForms * 100) : 0}%</td><td class="r num">${f.open}</td><td class="r num">${f.done}</td><td class="r num">${f.avg === null ? '—' : f.avg.toFixed(1)}</td></tr>`).join('')}</tbody></table></div></section>`}
            <section class="card chart-card span-6"><div class="card-head"><h3>${icon('wrench')}หมวดงานที่แจ้งซ่อม</h3><span class="chart-sub">จำนวนงาน</span></div><div class="card-body"><div class="chart-box" style="height:${Math.max(200, st.cats.length * 36 + 40)}px"><canvas id="cCat"></canvas></div></div></section>
            <section class="card span-6"><div class="card-head"><h3>${icon('list')}รายการที่ซ่อมบ่อยที่สุด</h3><span class="chart-sub">Top 10</span></div><div class="card-body">${rankList(st.items, v => `${v} ครั้ง`) || '<p class="small faint">ไม่มีข้อมูล</p>'}</div></section>
            <section class="card span-6"><div class="card-head"><h3>${icon('pin')}สถานที่ที่แจ้งซ่อมบ่อย</h3><span class="chart-sub">เสียซ้ำ ≥ 3 ครั้ง ควรพิจารณาปรับปรุง</span></div><div class="card-body">${rankList(st.locs.map(([k, v]) => [k, v, v >= 3 ? '<span class="badge tone-red" style="padding:1px 8px">เสียซ้ำ</span>' : '']), v => `${v} ครั้ง`) || '<p class="small faint">ไม่มีข้อมูล</p>'}</div></section>
            <section class="card span-6"><div class="card-head"><h3>${icon('users')}ฝ่ายงาน / กลุ่มสาระที่แจ้งซ่อม</h3></div><div class="card-body">${rankList(st.depts.map(([k, v]) => [k.replace('กลุ่มสาระการเรียนรู้', 'กลุ่มสาระฯ '), v]), v => `${v} งาน`) || '<p class="small faint">ไม่มีข้อมูล</p>'}</div></section>
            <section class="card span-6"><div class="card-head"><h3>${icon('x')}สาเหตุที่ซ่อมไม่ได้</h3></div><div class="card-body">${rankList(st.cannot, v => `${v} งาน`) || '<p class="small faint">ไม่มีรายการที่ซ่อมไม่ได้</p>'}</div></section>
            <section class="card span-6"><div class="card-head"><h3>${icon('user')}ผู้ปฏิบัติงาน</h3><span class="chart-sub">จำนวนงานที่ซ่อมเสร็จ</span></div><div class="card-body">${rankList(st.workers, v => `${v} งาน`) || '<p class="small faint">ไม่มีข้อมูล</p>'}</div></section>`;
          chart($('#cTrend', root), lineConfig(st.buckets.map(b => b.label), [
            { label: 'แจ้งซ่อม', data: st.buckets.map(b => b.created), color: SERIES[0] },
            { label: 'เสร็จสิ้น', data: st.buckets.map(b => b.done), color: SERIES[1] }
          ]));
          chart($('#cCat', root), hBar(st.cats.map(x => x[0]), st.cats.map(x => x[1]), C_COUNT));
        };
        render();
        root.addEventListener('change', e => {
          if (!(e.target.id in state)) return;
          state[e.target.id] = e.target.value;
          if (e.target.id === 'range') $('#customR', root).hidden = state.range !== 'custom';
          render();
        });
        root.addEventListener('click', e => { const f = e.target.closest('[data-form]'); if (f) { state.form = f.dataset.form; render(); } });
        $('#reset', root).addEventListener('click', () => {
          Object.assign(state, { range: '365d', from: '', to: '', cat: '', loc: '', dept: '' });
          $$('.filters select', root).forEach(x => { x.value = state[x.id] ?? ''; });
          $('#customR', root).hidden = true;
          render();
        });
        $('#statCsv').addEventListener('click', () => exportCsv(statsRange(state).list, 'รายงานสถิติแจ้งซ่อม'));
        $('#statPdf').addEventListener('click', () => {
          try { sessionStorage.setItem('pcshs-report', JSON.stringify(state)); } catch (e) { /* ignore */ }
          App.go('/print-report');
        });
        App.onCleanup(Store.subscribe(render));
        App.onCleanup(destroyCharts);
      }
    };
  }

  // ═══════════ ตั้งค่า: หมวดงานซ่อม ═══════════
  const CAT_ICONS = ['zap', 'droplet', 'hammer', 'window', 'speaker', 'monitor', 'aircon', 'building', 'bed', 'wrench', 'package', 'layers', 'home', 'shield', 'activity', 'more'];
  function categories() {
    const state = { form: '' };
    return {
      title: 'หมวดงานซ่อม', subtitle: 'เพิ่ม ลบ แก้ไขหมวดและรายการที่ให้ครูเลือกในแบบฟอร์ม (รายการจะแสดงในใบแจ้งซ่อม PDF ตามลำดับนี้)',
      actions: `<button class="btn btn-primary btn-sm" id="addCat">${icon('plus')} เพิ่มหมวดงาน</button>`,
      html: `<div class="card" style="padding:16px" id="ff"></div><div class="setting-list" id="cats"></div>`,
      mount(root) {
        const s = S();
        const render = () => {
          $('#ff', root).innerHTML = Pages.formTabs(state.form);
          const all = Store.allCategories();
          const list = all.filter(c => !state.form || c.forms.includes(state.form));
          $('#cats', root).innerHTML = list.map(c => `
            <article class="card cat-editor" style="${c.active === false ? 'opacity:.6' : ''}">
              <div class="cat-editor-head">
                <span class="cat-ic">${icon(c.icon)}</span>
                <div style="flex:1;min-width:180px"><strong style="font-family:var(--font-display);font-size:1.1rem;color:var(--navy-800)">${esc(c.name)}</strong>
                  <div class="row" style="gap:6px;margin-top:4px">${c.forms.map(f => Views.formChip(f)).join('')}${c.freeOnly ? '<span class="badge tone-slate">ระบุรายการเอง</span>' : ''}${c.active === false ? '<span class="badge tone-slate">ปิดใช้งาน</span>' : ''}</div></div>
                <div class="row" style="gap:6px">
                  <button class="icon-btn sm" data-move="-1" data-id="${c.id}" aria-label="เลื่อนขึ้น" ${all.indexOf(c) === 0 ? 'disabled' : ''}>${icon('grip')}</button>
                  <button class="icon-btn sm" data-move="1" data-id="${c.id}" aria-label="เลื่อนลง" style="transform:rotate(180deg)" ${all.indexOf(c) === all.length - 1 ? 'disabled' : ''}>${icon('grip')}</button>
                  <button class="icon-btn sm" data-edit="${c.id}" aria-label="แก้ไขหมวด">${icon('edit')}</button>
                  <button class="icon-btn sm danger" data-delcat="${c.id}" aria-label="ลบหมวด">${icon('trash')}</button>
                </div>
              </div>
              ${c.freeOnly ? '<p class="small faint" style="margin-top:12px">หมวดนี้ให้ผู้แจ้งพิมพ์รายการเอง</p>' : `
              <div class="item-rows">
                ${Store.itemsFor(c, state.form).map(it => `<span class="item-chip">${esc(it.name)}${it.unit ? `<span class="unit">· นับเป็น${esc(it.unit)}</span>` : ''}${it.forms ? `<span class="unit">· เฉพาะ${esc(it.forms.map(f => Views.formShort(f)).join('/'))}</span>` : ''}<button data-edititem="${it.id}" data-cat="${c.id}" aria-label="แก้ไข ${esc(it.name)}">${icon('edit')}</button><button data-delitem="${it.id}" data-cat="${c.id}" aria-label="ลบ ${esc(it.name)}">${icon('close')}</button></span>`).join('')}
              </div>
              <form class="row" data-additem="${c.id}" style="margin-top:14px;gap:8px">
                <input class="input sm" name="name" placeholder="เพิ่มรายการใหม่ เช่น ปลั๊กไฟ" style="flex:1 1 200px;width:auto" required>
                <input class="input sm" name="unit" placeholder="หน่วยนับ (ถ้าต้องระบุจำนวน)" style="flex:0 1 200px;width:auto">
                ${c.forms.length > 1 ? `<select class="select sm" name="forms" style="width:auto" aria-label="แสดงในแบบฟอร์ม"><option value="">ทุกแบบฟอร์ม</option>${c.forms.map(f => `<option value="${f}" ${state.form === f ? 'selected' : ''}>เฉพาะ${esc(Views.formShort(f))}</option>`).join('')}</select>` : ''}
                <button class="btn btn-soft btn-sm" type="submit">${icon('plus')} เพิ่ม</button>
              </form>`}
            </article>`).join('') || `<div class="card empty">${icon('layers')}<strong>ยังไม่มีหมวดงาน</strong></div>`;
        };
        const editCat = c => {
          const isNew = !c;
          c = c ? JSON.parse(JSON.stringify(c)) : { id: 'cat_' + Date.now().toString(36), name: '', icon: 'wrench', forms: [state.form || 'general'], items: [], active: true };
          UI.modal({ title: isNew ? 'เพิ่มหมวดงาน' : 'แก้ไขหมวดงาน',
            body: `<div class="field"><label for="cn">ชื่อหมวดงาน <span class="req">*</span></label><input class="input" id="cn" value="${esc(c.name)}" placeholder="เช่น งานไฟฟ้า"></div>
              <div class="field"><span class="label">ใช้ในแบบฟอร์ม</span><div class="row">${Store.FORM_KEYS.map(k => `<label class="checkbox"><input type="checkbox" name="forms" value="${k}" ${c.forms.includes(k) ? 'checked' : ''}>${esc(s.forms[k].name)}</label>`).join('')}</div></div>
              <div class="field"><span class="label">ไอคอน</span><div class="icon-picker">${CAT_ICONS.map(ic => `<label><input type="radio" name="ic" value="${ic}" ${ic === c.icon ? 'checked' : ''}><span>${icon(ic)}</span></label>`).join('')}</div></div>
              <label class="checkbox"><input type="checkbox" id="free" ${c.freeOnly ? 'checked' : ''}>ไม่มีรายการให้เลือก ให้ผู้แจ้งพิมพ์เอง</label>
              <label class="checkbox"><input type="checkbox" id="act" ${c.active !== false ? 'checked' : ''}>เปิดใช้งาน</label>`,
            actions: [{ label: 'ยกเลิก', kind: 'btn-ghost-dark' }, { label: 'บันทึก', kind: 'btn-primary', onClick: api => {
              const name = $('#cn', api.body).value.trim();
              const forms = $$('input[name=forms]:checked', api.body).map(x => x.value);
              if (!name) throw new Error('กรุณาระบุชื่อหมวด');
              if (!forms.length) throw new Error('กรุณาเลือกอย่างน้อย 1 แบบฟอร์ม');
              Store.saveCategory({ ...c, name, forms, icon: $('input[name=ic]:checked', api.body).value, freeOnly: $('#free', api.body).checked, active: $('#act', api.body).checked });
              UI.toast('บันทึกหมวดงานแล้ว');
            } }] });
        };
        render();
        root.addEventListener('click', async e => {
          const f = e.target.closest('[data-form]'); if (f) { state.form = f.dataset.form; render(); return; }
          const t = e.target.closest('button'); if (!t) return;
          const cat = id => JSON.parse(JSON.stringify(Store.allCategories().find(c => c.id === id)));
          if (t.dataset.move) Store.moveCategory(t.dataset.id, +t.dataset.move);
          else if (t.dataset.edit) editCat(cat(t.dataset.edit));
          else if (t.dataset.delcat) { if (await UI.confirm('ลบหมวดงานนี้และรายการทั้งหมดในหมวด? (ใบแจ้งซ่อมเดิมไม่ได้รับผลกระทบ)', { danger: true, okLabel: 'ลบ' })) { Store.deleteCategory(t.dataset.delcat); UI.toast('ลบหมวดงานแล้ว'); } }
          else if (t.dataset.delitem) { const c = cat(t.dataset.cat); c.items = c.items.filter(i => i.id !== t.dataset.delitem); Store.saveCategory(c); UI.toast('ลบรายการแล้ว'); }
          else if (t.dataset.edititem) {
            const c = cat(t.dataset.cat), it = c.items.find(i => i.id === t.dataset.edititem);
            UI.modal({ title: 'แก้ไขรายการ', size: 'sm', body: `<div class="field"><label for="in">ชื่อรายการ</label><input class="input" id="in" value="${esc(it.name)}"></div><div class="field"><label for="iu">หน่วยนับ</label><input class="input" id="iu" value="${esc(it.unit || '')}" placeholder="เว้นว่างถ้าไม่ต้องระบุจำนวน"></div>
              ${c.forms.length > 1 ? `<div class="field"><span class="label">แสดงในแบบฟอร์ม</span><div class="row">${c.forms.map(f => `<label class="checkbox"><input type="checkbox" name="iforms" value="${f}" ${!it.forms || it.forms.includes(f) ? 'checked' : ''}>${esc(s.forms[f].name)}</label>`).join('')}</div></div>` : ''}`,
              actions: [{ label: 'ยกเลิก', kind: 'btn-ghost-dark' }, { label: 'บันทึก', kind: 'btn-primary', onClick: api => {
                const name = $('#in', api.body).value.trim(); if (!name) throw new Error('กรุณาระบุชื่อรายการ');
                it.name = name; const unit = $('#iu', api.body).value.trim(); if (unit) it.unit = unit; else delete it.unit;
                if (c.forms.length > 1) {
                  const fs = $$('input[name=iforms]:checked', api.body).map(x => x.value);
                  if (!fs.length) throw new Error('เลือกอย่างน้อย 1 แบบฟอร์ม');
                  if (fs.length === c.forms.length) delete it.forms; else it.forms = fs;
                }
                Store.saveCategory(c); UI.toast('บันทึกแล้ว');
              } }] });
          }
        });
        root.addEventListener('submit', e => {
          const f = e.target.closest('[data-additem]'); if (!f) return;
          e.preventDefault();
          const c = JSON.parse(JSON.stringify(Store.allCategories().find(x => x.id === f.dataset.additem)));
          const name = f.name.value.trim(), unit = f.unit.value.trim(), only = f.forms?.value || '';
          if (!name) return;
          c.items.push({ id: 'it_' + Math.random().toString(36).slice(2, 9), name, ...(unit ? { unit } : {}), ...(only ? { forms: [only] } : {}) });
          Store.saveCategory(c);
          UI.toast(`เพิ่ม "${name}" แล้ว`);
        });
        $('#addCat').addEventListener('click', () => editCat(null));
        App.onCleanup(Store.subscribe(render));
      }
    };
  }

  // ═══════════ ตั้งค่า: สถานที่ ═══════════
  // แปลงข้อความ "ชื่อกลุ่ม: ห้อง, ห้อง" (บรรทัดละกลุ่ม) ↔ zones · รองรับช่วง 201-211 และ 1/1-1/3
  function parseZones(text) {
    const expand = tok => {
      let m = tok.match(/^(\d+)\s*-\s*(\d+)$/);
      if (m && +m[2] >= +m[1] && +m[2] - +m[1] < 200) return Array.from({ length: +m[2] - +m[1] + 1 }, (_, i) => String(+m[1] + i));
      m = tok.match(/^(\d+)\/(\d+)\s*-\s*\1\/(\d+)$/);
      if (m && +m[3] >= +m[2]) return Array.from({ length: +m[3] - +m[2] + 1 }, (_, i) => `${m[1]}/${+m[2] + i}`);
      return [tok];
    };
    return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
      const i = line.indexOf(':');
      const name = i >= 0 ? line.slice(0, i).trim() : '';
      const rooms = (i >= 0 ? line.slice(i + 1) : line).split(',').map(x => x.trim()).filter(Boolean).flatMap(expand);
      return { name, rooms };
    }).filter(z => z.rooms.length);
  }
  const zonesText = zones => (zones || []).map(z => `${z.name ? z.name + ': ' : ''}${z.rooms.join(', ')}`).join('\n');

  function locations() {
    const state = { type: 'building' };
    return {
      title: 'อาคารและสถานที่', subtitle: 'สถานที่ ห้อง และหอพักที่ให้ครูเลือกตอนแจ้งซ่อม (เลือกได้หลายห้องพร้อมกัน)',
      actions: `<button class="btn btn-primary btn-sm" id="addLoc">${icon('plus')} เพิ่มสถานที่</button>`,
      html: `<div class="card filters"><div class="seg" id="locTabs"></div></div><div class="stack" id="locs" style="gap:16px"></div>`,
      mount(root) {
        const render = () => {
          $('#locTabs', root).innerHTML = [['building', 'สถานที่ (แจ้งซ่อมทั่วไป)'], ['dorm', 'หอพักนักเรียน']].map(([k, l]) => `<button type="button" data-type="${k}" class="${state.type === k ? 'is-active' : ''}">${l}</button>`).join('');
          const list = Store.allLocations().filter(l => l.type === state.type);
          const counts = countBy(Store.tickets(), t => t.location.locationId);
          const n = id => counts.find(c => c[0] === id)?.[1] || 0;
          const groups = [...new Set(list.map(l => l.group || ''))];
          $('#locs', root).innerHTML = groups.map(g => `
            <section class="card">
              <div class="card-head"><h3>${icon(state.type === 'dorm' ? 'bed' : 'building')}${esc(g || 'ไม่ระบุกลุ่ม')}</h3><span class="chart-sub">${list.filter(l => (l.group || '') === g).length} แห่ง</span></div>
              <div class="card-body stack" style="gap:0;padding-top:4px;padding-bottom:4px">
                ${list.filter(l => (l.group || '') === g).map(l => {
                  const rooms = (l.zones || []).reduce((a, z) => a + z.rooms.length, 0);
                  return `<div class="loc-row" style="${l.active === false ? 'opacity:.55' : ''}">
                    <div style="flex:1;min-width:0"><strong>${esc(l.name)}</strong>
                      <div class="small faint">${rooms ? `${(l.zones || []).filter(z => z.name).length ? `${l.zones.length} กลุ่ม · ` : ''}${rooms} ห้อง` : 'ไม่มีห้องย่อย'} · แจ้งซ่อม ${n(l.id)} ครั้ง</div>
                      ${l.zones?.length ? `<div class="zone-preview">${l.zones.slice(0, 4).map(z => `<span class="chip">${esc(z.name || 'ห้อง')} ${z.rooms.length > 3 ? `${esc(z.rooms[0])}–${esc(z.rooms.at(-1))}` : esc(z.rooms.join(', '))}</span>`).join('')}${l.zones.length > 4 ? `<span class="chip">+${l.zones.length - 4} กลุ่ม</span>` : ''}</div>` : ''}
                    </div>
                    <label class="checkbox small"><input type="checkbox" data-toggle="${l.id}" ${l.active !== false ? 'checked' : ''}>ใช้งาน</label>
                    <button class="icon-btn sm" data-edit="${l.id}" aria-label="แก้ไข ${esc(l.name)}">${icon('edit')}</button>
                    <button class="icon-btn sm danger" data-del="${l.id}" aria-label="ลบ ${esc(l.name)}">${icon('trash')}</button>
                  </div>`;
                }).join('')}
              </div>
            </section>`).join('') || `<div class="card empty">${icon('pin')}<strong>ยังไม่มีสถานที่</strong></div>`;
        };
        const edit = l => {
          const isNew = !l;
          l = l ? JSON.parse(JSON.stringify(l)) : { name: '', type: state.type, group: '', zones: [], active: true };
          const groups = [...new Set(Store.allLocations().filter(x => x.type === l.type).map(x => x.group).filter(Boolean))];
          UI.modal({ title: isNew ? 'เพิ่มสถานที่' : `แก้ไข ${l.name}`, size: 'lg',
            body: `
              <div class="grid-2">
                <div class="field"><label for="ln">ชื่อ${l.type === 'dorm' ? 'หอพัก' : 'สถานที่'} <span class="req">*</span></label><input class="input" id="ln" value="${esc(l.name)}" placeholder="${l.type === 'dorm' ? 'เช่น หอ D1 บัวอุบล (ญ)' : 'เช่น ห้องเรียน ม.1'}"></div>
                <div class="field"><label for="lg">กลุ่ม (หัวข้อในรายการ)</label><input class="input" id="lg" list="lgList" value="${esc(l.group || '')}" placeholder="เช่น ห้องประชุม / หอประชุม"><datalist id="lgList">${groups.map(g => `<option value="${esc(g)}">`).join('')}</datalist></div>
              </div>
              <div class="field"><label for="lz">${l.type === 'dorm' ? 'ล็อคนอน / ชั้น และห้อง' : 'ห้องย่อย'} <span class="faint">(บรรทัดละกลุ่ม · เว้นว่างถ้าไม่มีห้องย่อย)</span></label>
                <textarea class="textarea" id="lz" style="min-height:190px;font-size:.92rem" placeholder="${l.type === 'dorm' ? 'ส่วนกลาง: ห้อง Study, ห้องประชุม\nล็อค 1: 1/1-1/3\nชั้น 2: 201-211\nห้องพักครู: ชั้น 2, ชั้น 3' : '101-104'}">${esc(zonesText(l.zones))}</textarea>
                <span class="hint">รูปแบบ <strong>ชื่อกลุ่ม: ห้อง, ห้อง</strong> · พิมพ์ช่วงได้ เช่น 201-211 หรือ 1/1-1/3 · ไม่ต้องมีชื่อกลุ่มก็ได้ เช่น 101-104</span></div>
              <div id="lzPreview"></div>`,
            onOpen: api => {
              const prev = () => {
                const z = parseZones($('#lz', api.body).value);
                $('#lzPreview', api.body).innerHTML = z.length ? `<div class="label" style="margin-bottom:6px">ตัวอย่างที่ครูจะเห็น (${z.reduce((a, x) => a + x.rooms.length, 0)} ห้อง)</div>${z.map(x => `<div class="zone"><div class="zone-head"><strong>${esc(x.name || 'ห้อง')}</strong></div><div class="pick-grid">${x.rooms.slice(0, 20).map(r => `<span class="pick pick-sm"><span class="box"></span>${esc(r)}</span>`).join('')}${x.rooms.length > 20 ? `<span class="faint small">+${x.rooms.length - 20}</span>` : ''}</div></div>`).join('')}` : '';
              };
              $('#lz', api.body).addEventListener('input', prev); prev();
            },
            actions: [{ label: 'ยกเลิก', kind: 'btn-ghost-dark' }, { label: 'บันทึก', kind: 'btn-primary', onClick: api => {
              const name = $('#ln', api.body).value.trim();
              if (!name) throw new Error('กรุณาระบุชื่อ');
              Store.saveLocation({ ...l, name, group: $('#lg', api.body).value.trim(), zones: parseZones($('#lz', api.body).value) });
              UI.toast('บันทึกสถานที่แล้ว');
            } }] });
        };
        render();
        root.addEventListener('change', e => { const id = e.target.dataset.toggle; if (id) { const l = Store.allLocations().find(x => x.id === id); Store.saveLocation({ ...l, active: e.target.checked }); } });
        root.addEventListener('click', async e => {
          const tb = e.target.closest('[data-type]'); if (tb) { state.type = tb.dataset.type; render(); return; }
          const b = e.target.closest('button'); if (!b) return;
          if (b.dataset.edit) edit(Store.allLocations().find(x => x.id === b.dataset.edit));
          if (b.dataset.del && await UI.confirm('ลบสถานที่นี้? ใบแจ้งซ่อมเดิมยังแสดงชื่อเดิมตามปกติ', { danger: true, okLabel: 'ลบ' })) { Store.deleteLocation(b.dataset.del); UI.toast('ลบแล้ว'); }
        });
        $('#addLoc').addEventListener('click', () => edit(null));
        App.onCleanup(Store.subscribe(render));
      }
    };
  }

  // ═══════════ ตั้งค่า: ผู้ใช้และสิทธิ์ ═══════════
  const ROLE = {
    teacher: { label: 'ครู', tone: 'orange', desc: 'แจ้งซ่อมและดูรายการของตัวเอง' },
    executive: { label: 'ผู้บริหาร', tone: 'gold', desc: 'ดูสถิติ รายงาน และแดชบอร์ดได้อย่างเดียว ไม่สามารถแก้ไขหรืออนุมัติ' },
    approver: { label: 'ผู้อนุมัติ', tone: 'green', desc: 'อัปเดตสถานะเฉพาะหมวดและสถานะที่ได้รับสิทธิ์ ไม่เห็นสถิติและการตั้งค่า' },
    admin: { label: 'แอดมิน', tone: 'indigo', desc: 'ดูแลทุกอย่าง เห็นทุกหมวด สถิติ และการตั้งค่า' }
  };
  function users() {
    const state = { q: '', role: '' };
    return {
      title: 'ผู้ใช้และสิทธิ์', subtitle: 'กำหนดบทบาท หมวดที่มองเห็น และสถานะที่กดได้ของแต่ละคน (นักเรียนใช้โดเมนเดียวกัน จึงต้องมีชื่อในรายการนี้ก่อน)',
      actions: `<button class="btn btn-outline btn-sm" id="imp">${icon('upload')} นำเข้ารายชื่อ</button><button class="btn btn-primary btn-sm" id="addU">${icon('plus')} เพิ่มผู้ใช้</button>`,
      html: `
        <div class="card">
          <div class="filters"><div class="input-icon">${icon('search')}<input class="input sm" id="q" placeholder="ค้นหาชื่อ อีเมล ฝ่าย" style="padding-left:40px"></div>
            <div class="seg" id="roleTabs"></div>
            <span class="spacer"></span><span class="small faint" id="cnt"></span></div>
          <div class="table-wrap"><table class="table"><thead><tr><th>ชื่อ / อีเมล</th><th>บทบาท</th><th>หมวดที่เห็น</th><th>สถานะที่กดได้</th><th>ลายเซ็น</th><th></th></tr></thead><tbody id="rows"></tbody></table></div>
        </div>`,
      mount(root) {
        const s = S();
        const mainRole = u => ['admin', 'approver', 'executive'].find(r => u.roles.includes(r)) || 'teacher';
        const render = () => {
          const q = state.q.toLowerCase();
          const all = Store.users();
          $('#roleTabs', root).innerHTML = [['', 'ทั้งหมด'], ...Object.entries(ROLE).map(([k, v]) => [k, v.label])].map(([k, l]) => `<button type="button" data-role="${k}" class="${state.role === k ? 'is-active' : ''}">${l} <span class="faint">${k ? all.filter(u => mainRole(u) === k).length : all.length}</span></button>`).join('');
          const list = all.filter(u => (!state.role || mainRole(u) === state.role) && (!q || [Store.fullName(u), u.email, u.dept, u.position].join(' ').toLowerCase().includes(q)));
          $('#cnt', root).textContent = `${list.length} จาก ${all.length} บัญชี`;
          const signOf = u => Object.entries(s.signatories).filter(([, v]) => v.email === u.email).map(([, v]) => v.title);
          $('#rows', root).innerHTML = list.map(u => {
            const r = mainRole(u);
            return `
            <tr style="${u.active ? '' : 'opacity:.55'}"><td><div class="row" style="gap:12px;flex-wrap:nowrap">${UI.avatar(Store.fullName(u), '', r !== 'teacher' ? 'navy' : '')}<div><strong style="font-weight:500">${esc(Store.fullName(u))}</strong><div class="sub">${esc(u.email)}</div>${signOf(u).length ? `<div class="sub" style="color:var(--orange-700)">ผู้ลงนาม: ${signOf(u).map(esc).join(', ')}</div>` : ''}</div></div></td>
              <td><span class="badge tone-${ROLE[r].tone}">${ROLE[r].label}</span>${!u.active ? ' <span class="badge tone-slate">ระงับ</span>' : ''}</td>
              <td>${r === 'teacher' || r === 'executive' ? '<span class="faint small">—</span>' : `<div class="role-tags">${Store.formsOf(u).map(f => Views.formChip(f)).join('') || '<span class="faint small">ไม่มี</span>'}</div>`}</td>
              <td>${r === 'teacher' || r === 'executive' ? '<span class="faint small">—</span>' : `<div class="role-tags">${Store.actionsOf(u).map(a => `<span class="badge tone-${UI.STATUS[a].tone}" style="padding:2px 9px">${UI.STATUS[a].label}</span>`).join('') || '<span class="faint small">ไม่มี</span>'}</div>`}</td>
              <td>${u.signature ? `<img src="${u.signature}" alt="" style="height:28px">` : '<span class="faint small">—</span>'}</td>
              <td class="r nowrap"><button class="icon-btn sm" data-edit="${esc(u.email)}" aria-label="แก้ไข">${icon('edit')}</button> <button class="icon-btn sm danger" data-del="${esc(u.email)}" aria-label="ลบ">${icon('trash')}</button></td></tr>`;
          }).join('');
        };
        const edit = u => {
          const isNew = !u;
          u = u || { email: '', prefix: 'นาย', first: '', last: '', position: 'ครู', dept: '', phone: '', roles: ['teacher'], forms: [...Store.FORM_KEYS], actions: ['done', 'cannot_fix'], active: true };
          const r = mainRole(u);
          UI.modal({ title: isNew ? 'เพิ่มผู้ใช้' : 'แก้ไขผู้ใช้และสิทธิ์', size: 'lg',
            body: `<div class="grid-2">
                <div class="field"><label for="em">อีเมลโรงเรียน <span class="req">*</span></label><input class="input" id="em" value="${esc(u.email)}" placeholder="name@${esc(s.domain)}"></div>
                <div class="field"><label for="ph">เบอร์โทร</label><input class="input" id="ph" value="${esc(u.phone || '')}"></div></div>
              <div class="grid-3">
                <div class="field"><label for="pf">คำนำหน้า</label><select class="select" id="pf">${['นาย', 'นาง', 'นางสาว', 'ดร.', 'ว่าที่ร้อยตรี'].map(v => `<option ${v === u.prefix ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
                <div class="field"><label for="fn">ชื่อ <span class="req">*</span></label><input class="input" id="fn" value="${esc(u.first)}"></div>
                <div class="field"><label for="ln">นามสกุล <span class="req">*</span></label><input class="input" id="ln" value="${esc(u.last)}"></div></div>
              <div class="grid-2">
                <div class="field"><label for="po">ตำแหน่ง</label><input class="input" id="po" list="posList" value="${esc(u.position)}"><datalist id="posList">${s.positions.map(p => `<option value="${esc(p)}">`).join('')}</datalist></div>
                <div class="field"><label for="dp">ฝ่าย / กลุ่มสาระ</label><select class="select" id="dp"><option value="">-</option>${[...new Set([u.dept, ...s.departments])].filter(Boolean).map(d => `<option ${d === u.dept ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select></div></div>
              <div class="field"><span class="label">บทบาทในระบบหลังบ้าน</span><div class="role-cards">
                ${Object.entries(ROLE).map(([k, v]) => `<label class="role-card"><input type="radio" name="role" value="${k}" ${r === k ? 'checked' : ''}><span><strong>${icon({ admin: 'shield', approver: 'approve', executive: 'chart' }[k] || 'user')}${v.label}</strong><small>${v.desc}</small></span></label>`).join('')}
              </div></div>
              <div id="permBox" class="stack" ${r === 'approver' ? '' : 'hidden'}>
                <div class="field"><span class="label">มองเห็นและจัดการหมวด</span><div class="perm-grid">${Store.FORM_KEYS.map(k => `<label class="perm"><input type="checkbox" name="forms" value="${k}" ${(u.forms || []).includes(k) ? 'checked' : ''}>${icon(UI.FORM_ICON[k])}${esc(s.forms[k].name)}</label>`).join('')}</div></div>
                <div class="field"><span class="label">สถานะที่กดได้</span><div class="perm-grid">${Store.ACTIONS.map(a => `<label class="perm"><input type="checkbox" name="actions" value="${a}" ${(u.actions || []).includes(a) ? 'checked' : ''}>${icon(UI.STATUS[a].icon)}${UI.STATUS[a].label}</label>`).join('')}</div>
                  <span class="hint">ค่าแนะนำสำหรับผู้อนุมัติขั้นสุดท้าย: เสร็จสิ้น และ ไม่สามารถซ่อมได้</span></div>
              </div>
              <label class="checkbox"><input type="checkbox" id="tc" ${u.roles.includes('teacher') ? 'checked' : ''}>แจ้งซ่อมได้ด้วย (เป็นครู/บุคลากร)</label>
              <label class="checkbox"><input type="checkbox" id="ac" ${u.active ? 'checked' : ''}>เปิดใช้งานบัญชี</label>`,
            onOpen: api => api.body.addEventListener('change', e => { if (e.target.name === 'role') { $('#permBox', api.body).hidden = e.target.value !== 'approver'; if (e.target.value === 'teacher') $('#tc', api.body).checked = true; } }),
            actions: [{ label: 'ยกเลิก', kind: 'btn-ghost-dark' }, { label: 'บันทึก', kind: 'btn-primary', onClick: api => {
              const v = id => $('#' + id, api.body).value.trim();
              const email = v('em').toLowerCase();
              if (!email.endsWith('@' + s.domain)) throw new Error(`อีเมลต้องลงท้ายด้วย @${s.domain}`);
              if (!v('fn') || !v('ln')) throw new Error('กรุณากรอกชื่อและนามสกุล');
              const role = $('input[name=role]:checked', api.body).value;
              const roles = [...new Set([...(role !== 'teacher' ? [role] : []), ...($('#tc', api.body).checked || role === 'teacher' ? ['teacher'] : [])])];
              const forms = $$('input[name=forms]:checked', api.body).map(x => x.value);
              const actions = $$('input[name=actions]:checked', api.body).map(x => x.value);
              if (role === 'approver' && !forms.length) throw new Error('กรุณาเลือกหมวดที่ผู้อนุมัติมองเห็นอย่างน้อย 1 หมวด');
              if (role === 'approver' && !actions.length) throw new Error('กรุณาเลือกสถานะที่กดได้อย่างน้อย 1 สถานะ');
              if (!isNew && u.email === Store.me().email && role !== 'admin' && mainRole(u) === 'admin') throw new Error('ไม่สามารถลดสิทธิ์แอดมินของตัวเองได้');
              Store.saveUser({ email, prefix: v('pf'), first: v('fn'), last: v('ln'), position: v('po'), dept: v('dp'), phone: v('ph'), roles, forms, actions, active: $('#ac', api.body).checked }, isNew ? null : u.email);
              UI.toast('บันทึกผู้ใช้แล้ว');
            } }] });
        };
        render();
        root.addEventListener('input', e => { if (e.target.id === 'q') { state.q = e.target.value; render(); } });
        root.addEventListener('click', async e => {
          const rt = e.target.closest('[data-role]'); if (rt) { state.role = rt.dataset.role; render(); return; }
          const b = e.target.closest('button'); if (!b) return;
          if (b.dataset.edit) edit(JSON.parse(JSON.stringify(Store.userByEmail(b.dataset.edit))));
          if (b.dataset.del) {
            if (b.dataset.del === Store.me().email) return UI.toast('ไม่สามารถลบบัญชีของตัวเองได้', 'error');
            if (await UI.confirm(`ลบ ${b.dataset.del} ออกจากระบบ?`, { danger: true, okLabel: 'ลบ' })) { Store.deleteUser(b.dataset.del); UI.toast('ลบผู้ใช้แล้ว'); }
          }
        });
        $('#addU').addEventListener('click', () => edit(null));
        $('#imp').addEventListener('click', () => {
          const s = S();
          UI.modal({ title: 'นำเข้ารายชื่อครู', size: 'lg',
            body: `<p class="muted small">คัดลอกจาก Excel หรือ Google Sheets แล้ววางด้านล่าง หนึ่งบรรทัดต่อหนึ่งคน เรียงคอลัมน์: <strong>อีเมล, คำนำหน้า, ชื่อ, นามสกุล, ตำแหน่ง, ฝ่าย/กลุ่มสาระ, เบอร์โทร</strong> (คั่นด้วยจุลภาคหรือแท็บ) ผู้ใช้ใหม่จะได้บทบาท "ครู"</p>
              <textarea class="textarea" id="csv" style="min-height:200px;font-family:monospace;font-size:.85rem" placeholder="malee.s@${esc(s.domain)}, นางสาว, มาลี, สวยงาม, ครู, กลุ่มสาระการเรียนรู้ศิลปะ, 081-111-2222"></textarea>`,
            actions: [{ label: 'ยกเลิก', kind: 'btn-ghost-dark' }, { label: 'นำเข้า', kind: 'btn-primary', icon: 'upload', onClick: api => {
              const rows = [], bad = [];
              $('#csv', api.body).value.split(/\r?\n/).map(l => l.trim()).filter(Boolean).forEach((line, i) => {
                const [email, prefix, first, last, position, dept, phone] = line.split(/\t|,/).map(x => (x || '').trim());
                if (!email?.toLowerCase().endsWith('@' + s.domain) || !first) bad.push(i + 1);
                else rows.push({ email: email.toLowerCase(), prefix, first, last, position: position || 'ครู', dept, phone });
              });
              if (!rows.length) throw new Error('ไม่พบข้อมูลที่ถูกต้อง');
              const r = Store.importUsers(rows);
              UI.toast(`เพิ่มใหม่ ${r.added} คน · อัปเดต ${r.updated} คน${bad.length ? ` · ข้าม ${bad.length} บรรทัด` : ''}`);
            } }] });
        });
        App.onCleanup(Store.subscribe(render));
      }
    };
  }

  // ═══════════ ตั้งค่า: บุคลากร (หน้าติดต่อเรา) ═══════════
  function staff() {
    return {
      title: 'บุคลากร (หน้าติดต่อเรา)', subtitle: 'เปลี่ยนรูป ชื่อ ตำแหน่ง เพิ่ม/ลบ และลากเพื่อจัดลำดับการแสดงผล',
      actions: `<a class="btn btn-outline btn-sm" href="#/contact" target="_blank">${icon('eye')} ดูหน้าเว็บ</a><button class="btn btn-primary btn-sm" id="addS">${icon('plus')} เพิ่มบุคลากร</button>`,
      html: `<div class="notice">${icon('grip')}<div>ลากที่ไอคอน ⠿ เพื่อเลื่อนลำดับ หรือใช้ปุ่มลูกศร · บุคลากรระดับ "ผู้บริหารฝ่าย" จะแสดงเป็นการ์ดใหญ่ด้านบนของหน้าติดต่อเรา</div></div><div class="card" id="list"></div>`,
      mount(root) {
        const render = () => {
          const list = Store.staff();
          $('#list', root).innerHTML = list.map((m, i) => `
            <div class="staff-row" draggable="true" data-id="${m.id}">
              <span class="drag-handle" title="ลากเพื่อเรียงลำดับ" aria-hidden="true">⠿</span>
              <span class="order-no">${i + 1}</span>
              <span class="staff-thumb ${m.tier === 'lead' ? 'lead' : ''}">${m.photo ? `<img src="${m.photo}" alt="">` : icon('user')}</span>
              <div class="sr-info" style="flex:1;min-width:0"><div class="row" style="gap:8px"><strong style="font-family:var(--font-display);font-weight:600">${esc(m.name)}</strong>${m.tier === 'lead' ? '<span class="badge tone-orange">ผู้บริหารฝ่าย</span>' : ''}</div>
                <div class="small" style="color:var(--orange-700)">${esc(m.position)}</div>${m.tier === 'lead' && m.message ? `<div class="small faint sr-duties">“${esc(m.message)}”</div>` : ''}</div>
              <div class="row sr-acts" style="gap:6px">
                <button class="icon-btn sm" data-move="-1" data-id="${m.id}" ${i === 0 ? 'disabled' : ''} aria-label="เลื่อนขึ้น">${icon('grip')}</button>
                <button class="icon-btn sm" data-move="1" data-id="${m.id}" ${i === list.length - 1 ? 'disabled' : ''} style="transform:rotate(180deg)" aria-label="เลื่อนลง">${icon('grip')}</button>
                <button class="icon-btn sm" data-edit="${m.id}" aria-label="แก้ไข">${icon('edit')}</button>
                <button class="icon-btn sm danger" data-del="${m.id}" aria-label="ลบ">${icon('trash')}</button></div>
            </div>`).join('') || `<div class="empty">${icon('users')}<strong>ยังไม่มีบุคลากร</strong></div>`;
        };
        const edit = m => {
          const isNew = !m;
          m = m ? { ...m } : { name: '', position: '', tier: 'team', duties: '', message: '', phone: '', email: '', photo: '' };
          let photo = m.photo;
          UI.modal({ title: isNew ? 'เพิ่มบุคลากร' : 'แก้ไขบุคลากร', size: 'lg',
            body: `
              <div class="photo-pick"><span class="staff-thumb ${m.tier === 'lead' ? 'lead' : ''}" id="pv">${photo ? `<img src="${photo}" alt="">` : icon('user')}</span>
                <div class="stack" style="gap:8px"><label class="btn btn-soft btn-sm">${icon('upload')} ${photo ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}<input type="file" accept="image/*" hidden id="pf"></label>
                <button type="button" class="btn btn-ghost-dark btn-sm" id="rm">ลบรูป</button><span class="hint">แนะนำรูปแนวตั้ง พื้นหลังเรียบ ระบบย่อขนาดให้อัตโนมัติ</span></div></div>
              <div class="grid-2">
                <div class="field"><label for="nm">ชื่อ-นามสกุล <span class="req">*</span></label><input class="input" id="nm" value="${esc(m.name)}" placeholder="เช่น นางสาวพิศมัย แจ่มจำรัส"></div>
                <div class="field"><label for="ps">ตำแหน่ง <span class="req">*</span></label><input class="input" id="ps" value="${esc(m.position)}"></div>
                <div class="field"><label for="tr">ระดับการแสดงผล</label><select class="select" id="tr"><option value="lead" ${m.tier === 'lead' ? 'selected' : ''}>ผู้บริหารฝ่าย (การ์ดใหญ่ด้านบน)</option><option value="team" ${m.tier !== 'lead' ? 'selected' : ''}>ทีมงาน</option></select></div>
                <div class="field"><label for="tel">โทรศัพท์</label><input class="input" id="tel" value="${esc(m.phone || '')}"></div>
                <div class="field" style="grid-column:1/-1"><label for="ml">อีเมล</label><input class="input" id="ml" value="${esc(m.email || '')}"></div></div>
              <div class="stack" id="leadBox" style="gap:14px" ${m.tier === 'lead' ? '' : 'hidden'}>
                <div class="field"><label for="msg">คำพูดประกอบ</label><textarea class="textarea" id="msg" maxlength="200" style="min-height:80px" placeholder="เช่น ฝ่ายบริหารงานทั่วไปพร้อมดูแลอาคารและสถานที่...">${esc(m.message || '')}</textarea><span class="hint">แสดงเป็นข้อความเด่นบนการ์ดใหญ่ในหน้าติดต่อเรา</span></div>
                <div class="field"><label for="du">คำอธิบายหน้าที่</label><textarea class="textarea" id="du" maxlength="200" style="min-height:70px">${esc(m.duties || '')}</textarea></div>
              </div>
              <p class="hint" id="teamHint" ${m.tier === 'lead' ? 'hidden' : ''}>ทีมงานแสดงรูป ชื่อ และตำแหน่ง · คำพูดประกอบและคำอธิบายหน้าที่ใส่ได้เฉพาะระดับผู้บริหารฝ่าย</p>`,
            onOpen: api => {
              $('#tr', api.body).addEventListener('change', e => {
                const lead = e.target.value === 'lead';
                $('#leadBox', api.body).hidden = !lead; $('#teamHint', api.body).hidden = lead;
                $('#pv', api.body).classList.toggle('lead', lead);
              });
              $('#pf', api.body).addEventListener('change', async e => { const f = e.target.files[0]; if (!f) return; photo = await UI.compressImage(f, 700, .82); $('#pv', api.body).innerHTML = `<img src="${photo}" alt="">`; });
              $('#rm', api.body).addEventListener('click', () => { photo = ''; $('#pv', api.body).innerHTML = icon('user'); });
            },
            actions: [{ label: 'ยกเลิก', kind: 'btn-ghost-dark' }, { label: 'บันทึก', kind: 'btn-primary', onClick: api => {
              const v = id => $('#' + id, api.body).value.trim();
              if (!v('nm') || !v('ps')) throw new Error('กรุณากรอกชื่อและตำแหน่ง');
              const lead = v('tr') === 'lead';
              Store.saveStaff({ ...m, name: v('nm'), position: v('ps'), tier: v('tr'), phone: v('tel'), email: v('ml'), duties: lead ? v('du') : '', message: lead ? v('msg') : '', photo });
              UI.toast('บันทึกแล้ว');
            } }] });
        };
        render();
        // ลากเพื่อเรียงลำดับ
        let dragId = null;
        root.addEventListener('dragstart', e => { const r = e.target.closest('.staff-row'); if (!r) return; dragId = r.dataset.id; r.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
        root.addEventListener('dragend', e => { e.target.closest('.staff-row')?.classList.remove('dragging'); $$('.drag-over', root).forEach(x => x.classList.remove('drag-over')); });
        root.addEventListener('dragover', e => { const r = e.target.closest('.staff-row'); if (!r || !dragId) return; e.preventDefault(); $$('.drag-over', root).forEach(x => x !== r && x.classList.remove('drag-over')); r.classList.add('drag-over'); });
        root.addEventListener('drop', e => {
          const r = e.target.closest('.staff-row'); if (!r || !dragId) return;
          e.preventDefault();
          const ids = Store.staff().map(m => m.id).filter(id => id !== dragId);
          ids.splice(ids.indexOf(r.dataset.id), 0, dragId);
          Store.reorderStaff(ids); dragId = null; UI.toast('จัดลำดับใหม่แล้ว');
        });
        root.addEventListener('click', async e => {
          const b = e.target.closest('button'); if (!b) return;
          if (b.dataset.move) {
            const ids = Store.staff().map(m => m.id), i = ids.indexOf(b.dataset.id), j = i + +b.dataset.move;
            [ids[i], ids[j]] = [ids[j], ids[i]]; Store.reorderStaff(ids);
          }
          if (b.dataset.edit) edit(Store.staff().find(m => m.id === b.dataset.edit));
          if (b.dataset.del && await UI.confirm('ลบบุคลากรนี้ออกจากหน้าติดต่อเรา?', { danger: true, okLabel: 'ลบ' })) { Store.deleteStaff(b.dataset.del); UI.toast('ลบแล้ว'); }
        });
        $('#addS').addEventListener('click', () => edit(null));
        App.onCleanup(Store.subscribe(render));
      }
    };
  }

  // ═══════════ ตั้งค่าระบบ ═══════════
  function settings() {
    return {
      title: 'ตั้งค่าระบบ', subtitle: 'ข้อมูลหน่วยงาน ผู้ลงนาม แบบฟอร์มเอกสาร และการแจ้งเตือน',
      actions: `<button class="btn btn-primary btn-sm" id="saveAll">${icon('check')} บันทึกการตั้งค่า</button>`,
      html: `<form id="sf" class="chart-grid"></form>`,
      mount(root) {
        const s = JSON.parse(JSON.stringify(S()));
        const users = Store.users().filter(u => u.active);
        const f = (id, label, val, extra = '') => `<div class="field"><label for="${id}">${label}</label><input class="input" id="${id}" value="${esc(val)}" ${extra}></div>`;
        const SIGN_LABEL = { head_building: 'ช่องลงนามที่ 1 · แจ้งซ่อมทั่วไป / เครื่องปรับอากาศ', deputy_student: 'ช่องลงนามที่ 1 · แจ้งซ่อมหอพัก', deputy_general: 'ช่องลงนามที่ 2 · ทุกแบบฟอร์ม' };
        $('#sf', root).innerHTML = `
          <section class="card span-6"><div class="card-head"><h3>${icon('building')}ข้อมูลหน่วยงาน</h3></div><div class="card-body stack">
            ${f('schoolName', 'ชื่อโรงเรียน (ส่วนราชการ)', s.schoolName)}${f('division', 'ฝ่าย', s.division)}${f('unit', 'แผนก', s.unit)}${f('addressee', 'เรียน (ในเอกสาร)', s.addressee)}
            <div class="field"><label for="domain">โดเมนอีเมลโรงเรียน</label><div class="input-icon">${icon('mail')}<input class="input" id="domain" value="${esc(s.domain)}"></div><span class="hint">ใช้ตรวจสอบการเข้าสู่ระบบ ระบบจริงตั้งค่านี้ตอนติดตั้งบน Google Workspace</span></div>
          </div></section>
          <section class="card span-6"><div class="card-head"><h3>${icon('sign')}ผู้ลงนามในใบแจ้งซ่อม</h3></div><div class="card-body stack">
            <p class="small muted">เมื่อกด "กำลังดำเนินการซ่อม" ระบบจะลงลายเซ็นของผู้ดำรงตำแหน่งเหล่านี้ในใบแจ้งซ่อมอัตโนมัติ</p>
            ${Object.entries(s.signatories).map(([k, v]) => `<div class="field"><span class="label">${SIGN_LABEL[k]}</span>
              <div class="grid-2"><input class="input" id="sigt_${k}" value="${esc(v.title)}" aria-label="ชื่อตำแหน่ง">
              <select class="select" id="sigu_${k}" aria-label="ผู้ดำรงตำแหน่ง"><option value="">— เลือกผู้ดำรงตำแหน่ง —</option>${users.map(u => `<option value="${esc(u.email)}" ${u.email === v.email ? 'selected' : ''}>${esc(Store.fullName(u))}${u.signature ? '' : ' (ยังไม่มีลายเซ็น)'}</option>`).join('')}</select></div></div>`).join('')}
          </div></section>
          ${Store.FORM_KEYS.map(k => `
          <section class="card span-4"><div class="card-head"><h3>${icon(UI.FORM_ICON[k])}${esc(s.forms[k].name)}</h3><label class="checkbox small"><input type="checkbox" id="en_${k}" ${s.forms[k].enabled ? 'checked' : ''}>เปิดรับแจ้ง</label></div><div class="card-body stack">
            ${f(`fn_${k}`, 'ชื่อแบบฟอร์ม', s.forms[k].name)}${f(`fd_${k}`, 'คำอธิบาย', s.forms[k].desc)}
            <div class="field"><label for="fs_${k}">เรื่อง (ในบันทึกข้อความ)</label><textarea class="textarea" id="fs_${k}" style="min-height:70px">${esc(s.forms[k].subject)}</textarea></div>
            <div class="field"><label for="fx_${k}">หมายเหตุท้ายเอกสาร (บรรทัดละข้อ)</label><textarea class="textarea" id="fx_${k}" style="min-height:90px">${esc(s.forms[k].notes.join('\n'))}</textarea></div>
          </div></section>`).join('')}
          <section class="card span-4"><div class="card-head"><h3>${icon('file')}เลขที่เอกสาร</h3></div><div class="card-body stack">
            ${f('docPrefix', 'คำนำหน้าเลขที่ (ช่อง "ที่")', s.docPrefix, 'placeholder="เช่น บท."')}
            <p class="small muted">ตัวอย่าง: ที่ ${esc(s.docPrefix)}${(s.running[new Date().getFullYear() + 543] || 0) + 1}/${new Date().getFullYear() + 543} · เลขรันใหม่ทุกปี พ.ศ.</p>
            <label class="checkbox"><input type="checkbox" id="showRef" ${s.showRefOnDoc ? 'checked' : ''}>แสดงเลขอ้างอิงระบบ (REP-xxxx) มุมขวาบนของเอกสาร</label>
          </div></section>
          <section class="card span-4"><div class="card-head"><h3>${icon('clock')}งานค้าง</h3></div><div class="card-body stack">
            <div class="row" style="gap:12px">ถือว่า "ค้างนาน" เมื่อยังไม่ปิดงานเกิน<input class="input sm" type="number" min="1" id="staleDays" value="${s.staleDays || 7}" style="width:90px">วัน</div>
            <p class="hint">ใช้แสดงป้าย "ค้างนาน" ในรายการงานและนับในสถิติ</p>
            <div class="row" style="gap:12px">ครูแจ้ง "ยังไม่หาย" ได้ภายใน<input class="input sm" type="number" min="1" id="reopenDays" value="${s.reopenDays || 14}" style="width:90px">วันหลังเสร็จสิ้น</div>
          </div></section>
          <section class="card span-4"><div class="card-head"><h3>${icon('bell')}การแจ้งเตือน</h3></div><div class="card-body stack">
            <label class="checkbox"><input type="checkbox" id="nEmail" ${s.notify.email ? 'checked' : ''}>อีเมล (เจ้าหน้าที่เมื่อมีงานใหม่ · ครูเมื่อสถานะเปลี่ยน)</label>
            <label class="checkbox"><input type="checkbox" id="nApp" ${s.notify.inApp ? 'checked' : ''}>กระดิ่งแจ้งเตือนในเว็บ</label>
            <label class="checkbox" style="opacity:.55"><input type="checkbox" disabled>LINE Official Account (เพิ่มในระยะถัดไป)</label>
          </div></section>
          <section class="card span-12"><div class="card-head"><h3>${icon('bell')}แถบเหตุฉุกเฉิน และประกาศหน้าเว็บ</h3><span class="small faint">ทุกคนเห็นได้ ไม่ต้องเข้าสู่ระบบ · กด "บันทึกการตั้งค่า" ด้านบนเมื่อแก้เสร็จ</span></div>
            <div class="card-body grid-2 banner-edit">
              <div class="stack" style="gap:12px">
                <label class="checkbox"><input type="checkbox" id="bnEm" ${Store.banners().emergency?.enabled ? 'checked' : ''}><b style="color:#B91C1C">แถบสีแดง (เหตุฉุกเฉิน)</b> · แสดงบนสุดทุกหน้า</label>
                <div class="field"><label for="bnEmText">ข้อความ</label><input class="input" id="bnEmText" maxlength="140" value="${esc(Store.banners().emergency?.text || '')}"></div>
                <div class="field"><label for="bnEmPhone">เบอร์โทร (มือถือกดโทรได้)</label><input class="input" id="bnEmPhone" maxlength="30" value="${esc(Store.banners().emergency?.phone || '')}" placeholder="เช่น 02-123-4567 หรือ 081-234-5678"></div>
              </div>
              <div class="stack" style="gap:12px">
                <label class="checkbox"><input type="checkbox" id="bnNo" ${Store.banners().notice?.enabled ? 'checked' : ''}><b style="color:var(--orange-700)">แถบประกาศ</b> · แสดงบนรูปหน้าแรก (ผู้ชมกด ✕ ปิดได้)</label>
                <div class="field"><label for="bnNoText">ข้อความประกาศ</label><textarea class="textarea" id="bnNoText" maxlength="200" style="min-height:70px">${esc(Store.banners().notice?.text || '')}</textarea></div>
                <div class="grid-2"><div class="field"><label for="bnNoFrom">เริ่มแสดง (ไม่บังคับ)</label><input type="date" class="input" id="bnNoFrom" value="${esc(Store.banners().notice?.from || '')}"></div>
                  <div class="field"><label for="bnNoTo">แสดงถึงวันที่ (ไม่บังคับ)</label><input type="date" class="input" id="bnNoTo" value="${esc(Store.banners().notice?.to || '')}"></div></div>
                <span class="hint">เว้นวันที่ว่าง = แสดงตลอดจนกว่าจะปิด · เลยวันสิ้นสุดแล้วประกาศหายเอง</span>
              </div>
            </div></section>
          <section class="card span-6"><div class="card-head"><h3>${icon('phone')}ช่องทางติดต่อ (หน้าติดต่อเรา)</h3></div><div class="card-body grid-2">
            ${f('cPhone', 'โทรศัพท์', s.contact.phone)}${f('cEmail', 'อีเมล', s.contact.email)}${f('cOffice', 'สำนักงาน', s.contact.office)}${f('cHours', 'เวลาทำการ', s.contact.hours)}
          </div></section>
          <section class="card span-6"><div class="card-head"><h3>${icon('list')}ตัวเลือกในแบบฟอร์ม (บรรทัดละรายการ)</h3></div><div class="card-body grid-2">
            <div class="field"><label for="lDept">ฝ่ายงาน / กลุ่มสาระ</label><textarea class="textarea" id="lDept" style="min-height:150px">${esc(s.departments.join('\n'))}</textarea></div>
            <div class="field"><label for="lPos">ตำแหน่ง</label><textarea class="textarea" id="lPos" style="min-height:150px">${esc(s.positions.join('\n'))}</textarea></div>
            <div class="field"><label for="lWork">รายชื่อผู้ปฏิบัติงาน / ช่าง</label><textarea class="textarea" id="lWork" style="min-height:110px">${esc(s.workers.join('\n'))}</textarea></div>
            <div class="field"><label for="lRev">เหตุผล "รอพิจารณา"</label><textarea class="textarea" id="lRev" style="min-height:110px">${esc(s.reviewReasons.join('\n'))}</textarea></div>
            <div class="field" style="grid-column:1/-1"><label for="lCan">เหตุผล "ไม่สามารถซ่อมได้"</label><textarea class="textarea" id="lCan" style="min-height:110px">${esc(s.cannotReasons.join('\n'))}</textarea></div>
          </div></section>
          <section class="card span-12 purge-card"><div class="card-head"><h3>${icon('trash')}ล้างข้อมูลใบแจ้งซ่อม</h3><span class="badge tone-red">เฉพาะแอดมิน · กู้คืนไม่ได้</span></div>
            <div class="card-body stack" style="gap:14px">
              <p class="muted small" style="margin:0">ลบใบแจ้งซ่อม<b>ทุกสถานะ</b>ที่<b>วันที่แจ้ง</b>อยู่ในช่วงที่เลือก ทั้งข้อมูลในระบบและรูปใน Google Drive (รูปย้ายไปถังขยะ กู้คืนได้ภายใน 30 วัน) · ระบบดาวน์โหลดไฟล์สำรอง (CSV เปิดด้วย Excel ได้) ให้อัตโนมัติก่อนลบทุกครั้ง · เลขที่ใบไม่ถูกรีเซ็ต</p>
              <div class="row purge-range">
                <select class="select sm" id="pgPreset" aria-label="ช่วงเวลา">
                  ${[['month', 'เดือนนี้'], ['lastMonth', 'เดือนที่แล้ว'], ['year', 'ปีนี้ (ม.ค.–ธ.ค.)'], ['lastYear', 'ปีที่แล้ว'], ['older1', 'เก่ากว่า 1 ปี'], ['older2', 'เก่ากว่า 2 ปี'], ['custom', 'กำหนดวันที่เอง']].map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}
                </select>
                <span class="row" id="pgCustom" hidden><input type="date" class="input sm" id="pgFrom" aria-label="ตั้งแต่วันที่"><span class="faint">ถึง</span><input type="date" class="input sm" id="pgTo" aria-label="ถึงวันที่"></span>
                <button type="button" class="btn btn-outline btn-sm" id="pgCheck">${icon('search')} ตรวจสอบรายการที่จะลบ</button>
              </div>
              <div id="pgResult"></div>
            </div></section>
          ${Store.cloud ? `<section class="card span-12"><div class="card-head"><h3>${icon('trash')}ใบแจ้งซ่อมตัวอย่าง</h3></div><div class="card-body row">
            <p class="muted small" style="flex:1">ตอนเริ่มระบบ ใส่ใบแจ้งซ่อมตัวอย่างไว้ให้ทดลองใช้ ${Store.hasSamples() ? '<b>(ตอนนี้ยังมีใบตัวอย่างอยู่)</b>' : '(ลบไปแล้ว)'} · เมื่อพร้อมใช้งานจริง กดลบได้ เลขที่ใบจะเริ่มนับต่อจากใบจริงล่าสุด (ถ้ายังไม่มีใบจริง เริ่ม 0001)</p>
            <button type="button" class="btn btn-outline btn-sm" id="delSamples" ${Store.hasSamples() ? '' : 'disabled'}>${icon('trash')} ลบใบตัวอย่างทั้งหมด</button></div></section>`
          : `<section class="card span-12"><div class="card-head"><h3>${icon('refresh')}ข้อมูลทดลอง</h3></div><div class="card-body row">
            <p class="muted small" style="flex:1">ต้นแบบนี้เก็บข้อมูลไว้ในเบราว์เซอร์ กดปุ่มเพื่อล้างและสร้างข้อมูลตัวอย่างใหม่</p>
            <button type="button" class="btn btn-outline btn-sm" id="resetDemo">${icon('refresh')} รีเซ็ตข้อมูลทดลอง</button></div></section>`}`;
        const lines = id => $('#' + id, root).value.split('\n').map(x => x.trim()).filter(Boolean);
        const val = id => $('#' + id, root).value.trim();
        $('#saveAll').addEventListener('click', () => {
          if (!val('domain').includes('.')) return UI.toast('โดเมนอีเมลไม่ถูกต้อง', 'error');
          if (val('bnNoFrom') && val('bnNoTo') && val('bnNoTo') < val('bnNoFrom')) return UI.toast('วันที่สิ้นสุดประกาศต้องไม่ก่อนวันที่เริ่ม', 'error');
          Store.saveSettings({
            schoolName: val('schoolName'), division: val('division'), unit: val('unit'), addressee: val('addressee'), domain: val('domain').replace(/^@/, ''),
            docPrefix: val('docPrefix'), showRefOnDoc: $('#showRef', root).checked, staleDays: Math.max(1, +val('staleDays') || 7), reopenDays: Math.max(1, +val('reopenDays') || 14),
            signatories: Object.fromEntries(Object.keys(s.signatories).map(k => [k, { title: val('sigt_' + k), email: val('sigu_' + k) }])),
            forms: Object.fromEntries(Store.FORM_KEYS.map(k => [k, { ...s.forms[k], enabled: $('#en_' + k, root).checked, name: val('fn_' + k), desc: val('fd_' + k), subject: val('fs_' + k), notes: lines('fx_' + k) }])),
            notify: { ...s.notify, email: $('#nEmail', root).checked, inApp: $('#nApp', root).checked },
            contact: { ...s.contact, phone: val('cPhone'), email: val('cEmail'), office: val('cOffice'), hours: val('cHours') },
            banners: {
              emergency: { enabled: $('#bnEm', root).checked, text: val('bnEmText'), phone: val('bnEmPhone') },
              notice: { enabled: $('#bnNo', root).checked, text: val('bnNoText'), from: val('bnNoFrom'), to: val('bnNoTo') }
            },
            departments: lines('lDept'), positions: lines('lPos'), workers: lines('lWork'), reviewReasons: lines('lRev'), cannotReasons: lines('lCan')
          });
          UI.toast('บันทึกการตั้งค่าแล้ว');
        });
        // ───── ล้างข้อมูลตามช่วงวันที่แจ้ง ─────
        const pg = { list: null, from: null, to: null };
        const pgRange = () => {
          const now = new Date(), y = now.getFullYear(), m = now.getMonth();
          const DAYMS = 864e5, start = new Date(2000, 0, 1);
          switch ($('#pgPreset', root).value) {
            case 'month': return [new Date(y, m, 1), new Date(y, m + 1, 1)];
            case 'lastMonth': return [new Date(y, m - 1, 1), new Date(y, m, 1)];
            case 'year': return [new Date(y, 0, 1), new Date(y + 1, 0, 1)];
            case 'lastYear': return [new Date(y - 1, 0, 1), new Date(y, 0, 1)];
            case 'older1': return [start, new Date(now.getTime() - 365 * DAYMS)];
            case 'older2': return [start, new Date(now.getTime() - 730 * DAYMS)];
            default: {
              const f = $('#pgFrom', root).value, t = $('#pgTo', root).value;
              if (!f || !t) return null;
              return [new Date(f + 'T00:00:00'), new Date(new Date(t + 'T00:00:00').getTime() + DAYMS)];
            }
          }
        };
        const pgReset = () => { pg.list = null; $('#pgResult', root).innerHTML = ''; };
        $('#pgPreset', root).addEventListener('change', e => { $('#pgCustom', root).hidden = e.target.value !== 'custom'; pgReset(); });
        ['pgFrom', 'pgTo'].forEach(id => $('#' + id, root).addEventListener('change', pgReset));
        $('#pgCheck', root).addEventListener('click', async e => {
          const range = pgRange();
          if (!range) return UI.toast('กรุณาเลือกวันที่เริ่มต้นและสิ้นสุด', 'error');
          if (range[1] <= range[0]) return UI.toast('วันที่สิ้นสุดต้องอยู่หลังวันที่เริ่มต้น', 'error');
          const btn = e.currentTarget; btn.disabled = true;
          try {
            const list = await Store.purgePreview(range[0], range[1]);
            Object.assign(pg, { list, from: range[0], to: range[1] });
            const photos = new Set(list.flatMap(Store.photoRefs)).size;
            const open = list.filter(t => ['pending', 'in_progress', 'review'].includes(t.status)).length;
            const label = `${UI.date(range[0].toISOString())} – ${UI.date(new Date(range[1] - 1).toISOString())}`;
            $('#pgResult', root).innerHTML = !list.length ? `<div class="notice">${icon('checkCircle')}<div>ไม่มีใบแจ้งซ่อมที่แจ้งในช่วง ${label}</div></div>` : `
              <div class="purge-sum">
                <div><small>ช่วงวันที่แจ้ง</small><strong>${label}</strong></div>
                <div><small>ใบแจ้งซ่อม</small><strong>${UI.num(list.length)} ใบ</strong></div>
                <div><small>รูปภาพ</small><strong>${UI.num(photos)} รูป</strong></div>
                <div><small>แยกตามสถานะ</small><span>${UI.STATUS_KEYS.map(k => [k, list.filter(t => t.status === k).length]).filter(x => x[1]).map(([k, n]) => `${UI.STATUS[k].label} ${n}`).join(' · ')}</span></div>
              </div>
              ${open ? `<div class="notice red">${icon('alert')}<div><b>มีงานที่ยังไม่ปิด ${open} ใบ</b> (รออนุมัติ / กำลังซ่อม / รอพิจารณา) จะถูกลบไปด้วย ครูผู้แจ้งจะไม่เห็นงานนี้อีก</div></div>` : ''}
              <div class="row purge-confirm">
                <label class="field" style="flex:1;min-width:220px;margin:0"><span class="label">พิมพ์คำว่า <b>ลบข้อมูล</b> เพื่อยืนยัน</span><input class="input" id="pgWord" autocomplete="off" placeholder="ลบข้อมูล"></label>
                <button type="button" class="btn btn-danger" id="pgDo" disabled>${icon('trash')} ดาวน์โหลดไฟล์สำรอง แล้วลบ ${UI.num(list.length)} ใบ</button>
              </div>
              <p class="small faint" id="pgProg" style="margin:0"></p>`;
          } catch (err) { UI.toast(err.message, 'error'); }
          finally { btn.disabled = false; }
        });
        root.addEventListener('input', e => { if (e.target.id === 'pgWord') $('#pgDo', root).disabled = e.target.value.trim() !== 'ลบข้อมูล'; });
        root.addEventListener('click', async e => {
          const btn = e.target.closest('#pgDo');
          if (!btn || !pg.list?.length) return;
          btn.disabled = true; $('#pgWord', root).disabled = true;
          const prog = msg => { $('#pgProg', root).textContent = msg; };
          try {
            // สำรองก่อนลบเสมอ: ไฟล์ CSV ชื่อบอกช่วงวันที่
            const stamp = d => d.toISOString().slice(0, 10);
            exportCsv(pg.list, `สำรองก่อนล้างข้อมูล ${stamp(pg.from)} ถึง ${stamp(new Date(pg.to - 1))}`);
            prog('ดาวน์โหลดไฟล์สำรองแล้ว · กำลังเริ่มลบ...');
            const r = await Store.purge(pg.list, prog);
            UI.toast(`ล้างข้อมูลแล้ว: ลบ ${UI.num(r.tickets)} ใบ${r.photoTotal ? ` · ย้ายรูปไปถังขยะ ${UI.num(r.photos)} รูป` : ''}`);
            pgReset();
          } catch (err) {
            prog('');
            UI.toast(err.message, 'error');
            btn.disabled = false; $('#pgWord', root).disabled = false;
          }
        });

        $('#delSamples', root)?.addEventListener('click', async e => {
          if (!await UI.confirm('ลบใบแจ้งซ่อมตัวอย่างทั้งหมดออกจากระบบถาวร? (ใบจริงไม่ได้รับผลกระทบ)', { title: 'ลบใบตัวอย่าง', danger: true, okLabel: 'ลบทั้งหมด' })) return;
          const btn = e.target.closest('button'); btn.disabled = true; btn.innerHTML = `${icon('refresh')} กำลังลบ...`;
          try { const n = await Store.deleteSamples(); UI.toast(`ลบใบตัวอย่าง ${n} ใบแล้ว`); App.render(); }
          catch (err) { UI.toast(err.message, 'error'); btn.disabled = false; }
        });
        $('#resetDemo', root)?.addEventListener('click', async () => {
          if (!await UI.confirm('ล้างข้อมูลทั้งหมดในเบราว์เซอร์และสร้างข้อมูลตัวอย่างใหม่?', { danger: true, okLabel: 'รีเซ็ต' })) return;
          const me = Store.me()?.email;
          Store.reset();
          if (me) await Store.login(me).catch(() => {});
          UI.toast('รีเซ็ตข้อมูลทดลองแล้ว');
          App.render();
        });
      }
    };
  }

  return { overview, jobs, job, stats, categories, locations, users, staff, settings, isStale, computeStats, statsRange, catKeys, SERIES };
})();
