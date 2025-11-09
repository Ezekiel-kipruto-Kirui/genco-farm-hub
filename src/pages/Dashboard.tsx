import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, Sprout, Wheat, Building2, GraduationCap, TrendingUp, Users } from "lucide-react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import DataTable from "@/components/DataTable";
import StatsCard from "@/components/StatsCard";

interface DataCounts {
  livestock: number;
  fodder: number;
  infrastructure: number;
  capacity: number;
  livestockOfftake: number;
  fodderOfftake: number;
  users: number;
}

const Dashboard = () => {
  const { user, userRole, signOutUser } = useAuth();
  const [dataCounts, setDataCounts] = useState<DataCounts>({
    livestock: 0,
    fodder: 0,
    infrastructure: 0,
    capacity: 0,
    livestockOfftake: 0,
    fodderOfftake: 0,
    users: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const collections = [
          { name: "Livestock Farmers", key: "livestock" },
          { name: "Fodder Farmers", key: "fodder" },
          { name: "Infrastructure Data", key: "infrastructure" },
          { name: "Capacity Building", key: "capacity" },
          { name: "Livestock Offtake Data", key: "livestockOfftake" },
          { name: "Fodder Offtake Data", key: "fodderOfftake" },
          { name: "users", key: "users" },
        ];

        const counts: any = {};
        
        await Promise.all(
          collections.map(async ({ name, key }) => {
            const snapshot = await getDocs(collection(db, name));
            counts[key] = snapshot.size;
          })
        );

        setDataCounts(counts as DataCounts);
      } catch (error) {
        console.error("Error fetching counts:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCounts();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Sprout className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">GenCo Agriculture</h1>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">
              {userRole === "chief-admin" ? "Chief Admin" : "Admin"}
            </span>
            <Button variant="outline" size="sm" onClick={signOutUser}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4 mb-8">
              <StatsCard
                title="Livestock Farmers"
                value={dataCounts.livestock}
                icon={<Sprout className="h-5 w-5" />}
                trend="+12%"
              />
              <StatsCard
                title="Fodder Farmers"
                value={dataCounts.fodder}
                icon={<Wheat className="h-5 w-5" />}
                trend="+8%"
              />
              <StatsCard
                title="Infrastructure"
                value={dataCounts.infrastructure}
                icon={<Building2 className="h-5 w-5" />}
                trend="+5%"
              />
              <StatsCard
                title="Training Programs"
                value={dataCounts.capacity}
                icon={<GraduationCap className="h-5 w-5" />}
                trend="+15%"
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Data Management</CardTitle>
                <CardDescription>View and manage your agricultural data</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="livestock" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 lg:grid-cols-7">
                    <TabsTrigger value="livestock">Livestock</TabsTrigger>
                    <TabsTrigger value="fodder">Fodder</TabsTrigger>
                    <TabsTrigger value="infrastructure">Infrastructure</TabsTrigger>
                    <TabsTrigger value="capacity">Capacity</TabsTrigger>
                    <TabsTrigger value="livestock-offtake">L. Offtake</TabsTrigger>
                    <TabsTrigger value="fodder-offtake">F. Offtake</TabsTrigger>
                    {userRole === "chief-admin" && (
                      <TabsTrigger value="users">Users</TabsTrigger>
                    )}
                  </TabsList>

                  <TabsContent value="livestock" className="mt-6">
                    <DataTable 
                      collectionName="Livestock Farmers" 
                      canEdit={userRole === "chief-admin"}
                    />
                  </TabsContent>

                  <TabsContent value="fodder" className="mt-6">
                    <DataTable 
                      collectionName="Fodder Farmers" 
                      canEdit={userRole === "chief-admin"}
                    />
                  </TabsContent>

                  <TabsContent value="infrastructure" className="mt-6">
                    <DataTable 
                      collectionName="Infrastructure Data" 
                      canEdit={userRole === "chief-admin"}
                    />
                  </TabsContent>

                  <TabsContent value="capacity" className="mt-6">
                    <DataTable 
                      collectionName="Capacity Building" 
                      canEdit={userRole === "chief-admin"}
                    />
                  </TabsContent>

                  <TabsContent value="livestock-offtake" className="mt-6">
                    <DataTable 
                      collectionName="Livestock Offtake Data" 
                      canEdit={userRole === "chief-admin"}
                    />
                  </TabsContent>

                  <TabsContent value="fodder-offtake" className="mt-6">
                    <DataTable 
                      collectionName="Fodder Offtake Data" 
                      canEdit={userRole === "chief-admin"}
                    />
                  </TabsContent>

                  {userRole === "chief-admin" && (
                    <TabsContent value="users" className="mt-6">
                      <DataTable 
                        collectionName="users" 
                        canEdit={true}
                      />
                    </TabsContent>
                  )}
                </Tabs>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
