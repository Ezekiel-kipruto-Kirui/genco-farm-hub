import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchData } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Download, Users, MapPin, Eye, Calendar, Sprout, Globe, LayoutGrid, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isChiefAdmin } from "./onboardingpage";

// Types
interface FodderFarmer {
  id: string;
  date: any;
  landSize?: number;
  location?: string;
  model?: string;
  region?: string;
  totalAcresPasture?: number;
  totalBales?: number;
  yieldPerHarvest?: number;
  farmers?: Farmer[];
}

interface Farmer {
  id: string;
  name?: string;
  phone?: string;
  gender?: string;
}

interface Filters {
  search: string;
  startDate: string;
  endDate: string;
  location: string;
  region: string;
  model: string;
}

interface Stats {
  totalFarmers: number;
  totalRegions: number;
  totalModels: number;
}

interface Pagination {
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Constants
const PAGE_LIMIT = 15;
const SEARCH_DEBOUNCE_DELAY = 300; // milliseconds

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
    } else if (date._seconds) {
      return new Date(date._seconds * 1000);
    }
  } catch (error) {
    console.error('Error parsing date:', error, date);
  }
  
  return null;
};

const formatDate = (date: any): string => {
  const parsedDate = parseDate(date);
  return parsedDate ? parsedDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }) : 'N/A';
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

const FodderFarmersPage = () => {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const [allFodder, setAllFodder] = useState<FodderFarmer[]>([]);
  const [filteredFodder, setFilteredFodder] = useState<FodderFarmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingRecord, setViewingRecord] = useState<FodderFarmer | null>(null);
  
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const currentMonth = useMemo(getCurrentMonthDates, []);

  const [filters, setFilters] = useState<Filters>({
    search: "",
    startDate: currentMonth.startDate,
    endDate: currentMonth.endDate,
    location: "all",
    region: "all",
    model: "all"
  });

  const [stats, setStats] = useState<Stats>({
    totalFarmers: 0,
    totalRegions: 0,
    totalModels: 0
  });

  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: PAGE_LIMIT,
    totalPages: 1,
    hasNext: false,
    hasPrev: false
  });

  const userIsChiefAdmin = useMemo(() => {
    return isChiefAdmin(userRole);
  }, [userRole]);

  // Data fetching
  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      console.log("Starting data fetch...");
      
      const data = await fetchData();
      console.log("Raw fetched data:", data);
      console.log("Fodder data structure:", data.fodder);

      if (!data.fodder) {
        console.warn("No fodder data found in response");
        setAllFodder([]);
        return;
      }

      const fodderData = Array.isArray(data.fodder) ? data.fodder.map((item: any, index: number) => {
        console.log(`Processing item ${index}:`, item);
        
        // Handle date parsing more robustly
        let dateValue = item.date || item.Date || item.createdAt || item.timestamp;
        
        // If it's a Firestore timestamp object
        if (dateValue && typeof dateValue === 'object') {
          if (dateValue.toDate && typeof dateValue.toDate === 'function') {
            dateValue = dateValue.toDate();
          } else if (dateValue.seconds) {
            dateValue = new Date(dateValue.seconds * 1000);
          } else if (dateValue._seconds) {
            dateValue = new Date(dateValue._seconds * 1000);
          }
        }

        // Handle different field name variations
        const processedItem = {
          id: item.id || `temp-${index}-${Date.now()}`,
          date: dateValue,
          landSize: Number(item.landSize || item.LandSize || 0),
          location: item.location || item.Location || item.area || item.Area || '',
          model: item.model || item.Model || '',
          region: item.region || item.Region || item.county || item.County || '',
          totalAcresPasture: Number(item.totalAcresPasture || item.TotalAcresPasture || 0),
          totalBales: Number(item.totalBales || item.TotalBales || 0),
          yieldPerHarvest: Number(item.yieldPerHarvest || item.YieldPerHarvest || 0),
          farmers: Array.isArray(item.farmers) ? item.farmers : []
        };

        console.log(`Processed item ${index}:`, processedItem);
        return processedItem;

      }) : [];

      console.log("Final processed data:", fodderData);
      setAllFodder(fodderData);
      
    } catch (error) {
      console.error("Error fetching fodder data:", error);
      toast({
        title: "Error",
        description: "Failed to load data from database",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Filter application - memoized to prevent unnecessary re-renders
  const applyFilters = useCallback(() => {
    if (allFodder.length === 0) {
      console.log("No data to filter");
      setFilteredFodder([]);
      setStats({
        totalFarmers: 0,
        totalRegions: 0,
        totalModels: 0
      });
      return;
    }

    console.log("Applying filters to", allFodder.length, "records");
    
    let filtered = allFodder.filter(record => {
      // Region filter
      if (filters.region !== "all" && record.region?.toLowerCase() !== filters.region.toLowerCase()) {
        return false;
      }

      // Location filter
      if (filters.location !== "all" && record.location?.toLowerCase() !== filters.location.toLowerCase()) {
        return false;
      }

      // Model filter
      if (filters.model !== "all" && record.model?.toLowerCase() !== filters.model.toLowerCase()) {
        return false;
      }

      // Date filter
      if (filters.startDate || filters.endDate) {
        const recordDate = parseDate(record.date);
        if (recordDate) {
          const recordDateOnly = new Date(recordDate);
          recordDateOnly.setHours(0, 0, 0, 0);

          const startDate = filters.startDate ? new Date(filters.startDate) : null;
          const endDate = filters.endDate ? new Date(filters.endDate) : null;
          if (startDate) startDate.setHours(0, 0, 0, 0);
          if (endDate) endDate.setHours(23, 59, 59, 999);

          if (startDate && recordDateOnly < startDate) return false;
          if (endDate && recordDateOnly > endDate) return false;
        } else if (filters.startDate || filters.endDate) {
          // If we have date filters but no valid date on record, exclude it
          return false;
        }
      }

      // Search filter
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        const searchMatch = [
          record.location, record.region, record.model
        ].some(field => field?.toLowerCase().includes(searchTerm));
        if (!searchMatch) return false;
      }

      return true;
    });

    console.log("Filtered to", filtered.length, "records");
    setFilteredFodder(filtered);
    
    // Update stats
    const totalFarmers = filtered.reduce((sum, record) => 
      sum + (record.farmers?.length || 0), 0);
    
    // Count unique regions and models from filtered data
    const uniqueRegions = new Set(filtered.map(f => f.region).filter(Boolean));
    const uniqueModels = new Set(filtered.map(f => f.model).filter(Boolean));

    console.log("Stats - Total Farmers:", totalFarmers, "Regions:", uniqueRegions.size, "Models:", uniqueModels.size);

    setStats({
      totalFarmers,
      totalRegions: uniqueRegions.size,
      totalModels: uniqueModels.size
    });

    // Update pagination - FIXED: Calculate hasPrev based on current page
    const totalPages = Math.ceil(filtered.length / pagination.limit);
    setPagination(prev => ({
      ...prev,
      totalPages,
      hasNext: prev.page < totalPages,
      hasPrev: prev.page > 1
    }));
  }, [allFodder, filters, pagination.limit]);

  // Effects
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // Optimized search handler with debouncing
  const handleSearch = useCallback((value: string) => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout
    searchTimeoutRef.current = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: value }));
      setPagination(prev => ({ ...prev, page: 1 }));
    }, SEARCH_DEBOUNCE_DELAY);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Filter change handler
  const handleFilterChange = useCallback((key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);

  const handleExport = async () => {
    try {
      setExportLoading(true);
      
      if (filteredFodder.length === 0) {
        toast({
          title: "No Data to Export",
          description: "There are no records matching your current filters",
          variant: "destructive",
        });
        return;
      }

      const csvData = filteredFodder.map(record => [
        formatDate(record.date),
        record.location || 'N/A',
        record.region || 'N/A',
        record.model || 'N/A',
        (record.farmers?.length || 0).toString(),
        (record.landSize || 0).toString(),
        (record.totalAcresPasture || 0).toString(),
        (record.totalBales || 0).toString(),
        (record.yieldPerHarvest || 0).toString()
      ]);

      const headers = ['Date', 'Location', 'Region', 'Model', 'Number of Farmers', 'Land Size', 'Total Acres Pasture', 'Total Bales', 'Yield per Harvest'];
      const csvContent = [headers, ...csvData]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      let filename = `fodder-farmers`;
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
        description: `Exported ${filteredFodder.length} records with applied filters`,
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

  const handleSelectRecord = (recordId: string) => {
    setSelectedRecords(prev =>
      prev.includes(recordId)
        ? prev.filter(id => id !== recordId)
        : [...prev, recordId]
    );
  };

  const handleSelectAll = () => {
    const currentPageIds = getCurrentPageRecords().map(f => f.id);
    setSelectedRecords(prev =>
      prev.length === currentPageIds.length ? [] : currentPageIds
    );
  };

  const openViewDialog = (record: FodderFarmer) => {
    setViewingRecord(record);
    setIsViewDialogOpen(true);
  };

  // Edit and Delete handlers
  const handleEdit = (record: FodderFarmer) => {
    // TODO: Implement edit functionality
    console.log("Edit record:", record);
    toast({
      title: "Edit Feature",
      description: "Edit functionality will be implemented soon",
    });
  };

  const handleDelete = (record: FodderFarmer) => {
    // TODO: Implement delete functionality
    console.log("Delete record:", record);
    toast({
      title: "Delete Feature",
      description: "Delete functionality will be implemented soon",
      variant: "destructive",
    });
  };

  // Memoized values
  const uniqueRegions = useMemo(() => {
    const regions = [...new Set(allFodder.map(f => f.region).filter(Boolean))];
    console.log("Unique regions:", regions);
    return regions;
  }, [allFodder]);

  const uniqueLocations = useMemo(() => {
    const locations = [...new Set(allFodder.map(f => f.location).filter(Boolean))];
    console.log("Unique locations:", locations);
    return locations;
  }, [allFodder]);

  const uniqueModels = useMemo(() => {
    const models = [...new Set(allFodder.map(f => f.model).filter(Boolean))];
    console.log("Unique models:", models);
    return models;
  }, [allFodder]);

  const getCurrentPageRecords = useCallback(() => {
    const startIndex = (pagination.page - 1) * pagination.limit;
    const endIndex = startIndex + pagination.limit;
    return filteredFodder.slice(startIndex, endIndex);
  }, [filteredFodder, pagination.page, pagination.limit]);

  const currentPageRecords = useMemo(getCurrentPageRecords, [getCurrentPageRecords]);

  const clearAllFilters = () => {
    // Clear any pending search timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    setFilters({
      search: "",
      startDate: "",
      endDate: "",
      location: "all",
      region: "all",
      model: "all"
    });
  };

  const resetToCurrentMonth = () => {
    setFilters(prev => ({ ...prev, ...currentMonth }));
  };

  // Memoized components to prevent re-renders
  const StatsCard = useCallback(({ title, value, icon: Icon, description }: any) => (
    <Card className="bg-white text-slate-900 shadow-lg border border-gray-200 relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-green-500 to-emerald-600"></div>
      
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 pl-6">
        <CardTitle className="text-sm font-medium text-slate-700">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pl-6 pb-4 flex flex-row">
        <div className="mr-2 rounded-full">
          <Icon className="h-8 w-8 text-green-600" />
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-900 mb-2">{value}</div>
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
          onChange={(e) => handleSearch(e.target.value)}
          className="border-gray-300 focus:border-green-500 focus:ring-green-500 bg-white"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="region" className="font-semibold text-gray-700">Region</Label>
        <Select value={filters.region} onValueChange={(value) => handleFilterChange("region", value)}>
          <SelectTrigger className="border-gray-300 focus:border-green-500 focus:ring-green-500 bg-white">
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
        <Select value={filters.location} onValueChange={(value) => handleFilterChange("location", value)}>
          <SelectTrigger className="border-gray-300 focus:border-green-500 focus:ring-green-500 bg-white">
            <SelectValue placeholder="Select location" />
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
        <Label htmlFor="model" className="font-semibold text-gray-700">Model</Label>
        <Select value={filters.model} onValueChange={(value) => handleFilterChange("model", value)}>
          <SelectTrigger className="border-gray-300 focus:border-green-500 focus:ring-green-500 bg-white">
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Models</SelectItem>
            {uniqueModels.slice(0, 20).map(model => (
              <SelectItem key={model} value={model}>{model}</SelectItem>
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
          className="border-gray-300 focus:border-green-500 focus:ring-green-500 bg-white"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="endDate" className="font-semibold text-gray-700">To Date</Label>
        <Input
          id="endDate"
          type="date"
          value={filters.endDate}
          onChange={(e) => handleFilterChange("endDate", e.target.value)}
          className="border-gray-300 focus:border-green-500 focus:ring-green-500 bg-white"
        />
      </div>
    </div>
  ), [filters, uniqueRegions, uniqueLocations, uniqueModels, handleSearch, handleFilterChange]);

  const TableRow = useCallback(({ record }: { record: FodderFarmer }) => {
    const farmerCount = record.farmers?.length || 0;
    
    return (
      <tr className="border-b hover:bg-green-50 transition-colors duration-200 group text-sm">
        <td className="py-3 px-4">
          <Checkbox
            checked={selectedRecords.includes(record.id)}
            onCheckedChange={() => handleSelectRecord(record.id)}
          />
        </td>
        <td className="py-3 px-4">{formatDate(record.date)}</td>
        <td className="py-3 px-4">{record.location || 'N/A'}</td>
        <td className="py-3 px-4">{record.region || 'N/A'}</td>
        <td className="py-3 px-4">
          <Badge className="bg-blue-100 text-blue-800">
            {record.model || 'N/A'}
          </Badge>
        </td>
        <td className="py-3 px-4">{record.landSize || 0}</td>
        <td className="py-3 px-4">{record.totalAcresPasture || 0}</td>
        <td className="py-3 px-4">{record.totalBales || 0}</td>
        <td className="py-3 px-4">{record.yieldPerHarvest || 0}</td>
        <td className="py-3 px-4">
          <span className="font-bold text-gray-700">{farmerCount}</span>
        </td>
        <td className="py-3 px-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openViewDialog(record)}
              className="h-8 w-8 p-0 hover:bg-green-50 hover:text-green-600 border-green-200"
            >
              <Eye className="h-4 w-4 text-green-500" />
            </Button>
            {/* Edit button - only for chief admin */}
            {userIsChiefAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEdit(record)}
                className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600 border-blue-200"
              >
                <Edit className="h-4 w-4 text-blue-500" />
              </Button>
            )}
            {/* Delete button - only for chief admin */}
            {isChiefAdmin(userRole)  && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDelete(record)}
                className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600 border-red-200"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            )}
          </div>
        </td>
      </tr>
    );
  }, [selectedRecords, handleSelectRecord, openViewDialog, handleEdit, handleDelete, userIsChiefAdmin]);

  return (
    <div className="space-y-6">
      {/* Header with Action Buttons */}
      <div className="flex md:flex-row flex-col justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold mb-2 bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
            Fodder Farmers
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
          {/* Export button - only for chief admin */}
          {userIsChiefAdmin && (
            <Button 
              onClick={handleExport} 
              disabled={exportLoading || filteredFodder.length === 0}
              className="bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white shadow-md text-xs"
            >
              <Download className="h-4 w-4 mr-2" />
              {exportLoading ? "Exporting..." : `Export (${filteredFodder.length})`}
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard 
          title="Total Farmers" 
          value={stats.totalFarmers} 
          icon={Users}
          description="Across all records"
        />

        <StatsCard 
          title="Regions" 
          value={stats.totalRegions} 
          icon={Globe}
          description="Unique regions covered"
        />

        <StatsCard 
          title="Models" 
          value={stats.totalModels} 
          icon={LayoutGrid}
          description="Different farming models"
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
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
              <p className="text-muted-foreground mt-2">Loading fodder data...</p>
            </div>
          ) : currentPageRecords.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {allFodder.length === 0 ? "No fodder data found in database" : "No records found matching your criteria"}
            </div>
          ) : (
            <>
              <div className="w-full overflow-x-auto rounded-md">
                <table className="w-full border-collapse border border-gray-300 text-sm text-left whitespace-nowrap">
                  <thead className="rounded">
                    <tr className="bg-green-100 p-1 px-3">
                      <th className="py-1 px-6">
                        <Checkbox
                          checked={selectedRecords.length === currentPageRecords.length && currentPageRecords.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </th>
                      <th className="py-1 px-6 font-medium text-gray-600">Date</th>
                      <th className="py-1 px-6 font-medium text-gray-600">Location</th>
                      <th className="py-1 px-6 font-medium text-gray-600">Region</th>
                      <th className="py-1 px-6 font-medium text-gray-600">Model</th>
                      <th className="py-1 px-6 font-medium text-gray-600">Land Size</th>
                      <th className="py-1 px-6 font-medium text-gray-600">Pasture Acres</th>
                      <th className="py-1 px-6 font-medium text-gray-600">Total Bales</th>
                      <th className="py-1 px-6 font-medium text-gray-600">Yield/Harvest</th>
                      <th className="py-1 px-6 font-medium text-gray-600">Farmers</th>
                      <th className="py-1 px-6 font-medium text-gray-600">Actions</th>
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
                  Page {pagination.page} of {pagination.totalPages} • {filteredFodder.length} total records • {currentPageRecords.length} on this page
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
        <DialogContent className="sm:max-w-2xl bg-white rounded-2xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Eye className="h-5 w-5 text-green-600" />
              Fodder Farmer Details
            </DialogTitle>
            <DialogDescription>
              Complete information for this fodder farming record
            </DialogDescription>
          </DialogHeader>
          {viewingRecord && (
            <div className="space-y-6 py-4 overflow-y-auto max-h-[60vh]">
              {/* Basic Information */}
              <div className="bg-slate-50 rounded-xl p-4">
                <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <Sprout className="h-4 w-4" />
                  Basic Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Date</Label>
                    <p className="text-slate-900 font-medium">{formatDate(viewingRecord.date)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Location</Label>
                    <p className="text-slate-900 font-medium">{viewingRecord.location || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Region</Label>
                    <p className="text-slate-900 font-medium">{viewingRecord.region || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Model</Label>
                    <Badge className="bg-blue-100 text-blue-800">{viewingRecord.model || 'N/A'}</Badge>
                  </div>
                </div>
              </div>

              {/* Land Information */}
              <div className="bg-slate-50 rounded-xl p-4">
                <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Land Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Land Size</Label>
                    <p className="text-slate-900 font-medium">{(viewingRecord.landSize || 0).toLocaleString()} acres</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Total Acres Pasture</Label>
                    <p className="text-slate-900 font-medium">{(viewingRecord.totalAcresPasture || 0).toLocaleString()} acres</p>
                  </div>
                </div>
              </div>

              {/* Production Information */}
              <div className="bg-slate-50 rounded-xl p-4">
                <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Production Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Total Bales</Label>
                    <p className="text-slate-900 font-medium text-lg font-bold">
                      {(viewingRecord.totalBales || 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Yield per Harvest</Label>
                    <p className="text-slate-900 font-medium">{(viewingRecord.yieldPerHarvest || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Farmers List */}
              {viewingRecord.farmers && viewingRecord.farmers.length > 0 && (
                <div className="bg-slate-50 rounded-xl p-4">
                  <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Associated Farmers ({viewingRecord.farmers.length})
                  </h3>
                  <div className="space-y-3 max-h-40 overflow-y-auto">
                    {viewingRecord.farmers.map((farmer, index) => (
                      <div key={farmer.id || index} className="border border-slate-200 rounded-lg p-3 bg-white">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm font-medium text-slate-600">Name</Label>
                            <p className="text-slate-900 font-medium">{farmer.name || 'N/A'}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-slate-600">Gender</Label>
                            <p className="text-slate-900 font-medium">{farmer.gender || 'N/A'}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-slate-600">Phone</Label>
                            <p className="text-slate-900 font-medium">{farmer.phone || 'N/A'}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-slate-600">Farmer ID</Label>
                            <p className="text-slate-900 font-medium font-mono">{farmer.id || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button 
              onClick={() => setIsViewDialogOpen(false)}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FodderFarmersPage;