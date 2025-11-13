import { useState, useEffect, useCallback, useMemo } from "react";
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
import { Download, Users, BookOpen, Edit, Trash2, Calendar, Eye, X, MapPin, GraduationCap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  location: string;
  modules: string;
  region: string;
}

interface Stats {
  totalRecords: number;
  maleParticipants: number;
  femaleParticipants: number;
  uniqueLocations: number;
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

const CapacityBuildingPage = () => {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const [allRecords, setAllRecords] = useState<TrainingRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<TrainingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingRecord, setViewingRecord] = useState<TrainingRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<TrainingRecord | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  const currentMonth = useMemo(getCurrentMonthDates, []);

  const [filters, setFilters] = useState<Filters>({
    search: "",
    gender: "all",
    startDate: currentMonth.startDate,
    endDate: currentMonth.endDate,
    location: "all",
    modules: "all",
    region: "all"
  });

  const [stats, setStats] = useState<Stats>({
    totalRecords: 0,
    maleParticipants: 0,
    femaleParticipants: 0,
    uniqueLocations: 0,
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

  // Filter application
  const applyFilters = useCallback(() => {
    if (allRecords.length === 0) return;

    let filtered = allRecords.filter(record => {
      // Gender filter
      if (filters.gender !== "all" && record.Gender?.toLowerCase() !== filters.gender.toLowerCase()) {
        return false;
      }

      // Region filter
      if (filters.region !== "all" && record.region?.toLowerCase() !== filters.region.toLowerCase()) {
        return false;
      }

      // Location filter (dependent on region)
      if (filters.location !== "all") {
        if (filters.region !== "all") {
          // If region is selected, location must match both region and location
          if (record.region?.toLowerCase() !== filters.region.toLowerCase() || 
              record.Location?.toLowerCase() !== filters.location.toLowerCase()) {
            return false;
          }
        } else {
          // If no region selected, just match location
          if (record.Location?.toLowerCase() !== filters.location.toLowerCase()) {
            return false;
          }
        }
      }

      // Modules filter
      if (filters.modules !== "all" && record.Modules?.toLowerCase() !== filters.modules.toLowerCase()) {
        return false;
      }

      // Date filter
      if (filters.startDate || filters.endDate) {
        const recordDate = parseDate(record.date) || parseDate(record.timestamp);
        if (recordDate) {
          const recordDateOnly = new Date(recordDate);
          recordDateOnly.setHours(0, 0, 0, 0);

          const startDate = filters.startDate ? new Date(filters.startDate) : null;
          const endDate = filters.endDate ? new Date(filters.endDate) : null;
          if (startDate) startDate.setHours(0, 0, 0, 0);
          if (endDate) endDate.setHours(23, 59, 59, 999);

          if (startDate && recordDateOnly < startDate) return false;
          if (endDate && recordDateOnly > endDate) return false;
        }
      }

      // Search filter
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        const searchMatch = [
          record.Name, record.Gender, record.Phone, record.Location, 
          record.region, record.Modules
        ].some(field => field?.toLowerCase().includes(searchTerm));
        if (!searchMatch) return false;
      }

      return true;
    });

    setFilteredRecords(filtered);
    
    // Update stats
    const maleParticipants = filtered.filter(r => r.Gender?.toLowerCase() === 'male').length;
    const femaleParticipants = filtered.filter(r => r.Gender?.toLowerCase() === 'female').length;
    const uniqueLocations = new Set(filtered.map(r => r.Location).filter(Boolean)).size;
    const totalModules = new Set(filtered.map(r => r.Modules).filter(Boolean)).size;

    setStats({
      totalRecords: filtered.length,
      maleParticipants,
      femaleParticipants,
      uniqueLocations,
      totalModules
    });

    // Update pagination
    const totalPages = Math.ceil(filtered.length / pagination.limit);
    setPagination(prev => ({
      ...prev,
      totalPages,
      hasNext: prev.page < totalPages,
      hasPrev: prev.page > 1
    }));
  }, [allRecords, filters, pagination.limit]);

  // Effects
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // Handlers
  const handleSearch = (value: string) => {
    setFilters(prev => ({ ...prev, search: value }));
  };

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters(prev => ({ 
      ...prev, 
      [key]: value,
      // Reset location when region changes
      ...(key === 'region' && value !== 'all' ? { location: 'all' } : {})
    }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleExport = async () => {
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
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const getCurrentPageRecords = useCallback(() => {
    const startIndex = (pagination.page - 1) * pagination.limit;
    const endIndex = startIndex + pagination.limit;
    return filteredRecords.slice(startIndex, endIndex);
  }, [filteredRecords, pagination.page, pagination.limit]);

  const handleSelectRecord = (recordId: string) => {
    setSelectedRecords(prev =>
      prev.includes(recordId)
        ? prev.filter(id => id !== recordId)
        : [...prev, recordId]
    );
  };

  const handleSelectAll = () => {
    const currentPageIds = getCurrentPageRecords().map(r => r.id);
    setSelectedRecords(prev =>
      prev.length === currentPageIds.length ? [] : currentPageIds
    );
  };

  const openEditDialog = (record: TrainingRecord) => {
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
  };

  const openViewDialog = (record: TrainingRecord) => {
    setViewingRecord(record);
    setIsViewDialogOpen(true);
  };

  const handleEditSubmit = async () => {
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
  };

  const handleDeleteSelected = async () => {
    if (selectedRecords.length === 0) return;

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

  const clearAllFilters = () => {
    setFilters({
      search: "",
      gender: "all",
      startDate: "",
      endDate: "",
      location: "all",
      modules: "all",
      region: "all"
    });
  };

  const resetToCurrentMonth = () => {
    setFilters(prev => ({ ...prev, ...currentMonth }));
  };

  // Render components
  const StatsCard = ({ title, value, icon: Icon, description, children }: any) => (
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
  );

  const FilterSection = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
      <div className="space-y-2">
        <Label htmlFor="search" className="font-semibold text-gray-700">Search</Label>
        <Input
          id="search"
          placeholder="Search records..."
          value={filters.search}
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
        <Label htmlFor="location" className="font-semibold text-gray-700">Location</Label>
        <Select 
          value={filters.location} 
          onValueChange={(value) => handleFilterChange("location", value)}
          disabled={filters.region !== "all" && uniqueLocations.length === 0}
        >
          <SelectTrigger className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-white">
            <SelectValue placeholder={
              filters.region !== "all" && uniqueLocations.length === 0 
                ? "No locations for this region" 
                : "Select location"
            } />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {uniqueLocations.slice(0, 20).map(location => (
              <SelectItem key={location} value={location}>{location}</SelectItem>
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
  );

  const TableRow = ({ record }: { record: TrainingRecord }) => (
    <tr className="border-b hover:bg-blue-50 transition-all duration-200 group text-sm">
      <td className="py-2 px-4 ml-2">
        <Checkbox
          checked={selectedRecords.includes(record.id)}
          onCheckedChange={() => handleSelectRecord(record.id)}
        />
      </td>
      <td className="py-2 px-4">{formatDate(record.date || record.timestamp)}</td>
      <td className="py-2 px-4 text-sm">{record.Name || 'N/A'}</td>
      <td className="py-2 px-4">{record.Gender || 'N/A'}</td>
      <td className="py-2 px-4 text-sm text-gray-600">{record.Phone || 'N/A'}</td>
      <td className="py-2 px-4">{record.Location || 'N/A'}</td>
      <td className="py-2 px-4">{record.region || 'N/A'}</td>
      <td className="py-2 px-4">{record.Modules || 'N/A'}</td>
      <td className="py-2 px-4">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openViewDialog(record)}
            className="h-5 w-5 p-0 hover:bg-green-50 hover:text-green-600 border-green-200"
          >
            <Eye className="h-3 w-3 text-green-500" />
          </Button>
          {userRole === "chief-admin" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openEditDialog(record)}
                className="h-5 w-5 p-0 hover:bg-blue-50 hover:text-blue-600 border-blue-200"
              >
                <Edit className="h-3 w-3 text-blue-500" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSelectRecord(record.id)}
                className="h-5 w-5 p-0 hover:bg-red-50 hover:text-red-600 border-red-200"
              >
                <Trash2 className="h-3 w-3 text-red-500" />
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  );

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard 
          title="Total Participants" 
          value={stats.totalRecords} 
          icon={Users}
        >
          <div className="flex gap-4 justify-between text-xs text-slate-600 mt-2">
            <span>Male: {stats.maleParticipants}</span>
            <span>Female: {stats.femaleParticipants}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-600 mt-1">
            <span>{(stats.maleParticipants > 0 ? (stats.maleParticipants / stats.totalRecords * 100).toFixed(1) : '0')}%</span>
            <span>{(stats.femaleParticipants > 0 ? (stats.femaleParticipants / stats.totalRecords * 100).toFixed(1) : '0')}%</span>
          </div>
        </StatsCard>

        <StatsCard 
          title="Training Locations" 
          value={stats.uniqueLocations} 
          icon={MapPin}
          description="Different training locations"
        />

        <StatsCard 
          title="Training Modules" 
          value={stats.totalModules} 
          icon={BookOpen}
          description="Different modules offered"
        />
      </div>

      {/* Filters Section */}
      <Card className="shadow-lg border-0 bg-white">
        <CardContent className="space-y-4 pt-6">
          <FilterSection />
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

              {/* Pagination */}
              <div className="flex items-center justify-between p-4 border-t bg-gray-50">
                <div className="text-sm text-muted-foreground">
                  {filteredRecords.length} total records • {currentPageRecords.length} on this page
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
      {userRole === "chief-admin" && (
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