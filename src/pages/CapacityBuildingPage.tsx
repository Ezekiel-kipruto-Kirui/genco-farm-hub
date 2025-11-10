import { useAuth } from "@/contexts/AuthContext";
import DataTable from "@/components/DataTable";

const CapacityBuildingPage = () => {
  const { userRole } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold mb-2">Capacity Building</h2>
        <p className="text-muted-foreground">Manage training and capacity building records</p>
      </div>
      <DataTable 
        collectionName="Capacity Building" 
        canEdit={userRole === "chief-admin"}
      />
    </div>
  );
};

export default CapacityBuildingPage;
