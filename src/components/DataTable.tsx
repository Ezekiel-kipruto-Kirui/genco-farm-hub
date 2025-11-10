import { useState, useEffect } from "react";
import { collection, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Trash2, Edit, Save, X, Download, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface DataTableProps {
  collectionName: string;
  canEdit: boolean;
}

interface EditFormData {
  [key: string]: any;
}

const DataTable = ({ collectionName, canEdit }: DataTableProps) => {
  const [data, setData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<EditFormData>({});
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [collectionName]);

  useEffect(() => {
    if (searchQuery) {
      const filtered = data.filter((item) =>
        Object.values(item).some((value) =>
          String(value).toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
      setFilteredData(filtered);
    } else {
      setFilteredData(data);
    }
  }, [searchQuery, data]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, collectionName));
      const items = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setData(items);
      setFilteredData(items);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to fetch data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, collectionName, id));
      toast({
        title: "Success",
        description: "Record deleted successfully.",
      });
      fetchData();
    } catch (error) {
      console.error("Error deleting document:", error);
      toast({
        title: "Error",
        description: "Failed to delete record. Please try again.",
        variant: "destructive",
      });
    }
    setDeleteId(null);
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setEditFormData({ ...item });
    setIsEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingId) return;

    try {
      const docRef = doc(db, collectionName, editingId);
      const { id, ...updateData } = editFormData;
      await updateDoc(docRef, updateData);
      
      toast({
        title: "Success",
        description: "Record updated successfully.",
      });
      
      fetchData();
      setIsEditDialogOpen(false);
      setEditingId(null);
      setEditFormData({});
    } catch (error) {
      console.error("Error updating document:", error);
      toast({
        title: "Error",
        description: "Failed to update record. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleExport = () => {
    const columns = Object.keys(data[0]).filter((key) => key !== "id");
    const headers = columns.join(",");
    const rows = filteredData.map((item) =>
      columns.map((col) => {
        const value = item[col] || "";
        return typeof value === "string" && value.includes(",") ? `"${value}"` : value;
      }).join(",")
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${collectionName}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast({
      title: "Success",
      description: "Data exported successfully.",
    });
  };

  const formatColumnName = (column: string) => {
    return column.charAt(0).toUpperCase() + column.slice(1).replace(/([A-Z])/g, ' $1').trim();
  };

  const formatValue = (value: any) => {
    if (value === null || value === undefined) return "-";
    
    const stringValue = String(value);
    
    // Format dates
    if (!isNaN(Date.parse(stringValue))) {
      return new Date(stringValue).toLocaleDateString();
    }
    
    // Format booleans
    if (stringValue === "true") return "Yes";
    if (stringValue === "false") return "No";
    
    // Truncate long text
    if (stringValue.length > 50) {
      return stringValue.substring(0, 50) + "...";
    }
    
    return stringValue;
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-lg bg-gradient-to-br from-background to-muted/20">
        <CardContent className="flex flex-col justify-center items-center h-64 space-y-4">
          <div className="relative">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary"></div>
            <div className="absolute inset-0 h-12 w-12 animate-ping rounded-full border-2 border-primary/30"></div>
          </div>
          <p className="text-muted-foreground animate-pulse font-medium">Loading data...</p>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="border-0 shadow-lg bg-gradient-to-br from-background to-muted/20 text-center py-16">
        <CardContent>
          <div className="relative mx-auto w-16 h-16 mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent rounded-full opacity-20 animate-pulse"></div>
            <Download className="h-16 w-16 mx-auto text-muted-foreground/50 relative" />
          </div>
          <h3 className="text-xl font-semibold text-muted-foreground mb-2">No data available</h3>
          <p className="text-sm text-muted-foreground/70 max-w-sm mx-auto">
            There are no records in the "{collectionName}" collection yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const columns = Object.keys(data[0]).filter((key) => key !== "id");

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {formatColumnName(collectionName)}
              </CardTitle>
              <CardDescription>
                Managing {filteredData.length} record{filteredData.length !== 1 ? 's' : ''}
                {searchQuery && (
                  <Badge variant="secondary" className="ml-2">
                    Filtered
                  </Badge>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search records..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-11 rounded-xl border-2 focus:border-primary/50 bg-background/80 backdrop-blur-sm shadow-sm"
                />
              </div>
              <Button 
                onClick={handleExport} 
                variant="outline" 
                className="h-11 px-6 rounded-xl border-2 bg-background/80 backdrop-blur-sm hover:bg-primary hover:text-primary-foreground transition-all duration-200 shadow-sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Data Table */}
      <Card className="border-0 shadow-xl overflow-hidden bg-card/50 backdrop-blur-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-gradient-to-r from-primary/10 to-accent/10">
              <TableRow className="border-b-2 border-primary/20 hover:bg-transparent">
                {columns.map((column) => (
                  <TableHead 
                    key={column} 
                    className="whitespace-nowrap font-bold text-foreground py-4 px-6 text-sm border-r border-primary/10 last:border-r-0"
                  >
                    {formatColumnName(column)}
                  </TableHead>
                ))}
                {canEdit && (
                  <TableHead className="text-right font-bold text-foreground py-4 px-6 text-sm w-32">
                    Actions
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((item, index) => (
                <TableRow
                  key={item.id}
                  className={`border-b border-border/20 hover:bg-primary/5 transition-all duration-200 group ${
                    index % 2 === 0 ? 'bg-background/50' : 'bg-muted/20'
                  }`}
                >
                  {columns.map((column) => (
                    <TableCell 
                      key={column} 
                      className="whitespace-nowrap py-4 px-6 text-sm font-medium border-r border-border/10 last:border-r-0"
                    >
                      <span className="text-foreground/90">
                        {formatValue(item[column])}
                      </span>
                    </TableCell>
                  ))}
                  {canEdit && (
                    <TableCell className="text-right py-4 px-6 border-l border-border/10">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(item)}
                          className="h-9 w-9 p-0 hover:bg-primary hover:text-primary-foreground rounded-lg transition-all duration-200 border-2 shadow-sm"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteId(item.id)}
                          className="h-9 w-9 p-0 hover:bg-destructive hover:text-destructive-foreground rounded-lg transition-all duration-200 border-2 shadow-sm"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {filteredData.length === 0 && searchQuery && (
          <div className="text-center py-12">
            <Search className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground font-medium">No records found</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Try adjusting your search query
            </p>
          </div>
        )}
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="border-0 shadow-2xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-destructive/10 rounded-lg">
                <Trash2 className="h-6 w-6 text-destructive" />
              </div>
              <AlertDialogTitle className="text-lg">Delete Record</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base">
              This action cannot be undone. This will permanently delete the record from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg border-2">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg"
            >
              Delete Record
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="border-0 shadow-2xl max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Edit className="h-6 w-6 text-primary" />
              </div>
              <DialogTitle className="text-lg">Edit Record</DialogTitle>
            </div>
            <DialogDescription>
              Update the record details below. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto py-2">
            {columns.map((column) => (
              <div key={column} className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">
                  {formatColumnName(column)}
                </label>
                <Input
                  value={editFormData[column] || ""}
                  onChange={(e) => handleInputChange(column, e.target.value)}
                  className="rounded-lg border-2 focus:border-primary/50 bg-background/50"
                  placeholder={`Enter ${formatColumnName(column).toLowerCase()}`}
                />
              </div>
            ))}
          </div>
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              className="rounded-lg border-2"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="rounded-lg bg-primary hover:bg-primary/90"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DataTable;