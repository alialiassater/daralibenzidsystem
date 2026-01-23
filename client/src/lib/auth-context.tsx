import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { User } from "@shared/schema";

type UserRole = "admin" | "employee" | "supervisor";

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  isLoading: boolean;
  isAdmin: boolean;
  isSupervisor: boolean;
  isEmployee: boolean;
  canAccessPage: (page: string) => boolean;
  canDelete: boolean;
  canManageEmployees: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const pagePermissions: Record<string, UserRole[]> = {
  dashboard: ["admin", "supervisor", "employee"],
  inventory: ["admin", "supervisor", "employee"],
  orders: ["admin", "supervisor", "employee"],
  books: ["admin", "supervisor", "employee"],
  expenses: ["admin", "supervisor"],
  employees: ["admin"],
  "activity-logs": ["admin"],
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = (user: User) => {
    setUser(user);
    localStorage.setItem("user", JSON.stringify(user));
  };

  const logout = async () => {
    // تسجيل الخروج في سجل النشاط
    if (user) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            userName: user.fullName,
            userRole: user.role,
          }),
        });
      } catch (error) {
        console.error("Error logging logout:", error);
      }
    }
    setUser(null);
    localStorage.removeItem("user");
  };

  const role = user?.role as UserRole | undefined;
  const isAdmin = role === "admin";
  const isSupervisor = role === "supervisor";
  const isEmployee = role === "employee";
  const canDelete = isAdmin;
  const canManageEmployees = isAdmin;

  const canAccessPage = (page: string): boolean => {
    if (!role) return false;
    const allowedRoles = pagePermissions[page];
    return allowedRoles ? allowedRoles.includes(role) : true;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      isLoading, 
      isAdmin, 
      isSupervisor, 
      isEmployee,
      canAccessPage,
      canDelete,
      canManageEmployees 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
