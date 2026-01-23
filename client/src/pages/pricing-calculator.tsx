import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calculator, Printer, Droplets, Banknote, FileText, Save, History, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import type { SavedCalculation } from "@shared/schema";

const PAPER_SIZES = [
  { label: "A4", value: "A4", paperPrice: 5.85, coverPrice: 150 },
  { label: "A3", value: "A3", paperPrice: 12, coverPrice: 150 },
  { label: "A5", value: "A5", paperPrice: 3.25, coverPrice: 150 },
];

export default function PricingCalculatorPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === 'admin';

  const [pageCount, setPageCount] = useState<number>(0);
  const [copies, setCopies] = useState<number>(0);
  const [bookTitle, setBookTitle] = useState<string>("");
  const [paperSize, setPaperSize] = useState<string>("A4");
  const [discountType, setDiscountType] = useState<"amount" | "percent">("amount");
  const [discountValue, setDiscountValue] = useState<number>(0);

  const [results, setResults] = useState({
    paperCost: 0,
    coverCost: 0,
    originalTotal: 0,
    discountAmount: 0,
    finalTotal: 0,
  });

  const { data: savedCalcs, isLoading: isLoadingCalcs } = useQuery<SavedCalculation[]>({
    queryKey: ["/api/calculations"],
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/calculations", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calculations"] });
      toast({ title: "تم حفظ السعر بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ أثناء حفظ السعر", variant: "destructive" });
    },
  });

  useEffect(() => {
    // التحقق من القيم قبل الحساب
    if (pageCount <= 0 || copies <= 0) {
      setResults({
        paperCost: 0,
        coverCost: 0,
        originalTotal: 0,
        discountAmount: 0,
        finalTotal: 0,
      });
      return;
    }

    const selectedSize = PAPER_SIZES.find(s => s.value === paperSize);
    if (!selectedSize) return;

    const paperPrice = selectedSize.paperPrice;
    const coverPrice = selectedSize.coverPrice;
    
    // المعادلة المعتمدة: (سعر الورقة × عدد الأوراق × عدد النسخ) + (سعر الغلاف × عدد النسخ)
    const paperTotalCost = paperPrice * Number(pageCount) * Number(copies);
    const coverTotalCost = coverPrice * Number(copies);
    const originalTotal = paperTotalCost + coverTotalCost;

    let discountAmount = 0;
    if (isAdmin) {
      if (discountType === "percent") {
        discountAmount = (originalTotal * Number(discountValue)) / 100;
      } else {
        discountAmount = Number(discountValue);
      }
      // منع الخصم إذا كان أكبر من السعر الأصلي
      if (discountAmount > originalTotal) discountAmount = originalTotal;
      if (discountAmount < 0) discountAmount = 0;
    }

    const finalTotal = originalTotal - discountAmount;

    setResults({
      paperCost: paperTotalCost,
      coverCost: coverTotalCost,
      originalTotal,
      discountAmount,
      finalTotal,
    });
  }, [pageCount, copies, paperSize, discountType, discountValue, isAdmin]);

  const handleSave = () => {
    if (!isAdmin) {
      toast({ title: "عذراً، حفظ الأسعار متاح للمدير فقط", variant: "destructive" });
      return;
    }

    saveMutation.mutate({
      userId: user?.id,
      bookTitle: bookTitle || "كتاب بدون عنوان",
      totalPrice: results.finalTotal.toString(),
      paperSize,
      pageCount,
      copyCount: copies,
      details: JSON.stringify({
        paperCost: results.paperCost,
        coverCost: results.coverCost,
        originalTotal: results.originalTotal,
        discountAmount: results.discountAmount,
        discountType,
        discountValue,
        finalTotal: results.finalTotal,
      })
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex items-center gap-3">
        <Calculator className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">حساب تكلفة الطباعة</h1>
          <p className="text-muted-foreground text-sm">حساب فوري حسب أسعار المطبعة المعتمدة</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Input Form */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 border-b mb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              بيانات العمل
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-sm">اسم الكتاب</Label>
              <Input 
                value={bookTitle} 
                onChange={(e) => setBookTitle(e.target.value)}
                placeholder="أدخل اسم الكتاب أو العمل"
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">حجم الورق</Label>
              <Select value={paperSize} onValueChange={setPaperSize}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAPER_SIZES.map(size => (
                    <SelectItem key={size.value} value={size.value}>{size.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">عدد الصفحات</Label>
                <Input 
                  type="number" 
                  min="1"
                  value={pageCount || ''} 
                  onChange={(e) => setPageCount(Math.max(0, Number(e.target.value)))}
                  placeholder="0"
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">عدد النسخ</Label>
                <Input 
                  type="number" 
                  min="1"
                  value={copies || ''} 
                  onChange={(e) => setCopies(Math.max(0, Number(e.target.value)))}
                  placeholder="0"
                  className="h-10"
                />
              </div>
            </div>

            <div className="p-3 bg-muted/30 rounded-lg border border-dashed space-y-2 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">الأسعار المعتمدة للحجم المختار:</p>
              <div className="flex justify-between">
                <span>سعر الورقة (شامل الحبر):</span>
                <span className="font-bold">{PAPER_SIZES.find(s => s.value === paperSize)?.paperPrice} دج</span>
              </div>
              <div className="flex justify-between">
                <span>سعر الغلاف (لكل نسخة):</span>
                <span className="font-bold">{PAPER_SIZES.find(s => s.value === paperSize)?.coverPrice} دج</span>
              </div>
            </div>

            {isAdmin && (
              <div className="space-y-4 pt-4 border-t">
                <Label className="text-sm font-bold flex items-center gap-2 text-primary">
                  <Banknote className="h-4 w-4" />
                  إضافة خصم (للمدير فقط)
                </Label>
                <div className="flex gap-2">
                  <Select value={discountType} onValueChange={(v: any) => setDiscountType(v)}>
                    <SelectTrigger className="w-[120px] h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="amount">مبلغ (دج)</SelectItem>
                      <SelectItem value="percent">نسبة (%)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input 
                    type="number"
                    min="0"
                    value={discountValue || ''}
                    onChange={(e) => setDiscountValue(Math.max(0, Number(e.target.value)))}
                    placeholder="0"
                    className="h-10 flex-1"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground italic">يتم تطبيق الخصم على السعر الإجمالي النهائي.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results Card */}
        <div className="space-y-4">
          <Card className="bg-primary/5 border-primary/20 shadow-none h-full">
            <CardHeader className="pb-2 border-b border-primary/10 mb-2">
              <CardTitle className="text-base text-primary flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                ملخص السعر
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
            <div className="flex justify-between items-center p-3 bg-card rounded-lg border shadow-sm">
                <div className="flex items-center gap-2">
                  <Printer className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">تكلفة الأوراق:</span>
                </div>
                <span className="font-bold text-lg">{Math.round(results.paperCost).toLocaleString()} دج</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-card rounded-lg border shadow-sm">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium">تكلفة الأغلفة:</span>
                </div>
                <span className="font-bold text-lg">{Math.round(results.coverCost).toLocaleString()} دج</span>
              </div>

              {results.originalTotal > 0 && (
                <div className="flex justify-between items-center p-3 bg-muted/20 rounded-lg border border-dashed">
                  <span className="text-sm font-medium text-muted-foreground">السعر الأصلي:</span>
                  <span className="font-bold text-muted-foreground">{Math.round(results.originalTotal).toLocaleString()} دج</span>
                </div>
              )}

              {results.discountAmount > 0 && (
                <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400">
                  <span className="text-sm font-medium">قيمة الخصم:</span>
                  <span className="font-bold">-{Math.round(results.discountAmount).toLocaleString()} دج</span>
                </div>
              )}

              <div className="mt-8 p-6 bg-primary text-primary-foreground rounded-xl shadow-lg border-2 border-primary-foreground/20 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Banknote className="h-20 w-20" />
                </div>
                <div className="relative z-10 text-center">
                  <span className="text-xs font-light uppercase tracking-wider opacity-80">السعر النهائي بعد الخصم</span>
                  <div className="flex flex-col items-center mt-2">
                    <span className="text-4xl font-black">{Math.round(results.finalTotal).toLocaleString()}</span>
                    <span className="text-sm font-medium mt-1 opacity-90">دينار جزائري</span>
                  </div>
                </div>
              </div>

              {isAdmin && (
                <Button 
                  onClick={handleSave} 
                  className="w-full mt-6 bg-green-600 hover:bg-green-700 h-11"
                  disabled={saveMutation.isPending || results.finalTotal === 0}
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin ml-2" />
                  ) : (
                    <Save className="h-5 w-5 ml-2" />
                  )}
                  حفظ الحساب في السجل
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Saved Calculations */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />
            سجل الحسابات الأخيرة
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="pb-3 pr-2">اسم الكتاب</th>
                  <th className="pb-3 pr-2">الحجم</th>
                  <th className="pb-3 pr-2">الصفحات</th>
                  <th className="pb-3 pr-2">النسخ</th>
                  <th className="pb-3 pr-2 text-left">السعر</th>
                  <th className="pb-3 pr-2">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {savedCalcs?.map((calc) => (
                  <tr key={calc.id} className="hover:bg-muted/50 transition-colors">
                    <td className="py-3 pr-2 font-medium">{calc.bookTitle}</td>
                    <td className="py-3 pr-2">{calc.paperSize}</td>
                    <td className="py-3 pr-2">{calc.pageCount}</td>
                    <td className="py-3 pr-2">{calc.copyCount}</td>
                    <td className="py-3 pr-2 text-left font-bold text-primary">
                      {Number(calc.totalPrice).toLocaleString()} دج
                    </td>
                    <td className="py-3 pr-2 text-xs text-muted-foreground">
                      {calc.createdAt ? format(new Date(calc.createdAt), "PPP p", { locale: ar }) : "-"}
                    </td>
                  </tr>
                ))}
                {!isLoadingCalcs && (!savedCalcs || savedCalcs.length === 0) && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground italic">
                      لا توجد حسابات محفوظة
                    </td>
                  </tr>
                )}
                {isLoadingCalcs && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
