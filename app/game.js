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

  var HINH_CHUOT = '🐭';
  var HINH_BI_DAP = '💥';

  var BAT_DAU = 'BAT_DAU';
  var DANG_CHOI = 'DANG_CHOI';
  var KET_THUC = 'KET_THUC';

  /* ---------- Dữ liệu trong lúc chạy ---------- */
  var trangThai = BAT_DAU;
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

  /* ---------- Hiển thị ---------- */
  function hienMan(man) {
    manBatDau.hidden = man !== manBatDau;
    manDangChoi.hidden = man !== manDangChoi;
    manKetThuc.hidden = man !== manKetThuc;
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
    batDauLuot();
  });

  // Quay lại tab: đồng hồ thực vẫn trôi, cập nhật ngay
  document.addEventListener('visibilitychange', nhip);

  // Không hiện menu ngữ cảnh khi giữ ngón tay
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  /* ---------- Mở trang ---------- */
  elKyLucBatDau.textContent = String(diemCaoNhat);
  hienMan(manBatDau);
})();
