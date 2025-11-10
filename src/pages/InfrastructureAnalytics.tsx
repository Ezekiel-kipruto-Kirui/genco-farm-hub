import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Tooltip, LineChart, Line } from "recharts";
import { Building2 } from "lucide-react";

const InfrastructureAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [typeData, setTypeData] = useState<any[]>([]);
  const [statusData, setStatusData] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0 });

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "Infrastructure Data"));
      const data = querySnapshot.docs.map(doc => doc.data());

      setStats({ total: data.length });

      const typeCount: Record<string, number> = {};
      data.forEach(item => {
        const type = String(item.type || item.Type || "Unknown");
        typeCount[type] = (typeCount[type] || 0) + 1;
      });
      setTypeData(
        Object.entries(typeCount).map(([name, value]) => ({ name, value }))
      );

      const statusCount: Record<string, number> = {};
      data.forEach(item => {
        const status = String(item.status || item.Status || "Unknown");
        statusCount[status] = (statusCount[status] || 0) + 1;
      });
      setStatusData(
        Object.entries(statusCount).map(([name, value]) => ({ name, value }))
      );
    } catch (error) {
      console.error("Error fetching analytics:", error);
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
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold font-display mb-2">Infrastructure Analytics</h2>
        <p className="text-muted-foreground">Visual insights and statistics</p>
      </div>

      <div className="grid gap-4 md:grid-cols-1">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Infrastructure</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Infrastructure by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={typeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="hsl(217 91% 60%)" name="Count" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display">Infrastructure by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="hsl(142 76% 36%)" name="Count" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InfrastructureAnalytics;
