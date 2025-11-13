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
  Table,
  DollarSign,
  Target
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
  <div className="group relative bg-white">
    <div className="relative bg-white backdrop-blur-sm rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 p-6">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-lg ${gradient}`}>
            {icon}
          </div>
        </div>
        <div className="ml-5 flex-1">
          <p className="text-sm font-medium text-slate-600 uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{total.toLocaleString()}</p>
          <div className="flex gap-4 mt-3">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-slate-600">Male</span>
              <span className="text-sm font-semibold text-slate-900">{maleCount.toLocaleString()}</span>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex flex-col">
              <span className="text-xs font-medium text-slate-600">Female</span>
              <span className="text-sm font-semibold text-slate-900">{femaleCount.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
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
    <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-slate-50 to-slate-100/80 shadow-sm">
              <th className="p-4 text-left font-semibold text-slate-700 text-sm">Activity Name</th>
              <th className="p-4 text-left font-semibold text-slate-700 text-sm">Date</th>
              <th className="p-4 text-left font-semibold text-slate-700 text-sm">Location</th>
              <th className="p-4 text-left font-semibold text-slate-700 text-sm">Participants</th>
              <th className="p-4 text-left font-semibold text-slate-700 text-sm">County</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {activities.map((activity, index) => (
              <tr 
                key={activity.id} 
                className="hover:bg-slate-50/50 transition-colors duration-200 group"
              >
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></div>
                    <span className="font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
                      {activity.activityName}
                    </span>
                  </div>
                </td>
                <td className="p-4">
                  <Badge className="bg-blue-100 text-blue-700 border-0 shadow-sm">
                    {formatDate(activity.date)}
                  </Badge>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-500" />
                    <span className="text-slate-700">{activity.location}</span>
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-slate-500" />
                    <span className="font-semibold text-slate-900">{activity.numberOfPersons}</span>
                  </div>
                </td>
                <td className="p-4">
                  <span className="text-slate-700">{activity.county}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

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
        className: "bg-white text-slate-900 border border-slate-200"
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
        className: "bg-white text-slate-900 border border-slate-200"
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
        className: "bg-white text-slate-900 border border-slate-200"
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
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="group relative">
            <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Skeleton className="w-14 h-14 rounded-xl" />
                </div>
                <div className="ml-5 flex-1">
                  <Skeleton className="h-4 w-32 mb-2" />
                  <Skeleton className="h-8 w-20 mb-3" />
                  <div className="flex gap-4">
                    <Skeleton className="h-10 flex-1 rounded-lg" />
                    <Skeleton className="h-10 flex-1 rounded-lg" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Get top 4 regions by farmer count
  const topRegions = regionStats.slice(0, 4);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/80 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        

        {loading ? (
          <LoadingSkeleton />
        ) : (
          <>
            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <StatCard
                title="Farmers Registered"
                icon={<Users className="h-7 w-7 text-blue-600" />}
                maleCount={stats.maleFarmers}
                femaleCount={stats.femaleFarmers}
                total={stats.totalFarmers}
                gradient="bg-gradient-to-br from-blue-100 to-blue-50"
              />
              <StatCard
                title="Trained Farmers"
                icon={<GraduationCap className="h-7 w-7 text-green-600" />}
                maleCount={stats.trainedMale}
                femaleCount={stats.trainedFemale}
                total={stats.trainedFarmers}
                gradient="bg-gradient-to-br from-green-100 to-green-50"
              />
              <StatCard
                title="Animal Census"
                icon={<Beef className="h-7 w-7 text-orange-600" />}
                maleCount={stats.maleGoats}
                femaleCount={stats.femaleGoats}
                total={stats.totalGoats}
                gradient="bg-gradient-to-br from-orange-100 to-orange-50"
              />
              
              {/* Updated Regions Visited Card with Top 4 Regions */}
              <div className="group relative">
                <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-14 h-14 bg-gradient-to-br from-purple-100 to-purple-50 rounded-xl flex items-center justify-center shadow-lg">
                        <Map className="h-7 w-7 text-purple-600" />
                      </div>
                    </div>
                    <div className="ml-5 flex-1">
                     <div className="flex items-center justify-between mb-1"> 
                      <p className="text-sm font-medium text-slate-600 uppercase tracking-wide">Regions Visited</p>
                      <p className="bg-purple-100 text-purple-700 border-0 text-xs rounded-full text-center w-10">{stats.regionsVisited}</p>
                      </div>
                      {/* Top 4 Regions Grid */}
                      {topRegions.length > 0 && (
                        <div className="mt-4 grid grid-cols-2 gap-1">
                          {topRegions.map((region, index) => (
                            <div key={region.name} className="bg-slate-50/80 rounded-lg p-1 shadow-sm">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold text-slate-700 truncate">
                                  {region.name}
                                </span>
                                <Badge className="bg-purple-100 text-purple-700 border-0 text-xs">
                                  {region.farmerCount}
                                </Badge>
                              </div>
                              
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {topRegions.length === 0 && (
                        <div className="mt-3 text-sm text-slate-500">
                          No region data available
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activities Section */}
            <div className="space-y-6">
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100/80 shadow-sm">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center shadow-lg mr-3">
                      <Activity className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">Recent Activities</h3>
                  </div>
                </div>

                <div className="p-6">
                  {activitiesLoading ? (
                    <div className="space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full rounded-xl" />
                      ))}
                    </div>
                  ) : recentActivities.length > 0 ? (
                    <>
                      <ActivityTable activities={recentActivities} />
                      
                      {/* Action Buttons at Bottom */}
                      <div className="flex justify-between items-center pt-6 mt-6 border-t border-slate-200">
                        <Button 
                          onClick={fetchAllActivities}
                          variant="outline"
                          className="border-slate-300 text-slate-700 hover:bg-slate-50 font-medium px-4 py-2 rounded-xl transition-all duration-200 shadow-sm"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View All Activities
                        </Button>
                        
                        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                          <DialogTrigger asChild>
                            <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold px-4 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200">
                              <Plus className="h-4 w-4 mr-2" />
                              Add New Activity
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[600px] bg-white rounded-2xl border-0 shadow-2xl">
                            <DialogHeader>
                              <DialogTitle className="text-xl font-semibold text-slate-900">
                                Create New Activity
                              </DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-6 py-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="activityName" className="text-sm font-medium text-slate-700">Activity Name</Label>
                                  <Input
                                    id="activityName"
                                    value={activityForm.activityName}
                                    onChange={(e) => setActivityForm({...activityForm, activityName: e.target.value})}
                                    placeholder="Enter activity name"
                                    className="rounded-xl border-slate-300 focus:border-blue-500 focus:ring-blue-500 transition-all bg-white"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="date" className="text-sm font-medium text-slate-700">Date</Label>
                                  <Input
                                    id="date"
                                    type="date"
                                    value={activityForm.date}
                                    onChange={(e) => setActivityForm({...activityForm, date: e.target.value})}
                                    className="rounded-xl border-slate-300 focus:border-blue-500 focus:ring-blue-500 transition-all bg-white"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="numberOfPersons" className="text-sm font-medium text-slate-700">Participants</Label>
                                  <Input
                                    id="numberOfPersons"
                                    type="number"
                                    value={activityForm.numberOfPersons}
                                    onChange={(e) => setActivityForm({...activityForm, numberOfPersons: e.target.value})}
                                    placeholder="Number of participants"
                                    className="rounded-xl border-slate-300 focus:border-blue-500 focus:ring-blue-500 transition-all bg-white"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="county" className="text-sm font-medium text-slate-700">County</Label>
                                  <Input
                                    id="county"
                                    value={activityForm.county}
                                    onChange={(e) => setActivityForm({...activityForm, county: e.target.value})}
                                    placeholder="Enter county"
                                    className="rounded-xl border-slate-300 focus:border-blue-500 focus:ring-blue-500 transition-all bg-white"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="subcounty" className="text-sm font-medium text-slate-700">Subcounty</Label>
                                  <Input
                                    id="subcounty"
                                    value={activityForm.subcounty}
                                    onChange={(e) => setActivityForm({...activityForm, subcounty: e.target.value})}
                                    placeholder="Enter subcounty"
                                    className="rounded-xl border-slate-300 focus:border-blue-500 focus:ring-blue-500 transition-all bg-white"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="location" className="text-sm font-medium text-slate-700">Location</Label>
                                  <Input
                                    id="location"
                                    value={activityForm.location}
                                    onChange={(e) => setActivityForm({...activityForm, location: e.target.value})}
                                    placeholder="Enter location"
                                    className="rounded-xl border-slate-300 focus:border-blue-500 focus:ring-blue-500 transition-all bg-white"
                                  />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="namesOfPersons" className="text-sm font-medium text-slate-700">Participant Names</Label>
                                <Textarea
                                  id="namesOfPersons"
                                  value={activityForm.namesOfPersons}
                                  onChange={(e) => setActivityForm({...activityForm, namesOfPersons: e.target.value})}
                                  placeholder="Enter names separated by commas"
                                  className="rounded-xl border-slate-300 focus:border-blue-500 focus:ring-blue-500 transition-all bg-white min-h-[80px]"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="roles" className="text-sm font-medium text-slate-700">Roles</Label>
                                <Textarea
                                  id="roles"
                                  value={activityForm.roles}
                                  onChange={(e) => setActivityForm({...activityForm, roles: e.target.value})}
                                  placeholder="Enter roles separated by commas"
                                  className="rounded-xl border-slate-300 focus:border-blue-500 focus:ring-blue-500 transition-all bg-white min-h-[80px]"
                                />
                              </div>
                            </div>
                            <div className="flex justify-end gap-3">
                              <Button 
                                variant="outline" 
                                onClick={() => setIsAddDialogOpen(false)}
                                className="rounded-xl border-slate-300 hover:border-slate-400 transition-all text-slate-700"
                              >
                                Cancel
                              </Button>
                              <Button 
                                onClick={handleAddActivity}
                                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-xl text-white font-semibold shadow-lg hover:shadow-xl transition-all"
                              >
                                <Calendar className="h-4 w-4 mr-2" />
                                Create Activity
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-8 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50/50">
                      <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <Table className="h-8 w-8 text-white" />
                      </div>
                      <h4 className="text-xl font-bold text-slate-800 mb-2">
                        No activities yet
                      </h4>
                      <p className="text-slate-600 mb-4">
                        Start tracking your field activities and events to see them displayed here.
                      </p>
                      <div className="flex justify-center">
                        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                          <DialogTrigger asChild>
                            <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold px-4 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200">
                              <Plus className="h-4 w-4 mr-2" />
                              Add Your First Activity
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[600px] bg-white rounded-2xl border-0 shadow-2xl">
                            <DialogHeader>
                              <DialogTitle className="text-xl font-semibold text-slate-900">
                                Create New Activity
                              </DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-6 py-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="activityName" className="text-sm font-medium text-slate-700">Activity Name</Label>
                                  <Input
                                    id="activityName"
                                    value={activityForm.activityName}
                                    onChange={(e) => setActivityForm({...activityForm, activityName: e.target.value})}
                                    placeholder="Enter activity name"
                                    className="rounded-xl border-slate-300 focus:border-blue-500 focus:ring-blue-500 transition-all bg-white"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="date" className="text-sm font-medium text-slate-700">Date</Label>
                                  <Input
                                    id="date"
                                    type="date"
                                    value={activityForm.date}
                                    onChange={(e) => setActivityForm({...activityForm, date: e.target.value})}
                                    className="rounded-xl border-slate-300 focus:border-blue-500 focus:ring-blue-500 transition-all bg-white"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="numberOfPersons" className="text-sm font-medium text-slate-700">Participants</Label>
                                  <Input
                                    id="numberOfPersons"
                                    type="number"
                                    value={activityForm.numberOfPersons}
                                    onChange={(e) => setActivityForm({...activityForm, numberOfPersons: e.target.value})}
                                    placeholder="Number of participants"
                                    className="rounded-xl border-slate-300 focus:border-blue-500 focus:ring-blue-500 transition-all bg-white"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="county" className="text-sm font-medium text-slate-700">County</Label>
                                  <Input
                                    id="county"
                                    value={activityForm.county}
                                    onChange={(e) => setActivityForm({...activityForm, county: e.target.value})}
                                    placeholder="Enter county"
                                    className="rounded-xl border-slate-300 focus:border-blue-500 focus:ring-blue-500 transition-all bg-white"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="subcounty" className="text-sm font-medium text-slate-700">Subcounty</Label>
                                  <Input
                                    id="subcounty"
                                    value={activityForm.subcounty}
                                    onChange={(e) => setActivityForm({...activityForm, subcounty: e.target.value})}
                                    placeholder="Enter subcounty"
                                    className="rounded-xl border-slate-300 focus:border-blue-500 focus:ring-blue-500 transition-all bg-white"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="location" className="text-sm font-medium text-slate-700">Location</Label>
                                  <Input
                                    id="location"
                                    value={activityForm.location}
                                    onChange={(e) => setActivityForm({...activityForm, location: e.target.value})}
                                    placeholder="Enter location"
                                    className="rounded-xl border-slate-300 focus:border-blue-500 focus:ring-blue-500 transition-all bg-white"
                                  />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="namesOfPersons" className="text-sm font-medium text-slate-700">Participant Names</Label>
                                <Textarea
                                  id="namesOfPersons"
                                  value={activityForm.namesOfPersons}
                                  onChange={(e) => setActivityForm({...activityForm, namesOfPersons: e.target.value})}
                                  placeholder="Enter names separated by commas"
                                  className="rounded-xl border-slate-300 focus:border-blue-500 focus:ring-blue-500 transition-all bg-white min-h-[80px]"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="roles" className="text-sm font-medium text-slate-700">Roles</Label>
                                <Textarea
                                  id="roles"
                                  value={activityForm.roles}
                                  onChange={(e) => setActivityForm({...activityForm, roles: e.target.value})}
                                  placeholder="Enter roles separated by commas"
                                  className="rounded-xl border-slate-300 focus:border-blue-500 focus:ring-blue-500 transition-all bg-white min-h-[80px]"
                                />
                              </div>
                            </div>
                            <div className="flex justify-end gap-3">
                              <Button 
                                variant="outline" 
                                onClick={() => setIsAddDialogOpen(false)}
                                className="rounded-xl border-slate-300 hover:border-slate-400 transition-all text-slate-700"
                              >
                                Cancel
                              </Button>
                              <Button 
                                onClick={handleAddActivity}
                                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-xl text-white font-semibold shadow-lg hover:shadow-xl transition-all"
                              >
                                <Calendar className="h-4 w-4 mr-2" />
                                Create Activity
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* View All Activities Dialog */}
        <Dialog open={isViewAllDialogOpen} onOpenChange={setIsViewAllDialogOpen}>
          <DialogContent className="max-w-6xl max-h-[80vh] bg-white rounded-2xl border-0 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-slate-900 flex items-center justify-between">
                <span>All Activities</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsViewAllDialogOpen(false)}
                  className="h-8 w-8 rounded-lg hover:bg-slate-100 transition-colors text-slate-600"
                >
                  <X className="h-4 w-4" />
                </Button>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {allActivities.map((activity) => (
                <div key={activity.id} className="group relative">
                  <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-900 mb-3 group-hover:text-blue-600 transition-colors">
                          {activity.activityName}
                        </h4>
                        <div className="space-y-2 text-sm text-slate-600">
                          <div className="flex items-center gap-3">
                            <Calendar className="h-4 w-4 text-slate-500" />
                            <span className="font-medium">{new Date(activity.date).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <MapPin className="h-4 w-4 text-slate-500" />
                            <span>{activity.location}, {activity.county}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Users className="h-4 w-4 text-slate-500" />
                            <span className="font-semibold">{activity.numberOfPersons} participants</span>
                          </div>
                          {activity.namesOfPersons && (
                            <div>
                              <p className="font-semibold text-blue-600 text-sm">Participants:</p>
                              <p className="text-sm text-slate-700">{activity.namesOfPersons}</p>
                            </div>
                          )}
                          {activity.roles && (
                            <div>
                              <p className="font-semibold text-blue-600 text-sm">Roles:</p>
                              <p className="text-sm text-slate-700">{activity.roles}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          size="sm"
                          onClick={() => openEditDialog(activity)}
                          className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg transition-all shadow-sm"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteActivity(activity.id)}
                          className="rounded-lg transition-all shadow-sm"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Activity Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[600px] bg-white rounded-2xl border-0 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-slate-900">
                Edit Activity
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-activityName" className="text-sm font-medium text-slate-700">Activity Name</Label>
                  <Input
                    id="edit-activityName"
                    value={activityForm.activityName}
                    onChange={(e) => setActivityForm({...activityForm, activityName: e.target.value})}
                    placeholder="Enter activity name"
                    className="rounded-xl border-slate-300 focus:border-blue-500 focus:ring-blue-500 transition-all bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-date" className="text-sm font-medium text-slate-700">Date</Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={activityForm.date}
                    onChange={(e) => setActivityForm({...activityForm, date: e.target.value})}
                    className="rounded-xl border-slate-300 focus:border-blue-500 focus:ring-blue-500 transition-all bg-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-numberOfPersons" className="text-sm font-medium text-slate-700">Participants</Label>
                  <Input
                    id="edit-numberOfPersons"
                    type="number"
                    value={activityForm.numberOfPersons}
                    onChange={(e) => setActivityForm({...activityForm, numberOfPersons: e.target.value})}
                    placeholder="Number of participants"
                    className="rounded-xl border-slate-300 focus:border-blue-500 focus:ring-blue-500 transition-all bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-county" className="text-sm font-medium text-slate-700">County</Label>
                  <Input
                    id="edit-county"
                    value={activityForm.county}
                    onChange={(e) => setActivityForm({...activityForm, county: e.target.value})}
                    placeholder="Enter county"
                    className="rounded-xl border-slate-300 focus:border-blue-500 focus:ring-blue-500 transition-all bg-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-subcounty" className="text-sm font-medium text-slate-700">Subcounty</Label>
                  <Input
                    id="edit-subcounty"
                    value={activityForm.subcounty}
                    onChange={(e) => setActivityForm({...activityForm, subcounty: e.target.value})}
                    placeholder="Enter subcounty"
                    className="rounded-xl border-slate-300 focus:border-blue-500 focus:ring-blue-500 transition-all bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-location" className="text-sm font-medium text-slate-700">Location</Label>
                  <Input
                    id="edit-location"
                    value={activityForm.location}
                    onChange={(e) => setActivityForm({...activityForm, location: e.target.value})}
                    placeholder="Enter location"
                    className="rounded-xl border-slate-300 focus:border-blue-500 focus:ring-blue-500 transition-all bg-white"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-namesOfPersons" className="text-sm font-medium text-slate-700">Participant Names</Label>
                <Textarea
                  id="edit-namesOfPersons"
                  value={activityForm.namesOfPersons}
                  onChange={(e) => setActivityForm({...activityForm, namesOfPersons: e.target.value})}
                  placeholder="Enter names separated by commas"
                  className="rounded-xl border-slate-300 focus:border-blue-500 focus:ring-blue-500 transition-all bg-white min-h-[80px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-roles" className="text-sm font-medium text-slate-700">Roles</Label>
                <Textarea
                  id="edit-roles"
                  value={activityForm.roles}
                  onChange={(e) => setActivityForm({...activityForm, roles: e.target.value})}
                  placeholder="Enter roles separated by commas"
                  className="rounded-xl border-slate-300 focus:border-blue-500 focus:ring-blue-500 transition-all bg-white min-h-[80px]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => setIsEditDialogOpen(false)}
                className="rounded-xl border-slate-300 hover:border-slate-400 transition-all text-slate-700"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleEditActivity}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-xl text-white font-semibold shadow-lg hover:shadow-xl transition-all"
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