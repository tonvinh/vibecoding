// Tiện ích dùng chung cho các API: đọc thân JSON, trả JSON, giới hạn số lần gửi.

const KICH_THUOC_GUI_TOI_DA = 10 * 1024; // 10 KB

// Lỗi có mã HTTP đi kèm; server.js đổi nó thành câu trả lời JSON.
class LoiHttp extends Error {
  constructor(status, loi) {
    super(loi);
    this.status = status;
    this.loi = loi;
  }
}

function guiJson(res, status, duLieu, headers = {}) {
  const than = JSON.stringify(duLieu);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(than),
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(than);
}

// Đọc thân yêu cầu thành một object JSON. Quá 10 KB hoặc không phải JSON hợp lệ: lỗi 400.
function docThan(req) {
  return new Promise((resolve, reject) => {
    const tuChoi = () => {
      req.removeAllListeners('data');
      req.removeAllListeners('end');
      req.resume(); // bỏ phần còn lại để vẫn trả lời được
      reject(new LoiHttp(400, 'YEU_CAU_SAI'));
    };

    if (Number(req.headers['content-length']) > KICH_THUOC_GUI_TOI_DA) return tuChoi();

    const cacManh = [];
    let tong = 0;
    req.on('data', (manh) => {
      tong += manh.length;
      if (tong > KICH_THUOC_GUI_TOI_DA) return tuChoi();
      cacManh.push(manh);
    });
    req.on('end', () => {
      let than;
      try {
        than = JSON.parse(Buffer.concat(cacManh).toString('utf8'));
      } catch {
        return reject(new LoiHttp(400, 'YEU_CAU_SAI'));
      }
      if (than === null || typeof than !== 'object' || Array.isArray(than)) {
        return reject(new LoiHttp(400, 'YEU_CAU_SAI'));
      }
      resolve(than);
    });
    req.on('error', () => reject(new LoiHttp(400, 'YEU_CAU_SAI')));
  });
}

// Địa chỉ mạng của bên gọi. Chạy sau máy chủ trung gian thì cần cấu hình lại chỗ này.
function diaChiMang(req) {
  return req.socket.remoteAddress || 'khong-ro';
}

// Giới hạn "toiDa lần trong cuaSoMs" theo từng khoá (địa chỉ mạng, mã người chơi…), giữ trong bộ nhớ.
class GioiHan {
  constructor(toiDa, cuaSoMs) {
    this.toiDa = toiDa;
    this.cuaSoMs = cuaSoMs;
    this.so = new Map();
    setInterval(() => this.don(), cuaSoMs).unref();
  }

  // Ghi nhận một lần gửi. Trả false nếu đã vượt giới hạn.
  thu(khoa) {
    const bayGio = Date.now();
    const cac = (this.so.get(khoa) || []).filter((t) => t > bayGio - this.cuaSoMs);
    if (cac.length >= this.toiDa) {
      this.so.set(khoa, cac);
      return false;
    }
    cac.push(bayGio);
    this.so.set(khoa, cac);
    return true;
  }

  don() {
    const moc = Date.now() - this.cuaSoMs;
    for (const [khoa, cac] of this.so) {
      if (cac.length === 0 || cac[cac.length - 1] <= moc) this.so.delete(khoa);
    }
  }
}

module.exports = { LoiHttp, guiJson, docThan, diaChiMang, GioiHan };
