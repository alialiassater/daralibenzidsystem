import {
  users, materials, inventoryMovements, printOrders, orderMaterials, books, expenses,
  type User, type InsertUser, type UpdateUser,
  type Material, type InsertMaterial,
  type InventoryMovement, type InsertInventoryMovement,
  type PrintOrder, type InsertPrintOrder,
  type Book, type InsertBook,
  type Expense, type InsertExpense,
} from "@shared/schema";
import { db } from "./db";
import { eq, sql, and, gte, lte, desc, ne } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  // إدارة المستخدمين
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: UpdateUser): Promise<User>;
  toggleUserActive(id: string, isActive: boolean): Promise<void>;

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

  getBooks(): Promise<Book[]>;
  getBook(id: string): Promise<Book | undefined>;
  getBookByBarcode(barcode: string): Promise<Book | undefined>;
  createBook(book: InsertBook): Promise<Book>;
  updateBookCover(id: string, coverPath: string): Promise<void>;
  updateBookQuantities(id: string, totalQuantity: number, readyQuantity: number, printingQuantity: number): Promise<Book>;

  getExpenses(): Promise<Expense[]>;
  createExpense(expense: InsertExpense): Promise<Expense>;

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
    lowStockItems: Array<{ id: string; name: string; quantity: number; minQuantity: number }>;
    recentOrders: Array<{ id: string; customerName: string; status: string; cost: string }>;
  }>;
}

function generateBarcode(): string {
  return `MAT${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function generateBookBarcode(): string {
  return `BOOK${Date.now()}${Math.floor(Math.random() * 1000)}`;
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
    return db.select().from(printOrders).orderBy(desc(printOrders.createdAt));
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

  async getBooks(): Promise<Book[]> {
    return db.select().from(books).orderBy(desc(books.createdAt));
  }

  async getBook(id: string): Promise<Book | undefined> {
    const [book] = await db.select().from(books).where(eq(books.id, id));
    return book || undefined;
  }

  async getBookByBarcode(barcode: string): Promise<Book | undefined> {
    const [book] = await db.select().from(books).where(eq(books.barcode, barcode));
    return book || undefined;
  }

  async createBook(insertBook: InsertBook): Promise<Book> {
    const barcode = generateBookBarcode();
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

  async getExpenses(): Promise<Expense[]> {
    return db.select().from(expenses).orderBy(desc(expenses.createdAt));
  }

  async createExpense(insertExpense: InsertExpense): Promise<Expense> {
    const [expense] = await db.insert(expenses).values(insertExpense).returning();
    return expense;
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
    };
  }
}

export const storage = new DatabaseStorage();
