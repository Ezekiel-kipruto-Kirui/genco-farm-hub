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
import { Download, MapPin, Eye, Calendar, Droplets, Users, Globe, Building } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Types
interface Borehole {
  id: string;
  date: any;
  location?: string;
  region?: string;
  people?: number;
  waterUsed?: number;
}

interface Filters {
  search: string;
  startDate: string;
  endDate: string;
  location: string;
  region: string;
}

interface Stats {
  totalBoreholes: number;
  totalRegions: number;
  totalPeople: number;
  totalWaterUsed: number;
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

const BoreholePage = () => {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const [allBoreholes, setAllBoreholes] = useState<Borehole[]>([]);
  const [filteredBoreholes, setFilteredBoreholes] = useState<Borehole[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingRecord, setViewingRecord] = useState<Borehole | null>(null);
  
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const currentMonth = useMemo(getCurrentMonthDates, []);

  const [filters, setFilters] = useState<Filters>({
    search: "",
    startDate: currentMonth.startDate,
    endDate: currentMonth.endDate,
    location: "all",
    region: "all"
  });

  const [stats, setStats] = useState<Stats>({
    totalBoreholes: 0,
    totalRegions: 0,
    totalPeople: 0,
    totalWaterUsed: 0
  });

  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: PAGE_LIMIT,
    totalPages: 1,
    hasNext: false,
    hasPrev: false
  });

  // Data fetching
  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      console.log("Starting borehole data fetch...");
      
      const data = await fetchData();
      

      if (!data.BoreholeStorage) {
        console.warn("No BoreholeStorage data found in response");
        // Check all available collections
        Object.keys(data).forEach(key => {
          console.log(`Available collection: ${key}`, data[key]);
          if (Array.isArray(data[key]) && data[key].length > 0) {
            console.log(`First item in ${key}:`, data[key][0]);
          }
        });
        setAllBoreholes([]);
        return;
      }

      const boreholeData = Array.isArray(data.BoreholeStorage) ? data.BoreholeStorage.map((item: any, index: number) => {
        console.log(`Processing borehole item ${index}:`, item);
        
        // Handle date parsing
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

        // Handle different field name variations for borehole data
        const processedItem = {
          id: item.id || `borehole-${index}-${Date.now()}`,
          date: dateValue,
          location: item.	BoreholeLocation || 'No location',
          region: item.Region || '',
          people: Number(item.PeopleUsingBorehole || 0),
          waterUsed: Number(item.WaterUsed || 0)
        };

        console.log(`Processed borehole item ${index}:`, processedItem);
        return processedItem;

      }) : [];

      console.log("Final processed borehole data:", boreholeData);
      setAllBoreholes(boreholeData);
      
    } catch (error) {
      console.error("Error fetching borehole data:", error);
      toast({
        title: "Error",
        description: "Failed to load borehole data from database",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Filter application
  const applyFilters = useCallback(() => {
    if (allBoreholes.length === 0) {
      console.log("No borehole data to filter");
      setFilteredBoreholes([]);
      setStats({
        totalBoreholes: 0,
        totalRegions: 0,
        totalPeople: 0,
        totalWaterUsed: 0
      });
      return;
    }

    console.log("Applying filters to", allBoreholes.length, "borehole records");
    
    let filtered = allBoreholes.filter(record => {
      // Region filter
      if (filters.region !== "all" && record.region?.toLowerCase() !== filters.region.toLowerCase()) {
        return false;
      }

      // Location filter
      if (filters.location !== "all" && record.location?.toLowerCase() !== filters.location.toLowerCase()) {
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
          record.location, 
          record.region
        ].some(field => field?.toLowerCase().includes(searchTerm));
        if (!searchMatch) return false;
      }

      return true;
    });

    console.log("Filtered to", filtered.length, "borehole records");
    setFilteredBoreholes(filtered);
    
    // Update stats
    const totalPeople = filtered.reduce((sum, record) => sum + (record.people || 0), 0);
    const totalWaterUsed = filtered.reduce((sum, record) => sum + (record.waterUsed || 0), 0);
    
    // Count unique regions from filtered data
    const uniqueRegions = new Set(filtered.map(f => f.region).filter(Boolean));

    console.log("Stats - Total Boreholes:", filtered.length, "Regions:", uniqueRegions.size, "People:", totalPeople, "Water Used:", totalWaterUsed);

    setStats({
      totalBoreholes: filtered.length,
      totalRegions: uniqueRegions.size,
      totalPeople,
      totalWaterUsed
    });

    // Update pagination
    const totalPages = Math.ceil(filtered.length / pagination.limit);
    setPagination(prev => ({
      ...prev,
      totalPages,
      hasNext: prev.page < totalPages,
      hasPrev: prev.page > 1
    }));
  }, [allBoreholes, filters, pagination.limit]);

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
      
      if (filteredBoreholes.length === 0) {
        toast({
          title: "No Data to Export",
          description: "There are no records matching your current filters",
          variant: "destructive",
        });
        return;
      }

      const csvData = filteredBoreholes.map(record => [
        formatDate(record.date),
        record.location || 'N/A',
        record.region || 'N/A',
        (record.people || 0).toString(),
        (record.waterUsed || 0).toString()
      ]);

      const headers = ['Date', 'Borehole Location', 'Region', 'People Using Water', 'Water Used'];
      const csvContent = [headers, ...csvData]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      let filename = `borehole-data`;
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
        description: `Exported ${filteredBoreholes.length} borehole records`,
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
    return filteredBoreholes.slice(startIndex, endIndex);
  }, [filteredBoreholes, pagination.page, pagination.limit]);

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

  const openViewDialog = (record: Borehole) => {
    setViewingRecord(record);
    setIsViewDialogOpen(true);
  };

  // Memoized values
  const uniqueRegions = useMemo(() => {
    const regions = [...new Set(allBoreholes.map(f => f.region).filter(Boolean))];
    console.log("Unique regions:", regions);
    return regions;
  }, [allBoreholes]);

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
      region: "all"
    });
  };

  const resetToCurrentMonth = () => {
    setFilters(prev => ({ ...prev, ...currentMonth }));
  };

  // Memoized components to prevent re-renders
  const StatsCard = useCallback(({ title, value, icon: Icon, description }: any) => (
    <Card className="bg-white text-slate-900 shadow-lg border border-gray-200 relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-cyan-600"></div>
      
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 pl-6">
        <CardTitle className="text-sm font-medium text-slate-700">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pl-6 pb-4 flex flex-row">
        <div className="mr-2 rounded-full">
          <Icon className="h-8 w-8 text-blue-600" />
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="space-y-2">
        <Label htmlFor="search" className="font-semibold text-gray-700">Search</Label>
        <Input
          id="search"
          placeholder="Search boreholes..."
          onChange={(e) => handleSearch(e.target.value)}
          className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-white"
        />
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
  ), [filters, uniqueRegions, handleSearch, handleFilterChange]);

  const TableRow = useCallback(({ record }: { record: Borehole }) => (
    <tr className="border-b hover:bg-blue-50 transition-colors duration-200 group text-sm">
      <td className="py-3 px-4">
        <Checkbox
          checked={selectedRecords.includes(record.id)}
          onCheckedChange={() => handleSelectRecord(record.id)}
        />
      </td>
      <td className="py-3 px-4">{formatDate(record.date)}</td>
      <td className="py-3 px-4 font-medium">{record.location || 'N/A'}</td>
      <td className="py-3 px-4">
        <Badge className="bg-green-100 text-green-800">
          {record.region || 'N/A'}
        </Badge>
      </td>
      <td className="py-3 px-4">
        <span className="font-bold text-blue-700">{record.people || 0}</span>
      </td>
      <td className="py-3 px-4">
        <span className="font-bold text-cyan-700">{record.waterUsed || 0} L</span>
      </td>
      <td className="py-3 px-4">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openViewDialog(record)}
            className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600 border-blue-200"
          >
            <Eye className="h-4 w-4 text-blue-500" />
          </Button>
        </div>
      </td>
    </tr>
  ), [selectedRecords, handleSelectRecord, openViewDialog]);

  return (
    <div className="space-y-6">
      {/* Header with Action Buttons */}
      <div className="flex md:flex-row flex-col justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
            Borehole Data
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
            disabled={exportLoading || filteredBoreholes.length === 0}
            className="bg-gradient-to-r from-blue-600 to-cyan-700 hover:from-blue-700 hover:to-cyan-800 text-white shadow-md text-xs"
          >
            <Download className="h-4 w-4 mr-2" />
            {exportLoading ? "Exporting..." : `Export (${filteredBoreholes.length})`}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard 
          title="Total Boreholes" 
          value={stats.totalBoreholes} 
          icon={Building}
          description="Water sources monitored"
        />

        <StatsCard 
          title="Regions" 
          value={stats.totalRegions} 
          icon={Globe}
          description="Unique regions covered"
        />

        <StatsCard 
          title="People Served" 
          value={stats.totalPeople.toLocaleString()} 
          icon={Users}
          description="Total people using boreholes"
        />

        <StatsCard 
          title="Water Used" 
          value={`${stats.totalWaterUsed.toLocaleString()}L`} 
          icon={Droplets}
          description="Total water consumption"
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
              <p className="text-muted-foreground mt-2">Loading borehole data...</p>
            </div>
          ) : currentPageRecords.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {allBoreholes.length === 0 ? "No borehole data found in database" : "No records found matching your criteria"}
            </div>
          ) : (
            <>
              <div className="w-full overflow-x-auto rounded-md">
                <table className="w-full border-collapse border border-gray-300 text-sm text-left">
                  <thead className="rounded">
                    <tr className="bg-blue-100">
                      <th className="py-3 px-4">
                        <Checkbox
                          checked={selectedRecords.length === currentPageRecords.length && currentPageRecords.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </th>
                      <th className="py-3 px-4 font-medium text-gray-600">Date</th>
                      <th className="py-3 px-4 font-medium text-gray-600">Borehole Location</th>
                      <th className="py-3 px-4 font-medium text-gray-600">Region</th>
                      <th className="py-3 px-4 font-medium text-gray-600">People Using Water</th>
                      <th className="py-3 px-4 font-medium text-gray-600">Water Used</th>
                      <th className="py-3 px-4 font-medium text-gray-600">Actions</th>
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
                  {filteredBoreholes.length} total records • {currentPageRecords.length} on this page
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
              <Eye className="h-5 w-5 text-blue-600" />
              Borehole Details
            </DialogTitle>
            <DialogDescription>
              Complete information for this borehole record
            </DialogDescription>
          </DialogHeader>
          {viewingRecord && (
            <div className="space-y-6 py-4 overflow-y-auto max-h-[60vh]">
              {/* Location Information */}
              <div className="bg-slate-50 rounded-xl p-4">
                <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Location Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Date Recorded</Label>
                    <p className="text-slate-900 font-medium">{formatDate(viewingRecord.date)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Borehole Location</Label>
                    <p className="text-slate-900 font-medium">{viewingRecord.location || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Region</Label>
                    <Badge className="bg-green-100 text-green-800">{viewingRecord.region || 'N/A'}</Badge>
                  </div>
                </div>
              </div>

              {/* Usage Information */}
              <div className="bg-slate-50 rounded-xl p-4">
                <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Usage Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-600">People Using Water</Label>
                    <p className="text-slate-900 font-medium text-lg font-bold text-blue-700">
                      {viewingRecord.people || 0}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Water Used</Label>
                    <p className="text-slate-900 font-medium text-lg font-bold text-cyan-700">
                      {viewingRecord.waterUsed || 0} liters
                    </p>
                  </div>
                </div>
              </div>

              {/* Additional Information */}
              <div className="bg-slate-50 rounded-xl p-4">
                <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <Droplets className="h-4 w-4" />
                  Water Usage Summary
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm font-medium text-slate-600">Average Water per Person</Label>
                    <p className="text-slate-900 font-medium">
                      {viewingRecord.people && viewingRecord.waterUsed && viewingRecord.people > 0 
                        ? `${(viewingRecord.waterUsed / viewingRecord.people).toFixed(1)} liters/person`
                        : 'N/A'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button 
              onClick={() => setIsViewDialogOpen(false)}
              className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BoreholePage;