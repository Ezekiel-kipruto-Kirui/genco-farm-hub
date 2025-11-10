import { useAuth } from "@/contexts/AuthContext";
import DataTable from "@/components/DataTable";

const InfrastructurePage = () => {
  const { userRole } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold mb-2">Infrastructure Data</h2>
        <p className="text-muted-foreground">Manage infrastructure records</p>
      </div>
      <DataTable 
        collectionName="Infrastructure Data" 
        canEdit={userRole === "chief-admin"}
      />
    </div>
  );
};

export default InfrastructurePage;
