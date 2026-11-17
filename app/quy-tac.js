/* Quy tắc chuẩn hoá và kiểm tra dữ liệu đăng ký — docs/04-quy-tac-du-lieu.html.
   Một file dùng chung: trình duyệt nạp bằng <script>, máy chủ nạp bằng require(),
   để hai bên luôn cùng một bộ quy tắc. */
(function (goc, tao) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = tao();
  else goc.QuyTac = tao();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var HO_TEN_TOI_THIEU = 2;
  var HO_TEN_TOI_DA = 60;
  var EMAIL_TOI_DA = 254;

  var LOI = {
    hoTen: 'Họ tên cần từ 2 đến 60 ký tự, không chứa số.',
    email: 'Email chưa đúng định dạng.',
    soDienThoai: 'Số điện thoại cần 10 chữ số, ví dụ 0912 345 678.',
  };

  // Bắt đầu bằng chữ cái; chỉ gồm chữ cái của mọi ngôn ngữ, khoảng trắng, ' - .
  var MAU_HO_TEN = /^\p{L}[\p{L}\p{M} '.\-]*$/u;
  var MAU_SO_DIEN_THOAI = /^0[35789]\d{8}$/;

  function chuoi(v) {
    return typeof v === 'string' ? v : '';
  }

  function chuanHoaHoTen(v) {
    return chuoi(v).normalize('NFC').replace(/\s+/g, ' ').trim();
  }

  function chuanHoaEmail(v) {
    return chuoi(v).trim().toLowerCase();
  }

  function chuanHoaSoDienThoai(v) {
    var s = chuoi(v).replace(/[\s.\-()]/g, '');
    if (/^\+?84\d{9}$/.test(s)) s = '0' + s.slice(-9);
    return s;
  }

  function hoTenHopLe(s) {
    var doDai = Array.from(s).length;
    return doDai >= HO_TEN_TOI_THIEU && doDai <= HO_TEN_TOI_DA && MAU_HO_TEN.test(s);
  }

  function emailHopLe(s) {
    if (s.length === 0 || s.length > EMAIL_TOI_DA || /\s/.test(s)) return false;
    var phan = s.split('@');
    if (phan.length !== 2) return false;
    var truoc = phan[0];
    var sau = phan[1];
    if (truoc === '' || sau === '') return false;
    if (sau.indexOf('.') === -1 || sau[0] === '.' || sau[sau.length - 1] === '.') return false;
    return true;
  }

  function soDienThoaiHopLe(s) {
    return MAU_SO_DIEN_THOAI.test(s);
  }

  /* Nhận {hoTen, email, soDienThoai} thô.
     Trả {hopLe, giaTri: bản đã chuẩn hoá, truong: {tên ô sai: câu lỗi}}. */
  function kiemTraDangKy(duLieu) {
    var d = duLieu || {};
    var giaTri = {
      hoTen: chuanHoaHoTen(d.hoTen),
      email: chuanHoaEmail(d.email),
      soDienThoai: chuanHoaSoDienThoai(d.soDienThoai),
    };
    var truong = {};
    if (!hoTenHopLe(giaTri.hoTen)) truong.hoTen = LOI.hoTen;
    if (!emailHopLe(giaTri.email)) truong.email = LOI.email;
    if (!soDienThoaiHopLe(giaTri.soDienThoai)) truong.soDienThoai = LOI.soDienThoai;
    return { hopLe: Object.keys(truong).length === 0, giaTri: giaTri, truong: truong };
  }

  /* Dạng để tìm kiếm: viết thường, bỏ dấu, đ → d, gộp khoảng trắng. */
  function boDau(v) {
    return chuoi(v)
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/đ/g, 'd')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return {
    HO_TEN_TOI_THIEU: HO_TEN_TOI_THIEU,
    HO_TEN_TOI_DA: HO_TEN_TOI_DA,
    EMAIL_TOI_DA: EMAIL_TOI_DA,
    LOI: LOI,
    chuanHoaHoTen: chuanHoaHoTen,
    chuanHoaEmail: chuanHoaEmail,
    chuanHoaSoDienThoai: chuanHoaSoDienThoai,
    hoTenHopLe: hoTenHopLe,
    emailHopLe: emailHopLe,
    soDienThoaiHopLe: soDienThoaiHopLe,
    kiemTraDangKy: kiemTraDangKy,
    boDau: boDau,
  };
});
