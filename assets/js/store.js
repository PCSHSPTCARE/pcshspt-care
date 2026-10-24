/* ชั้นข้อมูลของระบบ (ต้นแบบ)
   ตอนนี้เก็บข้อมูลจำลองไว้ใน localStorage ของเบราว์เซอร์
   ตอนต่อระบบจริง จะเปลี่ยนเฉพาะไฟล์นี้ให้เรียก Google Apps Script (google.script.run) แทน
   หน้าจออื่นทั้งหมดเรียกผ่าน Store.* เท่านั้น */
const Store = (() => {
  const DB_KEY = 'pcshs-repair-db-v5';
  const SESSION_KEY = 'pcshs-repair-session-v1';
  const listeners = new Set();

  // ───────── ค่าคงที่ ─────────
  const FORM_KEYS = ['general', 'dorm'];
  // ผู้ลงนามช่องที่ 1 ตามแบบฟอร์ม · ช่องที่ 2 เป็นรอง ผอ.ฝ่ายบริหารงานทั่วไปเสมอ
  const STEP1_KEY = { general: 'head_building', dorm: 'deputy_student' };
  const STEP2_KEY = 'deputy_general';
  // สถานะที่กดเปลี่ยนได้ (รออนุมัติเป็นสถานะเริ่มต้นเท่านั้น)
  const ACTIONS = ['in_progress', 'review', 'done', 'cannot_fix'];

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
        it('พัดลมเพดาน', 'ตัว'), it('พัดลมผนัง', 'ตัว'), it('ปลั๊ก', '', DORM)] },
      { id: 'plumb', name: 'งานประปา', icon: 'droplet', forms: ['general', 'dorm'], active: true, items: [
        it('ก๊อกสนาม'), it('ก๊อกซิ้งค์'), it('ก๊อกอ่าง'), it('สายชำระ'), it('สายน้ำดี'), it('สะดืออ่าง'), it('โถปัสสาวะ'), it('โถชักโครก'),
        it('ฝาชักโครก', '', DORM), it('ฝักบัว', '', DORM), it('อ่างล้างมือ', '', DORM)] },
      { id: 'wood', name: 'งานไม้', icon: 'hammer', forms: ['general', 'dorm'], active: true, items: [
        it('ประตู'), it('หน้าต่าง'), it('โต๊ะ/ตู้/กระดาน', '', GEN), it('กลอนประตู'), it('กุญแจลิ้นชัก'), it('บานพับ'), it('สายยู'), it('ลูกบิดประตู'), it('เตียง', '', DORM)] },
      { id: 'alu', name: 'งานอลูมิเนียม+กระจก', icon: 'window', forms: ['general', 'dorm'], active: true, items: [
        it('ประตูบานสวิง'), it('ประตูบานเลื่อน'), it('หน้าต่างบานเลื่อน'), it('หน้าต่างบานเปิด-ปิด'), it('มือจับประตู')] },
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
    return [
      L('building', 'ห้องประชุม / หอประชุม', 'บรรยายรวม'), L('building', 'ห้องประชุม / หอประชุม', 'หอประชุม 1'),
      L('building', 'ห้องประชุม / หอประชุม', 'หอประชุม 2'), L('building', 'ห้องประชุม / หอประชุม', 'ห้องประชุมพระยาสุรินทร์'),
      L('building', 'ห้องประชุม / หอประชุม', 'ห้องประชุมแคแสด'), L('building', 'ห้องประชุม / หอประชุม', 'ห้องประชุมสุวรรณภูมิ'),
      L('building', 'สถานที่อื่น ๆ', 'โรงอาหาร'), L('building', 'สถานที่อื่น ๆ', 'โรงยิมชั้น 1'),
      L('building', 'สถานที่อื่น ๆ', 'โรงยิมชั้น 2'), L('building', 'สถานที่อื่น ๆ', 'โดมอเนกประสงค์'),
      ...[[1, 4], [2, 4], [3, 4], [4, 6], [5, 6], [6, 6]].map(([m, n]) =>
        L('building', 'ห้องเรียน ม.1 – ม.6', `ห้องเรียน ม.${m}`, [{ name: '', rooms: nums(m * 100 + 1, m * 100 + n) }])),
      L('building', 'ห้องปฏิบัติการ', 'ห้องคอมพิวเตอร์ 1'), L('building', 'ห้องปฏิบัติการ', 'ห้องคอมพิวเตอร์ 2'),
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
        deputy_student: { title: 'รองผู้อำนวยการฝ่ายกิจการนักเรียนและหอพัก', email: `chutirat.k@${domain}` }
      },
      forms: {
        general: { name: 'แจ้งซ่อมทั่วไป', desc: 'อาคารเรียน ห้องเรียน ห้องปฏิบัติการ และพื้นที่ส่วนกลาง', enabled: true,
          subject: 'ขออนุญาตแจ้งซ่อม ไฟฟ้า ประปา งานไม้ งานอะลูมิเนียม และอื่นๆ',
          notes: ['ให้ผู้ขออนุญาตลงนามและกรอกข้อมูลตามแบบฟอร์มให้ละเอียดชัดเจน นำส่งที่ฝ่ายบริหารทั่วไป', 'ติดต่อประสานงาน นายไชยวัฒน์  กุณฑล'] },
        dorm: { name: 'แจ้งซ่อมหอพักนักเรียน', desc: 'ไฟฟ้า ประปา งานไม้ อลูมิเนียม และอื่น ๆ ภายในหอพัก', enabled: true,
          subject: 'ขออนุญาตแจ้งซ่อม ไฟฟ้า ประปา งานไม้ งานอะลูมิเนียม และอื่นๆ ในหอพักนักเรียน',
          notes: ['ให้ผู้ขออนุญาตลงนามและกรอกข้อมูลตามแบบฟอร์มให้ละเอียดชัดเจน นำส่งที่ฝ่ายกิจการนักเรียนและหอพัก', 'ติดต่อประสานงาน นายพิทักษ์  แซ่โง้ว'] }
      },
      reopenDays: 14,
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
        return d;
      }
    } catch (e) { /* ใช้ข้อมูลเริ่มต้นแทน */ }
    const d = seed();
    try { localStorage.setItem(DB_KEY, JSON.stringify(d)); } catch (e) { /* โหมดส่วนตัว */ }
    return d;
  }
  let db = load();
  function commit(mutator) {
    const draft = clone(db);
    const result = mutator(draft);
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(draft));
    } catch (e) {
      throw new Error('พื้นที่เก็บข้อมูลของเบราว์เซอร์เต็ม (ต้นแบบเก็บรูปไว้ในเครื่อง) ลองลดจำนวนหรือขนาดรูปภาพ');
    }
    db = draft;
    emit();
    return result;
  }
  function emit() { listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); }
  window.addEventListener('storage', e => {
    if (e.key === DB_KEY && e.newValue) { db = JSON.parse(e.newValue); emit(); }
    if (e.key === SESSION_KEY) emit();
  });
  const delay = (v, ms = 160) => new Promise(res => setTimeout(() => res(v), ms));

  // ───────── สิทธิ์ ─────────
  function currentUser() {
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
      (Date.now() - new Date(t.completion?.at || 0)) / 864e5 <= (db.settings.reopenDays || 14);
    return false;
  }
  const deadline = t => new Date(new Date(t.completion?.at || 0).getTime() + (db.settings.reopenDays || 14) * 864e5);
  // คำขอที่ยังเปิดอยู่ในสถานที่เดียวกันและมีรายการซ้ำกัน
  function duplicatesOf(input, exceptId) {
    const room = s => String(s || '').replace(/\s|ห้อง/g, '').toLowerCase();
    const names = new Set(input.items.map(i => `${i.catId}|${i.name}`));
    return db.tickets.filter(t => t.id !== exceptId && ['pending', 'in_progress', 'review'].includes(t.status)
      && t.formType === input.formType && t.location.locationName === input.location.locationName
      && (t.location.zone || '') === (input.location.zone || '') && room(t.location.room) === room(input.location.room)
      && t.items.some(i => names.has(`${i.catId}|${i.name}`)));
  }

  function notify(d, emails, title, body, ticketId) {
    const seen = new Set();
    for (const to of emails) {
      if (!to || seen.has(to)) continue;
      seen.add(to);
      d.notifications.push({ id: uid('n'), to, at: nowISO(), title, body, ticketId, read: false });
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
      extra.reopenOf ? 'แจ้งซ้ำ: ซ่อมแล้วยังไม่หาย' : 'มีการแจ้งซ่อมใหม่', `${t.id} · ${t.location.locationName}`, t.id);
    return t;
  }

  // ───────── API ─────────
  return {
    FORM_KEYS, STEP1_KEY, STEP2_KEY, ACTIONS,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    fullName, hasRole, isStaff, isBackOffice, can, canSee, formsOf, actionsOf, reopenDeadline: deadline,
    duplicates: (input, exceptId) => duplicatesOf(input, exceptId),
    step1Key: t => STEP1_KEY[t.formType],
    signer: key => signerOf(db, key),

    // เซสชัน
    me: currentUser,
    async login(email) {
      email = String(email || '').trim().toLowerCase();
      const domain = db.settings.domain.toLowerCase();
      if (!email.endsWith('@' + domain)) throw new Error(`ใช้ได้เฉพาะอีเมลของโรงเรียน (@${domain}) เท่านั้น`);
      const u = db.users.find(x => x.email.toLowerCase() === email);
      if (!u || !u.active) throw new Error('บัญชีนี้ยังไม่มีสิทธิ์ใช้งานระบบ ระบบแจ้งซ่อมเปิดให้เฉพาะครูและบุคลากร หากเป็นครูกรุณาติดต่อฝ่ายบริหารงานทั่วไปเพื่อเพิ่มรายชื่อ');
      localStorage.setItem(SESSION_KEY, u.email);
      emit();
      return delay(u, 450);
    },
    logout() { localStorage.removeItem(SESSION_KEY); emit(); },
    // เฉพาะต้นแบบ: เปิด index.html?as=ชื่ออีเมล เพื่อเข้าในบทบาทนั้นทันที (ตัดออกในระบบจริง)
    demoLogin(local) {
      const u = db.users.find(x => x.email.split('@')[0] === local);
      try { if (u) localStorage.setItem(SESSION_KEY, u.email); else localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
    },

    // ตั้งค่า / ข้อมูลหลัก
    settings: () => db.settings,
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
      return db.notifications.filter(n => n.to === me.email).sort((a, b) => b.at.localeCompare(a.at));
    },
    markRead(id) {
      const me = currentUser();
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
      const list = commit(d => {
        const user = d.users.find(u => u.email === me.email);
        if (input.phone && input.phone !== user.phone) user.phone = input.phone;
        const batch = entries.length > 1 ? uid('B') : null;
        const made = entries.map(({ location, items }) => newTicket(d, { ...input, location, items }, user, batch ? { batch } : {}));
        if (batch) made.forEach(t => { t.batchIds = made.map(x => x.id); });
        return made;
      });
      return delay(list, 600);
    },

    // ผู้แจ้งแก้ไขคำขอที่ยังรออนุมัติ (เลขที่เดิม)
    async updateTicket(id, input) {
      const me = currentUser();
      if (!can(me, 'edit', db.tickets.find(t => t.id === id))) throw new Error('แก้ไขได้เฉพาะคำขอของคุณที่ยังรออนุมัติ');
      if (!input.items?.length || input.items.some(i => !String(i.detail || '').trim())) throw new Error('กรุณาระบุรายละเอียดของทุกรายการที่แจ้งซ่อม');
      const t = commit(d => {
        const t = d.tickets.find(x => x.id === id);
        const user = d.users.find(u => u.email === me.email);
        Object.assign(t, { location: input.location, items: input.items, note: input.note || '', photos: input.photos || [] });
        Object.assign(t.reporter, { phone: input.phone || t.reporter.phone, dept: input.dept || t.reporter.dept, position: input.position || t.reporter.position });
        t.history.push({ at: nowISO(), by: fullName(user), action: 'แก้ไขคำขอ', note: '' });
        return t;
      });
      return delay(t, 400);
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
      return delay(t, 300);
    },

    // "ยังไม่หาย / เสียอีก" หลังเสร็จสิ้น → สร้างใบใหม่ที่อ้างอิงใบเดิม
    async reopenTicket(id, detail) {
      const me = currentUser();
      if (!can(me, 'reopen', db.tickets.find(t => t.id === id))) throw new Error(`แจ้ง "ยังไม่หาย" ได้ภายใน ${db.settings.reopenDays || 14} วันหลังซ่อมเสร็จ`);
      if (!String(detail || '').trim()) throw new Error('กรุณาระบุอาการที่ยังพบ');
      const t = commit(d => {
        const old = d.tickets.find(x => x.id === id);
        const user = d.users.find(u => u.email === me.email);
        const items = old.items.map(i => ({ ...i, detail: `ยังไม่หาย: ${detail}` }));
        const t = newTicket(d, { formType: old.formType, location: old.location, items, note: `แจ้งซ้ำจาก ${old.id} (ซ่อมเสร็จเมื่อ ${new Date(old.completion.at).toLocaleDateString('th-TH')})`, photos: [] }, user, { reopenOf: old.id });
        old.reopenedBy = t.id;
        old.history.push({ at: nowISO(), by: fullName(user), action: 'แจ้งว่ายังไม่หาย', note: `เปิดใบใหม่ ${t.id} · ${detail}` });
        return t;
      });
      return delay(t, 500);
    },

    // เปลี่ยนสถานะได้ทีละหลายรายการ คืนจำนวนที่สำเร็จและที่ข้าม
    async setStatus(ids, status, payload = {}) {
      const me = currentUser();
      if (!ACTIONS.includes(status)) throw new Error('สถานะไม่ถูกต้อง');
      if (status === 'cannot_fix' && !payload.reason) throw new Error('กรุณาระบุเหตุผลที่ซ่อมไม่ได้');
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
      return delay(res, 300);
    },

    reset() { localStorage.removeItem(DB_KEY); db = load(); emit(); }
  };
})();
