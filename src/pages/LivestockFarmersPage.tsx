import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { collection, getDocs, query, updateDoc, doc, deleteDoc, writeBatch } from "firebase/firestore";
import { db,fetchData } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Download, Users, Beef, Edit, Trash2, GraduationCap, Eye, MapPin, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Types
interface Farmer {
  id: string;
  name?: string;
  gender?: string;
  phone?: string;
  farmerId?: string;
  createdAt?: any;
  IdNo?: string;
  date?: any;
  location?: string;
  county?: string;
  subcounty?: string;
  region?: string;
  goatsMale?: number;
  goatsFemale?: number;
  maleGoats?: number;
  femaleGoats?: number;
  numberOfBreeds?: number;
  newBreedFemales?: number;
  newBreedMales?: number;
  newBreedYoung?: number;
  vaccineType?: string;
  vaccinationDate?: any;
  dewormingDate?: any;
  dippingDate?: any;
  dewormingSchedule?: string;
  vaccineDate?: any;
  trained?: boolean;
  trainingDate?: any;
  trainingType?: string;
  Weight1?: string;
  Weight2?: string;
  Weight3?: string;
  Weight4?: string;
  Weight5?: string;
  Weight6?: string;
  Weight7?: string;
  dateSubmitted?: any;
  phoneNo?: string;
  rangeFirst?: string;
  rangeForth?: string;
  rangeSecond?: string;
  rangeThird?: string;
  traceability?: string;
  idNo?: string;
}

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
  region: string;
}

interface Stats {
  totalFarmers: number;
  maleFarmers: number;
  femaleFarmers: number;
  totalGoats: number;
  trainedFarmers: number;
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
  IdNo: string;
  date: string;
  gender: string;
  numberOfBreeds: string;
  location: string;
  goatsMale: string;
  goatsFemale: string;
  trained: boolean;
  trainingDate: string;
}

// Constants
const PAGE_LIMIT = 15;
const EXPORT_HEADERS = [
  'Date', 'Farmer Name', 'Gender', 'Farmer ID', 'Phone', 'Location', 
  'Number of goats', 'Vaccine', 'Vaccine Date', 'Training Status', 'Breeds',
  'County', 'Subcounty', 'Region', 'Male Goats', 'Female Goats', 'Total Goats',
  'New Breed Males', 'New Breed Females', 'New Breed Young', 'Deworming Schedule',
  'Dipping Date', 'Deworming Date', 'Training Date', 'Training Type', 'Traceability',
  'Weight1', 'Weight2', 'Weight3', 'Weight4', 'Weight5', 'Weight6', 'Weight7',
  'Range First', 'Range Second', 'Range Third', 'Range Forth'
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

const LivestockFarmersPage = () => {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const [allFarmers, setAllFarmers] = useState<Farmer[]>([]);
  const [trainingRecords, setTrainingRecords] = useState<TrainingRecord[]>([]);
  const [filteredFarmers, setFilteredFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [selectedFarmers, setSelectedFarmers] = useState<string[]>([]);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingFarmer, setViewingFarmer] = useState<Farmer | null>(null);
  const [editingFarmer, setEditingFarmer] = useState<Farmer | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  const currentMonth = useMemo(getCurrentMonthDates, []);

  const [filters, setFilters] = useState<Filters>({
    search: "",
    gender: "all",
    startDate: currentMonth.startDate,
    endDate: currentMonth.endDate,
    location: "all",
    region: "all"
  });

  const [stats, setStats] = useState<Stats>({
    totalFarmers: 0,
    maleFarmers: 0,
    femaleFarmers: 0,
    totalGoats: 0,
    trainedFarmers: 0
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
    IdNo: "",
    date: "",
    gender: "",
    numberOfBreeds: "",
    location: "",
    goatsMale: "",
    goatsFemale: "",
    trained: false,
    trainingDate: ""
  });
  // Data fetching
  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch livestock farmers
      const farmersQuery = query(collection(db, "Livestock Farmers"));
      const farmersSnapshot = await getDocs(farmersQuery);
      console.log(farmersSnapshot)
      // Fetch training records from Capacity Building
      const trainingQuery = query(collection(db, "Capacity Building"));
      const trainingSnapshot = await getDocs(trainingQuery);

      const farmersData = farmersSnapshot.docs.map(doc => {
        const data = doc.data();
        
        // Helper function to get field value with fallbacks
        const getField = (primary: string, ...fallbacks: string[]) => {
          for (const field of [primary, ...fallbacks]) {
            const value = data[field];
            if (value !== undefined && value !== null && value !== "") return value;
          }
          return "";
        };

        const getNumberField = (primary: string, ...fallbacks: string[]) => {
          const value = getField(primary, ...fallbacks);
          return parseInt(value) || 0;
        };

        return {
          id: doc.id,
          // Personal Information
          name: getField("name", "Name"),
          gender: getField("gender", "Gender"),
          phone: getField("phone", "Phone", "phoneNo"),
          farmerId: getField("farmerId", "FarmerID", "id"),
          IdNo: getField("IdNo", "idNo", "farmerId"),
          date: getField("date", "createdAt", "timestamp", "dateSubmitted"),
          createdAt: getField("dateSubmitted", "date", "timestamp"),
          
          // Location Information
          location: getField("location", "Location", "area", "county", "region"),
          county: getField("county", "County", "region"),
          subcounty: getField("subcounty", "Subcounty", "district"),
          region: getField("region"),
          
          // Livestock Information
          goatsMale: getNumberField("goatsMale", "GoatsMale", "maleGoats", "goats_male"),
          goatsFemale: getNumberField("femaleGoats", "female_goats", "goats_female"),
          maleGoats: getNumberField("maleGoats", "goatsMale"),
          femaleGoats: getNumberField("femaleGoats", "goatsFemale"),
          numberOfBreeds: getNumberField("numberOfBreeds", "NumberOfBreeds", "breeds", "totalBreeds"),
          newBreedFemales: getNumberField("newBreedFemales"),
          newBreedMales: getNumberField("newBreedMales"),
          newBreedYoung: getNumberField("newBreedYoung"),
          
          // Health Information
          vaccineType: getField("vaccineType", "VaccineType"),
          vaccinationDate: getField("vaccineDate", "vaccinationDate", "VaccinationDate"),
          dewormingDate: getField("dewormingDate", "DewormingDate", "deworm_date"),
          dippingDate: getField("dippingDate", "DippingDate", "dip_date"),
          dewormingSchedule: getField("dewormingSchedule"),
          vaccineDate: getField("vaccineDate", "vaccinationDate"),

          // Training Information
          trained: Boolean(getField("trained", "Trained")),
          trainingDate: getField("trainingDate", "TrainingDate"),
          trainingType: getField("trainingType", "TrainingType"),

          // Additional fields
          Weight1: getField("Weight1"),
          Weight2: getField("Weight2"),
          Weight3: getField("Weight3"),
          Weight4: getField("Weight4"),
          Weight5: getField("Weight5"),
          Weight6: getField("Weight6"),
          Weight7: getField("Weight7"),
          dateSubmitted: getField("dateSubmitted"),
          phoneNo: getField("phoneNo"),
          rangeFirst: getField("rangeFirst"),
          rangeForth: getField("rangeForth"),
          rangeSecond: getField("rangeSecond"),
          rangeThird: getField("rangeThird"),
          traceability: getField("traceability"),
          idNo: getField("idNo"),
        };
      });

      // Process training records
      const trainingData = trainingSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
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

      setAllFarmers(farmersData);
      setTrainingRecords(trainingData);
      
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to load data from database",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Function to check if a farmer is trained (exists in Capacity Building)
  const isFarmerTrained = useCallback((farmer: Farmer): boolean => {
    if (!farmer.phone) return false;
    
    // Check if farmer exists in training records by phone number
    return trainingRecords.some(record => 
      record.Phone === farmer.phone || record.Phone === farmer.phoneNo
    );
  }, [trainingRecords]);

  // Function to get training details for a farmer
  const getFarmerTrainingDetails = useCallback((farmer: Farmer): TrainingRecord | null => {
    if (!farmer.phone) return null;
    
    const trainingRecord = trainingRecords.find(record => 
      record.Phone === farmer.phone || record.Phone === farmer.phoneNo
    );
    
    return trainingRecord || null;
  }, [trainingRecords]);

  // Filter application
  const applyFilters = useCallback(() => {
    if (allFarmers.length === 0) return;

    let filtered = allFarmers.filter(farmer => {
      // Gender filter
      if (filters.gender !== "all" && farmer.gender?.toLowerCase() !== filters.gender.toLowerCase()) {
        return false;
      }

      // Region filter
      if (filters.region !== "all" && farmer.region?.toLowerCase() !== filters.region.toLowerCase()) {
        return false;
      }

      // Location filter (dependent on region)
      if (filters.location !== "all") {
        if (filters.region !== "all") {
          // If region is selected, location must match both region and location
          if (farmer.region?.toLowerCase() !== filters.region.toLowerCase() || 
              farmer.location?.toLowerCase() !== filters.location.toLowerCase()) {
            return false;
          }
        } else {
          // If no region selected, just match location
          if (farmer.location?.toLowerCase() !== filters.location.toLowerCase()) {
            return false;
          }
        }
      }

      // Date filter
      if (filters.startDate || filters.endDate) {
        const farmerDate = parseDate(farmer.dateSubmitted) || parseDate(farmer.createdAt) || parseDate(farmer.date);
        if (farmerDate) {
          const farmerDateOnly = new Date(farmerDate);
          farmerDateOnly.setHours(0, 0, 0, 0);

          const startDate = filters.startDate ? new Date(filters.startDate) : null;
          const endDate = filters.endDate ? new Date(filters.endDate) : null;
          if (startDate) startDate.setHours(0, 0, 0, 0);
          if (endDate) endDate.setHours(23, 59, 59, 999);

          if (startDate && farmerDateOnly < startDate) return false;
          if (endDate && farmerDateOnly > endDate) return false;
        }
      }

      // Search filter
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        const searchMatch = [
          farmer.name, farmer.gender, farmer.farmerId, farmer.IdNo, 
          farmer.phone, farmer.phoneNo, farmer.location, farmer.vaccineType, farmer.trainingType
        ].some(field => field?.toLowerCase().includes(searchTerm));
        if (!searchMatch) return false;
      }

      return true;
    });

    setFilteredFarmers(filtered);
    
    // Update stats - now using training records from Capacity Building
    const maleFarmers = filtered.filter(f => f.gender?.toLowerCase() === 'male').length;
    const femaleFarmers = filtered.filter(f => f.gender?.toLowerCase() === 'female').length;
    const totalGoats = filtered.reduce((sum, farmer) => 
      sum + (farmer.goatsMale || 0) + (farmer.goatsFemale || 0) + (farmer.maleGoats || 0) + (farmer.femaleGoats || 0), 0);
    
    // Count trained farmers from Capacity Building records
    const trainedFarmers = filtered.filter(farmer => isFarmerTrained(farmer)).length;

    setStats({
      totalFarmers: filtered.length,
      maleFarmers,
      femaleFarmers,
      totalGoats,
      trainedFarmers
    });

    // Update pagination
    const totalPages = Math.ceil(filtered.length / pagination.limit);
    setPagination(prev => ({
      ...prev,
      totalPages,
      hasNext: prev.page < totalPages,
      hasPrev: prev.page > 1
    }));
  }, [allFarmers, filters, pagination.limit, isFarmerTrained]);

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
      
      if (filteredFarmers.length === 0) {
        toast({
          title: "No Data to Export",
          description: "There are no records matching your current filters",
          variant: "destructive",
        });
        return;
      }

      const csvData = filteredFarmers.map(farmer => {
        const totalGoats = (farmer.goatsMale || 0) + (farmer.goatsFemale || 0) + (farmer.maleGoats || 0) + (farmer.femaleGoats || 0);
        const isTrained = isFarmerTrained(farmer);
        const trainingDetails = getFarmerTrainingDetails(farmer);

        return [
          formatDate(farmer.dateSubmitted || farmer.createdAt),
          farmer.name || 'N/A',
          farmer.gender || 'N/A',
          farmer.farmerId || farmer.IdNo || farmer.idNo || 'N/A',
          farmer.phone || farmer.phoneNo || 'N/A',
          farmer.location || farmer.region || farmer.county || 'N/A',
          totalGoats.toString(),
          farmer.vaccineType || 'N/A',
          formatDate(farmer.vaccineDate || farmer.vaccinationDate),
          isTrained ? 'Trained' : 'Not Trained',
          (farmer.numberOfBreeds || 0).toString(),
          farmer.county || 'N/A',
          farmer.subcounty || 'N/A',
          farmer.region || 'N/A',
          (farmer.goatsMale || farmer.maleGoats || 0).toString(),
          (farmer.goatsFemale || farmer.femaleGoats || 0).toString(),
          totalGoats.toString(),
          (farmer.newBreedMales || 0).toString(),
          (farmer.newBreedFemales || 0).toString(),
          (farmer.newBreedYoung || 0).toString(),
          farmer.dewormingSchedule || 'N/A',
          formatDate(farmer.dippingDate),
          formatDate(farmer.dewormingDate),
          formatDate(trainingDetails?.date || trainingDetails?.timestamp),
          trainingDetails?.Modules || 'N/A',
          farmer.traceability || 'N/A',
          farmer.Weight1 || 'N/A',
          farmer.Weight2 || 'N/A',
          farmer.Weight3 || 'N/A',
          farmer.Weight4 || 'N/A',
          farmer.Weight5 || 'N/A',
          farmer.Weight6 || 'N/A',
          farmer.Weight7 || 'N/A',
          farmer.rangeFirst || 'N/A',
          farmer.rangeSecond || 'N/A',
          farmer.rangeThird || 'N/A',
          farmer.rangeForth || 'N/A'
        ];
      });

      const csvContent = [EXPORT_HEADERS, ...csvData]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      let filename = `livestock-farmers`;
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
        description: `Exported ${filteredFarmers.length} records with applied filters`,
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

  const getCurrentPageFarmers = useCallback(() => {
    const startIndex = (pagination.page - 1) * pagination.limit;
    const endIndex = startIndex + pagination.limit;
    return filteredFarmers.slice(startIndex, endIndex);
  }, [filteredFarmers, pagination.page, pagination.limit]);

  const handleSelectFarmer = (farmerId: string) => {
    setSelectedFarmers(prev =>
      prev.includes(farmerId)
        ? prev.filter(id => id !== farmerId)
        : [...prev, farmerId]
    );
  };

  const handleSelectAll = () => {
    const currentPageIds = getCurrentPageFarmers().map(f => f.id);
    setSelectedFarmers(prev =>
      prev.length === currentPageIds.length ? [] : currentPageIds
    );
  };

  const openEditDialog = (farmer: Farmer) => {
    setEditingFarmer(farmer);
    setEditForm({
      name: farmer.name || "",
      IdNo: farmer.IdNo || farmer.farmerId || farmer.idNo || "",
      date: farmer.dateSubmitted ? (parseDate(farmer.dateSubmitted)?.toISOString().split('T')[0] || "") : "",
      gender: farmer.gender || "",
      numberOfBreeds: (farmer.numberOfBreeds || 0).toString(),
      location: farmer.location || farmer.region || "",
      goatsMale: (farmer.goatsMale || farmer.maleGoats || 0).toString(),
      goatsFemale: (farmer.goatsFemale || farmer.femaleGoats || 0).toString(),
      trained: isFarmerTrained(farmer),
      trainingDate: ""
    });
    setIsEditDialogOpen(true);
  };

  const openViewDialog = (farmer: Farmer) => {
    setViewingFarmer(farmer);
    setIsViewDialogOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editingFarmer) return;
    
    try {
      
      const farmerRef = doc(db, "Livestock Farmers", editingFarmer.id);
    
      const updateData = {
        name: editForm.name,
        IdNo: editForm.IdNo,
        dateSubmitted: editForm.date ? new Date(editForm.date) : null,
        gender: editForm.gender,
        numberOfBreeds: parseInt(editForm.numberOfBreeds) || 0,
        location: editForm.location,
        goatsMale: parseInt(editForm.goatsMale) || 0,
        goatsFemale: parseInt(editForm.goatsFemale) || 0,
        trained: editForm.trained,
        trainingDate: editForm.trainingDate ? new Date(editForm.trainingDate) : null,
        Name: editForm.name,
        FarmerID: editForm.IdNo,
        Gender: editForm.gender,
        NumberOfBreeds: parseInt(editForm.numberOfBreeds) || 0,
        Location: editForm.location,
        GoatsMale: parseInt(editForm.goatsMale) || 0,
        GoatsFemale: parseInt(editForm.goatsFemale) || 0,
        Trained: editForm.trained,
        TrainingDate: editForm.trainingDate ? new Date(editForm.trainingDate) : null
      };

      await updateDoc(farmerRef, updateData);

      toast({
        title: "Success",
        description: "Farmer data updated successfully",
      });

      setIsEditDialogOpen(false);
      setEditingFarmer(null);
      fetchAllData();
    } catch (error) {
      console.error("Error updating farmer:", error);
      toast({
        title: "Error",
        description: "Failed to update farmer data",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedFarmers.length === 0) return;

    try {
      setDeleteLoading(true);
      const batch = writeBatch(db);

      selectedFarmers.forEach(farmerId => {
        const docRef = doc(db, "Livestock Farmers", farmerId);
        batch.delete(docRef);
      });

      await batch.commit();

      toast({
        title: "Success",
        description: `Deleted ${selectedFarmers.length} records successfully`,
      });

      setSelectedFarmers([]);
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
    [...new Set(allFarmers.map(f => f.region).filter(Boolean))],
    [allFarmers]
  );

  const uniqueLocations = useMemo(() => {
    if (filters.region === "all") {
      return [...new Set(allFarmers.map(f => f.location).filter(Boolean))];
    } else {
      return [...new Set(
        allFarmers
          .filter(f => f.region?.toLowerCase() === filters.region.toLowerCase())
          .map(f => f.location)
          .filter(Boolean)
      )];
    }
  }, [allFarmers, filters.region]);

  const currentPageFarmers = useMemo(getCurrentPageFarmers, [getCurrentPageFarmers]);

  const clearAllFilters = () => {
    setFilters({
      search: "",
      gender: "all",
      startDate: "",
      endDate: "",
      location: "all",
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
          placeholder="Search farmers..."
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
            <SelectItem value="male">Male Only</SelectItem>
            <SelectItem value="female">Female Only</SelectItem>
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

  const TableRow = ({ farmer }: { farmer: Farmer }) => {
    const totalGoats = (farmer.goatsMale || 0) + (farmer.goatsFemale || 0) + (farmer.maleGoats || 0) + (farmer.femaleGoats || 0);
    const isTrained = isFarmerTrained(farmer);
    const trainingDetails = getFarmerTrainingDetails(farmer);
    
    return (
      <tr className="border-b hover:bg-blue-50 transition-all duration-200 group text-sm">
        <td className="py-2 px-4 ml-2">
          <Checkbox
            checked={selectedFarmers.includes(farmer.id)}
            onCheckedChange={() => handleSelectFarmer(farmer.id)}
          />
        </td>
        <td className="py-2 px-4">{formatDate(farmer.dateSubmitted || farmer.createdAt)}</td>
        <td className="py-2 px-4 text-sm">{farmer.name || 'N/A'}</td>
        <td className="py-2 px-4">{farmer.gender || 'N/A'}</td>
        <td className="py-2 px-4">
          <code className="text-sm bg-gray-100 px-2 py-1 rounded text-gray-700">
            {farmer.farmerId || farmer.IdNo || farmer.idNo || 'N/A'}
          </code>
        </td>
        <td className="py-2 px-4 text-sm text-gray-600">{farmer.phone || farmer.phoneNo || 'N/A'}</td>
        <td className="py-2 px-4">{farmer.location || farmer.region || farmer.county || 'N/A'}</td>
        <td className="py-2 px-4">{farmer.region || 'N/A'}</td>
        <td className="py-2 px-4">
          <span className="text-xs font-bold text-gray-700">{totalGoats}</span>
        </td>
        <td className="py-2 px-4">{farmer.vaccineType || 'N/A'}</td>
        <td className="py-2 px-4 text-sm text-gray-600">
          {formatDate(farmer.vaccineDate || farmer.vaccinationDate)}
        </td>
        <td className="py-2 px-4">
          <Badge className={isTrained ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
            {isTrained ? 'Trained' : 'Not Trained'}
          </Badge>
        </td>
        <td className="py-2 px-4">{farmer.numberOfBreeds || 0}</td>
        <td className="py-2 px-4">
         <div className="flex gap-2">
  <Button
    variant="outline"
    size="sm"
    onClick={() => openViewDialog(farmer)}
    className="h-5 w-5 p-0 hover:bg-green-50 hover:text-green-600 border-green-200"
  >
    <Eye className="h-3 w-3 text-green-500" />
  </Button>

  <Button
    variant="outline"
    size="sm"
    onClick={() => openEditDialog(farmer)}
    className="h-5 w-5 p-0 hover:bg-blue-50 hover:text-blue-600 border-blue-200"
  >
    <Edit className="h-3 w-3 text-blue-500" />
  </Button>

  <Button
    variant="outline"
    size="sm"
    onClick={() => handleSelectFarmer(farmer.id)}
    className="h-5 w-5 p-0 hover:bg-red-50 hover:text-red-600 border-red-200"
  >
    <Trash2 className="h-3 w-3 text-red-500" />
  </Button>
</div>

        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with Action Buttons */}
      <div className="flex md:flex-row flex-col justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-md font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Livestock Farmers 
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
            disabled={exportLoading || filteredFarmers.length === 0}
            className="bg-gradient-to-r from-blue-800 to-purple-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-md text-xs"
          >
            <Download className="h-4 w-4 mr-2" />
            {exportLoading ? "Exporting..." : `Export (${filteredFarmers.length})`}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard 
          title="Total Farmers" 
          value={stats.totalFarmers} 
          icon={Users}
        >
          <div className="flex gap-4 justify-between text-xs text-slate-600 mt-2">
            <span>Male: {stats.maleFarmers}</span>
            <span>Female: {stats.femaleFarmers}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-600 mt-1">
            <span>{(stats.maleFarmers > 0 ? (stats.maleFarmers / stats.totalFarmers * 100).toFixed(1) : '0')}%</span>
            <span>{(stats.femaleFarmers > 0 ? (stats.femaleFarmers / stats.totalFarmers * 100).toFixed(1) : '0')}%</span>
          </div>
        </StatsCard>

        <StatsCard 
          title="Animal census" 
          value={stats.totalGoats} 
          icon={Beef}
          description="Across all farmers"
        />

        <StatsCard 
          title="Trained Farmers" 
          value={stats.trainedFarmers} 
          icon={GraduationCap}
          description={`${stats.totalFarmers > 0 ? ((stats.trainedFarmers / stats.totalFarmers) * 100).toFixed(1) : '0'}% of total farmers`}
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
              <p className="text-muted-foreground mt-2">Loading farmer data...</p>
            </div>
          ) : currentPageFarmers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {allFarmers.length === 0 ? "No farmer data found" : "No records found matching your criteria"}
            </div>
          ) : (
            <>
              <div className="w-full overflow-x-auto rounded-md">
                <table className=" w-full2borde4-collapse border border-gray-300 text-sm text-left whitespace-nowrap ">
                  <thead className="rounded">
                    <tr className="bg-blue-100 p-1 px-3">
                      <th className="py-2 px-4 ml-2">
                        <Checkbox

                          checked={selectedFarmers.length === currentPageFarmers.length && currentPageFarmers.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </th>
                      <th className="text-left py-2  px-4 font-medium text-gray-600">Date</th>
                      <th className="text-left py-2  px-4 font-medium text-gray-600">Farmer Name</th>
                      <th className="text-left py-2  px-4 font-medium text-gray-600">Gender</th>
                      <th className="text-left py-2  px-4 font-medium text-gray-600">Farmer ID</th>
                      <th className="text-left py-2  px-4 font-medium text-gray-600">Phone</th>
                      <th className="text-left py-2  px-4 font-medium text-gray-600">Location</th>
                      <th className="text-left py-2  px-4 font-medium text-gray-600">Region</th>
                      <th className="text-left py-2  px-4 font-medium text-gray-600">Number of goats</th>
                      <th className="text-left py-2  px-4 font-medium text-gray-600">Vaccine</th>
                      <th className="text-left py-2  px-4 font-medium text-gray-600">Vaccine Date</th>
                      <th className="text-left py-2  px-4 font-medium text-gray-600">Training Status</th>
                      <th className="text-left py-2  px-4 font-medium text-gray-600">Breeds</th>
                      <th className="text-left py-2  px-4 font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentPageFarmers.map((farmer) => (
                      <TableRow key={farmer.id} farmer={farmer} />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between p-4 border-t bg-gray-50">
                <div className="text-sm text-muted-foreground">
                  {filteredFarmers.length} total records • {currentPageFarmers.length} on this page
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

      {/* View Farmer Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-2xl bg-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Eye className="h-5 w-5 text-green-600" />
              Farmer Details
            </DialogTitle>
            <DialogDescription>
              Complete information for this livestock farmer
            </DialogDescription>
          </DialogHeader>
          {viewingFarmer && (
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
                    <p className="text-slate-900 font-medium">{viewingFarmer.name || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Gender</Label>
                    <p className="text-slate-900 font-medium">{viewingFarmer.gender || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Phone</Label>
                    <p className="text-slate-900 font-medium">{viewingFarmer.phone || viewingFarmer.phoneNo || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Farmer ID</Label>
                    <p className="text-slate-900 font-medium font-mono">{viewingFarmer.farmerId || viewingFarmer.IdNo || viewingFarmer.idNo || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Date Registered</Label>
                    <p className="text-slate-900 font-medium">{formatDate(viewingFarmer.dateSubmitted || viewingFarmer.createdAt)}</p>
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
                    <p className="text-slate-900 font-medium">{viewingFarmer.location || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Region</Label>
                    <p className="text-slate-900 font-medium">{viewingFarmer.region || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">County</Label>
                    <p className="text-slate-900 font-medium">{viewingFarmer.county || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Subcounty</Label>
                    <p className="text-slate-900 font-medium">{viewingFarmer.subcounty || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Livestock Information */}
              <div className="bg-slate-50 rounded-xl p-4">
                <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <Beef className="h-4 w-4" />
                  Livestock Information
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Male Goats</Label>
                    <p className="text-slate-900 font-medium">{(viewingFarmer.goatsMale || viewingFarmer.maleGoats || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Female Goats</Label>
                    <p className="text-slate-900 font-medium">{(viewingFarmer.goatsFemale || viewingFarmer.femaleGoats || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Total Goats</Label>
                    <p className="text-slate-900 font-medium text-lg font-bold">
                      {((viewingFarmer.goatsMale || 0) + (viewingFarmer.goatsFemale || 0) + (viewingFarmer.maleGoats || 0) + (viewingFarmer.femaleGoats || 0)).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Number of Breeds</Label>
                    <p className="text-slate-900 font-medium">{viewingFarmer.numberOfBreeds || 0}</p>
                  </div>
                </div>
              </div>

              {/* Training Information */}
              <div className="bg-slate-50 rounded-xl p-4">
                <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  Training Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Training Status</Label>
                    <Badge className={isFarmerTrained(viewingFarmer) ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                      {isFarmerTrained(viewingFarmer) ? 'Trained' : 'Not Trained'}
                    </Badge>
                  </div>
                  {isFarmerTrained(viewingFarmer) && (
                    <>
                      <div>
                        <Label className="text-sm font-medium text-slate-600">Training Date</Label>
                        <p className="text-slate-900 font-medium">
                          {formatDate(getFarmerTrainingDetails(viewingFarmer)?.date || getFarmerTrainingDetails(viewingFarmer)?.timestamp)}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-slate-600">Training Modules</Label>
                        <p className="text-slate-900 font-medium">{getFarmerTrainingDetails(viewingFarmer)?.Modules || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-slate-600">Training Location</Label>
                        <p className="text-slate-900 font-medium">{getFarmerTrainingDetails(viewingFarmer)?.Location || 'N/A'}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Health Information */}
              <div className="bg-slate-50 rounded-xl p-4">
                <h3 className="font-semibold text-slate-800 mb-3">Health Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Vaccine Type</Label>
                    <p className="text-slate-900 font-medium">{viewingFarmer.vaccineType || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Vaccine Date</Label>
                    <p className="text-slate-900 font-medium">{formatDate(viewingFarmer.vaccineDate || viewingFarmer.vaccinationDate)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Deworming Date</Label>
                    <p className="text-slate-900 font-medium">{formatDate(viewingFarmer.dewormingDate)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Dipping Date</Label>
                    <p className="text-slate-900 font-medium">{formatDate(viewingFarmer.dippingDate)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Deworming Schedule</Label>
                    <p className="text-slate-900 font-medium">{viewingFarmer.dewormingSchedule || 'N/A'}</p>
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
              Edit Farmer Data
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Farmer Name</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  className="bg-white border-slate-300"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-id">ID Number</Label>
                <Input
                  id="edit-id"
                  value={editForm.IdNo}
                  onChange={(e) => setEditForm(prev => ({ ...prev, IdNo: e.target.value }))}
                  className="bg-white border-slate-300"
                />
              </div>
            </div>
            
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-breeds">Number of Breeds</Label>
                <Input
                  id="edit-breeds"
                  type="number"
                  value={editForm.numberOfBreeds}
                  onChange={(e) => setEditForm(prev => ({ ...prev, numberOfBreeds: e.target.value }))}
                  className="bg-white border-slate-300"
                />
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-goats-male">Male Goats</Label>
                <Input
                  id="edit-goats-male"
                  type="number"
                  value={editForm.goatsMale}
                  onChange={(e) => setEditForm(prev => ({ ...prev, goatsMale: e.target.value }))}
                  className="bg-white border-slate-300"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-goats-female">Female Goats</Label>
                <Input
                  id="edit-goats-female"
                  type="number"
                  value={editForm.goatsFemale}
                  onChange={(e) => setEditForm(prev => ({ ...prev, goatsFemale: e.target.value }))}
                  className="bg-white border-slate-300"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 flex items-center gap-2">
                <Checkbox
                  id="edit-trained"
                  checked={editForm.trained}
                  onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, trained: checked as boolean }))}
                />
                <Label htmlFor="edit-trained" className="cursor-pointer">Trained Farmer</Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-training-date">Training Date</Label>
                <Input
                  id="edit-training-date"
                  type="date"
                  value={editForm.trainingDate}
                  onChange={(e) => setEditForm(prev => ({ ...prev, trainingDate: e.target.value }))}
                  className="bg-white border-slate-300"
                  disabled
                />
              </div>
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
    </div>
  );
};

export default LivestockFarmersPage;