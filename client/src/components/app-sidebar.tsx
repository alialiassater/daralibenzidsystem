import { useLocation, Link } from "wouter";
import {
  LayoutDashboard,
  Package,
  Printer,
  BookOpen,
  LogOut,
  User,
} from "lucide-react";
import logoImage from "@assets/image_1769118952560.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const menuItems = [
  {
    title: "لوحة التحكم",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "المخزون",
    url: "/inventory",
    icon: Package,
  },
  {
    title: "طلبات الطباعة",
    url: "/orders",
    icon: Printer,
  },
  {
    title: "الكتب",
    url: "/books",
    icon: BookOpen,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  return (
    <Sidebar side="right" collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <img src={logoImage} alt="دار علي بن زيد" className="h-12 w-12 object-contain" />
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="font-bold text-lg">دار علي بن زيد</span>
            <span className="text-xs text-muted-foreground">للطباعة والنشر</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>القائمة الرئيسية</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    tooltip={item.title}
                  >
                    <Link href={item.url} data-testid={`link-${item.url.slice(1) || "dashboard"}`}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-primary">
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-medium">{user?.fullName}</span>
            <span className="text-xs text-muted-foreground">
              {user?.role === "admin" ? "مدير النظام" : "موظف"}
            </span>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={logout}
            className="group-data-[collapsible=icon]:hidden"
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
