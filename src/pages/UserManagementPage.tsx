import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { collection, getDocs, query, updateDoc, doc, deleteDoc, writeBatch, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Download, Users, User, Edit, Trash2, Mail, Shield, Calendar, Eye, MapPin, Phone, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Types
interface UserRecord {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  
  createdAt?: any;
  lastLogin?: any;
  status?: string;
}

interface Filters {
  search: string;
  role: string;
  status: string;
  startDate: string;
  endDate: string;
 
}

interface Stats {
  totalUsers: number;
  activeUsers: number;
  adminUsers: number;
  chiefAdminUsers: number;
  androidUsers: number;
 
}

interface Pagination {
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface EditForm {
  name: string;
  email: string;
  role: string;
 
  status: string;
}

interface AddUserForm {
  name: string;
  email: string;
  role: string;
 
  password: string;
  confirmPassword: string;
}

// Constants
const PAGE_LIMIT = 15;
const EXPORT_HEADERS = [
  'Name', 'Email', 'Role', 'Status', 'Created At', 'Last Login'
];

// Helper functions
const parseDate = (date: any): Date | null => {
  if (!date) return null;
  
  try {
    if (date.toDate && typeof date.toDate === 'function') {
      return date.toDate();
    } else if (date instanceof Date) {
      return date;
    } else if (typeof date === 'string') {
      const parsed = new Date(date);
      return isNaN(parsed.getTime()) ? null : parsed;
    } else if (typeof date === 'number') {
      return new Date(date);
    } else if (date.seconds) {
      return new Date(date.seconds * 1000);
    }
  } catch (error) {
    console.error('Error parsing date:', error);
  }
  
  return null;
};

const getCurrentMonthDates = () => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  return {
    startDate: startOfMonth.toISOString().split('T')[0],
    endDate: endOfMonth.toISOString().split('T')[0]
  };
};

const formatDate = (date: any): string => {
  const parsedDate = parseDate(date);
  return parsedDate ? parsedDate.toLocaleDateString() : 'N/A';
};

// Custom debounce hook
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

const UserManagementPage = () => {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const [allRecords, setAllRecords] = useState<UserRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [viewingRecord, setViewingRecord] = useState<UserRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<UserRecord | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  
  const currentMonth = useMemo(getCurrentMonthDates, []);

  // Separate search state with debouncing
  const [searchValue, setSearchValue] = useState("");
  const debouncedSearch = useDebounce(searchValue, 300);

  const [filters, setFilters] = useState<Omit<Filters, 'search'>>({
    role: "all",
    status: "all",
    startDate: currentMonth.startDate,
    endDate: currentMonth.endDate,
   
   
  });

  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    activeUsers: 0,
    adminUsers: 0,
    chiefAdminUsers: 0,
    androidUsers: 0,
    
  });

  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: PAGE_LIMIT,
    totalPages: 1,
    hasNext: false,
    hasPrev: false
  });

  const [editForm, setEditForm] = useState<EditForm>({
    name: "",
    email: "",
    role: "",
   
    status: "active"
  });

  const [addForm, setAddForm] = useState<AddUserForm>({
    name: "",
    email: "",
    role: "user",
   
    password: "",
    confirmPassword: ""
  });

  // Data fetching - improved to get all users from Firebase Auth and Firestore
  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      const q = query(collection(db, "users"));
      const snapshot = await getDocs(q);
      
      const recordsData = snapshot.docs.map(doc => {
        const data = doc.data();
        
        return {
          id: doc.id,
          name: data.name || data.displayName || data.email?.split('@')[0] || "Unknown User",
          email: data.email || "",
          role: data.role || "user",
         
          createdAt: data.createdAt || data.metadata?.creationTime || "",
          lastLogin: data.lastLogin || data.metadata?.lastSignInTime || "",
          status: data.status || "active"
        };
      });

      // Sort users by creation date (newest first)
      recordsData.sort((a, b) => {
        const dateA = parseDate(a.createdAt) || new Date(0);
        const dateB = parseDate(b.createdAt) || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });

      setAllRecords(recordsData);
      
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to load users from database",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Main filtering logic
  const filterAndProcessData = useCallback((records: UserRecord[], searchTerm: string, filterParams: Omit<Filters, 'search'>) => {
    const filtered = records.filter(record => {
      // Role filter
      if (filterParams.role !== "all" && record.role?.toLowerCase() !== filterParams.role.toLowerCase()) {
        return false;
      }

      // Status filter
      if (filterParams.status !== "all" && record.status?.toLowerCase() !== filterParams.status.toLowerCase()) {
        return false;
      }

     

      // Date filter
      if (filterParams.startDate || filterParams.endDate) {
        const recordDate = parseDate(record.createdAt);
        if (recordDate) {
          const recordDateOnly = new Date(recordDate);
          recordDateOnly.setHours(0, 0, 0, 0);

          const startDate = filterParams.startDate ? new Date(filterParams.startDate) : null;
          const endDate = filterParams.endDate ? new Date(filterParams.endDate) : null;
          if (startDate) startDate.setHours(0, 0, 0, 0);
          if (endDate) endDate.setHours(23, 59, 59, 999);

          if (startDate && recordDateOnly < startDate) return false;
          if (endDate && recordDateOnly > endDate) return false;
        }
      }

      // Search filter
      if (searchTerm) {
        const searchTermLower = searchTerm.toLowerCase();
        const searchMatch = [
          record.name, record.email, record.role
        ].some(field => field?.toLowerCase().includes(searchTermLower));
        if (!searchMatch) return false;
      }

      return true;
    });

    // Calculate stats
    const activeUsers = filtered.filter(r => r.status?.toLowerCase() === 'active').length;
    const adminUsers = filtered.filter(r => r.role?.toLowerCase() === 'admin').length;
    const chiefAdminUsers = filtered.filter(r => r.role?.toLowerCase() === 'chief-admin').length;
    const androidUsers = filtered.filter(r => r.role?.toLowerCase() === 'android').length;
   

    const calculatedStats = {
      totalUsers: filtered.length,
      activeUsers,
      adminUsers,
      chiefAdminUsers,
      androidUsers,
     
    };

    // Calculate pagination
    const totalPages = Math.ceil(filtered.length / PAGE_LIMIT);

    return {
      filteredRecords: filtered,
      stats: calculatedStats,
      totalPages
    };
  }, []);

  // Effect to apply filters when data, search, or filters change
  useEffect(() => {
    if (allRecords.length === 0) return;

    const result = filterAndProcessData(allRecords, debouncedSearch, filters);
    
    setFilteredRecords(result.filteredRecords);
    setStats(result.stats);
    
    // Update pagination
    setPagination(prev => ({
      ...prev,
      totalPages: result.totalPages,
      hasNext: prev.page < result.totalPages,
      hasPrev: prev.page > 1
    }));
  }, [allRecords, debouncedSearch, filters, filterAndProcessData]);

  // Effects
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Search handler
  const handleSearch = useCallback((value: string) => {
    setSearchValue(value);
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);

  // Filter change handler
  const handleFilterChange = useCallback((key: keyof Omit<Filters, 'search'>, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);

  const handleExport = useCallback(async () => {
    try {
      setExportLoading(true);
      
      if (filteredRecords.length === 0) {
        toast({
          title: "No Data to Export",
          description: "There are no users matching your current filters",
          variant: "destructive",
        });
        return;
      }

      const csvData = filteredRecords.map(record => [
        record.name || 'N/A',
        record.email || 'N/A',
        record.role || 'N/A',
      
        record.status || 'N/A',
        formatDate(record.createdAt),
        formatDate(record.lastLogin)
      ]);

      const csvContent = [EXPORT_HEADERS, ...csvData]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      let filename = `users-management`;
      if (filters.startDate || filters.endDate) {
        filename += `_${filters.startDate || 'start'}_to_${filters.endDate || 'end'}`;
      }
      filename += `_${new Date().toISOString().split('T')[0]}.csv`;
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: `Exported ${filteredRecords.length} users with applied filters`,
      });

    } catch (error) {
      console.error("Error exporting data:", error);
      toast({
        title: "Export Failed",
        description: "Failed to export data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setExportLoading(false);
    }
  }, [filteredRecords, filters.startDate, filters.endDate, toast]);

  const handlePageChange = useCallback((newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  }, []);

  const getCurrentPageRecords = useCallback(() => {
    const startIndex = (pagination.page - 1) * pagination.limit;
    const endIndex = startIndex + pagination.limit;
    return filteredRecords.slice(startIndex, endIndex);
  }, [filteredRecords, pagination.page, pagination.limit]);

  const handleSelectRecord = useCallback((recordId: string) => {
    setSelectedRecords(prev =>
      prev.includes(recordId)
        ? prev.filter(id => id !== recordId)
        : [...prev, recordId]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    const currentPageIds = getCurrentPageRecords().map(r => r.id);
    setSelectedRecords(prev =>
      prev.length === currentPageIds.length ? [] : currentPageIds
    );
  }, [getCurrentPageRecords]);

  const openEditDialog = useCallback((record: UserRecord) => {
    setEditingRecord(record);
    setEditForm({
      name: record.name || "",
      email: record.email || "",
      role: record.role || "",
      status: record.status || "active"
    });
    setIsEditDialogOpen(true);
  }, []);

  const openViewDialog = useCallback((record: UserRecord) => {
    setViewingRecord(record);
    setIsViewDialogOpen(true);
  }, []);

  const openAddDialog = useCallback(() => {
    setAddForm({
      name: "",
      email: "",
      role: "user",
     
      password: "",
      confirmPassword: ""
    });
    setIsAddDialogOpen(true);
  }, []);

  const handleEditSubmit = useCallback(async () => {
    if (!editingRecord) return;

    try {
      const recordRef = doc(db, "users", editingRecord.id);
      const updateData = {
        name: editForm.name,
        email: editForm.email,
        role: editForm.role,
       
        status: editForm.status,
        updatedAt: new Date()
      };

      await updateDoc(recordRef, updateData);

      toast({
        title: "Success",
        description: "User updated successfully",
      });

      setIsEditDialogOpen(false);
      setEditingRecord(null);
      fetchAllData();
    } catch (error) {
      console.error("Error updating user:", error);
      toast({
        title: "Error",
        description: "Failed to update user",
        variant: "destructive",
      });
    }
  }, [editingRecord, editForm, fetchAllData, toast]);

  const handleAddUser = useCallback(async () => {
    if (addForm.password !== addForm.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (addForm.password.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    try {
      setAddLoading(true);

      // Create user in Firebase Auth (you'll need to implement this)
      // For now, we'll just add to Firestore
      const userData = {
        name: addForm.name,
        email: addForm.email,
        role: addForm.role,
        
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await addDoc(collection(db, "users"), userData);

      toast({
        title: "Success",
        description: "User created successfully",
      });

      setIsAddDialogOpen(false);
      fetchAllData();
    } catch (error) {
      console.error("Error creating user:", error);
      toast({
        title: "Error",
        description: "Failed to create user",
        variant: "destructive",
      });
    } finally {
      setAddLoading(false);
    }
  }, [addForm, fetchAllData, toast]);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedRecords.length === 0) return;

    try {
      setDeleteLoading(true);
      const batch = writeBatch(db);

      selectedRecords.forEach(recordId => {
        const docRef = doc(db, "users", recordId);
        batch.delete(docRef);
      });

      await batch.commit();

      toast({
        title: "Success",
        description: `Deleted ${selectedRecords.length} users successfully`,
      });

      setSelectedRecords([]);
      fetchAllData();
    } catch (error) {
      console.error("Error deleting users:", error);
      toast({
        title: "Error",
        description: "Failed to delete users",
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(false);
    }
  }, [selectedRecords, fetchAllData, toast]);

  const handleDeleteSingle = useCallback(async (recordId: string) => {
    try {
      setDeleteLoading(true);
      const batch = writeBatch(db);
      const docRef = doc(db, "users", recordId);
      batch.delete(docRef);
      await batch.commit();

      toast({
        title: "Success",
        description: "User deleted successfully",
      });

      setSelectedRecords([]);
      fetchAllData();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(false);
    }
  }, [fetchAllData, toast]);

  const uniqueRoles = useMemo(() =>
    ["chief-admin", "admin", "user", "android"],
    []
  );

  const uniqueStatuses = useMemo(() => 
    ["active", "inactive"],
    []
  );

  const currentPageRecords = useMemo(getCurrentPageRecords, [getCurrentPageRecords]);

  const clearAllFilters = useCallback(() => {
    setSearchValue("");
    setFilters({
      role: "all",
      status: "all",
      startDate: "",
      endDate: "",
    
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);

  const resetToCurrentMonth = useCallback(() => {
    setFilters(prev => ({ ...prev, ...currentMonth }));
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [currentMonth]);

  // Render components
  const StatsCard = useCallback(({ title, value, icon: Icon, description, children }: any) => (
    <Card className="bg-white text-slate-900 shadow-lg border border-gray-200 relative overflow-hidden">
      {/* Left accent border */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-purple-600"></div>
      
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 pl-6">
        <CardTitle className="text-sm font-medium text-slate-700">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pl-6 pb-4 flex flex-row">
        <div className="mr-2 rounded-full">
          <Icon className="h-8 w-8 text-blue-600" />
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-900 mb-2">{value}</div>
          {children}
          {description && (
            <p className="text-xs text-slate-600 mt-2 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
              {description}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  ), []);

  const FilterSection = useMemo(() => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
      <div className="space-y-2">
        <Label htmlFor="search" className="font-semibold text-gray-700">Search</Label>
        <Input
          id="search"
          placeholder="Search users..."
          value={searchValue}
          onChange={(e) => handleSearch(e.target.value)}
          className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-white"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="role" className="font-semibold text-gray-700">Role</Label>
        <Select value={filters.role} onValueChange={(value) => handleFilterChange("role", value)}>
          <SelectTrigger className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-white">
            <SelectValue placeholder="Select role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {uniqueRoles.map(role => (
              <SelectItem key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="status" className="font-semibold text-gray-700">Status</Label>
        <Select value={filters.status} onValueChange={(value) => handleFilterChange("status", value)}>
          <SelectTrigger className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-white">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {uniqueStatuses.map(status => (
              <SelectItem key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

    

      <div className="space-y-2">
        <Label htmlFor="startDate" className="font-semibold text-gray-700">From Date</Label>
        <Input
          id="startDate"
          type="date"
          value={filters.startDate}
          onChange={(e) => handleFilterChange("startDate", e.target.value)}
          className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-white"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="endDate" className="font-semibold text-gray-700">To Date</Label>
        <Input
          id="endDate"
          type="date"
          value={filters.endDate}
          onChange={(e) => handleFilterChange("endDate", e.target.value)}
          className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-white"
        />
      </div>
    </div>
  ), [searchValue, filters, uniqueRoles, uniqueStatuses,handleSearch, handleFilterChange]);

  const TableRow = useCallback(({ record }: { record: UserRecord }) => (
    <tr className="border-b hover:bg-blue-50 transition-all duration-200 group text-sm">
      <td className="py-2 px-4 ml-2">
        <Checkbox
          checked={selectedRecords.includes(record.id)}
          onCheckedChange={() => handleSelectRecord(record.id)}
        />
      </td>
      <td className="py-2 px-4 text-sm">{record.name || 'N/A'}</td>
      <td className="py-2 px-4 text-sm">{record.email || 'N/A'}</td>
      <td className="py-2 px-4 text-sm">
        <Badge 
          variant="secondary"
          className={
            record.role === 'chief-admin' ? 'bg-purple-100 text-purple-800' :
            record.role === 'admin' ? 'bg-blue-100 text-blue-800' :
            record.role === 'android' ? 'bg-green-100 text-green-800' :
            'bg-gray-100 text-gray-800'
          }
        >
          {record.role || 'N/A'}
        </Badge>
      </td>
    
      <td className="py-2 px-4 text-sm">
        <Badge 
          variant={record.status === 'active' ? 'default' : 'secondary'}
          className={record.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
        >
          {record.status || 'N/A'}
        </Badge>
      </td>
      <td className="py-2 px-4 text-sm">{formatDate(record.createdAt)}</td>
      <td className="py-2 px-4 text-sm">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openViewDialog(record)}
            className="h-6 w-6 p-0 hover:bg-green-50 hover:text-green-600 border-green-200"
          >
            <Eye className="h-3 w-3 text-green-500" />
          </Button>
          {userRole === "chief-admin" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openEditDialog(record)}
                className="h-6 w-6 p-0 hover:bg-orange-50 hover:text-blue-600 border-gray-200"
              >
                <Edit className="h-3 w-3 text-orange-400" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDeleteSingle(record.id)}
                className="h-6 w-6 p-0 hover:bg-red-50 hover:text-red-600 border-red-200"
              >
                <Trash2 className="h-3 w-3 text-red-500" />
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  ), [selectedRecords, handleSelectRecord, openViewDialog, openEditDialog, userRole, handleDeleteSingle]);

  return (
    <div className="space-y-6">
      {/* Header with Action Buttons */}
      <div className="flex md:flex-row flex-col justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-md font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            User Management
          </h2>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={clearAllFilters}
            className="text-xs border-gray-300 hover:bg-gray-50"
          >
            Clear All Filters
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={resetToCurrentMonth}
            className="text-xs border-gray-300 hover:bg-gray-50"
          >
            This Month
          </Button>
          {userRole === "chief-admin" && (
            <Button 
              onClick={openAddDialog}
              className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white shadow-md text-xs"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          )}
          <Button 
            onClick={handleExport} 
            disabled={exportLoading || filteredRecords.length === 0}
            className="bg-gradient-to-r from-blue-800 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-md text-xs"
          >
            <Download className="h-4 w-4 mr-2" />
            {exportLoading ? "Exporting..." : `Export (${filteredRecords.length})`}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard 
          title="Total Users" 
          value={stats.totalUsers} 
          icon={Users}
        >
          <div className="flex gap-4 justify-between text-xs text-slate-600 mt-2">
            <span>Active: {stats.activeUsers}</span>
            <span>Inactive: {stats.totalUsers - stats.activeUsers}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-600 mt-1">
            <span>{(stats.activeUsers > 0 ? (stats.activeUsers / stats.totalUsers * 100).toFixed(1) : '0')}%</span>
            <span>{((stats.totalUsers - stats.activeUsers) > 0 ? ((stats.totalUsers - stats.activeUsers) / stats.totalUsers * 100).toFixed(1) : '0')}%</span>
          </div>
        </StatsCard>

        <StatsCard 
          title="Admin Users" 
          value={stats.adminUsers} 
          icon={Shield}
          description="Administrative users"
        />

        <StatsCard 
          title="Chief Admins" 
          value={stats.chiefAdminUsers} 
          icon={User}
          description="Chief administrators"
        />

        <StatsCard 
          title="Android Users" 
          value={stats.androidUsers} 
          icon={Phone}
          description="Mobile app users"
        />
      </div>

      {/* Filters Section */}
      <Card className="shadow-lg border-0 bg-white">
        <CardContent className="space-y-4 pt-6">
          {FilterSection}
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card className="shadow-lg border-0 bg-white">
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-muted-foreground mt-2">Loading users...</p>
            </div>
          ) : currentPageRecords.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {allRecords.length === 0 ? "No users found" : "No users found matching your criteria"}
            </div>
          ) : (
            <>
              <div className="w-full overflow-x-auto rounded-md">
                <table className="w-full border-collapse border border-gray-300 text-sm text-left whitespace-nowrap">
                  <thead className="rounded">
                    <tr className="bg-blue-100 p-1 px-3">
                      <th className="py-2 px-4 ml-2">
                        <Checkbox
                          checked={selectedRecords.length === currentPageRecords.length && currentPageRecords.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </th>
                      <th className="text-left py-2 px-4 font-medium text-gray-600">Name</th>
                      <th className="text-left py-2 px-4 font-medium text-gray-600">Email</th>
                      <th className="text-left py-2 px-4 font-medium text-gray-600">Role</th>
                     
                      <th className="text-left py-2 px-4 font-medium text-gray-600">Status</th>
                      <th className="text-left py-2 px-4 font-medium text-gray-600">Created</th>
                      <th className="text-left py-2 px-4 font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentPageRecords.map((record) => (
                      <TableRow key={record.id} record={record} />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between p-4 border-t bg-gray-50">
                <div className="text-sm text-muted-foreground">
                  {filteredRecords.length} total users • {currentPageRecords.length} on this page
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!pagination.hasPrev}
                    onClick={() => handlePageChange(pagination.page - 1)}
                    className="border-gray-300 hover:bg-gray-100"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!pagination.hasNext}
                    onClick={() => handlePageChange(pagination.page + 1)}
                    className="border-gray-300 hover:bg-gray-100"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* View User Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-2xl bg-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Eye className="h-5 w-5 text-green-600" />
              User Details
            </DialogTitle>
            <DialogDescription>
              Complete information for this user
            </DialogDescription>
          </DialogHeader>
          {viewingRecord && (
            <div className="space-y-6 py-4 max-h-[70vh] overflow-y-auto">
              {/* Personal Information */}
              <div className="bg-slate-50 rounded-xl p-4">
                <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Personal Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Name</Label>
                    <p className="text-slate-900 font-medium">{viewingRecord.name || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Email</Label>
                    <p className="text-slate-900 font-medium">{viewingRecord.email || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Role</Label>
                    <p className="text-slate-900 font-medium">
                      <Badge 
                        variant="secondary"
                        className={
                          viewingRecord.role === 'chief-admin' ? 'bg-purple-100 text-purple-800' :
                          viewingRecord.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                          viewingRecord.role === 'android' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }
                      >
                        {viewingRecord.role || 'N/A'}
                      </Badge>
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Status</Label>
                    <p className="text-slate-900 font-medium">
                      <Badge 
                        variant={viewingRecord.status === 'active' ? 'default' : 'secondary'}
                        className={viewingRecord.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                      >
                        {viewingRecord.status || 'N/A'}
                      </Badge>
                    </p>
                  </div>
                </div>
              </div>

              

              {/* Account Information */}
              <div className="bg-slate-50 rounded-xl p-4">
                <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Account Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Created At</Label>
                    <p className="text-slate-900 font-medium">{formatDate(viewingRecord.createdAt)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Last Login</Label>
                    <p className="text-slate-900 font-medium">{formatDate(viewingRecord.lastLogin)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button 
              onClick={() => setIsViewDialogOpen(false)}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add User Dialog */}
      {userRole === "chief-admin" && (
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="sm:max-w-md bg-white rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-slate-900">
                <Plus className="h-5 w-5 text-green-600" />
                Add New User
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-name" className="text-sm font-medium text-slate-700">Name *</Label>
                  <Input
                    id="add-name"
                    value={addForm.name}
                    onChange={(e) => setAddForm(prev => ({ ...prev, name: e.target.value }))}
                    className="bg-white border-slate-300"
                    placeholder="Enter full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-email" className="text-sm font-medium text-slate-700">Email *</Label>
                  <Input
                    id="add-email"
                    type="email"
                    value={addForm.email}
                    onChange={(e) => setAddForm(prev => ({ ...prev, email: e.target.value }))}
                    className="bg-white border-slate-300"
                    placeholder="Enter email address"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-role" className="text-sm font-medium text-slate-700">Role *</Label>
                  <Select value={addForm.role} onValueChange={(value) => setAddForm(prev => ({ ...prev, role: value }))}>
                    <SelectTrigger className="bg-white border-slate-300">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="chief-admin">Chief Admin</SelectItem>
                      <SelectItem value="android">Android User</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
               
              </div>

             

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-password" className="text-sm font-medium text-slate-700">Password *</Label>
                  <Input
                    id="add-password"
                    type="password"
                    value={addForm.password}
                    onChange={(e) => setAddForm(prev => ({ ...prev, password: e.target.value }))}
                    className="bg-white border-slate-300"
                    placeholder="Enter password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-confirm-password" className="text-sm font-medium text-slate-700">Confirm Password *</Label>
                  <Input
                    id="add-confirm-password"
                    type="password"
                    value={addForm.confirmPassword}
                    onChange={(e) => setAddForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    className="bg-white border-slate-300"
                    placeholder="Confirm password"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="border-slate-300">
                Cancel
              </Button>
              <Button 
                onClick={handleAddUser} 
                disabled={addLoading}
                className="bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 text-white"
              >
                {addLoading ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Dialog */}
      {userRole === "chief-admin" && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-md bg-white rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-slate-900">
                <Edit className="h-5 w-5 text-blue-600" />
                Edit User
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name" className="text-sm font-medium text-slate-700">Name</Label>
                  <Input
                    id="edit-name"
                    value={editForm.name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    className="bg-white border-slate-300"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email" className="text-sm font-medium text-slate-700">Email</Label>
                  <Input
                    id="edit-email"
                    value={editForm.email}
                    onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                    className="bg-white border-slate-300"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-role" className="text-sm font-medium text-slate-700">Role</Label>
                  <Select value={editForm.role} onValueChange={(value) => setEditForm(prev => ({ ...prev, role: value }))}>
                    <SelectTrigger className="bg-white border-slate-300">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="chief-admin">Chief Admin</SelectItem>
                      <SelectItem value="android">Android User</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-status" className="text-sm font-medium text-slate-700">Status</Label>
                  <Select value={editForm.status} onValueChange={(value) => setEditForm(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger className="bg-white border-slate-300">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
               
               
              </div>

              
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="border-slate-300">
                Cancel
              </Button>
              <Button onClick={handleEditSubmit} className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white">
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
};

export default UserManagementPage;