import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Tooltip, BarChart, Bar } from "recharts";
import { TrendingUp } from "lucide-react";

const FodderOfftakeAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [regionData, setRegionData] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0 });

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "Fodder Offtake Data"));
      const data = querySnapshot.docs.map(doc => doc.data());

      setStats({ total: data.length });

      const monthCount: Record<string, number> = {};
      data.forEach(item => {
        const date = item.date || item.Date;
        if (date) {
          const month = new Date(date).toLocaleString('default', { month: 'short', year: 'numeric' });
          monthCount[month] = (monthCount[month] || 0) + 1;
        }
      });
      setMonthlyData(
        Object.entries(monthCount).map(([name, value]) => ({ name, value }))
      );

      const regionCount: Record<string, number> = {};
      data.forEach(item => {
        const region = String(item.region || item.Region || "Unknown");
        regionCount[region] = (regionCount[region] || 0) + 1;
      });
      setRegionData(
        Object.entries(regionCount).map(([name, value]) => ({ name, value }))
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
        <h2 className="text-3xl font-bold font-display mb-2">Fodder Offtake Analytics</h2>
        <p className="text-muted-foreground">Sales and offtake insights</p>
      </div>

      <div className="grid gap-4 md:grid-cols-1">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display">Monthly Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="value" stroke="hsl(142 76% 36%)" name="Offtake" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display">Regional Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={regionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="hsl(142 76% 36%)" name="Records" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default FodderOfftakeAnalytics;
