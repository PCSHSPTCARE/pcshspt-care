/* ชิ้นส่วนแสดงผลใบแจ้งซ่อม ใช้ร่วมกันทั้งหน้าครูและหลังบ้าน */
const Views = (() => {
  const PROGRESS = { pending: 15, review: 45, in_progress: 60, done: 100, cannot_fix: 100, cancelled: 0 };
  const formName = key => Store.settings().forms[key]?.name || key;
  const formShort = key => formName(key).replace('แจ้งซ่อม', '').trim();
  const catIcon = id => Store.allCategories().find(c => c.id === id)?.icon || 'wrench';
  const ticketIcon = t => catIcon(t.items[0]?.catId || 'other');
  const itemsTitle = t => t.items.map(i => (i.catId === 'ac' && !i.custom ? 'แอร์ ' : '') + i.name).join(', ') || '-';
  const formChip = k => `<span class="chip chip-form f-${k}">${icon(UI.FORM_ICON[k])}${esc(formShort(k))}</span>`;

  function ticketCard(t, { href } = {}) {
    return `
      <a class="t-card" href="#${href || '/ticket/' + t.id}">
        <span class="t-ic">${icon(ticketIcon(t))}</span>
        <div class="t-main">
          <div class="row" style="gap:10px"><span class="t-id">${esc(t.id)}</span>${formChip(t.formType)}</div>
          <div class="t-title">${esc(itemsTitle(t))}</div>
          <div class="t-meta">
            <span>${icon('pin')}${esc(UI.locationText(t))}</span>
            <span>${icon('calendar')}${UI.dateTime(t.createdAt)}</span>
          </div>
        </div>
        <div class="t-side">
          ${UI.statusBadge(t.status)}
          <span class="mini-progress" title="ความคืบหน้า ${PROGRESS[t.status]}%"><span style="width:${PROGRESS[t.status]}%"></span></span>
        </div>
      </a>`;
  }

  // แจ้งซ่อม → กำลังดำเนินการ/รอพิจารณา → เสร็จสิ้น/ซ่อมไม่ได้
  function progressSteps(t) {
    const mid = t.status === 'review' ? ['รอพิจารณา', 'hourglass'] : ['กำลังดำเนินการซ่อม', 'wrench'];
    const end = t.status === 'cannot_fix' ? ['ไม่สามารถซ่อมได้', 'close'] : ['เสร็จสิ้น', 'checkCircle'];
    const steps = [['แจ้งซ่อม', 'send'], ['รออนุมัติ', 'clock'], mid, end];
    if (t.status === 'cancelled') return `<div class="progress-steps"><div class="ps done"><span class="ps-dot">${icon('check')}</span>แจ้งซ่อม</div><div class="ps fail"><span class="ps-dot">${icon('close')}</span>ยกเลิกโดยผู้แจ้ง</div></div>`;
    const idx = { pending: 1, in_progress: 2, review: 2, done: 4, cannot_fix: 4 }[t.status];
    return `<div class="progress-steps">${steps.map(([label, ic], i) => {
      let cls = i < idx ? 'done' : i === idx ? 'current' : '';
      if (i === 3 && t.status === 'cannot_fix') cls = 'fail';
      return `<div class="ps ${cls}"><span class="ps-dot">${icon(cls === 'done' ? 'check' : ic)}</span>${label}</div>`;
    }).join('')}</div>`;
  }

  function photos(list, empty = '') {
    if (!list?.length) return empty;
    return `<div class="thumbs">${list.map((p, i) => `<figure class="thumb"><img ${Store.img(p)} alt="รูปที่ ${i + 1}" data-zoom></figure>`).join('')}</div>`;
  }



  function infoCard(t) {
    const r = t.reporter;
    const items = t.items.map((i, n) => `
      <li class="item-row"><span class="ir-no">${n + 1}</span><span class="ir-ic">${icon(catIcon(i.catId))}</span>
        <div><strong>${esc(i.name)}${i.qty ? ` <span class="faint">× ${i.qty} ${esc(i.unit)}</span>` : ''}</strong><span class="ir-cat">${esc(i.catName)}${i.custom ? ' · ระบุเอง' : ''}</span>
        <p>${esc(i.detail || '-')}</p>${i.photos?.length ? `<div style="margin-top:10px">${photos(i.photos)}</div>` : ''}</div></li>`).join('');
    return `
      <section class="card">
        <div class="card-head"><h3>${icon('file')}ข้อมูลการแจ้งซ่อม</h3>${formChip(t.formType)}</div>
        <div class="card-body stack">
          <dl class="kv">
            <div><dt>ผู้แจ้งซ่อม</dt><dd>${esc(r.name)}</dd></div>
            <div><dt>ตำแหน่ง</dt><dd>${esc(r.position || '-')}</dd></div>
            <div><dt>ฝ่ายงาน / กลุ่มสาระฯ</dt><dd>${esc(r.dept || '-')}</dd></div>
            <div><dt>เบอร์ติดต่อ</dt><dd>${esc(r.phone || '-')}</dd></div>
            <div><dt>สถานที่ซ่อม</dt><dd>${esc(UI.locationText(t))}</dd></div>
            <div><dt>วันเวลาที่แจ้ง</dt><dd>${UI.dateTime(t.createdAt)}</dd></div>

            <div><dt>เลขที่เอกสาร</dt><dd>${esc(t.docNo)}</dd></div>
            <div><dt>เลขอ้างอิงระบบ</dt><dd>${esc(t.id)}</dd></div>
            <div class="full"><dt>รายการที่แจ้งซ่อมและอาการ (${t.items.length} รายการ)</dt><dd><ol class="item-rows-list">${items}</ol></dd></div>
            ${t.note ? `<div class="full"><dt>หมายเหตุเพิ่มเติม</dt><dd style="font-weight:400">${esc(t.note)}</dd></div>` : ''}
            ${t.reopenOf ? `<div class="full"><dt>แจ้งซ้ำจากใบเดิม</dt><dd><a class="link" href="#/ticket/${esc(t.reopenOf)}">${esc(t.reopenOf)}</a> (ซ่อมแล้วยังไม่หาย)</dd></div>` : ''}
          </dl>
          ${t.photos?.length ? `<div><div class="label" style="margin-bottom:10px">${icon('camera')}รูปประกอบเพิ่มเติม</div>${photos(t.photos)}</div>` : ''}
          ${t.batchIds?.length > 1 ? `<div class="notice">${icon('layers')}<div>แจ้งพร้อมกัน ${t.batchIds.length} สถานที่: ${t.batchIds.map(id => id === t.id ? `<strong>${esc(id)}</strong>` : `<a class="link" href="${location.hash.startsWith('#/admin') ? '#/admin/job/' : '#/ticket/'}${esc(id)}">${esc(id)}</a>`).join(' · ')}</div></div>` : ''}
        </div>
      </section>`;
  }

  // ผลการดำเนินงาน: รอพิจารณา / ผู้อนุมัติ / ผลซ่อม
  function resultCard(t) {
    const a1 = t.approvals?.step1, a2 = t.approvals?.step2;
    if (t.status === 'cancelled') return `<section class="card"><div class="card-body"><div class="notice">${icon('close')}<div><strong>ผู้แจ้งยกเลิกคำขอนี้แล้ว</strong>${t.cancel?.reason ? `<div>เหตุผล: ${esc(t.cancel.reason)}</div>` : ''}<div class="small">${esc(t.cancel?.by || '')} · ${UI.dateTime(t.cancel?.at)}</div></div></div></div></section>`;
    if (t.status === 'pending' && !t.review) return '';
    const sig = (label, a) => a ? `
      <div class="approval-box"><span class="ab-ic tone-green">${icon('check')}</span>
        <div style="min-width:0"><div class="small faint">${esc(label)}</div><strong>${esc(a.by.name || '—')}</strong>
        <div class="small muted">${esc(a.by.title)} · ${UI.dateTime(a.at)}</div>
        ${a.by.signature ? `<div class="ab-sig"><img src="${a.by.signature}" alt="ลายเซ็น"></div>` : ''}</div></div>` : '';
    return `
      <section class="card">
        <div class="card-head"><h3>${icon('wrench')}ผลการดำเนินงาน</h3>${UI.statusBadge(t.status)}</div>
        <div class="card-body stack">
          ${t.status === 'review' && t.review ? `<div class="notice">${icon('hourglass')}<div><strong>รอพิจารณา${t.review.note ? `: ${esc(t.review.note)}` : ''}</strong><div class="small">${esc(t.review.by)} · ${UI.dateTime(t.review.at)}</div></div></div>` : ''}
          ${t.completion ? `<div class="notice" style="background:#F0FDF4;color:#166534">${icon('checkCircle')}<div><strong>ซ่อมเสร็จสิ้นเมื่อ ${UI.dateTime(t.completion.at)}</strong>
            ${t.completion.worker ? `<div>ผู้ปฏิบัติงาน: ${esc(t.completion.worker)}</div>` : ''}${t.completion.note ? `<div>${esc(t.completion.note)}</div>` : ''}</div></div>
            ${Views.photos(t.completion.photos)}` : ''}
          ${t.cannot ? `<div class="alert alert-error">${icon('alert')}<div><strong>ไม่สามารถซ่อมได้ เนื่องจาก ${esc(t.cannot.reason)}</strong>${t.cannot.note ? `<div>${esc(t.cannot.note)}</div>` : ''}<div class="small">${esc(t.cannot.by)} · ${UI.dateTime(t.cannot.at)}</div></div></div>
            ${Views.photos(t.cannot.photos)}` : ''}
          ${a1 || a2 ? `<div class="grid-2">${sig('ผู้อนุมัติ (ช่องที่ 1)', a1)}${sig('ผู้อนุมัติ (ช่องที่ 2)', a2)}</div>` : ''}
          ${t.inspection ? sig('ผู้ตรวจงาน', { by: { ...t.inspection.by, title: t.inspection.result === 'ok' ? 'การดำเนินงาน: เรียบร้อยดี' : 'การดำเนินงาน: ไม่สามารถแก้ไขได้' }, at: t.inspection.at }) : ''}
        </div>
      </section>`;
  }

  function historyCard(t) {
    const list = [...t.history].reverse();
    return `
      <section class="card">
        <div class="card-head"><h3>${icon('activity')}ประวัติการดำเนินงาน</h3><span class="small faint">บันทึกอัตโนมัติ แก้ไขย้อนหลังไม่ได้</span></div>
        <div class="card-body">
          <ol class="timeline">${list.map(h => `
            <li><span class="tl-dot">${icon('check')}</span>
              <div class="tl-title">${esc(h.action)}</div>
              <div class="tl-meta">${esc(h.by)} · ${UI.dateTime(h.at)}</div>
              ${h.note ? `<div class="tl-note">${esc(h.note)}</div>` : ''}</li>`).join('')}
          </ol>
        </div>
      </section>`;
  }

  function headCard(t) {
    return `
      <section class="card">
        <div class="card-body" style="padding-bottom:0">
          <div class="detail-head">
            <span class="t-ic">${icon(ticketIcon(t))}</span>
            <div style="min-width:0;flex:1">
              <div class="small faint">${esc(formName(t.formType))} · แจ้งเมื่อ ${UI.dateTime(t.createdAt)}</div>
              <h2 style="font-size:1.5rem;font-weight:600;color:var(--navy-800)">${esc(t.id)}</h2>
            </div>
            ${UI.statusBadge(t.status)}
          </div>
          <p style="margin-top:12px;font-size:1.05rem">${esc(itemsTitle(t))}</p>
        </div>
        ${progressSteps(t)}
      </section>`;
  }

  function bindZoom(root) {
    root.addEventListener('click', e => {
      const img = e.target.closest('img[data-zoom]');
      if (img) UI.lightbox(img.src);
    });
  }

  return { PROGRESS, formName, formShort, formChip, catIcon, ticketIcon, itemsTitle, ticketCard, progressSteps, photos, infoCard, resultCard, historyCard, headCard, bindZoom };
})();
