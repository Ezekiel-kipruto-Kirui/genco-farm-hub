import { useAuth } from "@/contexts/AuthContext";
import DataTable from "@/components/DataTable";

const LivestockOfftakePage = () => {
  const { userRole } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold mb-2">Livestock Offtake Data</h2>
        <p className="text-muted-foreground">Manage livestock offtake records</p>
      </div>
      <DataTable 
        collectionName="Livestock Offtake Data" 
        canEdit={userRole === "chief-admin"}
      />
    </div>
  );
};

export default LivestockOfftakePage;
