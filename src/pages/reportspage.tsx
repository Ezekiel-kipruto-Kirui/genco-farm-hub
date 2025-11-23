import { useState, useEffect, useCallback, useMemo } from "react";
import { collection, getDocs, query, doc, setDoc, getDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area, Line } from "recharts";
import { Users, GraduationCap, Beef, Calendar, TrendingUp, Target, Award, Star, MapPin, Syringe, TargetIcon, UserCheck, Plus, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isChiefAdmin } from "./onboardingpage";
import { useAuth } from "@/contexts/AuthContext";

const COLORS = {
  darkBlue: "#1e3a8a",
  orange: "#f97316", 
  yellow: "#f59e0b",
  green: "#16a34a",
  maroon: "#991b1b",
  purple: "#7c3aed",
  teal: "#0d9488"
};

const BAR_COLORS = [COLORS.darkBlue, COLORS.orange, COLORS.yellow, COLORS.green, COLORS.purple, COLORS.teal];

interface OfftakeData {
  id: string;
  date: Date;
  farmerName: string;
  gender: string;
  idNumber: string;
  liveWeight: number;
  carcassWeight: number;
  location: string;
  noSheepGoats: number;
  phoneNumber: string;
  pricePerGoatAndSheep: number;
  region: string;
  totalprice: number;
}

interface User {
  id: string;
  name: string;
  email: string;
  region: string;
  monthlyTarget: number;
}

interface UserProgress {
  id: string;
  name: string;
  email: string;
  region: string;
  farmersRegistered: number;
  monthlyTarget: number;
  progressPercentage: number;
  status: 'achieved' | 'on-track' | 'behind' | 'needs-attention';
}

// Mock users data - Replace this with your actual user fetching logic
const MOCK_USERS = [
  { id: "user1", name: "John Doe", email: "john.doe@example.com", region: "", monthlyTarget: 117 },
  { id: "user2", name: "Jane Smith", email: "jane.smith@example.com", region: "", monthlyTarget: 117 },
  { id: "user3", name: "Mike Johnson", email: "mike.johnson@example.com", region: "", monthlyTarget: 117 },
  { id: "user4", name: "Sarah Wilson", email: "sarah.wilson@example.com", region: "", monthlyTarget: 117 },
  { id: "user5", name: "David Brown", email: "david.brown@example.com", region: "", monthlyTarget: 117 },
];

const PerformanceReport = () => {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [allFarmers, setAllFarmers] = useState<any[]>([]);
  const [trainingRecords, setTrainingRecords] = useState<any[]>([]);
  const [offtakeData, setOfftakeData] = useState<OfftakeData[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [allAvailableUsers, setAllAvailableUsers] = useState<User[]>([]);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({
    userId: "",
    name: "",
    email: "",
    region: "",
    monthlyTarget: 117
  });
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: ""
  });
  const [timeFrame, setTimeFrame] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const { toast } = useToast();

  // Function to fetch all available users
  const fetchAllAvailableUsers = async (): Promise<User[]> => {
    try {
      // Try to fetch from your users collection first
      const usersSnapshot = await getDocs(query(collection(db, "users")));
      
      if (!usersSnapshot.empty) {
        const usersData = usersSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || data.displayName || data.email?.split('@')[0] || 'Unknown User',
            email: data.email || '',
            region: data.region || data.assignedRegion || '',
            monthlyTarget: data.monthlyTarget || 117
          };
        }).filter(user => user.email); // Only include users with email
        
        return usersData;
      }
      
      // If no users found in Firestore, return mock users
      console.log("No users found in Firestore, using mock data");
      return MOCK_USERS;
      
    } catch (error) {
      console.error("Error fetching users:", error);
      // Return mock users as fallback
      return MOCK_USERS;
    }
  };

  // Function to fetch assigned users (users with regions)
  const fetchAssignedUsers = async (): Promise<User[]> => {
    try {
      const assignedUsersSnapshot = await getDocs(
        query(collection(db, "users"), where("region", "!=", ""))
      );
      
      if (!assignedUsersSnapshot.empty) {
        return assignedUsersSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || data.displayName || data.email?.split('@')[0] || 'Unknown User',
            email: data.email || '',
            region: data.region || data.assignedRegion || '',
            monthlyTarget: data.monthlyTarget || 117
          };
        });
      }
      return [];
    } catch (error) {
      console.error("Error fetching assigned users:", error);
      return [];
    }
  };

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

  // Helper function to get number field from various possible field names
  const getNumberField = (farmer: any, ...fieldNames: string[]): number => {
    for (const fieldName of fieldNames) {
      const value = farmer[fieldName];
      if (value !== undefined && value !== null && value !== '') {
        return Number(value) || 0;
      }
    }
    return 0;
  };

  // Helper function to check if a farmer is trained
  const checkIfFarmerTrained = (farmer: any, trainingRecords: any[]): boolean => {
    if (!farmer.phone && !farmer.phoneNo && !farmer.Phone && !farmer.name && !farmer.Name) return false;
    
    return trainingRecords.some(record => {
      const recordPhone = record.Phone?.toString().trim();
      const recordName = record.Name?.toString().toLowerCase().trim();
      
      const farmerPhone = (farmer.phone || farmer.phoneNo || farmer.Phone)?.toString().trim();
      const farmerName = (farmer.name || farmer.Name)?.toString().toLowerCase().trim();
      
      return (
        (recordPhone && farmerPhone && recordPhone === farmerPhone) ||
        (recordName && farmerName && recordName === farmerName)
      );
    });
  };

  // Memoized data calculations
  const { 
    filteredData, 
    genderData, 
    trainedGenderData, 
    registrationTrendData, 
    topOfftakeFarmers, 
    topLocations, 
    stats,
    regionStats,
    breedStats,
    vaccinationStats,
    userProgressData
  } = useMemo(() => {
    if (allFarmers.length === 0) {
      return {
        filteredData: [],
        genderData: [],
        trainedGenderData: [],
        registrationTrendData: [],
        topOfftakeFarmers: [],
        topLocations: [],
        stats: {
          totalFarmers: 0,
          maleFarmers: 0,
          femaleFarmers: 0,
          totalAnimals: 0,
          trainedFarmers: 0,
          trainedMale: 0,
          trainedFemale: 0,
          offtakeParticipants: 0
        },
        regionStats: {
          totalRegions: 0,
          farmersPerRegion: [],
          topPerformingRegion: { name: 'N/A', farmers: 0, percentage: 0 },
          averageFarmersPerRegion: 0
        },
        breedStats: {
          totalBreedsDistributed: 0,
          farmersReceivingBreeds: 0,
          breedDistribution: {
            newBreedFemales: 0,
            newBreedMales: 0,
            newBreedYoung: 0
          }
        },
        vaccinationStats: {
          vaccinatedAnimals: 0,
          totalAnimals: 0,
          vaccinationRate: 0,
          comment: "No data available"
        },
        userProgressData: []
      };
    }

    // Filter data based on date range
    const filtered = allFarmers.filter(farmer => {
      if (!dateRange.startDate && !dateRange.endDate) return true;
      
      const farmerDate = parseDate(farmer.dateSubmitted || farmer.createdAt || farmer.date);
      if (!farmerDate) return false;

      const farmerDateOnly = new Date(farmerDate);
      farmerDateOnly.setHours(0, 0, 0, 0);

      const start = dateRange.startDate ? new Date(dateRange.startDate) : null;
      const end = dateRange.endDate ? new Date(dateRange.endDate) : null;
      
      if (start) start.setHours(0, 0, 0, 0);
      if (end) end.setHours(23, 59, 59, 999);

      if (start && farmerDateOnly < start) return false;
      if (end && farmerDateOnly > end) return false;
      
      return true;
    });

    // Calculate basic stats
    const maleFarmers = filtered.filter(f => String(f.gender || f.Gender).toLowerCase() === 'male').length;
    const femaleFarmers = filtered.filter(f => String(f.gender || f.Gender).toLowerCase() === 'female').length;
    
    const trainedMale = filtered.filter(farmer => 
      checkIfFarmerTrained(farmer, trainingRecords) && String(farmer.gender || farmer.Gender).toLowerCase() === 'male'
    ).length;
    const trainedFemale = filtered.filter(farmer => 
      checkIfFarmerTrained(farmer, trainingRecords) && String(farmer.gender || farmer.Gender).toLowerCase() === 'female'
    ).length;
    
    const totalAnimals = filtered.reduce((sum, farmer) => 
      sum + parseInt(farmer.goatsMale || farmer.GoatsMale || farmer.maleGoats || 0) + 
          parseInt(farmer.goatsFemale || farmer.GoatsFemale || farmer.femaleGoats || 0), 0
    );

    // Region Statistics
    const regionMap: Record<string, number> = {};
    filtered.forEach(farmer => {
      const region = farmer.region || farmer.Region || farmer.county || farmer.County || 'Unknown';
      regionMap[region] = (regionMap[region] || 0) + 1;
    });

    const farmersPerRegion = Object.entries(regionMap)
      .map(([name, farmers]) => ({ name, farmers }))
      .sort((a, b) => b.farmers - a.farmers);

    const topPerformingRegion = farmersPerRegion[0] || { name: 'N/A', farmers: 0 };
    const averageFarmersPerRegion = farmersPerRegion.length > 0 
      ? farmersPerRegion.reduce((sum, region) => sum + region.farmers, 0) / farmersPerRegion.length 
      : 0;

    // Calculate regional performance percentage
    const totalFarmersInTopRegion = topPerformingRegion.farmers;
    const regionalPerformancePercentage = totalFarmersInTopRegion > 0 
      ? (totalFarmersInTopRegion / filtered.length) * 100 
      : 0;

    // Breed Distribution Statistics
    const breedDistribution = {
      newBreedFemales: filtered.reduce((sum, farmer) => sum + getNumberField(farmer, "newBreedFemales", "newBreedFemale"), 0),
      newBreedMales: filtered.reduce((sum, farmer) => sum + getNumberField(farmer, "newBreedMales", "newBreedMale"), 0),
      newBreedYoung: filtered.reduce((sum, farmer) => sum + getNumberField(farmer, "newBreedYoung", "newBreedYoungs"), 0)
    };

    const totalBreedsDistributed = breedDistribution.newBreedFemales + breedDistribution.newBreedMales + breedDistribution.newBreedYoung;
    
    const farmersReceivingBreeds = filtered.filter(farmer => 
      getNumberField(farmer, "numberOfBreeds", "NumberOfBreeds", "breeds", "totalBreeds") > 0 ||
      getNumberField(farmer, "newBreedFemales", "newBreedFemale") > 0 ||
      getNumberField(farmer, "newBreedMales", "newBreedMale") > 0 ||
      getNumberField(farmer, "newBreedYoung", "newBreedYoungs") > 0
    ).length;

    // Vaccination Statistics
    const vaccinatedAnimals = filtered.reduce((sum, farmer) => 
      sum + getNumberField(farmer, "vaccinatedAnimals", "vaccinated", "animalsVaccinated"), 0
    );
    
    const vaccinationRate = totalAnimals > 0 ? (vaccinatedAnimals / totalAnimals) * 100 : 0;
    
    let vaccinationComment = "No data available";
    if (totalAnimals > 0) {
      if (vaccinationRate < 50) {
        vaccinationComment = "Action needed";
      } else if (vaccinationRate >= 50 && vaccinationRate < 75) {
        vaccinationComment = "EVARGE action needed";
      } else {
        vaccinationComment = "Good progress";
      }
    }

    // User Progress Tracking - Only users with assigned regions
    const usersWithRegions = users.filter(user => user.region && user.region.trim() !== '');
    
    const userProgressData: UserProgress[] = usersWithRegions.map(user => {
      const farmersRegistered = filtered.filter(farmer => 
        farmer.region === user.region || farmer.Region === user.region
      ).length;

      const monthlyTarget = user.monthlyTarget || 117;
      const progressPercentage = (farmersRegistered / monthlyTarget) * 100;
      
      let status: UserProgress['status'] = 'needs-attention';
      if (progressPercentage >= 100) {
        status = 'achieved';
      } else if (progressPercentage >= 75) {
        status = 'on-track';
      } else if (progressPercentage >= 50) {
        status = 'behind';
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        region: user.region,
        farmersRegistered,
        monthlyTarget,
        progressPercentage,
        status
      };
    }).sort((a, b) => b.progressPercentage - a.progressPercentage);

    // Generate trend data based on time frame
    const generateTrendData = () => {
      const trendData: any[] = [];
      
      if (timeFrame === 'weekly') {
        for (let week = 1; week <= 4; week++) {
          const weekStart = new Date();
          weekStart.setDate(weekStart.getDate() - ((4 - week) * 7));
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          
          const weekRegistrations = filtered.filter(farmer => {
            const farmerDate = parseDate(farmer.dateSubmitted || farmer.createdAt || farmer.date);
            return farmerDate && farmerDate >= weekStart && farmerDate <= weekEnd;
          }).length;

          trendData.push({
            name: `Week ${week}`,
            registrations: weekRegistrations,
            target: Math.round(filtered.length / 4)
          });
        }
      } else if (timeFrame === 'monthly') {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        months.forEach((month, index) => {
          const monthStart = new Date(2024, index, 1);
          const monthEnd = new Date(2024, index + 1, 0);
          
          const monthRegistrations = filtered.filter(farmer => {
            const farmerDate = parseDate(farmer.dateSubmitted || farmer.createdAt || farmer.date);
            return farmerDate && farmerDate >= monthStart && farmerDate <= monthEnd;
          }).length;

          trendData.push({
            name: month,
            registrations: monthRegistrations,
            target: Math.round(filtered.length / 12)
          });
        });
      } else {
        const currentYear = new Date().getFullYear();
        for (let year = currentYear - 4; year <= currentYear; year++) {
          const yearStart = new Date(year, 0, 1);
          const yearEnd = new Date(year, 11, 31);
          
          const yearRegistrations = filtered.filter(farmer => {
            const farmerDate = parseDate(farmer.dateSubmitted || farmer.createdAt || farmer.date);
            return farmerDate && farmerDate >= yearStart && farmerDate <= yearEnd;
          }).length;

          trendData.push({
            name: year.toString(),
            registrations: yearRegistrations,
            target: Math.round(filtered.length / 5)
          });
        }
      }

      return trendData;
    };

    // Generate top performers
    const generateTopOfftakeFarmers = () => {
      const farmerSales: Record<string, number> = {};
      
      offtakeData.forEach(record => {
        const farmerKey = record.farmerName || record.idNumber;
        if (farmerKey) {
          farmerSales[farmerKey] = (farmerSales[farmerKey] || 0) + record.noSheepGoats;
        }
      });

      return Object.entries(farmerSales)
        .map(([name, animals]) => ({ name, animals }))
        .sort((a, b) => b.animals - a.animals)
        .slice(0, 4);
    };

    const generateTopLocations = () => {
      const locationSales: Record<string, number> = {};
      
      offtakeData.forEach(record => {
        const location = record.location || 'Unknown';
        locationSales[location] = (locationSales[location] || 0) + record.noSheepGoats;
      });

      return Object.entries(locationSales)
        .map(([name, animals]) => ({ name, animals }))
        .sort((a, b) => b.animals - a.animals)
        .slice(0, 4);
    };

    const trendData = generateTrendData();
    const topFarmers = generateTopOfftakeFarmers();
    const topLocs = generateTopLocations();

    return {
      filteredData: filtered,
      genderData: [
        { name: "Male", value: maleFarmers, color: COLORS.darkBlue },
        { name: "Female", value: femaleFarmers, color: COLORS.orange },
      ],
      trainedGenderData: [
        { name: "Male", value: trainedMale, color: COLORS.yellow },
        { name: "Female", value: trainedFemale, color: COLORS.maroon },
      ],
      registrationTrendData: trendData,
      topOfftakeFarmers: topFarmers,
      topLocations: topLocs,
      stats: {
        totalFarmers: filtered.length,
        maleFarmers,
        femaleFarmers,
        totalAnimals,
        trainedFarmers: trainedMale + trainedFemale,
        trainedMale,
        trainedFemale,
        offtakeParticipants: offtakeData.length
      },
      regionStats: {
        totalRegions: farmersPerRegion.length,
        farmersPerRegion,
        topPerformingRegion: {
          ...topPerformingRegion,
          percentage: regionalPerformancePercentage
        },
        averageFarmersPerRegion
      },
      breedStats: {
        totalBreedsDistributed,
        farmersReceivingBreeds,
        breedDistribution
      },
      vaccinationStats: {
        vaccinatedAnimals,
        totalAnimals,
        vaccinationRate,
        comment: vaccinationComment
      },
      userProgressData
    };
  }, [allFarmers, dateRange, timeFrame, trainingRecords, offtakeData, users]);

  // Fetch all data on component mount
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [farmersSnapshot, trainingSnapshot, offtakeSnapshot, availableUsers, assignedUsers] = await Promise.all([
        getDocs(query(collection(db, "Livestock Farmers"))),
        getDocs(query(collection(db, "Capacity Building"))),
        getDocs(query(collection(db, "Livestock Offtake Data"))),
        fetchAllAvailableUsers(), // Prefetch all available users
        fetchAssignedUsers() // Fetch assigned users
      ]);

      const farmersData = farmersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const trainingData = trainingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const processedOfftakeData: OfftakeData[] = offtakeSnapshot.docs.map((doc, index) => {
        const item = doc.data();
        const dateValue = item.date?.toDate?.() || new Date(item.date) || new Date();

        return {
          id: item.id || `temp-${index}-${Date.now()}`,
          date: dateValue,
          farmerName: item.farmerName || item.farmername || item.farmer_name || item.name || '',
          gender: item.gender || item.Gender || '',
          idNumber: item.idNumber || item.idnumber || item.id_number || item.IDNumber || '',
          liveWeight: Number(item.liveWeight || item.live_weight || item.weight || 0),
          carcassWeight: Number(item.carcassWeight || item.carcass_weight || 0),
          location: item.location || item.Location || item.area || item.Area || '',
          noSheepGoats: Number(item.noSheepGoats || item.nosheepgoats || item.no_sheep_goats || item.quantity || item.animals || 0),
          phoneNumber: item.phoneNumber || item.phonenumber || item.phone_number || item.phone || item.Phone || '',
          pricePerGoatAndSheep: Number(item.pricePerGoatAndSheep || item.price_per_goat_sheep || item.price || 0),
          region: item.region || item.Region || item.county || item.County || '',
          totalprice: Number(item.totalprice || item.totalPrice || item.total_price || item.sheepGoatPrice || 0),
        };
      });

      setAllFarmers(farmersData);
      setTrainingRecords(trainingData);
      setOfftakeData(processedOfftakeData);
      setAllAvailableUsers(availableUsers);
      setUsers(assignedUsers);
      
    } catch (error) {
      console.error("Error fetching data:", error);
      // Set mock data as fallback
      setAllAvailableUsers(MOCK_USERS);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUserFormChange = (field: string, value: string) => {
    setUserForm(prev => ({
      ...prev,
      [field]: value
    }));

    // When user is selected from dropdown, auto-fill name and email
    if (field === "userId" && value) {
      const selectedUser = allAvailableUsers.find(user => user.id === value);
      if (selectedUser) {
        setUserForm(prev => ({
          ...prev,
          userId: value,
          name: selectedUser.name,
          email: selectedUser.email
        }));
      }
    }
  };

  const handleAddUser = async () => {
    try {
      if (!userForm.userId || !userForm.region) {
        toast({
          title: "Validation Error",
          description: "Please select a user and assign a region",
          variant: "destructive",
        });
        return;
      }

      const selectedUserData = allAvailableUsers.find(user => user.id === userForm.userId);
      if (!selectedUserData) {
        toast({
          title: "Error",
          description: "Selected user not found",
          variant: "destructive",
        });
        return;
      }

      const userData = {
        name: selectedUserData.name,
        email: selectedUserData.email,
        region: userForm.region,
        monthlyTarget: userForm.monthlyTarget,
        updatedAt: new Date()
      };

      if (selectedUser) {
        // Update existing user assignment
        await setDoc(doc(db, "users", selectedUser.id), userData, { merge: true });
        toast({
          title: "Success",
          description: "User assignment updated successfully",
        });
      } else {
        // Assign region to new user
        await setDoc(doc(db, "users", userForm.userId), userData, { merge: true });
        toast({
          title: "Success",
          description: "User assigned to region successfully",
        });
      }

      setUserForm({
        userId: "",
        name: "",
        email: "",
        region: "",
        monthlyTarget: 117
      });
      setSelectedUser(null);
      setIsUserDialogOpen(false);
      fetchAllData(); // Refresh data
    } catch (error) {
      console.error("Error saving user assignment:", error);
      toast({
        title: "Error",
        description: "Failed to assign user to region",
        variant: "destructive",
      });
    }
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setUserForm({
      userId: user.id,
      name: user.name,
      email: user.email,
      region: user.region,
      monthlyTarget: user.monthlyTarget
    });
    setIsUserDialogOpen(true);
  };

  const openAddUserDialog = () => {
    setSelectedUser(null);
    setUserForm({
      userId: "",
      name: "",
      email: "",
      region: "",
      monthlyTarget: 117
    });
    setIsUserDialogOpen(true);
  };

  const getPerformanceRecommendation = () => {
    if (registrationTrendData.length === 0) return { text: "No data available", color: "gray" };
    
    const currentRegistrations = registrationTrendData[registrationTrendData.length - 1]?.registrations || 0;
    const averageRegistrations = registrationTrendData.reduce((sum, item) => sum + item.registrations, 0) / registrationTrendData.length;
    
    if (currentRegistrations > averageRegistrations * 1.2) {
      return { text: "Excellent Progress - Above Target", color: "green" };
    } else if (currentRegistrations >= averageRegistrations * 0.8) {
      return { text: "Average Performance - Action Needed", color: "yellow" };
    } else {
      return { text: "Poor Performance - Immediate Action Required", color: "red" };
    }
  };

  const handleDateRangeChange = (key: string, value: string) => {
    setDateRange(prev => ({ ...prev, [key]: value }));
  };

  const setWeekFilter = () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const endOfWeek = new Date(now);
    endOfWeek.setDate(now.getDate() + (6 - now.getDay()));
    
    setDateRange({
      startDate: startOfWeek.toISOString().split('T')[0],
      endDate: endOfWeek.toISOString().split('T')[0]
    });
    setTimeFrame('weekly');
  };

  const setMonthFilter = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    setDateRange({
      startDate: startOfMonth.toISOString().split('T')[0],
      endDate: endOfMonth.toISOString().split('T')[0]
    });
    setTimeFrame('monthly');
  };

  const clearFilters = () => {
    setDateRange({ startDate: "", endDate: "" });
    setTimeFrame('monthly');
  };

  const setTimeFrameFilter = (frame: 'weekly' | 'monthly' | 'yearly') => {
    setTimeFrame(frame);
  };

  // Custom label renderer for doughnut charts
  const renderCustomizedLabel = useCallback(({
    cx, cy, midAngle, innerRadius, outerRadius, percent
  }: any) => {
    if (percent === 0) return null;
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize="12"
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  }, []);

  // Stats Card Component
  const StatsCard = ({ title, value, icon: Icon, description, color = "blue", children }: any) => (
    <Card className="relative overflow-hidden group hover:shadow-xl transition-all duration-300 border-0 bg-gradient-to-br from-white to-gray-50">
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${
        color === 'blue' ? 'bg-blue-500' :
        color === 'orange' ? 'bg-orange-500' :
        color === 'yellow' ? 'bg-yellow-500' :
        color === 'green' ? 'bg-green-500' :
        color === 'red' ? 'bg-red-500' : 
        color === 'purple' ? 'bg-purple-500' :
        color === 'teal' ? 'bg-teal-500' : 'bg-blue-500'
      }`}></div>
      
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 pl-6">
        <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
        <div className={`p-2 rounded-xl ${
          color === 'blue' ? 'bg-blue-100' :
          color === 'orange' ? 'bg-orange-100' :
          color === 'yellow' ? 'bg-yellow-100' :
          color === 'green' ? 'bg-green-100' :
          color === 'red' ? 'bg-red-100' : 
          color === 'purple' ? 'bg-purple-100' :
          color === 'teal' ? 'bg-teal-100' : 'bg-blue-100'
        } shadow-sm`}>
          <Icon className={`h-4 w-4 ${
            color === 'blue' ? 'text-blue-600' :
            color === 'orange' ? 'text-orange-600' :
            color === 'yellow' ? 'text-yellow-600' :
            color === 'green' ? 'text-green-600' :
            color === 'red' ? 'text-red-600' : 
            color === 'purple' ? 'text-purple-600' :
            color === 'teal' ? 'text-teal-600' : 'text-blue-600'
          }`} />
        </div>
      </CardHeader>
      <CardContent className="-2 pl-6 pb-4">
        <div className=" grid grid-cols-2 text-2xl font-bold text-gray-900">{value}</div>
        {description && (
          <p className=" grid grid-cols-2 text-xs text-gray-500 mt-2 font-medium">
            {description}
          </p>
        )}
        {children}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        <p className="ml-2 text-gray-600">Loading analytics data...</p>
      </div>
    );
  }

  const performanceRecommendation = getPerformanceRecommendation();

  // Get unique regions for dropdown
  const uniqueRegions = Array.from(new Set(allFarmers.map(farmer => 
    farmer.region || farmer.Region || farmer.county || farmer.County
  ).filter(Boolean)));

  // Get users not yet assigned to any region for the dropdown
  const unassignedUsers = allAvailableUsers.filter(availableUser => 
    !users.some(assignedUser => assignedUser.id === availableUser.id)
  );

  return (
    <div className="space-y-6 p-1">
      {/* Header and Filters */}
      <div className="flex flex-col justify-between items-start gap-4">
        <h1 className="text-xl font-bold text-gray-900">Performance Dashboard</h1>

        {/* Date Range Filter */}
        <Card className="w-full lg:w-auto border-0 shadow-lg bg-white">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4 items-end">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate" className="text-sm font-medium text-gray-700">From Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => handleDateRangeChange("startDate", e.target.value)}
                    className="border-gray-200 focus:border-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate" className="text-sm font-medium text-gray-700">To Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => handleDateRangeChange("endDate", e.target.value)}
                    className="border-gray-200 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={setWeekFilter} className="text-xs">
                  This Week
                </Button>
                <Button variant="outline" onClick={setMonthFilter} className="text-xs">
                  This Month
                </Button>
                <Button onClick={clearFilters} variant="outline" className="text-xs">
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard 
          title="Total Farmers" 
          value={stats.totalFarmers} 
          icon={Users}
          description={`${stats.maleFarmers} male, ${stats.femaleFarmers} female`}
          color="blue"
        />

        <StatsCard 
          title="Animal Census" 
          value={stats.totalAnimals.toLocaleString()} 
          icon={Beef}
          description="Total livestock registered"
          color="orange"
        />

        <StatsCard 
          title="Trained Farmers" 
          value={stats.trainedFarmers} 
          icon={GraduationCap}
          description={`${stats.trainedMale} male, ${stats.trainedFemale} female trained`}
          color="yellow"
        />

        <StatsCard 
          title="Offtake Participants" 
          value={stats.offtakeParticipants} 
          icon={Award}
          description={`${((stats.offtakeParticipants / stats.totalFarmers) * 100).toFixed(1)}% participation rate`}
          color="green"
        />

        {/* Regional Performance Card with detailed region breakdown */}
    
<StatsCard 
  title="Regional Coverage" 
  value={regionStats.totalRegions} 
  icon={MapPin}
  //description={`${stats.totalFarmers} farmers across regions`}
  color="purple"
>
  <div className="mt-3">
    <div className="grid grid-cols-2 gap-1.5 max-h-24 overflow-y-auto">
      {regionStats.farmersPerRegion.slice(0, 8).map((region, index) => (
        <div 
          key={region.name} 
          className="flex flex-col-2 gap-2 bg-gray-50 rounded border border-gray-100 hover:bg-gray-100 transition-colors"
        >
          <span className="text-[10px] font-light text-gray-600 truncate leading-tight">
            {region.name}
          </span>
          <div className="flex justify-between items-center mt-0.5">
            <span className="text-[9px] text-gray-800">
              {region.farmers}
            </span>
          </div>
        </div>
      ))}
    </div>
    {regionStats.farmersPerRegion.length > 8 && (
      <div className="text-[10px] text-gray-500 text-center mt-2 font-light">
        +{regionStats.farmersPerRegion.length - 8} more regions
      </div>
    )}
  </div>
</StatsCard>

        <StatsCard 
          title="Breeds Distributed" 
          value={breedStats.totalBreedsDistributed.toLocaleString()} 
          icon={TargetIcon}
          description={`${breedStats.farmersReceivingBreeds} farmers received breeds`}
          color="teal"
        />

        <StatsCard 
          title="Farmers with Breeds" 
          value={breedStats.farmersReceivingBreeds} 
          icon={UserCheck}
          description={`${((breedStats.farmersReceivingBreeds / stats.totalFarmers) * 100).toFixed(1)}% of total farmers`}
          color="blue"
        />

        <StatsCard 
          title="Vaccination Coverage" 
          value={`${vaccinationStats.vaccinationRate.toFixed(1)}%`} 
          icon={Syringe}
          description={`${vaccinationStats.comment} - ${vaccinationStats.vaccinatedAnimals.toLocaleString()} animals`}
          color={vaccinationStats.vaccinationRate >= 75 ? "green" : vaccinationStats.vaccinationRate >= 50 ? "yellow" : "red"}
        />
      </div>

      {/* User Management and Progress Table - Only shows users with assigned regions */}
      <Card className="border-0 shadow-lg bg-white">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-md flex items-center gap-2 text-gray-800">
              <UserCheck className="h-5 w-5 text-blue-600" />
              Field Officers Assignment & Progress (Monthly Target: 117 farmers)
            </CardTitle>

            {isChiefAdmin(userRole) &&
            (<Button onClick={openAddUserDialog} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Assign User
            </Button>)}
            
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Field Officer</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Assigned Region</TableHead>
                <TableHead>Farmers Registered</TableHead>
                <TableHead>Monthly Target</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {userProgressData.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="text-sm text-gray-600">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                      {user.region}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold">{user.farmersRegistered}</TableCell>
                  <TableCell>{user.monthlyTarget}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            user.status === 'achieved' ? 'bg-green-500' :
                            user.status === 'on-track' ? 'bg-blue-500' :
                            user.status === 'behind' ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(user.progressPercentage, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600">{user.progressPercentage.toFixed(1)}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={
                        user.status === 'achieved' ? 'default' :
                        user.status === 'on-track' ? 'secondary' :
                        user.status === 'behind' ? 'outline' :
                        'destructive'
                      }
                      className={
                        user.status === 'achieved' ? 'bg-green-100 text-green-800' :
                        user.status === 'on-track' ? 'bg-blue-100 text-blue-800' :
                        user.status === 'behind' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }
                    >
                      {user.status === 'achieved' ? 'Target Achieved' :
                       user.status === 'on-track' ? 'On Track' :
                       user.status === 'behind' ? 'Behind Schedule' :
                       'Needs Attention'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                   
                      {isChiefAdmin(userRole) && ( 
                        <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditUser(user as any)}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>)}

                  </TableCell>
                </TableRow>
              ))}
              {userProgressData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    No users assigned to regions yet. Click "Assign User" to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* User Assignment Dialog */}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedUser ? "Edit User Assignment" : "Assign User to Region"}
            </DialogTitle>
            <DialogDescription>
              {selectedUser 
                ? "Update the region assignment and target for this user."
                : "Select a user and assign them to a region with a monthly target."
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="userSelect">Select User *</Label>
              <Select 
                value={userForm.userId} 
                onValueChange={(value) => handleUserFormChange("userId", value)}
                disabled={!!selectedUser}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a user to assign" />
                </SelectTrigger>
                <SelectContent>
                  {selectedUser ? (
                    <SelectItem value={selectedUser.id}>
                      {selectedUser.name} ({selectedUser.email})
                    </SelectItem>
                  ) : (
                    unassignedUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {!selectedUser && unassignedUsers.length === 0 && (
                <p className="text-xs text-gray-500">No unassigned users available.</p>
              )}
            </div>

            {userForm.userId && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="userName">User Name</Label>
                  <Input
                    id="userName"
                    value={userForm.name}
                    disabled
                    className="bg-gray-50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="userEmail">Email</Label>
                  <Input
                    id="userEmail"
                    type="email"
                    value={userForm.email}
                    disabled
                    className="bg-gray-50"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="userRegion">Assigned Region *</Label>
              <Select value={userForm.region} onValueChange={(value) => handleUserFormChange("region", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a region" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueRegions.map((region) => (
                    <SelectItem key={region} value={region}>
                      {region}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="monthlyTarget">Monthly Target</Label>
              <Input
                id="monthlyTarget"
                type="number"
                value={userForm.monthlyTarget}
                onChange={(e) => handleUserFormChange("monthlyTarget", e.target.value)}
                placeholder="117"
              />
              <p className="text-xs text-gray-500">Default target is 117 farmers per month</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUserDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddUser} disabled={!userForm.userId || !userForm.region}>
              {selectedUser ? "Update" : "Assign"} User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rest of the charts remain the same */}
      {/* Charts Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Gender Distribution */}
        <Card className="border-0 shadow-lg bg-white">
          <CardHeader className="pb-4">
            <CardTitle className="text-md flex items-center gap-2 text-gray-800">
              <Users className="h-5 w-5 text-blue-600" />
              Farmers by Gender
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={genderData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={renderCustomizedLabel}
                  labelLine={false}
                >
                  {genderData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [value, "Farmers"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Trained Farmers by Gender */}
        <Card className="border-0 shadow-lg bg-white">
          <CardHeader className="pb-4">
            <CardTitle className="text-md flex items-center gap-2 text-gray-800">
              <GraduationCap className="h-5 w-5 text-yellow-600" />
              Trained Farmers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={trainedGenderData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={renderCustomizedLabel}
                  labelLine={false}
                >
                  {trainedGenderData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [value, "Farmers"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Registration Trend and Top Performers */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Registration Trend Chart */}
        <Card className="border-0 shadow-lg bg-white">
          <CardHeader className="pb-4">
            <div className="flex justify-between items-center">
              <CardTitle className="text-md flex items-center gap-2 text-gray-800">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                Farmers Registration Trend
              </CardTitle>
              <div className="flex gap-2">
                <Button 
                  variant={timeFrame === 'weekly' ? 'default' : 'outline'} 
                  size="sm" 
                  onClick={() => setTimeFrameFilter('weekly')}
                  className="text-xs h-8"
                >
                  Weekly
                </Button>
                <Button 
                  variant={timeFrame === 'monthly' ? 'default' : 'outline'} 
                  size="sm" 
                  onClick={() => setTimeFrameFilter('monthly')}
                  className="text-xs h-8"
                >
                  Monthly
                </Button>
                <Button 
                  variant={timeFrame === 'yearly' ? 'default' : 'outline'} 
                  size="sm" 
                  onClick={() => setTimeFrameFilter('yearly')}
                  className="text-xs h-8"
                >
                  Yearly
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={registrationTrendData}>
                <defs>
                  <linearGradient id="colorRegistrations" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.darkBlue} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={COLORS.darkBlue} stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Area 
                  type="monotone" 
                  dataKey="registrations" 
                  stroke={COLORS.darkBlue} 
                  fillOpacity={1} 
                  fill="url(#colorRegistrations)" 
                  name="Actual Registrations"
                />
                <Line 
                  type="monotone" 
                  dataKey="target" 
                  stroke={COLORS.orange} 
                  strokeDasharray="5 5"
                  name="Target"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className={`mt-4 p-3 rounded-lg ${
              performanceRecommendation.color === 'green' ? 'bg-green-50 border-green-200' :
              performanceRecommendation.color === 'yellow' ? 'bg-yellow-50 border-yellow-200' :
              'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center gap-2">
                <Star className={`h-4 w-4 ${
                  performanceRecommendation.color === 'green' ? 'text-green-600' :
                  performanceRecommendation.color === 'yellow' ? 'text-yellow-600' :
                  'text-red-600'
                }`} />
                <span className={`text-sm font-medium ${
                  performanceRecommendation.color === 'green' ? 'text-green-800' :
                  performanceRecommendation.color === 'yellow' ? 'text-yellow-800' :
                  'text-red-800'
                }`}>
                  {performanceRecommendation.text}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Performers */}
        <div className="space-y-6">
          {/* Top Offtake Farmers */}
          <Card className="border-0 shadow-lg bg-white">
            <CardHeader className="pb-4">
              <CardTitle className="text-md flex items-center gap-2 text-gray-800">
                <Award className="h-5 w-5 text-blue-600" />
                Top Offtake Farmers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart
                  data={topOfftakeFarmers}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f3f4f6" />
                  <XAxis 
                    type="number" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    width={90}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#374151' }}
                  />
                  <Tooltip 
                    formatter={(value) => [`${value} animals`, 'Animals Sold']}
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  />
                  <Bar 
                    dataKey="animals" 
                    radius={[0, 4, 4, 0]}
                    barSize={10}
                  >
                    {topOfftakeFarmers.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top Locations */}
          <Card className="border-0 shadow-lg bg-white">
            <CardHeader className="pb-4">
              <CardTitle className="text-md flex items-center gap-2 text-gray-800">
                <Award className="h-5 w-5 text-orange-600" />
                Top Locations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart
                  data={topLocations}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f3f4f6" />
                  <XAxis 
                    type="number" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    width={90}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#374151' }}
                  />
                  <Tooltip 
                    formatter={(value) => [`${value} animals`, 'Total Sales']}
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  />
                  <Bar 
                    dataKey="animals" 
                    radius={[0, 4, 4, 0]}
                    barSize={10}
                  >
                    {topLocations.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PerformanceReport;