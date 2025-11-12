import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, query, orderBy, limit, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  GraduationCap, 
  Beef, 
  MapPin, 
  Plus, 
  Calendar, 
  Activity,
  Eye,
  Edit,
  Trash2,
  X,
  TrendingUp,
  Map,
  BarChart3,
  Table
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface StatCardProps {
  title: string;
  icon: React.ReactNode;
  maleCount: number;
  femaleCount: number;
  total: number;
  gradient: string;
}

const StatCard = ({ title, icon, maleCount, femaleCount, total, gradient }: StatCardProps) => (
  <Card className={`group relative overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-500 hover:scale-[1.02] ${gradient}`}>
    <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 relative z-10">
      <CardTitle className="text-sm font-semibold text-white/90">{title}</CardTitle>
      <div className="p-2 bg-white/20 rounded-xl text-white backdrop-blur-sm">
        {icon}
      </div>
    </CardHeader>
    <CardContent className="relative z-10">
      <div className="flex items-end justify-between mb-4">
        <div className="text-3xl font-bold text-white">
          {total.toLocaleString()}
        </div>
        <TrendingUp className="h-5 w-5 text-white/70" />
      </div>
      <div className="flex gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-white/80 text-xs font-medium">Male</p>
          <p className="text-white font-semibold text-lg">{maleCount.toLocaleString()}</p>
        </div>
        <div className="h-8 w-px bg-white/30" />
        <div className="flex flex-col gap-1">
          <p className="text-white/80 text-xs font-medium">Female</p>
          <p className="text-white font-semibold text-lg">{femaleCount.toLocaleString()}</p>
        </div>
      </div>
    </CardContent>
  </Card>
);

interface Activity {
  id: string;
  activityName: string;
  date: string;
  numberOfPersons: number;
  county: string;
  location: string;
  namesOfPersons: string;
  roles: string;
  subcounty: string;
  createdAt: any;
}

interface RegionStats {
  name: string;
  farmerCount: number;
  maleFarmers: number;
  femaleFarmers: number;
}

const ActivityTable = ({ activities }: { activities: Activity[] }) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="bg-white rounded-2xl border-0 shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-blue-500 text-white">
              <th className="p-3 text-left font-semibold text-sm">Activity Name</th>
              <th className="p-3 text-left font-semibold text-sm">Date</th>
              <th className="p-3 text-left font-semibold text-sm">Location</th>
              <th className="p-3 text-left font-semibold text-sm">Participants</th>
              <th className="p-3 text-left font-semibold text-sm">County</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {activities.map((activity, index) => (
              <tr 
                key={activity.id} 
                className="hover:bg-gray-50 transition-colors duration-200 group"
              >
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-gradient-to-r from-green-500 to-blue-500 rounded-full"></div>
                    <span className="font-medium text-gray-900 group-hover:text-green-600 transition-colors">
                      {activity.activityName}
                    </span>
                  </div>
                </td>
                <td className="p-3">
                  <Badge variant="secondary" className="bg-green-100 text-green-700 border-0">
                    {formatDate(activity.date)}
                  </Badge>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-green-500" />
                    <span className="text-gray-600">{activity.location}</span>
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-500" />
                    <span className="font-semibold text-gray-700">{activity.numberOfPersons}</span>
                  </div>
                </td>
                <td className="p-3">
                  <span className="text-gray-600">{activity.county}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const RegionCard = ({ region }: { region: RegionStats }) => (
  <Card className="group bg-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] overflow-hidden">
    <CardContent className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl text-white">
            <Map className="h-4 w-4" />
          </div>
          <div>
            <h4 className="font-bold text-gray-900 line-clamp-1 text-sm">
              {region.name}
            </h4>
            <p className="text-gray-500 text-xs">Region</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-green-600">{region.farmerCount}</p>
          <p className="text-gray-500 text-xs">Farmers</p>
        </div>
      </div>
    </CardContent>
  </Card>
);

const DashboardOverview = () => {
  const [loading, setLoading] = useState(true);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isViewAllDialogOpen, setIsViewAllDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [activityForm, setActivityForm] = useState({
    activityName: "",
    date: "",
    numberOfPersons: "",
    namesOfPersons: "",
    roles: "",
    county: "",
    subcounty: "",
    location: "",
  });
  const { toast } = useToast();
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
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [regionStats, setRegionStats] = useState<RegionStats[]>([]);

  useEffect(() => {
    fetchStats();
    fetchRecentActivities();
  }, []);

  const fetchStats = async () => {
    try {
      const livestockSnapshot = await getDocs(collection(db, "Livestock Farmers"));
      const livestockData = livestockSnapshot.docs.map(doc => doc.data());

      const maleFarmers = livestockData.filter(f =>
        String(f.gender).toLowerCase() === 'male' || String(f.Gender).toLowerCase() === 'male'
      ).length;
      const femaleFarmers = livestockData.filter(f =>
        String(f.gender).toLowerCase() === 'female' || String(f.Gender).toLowerCase() === 'female'
      ).length;

      const capacitySnapshot = await getDocs(collection(db, "Capacity Building"));
      const capacityData = capacitySnapshot.docs.map(doc => doc.data());

      const trainedMale = capacityData.filter(f =>
        String(f.gender).toLowerCase() === 'male' || String(f.Gender).toLowerCase() === 'male'
      ).length;
      const trainedFemale = capacityData.filter(f =>
        String(f.gender).toLowerCase() === 'female' || String(f.Gender).toLowerCase() === 'female'
      ).length;

      let totalGoats = 0;
      let maleGoats = 0;
      let femaleGoats = 0;

      livestockData.forEach(farmer => {
        const goatsMale = parseInt(farmer.goatsMale || farmer.GoatsMale || farmer.maleGoats || 0);
        const goatsFemale = parseInt(farmer.femaleGoats || farmer.female_goats || 0);

        maleGoats += goatsMale;
        femaleGoats += goatsFemale;
      });
      totalGoats = maleGoats + femaleGoats;

      // Calculate region statistics
      const regionData: { [key: string]: RegionStats } = {};

      livestockData.forEach(farmer => {
        const region = farmer.region || farmer.Region || farmer.county || farmer.County;
        if (region) {
          const regionName = String(region).trim();
          if (!regionData[regionName]) {
            regionData[regionName] = {
              name: regionName,
              farmerCount: 0,
              maleFarmers: 0,
              femaleFarmers: 0
            };
          }

          regionData[regionName].farmerCount++;
          
          const gender = String(farmer.gender || farmer.Gender).toLowerCase();
          if (gender === 'male') {
            regionData[regionName].maleFarmers++;
          } else if (gender === 'female') {
            regionData[regionName].femaleFarmers++;
          }
        }
      });

      const regionsArray = Object.values(regionData).sort((a, b) => b.farmerCount - a.farmerCount);
      setRegionStats(regionsArray);

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
        regionsVisited: regionsArray.length,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      toast({
        title: "Error",
        description: "Failed to load dashboard statistics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentActivities = async () => {
    try {
      const activitiesQuery = query(
        collection(db, "Recent Activities"),
        orderBy("createdAt", "desc"),
        limit(5)
      );
      const activitiesSnapshot = await getDocs(activitiesQuery);
      const activities = activitiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Activity[];
      setRecentActivities(activities);
    } catch (error) {
      console.error("Error fetching activities:", error);
      toast({
        title: "Error",
        description: "Failed to load recent activities",
        variant: "destructive",
      });
    } finally {
      setActivitiesLoading(false);
    }
  };

  const fetchAllActivities = async () => {
    try {
      const activitiesQuery = query(
        collection(db, "Recent Activities"),
        orderBy("createdAt", "desc")
      );
      const activitiesSnapshot = await getDocs(activitiesQuery);
      const activities = activitiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Activity[];
      setAllActivities(activities);
      setIsViewAllDialogOpen(true);
    } catch (error) {
      console.error("Error fetching all activities:", error);
      toast({
        title: "Error",
        description: "Failed to load activities",
        variant: "destructive",
      });
    }
  };

  const handleAddActivity = async () => {
    try {
      await addDoc(collection(db, "Recent Activities"), {
        ...activityForm,
        numberOfPersons: parseInt(activityForm.numberOfPersons),
        createdAt: new Date(),
      });
      toast({
        title: "Success",
        description: "Activity added successfully.",
        className: "bg-gradient-to-r from-green-500 to-blue-500 text-white"
      });
      setActivityForm({
        activityName: "",
        date: "",
        numberOfPersons: "",
        namesOfPersons: "",
        roles: "",
        county: "",
        subcounty: "",
        location: "",
      });
      setIsAddDialogOpen(false);
      fetchRecentActivities();
    } catch (error) {
      console.error("Error adding activity:", error);
      toast({
        title: "Error",
        description: "Failed to add activity. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEditActivity = async () => {
    if (!editingActivity) return;

    try {
      await updateDoc(doc(db, "Recent Activities", editingActivity.id), {
        ...activityForm,
        numberOfPersons: parseInt(activityForm.numberOfPersons),
      });
      toast({
        title: "Success",
        description: "Activity updated successfully.",
        className: "bg-gradient-to-r from-green-500 to-blue-500 text-white"
      });
      setEditingActivity(null);
      setIsEditDialogOpen(false);
      setActivityForm({
        activityName: "",
        date: "",
        numberOfPersons: "",
        namesOfPersons: "",
        roles: "",
        county: "",
        subcounty: "",
        location: "",
      });
      fetchRecentActivities();
      fetchAllActivities();
    } catch (error) {
      console.error("Error updating activity:", error);
      toast({
        title: "Error",
        description: "Failed to update activity. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteActivity = async (activityId: string) => {
    try {
      await deleteDoc(doc(db, "Recent Activities", activityId));
      toast({
        title: "Success",
        description: "Activity deleted successfully.",
        className: "bg-gradient-to-r from-green-500 to-blue-500 text-white"
      });
      fetchRecentActivities();
      fetchAllActivities();
    } catch (error) {
      console.error("Error deleting activity:", error);
      toast({
        title: "Error",
        description: "Failed to delete activity. Please try again.",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (activity: Activity) => {
    setEditingActivity(activity);
    setActivityForm({
      activityName: activity.activityName,
      date: activity.date,
      numberOfPersons: activity.numberOfPersons.toString(),
      namesOfPersons: activity.namesOfPersons,
      roles: activity.roles,
      county: activity.county,
      subcounty: activity.subcounty,
      location: activity.location,
    });
    setIsEditDialogOpen(true);
  };

  const LoadingSkeleton = () => (
    <div className="space-y-8">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="p-6 border-0 shadow-lg overflow-hidden">
            <div className="flex justify-between items-start mb-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-10 w-10 rounded-xl" />
            </div>
            <Skeleton className="h-8 w-20 mb-4" />
            <div className="flex gap-3">
              <Skeleton className="h-16 flex-1 rounded-lg" />
              <Skeleton className="h-16 flex-1 rounded-lg" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-1xl font-bold bg-gradient-to-r from-gray-800 to-green-600 bg-clip-text text-transparent">
              Dashboard Overview
            </h1>
          </div>
        </div>

        {loading ? (
          <LoadingSkeleton />
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="animate-in slide-in-from-left duration-500">
                <StatCard
                  title="Farmers Registered"
                  icon={<Users className="h-5 w-5" />}
                  maleCount={stats.maleFarmers}
                  femaleCount={stats.femaleFarmers}
                  total={stats.totalFarmers}
                  gradient="bg-gradient-to-br from-blue-500 to-purple-600"
                />
              </div>
              <div className="animate-in slide-in-from-bottom duration-500 delay-100">
                <StatCard
                  title="Trained Farmers"
                  icon={<GraduationCap className="h-5 w-5" />}
                  maleCount={stats.trainedMale}
                  femaleCount={stats.trainedFemale}
                  total={stats.trainedFarmers}
                  gradient="bg-gradient-to-br from-green-500 to-emerald-600"
                />
              </div>
              <div className="animate-in slide-in-from-right duration-500 delay-200">
                <StatCard
                  title="Animal Census"
                  icon={<Beef className="h-5 w-5" />}
                  maleCount={stats.maleGoats}
                  femaleCount={stats.femaleGoats}
                  total={stats.totalGoats}
                  gradient="bg-gradient-to-br from-orange-500 to-red-500"
                />
              </div>
            </div>

            {/* Combined Section: Recent Activities & Regions Overview */}
            <div className="gap-6">
              {/* Regions Overview */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold bg-gradient-to-r from-gray-800 to-blue-600 bg-clip-text text-transparent">
                      Regions Overview
                    </h2>
                  </div>
                  <Badge className="text-sm bg-gradient-to-r from-blue-500 to-purple-600 text-white border-0 shadow-lg px-3 py-1">
                    {regionStats.length} Regions
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2">
                  {regionStats.map((region, index) => (
                    <div
                      key={region.name}
                      className="animate-in slide-in-from-bottom duration-300"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <RegionCard region={region} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Activities Table Container */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold bg-gradient-to-r from-gray-800 to-green-600 bg-clip-text text-transparent">
                      Recent Activities
                    </h2>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border-0 shadow-lg p-6 space-y-4">
                  {activitiesLoading ? (
                    <div className="space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full rounded-xl" />
                      ))}
                    </div>
                  ) : recentActivities.length > 0 ? (
                    <ActivityTable activities={recentActivities} />
                  ) : (
                    <div className="text-center p-8 border-2 border-dashed border-gray-300 rounded-2xl">
                      <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <Table className="h-8 w-8 text-white" />
                      </div>
                      <h4 className="text-xl font-bold text-gray-800 mb-2">
                        No activities yet
                      </h4>
                      <p className="text-gray-600 mb-4">
                        Start tracking your field activities and events to see them displayed here.
                      </p>
                    </div>
                  )}

                  {/* Table Action Buttons */}
                  <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                    <Button 
                      onClick={fetchAllActivities}
                      variant="outline"
                      className="border-blue-500 text-blue-500 hover:bg-blue-50 font-medium px-4 py-2 rounded-lg transition-all duration-300"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View All Activities
                    </Button>
                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                      <DialogTrigger asChild>
                        <Button className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold px-4 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300">
                          <Plus className="h-4 w-4 mr-2" />
                          Add New Activity
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[600px] bg-white rounded-2xl border-0 shadow-2xl">
                        <DialogHeader>
                          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-green-600 bg-clip-text text-transparent">
                            Create New Activity
                          </DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-6 py-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="activityName" className="text-sm font-semibold text-gray-700">Activity Name</Label>
                              <Input
                                id="activityName"
                                value={activityForm.activityName}
                                onChange={(e) => setActivityForm({...activityForm, activityName: e.target.value})}
                                placeholder="Enter activity name"
                                className="rounded-xl border-gray-300 focus:border-green-500 focus:ring-green-500 transition-all"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="date" className="text-sm font-semibold text-gray-700">Date</Label>
                              <Input
                                id="date"
                                type="date"
                                value={activityForm.date}
                                onChange={(e) => setActivityForm({...activityForm, date: e.target.value})}
                                className="rounded-xl border-gray-300 focus:border-green-500 focus:ring-green-500 transition-all"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="numberOfPersons" className="text-sm font-semibold text-gray-700">Participants</Label>
                              <Input
                                id="numberOfPersons"
                                type="number"
                                value={activityForm.numberOfPersons}
                                onChange={(e) => setActivityForm({...activityForm, numberOfPersons: e.target.value})}
                                placeholder="Number of participants"
                                className="rounded-xl border-gray-300 focus:border-green-500 focus:ring-green-500 transition-all"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="county" className="text-sm font-semibold text-gray-700">County</Label>
                              <Input
                                id="county"
                                value={activityForm.county}
                                onChange={(e) => setActivityForm({...activityForm, county: e.target.value})}
                                placeholder="Enter county"
                                className="rounded-xl border-gray-300 focus:border-green-500 focus:ring-green-500 transition-all"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="subcounty" className="text-sm font-semibold text-gray-700">Subcounty</Label>
                              <Input
                                id="subcounty"
                                value={activityForm.subcounty}
                                onChange={(e) => setActivityForm({...activityForm, subcounty: e.target.value})}
                                placeholder="Enter subcounty"
                                className="rounded-xl border-gray-300 focus:border-green-500 focus:ring-green-500 transition-all"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="location" className="text-sm font-semibold text-gray-700">Location</Label>
                              <Input
                                id="location"
                                value={activityForm.location}
                                onChange={(e) => setActivityForm({...activityForm, location: e.target.value})}
                                placeholder="Enter location"
                                className="rounded-xl border-gray-300 focus:border-green-500 focus:ring-green-500 transition-all"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="namesOfPersons" className="text-sm font-semibold text-gray-700">Participant Names</Label>
                            <Textarea
                              id="namesOfPersons"
                              value={activityForm.namesOfPersons}
                              onChange={(e) => setActivityForm({...activityForm, namesOfPersons: e.target.value})}
                              placeholder="Enter names separated by commas"
                              className="rounded-xl border-gray-300 focus:border-green-500 focus:ring-green-500 transition-all min-h-[80px]"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="roles" className="text-sm font-semibold text-gray-700">Roles</Label>
                            <Textarea
                              id="roles"
                              value={activityForm.roles}
                              onChange={(e) => setActivityForm({...activityForm, roles: e.target.value})}
                              placeholder="Enter roles separated by commas"
                              className="rounded-xl border-gray-300 focus:border-green-500 focus:ring-green-500 transition-all min-h-[80px]"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-3">
                          <Button 
                            variant="outline" 
                            onClick={() => setIsAddDialogOpen(false)}
                            className="rounded-xl border-gray-300 hover:border-gray-400 transition-all"
                          >
                            Cancel
                          </Button>
                          <Button 
                            onClick={handleAddActivity}
                            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-xl text-white font-semibold shadow-lg hover:shadow-xl transition-all"
                          >
                            <Calendar className="h-4 w-4 mr-2" />
                            Create Activity
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* View All Activities Dialog */}
        <Dialog open={isViewAllDialogOpen} onOpenChange={setIsViewAllDialogOpen}>
          <DialogContent className="max-w-6xl max-h-[80vh] bg-white rounded-2xl border-0 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-green-600 bg-clip-text text-transparent flex items-center justify-between">
                <span>All Activities</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsViewAllDialogOpen(false)}
                  className="h-8 w-8 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X className="h-4 w-4" />
                </Button>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {allActivities.map((activity) => (
                <Card key={activity.id} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-bold text-lg text-gray-900 mb-3 group-hover:text-green-600 transition-colors">
                          {activity.activityName}
                        </h4>
                        <div className="space-y-2 text-sm text-gray-600">
                          <div className="flex items-center gap-3">
                            <Calendar className="h-4 w-4 text-green-500" />
                            <span className="font-medium">{new Date(activity.date).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <MapPin className="h-4 w-4 text-green-500" />
                            <span>{activity.location}, {activity.county}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Users className="h-4 w-4 text-green-500" />
                            <span className="font-semibold">{activity.numberOfPersons} participants</span>
                          </div>
                          {activity.namesOfPersons && (
                            <div>
                              <p className="font-semibold text-green-600 text-sm">Participants:</p>
                              <p className="text-sm text-gray-700">{activity.namesOfPersons}</p>
                            </div>
                          )}
                          {activity.roles && (
                            <div>
                              <p className="font-semibold text-green-600 text-sm">Roles:</p>
                              <p className="text-sm text-gray-700">{activity.roles}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          size="sm"
                          onClick={() => openEditDialog(activity)}
                          className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-lg transition-all"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteActivity(activity.id)}
                          className="rounded-lg transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Activity Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[600px] bg-white rounded-2xl border-0 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-green-600 bg-clip-text text-transparent">
                Edit Activity
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-activityName" className="text-sm font-semibold text-gray-700">Activity Name</Label>
                  <Input
                    id="edit-activityName"
                    value={activityForm.activityName}
                    onChange={(e) => setActivityForm({...activityForm, activityName: e.target.value})}
                    placeholder="Enter activity name"
                    className="rounded-xl border-gray-300 focus:border-green-500 focus:ring-green-500 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-date" className="text-sm font-semibold text-gray-700">Date</Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={activityForm.date}
                    onChange={(e) => setActivityForm({...activityForm, date: e.target.value})}
                    className="rounded-xl border-gray-300 focus:border-green-500 focus:ring-green-500 transition-all"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-numberOfPersons" className="text-sm font-semibold text-gray-700">Participants</Label>
                  <Input
                    id="edit-numberOfPersons"
                    type="number"
                    value={activityForm.numberOfPersons}
                    onChange={(e) => setActivityForm({...activityForm, numberOfPersons: e.target.value})}
                    placeholder="Number of participants"
                    className="rounded-xl border-gray-300 focus:border-green-500 focus:ring-green-500 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-county" className="text-sm font-semibold text-gray-700">County</Label>
                  <Input
                    id="edit-county"
                    value={activityForm.county}
                    onChange={(e) => setActivityForm({...activityForm, county: e.target.value})}
                    placeholder="Enter county"
                    className="rounded-xl border-gray-300 focus:border-green-500 focus:ring-green-500 transition-all"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-subcounty" className="text-sm font-semibold text-gray-700">Subcounty</Label>
                  <Input
                    id="edit-subcounty"
                    value={activityForm.subcounty}
                    onChange={(e) => setActivityForm({...activityForm, subcounty: e.target.value})}
                    placeholder="Enter subcounty"
                    className="rounded-xl border-gray-300 focus:border-green-500 focus:ring-green-500 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-location" className="text-sm font-semibold text-gray-700">Location</Label>
                  <Input
                    id="edit-location"
                    value={activityForm.location}
                    onChange={(e) => setActivityForm({...activityForm, location: e.target.value})}
                    placeholder="Enter location"
                    className="rounded-xl border-gray-300 focus:border-green-500 focus:ring-green-500 transition-all"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-namesOfPersons" className="text-sm font-semibold text-gray-700">Participant Names</Label>
                <Textarea
                  id="edit-namesOfPersons"
                  value={activityForm.namesOfPersons}
                  onChange={(e) => setActivityForm({...activityForm, namesOfPersons: e.target.value})}
                  placeholder="Enter names separated by commas"
                  className="rounded-xl border-gray-300 focus:border-green-500 focus:ring-green-500 transition-all min-h-[80px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-roles" className="text-sm font-semibold text-gray-700">Roles</Label>
                <Textarea
                  id="edit-roles"
                  value={activityForm.roles}
                  onChange={(e) => setActivityForm({...activityForm, roles: e.target.value})}
                  placeholder="Enter roles separated by commas"
                  className="rounded-xl border-gray-300 focus:border-green-500 focus:ring-green-500 transition-all min-h-[80px]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => setIsEditDialogOpen(false)}
                className="rounded-xl border-gray-300 hover:border-gray-400 transition-all"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleEditActivity}
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-xl text-white font-semibold shadow-lg hover:shadow-xl transition-all"
              >
                <Edit className="h-4 w-4 mr-2" />
                Update Activity
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default DashboardOverview;