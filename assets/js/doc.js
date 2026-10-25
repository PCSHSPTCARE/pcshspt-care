/* ใบขออนุญาตแจ้งซ่อมและบำรุงรักษา — จัดวางตามแบบฟอร์มของโรงเรียน (บท00 ขอแจ้งซ่อมทั่วไป / หอพัก)
   ทั้งสองแบบใช้โครงเดียวกัน ต่างกันที่ "เรื่อง" และผู้พิจารณาช่องซ้าย (หัวหน้างานอาคารฯ / รอง ผอ.ฝ่ายกิจการนักเรียนและหอพัก)
   style 'memo' = บันทึกข้อความมีตราครุฑ · 'plain' = หัวกระดาษตราโรงเรียน (ไม่มีตราครุฑ)
   ตัวเลขทั้งหมดเป็นมิลลิเมตร วัดจากต้นฉบับ (ตำแหน่งบรรทัดหัวเอกสารเป็นจุดกึ่งกลางบรรทัด) */
const Doc = (() => {
  const L = {
    garuda: [23.5, 2.6, 12.5], title: 13.6, rows: [23, 29.8, 36.4, 50.4], left: 23.5, right: 16.2,
    rule: [42.5, 23.5, 20.4], date: 103.8, box: [54.4, 23.5, 16.2],
    sec: { info: 85.2, approve: 50.7, inspect: 76.5 }
  };

  // ───────── ชิ้นส่วนเอกสาร ─────────
  const val = v => (v === 0 || v) ? `<span>${esc(v)}</span>` : '<span><i class="fe"></i></span>';
  const F = (v, w) => `<span class="fill" style="width:${w}mm">${val(v)}</span>`;
  const G = (v, weight = 1, cls = '') => `<span class="fill ${cls}" style="flex:${weight} 1 0">${val(v)}</span>`;
  const SIG = (img, w) => `<span class="fill sig" style="width:${w}mm"><span><i class="fe"></i></span>${img ? `<img src="${img}" alt="">` : ''}</span>`;
  const CB = on => `<span class="cb ${on ? 'on' : ''}"></span>`;
  // ข้อความหลายบรรทัดบนจุดไข่ปลา (ยาวเกินจำนวนบรรทัด → ย่อตัวอักษรลง ไม่ให้ล้นกรอบ)
  const MF = (text, lines, lh, cpl = 92) => {
    const len = String(text || '').length;
    const scale = len > lines * cpl ? Math.max(.6, (lines * cpl) / len) : 1;
    return `
    <div class="mfill" style="--l:${lh}mm;height:${lines * lh}mm">
      ${Array.from({ length: lines }, (_, i) => `<div class="dots" style="top:${i * lh}mm"></div>`).join('')}
      <div class="txt" ${scale < 1 ? `style="font-size:${Math.round(scale * 100)}%;line-height:${(lh / scale).toFixed(2)}mm"` : ''}><span class="v">${esc(text || '')}</span></div>
    </div>`;
  };
  const ln = (html, { l, pl, cls = '' } = {}) => `<div class="ln ${cls}" style="${l ? `--l:${l}mm;` : ''}${pl ? `padding-left:${pl}mm;` : ''}">${html}</div>`;
  const spacer = mm => `<div style="height:${mm}mm"></div>`;
  const GARUDA = () => typeof GARUDA_SRC !== 'undefined' ? GARUDA_SRC : 'images/garuda.png';

  function dateParts(iso) {
    if (!iso) return ['', '', ''];
    const d = new Date(iso);
    return [d.getDate(), UI.TH_MONTHS[d.getMonth()], d.getFullYear() + 543];
  }
  const subjectOf = t => Store.settings().forms[t.formType]?.subject || 'ขออนุญาตแจ้งซ่อมและบำรุงรักษา';

  // ส่วนหัว: บันทึกข้อความ (มีตราครุฑ)
  function memoHeader(t) {
    const s = Store.settings();
    const [no, yr] = String(t.docNo || '').split('/');
    const [dd, mm, yy] = dateParts(t.createdAt);
    return `
      <img class="garuda" src="${GARUDA()}" alt="" style="left:${L.garuda[0]}mm;top:${L.garuda[1]}mm;height:${L.garuda[2]}mm">
      ${s.showRefOnDoc ? `<div class="ref">อ้างอิงระบบ ${esc(t.id)}</div>` : ''}
      <div class="doc-title" style="top:${L.title}mm">บันทึกข้อความ</div>
      <div class="hl" style="top:${L.rows[0]}mm;left:${L.left}mm"><b>ส่วนราชการ</b>${esc(s.schoolName)}</div>
      <div class="hl" style="top:${L.rows[1]}mm;left:${L.left}mm"><b style="margin-right:2mm">ที่</b>${F(no, 9)}/${F(yr, 17)}</div>
      <div class="hl" style="top:${L.rows[1]}mm;left:${L.date}mm"><b style="margin-right:4.5mm">วันที่</b>${F(dd, 11)}/${F(mm, 25)}/${F(yy, 15)}</div>
      <div class="hl" style="top:${L.rows[2]}mm;left:${L.left}mm"><b style="margin-right:2.5mm">เรื่อง</b>${esc(subjectOf(t))}</div>
      <div class="rule" style="top:${L.rule[0]}mm;left:${L.rule[1]}mm;right:${L.rule[2]}mm"></div>
      <div class="hl" style="top:${L.rows[3]}mm;left:${L.left}mm"><b style="margin-right:3.5mm">เรียน</b>${esc(s.addressee)}</div>`;
  }

  // ส่วนหัว: ใบแจ้งซ่อม (ไม่มีตราครุฑ) หัวกระดาษตราโรงเรียน
  function plainHeader(t) {
    const s = Store.settings();
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
      <div class="hl" style="top:${L.rows[3] - 7}mm;left:${L.left}mm"><b style="margin-right:2.5mm">เรื่อง</b>${esc(subjectOf(t))}</div>
      <div class="hl" style="top:${L.rows[3]}mm;left:${L.left}mm"><b style="margin-right:3.5mm">เรียน</b>${esc(s.addressee)}</div>`;
  }

  // ───────── เนื้อหา: 1. รายการ 2. สถานที่ 3. อาการ ─────────
  // รายการ/อุปกรณ์: ชื่อรายการ + จำนวนชิ้นท้ายชื่อ (เช่น "หลอดตะเกียบ 3 หลอด") · รวมจำนวน = จำนวนรายการ
  const itemsText = t => t.items.map(i => i.unit && i.qty ? `${i.name} ${i.qty} ${String(i.unit).split('/')[0]}` : i.name).join(', ');
  const symptomsText = t => [
    ...t.items.filter(i => String(i.detail || '').trim()).map(i => t.items.length > 1 ? `${i.name}: ${i.detail}` : i.detail),
    t.note ? `หมายเหตุ: ${t.note}` : ''
  ].filter(Boolean).join(' · ');

  function infoSection(t) {
    const r = t.reporter || {};
    const lh = L.sec.info / 13;
    const IN = 13; // ระยะย่อหน้ารายการย่อย
    return `
      <div class="sec" style="height:${L.sec.info}mm;--l:${lh}mm">
        ${ln(`ด้วยข้าพเจ้า${G(r.name, 1.25)}ตำแหน่ง${G(r.position, 1)}`)}
        ${ln(`กลุ่มงาน/กลุ่มสาระฯ${G(r.dept, 1.15)}เบอร์ติดต่อ${G(r.phone, 1)}`)}
        ${ln('มีความประสงค์ขอแจ้งซ่อมแซม/บำรุงรักษา เนื่องจากตรวจพบการชำรุดหรือขัดข้อง โดยมีรายละเอียดดังนี้')}
        ${ln('1. รายการที่แจ้งซ่อม')}
        ${ln(`รายการ/อุปกรณ์${G(itemsText(t), 1, 'left')}`, { pl: IN })}
        ${ln(`รวมจำนวน${F(t.items.length, 46)}รายการ`, { pl: IN })}
        ${ln('2. สถานที่')}
        <div style="padding-left:${IN}mm">${MF(UI.locationText(t), 2, lh, 84)}</div>
        ${ln('3. ลักษณะการชำรุด/อาการที่พบ')}
        <div style="padding-left:${IN}mm">${MF(symptomsText(t), 3, lh, 84)}</div>
      </div>`;
  }

  // ───────── ผู้พิจารณา 2 คอลัมน์ (ลงลายเซ็นอัตโนมัติเมื่อเริ่มดำเนินการ) ─────────
  function approvals(t) {
    const lh = 6.9; // 7 บรรทัด + ช่องว่างก่อนลายเซ็น = ความสูงช่องพอดี

    const k1 = Store.step1Key(t), k2 = Store.STEP2_KEY;
    const a1 = t.approvals?.step1, a2 = t.approvals?.step2;
    const p1 = a1?.by || Store.signer(k1), p2 = a2?.by || Store.signer(k2);
    const head = title => ln(`<b style="${String(title || '').length > 42 ? 'font-size:91%' : ''}">${esc(title)}</b>`, { l: lh });
    const sigBlock = (sig, name, title) => `
      <div class="sigblk">
        ${ln(`ลงชื่อ${SIG(sig, 44)}`, { l: lh, cls: 'center' })}
        ${ln(name ? `(${esc(name)})` : `(${F('', 42)})`, { l: lh, cls: 'center' })}
        ${ln(`<span style="${String(title || '').length > 42 ? 'font-size:91%' : ''}">${esc(title)}</span>`, { l: lh, cls: 'center' })}
      </div>`;
    return `
      <div class="sec two" style="height:${L.sec.approve}mm;padding:0;grid-template-columns:84.9mm 1fr">
        <div>
          ${head(p1.title)}
          ${ln(`${CB(!!a1)}เห็นควรพิจารณาอนุญาตดำเนินการ`, { l: lh })}
          ${ln(`${CB(false)}ไม่อนุญาต เนื่องจาก`, { l: lh })}
          ${MF('', 1, lh)}
          ${spacer(2.4)}
          ${sigBlock(a1?.by.signature, p1.name, p1.title)}
        </div>
        <div>
          ${head(p2.title)}
          ${ln('พิจารณา/สั่งการ', { l: lh })}
          ${MF(a2?.note || '', 2, lh, 44)}
          ${spacer(2.4)}
          ${sigBlock(a2?.by.signature, p2.name, p2.title)}
        </div>
      </div>`;
  }

  // ───────── ผู้ตรวจงาน: ติ๊กเมื่อปิดงานแล้วเท่านั้น (เสร็จสิ้น / ซ่อมไม่ได้) ─────────
  function inspection(t) {
    const lh = 6.6;
    const insp = t.inspection;
    const done = t.status === 'done', cannot = t.status === 'cannot_fix';
    const [dd, mm, yy] = dateParts(insp?.at || t.completion?.at || t.cannot?.at);
    // บันทึกผลการซ่อมในพื้นที่ว่างของช่อง (เฉพาะงานที่ปิดแล้ว)
    const remarks = done ? [t.completion?.worker && `ผู้ปฏิบัติงาน: ${t.completion.worker}`, t.completion?.note && `ผลการซ่อม: ${t.completion.note}`]
      : cannot ? [t.cannot?.reason && `เหตุผลที่ซ่อมไม่ได้: ${t.cannot.reason}`, t.cannot?.note && `รายละเอียด: ${t.cannot.note}`] : [];
    const rem = remarks.filter(Boolean);
    return `
      <div class="sec" style="height:${L.sec.inspect}mm;--l:${lh}mm">
        ${ln('<b>ผู้ตรวจงาน</b>')}
        ${ln(`<b>การดำเนินงาน</b><span class="gap"></span>${CB(done)}เรียบร้อยดี<span class="gap"></span>${CB(false)}ยังไม่แล้วเสร็จ<span class="gap"></span>${CB(cannot)}ไม่สามารถแก้ไขได้<span class="gap"></span>${CB(false)}อื่นๆ${G('', 1, 'left')}`)}
        <div class="remarks" style="height:33mm;padding:2.5mm 0 0 2mm">${rem.map(x => `<div>${esc(x)}</div>`).join('')}</div>
        ${ln(`ลงชื่อ${SIG(insp?.by.signature, 48)}ผู้ตรวจงาน`, { pl: 93 })}
        ${ln(`(${F(insp?.by.name, 50)})`, { pl: 92 })}
        ${ln(`วันที่${F(dd, 11)}/${F(mm, 22)}/${F(yy, 13)}`, { pl: 92 })}
      </div>`;
  }

  function memo(t, style) {
    return `
      <div class="sheet memo ${style}">
        ${style === 'plain' ? plainHeader(t) : memoHeader(t)}
        <div class="box" style="top:${L.box[0]}mm;left:${L.box[1]}mm;right:${L.box[2]}mm">
          ${infoSection(t)}
          ${approvals(t)}
          ${inspection(t)}
        </div>
      </div>`;
  }

  // หน้าภาพประกอบ: หน้าละ 4 รูป (2×2 รูปละ ~1/4 หน้า) แสดงเต็มภาพไม่ตัดขอบ · รูปตอนแจ้งก่อน แล้วต่อด้วยรูปหลังซ่อม (มีป้ายกำกับ)
  function photoSheet(t) {
    const PER_PAGE = 4;
    const groups = [
      ...t.items.map((i, n) => ['before', `รายการที่ ${n + 1}: ${i.name}${i.detail ? ` — ${i.detail}` : ''}`, i.photos]),
      ['before', 'รูปประกอบเพิ่มเติม', t.photos],
      ['after', 'รูปหลังซ่อม', t.completion?.photos], ['after', 'รูปประกอบกรณีซ่อมไม่ได้', t.cannot?.photos]
    ];
    const tag = { before: 'ก่อนซ่อม (ตอนแจ้ง)', after: 'หลังซ่อม' };
    const all = groups.flatMap(([phase, label, list]) => (list || []).map((src, i) => ({ phase, label, src, n: i + 1, of: list.length })));
    if (!all.length) return '';
    const pages = [];
    for (let i = 0; i < all.length; i += PER_PAGE) pages.push(all.slice(i, i + PER_PAGE));
    return pages.map((list, p) => `
      <div class="sheet photos">
        <h2>ภาพประกอบใบแจ้งซ่อม${pages.length > 1 ? ` <span class="ph-pg">(หน้า ${p + 1}/${pages.length})</span>` : ''}</h2>
        <div class="meta">เลขที่ ${esc(t.docNo)} · อ้างอิงระบบ ${esc(t.id)} · ${esc(UI.locationText(t))}</div>
        <div class="ph-grid">${list.map(ph => `
          <figure class="ph-${ph.phase}">
            <div class="ph-frame"><img ${Store.img(ph.src)} alt=""></div>
            <figcaption><span class="ph-tag">${tag[ph.phase]}</span> ${esc(ph.label)}${ph.of > 1 ? ` · ภาพที่ ${ph.n}/${ph.of}` : ''}</figcaption>
          </figure>`).join('')}</div>
      </div>`).join('');
  }

  const sheet = (t, style = 'memo') => memo(t, style);
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
