// API phía admin: đăng nhập, danh sách, xoá, xuất CSV — docs/04-quy-tac-du-lieu.html.
const crypto = require('node:crypto');
const db = require('./db');
const quyTac = require('../app/quy-tac.js');
const { LoiHttp, guiJson, docThan, diaChiMang } = require('./tien-ich');

const SO_LAN_SAI_TOI_DA = 5;
const CUA_SO_SAI = 15 * 60 * 1000;
const THOI_GIAN_KHOA = 15 * 60 * 1000;
const HAN_PHIEN_ADMIN = 8 * 60 * 60 * 1000;
const MAT_KHAU_TOI_THIEU = 8;
const SO_DONG_MOI_TRANG = 50;
const TU_KHOA_TOI_DA = 100;
const TEN_COOKIE = 'phien';
const LECH_GIO_VN = 7 * 60 * 60 * 1000;

const ADMIN_USER = process.env.ADMIN_USER || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const DA_CAU_HINH = ADMIN_USER.length > 0 && ADMIN_PASSWORD.length >= MAT_KHAU_TOI_THIEU;

function canhBaoCauHinh() {
  if (!DA_CAU_HINH) {
    console.warn(
      'CẢNH BÁO: chưa đặt ADMIN_USER hoặc ADMIN_PASSWORD (tối thiểu 8 ký tự). ' +
      'Trang admin bị khoá; game và đăng ký vẫn chạy.'
    );
  }
}

/* ---------- Phiên đăng nhập (giữ trong bộ nhớ, mất khi máy chủ khởi động lại) ---------- */
const cacPhien = new Map(); // mã phiên → thời điểm hết hạn
const lanSai = new Map();   // địa chỉ mạng → { cac: [thời điểm sai], khoaDen }

setInterval(() => {
  const bayGio = Date.now();
  for (const [ma, han] of cacPhien) if (han <= bayGio) cacPhien.delete(ma);
  for (const [ip, tt] of lanSai) {
    if (tt.khoaDen <= bayGio && tt.cac.every((t) => t <= bayGio - CUA_SO_SAI)) lanSai.delete(ip);
  }
}, 60 * 1000).unref();

// So sánh có thời gian không đổi: băm hai bên về cùng độ dài rồi mới so.
function bangNhau(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function docCookie(req, ten) {
  for (const phan of (req.headers.cookie || '').split(';')) {
    const i = phan.indexOf('=');
    if (i !== -1 && phan.slice(0, i).trim() === ten) return phan.slice(i + 1).trim();
  }
  return null;
}

function cookiePhien(req, giaTri, tuoiGiay) {
  const https = req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https';
  return `${TEN_COOKIE}=${giaTri}; HttpOnly; SameSite=Strict; Path=/admin; Max-Age=${tuoiGiay}` +
    (https ? '; Secure' : '');
}

function coPhien(req) {
  const ma = docCookie(req, TEN_COOKIE);
  if (!ma) return false;
  const han = cacPhien.get(ma);
  if (!han) return false;
  if (han <= Date.now()) {
    cacPhien.delete(ma);
    return false;
  }
  return true;
}

// POST /admin/api/dang-nhap  {tenDangNhap, matKhau} → 200 + cookie | 401 | 429
async function dangNhap(req, res) {
  const ip = diaChiMang(req);
  const bayGio = Date.now();
  const tt = lanSai.get(ip) || { cac: [], khoaDen: 0 };
  if (tt.khoaDen > bayGio) throw new LoiHttp(429, 'BI_KHOA'); // đang khoá: mật khẩu đúng cũng từ chối

  const { tenDangNhap, matKhau } = await docThan(req);
  const dungTen = bangNhau(typeof tenDangNhap === 'string' ? tenDangNhap : '', ADMIN_USER);
  const dungMatKhau = bangNhau(typeof matKhau === 'string' ? matKhau : '', ADMIN_PASSWORD);

  if (!(DA_CAU_HINH && dungTen && dungMatKhau)) {
    tt.cac = tt.cac.filter((t) => t > bayGio - CUA_SO_SAI);
    tt.cac.push(bayGio);
    if (tt.cac.length >= SO_LAN_SAI_TOI_DA) {
      tt.cac = [];
      tt.khoaDen = bayGio + THOI_GIAN_KHOA;
      lanSai.set(ip, tt);
      throw new LoiHttp(429, 'BI_KHOA');
    }
    lanSai.set(ip, tt);
    throw new LoiHttp(401, 'SAI_THONG_TIN');
  }

  lanSai.delete(ip);
  const ma = crypto.randomBytes(32).toString('hex');
  cacPhien.set(ma, bayGio + HAN_PHIEN_ADMIN);
  guiJson(res, 200, { ok: true }, { 'Set-Cookie': cookiePhien(req, ma, HAN_PHIEN_ADMIN / 1000) });
}

// POST /admin/api/dang-xuat → 200, huỷ phiên và xoá cookie
async function dangXuat(req, res) {
  const ma = docCookie(req, TEN_COOKIE);
  if (ma) cacPhien.delete(ma);
  guiJson(res, 200, { ok: true }, { 'Set-Cookie': cookiePhien(req, '', 0) });
}

/* ---------- Tìm kiếm và sắp xếp ---------- */
// Trả mệnh đề WHERE và tham số cho từ khoá. Dùng position() nên % và _ không phải ký tự đại diện.
function dieuKienTim(tuKhoaTho) {
  const tim = Array.from(String(tuKhoaTho || '').trim()).slice(0, TU_KHOA_TOI_DA).join('').trim();
  if (tim === '') return { tim, menhDe: '', thamSo: [] };

  const thamSo = [];
  const cac = [];
  const them = (cot, giaTri) => {
    thamSo.push(giaTri);
    cac.push(`position($${thamSo.length} in ${cot}) > 0`);
  };

  const chu = quyTac.boDau(tim);
  if (chu !== '') {
    them('ho_ten_tim', chu);
    them('email', chu);
  }
  // Dạng số: từ khoá chỉ gồm chữ số, khoảng trắng, chấm, gạch và dấu + ở đầu.
  if (/^\+?[\d\s.\-]+$/.test(tim)) {
    const so = tim.replace(/\D/g, '');
    if (so !== '') {
      them('so_dien_thoai', so);
      if (so.startsWith('84')) them('so_dien_thoai', '0' + so.slice(2));
    }
  }
  return { tim, menhDe: cac.length ? `WHERE (${cac.join(' OR ')})` : 'WHERE FALSE', thamSo };
}

function thuTu(sapXep) {
  return sapXep === 'diem'
    ? 'ORDER BY diem_cao_nhat DESC, dang_ky_luc ASC, id ASC'
    : 'ORDER BY dang_ky_luc DESC, id DESC';
}

// GET /admin/api/nguoi-choi?tim=&sapXep=moi-nhat|diem&trang=1
async function danhSach(req, res, url) {
  const { menhDe, thamSo } = dieuKienTim(url.searchParams.get('tim'));
  const sapXep = url.searchParams.get('sapXep') === 'diem' ? 'diem' : 'moi-nhat';

  const dem = await db.query(
    `SELECT (SELECT count(*) FROM nguoi_choi)::int AS tong,
            (SELECT count(*) FROM nguoi_choi ${menhDe})::int AS so_khop`,
    thamSo
  );
  const { tong, so_khop: soKhop } = dem.rows[0];
  const soTrang = Math.max(1, Math.ceil(soKhop / SO_DONG_MOI_TRANG));
  let trang = Number.parseInt(url.searchParams.get('trang'), 10);
  if (!Number.isFinite(trang) || trang < 1) trang = 1;
  if (trang > soTrang) trang = soTrang;

  const kq = await db.query(
    `SELECT id, ho_ten, email, so_dien_thoai, diem_cao_nhat, so_luot, dang_ky_luc
       FROM nguoi_choi ${menhDe} ${thuTu(sapXep)}
      LIMIT ${SO_DONG_MOI_TRANG} OFFSET $${thamSo.length + 1}`,
    [...thamSo, (trang - 1) * SO_DONG_MOI_TRANG]
  );
  guiJson(res, 200, {
    tong,
    soKhop,
    trang,
    soTrang,
    danhSach: kq.rows.map((d) => ({
      id: d.id,
      hoTen: d.ho_ten,
      email: d.email,
      soDienThoai: d.so_dien_thoai,
      diemCaoNhat: d.diem_cao_nhat,
      soLuot: d.so_luot,
      dangKyLuc: d.dang_ky_luc.toISOString(),
    })),
  });
}

// DELETE /admin/api/nguoi-choi/:id → 200 | 404
async function xoa(req, res, idTho) {
  if (!/^\d{1,9}$/.test(idTho)) throw new LoiHttp(404, 'KHONG_TON_TAI');
  const kq = await db.query('DELETE FROM nguoi_choi WHERE id = $1', [Number(idTho)]);
  if (kq.rowCount === 0) throw new LoiHttp(404, 'KHONG_TON_TAI');
  guiJson(res, 200, { ok: true });
}

/* ---------- CSV ---------- */
const hai = (n) => String(n).padStart(2, '0');

// Tách một thời điểm thành các phần theo giờ Việt Nam (UTC+7, không có giờ mùa hè).
function gioVietNam(thoiDiem) {
  const d = new Date(thoiDiem.getTime() + LECH_GIO_VN);
  return {
    nam: d.getUTCFullYear(), thang: hai(d.getUTCMonth() + 1), ngay: hai(d.getUTCDate()),
    gio: hai(d.getUTCHours()), phut: hai(d.getUTCMinutes()), giay: hai(d.getUTCSeconds()),
  };
}

// Mọi ô bọc nháy kép; ô chữ bắt đầu bằng ký tự công thức thì thêm ' ở trước.
function oCsv(giaTri, laChu) {
  let s = String(giaTri);
  if (laChu && /^[=+\-@\t\r\n]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

// GET /admin/api/xuat-csv?tim=&sapXep= → file CSV chứa mọi dòng đang lọc
async function xuatCsv(req, res, url) {
  const { menhDe, thamSo } = dieuKienTim(url.searchParams.get('tim'));
  const kq = await db.query(
    `SELECT ho_ten, email, so_dien_thoai, diem_cao_nhat, so_luot, dang_ky_luc
       FROM nguoi_choi ${menhDe} ${thuTu(url.searchParams.get('sapXep'))}`,
    thamSo
  );

  const dong = ['"Họ tên","Email","Số điện thoại","Điểm cao nhất","Số lượt chơi","Thời điểm đăng ký"'];
  for (const d of kq.rows) {
    const t = gioVietNam(d.dang_ky_luc);
    dong.push([
      oCsv(d.ho_ten, true),
      oCsv(d.email, true),
      oCsv(d.so_dien_thoai, true),
      oCsv(d.diem_cao_nhat, false),
      oCsv(d.so_luot, false),
      oCsv(`${t.nam}-${t.thang}-${t.ngay} ${t.gio}:${t.phut}:${t.giay}`, false),
    ].join(','));
  }
  const than = Buffer.from('﻿' + dong.join('\r\n') + '\r\n', 'utf8');

  const n = gioVietNam(new Date());
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Length': than.length,
    'Content-Disposition': `attachment; filename="nguoi-choi-${n.nam}${n.thang}${n.ngay}-${n.gio}${n.phut}.csv"`,
    'Cache-Control': 'no-store',
  });
  res.end(than);
}

/* ---------- Định tuyến /admin/api/* ---------- */
async function xuLy(req, res, pathname, url) {
  const duong = pathname.slice('/admin/api'.length);
  const chi = (phuongThuc) => {
    if (req.method !== phuongThuc) {
      guiJson(res, 405, { loi: 'SAI_PHUONG_THUC' }, { Allow: phuongThuc });
      return false;
    }
    return true;
  };

  if (duong === '/dang-nhap') return chi('POST') && dangNhap(req, res);

  // Từ đây trở xuống đều cần phiên hợp lệ; không có thì 401 và không kèm dữ liệu nào.
  if (!coPhien(req)) throw new LoiHttp(401, 'CHUA_DANG_NHAP');

  if (duong === '/dang-xuat') return chi('POST') && dangXuat(req, res);
  if (duong === '/nguoi-choi') return chi('GET') && danhSach(req, res, url);
  if (duong === '/xuat-csv') return chi('GET') && xuatCsv(req, res, url);
  if (duong.startsWith('/nguoi-choi/')) {
    return chi('DELETE') && xoa(req, res, duong.slice('/nguoi-choi/'.length));
  }
  throw new LoiHttp(404, 'KHONG_CO');
}

module.exports = { xuLy, canhBaoCauHinh };
