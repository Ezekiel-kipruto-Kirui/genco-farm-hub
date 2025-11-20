import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { collection, getDocs, query, addDoc, updateDoc, doc, deleteDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Download, Users, Edit, Trash2, GraduationCap, Eye, MapPin, Upload, Plus, Calendar, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';

interface OnboardingData {
    id?: string;
    date: Date;
    topic: string;
    fieldofficer: string;
    fieldofficerrole: string;
    farmername: string;
    farmeridNo: string;
    farmerphoneNo: string;
    farmerlocation: string;
    farmerregion: string;
    createdAt?: Date;
}

interface Filters {
    startDate: string;
    endDate: string;
}

interface Stats {
    totalFarmers: number;
    totalOnboarding: number;
    uniqueLocations: number;
}

const OnboardingPage = () => {
    const [onboarding, setOnboarding] = useState<OnboardingData[]>([]);
    const [filteredOnboarding, setFilteredOnboarding] = useState<OnboardingData[]>([]);
    const [onboardingForm, setOnboardingForm] = useState({
        id: "",
        topic: "",
        date: "",
        fieldofficer: "",
        fieldofficerrole: "",
        farmername: "",
        farmeridNo: "",
        farmerphoneNo: "",
        farmerregion: "",
        farmerlocation: "",
    });
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<OnboardingData | null>(null);
    const [loading, setLoading] = useState(false);
    const [exportLoading, setExportLoading] = useState(false);
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Filters state - simplified
    const [filters, setFilters] = useState<Filters>({
        startDate: "",
        endDate: "",
    });

    const [stats, setStats] = useState<Stats>({
        totalFarmers: 0,
        totalOnboarding: 0,
        uniqueLocations: 0
    });

    // Get current month dates for default filter
    const getCurrentMonthDates = () => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        return {
            startDate: startOfMonth.toISOString().split('T')[0],
            endDate: endOfMonth.toISOString().split('T')[0]
        };
    };

    const currentMonth = useMemo(getCurrentMonthDates, []);

    // Excel file reading function
    const readExcelFile = (file: File): Promise<any[]> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);
                    resolve(jsonData);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    };

    // Fetch onboarding data
    const fetchOnboardingData = async () => {
        try {
            setLoading(true);
            const q = query(collection(db, "Onboarding"));
            const querySnapshot = await getDocs(q);
            const data = querySnapshot.docs.map(doc => {
                const docData = doc.data();
                return {
                    id: doc.id,
                    date: docData.date?.toDate() || new Date(),
                    topic: docData.topic || "",
                    fieldofficer: docData.fieldofficer || "",
                    fieldofficerrole: docData.fieldofficerrole || "",
                    farmername: docData.farmername || "",
                    farmeridNo: docData.farmeridNo || "",
                    farmerphoneNo: docData.farmerphoneNo || "",
                    farmerlocation: docData.farmerlocation || "",
                    farmerregion: docData.farmerregion || "",
                    createdAt: docData.createdAt?.toDate() || new Date()
                } as OnboardingData;
            });
            setOnboarding(data);
            setFilteredOnboarding(data);
        } catch (error) {
            console.error("Error fetching onboarding data:", error);
            toast({
                title: "Error",
                description: "Failed to fetch onboarding data",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOnboardingData();
    }, []);

    // Filter and process data - simplified
    const filterAndProcessData = useCallback((data: OnboardingData[], filterParams: Filters) => {
        const filtered = data.filter(record => {
            // Date filter only
            if (filterParams.startDate || filterParams.endDate) {
                const recordDate = new Date(record.date);
                recordDate.setHours(0, 0, 0, 0);

                const startDate = filterParams.startDate ? new Date(filterParams.startDate) : null;
                const endDate = filterParams.endDate ? new Date(filterParams.endDate) : null;
                if (startDate) startDate.setHours(0, 0, 0, 0);
                if (endDate) endDate.setHours(23, 59, 59, 999);

                if (startDate && recordDate < startDate) return false;
                if (endDate && recordDate > endDate) return false;
            }

            return true;
        });

        // Calculate stats
        const uniqueFarmers = new Set(filtered.map(record => record.farmeridNo || record.farmername));
        const uniqueLocations = new Set(filtered.map(record => record.farmerlocation).filter(Boolean));

        const calculatedStats = {
            totalFarmers: uniqueFarmers.size,
            totalOnboarding: filtered.length,
            uniqueLocations: uniqueLocations.size
        };

        return {
            filteredOnboarding: filtered,
            stats: calculatedStats
        };
    }, []);

    // Apply filters when data or filters change
    useEffect(() => {
        if (onboarding.length === 0) return;

        const result = filterAndProcessData(onboarding, filters);
        setFilteredOnboarding(result.filteredOnboarding);
        setStats(result.stats);
    }, [onboarding, filters, filterAndProcessData]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setOnboardingForm(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleFilterChange = (key: keyof Filters, value: string) => {
        setFilters(prev => ({ 
            ...prev, 
            [key]: value
        }));
    };

    const resetForm = () => {
        setOnboardingForm({
            id: "",
            topic: "",
            date: "",
            fieldofficer: "",
            fieldofficerrole: "",
            farmername: "",
            farmeridNo: "",
            farmerphoneNo: "",
            farmerregion: "",
            farmerlocation: "",
        });
    };

    const handleAddOnboarding = async () => {
        try {
            if (!onboardingForm.topic || !onboardingForm.date || !onboardingForm.fieldofficer || !onboardingForm.farmername) {
                toast({
                    title: "Validation Error",
                    description: "Please fill in all required fields",
                    variant: "destructive",
                });
                return;
            }

            setLoading(true);

            if (onboardingForm.id) {
                // Update existing record
                await updateDoc(doc(db, "Onboarding", onboardingForm.id), {
                    ...onboardingForm,
                    date: new Date(onboardingForm.date),
                    updatedAt: new Date()
                });
                toast({
                    title: "Success",
                    description: "Onboarding record updated successfully",
                });
            } else {
                // Add new record
                await addDoc(collection(db, "Onboarding"), {
                    ...onboardingForm,
                    date: new Date(onboardingForm.date),
                    createdAt: new Date()
                });
                toast({
                    title: "Success",
                    description: "Onboarding record added successfully",
                });
            }

            resetForm();
            setIsDialogOpen(false);
            fetchOnboardingData();
        } catch (error) {
            console.error("Error saving onboarding record:", error);
            toast({
                title: "Error",
                description: "Failed to save onboarding record",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (record: OnboardingData) => {
        setOnboardingForm({
            id: record.id || "",
            topic: record.topic,
            date: record.date.toISOString().split('T')[0],
            fieldofficer: record.fieldofficer,
            fieldofficerrole: record.fieldofficerrole,
            farmername: record.farmername,
            farmeridNo: record.farmeridNo,
            farmerphoneNo: record.farmerphoneNo,
            farmerregion: record.farmerregion,
            farmerlocation: record.farmerlocation,
        });
        setIsDialogOpen(true);
    };

    const handleDeleteClick = (record: OnboardingData) => {
        setSelectedRecord(record);
        setIsDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!selectedRecord?.id) return;

        try {
            setLoading(true);
            await deleteDoc(doc(db, "Onboarding", selectedRecord.id));
            
            toast({
                title: "Success",
                description: "Onboarding record deleted successfully",
            });
            
            setIsDeleteDialogOpen(false);
            setSelectedRecord(null);
            fetchOnboardingData();
        } catch (error) {
            console.error("Error deleting onboarding record:", error);
            toast({
                title: "Error",
                description: "Failed to delete onboarding record",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleView = (record: OnboardingData) => {
        setSelectedRecord(record);
        // You can implement a view dialog here if needed
        toast({
            title: "Record Details",
            description: `Viewing record for ${record.farmername}`,
        });
    };

    const handleExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            setLoading(true);
            
            const data = await readExcelFile(file);
            const validatedData = validateExcelData(data);
            
            if (validatedData.length === 0) {
                toast({
                    title: "No valid data",
                    description: "The Excel file doesn't contain valid onboarding data or has incorrect format",
                    variant: "destructive",
                });
                return;
            }

            const batch = writeBatch(db);
            const onboardingCollection = collection(db, "Onboarding");

            validatedData.forEach((record) => {
                const docRef = doc(onboardingCollection);
                batch.set(docRef, {
                    topic: record.topic,
                    date: new Date(record.date),
                    fieldofficer: record.fieldofficer,
                    fieldofficerrole: record.fieldofficerrole,
                    farmername: record.farmername,
                    farmeridNo: record.farmeridNo,
                    farmerphoneNo: record.farmerphoneNo,
                    farmerlocation: record.farmerlocation,
                    farmerregion: record.farmerregion,
                    createdAt: new Date()
                });
            });

            await batch.commit();

            toast({
                title: "Success",
                description: `Successfully uploaded ${validatedData.length} onboarding records`,
            });

            setIsUploadDialogOpen(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
            fetchOnboardingData();
        } catch (error) {
            console.error("Error uploading Excel file:", error);
            toast({
                title: "Upload Failed",
                description: "Failed to upload Excel file. Please check the format and try again.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const validateExcelData = (data: any[]): OnboardingData[] => {
        return data.filter(item => 
            item.topic && 
            item.date && 
            item.fieldofficer && 
            item.farmername
        ).map(item => ({
            topic: item.topic || "",
            date: new Date(item.date),
            fieldofficer: item.fieldofficer || "",
            fieldofficerrole: item.fieldofficerrole || "",
            farmername: item.farmername || "",
            farmeridNo: item.farmeridNo || "",
            farmerphoneNo: item.farmerphoneNo || "",
            farmerlocation: item.farmerlocation || "",
            farmerregion: item.farmerregion || ""
        }));
    };

    const downloadTemplate = () => {
        const templateData = [
            {
                topic: "Livestock Management",
                date: "2024-01-15",
                fieldofficer: "John Doe",
                fieldofficerrole: "Field Officer",
                farmername: "Samuel Kariuki",
                farmeridNo: "12345678",
                farmerphoneNo: "0712345678",
                farmerlocation: "Nakuru",
                farmerregion: "Rift Valley"
            },
            {
                topic: "Crop Rotation",
                date: "2024-01-16",
                fieldofficer: "Jane Smith",
                fieldofficerrole: "Agricultural Officer",
                farmername: "Mary Wanjiku",
                farmeridNo: "87654321",
                farmerphoneNo: "0723456789",
                farmerlocation: "Kiambu",
                farmerregion: "Central"
            }
        ];

        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, "onboarding_template.xlsx");
    };

    const handleExport = () => {
        try {
            if (filteredOnboarding.length === 0) {
                toast({
                    title: "No Data to Export",
                    description: "There are no records matching your current filters",
                    variant: "destructive",
                });
                return;
            }

            const exportData = filteredOnboarding.map(record => ({
                Date: record.date.toLocaleDateString(),
                Topic: record.topic,
                'Field Officer': record.fieldofficer,
                'Field Officer Role': record.fieldofficerrole,
                'Farmer Name': record.farmername,
                'Farmer ID': record.farmeridNo,
                'Phone Number': record.farmerphoneNo,
                Location: record.farmerlocation,
                Region: record.farmerregion,
                'Created Date': record.createdAt?.toLocaleDateString() || 'N/A'
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Onboarding Data");
            XLSX.writeFile(wb, `onboarding_data_${new Date().toISOString().split('T')[0]}.xlsx`);

            toast({
                title: "Export Successful",
                description: `Exported ${filteredOnboarding.length} records`,
            });
        } catch (error) {
            console.error("Error exporting data:", error);
            toast({
                title: "Export Failed",
                description: "Failed to export data. Please try again.",
                variant: "destructive",
            });
        }
    };

    const clearAllFilters = () => {
        setFilters({
            startDate: "",
            endDate: "",
        });
    };

    const resetToCurrentMonth = () => {
        setFilters(prev => ({ ...prev, ...currentMonth }));
    };

    const openAddDialog = () => {
        resetForm();
        setIsDialogOpen(true);
    };

    // StatsCard component
    const StatsCard = ({ title, value, icon: Icon, description, children }: any) => (
        <Card className="bg-white text-slate-900 shadow-lg border border-gray-200 relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-purple-600"></div>
            
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 pl-6">
                <CardTitle className="text-sm font-medium text-gray-400">{title}</CardTitle>
            </CardHeader>
            <CardContent className="pl-6 pb-4 flex flex-row">
                <div className="mr-2 rounded-full">
                    <Icon className="h-8 w-8 text-blue-600" />
                </div>
                <div>
                    <div className="text-2xl font-bold text-green-500 mb-2">{value}</div>
                    {children}
                    {description && (
                        <p className="text-xs mt-2 bg-orange-50 px-2 py-1 rounded-md border border-slate-100">
                            {description}
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    );

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header with Action Buttons */}
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Onboarding</h1>
                <div className="flex gap-2">
                    <Button onClick={handleExport} disabled={exportLoading || filteredOnboarding.length === 0}>
                        <Download className="w-4 h-4 mr-2" />
                        Export ({filteredOnboarding.length})
                    </Button>
                    <Button onClick={() => setIsUploadDialogOpen(true)}>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Excel
                    </Button>
                    <Button onClick={openAddDialog}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Onboarding
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatsCard 
                    title="TOTAL FARMERS" 
                    value={stats.totalFarmers} 
                    icon={Users}
                    description="Unique farmers onboarded"
                />
                <StatsCard 
                    title="ONBOARDING SESSIONS" 
                    value={stats.totalOnboarding} 
                    icon={GraduationCap}
                    description="Total onboarding sessions conducted"
                />
                <StatsCard 
                    title="LOCATIONS COVERED" 
                    value={stats.uniqueLocations} 
                    icon={MapPin}
                    description="Unique locations reached"
                />
            </div>

            {/* Simplified Filters Section */}
            <Card className="shadow-lg border-0 bg-white">
                <CardContent className="space-y-4 pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="startDate" className="font-semibold text-gray-700">From Date</Label>
                            <Input
                                id="startDate"
                                type="date"
                                value={filters.startDate}
                                onChange={(e) => handleFilterChange("startDate", e.target.value)}
                                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-white"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="endDate" className="font-semibold text-gray-700">To Date</Label>
                            <Input
                                id="endDate"
                                type="date"
                                value={filters.endDate}
                                onChange={(e) => handleFilterChange("endDate", e.target.value)}
                                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-white"
                            />
                        </div>

                        <div className="space-y-2 flex items-end">
                            <div className="flex gap-2 w-full">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={clearAllFilters}
                                    className="flex-1 border-gray-300 hover:bg-gray-50"
                                >
                                    <X className="w-4 h-4 mr-1" />
                                    Clear
                                </Button>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={resetToCurrentMonth}
                                    className="flex-1 border-gray-300 hover:bg-gray-50"
                                >
                                    <Calendar className="w-4 h-4 mr-1" />
                                    This Month
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Onboarding Records Table */}
            <Card className="shadow-lg border-0 bg-white">
                <CardHeader>
                    <CardTitle>Onboarding Records</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                            <p className="text-muted-foreground mt-2">Loading onboarding data...</p>
                        </div>
                    ) : filteredOnboarding.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            {onboarding.length === 0 ? "No onboarding records found" : "No records found matching your criteria"}
                        </div>
                    ) : (
                        <div className="w-full overflow-x-auto rounded-md">
                            <table className="w-full border-collapse border border-gray-300 text-sm text-left whitespace-nowrap">
                                <thead className="rounded">
                                    <tr className="bg-blue-100 p-1 px-3">
                                        <th className="text-left py-3 px-4 font-medium text-gray-600">Date</th>
                                        <th className="text-left py-3 px-4 font-medium text-gray-600">Topic</th>
                                        <th className="text-left py-3 px-4 font-medium text-gray-600">Field Officer</th>
                                        <th className="text-left py-3 px-4 font-medium text-gray-600">Officer Role</th>
                                        <th className="text-left py-3 px-4 font-medium text-gray-600">Farmer Name</th>
                                        <th className="text-left py-3 px-4 font-medium text-gray-600">Farmer ID</th>
                                        <th className="text-left py-3 px-4 font-medium text-gray-600">Phone</th>
                                        <th className="text-left py-3 px-4 font-medium text-gray-600">Location</th>
                                        <th className="text-left py-3 px-4 font-medium text-gray-600">Region</th>
                                        <th className="text-left py-3 px-4 font-medium text-gray-600">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredOnboarding.map((record, index) => (
                                        <tr key={record.id || index} className="border-b hover:bg-blue-50 transition-all duration-200 group text-sm">
                                            <td className="py-3 px-4 text-xs text-gray-600">
                                                {record.date.toLocaleDateString()}
                                            </td>
                                            <td className="py-3 px-4 text-xs text-gray-600 font-medium">
                                                {record.topic}
                                            </td>
                                            <td className="py-3 px-4 text-xs text-gray-600">
                                                {record.fieldofficer}
                                            </td>
                                            <td className="py-3 px-4 text-xs text-gray-600">
                                                {record.fieldofficerrole || 'N/A'}
                                            </td>
                                            <td className="py-3 px-4 text-xs text-gray-600 font-medium">
                                                {record.farmername}
                                            </td>
                                            <td className="py-3 px-4 text-xs text-gray-600">
                                                <code className="text-sm bg-gray-100 px-2 py-1 rounded text-gray-700">
                                                    {record.farmeridNo || 'N/A'}
                                                </code>
                                            </td>
                                            <td className="py-3 px-4 text-xs text-gray-600">
                                                {record.farmerphoneNo || 'N/A'}
                                            </td>
                                            <td className="py-3 px-4 text-xs text-gray-600">
                                                {record.farmerlocation || 'N/A'}
                                            </td>
                                            <td className="py-3 px-4 text-xs text-gray-600">
                                                <Badge variant="secondary">
                                                    {record.farmerregion || 'N/A'}
                                                </Badge>
                                            </td>
                                            <td className="py-3 px-4 text-xs text-gray-600">
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600 border-blue-200"
                                                        onClick={() => handleView(record)}
                                                    >
                                                        <Eye className="h-3 w-3 text-blue-500" />
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 hover:bg-green-50 hover:text-green-600 border-green-200"
                                                        onClick={() => handleEdit(record)}
                                                    >
                                                        <Edit className="h-3 w-3 text-green-500" />
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600 border-red-200"
                                                        onClick={() => handleDeleteClick(record)}
                                                    >
                                                        <Trash2 className="h-3 w-3 text-red-500" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Add/Edit Onboarding Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {onboardingForm.id ? "Edit Onboarding Record" : "Add New Onboarding"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
                        <div className="space-y-2">
                            <Label htmlFor="topic">Topic *</Label>
                            <Input
                                id="topic"
                                name="topic"
                                value={onboardingForm.topic}
                                onChange={handleInputChange}
                                placeholder="Enter training topic"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="date">Date *</Label>
                            <Input
                                id="date"
                                name="date"
                                type="date"
                                value={onboardingForm.date}
                                onChange={handleInputChange}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="fieldofficer">Field Officer *</Label>
                            <Input
                                id="fieldofficer"
                                name="fieldofficer"
                                value={onboardingForm.fieldofficer}
                                onChange={handleInputChange}
                                placeholder="Enter field officer name"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="fieldofficerrole">Field Officer Role</Label>
                            <Input
                                id="fieldofficerrole"
                                name="fieldofficerrole"
                                value={onboardingForm.fieldofficerrole}
                                onChange={handleInputChange}
                                placeholder="Enter field officer role"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="farmername">Farmer Name *</Label>
                            <Input
                                id="farmername"
                                name="farmername"
                                value={onboardingForm.farmername}
                                onChange={handleInputChange}
                                placeholder="Enter farmer name"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="farmeridNo">Farmer ID Number</Label>
                            <Input
                                id="farmeridNo"
                                name="farmeridNo"
                                value={onboardingForm.farmeridNo}
                                onChange={handleInputChange}
                                placeholder="Enter farmer ID number"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="farmerphoneNo">Farmer Phone Number</Label>
                            <Input
                                id="farmerphoneNo"
                                name="farmerphoneNo"
                                value={onboardingForm.farmerphoneNo}
                                onChange={handleInputChange}
                                placeholder="Enter farmer phone number"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="farmerregion">Region</Label>
                            <Input
                                id="farmerregion"
                                name="farmerregion"
                                value={onboardingForm.farmerregion}
                                onChange={handleInputChange}
                                placeholder="Enter region"
                            />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="farmerlocation">Location</Label>
                            <Input
                                id="farmerlocation"
                                name="farmerlocation"
                                value={onboardingForm.farmerlocation}
                                onChange={handleInputChange}
                                placeholder="Enter location"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleAddOnboarding} disabled={loading}>
                            {loading ? "Saving..." : (onboardingForm.id ? "Update" : "Add")} Onboarding
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Deletion</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete the onboarding record for{" "}
                            <strong>{selectedRecord?.farmername}</strong>? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDeleteConfirm} disabled={loading}>
                            {loading ? "Deleting..." : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Upload Excel Dialog */}
            <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Upload Excel File</DialogTitle>
                        <DialogDescription>
                            Upload an Excel file containing multiple onboarding records. 
                            Download the template to ensure correct format.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <Button onClick={downloadTemplate} variant="outline">
                            <Download className="w-4 h-4 mr-2" />
                            Download Template
                        </Button>
                        <Input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={handleExcelUpload}
                            disabled={loading}
                        />
                        <p className="text-sm text-muted-foreground">
                            Supported formats: .xlsx, .xls, .csv
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default OnboardingPage;