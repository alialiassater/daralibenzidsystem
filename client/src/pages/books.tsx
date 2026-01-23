import { useState, useRef } from "react";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { BarcodeGenerator } from "@/components/barcode-generator";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { Plus, BookOpen, Search, Loader2, QrCode, TrendingUp, Upload, Image, Edit2, Package, Trash2, Pencil, Printer } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { Book } from "@shared/schema";
import { useAuth } from "@/lib/auth-context";

const BOOK_CATEGORIES = [
  { value: "تعليمي", label: "تعليمي" },
  { value: "ديني", label: "ديني" },
  { value: "أدبي", label: "أدبي" },
  { value: "علمي", label: "علمي" },
  { value: "أطفال", label: "أطفال" },
  { value: "تاريخي", label: "تاريخي" },
  { value: "فلسفي", label: "فلسفي" },
  { value: "شعر", label: "شعر" },
  { value: "رواية", label: "رواية" },
  { value: "قصص قصيرة", label: "قصص قصيرة" },
  { value: "مسرحيات", label: "مسرحيات" },
  { value: "أخرى", label: "أخرى" },
];

const bookSchema = z.object({
  title: z.string().min(1, "اسم الكتاب مطلوب"),
  author: z.string().min(1, "اسم المؤلف مطلوب"),
  isbn: z.string().min(1, "رقم ISBN مطلوب"),
  category: z.string().min(1, "الصنف مطلوب"),
  totalQuantity: z.coerce.number().min(0, "الكمية الإجمالية مطلوبة"),
  readyQuantity: z.coerce.number().min(0, "الكمية الجاهزة مطلوبة"),
  printingQuantity: z.coerce.number().min(0, "الكمية قيد الطباعة مطلوبة"),
  price: z.coerce.number().min(0, "السعر مطلوب"),
}).refine((data) => data.readyQuantity <= data.totalQuantity, {
  message: "الكمية الجاهزة لا يمكن أن تكون أكبر من الكمية الإجمالية",
  path: ["readyQuantity"],
}).refine((data) => data.readyQuantity + data.printingQuantity <= data.totalQuantity, {
  message: "مجموع الكميات لا يمكن أن يتجاوز الكمية الإجمالية",
  path: ["printingQuantity"],
});

type BookForm = z.infer<typeof bookSchema>;

const quantitySchema = z.object({
  totalQuantity: z.coerce.number().min(0),
  readyQuantity: z.coerce.number().min(0),
  printingQuantity: z.coerce.number().min(0),
}).refine((data) => data.readyQuantity <= data.totalQuantity, {
  message: "الكمية الجاهزة لا يمكن أن تكون أكبر من الكمية الإجمالية",
  path: ["readyQuantity"],
}).refine((data) => data.readyQuantity + data.printingQuantity <= data.totalQuantity, {
  message: "مجموع الكميات لا يمكن أن يتجاوز الكمية الإجمالية",
  path: ["printingQuantity"],
});

type QuantityForm = z.infer<typeof quantitySchema>;

const editBookSchema = z.object({
  title: z.string().min(1, "اسم الكتاب مطلوب"),
  author: z.string().min(1, "اسم المؤلف مطلوب"),
  isbn: z.string().min(1, "رقم ISBN مطلوب"),
  category: z.string().min(1, "الصنف مطلوب"),
  totalQuantity: z.coerce.number().min(0),
  readyQuantity: z.coerce.number().min(0),
  printingQuantity: z.coerce.number().min(0),
  price: z.coerce.number().min(0),
}).refine((data) => data.readyQuantity <= data.totalQuantity, {
  message: "الكمية الجاهزة لا يمكن أن تكون أكبر من الكمية الإجمالية",
  path: ["readyQuantity"],
}).refine((data) => data.readyQuantity + data.printingQuantity <= data.totalQuantity, {
  message: "مجموع الكميات لا يمكن أن يتجاوز الكمية الإجمالية",
  path: ["printingQuantity"],
});

type EditBookForm = z.infer<typeof editBookSchema>;

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  "ready": { label: "جاهز", className: "bg-green-500/10 text-green-600" },
  "printing": { label: "قيد الطباعة", className: "bg-yellow-500/10 text-yellow-600" },
  "unavailable": { label: "غير متوفر", className: "bg-red-500/10 text-red-600" },
};

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-4 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function BookCard({ book, onViewBarcode, onEditQuantity, onEditBook, onDeleteBook, isAdmin }: { 
  book: Book; 
  onViewBarcode: (book: Book) => void; 
  onEditQuantity: (book: Book) => void;
  onEditBook: (book: Book) => void;
  onDeleteBook: (book: Book) => void;
  isAdmin: boolean;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  const statusInfo = STATUS_LABELS[book.status] || STATUS_LABELS["unavailable"];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('cover', file);

    try {
      const response = await fetch(`/api/books/${book.id}/cover`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      toast({ title: "تم رفع صورة الغلاف بنجاح" });
    } catch {
      toast({ title: "حدث خطأ أثناء رفع الصورة", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const categoryColors: Record<string, string> = {
    "تعليمي": "bg-blue-500/10 text-blue-600",
    "ديني": "bg-green-500/10 text-green-600",
    "أدبي": "bg-purple-500/10 text-purple-600",
    "علمي": "bg-orange-500/10 text-orange-600",
    "أطفال": "bg-pink-500/10 text-pink-600",
    "تاريخي": "bg-amber-500/10 text-amber-600",
    "فلسفي": "bg-indigo-500/10 text-indigo-600",
    "شعر": "bg-rose-500/10 text-rose-600",
    "رواية": "bg-cyan-500/10 text-cyan-600",
    "قصص قصيرة": "bg-teal-500/10 text-teal-600",
    "مسرحيات": "bg-violet-500/10 text-violet-600",
    "أخرى": "bg-gray-500/10 text-gray-600",
  };

  return (
    <Card className="overflow-hidden" data-testid={`card-book-${book.id}`}>
      <div className="aspect-[3/4] relative bg-muted">
        {book.coverImage ? (
          <img
            src={book.coverImage}
            alt={book.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="h-16 w-16 text-muted-foreground/50" />
          </div>
        )}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/jpeg,image/jpg,image/png,image/webp"
          className="hidden"
        />
        <Button
          size="sm"
          variant="secondary"
          className="absolute bottom-2 left-2"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          data-testid={`button-upload-cover-${book.id}`}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Upload className="h-4 w-4 ml-1" />
              {book.coverImage ? "تغيير" : "رفع غلاف"}
            </>
          )}
        </Button>
      </div>
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="font-bold text-lg line-clamp-2">{book.title}</h3>
          <p className="text-muted-foreground text-sm">{book.author}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className={categoryColors[book.category] || categoryColors["أخرى"]} variant="secondary">
            {book.category}
          </Badge>
          <Badge className={statusInfo.className} variant="secondary">
            {statusInfo.label}
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-1 text-xs text-center">
          <div className="bg-muted rounded p-1">
            <p className="font-bold">{book.totalQuantity || 0}</p>
            <p className="text-muted-foreground">إجمالي</p>
          </div>
          <div className="bg-green-500/10 rounded p-1">
            <p className="font-bold text-green-600">{book.readyQuantity || 0}</p>
            <p className="text-muted-foreground">جاهز</p>
          </div>
          <div className="bg-yellow-500/10 rounded p-1">
            <p className="font-bold text-yellow-600">{book.printingQuantity || 0}</p>
            <p className="text-muted-foreground">قيد الطباعة</p>
          </div>
        </div>
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="font-bold text-primary">{Number(book.price).toLocaleString()} د.ج</span>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" onClick={() => onEditBook(book)} data-testid={`button-edit-book-${book.id}`}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => onEditQuantity(book)} data-testid={`button-edit-quantity-${book.id}`}>
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => onViewBarcode(book)} data-testid={`button-barcode-book-${book.id}`}>
              <QrCode className="h-4 w-4" />
            </Button>
            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost" className="text-destructive" data-testid={`button-delete-book-${book.id}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>هل أنت متأكد من حذف الكتاب؟</AlertDialogTitle>
                    <AlertDialogDescription>
                      سيتم حذف الكتاب "{book.title}" نهائياً. هذا الإجراء لا يمكن التراجع عنه.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="gap-2">
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDeleteBook(book)} className="bg-destructive text-destructive-foreground">
                      حذف
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground font-mono">ISBN: {book.isbn}</p>
      </CardContent>
    </Card>
  );
}

export default function BooksPage() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isBarcodeOpen, setIsBarcodeOpen] = useState(false);
  const [isQuantityOpen, setIsQuantityOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const { data: books, isLoading } = useQuery<Book[]>({
    queryKey: ["/api/books"],
  });

  const addForm = useForm<BookForm>({
    resolver: zodResolver(bookSchema),
    defaultValues: {
      title: "",
      author: "",
      isbn: "",
      category: "أخرى",
      totalQuantity: 0,
      readyQuantity: 0,
      printingQuantity: 0,
      price: 0,
    },
  });

  const quantityForm = useForm<QuantityForm>({
    resolver: zodResolver(quantitySchema),
    defaultValues: {
      totalQuantity: 0,
      readyQuantity: 0,
      printingQuantity: 0,
    },
  });

  const editForm = useForm<EditBookForm>({
    resolver: zodResolver(editBookSchema),
    defaultValues: {
      title: "",
      author: "",
      isbn: "",
      category: "أخرى",
      totalQuantity: 0,
      readyQuantity: 0,
      printingQuantity: 0,
      price: 0,
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: BookForm) => {
      const response = await apiRequest("POST", "/api/books", { ...data, currentUser: user });
      return response.json() as Promise<Book>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setIsAddOpen(false);
      addForm.reset();
      toast({ title: "تمت إضافة الكتاب بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ أثناء الإضافة", variant: "destructive" });
    },
  });

  const updateQuantityMutation = useMutation({
    mutationFn: async ({ bookId, data }: { bookId: string; data: QuantityForm }) => {
      const response = await apiRequest("PATCH", `/api/books/${bookId}/quantities`, { ...data, currentUser: user });
      return response.json() as Promise<Book>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setIsQuantityOpen(false);
      toast({ title: "تم تحديث الكميات بنجاح" });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "حدث خطأ أثناء تحديث الكميات", variant: "destructive" });
    },
  });

  const updateBookMutation = useMutation({
    mutationFn: async ({ bookId, data }: { bookId: string; data: EditBookForm }) => {
      const response = await fetch(`/api/books/${bookId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, currentUser: user })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'فشل تحديث الكتاب');
      }
      return response.json() as Promise<Book>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setIsEditOpen(false);
      setSelectedBook(null);
      toast({ title: "تم تحديث بيانات الكتاب بنجاح" });
    },
    onError: (error: any) => {
      const message = error?.message || "حدث خطأ أثناء تحديث الكتاب";
      toast({ title: message, variant: "destructive" });
    },
  });

  const deleteBookMutation = useMutation({
    mutationFn: async (bookId: string) => {
      const response = await fetch(`/api/books/${bookId}`, {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-role': user?.role || ''
        },
        body: JSON.stringify({ currentUser: user })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'فشل الحذف');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "تم حذف الكتاب بنجاح" });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "حدث خطأ أثناء حذف الكتاب", variant: "destructive" });
    },
  });

  const handleViewBarcode = (book: Book) => {
    setSelectedBook(book);
    setIsBarcodeOpen(true);
  };

  const handleEditQuantity = (book: Book) => {
    setSelectedBook(book);
    quantityForm.reset({
      totalQuantity: book.totalQuantity || 0,
      readyQuantity: book.readyQuantity || 0,
      printingQuantity: book.printingQuantity || 0,
    });
    setIsQuantityOpen(true);
  };

  const handleEditBook = (book: Book) => {
    setSelectedBook(book);
    editForm.reset({
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      category: book.category,
      totalQuantity: book.totalQuantity || 0,
      readyQuantity: book.readyQuantity || 0,
      printingQuantity: book.printingQuantity || 0,
      price: Number(book.price) || 0,
    });
    setIsEditOpen(true);
  };

  const handleDeleteBook = (book: Book) => {
    deleteBookMutation.mutate(book.id);
  };

  const handleBarcodeScan = (barcode: string) => {
    const book = books?.find(b => b.isbn === barcode || b.barcode === barcode);
    if (book) {
      setSearchQuery(barcode);
      toast({ title: "تم العثور على الكتاب" });
    } else {
      toast({ title: "الكتاب غير موجود", variant: "destructive" });
    }
  };

  const filteredBooks = books?.filter((b) => {
    const matchesSearch = 
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.isbn.includes(searchQuery) ||
      b.barcode.includes(searchQuery);
    
    const matchesCategory = categoryFilter === "all" || b.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  const totalBooks = books?.length || 0;
  const totalQuantity = books?.reduce((sum, b) => sum + (b.totalQuantity || 0), 0) || 0;
  const totalReady = books?.reduce((sum, b) => sum + (b.readyQuantity || 0), 0) || 0;

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" data-testid="text-page-title">إدارة الكتب</h1>
          <p className="text-muted-foreground mt-1">إدارة كتب دار النشر مع دعم الباركود وصور الأغلفة</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <BarcodeScanner onScan={handleBarcodeScan} placeholder="امسح ISBN الكتاب" />
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-book">
                <Plus className="h-4 w-4 ml-2" />
                إضافة كتاب
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>إضافة كتاب جديد</DialogTitle>
              </DialogHeader>
              <Form {...addForm}>
                <form onSubmit={addForm.handleSubmit((data) => addMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={addForm.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>اسم الكتاب</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-book-title" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addForm.control}
                    name="author"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>المؤلف</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-book-author" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={addForm.control}
                      name="isbn"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>رقم ISBN (سيستخدم كباركود)</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-book-isbn" placeholder="مثلاً: 9789947000000" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addForm.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>الصنف</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-book-category">
                                <SelectValue placeholder="اختر الصنف" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {BOOK_CATEGORIES.map((cat) => (
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
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={addForm.control}
                      name="totalQuantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>الكمية الإجمالية</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} data-testid="input-book-total" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addForm.control}
                      name="readyQuantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>الجاهزة</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} data-testid="input-book-ready" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addForm.control}
                      name="printingQuantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>قيد الطباعة</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} data-testid="input-book-printing" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={addForm.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>السعر (د.ج)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} data-testid="input-book-price" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={addMutation.isPending}
                    data-testid="button-submit-book"
                  >
                    {addMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "إضافة الكتاب"
                    )}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 p-2 rounded">
                <Package className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">عدد الكتب</p>
                <h3 className="text-2xl font-bold">{totalBooks}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <div className="bg-green-500/10 p-2 rounded">
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">إجمالي النسخ</p>
                <h3 className="text-2xl font-bold">{totalQuantity}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <div className="bg-blue-500/10 p-2 rounded">
                <BookOpen className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">النسخ الجاهزة</p>
                <h3 className="text-2xl font-bold">{totalReady}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="البحث عن كتاب بالاسم، المؤلف، ISBN أو الباركود..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
            data-testid="input-search-books"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-filter-category">
            <SelectValue placeholder="تصفية حسب الصنف" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأصناف</SelectItem>
            {BOOK_CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredBooks?.map((book) => (
          <BookCard 
            key={book.id} 
            book={book} 
            onViewBarcode={handleViewBarcode}
            onEditQuantity={handleEditQuantity}
            onEditBook={handleEditBook}
            onDeleteBook={handleDeleteBook}
            isAdmin={isAdmin}
          />
        ))}
        {filteredBooks?.length === 0 && (
          <div className="col-span-full text-center py-12 bg-muted/20 rounded-lg border-2 border-dashed">
            <p className="text-muted-foreground">لا توجد كتب تطابق البحث</p>
          </div>
        )}
      </div>

      <Dialog open={isBarcodeOpen} onOpenChange={setIsBarcodeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>باركود الكتاب</DialogTitle>
          </DialogHeader>
          {selectedBook && (
            <div className="space-y-4">
              <div id="barcode-print-area" className="flex flex-col items-center p-4 bg-white">
                <p className="text-center font-bold text-black mb-2">{selectedBook.title}</p>
                <BarcodeGenerator value={selectedBook.barcode} />
                <p className="text-center text-xs text-black mt-1">ISBN: {selectedBook.isbn}</p>
              </div>
              <Button 
                onClick={() => {
                  const content = document.getElementById("barcode-print-area");
                  if (content) {
                    const printWindow = window.open('', '_blank');
                    printWindow?.document.write(`
                      <html>
                        <head>
                          <title>طباعة باركود - ${selectedBook.title}</title>
                          <style>
                            body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; font-family: sans-serif; }
                            @media print { body { height: auto; } }
                          </style>
                        </head>
                        <body>${content.innerHTML}</body>
                      </html>
                    `);
                    printWindow?.document.close();
                    printWindow?.focus();
                    setTimeout(() => {
                      printWindow?.print();
                      printWindow?.close();
                    }, 250);
                  }
                }} 
                className="w-full"
                variant="outline"
              >
                <Printer className="h-4 w-4 ml-2" />
                طباعة الباركود
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isQuantityOpen} onOpenChange={setIsQuantityOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تحديث كميات الكتاب</DialogTitle>
          </DialogHeader>
          <Form {...quantityForm}>
            <form onSubmit={quantityForm.handleSubmit((data) => {
              if (selectedBook) {
                updateQuantityMutation.mutate({ bookId: selectedBook.id, data });
              }
            })} className="space-y-4">
              <FormField
                control={quantityForm.control}
                name="totalQuantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الكمية الإجمالية</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={quantityForm.control}
                name="readyQuantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الكمية الجاهزة</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={quantityForm.control}
                name="printingQuantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الكمية قيد الطباعة</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={updateQuantityMutation.isPending}
              >
                {updateQuantityMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "تحديث"
                )}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>تعديل بيانات الكتاب</DialogTitle>
          </DialogHeader>
          {selectedBook && (
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit((data) => {
                updateBookMutation.mutate({ bookId: selectedBook.id, data });
              })} className="space-y-4">
                <FormField
                  control={editForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>اسم الكتاب</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-edit-book-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="author"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>المؤلف</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-edit-book-author" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="isbn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>رقم ISBN</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-edit-book-isbn" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>الصنف</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-edit-book-category">
                              <SelectValue placeholder="اختر الصنف" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {BOOK_CATEGORIES.map((cat) => (
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
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={editForm.control}
                    name="totalQuantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>الكمية الإجمالية</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} data-testid="input-edit-book-total" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="readyQuantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>الكمية الجاهزة</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} data-testid="input-edit-book-ready" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="printingQuantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>قيد الطباعة</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} data-testid="input-edit-book-printing" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={editForm.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>السعر (د.ج)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} data-testid="input-edit-book-price" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={updateBookMutation.isPending}
                  data-testid="button-submit-edit-book"
                >
                  {updateBookMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "حفظ التعديلات"
                  )}
                </Button>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
