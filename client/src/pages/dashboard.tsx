import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Printer, BookOpen, DollarSign, AlertTriangle, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface DashboardStats {
  totalMaterials: number;
  lowStockCount: number;
  totalOrders: number;
  pendingOrders: number;
  totalBooks: number;
  totalBooksSold: number;
  todaySales: number;
  monthSales: number;
  totalExpenses: number;
  profit: number;
  lowStockItems: Array<{ id: string; name: string; quantity: number; minQuantity: number }>;
  recentOrders: Array<{ id: string; customerName: string; status: string; cost: string }>;
  salesByMonth: Array<{ month: string; amount: number }>;
}

const COLORS = ["hsl(217, 91%, 60%)", "hsl(142, 76%, 36%)", "hsl(45, 93%, 47%)", "hsl(262, 83%, 58%)", "hsl(0, 84%, 60%)"];

function StatCard({ title, value, icon: Icon, description, trend }: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
  trend?: "up" | "down" | "neutral";
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
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            {trend === "up" && <TrendingUp className="h-3 w-3 text-green-500" />}
            {description}
          </p>
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
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">لوحة التحكم</h1>
        <p className="text-muted-foreground mt-1">نظرة عامة على المطبعة ودار النشر</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
          description={`${stats?.totalBooksSold || 0} نسخة مباعة`}
        />
        <StatCard
          title="مبيعات اليوم"
          value={`${Number(stats?.todaySales || 0).toLocaleString()} د.ج`}
          icon={DollarSign}
          trend="up"
          description="إجمالي المبيعات اليومية"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              المبيعات الشهرية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats?.salesByMonth || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [`${value.toLocaleString()} د.ج`, "المبيعات"]}
                />
                <Bar dataKey="amount" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              حالة الطلبات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
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
      </div>

      <div className="grid gap-4 md:grid-cols-2">
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              ملخص مالي
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 rounded-md bg-muted/50">
                <span className="text-muted-foreground">مبيعات الشهر</span>
                <span className="font-bold text-lg">
                  {Number(stats?.monthSales || 0).toLocaleString()} د.ج
                </span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-md bg-muted/50">
                <span className="text-muted-foreground">المصروفات</span>
                <span className="font-bold text-lg text-destructive">
                  {Number(stats?.totalExpenses || 0).toLocaleString()} د.ج
                </span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-md bg-primary/10 border border-primary/20">
                <span className="font-medium">صافي الربح</span>
                <span className="font-bold text-xl text-primary">
                  {Number(stats?.profit || 0).toLocaleString()} د.ج
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
