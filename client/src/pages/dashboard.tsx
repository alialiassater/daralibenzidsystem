import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Printer, BookOpen, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface DashboardStats {
  totalMaterials: number;
  lowStockCount: number;
  totalOrders: number;
  pendingOrders: number;
  totalBooks: number;
  totalPrintedCopies: number;
  totalExpenses: number;
  readyBooksCount: number;
  readyBooksQuantity: number;
  lowStockItems: Array<{ id: string; name: string; quantity: number; minQuantity: number }>;
  recentOrders: Array<{ id: string; customerName: string; status: string; cost: string }>;
}

const COLORS = ["hsl(217, 91%, 60%)", "hsl(142, 76%, 36%)", "hsl(45, 93%, 47%)", "hsl(262, 83%, 58%)", "hsl(0, 84%, 60%)"];

function StatCard({ title, value, icon: Icon, description }: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  const orderStatusData = [
    { name: "قيد الانتظار", value: stats?.pendingOrders || 0 },
    { name: "مكتملة", value: (stats?.totalOrders || 0) - (stats?.pendingOrders || 0) },
  ];

  const statusLabels: Record<string, string> = {
    pending: "قيد الانتظار",
    in_progress: "قيد التنفيذ",
    completed: "مكتمل",
    cancelled: "ملغي",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">لوحة التحكم</h1>
        <p className="text-muted-foreground mt-1">نظرة عامة على المطبعة ودار النشر</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="إجمالي المخزون"
          value={stats?.totalMaterials || 0}
          icon={Package}
          description={`${stats?.lowStockCount || 0} عناصر منخفضة`}
        />
        <StatCard
          title="طلبات الطباعة"
          value={stats?.totalOrders || 0}
          icon={Printer}
          description={`${stats?.pendingOrders || 0} طلبات قيد الانتظار`}
        />
        <StatCard
          title="الكتب المنشورة"
          value={stats?.totalBooks || 0}
          icon={BookOpen}
          description={`${stats?.totalPrintedCopies || 0} نسخة مطبوعة`}
        />
        <StatCard
          title="الكتب الجاهزة"
          value={stats?.readyBooksCount || 0}
          icon={CheckCircle2}
          description={`${stats?.readyBooksQuantity || 0} نسخة جاهزة`}
        />
        <StatCard
          title="المصروفات الشهرية"
          value={`${Number(stats?.totalExpenses || 0).toLocaleString()} د.ج`}
          icon={Package}
          description="إجمالي مصروفات الشهر"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              حالة الطلبات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={orderStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {orderStatusData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              تنبيهات المخزون
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.lowStockItems && stats.lowStockItems.length > 0 ? (
              <div className="space-y-3">
                {stats.lowStockItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-md bg-destructive/10 border border-destructive/20"
                  >
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        الحد الأدنى: {item.minQuantity}
                      </p>
                    </div>
                    <Badge variant="destructive">
                      {item.quantity} متبقي
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>لا توجد تنبيهات حالياً</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            آخر الطلبات
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.recentOrders && stats.recentOrders.length > 0 ? (
            <div className="space-y-3">
              {stats.recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                >
                  <div>
                    <p className="font-medium">{order.customerName}</p>
                    <p className="text-sm text-muted-foreground">
                      {Number(order.cost).toLocaleString()} د.ج
                    </p>
                  </div>
                  <Badge variant={order.status === "completed" ? "default" : "secondary"}>
                    {statusLabels[order.status] || order.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Printer className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>لا توجد طلبات حالياً</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
