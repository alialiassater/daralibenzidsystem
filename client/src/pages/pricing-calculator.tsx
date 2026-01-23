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
  { label: "A4", value: "A4", multiplier: 1 },
  { label: "A5", value: "A5", multiplier: 0.7 },
  { label: "A3", value: "A3", multiplier: 2 },
  { label: "B5", value: "B5", multiplier: 0.85 },
  { label: "مخصص (Custom)", value: "custom", multiplier: 1 },
];

export default function PricingCalculatorPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === 'admin';

  const [paperPrice, setPaperPrice] = useState<number>(0);
  const [pageCount, setPageCount] = useState<number>(0);
  const [copies, setCopies] = useState<number>(0);
  const [paperSize, setPaperSize] = useState<string>("A4");
  const [customMultiplier, setCustomMultiplier] = useState<number>(1);
  const [inkPrice, setInkPrice] = useState<number>(3500);
  const [extraCosts, setExtraCosts] = useState<number>(0);

  const [results, setResults] = useState({
    inkCartridges: 0,
    paperCost: 0,
    inkCost: 0,
    totalCost: 0,
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
    const selectedSize = PAPER_SIZES.find(s => s.value === paperSize);
    const multiplier = paperSize === "custom" ? customMultiplier : (selectedSize?.multiplier || 1);
    
    const totalPages = pageCount * copies;
    const inkCost = totalPages > 0 ? inkPrice : 0; // علبة واحدة إذا كان هناك صفحات
    const paperCost = totalPages * paperPrice * multiplier;
    const totalCost = paperCost + inkCost + extraCosts;

    setResults({
      inkCartridges: totalPages > 0 ? 1 : 0,
      paperCost,
      inkCost,
      totalCost,
    });
  }, [paperPrice, pageCount, copies, paperSize, customMultiplier, inkPrice, extraCosts]);

  const handleSave = () => {
    if (!isAdmin) {
      toast({ title: "عذراً، حفظ الأسعار متاح للمدير فقط", variant: "destructive" });
      return;
    }

    saveMutation.mutate({
      userId: user?.id,
      totalPrice: results.totalCost.toString(),
      paperSize,
      pageCount,
      copyCount: copies,
      details: JSON.stringify({
        paperPrice,
        multiplier: paperSize === "custom" ? customMultiplier : PAPER_SIZES.find(s => s.value === paperSize)?.multiplier,
        inkPrice,
        extraCosts,
        inkCartridges: results.inkCartridges,
        paperCost: results.paperCost,
        inkCost: results.inkCost,
      })
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex items-center gap-3">
        <Calculator className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">حساب تكلفة الطباعة</h1>
          <p className="text-muted-foreground text-sm">أداة مستقلة لحساب تكاليف إنتاج الكتب والمنشورات</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Input Form */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 border-b mb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              بيانات الطباعة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">سعر الورقة (د.ج)</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  value={paperPrice || ''} 
                  onChange={(e) => setPaperPrice(Number(e.target.value))}
                  placeholder="0.00"
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">حجم الورق</Label>
                <Select value={paperSize} onValueChange={setPaperSize}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAPER_SIZES.map(size => (
                      <SelectItem key={size.value} value={size.value}>{size.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {paperSize === "custom" && (
              <div className="space-y-2">
                <Label className="text-sm">معامل الحجم المخصص</Label>
                <Input 
                  type="number" 
                  step="0.1" 
                  value={customMultiplier} 
                  onChange={(e) => setCustomMultiplier(Number(e.target.value))}
                  className="h-9"
                />
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">عدد الصفحات</Label>
                <Input 
                  type="number" 
                  value={pageCount || ''} 
                  onChange={(e) => setPageCount(Number(e.target.value))}
                  placeholder="0"
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">عدد النسخ</Label>
                <Input 
                  type="number" 
                  value={copies || ''} 
                  onChange={(e) => setCopies(Number(e.target.value))}
                  placeholder="0"
                  className="h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-dashed">
              <div className="space-y-2">
                <Label className="text-sm">سعر علبة الحبر (د.ج)</Label>
                <Input 
                  type="number" 
                  value={inkPrice} 
                  onChange={(e) => setInkPrice(Number(e.target.value))}
                  className="h-9"
                />
                <p className="text-[10px] text-muted-foreground font-medium">يتم حساب تكلفة علبة واحدة فقط</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">صفحات/علبة حبر (معلومة)</Label>
                <div className="h-9 flex items-center px-3 bg-muted/50 rounded-md border border-input text-sm text-muted-foreground select-none">
                  حوالي 2000 صفحة
                </div>
                <p className="text-[10px] text-muted-foreground italic">هذه معلومة تقريبية ولا تدخل في حساب السعر</p>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-dashed">
              <Label className="text-sm">تكاليف إضافية (د.ج)</Label>
              <Input 
                type="number" 
                value={extraCosts || ''} 
                onChange={(e) => setExtraCosts(Number(e.target.value))}
                placeholder="0.00"
                className="h-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* Results Card */}
        <div className="space-y-4">
          <Card className="bg-primary/5 border-primary/20 shadow-none">
            <CardHeader className="pb-2 border-b border-primary/10 mb-2">
              <CardTitle className="text-base text-primary flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                نتائج الحساب
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="flex justify-between items-center p-3 bg-card rounded-lg border shadow-sm">
                <div className="flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">علب الحبر:</span>
                </div>
                <div className="text-left">
                  <span className="font-bold text-lg">{results.inkCartridges} علبة</span>
                  <p className="text-[10px] text-muted-foreground">تكلفة ثابتة للعمل بالكامل</p>
                </div>
              </div>

              <div className="flex justify-between items-center p-3 bg-card rounded-lg border shadow-sm">
                <div className="flex items-center gap-2">
                  <Printer className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">تكلفة الورق:</span>
                </div>
                <span className="font-bold text-lg">{Math.round(results.paperCost).toLocaleString()} د.ج</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-card rounded-lg border shadow-sm">
                <div className="flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">تكلفة الحبر:</span>
                </div>
                <span className="font-bold text-lg">{results.inkCost.toLocaleString()} د.ج</span>
              </div>

              <div className="mt-6 p-4 bg-primary text-primary-foreground rounded-xl shadow-lg border-2 border-primary-foreground/20 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Banknote className="h-16 w-16" />
                </div>
                <div className="relative z-10">
                  <span className="text-xs font-light uppercase tracking-wider opacity-80">السعر الإجمالي النهائي</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-black">{Math.round(results.totalCost).toLocaleString()}</span>
                    <span className="text-sm font-medium opacity-90">دينار جزائري</span>
                  </div>
                </div>
              </div>

              {isAdmin && (
                <Button 
                  onClick={handleSave} 
                  className="w-full mt-4 bg-green-600 hover:bg-green-700"
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  ) : (
                    <Save className="h-4 w-4 ml-2" />
                  )}
                  حفظ السعر
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
            الأسعار المحفوظة
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="pb-3 pr-2">التاريخ</th>
                  <th className="pb-3 pr-2">حجم الورق</th>
                  <th className="pb-3 pr-2">عدد الصفحات</th>
                  <th className="pb-3 pr-2">النسخ</th>
                  <th className="pb-3 pr-2 text-left">السعر الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {savedCalcs?.map((calc) => (
                  <tr key={calc.id} className="hover:bg-muted/50 transition-colors">
                    <td className="py-3 pr-2">
                      {calc.createdAt ? format(new Date(calc.createdAt), "PPP p", { locale: ar }) : "-"}
                    </td>
                    <td className="py-3 pr-2 font-medium">{calc.paperSize}</td>
                    <td className="py-3 pr-2">{calc.pageCount}</td>
                    <td className="py-3 pr-2">{calc.copyCount}</td>
                    <td className="py-3 pr-2 text-left font-bold text-primary">
                      {Number(calc.totalPrice).toLocaleString()} د.ج
                    </td>
                  </tr>
                ))}
                {!isLoadingCalcs && (!savedCalcs || savedCalcs.length === 0) && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground italic">
                      لا توجد حسابات محفوظة بعد
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
