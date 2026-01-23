import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calculator, Printer, Droplets, Banknote, FileText } from "lucide-react";

export default function PricingCalculatorPage() {
  const [paperPrice, setPaperPrice] = useState<number>(0);
  const [pageCount, setPageCount] = useState<number>(0);
  const [copies, setCopies] = useState<number>(0);
  const [inkPrice, setInkPrice] = useState<number>(3500);
  const [pagesPerInk, setPagesPerInk] = useState<number>(1000);
  const [extraCosts, setExtraCosts] = useState<number>(0);

  const [results, setResults] = useState({
    inkCartridges: 0,
    paperCost: 0,
    inkCost: 0,
    totalCost: 0,
  });

  useEffect(() => {
    const totalPages = pageCount * copies;
    const inkCartridges = Math.ceil(totalPages / pagesPerInk) || 0;
    const inkCost = inkCartridges * inkPrice;
    const paperCost = totalPages * paperPrice;
    const totalCost = paperCost + inkCost + extraCosts;

    setResults({
      inkCartridges,
      paperCost,
      inkCost,
      totalCost,
    });
  }, [paperPrice, pageCount, copies, inkPrice, pagesPerInk, extraCosts]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
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
            <div className="space-y-2">
              <Label className="text-sm">سعر الورقة الواحدة (د.ج)</Label>
              <Input 
                type="number" 
                step="0.01" 
                value={paperPrice || ''} 
                onChange={(e) => setPaperPrice(Number(e.target.value))}
                placeholder="0.00"
                className="h-9"
              />
            </div>
            
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

            <div className="space-y-2 pt-2 border-t border-dashed">
              <Label className="text-sm">سعر علبة الحبر (د.ج)</Label>
              <Input 
                type="number" 
                value={inkPrice} 
                onChange={(e) => setInkPrice(Number(e.target.value))}
                className="h-9"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">عدد الصفحات لكل علبة حبر</Label>
              <Input 
                type="number" 
                value={pagesPerInk} 
                onChange={(e) => setPagesPerInk(Number(e.target.value))}
                className="h-9"
              />
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
                <span className="font-bold text-lg">{results.inkCartridges} علبة</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-card rounded-lg border shadow-sm">
                <div className="flex items-center gap-2">
                  <Printer className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">تكلفة الورق:</span>
                </div>
                <span className="font-bold text-lg">{results.paperCost.toLocaleString()} د.ج</span>
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
                    <span className="text-3xl font-black">{results.totalCost.toLocaleString()}</span>
                    <span className="text-sm font-medium opacity-90">دينار جزائري</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <div className="p-4 bg-muted rounded-lg text-xs text-muted-foreground leading-relaxed">
            <p className="font-semibold mb-1 border-b pb-1">ملاحظة:</p>
            هذه الحاسبة تقديرية للمساعدة في تحديد التكاليف. لا يتم حفظ هذه البيانات في سجل الكتب تلقائياً.
          </div>
        </div>
      </div>
    </div>
  );
}
