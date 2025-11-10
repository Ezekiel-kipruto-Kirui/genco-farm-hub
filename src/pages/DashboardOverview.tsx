import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, GraduationCap, Beef, MapPin } from "lucide-react";

interface StatCardProps {
  title: string;
  icon: React.ReactNode;
  maleCount: number;
  femaleCount: number;
  total: number;
}

const StatCard = ({ title, icon, maleCount, femaleCount, total }: StatCardProps) => (
  <Card className="hover:shadow-lg transition-shadow">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <div className="p-2 bg-primary/10 rounded-full text-primary">
        {icon}
      </div>
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold mb-4">{total}</div>
      <div className="flex justify-between text-sm">
        <div>
          <p className="text-muted-foreground">Male</p>
          <p className="font-semibold text-lg">{maleCount}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Female</p>
          <p className="font-semibold text-lg">{femaleCount}</p>
        </div>
      </div>
    </CardContent>
  </Card>
);

interface SimpleStatCardProps {
  title: string;
  icon: React.ReactNode;
  value: number | string;
}

const SimpleStatCard = ({ title, icon, value }: SimpleStatCardProps) => (
  <Card className="hover:shadow-lg transition-shadow">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <div className="p-2 bg-primary/10 rounded-full text-primary">
        {icon}
      </div>
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold">{value}</div>
    </CardContent>
  </Card>
);

const DashboardOverview = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalFarmers: 0,
    maleFarmers: 0,
    femaleFarmers: 0,
    trainedFarmers: 0,
    trainedMale: 0,
    trainedFemale: 0,
    totalGoats: 0,
    maleGoats: 0,
    femaleGoats: 0,
    regionsVisited: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Fetch livestock farmers
      const livestockSnapshot = await getDocs(collection(db, "Livestock Farmers"));
      const livestockData = livestockSnapshot.docs.map(doc => doc.data());
      
      const maleFarmers = livestockData.filter(f => 
        String(f.gender).toLowerCase() === 'male' || String(f.Gender).toLowerCase() === 'male'
      ).length;
      const femaleFarmers = livestockData.filter(f => 
        String(f.gender).toLowerCase() === 'female' || String(f.Gender).toLowerCase() === 'female'
      ).length;

      // Fetch capacity building (training)
      const capacitySnapshot = await getDocs(collection(db, "Capacity Building"));
      const capacityData = capacitySnapshot.docs.map(doc => doc.data());
      
      const trainedMale = capacityData.filter(f => 
        String(f.gender).toLowerCase() === 'male' || String(f.Gender).toLowerCase() === 'male'
      ).length;
      const trainedFemale = capacityData.filter(f => 
        String(f.gender).toLowerCase() === 'female' || String(f.Gender).toLowerCase() === 'female'
      ).length;

      // Calculate goat statistics from livestock data
      let totalGoats = 0;
      let maleGoats = 0;
      let femaleGoats = 0;

      livestockData.forEach(farmer => {
        // Try different possible field names for goats
        const goatsMale = parseInt(farmer.goatsMale || farmer.GoatsMale || farmer.maleGoats || 0);
        const goatsFemale = parseInt(farmer.femaleGoats || farmer.female_goats || 0);
        
        maleGoats += goatsMale;
        femaleGoats += goatsFemale;
      });
      totalGoats = maleGoats + femaleGoats;

      // Get unique regions from livestock farmers
      const regions = new Set();
      livestockData.forEach(farmer => {
        const region = farmer.region || farmer.Region || farmer.county || farmer.County;
        if (region) regions.add(String(region).trim());
      });

      setStats({
        totalFarmers: livestockSnapshot.size,
        maleFarmers,
        femaleFarmers,
        trainedFarmers: capacitySnapshot.size,
        trainedMale,
        trainedFemale,
        totalGoats,
        maleGoats,
        femaleGoats,
        regionsVisited: regions.size,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* <div>
        <h2 className="text-3xl font-bold mb-2">Dashboard Overview</h2>
        <p className="text-muted-foreground">Key statistics and metrics at a glance</p>
      </div> */}

      <div className="grid gap-6 md:grid-cols-2">
        <StatCard
          title="Total Farmers Registered"
          icon={<Users className="h-5 w-5" />}
          maleCount={stats.maleFarmers}
          femaleCount={stats.femaleFarmers}
          total={stats.totalFarmers}
        />
        <StatCard
          title="Total Trained Farmers"
          icon={<GraduationCap className="h-5 w-5" />}
          maleCount={stats.trainedMale}
          femaleCount={stats.trainedFemale}
          total={stats.trainedFarmers}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <StatCard
          title="Total Goats (Animal Census)"
          icon={<Beef className="h-5 w-5" />}
          maleCount={stats.maleGoats}
          femaleCount={stats.femaleGoats}
          total={stats.totalGoats}
        />
        <SimpleStatCard
          title="Regions Visited"
          icon={<MapPin className="h-5 w-5" />}
          value={stats.regionsVisited}
        />
      </div>
    </div>
  );
};

export default DashboardOverview;
