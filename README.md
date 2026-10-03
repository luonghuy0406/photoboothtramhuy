# Digital Wedding Photobooth · HUY & TRÂM 💍

Hệ thống Photobooth đám cưới tự vận hành (Local-First, Self-Hosted) được thiết kế tối ưu cho máy ảnh **Canon EOS M50**, chạy trên một chiếc laptop làm máy chủ trung tâm kết hợp router Wi-Fi riêng để phục vụ khách mời xem và tải ảnh tức thời qua mạng nội bộ mà **không cần kết nối Internet**.

---

## 1. Kiến trúc hệ thống

```
+---------------------------------------------------------------------------------+
|                                LAPTOP TRUNG TÂM                                 |
|                                                                                 |
|  +--------------------------------+     +------------------------------------+  |
|  |       Desktop Kiosk App        |     |        Local Backend Server        |  |
|  |        (Electron + React)      |     |         (Node.js + Fastify)        |  |
|  |                                |     |                                    |  |
|  |  • Màn hình cảm ứng Kiosk      |     |  • Camera Manager                  |  |
|  |  • 7 bước chụp ảnh mượt mà     |     |  • Image Processor (Sharp)         |  |
|  |  • Âm thanh Web Audio beep     |<--->|  • SQLite DB (WAL Mode)            |  |
|  |  • Flash trắng khi bấm chụp    |     |  • QR Service                      |  |
|  |  • Secret Admin Dashboard      |     |  • Static Photo Server             |  |
|  +--------------------------------+     +-----------------+------------------+  |
+-----------------|-----------------------------------------|---------------------+
                  | USB Tether                              | HTTP LAN (:3000)
                  v                                         v
         +-----------------+                     +--------------------+
         |   Canon EOS M50 |                     |  Private Wi-Fi     |
         |   (Body + Lens) |                     |  Router LAN        |
         +-----------------+                     +---------+----------+
                                                           |
                                            +--------------+--------------+
                                            |                             |
                                            v                             v
                                  +-------------------+         +-------------------+
                                  |   Khách iPhone    |         |   Khách Android   |
                                  |   (Quét QR tải)   |         |   (Quét QR tải)   |
                                  +-------------------+         +-------------------+
```

---

## 2. Phân chia các gói (Monorepo Packages)

Codebase TypeScript sử dụng npm workspaces gồm 4 thành phần:

| Package | Công nghệ | Nhiệm vụ chính |
| :--- | :--- | :--- |
| **`@photobooth/desktop`** | Electron, React 18, Zustand, Framer Motion | Kiosk UI toàn màn hình, quản lý phiên chụp 7 bước, âm thanh & hiệu ứng flash |
| **`@photobooth/server`** | Fastify, Better-SQLite3, Sharp, QRCode | Camera Agent, biên tập Photo Strip cưới, tạo mã QR, phục vụ ảnh & API nội bộ |
| **`@photobooth/guest`** | React 18, Vite | Giao diện mobile tối ưu cho khách quét QR, tải Photo Strip & 3 ảnh gốc |
| **`@photobooth/shared`** | TypeScript | State machine transitions, CameraAdapter interface, EventConfig, API types |

---

## 3. Tích hợp máy ảnh (Canon EOS M50 & Dự phòng Laptop Webcam)

Hệ thống được thiết kế linh hoạt, tự động nhận diện và chuyển đổi:

### Phương án Tự động: Laptop Webcam (Dự phòng thông minh khi chưa có cáp Canon)
- **Cơ chế**: Khi chưa có cáp kết nối Canon M50 hoặc máy ảnh bị ngắt kết nối, hệ thống tự động kích hoạt **Camera tích hợp trên Laptop (FaceTime HD Camera)**:
  - Hiển thị **Live View thực tế 1080p** trên màn hình chuẩn bị và màn hình đếm ngược (gương lật selfie `mirrored`).
  - Tự động chụp ảnh độ phân giải cao từ webcam khi đếm ngược về 0.
  - Tự động tắt đèn camera xanh trên laptop khi không chụp để bảo vệ quyền riêng tư & tiết kiệm pin.

### Phương án Canon EOS Utility Hot Folder (Khi có cáp Micro-USB ★★★★★)
- **Cơ chế**: Canon EOS Utility là phần mềm chính hãng miễn phí của Canon. Nó quản lý kết nối USB, sạc/ngủ của M50, và tự động tải ảnh về laptop ngay khi bấm chụp.
- **Cách cấu hình**:
  1. Cắm cáp Micro-USB từ Canon M50 vào Laptop.
  2. Mở Canon EOS Utility, bật chế độ **Tethered Shooting**.
  3. Đặt thư mục tự động lưu về: `~/PhotoboothData/watch/`.
  4. Hệ thống photobooth sử dụng `EosUtilityWatcherAdapter` tự động bắt event file ảnh mới, kiểm tra ghi xong rồi chuyển vào pipeline xử lý.

### Phương án 2: GPhoto2 CLI Driver (USB Trực tiếp)
- Sử dụng công cụ `gphoto2` (`brew install gphoto2`) để kích hoạt màn trập Canon M50 trực tiếp qua dòng lệnh.

### Phương án 3: Mock Camera Adapter (Dành cho Dev / Test)
- Tự động sinh ảnh demo với màu sắc gradient, thông tin timestamp và thông số máy để kiểm thử toàn bộ giao diện và flow chụp mà không cần gắn máy ảnh thật.

---

## 4. Thiết kế mạng Wi-Fi riêng (Private LAN)

```
SSID:             HUY-TRAM-PHOTO
Băng tần:         5GHz & 2.4GHz
Mật khẩu:         WPA2-PSK (Ví dụ: huytram2025)
DHCP Server:      Bật (Cấp phát dải 192.168.50.20 - 192.168.50.250)
Client Isolation: TẮT (Cho phép điện thoại truy cập HTTP vào laptop)
IP Laptop:        192.168.50.10 (Static IP hoặc DHCP Reservation)
Cổng phục vụ:     3000 (Guest Gallery), 3001 (Admin Internal)
URL mã QR:        http://192.168.50.10:3000/gallery/:sessionId
```

---

## 5. Quy trình chụp ảnh 7 bước (Session State Machine)

```
[ IDLE ]  Welcome Screen: "Huy & Trâm" -> Khách chạm nút "Bắt đầu"
   |
   v
[ PREPARING ]  Xem trước vị trí đứng, hướng dẫn 1-4 người, canh khung hình
   |
   v
[ COUNTDOWN ]  Đếm ngược 3 · 2 · 1 (Có âm thanh Beep + hiển thị kiểu ảnh 1/3)
   |
   v
[ CAPTURING ]  Hiệu ứng Flash trắng + tiếng chụp Shutter -> Lưu ảnh
   |-- (Còn kiểu ảnh tiếp theo? -> Quay lại COUNTDOWN)
   v
[ REVIEWING ]  Xem lại 3 kiểu ảnh đã chụp:
   |-- [ Chụp lại ] -> Reset và chụp lại lượt mới
   +-- [ Đồng ý / In ảnh ] -> Chuyển sang bước ghép ảnh
   v
[ PROCESSING ] Ghép 3 ảnh thành Photo Strip cưới thanh lịch + Tạo mã QR
   |
   v
[ QR_DISPLAY ] Hiển thị mã QR tải ảnh + Wi-Fi HUY-TRAM-PHOTO (Đếm ngược 25s về Welcome)
   |
   v
[ IDLE ]  Sẵn sàng cho nhóm khách tiếp theo
```

---

## 6. Hướng dẫn cài đặt & Khởi chạy

### Yêu cầu môi trường
- Node.js >= 20
- npm >= 10
- macOS hoặc Windows laptop

### Cài đặt dependencies
```bash
npm install
```

### Chạy hệ thống photobooth
```bash
# Cách 1: Sử dụng bash script tự động
./scripts/start-photobooth.sh

# Cách 2: Khởi chạy từng thành phần
npm run start --workspace=@photobooth/server   # Khởi động Fastify API trên cổng 3000
npm run dev --workspace=@photobooth/desktop     # Khởi động Electron Kiosk UI
npm run dev --workspace=@photobooth/guest       # Mở dev server cho Guest Gallery
```

---

## 7. Phím tắt & Bảng điều khiển Admin bí mật

- **Mở Admin Dashboard**: Chạm nhanh **3 lần** vào góc trên cùng bên phải màn hình Welcome, hoặc mở qua API `http://localhost:3001/api/admin/config`.
- **Thoát Kiosk**: Nhấn tổ hợp phím `Command + Shift + Q` (macOS) hoặc `Ctrl + Shift + Q` (Windows).
- **Chuyển Fullscreen**: Nhấn phím `F11`.
- **Xuất toàn bộ Album**: Trong Admin Modal, bấm nút **"Xuất toàn bộ album ảnh"**, hệ thống sẽ tự động tổng hợp tất cả ảnh gốc, ảnh strip và tạo sẵn file `index.html` để cô dâu chú rể lưu trữ trọn đời.
