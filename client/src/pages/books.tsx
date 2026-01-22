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
import { Plus, BookOpen, Search, Loader2, QrCode, TrendingUp, Upload, Image, Edit2, Package } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Book } from "@shared/schema";

const BOOK_CATEGORIES = [
  { value: "تعليمي", label: "تعليمي" },
  { value: "ديني", label: "ديني" },
  { value: "أدبي", label: "أدبي" },
  { value: "علمي", label: "علمي" },
  { value: "أطفال", label: "أطفال" },
  { value: "تاريخي", label: "تاريخي" },
  { value: "فلسفي", label: "فلسفي" },
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
      <div className="grid gap-4 md:grid-cols-3">
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

function BookCard({ book, onViewBarcode, onEditQuantity }: { book: Book; onViewBarcode: (book: Book) => void; onEditQuantity: (book: Book) => void }) {
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
            <Button size="icon" variant="ghost" onClick={() => onEditQuantity(book)} data-testid={`button-edit-quantity-${book.id}`}>
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => onViewBarcode(book)} data-testid={`button-barcode-book-${book.id}`}>
              <QrCode className="h-4 w-4" />
            </Button>
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
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const { toast } = useToast();

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

  const addMutation = useMutation({
    mutationFn: async (data: BookForm) => {
      const response = await apiRequest("POST", "/api/books", data);
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
      const response = await apiRequest("PATCH", `/api/books/${bookId}/quantities`, data);
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
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">إدارة الكتب</h1>
          <p className="text-muted-foreground mt-1">إدارة كتب دار النشر مع دعم الباركود وصور الأغلفة</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-book">
              <Plus className="h-4 w-4 ml-2" />
              إضافة كتاب
            </Button>
          </DialogTrigger>
          <DialogContent>
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
                        <FormLabel>رقم ISBN</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-book-isbn" />
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
                        <FormLabel>الكمية الجاهزة</FormLabel>
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
                <Button type="submit" className="w-full" disabled={addMutation.isPending} data-testid="button-submit-book">
                  {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "إضافة"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-md bg-primary/10">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalBooks}</p>
                <p className="text-sm text-muted-foreground">إجمالي الكتب</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-md bg-accent">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalQuantity}</p>
                <p className="text-sm text-muted-foreground">الكمية الإجمالية</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-md bg-green-500/10">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalReady}</p>
                <p className="text-sm text-muted-foreground">نسخ جاهزة</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-md bg-muted">
                <Image className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{books?.filter(b => b.coverImage).length || 0}</p>
                <p className="text-sm text-muted-foreground">كتب بأغلفة</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            الكتب المنشورة
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالاسم، المؤلف، أو الباركود..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
                data-testid="input-search-book"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48" data-testid="select-filter-category">
                <SelectValue placeholder="جميع الأصناف" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الأصناف</SelectItem>
                {BOOK_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredBooks?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">لا توجد كتب</p>
              <p className="text-sm">ابدأ بإضافة كتاب جديد</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredBooks?.map((book) => (
                <BookCard key={book.id} book={book} onViewBarcode={handleViewBarcode} onEditQuantity={handleEditQuantity} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isBarcodeOpen} onOpenChange={setIsBarcodeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>باركود الكتاب</DialogTitle>
          </DialogHeader>
          {selectedBook && (
            <div className="space-y-4">
              <p className="text-center font-medium">{selectedBook.title}</p>
              <p className="text-center text-sm text-muted-foreground">ISBN: {selectedBook.isbn}</p>
              <BarcodeGenerator value={selectedBook.barcode} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isQuantityOpen} onOpenChange={setIsQuantityOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تحديث كميات الكتاب</DialogTitle>
          </DialogHeader>
          {selectedBook && (
            <Form {...quantityForm}>
              <form
                onSubmit={quantityForm.handleSubmit((data) =>
                  updateQuantityMutation.mutate({ bookId: selectedBook.id, data })
                )}
                className="space-y-4"
              >
                <p className="font-medium text-center">{selectedBook.title}</p>
                <FormField
                  control={quantityForm.control}
                  name="totalQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>الكمية الإجمالية</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} data-testid="input-edit-total" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={quantityForm.control}
                    name="readyQuantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>الكمية الجاهزة</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} data-testid="input-edit-ready" />
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
                        <FormLabel>قيد الطباعة</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} data-testid="input-edit-printing" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={updateQuantityMutation.isPending}
                  data-testid="button-submit-quantity"
                >
                  {updateQuantityMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "تحديث الكميات"
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
