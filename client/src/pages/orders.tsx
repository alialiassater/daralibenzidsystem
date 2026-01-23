import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Printer, Search, Loader2, Eye, Clock, CheckCircle, XCircle, PlayCircle, Pencil, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { PrintOrder } from "@shared/schema";
import { useAuth } from "@/lib/auth-context";

const orderSchema = z.object({
  customerName: z.string().min(1, "اسم الزبون مطلوب"),
  printType: z.string().min(1, "نوع الطباعة مطلوب"),
  copies: z.coerce.number().min(1, "عدد النسخ مطلوب"),
  paperType: z.string().min(1, "نوع الورق مطلوب"),
  cost: z.coerce.number().min(0, "التكلفة مطلوبة"),
  status: z.string().optional(),
  notes: z.string().optional(),
});

type OrderForm = z.infer<typeof orderSchema>;

const printTypes = [
  { value: "offset", label: "طباعة أوفست" },
  { value: "digital", label: "طباعة رقمية" },
  { value: "silkscreen", label: "طباعة حريرية" },
  { value: "largeformat", label: "طباعة كبيرة" },
  { value: "books", label: "طباعة كتب" },
  { value: "cards", label: "بطاقات وكروت" },
  { value: "banners", label: "لافتات وبنرات" },
];

const paperTypes = [
  { value: "a4_80", label: "A4 - 80 غرام" },
  { value: "a4_100", label: "A4 - 100 غرام" },
  { value: "a3_80", label: "A3 - 80 غرام" },
  { value: "a3_100", label: "A3 - 100 غرام" },
  { value: "glossy", label: "ورق لامع" },
  { value: "matte", label: "ورق مطفي" },
  { value: "cardboard", label: "كرتون مقوى" },
  { value: "special", label: "ورق خاص" },
];

const statusConfig = {
  pending: { label: "قيد الانتظار", variant: "secondary" as const, icon: Clock },
  in_progress: { label: "جاري التنفيذ", variant: "default" as const, icon: PlayCircle },
  completed: { label: "مكتمل", variant: "outline" as const, icon: CheckCircle },
  cancelled: { label: "ملغي", variant: "destructive" as const, icon: XCircle },
};

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-32" />
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

export default function OrdersPage() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PrintOrder | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const { data: orders, isLoading } = useQuery<PrintOrder[]>({
    queryKey: ["/api/orders"],
  });

  const form = useForm<OrderForm>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      customerName: "",
      printType: "",
      copies: 1,
      paperType: "",
      cost: 0,
      notes: "",
    },
  });

  const editForm = useForm<OrderForm>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      customerName: "",
      printType: "",
      copies: 1,
      paperType: "",
      cost: 0,
      status: "pending",
      notes: "",
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: OrderForm) => {
      return apiRequest("POST", "/api/orders", { ...data, currentUser: user });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setIsAddOpen(false);
      form.reset();
      toast({ title: "تمت إضافة الطلب بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ أثناء الإضافة", variant: "destructive" });
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: OrderForm }) => {
      return apiRequest("PATCH", `/api/orders/${id}`, { ...data, currentUser: user });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setIsEditOpen(false);
      toast({ title: "تم تحديث الطلب بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ أثناء التحديث", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/orders/${id}`, { currentUser: user });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "تم حذف الطلب بنجاح" });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "حدث خطأ أثناء الحذف", variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/orders/${id}/status`, { status, currentUser: user });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "تم تحديث حالة الطلب" });
    },
    onError: () => {
      toast({ title: "حدث خطأ أثناء التحديث", variant: "destructive" });
    },
  });

  const canEdit = (order: PrintOrder) => {
    if (isAdmin) return true;
    return order.status !== 'completed';
  };

  const handleEditClick = (order: PrintOrder) => {
    setSelectedOrder(order);
    editForm.reset({
      customerName: order.customerName,
      printType: order.printType,
      copies: order.copies,
      paperType: order.paperType,
      cost: Number(order.cost),
      status: order.status,
      notes: order.notes || "",
    });
    setIsEditOpen(true);
  };

  const filteredOrders = orders?.filter((order) => {
    const matchesSearch = order.customerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getPrintTypeLabel = (type: string) => printTypes.find((t) => t.value === type)?.label || type;
  const getPaperTypeLabel = (type: string) => paperTypes.find((t) => t.value === type)?.label || type;

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" data-testid="text-page-title">طلبات الطباعة</h1>
          <p className="text-muted-foreground mt-1">إدارة ومتابعة طلبات الطباعة</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-order">
              <Plus className="h-4 w-4 ml-2" />
              طلب جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>إضافة طلب طباعة جديد</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => addMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>اسم الزبون</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-order-customer" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="printType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>نوع الطباعة</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-order-printtype">
                              <SelectValue placeholder="اختر" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {printTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="paperType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>نوع الورق</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-order-papertype">
                              <SelectValue placeholder="اختر" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {paperTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="copies"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>عدد النسخ</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} data-testid="input-order-copies" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>التكلفة (د.ج)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} data-testid="input-order-cost" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ملاحظات (اختياري)</FormLabel>
                      <FormControl>
                        <Textarea {...field} data-testid="input-order-notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={addMutation.isPending} data-testid="button-submit-order">
                  {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "إضافة الطلب"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث باسم الزبون..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
                data-testid="input-search-order"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="فلترة بالحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="pending">قيد الانتظار</SelectItem>
                <SelectItem value="in_progress">جاري التنفيذ</SelectItem>
                <SelectItem value="completed">مكتمل</SelectItem>
                <SelectItem value="cancelled">ملغي</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">الزبون</TableHead>
                <TableHead className="whitespace-nowrap hidden sm:table-cell">نوع الطباعة</TableHead>
                <TableHead className="whitespace-nowrap hidden md:table-cell">النسخ</TableHead>
                <TableHead className="whitespace-nowrap">التكلفة</TableHead>
                <TableHead className="whitespace-nowrap">الحالة</TableHead>
                <TableHead className="whitespace-nowrap hidden md:table-cell">التاريخ</TableHead>
                <TableHead className="whitespace-nowrap">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <Printer className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    لا توجد طلبات
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders?.map((order) => {
                  const StatusIcon = statusConfig[order.status as keyof typeof statusConfig]?.icon || Clock;
                  return (
                    <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                      <TableCell className="font-medium whitespace-nowrap">{order.customerName}</TableCell>
                      <TableCell className="hidden sm:table-cell">{getPrintTypeLabel(order.printType)}</TableCell>
                      <TableCell className="hidden md:table-cell">{order.copies}</TableCell>
                      <TableCell>{Number(order.cost).toLocaleString()} د.ج</TableCell>
                      <TableCell>
                        <Badge variant={statusConfig[order.status as keyof typeof statusConfig]?.variant || "secondary"}>
                          <StatusIcon className="h-3 w-3 ml-1" />
                          {statusConfig[order.status as keyof typeof statusConfig]?.label || order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell">
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString("ar-SA") : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 sm:gap-2">
                          <Button
                            size="icon"
                            className="h-9 w-9"
                            variant="ghost"
                            onClick={() => {
                              setSelectedOrder(order);
                              setIsViewOpen(true);
                            }}
                            data-testid={`button-view-order-${order.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canEdit(order) && (
                            <Button
                              size="icon"
                              className="h-9 w-9"
                              variant="ghost"
                              onClick={() => handleEditClick(order)}
                              data-testid={`button-edit-order-${order.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {(isAdmin || (order.status !== 'completed')) && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="icon"
                                  className="h-9 w-9 text-destructive"
                                  variant="ghost"
                                  disabled={!isAdmin && user?.role !== 'admin'}
                                  data-testid={`button-delete-order-${order.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>هل أنت متأكد من حذف الطلب؟</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    سيتم حذف الطلب "{order.customerName}" نهائياً. هذا الإجراء لا يمكن التراجع عنه.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="gap-2">
                                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteMutation.mutate(order.id)} className="bg-destructive text-destructive-foreground">
                                    حذف
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          {order.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateStatusMutation.mutate({ id: order.id, status: "in_progress" })}
                            >
                              <PlayCircle className="h-4 w-4 ml-1" />
                              بدء
                            </Button>
                          )}
                          {order.status === "in_progress" && (
                            <Button
                              size="sm"
                              onClick={() => updateStatusMutation.mutate({ id: order.id, status: "completed" })}
                            >
                              <CheckCircle className="h-4 w-4 ml-1" />
                              إكمال
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>تعديل طلب الطباعة</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((data) => selectedOrder && updateOrderMutation.mutate({ id: selectedOrder.id, data }))} className="space-y-4">
              <FormField
                control={editForm.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>اسم الزبون</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-order-customer" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="printType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>نوع الطباعة</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-order-printtype">
                            <SelectValue placeholder="اختر" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {printTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>حالة الطلب</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-order-status">
                            <SelectValue placeholder="اختر الحالة" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pending">قيد الانتظار</SelectItem>
                          <SelectItem value="in_progress">جاري التنفيذ</SelectItem>
                          <SelectItem value="completed">مكتمل</SelectItem>
                          <SelectItem value="cancelled">ملغي</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="paperType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>نوع الورق</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-order-papertype">
                            <SelectValue placeholder="اختر" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {paperTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="copies"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>عدد النسخ</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} data-testid="input-edit-order-copies" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editForm.control}
                name="cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>التكلفة (د.ج)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} data-testid="input-edit-order-cost" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ملاحظات (اختياري)</FormLabel>
                    <FormControl>
                      <Textarea {...field} data-testid="input-edit-order-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={updateOrderMutation.isPending} data-testid="button-update-order">
                {updateOrderMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "تحديث الطلب"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تفاصيل الطلب</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm text-muted-foreground">الزبون</p>
                  <p className="font-medium">{selectedOrder.customerName}</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm text-muted-foreground">نوع الطباعة</p>
                  <p className="font-medium">{getPrintTypeLabel(selectedOrder.printType)}</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm text-muted-foreground">نوع الورق</p>
                  <p className="font-medium">{getPaperTypeLabel(selectedOrder.paperType)}</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm text-muted-foreground">عدد النسخ</p>
                  <p className="font-medium">{selectedOrder.copies}</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm text-muted-foreground">التكلفة</p>
                  <p className="font-medium">{Number(selectedOrder.cost).toLocaleString()} د.ج</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm text-muted-foreground">الحالة</p>
                  <Badge variant={statusConfig[selectedOrder.status as keyof typeof statusConfig]?.variant || "secondary"}>
                    {statusConfig[selectedOrder.status as keyof typeof statusConfig]?.label || selectedOrder.status}
                  </Badge>
                </div>
              </div>
              {selectedOrder.notes && (
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm text-muted-foreground">ملاحظات</p>
                  <p>{selectedOrder.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
