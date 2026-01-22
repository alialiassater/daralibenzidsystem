import {
  users, materials, inventoryMovements, printOrders, orderMaterials, books, sales, expenses,
  type User, type InsertUser,
  type Material, type InsertMaterial,
  type InventoryMovement, type InsertInventoryMovement,
  type PrintOrder, type InsertPrintOrder,
  type Book, type InsertBook,
  type Sale, type InsertSale,
  type Expense, type InsertExpense,
} from "@shared/schema";
import { db } from "./db";
import { eq, sql, and, gte, lte, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getMaterials(): Promise<Material[]>;
  getMaterial(id: string): Promise<Material | undefined>;
  getMaterialByBarcode(barcode: string): Promise<Material | undefined>;
  createMaterial(material: InsertMaterial): Promise<Material>;
  updateMaterialQuantity(id: string, quantity: number): Promise<void>;

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
  updateBookSoldCopies(id: string, soldCopies: number): Promise<void>;

  getSales(): Promise<(Sale & { book?: { title: string } })[]>;
  createSale(sale: InsertSale): Promise<Sale>;

  getExpenses(): Promise<Expense[]>;
  createExpense(expense: InsertExpense): Promise<Expense>;

  getDashboardStats(): Promise<{
    totalMaterials: number;
    lowStockCount: number;
    totalOrders: number;
    pendingOrders: number;
    totalBooks: number;
    totalBooksSold: number;
    todaySales: number;
    monthSales: number;
    totalExpenses: number;
    profit: number;
    lowStockItems: Array<{ id: string; name: string; quantity: number; minQuantity: number }>;
    recentOrders: Array<{ id: string; customerName: string; status: string; cost: string }>;
    salesByMonth: Array<{ month: string; amount: number }>;
  }>;

  getSalesStats(): Promise<{
    todaySales: number;
    weekSales: number;
    monthSales: number;
    todayExpenses: number;
    monthExpenses: number;
    profit: number;
  }>;
}

function generateBarcode(): string {
  return `MAT${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function generateBookBarcode(): string {
  return `BOOK${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getMaterials(): Promise<Material[]> {
    return db.select().from(materials).orderBy(desc(materials.createdAt));
  }

  async getMaterial(id: string): Promise<Material | undefined> {
    const [material] = await db.select().from(materials).where(eq(materials.id, id));
    return material || undefined;
  }

  async getMaterialByBarcode(barcode: string): Promise<Material | undefined> {
    const [material] = await db.select().from(materials).where(eq(materials.barcode, barcode));
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
    const [book] = await db.insert(books).values({ ...insertBook, barcode, soldCopies: 0 }).returning();
    return book;
  }

  async updateBookSoldCopies(id: string, soldCopies: number): Promise<void> {
    await db.update(books).set({ soldCopies }).where(eq(books.id, id));
  }

  async getSales(): Promise<(Sale & { book?: { title: string } })[]> {
    const salesList = await db.select().from(sales).orderBy(desc(sales.createdAt));
    const result = [];
    for (const sale of salesList) {
      let book = undefined;
      if (sale.bookId) {
        const bookData = await this.getBook(sale.bookId);
        if (bookData) {
          book = { title: bookData.title };
        }
      }
      result.push({ ...sale, book });
    }
    return result;
  }

  async createSale(insertSale: InsertSale): Promise<Sale> {
    const [sale] = await db.insert(sales).values(insertSale).returning();
    return sale;
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
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const allMaterials = await this.getMaterials();
    const lowStockItems = allMaterials.filter(m => m.quantity <= m.minQuantity);

    const allOrders = await this.getOrders();
    const pendingOrders = allOrders.filter(o => o.status === 'pending' || o.status === 'in_progress');

    const allBooks = await this.getBooks();
    const totalBooksSold = allBooks.reduce((sum, b) => sum + b.soldCopies, 0);

    const allSales = await this.getSales();
    const todaySales = allSales
      .filter(s => s.createdAt && new Date(s.createdAt) >= startOfDay)
      .reduce((sum, s) => sum + Number(s.totalAmount), 0);
    const monthSales = allSales
      .filter(s => s.createdAt && new Date(s.createdAt) >= startOfMonth)
      .reduce((sum, s) => sum + Number(s.totalAmount), 0);

    const allExpenses = await this.getExpenses();
    const totalExpenses = allExpenses
      .filter(e => e.createdAt && new Date(e.createdAt) >= startOfMonth)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const salesByMonth = this.calculateSalesByMonth(allSales);

    return {
      totalMaterials: allMaterials.length,
      lowStockCount: lowStockItems.length,
      totalOrders: allOrders.length,
      pendingOrders: pendingOrders.length,
      totalBooks: allBooks.length,
      totalBooksSold,
      todaySales,
      monthSales,
      totalExpenses,
      profit: monthSales - totalExpenses,
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
      salesByMonth,
    };
  }

  private calculateSalesByMonth(salesList: Sale[]): Array<{ month: string; amount: number }> {
    const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    const currentMonth = new Date().getMonth();
    const result: Array<{ month: string; amount: number }> = [];

    for (let i = 5; i >= 0; i--) {
      const monthIndex = (currentMonth - i + 12) % 12;
      const amount = salesList
        .filter(s => s.createdAt && new Date(s.createdAt).getMonth() === monthIndex)
        .reduce((sum, s) => sum + Number(s.totalAmount), 0);
      result.push({ month: months[monthIndex], amount });
    }

    return result;
  }

  async getSalesStats() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const allSales = await this.getSales();
    const todaySales = allSales
      .filter(s => s.createdAt && new Date(s.createdAt) >= startOfDay)
      .reduce((sum, s) => sum + Number(s.totalAmount), 0);
    const weekSales = allSales
      .filter(s => s.createdAt && new Date(s.createdAt) >= startOfWeek)
      .reduce((sum, s) => sum + Number(s.totalAmount), 0);
    const monthSales = allSales
      .filter(s => s.createdAt && new Date(s.createdAt) >= startOfMonth)
      .reduce((sum, s) => sum + Number(s.totalAmount), 0);

    const allExpenses = await this.getExpenses();
    const todayExpenses = allExpenses
      .filter(e => e.createdAt && new Date(e.createdAt) >= startOfDay)
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const monthExpenses = allExpenses
      .filter(e => e.createdAt && new Date(e.createdAt) >= startOfMonth)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    return {
      todaySales,
      weekSales,
      monthSales,
      todayExpenses,
      monthExpenses,
      profit: monthSales - monthExpenses,
    };
  }
}

export const storage = new DatabaseStorage();
