# نظام إدارة المطبعة ودار النشر

## نظرة عامة
تطبيق ويب متكامل لإدارة مطبعة ودار نشر بواجهة عربية 100% مع دعم الباركود.

## التقنيات المستخدمة
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + Shadcn UI
- **Backend**: Node.js + Express
- **Database**: PostgreSQL (Drizzle ORM)
- **Barcode**: JsBarcode للتوليد

## الميزات الرئيسية

### 1. المستخدمون والصلاحيات
- تسجيل دخول عربي
- دور المدير (صلاحيات كاملة)
- دور الموظف

### 2. إدارة المخزون + باركود
- إضافة مواد جديدة (ورق، حبر، غلاف، كتاب)
- توليد باركود تلقائي لكل مادة
- طباعة الباركود
- مسح الباركود يدوياً
- تسجيل حركات الدخول/الخروج
- تنبيهات المخزون المنخفض

### 3. إدارة طلبات الطباعة
- إضافة طلبات جديدة
- تتبع حالة الطلب
- أنواع طباعة متعددة

### 4. إدارة دار النشر (الكتب)
- إضافة كتب مع ISBN وباركود
- تتبع النسخ المطبوعة والمباعة
- بيع الكتب عبر الباركود

### 5. المبيعات والمحاسبة
- تسجيل المبيعات
- إضافة المصروفات
- حساب الأرباح

### 6. لوحة التحكم
- إحصائيات شاملة
- رسوم بيانية
- تنبيهات

## هيكل المشروع

```
client/
├── src/
│   ├── components/
│   │   ├── app-sidebar.tsx        # القائمة الجانبية
│   │   ├── barcode-generator.tsx  # مولد الباركود
│   │   ├── barcode-scanner.tsx    # ماسح الباركود
│   │   └── theme-toggle.tsx       # تبديل الوضع
│   ├── lib/
│   │   └── auth-context.tsx       # سياق المصادقة
│   ├── pages/
│   │   ├── dashboard.tsx          # لوحة التحكم
│   │   ├── inventory.tsx          # المخزون
│   │   ├── orders.tsx             # الطلبات
│   │   ├── books.tsx              # الكتب
│   │   ├── sales.tsx              # المبيعات
│   │   └── login.tsx              # تسجيل الدخول
│   └── App.tsx                    # التطبيق الرئيسي
server/
├── db.ts                          # اتصال قاعدة البيانات
├── routes.ts                      # API endpoints
└── storage.ts                     # طبقة التخزين
shared/
└── schema.ts                      # مخطط قاعدة البيانات
```

## API Endpoints

### المصادقة
- `POST /api/auth/login` - تسجيل الدخول

### المخزون
- `GET /api/materials` - جلب جميع المواد
- `POST /api/materials` - إضافة مادة جديدة
- `GET /api/materials/:barcode` - جلب مادة بالباركود
- `GET /api/inventory-movements` - جلب حركات المخزون
- `POST /api/inventory-movements` - تسجيل حركة

### الطلبات
- `GET /api/orders` - جلب جميع الطلبات
- `POST /api/orders` - إضافة طلب جديد
- `PATCH /api/orders/:id/status` - تحديث حالة الطلب

### الكتب
- `GET /api/books` - جلب جميع الكتب
- `POST /api/books` - إضافة كتاب جديد
- `POST /api/books/:id/sell` - بيع كتاب

### المبيعات
- `GET /api/sales` - جلب المبيعات
- `GET /api/sales/stats` - إحصائيات المبيعات
- `GET /api/expenses` - جلب المصروفات
- `POST /api/expenses` - إضافة مصروف

### لوحة التحكم
- `GET /api/dashboard/stats` - إحصائيات اللوحة

## بيانات الدخول التجريبية
- المستخدم: `admin`
- كلمة المرور: `admin123`

## التشغيل
```bash
npm run dev
```

## التاريخ
- 2026-01-22: الإصدار الأول - نظام متكامل مع RTL ودعم الباركود
