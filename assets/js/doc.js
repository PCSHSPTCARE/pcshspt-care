/* ใบขออนุญาตแจ้งซ่อม — จัดวางตามแบบฟอร์มกระดาษของโรงเรียน
   แบบ A = แจ้งซ่อมทั่วไป / หอพัก (รูป 1, 3) · แบบ B = เครื่องปรับอากาศ (รูป 2)
   style 'memo' = บันทึกข้อความมีตราครุฑ · 'plain' = ใบแจ้งซ่อมหัวกระดาษโรงเรียน (ไม่มีตราครุฑ)
   ตัวเลขทั้งหมดเป็นมิลลิเมตร วัดจากต้นฉบับ */
const Doc = (() => {
  const LAYOUT = {
    a: { garuda: [17.2, 7.6], title: 16.9, rows: [25.3, 33, 40, 49.5], left: 15, right: 16.2, rule: [43.6, 15, 21.5], date: 103.8, box: [54.8, 13.7, 16.2], notes: [279.4, 13.2, 25.8] },
    b: { garuda: [22.7, 4.3], title: 12, rows: [20.3, 27.5, 35.2, 49.8], left: 22.7, right: 22.4, rule: [41.2, 23.9, 26.2], date: 98.6, box: [53.8, 22.7, 22.4], notes: [272.6, 25.3, 36.4] }
  };

  // ───────── ชิ้นส่วนเอกสาร ─────────
  const val = v => (v === 0 || v) ? `<span>${esc(v)}</span>` : '<span><i class="fe"></i></span>';
  const F = (v, w) => `<span class="fill" style="width:${w}mm">${val(v)}</span>`;
  const G = (v, weight = 1, cls = '') => `<span class="fill ${cls}" style="flex:${weight} 1 0">${val(v)}</span>`;
  const SIG = (img, w) => `<span class="fill sig" style="width:${w}mm"><span><i class="fe"></i></span>${img ? `<img src="${img}" alt="">` : ''}</span>`;
  const CB = on => `<span class="cb ${on ? 'on' : ''}"></span>`;
  const RB = (on, lg = false) => `<span class="rb ${lg ? 'lg' : ''} ${on ? 'on' : ''}"></span>`;
  const MF = (label, text, lines, lh) => `
    <div class="mfill" style="--l:${lh}mm;height:${lines * lh}mm">
      ${Array.from({ length: lines }, (_, i) => `<div class="dots" style="top:${i * lh}mm"></div>`).join('')}
      <div class="txt">${label ? `<span class="lbl">${label}</span>` : ''}<span class="v">${esc(text || '')}</span></div>
    </div>`;
  const ln = (html, { l, pl, cls = '' } = {}) => `<div class="ln ${cls}" style="${l ? `--l:${l}mm;` : ''}${pl ? `padding-left:${pl}mm;` : ''}">${html}</div>`;
  const spacer = mm => `<div style="height:${mm}mm"></div>`;
  const GARUDA = () => typeof GARUDA_SRC !== 'undefined' ? GARUDA_SRC : 'images/garuda.png';

  function dateParts(iso) {
    if (!iso) return ['', '', ''];
    const d = new Date(iso);
    return [d.getDate(), UI.TH_MONTHS[d.getMonth()], d.getFullYear() + 543];
  }

  // ส่วนหัว: บันทึกข้อความ (มีตราครุฑ)
  function memoHeader(t, lay) {
    const s = Store.settings();
    const [no, yr] = String(t.docNo || '').split('/');
    const [dd, mm, yy] = dateParts(t.createdAt);
    const L = LAYOUT[lay];
    return `
      <img class="garuda" src="${GARUDA()}" alt="" style="left:${L.garuda[0]}mm;top:${L.garuda[1]}mm">
      ${s.showRefOnDoc ? `<div class="ref">อ้างอิงระบบ ${esc(t.id)}</div>` : ''}
      <div class="doc-title" style="top:${L.title}mm">บันทึกข้อความ</div>
      <div class="hl" style="top:${L.rows[0]}mm;left:${L.left}mm"><b>ส่วนราชการ</b>${esc(s.schoolName)}</div>
      <div class="hl" style="top:${L.rows[1]}mm;left:${L.left}mm"><b style="margin-right:2mm">ที่</b>${F(no, 7.5)}/${F(yr, 16)}</div>
      <div class="hl" style="top:${L.rows[1]}mm;left:${L.date}mm"><b style="margin-right:4.5mm">วันที่</b>${F(dd, 10)}/${F(mm, 23)}/${F(yy, 15)}</div>
      <div class="hl" style="top:${L.rows[2]}mm;left:${L.left}mm"><b style="margin-right:2.5mm">เรื่อง</b>${esc(s.forms[t.formType].subject)}</div>
      <div class="rule" style="top:${L.rule[0]}mm;left:${L.rule[1]}mm;right:${L.rule[2]}mm"></div>
      <div class="hl" style="top:${L.rows[3]}mm;left:${L.left}mm"><b style="margin-right:3.5mm">เรียน</b>${esc(s.addressee)}</div>`;
  }

  // ส่วนหัว: ใบแจ้งซ่อม (ไม่มีตราครุฑ) หัวกระดาษตราโรงเรียน
  function plainHeader(t, lay) {
    const s = Store.settings();
    const L = LAYOUT[lay];
    return `
      <div class="ph-head" style="left:${L.left}mm;right:${L.right}mm">
        <img class="ph-logo" src="images/logo.png" alt="">
        <div class="ph-title">
          <div class="ph-t1">ใบ${esc(s.forms[t.formType].name)}</div>
          <div class="ph-t2">${esc(s.unit)} ${esc(s.division)}</div>
          <div class="ph-t3">${esc(s.schoolName)}</div>
        </div>
        <div class="ph-meta">
          <div><span>เลขที่</span><b>${esc(t.docNo)}</b></div>
          <div><span>วันที่แจ้ง</span><b>${UI.dateLong(t.createdAt)}</b></div>
          <div><span>เวลา</span><b>${UI.time(t.createdAt)} น.</b></div>
          <div><span>อ้างอิง</span><b>${esc(t.id)}</b></div>
        </div>
      </div>
      <div class="ph-rule" style="left:${L.left}mm;right:${L.right}mm"></div>
      <div class="hl" style="top:${L.rows[3] - 7}mm;left:${L.left}mm"><b style="margin-right:2.5mm">เรื่อง</b>${esc(s.forms[t.formType].subject)}</div>
      <div class="hl" style="top:${L.rows[3]}mm;left:${L.left}mm"><b style="margin-right:3.5mm">เรียน</b>${esc(s.addressee)}</div>`;
  }

  function notes(t, lay) {
    const L = LAYOUT[lay];
    const list = Store.settings().forms[t.formType].notes || [];
    return `<div class="notes" style="top:${L.notes[0]}mm;left:${L.notes[1]}mm">
      ${list.map((n, i) => i === 0 ? `<div>หมายเหตุ – ${esc(n)}</div>` : `<div style="padding-left:${L.notes[2] - L.notes[1]}mm">– ${esc(n)}</div>`).join('')}</div>`;
  }

  // บล็อกพิจารณาอนุมัติ 2 คอลัมน์ (ลงลายเซ็นอัตโนมัติเมื่อเริ่มดำเนินการ)
  function approvals(t, { lh, sigLeft, sigRight, h }) {
    const k1 = Store.step1Key(t), k2 = Store.STEP2_KEY;
    const a1 = t.approvals?.step1, a2 = t.approvals?.step2;
    const p1 = a1?.by || Store.signer(k1), p2 = a2?.by || Store.signer(k2);
    const sigBlock = (sig, name, title, pl) => `
      <div style="padding-left:${pl}mm">
        <div class="sigblk">
          ${ln(`ลงชื่อ${SIG(sig, 44)}`, { l: lh, cls: 'center' })}
          ${ln(name ? `(${esc(name)})` : `(${F('', 42)})`, { l: lh, cls: 'center' })}
          ${ln(esc(title), { l: lh, cls: 'center' })}
        </div>
      </div>`;
    return `
      <div class="sec two" style="height:${h}mm;padding:0">
        <div>
          ${ln(`<b>${esc(p1.title)}</b>`, { l: lh })}
          ${ln(`${RB(!!a1)}เห็นควรพิจารณาอนุญาตดำเนินการ`, { l: lh })}
          ${MF(`${RB(false)}ไม่อนุญาต เนื่องจาก`, '', 2, lh)}
          ${spacer(h - lh * 7 - .4)}
          ${sigBlock(a1?.by.signature, p1.name, p1.title, sigLeft)}
        </div>
        <div>
          ${ln(`<b>${esc(p2.title)}</b>`, { l: lh })}
          ${ln('พิจารณาสั่งการ', { l: lh })}
          ${MF('', a2?.note || '', 2, lh)}
          ${spacer(h - lh * 7 - .4)}
          ${sigBlock(a2?.by.signature, p2.name, p2.title, sigRight)}
        </div>
      </div>`;
  }

  // จัดแถวรายการในแต่ละหมวด (ตามคอลัมน์ของแบบฟอร์ม)
  function categoryBlocks(t) {
    const picked = new Map(t.items.map(i => [i.itemId, i]));
    const pickedByName = new Map(t.items.map(i => [`${i.catId}|${i.name}`, i]));
    const current = Store.allCategories().filter(c => c.forms.includes(t.formType));
    const used = c => t.items.some(i => i.catId === c.id);
    // หมวดที่ไม่มีในแบบฟอร์มกระดาษเดิม (เช่น เครื่องปรับอากาศ) แสดงเฉพาะเมื่อมีการเลือก
    const cats = current.filter(c => used(c) || (c.active !== false && !c.pdfWhenUsed)).map(c => ({ ...c, items: Store.itemsFor(c, t.formType) }));
    // รายการที่ถูกลบออกจากระบบภายหลัง ยังต้องแสดงในเอกสารเดิม
    for (const it of t.items.filter(i => !i.custom)) {
      let c = cats.find(x => x.id === it.catId);
      if (!c) { c = { id: it.catId, name: it.catName, items: [] }; cats.push(c); }
      if (!c.items.some(x => x.id === it.itemId || x.name === it.name)) c.items.push({ id: it.itemId, name: it.name, unit: it.unit });
    }
    const blocks = [];
    for (const c of cats) {
      const other = t.items.filter(i => i.custom && i.catId === c.id).map(i => i.name).join(', ');
      if (c.freeOnly && !other) continue;
      const on = it => picked.get(it.id) || pickedByName.get(`${c.id}|${it.name}`);
      const rows = [];
      const hasUnits = c.items.some(i => i.unit);
      const tpl = hasUnits ? 'A' : 'B';
      const cell = (it, col) => `<span class="cell" style="grid-column:${col}">${CB(!!on(it))}${esc(it.name)}</span>`;
      if (hasUnits) {
        const groups = [];
        for (const it of c.items) {
          const g = groups.at(-1);
          if (g && g.unit === (it.unit || '')) g.items.push(it); else groups.push({ unit: it.unit || '', items: [it] });
        }
        for (const g of groups) {
          for (let i = 0; i < g.items.length; i += 4) {
            let html = g.items.slice(i, i + 4).map((it, j) => cell(it, j + 1)).join('');
            if (g.unit && i === 0) {
              const sum = g.items.reduce((a, it) => a + (on(it)?.qty || 0), 0);
              html += `<span class="cell" style="grid-column:5">จำนวน${G(sum || '')}${esc(g.unit)}</span>`;
            }
            rows.push(html);
          }
        }
        rows.push(`<span class="cell" style="grid-column:1 / -1">${CB(!!other)}อื่นๆ${G(other, 1, 'left')}</span>`);
      } else if (c.freeOnly) {
        rows.push(`<span class="cell" style="grid-column:1 / -1">${CB(true)}${G(other, 1, 'left')}</span>`);
      } else {
        // ชื่อรายการยาว (เช่น เครื่องปรับอากาศ) ใช้ 3 คอลัมน์ ไม่ให้ทับกัน
        // หมวดตามแบบฟอร์มเดิมใช้ 5 คอลัมน์เหมือนกระดาษ หมวดที่เพิ่มภายหลังและชื่อยาวใช้ 3 คอลัมน์
        const cols = c.pdfWhenUsed || Math.max(...c.items.map(i => i.name.length)) > 20 ? 3 : 5;
        let cur = [];
        c.items.forEach(it => { if (cur.length === cols) { rows.push(cur.join('')); cur = []; } cur.push(cell(it, cur.length + 1)); });
        if (cur.length === cols) { rows.push(cur.join('')); cur = []; }
        cur.push(`<span class="cell" style="grid-column:${cur.length + 1} / -1">${CB(!!other)}อื่นๆ${G(other, 1, 'left')}</span>`);
        rows.push(cur.join(''));
        blocks.push({ title: c.name, rows, tpl: cols === 3 ? 'C' : 'B' });
        continue;
      }
      blocks.push({ title: c.name, rows, tpl });
    }
    return blocks;
  }

  // ───────── แบบ A: ทั่วไป / หอพัก ─────────
  function memoA(t, style) {
    const L = LAYOUT.a;
    const dorm = t.formType === 'dorm';
    const loc = t.location || {};
    const blocks = categoryBlocks(t);
    const details = UI.detailsText(t);
    const symLines = Math.min(4, Math.max(1, Math.ceil(details.length / 92)));
    const lines = blocks.reduce((a, b) => a + 1 + b.rows.length, 0) + 1 + symLines;
    const CATS_H = 108.4;
    const lh = Math.max(4.4, Math.min(6.35, CATS_H / lines));
    const fontScale = lh < 5.3 ? lh / 5.3 : 1;
    const insp = t.inspection;
    const failed = t.status === 'cannot_fix';
    const [cd, cm, cy] = dateParts(t.completion?.at || t.cannot?.at);
    const repLine2 = dorm
      ? `<b>สถานที่ซ่อมหอ</b>${G(loc.locationName, 46)}<b>ล็อคนอน</b>${G(loc.zone || loc.lock, 39)}<b>ห้อง</b>${G([loc.room, loc.point].filter(Boolean).join(' '), 41)}`
      : `<b>สถานที่ซ่อม</b>${G(UI.locationText(t).replace(/ · /g, ' '), 1, 'left')}`;
    return `
      <div class="sheet memo-a ${style}" style="--lh:${lh}mm;${fontScale < 1 ? `font-size:${(11.6 * fontScale).toFixed(2)}pt` : ''}">
        ${style === 'plain' ? plainHeader(t, 'a') : memoHeader(t, 'a')}
        <div class="box" style="top:${L.box[0]}mm;left:${L.box[1]}mm;right:${L.box[2]}mm">
          <div class="sec" style="height:19.1mm;padding-top:4.3mm">
            ${ln(`<b>ผู้แจ้งซ่อม</b>${G(t.reporter.name, 61.5)}<b>เบอร์ติดต่อ</b>${G(t.reporter.phone, 35)}<b>เวลาแจ้ง</b>${G(UI.time(t.createdAt), 26.5)}น.`, { l: 7.2 })}
            ${ln(repLine2, { l: 7.2 })}
          </div>
          <div class="sec cats" style="height:${(CATS_H + .2).toFixed(2)}mm">
            ${blocks.map(b => `${ln(`<b>${esc(b.title)}</b>`)}${b.rows.map(r => `<div class="cgrid ${b.tpl}">${r}</div>`).join('')}`).join('')}
            ${ln('<b>ระบุอาการชำรุดตามรายการที่แจ้ง</b>')}
            ${MF('', details, symLines, lh)}
          </div>
          ${approvals(t, { lh: 7.35, sigLeft: 11, sigRight: 19, h: 56.3 })}
          <div class="sec" style="height:38.2mm;padding-top:5.1mm">
            ${ln(`<b>ชื่อผู้ปฏิบัติงาน</b>${G(t.completion?.worker, 1)}<b style="margin-left:.5mm">วันที่</b>${F(cd, 9.6)}/${F(cm, 21.5)}/${F(cy, 14.3)}`, { l: 7.3 })}
            ${ln(`<b>การดำเนินงาน</b><span class="gap"></span><span class="gap"></span>${CB(insp?.result === 'ok')}เรียบร้อยดี<span class="gap"></span>${CB(false)}ยังไม่แล้วเสร็จ<span class="gap"></span>${CB(failed)}ไม่สามารถแก้ไขได้<span class="gap"></span>${CB(false)}อื่นๆ${G('', 1, 'left')}`, { l: 7.3 })}
            ${spacer(4.2)}
            ${ln(`ลงชื่อ${SIG(insp?.by.signature, 54)}`, { l: 7.3, pl: 101 })}
            ${ln(`(${F(insp?.by.name, 55)}) ผู้ตรวจงาน`, { l: 7.3, pl: 98 })}
          </div>
        </div>
        ${notes(t, 'a')}
      </div>`;
  }

  function photoSheet(t) {
    // รูปแยกตามรายการที่แจ้ง แล้วตามด้วยรูปหลังซ่อม
    const groups = [
      ...t.items.map((i, n) => [`รายการที่ ${n + 1}: ${i.name}${i.detail ? ` — ${i.detail}` : ''}`, i.photos]),
      ['รูปประกอบเพิ่มเติม', t.photos], ['รูปหลังซ่อม', t.completion?.photos], ['รูปประกอบกรณีซ่อมไม่ได้', t.cannot?.photos]
    ].filter(g => g[1]?.length);
    if (!groups.length) return '';
    return `
      <div class="sheet photos">
        <h2>ภาพประกอบใบแจ้งซ่อม</h2>
        <div class="meta">เลขที่ ${esc(t.docNo)} · อ้างอิงระบบ ${esc(t.id)} · ${esc(UI.locationText(t))}</div>
        ${groups.map(([h, list]) => `<h3>${esc(h)}</h3><div class="ph-grid">${list.map((p, i) => `<figure><img src="${p}" alt=""><figcaption>ภาพที่ ${i + 1}</figcaption></figure>`).join('')}</div>`).join('')}
      </div>`;
  }

  const sheet = (t, style = 'memo') => memoA(t, style);
  const sheets = (t, withPhotos, style) => sheet(t, style) + (withPhotos ? photoSheet(t) : '');

  // ย่อตัวอักษรในช่องที่ข้อความยาวเกินจุดไข่ปลา ไม่ให้ล้นกรอบ
  function fit(box) {
    $$('.fill > span', box).forEach(sp => {
      sp.style.fontSize = '';
      const room = sp.parentElement.clientWidth, need = sp.offsetWidth;
      if (room > 0 && need > room) sp.style.fontSize = Math.max(55, Math.floor(room / need * 100)) + '%';
    });
  }

  // ดาวน์โหลด PDF จากกลุ่มหน้า A4
  async function downloadPdf(box, filename, btn) {
    if (!window.html2pdf) return UI.toast('โหลดตัวสร้าง PDF ไม่สำเร็จ ใช้ปุ่ม "พิมพ์" แล้วเลือก "บันทึกเป็น PDF" แทน', 'error');
    const label = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = `${icon('refresh')} กำลังสร้าง PDF...`;
    try {
      await document.fonts.ready;
      const clone = box.cloneNode(true);
      clone.style.cssText = 'position:fixed;left:-10000px;top:0;width:210mm;background:#fff;zoom:1';
      $$('.sheet', clone).forEach((s, i, all) => { s.style.margin = '0'; s.style.boxShadow = 'none'; s.style.pageBreakAfter = i < all.length - 1 ? 'always' : 'auto'; });
      document.body.appendChild(clone);
      await html2pdf().set({
        margin: 0, filename, image: { type: 'jpeg', quality: 0.96 },
        html2canvas: { scale: 2.4, useCORS: true, backgroundColor: '#ffffff', logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css'] }
      }).from(clone).save();
      clone.remove();
      UI.toast('ดาวน์โหลด PDF แล้ว');
    } catch (err) {
      console.error(err);
      UI.toast('สร้าง PDF ไม่สำเร็จ ใช้ปุ่ม "พิมพ์" แล้วเลือก "บันทึกเป็น PDF" แทน', 'error');
    } finally { btn.disabled = false; btn.innerHTML = label; }
  }

  // ───────── หน้าแสดงเอกสารรายการเดียว ─────────
  function page(params) {
    const t = Store.ticket(params.id);
    const me = Store.me();
    if (!t) return Pages.notFound();
    if (t.reporter.email !== me.email && !Store.canSee(me, t)) return Pages.forbidden('เอกสารนี้เปิดได้เฉพาะผู้แจ้งซ่อมและเจ้าหน้าที่ที่ดูแลหมวดนี้');
    const hasPhotos = [t.photos, t.completion?.photos, t.cannot?.photos, ...t.items.map(i => i.photos)].some(p => p?.length);
    const final = ['done', 'cannot_fix'].includes(t.status);
    const back = Store.isStaff(me) && Store.canSee(me, t) ? `/admin/job/${t.id}` : `/ticket/${t.id}`;
    const state = { style: params.style === 'plain' ? 'plain' : 'memo', photos: hasPhotos };
    return {
      title: `ใบแจ้งซ่อม ${t.id}`,
      html: `
      <div class="doc-page">
        <div class="doc-toolbar">
          <a class="btn btn-outline btn-sm" href="#${back}">${icon('back')} กลับ</a>
          <div><div class="t">ใบแจ้งซ่อม ${esc(t.id)}</div><div class="sub">${esc(UI.STATUS[t.status].label)} · ข้อมูล ณ ${UI.dateTime(new Date().toISOString())}</div></div>
          <span class="spacer"></span>
          <div class="seg seg-dark" id="styleSeg">
            <button type="button" data-style="memo" class="${state.style === 'memo' ? 'is-active' : ''}">มีตราครุฑ</button>
            <button type="button" data-style="plain" class="${state.style === 'plain' ? 'is-active' : ''}">ไม่มีตราครุฑ</button>
          </div>
          ${hasPhotos ? `<label class="checkbox"><input type="checkbox" id="withPhotos" checked> แนบหน้ารูปภาพ</label>` : ''}
          <button class="btn btn-outline btn-sm" id="printBtn">${icon('printer')} พิมพ์</button>
          <button class="btn btn-primary btn-sm" id="pdfBtn">${icon('download')} ดาวน์โหลด PDF</button>
        </div>
        <div class="doc-stage">
          <div class="doc-hint">${icon(final ? 'checkCircle' : 'clock')}<span>${final ? 'เอกสารฉบับสมบูรณ์ พร้อมลายเซ็นและผลการดำเนินงาน' : 'ลายเซ็นผู้อนุมัติจะปรากฏเมื่อเริ่มดำเนินการซ่อม และผลการซ่อมจะปรากฏเมื่อเสร็จสิ้น'} · ปุ่ม "พิมพ์" ให้คุณภาพคมชัดที่สุด (เลือก "บันทึกเป็น PDF" ได้)</span></div>
          <div id="sheets"></div>
        </div>
      </div>`,
      mount(root) {
        const box = $('#sheets', root);
        const draw = () => { box.innerHTML = sheets(Store.ticket(t.id), state.photos, state.style); fit(box); };
        draw();
        document.fonts?.ready.then(() => fit(box));
        $('#styleSeg', root).addEventListener('click', e => {
          const b = e.target.closest('[data-style]'); if (!b) return;
          state.style = b.dataset.style;
          $$('#styleSeg button', root).forEach(x => x.classList.toggle('is-active', x === b));
          draw();
        });
        $('#withPhotos', root)?.addEventListener('change', e => { state.photos = e.target.checked; draw(); });
        $('#printBtn', root).addEventListener('click', () => window.print());
        $('#pdfBtn', root).addEventListener('click', e => downloadPdf(box, `ใบแจ้งซ่อม-${t.id}.pdf`, e.currentTarget));
        App.onCleanup(Store.subscribe(draw));
      }
    };
  }

  return { page, sheet, sheets, photoSheet, fit, downloadPdf, dateParts };
})();
