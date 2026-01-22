import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, DollarSign, TrendingUp, TrendingDown, Receipt, Wallet, Loader2, Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Sale, Expense } from "@shared/schema";

const expenseSchema = z.object({
  description: z.string().min(1, "الوصف مطلوب"),
  amount: z.coerce.number().min(0.01, "المبلغ مطلوب"),
  category: z.string().min(1, "التصنيف مطلوب"),
});

type ExpenseForm = z.infer<typeof expenseSchema>;

const expenseCategories = [
  { value: "salaries", label: "رواتب" },
  { value: "utilities", label: "خدمات" },
  { value: "supplies", label: "مستلزمات" },
  { value: "maintenance", label: "صيانة" },
  { value: "rent", label: "إيجار" },
  { value: "marketing", label: "تسويق" },
  { value: "other", label: "أخرى" },
];

interface SalesStats {
  todaySales: number;
  weekSales: number;
  monthSales: number;
  todayExpenses: number;
  monthExpenses: number;
  profit: number;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-8 w-20 mb-2" />
              <Skeleton className="h-4 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="space-y-4 p-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SalesPage() {
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const { toast } = useToast();

  const { data: sales, isLoading: salesLoading } = useQuery<(Sale & { book?: { title: string } })[]>({
    queryKey: ["/api/sales"],
  });

  const { data: expenses, isLoading: expensesLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<SalesStats>({
    queryKey: ["/api/sales/stats"],
  });

  const expenseForm = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      description: "",
      amount: 0,
      category: "",
    },
  });

  const addExpenseMutation = useMutation({
    mutationFn: async (data: ExpenseForm) => {
      return apiRequest<Expense>("POST", "/api/expenses", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setIsExpenseOpen(false);
      expenseForm.reset();
      toast({ title: "تمت إضافة المصروف بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ أثناء الإضافة", variant: "destructive" });
    },
  });

  const getCategoryLabel = (category: string) =>
    expenseCategories.find((c) => c.value === category)?.label || category;

  const isLoading = salesLoading || expensesLoading || statsLoading;

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">المبيعات والمحاسبة</h1>
          <p className="text-muted-foreground mt-1">تتبع المبيعات والمصروفات والأرباح</p>
        </div>
        <Dialog open={isExpenseOpen} onOpenChange={setIsExpenseOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" data-testid="button-add-expense">
              <Plus className="h-4 w-4 ml-2" />
              إضافة مصروف
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إضافة مصروف جديد</DialogTitle>
            </DialogHeader>
            <Form {...expenseForm}>
              <form onSubmit={expenseForm.handleSubmit((data) => addExpenseMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={expenseForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>الوصف</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-expense-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={expenseForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>التصنيف</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-expense-category">
                            <SelectValue placeholder="اختر التصنيف" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {expenseCategories.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={expenseForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>المبلغ (د.ج)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} data-testid="input-expense-amount" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={addExpenseMutation.isPending} data-testid="button-submit-expense">
                  {addExpenseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "إضافة"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-md bg-green-500/10">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{Number(stats?.todaySales || 0).toLocaleString()} د.ج</p>
                <p className="text-sm text-muted-foreground">مبيعات اليوم</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-md bg-primary/10">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{Number(stats?.monthSales || 0).toLocaleString()} د.ج</p>
                <p className="text-sm text-muted-foreground">مبيعات الشهر</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-md bg-destructive/10">
                <TrendingDown className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{Number(stats?.monthExpenses || 0).toLocaleString()} د.ج</p>
                <p className="text-sm text-muted-foreground">مصروفات الشهر</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-md bg-primary">
                <Wallet className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">{Number(stats?.profit || 0).toLocaleString()} د.ج</p>
                <p className="text-sm text-muted-foreground">صافي الربح</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sales" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            المبيعات
          </TabsTrigger>
          <TabsTrigger value="expenses" className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            المصروفات
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          <Card>
            <CardHeader>
              <CardTitle>سجل المبيعات</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الكتاب / الخدمة</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>الكمية</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>التاريخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        <Receipt className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        لا توجد مبيعات مسجلة
                      </TableCell>
                    </TableRow>
                  ) : (
                    sales?.map((sale) => (
                      <TableRow key={sale.id} data-testid={`row-sale-${sale.id}`}>
                        <TableCell className="font-medium">
                          {sale.book?.title || sale.notes || "خدمة طباعة"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={sale.saleType === "book" ? "default" : "secondary"}>
                            {sale.saleType === "book" ? "كتاب" : "خدمة"}
                          </Badge>
                        </TableCell>
                        <TableCell>{sale.quantity}</TableCell>
                        <TableCell className="text-green-600 font-medium">
                          +{Number(sale.totalAmount).toLocaleString()} د.ج
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {sale.createdAt ? new Date(sale.createdAt).toLocaleDateString("ar-SA") : "-"}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses">
          <Card>
            <CardHeader>
              <CardTitle>سجل المصروفات</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الوصف</TableHead>
                    <TableHead>التصنيف</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>التاريخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        <TrendingDown className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        لا توجد مصروفات مسجلة
                      </TableCell>
                    </TableRow>
                  ) : (
                    expenses?.map((expense) => (
                      <TableRow key={expense.id} data-testid={`row-expense-${expense.id}`}>
                        <TableCell className="font-medium">{expense.description}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{getCategoryLabel(expense.category)}</Badge>
                        </TableCell>
                        <TableCell className="text-destructive font-medium">
                          -{Number(expense.amount).toLocaleString()} د.ج
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {expense.createdAt ? new Date(expense.createdAt).toLocaleDateString("ar-SA") : "-"}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
