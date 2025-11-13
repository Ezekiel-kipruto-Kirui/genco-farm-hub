import { useState, useEffect } from "react";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area, LineChart, Line, ComposedChart } from "recharts";
import { Users, GraduationCap, Beef, Calendar, TrendingUp, Target, BarChart3, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const COLORS = {
  orange: "hsl(25 95% 53%)",
  navy: "hsl(221 83% 53%)",
  green: "hsl(142 76% 36%)",
  blue: "hsl(217 91% 60%)",
  purple: "hsl(272 91% 65%)",
  red: "hsl(0 84% 60%)",
  teal: "hsl(173 80% 40%)",
  amber: "hsl(45 93% 47%)",
  indigo: "hsl(239 84% 67%)"
};

const LivestockFarmersAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [allFarmers, setAllFarmers] = useState<any[]>([]);
  const [trainingRecords, setTrainingRecords] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [genderData, setGenderData] = useState<any[]>([]);
  const [regionData, setRegionData] = useState<any[]>([]);
  const [goatsData, setGoatsData] = useState<any[]>([]);
  const [trainingComparisonData, setTrainingComparisonData] = useState<any[]>([]);
  const [trainingTrendData, setTrainingTrendData] = useState<any[]>([]);
  const [regionalComparisonData, setRegionalComparisonData] = useState<any[]>([]);
  const [stats, setStats] = useState({ 
    total: 0, 
    trained: 0, 
    totalAnimals: 0,
    trainingRate: 0,
    maleFarmers: 0,
    femaleFarmers: 0,
    totalTrainedFromCapacity: 0
  });
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: ""
  });

  // Fetch all data on component mount
  useEffect(() => {
    fetchAllData();
  }, []);

  // Apply filters whenever dateRange changes
  useEffect(() => {
    if (allFarmers.length > 0 && trainingRecords.length > 0) {
      applyFilters();
    }
  }, [dateRange, allFarmers, trainingRecords]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      
      // Fetch livestock farmers
      const farmersQuery = query(collection(db, "Livestock Farmers"));
      const farmersSnapshot = await getDocs(farmersQuery);
      
      // Fetch training records from Capacity Building
      const trainingQuery = query(collection(db, "Capacity Building"));
      const trainingSnapshot = await getDocs(trainingQuery);

      const farmersData = farmersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const trainingData = trainingSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setAllFarmers(farmersData);
      setTrainingRecords(trainingData);
      
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Function to check if a farmer is trained (exists in Capacity Building)
  const isFarmerTrained = (farmer: any): boolean => {
    if (!farmer.phone && !farmer.phoneNo && !farmer.Phone && !farmer.name) return false;
    
    // Check if farmer exists in training records by phone number or name
    return trainingRecords.some(record => 
      record.Phone === farmer.phone || 
      record.Phone === farmer.phoneNo ||
      record.Phone === farmer.Phone ||
      (record.Name && farmer.name && record.Name.toLowerCase() === farmer.name.toLowerCase()) ||
      (record.Name && farmer.Name && record.Name.toLowerCase() === farmer.Name.toLowerCase())
    );
  };

  // Function to get total trained farmers from Capacity Building (all records)
  const getTotalTrainedFromCapacityBuilding = (): number => {
    return trainingRecords.length;
  };

  const getCurrentWeekDates = () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const endOfWeek = new Date(now);
    endOfWeek.setDate(now.getDate() + (6 - now.getDay()));
    
    return {
      startDate: startOfWeek.toISOString().split('T')[0],
      endDate: endOfWeek.toISOString().split('T')[0]
    };
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

  const isDateInRange = (date: any, startDate: string, endDate: string): boolean => {
    if (!startDate && !endDate) return true;
    
    const farmerDate = parseDate(date);
    if (!farmerDate) return false;

    const farmerDateOnly = new Date(farmerDate);
    farmerDateOnly.setHours(0, 0, 0, 0);

    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    
    if (start) start.setHours(0, 0, 0, 0);
    if (end) end.setHours(23, 59, 59, 999);

    if (start && farmerDateOnly < start) return false;
    if (end && farmerDateOnly > end) return false;
    
    return true;
  };

  const applyFilters = () => {
    const filtered = allFarmers.filter(farmer => 
      isDateInRange(
        farmer.dateSubmitted || farmer.createdAt || farmer.date, 
        dateRange.startDate, 
        dateRange.endDate
      )
    );

    setFilteredData(filtered);
    updateAnalytics(filtered);
  };

  const updateAnalytics = (data: any[]) => {
    // Gender distribution
    const male = data.filter(f => 
      String(f.gender || f.Gender).toLowerCase() === 'male'
    ).length;
    const female = data.filter(f => 
      String(f.gender || f.Gender).toLowerCase() === 'female'
    ).length;

    // Trained farmers from Capacity Building - count unique farmers who are trained
    const trained = data.filter(farmer => isFarmerTrained(farmer)).length;
    
    // Total trained farmers from Capacity Building (all records)
    const totalTrainedFromCapacity = getTotalTrainedFromCapacityBuilding();
    
    const notTrained = data.length - trained;
    const trainingRate = data.length > 0 ? (trained / data.length) * 100 : 0;

    // Animal census
    let totalMaleGoats = 0;
    let totalFemaleGoats = 0;
    data.forEach(farmer => {
      totalMaleGoats += parseInt(farmer.goatsMale || farmer.GoatsMale || farmer.maleGoats || 0);
      totalFemaleGoats += parseInt(farmer.goatsFemale || farmer.GoatsFemale || farmer.femaleGoats || 0);
    });
    const totalAnimals = totalMaleGoats + totalFemaleGoats;

    setStats({ 
      total: data.length, 
      trained, 
      totalAnimals,
      trainingRate,
      maleFarmers: male,
      femaleFarmers: female,
      totalTrainedFromCapacity
    });

    // Gender data for doughnut chart
    setGenderData([
      { name: "Male", value: male, color: COLORS.orange },
      { name: "Female", value: female, color: COLORS.navy },
    ]);

    // Goats data for doughnut chart
    setGoatsData([
      { name: "Male Goats", value: totalMaleGoats, color: COLORS.orange },
      { name: "Female Goats", value: totalFemaleGoats, color: COLORS.navy },
    ]);

    // Training comparison data
    setTrainingComparisonData([
      { name: "Trained", value: trained, color: COLORS.green },
      { name: "Not Trained", value: notTrained, color: COLORS.red },
    ]);

    // Training trend data (monthly) - using actual training records data
    const monthlyTraining = generateMonthlyTrainingData();
    setTrainingTrendData(monthlyTraining);

    // Region distribution with multiple curves
    const regionalComparison = generateRegionalComparisonData(data);
    setRegionalComparisonData(regionalComparison);

    // Simple region data for bar chart
    const regionCount: Record<string, number> = {};
    data.forEach(farmer => {
      const region = String(farmer.region || farmer.Region || farmer.location || "Unknown");
      regionCount[region] = (regionCount[region] || 0) + 1;
    });
    
    const regionChartData = Object.entries(regionCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    setRegionData(regionChartData);
  };

  const generateMonthlyTrainingData = () => {
    // Group training records by month
    const monthlyCount: Record<string, number> = {};
    
    trainingRecords.forEach(record => {
      const date = parseDate(record.date || record.timestamp);
      if (date) {
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyCount[monthYear] = (monthlyCount[monthYear] || 0) + 1;
      }
    });

    // Convert to chart data format
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyData = months.map((month, index) => {
      const monthKey = `2024-${String(index + 1).padStart(2, '0')}`;
      return {
        name: month,
        trained: monthlyCount[monthKey] || 0,
      };
    });

    return monthlyData;
  };

  const generateRegionalComparisonData = (data: any[]) => {
    // Get top regions
    const regionCount: Record<string, number> = {};
    data.forEach(farmer => {
      const region = String(farmer.region || farmer.Region || farmer.location || "Unknown");
      regionCount[region] = (regionCount[region] || 0) + 1;
    });

    const topRegions = Object.entries(regionCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name]) => name);

    // Generate data for each region over time (simulated for demo)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return months.map(month => {
      const regionData: any = { name: month };
      topRegions.forEach((region, index) => {
        // Simulate growth data for each region
        const baseValue = Math.floor(regionCount[region] * 0.1);
        const growth = Math.floor(Math.random() * 10) + 1;
        regionData[region] = baseValue + growth;
      });
      return regionData;
    });
  };

  const handleDateRangeChange = (key: string, value: string) => {
    setDateRange(prev => ({ ...prev, [key]: value }));
  };

  const setWeekFilter = () => {
    const weekDates = getCurrentWeekDates();
    setDateRange(weekDates);
  };

  const setMonthFilter = () => {
    const monthDates = getCurrentMonthDates();
    setDateRange(monthDates);
  };

  const clearFilters = () => {
    setDateRange({ startDate: "", endDate: "" });
  };

  // Custom label renderer for doughnut charts
  const renderCustomizedLabel = ({
    cx, cy, midAngle, innerRadius, outerRadius, percent
  }: any) => {
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
  };

  // Modern Stats Card Component
  const StatsCard = ({ title, value, icon: Icon, description, trend, color = "blue", badge }: any) => {
    const colorConfig = {
      blue: { bg: "from-blue-500 to-blue-600", iconBg: "bg-blue-100", iconColor: "text-blue-600" },
      green: { bg: "from-green-500 to-green-600", iconBg: "bg-green-100", iconColor: "text-green-600" },
      orange: { bg: "from-orange-500 to-orange-600", iconBg: "bg-orange-100", iconColor: "text-orange-600" },
      purple: { bg: "from-purple-500 to-purple-600", iconBg: "bg-purple-100", iconColor: "text-purple-600" },
      teal: { bg: "from-teal-500 to-teal-600", iconBg: "bg-teal-100", iconColor: "text-teal-600" }
    };

    const colors = colorConfig[color] || colorConfig.blue;

    return (
      <Card className="relative overflow-hidden group hover:shadow-xl transition-all duration-300 border-0 bg-gradient-to-br from-white to-gray-50">
        <div className={`absolute inset-0 bg-gradient-to-br ${colors.bg} opacity-5 group-hover:opacity-10 transition-opacity duration-300`}></div>
        <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${colors.bg}`}></div>
        
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 pl-6">
          <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
          <div className={`p-2 rounded-xl ${colors.iconBg} shadow-sm`}>
            <Icon className={`h-4 w-4 ${colors.iconColor}`} />
          </div>
        </CardHeader>
        <CardContent className="pl-6 pb-4">
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-bold text-gray-900">{value}</div>
            {trend && (
              <Badge variant="secondary" className={`text-xs ${trend > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                <TrendingUp className={`h-3 w-3 mr-1 ${trend > 0 ? 'text-green-600' : 'text-red-600'}`} />
                {trend > 0 ? '+' : ''}{trend}%
              </Badge>
            )}
            {badge && (
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                {badge}
              </Badge>
            )}
          </div>
          {description && (
            <p className="text-xs text-gray-500 mt-2 font-medium">
              {description}
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  // Region colors for multiple curves
  const regionColors = [COLORS.blue, COLORS.green, COLORS.orange, COLORS.purple, COLORS.teal, COLORS.indigo];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
            Livestock Analytics Dashboard
          </h1>
          <p className="text-gray-600 mt-2">
            {dateRange.startDate || dateRange.endDate 
              ? `Showing insights from ${dateRange.startDate || 'beginning'} to ${dateRange.endDate || 'now'}`
              : 'Comprehensive overview of all livestock data'
            }
          </p>
        </div>

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
              <div className="flex gap-2">
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
          value={stats.total} 
          icon={Users}
          description={`${stats.maleFarmers} male, ${stats.femaleFarmers} female`}
          color="blue"
        />

        <StatsCard 
          title="Trained Farmers" 
          value={stats.trained} 
          icon={GraduationCap}
          description={`${stats.trainingRate.toFixed(1)}% of livestock farmers`}
          color="green"
          badge={`${stats.totalTrainedFromCapacity} total trained`}
        />

        <StatsCard 
          title="Animal Census" 
          value={stats.totalAnimals.toLocaleString()} 
          icon={Beef}
          description="Total goats registered"
          color="orange"
        />

        <StatsCard 
          title="Training Coverage" 
          value={`${stats.trainingRate.toFixed(1)}%`} 
          icon={Target}
          description="Of livestock farmers trained"
          color="purple"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Gender Distribution Doughnut */}
        <Card className="border-0 shadow-lg bg-white">
          <CardHeader className="pb-4">
            <CardTitle className="font-display flex items-center gap-2 text-gray-800">
              <Users className="h-5 w-5 text-blue-600" />
              Farmers by Gender
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={genderData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  label={renderCustomizedLabel}
                  labelLine={false}
                >
                  {genderData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color} 
                    />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [value, "Farmers"]}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  formatter={(value, entry) => (
                    <span style={{ color: '#374151', fontSize: '12px' }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Training Comparison Doughnut */}
        <Card className="border-0 shadow-lg bg-white">
          <CardHeader className="pb-4">
            <CardTitle className="font-display flex items-center gap-2 text-gray-800">
              <GraduationCap className="h-5 w-5 text-green-600" />
              Training Status (Livestock Farmers)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={trainingComparisonData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  label={renderCustomizedLabel}
                  labelLine={false}
                >
                  {trainingComparisonData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color} 
                    />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [value, "Farmers"]}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  formatter={(value, entry) => (
                    <span style={{ color: '#374151', fontSize: '12px' }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="text-center mt-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs">
                Total trained farmers in Capacity Building: {stats.totalTrainedFromCapacity}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Animal Census Doughnut */}
        <Card className="border-0 shadow-lg bg-white">
          <CardHeader className="pb-4">
            <CardTitle className="font-display flex items-center gap-2 text-gray-800">
              <Beef className="h-5 w-5 text-orange-600" />
              Animal Census
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={goatsData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  label={renderCustomizedLabel}
                  labelLine={false}
                >
                  {goatsData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color} 
                    />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [value.toLocaleString(), "Goats"]}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  formatter={(value, entry) => (
                    <span style={{ color: '#374151', fontSize: '12px' }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Training Trend Line Chart */}
        <Card className="border-0 shadow-lg bg-white">
          <CardHeader className="pb-4">
            <CardTitle className="font-display flex items-center gap-2 text-gray-800">
              <TrendingUp className="h-5 w-5 text-teal-600" />
              Training Activities Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trainingTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis 
                  dataKey="name" 
                  fontSize={11}
                  tick={{ fill: '#6b7280' }}
                />
                <YAxis fontSize={11} tick={{ fill: '#6b7280' }} />
                <Tooltip 
                  formatter={(value: number) => [value, "Training Sessions"]}
                  labelStyle={{ color: '#374151', fontWeight: 'bold' }}
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="trained" 
                  stroke={COLORS.teal}
                  strokeWidth={3}
                  dot={{ fill: COLORS.teal, strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: COLORS.teal }}
                  name="Training Sessions"
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="text-center mt-2">
              <Badge variant="outline" className="bg-teal-50 text-teal-700 text-xs">
                Based on Capacity Building records
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Regional Comparison Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Regional Distribution with Multiple Curves */}
        <Card className="border-0 shadow-lg bg-white">
          <CardHeader className="pb-4">
            <CardTitle className="font-display flex items-center gap-2 text-gray-800">
              <Map className="h-5 w-5 text-purple-600" />
              Regional Growth Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={regionalComparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis 
                  dataKey="name" 
                  fontSize={11}
                  tick={{ fill: '#6b7280' }}
                />
                <YAxis fontSize={11} tick={{ fill: '#6b7280' }} />
                <Tooltip 
                  labelStyle={{ color: '#374151', fontWeight: 'bold' }}
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
                />
                <Legend 
                  verticalAlign="top"
                  height={36}
                />
                {/* Multiple area curves for each region */}
                {regionalComparisonData.length > 0 && 
                  Object.keys(regionalComparisonData[0])
                    .filter(key => key !== 'name')
                    .map((region, index) => (
                      <Area
                        key={region}
                        type="monotone"
                        dataKey={region}
                        stackId="1"
                        stroke={regionColors[index % regionColors.length]}
                        fill={regionColors[index % regionColors.length]}
                        fillOpacity={0.3}
                        strokeWidth={2}
                        name={region}
                      />
                    ))
                }
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Regional Performance Line Chart */}
        <Card className="border-0 shadow-lg bg-white">
          <CardHeader className="pb-4">
            <CardTitle className="font-display flex items-center gap-2 text-gray-800">
              <BarChart3 className="h-5 w-5 text-indigo-600" />
              Regional Performance Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={regionalComparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis 
                  dataKey="name" 
                  fontSize={11}
                  tick={{ fill: '#6b7280' }}
                />
                <YAxis fontSize={11} tick={{ fill: '#6b7280' }} />
                <Tooltip 
                  labelStyle={{ color: '#374151', fontWeight: 'bold' }}
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
                />
                <Legend 
                  verticalAlign="top"
                  height={36}
                />
                {/* Multiple line curves for each region */}
                {regionalComparisonData.length > 0 && 
                  Object.keys(regionalComparisonData[0])
                    .filter(key => key !== 'name')
                    .map((region, index) => (
                      <Line
                        key={region}
                        type="monotone"
                        dataKey={region}
                        stroke={regionColors[index % regionColors.length]}
                        strokeWidth={3}
                        dot={{ fill: regionColors[index % regionColors.length], strokeWidth: 2, r: 3 }}
                        activeDot={{ r: 5, fill: regionColors[index % regionColors.length] }}
                        name={region}
                      />
                    ))
                }
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LivestockFarmersAnalytics;