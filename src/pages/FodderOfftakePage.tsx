import { useAuth } from "@/contexts/AuthContext";
import DataTable from "@/components/DataTable";

const FodderOfftakePage = () => {
  const { userRole } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold mb-2">Fodder Offtake Data</h2>
        <p className="text-muted-foreground">Manage fodder offtake records</p>
      </div>
      <DataTable 
        collectionName="Fodder Offtake Data" 
        canEdit={userRole === "chief-admin"}
      />
    </div>
  );
};

export default FodderOfftakePage;
