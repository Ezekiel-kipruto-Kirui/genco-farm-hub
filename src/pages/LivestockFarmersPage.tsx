import { useAuth } from "@/contexts/AuthContext";
import DataTable from "@/components/DataTable";

const LivestockFarmersPage = () => {
  const { userRole } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold mb-2">Livestock Farmers</h2>
        <p className="text-muted-foreground">Manage livestock farmer records</p>
      </div>
      <DataTable 
        collectionName="Livestock Farmers" 
        canEdit={userRole === "chief-admin"}
      />
    </div>
  );
};

export default LivestockFarmersPage;
