import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMaterialSchema, updateMaterialSchema, insertInventoryMovementSchema, insertPrintOrderSchema, insertBookSchema, updateBookSchema, insertExpenseSchema, insertUserSchema, updateUserSchema, insertSavedCalculationSchema, type InsertActivityLog } from "@shared/schema";
import { createHash } from "crypto";

// دالة لتشفير كلمة المرور
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";

// دالة مساعدة للحصول على عنوان IP
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || 'unknown';
}

// دالة مساعدة لتسجيل النشاط
async function logActivity(data: {
  userId?: string;
  userName: string;
  userRole: string;
  action: string;
  entityType: string;
  entityId?: string;
  entityName?: string;
  details?: string;
  ipAddress?: string;
}) {
  try {
    await storage.createActivityLog(data as InsertActivityLog);
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}

// إعداد Multer لرفع صور الأغلفة
const uploadsDir = path.join(process.cwd(), "uploads", "covers");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const coverStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'cover-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadCover = multer({
  storage: coverStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('نوع الملف غير مدعوم'));
  }
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      let user = await storage.getUserByUsername(username);
      
      if (!user) {
        // Create default admin user for first login
        if (username === "admin" && password === "admin123") {
          user = await storage.createUser({
            username: "admin",
            password: "admin",
            fullName: "مدير النظام",
            role: "admin",
          });
        } else {
          return res.status(401).json({ message: "بيانات الدخول غير صحيحة" });
        }
      }
      
      // التحقق من أن المستخدم نشط
      if (!user.isActive) {
        return res.status(401).json({ message: "تم تعطيل هذا الحساب" });
      }
      
      if (user.password !== password) {
        return res.status(401).json({ message: "بيانات الدخول غير صحيحة" });
      }
      
      // تسجيل نشاط الدخول
      await logActivity({
        userId: user.id,
        userName: user.fullName,
        userRole: user.role,
        action: 'login',
        entityType: 'auth',
        details: 'تسجيل دخول ناجح',
        ipAddress: getClientIp(req),
      });
      
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "خطأ في الخادم" });
    }
  });

  // تسجيل الخروج
  app.post("/api/auth/logout", async (req, res) => {
    try {
      const { userId, userName, userRole } = req.body;
      
      // التحقق من صحة بيانات المستخدم قبل التسجيل
      if (userId) {
        const user = await storage.getUser(userId);
        // فقط سجل الخروج إذا كان المستخدم موجوداً ومتطابق
        if (user && user.fullName === userName) {
          await logActivity({
            userId: user.id,
            userName: user.fullName,
            userRole: user.role,
            action: 'logout',
            entityType: 'auth',
            details: 'تسجيل خروج',
            ipAddress: getClientIp(req),
          });
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "خطأ في تسجيل الخروج" });
    }
  });

  // ===== إدارة المستخدمين =====
  app.get("/api/users", async (req, res) => {
    try {
      const usersList = await storage.getUsers();
      // إخفاء كلمات المرور من الاستجابة
      const usersWithoutPassword = usersList.map(({ password, ...user }) => user);
      res.json(usersWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: "خطأ في جلب المستخدمين" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const { currentUser, ...userData } = req.body;
      const validatedData = insertUserSchema.parse(userData);
      
      // التحقق من عدم وجود اسم مستخدم مكرر
      const existingUser = await storage.getUserByUsername(validatedData.username);
      if (existingUser) {
        return res.status(400).json({ message: "اسم المستخدم موجود مسبقاً" });
      }
      
      const user = await storage.createUser(validatedData);
      
      // تسجيل النشاط
      if (currentUser) {
        await logActivity({
          userId: currentUser.id,
          userName: currentUser.fullName,
          userRole: currentUser.role,
          action: 'create',
          entityType: 'user',
          entityId: user.id,
          entityName: user.fullName,
          details: `إضافة موظف جديد: ${user.fullName} (${user.role})`,
          ipAddress: getClientIp(req),
        });
      }
      
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "بيانات غير صالحة", errors: error.errors });
      }
      res.status(500).json({ message: "خطأ في إضافة المستخدم" });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const userId = req.params.id;
      const { currentUser, ...updateData } = req.body;
      const validatedData = updateUserSchema.parse(updateData);
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "المستخدم غير موجود" });
      }
      
      // التحقق من عدم تكرار اسم المستخدم
      if (validatedData.username && validatedData.username !== user.username) {
        const existingUser = await storage.getUserByUsername(validatedData.username);
        if (existingUser) {
          return res.status(400).json({ message: "اسم المستخدم موجود مسبقاً" });
        }
      }
      
      const updatedUser = await storage.updateUser(userId, validatedData);
      
      // تسجيل النشاط
      if (currentUser) {
        await logActivity({
          userId: currentUser.id,
          userName: currentUser.fullName,
          userRole: currentUser.role,
          action: 'update',
          entityType: 'user',
          entityId: userId,
          entityName: updatedUser.fullName,
          details: `تعديل بيانات موظف: ${updatedUser.fullName}`,
          ipAddress: getClientIp(req),
        });
      }
      
      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "بيانات غير صالحة", errors: error.errors });
      }
      res.status(500).json({ message: "خطأ في تحديث المستخدم" });
    }
  });

  app.patch("/api/users/:id/toggle-active", async (req, res) => {
    try {
      const userId = req.params.id;
      const { isActive, currentUser } = req.body;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "المستخدم غير موجود" });
      }
      
      // منع تعطيل المدير الرئيسي
      if (user.username === "admin" && !isActive) {
        return res.status(400).json({ message: "لا يمكن تعطيل حساب المدير الرئيسي" });
      }
      
      await storage.toggleUserActive(userId, isActive);
      
      // تسجيل النشاط
      if (currentUser) {
        await logActivity({
          userId: currentUser.id,
          userName: currentUser.fullName,
          userRole: currentUser.role,
          action: 'update',
          entityType: 'user',
          entityId: userId,
          entityName: user.fullName,
          details: isActive ? `تفعيل حساب: ${user.fullName}` : `تعطيل حساب: ${user.fullName}`,
          ipAddress: getClientIp(req),
        });
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "خطأ في تحديث حالة المستخدم" });
    }
  });

  // تغيير كلمة مرور الموظف (للمدير فقط)
  app.patch("/api/users/:id/password", async (req, res) => {
    try {
      const userId = req.params.id;
      const { newPassword, currentUser } = req.body;
      const userRole = req.headers['x-user-role'];
      
      // التحقق من صلاحية المدير
      if (userRole !== 'admin') {
        return res.status(403).json({ message: "هذه العملية متاحة للمدير فقط" });
      }
      
      // التحقق من كلمة المرور الجديدة
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" });
      }
      
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "المستخدم غير موجود" });
      }
      
      // تشفير كلمة المرور الجديدة
      const hashedPassword = hashPassword(newPassword);
      await storage.updateUserPassword(userId, hashedPassword);
      
      // تسجيل النشاط (بدون تخزين كلمة السر)
      if (currentUser) {
        await logActivity({
          userId: currentUser.id,
          userName: currentUser.fullName,
          userRole: currentUser.role,
          action: 'update',
          entityType: 'user',
          entityId: userId,
          entityName: targetUser.fullName,
          details: `تغيير كلمة مرور الموظف: ${targetUser.fullName}`,
          ipAddress: getClientIp(req),
        });
      }
      
      res.json({ success: true, message: "تم تغيير كلمة المرور بنجاح" });
    } catch (error) {
      res.status(500).json({ message: "خطأ في تغيير كلمة المرور" });
    }
  });

  // Materials routes
  app.get("/api/materials", async (req, res) => {
    try {
      const materials = await storage.getMaterials();
      res.json(materials);
    } catch (error) {
      res.status(500).json({ message: "خطأ في جلب المواد" });
    }
  });

  app.post("/api/materials", async (req, res) => {
    try {
      const userRole = req.headers['x-user-role'];
      const { currentUser, ...materialData } = req.body;
      
      // التحقق من صلاحية الإضافة (مسموح للمدير فقط)
      if (userRole !== 'admin') {
        return res.status(403).json({ message: "صلاحية الإضافة متاحة للمدير فقط" });
      }

      const validatedData = insertMaterialSchema.parse(materialData);
      const material = await storage.createMaterial(validatedData);
      
      // تسجيل النشاط
      if (currentUser) {
        await logActivity({
          userId: currentUser.id,
          userName: currentUser.fullName,
          userRole: currentUser.role,
          action: 'create',
          entityType: 'material',
          entityId: material.id,
          entityName: material.name,
          details: `إضافة مادة جديدة: ${material.name} (${material.type})`,
          ipAddress: getClientIp(req),
        });
      }
      
      res.json(material);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "بيانات غير صالحة", errors: error.errors });
      }
      res.status(500).json({ message: "خطأ في إضافة المادة" });
    }
  });

  app.get("/api/materials/:barcode", async (req, res) => {
    try {
      const material = await storage.getMaterialByBarcode(req.params.barcode);
      if (!material) {
        return res.status(404).json({ message: "المادة غير موجودة" });
      }
      res.json(material);
    } catch (error) {
      res.status(500).json({ message: "خطأ في جلب المادة" });
    }
  });

  // تحديث مادة (السعر، الحجم، النوع)
  app.patch("/api/materials/:id", async (req, res) => {
    try {
      const userRole = req.headers['x-user-role'];
      const { currentUser, ...updateData } = req.body;
      const materialId = req.params.id;
      
      // التحقق من صلاحية التعديل (مسموح للمدير فقط)
      if (userRole !== 'admin') {
        return res.status(403).json({ message: "صلاحية التعديل متاحة للمدير فقط" });
      }
      
      const existingMaterial = await storage.getMaterial(materialId);
      if (!existingMaterial) {
        return res.status(404).json({ message: "المادة غير موجودة" });
      }
      
      // تنظيف البيانات - تحويل السلاسل الفارغة إلى null للحقول الاختيارية
      const cleanedData = {
        ...updateData,
        paperSize: updateData.paperSize || null,
        paperVariant: updateData.paperVariant || null,
      };
      
      // إزالة حقول الورق إذا لم تكن المادة من نوع ورق
      if (existingMaterial.type !== 'paper') {
        cleanedData.paperSize = null;
        cleanedData.paperVariant = null;
      }
      
      const validatedData = updateMaterialSchema.parse(cleanedData);
      const material = await storage.updateMaterial(materialId, validatedData);
      
      // تسجيل النشاط
      if (currentUser) {
        await logActivity({
          userId: currentUser.id,
          userName: currentUser.fullName,
          userRole: currentUser.role,
          action: 'update',
          entityType: 'material',
          entityId: materialId,
          entityName: material.name,
          details: `تحديث مادة: ${material.name}`,
          ipAddress: getClientIp(req),
        });
      }
      
      res.json(material);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "بيانات غير صالحة", errors: error.errors });
      }
      res.status(500).json({ message: "خطأ في تحديث المادة" });
    }
  });

  // حذف مادة (Soft Delete)
  app.delete("/api/materials/:id", async (req, res) => {
    try {
      const userRole = req.headers['x-user-role'];
      const currentUser = req.body.currentUser;
      const materialId = req.params.id;
      
      const material = await storage.getMaterial(materialId);
      if (!material) {
        return res.status(404).json({ message: "المادة غير موجودة" });
      }
      
      // التحقق من وجود حركات مسجلة للمادة
      const hasMovements = await storage.hasMaterialMovements(materialId);
      if (hasMovements && userRole !== "admin") {
        return res.status(403).json({ 
          message: "لا يمكن حذف مادة لها حركات مسجلة. يتطلب صلاحية المدير" 
        });
      }

      if (userRole !== 'admin') {
        return res.status(403).json({ message: "صلاحية الحذف متاحة للمدير فقط" });
      }
      
      await storage.softDeleteMaterial(materialId);
      
      // تسجيل النشاط
      if (currentUser) {
        await logActivity({
          userId: currentUser.id,
          userName: currentUser.fullName,
          userRole: currentUser.role,
          action: 'delete',
          entityType: 'material',
          entityId: materialId,
          entityName: material.name,
          details: `حذف مادة: ${material.name}`,
          ipAddress: getClientIp(req),
        });
      }
      
      res.json({ success: true, message: "تم حذف المادة بنجاح" });
    } catch (error) {
      res.status(500).json({ message: "خطأ في حذف المادة" });
    }
  });

  // Inventory movements routes
  app.get("/api/inventory-movements", async (req, res) => {
    try {
      const movements = await storage.getInventoryMovements();
      res.json(movements);
    } catch (error) {
      res.status(500).json({ message: "خطأ في جلب الحركات" });
    }
  });

  app.post("/api/inventory-movements", async (req, res) => {
    try {
      const { currentUser, ...movementData } = req.body;
      const validatedData = insertInventoryMovementSchema.parse(movementData);
      
      // Update material quantity
      const material = await storage.getMaterial(validatedData.materialId);
      if (!material) {
        return res.status(404).json({ message: "المادة غير موجودة" });
      }
      
      let newQuantity = material.quantity;
      if (validatedData.type === "in") {
        newQuantity += validatedData.quantity;
      } else {
        newQuantity -= validatedData.quantity;
        if (newQuantity < 0) {
          return res.status(400).json({ message: "الكمية غير كافية" });
        }
      }
      
      await storage.updateMaterialQuantity(material.id, newQuantity);
      const movement = await storage.createInventoryMovement(validatedData);
      
      // تسجيل النشاط
      if (currentUser) {
        const actionType = validatedData.type === 'in' ? 'إدخال' : 'إخراج';
        await logActivity({
          userId: currentUser.id,
          userName: currentUser.fullName,
          userRole: currentUser.role,
          action: validatedData.type === 'in' ? 'inventory_in' : 'inventory_out',
          entityType: 'inventory_movement',
          entityId: movement.id,
          entityName: material.name,
          details: `${actionType} ${validatedData.quantity} من ${material.name}`,
          ipAddress: getClientIp(req),
        });
      }
      
      res.json(movement);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "بيانات غير صالحة", errors: error.errors });
      }
      res.status(500).json({ message: "خطأ في تسجيل الحركة" });
    }
  });

  // Orders routes
  app.get("/api/orders", async (req, res) => {
    try {
      const orders = await storage.getOrders();
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: "خطأ في جلب الطلبات" });
    }
  });

  app.post("/api/orders", async (req, res) => {
    try {
      const userRole = req.headers['x-user-role'];
      const { currentUser, ...orderData } = req.body;
      const validatedData = insertPrintOrderSchema.parse(orderData);
      const order = await storage.createOrder(validatedData);
      
      // تسجيل النشاط
      if (currentUser) {
        await logActivity({
          userId: currentUser.id,
          userName: currentUser.fullName,
          userRole: currentUser.role,
          action: 'create',
          entityType: 'order',
          entityId: order.id,
          entityName: order.customerName,
          details: `إضافة طلب طباعة جديد: ${order.customerName} - ${order.printType}`,
          ipAddress: getClientIp(req),
        });
      }
      
      res.json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "بيانات غير صالحة", errors: error.errors });
      }
      res.status(500).json({ message: "خطأ في إضافة الطلب" });
    }
  });

  // تحديث حالة الطلب
  app.patch("/api/orders/:id/status", async (req, res) => {
    try {
      const userRole = req.headers['x-user-role'];
      const { status, currentUser } = req.body;
      const order = await storage.getOrder(req.params.id);
      
      if (!order) {
        return res.status(404).json({ message: "الطلب غير موجود" });
      }

      // إذا كان الطلب مكتملاً، لا يمكن تغيير حالته إلا بواسطة المدير
      if (order.status === 'completed' && userRole !== 'admin') {
        return res.status(403).json({ message: "لا يمكن تعديل حالة الطلبات المكتملة إلا بواسطة المدير" });
      }

      await storage.updateOrderStatus(req.params.id, status);
      
      // تسجيل النشاط
      if (currentUser && order) {
        const statusArabic: Record<string, string> = {
          pending: 'قيد الانتظار',
          in_progress: 'قيد التنفيذ',
          completed: 'مكتمل',
          cancelled: 'ملغي'
        };
        await logActivity({
          userId: currentUser.id,
          userName: currentUser.fullName,
          userRole: currentUser.role,
          action: 'update',
          entityType: 'order',
          entityId: req.params.id,
          entityName: order.customerName,
          details: `تغيير حالة طلب ${order.customerName} إلى: ${statusArabic[status] || status}`,
          ipAddress: getClientIp(req),
        });
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "خطأ في تحديث الحالة" });
    }
  });

  // تحديث بيانات الطلب
  app.patch("/api/orders/:id", async (req, res) => {
    try {
      const userRole = req.headers['x-user-role'];
      const id = req.params.id;
      const { currentUser, ...updates } = req.body;
      
      const order = await storage.getOrder(id);
      if (!order) return res.status(404).json({ message: "الطلب غير موجود" });

      // التحقق من الصلاحيات
      if (userRole !== 'admin' && order.status === 'completed') {
        return res.status(403).json({ message: "لا يمكن تعديل الطلبات المكتملة إلا بواسطة المدير" });
      }

      const updatedOrder = await storage.updateOrder(id, updates);

      // تسجيل النشاط
      await logActivity({
        userId: currentUser?.id || "unknown",
        userName: currentUser?.fullName || "unknown",
        userRole: currentUser?.role || "employee",
        action: "update",
        entityType: "order",
        entityId: id,
        details: `تعديل طلب الطباعة للزبون: ${order.customerName}`,
        ipAddress: getClientIp(req),
      });

      res.json(updatedOrder);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // حذف طلب (Soft Delete - للمدير فقط أو الطلبات غير المكتملة)
  app.delete("/api/orders/:id", async (req, res) => {
    try {
      const userRole = req.headers['x-user-role'];
      const orderId = req.params.id;
      const { currentUser } = req.body;
      
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "الطلب غير موجود" });
      }

      // التحقق من صلاحية المدير للحذف
      if (userRole !== 'admin') {
        return res.status(403).json({ message: "صلاحية الحذف متاحة للمدير فقط" });
      }

      // إذا كان الطلب مكتملاً، يتطلب صلاحية المدير (تم التحقق منها أعلاه بالفعل كونه أدمن)
      
      await storage.softDeleteOrder(orderId);
      
      // تسجيل النشاط
      await logActivity({
        userId: currentUser.id,
        userName: currentUser.fullName,
        userRole: currentUser.role,
        action: 'delete',
        entityType: 'order',
        entityId: orderId,
        entityName: order.customerName,
        details: `حذف طلب: ${order.customerName} - ${order.printType}`,
        ipAddress: getClientIp(req),
      });
      
      res.json({ success: true, message: "تم حذف الطلب بنجاح" });
    } catch (error) {
      res.status(500).json({ message: "خطأ في حذف الطلب" });
    }
  });

  // Books routes
  app.get("/api/books", async (req, res) => {
    try {
      const booksList = await storage.getBooks();
      res.json(booksList);
    } catch (error) {
      res.status(500).json({ message: "خطأ في جلب الكتب" });
    }
  });

  app.post("/api/books", async (req, res) => {
    try {
      const userRole = req.headers['x-user-role'];
      const { currentUser, ...bookData } = req.body;
      const validatedData = insertBookSchema.parse(bookData);
      
      // التحقق من صلاحية الإضافة (مسموح للمدير فقط)
      if (userRole !== 'admin') {
        return res.status(403).json({ message: "صلاحية الإضافة متاحة للمدير فقط" });
      }

      // التحقق من أن ISBN فريد
      const existingBook = await storage.getBooks().then(books => books.find(b => b.isbn === validatedData.isbn && !b.isDeleted));
      if (existingBook) {
        return res.status(400).json({ message: "رقم ISBN مسجل مسبقاً لكتاب آخر" });
      }

      const book = await storage.createBook(validatedData);
      
      // تسجيل النشاط
      if (currentUser) {
        await logActivity({
          userId: currentUser.id,
          userName: currentUser.fullName,
          userRole: currentUser.role,
          action: 'create',
          entityType: 'book',
          entityId: book.id,
          entityName: book.title,
          details: `إضافة كتاب جديد: ${book.title} - ${book.author}`,
          ipAddress: getClientIp(req),
        });
      }
      
      res.json(book);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "بيانات غير صالحة", errors: error.errors });
      }
      res.status(500).json({ message: "خطأ في إضافة الكتاب" });
    }
  });

  // تحديث كميات الكتاب
  app.patch("/api/books/:id/quantities", async (req, res) => {
    try {
      const bookId = req.params.id as string;
      const book = await storage.getBook(bookId);
      if (!book) {
        return res.status(404).json({ message: "الكتاب غير موجود" });
      }
      
      const { totalQuantity, readyQuantity, printingQuantity, currentUser } = req.body;
      
      // التحقق من صحة الكميات
      if (totalQuantity < 0 || readyQuantity < 0 || printingQuantity < 0) {
        return res.status(400).json({ message: "الكميات يجب أن تكون أكبر من أو تساوي صفر" });
      }
      
      // منع تسجيل كمية جاهزة أكبر من الكمية الإجمالية
      if (readyQuantity > totalQuantity) {
        return res.status(400).json({ message: "الكمية الجاهزة لا يمكن أن تكون أكبر من الكمية الإجمالية" });
      }
      
      // منع الكمية قيد الطباعة من تجاوز الكمية المتبقية
      if (readyQuantity + printingQuantity > totalQuantity) {
        return res.status(400).json({ message: "مجموع الكمية الجاهزة وقيد الطباعة لا يمكن أن يتجاوز الكمية الإجمالية" });
      }
      
      const oldStatus = book.status;
      const updatedBook = await storage.updateBookQuantities(
        bookId, 
        totalQuantity, 
        readyQuantity, 
        printingQuantity
      );
      
      // تسجيل النشاط
      if (currentUser) {
        const statusChanged = oldStatus !== updatedBook.status;
        const statusArabic: Record<string, string> = {
          ready: 'جاهز',
          printing: 'قيد الطباعة',
          unavailable: 'غير متوفر'
        };
        
        await logActivity({
          userId: currentUser.id,
          userName: currentUser.fullName,
          userRole: currentUser.role,
          action: 'update',
          entityType: 'book',
          entityId: bookId,
          entityName: book.title,
          details: statusChanged 
            ? `تغيير حالة كتاب "${book.title}" إلى: ${statusArabic[updatedBook.status] || updatedBook.status}`
            : `تحديث كميات كتاب "${book.title}": جاهز=${readyQuantity}, قيد الطباعة=${printingQuantity}`,
          ipAddress: getClientIp(req),
        });
      }
      
      res.json(updatedBook);
    } catch (error) {
      res.status(500).json({ message: "خطأ في تحديث كميات الكتاب" });
    }
  });

  // رفع صورة غلاف الكتاب
  app.post("/api/books/:id/cover", uploadCover.single('cover'), async (req, res) => {
    try {
      const bookId = req.params.id as string;
      const book = await storage.getBook(bookId);
      if (!book) {
        return res.status(404).json({ message: "الكتاب غير موجود" });
      }
      
      if (!req.file) {
        return res.status(400).json({ message: "لم يتم رفع أي ملف" });
      }
      
      const coverPath = `/uploads/covers/${req.file.filename}`;
      await storage.updateBookCover(book.id, coverPath);
      
      res.json({ success: true, coverImage: coverPath });
    } catch (error) {
      res.status(500).json({ message: "خطأ في رفع صورة الغلاف" });
    }
  });

  // تحديث بيانات الكتاب (الاسم، المؤلف، الصنف، ISBN، الكميات)
  app.patch("/api/books/:id", async (req, res) => {
    try {
      const userRole = req.headers['x-user-role'];
      const bookId = req.params.id;
      const { currentUser, ...updateData } = req.body;
      
      // التحقق من صلاحية التعديل (مسموح للمدير فقط)
      if (userRole !== 'admin') {
        return res.status(403).json({ message: "صلاحية التعديل متاحة للمدير فقط" });
      }

      const book = await storage.getBook(bookId);
      if (!book) {
        return res.status(404).json({ message: "الكتاب غير موجود" });
      }
      
      // التحقق من تفرد ISBN إذا تم تغييره
      if (updateData.isbn && updateData.isbn !== book.isbn) {
        const existingBook = await storage.getBookByIsbn(updateData.isbn);
        if (existingBook && existingBook.id !== bookId) {
          return res.status(400).json({ message: "رقم ISBN مستخدم مسبقاً لكتاب آخر" });
        }
      }
      
      // التحقق من صحة الكميات إذا تم تحديثها
      const totalQty = updateData.totalQuantity ?? book.totalQuantity ?? 0;
      const readyQty = updateData.readyQuantity ?? book.readyQuantity ?? 0;
      const printingQty = updateData.printingQuantity ?? book.printingQuantity ?? 0;
      
      if (readyQty > totalQty) {
        return res.status(400).json({ message: "الكمية الجاهزة لا يمكن أن تكون أكبر من الكمية الإجمالية" });
      }
      if (readyQty + printingQty > totalQty) {
        return res.status(400).json({ message: "مجموع الكميات لا يمكن أن يتجاوز الكمية الإجمالية" });
      }
      
      const validatedData = updateBookSchema.parse(updateData);
      const updatedBook = await storage.updateBook(bookId, validatedData);
      
      // تسجيل النشاط إذا كان هناك تغيير في حقول التسعير
      if (currentUser) {
        const changes: string[] = [];
        if (updateData.title && updateData.title !== book.title) changes.push(`الاسم: ${updateData.title}`);
        if (updateData.author && updateData.author !== book.author) changes.push(`المؤلف: ${updateData.author}`);
        if (updateData.isbn && updateData.isbn !== book.isbn) changes.push(`ISBN: ${updateData.isbn}`);
        if (updateData.category && updateData.category !== book.category) changes.push(`الصنف: ${updateData.category}`);
        if (updateData.paperPricePerSheet !== undefined) changes.push(`سعر الورق (${updateData.paperPricePerSheet})`);
        if (updateData.inkCartridgePrice !== undefined) changes.push(`سعر الحبر (${updateData.inkCartridgePrice})`);
        if (updateData.pageCount !== undefined) changes.push(`عدد الصفحات (${updateData.pageCount})`);
        if (updateData.totalQuantity !== undefined) changes.push(`عدد النسخ (${updateData.totalQuantity})`);
        
        await logActivity({
          userId: currentUser.id,
          userName: currentUser.fullName,
          userRole: currentUser.role,
          action: 'update',
          entityType: 'book',
          entityId: bookId,
          entityName: updatedBook.title,
          details: changes.length > 0 
            ? `تعديل كتاب "${book.title}": ${changes.join('، ')}`
            : `تعديل بيانات كتاب "${book.title}"`,
          ipAddress: getClientIp(req),
        });
      }
      
      res.json(updatedBook);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "بيانات غير صالحة", errors: error.errors });
      }
      res.status(500).json({ message: "خطأ في تحديث بيانات الكتاب" });
    }
  });

  // حذف كتاب (Soft Delete - للمدير فقط)
  app.delete("/api/books/:id", async (req, res) => {
    try {
      const bookId = req.params.id;
      const { currentUser } = req.body;
      const userRole = req.headers['x-user-role'];
      
      // التحقق من صلاحية المدير
      if (userRole !== 'admin') {
        return res.status(403).json({ message: "صلاحية الحذف متاحة للمدير فقط" });
      }
      
      const book = await storage.getBook(bookId);
      if (!book) {
        return res.status(404).json({ message: "الكتاب غير موجود" });
      }
      
      await storage.softDeleteBook(bookId);
      
      // تسجيل النشاط
      if (currentUser) {
        await logActivity({
          userId: currentUser.id,
          userName: currentUser.fullName,
          userRole: currentUser.role,
          action: 'delete',
          entityType: 'book',
          entityId: bookId,
          entityName: book.title,
          details: `حذف كتاب: ${book.title} - ${book.author}`,
          ipAddress: getClientIp(req),
        });
      }
      
      res.json({ success: true, message: "تم حذف الكتاب بنجاح" });
    } catch (error) {
      res.status(500).json({ message: "خطأ في حذف الكتاب" });
    }
  });

  // Expenses routes
  app.get("/api/expenses", async (req, res) => {
    try {
      const expensesList = await storage.getExpenses();
      res.json(expensesList);
    } catch (error) {
      res.status(500).json({ message: "خطأ في جلب المصروفات" });
    }
  });

  app.post("/api/expenses", async (req, res) => {
    try {
      const validatedData = insertExpenseSchema.parse(req.body);
      const expense = await storage.createExpense(validatedData);
      res.json(expense);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "بيانات غير صالحة", errors: error.errors });
      }
      res.status(500).json({ message: "خطأ في إضافة المصروف" });
    }
  });

  // Dashboard routes
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "خطأ في جلب الإحصائيات" });
    }
  });

  // ===== Saved Calculations =====
  app.get("/api/calculations", async (req, res) => {
    try {
      const calculations = await storage.getSavedCalculations();
      res.json(calculations);
    } catch (error) {
      console.error("Error fetching calculations:", error);
      res.status(500).json({ message: "خطأ في جلب الحسابات المحفوظة" });
    }
  });

  app.post("/api/calculations", async (req, res) => {
    try {
      const validatedData = insertSavedCalculationSchema.parse(req.body);
      const calculation = await storage.createSavedCalculation(validatedData);
      res.json(calculation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "بيانات غير صالحة", errors: error.errors });
      }
      console.error("Error saving calculation:", error);
      res.status(500).json({ message: "خطأ في حفظ الحساب" });
    }
  });

  app.delete("/api/calculations/:id", async (req, res) => {
    try {
      const calcId = req.params.id;
      const userRole = req.headers['x-user-role'];
      const currentUser = req.body.currentUser;

      if (userRole !== 'admin') {
        return res.status(403).json({ message: "صلاحية الحذف متاحة للمدير فقط" });
      }

      const calc = await storage.getSavedCalculations().then(calcs => calcs.find(c => c.id === calcId));
      if (!calc) {
        return res.status(404).json({ message: "السجل غير موجود" });
      }

      await storage.deleteSavedCalculation(calcId);

      // تسجيل النشاط
      if (currentUser) {
        await logActivity({
          userId: currentUser.id,
          userName: currentUser.fullName,
          userRole: currentUser.role,
          action: 'delete',
          entityType: 'calculation',
          entityId: calcId,
          entityName: calc.bookTitle,
          details: `حذف سجل حساب كتاب: ${calc.bookTitle}`,
          ipAddress: getClientIp(req),
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting calculation:", error);
      res.status(500).json({ message: "خطأ في حذف السجل" });
    }
  });

  // ===== سجل النشاط =====
  app.get("/api/activity-logs", async (req, res) => {
    try {
      // التحقق من أن المستخدم مدير - يتم إرسال role في header
      const userRole = req.headers['x-user-role'];
      if (userRole !== 'admin') {
        return res.status(403).json({ message: "غير مسموح لك بالوصول إلى سجل النشاط" });
      }
      
      const { userId, action, entityType } = req.query;
      const filters: { userId?: string; action?: string; entityType?: string } = {};
      
      if (userId && typeof userId === 'string') filters.userId = userId;
      if (action && typeof action === 'string') filters.action = action;
      if (entityType && typeof entityType === 'string') filters.entityType = entityType;
      
      const logs = await storage.getActivityLogs(Object.keys(filters).length > 0 ? filters : undefined);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "خطأ في جلب سجل النشاط" });
    }
  });

  return httpServer;
}
