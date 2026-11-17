// Kết nối PostgreSQL. Thông tin kết nối lấy từ biến môi trường PGHOST, PGPORT,
// PGUSER, PGPASSWORD, PGDATABASE (thư viện pg tự đọc).
const { Pool } = require('pg');

const pool = new Pool({ max: 10, connectionTimeoutMillis: 5000 });

// Lỗi ở kết nối đang rảnh (database khởi động lại…) không được làm sập máy chủ.
pool.on('error', (err) => {
  console.error(`Lỗi kết nối database: ${err.code || ''} ${err.message}`);
});

const TAO_BANG = `
  CREATE TABLE IF NOT EXISTS nguoi_choi (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ma            CHAR(32)    NOT NULL UNIQUE,
    ho_ten        TEXT        NOT NULL,
    ho_ten_tim    TEXT        NOT NULL,
    email         TEXT        NOT NULL UNIQUE,
    so_dien_thoai VARCHAR(10) NOT NULL,
    diem_cao_nhat INTEGER     NOT NULL DEFAULT 0 CHECK (diem_cao_nhat BETWEEN 0 AND 33),
    so_luot       INTEGER     NOT NULL DEFAULT 0 CHECK (so_luot >= 0),
    dang_ky_luc   TIMESTAMPTZ NOT NULL DEFAULT now(),
    choi_gan_nhat TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS nguoi_choi_so_dien_thoai_idx ON nguoi_choi (so_dien_thoai);
`;

const cho = (ms) => new Promise((r) => setTimeout(r, ms));

// Tạo bảng ở lần chạy đầu. Database chưa sẵn sàng thì thử lại, không tự tắt máy chủ.
async function khoiTao() {
  for (let lan = 1; ; lan++) {
    try {
      await pool.query(TAO_BANG);
      console.log('Database đã sẵn sàng.');
      return;
    } catch (err) {
      console.error(`Chưa kết nối được database (lần ${lan}): ${err.code || ''} ${err.message}`);
      await cho(Math.min(lan, 5) * 1000);
    }
  }
}

module.exports = {
  query: (cau, thamSo) => pool.query(cau, thamSo),
  khoiTao,
  dong: () => pool.end(),
};
