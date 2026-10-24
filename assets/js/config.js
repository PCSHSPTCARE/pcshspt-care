/* ค่าการเชื่อมต่อระบบจริง
   - firebase: ค่าจาก Firebase → Settings → General → Your apps (เปิดเผยได้ ความปลอดภัยอยู่ที่ Firestore Rules)
   - appsScriptUrl: ลิงก์ Web app ของ Apps Script (เก็บรูปลง Google Drive + แจ้งเตือน LINE)
   - bootstrapAdmins: แอดมินคนแรก (ต้องตรงกับในไฟล์ firestore.rules)
   เปิดจากไฟล์ในเครื่อง (file://) หรือเติม ?local ท้ายลิงก์ จะใช้ข้อมูลทดลองในเบราว์เซอร์แทน */
window.APP_CONFIG = {
  domain: 'pcshspt.ac.th',
  firebase: {
    apiKey: 'AIzaSyCtpXj7Rnjzv7I6yNXLgwOQ28zA6vmXs0E',
    authDomain: 'pcshs-repair-da0cc.firebaseapp.com',
    projectId: 'pcshs-repair-da0cc',
    storageBucket: 'pcshs-repair-da0cc.firebasestorage.app',
    messagingSenderId: '2077283806',
    appId: '1:2077283806:web:dc894edb04382be475b94f'
  },
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbxZay0to-nXJVXQ5wcXA8l5VwL0bPYHw34oJbGwmTiZTbHED7nIfqb1KWlrgE9ti3M/exec',
  bootstrapAdmins: ['tripop@pcshspt.ac.th']
};
