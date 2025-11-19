import { useState, useEffect } from "react";
import { collection, getDocs, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Bell,
  ArrowRight,
  Trash2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

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

interface Participant {
  name: string;
  role: string;
}

interface Activity {
  id: string;
  activityName: string;
  date: string;
  numberOfPersons: number;
  county: string;
  location: string;
  participants: Participant[];
  subcounty: string;
  createdAt: any;
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
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

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'pending': { color: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
      'in-progress': { color: 'bg-blue-100 text-blue-800', label: 'In Progress' },
      'completed': { color: 'bg-green-100 text-green-800', label: 'Completed' },
      'cancelled': { color: 'bg-red-100 text-red-800', label: 'Cancelled' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge className={`${config.color} border-0 text-xs`}>{config.label}</Badge>;
  };

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-slate-50 to-slate-100/80 shadow-sm">
              <th className="p-4 text-left font-semibold text-slate-700 text-sm">Activity Name</th>
              <th className="p-4 text-left font-semibold text-slate-700 text-sm">Date</th>
              <th className="p-4 text-left font-semibold text-slate-700 text-sm">Status</th>
              <th className="p-4 text-left font-semibold text-slate-700 text-sm">Location</th>
              <th className="p-4 text-left font-semibold text-slate-700 text-sm">Participants</th>
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
                  {getStatusBadge(activity.status)}
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
  const [pendingActivitiesCount, setPendingActivitiesCount] = useState(0);
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [participantForm, setParticipantForm] = useState({
    name: "",
    role: ""
  });
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [activityForm, setActivityForm] = useState({
    activityName: "",
    date: "",
    numberOfPersons: "",
    county: "",
    subcounty: "",
    location: "",
  });
  const { toast } = useToast();
  const { user } = useAuth();
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
      const activitiesSnapshot = await getDocs(collection(db, "Recent Activities"));
      const activities = activitiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Activity[];

      // Sort by date and get latest 3
      const sortedActivities = activities
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 3);

      setRecentActivities(sortedActivities);

      // Count pending activities for notification
      const pendingCount = activities.filter(activity => activity.status === 'pending').length;
      setPendingActivitiesCount(pendingCount);
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

  const handleAddParticipant = () => {
    if (participantForm.name.trim() && participantForm.role.trim()) {
      setParticipants([...participants, { ...participantForm }]);
      setParticipantForm({ name: "", role: "" });
    }
  };

  const removeParticipant = (index: number) => {
    const updatedParticipants = participants.filter((_, i) => i !== index);
    setParticipants(updatedParticipants);
  };

  const handleAddActivity = async () => {
    if (participants.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one participant",
        variant: "destructive",
      });
      return;
    }

    try {
      await addDoc(collection(db, "Recent Activities"), {
        ...activityForm,
        numberOfPersons: participants.length,
        participants: participants,
        status: 'pending', // Default status
        createdBy: user?.email,
        createdAt: new Date(),
      });
      toast({
        title: "Success",
        description: "Activity scheduled successfully.",
        className: "bg-white text-slate-900 border border-slate-200"
      });
      setActivityForm({
        activityName: "",
        date: "",
        numberOfPersons: "",
        county: "",
        subcounty: "",
        location: "",
      });
      setParticipants([]);
      setIsAddDialogOpen(false);
      fetchRecentActivities();
    } catch (error) {
      console.error("Error adding activity:", error);
      toast({
        title: "Error",
        description: "Failed to schedule activity. Please try again.",
        variant: "destructive",
      });
    }
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
        {/* Header with Notification Bell */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Dashboard Overview</h1>
            <p className="text-slate-600 mt-2">Welcome back! Here's what's happening today.</p>
          </div>
          <Link to="/activities">
            <Button variant="outline" className="relative">
              <Bell className="h-4 w-4 mr-2" />
              Activities
              {pendingActivitiesCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
                  {pendingActivitiesCount}
                </span>
              )}
            </Button>
          </Link>
        </div>

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
                        <MapPin className="h-7 w-7 text-purple-600" />
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center shadow-lg mr-3">
                        <Activity className="w-4 h-4 text-white" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900">Recent Activities</h3>
                    </div>
                    <Link to="/dashboard/activities">
                      <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900">
                        View All <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="p-6">
                  {activitiesLoading ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full rounded-xl" />
                      ))}
                    </div>
                  ) : recentActivities.length > 0 ? (
                    <>
                      <ActivityTable activities={recentActivities} />
                      
                      {/* Action Buttons at Bottom */}
                      <div className="flex justify-between items-center pt-6 mt-6 border-t border-slate-200">
                        <Link to="/dashboard/activities">
                          <Button 
                            variant="outline"
                            className="border-slate-300 text-slate-700 hover:bg-slate-50 font-medium px-4 py-2 rounded-xl transition-all duration-200 shadow-sm"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View All Activities
                          </Button>
                        </Link>
                        
                        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                          <DialogTrigger asChild>
                            <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold px-4 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200">
                              <Plus className="h-4 w-4 mr-2" />
                              Schedule Activity
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[700px] bg-white rounded-2xl border-0 shadow-2xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle className="text-xl font-semibold text-slate-900">
                                Schedule New Activity
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
                                  <Label htmlFor="county" className="text-sm font-medium text-slate-700">County</Label>
                                  <Input
                                    id="county"
                                    value={activityForm.county}
                                    onChange={(e) => setActivityForm({...activityForm, county: e.target.value})}
                                    placeholder="Enter county"
                                    className="rounded-xl border-slate-300 focus:border-blue-500 focus:ring-blue-500 transition-all bg-white"
                                  />
                                </div>
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

                              {/* Participants Section */}
                              <div className="space-y-4 border-t pt-4">
                                <div className="flex items-center justify-between">
                                  <Label className="text-sm font-medium text-slate-700">Participants ({participants.length})</Label>
                                  <span className="text-xs text-slate-500">Add participants with their roles</span>
                                </div>
                                
                                {/* Add Participant Form */}
                                <div className="grid grid-cols-2 gap-3">
                                  <Input
                                    placeholder="Participant Name"
                                    value={participantForm.name}
                                    onChange={(e) => setParticipantForm({...participantForm, name: e.target.value})}
                                    className="rounded-xl border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                                  />
                                  <div className="flex gap-2">
                                    <Input
                                      placeholder="Role"
                                      value={participantForm.role}
                                      onChange={(e) => setParticipantForm({...participantForm, role: e.target.value})}
                                      className="rounded-xl border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                                    />
                                    <Button 
                                      type="button" 
                                      onClick={handleAddParticipant}
                                      className="bg-blue-500 hover:bg-blue-600 text-white rounded-xl"
                                      disabled={!participantForm.name.trim() || !participantForm.role.trim()}
                                    >
                                      <Plus className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>

                                {/* Participants List */}
                                {participants.length > 0 && (
                                  <div className="space-y-2 max-h-40 overflow-y-auto">
                                    {participants.map((participant, index) => (
                                      <div key={index} className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                                        <div className="flex-1">
                                          <p className="font-medium text-slate-900">{participant.name}</p>
                                          <p className="text-sm text-slate-600">{participant.role}</p>
                                        </div>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => removeParticipant(index)}
                                          className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                              <Button 
                                variant="outline" 
                                onClick={() => {
                                  setIsAddDialogOpen(false);
                                  setParticipants([]);
                                }}
                                className="rounded-xl border-slate-300 hover:border-slate-400 transition-all text-slate-700"
                              >
                                Cancel
                              </Button>
                              <Button 
                                onClick={handleAddActivity}
                                disabled={participants.length === 0}
                                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-xl text-white font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                              >
                                <Calendar className="h-4 w-4 mr-2" />
                                Schedule Activity
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-8 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50/50">
                      <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <Activity className="h-8 w-8 text-white" />
                      </div>
                      <h4 className="text-xl font-bold text-slate-800 mb-2">
                        No activities yet
                      </h4>
                      <p className="text-slate-600 mb-4">
                        Start scheduling your field activities and events to see them displayed here.
                      </p>
                      <div className="flex justify-center">
                        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                          <DialogTrigger asChild>
                            <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold px-4 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200">
                              <Plus className="h-4 w-4 mr-2" />
                              Schedule Your First Activity
                            </Button>
                          </DialogTrigger>
                        </Dialog>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DashboardOverview;