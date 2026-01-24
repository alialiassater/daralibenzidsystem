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
import { BarcodeGenerator } from "@/components/barcode-generator";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { Plus, Package, ArrowUpCircle, ArrowDownCircle, Search, Loader2, QrCode, History, Trash2, Pencil } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth-context";
import type { Material, InventoryMovement } from "@shared/schema";

const materialSchema = z.object({
  name: z.string().min(1, "اسم المادة مطلوب"),
  type: z.string().min(1, "نوع المادة مطلوب"),
  quantity: z.coerce.number().min(0, "الكمية يجب أن تكون 0 أو أكثر"),
  price: z.coerce.number().min(0, "السعر مطلوب"),
  paperSize: z.string().optional(),
  paperVariant: z.string().optional(),
});

// مخطط تحديث المادة
const updateMaterialSchema = z.object({
  name: z.string().min(1, "اسم المادة مطلوب"),
  price: z.coerce.number().min(0, "السعر مطلوب"),
  paperSize: z.string().optional(),
  paperVariant: z.string().optional(),
});

// خيارات حجم الورق
const paperSizes = [
  { value: "A3", label: "A3" },
  { value: "A4", label: "A4" },
  { value: "A5", label: "A5" },
];

// أنواع الورق
const paperVariants = [
  { value: "extra", label: "اكسترا" },
  { value: "autoclon", label: "اوتوكولون" },
  { value: "insiar", label: "انسيار" },
  { value: "other", label: "أخرى" },
];

const movementSchema = z.object({
  type: z.enum(["in", "out"]),
  quantity: z.coerce.number().min(1, "الكمية مطلوبة"),
  notes: z.string().optional(),
});

type MaterialForm = z.infer<typeof materialSchema>;
type MovementForm = z.infer<typeof movementSchema>;
type UpdateMaterialForm = z.infer<typeof updateMaterialSchema>;

const materialTypes = [
  { value: "paper", label: "ورق" },
  { value: "ink", label: "حبر" },
  { value: "cover", label: "غلاف" },
  { value: "book", label: "كتاب" },
  { value: "other", label: "أخرى" },
];

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

export default function InventoryPage() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [isMovementOpen, setIsMovementOpen] = useState(false);
  const [isBarcodeOpen, setIsBarcodeOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const { user, canDelete } = useAuth();
  const isAdmin = user?.role === 'admin';

  const { data: materials, isLoading } = useQuery<Material[]>({
    queryKey: ["/api/materials"],
  });

  const { data: movements } = useQuery<(InventoryMovement & { material?: Material })[]>({
    queryKey: ["/api/inventory-movements"],
  });

  const addForm = useForm<MaterialForm>({
    resolver: zodResolver(materialSchema),
    defaultValues: {
      name: "",
      type: "",
      quantity: 0,
      price: 0,
      paperSize: "",
      paperVariant: "",
    },
  });
  
  // نموذج تحديث المادة
  const editForm = useForm<UpdateMaterialForm>({
    resolver: zodResolver(updateMaterialSchema),
    defaultValues: {
      name: "",
      price: 0,
      paperSize: "",
      paperVariant: "",
    },
  });
  
  // متابعة نوع المادة لإظهار حقول الورق
  const watchedType = addForm.watch("type");

  const movementForm = useForm<MovementForm>({
    resolver: zodResolver(movementSchema),
    defaultValues: {
      type: "in",
      quantity: 1,
      notes: "",
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: MaterialForm) => {
      const res = await apiRequest("POST", "/api/materials", { ...data, currentUser: user });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setIsAddOpen(false);
      addForm.reset();
      toast({ title: "تمت إضافة المادة بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ أثناء الإضافة", variant: "destructive" });
    },
  });

  const movementMutation = useMutation({
    mutationFn: async (data: MovementForm) => {
      return apiRequest("POST", "/api/inventory-movements", {
        ...data,
        materialId: selectedMaterial?.id,
        currentUser: user,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory-movements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setIsMovementOpen(false);
      movementForm.reset();
      toast({ title: "تم تسجيل الحركة بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ أثناء التسجيل", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (materialId: string) => {
      return apiRequest("DELETE", `/api/materials/${materialId}`, {
        userRole: user?.role,
        currentUser: user,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setIsDeleteOpen(false);
      setSelectedMaterial(null);
      toast({ title: "تم حذف المادة بنجاح" });
    },
    onError: (error: any) => {
      const message = error?.message || "حدث خطأ أثناء الحذف";
      toast({ title: message, variant: "destructive" });
    },
  });

  // تحديث المادة (السعر، الحجم، النوع)
  const updateMutation = useMutation({
    mutationFn: async (data: UpdateMaterialForm) => {
      const res = await apiRequest("PATCH", `/api/materials/${selectedMaterial?.id}`, { 
        ...data, 
        currentUser: user 
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      setIsEditOpen(false);
      setSelectedMaterial(null);
      editForm.reset();
      toast({ title: "تم تحديث المادة بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ أثناء التحديث", variant: "destructive" });
    },
  });

  // فتح نافذة التحديث مع تعبئة البيانات
  const openEditDialog = (material: Material) => {
    setSelectedMaterial(material);
    editForm.reset({
      name: material.name || "",
      price: Number(material.price) || 0,
      paperSize: material.paperSize || "",
      paperVariant: material.paperVariant || "",
    });
    setIsEditOpen(true);
  };

  const handleBarcodeScan = (barcode: string) => {
    const material = materials?.find((m) => m.barcode === barcode);
    if (material) {
      setSelectedMaterial(material);
      setIsMovementOpen(true);
      toast({ title: `تم العثور على: ${material.name}` });
    } else {
      toast({ title: "لم يتم العثور على المادة", variant: "destructive" });
    }
  };

  const filteredMaterials = materials?.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.barcode.includes(searchQuery)
  );

  const getTypeLabel = (type: string) => {
    return materialTypes.find((t) => t.value === type)?.label || type;
  };
  
  // دالة للحصول على اسم حجم الورق
  const getPaperSizeLabel = (size: string | null | undefined) => {
    return size || "-";
  };
  
  // دالة للحصول على اسم نوع الورق
  const getPaperVariantLabel = (variant: string | null | undefined) => {
    return paperVariants.find((v) => v.value === variant)?.label || variant || "-";
  };

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" data-testid="text-page-title">إدارة المخزون</h1>
          <p className="text-muted-foreground mt-1">إدارة المواد والمخزون مع دعم الباركود</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-material">
              <Plus className="h-4 w-4 ml-2" />
              إضافة مادة
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إضافة مادة جديدة</DialogTitle>
            </DialogHeader>
            <Form {...addForm}>
              <form onSubmit={addForm.handleSubmit((data) => addMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={addForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>اسم المادة</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-material-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>النوع</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-material-type">
                            <SelectValue placeholder="اختر النوع" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {materialTypes.map((type) => (
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
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={addForm.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>الكمية</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} data-testid="input-material-quantity" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addForm.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>السعر (د.ج)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} data-testid="input-material-price" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                {/* حقول خاصة بالورق */}
                {watchedType === "paper" && (
                  <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg">
                    <FormField
                      control={addForm.control}
                      name="paperSize"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>حجم الورق</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-paper-size">
                                <SelectValue placeholder="اختر الحجم" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {paperSizes.map((size) => (
                                <SelectItem key={size.value} value={size.value}>
                                  {size.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addForm.control}
                      name="paperVariant"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>نوع الورق</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-paper-variant">
                                <SelectValue placeholder="اختر النوع" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {paperVariants.map((variant) => (
                                <SelectItem key={variant.value} value={variant.value}>
                                  {variant.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={addMutation.isPending} data-testid="button-submit-material">
                  {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "إضافة"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            المخزون
          </TabsTrigger>
          <TabsTrigger value="movements" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            سجل الحركات
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="بحث بالاسم أو الباركود..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-10"
                    data-testid="input-search-material"
                  />
                </div>
                <BarcodeScanner onScan={handleBarcodeScan} placeholder="مسح الباركود" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">المادة</TableHead>
                    <TableHead className="whitespace-nowrap">النوع</TableHead>
                    <TableHead className="whitespace-nowrap hidden sm:table-cell">الحجم/الصنف</TableHead>
                    <TableHead className="whitespace-nowrap">الكمية</TableHead>
                    <TableHead className="whitespace-nowrap hidden sm:table-cell">السعر</TableHead>
                    <TableHead className="whitespace-nowrap hidden md:table-cell">الباركود</TableHead>
                    <TableHead className="whitespace-nowrap">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMaterials?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        لا توجد مواد
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredMaterials?.map((material) => (
                      <TableRow key={material.id} data-testid={`row-material-${material.id}`}>
                        <TableCell className="font-medium whitespace-nowrap">{material.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{getTypeLabel(material.type)}</Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                          {material.type === "paper" ? (
                            <span>{getPaperSizeLabel(material.paperSize)} / {getPaperVariantLabel(material.paperVariant)}</span>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          <span>{material.quantity}</span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{Number(material.price).toLocaleString()} د.ج</TableCell>
                        <TableCell className="font-mono text-sm hidden md:table-cell">{material.barcode}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 sm:gap-2">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-9 w-9 sm:h-auto sm:w-auto sm:px-3"
                              onClick={() => {
                                setSelectedMaterial(material);
                                setIsMovementOpen(true);
                              }}
                              data-testid={`button-movement-${material.id}`}
                            >
                              <ArrowUpCircle className="h-4 w-4 sm:ml-1" />
                              <span className="hidden sm:inline">حركة</span>
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-9 w-9"
                              onClick={() => {
                                setSelectedMaterial(material);
                                setIsBarcodeOpen(true);
                              }}
                              data-testid={`button-barcode-${material.id}`}
                            >
                              <QrCode className="h-4 w-4" />
                            </Button>
                            {isAdmin && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-9 w-9"
                                onClick={() => openEditDialog(material)}
                                data-testid={`button-edit-${material.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-9 w-9 text-destructive hover:text-destructive"
                                onClick={() => {
                                  setSelectedMaterial(material);
                                  setIsDeleteOpen(true);
                                }}
                                data-testid={`button-delete-${material.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements">
          <Card>
            <CardHeader>
              <CardTitle>سجل حركات المخزون</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">المادة</TableHead>
                    <TableHead className="whitespace-nowrap">النوع</TableHead>
                    <TableHead className="whitespace-nowrap">الكمية</TableHead>
                    <TableHead className="whitespace-nowrap hidden sm:table-cell">الملاحظات</TableHead>
                    <TableHead className="whitespace-nowrap hidden sm:table-cell">التاريخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        لا توجد حركات مسجلة
                      </TableCell>
                    </TableRow>
                  ) : (
                    movements?.map((movement) => (
                      <TableRow key={movement.id}>
                        <TableCell className="font-medium whitespace-nowrap">
                          {movement.material?.name || "غير معروف"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={movement.type === "in" ? "default" : "destructive"}>
                            {movement.type === "in" ? (
                              <><ArrowUpCircle className="h-3 w-3 ml-1" /> دخول</>
                            ) : (
                              <><ArrowDownCircle className="h-3 w-3 ml-1" /> خروج</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>{movement.quantity}</TableCell>
                        <TableCell className="text-muted-foreground hidden sm:table-cell">
                          {movement.notes || "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden sm:table-cell">
                          {movement.createdAt
                            ? new Date(movement.createdAt).toLocaleDateString("ar-SA")
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isMovementOpen} onOpenChange={setIsMovementOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تسجيل حركة مخزون</DialogTitle>
          </DialogHeader>
          {selectedMaterial && (
            <div className="p-3 bg-muted rounded-md mb-4">
              <p className="font-medium">{selectedMaterial.name}</p>
              <p className="text-sm text-muted-foreground">الكمية الحالية: {selectedMaterial.quantity}</p>
            </div>
          )}
          <Form {...movementForm}>
            <form onSubmit={movementForm.handleSubmit((data) => movementMutation.mutate(data))} className="space-y-4">
              <FormField
                control={movementForm.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>نوع الحركة</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="in">دخول (إضافة للمخزون)</SelectItem>
                        <SelectItem value="out">خروج (سحب من المخزون)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={movementForm.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الكمية</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={movementForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ملاحظات (اختياري)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={movementMutation.isPending}>
                {movementMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "تسجيل"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isBarcodeOpen} onOpenChange={setIsBarcodeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>باركود المادة</DialogTitle>
          </DialogHeader>
          {selectedMaterial && (
            <div className="space-y-4">
              <p className="text-center font-medium">{selectedMaterial.name}</p>
              <BarcodeGenerator value={selectedMaterial.barcode} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* نافذة تعديل المادة */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل المادة: {selectedMaterial?.name}</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((data) => updateMutation.mutate(data))} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>اسم المادة</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>السعر (د.ج)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} data-testid="input-edit-price" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* حقول خاصة بالورق */}
              {selectedMaterial?.type === "paper" && (
                <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg">
                  <FormField
                    control={editForm.control}
                    name="paperSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>حجم الورق</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-edit-paper-size">
                              <SelectValue placeholder="اختر الحجم" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {paperSizes.map((size) => (
                              <SelectItem key={size.value} value={size.value}>
                                {size.label}
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
                    name="paperVariant"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>نوع الورق</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-edit-paper-variant">
                              <SelectValue placeholder="اختر النوع" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {paperVariants.map((variant) => (
                              <SelectItem key={variant.value} value={variant.value}>
                                {variant.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
              
              <Button type="submit" className="w-full" disabled={updateMutation.isPending} data-testid="button-save-edit">
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ التغييرات"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف المادة</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف المادة "{selectedMaterial?.name}"؟
              <br />
              لن يتم حذف المادة نهائياً من قاعدة البيانات، ولكن لن تظهر في قائمة المواد.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel data-testid="button-cancel-delete">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => selectedMaterial && deleteMutation.mutate(selectedMaterial.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "حذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
