import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { collection, getDocs, query, updateDoc, doc, deleteDoc, writeBatch } from "firebase/firestore";
import { db, fetchData } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Download, Users, MapPin, Eye, Calendar, Scale, Phone, CreditCard, Edit, Trash2, Weight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isChiefAdmin } from "./onboardingpage";

// Types
interface OfftakeData {
  id: string;
  date: any;
  farmerName: string;
  gender: string;
  idNumber: string;
  liveWeight: number | number[];
  carcassWeight?: number | number[];
  location: string;
  noSheepGoats: number;
  phoneNumber: string;
  pricePerGoatAndSheep: number | number[];
  region: string;
  totalprice: number;
  sheepGoatPrice?: number;
}

interface Filters {
  search: string;
  startDate: string;
  endDate: string;
  region: string;
  gender: string;
}

interface Stats {
  totalRegions: number;
  totalAnimals: number;
  totalRevenue: number;
  averageLiveWeight: number;
  averageCarcassWeight: number;
  averageRevenue: number;
  totalFarmers: number;
}

interface Pagination {
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface EditForm {
  date: string;
  farmerName: string;
  gender: string;
  idNumber: string;
  phoneNumber: string;
  region: string;
  location: string;
}

interface WeightEditForm {
  liveWeights: number[];
  carcassWeights: number[];
  prices: number[];
}

// Constants
const PAGE_LIMIT = 15;

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

const formatDateForInput = (date: any): string => {
  const parsedDate = parseDate(date);
  return parsedDate ? parsedDate.toISOString().split('T')[0] : '';
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
  }).format(amount || 0);
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

// Helper function to process array data
const processArrayData = (data: any): number | number[] => {
  if (Array.isArray(data)) {
    return data;
  } else if (typeof data === 'number') {
    return data;
  } else if (typeof data === 'string') {
    const parsed = parseFloat(data);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

// Helper function to calculate average from array
const calculateAverage = (data: number | number[]): number => {
  if (Array.isArray(data)) {
    if (data.length === 0) return 0;
    const sum = data.reduce((acc, val) => acc + (Number(val) || 0), 0);
    return sum / data.length;
  }
  return Number(data) || 0;
};

// Helper function to calculate total from array
const calculateTotal = (data: number | number[]): number => {
  if (Array.isArray(data)) {
    return data.reduce((acc, val) => acc + (Number(val) || 0), 0);
  }
  return Number(data) || 0;
};

const LivestockOfftakePage = () => {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const [allOfftake, setAllOfftake] = useState<OfftakeData[]>([]);
  const [filteredOfftake, setFilteredOfftake] = useState<OfftakeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isWeightEditDialogOpen, setIsWeightEditDialogOpen] = useState(false);
  const [viewingRecord, setViewingRecord] = useState<OfftakeData | null>(null);
  const [editingRecord, setEditingRecord] = useState<OfftakeData | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  const currentMonth = useMemo(getCurrentMonthDates, []);

  // Use ref for search timeout to debounce search
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const filtersRef = useRef<Filters>({
    search: "",
    startDate: currentMonth.startDate,
    endDate: currentMonth.endDate,
    region: "all",
    gender: "all"
  });

  const [stats, setStats] = useState<Stats>({
    totalRegions: 0,
    totalAnimals: 0,
    totalRevenue: 0,
    averageLiveWeight: 0,
    averageCarcassWeight: 0,
    averageRevenue: 0,
    totalFarmers: 0
  });

  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: PAGE_LIMIT,
    totalPages: 1,
    hasNext: false,
    hasPrev: false
  });

  const [editForm, setEditForm] = useState<EditForm>({
    date: "",
    farmerName: "",
    gender: "",
    idNumber: "",
    phoneNumber: "",
    region: "",
    location: ""
  });

  const [weightEditForm, setWeightEditForm] = useState<WeightEditForm>({
    liveWeights: [],
    carcassWeights: [],
    prices: []
  });

 const userIsChiefAdmin = useMemo(() => {
        return isChiefAdmin(userRole);
    }, [userRole]);

  // Data fetching - memoized to prevent unnecessary re-fetches
  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      console.log("Starting livestock offtake data fetch...");
      
      const data = await fetchData();
      console.log("Raw fetched data:", data);
      console.log("Livestock offtake data structure:", data.lofftake);

      if (!data.lofftake) {
        console.warn("No livestock offtake data found in response");
        setAllOfftake([]);
        return;
      }

      const offtakeData = Array.isArray(data.lofftake) ? data.lofftake.map((item: any, index: number) => {
        console.log(`Processing livestock offtake item ${index}:`, item);
        
        let dateValue = item.date || item.Date || item.createdAt || item.timestamp;
        
        if (dateValue && typeof dateValue === 'object') {
          if (dateValue.toDate && typeof dateValue.toDate === 'function') {
            dateValue = dateValue.toDate();
          } else if (dateValue.seconds) {
            dateValue = new Date(dateValue.seconds * 1000);
          } else if (dateValue._seconds) {
            dateValue = new Date(dateValue._seconds * 1000);
          }
        }

        const liveWeight = processArrayData(item.liveWeight || item.live_weight || item.LiveWeight || 0);
        const carcassWeight = processArrayData(item.carcassWeight || item.carcass_weight || item.CarcassWeight || 0);
        const pricePerGoatAndSheep = processArrayData(item.pricePerGoatAndSheep || item.price_per_goat_sheep || item.unitPrice || 0);

        const processedItem: OfftakeData = {
          id: item.id || `temp-${index}-${Date.now()}`,
          date: dateValue,
          farmerName: item.farmerName || item.farmername || item.farmer_name || item.name || '',
          gender: item.gender || item.Gender || '',
          idNumber: item.idNumber || item.idnumber || item.id_number || item.IDNumber || '',
          liveWeight: liveWeight,
          carcassWeight: carcassWeight,
          location: item.location || item.Location || item.area || item.Area || '',
          noSheepGoats: Number(item.noSheepGoats || item.nosheepgoats || item.no_sheep_goats || item.quantity || item.animals || 0),
          phoneNumber: item.phoneNumber || item.phonenumber || item.phone_number || item.phone || item.Phone || '',
          pricePerGoatAndSheep: pricePerGoatAndSheep,
          region: item.region || item.Region || item.county || item.County || '',
          totalprice: Number(item.totalprice || item.totalPrice || item.total_price || item.sheepGoatPrice || 0),
        };

        console.log(`Processed livestock offtake item ${index}:`, processedItem);
        return processedItem;

      }) : [];

      console.log("Final processed livestock offtake data:", offtakeData);
      setAllOfftake(offtakeData);
      
    } catch (error) {
      console.error("Error fetching livestock offtake data:", error);
      toast({
        title: "Error",
        description: "Failed to load livestock offtake data from database",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Filter application - optimized with useMemo
 
const applyFilters = useCallback(() => {
  if (allOfftake.length === 0) {
    console.log("No livestock offtake data to filter");
    setFilteredOfftake([]);
    setStats({
      totalRegions: 0,
      totalAnimals: 0,
      totalRevenue: 0,
      averageLiveWeight: 0,
      averageCarcassWeight: 0,
      averageRevenue: 0,
      totalFarmers: 0
    });
    return;
  }

  console.log("Applying filters to", allOfftake.length, "livestock offtake records");
  
  let filtered = allOfftake.filter(record => {
    if (filtersRef.current.region !== "all" && record.region?.toLowerCase() !== filtersRef.current.region.toLowerCase()) {
      return false;
    }

    if (filtersRef.current.gender !== "all" && record.gender?.toLowerCase() !== filtersRef.current.gender.toLowerCase()) {
      return false;
    }

    if (filtersRef.current.startDate || filtersRef.current.endDate) {
      const recordDate = parseDate(record.date);
      if (recordDate) {
        const recordDateOnly = new Date(recordDate);
        recordDateOnly.setHours(0, 0, 0, 0);

        const startDate = filtersRef.current.startDate ? new Date(filtersRef.current.startDate) : null;
        const endDate = filtersRef.current.endDate ? new Date(filtersRef.current.endDate) : null;
        if (startDate) startDate.setHours(0, 0, 0, 0);
        if (endDate) endDate.setHours(23, 59, 59, 999);

        if (startDate && recordDateOnly < startDate) return false;
        if (endDate && recordDateOnly > endDate) return false;
      } else if (filtersRef.current.startDate || filtersRef.current.endDate) {
        return false;
      }
    }

    if (filtersRef.current.search) {
      const searchTerm = filtersRef.current.search.toLowerCase();
      const searchMatch = [
        record.farmerName, 
        record.location, 
        record.region,
        record.idNumber,
        record.phoneNumber
      ].some(field => field?.toLowerCase().includes(searchTerm));
      if (!searchMatch) return false;
    }

    return true;
  });

  console.log("Filtered to", filtered.length, "livestock offtake records");
  setFilteredOfftake(filtered);
  
  const totalAnimals = filtered.reduce((sum, record) => sum + (record.noSheepGoats || 0), 0);
  const totalRevenue = filtered.reduce((sum, record) => sum + (record.totalprice || 0), 0);
  
  const uniqueRegions = new Set(filtered.map(f => f.region).filter(Boolean));
  const totalFarmers = filtered.length;

  // Calculate averages
  const totalLiveWeight = filtered.reduce((sum, record) => sum + calculateTotal(record.liveWeight), 0);
  const totalCarcassWeight = filtered.reduce((sum, record) => sum + calculateTotal(record.carcassWeight || 0), 0);
  
  const averageLiveWeight = totalAnimals > 0 ? totalLiveWeight / totalAnimals : 0;
  const averageCarcassWeight = totalAnimals > 0 ? totalCarcassWeight / totalAnimals : 0;
  
  // CORRECTED: Average revenue is now divided by total number of animals, not farmers
  const averageRevenue = totalAnimals > 0 ? totalRevenue / totalAnimals : 0;

  console.log("Regions:", uniqueRegions.size, "Animals:", totalAnimals, "Revenue:", totalRevenue);
  console.log("Average Live Weight:", averageLiveWeight, "Average Carcass Weight:", averageCarcassWeight, "Average Revenue per Animal:", averageRevenue);

  setStats({
    totalRegions: uniqueRegions.size,
    totalAnimals,
    totalRevenue,
    averageLiveWeight,
    averageCarcassWeight,
    averageRevenue,
    totalFarmers
  });

  // Calculate pagination based on current page
  const totalPages = Math.ceil(filtered.length / pagination.limit);
  const currentPage = Math.min(pagination.page, Math.max(1, totalPages));
  
  setPagination(prev => ({
    ...prev,
    page: currentPage,
    totalPages,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1
  }));
}, [allOfftake, pagination.limit, pagination.page]);


  // Effects - optimized dependencies
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // Debounced search handler - optimized
  const handleSearchChange = useCallback((value: string) => {
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for debouncing
    searchTimeoutRef.current = setTimeout(() => {
      filtersRef.current.search = value;
      setPagination(prev => ({ ...prev, page: 1 }));
      applyFilters();
    }, 300);
  }, [applyFilters]);

  // Filter change handler - optimized
  const handleFilterChange = useCallback((key: keyof Filters, value: string) => {
    filtersRef.current[key] = value;
    setPagination(prev => ({ ...prev, page: 1 }));
    applyFilters();
  }, [applyFilters]);

  // Export handler - Updated with better formatting
 const handleExport = async () => {
  try {
    setExportLoading(true);
    
    if (filteredOfftake.length === 0) {
      toast({
        title: "No Data to Export",
        description: "There are no records matching your current filters",
        variant: "destructive",
      });
      return;
    }

    // Create headers
    const headers = [
      'Date', 
      'Farmer Name', 
      'Gender', 
      'ID Number', 
      'Location', 
      'Phone Number', 
      'Region', 
      'Total Animals in Transaction',
      'Live Weight (kg)',
      'Carcass Weight (kg)',
      'Price per Animal (KES)',
      
    ];

    const csvData = [];

    // Process each record and create rows for each animal
    filteredOfftake.forEach(record => {
      const liveWeights = Array.isArray(record.liveWeight) ? record.liveWeight : [record.liveWeight || 0];
      const carcassWeights = Array.isArray(record.carcassWeight) ? record.carcassWeight : [record.carcassWeight || 0];
      const prices = Array.isArray(record.pricePerGoatAndSheep) ? record.pricePerGoatAndSheep : [record.pricePerGoatAndSheep || 0];

      // Clean and validate base data
      const cleanData = {
        date: formatDate(record.date) || 'N/A',
        farmerName: (record.farmerName || 'N/A').trim(),
        gender: (record.gender || 'N/A').trim(),
        idNumber: (record.idNumber || 'N/A').trim(),
        location: (record.location || 'N/A').trim(),
        phoneNumber: (record.phoneNumber || 'N/A').trim(),
        region: (record.region || 'N/A').trim(),
        totalAnimals: (record.noSheepGoats || 0).toString(),
        totalPrice: (record.totalprice || 0).toString()
      };

      // Determine the maximum number of animals to process for this record
      const numAnimals = Math.max(liveWeights.length, carcassWeights.length, prices.length, record.noSheepGoats || 1);

      let hasValidAnimals = false;

      // Create a row for each animal
      for (let i = 0; i < numAnimals; i++) {
        const liveWeight = liveWeights[i] !== undefined ? Number(liveWeights[i]) : null;
        const carcassWeight = carcassWeights[i] !== undefined ? Number(carcassWeights[i]) : null;
        const price = prices[i] !== undefined ? Number(prices[i]) : null;

        // Only include rows where we have at least one valid data point
        if (liveWeight !== null || carcassWeight !== null || price !== null) {
          const row = [
            // Only show constant data for the first animal row
            i === 0 ? cleanData.date : '',
            i === 0 ? cleanData.farmerName : '',
            i === 0 ? cleanData.gender : '',
            i === 0 ? cleanData.idNumber : '',
            i === 0 ? cleanData.location : '',
            i === 0 ? cleanData.phoneNumber : '',
            i === 0 ? cleanData.region : '',
            i === 0 ? '' : '',
            
            liveWeight !== null && liveWeight > 0 ? liveWeight.toFixed(1) : '',
            carcassWeight !== null && carcassWeight > 0 ? carcassWeight.toFixed(1) : '',
            price !== null && price > 0 ? price.toFixed(0) : '',
            
          ];
          csvData.push(row);
          hasValidAnimals = true;
        }
      }

      // Add farmer summary row
      if (hasValidAnimals) {
        // Skip one line
        csvData.push(Array(headers.length).fill(''));
        
        // Add total animals and total price for this farmer in the same row
        const summaryRow = Array(headers.length).fill('');
        summaryRow[7] = `${cleanData.totalAnimals}`;
        summaryRow[10] = ` ${cleanData.totalPrice}`;
        csvData.push(summaryRow);
        
        // Skip two lines after each farmer
        csvData.push(Array(headers.length).fill(''));
        csvData.push(Array(headers.length).fill(''));
      }
    });

    // Remove the last empty rows if they exist
    while (csvData.length > 0 && csvData[csvData.length - 1].every(cell => cell === '')) {
      csvData.pop();
    }

    // Add grand totals row
    const totalAnimals = filteredOfftake.reduce((sum, record) => sum + (record.noSheepGoats || 0), 0);
    const totalRevenue = filteredOfftake.reduce((sum, record) => sum + (record.totalprice || 0), 0);
    const totalLiveWeight = filteredOfftake.reduce((sum, record) => sum + calculateTotal(record.liveWeight), 0);
    const totalCarcassWeight = filteredOfftake.reduce((sum, record) => sum + calculateTotal(record.carcassWeight || 0), 0);
    const totalPricePerAnimals = filteredOfftake.reduce((sum, record) => sum + calculateTotal(record.pricePerGoatAndSheep), 0);
    const averageLiveWeight = totalAnimals > 0 ? totalLiveWeight / totalAnimals : 0;
    const averageCarcassWeight = totalAnimals > 0 ? totalCarcassWeight / totalAnimals : 0;

    const grandTotalRow1 = [
      'GRAND TOTALS', 
      '', '', '', '', '', '',
      totalAnimals.toString(),
      '',
      totalLiveWeight.toFixed(1),
      totalCarcassWeight.toFixed(1),
      totalPricePerAnimals.toFixed(0),
      totalRevenue.toString()
    ];

    const grandTotalRow2 = [
      'AVERAGES', 
      '', '', '', '', '', '',
      '',
      '',
      averageLiveWeight.toFixed(1),
      averageCarcassWeight.toFixed(1),
      '',
      ''
    ];

    const csvContent = [headers, ...csvData, grandTotalRow1, grandTotalRow2]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    let filename = `livestock-offtake-cleaned`;
    if (filtersRef.current.startDate || filtersRef.current.endDate) {
      filename += `_${filtersRef.current.startDate || 'start'}_to_${filtersRef.current.endDate || 'end'}`;
    }
    filename += `_${new Date().toISOString().split('T')[0]}.csv`;
    
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    const totalAnimalRows = csvData.filter(row => row[8] && row[8].startsWith('Animal')).length;
    toast({
      title: "Export Successful",
      description: `Exported ${totalAnimalRows} animal records from ${filteredOfftake.length} transactions`,
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

  // Improved page change handler
  const handlePageChange = useCallback((newPage: number) => {
    setPagination(prev => {
      const totalPages = Math.ceil(filteredOfftake.length / prev.limit);
      const validatedPage = Math.max(1, Math.min(newPage, totalPages));
      
      return {
        ...prev,
        page: validatedPage,
        hasNext: validatedPage < totalPages,
        hasPrev: validatedPage > 1
      };
    });
  }, [filteredOfftake.length]);

  const getCurrentPageRecords = useCallback(() => {
    const startIndex = (pagination.page - 1) * pagination.limit;
    const endIndex = startIndex + pagination.limit;
    return filteredOfftake.slice(startIndex, endIndex);
  }, [filteredOfftake, pagination.page, pagination.limit]);

  const handleSelectRecord = useCallback((recordId: string) => {
    setSelectedRecords(prev =>
      prev.includes(recordId)
        ? prev.filter(id => id !== recordId)
        : [...prev, recordId]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    const currentPageIds = getCurrentPageRecords().map(f => f.id);
    setSelectedRecords(prev =>
      prev.length === currentPageIds.length ? [] : currentPageIds
    );
  }, [getCurrentPageRecords]);

  const openViewDialog = useCallback((record: OfftakeData) => {
    setViewingRecord(record);
    setIsViewDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((record: OfftakeData) => {
    setEditingRecord(record);
    setEditForm({
      date: formatDateForInput(record.date),
      farmerName: record.farmerName || "",
      gender: record.gender || "",
      idNumber: record.idNumber || "",
      phoneNumber: record.phoneNumber || "",
      region: record.region || "",
      location: record.location || ""
    });
    setIsEditDialogOpen(true);
  }, []);

  const openWeightEditDialog = useCallback((record: OfftakeData) => {
    setEditingRecord(record);
    
    const liveWeights = Array.isArray(record.liveWeight) ? record.liveWeight : [record.liveWeight || 0];
    const carcassWeights = Array.isArray(record.carcassWeight) ? record.carcassWeight : [record.carcassWeight || 0];
    const prices = Array.isArray(record.pricePerGoatAndSheep) ? record.pricePerGoatAndSheep : [record.pricePerGoatAndSheep || 0];
    
    // Ensure we have arrays for all weights and prices
    const numAnimals = Math.max(liveWeights.length, carcassWeights.length, prices.length, record.noSheepGoats || 1);
    
    const paddedLiveWeights = [...liveWeights];
    const paddedCarcassWeights = [...carcassWeights];
    const paddedPrices = [...prices];
    
    while (paddedLiveWeights.length < numAnimals) paddedLiveWeights.push(0);
    while (paddedCarcassWeights.length < numAnimals) paddedCarcassWeights.push(0);
    while (paddedPrices.length < numAnimals) paddedPrices.push(0);

    setWeightEditForm({
      liveWeights: paddedLiveWeights,
      carcassWeights: paddedCarcassWeights,
      prices: paddedPrices
    });
    
    setIsWeightEditDialogOpen(true);
  }, []);

  const handleEditSubmit = async () => {
    if (!editingRecord) return;
    
    try {
      const recordRef = doc(db, "lofftake", editingRecord.id);
    
      const updateData = {
        date: editForm.date ? new Date(editForm.date) : null,
        farmerName: editForm.farmerName,
        gender: editForm.gender,
        idNumber: editForm.idNumber,
        phoneNumber: editForm.phoneNumber,
        region: editForm.region,
        location: editForm.location,
        FarmerName: editForm.farmerName,
        Gender: editForm.gender,
        IDNumber: editForm.idNumber,
        PhoneNumber: editForm.phoneNumber,
        Region: editForm.region,
        Location: editForm.location
      };

      await updateDoc(recordRef, updateData);

      toast({
        title: "Success",
        description: "Record updated successfully",
      });

      setIsEditDialogOpen(false);
      setEditingRecord(null);
      fetchAllData();
    } catch (error) {
      console.error("Error updating record:", error);
      toast({
        title: "Error",
        description: "Failed to update record data",
        variant: "destructive",
      });
    }
  };

  const handleWeightEditSubmit = async () => {
    if (!editingRecord) return;
    
    try {
      const recordRef = doc(db, "lofftake", editingRecord.id);
      
      // Filter out zero values to maintain data integrity
      const filteredLiveWeights = weightEditForm.liveWeights.filter(weight => weight > 0);
      const filteredCarcassWeights = weightEditForm.carcassWeights.filter(weight => weight > 0);
      const filteredPrices = weightEditForm.prices.filter(price => price > 0);
      
      // Calculate new total price based on updated prices
      const newTotalPrice = filteredPrices.reduce((sum, price) => sum + price, 0);
      
      const updateData = {
        liveWeight: filteredLiveWeights.length > 0 ? filteredLiveWeights : 0,
        carcassWeight: filteredCarcassWeights.length > 0 ? filteredCarcassWeights : 0,
        pricePerGoatAndSheep: filteredPrices.length > 0 ? filteredPrices : 0,
        totalprice: newTotalPrice,
        LiveWeight: filteredLiveWeights.length > 0 ? filteredLiveWeights : 0,
        CarcassWeight: filteredCarcassWeights.length > 0 ? filteredCarcassWeights : 0,
        PricePerGoatAndSheep: filteredPrices.length > 0 ? filteredPrices : 0,
        TotalPrice: newTotalPrice
      };

      await updateDoc(recordRef, updateData);

      toast({
        title: "Success",
        description: "Weights and prices updated successfully",
      });

      setIsWeightEditDialogOpen(false);
      setEditingRecord(null);
      fetchAllData();
    } catch (error) {
      console.error("Error updating weights and prices:", error);
      toast({
        title: "Error",
        description: "Failed to update weights and prices",
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
        const docRef = doc(db, "lofftake", recordId);
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
  const uniqueRegions = useMemo(() => {
    const regions = [...new Set(allOfftake.map(f => f.region).filter(Boolean))];
    return regions;
  }, [allOfftake]);

  const uniqueGenders = useMemo(() => {
    const genders = [...new Set(allOfftake.map(f => f.gender).filter(Boolean))];
    return genders;
  }, [allOfftake]);

  const currentPageRecords = useMemo(getCurrentPageRecords, [getCurrentPageRecords]);

  const clearAllFilters = useCallback(() => {
    // Reset filters to show all data including dates
    filtersRef.current = {
      search: "",
      startDate: "", // Empty string to show all dates
      endDate: "",   // Empty string to show all dates
      region: "all",
      gender: "all"
    };
    setPagination(prev => ({ ...prev, page: 1 }));
    applyFilters();
  }, [applyFilters]);

  const resetToCurrentMonth = useCallback(() => {
    filtersRef.current = {
      ...filtersRef.current,
      ...currentMonth
    };
    setPagination(prev => ({ ...prev, page: 1 }));
    applyFilters();
  }, [currentMonth, applyFilters]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Memoized components
  const StatsCard = useMemo(() => ({ title, value, icon: Icon, description, subValue }: any) => (
    <Card className="bg-white text-slate-900 shadow-lg border border-gray-200 relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-purple-600"></div>
      
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 pl-6">
        <CardTitle className="text-sm font-medium text-gray-400">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pl-6 pb-4 flex flex-row">
        <div className="mr-2 rounded-full">
          <Icon className="h-8 w-8 text-blue-600" />
        </div>
        <div>
          <div className="text-2xl font-bold text-green-500 mb-2">{value}</div>
          {subValue && (
            <div className="text-sm font-medium text-slate-600 mb-2">{subValue}</div>
          )}
          {description && (
            <p className="text-xs mt-2 bg-orange-50 px-2 py-1 rounded-md border border-slate-100">
              {description}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  ), []);

  const FilterSection = useMemo(() => () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      <div className="space-y-2">
        <Label htmlFor="search" className="font-semibold text-gray-700">Search</Label>
        <Input
          id="search"
          placeholder="Search farmers, locations..."
          defaultValue={filtersRef.current.search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-white"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="region" className="font-semibold text-gray-700">Region</Label>
        <Select value={filtersRef.current.region} onValueChange={(value) => handleFilterChange("region", value)}>
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
        <Label htmlFor="gender" className="font-semibold text-gray-700">Gender</Label>
        <Select value={filtersRef.current.gender} onValueChange={(value) => handleFilterChange("gender", value)}>
          <SelectTrigger className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-white">
            <SelectValue placeholder="Select gender" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Genders</SelectItem>
            {uniqueGenders.slice(0, 20).map(gender => (
              <SelectItem key={gender} value={gender}>{gender}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="startDate" className="font-semibold text-gray-700">From Date</Label>
        <Input
          id="startDate"
          type="date"
          value={filtersRef.current.startDate}
          onChange={(e) => handleFilterChange("startDate", e.target.value)}
          className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-white"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="endDate" className="font-semibold text-gray-700">To Date</Label>
        <Input
          id="endDate"
          type="date"
          value={filtersRef.current.endDate}
          onChange={(e) => handleFilterChange("endDate", e.target.value)}
          className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-white"
        />
      </div>
    </div>
  ), [uniqueRegions, uniqueGenders, handleSearchChange, handleFilterChange]);

  const TableRow = useMemo(() => ({ record }: { record: OfftakeData }) => {
    const avgLiveWeight = calculateAverage(record.liveWeight);
    const avgPrice = calculateAverage(record.pricePerGoatAndSheep);
    
    return (
      <tr className="border-b hover:bg-blue-50 transition-all duration-200 group text-sm">
        <td className="py-1 px-4">
          <Checkbox
            checked={selectedRecords.includes(record.id)}
            onCheckedChange={() => handleSelectRecord(record.id)}
          />
        </td>
        <td className="py-1 px-6 text-xs">{formatDate(record.date)}</td>
        <td className="py-1 px-6 text-xs">{record.farmerName || 'N/A'}</td>
        <td className="py-1 px-6 text-xs">{record.gender || 'N/A'}</td>
        <td className="py-1 px-6 text-xs">
          <code className="text-sm bg-gray-100 px-2 py-1 rounded text-gray-700">
            {record.idNumber || 'N/A'}
          </code>
        </td>
        {/* Phone Number and Location columns removed from table display but still in export */}
        <td className="py-1 px-6 text-xs">{record.region || 'N/A'}</td>
        <td className="py-1 px-6 text-xs font-bold">{record.noSheepGoats || 0}</td>
        <td className="py-1 px-6 text-xs font-bold text-green-600">{formatCurrency(record.totalprice || 0)}</td>
        <td className="py-1 px-6 text-xs">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openViewDialog(record)}
              className="h-8 w-8 p-0 hover:bg-green-100 hover:text-green-600 border-green-200"
            >
              <Eye className="h-4 w-4 text-green-500" />
            </Button>
 {isChiefAdmin(userRole) &&(
              <Button
              variant="outline"
              size="sm"
              onClick={() => openEditDialog(record)}
              className="h-8 w-8 p-0 hover:bg-yellow-100 border-white"
            >
              <Edit className="h-4 w-4 text-orange-500" />
            </Button>
 )}
 {isChiefAdmin(userRole) &&(
        <Button
              variant="outline"
              size="sm"
              onClick={() => handleSelectRecord(record.id)}
              className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600 border-red-200"
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>     
 )}
            
          </div>
        </td>
      </tr>
    );
  }, [selectedRecords, handleSelectRecord, openViewDialog, openEditDialog]);

  return (
    <div className="space-y-6">
      {/* Header with Action Buttons */}
      <div className="flex md:flex-row flex-col justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-md font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Livestock Offtake Data
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
        {isChiefAdmin(userRole) &&(
               <Button 
            onClick={handleExport} 
            disabled={exportLoading || filteredOfftake.length === 0}
            className="bg-gradient-to-r from-blue-800 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-md text-xs"
          >
            <Download className="h-4 w-4 mr-2" />
            {exportLoading ? "Exporting..." : `Export (${filteredOfftake.length})`}
          </Button>
 )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard 
          title="REGIONS" 
          value={stats.totalRegions} 
          icon={MapPin}
          description={`${stats.totalFarmers} farmers`}
          // subValue={`${stats.totalFarmers} farmers`}
        />

        <StatsCard 
          title="TOTAL ANIMALS" 
          value={stats.totalAnimals} 
          icon={Scale}
          description={`Avg Live: ${stats.averageLiveWeight.toFixed(1)}kg | Avg Carcass: ${stats.averageCarcassWeight.toFixed(1)}kg`}
          // subValue={`Avg Live: ${stats.averageLiveWeight.toFixed(1)}kg`}
        />

        <StatsCard 
          title="TOTAL REVENUE" 
          value={formatCurrency(stats.totalRevenue)} 
          icon={CreditCard}
          description={`Average per farmer: ${formatCurrency(stats.averageRevenue)}`}
          // subValue={`Avg: ${formatCurrency(stats.averageRevenue)}`}
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
              <p className="text-muted-foreground mt-2">Loading livestock offtake data...</p>
            </div>
          ) : currentPageRecords.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {allOfftake.length === 0 ? "No livestock offtake data found in database" : "No records found matching your criteria"}
            </div>
          ) : (
            <>
              <div className="w-full overflow-x-auto rounded-md">
                <table className="w-full border-collapse border border-gray-300 text-sm text-left whitespace-nowrap">
                  <thead className="rounded">
                    <tr className="bg-blue-100 p-1 px-3">
                      <th className="py-2 px-4">
                        <Checkbox
                          checked={selectedRecords.length === currentPageRecords.length && currentPageRecords.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </th>
                      <th className="text-left py-2 px-4 font-medium text-gray-600">Date</th>
                      <th className="text-left py-2 px-4 font-medium text-gray-600">Farmer Name</th>
                      <th className="text-left py-2 px-4 font-medium text-gray-600">Gender</th>
                      <th className="text-left py-2 px-4 font-medium text-gray-600">ID No</th>
                      {/* Phone Number column removed from table display */}
                      <th className="text-left py-2 px-4 font-medium text-gray-600">Region</th>
                      {/* Location column removed from table display */}
                      <th className="text-left py-2 px-4 font-medium text-gray-600">No.Animals</th>
                      <th className="text-left py-2 px-4 font-medium text-gray-600">Total Price</th>
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
                  {filteredOfftake.length} total records • Page {pagination.page} of {pagination.totalPages} • {currentPageRecords.length} on this page
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!pagination.hasPrev}
                    onClick={() => handlePageChange(pagination.page - 1)}
                    className="border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!pagination.hasNext}
                    onClick={() => handlePageChange(pagination.page + 1)}
                    className="border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
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
        <DialogContent className="sm:max-w-4xl bg-white rounded-2xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Eye className="h-5 w-5 text-green-600" />
              Livestock Offtake Details
            </DialogTitle>
            <DialogDescription>
              Complete information for this livestock offtake transaction
            </DialogDescription>
          </DialogHeader>
          {viewingRecord && (
            <div className="space-y-6 py-4 overflow-y-auto max-h-[60vh]">
              
              {/* Weight and Price Details Table */}
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <Weight className="h-4 w-4" />
                    Animal Details Table
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openWeightEditDialog(viewingRecord)}
                    className="flex items-center gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    Edit Weights & Prices
                  </Button>
                </div>
                
                {/* Determine number of animals */}
                {(() => {
                  const liveWeights = Array.isArray(viewingRecord.liveWeight) ? viewingRecord.liveWeight : [viewingRecord.liveWeight || 0];
                  const carcassWeights = Array.isArray(viewingRecord.carcassWeight) ? viewingRecord.carcassWeight : [viewingRecord.carcassWeight || 0];
                  const prices = Array.isArray(viewingRecord.pricePerGoatAndSheep) ? viewingRecord.pricePerGoatAndSheep : [viewingRecord.pricePerGoatAndSheep || 0];
                  
                  const numAnimals = Math.max(liveWeights.length, carcassWeights.length, prices.length, viewingRecord.noSheepGoats || 1);
                  
                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-300 text-sm">
                        <thead>
                          <tr className="bg-blue-100">
                            <th className="border border-gray-300 py-2 px-3 font-medium text-gray-700 text-left">Animal #</th>
                            <th className="border border-gray-300 py-2 px-3 font-medium text-gray-700 text-left">Live Weight (kg)</th>
                            <th className="border border-gray-300 py-2 px-3 font-medium text-gray-700 text-left">Carcass Weight (kg)</th>
                            <th className="border border-gray-300 py-2 px-3 font-medium text-gray-700 text-left">Price (Ksh)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from({ length: numAnimals }).map((_, index) => (
                            <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="border border-gray-300 py-2 px-3 font-medium">Animal {index + 1}</td>
                              <td className="border border-gray-300 py-2 px-3">
                                {liveWeights[index] !== undefined ? Number(liveWeights[index]).toFixed(1) : 'N/A'} kg
                              </td>
                              <td className="border border-gray-300 py-2 px-3">
                                {carcassWeights[index] !== undefined && carcassWeights[index] !== 0 ? 
                                  Number(carcassWeights[index]).toFixed(1) + ' kg' : 'N/A'}
                              </td>
                              <td className="border border-gray-300 py-2 px-3 font-medium text-green-700">
                                {prices[index] !== undefined ? formatCurrency(Number(prices[index])) : 'N/A'}
                              </td>
                            </tr>
                          ))}
                          
                          {/* Summary Row */}
                          <tr className="bg-gray-100 font-semibold">
                            <td className="border border-gray-300 py-2 px-3">Total/Average</td>
                            <td className="border border-gray-300 py-2 px-3">
                              {calculateAverage(viewingRecord.liveWeight).toFixed(1)} kg avg<br />
                              <span className="text-xs text-gray-600">
                                {calculateTotal(viewingRecord.liveWeight).toFixed(1)} kg total
                              </span>
                            </td>
                            <td className="border border-gray-300 py-2 px-3">
                              {viewingRecord.carcassWeight ? 
                                `${calculateAverage(viewingRecord.carcassWeight).toFixed(1)} kg avg` : 'N/A'
                              }
                              {viewingRecord.carcassWeight && (
                                <br />
                              )}
                              {viewingRecord.carcassWeight && (
                                <span className="text-xs text-gray-600">
                                  {calculateTotal(viewingRecord.carcassWeight).toFixed(1)} kg total
                                </span>
                              )}
                            </td>
                            <td className="border border-gray-300 py-2 px-3 text-green-700">
                              {formatCurrency(calculateAverage(viewingRecord.pricePerGoatAndSheep))} avg<br />
                              <span className="text-xs text-gray-600">
                                {formatCurrency(calculateTotal(viewingRecord.pricePerGoatAndSheep))} total
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>

              {/* Transaction Summary */}
              <div className="bg-slate-50 rounded-xl p-4">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  Transaction Summary
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
                    <Label className="text-sm font-medium text-slate-600 block mb-2">Number of Animals</Label>
                    <p className="text-slate-900 font-medium text-2xl font-bold text-blue-600">
                      {viewingRecord.noSheepGoats || 0}
                    </p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
                    <Label className="text-sm font-medium text-slate-600 block mb-2">Total Transaction Value</Label>
                    <p className="text-slate-900 font-medium text-2xl font-bold text-green-600">
                      {formatCurrency(viewingRecord.totalprice || 0)}
                    </p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
                    <Label className="text-sm font-medium text-slate-600 block mb-2">Average Price per Animal</Label>
                    <p className="text-slate-900 font-medium text-xl font-bold text-purple-600">
                      {formatCurrency(calculateAverage(viewingRecord.pricePerGoatAndSheep))}
                    </p>
                  </div>
                </div>
              </div>

              {/* Farmer Information */}
              <div className="bg-slate-50 rounded-xl p-4">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Farmer Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Farmer Name</Label>
                    <p className="text-slate-900 font-medium">{viewingRecord.farmerName || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Gender</Label>
                    <Badge className={
                      viewingRecord.gender?.toLowerCase() === 'male' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-pink-100 text-pink-800'
                    }>
                      {viewingRecord.gender || 'N/A'}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">ID Number</Label>
                    <p className="text-slate-900 font-medium font-mono">{viewingRecord.idNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Phone Number</Label>
                    <p className="text-slate-900 font-medium">{viewingRecord.phoneNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Region</Label>
                    <p className="text-slate-900 font-medium">{viewingRecord.region || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Location</Label>
                    <p className="text-slate-900 font-medium">{viewingRecord.location || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Transaction Date</Label>
                    <p className="text-slate-900 font-medium">{formatDate(viewingRecord.date)}</p>
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

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Edit className="h-5 w-5 text-blue-600" />
              Edit Record Data
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-date">Date</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={editForm.date}
                  onChange={(e) => setEditForm(prev => ({ ...prev, date: e.target.value }))}
                  className="bg-white border-slate-300"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-farmerName">Farmer Name</Label>
                <Input
                  id="edit-farmerName"
                  value={editForm.farmerName}
                  onChange={(e) => setEditForm(prev => ({ ...prev, farmerName: e.target.value }))}
                  className="bg-white border-slate-300"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-gender">Gender</Label>
                <Select value={editForm.gender} onValueChange={(value) => setEditForm(prev => ({ ...prev, gender: value }))}>
                  <SelectTrigger className="bg-white border-slate-300">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-idNumber">ID Number</Label>
                <Input
                  id="edit-idNumber"
                  value={editForm.idNumber}
                  onChange={(e) => setEditForm(prev => ({ ...prev, idNumber: e.target.value }))}
                  className="bg-white border-slate-300"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-phoneNumber">Phone Number</Label>
                <Input
                  id="edit-phoneNumber"
                  value={editForm.phoneNumber}
                  onChange={(e) => setEditForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  className="bg-white border-slate-300"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-region">Region</Label>
                <Input
                  id="edit-region"
                  value={editForm.region}
                  onChange={(e) => setEditForm(prev => ({ ...prev, region: e.target.value }))}
                  className="bg-white border-slate-300"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-location">Location</Label>
              <Input
                id="edit-location"
                value={editForm.location}
                onChange={(e) => setEditForm(prev => ({ ...prev, location: e.target.value }))}
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

      {/* Weight Edit Dialog */}
      <Dialog open={isWeightEditDialogOpen} onOpenChange={setIsWeightEditDialogOpen}>
        <DialogContent className="sm:max-w-2xl bg-white rounded-2xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Weight className="h-5 w-5 text-blue-600" />
              Edit Weights and Prices
            </DialogTitle>
            <DialogDescription>
              Edit live weights, carcass weights, and prices for each animal
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto max-h-[60vh]">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 text-sm">
                <thead>
                  <tr className="bg-blue-100">
                    <th className="border border-gray-300 py-2 px-3 font-medium text-gray-700 text-left">Animal #</th>
                    <th className="border border-gray-300 py-2 px-3 font-medium text-gray-700 text-left">Live Weight (kg)</th>
                    <th className="border border-gray-300 py-2 px-3 font-medium text-gray-700 text-left">Carcass Weight (kg)</th>
                    <th className="border border-gray-300 py-2 px-3 font-medium text-gray-700 text-left">Price (Ksh)</th>
                  </tr>
                </thead>
                <tbody>
                  {weightEditForm.liveWeights.map((_, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-300 py-2 px-3 font-medium">Animal {index + 1}</td>
                      <td className="border border-gray-300 py-2 px-3">
                        <Input
                          type="number"
                          step="0.1"
                          value={weightEditForm.liveWeights[index] || 0}
                          onChange={(e) => {
                            const newLiveWeights = [...weightEditForm.liveWeights];
                            newLiveWeights[index] = parseFloat(e.target.value) || 0;
                            setWeightEditForm(prev => ({ ...prev, liveWeights: newLiveWeights }));
                          }}
                          className="w-24"
                        />
                      </td>
                      <td className="border border-gray-300 py-2 px-3">
                        <Input
                          type="number"
                          step="0.1"
                          value={weightEditForm.carcassWeights[index] || 0}
                          onChange={(e) => {
                            const newCarcassWeights = [...weightEditForm.carcassWeights];
                            newCarcassWeights[index] = parseFloat(e.target.value) || 0;
                            setWeightEditForm(prev => ({ ...prev, carcassWeights: newCarcassWeights }));
                          }}
                          className="w-24"
                        />
                      </td>
                      <td className="border border-gray-300 py-2 px-3">
                        <Input
                          type="number"
                          step="1"
                          value={weightEditForm.prices[index] || 0}
                          onChange={(e) => {
                            const newPrices = [...weightEditForm.prices];
                            newPrices[index] = parseFloat(e.target.value) || 0;
                            setWeightEditForm(prev => ({ ...prev, prices: newPrices }));
                          }}
                          className="w-32"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsWeightEditDialogOpen(false)} className="border-slate-300">
              Cancel
            </Button>
            <Button onClick={handleWeightEditSubmit} className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LivestockOfftakePage;