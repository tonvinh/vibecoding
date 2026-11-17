// API phía người chơi: đăng ký, kiểm tra, gửi điểm — docs/04-quy-tac-du-lieu.html › Địa chỉ API.
const crypto = require('node:crypto');
const db = require('./db');
const quyTac = require('../app/quy-tac.js');
const { LoiHttp, guiJson, docThan, diaChiMang, GioiHan } = require('./tien-ich');

const DIEM_TOI_DA = 33;
const MAU_MA = /^[0-9a-f]{32}$/;

const gioiHanDangKy = new GioiHan(60, 10 * 60 * 1000); // 60 lần / 10 phút / địa chỉ mạng
const gioiHanGuiDiem = new GioiHan(30, 60 * 1000);     // 30 lần / phút / người chơi

// POST /api/dang-ky  {hoTen, email, soDienThoai} → 201 người mới | 200 email đã có: {ma, diemCaoNhat}
async function dangKy(req, res) {
  if (!gioiHanDangKy.thu(diaChiMang(req))) throw new LoiHttp(429, 'QUA_NHIEU_LAN');

  const kq = quyTac.kiemTraDangKy(await docThan(req));
  if (!kq.hopLe) return guiJson(res, 400, { loi: 'DU_LIEU_SAI', truong: kq.truong });
  const { hoTen, email, soDienThoai } = kq.giaTri;

  // Ràng buộc duy nhất trên email bảo đảm chỉ một dòng, kể cả khi nhiều yêu cầu tới cùng lúc.
  const them = await db.query(
    `INSERT INTO nguoi_choi (ma, ho_ten, ho_ten_tim, email, so_dien_thoai)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO NOTHING
     RETURNING ma, diem_cao_nhat`,
    [crypto.randomBytes(16).toString('hex'), hoTen, quyTac.boDau(hoTen), email, soDienThoai]
  );
  if (them.rowCount === 1) {
    return guiJson(res, 201, { ma: them.rows[0].ma, diemCaoNhat: them.rows[0].diem_cao_nhat });
  }

  // Email đã có: nhận là người cũ, không sửa dòng nào.
  const cu = await db.query('SELECT ma, diem_cao_nhat FROM nguoi_choi WHERE email = $1', [email]);
  if (cu.rowCount === 0) throw new LoiHttp(503, 'THU_LAI'); // vừa bị xoá giữa hai câu lệnh
  guiJson(res, 200, { ma: cu.rows[0].ma, diemCaoNhat: cu.rows[0].diem_cao_nhat });
}

// POST /api/kiem-tra  {ma} → 200 {diemCaoNhat} | 404
async function kiemTra(req, res) {
  const { ma } = await docThan(req);
  if (typeof ma !== 'string' || !MAU_MA.test(ma)) throw new LoiHttp(404, 'KHONG_TON_TAI');

  const kq = await db.query('SELECT diem_cao_nhat FROM nguoi_choi WHERE ma = $1', [ma]);
  if (kq.rowCount === 0) throw new LoiHttp(404, 'KHONG_TON_TAI');
  guiJson(res, 200, { diemCaoNhat: kq.rows[0].diem_cao_nhat });
}

// POST /api/luot-choi  {ma, diem} → 200 {diemCaoNhat} | 400 | 404 | 429
async function luotChoi(req, res) {
  const { ma, diem } = await docThan(req);
  if (!Number.isInteger(diem) || diem < 0 || diem > DIEM_TOI_DA) throw new LoiHttp(400, 'DIEM_SAI');
  if (typeof ma !== 'string' || !MAU_MA.test(ma)) throw new LoiHttp(404, 'KHONG_TON_TAI');
  if (!gioiHanGuiDiem.thu(ma)) throw new LoiHttp(429, 'QUA_NHIEU_LAN');

  const kq = await db.query(
    `UPDATE nguoi_choi
        SET so_luot = so_luot + 1,
            diem_cao_nhat = GREATEST(diem_cao_nhat, $2),
            choi_gan_nhat = now()
      WHERE ma = $1
      RETURNING diem_cao_nhat`,
    [ma, diem]
  );
  if (kq.rowCount === 0) throw new LoiHttp(404, 'KHONG_TON_TAI');
  guiJson(res, 200, { diemCaoNhat: kq.rows[0].diem_cao_nhat });
}

const DUONG = {
  '/api/dang-ky': dangKy,
  '/api/kiem-tra': kiemTra,
  '/api/luot-choi': luotChoi,
};

async function xuLy(req, res, pathname) {
  const ham = DUONG[pathname];
  if (!ham) throw new LoiHttp(404, 'KHONG_CO');
  if (req.method !== 'POST') {
    return guiJson(res, 405, { loi: 'SAI_PHUONG_THUC' }, { Allow: 'POST' });
  }
  await ham(req, res);
}

module.exports = { xuLy };
