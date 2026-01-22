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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { BarcodeGenerator } from "@/components/barcode-generator";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { Plus, BookOpen, Search, Loader2, QrCode, ShoppingCart, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Book } from "@shared/schema";

const bookSchema = z.object({
  title: z.string().min(1, "اسم الكتاب مطلوب"),
  author: z.string().min(1, "اسم المؤلف مطلوب"),
  isbn: z.string().min(1, "رقم ISBN مطلوب"),
  printedCopies: z.coerce.number().min(0, "عدد النسخ مطلوب"),
  price: z.coerce.number().min(0, "السعر مطلوب"),
});

const sellSchema = z.object({
  quantity: z.coerce.number().min(1, "الكمية مطلوبة"),
});

type BookForm = z.infer<typeof bookSchema>;
type SellForm = z.infer<typeof sellSchema>;

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

export default function BooksPage() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isSellOpen, setIsSellOpen] = useState(false);
  const [isBarcodeOpen, setIsBarcodeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
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
      printedCopies: 0,
      price: 0,
    },
  });

  const sellForm = useForm<SellForm>({
    resolver: zodResolver(sellSchema),
    defaultValues: {
      quantity: 1,
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: BookForm) => {
      return apiRequest<Book>("POST", "/api/books", data);
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

  const sellMutation = useMutation({
    mutationFn: async (data: SellForm) => {
      return apiRequest("POST", `/api/books/${selectedBook?.id}/sell`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setIsSellOpen(false);
      sellForm.reset();
      toast({ title: "تم تسجيل البيع بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ أثناء البيع", variant: "destructive" });
    },
  });

  const handleBarcodeScan = (barcode: string) => {
    const book = books?.find((b) => b.barcode === barcode || b.isbn === barcode);
    if (book) {
      setSelectedBook(book);
      setIsSellOpen(true);
      toast({ title: `تم العثور على: ${book.title}` });
    } else {
      toast({ title: "لم يتم العثور على الكتاب", variant: "destructive" });
    }
  };

  const filteredBooks = books?.filter(
    (b) =>
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.isbn.includes(searchQuery) ||
      b.barcode.includes(searchQuery)
  );

  const totalBooks = books?.length || 0;
  const totalPrinted = books?.reduce((sum, b) => sum + b.printedCopies, 0) || 0;
  const totalSold = books?.reduce((sum, b) => sum + b.soldCopies, 0) || 0;
  const totalRemaining = totalPrinted - totalSold;

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">إدارة الكتب</h1>
          <p className="text-muted-foreground mt-1">إدارة كتب دار النشر مع دعم الباركود</p>
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
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={addForm.control}
                    name="printedCopies"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>عدد النسخ المطبوعة</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} data-testid="input-book-copies" />
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
                        <FormLabel>السعر (ر.س)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} data-testid="input-book-price" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
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
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalPrinted}</p>
                <p className="text-sm text-muted-foreground">نسخ مطبوعة</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-md bg-green-500/10">
                <ShoppingCart className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalSold}</p>
                <p className="text-sm text-muted-foreground">نسخ مباعة</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-md bg-muted">
                <BookOpen className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalRemaining}</p>
                <p className="text-sm text-muted-foreground">نسخ متبقية</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-4">
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
            <BarcodeScanner onScan={handleBarcodeScan} placeholder="مسح الباركود للبيع" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الكتاب</TableHead>
                <TableHead>المؤلف</TableHead>
                <TableHead>ISBN</TableHead>
                <TableHead>المطبوعة</TableHead>
                <TableHead>المباعة</TableHead>
                <TableHead>المتبقية</TableHead>
                <TableHead>السعر</TableHead>
                <TableHead>الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBooks?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    لا توجد كتب
                  </TableCell>
                </TableRow>
              ) : (
                filteredBooks?.map((book) => {
                  const remaining = book.printedCopies - book.soldCopies;
                  return (
                    <TableRow key={book.id} data-testid={`row-book-${book.id}`}>
                      <TableCell className="font-medium">{book.title}</TableCell>
                      <TableCell>{book.author}</TableCell>
                      <TableCell className="font-mono text-sm">{book.isbn}</TableCell>
                      <TableCell>{book.printedCopies}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{book.soldCopies}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={remaining <= 10 ? "destructive" : "secondary"}>
                          {remaining}
                        </Badge>
                      </TableCell>
                      <TableCell>{Number(book.price).toLocaleString()} ر.س</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedBook(book);
                              setIsSellOpen(true);
                            }}
                            disabled={remaining <= 0}
                            data-testid={`button-sell-book-${book.id}`}
                          >
                            <ShoppingCart className="h-4 w-4 ml-1" />
                            بيع
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedBook(book);
                              setIsBarcodeOpen(true);
                            }}
                            data-testid={`button-barcode-book-${book.id}`}
                          >
                            <QrCode className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isSellOpen} onOpenChange={setIsSellOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>بيع كتاب</DialogTitle>
          </DialogHeader>
          {selectedBook && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-md">
                <p className="font-bold text-lg">{selectedBook.title}</p>
                <p className="text-muted-foreground">{selectedBook.author}</p>
                <div className="mt-2 flex gap-4">
                  <span className="text-sm">السعر: {Number(selectedBook.price).toLocaleString()} ر.س</span>
                  <span className="text-sm">المتبقي: {selectedBook.printedCopies - selectedBook.soldCopies}</span>
                </div>
              </div>
              <Form {...sellForm}>
                <form onSubmit={sellForm.handleSubmit((data) => sellMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={sellForm.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>عدد النسخ</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            max={selectedBook.printedCopies - selectedBook.soldCopies}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="p-3 bg-primary/10 rounded-md text-center">
                    <p className="text-sm text-muted-foreground">الإجمالي</p>
                    <p className="text-2xl font-bold text-primary">
                      {(Number(selectedBook.price) * (sellForm.watch("quantity") || 0)).toLocaleString()} ر.س
                    </p>
                  </div>
                  <Button type="submit" className="w-full" disabled={sellMutation.isPending}>
                    {sellMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "تأكيد البيع"}
                  </Button>
                </form>
              </Form>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
    </div>
  );
}
