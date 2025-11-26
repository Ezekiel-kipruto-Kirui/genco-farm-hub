import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { collection, getDocs, query, addDoc, updateDoc, doc, deleteDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Download, Users, Edit, Trash2, GraduationCap, Eye, MapPin, Upload, Plus, Calendar, X, UserPlus, User, Phone, Map, FileText, MessageSquare, BookOpen, Heart, Zap, Target, Leaf, Shield, CheckCircle, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import * as XLSX from 'xlsx';

interface FarmerData {
    id?: string;
    name: string;
    idNo: string;
    phoneNo: string;
    location: string;
    region: string;
    gender: string;
    county: string; // Fixed capitalization to match usage
}

interface StaffData {
    name: string;
    role: string;
}

interface OnboardingData {
    id?: string;
    date: Date;
    topic: string;
    comment: string;
    staff: StaffData[];
    farmers: FarmerData[];
    createdAt?: Date;
    status: 'pending' | 'completed';
}

interface Filters {
    startDate: string;
    endDate: string;
}

interface Stats {
    totalFarmers: number;
    totalOnboarding: number;
    uniqueLocations: number;
    completedSessions: number;
    pendingSessions: number;
    maleFarmers: number;
    femaleFarmers: number;
    uniqueCounties: number; // Added county stats
}

// Exportable isChiefAdmin function
export const isChiefAdmin = (userRole: string | null): boolean => {
    return userRole === 'chief-admin';
};

// Function to get icon based on topic
const getTopicIcon = (topic: string) => {
    const topicLower = topic.toLowerCase();
    
    if (topicLower.includes('health') || topicLower.includes('medical') || topicLower.includes('vaccin')) {
        return <Heart className="h-5 w-5 text-red-500" />;
    } else if (topicLower.includes('breed') || topicLower.includes('genetic') || topicLower.includes('reproduction')) {
        return <Leaf className="h-5 w-5 text-green-500" />;
    } else if (topicLower.includes('feed') || topicLower.includes('nutrition') || topicLower.includes('diet')) {
        return <Zap className="h-5 w-5 text-yellow-500" />;
    } else if (topicLower.includes('market') || topicLower.includes('business') || topicLower.includes('economic')) {
        return <Target className="h-5 w-5 text-blue-500" />;
    } else if (topicLower.includes('safety') || topicLower.includes('security') || topicLower.includes('protection')) {
        return <Shield className="h-5 w-5 text-purple-500" />;
    } else {
        return <BookOpen className="h-5 w-5 text-gray-500" />;
    }
};

// Function to get status badge
const getStatusBadge = (status: 'pending' | 'completed') => {
    if (status === 'completed') {
        return (
            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                <CheckCircle className="h-3 w-3 mr-1" />
                Completed
            </Badge>
        );
    } else {
        return (
            <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                <Clock className="h-3 w-3 mr-1" />
                Pending
            </Badge>
        );
    }
};

const OnboardingPage = () => {
    const [onboarding, setOnboarding] = useState<OnboardingData[]>([]);
    const [filteredOnboarding, setFilteredOnboarding] = useState<OnboardingData[]>([]);
    const [displayedOnboarding, setDisplayedOnboarding] = useState<OnboardingData[]>([]);
    const [onboardingForm, setOnboardingForm] = useState({
        id: "",
        topic: "",
        comment: "",
        date: "",
        status: 'pending' as 'pending' | 'completed'
    });
    const [staff, setStaff] = useState<StaffData[]>([
        { name: "", role: "" }
    ]);
    const [farmers, setFarmers] = useState<FarmerData[]>([
        { name: "", idNo: "", phoneNo: "", location: "", region: "", gender: "", county: "" } // Fixed county field
    ]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
    const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<OnboardingData | null>(null);
    const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [exportLoading, setExportLoading] = useState(false);
    const { toast } = useToast();
    const { user, userRole } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const cardsPerPage = 3;

    // Use the exportable isChiefAdmin function
    const userIsChiefAdmin = useMemo(() => {
        return isChiefAdmin(userRole);
    }, [userRole]);

    // Filters state
    const [filters, setFilters] = useState<Filters>({
        startDate: "",
        endDate: "",
    });

    const [stats, setStats] = useState<Stats>({
        totalFarmers: 0,
        totalOnboarding: 0,
        uniqueLocations: 0,
        completedSessions: 0,
        pendingSessions: 0,
        maleFarmers: 0,
        femaleFarmers: 0,
        uniqueCounties: 0 // Added county stats
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
                    comment: docData.comment || "",
                    staff: docData.staff || [],
                    farmers: docData.farmers || [],
                    createdAt: docData.createdAt?.toDate() || new Date(),
                    status: docData.status || 'pending'
                } as OnboardingData;
            });
            setOnboarding(data);
            setFilteredOnboarding(data);
            setSelectedRecords([]); // Clear selections when data refreshes
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

    // Filter and process data
    const filterAndProcessData = useCallback((data: OnboardingData[], filterParams: Filters) => {
        const filtered = data.filter(record => {
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
        const allFarmers = filtered.flatMap(record => record.farmers);
        const uniqueFarmers = new Set(allFarmers.map(farmer => farmer.idNo || farmer.name));
        const uniqueLocations = new Set(allFarmers.map(farmer => farmer.location).filter(Boolean));
        const uniqueCounties = new Set(allFarmers.map(farmer => farmer.county).filter(Boolean)); // Added county stats
        const completedSessions = filtered.filter(record => record.status === 'completed').length;
        const pendingSessions = filtered.filter(record => record.status === 'pending').length;
        
        // Calculate gender stats
        const maleFarmers = allFarmers.filter(farmer => 
            farmer.gender && farmer.gender.toLowerCase() === 'male'
        ).length;
        const femaleFarmers = allFarmers.filter(farmer => 
            farmer.gender && farmer.gender.toLowerCase() === 'female'
        ).length;

        const calculatedStats = {
            totalFarmers: uniqueFarmers.size,
            totalOnboarding: filtered.length,
            uniqueLocations: uniqueLocations.size,
            uniqueCounties: uniqueCounties.size, // Added county stats
            completedSessions,
            pendingSessions,
            maleFarmers,
            femaleFarmers
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
        setCurrentPage(1);
    }, [onboarding, filters, filterAndProcessData]);

    // Update displayed onboarding based on current page
    useEffect(() => {
        const startIndex = (currentPage - 1) * cardsPerPage;
        const endIndex = startIndex + cardsPerPage;
        setDisplayedOnboarding(filteredOnboarding.slice(startIndex, endIndex));
    }, [filteredOnboarding, currentPage]);

    // Pagination functions
    const totalPages = Math.ceil(filteredOnboarding.length / cardsPerPage);
    const hasNextPage = currentPage < totalPages;
    const hasPrevPage = currentPage > 1;

    const handleNextPage = () => {
        if (hasNextPage) {
            setCurrentPage(currentPage + 1);
        }
    };

    const handlePrevPage = () => {
        if (hasPrevPage) {
            setCurrentPage(currentPage - 1);
        }
    };

    // Selection handlers for bulk delete
    const handleSelectRecord = (recordId: string) => {
        setSelectedRecords(prev => 
            prev.includes(recordId) 
                ? prev.filter(id => id !== recordId)
                : [...prev, recordId]
        );
    };

    const handleSelectAllOnPage = () => {
        const pageRecordIds = displayedOnboarding
            .filter(record => record.id)
            .map(record => record.id!) as string[];
        
        if (selectedRecords.length === pageRecordIds.length) {
            // If all are selected, deselect all
            setSelectedRecords([]);
        } else {
            // Select all on current page
            setSelectedRecords(pageRecordIds);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedRecords.length === 0) return;

        try {
            setLoading(true);
            const batch = writeBatch(db);
            
            selectedRecords.forEach(recordId => {
                const recordRef = doc(db, "Onboarding", recordId);
                batch.delete(recordRef);
            });

            await batch.commit();
            
            toast({
                title: "Success",
                description: `Successfully deleted ${selectedRecords.length} onboarding record(s)`,
            });
            
            setIsBulkDeleteDialogOpen(false);
            setSelectedRecords([]);
            fetchOnboardingData();
        } catch (error) {
            console.error("Error deleting onboarding records:", error);
            toast({
                title: "Error",
                description: "Failed to delete onboarding records",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setOnboardingForm(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleStatusChange = (status: 'pending' | 'completed') => {
        setOnboardingForm(prev => ({
            ...prev,
            status
        }));
    };

    const handleStaffChange = (index: number, field: keyof StaffData, value: string) => {
        const updatedStaff = [...staff];
        updatedStaff[index] = {
            ...updatedStaff[index],
            [field]: value
        };
        setStaff(updatedStaff);
    };

    const addStaff = () => {
        setStaff(prev => [...prev, { name: "", role: "" }]);
    };

    const removeStaff = (index: number) => {
        if (staff.length > 1) {
            setStaff(prev => prev.filter((_, i) => i !== index));
        }
    };

    const handleFarmerChange = (index: number, field: keyof FarmerData, value: string) => {
        const updatedFarmers = [...farmers];
        updatedFarmers[index] = {
            ...updatedFarmers[index],
            [field]: value
        };
        setFarmers(updatedFarmers);
    };

    const addFarmer = () => {
        setFarmers(prev => [...prev, { name: "", idNo: "", phoneNo: "", location: "", region: "", gender: "", county: "" }]); // Fixed county field
    };

    const removeFarmer = (index: number) => {
        if (farmers.length > 1) {
            setFarmers(prev => prev.filter((_, i) => i !== index));
        }
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
            comment: "",
            date: "",
            status: 'pending'
        });
        setStaff([{ name: "", role: "" }]);
        setFarmers([{ name: "", idNo: "", phoneNo: "", location: "", region: "", gender: "", county: "" }]); // Fixed county field
    };

    const handleAddOnboarding = async () => {
        try {
            if (!onboardingForm.topic || !onboardingForm.date) {
                toast({
                    title: "Validation Error",
                    description: "Please fill in all required fields",
                    variant: "destructive",
                });
                return;
            }

            // Validate staff data
            const validStaff = staff.filter(staffMember => staffMember.name.trim() !== "");
            if (validStaff.length === 0) {
                toast({
                    title: "Validation Error",
                    description: "Please add at least one staff member",
                    variant: "destructive",
                });
                return;
            }

            // Validate farmers data
            const validFarmers = farmers.filter(farmer => farmer.name.trim() !== "");
            if (validFarmers.length === 0) {
                toast({
                    title: "Validation Error",
                    description: "Please add at least one farmer",
                    variant: "destructive",
                });
                return;
            }

            setLoading(true);

            const onboardingData = {
                ...onboardingForm,
                date: new Date(onboardingForm.date),
                staff: validStaff,
                farmers: validFarmers,
                createdAt: new Date()
            };

            if (onboardingForm.id) {
                // Update existing record
                await updateDoc(doc(db, "Onboarding", onboardingForm.id), {
                    ...onboardingData,
                    updatedAt: new Date()
                });
                toast({
                    title: "Success",
                    description: "Onboarding record updated successfully",
                });
            } else {
                // Add new record
                await addDoc(collection(db, "Onboarding"), onboardingData);
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
            comment: record.comment || "",
            date: record.date.toISOString().split('T')[0],
            status: record.status
        });
        setStaff(record.staff.length > 0 ? record.staff : [{ name: "", role: "" }]);
        setFarmers(record.farmers.length > 0 ? record.farmers : [{ name: "", idNo: "", phoneNo: "", location: "", region: "", gender: "", county: "" }]); // Fixed county field
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
        setIsViewDialogOpen(true);
    };

    const handleExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            setLoading(true);
            
            const data = await readExcelFile(file);
            const validatedFarmers = validateExcelData(data);
            
            if (validatedFarmers.length === 0) {
                toast({
                    title: "No valid data",
                    description: "The Excel file doesn't contain valid farmer data or has incorrect format",
                    variant: "destructive",
                });
                return;
            }

            // Add validated farmers to the current list
            setFarmers(prev => [...prev.filter(f => f.name.trim() !== ""), ...validatedFarmers]);
            
            toast({
                title: "Success",
                description: `Successfully loaded ${validatedFarmers.length} farmers from Excel`,
            });

            setIsUploadDialogOpen(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
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

    const validateExcelData = (data: any[]): FarmerData[] => {
        return data.filter(item => item.name).map(item => ({
            name: item.name || "",
            gender: item.gender || item.Gender || "",
            idNo: item.idNo || item.idNumber || item.farmeridNo || "",
            phoneNo: item.phoneNo || item.phoneNumber || item.farmerphoneNo || "",
            location: item.location || item.farmerlocation || "",
            region: item.region || item.farmerregion || "",
            county: item.county || item.County || "" // Added county validation with multiple possible column names
        }));
    };

    const downloadTemplate = () => {
        const templateData = [
            {
                name: "Farmer Name",
                gender: "Gender (Male/Female)",
                idNo: "ID Number",
                phoneNo: "Phone Number",
                location: "Location",
                region: "Region",
                county: "County" // Added county to template
            }
        ];

        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Farmers Template");
        XLSX.writeFile(wb, "farmers_template.xlsx");
    };

    const handleExport = async () => {
        try {
            setExportLoading(true);
            
            if (filteredOnboarding.length === 0) {
                toast({
                    title: "No Data to Export",
                    description: "There are no records matching your current filters",
                    variant: "destructive",
                });
                return;
            }

            const exportData = filteredOnboarding.flatMap(record => 
                record.farmers.map(farmer => ({
                    Date: record.date.toLocaleDateString(),
                    Topic: record.topic,
                    Comment: record.comment || 'N/A',
                    Status: record.status,
                    'Staff Members': record.staff.map(s => `${s.name} (${s.role})`).join(', '),
                    'Farmer Name': farmer.name,
                    'Farmer Gender': farmer.gender || 'N/A',
                    'Farmer ID': farmer.idNo,
                    'Phone Number': farmer.phoneNo,
                    Location: farmer.location,
                    Region: farmer.region,
                    County: farmer.county || 'N/A', // Added county to export
                    'Created Date': record.createdAt?.toLocaleDateString() || 'N/A'
                }))
            );

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Onboarding Data");
            XLSX.writeFile(wb, `onboarding_data_${new Date().toISOString().split('T')[0]}.xlsx`);

            toast({
                title: "Export Successful",
                description: `Exported ${exportData.length} farmer records`,
            });
        } catch (error) {
            console.error("Error exporting data:", error);
            toast({
                title: "Export Failed",
                description: "Failed to export data. Please try again.",
                variant: "destructive",
            });
        } finally {
            setExportLoading(false);
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

    // Onboarding Card Component
    const OnboardingCard = ({ record }: { record: OnboardingData }) => {
        // Get unique regions from farmers in this record
        const uniqueRegions = useMemo(() => {
            const regions = record.farmers
                .map(farmer => farmer.region)
                .filter(region => region && region.trim() !== "");
            return [...new Set(regions)];
        }, [record.farmers]);

        // Get unique counties from farmers in this record
        const uniqueCounties = useMemo(() => {
            const counties = record.farmers
                .map(farmer => farmer.county)
                .filter(county => county && county.trim() !== "");
            return [...new Set(counties)];
        }, [record.farmers]);

        // Get gender distribution for this record
        const genderStats = useMemo(() => {
            const maleCount = record.farmers.filter(farmer => 
                farmer.gender && farmer.gender.toLowerCase() === 'male'
            ).length;
            const femaleCount = record.farmers.filter(farmer => 
                farmer.gender && farmer.gender.toLowerCase() === 'female'
            ).length;
            return { maleCount, femaleCount };
        }, [record.farmers]);

        const isSelected = record.id ? selectedRecords.includes(record.id) : false;

        return (
            <Card className={`bg-white shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 ${
                isSelected ? 'ring-2 ring-blue-500 border-blue-500' : ''
            }`}>
                <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                {getTopicIcon(record.topic)}
                                <CardTitle className="text-lg font-bold text-gray-800">
                                    {record.topic}
                                </CardTitle>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Calendar className="h-4 w-4" />
                                    <span>{record.date.toLocaleDateString()}</span>
                                </div>
                                {getStatusBadge(record.status)}
                            </div>
                        </div>
                        {userIsChiefAdmin && (
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => record.id && handleSelectRecord(record.id)}
                                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                            </div>
                        )}
                    </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                    {/* Comments Section - Displayed on card */}
                    {record.comment && (
                        <div className="pt-2 border-t">
                            <div className="flex items-start gap-2 text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border">
                                <MessageSquare className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                <div>
                                    <span className="font-medium text-gray-600">Comments:</span>
                                    <p className="mt-1 text-gray-800">{record.comment}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Quick Stats - Staff and Participants Count */}
                    <div className="grid grid-cols-1 pt-2 border-t">
                        <div className="flex flex-row-1 justify-between m-2 p-1">
                            <div className="flex items-center justify-center gap-2 text-sm font-medium text-blue-700 mb-1">
                                <User className="h-4 w-4" />
                                <span>Trainers</span>
                            </div>
                            <div className="text-md text-blue-800">
                                {record.staff.length}
                            </div>
                        </div>
                        <div className="flex flex-row-1 justify-between m-2 p-1">
                            <div className="flex items-center justify-center gap-2 text-sm font-medium text-green-700 mb-1">
                                <Users className="h-4 w-4" />
                                <span>Participants</span>
                            </div>
                            <div className="text-md text-green-800">
                                {record.farmers.length}
                            </div>
                        </div>
                    </div>

                    {/* Regions Display */}
                    <div className="pt-2 border-t">
                        <div className="flex flex-row-1 justify-between m-2 p-1">
                            <div className="flex items-center justify-center gap-1 text-xs text-gray-600">
                                <MapPin className="h-3 w-3" />
                                <span>Subcounty</span>
                            </div>
                            <div className="text-sm font-semibold text-green-600">
                                {uniqueRegions.length > 0 ? (
                                    <div className="flex flex-wrap gap-1 justify-end">
                                        {uniqueRegions.slice(0, 2).map((region, index) => (
                                            <Badge key={index} variant="secondary" className="text-xs">
                                                {region}
                                            </Badge>
                                        ))}
                                        {uniqueRegions.length > 2 && (
                                            <Badge variant="outline" className="text-xs">
                                                +{uniqueRegions.length - 2} more
                                            </Badge>
                                        )}
                                    </div>
                                ) : (
                                    <span className="text-gray-400">No regions</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Counties Display */}
                    

                    {/* Actions */}
                    <div className="flex gap-2 pt-3 border-t">
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 h-8 text-xs hover:bg-blue-50 hover:text-blue-600 border-blue-200"
                            onClick={() => handleView(record)}
                        >
                            <Eye className="h-3 w-3 mr-1" />
                            View Details
                        </Button>
                        {userIsChiefAdmin && (
                            <>
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
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header - Export available for chief admin, Add only for chief admin */}
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Additional Training</h1>
                <div className="flex gap-2">
                    {/* Bulk Delete Button - Only show when records are selected */}
                    {userIsChiefAdmin && selectedRecords.length > 0 && (
                        <Button 
                            variant="destructive" 
                            onClick={() => setIsBulkDeleteDialogOpen(true)}
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Selected ({selectedRecords.length})
                        </Button>
                    )}
                    {/* Export button available for chief admin */}
                    {userIsChiefAdmin && (
                        <Button onClick={handleExport} disabled={exportLoading || filteredOnboarding.length === 0}>
                            <Download className="w-4 h-4 mr-2" />
                            {exportLoading ? "Exporting..." : `Export (${filteredOnboarding.flatMap(r => r.farmers).length})`}
                        </Button>
                    )}
                    {/* Add button only for chief admin */}
                    {userIsChiefAdmin && (
                        <Button onClick={openAddDialog}>
                            <Plus className="w-4 h-4 mr-2" />
                            Add Training
                        </Button>
                    )}
                </div>
            </div>

            {/* Stats Cards - Available for all users */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatsCard 
                    title="TOTAL FARMERS" 
                    value={stats.totalFarmers} 
                    icon={Users}
                    description="Unique farmers trained"
                />
                <StatsCard 
                    title="TRAINING SESSIONS" 
                    value={stats.totalOnboarding} 
                    icon={GraduationCap}
                    description={`${stats.completedSessions} completed, ${stats.pendingSessions} pending`}
                />
                <StatsCard 
                    title="LOCATIONS COVERED" 
                    value={stats.uniqueLocations} 
                    icon={MapPin}
                    description="Unique locations reached"
                />
                <StatsCard 
                    title="COUNTIES COVERED" 
                    value={stats.uniqueCounties} 
                    icon={Map}
                    description="Unique counties reached"
                />
            </div>

            {/* Simplified Filters Section - Available for all users */}
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

            {/* Onboarding Records Cards with Pagination */}
            <Card className="shadow-lg border-0 bg-white">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-4">
                        <CardTitle>Additional Training Records</CardTitle>
                        {userIsChiefAdmin && displayedOnboarding.length > 0 && (
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={selectedRecords.length === displayedOnboarding.filter(r => r.id).length && displayedOnboarding.length > 0}
                                    onChange={handleSelectAllOnPage}
                                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <Label className="text-sm text-gray-600">
                                    Select all on page
                                </Label>
                            </div>
                        )}
                    </div>
                    {filteredOnboarding.length > cardsPerPage && (
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handlePrevPage}
                                disabled={!hasPrevPage}
                                className="h-8 w-8 p-0"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-sm text-gray-600">
                                Page {currentPage} of {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleNextPage}
                                disabled={!hasNextPage}
                                className="h-8 w-8 p-0"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                            <p className="text-muted-foreground mt-2">Loading additional training data...</p>
                        </div>
                    ) : displayedOnboarding.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            {onboarding.length === 0 ? "No onboarding records found" : "No records found matching your criteria"}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {displayedOnboarding.map((record, index) => (
                                <OnboardingCard key={record.id || index} record={record} />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* All edit/delete dialogs are only for chief admin */}
            {userIsChiefAdmin && (
                <>
                    {/* Add/Edit Onboarding Dialog */}
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogContent className="max-w-6xl max-h-[90vh]">
                            <DialogHeader>
                                <DialogTitle>
                                    {onboardingForm.id ? "Edit Onboarding Record" : "Add New Onboarding"}
                                </DialogTitle>
                            </DialogHeader>
                            <div className="grid grid-cols-1 gap-6 max-h-[70vh] overflow-y-auto">
                                {/* Basic Information */}
                                <div className="grid grid-cols-1 gap-4">
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
                                        <Label htmlFor="comment">Comment/Notes</Label>
                                        <textarea
                                            id="comment"
                                            name="comment"
                                            value={onboardingForm.comment}
                                            onChange={handleInputChange}
                                            placeholder="Add any comments or notes about this onboarding session..."
                                            rows={3}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
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
                                        <Label>Status</Label>
                                        <div className="flex gap-2">
                                            <Button
                                                type="button"
                                                variant={onboardingForm.status === 'pending' ? 'default' : 'outline'}
                                                onClick={() => handleStatusChange('pending')}
                                                className="flex-1"
                                            >
                                                <Clock className="h-4 w-4 mr-2" />
                                                Pending
                                            </Button>
                                            <Button
                                                type="button"
                                                variant={onboardingForm.status === 'completed' ? 'default' : 'outline'}
                                                onClick={() => handleStatusChange('completed')}
                                                className="flex-1"
                                            >
                                                <CheckCircle className="h-4 w-4 mr-2" />
                                                Completed
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Staff Section */}
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-lg font-semibold">Staff Members ({staff.filter(s => s.name.trim() !== "").length})</Label>
                                        <Button 
                                            type="button" 
                                            variant="outline" 
                                            size="sm"
                                            onClick={addStaff}
                                        >
                                            <UserPlus className="w-4 h-4 mr-1" />
                                            Add Staff
                                        </Button>
                                    </div>
                                    
                                    <div className="space-y-3 max-h-48 overflow-y-auto border rounded-lg p-4 bg-gray-50">
                                        {staff.map((staffMember, index) => (
                                            <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end p-3 border rounded bg-white">
                                                <div className="space-y-1">
                                                    <Label htmlFor={`staff-name-${index}`}>Staff Name *</Label>
                                                    <Input
                                                        id={`staff-name-${index}`}
                                                        value={staffMember.name}
                                                        onChange={(e) => handleStaffChange(index, 'name', e.target.value)}
                                                        placeholder="Enter staff name"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`staff-role-${index}`}>Staff Role *</Label>
                                                    <Input
                                                        id={`staff-role-${index}`}
                                                        value={staffMember.role}
                                                        onChange={(e) => handleStaffChange(index, 'role', e.target.value)}
                                                        placeholder="Enter staff role"
                                                    />
                                                </div>
                                                <div className="flex gap-2">
                                                    <div className="flex-1"></div>
                                                    {staff.length > 1 && (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-10 w-10 p-0 hover:bg-red-50 hover:text-red-600 border-red-200"
                                                            onClick={() => removeStaff(index)}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Farmers Section */}
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-lg font-semibold">Participants ({farmers.filter(f => f.name.trim() !== "").length})</Label>
                                        <div className="flex gap-2">
                                            <Button 
                                                type="button" 
                                                variant="outline" 
                                                size="sm"
                                                onClick={() => setIsUploadDialogOpen(true)}
                                            >
                                                <Upload className="w-4 h-4 mr-1" />
                                                Upload Excel
                                            </Button>
                                            <Button 
                                                type="button" 
                                                variant="outline" 
                                                size="sm"
                                                onClick={addFarmer}
                                            >
                                                <UserPlus className="w-4 h-4 mr-1" />
                                                Add Farmer
                                            </Button>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-3 max-h-64 overflow-y-auto border rounded-lg p-4 bg-gray-50">
                                        {farmers.map((farmer, index) => (
                                            <div key={index} className="grid grid-cols-1 md:grid-cols-7 gap-2 items-end p-3 border rounded bg-white">
                                                <div className="space-y-1">
                                                    <Label htmlFor={`farmer-name-${index}`}>Name *</Label>
                                                    <Input
                                                        id={`farmer-name-${index}`}
                                                        value={farmer.name}
                                                        onChange={(e) => handleFarmerChange(index, 'name', e.target.value)}
                                                        placeholder="Farmer name"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`farmer-gender-${index}`}>Gender</Label>
                                                    <select
                                                        id={`farmer-gender-${index}`}
                                                        value={farmer.gender}
                                                        onChange={(e) => handleFarmerChange(index, 'gender', e.target.value)}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                                    >
                                                        <option value="">Select</option>
                                                        <option value="Male">Male</option>
                                                        <option value="Female">Female</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`farmer-id-${index}`}>ID Number</Label>
                                                    <Input
                                                        id={`farmer-id-${index}`}
                                                        value={farmer.idNo}
                                                        onChange={(e) => handleFarmerChange(index, 'idNo', e.target.value)}
                                                        placeholder="ID number"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`farmer-phone-${index}`}>Phone</Label>
                                                    <Input
                                                        id={`farmer-phone-${index}`}
                                                        value={farmer.phoneNo}
                                                        onChange={(e) => handleFarmerChange(index, 'phoneNo', e.target.value)}
                                                        placeholder="Phone number"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`farmer-location-${index}`}>Location</Label>
                                                    <Input
                                                        id={`farmer-location-${index}`}
                                                        value={farmer.location}
                                                        onChange={(e) => handleFarmerChange(index, 'location', e.target.value)}
                                                        placeholder="Location"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`farmer-region-${index}`}>Region</Label>
                                                    <Input
                                                        id={`farmer-region-${index}`}
                                                        value={farmer.region}
                                                        onChange={(e) => handleFarmerChange(index, 'region', e.target.value)}
                                                        placeholder="Region"
                                                    />
                                                </div>
                                                <div className="flex gap-2">
                                                    <div className="space-y-1 flex-1">
                                                        <Label htmlFor={`farmer-county-${index}`}>County</Label>
                                                        <Input
                                                            id={`farmer-county-${index}`}
                                                            value={farmer.county}
                                                            onChange={(e) => handleFarmerChange(index, 'county', e.target.value)}
                                                            placeholder="County"
                                                        />
                                                    </div>
                                                    {farmers.length > 1 && (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-10 w-10 p-0 hover:bg-red-50 hover:text-red-600 border-red-200"
                                                            onClick={() => removeFarmer(index)}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
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

                    {/* Single Delete Confirmation Dialog */}
                    <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Confirm Deletion</DialogTitle>
                                <DialogDescription>
                                    Are you sure you want to delete the onboarding record for{" "}
                                    <strong>{selectedRecord?.topic}</strong> on {selectedRecord?.date.toLocaleDateString()}? 
                                    This will remove {selectedRecord?.farmers.length} farmer records. This action cannot be undone.
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

                    {/* Bulk Delete Confirmation Dialog */}
                    <Dialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Confirm Bulk Deletion</DialogTitle>
                                <DialogDescription>
                                    Are you sure you want to delete {selectedRecords.length} selected onboarding record(s)? 
                                    This action will permanently remove all associated farmer data and cannot be undone.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsBulkDeleteDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button variant="destructive" onClick={handleBulkDelete} disabled={loading}>
                                    {loading ? "Deleting..." : `Delete ${selectedRecords.length} Record(s)`}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* Upload Excel Dialog */}
                    <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Upload Farmers Excel</DialogTitle>
                                <DialogDescription>
                                   
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
                                    Supported formats: .xlsx, .xls, .csv. File should contain columns: name, gender, idNo, phoneNo, location, region, county
                                </p>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
                                    Cancel
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </>
            )}

            {/* View Participants Dialog - Available for all users */}
            <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
                <DialogContent className="max-w-6xl max-h-[80vh]">
                    <DialogHeader>
                        <DialogTitle>Additional Training Details</DialogTitle>
                        <DialogDescription>
                            {selectedRecord && (
                                <div className="grid grid-cols-1 gap-4 mt-2">
                                    <div>
                                        <strong>Date:</strong> {selectedRecord.date.toLocaleDateString()}
                                    </div>
                                    <div>
                                        <strong>Topic:</strong> {selectedRecord.topic}
                                    </div>
                                    <div>
                                        <strong>Status:</strong> {getStatusBadge(selectedRecord.status)}
                                    </div>
                                    
                                    {/* Comments removed from view dialog as requested */}
                                </div>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 gap-6 max-h-96 overflow-y-auto">
                        {/* Staff Details */}
                        <div>
                            <h4 className="font-semibold mb-3">Trainers ({selectedRecord?.staff.length || 0})</h4>
                            <div className="space-y-2">
                                {selectedRecord?.staff.map((staffMember, index) => (
                                    <div key={index} className="flex justify-between items-center p-1 border rounded bg-gray-50">
                                        <div>
                                            <span className="font-medium">{staffMember.name}</span>
                                            <Badge variant="secondary" className="ml-2">
                                                {staffMember.role}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Farmers Details */}
                        <div>
                            <h4 className="font-semibold mb-3">Participants ({selectedRecord?.farmers.length || 0})</h4>
                            <div className="max-h-64 overflow-y-auto">
                                <table className="w-full border-collapse border border-gray-300 text-sm">
                                    <thead>
                                        <tr className="bg-gray-100">
                                            <th className="text-left py-2 px-3 font-medium text-gray-600 border">Name</th>
                                            <th className="text-left py-2 px-3 font-medium text-gray-600 border">Gender</th>
                                            <th className="text-left py-2 px-3 font-medium text-gray-600 border">ID Number</th>
                                            <th className="text-left py-2 px-3 font-medium text-gray-600 border">Phone</th>
                                            <th className="text-left py-2 px-3 font-medium text-gray-600 border">Location</th>
                                            <th className="text-left py-2 px-3 font-medium text-gray-600 border">Region</th>
                                            <th className="text-left py-2 px-3 font-medium text-gray-600 border">County</th> {/* Added county column */}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedRecord?.farmers.map((farmer, index) => (
                                            <tr key={index} className="border-b hover:bg-gray-50">
                                                <td className="py-2 px-3 border text-gray-700">{farmer.name}</td>
                                                <td className="py-2 px-3 border text-gray-700">
                                                    <Badge variant={farmer.gender === 'Male' ? 'default' : 'secondary'} 
                                                           className={farmer.gender === 'Male' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'}>
                                                        {farmer.gender || 'N/A'}
                                                    </Badge>
                                                </td>
                                                <td className="py-2 px-3 border text-gray-700">
                                                    <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                                                        {farmer.idNo || 'N/A'}
                                                    </code>
                                                </td>
                                                <td className="py-2 px-3 border text-gray-700">{farmer.phoneNo || 'N/A'}</td>
                                                <td className="py-2 px-3 border text-gray-700">{farmer.location || 'N/A'}</td>
                                                <td className="py-2 px-3 border text-gray-700">
                                                    <Badge variant="secondary">{farmer.region || 'N/A'}</Badge>
                                                </td>
                                                <td className="py-2 px-3 border text-gray-700">
                                                    <Badge variant="outline" className="bg-purple-50 text-purple-700">
                                                        {farmer.county || 'N/A'}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default OnboardingPage;