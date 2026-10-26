/* ตัวช่วยหน้าจอที่ใช้ร่วมกันทุกหน้า */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const UI = (() => {
  // ───────── สถานะและความเร่งด่วน ─────────
  // ลำดับ: รออนุมัติ → กำลังดำเนินการซ่อม / รอพิจารณา → เสร็จสิ้น / ไม่สามารถซ่อมได้
  const STATUS = {
    pending: { label: 'รออนุมัติ', short: 'รออนุมัติ', tone: 'amber', icon: 'clock', color: '#F59E0B' },
    in_progress: { label: 'กำลังดำเนินการซ่อม', short: 'กำลังซ่อม', tone: 'orange', icon: 'wrench', color: '#EA580C' },
    review: { label: 'รอพิจารณา', short: 'รอพิจารณา', tone: 'indigo', icon: 'hourglass', color: '#4F46E5' },
    done: { label: 'เสร็จสิ้น', short: 'เสร็จสิ้น', tone: 'green', icon: 'checkCircle', color: '#16A34A' },
    cannot_fix: { label: 'ไม่สามารถซ่อมได้', short: 'ซ่อมไม่ได้', tone: 'rose', icon: 'x', color: '#E11D48' },
    cancelled: { label: 'ยกเลิกโดยผู้แจ้ง', short: 'ยกเลิก', tone: 'slate', icon: 'close', color: '#94A3B8' }
  };
  const STATUS_KEYS = Object.keys(STATUS);
  const OPEN = ['pending', 'in_progress', 'review'];
  const FORM_ICON = { general: 'building', dorm: 'bed', aircon: 'aircon' };

  const statusBadge = s => {
    const m = STATUS[s] || { label: s, tone: 'slate', icon: 'more' };
    return `<span class="badge tone-${m.tone}">${icon(m.icon)}${esc(m.label)}</span>`;
  };

  // ───────── วันที่ (ปฏิทินไทย พ.ศ.) ─────────
  const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const TH_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const pad = n => String(n).padStart(2, '0');
  const date = iso => { if (!iso) return '-'; const d = new Date(iso); return `${d.getDate()} ${TH_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`; };
  const dateLong = iso => { if (!iso) return '-'; const d = new Date(iso); return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`; };
  const time = iso => { if (!iso) return ''; const d = new Date(iso); return `${pad(d.getHours())}.${pad(d.getMinutes())}`; };
  const dateTime = iso => iso ? `${date(iso)} ${time(iso)} น.` : '-';
  function ago(iso) {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return 'เมื่อสักครู่';
    if (s < 3600) return `${Math.floor(s / 60)} นาทีที่แล้ว`;
    if (s < 86400) return `${Math.floor(s / 3600)} ชั่วโมงที่แล้ว`;
    if (s < 86400 * 30) return `${Math.floor(s / 86400)} วันที่แล้ว`;
    return date(iso);
  }
  const money = n => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const num = n => Number(n || 0).toLocaleString('th-TH');

  // จำนวนเงินเป็นตัวหนังสือ (บาทถ้วน)
  function bahtText(amount) {
    const digits = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
    const places = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];
    const readSix = (s, hasHigher) => {
      s = s.replace(/^0+/, '');
      let out = '';
      for (let i = 0; i < s.length; i++) {
        const d = +s[i], p = s.length - i - 1;
        if (!d) continue;
        if (p === 0 && d === 1 && (s.length > 1 || hasHigher)) out += 'เอ็ด';
        else if (p === 1 && d === 2) out += 'ยี่';
        else if (p === 1 && d === 1) out += '';
        else out += digits[d];
        out += places[p];
      }
      return out;
    };
    const read = s => {
      if (s.length > 6) {
        const high = s.slice(0, -6);
        return read(high) + 'ล้าน' + readSix(s.slice(-6), /[1-9]/.test(high));
      }
      return readSix(s, false);
    };
    const n = Math.round(Number(amount || 0) * 100) / 100;
    const [i, f] = n.toFixed(2).split('.');
    const baht = +i === 0 ? 'ศูนย์' : read(i);
    return baht + 'บาท' + (+f === 0 ? 'ถ้วน' : readSix(f, false) + 'สตางค์');
  }

  // ───────── การแจ้งเตือนแบบป๊อปอัป ─────────
  function toast(message, kind = 'success') {
    let host = $('#toasts');
    if (!host) { host = document.createElement('div'); host.id = 'toasts'; host.setAttribute('aria-live', 'polite'); document.body.appendChild(host); }
    const el = document.createElement('div');
    el.className = `toast toast-${kind}`;
    el.innerHTML = `${icon(kind === 'error' ? 'alert' : kind === 'info' ? 'bell' : 'checkCircle')}<span>${esc(message)}</span>`;
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, kind === 'error' ? 5200 : 3200);
  }

  // ───────── หน้าต่างโมดัล ─────────
  function modal({ title, subtitle = '', body = '', size = 'md', actions = [], onOpen, onClose }) {
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = `
      <div class="modal modal-${size}" role="dialog" aria-modal="true" aria-labelledby="mdl-title">
        <header class="modal-head">
          <div><h3 id="mdl-title">${esc(title)}</h3>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>
          <button class="icon-btn" data-close aria-label="ปิด">${icon('close')}</button>
        </header>
        <div class="modal-body">${body}</div>
        ${actions.length ? `<footer class="modal-foot">${actions.map((a, i) => `<button class="btn ${a.kind || 'btn-outline'}" data-act="${i}">${a.icon ? icon(a.icon) : ''}${esc(a.label)}</button>`).join('')}</footer>` : ''}
      </div>`;
    document.body.appendChild(wrap);
    document.body.classList.add('modal-open');
    requestAnimationFrame(() => wrap.classList.add('show'));
    const close = () => {
      onClose?.();
      wrap.classList.remove('show');
      document.removeEventListener('keydown', onKey);
      setTimeout(() => { wrap.remove(); if (!$('.modal-backdrop')) document.body.classList.remove('modal-open'); }, 200);
    };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('mousedown', e => { if (e.target === wrap) close(); });
    $$('[data-close]', wrap).forEach(b => b.addEventListener('click', close));
    const api = { el: wrap, close, body: $('.modal-body', wrap) };
    $$('[data-act]', wrap).forEach(b => b.addEventListener('click', async () => {
      const a = actions[+b.dataset.act];
      if (!a.onClick) return close();
      b.disabled = true;
      try { const keep = await a.onClick(api); if (keep !== false) close(); }
      catch (err) { toast(err.message || String(err), 'error'); }
      finally { b.disabled = false; }
    }));
    onOpen?.(api);
    setTimeout(() => ($('input,textarea,select', api.body) || $('[data-act]', wrap))?.focus(), 60);
    return api;
  }

  // ───────── รอประมวลผล: นาฬิกาทรายพลิก + ขั้นตอนจริง (ปิดหรือกดซ้ำระหว่างรอไม่ได้) ─────────
  const HOURGLASS = `<svg class="hg" viewBox="0 0 64 80" aria-hidden="true">
    <defs><clipPath id="hgTop"><path d="M15 10h34c0 13-9 19-15 27h-4c-6-8-15-14-15-27z"/></clipPath><clipPath id="hgBot"><path d="M30 43h4c6 8 15 14 15 27H15c0-13 9-19 15-27z"/></clipPath></defs>
    <g clip-path="url(#hgTop)"><rect class="hg-top" x="12" y="12" width="40" height="26"/></g>
    <g clip-path="url(#hgBot)"><rect class="hg-bot" x="12" y="44" width="40" height="27"/></g>
    <line class="hg-stream" x1="32" y1="37" x2="32" y2="69"/>
    <path class="hg-glass" d="M15 10h34c0 13-9 19-15 30c6 11 15 17 15 30H15c0-13 9-19 15-30C24 29 15 23 15 10z"/>
    <rect class="hg-cap" x="9" y="4" width="46" height="6" rx="3"/><rect class="hg-cap" x="9" y="70" width="46" height="6" rx="3"/>
  </svg>`;
  const CHECK = '<svg class="busy-check" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="27"/><path d="M19 33l9 9 18-19"/></svg>';
  function busy({ title = 'กำลังดำเนินการ', steps = [], note = 'กรุณาอย่าปิดหรือรีเฟรชหน้านี้' } = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'busy-backdrop';
    wrap.setAttribute('role', 'alertdialog');
    wrap.setAttribute('aria-busy', 'true');
    wrap.setAttribute('aria-label', title);
    wrap.innerHTML = `
      <div class="busy-card" aria-live="polite">
        <div class="busy-ic">${HOURGLASS}</div>
        <strong class="busy-title">${esc(title)}</strong>
        ${steps.length ? `<ol class="busy-steps">${steps.map(s => `<li><span class="bs-dot"></span><span>${esc(s)}</span></li>`).join('')}</ol>` : ''}
        <div class="busy-bar"><i></i></div>
        <small class="busy-note">${esc(note)}</small>
      </div>`;
    document.body.appendChild(wrap);
    document.body.classList.add('modal-open');
    document.activeElement?.blur?.();
    requestAnimationFrame(() => wrap.classList.add('show'));
    let cur = -1;
    const bar = p => { $('.busy-bar i', wrap).style.width = Math.round(p * 100) + '%'; };
    bar(.08);
    const close = () => {
      wrap.classList.remove('show');
      setTimeout(() => { wrap.remove(); if (!$('.modal-backdrop, .busy-backdrop')) document.body.classList.remove('modal-open'); }, 220);
    };
    return {
      step(i) {
        if (i <= cur) return;
        cur = i;
        $$('.busy-steps li', wrap).forEach((li, j) => { li.className = j < i ? 'done' : j === i ? 'now' : ''; });
        bar(steps.length ? Math.min(.95, (i + .6) / steps.length) : .6);
      },
      // สำเร็จ: เครื่องหมายถูกวาดตัวเองครู่หนึ่ง แล้วปิด
      async done(msg = 'สำเร็จ') {
        $$('.busy-steps li', wrap).forEach(li => { li.className = 'done'; });
        bar(1);
        $('.busy-ic', wrap).innerHTML = CHECK;
        $('.busy-title', wrap).textContent = msg;
        $('.busy-note', wrap).textContent = '';
        wrap.classList.add('is-done');
        await new Promise(r => setTimeout(r, 900));
        close();
      },
      close
    };
  }

  // ───────── หน้าขอบคุณหลังประเมิน: ดาว 5 ดวงเด้งขึ้นทีละดวง + ประกาย ─────────
  function thanks({ title, text = '', actions = [], autoClose = 2600 } = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'busy-backdrop thanks';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', title);
    const star = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/></svg>';
    wrap.innerHTML = `
      <div class="busy-card">
        <div class="ty-stars">${[0, 1, 2, 3, 4].map(i => `<span style="--i:${i}">${star}</span>`).join('')}
          ${Array.from({ length: 10 }, (_, i) => `<i class="ty-spark" style="--a:${i * 36}deg;--d:${i % 2 ? 46 : 62}px"></i>`).join('')}</div>
        <div class="busy-ic">${CHECK}</div>
        <strong class="busy-title">${esc(title)}</strong>
        ${text ? `<p class="ty-text">${esc(text)}</p>` : ''}
        <div class="ty-actions">${actions.map((a, i) => `<button type="button" class="btn ${a.kind || 'btn-outline'}" data-ty="${i}">${esc(a.label)}</button>`).join('')}</div>
      </div>`;
    document.body.appendChild(wrap);
    document.body.classList.add('modal-open');
    requestAnimationFrame(() => wrap.classList.add('show', 'is-done'));
    let timer = null;
    const close = () => {
      clearTimeout(timer);
      wrap.classList.remove('show');
      setTimeout(() => { wrap.remove(); if (!$('.modal-backdrop, .busy-backdrop')) document.body.classList.remove('modal-open'); }, 220);
    };
    wrap.addEventListener('click', e => {
      const b = e.target.closest('[data-ty]');
      if (b) { close(); actions[+b.dataset.ty].onClick?.(); return; }
      if (e.target === wrap) close();
    });
    // มีปุ่มให้กดต่อ = ไม่ปิดเอง
    if (autoClose && !actions.some(a => a.keep)) timer = setTimeout(close, autoClose);
    return { close };
  }

  const confirm = (message, { title = 'ยืนยันการทำรายการ', okLabel = 'ยืนยัน', cancelLabel = 'ยกเลิก', danger = false } = {}) => new Promise(res => {
    // ปิดหน้าต่างด้วยกากบาท / Esc / คลิกนอกกรอบ = ยกเลิก
    modal({ title, size: 'sm', body: `<p class="muted">${esc(message)}</p>`, onClose: () => res(false), actions: [
      { label: cancelLabel, kind: 'btn-ghost-dark', onClick: () => res(false) },
      { label: okLabel, kind: danger ? 'btn-danger' : 'btn-primary', onClick: () => res(true) }
    ] });
  });

  // ───────── รูปภาพ ─────────
  // ย่อรูปก่อนอัปโหลด: ด้านยาวสุด 1000px คุณภาพ JPEG 68% (ประมาณ 100–150 KB ต่อรูป ยังชัดพอสำหรับงานซ่อมและ PDF)
  function compressImage(file, max = 1000, quality = 0.68) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) return reject(new Error('รองรับเฉพาะไฟล์รูปภาพ'));
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('อ่านไฟล์รูปไม่ได้')); };
      img.src = url;
    });
  }

  // ช่องแนบรูปหลายรูป: คืนค่า { get() }
  function photoInput(host, { max = 6, initial = [], hint = 'ลากรูปมาวาง หรือกดเพื่อเลือก / ถ่ายรูป' } = {}) {
    let photos = [...initial];
    host.classList.add('photo-input');
    const render = () => {
      host.innerHTML = `
        <label class="dropzone ${photos.length >= max ? 'is-full' : ''}">
          <input type="file" accept="image/*" multiple hidden>
          <span class="dz-icon">${icon('camera')}</span>
          <span class="dz-text"><strong>${esc(hint)}</strong><small>JPG / PNG สูงสุด ${max} รูป ระบบย่อขนาดให้อัตโนมัติ</small></span>
        </label>
        ${photos.length ? `<div class="thumbs">${photos.map((p, i) => `
          <figure class="thumb"><img src="${p}" alt="รูปที่ ${i + 1}"><button type="button" class="thumb-x" data-i="${i}" aria-label="ลบรูปที่ ${i + 1}">${icon('close')}</button></figure>`).join('')}</div>` : ''}`;
      const input = $('input', host);
      input.addEventListener('change', () => add(input.files));
      $$('.thumb-x', host).forEach(b => b.addEventListener('click', () => { photos.splice(+b.dataset.i, 1); render(); }));
    };
    async function add(files) {
      for (const f of [...files].slice(0, max - photos.length)) {
        try { photos.push(await compressImage(f)); } catch (e) { toast(e.message, 'error'); }
      }
      render();
    }
    host.addEventListener('dragover', e => { e.preventDefault(); host.classList.add('drag'); });
    host.addEventListener('dragleave', () => host.classList.remove('drag'));
    host.addEventListener('drop', e => { e.preventDefault(); host.classList.remove('drag'); add(e.dataTransfer.files); });
    render();
    return { get: () => photos };
  }

  // ดูรูปขนาดใหญ่
  function lightbox(src) {
    modal({ title: 'รูปภาพ', size: 'lg', body: `<img src="${src}" alt="" style="width:100%;border-radius:14px">` });
  }

  // ───────── ช่องเซ็นชื่อบนจอ ─────────
  function signaturePad(canvas) {
    const ctx = canvas.getContext('2d');
    let drawing = false, dirty = false, last = null;
    const fit = () => {
      const r = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = r.width * ratio; canvas.height = r.height * ratio;
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1b2a8a';
    };
    fit();
    const pos = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    canvas.addEventListener('pointerdown', e => { drawing = true; last = pos(e); canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => {
      if (!drawing) return;
      const p = pos(e);
      ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      last = p; dirty = true;
    });
    const end = () => { drawing = false; };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    return {
      clear() { ctx.clearRect(0, 0, canvas.width, canvas.height); dirty = false; },
      isEmpty: () => !dirty,
      toDataURL: () => canvas.toDataURL('image/png')
    };
  }

  // ───────── อื่น ๆ ─────────
  const initials = name => {
    const clean = String(name || '').replace(/^(นาย|นางสาว|นาง|ดร\.|ว่าที่ร้อยตรี)/, '').trim();
    return clean.replace(/^[เแโใไ]/, '').slice(0, 1) || '?';
  };
  const avatar = (name, photo, cls = '') => photo
    ? `<span class="avatar ${cls}"><img src="${photo}" alt=""></span>`
    : `<span class="avatar ${cls}">${esc(initials(name))}</span>`;

  function locationText(t) {
    const l = t.location || t || {};
    const room = l.room && (/^\d|\//.test(l.room) ? `ห้อง ${l.room}` : l.room);
    return [l.locationName, l.zone || l.lock, room, l.point].filter(Boolean).join(' · ');
  }
  function itemsText(t) {
    return t.items.map(i => `${i.name}${i.qty ? ` ×${i.qty}` : ''}${i.detail ? ` (${i.detail})` : ''}`).join(', ') || '-';
  }
  // ข้อความ "ระบุอาการชำรุด" ของทุกรายการ เช่น 1) นีออนยาว: ไฟกะพริบ  2) ...
  function detailsText(t) {
    const parts = t.items.map((i, n) => `${t.items.length > 1 ? `${n + 1}) ` : ''}${i.name}${i.detail ? `: ${i.detail}` : ''}`);
    if (t.note) parts.push(`หมายเหตุ: ${t.note}`);
    return parts.join('  ');
  }

  function download(filename, text, type = 'text/csv;charset=utf-8') {
    const blob = new Blob(['﻿' + text], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const csv = rows => rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');

  // แสดงตัวเลขแบบนับขึ้น
  function countUp(root = document) {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    $$('[data-count]', root).forEach(el => {
      const target = parseFloat(el.dataset.count) || 0;
      const dec = +(el.dataset.decimals || 0);
      if (reduce) { el.textContent = target.toLocaleString('th-TH', { minimumFractionDigits: dec, maximumFractionDigits: dec }); return; }
      const start = performance.now(), dur = 1000;
      const tick = now => {
        const p = Math.min((now - start) / dur, 1), e = 1 - Math.pow(1 - p, 3);
        el.textContent = (target * e).toLocaleString('th-TH', { minimumFractionDigits: dec, maximumFractionDigits: dec });
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  function reveal(root = document) {
    const els = $$('.reveal:not(.is-visible)', root);
    if (!('IntersectionObserver' in window)) return els.forEach(e => e.classList.add('is-visible'));
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-visible');
      countUp(en.target);
      io.unobserve(en.target);
    }), { threshold: 0.15 });
    els.forEach(e => io.observe(e));
  }

  return {
    STATUS, STATUS_KEYS, OPEN, FORM_ICON, TH_MONTHS, TH_MONTHS_SHORT,
    statusBadge, date, dateLong, time, dateTime, ago, money, num, bahtText,
    toast, modal, confirm, busy, thanks, compressImage, photoInput, lightbox, signaturePad,
    avatar, initials, locationText, itemsText, detailsText, download, csv, countUp, reveal
  };
})();
