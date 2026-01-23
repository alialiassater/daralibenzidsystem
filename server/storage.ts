import {
  users, materials, inventoryMovements, printOrders, orderMaterials, books, expenses, activityLogs,
  type User, type InsertUser, type UpdateUser,
  type Material, type InsertMaterial,
  type InventoryMovement, type InsertInventoryMovement,
  type PrintOrder, type InsertPrintOrder,
  type Book, type InsertBook, type UpdateBook,
  type Expense, type InsertExpense,
  type ActivityLog, type InsertActivityLog,
} from "@shared/schema";
import { db } from "./db";
import { eq, sql, and, gte, lte, desc, ne } from "drizzle-orm";
import { randomUUID } from "crypto";
import { createHash } from "crypto";

// دالة لتشفير كلمة المرور باستخدام SHA-256
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export interface IStorage {
  // إدارة المستخدمين
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: UpdateUser): Promise<User>;
  toggleUserActive(id: string, isActive: boolean): Promise<void>;
  updateUserPassword(id: string, hashedPassword: string): Promise<void>;

  // إدارة المخزون
  getMaterials(): Promise<Material[]>;
  getMaterial(id: string): Promise<Material | undefined>;
  getMaterialByBarcode(barcode: string): Promise<Material | undefined>;
  createMaterial(material: InsertMaterial): Promise<Material>;
  updateMaterialQuantity(id: string, quantity: number): Promise<void>;
  softDeleteMaterial(id: string): Promise<void>;
  hasMaterialMovements(id: string): Promise<boolean>;

  getInventoryMovements(): Promise<(InventoryMovement & { material?: Material })[]>;
  createInventoryMovement(movement: InsertInventoryMovement): Promise<InventoryMovement>;

  getOrders(): Promise<PrintOrder[]>;
  getOrder(id: string): Promise<PrintOrder | undefined>;
  createOrder(order: InsertPrintOrder): Promise<PrintOrder>;
  updateOrderStatus(id: string, status: string): Promise<void>;
  softDeleteOrder(id: string): Promise<void>;

  getBooks(): Promise<Book[]>;
  getBook(id: string): Promise<Book | undefined>;
  getBookByBarcode(barcode: string): Promise<Book | undefined>;
  getBookByIsbn(isbn: string): Promise<Book | undefined>;
  createBook(book: InsertBook): Promise<Book>;
  updateBook(id: string, updates: UpdateBook): Promise<Book>;
  updateBookCover(id: string, coverPath: string): Promise<void>;
  updateBookQuantities(id: string, totalQuantity: number, readyQuantity: number, printingQuantity: number): Promise<Book>;
  softDeleteBook(id: string): Promise<void>;

  getExpenses(): Promise<Expense[]>;
  createExpense(expense: InsertExpense): Promise<Expense>;

  // سجل النشاط
  getActivityLogs(filters?: { userId?: string; action?: string; entityType?: string }): Promise<ActivityLog[]>;
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;

  getDashboardStats(): Promise<{
    totalMaterials: number;
    lowStockCount: number;
    totalOrders: number;
    pendingOrders: number;
    totalBooks: number;
    totalPrintedCopies: number;
    totalExpenses: number;
    readyBooksCount: number;
    readyBooksQuantity: number;
    readyBooksList: Array<{ id: string; title: string; readyQuantity: number }>;
    lowStockItems: Array<{ id: string; name: string; quantity: number; minQuantity: number }>;
    recentOrders: Array<{ id: string; customerName: string; status: string; cost: string }>;
    ordersList: Array<{ id: string; customerName: string; status: string; quantity: number; printType: string; createdAt: Date | null }>;
  }>;
}

function generateBarcode(): string {
  return `MAT${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

// حساب حالة الكتاب تلقائياً حسب الكميات
function calculateBookStatus(readyQuantity: number, printingQuantity: number): string {
  if (readyQuantity > 0) {
    return "ready"; // جاهز
  } else if (printingQuantity > 0) {
    return "printing"; // قيد الطباعة
  } else {
    return "unavailable"; // غير متوفر
  }
}

export class DatabaseStorage implements IStorage {
  // ===== إدارة المستخدمين =====
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, updates: UpdateUser): Promise<User> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user;
  }

  async toggleUserActive(id: string, isActive: boolean): Promise<void> {
    await db.update(users).set({ isActive }).where(eq(users.id, id));
  }

  // تحديث كلمة مرور المستخدم (مشفرة)
  async updateUserPassword(id: string, hashedPassword: string): Promise<void> {
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, id));
  }

  // ===== إدارة المخزون =====
  async getMaterials(): Promise<Material[]> {
    return db.select().from(materials)
      .where(eq(materials.isDeleted, false))
      .orderBy(desc(materials.createdAt));
  }

  async getMaterial(id: string): Promise<Material | undefined> {
    const [material] = await db.select().from(materials).where(eq(materials.id, id));
    return material || undefined;
  }

  async getMaterialByBarcode(barcode: string): Promise<Material | undefined> {
    const [material] = await db.select().from(materials)
      .where(and(eq(materials.barcode, barcode), eq(materials.isDeleted, false)));
    return material || undefined;
  }

  async createMaterial(insertMaterial: InsertMaterial): Promise<Material> {
    const barcode = generateBarcode();
    const [material] = await db.insert(materials).values({ ...insertMaterial, barcode }).returning();
    return material;
  }

  async updateMaterialQuantity(id: string, quantity: number): Promise<void> {
    await db.update(materials).set({ quantity }).where(eq(materials.id, id));
  }

  async softDeleteMaterial(id: string): Promise<void> {
    await db.update(materials).set({ isDeleted: true }).where(eq(materials.id, id));
  }

  async hasMaterialMovements(id: string): Promise<boolean> {
    const movements = await db.select().from(inventoryMovements)
      .where(eq(inventoryMovements.materialId, id))
      .limit(1);
    return movements.length > 0;
  }

  async getInventoryMovements(): Promise<(InventoryMovement & { material?: Material })[]> {
    const movementsList = await db.select().from(inventoryMovements).orderBy(desc(inventoryMovements.createdAt));
    const result = [];
    for (const movement of movementsList) {
      const material = await this.getMaterial(movement.materialId);
      result.push({ ...movement, material });
    }
    return result;
  }

  async createInventoryMovement(insertMovement: InsertInventoryMovement): Promise<InventoryMovement> {
    const [movement] = await db.insert(inventoryMovements).values(insertMovement).returning();
    return movement;
  }

  async getOrders(): Promise<PrintOrder[]> {
    return db.select().from(printOrders)
      .where(eq(printOrders.isDeleted, false))
      .orderBy(desc(printOrders.createdAt));
  }

  async getOrder(id: string): Promise<PrintOrder | undefined> {
    const [order] = await db.select().from(printOrders).where(eq(printOrders.id, id));
    return order || undefined;
  }

  async createOrder(insertOrder: InsertPrintOrder): Promise<PrintOrder> {
    const [order] = await db.insert(printOrders).values(insertOrder).returning();
    return order;
  }

  async updateOrderStatus(id: string, status: string): Promise<void> {
    await db.update(printOrders).set({ status }).where(eq(printOrders.id, id));
  }

  // حذف منطقي للطلب
  async softDeleteOrder(id: string): Promise<void> {
    await db.update(printOrders).set({ isDeleted: true }).where(eq(printOrders.id, id));
  }

  async getBooks(): Promise<Book[]> {
    return db.select().from(books)
      .where(eq(books.isDeleted, false))
      .orderBy(desc(books.createdAt));
  }

  async getBook(id: string): Promise<Book | undefined> {
    const [book] = await db.select().from(books).where(eq(books.id, id));
    return book || undefined;
  }

  async getBookByBarcode(barcode: string): Promise<Book | undefined> {
    const [book] = await db.select().from(books)
      .where(and(eq(books.barcode, barcode), eq(books.isDeleted, false)));
    return book || undefined;
  }

  // جلب كتاب برقم ISBN
  async getBookByIsbn(isbn: string): Promise<Book | undefined> {
    const [book] = await db.select().from(books)
      .where(and(eq(books.isbn, isbn), eq(books.isDeleted, false)));
    return book || undefined;
  }

  async createBook(insertBook: InsertBook): Promise<Book> {
    const barcode = insertBook.isbn; // استخدام ISBN كباركود
    const status = calculateBookStatus(
      insertBook.readyQuantity || 0,
      insertBook.printingQuantity || 0
    );
    const [book] = await db.insert(books).values({ 
      ...insertBook, 
      barcode,
      status 
    }).returning();
    return book;
  }

  async updateBookCover(id: string, coverPath: string): Promise<void> {
    await db.update(books).set({ coverImage: coverPath }).where(eq(books.id, id));
  }

  async updateBookQuantities(
    id: string, 
    totalQuantity: number, 
    readyQuantity: number, 
    printingQuantity: number
  ): Promise<Book> {
    const status = calculateBookStatus(readyQuantity, printingQuantity);
    const [book] = await db.update(books)
      .set({ 
        totalQuantity, 
        readyQuantity, 
        printingQuantity, 
        status 
      })
      .where(eq(books.id, id))
      .returning();
    return book;
  }

  // تحديث جميع بيانات الكتاب
  async updateBook(id: string, updates: UpdateBook): Promise<Book> {
    const updateData: Record<string, any> = { ...updates };
    
    // إذا تم تحديث ISBN، نحدث الباركود أيضاً ليتطابق معه
    if (updates.isbn) {
      updateData.barcode = updates.isbn;
    }

    // حساب الحالة تلقائياً إذا تم تغيير الكميات
    if (updates.readyQuantity !== undefined || updates.printingQuantity !== undefined) {
      const book = await this.getBook(id);
      if (book) {
        const readyQty = updates.readyQuantity ?? book.readyQuantity ?? 0;
        const printingQty = updates.printingQuantity ?? book.printingQuantity ?? 0;
        updateData.status = calculateBookStatus(readyQty, printingQty);
      }
    }
    
    const [book] = await db.update(books)
      .set(updateData)
      .where(eq(books.id, id))
      .returning();
    return book;
  }

  // حذف منطقي للكتاب
  async softDeleteBook(id: string): Promise<void> {
    await db.update(books).set({ isDeleted: true }).where(eq(books.id, id));
  }

  async getExpenses(): Promise<Expense[]> {
    return db.select().from(expenses).orderBy(desc(expenses.createdAt));
  }

  async createExpense(insertExpense: InsertExpense): Promise<Expense> {
    const [expense] = await db.insert(expenses).values(insertExpense).returning();
    return expense;
  }

  // ===== سجل النشاط =====
  async getActivityLogs(filters?: { userId?: string; action?: string; entityType?: string }): Promise<ActivityLog[]> {
    let query = db.select().from(activityLogs);
    
    const conditions = [];
    if (filters?.userId) {
      conditions.push(eq(activityLogs.userId, filters.userId));
    }
    if (filters?.action) {
      conditions.push(eq(activityLogs.action, filters.action));
    }
    if (filters?.entityType) {
      conditions.push(eq(activityLogs.entityType, filters.entityType));
    }
    
    if (conditions.length > 0) {
      return db.select().from(activityLogs)
        .where(and(...conditions))
        .orderBy(desc(activityLogs.createdAt));
    }
    
    return db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt));
  }

  async createActivityLog(insertLog: InsertActivityLog): Promise<ActivityLog> {
    const [log] = await db.insert(activityLogs).values(insertLog).returning();
    return log;
  }

  async getDashboardStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const allMaterials = await this.getMaterials();
    const lowStockItems = allMaterials.filter(m => m.quantity <= m.minQuantity);

    const allOrders = await this.getOrders();
    const pendingOrders = allOrders.filter(o => o.status === 'pending' || o.status === 'in_progress');

    const allBooks = await this.getBooks();
    const totalPrintedCopies = allBooks.reduce((sum, b) => sum + (b.totalQuantity || 0), 0);
    const readyBooks = allBooks.filter(b => b.status === 'ready');
    const readyBooksCount = readyBooks.length;
    const readyBooksQuantity = readyBooks.reduce((sum, b) => sum + (b.readyQuantity || 0), 0);

    const allExpenses = await this.getExpenses();
    const totalExpenses = allExpenses
      .filter(e => e.createdAt && new Date(e.createdAt) >= startOfMonth)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    // ترتيب الكتب الجاهزة حسب الكمية تنازلياً
    const sortedReadyBooks = readyBooks
      .sort((a, b) => (b.readyQuantity || 0) - (a.readyQuantity || 0));

    const booksByCategory: Record<string, number> = {};
    allBooks.forEach(b => {
      const cat = b.category || 'أخرى';
      booksByCategory[cat] = (booksByCategory[cat] || 0) + 1;
    });

    const inventoryByQuantity = allMaterials
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10)
      .map(m => ({ name: m.name, value: m.quantity }));

    return {
      totalMaterials: allMaterials.length,
      lowStockCount: lowStockItems.length,
      totalOrders: allOrders.length,
      pendingOrders: pendingOrders.length,
      totalBooks: allBooks.length,
      totalPrintedCopies,
      totalExpenses,
      readyBooksCount,
      readyBooksQuantity,
      readyBooksList: sortedReadyBooks.map(b => ({
        id: b.id,
        title: b.title,
        readyQuantity: b.readyQuantity || 0,
      })),
      lowStockItems: lowStockItems.slice(0, 5).map(m => ({
        id: m.id,
        name: m.name,
        quantity: m.quantity,
        minQuantity: m.minQuantity,
      })),
      recentOrders: allOrders.slice(0, 5).map(o => ({
        id: o.id,
        customerName: o.customerName,
        status: o.status,
        cost: o.cost,
      })),
      // قائمة الطلبات مرتبة حسب التاريخ (الأحدث أولاً) ثم الحالة
      ordersList: allOrders
        .sort((a, b) => {
          // ترتيب حسب الحالة أولاً (قيد المعالجة، قيد الطباعة، مكتمل)
          const statusOrder: Record<string, number> = { pending: 0, in_progress: 1, completed: 2, cancelled: 3 };
          const statusDiff = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
          if (statusDiff !== 0) return statusDiff;
          // ثم حسب التاريخ (الأحدث أولاً)
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        })
        .slice(0, 10)
        .map(o => ({
          id: o.id,
          customerName: o.customerName,
          status: o.status,
          quantity: o.quantity,
          printType: o.printType,
          createdAt: o.createdAt,
        })),
      booksByStatus: [
        { name: 'جاهز', value: readyBooksCount },
        { name: 'قيد الطباعة', value: allBooks.length - readyBooksCount }
      ],
      booksByCategory: Object.entries(booksByCategory).map(([name, value]) => ({ name, value })),
      inventoryByQuantity
    };
  }
}

export const storage = new DatabaseStorage();
