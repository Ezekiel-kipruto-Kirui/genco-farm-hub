import DataTable from "@/components/DataTable";

const UserManagementPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold mb-2">User Management</h2>
        <p className="text-muted-foreground">Manage system users and permissions</p>
      </div>
      <DataTable 
        collectionName="users" 
        canEdit={true}
      />
    </div>
  );
};

export default UserManagementPage;
