import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table with roles
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("employee"), // admin or employee
  createdAt: timestamp("created_at").defaultNow(),
});

// Inventory materials
export const materials = pgTable("materials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(), // paper, ink, cover, book, other
  quantity: integer("quantity").notNull().default(0),
  minQuantity: integer("min_quantity").notNull().default(10),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  barcode: text("barcode").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Inventory movements
export const inventoryMovements = pgTable("inventory_movements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  materialId: varchar("material_id").notNull().references(() => materials.id),
  type: text("type").notNull(), // in or out
  quantity: integer("quantity").notNull(),
  notes: text("notes"),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Print orders
export const printOrders = pgTable("print_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerName: text("customer_name").notNull(),
  printType: text("print_type").notNull(),
  copies: integer("copies").notNull(),
  paperType: text("paper_type").notNull(),
  cost: decimal("cost", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"), // pending, in_progress, completed, cancelled
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Order materials used
export const orderMaterials = pgTable("order_materials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => printOrders.id),
  materialId: varchar("material_id").notNull().references(() => materials.id),
  quantity: integer("quantity").notNull(),
});

// Books for publishing
export const books = pgTable("books", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  author: text("author").notNull(),
  isbn: text("isbn").notNull().unique(),
  barcode: text("barcode").notNull().unique(),
  category: text("category").notNull().default("أخرى"), // تعليمي، ديني، أدبي، علمي، أطفال، أخرى
  coverImage: text("cover_image"), // مسار صورة الغلاف
  totalQuantity: integer("total_quantity").notNull().default(0), // الكمية الإجمالية
  readyQuantity: integer("ready_quantity").notNull().default(0), // الكمية الجاهزة
  printingQuantity: integer("printing_quantity").notNull().default(0), // الكمية قيد الطباعة
  status: text("status").notNull().default("unavailable"), // printing, ready, unavailable
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Expenses
export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  category: text("category").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  inventoryMovements: many(inventoryMovements),
}));

export const materialsRelations = relations(materials, ({ many }) => ({
  movements: many(inventoryMovements),
  orderMaterials: many(orderMaterials),
}));

export const inventoryMovementsRelations = relations(inventoryMovements, ({ one }) => ({
  material: one(materials, {
    fields: [inventoryMovements.materialId],
    references: [materials.id],
  }),
  user: one(users, {
    fields: [inventoryMovements.userId],
    references: [users.id],
  }),
}));

export const printOrdersRelations = relations(printOrders, ({ many }) => ({
  materials: many(orderMaterials),
}));

export const orderMaterialsRelations = relations(orderMaterials, ({ one }) => ({
  order: one(printOrders, {
    fields: [orderMaterials.orderId],
    references: [printOrders.id],
  }),
  material: one(materials, {
    fields: [orderMaterials.materialId],
    references: [materials.id],
  }),
}));


// Helper for price/amount fields - accepts number or string, outputs string
const priceTransform = z.union([z.string(), z.number()]).transform((val) => String(val));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertMaterialSchema = createInsertSchema(materials).omit({
  id: true,
  createdAt: true,
  barcode: true,
}).extend({
  price: priceTransform,
});

export const insertInventoryMovementSchema = createInsertSchema(inventoryMovements).omit({
  id: true,
  createdAt: true,
});

export const insertPrintOrderSchema = createInsertSchema(printOrders).omit({
  id: true,
  createdAt: true,
}).extend({
  cost: priceTransform,
});

export const insertOrderMaterialSchema = createInsertSchema(orderMaterials).omit({
  id: true,
});

export const insertBookSchema = createInsertSchema(books).omit({
  id: true,
  createdAt: true,
  barcode: true,
  coverImage: true,
  status: true, // يتم حسابها تلقائياً
}).extend({
  price: priceTransform,
  totalQuantity: z.number().min(0).default(0),
  readyQuantity: z.number().min(0).default(0),
  printingQuantity: z.number().min(0).default(0),
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({
  id: true,
  createdAt: true,
}).extend({
  amount: priceTransform,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertMaterial = z.infer<typeof insertMaterialSchema>;
export type Material = typeof materials.$inferSelect;

export type InsertInventoryMovement = z.infer<typeof insertInventoryMovementSchema>;
export type InventoryMovement = typeof inventoryMovements.$inferSelect;

export type InsertPrintOrder = z.infer<typeof insertPrintOrderSchema>;
export type PrintOrder = typeof printOrders.$inferSelect;

export type InsertOrderMaterial = z.infer<typeof insertOrderMaterialSchema>;
export type OrderMaterial = typeof orderMaterials.$inferSelect;

export type InsertBook = z.infer<typeof insertBookSchema>;
export type Book = typeof books.$inferSelect;

export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;
