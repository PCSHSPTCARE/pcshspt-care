/* ชั้นข้อมูลของระบบ
   - ระบบจริง (เปิดผ่านเว็บ): Firebase Firestore + ล็อกอิน Google · รูปเก็บใน Google Drive ผ่าน Apps Script
   - ทดลองในเครื่อง (file:// หรือ ?local): เก็บข้อมูลจำลองไว้ใน localStorage
   หน้าจออื่นทั้งหมดเรียกผ่าน Store.* เท่านั้น ข้อมูลในหน่วยความจำ (db) มีรูปแบบเดียวกันทั้งสองโหมด */
const Store = (() => {
  const DB_KEY = 'pcshs-repair-db-v5';
  const SESSION_KEY = 'pcshs-repair-session-v1';
  const listeners = new Set();
  const CFG = (typeof window !== 'undefined' && window.APP_CONFIG) || {};
  const CLOUD = !!(CFG.firebase && typeof firebase !== 'undefined' && typeof location !== 'undefined'
    && /^https?:$/.test(location.protocol) && !/[?&]local\b/.test(location.search));

  // ───────── ค่าคงที่ ─────────
  const FORM_KEYS = ['general', 'dorm'];
  // ผู้ลงนามช่องที่ 1 ตามแบบฟอร์ม · ช่องที่ 2 เป็นรอง ผอ.ฝ่ายบริหารงานทั่วไปเสมอ
  const STEP1_KEY = { general: 'head_building', dorm: 'deputy_student' };
  const STEP2_KEY = 'deputy_general';
  // สถานะที่กดเปลี่ยนได้ (รออนุมัติเป็นสถานะเริ่มต้นเท่านั้น)
  const ACTIONS = ['in_progress', 'review', 'done', 'cannot_fix'];
  const CONFIG_VERSION = 5;

  // ───────── ตัวช่วย ─────────
  const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9);
  const nowISO = () => new Date().toISOString();
  const clone = o => JSON.parse(JSON.stringify(o));
  const beYear = d => new Date(d).getFullYear() + 543;

  function rng(seed) {
    return () => {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ลายเซ็นตัวอย่าง (เส้นหมึกน้ำเงิน) สำหรับข้อมูลทดลอง
  function makeSignature(seedStr) {
    let h = 7; for (const c of seedStr) h = (h * 31 + c.charCodeAt(0)) | 0;
    const r = rng(h);
    let x = 18, d = `M 10 ${42 + r() * 10}`;
    for (let i = 0; i < 6; i++) {
      const nx = x + 20 + r() * 22;
      d += ` C ${x + 6} ${4 + r() * 18}, ${nx - 10} ${58 + r() * 14}, ${nx} ${22 + r() * 26}`;
      x = nx;
    }
    d += ` M 14 ${60 + r() * 5} Q ${x / 2} ${46 + r() * 10} ${x + 12} ${55 + r() * 6}`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.round(x + 30)} 76"><path d="${d}" fill="none" stroke="#1b2a8a" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    return 'data:image/svg+xml;base64,' + btoa(svg);
  }

  // ───────── ข้อมูลเริ่มต้น ─────────
  function seedCategories() {
    // forms ของรายการ (ถ้ามี) = แสดงเฉพาะแบบฟอร์มนั้น · ไม่มี = แสดงทุกแบบฟอร์มของหมวด
    const it = (name, unit, forms) => ({ id: uid('it'), name, ...(unit ? { unit } : {}), ...(forms ? { forms } : {}) });
    const DORM = ['dorm'], GEN = ['general'];
    return [
      { id: 'elec', name: 'งานไฟฟ้า', icon: 'zap', forms: ['general', 'dorm'], active: true, items: [
        it('นีออนสั้น', 'หลอด/ดวง'), it('นีออนยาว', 'หลอด/ดวง'), it('หลอดตะเกียบ', 'หลอด/ดวง'), it('หลอดสปอตไลท์', 'หลอด/ดวง'),
        it('พัดลมเพดาน', 'ตัว'), it('พัดลมผนัง', 'ตัว'), it('ปลั๊ก', 'จุด', DORM)] },
      { id: 'plumb', name: 'งานประปา', icon: 'droplet', forms: ['general', 'dorm'], active: true, items: [
        it('ก๊อกสนาม', 'ตัว'), it('ก๊อกซิ้งค์', 'ตัว'), it('ก๊อกอ่าง', 'ตัว'), it('สายชำระ', 'เส้น'), it('สายน้ำดี', 'เส้น'), it('สะดืออ่าง', 'ชิ้น'), it('โถปัสสาวะ', 'ชุด'), it('โถชักโครก', 'ชุด'),
        it('ฝาชักโครก', 'ชิ้น', DORM), it('ฝักบัว', 'ชุด', DORM), it('อ่างล้างมือ', 'ชุด', DORM)] },
      { id: 'wood', name: 'งานไม้', icon: 'hammer', forms: ['general', 'dorm'], active: true, items: [
        it('ประตู', 'บาน'), it('หน้าต่าง', 'บาน'), it('โต๊ะ/ตู้/กระดาน', 'ตัว', GEN), it('กลอนประตู', 'ตัว'), it('กุญแจลิ้นชัก', 'ตัว'), it('บานพับ', 'ตัว'), it('สายยู', 'ตัว'), it('ลูกบิดประตู', 'ตัว'), it('เตียง', 'หลัง', DORM)] },
      { id: 'alu', name: 'งานอลูมิเนียม+กระจก', icon: 'window', forms: ['general', 'dorm'], active: true, items: [
        it('ประตูบานสวิง', 'บาน'), it('ประตูบานเลื่อน', 'บาน'), it('หน้าต่างบานเลื่อน', 'บาน'), it('หน้าต่างบานเปิด-ปิด', 'บาน'), it('มือจับประตู', 'ตัว')] },
      // เครื่องเสียง / ทีวี / แอร์: รายการเป็น "อาการ" ไม่ใช่ของที่นับเป็นชิ้น จึงไม่มีหน่วยนับ
      { id: 'sound', name: 'เครื่องเสียง', icon: 'speaker', forms: ['general', 'dorm'], active: true, items: [
        it('เสียงขาดหาย'), it('เปิดไม่ติด')] },
      { id: 'tv', name: 'จอทีวี/โปรเจคเตอร์', icon: 'monitor', forms: ['general'], active: true, items: [
        it('เอียง/หลุด'), it('เปิดไม่ติด')] },
      // แสดงในใบแจ้งซ่อม PDF เฉพาะเมื่อมีการเลือก (ไม่มีในแบบฟอร์มกระดาษเดิม)
      { id: 'ac', name: 'เครื่องปรับอากาศ', icon: 'aircon', forms: ['general', 'dorm'], active: true, pdfWhenUsed: true, items: [
        it('ไม่เย็น/เย็นน้อย'), it('น้ำหยด/น้ำรั่ว'), it('มีเสียงดังผิดปกติ'), it('เปิดไม่ติด'), it('มีกลิ่นอับ'), it('รีโมทเสีย/ไม่ตอบสนอง'), it('ขอล้างทำความสะอาด')] },
      { id: 'other', name: 'อื่น ๆ', icon: 'more', forms: ['general', 'dorm'], active: true, freeOnly: true, items: [] }
    ];
  }

  // สถานที่: { name, type, group, zones: [{ name, rooms: [] }] } · zones ว่าง = เลือกทั้งสถานที่
  function seedLocations() {
    const L = (type, group, name, zones = []) => ({ id: uid('loc'), name, type, group, zones, active: true });
    const nums = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => String(a + i));
    const lockZones = () => Array.from({ length: 6 }, (_, i) => ({ name: `ล็อค ${i + 1}`, rooms: [1, 2, 3].map(r => `${i + 1}/${r}`) }));
    const teacher = floors => ({ name: 'ห้องพักครู', rooms: floors.map(f => `ชั้น ${f}`) });
    const COMMON = ['ห้อง Study', 'ห้องประชุม (รับ-ส่งนักเรียน)'];
    const B = (group, names) => names.map(n => Array.isArray(n) ? L('building', group, n[0], n[1]) : L('building', group, n));
    return [
      ...B('ห้องประชุม / หอประชุม', ['บรรยายรวม', 'หอประชุม 1', 'หอประชุม 2', 'ห้องประชุมพระยาสุรินทร์', 'ห้องประชุมแคแสด', 'ห้องประชุมสุวรรณภูมิ',
        'ห้อง TJ ชั้น 1 (ติดองค์พระ)', 'ห้อง TJ ชั้น 1 (ตรงกลาง)', 'ห้อง TJ ชั้น 1 (ห้องยาว)', 'ห้อง TJ ชั้น 2']),
      ...B('สถานที่อื่น ๆ', ['โรงอาหาร', 'โรงยิมชั้น 1', 'โรงยิมชั้น 2', 'โดมอเนกประสงค์',
        ['หอสมุด', [{ name: '', rooms: ['ชั้น 1', 'ชั้น 2', 'ชั้น 3'] }]], 'เรือนพยาบาล', 'ห้องฟิตเนส', 'มินิมาร์ท', 'เดอะ ศาลา']),
      ...[[1, 4], [2, 4], [3, 4], [4, 6], [5, 6], [6, 6]].map(([m, n]) =>
        L('building', 'ห้องเรียน ม.1 – ม.6', `ห้องเรียน ม.${m}`, [{ name: '', rooms: nums(m * 100 + 1, m * 100 + n) }])),
      ...[[1, 5], [2, 5], [3, 5], [4, 7], [5, 7], [6, 7]].map(([m, n]) =>
        L('building', 'ห้องเรียน จ.ภ. สุพรรณบุรี', `ห้องเรียน ${m * 100 + 1}–${m * 100 + n} (จ.ภ. สุพรรณบุรี)`, [{ name: '', rooms: nums(m * 100 + 1, m * 100 + n) }])),
      ...B('ห้องปฏิบัติการ', ['ห้องคอมพิวเตอร์ 1', 'ห้องคอมพิวเตอร์ 2', 'ห้อง IOT', 'ห้อง Lab ฟิสิกส์', 'ห้อง Lab เคมี 1', 'ห้อง Lab เคมี 2',
        'ห้อง Lab ชีววิทยา 1', 'ห้อง Lab ชีววิทยา 2', 'ห้อง Lab ดาราศาสตร์', 'ห้อง Lab วิทย์ทั่วไป 1', 'ห้อง Lab วิทย์ทั่วไป 2', 'ห้อง สอวน.',
        'ห้องฟิสิกส์สัประยุทธ์', 'ห้องการงานอาชีพ', 'ห้องคหกรรม (Food Science)', 'ห้องเขียนแบบ']),
      ...B('ห้องศูนย์การเรียนรู้', ['ห้องศูนย์คณิตศาสตร์', 'ห้องศูนย์ภาษาไทย', 'ห้องศูนย์ภาษาต่างประเทศ', 'ห้องศูนย์ภาษาญี่ปุ่น', 'ห้องนาฏศิลป์', 'ห้องดนตรี', 'ห้องศิลปะ']),
      ...B('สำนักงาน / ฝ่ายงาน', ['ห้องประชาสัมพันธ์', 'ห้องธุรการ', 'ห้องทะเบียนและวัดผล', 'ห้องงานรับนักเรียน', 'ห้องบุคคล', 'ห้องฝ่ายบริหารงานวิชาการ',
        'ห้องฝ่ายบริหารงานงบประมาณ', 'ห้องฝ่ายบริหารงานกิจการนักเรียน', 'ห้องฝ่ายหอพัก', 'ห้องฝ่ายบริหารงานทั่วไป', 'ห้องยานพาหนะ', 'ห้องธนาคารโรงเรียน']),
      ...B('จ.ภ. สุพรรณบุรี', ['ห้องสำนักงาน จ.ภ. สุพรรณบุรี (โรงยิม ชั้น 1)', 'ห้องพักครู จ.ภ. สุพรรณบุรี (ฝั่งห้องพลศึกษา)', 'ห้องพักครู จ.ภ. สุพรรณบุรี (ฝั่งห้องดนตรี)']),
      ...B('ห้องกลุ่มสาระการเรียนรู้ (ห้องพักครู)', ['ห้องกลุ่มสาระฯ วิทยาศาสตร์', 'ห้องกลุ่มสาระฯ คณิตศาสตร์', 'ห้องกลุ่มสาระฯ ภาษาไทย',
        'ห้องกลุ่มสาระฯ ภาษาต่างประเทศ', 'ห้องกลุ่มสาระฯ สังคมศึกษา', 'ห้องแนะแนว']),
      L('dorm', 'หอพักนักเรียนหญิง', 'หอ D1 บัวอุบล (ญ)', [
        { name: 'ส่วนกลาง', rooms: COMMON },
        { name: 'ชั้น 2', rooms: nums(201, 211).map(r => r === '209' ? '209 (ห้องพักครู)' : r) },
        { name: 'ชั้น 3', rooms: nums(301, 311).map(r => r === '309' ? '309 (ห้องพักครู)' : r) }]),
      ...['หอ D2 บุษกร (ญ)', 'หอ D3 บัวชมพู (ญ)'].map(n => L('dorm', 'หอพักนักเรียนหญิง', n, [
        { name: 'ส่วนกลาง', rooms: [...COMMON, 'G01', 'G02', 'G03'] }, ...lockZones(), teacher([2, 3, 4])])),
      L('dorm', 'หอพักนักเรียนชาย', 'หอ D4 นิลกมล (ช)', [
        { name: 'ม.6 ชั้น 1', rooms: nums(101, 107) }, { name: 'ม.6 ชั้น 2', rooms: nums(201, 207) },
        { name: 'ม.6 ชั้น 3', rooms: nums(301, 307) }, { name: 'ม.6 ห้องพักครู', rooms: ['ชั้น 2', 'ชั้น 3'] },
        { name: 'ม.3 ชั้น 1', rooms: [...nums(101, 103), 'Study 1'] }, { name: 'ม.3 ชั้น 2', rooms: [...nums(201, 203), 'Study 2'] },
        { name: 'ม.3 ชั้น 3', rooms: [...nums(301, 307), 'Study 3'] }, { name: 'ม.3 ห้องพักครู', rooms: ['ชั้น 2', 'ชั้น 3'] }]),
      ...['หอ D5 โกเมน (ช)', 'หอ D6 นิลปัทม์ (ช)'].map(n => L('dorm', 'หอพักนักเรียนชาย', n, [
        { name: 'ส่วนกลาง', rooms: [...COMMON, 'ห้องพัก'] }, ...lockZones(), teacher([2, 3, 4])]))
    ];
  }

  function seedUsers(domain) {
    const u = (local, prefix, first, last, position, dept, roles, extra = {}) => ({
      email: `${local}@${domain}`, prefix, first, last, position, dept,
      phone: '08' + Math.floor(10000000 + Math.random() * 89999999).toString().replace(/(\d{1})(\d{3})(\d{4})/, '$1-$2-$3'),
      roles, forms: [...FORM_KEYS], actions: [...ACTIONS], active: true, signature: makeSignature(local), ...extra
    });
    return [
      u('somchai.j', 'นาย', 'สมชาย', 'ใจดี', 'ครู', 'กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี', ['teacher']),
      u('kanthida.s', 'นางสาว', 'กานต์ธิดา', 'ศรีสุข', 'ครู', 'กลุ่มสาระการเรียนรู้คณิตศาสตร์', ['teacher']),
      u('weerapong.t', 'นาย', 'วีระพงษ์', 'ทองดี', 'ครู', 'กลุ่มสาระการเรียนรู้ภาษาไทย', ['teacher']),
      u('porntip.k', 'นาง', 'พรทิพย์', 'แก้วมณี', 'ครูพี่เลี้ยงหอพัก', 'ฝ่ายกิจการนักเรียนและหอพัก', ['teacher']),
      u('anan.r', 'นาย', 'อนันต์', 'รุ่งเรือง', 'ครู', 'กลุ่มสาระการเรียนรู้ภาษาต่างประเทศ', ['teacher']),
      u('sirirat.m', 'นางสาว', 'ศิริรัตน์', 'มั่นคง', 'ครู', 'กลุ่มสาระการเรียนรู้สังคมศึกษา ศาสนา และวัฒนธรรม', ['teacher']),
      u('nattapong.c', 'นาย', 'ณัฐพงษ์', 'ชัยมงคล', 'ครู', 'กลุ่มสาระการเรียนรู้สุขศึกษาและพลศึกษา', ['teacher']),
      u('pitak.s', 'นาย', 'พิทักษ์', 'แซ่โง้ว', 'เจ้าหน้าที่งานอาคารสถานที่', 'ฝ่ายบริหารงานทั่วไป', ['teacher', 'admin']),
      u('chaiwat.k', 'นาย', 'ไชยวัฒน์', 'กุณฑล', 'หัวหน้างานอาคารสถานที่และสิ่งแวดล้อม', 'ฝ่ายบริหารงานทั่วไป', ['teacher', 'approver'], { forms: ['general'] }),
      u('pissamai.j', 'นางสาว', 'พิศมัย', 'แจ่มจำรัส', 'รองผู้อำนวยการฝ่ายบริหารงานทั่วไป', 'ฝ่ายบริหารงานทั่วไป', ['teacher', 'approver'], { actions: ['done', 'cannot_fix'] }),
      u('chutirat.k', 'นางสาว', 'ชุติรัตน์', 'กาญจนธนชัย', 'รองผู้อำนวยการฝ่ายกิจการนักเรียนและหอพัก', 'ฝ่ายกิจการนักเรียนและหอพัก', ['teacher', 'approver'], { forms: ['dorm'] }),
      u('prasert.w', 'นาย', 'ประเสริฐ', 'วงศ์ใหญ่', 'ผู้อำนวยการโรงเรียน', 'ฝ่ายบริหาร', ['teacher', 'executive'])
    ];
  }

  function seedStaff() {
    const s = (name, position, tier, duties, extra = {}) => ({ id: uid('st'), name, position, tier, duties, photo: '', phone: '', email: '', ...extra });
    // คำอธิบายและคำพูดประกอบใส่เฉพาะรองผู้อำนวยการ (การ์ดใหญ่ด้านบน) บุคลากรอื่นแสดงชื่อและตำแหน่ง
    const p = file => ({ photo: `images/staff/${file}.jpg` });
    return [
      s('นางสาวพิศมัย แจ่มจำรัส', 'รองผู้อำนวยการโรงเรียน ฝ่ายบริหารงานทั่วไป', 'lead',
        'กำกับดูแลงานอาคารสถานที่ งานซ่อมบำรุง และงานบริหารทั่วไปของโรงเรียน',
        { ...p('pissamai'), message: 'ฝ่ายบริหารงานทั่วไปพร้อมดูแลอาคารและสถานที่ ให้ปลอดภัยและพร้อมใช้งานสำหรับการเรียนรู้ของนักเรียนทุกคน' }),
      s('นางสาวชุติรัตน์ กาญจนธนชัย', 'รองผู้อำนวยการโรงเรียน ฝ่ายบริหารงานกิจการนักเรียนและหอพัก', 'lead',
        'กำกับดูแลงานกิจการนักเรียนและหอพักนักเรียน รวมถึงการดูแลซ่อมบำรุงอาคารหอพัก',
        { ...p('chutirat'), message: 'หอพักคือบ้านหลังที่สองของนักเรียน เราพร้อมดูแลให้ปลอดภัย สะอาด และอยู่อาศัยได้อย่างอบอุ่น' }),
      s('นายชลธีร์ จันทร์ลอย', 'หัวหน้าฝ่ายบริหารงานทั่วไป', 'team', '', p('chonlatee')),
      s('นายไชยวัฒน์ กุณฑล', 'หัวหน้างานอาคารสถานที่และสิ่งแวดล้อม', 'team', '', p('chaiwat')),
      s('นายจิรวัฒน์ ธรรมธัญกุล', 'รองหัวหน้าอาคารสถานที่และสิ่งแวดล้อม', 'team', '', p('jirawat')),
      s('นางสาวปิติพร นันทการัตน์', 'เลขานุการฝ่ายบริหารงานทั่วไป', 'team', '', p('pitiporn')),
      s('นางนิตยา สุขทอง', 'ผู้ช่วยเลขานุการฝ่ายบริหารงานทั่วไป', 'team', '', p('nittaya')),
      s('นายสมบัติ เกตุพิมล', 'ช่างไฟ', 'team', '', p('sombat')),
      s('นายวีรศักดิ์ โสดามุก', 'ช่างไม้และทั่วไป', 'team', '', p('weerasak')),
      s('นายเมฆ ดอกสี', 'ช่างปูนและทั่วไป', 'team', '', p('mek')),
      s('นายวิชัย เริงศาสตร์', 'ช่างซ่อมแซมทั่วไป', 'team', '', p('wichai'))
    ];
  }

  // แถบเหตุฉุกเฉิน (สีแดง บนสุดทุกหน้า) และแถบประกาศ (หน้าแรก) · ทุกคนเห็นได้ แอดมินแก้ได้ในตั้งค่าระบบ
  function seedBanners() {
    return {
      emergency: { enabled: true, text: 'เหตุฉุกเฉิน เช่น ไฟช็อต น้ำท่วม ไฟไหม้ ท่อแตก โทรแจ้งงานอาคารทันที', phone: '02-xxx-xxxx' },
      notice: { enabled: true, text: 'ตัวอย่างประกาศ: วันเสาร์ 9.00–12.00 น. งดจ่ายน้ำหอพัก D3 เพื่อซ่อมท่อประปา', from: '', to: '' }
    };
  }

  function seedSettings(domain) {
    return {
      schoolName: 'โรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย ปทุมธานี',
      schoolNameEn: 'Princess Chulabhorn Science High School Pathum Thani',
      division: 'ฝ่ายบริหารงานทั่วไป',
      unit: 'แผนกแจ้งซ่อมอาคารและสถานที่',
      domain,
      addressee: 'ผู้อำนวยการโรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย ปทุมธานี',
      docPrefix: '',
      showRefOnDoc: true,
      staleDays: 7,
      signatories: {
        head_building: { title: 'หัวหน้างานอาคารสถานที่และสิ่งแวดล้อม', email: `chaiwat.k@${domain}` },
        deputy_general: { title: 'รองผู้อำนวยการฝ่ายบริหารงานทั่วไป', email: `pissamai.j@${domain}` },
        deputy_student: { title: 'รองผู้อำนวยการฝ่ายบริหารงานกิจการนักเรียนและหอพัก', email: `chutirat.k@${domain}` }
      },
      forms: {
        general: { name: 'แจ้งซ่อมทั่วไป', desc: 'อาคารเรียน ห้องเรียน ห้องปฏิบัติการ และพื้นที่ส่วนกลาง', enabled: true,
          subject: 'ขออนุญาตแจ้งซ่อมและบำรุงรักษา',
          notes: ['ให้ผู้ขออนุญาตลงนามและกรอกข้อมูลตามแบบฟอร์มให้ละเอียดชัดเจน นำส่งที่ฝ่ายบริหารทั่วไป', 'ติดต่อประสานงาน นายไชยวัฒน์  กุณฑล'] },
        dorm: { name: 'แจ้งซ่อมหอพักนักเรียน', desc: 'ไฟฟ้า ประปา งานไม้ อลูมิเนียม และอื่น ๆ ภายในหอพัก', enabled: true,
          subject: 'ขออนุญาตแจ้งซ่อมและบำรุงรักษา ในหอพักนักเรียน',
          notes: ['ให้ผู้ขออนุญาตลงนามและกรอกข้อมูลตามแบบฟอร์มให้ละเอียดชัดเจน นำส่งที่ฝ่ายกิจการนักเรียนและหอพัก', 'ติดต่อประสานงาน นายพิทักษ์  แซ่โง้ว'] }
      },
      reopenDays: 7,
      configVersion: CONFIG_VERSION,
      banners: seedBanners(),
      notify: { email: true, inApp: true, line: false },
      contact: {
        phone: '02-xxx-xxxx ต่อ xxx', email: `building@${domain}`, line: '',
        office: 'ห้องฝ่ายบริหารงานทั่วไป อาคารอำนวยการ ชั้น 1', hours: 'วันจันทร์ – ศุกร์ เวลา 08.00 – 16.30 น.'
      },
      departments: [
        'กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี', 'กลุ่มสาระการเรียนรู้คณิตศาสตร์', 'กลุ่มสาระการเรียนรู้ภาษาไทย',
        'กลุ่มสาระการเรียนรู้ภาษาต่างประเทศ', 'กลุ่มสาระการเรียนรู้สังคมศึกษา ศาสนา และวัฒนธรรม', 'กลุ่มสาระการเรียนรู้สุขศึกษาและพลศึกษา',
        'กลุ่มสาระการเรียนรู้ศิลปะ', 'กลุ่มสาระการเรียนรู้การงานอาชีพ', 'กิจกรรมพัฒนาผู้เรียน',
        'ฝ่ายบริหารงานทั่วไป', 'ฝ่ายบริหารวิชาการ', 'ฝ่ายกิจการนักเรียนและหอพัก', 'ฝ่ายบริหารงบประมาณ', 'ฝ่ายบริหารงานบุคคล'
      ],
      positions: ['ครู', 'ครูผู้ช่วย', 'ครูอัตราจ้าง', 'ครูพี่เลี้ยงหอพัก', 'เจ้าหน้าที่', 'ผู้บริหาร'],
      workers: ['นายสมบัติ เกตุพิมล', 'นายวีรศักดิ์ โสดามุก', 'นายเมฆ ดอกสี', 'นายวิชัย เริงศาสตร์', 'ช่างภายนอก (จ้างเหมา)'],
      cannotReasons: ['ต้องจ้างช่างภายนอก', 'ไม่มีอะไหล่ / อะไหล่เลิกผลิต', 'ซ่อมไม่คุ้มค่า เสนอจำหน่ายครุภัณฑ์', 'อยู่ในระยะประกัน ส่งเคลมผู้ขาย', 'เกินขีดความสามารถของช่าง'],
      reviewReasons: ['รอจัดซื้อวัสดุ/อะไหล่', 'รอพิจารณางบประมาณ', 'รอช่างภายนอกประเมิน', 'รอผู้บริหารพิจารณา'],
      running: {}
    };
  }

  // อัปเดตค่าตั้งระบบที่มีอยู่แล้วให้เป็นชุดล่าสุด (ทำครั้งเดียว ข้อมูลที่แอดมินแก้เองไม่หาย)
  // v2: สถานที่แจ้งซ่อมทั่วไปชุดใหม่ + ข้อความตามแบบฟอร์ม "บท00 ขอแจ้งซ่อม" · v3: แถบเหตุฉุกเฉินและประกาศ
  // v4: หน่วยนับของรายการที่จับต้องได้ (ใส่เฉพาะรายการที่ยังไม่มีหน่วย ไม่ทับที่แอดมินตั้งเอง)
  // v5: แจ้ง "ซ่อมแล้วไม่หาย" ได้ภายใน 7 วัน (เปลี่ยนเฉพาะที่ยังเป็นค่าเดิม 14 วัน)
  function upgradeConfig(d) {
    const v = d.settings.configVersion || 1;
    if (v >= CONFIG_VERSION) return false;
    if (v < 2) upgradeV2(d);
    if (!d.settings.banners) d.settings.banners = seedBanners();
    if (v < 4) {
      const units = new Map(seedCategories().flatMap(c => c.items.filter(i => i.unit).map(i => [`${c.id}|${i.name}`, i.unit])));
      d.categories.forEach(c => (c.items || []).forEach(i => { const u = units.get(`${c.id}|${i.name}`); if (u && !i.unit) i.unit = u; }));
    }
    if (v < 5 && (!d.settings.reopenDays || d.settings.reopenDays === 14)) d.settings.reopenDays = 7;
    d.settings.configVersion = CONFIG_VERSION;
    return true;
  }
  function upgradeV2(d) {
    // สถานที่ทั่วไป: ใช้ชุดใหม่ คง id เดิมของชื่อที่มีอยู่แล้ว (สถิติไม่หาย) สถานที่ที่แอดมินเพิ่มเองต่อท้าย · หอพักไม่แตะ
    const fresh = seedLocations().filter(l => l.type === 'building');
    const old = d.locations.filter(l => l.type === 'building');
    const byName = new Map(old.map(l => [l.name, l]));
    const merged = fresh.map(l => byName.has(l.name) ? { ...l, id: byName.get(l.name).id, active: byName.get(l.name).active !== false } : l);
    const custom = old.filter(o => !fresh.some(l => l.name === o.name));
    d.locations = [...merged, ...custom, ...d.locations.filter(l => l.type !== 'building')];
    // ข้อความในเอกสาร: เปลี่ยนเฉพาะที่ยังเป็นค่าเดิมของระบบ
    const NEW = seedSettings(d.settings.domain);
    const OLD_SUBJECT = 'ขออนุญาตแจ้งซ่อม ไฟฟ้า ประปา งานไม้ งานอะลูมิเนียม และอื่นๆ';
    FORM_KEYS.forEach(k => { if (String(d.settings.forms[k]?.subject || '').startsWith(OLD_SUBJECT)) d.settings.forms[k].subject = NEW.forms[k].subject; });
    const ds = d.settings.signatories?.deputy_student;
    if (ds && ds.title === 'รองผู้อำนวยการฝ่ายกิจการนักเรียนและหอพัก') ds.title = NEW.signatories.deputy_student.title;
  }

  const SYMPTOMS = ['ใช้งานไม่ได้ตั้งแต่เช้า', 'ชำรุดเสียหาย ต้องเปลี่ยนใหม่', 'ใช้งานได้บ้างไม่ได้บ้าง', 'หลวม/หลุด ไม่แน่นหนา', 'มีเสียงดังผิดปกติ', 'รั่วซึม ทำให้พื้นเปียก', 'กดแล้วไม่ทำงาน'];
  const AC_SYMPTOMS = ['เปิดแล้วมีแต่ลม ไม่เย็น', 'น้ำหยดใส่โต๊ะนักเรียน', 'ใช้งานได้ประมาณ 10 นาทีแล้วตัด', 'มีเสียงดังจากคอยล์ร้อน'];

  const fullName = u => u ? `${u.prefix || ''}${u.first || ''} ${u.last || ''}`.trim() : '';
  const snapUser = u => ({ email: u.email, name: fullName(u), position: u.position, signature: u.signature || '' });

  // ผู้ลงนามตามตำแหน่ง (ข้อมูลล่าสุดของผู้ดำรงตำแหน่ง)
  function signerOf(d, key) {
    const sg = d.settings.signatories[key];
    const u = sg?.email && d.users.find(x => x.email === sg.email);
    return { title: sg?.title || '', email: u?.email || '', name: u ? fullName(u) : '', signature: u?.signature || '' };
  }
  // เติมลายเซ็นผู้อนุมัติทั้งสองช่องเมื่องานเริ่มดำเนินการ
  function fillApprovals(d, t, at) {
    if (!t.approvals.step1) t.approvals.step1 = { decision: 'approve', at, by: signerOf(d, STEP1_KEY[t.formType]) };
    if (!t.approvals.step2) t.approvals.step2 = { decision: 'approve', note: 'อนุมัติ ดำเนินการ', at, by: signerOf(d, STEP2_KEY) };
  }

  // เปลี่ยนสถานะ (ใช้ร่วมกันทั้งข้อมูลตัวอย่างและการกดจริง)
  function applyStatus(d, t, status, payload, byUser, at) {
    const by = fullName(byUser);
    const log = (action, note = '') => t.history.push({ at, by, action, note });
    if (status === 'in_progress') {
      fillApprovals(d, t, at);
      if (t.status === 'done' || t.status === 'cannot_fix') { t.completion = null; t.inspection = null; t.cannot = null; }
      t.status = 'in_progress';
      log('กำลังดำเนินการซ่อม', payload.note);
    } else if (status === 'review') {
      t.review = { note: payload.note || '', at, by };
      t.status = 'review';
      log('รอพิจารณา', payload.note);
    } else if (status === 'done') {
      fillApprovals(d, t, at);
      t.completion = { note: payload.note || '', worker: payload.worker || '', photos: payload.photos || [], at, by };
      t.cannot = null;
      t.inspection = { result: 'ok', at, by: { ...snapUser(byUser), title: 'ผู้ตรวจงาน' } };
      t.status = 'done';
      log('เสร็จสิ้น', [payload.worker && `ผู้ปฏิบัติงาน ${payload.worker}`, payload.note].filter(Boolean).join(' · '));
    } else if (status === 'cannot_fix') {
      t.cannot = { reason: payload.reason || '', note: payload.note || '', photos: payload.photos || [], at, by };
      t.completion = null;
      t.inspection = { result: 'cannot', at, by: { ...snapUser(byUser), title: 'ผู้ตรวจงาน' } };
      t.status = 'cannot_fix';
      log('ไม่สามารถซ่อมได้', [payload.reason, payload.note].filter(Boolean).join(' — '));
    }
  }

  function seedTickets(data) {
    const r = rng(25690);
    const pick = a => a[Math.floor(r() * a.length)];
    const between = (a, b) => a + r() * (b - a);
    const H = 3600e3, D = 24 * H;
    const teachers = data.users.filter(u => u.roles.length === 1);
    const admin = data.users.find(u => u.roles.includes('admin'));
    const approvers = data.users.filter(u => u.roles.includes('approver'));
    const buildings = data.locations.filter(l => l.type === 'building');
    const dorms = data.locations.filter(l => l.type === 'dorm');
    const tickets = [];
    const now = Date.now();

    for (let i = 0; i < 76; i++) {
      // วันที่ย้อนหลังประมาณ 8 เดือน ช่วงหลังหนาแน่นกว่า และมีงานใหม่ไม่กี่วันที่ผ่านมา
      const ago = i < 18 ? r() * 5 * D : Math.pow(r(), 1.35) * 240 * D;
      const created = new Date(now - ago);
      created.setHours(8 + Math.floor(r() * 8), Math.floor(r() * 60), 0, 0);
      if (created.getTime() > now) created.setTime(now - between(1, 6) * H);
      const formType = r() < 0.65 ? 'general' : 'dorm';
      const reporter = formType === 'dorm' && r() < 0.6 ? data.users.find(u => u.email.startsWith('porntip')) : pick(teachers);
      const cats = data.categories.filter(c => c.forms.includes(formType) && !c.freeOnly);
      const acCat = cats.find(c => c.id === 'ac');
      const cat = r() < 0.2 ? acCat : pick(cats.filter(c => c !== acCat));
      const items = [];
      for (let k = 0; k < 1 + (r() < 0.3 ? 1 : 0); k++) {
        const item = pick(cat.items.filter(i => !i.forms || i.forms.includes(formType)));
        if (items.some(x => x.itemId === item.id)) continue;
        items.push({ catId: cat.id, catName: cat.name, itemId: item.id, name: item.name, unit: item.unit || '', qty: item.unit ? 1 + Math.floor(r() * 4) : 0,
          detail: pick(cat === acCat ? AC_SYMPTOMS : SYMPTOMS) });
      }
      const place = pick(formType === 'dorm' ? dorms : buildings);
      const zone = place.zones.length ? pick(place.zones) : null;
      const loc = { locationId: place.id, locationName: place.name, zone: zone?.name || '', room: zone ? pick(zone.rooms) : '', point: '' };
      const t = {
        id: '', docNo: '', formType, createdAt: created.toISOString(),
        reporter: { ...snapUser(reporter), dept: reporter.dept, phone: reporter.phone },
        location: loc, items, note: '',
        photos: [], status: 'pending', approvals: {}, review: null, completion: null, inspection: null, cannot: null,
        history: [{ at: created.toISOString(), by: fullName(reporter), action: 'แจ้งซ่อม', note: '' }]
      };

      // ลำดับสถานะตามอายุงาน
      const ageDays = ago / D, s = r();
      let path;
      if (ageDays > 20) path = s < 0.82 ? ['in_progress', 'done'] : s < 0.9 ? ['review', 'cannot_fix'] : s < 0.95 ? ['review', 'in_progress', 'done'] : ['cannot_fix'];
      else if (ageDays > 4) path = s < 0.45 ? ['in_progress', 'done'] : s < 0.65 ? ['in_progress'] : s < 0.87 ? ['review'] : ['in_progress', 'cannot_fix'];
      else path = s < 0.4 ? [] : s < 0.65 ? ['in_progress'] : s < 0.85 ? ['review'] : ['in_progress', 'done'];
      let tcur = created.getTime();
      for (const st of path) {
        tcur += { in_progress: between(2, 30), review: between(2, 30), done: between(4, 120), cannot_fix: between(8, 96) }[st] * H * (ageDays < 5 ? 0.25 : 1);
        if (tcur > now) break;
        const at = new Date(tcur).toISOString();
        const actor = st === 'done' || st === 'cannot_fix' ? (r() < 0.6 ? admin : pick(approvers)) : admin;
        applyStatus(data, t, st, {
          note: st === 'done' ? pick(['เปลี่ยนอะไหล่ใหม่ ทดสอบใช้งานได้ปกติ', 'ซ่อมแซมเรียบร้อย ใช้งานได้ตามปกติ', 'ปรับตั้งและขันยึดใหม่ ใช้งานได้ดี']) : st === 'review' ? '' : '',
          worker: st === 'done' ? pick(data.settings.workers.slice(0, 4)) : '',
          reason: st === 'cannot_fix' ? pick(data.settings.cannotReasons) : '',
        }, actor, at);
        if (st === 'review') t.review.note = pick(data.settings.reviewReasons);
      }
      // ผู้แจ้งยกเลิกเองบางรายการที่ยังรออนุมัติ
      if (t.status === 'pending' && ago > 2 * D && r() < 0.5) {
        const at = new Date(created.getTime() + between(1, 20) * H).toISOString();
        t.status = 'cancelled';
        t.cancel = { reason: 'แจ้งซ้ำกับรายการเดิม', at, by: fullName(reporter) };
        t.history.push({ at, by: fullName(reporter), action: 'ยกเลิกคำขอ', note: t.cancel.reason });
      }
      tickets.push(t);
    }
    tickets.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const counters = {};
    for (const t of tickets) {
      const y = beYear(t.createdAt);
      counters[y] = (counters[y] || 0) + 1;
      t.id = `REP-${y}-${String(counters[y]).padStart(4, '0')}`;
      t.docNo = `${counters[y]}/${y}`;
    }
    data.settings.running = counters;
    return tickets;
  }

  function seed() {
    const domain = 'pcshspt.ac.th';
    const data = {
      version: 7, settings: seedSettings(domain),
      categories: seedCategories(), locations: seedLocations(),
      users: seedUsers(domain), staff: seedStaff(), notifications: [], tickets: []
    };
    data.tickets = seedTickets(data);
    for (const t of data.tickets.filter(x => x.status === 'pending')) {
      for (const u of data.users.filter(u => canSee(u, t) && isStaff(u))) {
        data.notifications.push({ id: uid('n'), to: u.email, at: t.createdAt, ticketId: t.id, read: false, title: 'มีการแจ้งซ่อมใหม่', body: `${t.id} · ${t.location.locationName}` });
      }
    }
    return data;
  }

  // ───────── จัดเก็บ ─────────
  function load() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        // ปรับข้อมูลเดิมครั้งเดียว: ย้ายหมวด "อื่น ๆ" ไปไว้ท้ายสุด
        if ((d.version || 0) < 4) {
          d.categories = [...d.categories.filter(c => !c.freeOnly), ...d.categories.filter(c => c.freeOnly)];
          d.version = 4;
          try { localStorage.setItem(DB_KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
        }
        // เพิ่มบัญชีผู้บริหารตัวอย่างให้ข้อมูลที่มีอยู่แล้ว (ข้อมูลเดิมไม่หาย)
        if ((d.version || 0) < 6) {
          const ex = seedUsers(d.settings.domain).find(u => u.roles.includes('executive'));
          if (!d.users.some(u => u.email === ex.email)) d.users.push(ex);
          d.version = 6;
          try { localStorage.setItem(DB_KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
        }
        // ใส่รายชื่อและรูปบุคลากรจริงแทนข้อมูลตัวอย่างเดิม
        if ((d.version || 0) < 7) {
          d.staff = seedStaff();
          d.version = 7;
          try { localStorage.setItem(DB_KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
        }
        if (upgradeConfig(d)) { try { localStorage.setItem(DB_KEY, JSON.stringify(d)); } catch (e) { /* ignore */ } }
        return d;
      }
    } catch (e) { /* ใช้ข้อมูลเริ่มต้นแทน */ }
    const d = seed();
    try { localStorage.setItem(DB_KEY, JSON.stringify(d)); } catch (e) { /* โหมดส่วนตัว */ }
    return d;
  }
  // ระบบจริง: เริ่มจากค่าตั้งต้นในโค้ด แล้วแทนที่ด้วยข้อมูลจาก Firestore เมื่อโหลดเสร็จ
  function cloudStartDb() {
    const domain = CFG.domain || 'pcshspt.ac.th';
    return { version: 7, settings: seedSettings(domain), categories: seedCategories(), locations: seedLocations(),
      users: [], staff: seedStaff(), notifications: [], tickets: [] };
  }
  let db = CLOUD ? cloudStartDb() : load();
  const Cloud = CLOUD ? makeCloud() : null;
  // การบันทึก: แก้สำเนาของข้อมูลด้วย mutator แล้วบันทึกลงที่เก็บ (ระบบจริงส่งเฉพาะส่วนที่เปลี่ยนไป Firestore)
  let lastWrite = Promise.resolve();
  function commit(mutator) {
    const draft = clone(db);
    const result = mutator(draft);
    if (CLOUD) {
      const prev = db;
      db = draft;
      emit();
      const w = Cloud.persist(prev, draft).catch(e => { Cloud.rebuild(); throw Cloud.friendly(e); });
      lastWrite = w;
      // ถ้าหน้าที่เรียกไม่ได้รอผลเอง ให้แจ้งข้อผิดพลาดที่มุมจอ
      w.catch(e => setTimeout(() => { if (!w.awaited && typeof UI !== 'undefined') UI.toast(e.message, 'error'); }, 0));
      return result;
    }
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(draft));
    } catch (e) {
      throw new Error('พื้นที่เก็บข้อมูลของเบราว์เซอร์เต็ม (ต้นแบบเก็บรูปไว้ในเครื่อง) ลองลดจำนวนหรือขนาดรูปภาพ');
    }
    db = draft;
    emit();
    return result;
  }
  // รอให้การบันทึกล่าสุดเสร็จ (ระบบจริง) · โหมดทดลองหน่วงเวลาเล็กน้อยให้เหมือนเรียกเซิร์ฟเวอร์
  const settle = (v, ms) => {
    if (!CLOUD) return delay(v, ms);
    lastWrite.awaited = true;
    return lastWrite.then(() => v);
  };
  function emit() { listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); }
  if (!CLOUD && typeof window !== 'undefined') window.addEventListener('storage', e => {
    if (e.key === DB_KEY && e.newValue) { db = JSON.parse(e.newValue); emit(); }
    if (e.key === SESSION_KEY) emit();
  });
  const delay = (v, ms = 160) => new Promise(res => setTimeout(() => res(v), ms));

  // ───────── สิทธิ์ ─────────
  function currentUser() {
    if (CLOUD) return Cloud.me();
    let email = null;
    try { email = localStorage.getItem(SESSION_KEY); } catch (e) { /* ignore */ }
    if (!email) return null;
    return db.users.find(u => u.email === email && u.active) || null;
  }
  function hasRole(u, role) { return !!u && (u.roles || []).includes(role); }
  function isStaff(u) { return hasRole(u, 'admin') || hasRole(u, 'approver'); }
  // ผู้บริหาร: เข้าหลังบ้านได้เพื่อดูสถิติและแดชบอร์ดเท่านั้น
  function isBackOffice(u) { return isStaff(u) || hasRole(u, 'executive'); }
  function formsOf(u) { return hasRole(u, 'admin') ? [...FORM_KEYS] : hasRole(u, 'approver') ? (u.forms || []) : []; }
  function actionsOf(u) { return hasRole(u, 'admin') ? [...ACTIONS] : hasRole(u, 'approver') ? (u.actions || []) : []; }
  function canSee(u, t) { return !!u && (formsOf(u).includes(t.formType) || t.reporter.email === u.email); }
  function can(u, action, t) {
    if (!u) return false;
    if (action === 'stats') return hasRole(u, 'admin') || hasRole(u, 'executive');
    if (action === 'settings') return hasRole(u, 'admin');
    if (ACTIONS.includes(action)) return t.status !== 'cancelled' && formsOf(u).includes(t.formType) && actionsOf(u).includes(action) && t.status !== action;
    const mine = t?.reporter.email === u.email;
    // ผู้แจ้งแก้ไข/ยกเลิกได้เฉพาะตอนยังรออนุมัติ
    if (action === 'edit' || action === 'cancel') return mine && t.status === 'pending';
    // แจ้ง "ยังไม่หาย" ได้ภายในจำนวนวันที่กำหนดหลังเสร็จสิ้น และแจ้งได้ครั้งเดียวต่อใบ
    if (action === 'reopen') return mine && t.status === 'done' && !t.reopenedBy &&
      (Date.now() - new Date(t.completion?.at || 0)) / 864e5 <= (db.settings.reopenDays || 7);
    return false;
  }
  const deadline = t => new Date(new Date(t.completion?.at || 0).getTime() + (db.settings.reopenDays || 7) * 864e5);
  // คำขอที่ยังเปิดอยู่ในสถานที่เดียวกันและมีรายการซ้ำกัน
  function duplicatesOf(input, exceptId) {
    const room = s => String(s || '').replace(/\s|ห้อง/g, '').toLowerCase();
    const names = new Set(input.items.map(i => `${i.catId}|${i.name}`));
    return db.tickets.filter(t => t.id !== exceptId && ['pending', 'in_progress', 'review'].includes(t.status)
      && t.formType === input.formType && t.location.locationName === input.location.locationName
      && (t.location.zone || '') === (input.location.zone || '') && room(t.location.room) === room(input.location.room)
      && t.items.some(i => names.has(`${i.catId}|${i.name}`)));
  }

  function notify(d, emails, title, body, ticketId, kind = '') {
    const seen = new Set();
    for (const to of emails) {
      if (!to || seen.has(to)) continue;
      seen.add(to);
      d.notifications.push({ id: uid('n'), to, at: nowISO(), title, body, ticketId, read: false, ...(kind ? { kind } : {}) });
    }
    if (d.notifications.length > 400) d.notifications = d.notifications.slice(-400);
  }

  const STATUS_TITLE = { in_progress: 'กำลังดำเนินการซ่อม', review: 'รอพิจารณา', done: 'ซ่อมเสร็จสิ้นแล้ว', cannot_fix: 'ไม่สามารถซ่อมได้' };

  // สร้างใบแจ้งซ่อมใหม่ (ใช้ทั้งแจ้งใหม่และแจ้ง "ยังไม่หาย")
  function newTicket(d, input, user, extra = {}) {
    const created = new Date();
    const y = beYear(created);
    d.settings.running[y] = (d.settings.running[y] || 0) + 1;
    const run = d.settings.running[y];
    const t = {
      id: `REP-${y}-${String(run).padStart(4, '0')}`,
      docNo: `${d.settings.docPrefix || ''}${run}/${y}`,
      formType: input.formType, createdAt: created.toISOString(),
      reporter: { ...snapUser(user), dept: input.dept || user.dept, phone: input.phone || user.phone, position: input.position || user.position },
      location: input.location, items: input.items, note: input.note || '', photos: input.photos || [],
      status: 'pending', approvals: {}, review: null, completion: null, inspection: null, cannot: null, ...extra,
      history: [{ at: created.toISOString(), by: fullName(user), action: extra.reopenOf ? `แจ้งซ้ำ (ยังไม่หาย) จาก ${extra.reopenOf}` : 'แจ้งซ่อม', note: '' }]
    };
    d.tickets.push(t);
    notify(d, d.users.filter(u => u.active && isStaff(u) && formsOf(u).includes(t.formType)).map(u => u.email),
      extra.reopenOf ? REOPEN_TITLE : 'มีการแจ้งซ่อมใหม่', extra.reopenOf ? reopenBody(t) : `${t.id} · ${t.location.locationName}`, t.id, extra.reopenOf ? 'reopen' : '');
    return t;
  }
  const REOPEN_TITLE = '🚨 ซ่อมแล้วไม่หาย';
  const reopenBody = t => `${t.id} ← ใบเดิม ${t.reopenOf}${t.reopenCount > 1 ? ` (ครั้งที่ ${t.reopenCount})` : ''} · ${t.location.locationName}`;

  // ───────── API ─────────
  return {
    FORM_KEYS, STEP1_KEY, STEP2_KEY, ACTIONS,
    cloud: CLOUD,
    // รอให้โหลดข้อมูลชุดแรกเสร็จก่อนวาดหน้า
    ready: () => CLOUD ? Cloud.ready : Promise.resolve(),
    // ระบบจริง: โหลดใบแจ้งซ่อมย้อนหลังเพิ่ม (หน้าสถิติ) คืนค่า true ถ้ามีการโหลดใหม่
    ensureRange: from => CLOUD ? Cloud.ensureRange(from) : Promise.resolve(false),
    // ระบบจริงโหลดใบแจ้งซ่อมไม่ครบทุกปี จึงดูจากค่าตั้งระบบว่ายังมีใบตัวอย่างหรือไม่
    hasSamples: () => CLOUD ? !!db.settings.hasSamples : db.tickets.some(t => t.sample),
    deleteSamples: () => CLOUD ? Cloud.deleteSamples() : Promise.resolve(0),
    // รูปที่เก็บใน Drive อ้างอิงเป็น "drive:<id>" · ใช้ <img ${Store.img(src)}> แล้วระบบโหลดรูปให้เอง
    img: src => CLOUD ? Cloud.imgAttr(src) : `src="${src}"`,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    fullName, hasRole, isStaff, isBackOffice, can, canSee, formsOf, actionsOf, reopenDeadline: deadline,
    duplicates: (input, exceptId) => duplicatesOf(input, exceptId),
    step1Key: t => STEP1_KEY[t.formType],
    signer: key => signerOf(db, key),

    // เซสชัน
    me: currentUser,
    async login(email) {
      if (CLOUD) return Cloud.login();
      email = String(email || '').trim().toLowerCase();
      const domain = db.settings.domain.toLowerCase();
      if (!email.endsWith('@' + domain)) throw new Error(`ใช้ได้เฉพาะอีเมลของโรงเรียน (@${domain}) เท่านั้น`);
      const u = db.users.find(x => x.email.toLowerCase() === email);
      if (!u || !u.active) throw new Error('บัญชีนี้ยังไม่มีสิทธิ์ใช้งานระบบ ระบบแจ้งซ่อมเปิดให้เฉพาะครูและบุคลากร หากเป็นครูกรุณาติดต่อฝ่ายบริหารงานทั่วไปเพื่อเพิ่มรายชื่อ');
      localStorage.setItem(SESSION_KEY, u.email);
      emit();
      return delay(u, 450);
    },
    logout() { if (CLOUD) return Cloud.logout(); localStorage.removeItem(SESSION_KEY); emit(); },
    // เฉพาะโหมดทดลอง: เปิด index.html?as=ชื่ออีเมล เพื่อเข้าในบทบาทนั้นทันที
    demoLogin(local) {
      if (CLOUD) return;
      const u = db.users.find(x => x.email.split('@')[0] === local);
      try { if (u) localStorage.setItem(SESSION_KEY, u.email); else localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
    },

    // ตั้งค่า / ข้อมูลหลัก
    settings: () => db.settings,
    banners: () => db.settings.banners || seedBanners(),
    saveSettings(patch) { return commit(d => { Object.assign(d.settings, patch); }); },
    categories(formType) { return db.categories.filter(c => c.active !== false && (!formType || c.forms.includes(formType))); },
    allCategories: () => db.categories,
    // รายการในหมวดที่แสดงในแบบฟอร์มนี้
    itemsFor: (cat, form) => (cat.items || []).filter(i => !i.forms || !form || i.forms.includes(form)),
    saveCategory(cat) {
      return commit(d => {
        const i = d.categories.findIndex(c => c.id === cat.id);
        if (i >= 0) d.categories[i] = cat;
        else {
          // หมวดใหม่ต่อท้ายก่อนหมวด "อื่น ๆ" เสมอ
          const at = d.categories.findIndex(c => c.freeOnly);
          d.categories.splice(at < 0 || cat.freeOnly ? d.categories.length : at, 0, { ...cat, id: cat.id || uid('cat') });
        }
      });
    },
    deleteCategory(id) { return commit(d => { d.categories = d.categories.filter(c => c.id !== id); }); },
    moveCategory(id, dir) {
      return commit(d => {
        const i = d.categories.findIndex(c => c.id === id), j = i + dir;
        if (i < 0 || j < 0 || j >= d.categories.length) return;
        [d.categories[i], d.categories[j]] = [d.categories[j], d.categories[i]];
      });
    },
    locations(type) { return db.locations.filter(l => l.active !== false && (!type || l.type === type)); },
    allLocations: () => db.locations,
    saveLocation(loc) {
      return commit(d => {
        const i = d.locations.findIndex(l => l.id === loc.id);
        if (i >= 0) d.locations[i] = loc; else d.locations.push({ ...loc, id: uid('loc'), active: true });
      });
    },
    deleteLocation(id) { return commit(d => { d.locations = d.locations.filter(l => l.id !== id); }); },

    users: () => db.users,
    userByEmail: email => db.users.find(u => u.email === email),
    saveUser(user, originalEmail) {
      return commit(d => {
        const key = originalEmail || user.email;
        const i = d.users.findIndex(u => u.email === key);
        if (i < 0 && d.users.some(u => u.email === user.email)) throw new Error('มีอีเมลนี้ในระบบแล้ว');
        if (i >= 0) d.users[i] = { ...d.users[i], ...user }; else d.users.push({ active: true, roles: ['teacher'], forms: [...FORM_KEYS], actions: ['done', 'cannot_fix'], ...user });
        // เปลี่ยนอีเมล → อัปเดตตำแหน่งผู้ลงนามที่ผูกไว้
        if (originalEmail && originalEmail !== user.email) Object.values(d.settings.signatories).forEach(s => { if (s.email === originalEmail) s.email = user.email; });
      });
    },
    deleteUser(email) { return commit(d => { d.users = d.users.filter(u => u.email !== email); }); },
    importUsers(rows) {
      return commit(d => {
        let added = 0, updated = 0;
        for (const r of rows) {
          const i = d.users.findIndex(u => u.email === r.email);
          if (i >= 0) { d.users[i] = { ...d.users[i], ...r, roles: d.users[i].roles }; updated++; }
          else { d.users.push({ active: true, roles: ['teacher'], forms: [...FORM_KEYS], actions: ['done', 'cannot_fix'], ...r }); added++; }
        }
        return { added, updated };
      });
    },
    // ข้อมูลโปรไฟล์ที่ยังขาด/ไม่ถูกต้อง (ว่าง = ครบ ใช้งานได้) · ทุกคนต้องกรอกครบก่อนใช้ระบบ
    profileIssues(u) {
      if (!u) return [];
      const thai = v => /^[฀-๿]+(\s+[฀-๿]+)*$/.test(String(v || '').trim());
      const digits = String(u.phone || '').replace(/\D/g, '');
      const issues = {};
      if (!u.prefix) issues.prefix = 'เลือกคำนำหน้า';
      if (!thai(u.first)) issues.first = u.first ? 'ชื่อต้องเป็นภาษาไทยเท่านั้น' : 'กรอกชื่อ';
      if (!thai(u.last)) issues.last = u.last ? 'นามสกุลต้องเป็นภาษาไทยเท่านั้น' : 'กรอกนามสกุล';
      if (!u.position) issues.position = 'เลือกตำแหน่ง';
      if (!u.dept) issues.dept = 'เลือกฝ่ายงาน / กลุ่มสาระฯ';
      if (!/^0\d{8,9}$/.test(digits)) issues.phone = digits ? 'เบอร์โทรต้องขึ้นต้นด้วย 0 และมี 9–10 หลัก' : 'กรอกเบอร์ติดต่อ';
      if (!u.signature) issues.signature = 'เพิ่มลายเซ็น';
      return issues;
    },
    profileComplete(u) { return !Object.keys(this.profileIssues(u)).length; },
    updateProfile(patch) {
      const me = currentUser();
      return commit(d => { Object.assign(d.users.find(u => u.email === me.email), patch); });
    },

    staff: () => db.staff,
    saveStaff(member) {
      return commit(d => {
        const i = d.staff.findIndex(s => s.id === member.id);
        if (i >= 0) d.staff[i] = member; else d.staff.push({ ...member, id: uid('st') });
      });
    },
    deleteStaff(id) { return commit(d => { d.staff = d.staff.filter(s => s.id !== id); }); },
    reorderStaff(ids) { return commit(d => { d.staff = ids.map(id => d.staff.find(s => s.id === id)).filter(Boolean).concat(d.staff.filter(s => !ids.includes(s.id))); }); },

    // การแจ้งเตือน
    notifications() {
      const me = currentUser();
      if (!me) return [];
      if (CLOUD) return Cloud.notifications(me);
      return db.notifications.filter(n => n.to === me.email).sort((a, b) => b.at.localeCompare(a.at));
    },
    // ตัวเลขบนกระดิ่ง: ยังไม่อ่าน และเข้ามาหลังเปิดดูกระดิ่งครั้งล่าสุด (เก็บเวลาที่เปิดดูไว้ในเครื่อง)
    unseenCount() {
      const me = currentUser();
      if (!me) return 0;
      let seen = '';
      try { seen = localStorage.getItem(`pcshs-notif-seen:${me.email}`) || ''; } catch (e) { /* ignore */ }
      return this.notifications().filter(n => !n.read && n.at > seen).length;
    },
    markSeen() {
      const me = currentUser();
      if (!me) return;
      try { localStorage.setItem(`pcshs-notif-seen:${me.email}`, nowISO()); } catch (e) { /* ignore */ }
      emit();
    },
    markRead(id) {
      const me = currentUser();
      if (CLOUD) return Cloud.markRead(me, id);
      return commit(d => { d.notifications.forEach(n => { if (n.to === me.email && (!id || n.id === id)) n.read = true; }); });
    },

    // ใบแจ้งซ่อม
    tickets: () => db.tickets,
    // งานที่ผู้ใช้คนนี้มีสิทธิ์เห็นในหลังบ้าน
    visibleTickets(u = currentUser()) { const f = formsOf(u); return db.tickets.filter(t => f.includes(t.formType)); },
    ticket: id => db.tickets.find(t => t.id === id),
    async createTicket(input) {
      const [t] = await this.createTickets({ ...input, locations: [input.location] });
      return t;
    },

    // แจ้งหลายสถานที่พร้อมกัน: แยกเป็นใบแจ้งซ่อมทีละสถานที่
    // entries = [{ location, items }] แต่ละสถานที่มีรายการของตัวเอง (หรือส่ง locations + items ชุดเดียวกันทุกที่)
    async createTickets(input) {
      const me = currentUser();
      if (!hasRole(me, 'teacher')) throw new Error('เฉพาะครูและบุคลากรเท่านั้นที่แจ้งซ่อมได้');
      const entries = input.entries || (input.locations || []).map(location => ({ location, items: input.items }));
      if (!entries.length) throw new Error('กรุณาเลือกสถานที่ซ่อมอย่างน้อย 1 แห่ง');
      if (entries.some(e => !e.items?.length || e.items.some(i => !String(i.detail || '').trim()))) throw new Error('กรุณาระบุรายละเอียดของทุกรายการที่แจ้งซ่อม');
      if (CLOUD) {
        if (entries.length > 8) throw new Error('แจ้งได้ครั้งละไม่เกิน 8 สถานที่ กรุณาแบ่งส่งเป็นหลายครั้ง');
        // อัปโหลดรูปลง Drive ก่อน แล้วจองเลขที่ใบไม่ให้ซ้ำกับคนอื่น
        for (const e of entries) for (const it of e.items) it.photos = await Cloud.upload(it.photos);
        input.photos = await Cloud.upload(input.photos);
        await Cloud.reserve(entries.length);
      }
      const list = commit(d => {
        const user = d.users.find(u => u.email === me.email);
        // เบอร์ใหม่จากฟอร์ม → อัปเดตโปรไฟล์ (เฉพาะเบอร์ที่ถูกต้อง ไม่ให้โปรไฟล์กลายเป็นไม่ครบ)
        if (input.phone && input.phone !== user.phone && /^0\d{8,9}$/.test(input.phone.replace(/\D/g, ''))) user.phone = input.phone;
        const batch = entries.length > 1 ? uid('B') : null;
        const made = entries.map(({ location, items }) => newTicket(d, { ...input, location, items }, user, batch ? { batch } : {}));
        if (batch) made.forEach(t => { t.batchIds = made.map(x => x.id); });
        return made;
      });
      await settle(list, 600);
      if (CLOUD) Cloud.notifyNew(list.map(t => t.id));
      return list;
    },

    // ผู้แจ้งแก้ไขคำขอที่ยังรออนุมัติ (เลขที่เดิม)
    async updateTicket(id, input) {
      const me = currentUser();
      if (!can(me, 'edit', db.tickets.find(t => t.id === id))) throw new Error('แก้ไขได้เฉพาะคำขอของคุณที่ยังรออนุมัติ');
      if (!input.items?.length || input.items.some(i => !String(i.detail || '').trim())) throw new Error('กรุณาระบุรายละเอียดของทุกรายการที่แจ้งซ่อม');
      if (CLOUD) {
        for (const it of input.items) it.photos = await Cloud.upload(it.photos);
        input.photos = await Cloud.upload(input.photos);
      }
      const t = commit(d => {
        const t = d.tickets.find(x => x.id === id);
        const user = d.users.find(u => u.email === me.email);
        Object.assign(t, { location: input.location, items: input.items, note: input.note || '', photos: input.photos || [] });
        Object.assign(t.reporter, { phone: input.phone || t.reporter.phone, dept: input.dept || t.reporter.dept, position: input.position || t.reporter.position });
        t.history.push({ at: nowISO(), by: fullName(user), action: 'แก้ไขคำขอ', note: '' });
        return t;
      });
      return settle(t, 400);
    },

    async cancelTicket(id, reason) {
      const me = currentUser();
      if (!can(me, 'cancel', db.tickets.find(t => t.id === id))) throw new Error('ยกเลิกได้เฉพาะคำขอของคุณที่ยังรออนุมัติ');
      const t = commit(d => {
        const t = d.tickets.find(x => x.id === id);
        const at = nowISO(), by = fullName(d.users.find(u => u.email === me.email));
        t.status = 'cancelled';
        t.cancel = { reason: reason || '', at, by };
        t.history.push({ at, by, action: 'ยกเลิกคำขอ', note: reason || '' });
        notify(d, d.users.filter(u => u.active && isStaff(u) && formsOf(u).includes(t.formType)).map(u => u.email), 'ผู้แจ้งยกเลิกคำขอ', `${t.id} · ${t.location.locationName}`, t.id);
        return t;
      });
      await settle(t, 300);
      if (CLOUD) Cloud.unshare([id]);
      return t;
    },

    // "ยังไม่หาย / เสียอีก" หลังเสร็จสิ้น → สร้างใบใหม่ที่อ้างอิงใบเดิม (แนบรูปได้ · เก็บสรุปการซ่อมครั้งก่อนไว้ในใบใหม่)
    async reopenTicket(id, detail, photos = []) {
      const me = currentUser();
      if (!can(me, 'reopen', db.tickets.find(t => t.id === id))) throw new Error(`แจ้ง "ยังไม่หาย" ได้ภายใน ${db.settings.reopenDays || 7} วันหลังซ่อมเสร็จ`);
      if (!String(detail || '').trim()) throw new Error('กรุณาระบุอาการที่ยังพบ');
      if (CLOUD) { photos = await Cloud.upload(photos); await Cloud.reserve(1); }
      const t = commit(d => {
        const old = d.tickets.find(x => x.id === id);
        const user = d.users.find(u => u.email === me.email);
        // รายการเดิม (ไม่เอารูปเก่ามา) · รูปใหม่ที่แนบอยู่ในรูปประกอบของใบ
        const items = old.items.map(i => ({ ...i, detail: `ยังไม่หาย: ${detail}`, photos: [] }));
        const prevRepair = { at: old.completion.at, worker: old.completion.worker || '', note: old.completion.note || '', by: old.completion.by || '' };
        const t = newTicket(d, { formType: old.formType, location: old.location, items, note: `แจ้งซ้ำจาก ${old.id} (ซ่อมเสร็จเมื่อ ${new Date(old.completion.at).toLocaleDateString('th-TH')})`, photos: photos.slice(0, 3) }, user,
          { reopenOf: old.id, reopenCount: (old.reopenCount || 0) + 1, reopenDetail: String(detail).trim(), prevRepair });
        old.reopenedBy = t.id;
        old.history.push({ at: nowISO(), by: fullName(user), action: 'แจ้งว่ายังไม่หาย', note: `เปิดใบใหม่ ${t.id} · ${detail}` });
        return t;
      });
      await settle(t, 500);
      if (CLOUD) Cloud.notifyNew([t.id]);
      return t;
    },

    // เปลี่ยนสถานะได้ทีละหลายรายการ คืนจำนวนที่สำเร็จและที่ข้าม
    async setStatus(ids, status, payload = {}) {
      const me = currentUser();
      if (!ACTIONS.includes(status)) throw new Error('สถานะไม่ถูกต้อง');
      if (status === 'cannot_fix' && !payload.reason) throw new Error('กรุณาระบุเหตุผลที่ซ่อมไม่ได้');
      if (CLOUD && payload.photos?.length) payload = { ...payload, photos: await Cloud.upload(payload.photos) };
      const res = commit(d => {
        const user = d.users.find(u => u.email === me.email);
        const at = nowISO();
        let ok = 0, skipped = 0;
        for (const id of [].concat(ids)) {
          const t = d.tickets.find(x => x.id === id);
          if (!t || !can(user, status, t)) { skipped++; continue; }
          applyStatus(d, t, status, payload, user, at);
          notify(d, [t.reporter.email], STATUS_TITLE[status], `${t.id} · ${t.location.locationName}`, t.id);
          ok++;
        }
        return { ok, skipped };
      });
      if (!res.ok) throw new Error('ไม่มีรายการที่คุณมีสิทธิ์เปลี่ยนเป็นสถานะนี้');
      await settle(res, 300);
      // ปิดงานแล้ว → ปิดสิทธิ์ลิงก์รูปที่เคยเปิดไว้ให้ LINE ดึงไปแสดง
      if (CLOUD && (status === 'done' || status === 'cannot_fix')) Cloud.unshare([].concat(ids));
      return res;
    },

    // ล้างข้อมูล (แอดมิน): ดูใบที่วันที่แจ้งอยู่ในช่วง [from, to) แล้วลบทั้งข้อมูลและรูปใน Drive (ย้ายไปถังขยะ)
    async purgePreview(from, to) {
      if (!hasRole(currentUser(), 'admin')) throw new Error('เฉพาะแอดมินเท่านั้น');
      const f = new Date(from).toISOString(), t = new Date(to).toISOString();
      if (CLOUD) return Cloud.fetchRange(f, t);
      return db.tickets.filter(x => x.createdAt >= f && x.createdAt < t);
    },
    async purge(list, onProgress) {
      if (!hasRole(currentUser(), 'admin')) throw new Error('เฉพาะแอดมินเท่านั้น');
      if (CLOUD) return Cloud.purge(list, onProgress);
      const ids = new Set(list.map(t => t.id));
      commit(d => { d.tickets = d.tickets.filter(t => !ids.has(t.id)); });
      return { tickets: ids.size, photos: 0, photoTotal: 0 };
    },
    photoRefs: t => photoRefsOf(t),

    reset() { if (CLOUD) return; localStorage.removeItem(DB_KEY); db = load(); emit(); }
  };

  // รูปทั้งหมดของใบแจ้งซ่อม (รายการ / รูปเพิ่มเติม / หลังซ่อม / ซ่อมไม่ได้)
  function photoRefsOf(t) {
    return [t.photos, t.completion?.photos, t.cannot?.photos, ...(t.items || []).map(i => i.photos)]
      .flat().filter(p => typeof p === 'string' && p);
  }

  // ═════════ ระบบจริง: Firebase (Firestore + Google Login) และ Apps Script (รูป / LINE) ═════════
  function makeCloud() {
    firebase.initializeApp(CFG.firebase);
    const auth = firebase.auth();
    const fs = firebase.firestore();
    try { fs.settings({ ignoreUndefinedProperties: true }); } catch (e) { /* ตั้งไว้แล้ว */ }
    fs.enablePersistence({ synchronizeTabs: true }).catch(() => { /* เบราว์เซอร์ไม่รองรับ ใช้แบบออนไลน์อย่างเดียว */ });

    const DOMAIN = (CFG.domain || 'pcshspt.ac.th').toLowerCase();
    const ADMINS = (CFG.bootstrapAdmins || []).map(s => s.toLowerCase());
    const OPEN = ['pending', 'in_progress', 'review'];
    const DAY = 864e5;
    const since = days => new Date(Date.now() - days * DAY).toISOString();
    const cfgDoc = name => fs.collection('config').doc(name);
    const strip = o => JSON.parse(JSON.stringify(o));
    const sleep = ms => new Promise(res => setTimeout(res, ms));

    let me = null, loginError = '', configMissing = false;
    let ownUnsub = null, dataUnsubs = [], usersList = [];
    let loadedFrom = null;           // ใบแจ้งซ่อมที่โหลดไว้ครบตั้งแต่วันที่นี้ (แอดมิน/ผู้บริหาร)
    const sets = new Map();          // ชื่อ listener → { kind: 'full' | 'board', m: Map(id → ข้อมูล) }
    const extra = new Map();         // ใบเก่าที่โหลดเพิ่มตามช่วงเวลา
    let authWaiters = [];

    // ── รวมข้อมูลจากทุก listener เป็น db.tickets (ใบเต็มทับข้อมูลกระดาน) ──
    // ข้อมูลกระดาน (board) ไม่มีชื่อและเบอร์ผู้แจ้ง ใช้แสดงภาพรวมให้ทุกคนเห็น
    const fromBoard = p => ({
      note: '', photos: [], approvals: {}, review: null, inspection: null, ...p,
      reporter: { email: '', name: '', dept: '', phone: '', position: '', signature: '' },
      completion: p.completion || null, cannot: p.cannot || null,
      history: (p.history || []).map(h => ({ by: '', note: '', ...h })), items: p.items || [], _board: true
    });
    const project = t => ({
      id: t.id, formType: t.formType, status: t.status, createdAt: t.createdAt, updatedAt: t.updatedAt || t.createdAt,
      location: t.location,
      items: (t.items || []).map(i => ({ catId: i.catId, catName: i.catName, itemId: i.itemId || '', name: i.name, unit: i.unit || '', qty: i.qty || 0, detail: i.detail || '' })),
      batchIds: t.batchIds || null,
      completion: t.completion ? { at: t.completion.at } : null, cannot: t.cannot ? { at: t.cannot.at } : null,
      history: (t.history || []).map(h => ({ at: h.at, action: h.action })), sample: !!t.sample
    });
    let queued = false;
    function rebuild() {
      if (queued) return;
      queued = true;
      Promise.resolve().then(() => {
        queued = false;
        const map = new Map();
        sets.forEach(s => { if (s.kind === 'board') s.m.forEach((p, id) => map.set(id, fromBoard(p))); });
        extra.forEach((t, id) => map.set(id, t));
        sets.forEach(s => { if (s.kind === 'full') s.m.forEach((t, id) => map.set(id, t)); });
        const users = usersList.slice();
        if (me && !users.some(u => u.email === me.email)) users.push(me);
        db = { ...db, users, tickets: [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) };
        emit();
      });
    }
    function listenQuery(name, query, kind) {
      const m = new Map();
      sets.set(name, { kind, m });
      let firstDone;
      const first = new Promise(res => { firstDone = res; });
      const un = query.onSnapshot(snap => {
        snap.docChanges().forEach(ch => { if (ch.type === 'removed') m.delete(ch.doc.id); else m.set(ch.doc.id, ch.doc.data()); });
        firstDone(); rebuild();
      }, err => { console.error(name, err); firstDone(); });
      return { stop: () => { un(); sets.delete(name); }, first };
    }

    // ── ค่าตั้งระบบ (อ่านได้ทุกคน รวมถึงก่อนเข้าสู่ระบบ) ──
    const configReady = Promise.all([
      new Promise(res => cfgDoc('settings').onSnapshot(s => {
        configMissing = !s.exists;
        if (s.exists) db = { ...db, settings: { ...s.data(), running: db.settings.running || {} } };
        res(); emit();
      }, e => { console.error(e); res(); })),
      ...['categories', 'locations'].map(k => new Promise(res => cfgDoc(k).onSnapshot(s => {
        if (s.exists) db = { ...db, [k]: s.data().list || [] };
        res(); emit();
      }, e => { console.error(e); res(); }))),
      new Promise(res => fs.collection('staff').onSnapshot(s => {
        if (!s.empty) db = { ...db, staff: s.docs.map(x => x.data()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(({ order, ...m }) => m) };
        res(); emit();
      }, e => { console.error(e); res(); }))
    ]);

    // ── ผู้ใช้ที่เข้าสู่ระบบ ──
    const rolesKey = u => JSON.stringify([u.roles, u.forms, u.actions, u.active]);
    function stopUser() {
      ownUnsub?.(); ownUnsub = null;
      dataUnsubs.forEach(f => f()); dataUnsubs = [];
      sets.clear(); extra.clear(); usersList = []; loadedFrom = null;
    }
    // เปิด listener ตามบทบาท: โหลดเฉพาะที่ต้องใช้เพื่อประหยัดโควตาการอ่านแบบฟรี
    function startData() {
      dataUnsubs.forEach(f => f()); dataUnsubs = [];
      [...sets.keys()].forEach(k => sets.delete(k));
      const T = fs.collection('tickets'), B = fs.collection('board');
      const firsts = [];
      const L = (name, q, kind) => { const h = listenQuery(name, q, kind); dataUnsubs.push(h.stop); firsts.push(h.first); };
      L('mine', T.where('reporter.email', '==', me.email), 'full');
      L('boardOpen', B.where('status', 'in', OPEN), 'board');
      L('boardRecent', B.where('updatedAt', '>=', since(45)), 'board');
      if (hasRole(me, 'admin')) {
        L('open', T.where('status', 'in', OPEN), 'full');
        L('recent', T.where('updatedAt', '>=', since(120)), 'full');
        loadedFrom = since(120);
      } else if (hasRole(me, 'approver')) {
        (me.forms || []).forEach(f => L('form_' + f, T.where('formType', '==', f), 'full'));
        loadedFrom = '0000';
      } else loadedFrom = hasRole(me, 'executive') ? nowISO() : '0000';
      if (isBackOffice(me)) {
        dataUnsubs.push(fs.collection('users').onSnapshot(s => { usersList = s.docs.map(d => d.data()); rebuild(); }, e => console.error(e)));
      }
      return Promise.race([Promise.all(firsts), sleep(10000)]);
    }
    async function startUser(u, email) {
      const ref = fs.collection('users').doc(email);
      let snap = await ref.get();
      if (!snap.exists) {
        // ล็อกอินครั้งแรก: สร้างโปรไฟล์ครูให้อัตโนมัติ (แอดมินคนแรกได้สิทธิ์แอดมินด้วย)
        const [first, ...rest] = String(u.displayName || email.split('@')[0]).trim().split(/\s+/);
        await ref.set({
          email, prefix: '', first: first || '', last: rest.join(' '), position: 'ครู', dept: '', phone: '',
          roles: ADMINS.includes(email) ? ['teacher', 'admin'] : ['teacher'], forms: [...FORM_KEYS], actions: ['done', 'cannot_fix'],
          active: true, signature: '', createdAt: nowISO()
        });
        snap = await ref.get();
      }
      me = snap.data();
      if (me.active === false) {
        loginError = 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อฝ่ายบริหารงานทั่วไป';
        me = null;
        await auth.signOut();
        return;
      }
      await configReady;
      if (configMissing && hasRole(me, 'admin')) await seedCloud();
      // แอดมินเข้าสู่ระบบ → อัปเดตค่าตั้งระบบเป็นชุดล่าสุด (ครั้งเดียว)
      else if (hasRole(me, 'admin') && (db.settings.configVersion || 1) < CONFIG_VERSION) commit(d => upgradeConfig(d));
      let key = rolesKey(me);
      ownUnsub = ref.onSnapshot(s => {
        if (!s.exists) return;
        me = s.data();
        if (rolesKey(me) !== key) { key = rolesKey(me); startData(); }
        rebuild();
      }, e => console.error(e));
      await startData();
    }
    let authFirst;
    const authReady = new Promise(res => { authFirst = res; });
    auth.onAuthStateChanged(async u => {
      stopUser();
      me = null;
      if (u) {
        const email = String(u.email || '').toLowerCase();
        if (!email.endsWith('@' + DOMAIN) || !u.emailVerified) {
          loginError = `ใช้ได้เฉพาะบัญชีของโรงเรียน (@${DOMAIN}) เท่านั้น · บัญชี ${email} ไม่มีสิทธิ์ใช้งาน`;
          await auth.signOut();
        } else {
          try { await startUser(u, email); } catch (e) { console.error(e); loginError = friendly(e).message; me = null; }
        }
      }
      rebuild();
      authFirst();
      authWaiters.splice(0).forEach(f => f());
    });
    const ready = Promise.all([configReady, authReady]).then(() => sleep(0));

    // ── บันทึก: ส่งเฉพาะเอกสารที่เปลี่ยนไปในชุดเดียว (สำเร็จทั้งหมดหรือไม่บันทึกเลย) ──
    function diffList(a, b, key, onPut, onDel, withOrder) {
      const before = new Map((a || []).map((x, i) => [x[key], JSON.stringify(withOrder ? [x, i] : x)]));
      (b || []).forEach((x, i) => { if (before.get(x[key]) !== JSON.stringify(withOrder ? [x, i] : x)) onPut(x, i); });
      const keep = new Set((b || []).map(x => x[key]));
      before.forEach((_, k) => { if (!keep.has(k)) onDel(k); });
    }
    // กฎความปลอดภัยตรวจเอกสารได้จำกัดต่อการบันทึกหนึ่งชุด จึงแบ่งใบแจ้งซ่อมเป็นชุดละไม่เกิน 8 ใบ
    async function persist(prev, next) {
      const batches = [fs.batch()];
      let n = 0, tickets = 0;
      const put = (ref, data) => { batches[batches.length - 1].set(ref, strip(data)); n++; };
      const del = ref => { batches[batches.length - 1].delete(ref); n++; };
      const nextTicket = () => { if (tickets && tickets % 8 === 0) batches.push(fs.batch()); tickets++; };
      const { running: r0, ...s0 } = prev.settings, { running: r1, ...s1 } = next.settings;
      if (JSON.stringify(s0) !== JSON.stringify(s1)) put(cfgDoc('settings'), s1);
      ['categories', 'locations'].forEach(k => { if (JSON.stringify(prev[k]) !== JSON.stringify(next[k])) put(cfgDoc(k), { list: next[k] }); });
      diffList(prev.staff, next.staff, 'id', (m, i) => put(fs.collection('staff').doc(m.id), { ...m, order: i }), id => del(fs.collection('staff').doc(id)), true);
      diffList(prev.users, next.users, 'email', u => put(fs.collection('users').doc(u.email), u), id => del(fs.collection('users').doc(id)));
      const at = nowISO();
      diffList(prev.tickets, next.tickets, 'id', t => {
        if (t._board) return;
        nextTicket();
        t.updatedAt = at;
        put(fs.collection('tickets').doc(t.id), t);
        put(fs.collection('board').doc(t.id), project(t));
      }, id => { nextTicket(); del(fs.collection('tickets').doc(id)); del(fs.collection('board').doc(id)); });
      if (!n) return;
      // ชุดแรกมีใบใหม่/ใบเดิมที่อ้างอิงกัน (เช่น แจ้งยังไม่หาย) บันทึกพร้อมกัน ชุดถัดไปบันทึกต่อเนื่อง
      for (const b of batches) await b.commit();
    }
    // จองเลขที่ใบแจ้งซ่อม (ไม่ซ้ำแม้หลายคนกดส่งพร้อมกัน) แล้วให้ newTicket ใช้เลขต่อจากนี้
    async function reserve(k) {
      const y = beYear(new Date());
      const ref = fs.collection('counters').doc(String(y));
      const start = await fs.runTransaction(async tx => {
        const s = await tx.get(ref);
        const cur = s.exists ? s.data() : {};
        const n = cur.n || 0;
        tx.set(ref, { ...cur, n: n + k });
        return n + 1;
      });
      db.settings.running = { ...(db.settings.running || {}), [y]: start - 1 };
    }

    // ── ข้อมูลเริ่มต้นครั้งแรก (แอดมินคนแรกเข้าสู่ระบบ): ค่าตั้งระบบ + ใบแจ้งซ่อมตัวอย่าง ──
    async function seedCloud() {
      const data = seed();
      const { running, ...settings } = data.settings;
      settings.hasSamples = true;
      const writes = [[cfgDoc('settings'), settings], [cfgDoc('categories'), { list: data.categories }], [cfgDoc('locations'), { list: data.locations }]];
      data.staff.forEach((m, i) => writes.push([fs.collection('staff').doc(m.id), { ...m, order: i }]));
      data.tickets.forEach(t => {
        t.sample = true;
        t.updatedAt = t.history[t.history.length - 1].at;
        writes.push([fs.collection('tickets').doc(t.id), t], [fs.collection('board').doc(t.id), project(t)]);
      });
      Object.entries(running).forEach(([y, n]) => writes.push([fs.collection('counters').doc(String(y)), { n }]));
      for (let i = 0; i < writes.length; i += 400) {
        const b = fs.batch();
        writes.slice(i, i + 400).forEach(([ref, d]) => b.set(ref, strip(d)));
        await b.commit();
      }
      configMissing = false;
    }
    async function deleteSamples() {
      if (!hasRole(me, 'admin')) throw new Error('เฉพาะแอดมินเท่านั้น');
      const snap = await fs.collection('tickets').where('sample', '==', true).get();
      const ids = snap.docs.map(d => d.id);
      for (let i = 0; i < ids.length; i += 200) {
        const b = fs.batch();
        ids.slice(i, i + 200).forEach(id => { b.delete(fs.collection('tickets').doc(id)); b.delete(fs.collection('board').doc(id)); });
        await b.commit();
      }
      // ตั้งเลขที่ใบใหม่ให้ต่อจากใบจริงล่าสุดของแต่ละปี (ไม่มีใบจริง = เริ่ม 0001)
      const real = await fs.collection('tickets').get();
      const max = {};
      real.forEach(d => { const [, y, n] = d.id.split('-'); max[y] = Math.max(max[y] || 0, +n || 0); });
      const counters = await fs.collection('counters').get();
      const b = fs.batch();
      // floor = เลขสูงสุดของใบจริงที่เคยถูกล้างไปแล้ว (ห้ามนับซ้ำกับเอกสารที่เคยพิมพ์)
      counters.forEach(c => { const floor = c.data().floor || 0; b.set(c.ref, { n: Math.max(max[c.id] || 0, floor), floor }); });
      const { running, ...settings } = db.settings;
      b.set(cfgDoc('settings'), strip({ ...settings, hasSamples: false }));
      await b.commit();
      ids.forEach(id => { extra.delete(id); sets.forEach(s => s.m.delete(id)); });
      rebuild();
      return ids.length;
    }
    // ── ล้างข้อมูลตามช่วงวันที่แจ้ง (แอดมิน) ──
    async function fetchRange(from, to) {
      const snap = await fs.collection('tickets').where('createdAt', '>=', from).where('createdAt', '<', to).get();
      return snap.docs.map(d => d.data()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
    // ย้ายรูปไปถังขยะก่อน (ถ้าไม่สำเร็จ จะไม่ลบข้อมูล) แล้วจึงลบใบแจ้งซ่อมและข้อมูลกระดาน
    async function purge(list, onProgress = () => {}) {
      const driveIds = [...new Set(list.flatMap(photoRefsOf).filter(p => p.startsWith('drive:')).map(p => p.slice(6)))];
      let trashed = 0;
      for (let i = 0; i < driveIds.length; i += 50) {
        onProgress(`กำลังย้ายรูปไปถังขยะ ${Math.min(i + 50, driveIds.length)}/${driveIds.length} รูป`);
        const r = await callScript('trash', { ids: driveIds.slice(i, i + 50) });
        trashed += r.trashed || 0;
      }
      const ids = list.map(t => t.id);
      // จำเลขที่สูงสุดของใบจริงที่ถูกลบไว้ในตัวนับ เลขที่ใบจะไม่ย้อนกลับมาซ้ำ
      const top = {};
      list.filter(t => !t.sample).forEach(t => { const [, y, n] = t.id.split('-'); top[y] = Math.max(top[y] || 0, +n || 0); });
      for (const [y, n] of Object.entries(top)) {
        const ref = fs.collection('counters').doc(y), s = await ref.get(), cur = s.exists ? s.data() : {};
        await ref.set({ ...cur, n: Math.max(cur.n || 0, n), floor: Math.max(cur.floor || 0, n) });
      }
      for (let i = 0; i < ids.length; i += 200) {
        onProgress(`กำลังลบข้อมูล ${Math.min(i + 200, ids.length)}/${ids.length} ใบ`);
        const b = fs.batch();
        ids.slice(i, i + 200).forEach(id => { b.delete(fs.collection('tickets').doc(id)); b.delete(fs.collection('board').doc(id)); });
        await b.commit();
      }
      ids.forEach(id => { extra.delete(id); sets.forEach(s => s.m.delete(id)); });
      rebuild();
      return { tickets: ids.length, photos: trashed, photoTotal: driveIds.length };
    }

    async function ensureRange(from) {
      if (!me || !(hasRole(me, 'admin') || hasRole(me, 'executive'))) return false;
      const iso = from ? new Date(from).toISOString() : '0000';
      if (loadedFrom && iso >= loadedFrom) return false;
      let q = fs.collection('tickets').where('createdAt', '>=', iso);
      if (loadedFrom && loadedFrom !== '0000') q = q.where('createdAt', '<', loadedFrom);
      const snap = await q.get();
      snap.forEach(d => extra.set(d.id, d.data()));
      loadedFrom = iso;
      rebuild();
      return true;
    }

    // ── Apps Script: เก็บรูปลง Google Drive และแจ้งเตือน LINE ──
    async function callScript(action, payload) {
      if (!CFG.appsScriptUrl) throw new Error('ยังไม่ได้ตั้งค่าที่เก็บรูป (Apps Script) กรุณาติดต่อแอดมิน');
      if (!auth.currentUser) throw new Error('กรุณาเข้าสู่ระบบใหม่');
      const idToken = await auth.currentUser.getIdToken();
      let res;
      try {
        res = await fetch(CFG.appsScriptUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, idToken, ...payload }) });
      } catch (e) { throw new Error('เชื่อมต่อที่เก็บรูปไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่'); }
      const data = await res.json().catch(() => ({ ok: false, error: 'ที่เก็บรูปตอบกลับผิดรูปแบบ' }));
      if (!data.ok) throw new Error(data.error || 'ที่เก็บรูปตอบกลับผิดพลาด');
      return data;
    }
    async function upload(list) {
      return Promise.all((list || []).map(async p => {
        const m = typeof p === 'string' && p.match(/^data:([^;]+);base64,(.+)$/);
        if (!m) return p;
        const r = await callScript('upload', { mime: m[1], data: m[2] });
        return 'drive:' + r.id;
      }));
    }
    function notifyNew(ids) {
      if (!CFG.appsScriptUrl || !ids.length) return;
      callScript('notify', { ids }).catch(e => console.warn('แจ้งเตือน LINE ไม่สำเร็จ', e));
    }
    // ปิดสิทธิ์ลิงก์รูปของใบที่ปิดงานแล้ว (สคริปต์ตรวจสถานะจากฐานข้อมูลเองอีกครั้ง)
    function unshare(ids) {
      if (!CFG.appsScriptUrl) return;
      for (let i = 0; i < ids.length; i += 20) callScript('unshare', { ids: ids.slice(i, i + 20) }).catch(e => console.warn('ปิดสิทธิ์รูปไม่สำเร็จ', e));
    }
    // แสดงรูปจาก Drive: แทนที่ด้วยรูปรอโหลด แล้วดึงรูปจริงผ่าน Apps Script (ตรวจสิทธิ์ทุกครั้ง)
    const PLACEHOLDER = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><rect width="4" height="3" fill="#F3EFEA"/></svg>');
    const photoCache = new Map();
    function photo(id) {
      if (!photoCache.has(id)) {
        photoCache.set(id, callScript('image', { id }).then(r => {
          const bin = atob(r.data), bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          return URL.createObjectURL(new Blob([bytes], { type: r.mime }));
        }).catch(e => { photoCache.delete(id); throw e; }));
      }
      return photoCache.get(id);
    }
    function imgAttr(src) {
      const s = String(src || '');
      if (!s.startsWith('drive:')) return `src="${s}"`;
      return `src="${PLACEHOLDER}" data-drive="${s.slice(6).replace(/[^\w-]/g, '')}"`;
    }
    const resolveImg = img => {
      const id = img.dataset.drive;
      if (!id || img.dataset.driveState) return;
      img.dataset.driveState = 'loading';
      photo(id).then(url => { img.src = url; img.dataset.driveState = 'ok'; })
        .catch(() => { img.dataset.driveState = 'error'; img.alt = 'โหลดรูปไม่สำเร็จ'; });
    };
    new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(n => {
      if (n.nodeType !== 1) return;
      if (n.matches?.('img[data-drive]')) resolveImg(n);
      n.querySelectorAll?.('img[data-drive]').forEach(resolveImg);
    }))).observe(document.documentElement, { childList: true, subtree: true });

    // ── การแจ้งเตือนในเว็บ: สร้างจากประวัติของใบแจ้งซ่อม (ไม่ต้องเก็บแยก) ──
    const READ_KEY = email => `pcshs-notif-read:${email}`;
    const readState = email => { try { return JSON.parse(localStorage.getItem(READ_KEY(email)) || '{}'); } catch (e) { return {}; } };
    const STAFF_EVENTS = { 'แจ้งซ่อม': 'มีการแจ้งซ่อมใหม่', 'ยกเลิกคำขอ': 'ผู้แจ้งยกเลิกคำขอ', 'แก้ไขคำขอ': 'ผู้แจ้งแก้ไขคำขอ' };
    const STATUS_EVENTS = { 'กำลังดำเนินการซ่อม': 'in_progress', 'รอพิจารณา': 'review', 'เสร็จสิ้น': 'done', 'ไม่สามารถซ่อมได้': 'cannot_fix' };
    function notifications(u) {
      const st = readState(u.email), readAt = st.at || '', ids = new Set(st.ids || []);
      const myName = fullName(u), forms = formsOf(u), from = since(60);
      const out = [];
      for (const t of db.tickets) {
        if (t._board) continue;
        const mine = t.reporter.email === u.email, staff = forms.includes(t.formType) && !mine;
        t.history.forEach((h, i) => {
          if (h.at < from || h.by === myName) return;
          const reopen = staff && h.action.startsWith('แจ้งซ้ำ');
          const title = staff ? (reopen ? REOPEN_TITLE : STAFF_EVENTS[h.action])
            : mine ? STATUS_TITLE[STATUS_EVENTS[h.action]] : null;
          if (!title) return;
          const id = `${t.id}#${i}`;
          out.push({ id, to: u.email, at: h.at, title, body: reopen && t.reopenOf ? reopenBody(t) : `${t.id} · ${t.location.locationName}`, ticketId: t.id, read: h.at <= readAt || ids.has(id), ...(reopen ? { kind: 'reopen' } : {}) });
        });
      }
      return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 50);
    }
    function markRead(u, id) {
      const st = readState(u.email);
      if (id) st.ids = [...new Set([...(st.ids || []), id])].slice(-200);
      else { st.at = nowISO(); st.ids = []; }
      try { localStorage.setItem(READ_KEY(u.email), JSON.stringify(st)); } catch (e) { /* ignore */ }
      emit();
    }

    // ── เข้าสู่ระบบ / ออกจากระบบ ──
    const AUTH_MSG = {
      'auth/popup-blocked': 'เบราว์เซอร์บล็อกหน้าต่างเข้าสู่ระบบ กรุณาอนุญาตป๊อปอัปแล้วลองใหม่',
      'auth/popup-closed-by-user': 'ปิดหน้าต่างเข้าสู่ระบบก่อนเสร็จ กรุณาลองใหม่',
      'auth/cancelled-popup-request': 'กรุณากดเข้าสู่ระบบอีกครั้ง',
      'auth/unauthorized-domain': 'เว็บไซต์นี้ยังไม่ได้รับอนุญาตให้เข้าสู่ระบบ กรุณาติดต่อแอดมิน',
      'auth/network-request-failed': 'เชื่อมต่ออินเทอร์เน็ตไม่ได้ ลองใหม่อีกครั้ง'
    };
    async function login() {
      loginError = '';
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ hd: DOMAIN, prompt: 'select_account' });
      const settled = new Promise(res => authWaiters.push(res));
      try { await auth.signInWithPopup(provider); }
      catch (e) { authWaiters = authWaiters.filter(f => f !== settled); throw new Error(AUTH_MSG[e.code] || e.message); }
      await settled;
      if (!me) throw new Error(loginError || 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่');
      return me;
    }
    function friendly(e) {
      const code = String(e?.code || '');
      if (code.includes('permission-denied')) return new Error('ระบบความปลอดภัยไม่อนุญาตให้ทำรายการนี้ (ไม่มีสิทธิ์)');
      if (code.includes('unavailable')) return new Error('เชื่อมต่อฐานข้อมูลไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
      return e instanceof Error ? e : new Error(String(e));
    }

    return {
      ready, rebuild, persist, reserve, friendly, ensureRange, deleteSamples, upload, notifyNew, unshare, imgAttr, fetchRange, purge,
      notifications, markRead, login,
      logout: () => auth.signOut(),
      me: () => me
    };
  }
})();
