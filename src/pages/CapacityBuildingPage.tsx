import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { collection, getDocs, query, updateDoc, doc, deleteDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Download, Users, BookOpen, Edit, Trash2, Calendar, Eye, X, MapPin, GraduationCap, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isChiefAdmin } from "./onboardingpage";
import { uploadDataWithValidation, formatValidationErrors, UploadResult } from "@/lib/uploads-util";

// Types
interface TrainingRecord {
  id: string;
  Gender?: string;
  Location?: string;
  Modules?: string;
  Name?: string;
  Phone?: string;
  date?: any;
  region?: string;
  timestamp?: any;
}

interface Filters {
  search: string;
  gender: string;
  startDate: string;
  endDate: string;
  modules: string;
  region: string;
}

interface Stats {
  totalRecords: number;
  maleParticipants: number;
  femaleParticipants: number;
  totalModules: number;
}

interface Pagination {
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface EditForm {
  Name: string;
  Gender: string;
  Phone: string;
  Location: string;
  Modules: string;
  region: string;
  date: string;
}

// Constants
const PAGE_LIMIT = 15;
const EXPORT_HEADERS = [
  'Date', 'Name', 'Gender', 'Phone', 'Location', 'Region', 'Modules', 'Timestamp'
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

const CapacityBuildingPage = () => {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const [allRecords, setAllRecords] = useState<TrainingRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<TrainingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [viewingRecord, setViewingRecord] = useState<TrainingRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<TrainingRecord | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  
  const userIsChiefAdmin = useMemo(() => {
    return isChiefAdmin(userRole);
  }, [userRole]);
  
  const currentMonth = useMemo(getCurrentMonthDates, []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Separate search state with debouncing
  const [searchValue, setSearchValue] = useState("");
  const debouncedSearch = useDebounce(searchValue, 300);

  const [filters, setFilters] = useState<Omit<Filters, 'search'>>({
    gender: "all",
    startDate: currentMonth.startDate,
    endDate: currentMonth.endDate,
    modules: "all",
    region: "all"
  });

  const [stats, setStats] = useState<Stats>({
    totalRecords: 0,
    maleParticipants: 0,
    femaleParticipants: 0,
    totalModules: 0
  });

  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: PAGE_LIMIT,
    totalPages: 1,
    hasNext: false,
    hasPrev: false
  });

  const [editForm, setEditForm] = useState<EditForm>({
    Name: "",
    Gender: "",
    Phone: "",
    Location: "",
    Modules: "",
    region: "",
    date: ""
  });

  // Data fetching
  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      const q = query(collection(db, "Capacity Building"));
      const snapshot = await getDocs(q);
      
      const recordsData = snapshot.docs.map(doc => {
        const data = doc.data();
        
        return {
          id: doc.id,
          // Use exact field names from your database
          Gender: data.Gender || "",
          Location: data.Location || "",
          Modules: data.Modules || "",
          Name: data.Name || "",
          Phone: data.Phone || "",
          date: data.date || "",
          region: data.region || "",
          timestamp: data.timestamp || ""
        };
      });

      setAllRecords(recordsData);
      
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to load training records from database",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // File upload handlers
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadFile(file);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) {
      toast({
        title: "No File Selected",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploadLoading(true);
      
      const result: UploadResult = await uploadDataWithValidation(uploadFile, 'Capacity Building');

      if (result.success) {
        toast({
          title: "Upload Successful",
          description: result.message,
        });
        
        // Refresh data
        fetchAllData();
      } else {
        // Show detailed validation errors
        let errorMessage = result.message;
        
        if (result.validationErrors && result.validationErrors.length > 0) {
          errorMessage += '\n\n' + formatValidationErrors(result.validationErrors);
          
          toast({
            title: "Data Schema Mismatch",
            description: (
              <div className="max-h-60 overflow-y-auto">
                <p className="font-semibold mb-2">Please update your data to match the database schema:</p>
                <pre className="text-sm whitespace-pre-wrap">{errorMessage}</pre>
              </div>
            ),
            variant: "destructive",
            duration: 10000, // Show for longer
          });
        } else {
          toast({
            title: "Upload Failed",
            description: result.message,
            variant: "destructive",
          });
        }
      }

      // Reset file input
      setUploadFile(null);
      setIsUploadDialogOpen(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Upload Failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setUploadLoading(false);
    }
  };

  // Delete multiple records
  const handleDeleteMultiple = async () => {
    if (selectedRecords.length === 0) {
      toast({
        title: "No Records Selected",
        description: "Please select records to delete",
        variant: "destructive",
      });
      return;
    }

    try {
      setDeleteLoading(true);
      const batch = writeBatch(db);

      selectedRecords.forEach(recordId => {
        const docRef = doc(db, "Capacity Building", recordId);
        batch.delete(docRef);
      });

      await batch.commit();

      toast({
        title: "Success",
        description: `Deleted ${selectedRecords.length} records successfully`,
      });

      setSelectedRecords([]);
      setIsDeleteConfirmOpen(false);
      fetchAllData();
    } catch (error) {
      console.error("Error deleting records:", error);
      toast({
        title: "Error",
        description: "Failed to delete records",
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const openDeleteConfirm = () => {
    if (selectedRecords.length === 0) {
      toast({
        title: "No Records Selected",
        description: "Please select records to delete",
        variant: "destructive",
      });
      return;
    }
    setIsDeleteConfirmOpen(true);
  };

  // Delete single record
  const handleDeleteSingle = useCallback(async (recordId: string) => {
    try {
      await deleteDoc(doc(db, "Capacity Building", recordId));

      toast({
        title: "Success",
        description: "Record deleted successfully",
      });

      // Remove from selected records if it was selected
      setSelectedRecords(prev => prev.filter(id => id !== recordId));
      fetchAllData();
    } catch (error) {
      console.error("Error deleting record:", error);
      toast({
        title: "Error",
        description: "Failed to delete record",
        variant: "destructive",
      });
    }
  }, [fetchAllData, toast]);

  // Main filtering logic - completely separated from state updates
  const filterAndProcessData = useCallback((records: TrainingRecord[], searchTerm: string, filterParams: Omit<Filters, 'search'>) => {
    const filtered = records.filter(record => {
      // Gender filter
      if (filterParams.gender !== "all" && record.Gender?.toLowerCase() !== filterParams.gender.toLowerCase()) {
        return false;
      }

      // Region filter
      if (filterParams.region !== "all" && record.region?.toLowerCase() !== filterParams.region.toLowerCase()) {
        return false;
      }

      // Modules filter
      if (filterParams.modules !== "all" && record.Modules?.toLowerCase() !== filterParams.modules.toLowerCase()) {
        return false;
      }

      // Date filter
      if (filterParams.startDate || filterParams.endDate) {
        const recordDate = parseDate(record.date) || parseDate(record.timestamp);
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

      // Search filter - only apply if search term exists
      if (searchTerm) {
        const searchTermLower = searchTerm.toLowerCase();
        const searchMatch = [
          record.Name, record.Gender, record.Phone, record.Location, 
          record.region, record.Modules
        ].some(field => field?.toLowerCase().includes(searchTermLower));
        if (!searchMatch) return false;
      }

      return true;
    });

    // Calculate stats
    const maleParticipants = filtered.filter(r => r.Gender?.toLowerCase() === 'male').length;
    const femaleParticipants = filtered.filter(r => r.Gender?.toLowerCase() === 'female').length;
    const totalModules = new Set(filtered.map(r => r.Modules).filter(Boolean)).size;

    const calculatedStats = {
      totalRecords: filtered.length,
      maleParticipants,
      femaleParticipants,
      totalModules
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
    
    // Update pagination - FIXED: Ensure hasPrev is calculated correctly
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

  // Search handler - only updates the search state
  const handleSearch = useCallback((value: string) => {
    setSearchValue(value);
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);

  // Filter change handler
  const handleFilterChange = useCallback((key: keyof Omit<Filters, 'search'>, value: string) => {
    setFilters(prev => ({ 
      ...prev, 
      [key]: value,
      // Reset location when region changes
      ...(key === 'region' && value !== 'all' ? { location: 'all' } : {})
    }));
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);

  const handleExport = useCallback(async () => {
    try {
      setExportLoading(true);
      
      if (filteredRecords.length === 0) {
        toast({
          title: "No Data to Export",
          description: "There are no records matching your current filters",
          variant: "destructive",
        });
        return;
      }

      const csvData = filteredRecords.map(record => [
        formatDate(record.date || record.timestamp),
        record.Name || 'N/A',
        record.Gender || 'N/A',
        record.Phone || 'N/A',
        record.Location || 'N/A',
        record.region || 'N/A',
        record.Modules || 'N/A',
        formatDate(record.timestamp)
      ]);

      const csvContent = [EXPORT_HEADERS, ...csvData]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      let filename = `capacity-building`;
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
        description: `Exported ${filteredRecords.length} records with applied filters`,
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

  // FIXED: Improved page change handler
  const handlePageChange = useCallback((newPage: number) => {
    setPagination(prev => {
      const totalPages = Math.ceil(filteredRecords.length / prev.limit);
      return {
        ...prev,
        page: newPage,
        hasNext: newPage < totalPages,
        hasPrev: newPage > 1
      };
    });
  }, [filteredRecords.length]);

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

  const openEditDialog = useCallback((record: TrainingRecord) => {
    setEditingRecord(record);
    setEditForm({
      Name: record.Name || "",
      Gender: record.Gender || "",
      Phone: record.Phone || "",
      Location: record.Location || "",
      Modules: record.Modules || "",
      region: record.region || "",
      date: record.date ? (parseDate(record.date)?.toISOString().split('T')[0] || "") : ""
    });
    setIsEditDialogOpen(true);
  }, []);

  const openViewDialog = useCallback((record: TrainingRecord) => {
    setViewingRecord(record);
    setIsViewDialogOpen(true);
  }, []);

  const handleEditSubmit = useCallback(async () => {
    if (!editingRecord) return;

    try {
      const recordRef = doc(db, "Capacity Building", editingRecord.id);
      const updateData = {
        Name: editForm.Name,
        Gender: editForm.Gender,
        Phone: editForm.Phone,
        Location: editForm.Location,
        Modules: editForm.Modules,
        region: editForm.region,
        date: editForm.date ? new Date(editForm.date) : null
      };

      await updateDoc(recordRef, updateData);

      toast({
        title: "Success",
        description: "Training record updated successfully",
      });

      setIsEditDialogOpen(false);
      setEditingRecord(null);
      fetchAllData();
    } catch (error) {
      console.error("Error updating training record:", error);
      toast({
        title: "Error",
        description: "Failed to update training record",
        variant: "destructive",
      });
    }
  }, [editingRecord, editForm, fetchAllData, toast]);

  // Memoized values
  const uniqueRegions = useMemo(() => 
    [...new Set(allRecords.map(r => r.region).filter(Boolean))],
    [allRecords]
  );

  const uniqueLocations = useMemo(() => {
    if (filters.region === "all") {
      return [...new Set(allRecords.map(r => r.Location).filter(Boolean))];
    } else {
      return [...new Set(
        allRecords
          .filter(r => r.region?.toLowerCase() === filters.region.toLowerCase())
          .map(r => r.Location)
          .filter(Boolean)
      )];
    }
  }, [allRecords, filters.region]);

  const uniqueModules = useMemo(() => 
    [...new Set(allRecords.map(r => r.Modules).filter(Boolean))],
    [allRecords]
  );

  const uniqueGenders = useMemo(() => 
    [...new Set(allRecords.map(r => r.Gender).filter(Boolean))],
    [allRecords]
  );

  const currentPageRecords = useMemo(getCurrentPageRecords, [getCurrentPageRecords]);

  const clearAllFilters = useCallback(() => {
    setSearchValue("");
    setFilters({
      gender: "all",
      startDate: "",
      endDate: "",
      modules: "all",
      region: "all"
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);

  const resetToCurrentMonth = useCallback(() => {
    setFilters(prev => ({ ...prev, ...currentMonth }));
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [currentMonth]);

  // FIXED: Ensure pagination buttons are always correctly enabled/disabled
  const paginationState = useMemo(() => {
    const totalPages = Math.ceil(filteredRecords.length / PAGE_LIMIT);
    return {
      hasNext: pagination.page < totalPages,
      hasPrev: pagination.page > 1,
      totalPages
    };
  }, [filteredRecords.length, pagination.page]);

  // Render components
  const StatsCard = useCallback(({ title, value, icon: Icon, description, children }: any) => (
    <Card className="bg-white text-slate-900 shadow-lg border border-gray-200 relative overflow-hidden">
      {/* Left accent border */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-purple-600"></div>
      
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 pl-6">
        <CardTitle className="text-sm font-medium text-gray-500">{title}</CardTitle>
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
          placeholder="Search records..."
          value={searchValue}
          onChange={(e) => handleSearch(e.target.value)}
          className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-white"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="gender" className="font-semibold text-gray-700">Gender</Label>
        <Select value={filters.gender} onValueChange={(value) => handleFilterChange("gender", value)}>
          <SelectTrigger className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-white">
            <SelectValue placeholder="Select gender" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Genders</SelectItem>
            {uniqueGenders.map(gender => (
              <SelectItem key={gender} value={gender.toLowerCase()}>{gender}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="region" className="font-semibold text-gray-700">Region</Label>
        <Select value={filters.region} onValueChange={(value) => handleFilterChange("region", value)}>
          <SelectTrigger className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-white">
            <SelectValue placeholder="Select region" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Regions</SelectItem>
            {uniqueRegions.slice(0, 20).map(region => (
              <SelectItem key={region} value={region}>{region}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="modules" className="font-semibold text-gray-700">Modules</Label>
        <Select value={filters.modules} onValueChange={(value) => handleFilterChange("modules", value)}>
          <SelectTrigger className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-white">
            <SelectValue placeholder="Select modules" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modules</SelectItem>
            {uniqueModules.slice(0, 10).map(module => (
              <SelectItem key={module} value={module}>{module}</SelectItem>
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
  ), [searchValue, filters, uniqueGenders, uniqueRegions, uniqueLocations, uniqueModules, handleSearch, handleFilterChange]);

  const TableRow = useCallback(({ record }: { record: TrainingRecord }) => (
    <tr className="border-b hover:bg-blue-50 transition-all duration-200 group text-sm">
      <td className="py-2 px-4 ml-2">
        <Checkbox
          checked={selectedRecords.includes(record.id)}
          onCheckedChange={() => handleSelectRecord(record.id)}
        />
      </td>
      <td className="py-2 px-4 text-sm">{formatDate(record.date || record.timestamp)}</td>
      <td className="py-2 px-4 text-sm">{record.Name || 'N/A'}</td>
      <td className="py-2 px-4 text-sm">{record.Gender || 'N/A'}</td>
      <td className="py-2 px-4 text-sm text-gray-600">{record.Phone || 'N/A'}</td>
      <td className="py-2 px-4 text-sm">{record.Location || 'N/A'}</td>
      <td className="py-2 px-4 text-sm">{record.region || 'N/A'}</td>
      <td className="py-2 px-4 text-sm">{record.Modules || 'N/A'}</td>
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
          {userIsChiefAdmin && (
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
                className="h-5 w-5 p-0 hover:bg-red-50 hover:text-red-600 border-red-200"
              >
                <Trash2 className="h-3 w-3 text-red-500" />
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  ), [selectedRecords, handleSelectRecord, openViewDialog, openEditDialog, handleDeleteSingle, userIsChiefAdmin]);

  return (
    <div className="space-y-6">
      {/* Header with Action Buttons */}
      <div className="flex md:flex-row flex-col justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-md font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Capacity Building
          </h2>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Bulk Actions */}
          {selectedRecords.length > 0 && userIsChiefAdmin && (
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={openDeleteConfirm}
              disabled={deleteLoading}
              className="text-xs"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete ({selectedRecords.length})
            </Button>
          )}
          
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

          {userIsChiefAdmin && (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsUploadDialogOpen(true)}
                className="text-xs border-green-300 hover:bg-green-50 text-green-700"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Data
              </Button>
              <Button 
                onClick={handleExport} 
                disabled={exportLoading || filteredRecords.length === 0}
                className="bg-gradient-to-r from-blue-800 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-md text-xs"
              >
                <Download className="h-4 w-4 mr-2" />
                {exportLoading ? "Exporting..." : `Export (${filteredRecords.length})`}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard 
          title="TOTAL PARTICIPANTS" 
          value={stats.totalRecords} 
          icon={Users}
        >
          <div className="flex gap-4 justify-between text-xs text-slate-600 mt-2">
            <span>Male {(stats.maleParticipants > 0 ? (stats.maleParticipants / stats.totalRecords * 100).toFixed(1) : '0')}%</span>
            <span>Female {(stats.femaleParticipants > 0 ? (stats.femaleParticipants / stats.totalRecords * 100).toFixed(1) : '0')}%</span>
          </div>
        </StatsCard>

        <StatsCard 
          title="MALE FARMERS" 
          value={stats.maleParticipants} 
          icon={MapPin}
          description="Different training locations"
        />

        <StatsCard 
          title="FEMALE FARMERS" 
          value={stats.femaleParticipants} 
          icon={BookOpen}
          description="Different modules offered"
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
              <p className="text-muted-foreground mt-2">Loading training records...</p>
            </div>
          ) : currentPageRecords.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {allRecords.length === 0 ? "No training records found" : "No records found matching your criteria"}
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
                      <th className="text-left py-2 px-4 font-medium text-gray-600">Date</th>
                      <th className="text-left py-2 px-4 font-medium text-gray-600">Name</th>
                      <th className="text-left py-2 px-4 font-medium text-gray-600">Gender</th>
                      <th className="text-left py-2 px-4 font-medium text-gray-600">Phone</th>
                      <th className="text-left py-2 px-4 font-medium text-gray-600">Location</th>
                      <th className="text-left py-2 px-4 font-medium text-gray-600">Region</th>
                      <th className="text-left py-2 px-4 font-medium text-gray-600">Modules</th>
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

              {/* Pagination - FIXED: Using the correct pagination state */}
              <div className="flex items-center justify-between p-4 border-t bg-gray-50">
                <div className="text-sm text-muted-foreground">
                  {filteredRecords.length} total records • Page {pagination.page} of {paginationState.totalPages} • {currentPageRecords.length} on this page
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!paginationState.hasPrev}
                    onClick={() => handlePageChange(pagination.page - 1)}
                    className="border-gray-300 hover:bg-gray-100"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!paginationState.hasNext}
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

      {/* Upload Data Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Upload className="h-5 w-5 text-green-600" />
              Upload Capacity Building Data
            </DialogTitle>
            <DialogDescription>
              Upload data from CSV or JSON files. The file should contain training records.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="file-upload">Select File</Label>
              <Input
                id="file-upload"
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
                onChange={handleFileSelect}
                className="bg-white border-slate-300"
              />
              <p className="text-xs text-slate-500">
                Supported formats: CSV, JSON. Maximum file size: 10MB
              </p>
            </div>
            
            {uploadFile && (
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{uploadFile.name}</p>
                    <p className="text-sm text-slate-500">
                      {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setUploadFile(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsUploadDialogOpen(false);
                setUploadFile(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }}
              className="border-slate-300"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUpload} 
              disabled={!uploadFile || uploadLoading}
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
            >
              {uploadLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Data
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Trash2 className="h-5 w-5 text-red-600" />
              Confirm Deletion
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedRecords.length} selected records? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteConfirmOpen(false)}
              className="border-slate-300"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteMultiple}
              disabled={deleteLoading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete {selectedRecords.length} Records
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Record Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-2xl bg-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Eye className="h-5 w-5 text-green-600" />
              Participant Details
            </DialogTitle>
            <DialogDescription>
              Complete information for this training participant
            </DialogDescription>
          </DialogHeader>
          {viewingRecord && (
            <div className="space-y-6 py-4 max-h-[70vh] overflow-y-auto">
              {/* Personal Information */}
              <div className="bg-slate-50 rounded-xl p-4">
                <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Personal Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Name</Label>
                    <p className="text-slate-900 font-medium">{viewingRecord.Name || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Gender</Label>
                    <p className="text-slate-900 font-medium">{viewingRecord.Gender || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Phone</Label>
                    <p className="text-slate-900 font-medium">{viewingRecord.Phone || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Training Date</Label>
                    <p className="text-slate-900 font-medium">{formatDate(viewingRecord.date || viewingRecord.timestamp)}</p>
                  </div>
                </div>
              </div>

              {/* Location Information */}
              <div className="bg-slate-50 rounded-xl p-4">
                <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Location Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Location</Label>
                    <p className="text-slate-900 font-medium">{viewingRecord.Location || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Region</Label>
                    <p className="text-slate-900 font-medium">{viewingRecord.region || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Training Information */}
              <div className="bg-slate-50 rounded-xl p-4">
                <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  Training Information
                </h3>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-600">Training Modules</Label>
                  <p className="text-slate-900 font-medium">{viewingRecord.Modules || 'N/A'}</p>
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

      {/* Edit Dialog */}
      {userIsChiefAdmin && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-md bg-white rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-slate-900">
                <Edit className="h-5 w-5 text-blue-600" />
                Edit Participant Record
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name" className="text-sm font-medium text-slate-700">Name</Label>
                  <Input
                    id="edit-name"
                    value={editForm.Name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, Name: e.target.value }))}
                    className="bg-white border-slate-300"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-gender" className="text-sm font-medium text-slate-700">Gender</Label>
                  <Select value={editForm.Gender} onValueChange={(value) => setEditForm(prev => ({ ...prev, Gender: value }))}>
                    <SelectTrigger className="bg-white border-slate-300">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-phone" className="text-sm font-medium text-slate-700">Phone</Label>
                  <Input
                    id="edit-phone"
                    value={editForm.Phone}
                    onChange={(e) => setEditForm(prev => ({ ...prev, Phone: e.target.value }))}
                    className="bg-white border-slate-300"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-date" className="text-sm font-medium text-slate-700">Date</Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={editForm.date}
                    onChange={(e) => setEditForm(prev => ({ ...prev, date: e.target.value }))}
                    className="bg-white border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-location" className="text-sm font-medium text-slate-700">Location</Label>
                  <Input
                    id="edit-location"
                    value={editForm.Location}
                    onChange={(e) => setEditForm(prev => ({ ...prev, Location: e.target.value }))}
                    className="bg-white border-slate-300"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-region" className="text-sm font-medium text-slate-700">Region</Label>
                  <Input
                    id="edit-region"
                    value={editForm.region}
                    onChange={(e) => setEditForm(prev => ({ ...prev, region: e.target.value }))}
                    className="bg-white border-slate-300"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-modules" className="text-sm font-medium text-slate-700">Modules</Label>
                <Input
                  id="edit-modules"
                  value={editForm.Modules}
                  onChange={(e) => setEditForm(prev => ({ ...prev, Modules: e.target.value }))}
                  className="bg-white border-slate-300"
                />
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

export default CapacityBuildingPage;