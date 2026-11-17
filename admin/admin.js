/* Trang admin — docs/02-chuc-nang.html F14–F18.
   Dữ liệu người chơi luôn được chèn bằng textContent, không bao giờ như HTML. */
(function () {
  'use strict';

  var TRE_TIM_KIEM = 300; // ms
  var API = '/admin/api';

  var $ = function (id) { return document.getElementById(id); };
  var manDangNhap = $('man-dang-nhap');
  var manDanhSach = $('man-danh-sach');
  var formDangNhap = $('form-dang-nhap');
  var oTen = $('ten-dang-nhap');
  var oMatKhau = $('mat-khau');
  var nutDangNhap = $('nut-dang-nhap');
  var loiDangNhap = $('loi-dang-nhap');
  var tbPhien = $('tb-phien');

  var elTong = $('tong');
  var oTim = $('tim');
  var nutXoaTim = $('nut-xoa-tim');
  var oSapXep = $('sap-xep');
  var nutXuatCsv = $('nut-xuat-csv');
  var elKetQuaTim = $('ket-qua-tim');
  var loiChung = $('loi-chung');
  var khungBang = $('khung-bang');
  var thanBang = $('than-bang');
  var elTrong = $('trong');
  var phanTrang = $('phan-trang');
  var elKhoangDong = $('khoang-dong');
  var elSoTrang = $('so-trang');
  var nutTruoc = $('nut-truoc');
  var nutSau = $('nut-sau');

  var hopXoa = $('hop-xoa');
  var hopChiTiet = $('hop-xoa-chi-tiet');
  var hopHuy = $('hop-huy');
  var hopXacNhan = $('hop-xoa-xac-nhan');

  var boLoc = { tim: '', sapXep: 'moi-nhat', trang: 1 };
  var henTim = null;
  var luotTai = 0;          // chỉ lần tải mới nhất được vẽ
  var sapXoa = null;        // người chơi đang chờ xác nhận xoá

  /* ---------- Gọi máy chủ ---------- */
  function LoiPhien() {}

  function goi(phuongThuc, duong, than) {
    var tuyChon = { method: phuongThuc, credentials: 'same-origin', headers: {} };
    if (than !== undefined) {
      tuyChon.headers['Content-Type'] = 'application/json';
      tuyChon.body = JSON.stringify(than);
    }
    return fetch(API + duong, tuyChon);
  }

  // Như goi(), nhưng 401 thì đưa về màn Đăng nhập.
  function goiCoPhien(phuongThuc, duong) {
    return goi(phuongThuc, duong).then(function (tl) {
      if (tl.status === 401) throw new LoiPhien();
      return tl;
    });
  }

  function thamSo(coTrang) {
    var p = new URLSearchParams();
    if (boLoc.tim) p.set('tim', boLoc.tim);
    p.set('sapXep', boLoc.sapXep);
    if (coTrang) p.set('trang', String(boLoc.trang));
    return '?' + p.toString();
  }

  /* ---------- Hiển thị ---------- */
  function hienDangNhap(hetPhien) {
    manDanhSach.hidden = true;
    manDangNhap.hidden = false;
    if (hopXoa.open) hopXoa.close();
    thanBang.textContent = '';           // không để dữ liệu cũ nằm lại trong trang
    tbPhien.hidden = !hetPhien;
    loiDangNhap.hidden = true;
    oMatKhau.value = '';
    (oTen.value ? oMatKhau : oTen).focus();
  }

  function hienDanhSach() {
    manDangNhap.hidden = true;
    manDanhSach.hidden = false;
  }

  function baoLoi(cau) {
    loiChung.textContent = cau || '';
    loiChung.hidden = !cau;
  }

  function xuLyLoi(loi, cau) {
    if (loi instanceof LoiPhien) hienDangNhap(true);
    else baoLoi(cau);
  }

  function hai(n) { return n < 10 ? '0' + n : String(n); }

  // NN/TT/NNNN GG:PP theo giờ Việt Nam (UTC+7)
  function gioVietNam(iso) {
    var d = new Date(new Date(iso).getTime() + 7 * 3600 * 1000);
    return hai(d.getUTCDate()) + '/' + hai(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear() +
      ' ' + hai(d.getUTCHours()) + ':' + hai(d.getUTCMinutes());
  }

  function dinhDangSo(s) {
    return /^\d{10}$/.test(s) ? s.slice(0, 4) + ' ' + s.slice(4, 7) + ' ' + s.slice(7) : s;
  }

  function o(lop, chu) {
    var td = document.createElement('td');
    td.className = lop;
    td.textContent = chu;
    return td;
  }

  function ve(dl) {
    boLoc.trang = dl.trang;
    elTong.textContent = String(dl.tong);

    var dangTim = boLoc.tim !== '';
    nutXuatCsv.textContent = dangTim ? 'Xuất CSV (' + dl.soKhop + ' dòng)' : 'Xuất CSV';
    elKetQuaTim.hidden = !(dangTim && dl.soKhop > 0);
    elKetQuaTim.textContent = 'Tìm thấy ' + dl.soKhop + ' người chơi';

    thanBang.textContent = '';
    dl.danhSach.forEach(function (nc) {
      var tr = document.createElement('tr');
      tr.appendChild(o('ten', nc.hoTen));
      tr.appendChild(o('email', nc.email));
      tr.appendChild(o('dien-thoai', dinhDangSo(nc.soDienThoai)));
      tr.appendChild(o('so', String(nc.diemCaoNhat)));
      tr.appendChild(o('so', String(nc.soLuot)));
      tr.appendChild(o('luc', gioVietNam(nc.dangKyLuc)));

      var td = o('thao-tac', '');
      var nut = document.createElement('button');
      nut.type = 'button';
      nut.className = 'btn btn-phu btn-nho btn-xoa';
      nut.textContent = 'Xoá';
      nut.setAttribute('aria-label', 'Xoá ' + nc.hoTen);
      nut.addEventListener('click', function () { moHopXoa(nc); });
      td.appendChild(nut);
      tr.appendChild(td);
      thanBang.appendChild(tr);
    });

    var rong = dl.danhSach.length === 0;
    khungBang.hidden = rong;
    elTrong.hidden = !rong;
    if (rong) {
      elTrong.textContent = dangTim
        ? "Không tìm thấy ai khớp với '" + boLoc.tim + "'."
        : 'Chưa có người chơi nào.';
    }

    phanTrang.hidden = dl.soTrang <= 1;
    var dau = (dl.trang - 1) * 50 + 1;
    elKhoangDong.textContent = dau + '–' + (dau + dl.danhSach.length - 1) + ' trong ' + dl.soKhop;
    elSoTrang.textContent = 'Trang ' + dl.trang + '/' + dl.soTrang;
    nutTruoc.disabled = dl.trang <= 1;
    nutSau.disabled = dl.trang >= dl.soTrang;
  }

  /* ---------- Tải danh sách ---------- */
  // Lỗi thì bảng giữ nguyên trạng thái cũ, chỉ hiện dòng báo lỗi phía trên.
  function tai(lanDau) {
    var luot = ++luotTai;
    return goiCoPhien('GET', '/nguoi-choi' + thamSo(true))
      .then(function (tl) {
        if (!tl.ok) throw new Error('loi');
        return tl.json();
      })
      .then(function (dl) {
        if (luot !== luotTai) return;
        baoLoi('');
        hienDanhSach();
        ve(dl);
      })
      .catch(function (loi) {
        if (luot !== luotTai) return;
        if (loi instanceof LoiPhien) return hienDangNhap(!lanDau);
        if (lanDau) hienDanhSach();
        baoLoi('Chưa tải được danh sách, thử lại nhé.');
      });
  }

  /* ---------- Đăng nhập, đăng xuất ---------- */
  formDangNhap.addEventListener('submit', function (e) {
    e.preventDefault();
    if (nutDangNhap.disabled) return;
    nutDangNhap.disabled = true;
    loiDangNhap.hidden = true;

    goi('POST', '/dang-nhap', { tenDangNhap: oTen.value, matKhau: oMatKhau.value })
      .then(function (tl) {
        if (tl.ok) {
          oMatKhau.value = '';
          tbPhien.hidden = true;
          boLoc = { tim: '', sapXep: 'moi-nhat', trang: 1 };
          oTim.value = '';
          nutXoaTim.hidden = true;
          oSapXep.value = 'moi-nhat';
          return tai(true);
        }
        loiDangNhap.textContent = tl.status === 429
          ? 'Sai quá nhiều lần. Thử lại sau 15 phút.'
          : tl.status === 401
            ? 'Tên đăng nhập hoặc mật khẩu không đúng.'
            : 'Chưa đăng nhập được, thử lại nhé.';
        loiDangNhap.hidden = false;
        oMatKhau.value = '';
        oMatKhau.focus();
      })
      .catch(function () {
        loiDangNhap.textContent = 'Chưa đăng nhập được, thử lại nhé.';
        loiDangNhap.hidden = false;
      })
      .then(function () { nutDangNhap.disabled = false; });
  });

  $('nut-dang-xuat').addEventListener('click', function () {
    var ve0 = function () { hienDangNhap(false); };
    goi('POST', '/dang-xuat').then(ve0, ve0);
  });

  /* ---------- Tìm kiếm, sắp xếp, phân trang ---------- */
  function timNgay() {
    clearTimeout(henTim);
    var tuKhoa = oTim.value.trim();
    nutXoaTim.hidden = oTim.value === '';
    if (tuKhoa === boLoc.tim) return;
    boLoc.tim = tuKhoa;
    boLoc.trang = 1;
    tai(false);
  }

  oTim.addEventListener('input', function () {
    nutXoaTim.hidden = oTim.value === '';
    clearTimeout(henTim);
    henTim = setTimeout(timNgay, TRE_TIM_KIEM);
  });
  oTim.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); timNgay(); }
  });
  nutXoaTim.addEventListener('click', function () {
    oTim.value = '';
    timNgay();
    oTim.focus();
  });

  oSapXep.addEventListener('change', function () {
    boLoc.sapXep = oSapXep.value === 'diem' ? 'diem' : 'moi-nhat';
    boLoc.trang = 1;
    tai(false);
  });

  nutTruoc.addEventListener('click', function () { boLoc.trang -= 1; tai(false); });
  nutSau.addEventListener('click', function () { boLoc.trang += 1; tai(false); });

  /* ---------- Xuất CSV ---------- */
  nutXuatCsv.addEventListener('click', function () {
    nutXuatCsv.disabled = true;
    goiCoPhien('GET', '/xuat-csv' + thamSo(false))
      .then(function (tl) {
        if (!tl.ok) throw new Error('loi');
        var khop = /filename="([^"]+)"/.exec(tl.headers.get('Content-Disposition') || '');
        return tl.blob().then(function (tep) {
          var a = document.createElement('a');
          a.href = URL.createObjectURL(tep);
          a.download = khop ? khop[1] : 'nguoi-choi.csv';
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
          baoLoi('');
        });
      })
      .catch(function (loi) { xuLyLoi(loi, 'Chưa xuất được file, thử lại nhé.'); })
      .then(function () { nutXuatCsv.disabled = false; });
  });

  /* ---------- Xoá ---------- */
  function moHopXoa(nc) {
    sapXoa = nc;
    hopChiTiet.textContent = nc.hoTen + ' · ' + nc.email + '. Không thể hoàn tác.';
    hopXoa.showModal();
    hopHuy.focus();                    // "Huỷ" được chọn sẵn: Enter ngay lúc mở không xoá
  }

  hopHuy.addEventListener('click', function () { hopXoa.close(); });
  hopXoa.addEventListener('click', function (e) {
    if (e.target === hopXoa) hopXoa.close();   // bấm ra ngoài hộp cũng là huỷ
  });
  hopXoa.addEventListener('close', function () { sapXoa = null; });

  hopXacNhan.addEventListener('click', function () {
    var nc = sapXoa;
    if (!nc) return;
    hopXoa.close();
    goiCoPhien('DELETE', '/nguoi-choi/' + encodeURIComponent(nc.id))
      .then(function (tl) {
        if (tl.status === 404) {
          return tai(false).then(function () { baoLoi('Người chơi này đã bị xoá.'); });
        }
        if (!tl.ok) throw new Error('loi');
        return tai(false);              // giữ từ khoá và trang; trang cuối hết dòng thì máy chủ lùi trang
      })
      .catch(function (loi) { xuLyLoi(loi, 'Chưa xoá được, thử lại nhé.'); });
  });

  /* ---------- Mở trang ---------- */
  tai(true);
})();
