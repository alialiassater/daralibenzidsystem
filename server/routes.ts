import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMaterialSchema, insertInventoryMovementSchema, insertPrintOrderSchema, insertBookSchema, insertSaleSchema, insertExpenseSchema } from "@shared/schema";
import { z } from "zod";

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
            password: "admin123",
            fullName: "مدير النظام",
            role: "admin",
          });
        } else {
          return res.status(401).json({ message: "بيانات الدخول غير صحيحة" });
        }
      }
      
      if (user.password !== password) {
        return res.status(401).json({ message: "بيانات الدخول غير صحيحة" });
      }
      
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "خطأ في الخادم" });
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

  app.post("/api/books/:id/sell", async (req, res) => {
    try {
      const { quantity } = req.body;
      const book = await storage.getBook(req.params.id);
      
      if (!book) {
        return res.status(404).json({ message: "الكتاب غير موجود" });
      }
      
      const remaining = book.printedCopies - book.soldCopies;
      if (quantity > remaining) {
        return res.status(400).json({ message: "الكمية المطلوبة أكبر من المتوفر" });
      }
      
      // Update sold copies
      await storage.updateBookSoldCopies(book.id, book.soldCopies + quantity);
      
      // Create sale record
      const totalAmount = Number(book.price) * quantity;
      await storage.createSale({
        bookId: book.id,
        quantity,
        totalAmount: totalAmount.toString(),
        saleType: "book",
      });
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "خطأ في عملية البيع" });
    }
  });

  // Sales routes
  app.get("/api/sales", async (req, res) => {
    try {
      const salesList = await storage.getSales();
      res.json(salesList);
    } catch (error) {
      res.status(500).json({ message: "خطأ في جلب المبيعات" });
    }
  });

  app.get("/api/sales/stats", async (req, res) => {
    try {
      const stats = await storage.getSalesStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "خطأ في جلب الإحصائيات" });
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
