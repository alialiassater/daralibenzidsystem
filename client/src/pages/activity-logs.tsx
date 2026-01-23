import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollText, Search, Filter, User, Clock, Activity } from "lucide-react";
import type { ActivityLog, User as UserType } from "@shared/schema";

// ترجمة أنواع العمليات
const actionLabels: Record<string, string> = {
  login: "تسجيل دخول",
  logout: "تسجيل خروج",
  create: "إضافة",
  update: "تعديل",
  delete: "حذف",
  inventory_in: "إدخال مخزون",
  inventory_out: "إخراج مخزون",
};

// ترجمة أنواع العناصر
const entityTypeLabels: Record<string, string> = {
  auth: "المصادقة",
  user: "موظف",
  material: "مادة",
  book: "كتاب",
  order: "طلب طباعة",
  inventory_movement: "حركة مخزون",
};

// ألوان العمليات
const actionColors: Record<string, string> = {
  login: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  logout: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  create: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  update: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  delete: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  inventory_in: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  inventory_out: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

// ترجمة الرتب
const roleLabels: Record<string, string> = {
  admin: "مدير",
  supervisor: "مشرف",
  employee: "موظف",
};

export default function ActivityLogsPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");

  // جلب سجلات النشاط مع إرسال role في الهيدر للتحقق
  const { data: logs, isLoading: logsLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/activity-logs"],
    queryFn: async () => {
      const response = await fetch("/api/activity-logs", {
        headers: {
          "x-user-role": user?.role || "",
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch activity logs");
      }
      return response.json();
    },
    enabled: user?.role === "admin",
  });

  // جلب قائمة الموظفين للفلترة
  const { data: users } = useQuery<Omit<UserType, 'password'>[]>({
    queryKey: ["/api/users"],
  });

  // التحقق من صلاحية المدير
  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <ScrollText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">غير مصرح</h2>
            <p className="text-muted-foreground">
              صفحة سجل النشاط متاحة للمدير فقط
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // تصفية السجلات
  const filteredLogs = logs?.filter((log) => {
    const matchesSearch =
      searchTerm === "" ||
      log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entityName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    const matchesEntity = entityFilter === "all" || log.entityType === entityFilter;
    const matchesUser = userFilter === "all" || log.userId === userFilter;

    return matchesSearch && matchesAction && matchesEntity && matchesUser;
  });

  // تنسيق التاريخ والوقت
  const formatDateTime = (date: Date | string | null) => {
    if (!date) return "-";
    const d = new Date(date);
    return d.toLocaleString("ar-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6" dir="rtl">
      {/* العنوان */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex items-center gap-2">
          <ScrollText className="h-6 w-6 md:h-8 md:w-8 text-primary" />
          <h1 className="text-2xl md:text-3xl font-bold">سجل النشاط</h1>
        </div>
        <Badge variant="secondary" className="w-fit">
          {filteredLogs?.length || 0} سجل
        </Badge>
      </div>

      {/* أدوات البحث والتصفية */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            البحث والتصفية
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* البحث */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-9"
                data-testid="input-search-logs"
              />
            </div>

            {/* فلتر الموظف */}
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger data-testid="select-user-filter">
                <User className="h-4 w-4 ml-2" />
                <SelectValue placeholder="جميع الموظفين" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الموظفين</SelectItem>
                {users?.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* فلتر نوع العملية */}
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger data-testid="select-action-filter">
                <Activity className="h-4 w-4 ml-2" />
                <SelectValue placeholder="جميع العمليات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع العمليات</SelectItem>
                <SelectItem value="login">تسجيل دخول</SelectItem>
                <SelectItem value="logout">تسجيل خروج</SelectItem>
                <SelectItem value="create">إضافة</SelectItem>
                <SelectItem value="update">تعديل</SelectItem>
                <SelectItem value="delete">حذف</SelectItem>
                <SelectItem value="inventory_in">إدخال مخزون</SelectItem>
                <SelectItem value="inventory_out">إخراج مخزون</SelectItem>
              </SelectContent>
            </Select>

            {/* فلتر نوع العنصر */}
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger data-testid="select-entity-filter">
                <SelectValue placeholder="جميع العناصر" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع العناصر</SelectItem>
                <SelectItem value="auth">المصادقة</SelectItem>
                <SelectItem value="user">الموظفين</SelectItem>
                <SelectItem value="material">المخزون</SelectItem>
                <SelectItem value="book">الكتب</SelectItem>
                <SelectItem value="order">الطلبات</SelectItem>
                <SelectItem value="inventory_movement">حركات المخزون</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* جدول السجلات */}
      <Card>
        <CardContent className="p-0">
          {logsLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredLogs && filteredLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الموظف</TableHead>
                    <TableHead className="text-right">الرتبة</TableHead>
                    <TableHead className="text-right">العملية</TableHead>
                    <TableHead className="text-right">العنصر</TableHead>
                    <TableHead className="text-right hidden md:table-cell">التفاصيل</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">IP</TableHead>
                    <TableHead className="text-right">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        التاريخ
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id} data-testid={`row-log-${log.id}`}>
                      <TableCell className="font-medium">{log.userName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {roleLabels[log.userRole] || log.userRole}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${actionColors[log.action] || ""} border-0`}>
                          {actionLabels[log.action] || log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground">
                            {entityTypeLabels[log.entityType] || log.entityType}
                          </span>
                          {log.entityName && (
                            <span className="font-medium text-sm">{log.entityName}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell max-w-xs truncate">
                        {log.details || "-"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground font-mono">
                        {log.ipAddress || "-"}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <ScrollText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>لا توجد سجلات</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
