/* Đập Chuột — luật chơi theo docs/04-quy-tac-du-lieu.html */
(function () {
  'use strict';

  /* ---------- Thông số ---------- */
  var SO_O = 9;                    // số ô của lưới (3×3)
  var THOI_LUONG_LUOT = 10000;     // ms, độ dài một lượt
  var THOI_GIAN_HIEN = 800;        // ms, chuột ở lại nếu không bị đập
  var KHOANG_NGHI = 300;           // ms, bảng trống giữa hai chuột và trước con đầu tiên
  var HIEU_UNG_DAP = 150;          // ms, thời gian hiện hình "bị đập"
  var NGUONG_CANH_BAO = 3;         // giây, đồng hồ đổi đỏ khi số hiển thị ≤ giá trị này
  var DIEM_MOI_CHUOT = 1;          // điểm cho mỗi lần đập trúng
  var KHOA_NUT_CHOI_LAI = 500;     // ms, nút "Chơi lại" chưa nhận bấm sau khi hết giờ
  var KHOA_LUU_TRU = 'dap-chuot:diem-cao-nhat';
  var KHOA_NGUOI_CHOI = 'dap-chuot:nguoi-choi';      // JSON {"ma":"…","hoTen":"…"}
  var KHOA_DIEM_CHO_GUI = 'dap-chuot:diem-cho-gui';  // điểm lớn nhất trong các lượt chưa gửi được
  var DIEM_TOI_DA = 33;            // điểm lớn nhất máy chủ chấp nhận cho một lượt
  var MAU_MA = /^[0-9a-f]{32}$/;

  var HINH_CHUOT = '🐭';
  var HINH_BI_DAP = '💥';

  var DANG_KY = 'DANG_KY';
  var BAT_DAU = 'BAT_DAU';
  var DANG_CHOI = 'DANG_CHOI';
  var KET_THUC = 'KET_THUC';

  /* ---------- Dữ liệu trong lúc chạy ---------- */
  var trangThai = DANG_KY;
  var nguoiChoi = null;            // {ma, hoTen} của người đang đăng ký, hoặc null
  var diemChoGui = null;           // điểm chưa gửi được lên máy chủ, hoặc null
  var dangGuiDiem = false;
  var dangGuiDangKy = false;
  var diem = 0;
  var mocBatDau = 0;               // performance.now() lúc bắt đầu lượt
  var oCoChuot = null;             // 0–8 hoặc null
  var oVuaXong = null;             // ô của con chuột liền trước
  var diemCaoNhat = docDiemCaoNhat();

  // Mốc của bảng (cùng thang với performance.now())
  var hanChuot = 0;                // lúc chuột đang hiện tự biến mất
  var hanSinh = 0;                 // lúc chuột kế tiếp hiện

  // Hẹn giờ
  var henGioLuot = null;
  var henGioChuot = null;
  var henGioHieuUng = null;
  var henGioKhoaNut = null;
  var khungHinh = null;

  var oBiDap = null;               // ô đang hiện hình "bị đập" (chỉ là hiển thị)
  var soDangHien = null;           // số giây đang hiện trên đồng hồ

  /* ---------- Phần tử ---------- */
  var manDangKy = document.getElementById('man-dang-ky');
  var formDangKy = document.getElementById('form-dang-ky');
  var nutTiepTuc = document.getElementById('nut-tiep-tuc');
  var elLoiDangKy = document.getElementById('loi-dang-ky');
  var elLoiChao = document.getElementById('loi-chao');
  var elTenNguoiChoi = document.getElementById('ten-nguoi-choi');
  var nutDoiNguoiChoi = document.getElementById('nut-doi-nguoi-choi');
  var cacTruong = ['ho-ten', 'email', 'so-dien-thoai'].map(function (ten, i) {
    return {
      khoa: ['hoTen', 'email', 'soDienThoai'][i],
      o: document.getElementById('o-' + ten),
      loi: document.getElementById('loi-' + ten),
      daCham: false,               // đã rời ô hoặc đã bấm "Tiếp tục": được phép báo lỗi
    };
  });
  var manBatDau = document.getElementById('man-bat-dau');
  var manDangChoi = document.getElementById('man-dang-choi');
  var manKetThuc = document.getElementById('man-ket-thuc');
  var nutBatDau = document.getElementById('nut-bat-dau');
  var nutChoiLai = document.getElementById('nut-choi-lai');
  var luoi = document.getElementById('luoi');
  var cacO = luoi.querySelectorAll('.o');
  var elSoDiem = document.getElementById('so-diem');
  var elDongHo = document.getElementById('dong-ho');
  var elSoGiay = document.getElementById('so-giay');
  var elKyLucBatDau = document.getElementById('ky-luc-bat-dau');
  var elKyLucKetThuc = document.getElementById('ky-luc-ket-thuc');
  var elNhanKyLuc = document.getElementById('nhan-ky-luc');
  var elDiemLuot = document.getElementById('diem-luot');

  /* ---------- Lưu trữ ---------- */
  function docDiemCaoNhat() {
    try {
      var v = window.localStorage.getItem(KHOA_LUU_TRU);
      if (v === null || !/^\d+$/.test(v)) return 0;
      var n = Number(v);
      return Number.isSafeInteger(n) ? n : 0;
    } catch (e) {
      return 0;
    }
  }

  function ghiDiemCaoNhat(n) {
    try {
      window.localStorage.setItem(KHOA_LUU_TRU, String(n));
    } catch (e) {
      // Lưu trữ bị chặn: kỷ lục chỉ giữ trong bộ nhớ
    }
  }

  function docKhoa(khoa) {
    try { return window.localStorage.getItem(khoa); } catch (e) { return null; }
  }
  function ghiKhoa(khoa, giaTri) {
    try { window.localStorage.setItem(khoa, giaTri); } catch (e) { /* chỉ giữ trong bộ nhớ */ }
  }
  function xoaKhoa(khoa) {
    try { window.localStorage.removeItem(khoa); } catch (e) { /* bỏ qua */ }
  }

  // Dữ liệu nhớ bị hỏng (không phải JSON, thiếu ma, ma sai dạng): coi như chưa đăng ký.
  function docNguoiChoi() {
    try {
      var d = JSON.parse(docKhoa(KHOA_NGUOI_CHOI));
      if (!d || typeof d.ma !== 'string' || !MAU_MA.test(d.ma)) return null;
      return { ma: d.ma, hoTen: typeof d.hoTen === 'string' ? d.hoTen : '' };
    } catch (e) {
      return null;
    }
  }

  function docDiemChoGui() {
    var v = docKhoa(KHOA_DIEM_CHO_GUI);
    if (v === null || !/^\d+$/.test(v)) return null;
    var n = Number(v);
    return n <= DIEM_TOI_DA ? n : null;
  }

  function datDiemCho(n) {
    diemChoGui = n;
    if (n === null) xoaKhoa(KHOA_DIEM_CHO_GUI);
    else ghiKhoa(KHOA_DIEM_CHO_GUI, String(n));
  }

  // Trình duyệt quên người chơi: xoá cả ba khoá. Dữ liệu trên máy chủ không đổi.
  function quenNguoiChoi() {
    nguoiChoi = null;
    diemChoGui = null;
    diemCaoNhat = 0;
    xoaKhoa(KHOA_NGUOI_CHOI);
    xoaKhoa(KHOA_LUU_TRU);
    xoaKhoa(KHOA_DIEM_CHO_GUI);
  }

  /* ---------- Máy chủ ---------- */
  // Mã người chơi luôn nằm trong thân yêu cầu, không nằm trên địa chỉ.
  function goiApi(duong, than) {
    return fetch(duong, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(than),
    }).then(function (tl) {
      return tl.json().then(
        function (duLieu) { return { status: tl.status, duLieu: duLieu }; },
        function () { return { status: tl.status, duLieu: null }; }
      );
    });
  }

  // Điểm cao nhất hiển thị = số lớn nhất trong: bản sao trên trình duyệt, điểm máy chủ, điểm chờ gửi.
  function nhanDiemMayChu(duLieu) {
    var n = duLieu && duLieu.diemCaoNhat;
    if (!Number.isInteger(n) || n <= diemCaoNhat) return;
    diemCaoNhat = n;
    ghiDiemCaoNhat(n);
    elKyLucBatDau.textContent = String(n);
  }

  // Máy chủ báo hồ sơ không còn (admin đã xoá).
  // Đang ở màn Bắt đầu thì về Đăng ký ngay; đang chơi thì chờ tới lúc bấm "Chơi lại".
  function nguoiChoiDaMat() {
    quenNguoiChoi();
    if (trangThai === BAT_DAU) veDangKy();
  }

  /* Gửi điểm lên máy chủ, chạy ngầm. diemMoi = null nghĩa là chỉ gửi bù điểm đang chờ.
     Điểm chờ và điểm lượt mới gộp thành một lần gửi (lấy số lớn hơn). */
  function guiDiem(diemMoi) {
    if (!nguoiChoi) return;
    var can = diemChoGui;
    if (diemMoi !== null) can = can === null ? diemMoi : Math.max(can, diemMoi);
    if (can === null) return;
    can = Math.min(can, DIEM_TOI_DA);
    if (dangGuiDiem) return datDiemCho(can);   // lần gửi trước chưa xong: để dành gửi bù

    var ma = nguoiChoi.ma;
    var giuLai = function () {
      if (nguoiChoi && nguoiChoi.ma === ma) datDiemCho(Math.max(can, diemChoGui === null ? 0 : diemChoGui));
    };
    dangGuiDiem = true;
    goiApi('/api/luot-choi', { ma: ma, diem: can }).then(function (kq) {
      dangGuiDiem = false;
      if (!nguoiChoi || nguoiChoi.ma !== ma) return;
      if (kq.status === 200) {
        if (diemChoGui !== null && diemChoGui <= can) datDiemCho(null);
        nhanDiemMayChu(kq.duLieu);
      } else if (kq.status === 404) {
        nguoiChoiDaMat();
      } else if (kq.status === 400) {
        datDiemCho(null);                      // máy chủ không nhận điểm này: bỏ
      } else {
        giuLai();                              // 429, 5xx: gửi bù sau
      }
    }, function () {
      dangGuiDiem = false;
      giuLai();                                // mất mạng: gửi bù sau
    });
  }

  // Mở trang khi đã nhớ người chơi: kiểm tra với máy chủ ở nền. Mất mạng thì vẫn chơi được.
  function kiemTraNen() {
    if (diemChoGui !== null) return guiDiem(null);
    var ma = nguoiChoi.ma;
    goiApi('/api/kiem-tra', { ma: ma }).then(function (kq) {
      if (!nguoiChoi || nguoiChoi.ma !== ma) return;
      if (kq.status === 200) nhanDiemMayChu(kq.duLieu);
      else if (kq.status === 404) nguoiChoiDaMat();
    }, function () { /* mất mạng: không đổi trạng thái */ });
  }

  /* ---------- Hiển thị ---------- */
  function hienMan(man) {
    manDangKy.hidden = man !== manDangKy;
    manBatDau.hidden = man !== manBatDau;
    manDangChoi.hidden = man !== manDangChoi;
    manKetThuc.hidden = man !== manKetThuc;
    window.scrollTo(0, 0);         // màn Đăng ký có thể đã cuộn; các màn khác luôn bắt đầu từ đầu trang
  }

  function veO(o, hinh, lop) {
    var el = cacO[o];
    el.classList.remove('co-chuot', 'bi-dap');
    el.textContent = '';
    if (hinh) {
      var span = document.createElement('span');
      span.textContent = hinh;
      el.appendChild(span);
      el.classList.add(lop);
    }
  }

  function xoaHieuUngDap() {
    if (henGioHieuUng !== null) {
      clearTimeout(henGioHieuUng);
      henGioHieuUng = null;
    }
    if (oBiDap !== null) {
      if (oBiDap !== oCoChuot) veO(oBiDap, null);
      oBiDap = null;
    }
  }

  function xoaBang() {
    for (var i = 0; i < SO_O; i++) veO(i, null);
    oBiDap = null;
  }

  function veDiem(nay) {
    elSoDiem.textContent = String(diem);
    elSoDiem.classList.remove('nay');
    if (nay) {
      void elSoDiem.offsetWidth;   // chạy lại hiệu ứng nảy từ đầu
      elSoDiem.classList.add('nay');
    }
  }

  function veDongHo(bayGio) {
    var conLaiMs = Math.max(0, THOI_LUONG_LUOT - (bayGio - mocBatDau));
    var so = Math.ceil(conLaiMs / 1000);
    if (so === soDangHien) return;
    soDangHien = so;
    elSoGiay.textContent = String(so);
    elDongHo.classList.toggle('canh-bao', so <= NGUONG_CANH_BAO);
  }

  /* ---------- Bảng: NGHI ⇄ CO_CHUOT ---------- */
  function sinhChuot(moc) {
    var o = Math.floor(Math.random() * (oVuaXong === null ? SO_O : SO_O - 1));
    if (oVuaXong !== null && o >= oVuaXong) o += 1;
    xoaHieuUngDap();
    oCoChuot = o;
    hanChuot = moc + THOI_GIAN_HIEN;
    veO(o, HINH_CHUOT, 'co-chuot');
  }

  function roiCoChuot(moc, biDap) {
    var o = oCoChuot;
    oVuaXong = o;
    oCoChuot = null;
    hanSinh = moc + KHOANG_NGHI;
    if (biDap) {
      xoaHieuUngDap();
      oBiDap = o;
      veO(o, HINH_BI_DAP, 'bi-dap');
      henGioHieuUng = setTimeout(function () {
        henGioHieuUng = null;
        xoaHieuUngDap();
      }, HIEU_UNG_DAP);
    } else {
      veO(o, null);
    }
  }

  /* ---------- Hẹn giờ ---------- */
  function huyHenGio() {
    clearTimeout(henGioLuot);
    clearTimeout(henGioChuot);
    clearTimeout(henGioHieuUng);
    clearTimeout(henGioKhoaNut);
    if (khungHinh !== null) cancelAnimationFrame(khungHinh);
    henGioLuot = henGioChuot = henGioHieuUng = henGioKhoaNut = khungHinh = null;
  }

  function nhip() {
    capNhat(performance.now());
  }

  function datHenGio(bayGio) {
    var hanLuot = mocBatDau + THOI_LUONG_LUOT;
    clearTimeout(henGioLuot);
    henGioLuot = setTimeout(nhip, Math.max(0, hanLuot - bayGio));

    clearTimeout(henGioChuot);
    henGioChuot = null;
    var moc = oCoChuot !== null ? hanChuot : hanSinh;
    if (moc < hanLuot) henGioChuot = setTimeout(nhip, Math.max(0, moc - bayGio));
  }

  function vongKhungHinh() {
    khungHinh = null;
    capNhat(performance.now());
    if (trangThai === DANG_CHOI) khungHinh = requestAnimationFrame(vongKhungHinh);
  }

  /* Đưa game tới đúng trạng thái của thời điểm bayGio, theo đồng hồ thực. */
  function capNhat(bayGio) {
    if (trangThai !== DANG_CHOI) return;
    var hanLuot = mocBatDau + THOI_LUONG_LUOT;

    for (;;) {
      var moc = oCoChuot !== null ? hanChuot : hanSinh;
      if (moc > bayGio || moc >= hanLuot) break;   // chưa tới hạn, hoặc rơi vào lúc hết giờ: không sinh
      if (oCoChuot !== null) roiCoChuot(moc, false);
      else sinhChuot(moc);
    }

    if (bayGio >= hanLuot) {
      ketThucLuot();
      return;
    }
    veDongHo(bayGio);
    datHenGio(bayGio);
  }

  /* ---------- Vòng chơi ---------- */
  function batDauLuot() {
    huyHenGio();
    diem = 0;
    oCoChuot = null;
    oVuaXong = null;
    mocBatDau = performance.now();
    hanSinh = mocBatDau + KHOANG_NGHI;
    trangThai = DANG_CHOI;

    xoaBang();
    veDiem(false);
    soDangHien = null;
    veDongHo(mocBatDau);
    hienMan(manDangChoi);

    datHenGio(mocBatDau);
    khungHinh = requestAnimationFrame(vongKhungHinh);
  }

  function ketThucLuot() {
    trangThai = KET_THUC;
    huyHenGio();
    oCoChuot = null;
    xoaBang();
    soDangHien = 0;
    elSoGiay.textContent = '0';

    var kyLucMoi = diem > diemCaoNhat;
    if (kyLucMoi) {
      diemCaoNhat = diem;
      ghiDiemCaoNhat(diemCaoNhat);
    }

    guiDiem(diem);                 // chạy ngầm: màn Kết thúc không chờ máy chủ

    elNhanKyLuc.hidden = !kyLucMoi;
    elDiemLuot.textContent = String(diem);
    elKyLucKetThuc.textContent = String(diemCaoNhat);

    nutChoiLai.disabled = true;
    hienMan(manKetThuc);
    henGioKhoaNut = setTimeout(function () {
      henGioKhoaNut = null;
      nutChoiLai.disabled = false;
    }, KHOA_NUT_CHOI_LAI);
  }

  /* ---------- Đăng ký ---------- */
  function hienLoiO(truong, cau) {
    truong.loi.textContent = cau || '';
    truong.loi.hidden = !cau;
    if (cau) truong.o.setAttribute('aria-invalid', 'true');
    else truong.o.removeAttribute('aria-invalid');
  }

  function docForm() {
    var duLieu = {};
    cacTruong.forEach(function (t) { duLieu[t.khoa] = t.o.value; });
    return window.QuyTac.kiemTraDangKy(duLieu);
  }

  // Chỉ báo lỗi ở những ô người dùng đã rời hoặc sau khi bấm "Tiếp tục".
  function veLoiForm(kq) {
    cacTruong.forEach(function (t) {
      hienLoiO(t, t.daCham ? kq.truong[t.khoa] : '');
    });
  }

  function veDangKy() {
    trangThai = DANG_KY;
    cacTruong.forEach(function (t) {
      t.o.value = '';
      t.daCham = false;
      hienLoiO(t, '');
    });
    elLoiDangKy.hidden = true;
    hienMan(manDangKy);
  }

  function veBatDau() {
    trangThai = BAT_DAU;
    elTenNguoiChoi.textContent = nguoiChoi ? nguoiChoi.hoTen : '';
    elLoiChao.hidden = !(nguoiChoi && nguoiChoi.hoTen);
    elKyLucBatDau.textContent = String(diemCaoNhat);
    hienMan(manBatDau);
  }

  function khoaNutTiepTuc(khoa) {
    dangGuiDangKy = khoa;
    nutTiepTuc.disabled = khoa;
    nutTiepTuc.textContent = khoa ? 'Đang gửi…' : 'Tiếp tục';
  }

  function khiGuiDangKy(e) {
    e.preventDefault();
    if (trangThai !== DANG_KY || dangGuiDangKy) return;

    cacTruong.forEach(function (t) { t.daCham = true; });
    var kq = docForm();
    veLoiForm(kq);
    elLoiDangKy.hidden = true;
    if (!kq.hopLe) return veOSaiDauTien();      // còn lỗi: không gửi gì lên máy chủ

    khoaNutTiepTuc(true);
    goiApi('/api/dang-ky', kq.giaTri).then(function (tl) {
      khoaNutTiepTuc(false);
      var d = tl.duLieu;
      if ((tl.status === 200 || tl.status === 201) && d && MAU_MA.test(d.ma)) {
        nguoiChoi = { ma: d.ma, hoTen: kq.giaTri.hoTen };
        ghiKhoa(KHOA_NGUOI_CHOI, JSON.stringify(nguoiChoi));
        diemCaoNhat = Number.isInteger(d.diemCaoNhat) ? d.diemCaoNhat : 0;
        ghiDiemCaoNhat(diemCaoNhat);
        datDiemCho(null);
        return veBatDau();
      }
      if (tl.status === 400 && d && d.truong) {   // kết quả của máy chủ là kết quả cuối
        cacTruong.forEach(function (t) { hienLoiO(t, d.truong[t.khoa]); });
        return veOSaiDauTien();
      }
      elLoiDangKy.hidden = false;
    }, function () {
      khoaNutTiepTuc(false);
      elLoiDangKy.hidden = false;                 // giữ nguyên những gì đã nhập
    });
  }

  function veOSaiDauTien() {
    for (var i = 0; i < cacTruong.length; i++) {
      if (!cacTruong[i].loi.hidden) return cacTruong[i].o.focus();
    }
  }

  cacTruong.forEach(function (t) {
    t.o.addEventListener('blur', function () {
      if (trangThai !== DANG_KY) return;
      t.daCham = true;
      veLoiForm(docForm());
    });
    // Đang gõ dở thì không báo lỗi mới; chỉ gỡ lỗi cũ khi ô đã hợp lệ.
    t.o.addEventListener('input', function () {
      if (!t.loi.hidden && !docForm().truong[t.khoa]) hienLoiO(t, '');
    });
  });

  formDangKy.addEventListener('submit', khiGuiDangKy);

  nutDoiNguoiChoi.addEventListener('click', function () {
    if (trangThai !== BAT_DAU) return;
    // Còn điểm chờ gửi: thử gửi bù một lần trước khi quên; không được thì bỏ.
    if (nguoiChoi && diemChoGui !== null) {
      goiApi('/api/luot-choi', { ma: nguoiChoi.ma, diem: diemChoGui }).catch(function () {});
    }
    quenNguoiChoi();
    veDangKy();
  });

  /* ---------- Thao tác ---------- */
  function khiBamLuoi(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();

    var bayGio = performance.now();
    capNhat(bayGio);                         // chuột hết hạn / hết giờ được xử lý trước lần bấm
    if (trangThai !== DANG_CHOI) return;

    var el = e.target.closest ? e.target.closest('.o') : null;
    if (!el) return;
    var o = Number(el.getAttribute('data-o'));
    if (o !== oCoChuot) return;              // ô trống: không có gì thay đổi

    diem += DIEM_MOI_CHUOT;
    roiCoChuot(bayGio, true);
    veDiem(true);
    datHenGio(bayGio);
  }

  luoi.addEventListener('pointerdown', khiBamLuoi);

  nutBatDau.addEventListener('click', function () {
    if (trangThai !== BAT_DAU) return;
    batDauLuot();
  });

  nutChoiLai.addEventListener('click', function () {
    if (trangThai !== KET_THUC || nutChoiLai.disabled) return;
    if (!nguoiChoi) return veDangKy();          // hồ sơ đã bị xoá trong lúc chơi
    batDauLuot();
  });

  // Quay lại tab: đồng hồ thực vẫn trôi, cập nhật ngay
  document.addEventListener('visibilitychange', nhip);

  // Không hiện menu ngữ cảnh khi giữ ngón tay
  document.addEventListener('contextmenu', function (e) {
    if (e.target && e.target.tagName === 'INPUT') return;   // ô nhập vẫn dán được
    e.preventDefault();
  });

  /* ---------- Mở trang ---------- */
  nguoiChoi = docNguoiChoi();
  if (!nguoiChoi) {
    quenNguoiChoi();
    veDangKy();
  } else {
    diemChoGui = docDiemChoGui();
    diemCaoNhat = Math.max(diemCaoNhat, diemChoGui === null ? 0 : diemChoGui);
    veBatDau();                    // hiện ngay, rồi kiểm tra với máy chủ ở nền
    kiemTraNen();
  }
})();
