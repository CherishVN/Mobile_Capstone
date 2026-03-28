# E-Commerce Mobile App - Customer

Ứng dụng mobile React Native dành cho khách hàng mua sắm.

## 🚀 Chạy App

```bash
cd Mobile
npm install --legacy-peer-deps
npm start
```

Sau đó scan QR code bằng **Expo Go** app.

## 📱 Tính năng

- ✅ Đăng nhập/Đăng ký (Supabase Auth)
- ✅ Xem & tìm kiếm sản phẩm
- ✅ Chi tiết sản phẩm với variants
- ✅ Giỏ hàng & thanh toán
- ✅ Quản lý đơn hàng
- ✅ Quản lý tài khoản & địa chỉ

## 🛠️ Tech Stack

- React Native + Expo (SDK 52)
- TypeScript
- Expo Router
- Zustand
- Supabase Auth
- Axios

## 📂 Cấu trúc

```
Mobile/
├── app/           # Screens (21 screens với Expo Router)
├── components/    # UI components (13 components)
├── services/      # API services (7 files)
├── store/         # State management (Zustand)
├── types/         # TypeScript types
├── lib/           # Core libraries (API client, Supabase)
└── hooks/         # Custom hooks
```

## ⚙️ Cấu hình

File `.env` đã được tạo sẵn. Nếu test trên **thiết bị thật**, thay `localhost` bằng IP máy tính:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.XXX:5153
```

Tìm IP: chạy `ipconfig` (Windows).

## 📂 Screens

- **Bottom Tabs:** Home, Categories, Orders, Profile
- **Auth:** Login, Register, Forgot Password
- **Shopping:** Products, Product Detail, Search, Cart, Checkout
- **Profile:** Edit Profile, Addresses, Change Password
- **Orders:** Order History, Order Detail

## 👥 Team

**Mã dự án:** SP26SE114  
**Team:** SE183534, SE183554, SE183550, SE183565  
**Giảng viên:** Phan Minh Tâm (tampm@fe.edu.vn)

---

**Version:** 1.0.0 | **Updated:** March 2026
