import { useState, useEffect, useCallback, useMemo } from "react";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area, Line } from "recharts";
import { Users, GraduationCap, Beef, Calendar, TrendingUp, Target, Award, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const COLORS = {
  darkBlue: "#1e3a8a",
  orange: "#f97316", 
  yellow: "#f59e0b",
  green: "#16a34a",
  maroon: "#991b1b"
};

const BAR_COLORS = [COLORS.darkBlue, COLORS.orange, COLORS.yellow, COLORS.green];

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

const PerformanceReport = () => {
  const [loading, setLoading] = useState(true);
  const [allFarmers, setAllFarmers] = useState<any[]>([]);
  const [trainingRecords, setTrainingRecords] = useState<any[]>([]);
  const [offtakeData, setOfftakeData] = useState<OfftakeData[]>([]);
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: ""
  });
  const [timeFrame, setTimeFrame] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');

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
  const { filteredData, genderData, trainedGenderData, registrationTrendData, topOfftakeFarmers, topLocations, stats } = useMemo(() => {
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
        }
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

    // Calculate stats
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

    // Generate trend data based on time frame
    const generateTrendData = () => {
      const trendData: any[] = [];
      
      if (timeFrame === 'weekly') {
        // Generate exactly 4 weeks of data
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
      }
    };
  }, [allFarmers, dateRange, timeFrame, trainingRecords, offtakeData]);

  // Fetch all data on component mount
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      
      const [farmersSnapshot, trainingSnapshot, offtakeSnapshot] = await Promise.all([
        getDocs(query(collection(db, "Livestock Farmers"))),
        getDocs(query(collection(db, "Capacity Building"))),
        getDocs(query(collection(db, "Livestock Offtake Data")))
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
      
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
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
  const StatsCard = ({ title, value, icon: Icon, description, color = "blue" }: any) => (
    <Card className="relative overflow-hidden group hover:shadow-xl transition-all duration-300 border-0 bg-gradient-to-br from-white to-gray-50">
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${
        color === 'blue' ? 'bg-blue-500' :
        color === 'orange' ? 'bg-orange-500' :
        color === 'yellow' ? 'bg-yellow-500' :
        color === 'green' ? 'bg-green-500' :
        color === 'red' ? 'bg-red-500' : 'bg-blue-500'
      }`}></div>
      
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 pl-6">
        <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
        <div className={`p-2 rounded-xl ${
          color === 'blue' ? 'bg-blue-100' :
          color === 'orange' ? 'bg-orange-100' :
          color === 'yellow' ? 'bg-yellow-100' :
          color === 'green' ? 'bg-green-100' :
          color === 'red' ? 'bg-red-100' : 'bg-blue-100'
        } shadow-sm`}>
          <Icon className={`h-4 w-4 ${
            color === 'blue' ? 'text-blue-600' :
            color === 'orange' ? 'text-orange-600' :
            color === 'yellow' ? 'text-yellow-600' :
            color === 'green' ? 'text-green-600' :
            color === 'red' ? 'text-red-600' : 'text-blue-600'
          }`} />
        </div>
      </CardHeader>
      <CardContent className="pl-6 pb-4">
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        {description && (
          <p className="text-xs text-gray-500 mt-2 font-medium">
            {description}
          </p>
        )}
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

  return (
    <div className="space-y-6 p-1">
      {/* Header and Filters */}
      <div className="flex flex-col justify-between items-start  gap-4">
    
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
      <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-4">
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

        {/* <StatsCard 
          title="Performance" 
          value={performanceRecommendation.text.split(' - ')[0]} 
          icon={performanceRecommendation.color === 'green' ? TrendingUp : performanceRecommendation.color === 'red' ? Award : Target}
          description={performanceRecommendation.text.split(' - ')[1]}
          color={performanceRecommendation.color === 'green' ? 'blue' : performanceRecommendation.color === 'red' ? 'red' : 'yellow'}
        /> */}
      </div>

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