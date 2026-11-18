# HAPRO Payroll System

Ứng dụng quản trị lương và hiệu quả dự án theo mô hình HAPRO V43.12: phân bổ nhân sự theo dự án, theo dõi KPI và tính lương tự động.

## Tính năng

- Quản lý nhân sự, phòng ban, vị trí và vai trò trong từng dự án.
- Cấu hình dự án: doanh thu, chi phí trực tiếp, biên lợi nhuận.
- Ma trận phân bổ nhân sự theo dự án và vai trò (Director, Sale, Presale, PM, Tech, Support).
- Thiết lập KPI, trọng số vai trò, quỹ lương và tỷ lệ thưởng.
- Tính lương theo tháng/quý/năm, xem lịch sử và xuất dữ liệu.
- Lưu dữ liệu qua backend JSON nhỏ gọn (`server.cjs`).

## Công nghệ

React 19 · TypeScript · Vite 6 · Express-style HTTP server (Node.js)

## Chạy local

```bash
npm install
npm run backend   # http://localhost:3001
npm run dev       # http://localhost:3000
```

Mặc định Vite proxy `/api` sang backend cổng `3001`.

## Biến môi trường

Tạo `.env.local` từ `.env.example`:

| Biến | Mô tả |
| --- | --- |
| `VITE_ADMIN_PASSWORD` | Mật khẩu mở giao diện quản trị. Nếu không đặt, dùng `demo-admin`. Chỉ là lớp bảo vệ phía client, không thay thế xác thực server. |
| `PORT` | Cổng backend, mặc định `3001`. |

> Không commit `.env.local` hoặc thư mục `data/`. Dữ liệu lương thực tế chỉ nên lưu trên máy chủ nội bộ.

## Dữ liệu

Backend lưu toàn bộ dữ liệu vào `data/data.json`. Lần chạy đầu tiên, ứng dụng dùng dữ liệu mẫu trong `constants.ts`; sau đó dữ liệu được đọc/ghi qua `GET/POST /api/data`.

`constants.ts` chỉ chứa nhân sự và mức lương mẫu. Thay bằng dữ liệu thật trong giao diện hoặc file `data/data.json` khi triển khai.

## Build

```bash
npm run build     # output: dist/
npm run preview
```

## Lưu ý bảo mật

- Đây là ứng dụng nội bộ, không có xác thực phía server. Không triển khai trực tiếp ra Internet.
- Thay `VITE_ADMIN_PASSWORD` và không dùng mật khẩu mặc định khi dùng thật.
- Dữ liệu lương và KPI là thông tin nhạy cảm; giới hạn quyền truy cập thư mục `data/`.
