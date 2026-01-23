import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMaterialSchema, insertInventoryMovementSchema, insertPrintOrderSchema, insertBookSchema, insertExpenseSchema, insertUserSchema, updateUserSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";

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
      
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "خطأ في الخادم" });
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
      const validatedData = insertUserSchema.parse(req.body);
      
      // التحقق من عدم وجود اسم مستخدم مكرر
      const existingUser = await storage.getUserByUsername(validatedData.username);
      if (existingUser) {
        return res.status(400).json({ message: "اسم المستخدم موجود مسبقاً" });
      }
      
      const user = await storage.createUser(validatedData);
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
      const validatedData = updateUserSchema.parse(req.body);
      
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
      const { isActive } = req.body;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "المستخدم غير موجود" });
      }
      
      // منع تعطيل المدير الرئيسي
      if (user.username === "admin" && !isActive) {
        return res.status(400).json({ message: "لا يمكن تعطيل حساب المدير الرئيسي" });
      }
      
      await storage.toggleUserActive(userId, isActive);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "خطأ في تحديث حالة المستخدم" });
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
      const validatedData = insertMaterialSchema.parse(req.body);
      const material = await storage.createMaterial(validatedData);
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

  // حذف مادة (Soft Delete)
  app.delete("/api/materials/:id", async (req, res) => {
    try {
      const { userRole } = req.body;
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
      
      await storage.softDeleteMaterial(materialId);
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
      const validatedData = insertInventoryMovementSchema.parse(req.body);
      
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
      const validatedData = insertPrintOrderSchema.parse(req.body);
      const order = await storage.createOrder(validatedData);
      res.json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "بيانات غير صالحة", errors: error.errors });
      }
      res.status(500).json({ message: "خطأ في إضافة الطلب" });
    }
  });

  app.patch("/api/orders/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      await storage.updateOrderStatus(req.params.id, status);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "خطأ في تحديث الحالة" });
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
      const validatedData = insertBookSchema.parse(req.body);
      const book = await storage.createBook(validatedData);
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
      
      const { totalQuantity, readyQuantity, printingQuantity } = req.body;
      
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
      
      const updatedBook = await storage.updateBookQuantities(
        bookId, 
        totalQuantity, 
        readyQuantity, 
        printingQuantity
      );
      
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

  return httpServer;
}
